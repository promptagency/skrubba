import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCfb, errorReason } from "../../tests/fixtures/documents/build.ts";
import { openCfb } from "./cfb.ts";
import { extract } from "./extract.ts";

describe("openCfb", () => {
  it("reads streams across sectors and inside storages", () => {
    const big = Uint8Array.from({ length: 1500 }, (_, i) => i % 251);
    const cfb = openCfb(buildCfb({ WordDocument: big, "Mapp/Inre": new Uint8Array([1, 2, 3]) }));
    expect(cfb.stream("WordDocument")).toEqual(big);
    expect(cfb.stream("Mapp/Inre")).toEqual(new Uint8Array([1, 2, 3]));
    expect(cfb.stream("Saknas")).toBeNull();
    expect(cfb.stream("Mapp")).toBeNull();
    expect(cfb.paths().sort()).toEqual(["Mapp", "Mapp/Inre", "WordDocument"]);
  });

  it("reads small streams from the mini stream of a real Outlook file", () => {
    const cfb = openCfb(new Uint8Array(readFileSync("tests/fixtures/documents/tika/test-outlook.msg")));
    const texts = cfb
      .paths()
      .filter((p) => p.startsWith("__substg1.0_") && p.endsWith("001E"))
      .map((p) => new TextDecoder("windows-1252").decode(cfb.stream(p) ?? new Uint8Array(0)));
    expect(texts.some((s) => s.includes("Nouvel utilisateur de Outlook Express"))).toBe(true);
  });

  it("refuses a sector chain that loops", async () => {
    const bytes = buildCfb({ S: new Uint8Array(1500) });
    // Sector 0 is the FAT, sector 1 the directory, and the stream starts at sector 2: point it at itself.
    new DataView(bytes.buffer).setUint32(512 + 2 * 4, 2, true);
    expect(await errorReason(() => openCfb(bytes).stream("S"))).toBe("failed");
  });

  it("refuses bytes that are not a compound file", async () => {
    expect(await errorReason(() => openCfb(new Uint8Array(1024)))).toBe("failed");
    expect(await errorReason(() => openCfb(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])))).toBe("failed");
  });
});

describe("extract with compound files", () => {
  it("says a password-protected Word file is protected", async () => {
    const bytes = buildCfb({ EncryptionInfo: new Uint8Array(8), EncryptedPackage: new Uint8Array(8) });
    expect(await extract(bytes, "avtal.docx")).toEqual({ kind: "error", reason: "encrypted" });
  });

  it("refuses other compound files, such as old Excel", async () => {
    expect(await extract(buildCfb({ Workbook: new Uint8Array(8) }), "lista.xls")).toEqual({ kind: "error", reason: "unsupported" });
  });
});
