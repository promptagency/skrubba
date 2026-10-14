// Rules of our own, shaped like a maskera Detector so they run in the same
// pipeline (and the worker clips model spans against them too).
import type { Detector } from "@maskera/core";

type Found = { start: number; end: number; value: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// maskera only masks Luhn-valid org.nr. A labelled number is masked even with
// a typo in the check digit: a miss is worse than an over-mask.
const ORGNR_LABELLED = /(?:org\.?\s?nr\.?|organisationsnummer)\s*:?\s*(\d{6}-?\d{4})(?!\d)/giu;

export const orgnrInContext: Detector = {
  label: "ORGANISATIONSNUMMER",
  detect(input) {
    const out: Found[] = [];
    for (const m of input.matchAll(ORGNR_LABELLED)) {
      const value = m[1];
      const start = m.index + m[0].length - value.length;
      out.push({ start, end: start + value.length, value });
    }
    return out;
  },
};

// A Swedish VAT number is SE + the organisationsnummer (or a sole trader's
// personnummer) + 01. maskera misses it because the digits touch the letters.
const MOMSNUMMER = /(?<![\p{L}\p{N}])SE\s?\d{6}-?\d{4}\s?01(?![\p{L}\p{N}])/gu;

export const momsnummer: Detector = {
  label: "ORGANISATIONSNUMMER",
  detect(input) {
    return [...input.matchAll(MOMSNUMMER)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
  },
};

// Capitalised words before a company form ("Norrström Media AB") are a
// company name. The model misses company names it has not seen, often. Only
// the name is masked: "[ORGANISATION_1] AB" tells the AI it is a company, and
// the name alone elsewhere gets the same placeholder.
const NAME_WORD = String.raw`[\p{Lu}\p{N}][\p{L}\p{N}'’-]*`;
export const COMPANY_FORM = String.raw`(?:AB|HB|KB|Aktiebolag|Handelsbolag|Kommanditbolag|Ltd|Limited|Inc|LLC|GmbH|Oyj?|ASA?|A\/S|ApS|BV)(?:[^\S\n]\(publ\))?`;
const COMPANY = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${NAME_WORD}(?:(?:[^\S\n]+|[^\S\n]+&[^\S\n]+)${NAME_WORD}){0,4})[^\S\n]+${COMPANY_FORM}(?![\p{L}\p{N}])`,
  "gu",
);

// Capitalised words that open a sentence or a heading rather than a name:
// "Enligt Norrström Media AB" is about Norrström Media.
const OPENERS = new Set(
  (
    "enligt kontakta hos med från till vi jag ni de han hon och men för av på i om efter mellan där här det den " +
    "detta denna dessa ring mejla skicka se via mot under genom utan inom både samt eller att när som nu även " +
    "bolaget företaget kunden leverantören köparen säljaren avtal avtalet parterna part hej tack välkommen " +
    "hälsningar ägare ägaren beställare beställaren uppdragsgivare uppdragsgivaren"
  ).split(" "),
);

function withoutOpeners(name: string): string {
  const words = name.split(/\s+/);
  while (words.length > 0 && (OPENERS.has(words[0].toLowerCase()) || words[0] === "&")) words.shift();
  return words.join(" ");
}

export const companyName: Detector = {
  label: "ORGANISATION",
  detect(input) {
    const names = new Set<string>();
    for (const m of input.matchAll(COMPANY)) {
      const name = withoutOpeners(m[1]);
      if (name.length >= 2) names.add(name);
    }
    // A name that ends with another found name has an opener in front that
    // the list does not know ("Tillsammans Norrström Media"): use the shorter.
    const shortest = [...names].filter((n) => ![...names].some((m) => n.endsWith(` ${m}`)));
    // Every occurrence of the name, with or without the form: "Norrström Media", "Norrström Media:s".
    const out: Found[] = [];
    for (const name of shortest) {
      const pattern = name.split(" ").map(escape).join(String.raw`\s+`);
      for (const m of input.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?::?s)?(?![\\p{L}\\p{N}])`, "gu")))
        out.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
    }
    return out.sort((a, b) => a.start - b.start);
  },
};

// A number right after a word that says what it is ("kundnummer 48213377",
// "avtalsnummer AB-1234-567", "Anläggnings-ID 7359…") identifies a customer,
// a contract or a case. Without the label such numbers look like amounts or
// dates, so only labelled ones are masked.
const NUMBER_LABEL = String.raw`(?:(?:kund|avtals?|order|faktura|referens|ärende|medlems?|anställnings|personal|kontrakts?|boknings|försäkrings|abonnemangs|objekt|anläggnings|mätpunkts|ocr)-?(?:nummer|nr\.?|id)|referens|ref(?:\.?\s?nr)?\.?)`;
const NUMBER_FILLER = String.raw`(?:\s*[:#]\s*|\s+(?:är\s+)?#?)`;
const NUMBER_VALUE = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}/.\-]*[\p{L}\p{N}])?(?: \d{2,}(?![\p{L}\p{N}]))*`;
const LABELLED = new RegExp(String.raw`(?<![\p{L}\p{N}])${NUMBER_LABEL}(?![\p{L}])${NUMBER_FILLER}(${NUMBER_VALUE})`, "giu");

export const labelledNumber: Detector = {
  label: "REFERENSNUMMER",
  detect(input) {
    const out: Found[] = [];
    for (const m of input.matchAll(LABELLED)) {
      const value = m[1];
      if (!/\d/.test(value)) continue;
      const start = m.index + m[0].length - value.length;
      out.push({ start, end: start + value.length, value });
    }
    return out;
  },
};

// A web address without https:// or www. ("foretaget.se", "shop.foretaget.se/om").
// Top-level domains are listed, and lowercase, so "t.ex." and "rapport.pdf"
// stay out.
const TLDS = "se|nu|com|net|org|io|eu|info|biz|dk|no|fi|is|ax|de|uk|co|me|tv|fm|app|dev|ai|tech|online|shop|store";
const LABEL = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?`;
const NOT_BEFORE = String.raw`(?<![\p{L}\p{N}@./_-])`;
const NOT_AFTER = String.raw`(?![\p{L}\p{N}@_-]|\.[\p{L}\p{N}])`;
const PATH = String.raw`(?:\/[^\s<>")]*[^\s<>").,;:!?])?`;
const DOMAIN = new RegExp(String.raw`${NOT_BEFORE}(?:${LABEL}\.)+(?:${TLDS})${NOT_AFTER}${PATH}`, "gu");
const EMAIL_DOMAIN = new RegExp(String.raw`@((?:${LABEL}\.)+\p{L}{2,})`, "gu");

export const domainName: Detector = {
  label: "URL",
  detect(input) {
    const found = new Map<number, Found>();
    const add = (start: number, value: string) => {
      if (!found.has(start)) found.set(start, { start, end: start + value.length, value });
    };
    for (const m of input.matchAll(DOMAIN)) add(m.index, m[0]);
    // The domain of an email address is as identifying as the address itself.
    const emailDomains = new Set([...input.matchAll(EMAIL_DOMAIN)].map((m) => m[1]));
    for (const domain of emailDomains)
      for (const m of input.matchAll(new RegExp(`${NOT_BEFORE}${escape(domain)}${NOT_AFTER}`, "gu"))) add(m.index, m[0]);
    return [...found.values()].sort((a, b) => a.start - b.start);
  },
};
