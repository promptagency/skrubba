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

  it("matches whole words, or the start of a compound word in any case", () => {
    expect(surfaces("Atea, Atealeveransen och atealeveransen", ["Atea"])).toEqual(["Atea", "Atea", "atea"]);
    expect(surfaces("FENIXLANSERINGEN", ["Fenix"])).toEqual(["FENIX"]);
    expect(surfaces("Kampanjen Sommarglöd och Sommarglödens budget", ["sommarglöd"])).toEqual([
      "Sommarglöd",
      "Sommarglöd",
    ]);
  });

  it("does not match terms shorter than four characters inside longer words", () => {
    expect(surfaces("Per på Personalavdelningen", ["Per"])).toEqual(["Per"]);
  });

  it("over-masks an ordinary word that starts with a term, by design", () => {
    expect(surfaces("Anna har en annan tid", ["Anna"])).toEqual(["Anna", "anna"]);
  });

  it("carries the term as the user typed it", () => {
    expect(findTerms("fenixlanseringen", ["Fenix"], "wordlist").map((s) => s.term)).toEqual(["Fenix"]);
  });

  it("matches a lowercase genitive", () => {
    expect(surfaces("fjällgrens jacka", ["Fjällgren"])).toEqual(["fjällgren"]);
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
    expect(span).toEqual({ start: 0, end: 8, type: "ORD", source: "manual", term: "Nordljus" });
  });
});

describe("the head word of a multi-word term", () => {
  const values = (text: string, terms: string[]) => findTerms(text, terms, "wordlist").map((s) => text.slice(s.start, s.end));

  it("is masked where it starts a hyphenated or compound word, but not bare", () => {
    expect(values("Aurora X släpps. Aurora-lanseringen och auroramötet är hemliga. Aurora själv är en gud.", ["Aurora X"])).toEqual([
      "Aurora X",
      "Aurora",
      "aurora",
    ]);
  });

  it("is stored as the head word, so restore writes the compound back", () => {
    expect(findTerms("Aurora-lanseringen", ["Aurora X"], "wordlist").map((s) => s.term)).toEqual(["Aurora"]);
  });

  it("is not masked when it is short", () => {
    expect(values("Max 2 lanseras. Max-teamet.", ["Max 2"])).toEqual(["Max 2"]);
  });
});
