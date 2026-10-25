// Rules of our own, shaped like a maskera Detector so they run in the same
// pipeline (and the worker clips model spans against them too).
import { type Detector, isPersonnummerShape } from "@maskera/core";
import { PLACES } from "./places.ts";

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

// The same for giro numbers: maskera masks a bankgiro or plusgiro only with a
// valid check digit, which an OCR error or a typo breaks. "bg"/"pg" count only
// with a number of the right shape right after.
const BANKGIRO_LABELLED = /(?:bankgiro(?:nr|nummer)?|bg(?:\.|nr)?)\s*:?\s*(\d{3,4}-\d{4})(?![\d-])/giu;
const PLUSGIRO_LABELLED = /(?:plusgiro(?:nr|nummer)?|postgiro|pg(?:\.|nr)?)\s*:?\s*(\d(?:[\d ]{0,7}\d)?-\d)(?![\d-])/giu;
const labelled = (label: "BANKGIRO" | "PLUSGIRO", re: RegExp): Detector => ({
  label,
  detect(input) {
    const out: Found[] = [];
    for (const m of input.matchAll(re)) {
      const value = m[1];
      const start = m.index + m[0].length - value.length;
      out.push({ start, end: start + value.length, value });
    }
    return out;
  },
});
export const bankgiroInContext = labelled("BANKGIRO", BANKGIRO_LABELLED);
export const plusgiroInContext = labelled("PLUSGIRO", PLUSGIRO_LABELLED);

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
    return everyOccurrence(input, shortest);
  },
};

