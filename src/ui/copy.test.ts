import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COPY, countLabel, EXAMPLE, FAQ, HOWTO, rowLabel, t, TYPE_LABEL } from "./copy.ts";

const doc = readFileSync("docs/COPY.md", "utf8");
const rows = (section: string) => {
  const body = doc.slice(doc.indexOf(section)).split("\n## ")[0];
  return new Map([...body.matchAll(/^\| ([^|]+?) \| ([^|]+?) \|$/gm)].map((m) => [m[1], m[2]]));
};

describe("copy matches docs/COPY.md", () => {
  it("has every fixed string verbatim", () => {
    const fixed = rows("## Fasta strängar");
    for (const [key, text] of Object.entries(COPY)) expect(fixed.get(key), key).toBe(text);
  });

  it("has every type label verbatim", () => {
    const types = rows("## Typer");
    for (const [type, label] of Object.entries(TYPE_LABEL)) expect(types.get(type), type).toBe(label);
  });

  it("has the example text verbatim", () => {
    const quoted = doc
      .slice(doc.indexOf("## Exempeltext"))
      .split("\n## ")[0]
      .split("\n")
      .filter((l) => l.startsWith(">"))
      .map((l) => l.replace(/^> ?/, ""))
      .join("\n");
    expect(EXAMPLE.text).toBe(quoted);
  });

  it("has the video steps verbatim, in order", () => {
    const steps = [...doc.slice(doc.indexOf("## Så här funkar det")).split("\n## ")[0].matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
    expect(HOWTO.steps).toEqual(steps);
  });
});

describe("t", () => {
  it("fills placeholders", () => {
    expect(t("status.loading", { pct: 43 })).toBe("Laddar modell 43 %");
  });

  it("uses the singular for one", () => {
    expect(countLabel(1)).toBe("1 uppgift");
    expect(countLabel(14)).toBe("14 uppgifter");
  });
});

describe("Vanliga frågor matches docs/COPY.md", () => {
  it("has every question and answer verbatim, in order", () => {
    const section = doc.slice(doc.indexOf("## Vanliga frågor")).split("\n## ")[0];
    const items = [...section.matchAll(/^### (.+)\n\n(.+)$/gm)].map((m) => ({ q: m[1], a: m[2] }));
    expect(FAQ.items).toEqual(items);
  });
});

describe("index.html and the manifest use app.tagline", () => {
  it("has the tagline as description", () => {
    const html = readFileSync("index.html", "utf8");
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(html).toContain(`<meta name="description" content="${COPY["app.tagline"]}" />`);
    expect(manifest.description).toBe(COPY["app.tagline"]);
    expect(html).toContain(`<title>${COPY["app.title"]}</title>`);
  });
});

describe("rowLabel", () => {
  it("reads value, type in lower case, how many times and the state", () => {
    expect(rowLabel({ value: "Johan Lindqvist", type: "NAMN", count: 3, active: true })).toBe(
      "Johan Lindqvist, namn, 3 gånger, skrubbas",
    );
    expect(rowLabel({ value: "Umeå", type: "PLATS", count: 1, active: false })).toBe("Umeå, plats, 1 gång, behålls");
  });

  it("keeps abbreviations in capitals", () => {
    expect(rowLabel({ value: "x", type: "IBAN", count: 1, active: true })).toBe("x, IBAN, 1 gång, skrubbas");
    expect(rowLabel({ value: "x", type: "IP_ADRESS", count: 1, active: true })).toBe("x, IP-adress, 1 gång, skrubbas");
  });
});
