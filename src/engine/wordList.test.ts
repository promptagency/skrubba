import { describe, expect, it } from "vitest";
import { findTerms, parseWordList } from "./wordList.ts";

const surfaces = (text: string, terms: string[]) =>
  findTerms(text, terms, "wordlist").map((s) => text.slice(s.start, s.end));

describe("parseWordList", () => {
  it("splits on lines, trims and drops blanks and duplicates", () => {
    expect(parseWordList("  Polaris Air \n\nNordljus\npolaris air\n")).toEqual(["Polaris Air", "Nordljus"]);
  });
});

describe("findTerms", () => {
  it("matches case-insensitively", () => {
    expect(surfaces("POLARIS AIR och polaris air", ["Polaris Air"])).toEqual(["POLARIS AIR", "polaris air"]);
  });

  it("matches whole words only", () => {
    expect(surfaces("Atea och Ateamet", ["Atea"])).toEqual(["Atea"]);
  });

  it("matches genitive forms but leaves the s outside the span", () => {
    expect(surfaces("Nordljus:s budget och Fjällgrens jacka", ["Nordljus", "Fjällgren"])).toEqual([
      "Nordljus",
      "Fjällgren",
    ]);
  });

  it("treats regex characters in terms literally", () => {
    expect(surfaces("Kund C++ (ny) och Cxx", ["C++ (ny)"])).toEqual(["C++ (ny)"]);
  });

  it("prefers the longer term when terms overlap", () => {
    expect(surfaces("Projekt Nordljus startar", ["Nordljus", "Projekt Nordljus"])).toEqual(["Projekt Nordljus"]);
  });

  it("types matches as ORD with the given source", () => {
    const [span] = findTerms("Nordljus", ["Nordljus"], "manual");
    expect(span).toEqual({ start: 0, end: 8, type: "ORD", source: "manual" });
  });
});