/** Every whole-word occurrence of each name, genitive included, any whitespace between its words. */
function everyOccurrence(input: string, names: Iterable<string>): Found[] {
  const out: Found[] = [];
  for (const name of names) {
    const pattern = name.split(" ").map(escape).join(String.raw`\s+`);
    for (const m of input.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?::?s)?(?![\\p{L}\\p{N}])`, "gu")))
      out.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out.sort((a, b) => a.start - b.start);
}

// The name on an email header line ("From: Jonas Falk", "Till: Anna Berg
// <anna@…>, Erik Holm") is a person, also where it recurs in the body. The
// model misses it there, since a header is not a sentence. Only capitalised
// words count, so a memo's "Till: alla medarbetare" stays.
const HEADER_LINE = /^[^\S\n]*(?:from|från|to|till|cc|bcc|kopia|hemlig kopia|avsändare|mottagare|sender|reply-to|svara till)[^\S\n]*:([^\n]*)/gimu;
const HEADER_NAME =
  /(?<=^|[,;"'<(]|[^\S\n])(\p{Lu}[\p{L}'’-]*\.?(?:[^\S\n]+\p{Lu}[\p{L}'’-]*\.?){0,3})(?=[^\S\n]*(?:[,;"'<>)]|$))/gu;

export const headerName: Detector = {
  label: "NAMN",
  detect(input) {
    const names = new Set<string>();
    for (const line of input.matchAll(HEADER_LINE))
      for (const m of line[1].matchAll(HEADER_NAME)) if (m[1].replace(/\.$/, "").length >= 2) names.add(m[1].replace(/\.$/, ""));
    return everyOccurrence(input, names);
  },
};

// A number right after a word that says what it is ("kundnummer 48213377",
// "avtalsnummer AB-1234-567", "Anläggnings-ID 7359…", "anst.nr 10234")
// identifies a customer, a contract, a case, an employee or a passport.
// Without the label such numbers look like amounts or dates, so only
// labelled ones are masked. Any word ending in nummer, nr, id or kod counts,
// except the kinds maskera types on its own, a version and a page. A space
// before "nr" counts only with a dot or colon ("Ärende nr."), so "barnen nr 1" stays.
const OWN_TYPE = String.raw`(?:tele?fon|tel|mobil|person|p|samordnings|organisations|org|moms|vat|konto|bankkonto|post|bankgiro|plusgiro|lägenhets|journal|registrerings|reg|versions?|sid)`;
// The word before "id" has two letters or more: "sid" and "vid" are not "s-id" and "v-id". "Knr" and "Dnr" still count.
const NUMBER_LABEL = String.raw`(?:(?!${OWN_TYPE}[-.\s]?(?:nummer|nr|id|kod))(?:\p{L}+(?:-?(?:nummer|kod)|[-.]?nr\.?|\snr(?:\.|(?=\s*:)))|\p{L}{2,}-?id)|referens|ref(?:\.?\s?nr)?\.?)`;
const NUMBER_FILLER = String.raw`(?:\s*[:#]\s*|\s+(?:är\s+)?#?)`;
const NUMBER_VALUE = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}/.\-]*[\p{L}\p{N}])?(?: \d(?:[\p{N}/.\-]*\p{N})?(?![\p{L}\p{N}]))*`;
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

// An identifier after a word that is always followed by one, with no
// "nummer" needed: "order 2024-559871", "Ärende #771203", "Mål nr T 4455-23",
// "Pass nr 87654321", "Kolli 00370724850012345678", "Faktura 2024-0912". The
// value must look like an identifier (four digits, or three with a dash or
// slash), so "mål 3", "order 12" and a score stay, and an amount ("faktura
// 12 500 kr") is not taken.
const BARE_LABEL = String.raw`(?:ordern?|fakturan?|ärendet?|kolli|pass|mål(?:et)?|dnr|diarienr)`;
// Digits with "-", "/" and ".", single spaces between digit groups, a short
// letter prefix ("T 4455-23") and letter groups between separators ("2024/VGR/5567").
const BARE_VALUE = String.raw`(?:[A-ZÅÄÖ]{1,2}\s?)?\d(?:[\d/.\-]|\s(?=\d)|[A-ZÅÄÖ]{1,4}(?=[/.\-]))*\d`;
const BARE_LABELLED = new RegExp(
  String.raw`(?<![\p{L}\p{N}])${BARE_LABEL}((?:\s?nr\.?)?)(?![\p{L}])\s*([:#]?)\s*(${BARE_VALUE})(?![\p{L}\p{N}])(?!\s\d)(?!\s?(?:kr|sek|:-|€|%))`,
  "giu",
);

export const bareLabelNumber: Detector = {
  label: "REFERENSNUMMER",
  detect(input) {
    const out: Found[] = [];
    for (const m of input.matchAll(BARE_LABELLED)) {
      const [, nr, hash, value] = m;
      const digits = (value.match(/\d/g) ?? []).length;
      if (digits < 4 && !(digits >= 3 && /[-/]/.test(value))) continue;
      // The letter prefix is uppercase ("T 4455-23"): the i flag would take "är 2030".
      if (/^\p{Ll}/u.test(value)) continue;
      // A year after the bare word is a year ("Målet 2030"), not without "nr" or "#".
      if (!nr && !hash && /^(?:19|20)\d\d$/.test(value)) continue;
      const start = m.index + m[0].length - value.length;
      out.push({ start, end: start + value.length, value });
    }
    return out;
  },
};

// A chat or social handle ("@mona_sjolin", "@anna.berg", "@fjallbris_official")
// names a person or an account. The broadcast words of chat tools are not
// handles, and an email address is claimed by the email rule first.
const HANDLE = /(?<![\p{L}\p{N}])@(\p{L}[\p{L}\p{N}_]*(?:\.[\p{L}\p{N}_]+)*)(?![\p{L}\p{N}])/gu;
const BROADCAST = /^(?:channel|here|everyone|all|alla|kanal)$/iu;

export const handle: Detector = {
  label: "NAMN",
  detect(input) {
    const out: Found[] = [];
    for (const m of input.matchAll(HANDLE)) {
      const value = m[1];
      if (value.length < 2 || BROADCAST.test(value)) continue;
      out.push({ start: m.index + 1, end: m.index + 1 + value.length, value });
    }
    return out;
  },
};

// A date right after a word that says it is a birth date ("född 1987-03-14",
// "Född: 14 mars 1987", "Berg, f. 14/3-87"). Other dates stay: the AI often
// needs them to answer. The year alone ("född 1987") stays too.
const BIRTH_LABEL = String.raw`(?:född|fodd|födelsedatum|födelsedag|födelsetid|f\.|fdat\.?|date of birth|dob|birthdate)`;
const MONTH = String.raw`(?:jan(?:uari)?|feb(?:ruari)?|mars?|apr(?:il)?|maj|juni?|juli?|aug(?:usti)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
export const DATE = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{6}|\d{1,2}[./]\d{1,2}(?:[./-]|\s)\s?\d{2,4}|\d{1,2}(?::e)?\s+${MONTH}\.?(?:\s+-?\d{2,4})?)`;
const BIRTH_DATE = new RegExp(String.raw`(?<![\p{L}\p{N}])${BIRTH_LABEL}\s*:?\s*(?:den\s+)?(${DATE})(?![\p{L}\p{N}])`, "giu");

export const birthDate: Detector = {
  label: "FÖDELSEDATUM",
  detect(input) {
    const out: Found[] = [];
    for (const m of input.matchAll(BIRTH_DATE)) {
      const value = m[1];
      const start = m.index + m[0].length - value.length;
      out.push({ start, end: start + value.length, value });
    }
    return out;
  },
};

// A known place at the start of a compound ("Malmöbor", "Stockholmskontoret",
// "Göteborgsteamet") when the model misses it, as it does when the place does
// not also stand alone. Only the place is masked: "[PLATS_1]bor". The tail is
// a listed word, so a surname ("Lundgren") is never cut.
const PLACE_TAIL =
  "bo|bor|borna|kontoret|kontor|kontorets|regionen|området|trakten|avtalet|teamet|filialen|fabriken|butiken|butikerna|" +
  "mässan|projektet|marknaden|resan|besöket|mötet|festivalen|hamnen|flygplatsen|universitetet|högskolan|kommunen|" +
  "polisen|tingsrätt|tingsrätten|lagret|anläggningen|enheten|avdelningen|gruppen|kunden|kunderna|distriktet|depån|" +
  "terminalen|centralen|sjukhuset|skolan|dialekt|dialekten|trafiken|området|delen|området";
const PLACE_COMPOUND = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${PLACES.filter((p) => p.length >= 4).join("|")})s?(?:${PLACE_TAIL})(?![\p{L}])`,
  "gu",
);

export const placeCompound: Detector = {
  label: "PLATS",
  detect(input) {
    return [...input.matchAll(PLACE_COMPOUND)].map((m) => ({ start: m.index, end: m.index + m[1].length, value: m[1] }));
  },
};

// A tab-separated table (as the document readers write one) with a column
// headed Född, Födelsedatum or the like: each date in that column is a birth
// date, though no label stands next to it. A blank line ends the table.
const BIRTH_HEADER = new RegExp(String.raw`^${BIRTH_LABEL}\.?$`, "iu");
const DATE_CELL = new RegExp(String.raw`^(${DATE})$`, "u");

export const birthColumn: Detector = {
  label: "FÖDELSEDATUM",
  detect(input) {
    const out: Found[] = [];
    let column = -1;
    let offset = 0;
    for (const line of input.split("\n")) {
      const cells = line.split("\t");
      if (!line.trim()) column = -1;
      else if (cells.length > 1 && column < 0) column = cells.findIndex((c) => BIRTH_HEADER.test(c.trim()));
      else if (column >= 0 && cells[column] !== undefined) {
        const cell = cells[column];
        const m = DATE_CELL.exec(cell.trim());
        if (m) {
          const start = offset + cells.slice(0, column).reduce((n, c) => n + c.length + 1, 0) + cell.indexOf(m[1]);
          out.push({ start, end: start + m[1].length, value: m[1] });
        }
      }
      offset += line.length + 1;
    }
    return out;
  },
};

// A post office box ("Box 1234") is an address. maskera's address rule
// wants a street name.
const BOX = /(?<![\p{L}\p{N}])(?:Box|Postbox)\s?\d{2,6}(?![\p{L}\p{N}])/giu;

export const postbox: Detector = {
  label: "ADRESS",
  detect(input) {
    return [...input.matchAll(BOX)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
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

// A personnummer broken by a space or a line break, as OCR and copy-paste
// leave it ("730928-\n1231", "8506 23-2381"). The dash must be there and
// stand after six or eight digits, so a phone number split by spaces
// ("070-123 45 67") is not taken for one.
const GAP = String.raw`[^\S\n]*\n?[^\S\n]*`;
const SPLIT_PNR = new RegExp(
  String.raw`(?<![\p{L}\p{N}])\d(?:${GAP}\d){5}(?:(?:${GAP}\d){2})?${GAP}[-+]${GAP}\d(?:${GAP}\d){3}(?![\p{L}\p{N}])`,
  "gu",
);

export const splitPersonnummer: Detector = {
  label: "PERSONNUMMER",
  detect(input) {
    return [...input.matchAll(SPLIT_PNR)]
      .filter((m) => /\s/.test(m[0]) && (m[0].match(/\n/g)?.length ?? 0) <= 1 && isPersonnummerShape(m[0].replace(/\s/g, "")))
      .map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
  },
};

// A phone number read out digit by digit, as in a call transcript ("noll sju
// noll två ett fyra sex fem åtta"). It starts with noll, as Swedish numbers
// do, and has at least seven digits, so counting ("ett, två, tre") stays.
const DIGIT_WORD = "(?:noll|ett|en|två|tre|fyra|fem|sex|sju|åtta|nio)";
const SPOKEN_PHONE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])noll(?:(?:,?[^\S\n]+|-)${DIGIT_WORD}){6,}(?![\p{L}\p{N}])`,
  "giu",
);

