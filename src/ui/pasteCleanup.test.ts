import { describe, expect, it } from "vitest";
import { cleanPaste } from "./pasteCleanup.ts";

// The layout of a real agreement copied from a PDF, with made-up details.
const AGREEMENT = [
  "1. Parter:",
  "Arbetsgivare, Norrström Media AB, Org.nr. 556677-8899,",
  "Storgatan 5, Uppsala.",
  "Arbetstagare: Anna Berg, personnummer 850412-1234, AI-",
  "teknik strateg.",
  "2. Bakgrund",
  "Anna Berg är anställd i Norrström sedan april 2021 som AI-teknik strateg. Norrström Media",
  "har genomgått en omorganisation på grund av svikande efterfrågan från kunderna och",
  "har tagit bort 7 tjänster från organisationen på grund av arbetsbrist. Rollen som Anna",
  "Berg innehar är en av de berörda tjänsterna. Denna överenskommelse har initierats av",
  "arbetsgivaren.",
  "3. Parterna är överens om följande:",
  "1. Anna Berg sägs upp på grund av arbetsbrist den 20.",
  "december 2024.",
].join("\n");

describe("cleanPaste: line breaks", () => {
  it("joins lines broken mid-sentence and keeps headings and numbered items on their own lines", () => {
    expect(cleanPaste(AGREEMENT)).toEqual({
      joined: true,
      text: [
        "1. Parter:",
        "Arbetsgivare, Norrström Media AB, Org.nr. 556677-8899, Storgatan 5, Uppsala.",
        "Arbetstagare: Anna Berg, personnummer 850412-1234, AI-teknik strateg.",
        "2. Bakgrund",
        "Anna Berg är anställd i Norrström sedan april 2021 som AI-teknik strateg. Norrström Media har genomgått en omorganisation på grund av svikande efterfrågan från kunderna och har tagit bort 7 tjänster från organisationen på grund av arbetsbrist. Rollen som Anna Berg innehar är en av de berörda tjänsterna. Denna överenskommelse har initierats av arbetsgivaren.",
        "3. Parterna är överens om följande:",
        "1. Anna Berg sägs upp på grund av arbetsbrist den 20. december 2024.",
      ].join("\n"),
    });
  });

  it("removes the hyphen of a word split across lines", () => {
    const text = "Vi behöver planera rehabili-\nteringen i god tid och boka in ett\nmöte med henne i nästa vecka.";
    expect(cleanPaste(text).text).toBe("Vi behöver planera rehabiliteringen i god tid och boka in ett möte med henne i nästa vecka.");
  });

  it("keeps blank lines between paragraphs", () => {
    const text = "Första stycket fortsätter\npå nästa rad.\n\nAndra stycket fortsätter\npå nästa rad.";
    expect(cleanPaste(text).text).toBe("Första stycket fortsätter på nästa rad.\n\nAndra stycket fortsätter på nästa rad.");
  });

  it("leaves a typed letter, an address block and a list alone", () => {
    const letter = "Hej Karin,\n\nJag skriver angående Johan.\nHan har varit sjuk.\n\nHälsningar\nMicke";
    const address = "Anna Berg\nStorgatan 5\n123 45 Uppsala";
    const list = "Att göra:\n- ringa Anna\n- boka möte\n- skicka avtalet";
    for (const text of [letter, address, list]) expect(cleanPaste(text)).toEqual({ text, joined: false });
  });

  it("leaves a single broken line alone, since one break is not a pattern", () => {
    const text = "Hej Anna,\nhoppas allt är bra.";
    expect(cleanPaste(text)).toEqual({ text, joined: false });
  });
});

describe("cleanPaste: hidden characters", () => {
  it("replaces PDF ligatures, odd spaces and Windows line endings, and drops soft hyphens and zero-width characters", () => {
    expect(cleanPaste("ﬁl\u00ADen\u00A0ﬂyttas\u200B\r\nnu")).toEqual({ text: "filen flyttas\nnu", joined: false });
  });

  it("composes letters and accents written as two characters", () => {
    expect(cleanPaste("Ha\u0308gvall och Rene\u0301").text).toBe("Hägvall och René");
  });

  it("drops spaces at the end of a line", () => {
    expect(cleanPaste("Hej  \nAnna").text).toBe("Hej\nAnna");
  });

  it("copes with a hundred thousand trailing spaces and two hundred thousand lines", () => {
    const started = performance.now();
    expect(cleanPaste(`Hej${" ".repeat(100_000)}\nAnna`).text).toBe("Hej\nAnna");
    expect(cleanPaste("x\n".repeat(200_000)).text.length).toBe(400_000); // Math.max(...lines) threw here
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
