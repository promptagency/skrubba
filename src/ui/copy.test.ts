import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COPY, countLabel, EXAMPLE, HOW, t, TYPE_LABEL } from "./copy.ts";

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

describe("Så funkar Skrubba matches docs/COPY.md", () => {
  const section = doc.slice(doc.indexOf("## Sidan /sa-funkar-det")).split("\n## ")[0];

  it("has the heading", () => {
    expect(section).toContain(`Rubrik: ${HOW.title}`);
  });

  it("has the three paragraphs verbatim", () => {
    const paragraphs = [...section.matchAll(/^\d\. \*\*(.+?)\*\* (.+)$/gm)].map((m) => ({ lead: m[1], body: m[2] }));
    expect(HOW.paragraphs).toEqual(paragraphs);
  });

  it("has the credits line", () => {
    expect(section).toContain(`Sist på sidan: ${HOW.credits}`);
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