export const spokenPhone: Detector = {
  label: "TELEFON",
  detect(input) {
    return [...input.matchAll(SPOKEN_PHONE)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
  },
};

// A foreign-format number with the 00 exit code ("0046 70 123 45 67"). maskera's
// phone rule knows +46 but not 00, so the personnummer rule took the digits.
const INTL_PHONE = /(?<![\p{L}\p{N}+])00[1-9]\d{0,2}[\s-]?\d(?:[\s-]?\d){6,11}(?![\p{L}\p{N}])/gu;

export const intlPhone: Detector = {
  label: "TELEFON",
  detect(input) {
    return [...input.matchAll(INTL_PHONE)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
  },
};

// An email address read out ("pelle punkt johansson snabel-a outlook punkt com").
const SPOKEN_WORD = String.raw`[\p{L}\p{N}_]+(?:-[\p{L}\p{N}_]+)*`;
const SPOKEN_EMAIL = new RegExp(
  String.raw`(?<![\p{L}\p{N}])${SPOKEN_WORD}(?:\s+punkt\s+${SPOKEN_WORD})*\s+snabel(?:-|\s)?a\s+${SPOKEN_WORD}(?:\s+punkt\s+${SPOKEN_WORD})+(?![\p{L}\p{N}])`,
  "giu",
);

export const spokenEmail: Detector = {
  label: "EPOST",
  detect(input) {
    return [...input.matchAll(SPOKEN_EMAIL)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
  },
};

// A company name of initials joined by "&" ("H&M", "AT&T"). The model sees no
// word there and misses it. Common business shorthand is left alone.
const AMPERSAND_NAME = /(?<![\p{L}\p{N}&])\p{Lu}{1,3}[^\S\n]?&[^\S\n]?\p{Lu}{1,3}(?![\p{L}\p{N}&])/gu;
const AMPERSAND_SHORTHAND = new Set(["R&D", "Q&A", "M&A", "P&L", "B&B", "F&B", "D&I", "T&C"]);

export const ampersandName: Detector = {
  label: "ORGANISATION",
  detect(input) {
    return [...input.matchAll(AMPERSAND_NAME)]
      .filter((m) => !AMPERSAND_SHORTHAND.has(m[0].replace(/\s/g, "")))
      .map((m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
  },
};
