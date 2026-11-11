// Generators for the robustness exam (tests/robustness.test.ts). Everything
// here is invented: names, companies, addresses and numbers.

export interface FuzzCase {
  /** What the case probes, shown as the test name. */
  probe: string;
  text: string;
  /** Must not appear in the masked text (case-insensitive substring). */
  secrets: string[];
  /** Plain words that must stay readable in the masked text. */
  keeps?: string[];
  wordList?: string[];
  /** Leaks today, on the owner's word. Still run; a leak here does not fail the exam. */
  knownLeak?: true;
}

/** A fabricated personnummer, YYMMDD-NNNC, with a valid Luhn check digit. */
export function personnummer(yymmdd: string, nnn: string): string {
  const digits = `${yymmdd}${nnn}`;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]) * (i % 2 === 0 ? 2 : 1);
    sum += d > 9 ? d - 9 : d;
  }
  return `${yymmdd}-${nnn}${(10 - (sum % 10)) % 10}`;
}

const genitive = (s: string) => (/[sxz]$/i.test(s) ? s : `${s}s`);

interface Person {
  first: string;
  last: string;
}

// Invented people, each a different naming tradition.
const PEOPLE: Person[] = [
  { first: "Tilda", last: "Granqvist" },
  { first: "Yasmin", last: "Haddad" },
  { first: "Mikko", last: "Rautakorpi" },
  { first: "Oskar", last: "Fjällgren" },
  { first: "Leonora", last: "Bexell" },
  { first: "Dragan", last: "Petrović" },
];

// One template per surrounding a name can turn up in. `n` is the full name,
// `g` its genitive. Each says what it probes.
const NAME_TEMPLATES: Array<[probe: string, make: (n: string, g: string) => string, keeps: string[]]> = [
  ["name at sentence start", (n) => `${n} ringde i morse om semestern.`, ["semestern"]],
  ["name at sentence end", (n) => `I morse ringde ${n}.`, ["morse"]],
  ["genitive s", (_, g) => `${g} lön höjs från och med maj.`, ["lön"]],
  ["question and exclamation marks", (n) => `Har ${n}? Ja, ${n}!`, ["Har"]],
  ["in parentheses", (n) => `Ansvarig (${n}) har godkänt budgeten.`, ["budgeten"]],
  ["in Swedish quotes", (n) => `Hon skrev ”${n}” i rutan för kontaktperson.`, ["kontaktperson"]],
  ["in guillemets", (n) => `Avsändare: »${n}«, mottagen fredag.`, ["fredag"]],
  ["alone on a signature line", (n) => `Tack för i dag.\n\nVänliga hälsningar\n${n}\n`, ["hälsningar"]],
  ["bullet list", (n) => `Deltagare:\n- ${n}\n- Klara Vinterbo\n* Ebbe Sandlund`, ["Deltagare"]],
  ["tab table cell", (n) => `Namn\tAvdelning\tLön\n${n}\tEkonomi\t41000\nKlara Vinterbo\tIT\t45500`, ["Avdelning", "Ekonomi"]],
  ["markdown table", (n) => `| Namn | Roll |\n|---|---|\n| ${n} | Säljare |\n| Klara Vinterbo | Chef |`, ["Roll", "Säljare"]],
  ["email header", (n) => `Från: ${n}\nTill: Klara Vinterbo\nÄmne: Sjukskrivning\n\nHej Klara!`, ["Sjukskrivning"]],
  ["mixed Swedish and English", (n) => `Hi team, ${n} will join the call. Hon har varit sjuk.`, ["call"]],
  ["after a colon, no space", (n) => `Kontakt:${n}, ring efter lunch.`, ["lunch"]],
  ["semicolon list", (n) => `Närvarande: ${n}; Klara Vinterbo; Ebbe Sandlund.`, ["Närvarande"]],
  ["after a title", (n) => `Enhetschef ${n} beslutade om omplacering.`, ["omplacering"]],
  ["after a Swedish salutation", (n) => `Hej ${n}!\nHär kommer underlaget.`, ["underlaget"]],
];

// The other names in the templates must go too, so they count as secrets.
const BYSTANDERS = ["Klara Vinterbo", "Ebbe Sandlund"];

/** Each template with one invented person, rotating, in the given casing. */
export function nameCases(): FuzzCase[] {
  return NAME_TEMPLATES.map(([probe, make, keeps], i) => {
    const p = PEOPLE[i % PEOPLE.length];
    const full = `${p.first} ${p.last}`;
    const text = make(full, genitive(full));
    return { probe: `name: ${probe}`, text, secrets: [p.last, ...BYSTANDERS.filter((b) => text.includes(b))], keeps };
  });
}

/** The same base text in other casings and spacings. */
export function casingCases(): FuzzCase[] {
  const base = "Leonora Bexell på Brännvik Konsult AB ringde om Leonoras lön.";
  const secrets = ["Bexell", "Leonora", "Brännvik"];
  const keeps = ["ringde"];
  return [
    { probe: "casing: all lower case", text: base.toLowerCase(), secrets, keeps },
    { probe: "casing: all upper case", text: base.toUpperCase(), secrets, keeps: ["RINGDE"] },
    { probe: "spacing: double space inside the name", text: base.replace("Leonora Bexell", "Leonora  Bexell"), secrets, keeps },
    { probe: "spacing: non-breaking space inside the name", text: base.replace("Leonora Bexell", "Leonora Bexell"), secrets, keeps },
    { probe: "line break: name split over two lines", text: base.replace("Leonora Bexell", "Leonora\nBexell"), secrets, keeps },
    { probe: "line break: Windows line ends", text: `${base}\r\nHon återkommer.\r\n`, secrets, keeps },
  ];
}

/** Placeholder forms an LLM might write back, per ARCHITECTURE "Tolerant restore". */
export interface Mangle {
  probe: string;
  /** The mangled form, built from a canonical placeholder such as [NAMN_1]. */
  form: (type: string, n: number) => string;
  /** silent: restored without asking; suggest: offered as a suggestion; untouched: not a candidate at all. */
  expect: "silent" | "suggest" | "untouched";
  /** What the form becomes once restored, given the value. Defaults to the value. */
  restored?: (value: string) => string;
}

export const MANGLES: Mangle[] = [
  { probe: "exact", form: (t, n) => `[${t}_${n}]`, expect: "silent" },
  { probe: "no brackets", form: (t, n) => `${t}_${n}`, expect: "silent" },
  { probe: "backticks", form: (t, n) => `\`${t}_${n}\``, expect: "silent" },
  { probe: "double backticks", form: (t, n) => `\`\`${t}_${n}\`\``, expect: "silent" },
  { probe: "lower case", form: (t, n) => `[${t.toLowerCase()}_${n}]`, expect: "silent" },
  { probe: "title case, no brackets", form: (t, n) => `${t[0]}${t.slice(1).toLowerCase()}_${n}`, expect: "silent" },
  { probe: "genitive s after the bracket", form: (t, n) => `[${t}_${n}]s`, expect: "silent", restored: genitive },
  { probe: ":s after the bracket stays", form: (t, n) => `[${t}_${n}]:s`, expect: "silent", restored: (v) => `${v}:s` },
  { probe: "right after digits, in brackets", form: (t, n) => `18[${t}_${n}]`, expect: "silent", restored: (v) => `18${v}` },
  { probe: "space separator", form: (t, n) => `${t} ${n}`, expect: "suggest" },
  { probe: "hyphen separator", form: (t, n) => `${t}-${n}`, expect: "suggest" },
  { probe: "no separator", form: (t, n) => `${t}${n}`, expect: "suggest" },
  { probe: "leading zero", form: (t, n) => `[${t}_0${n}]`, expect: "suggest" },
  { probe: "inflected s, no brackets", form: (t, n) => `${t}_${n}s`, expect: "suggest", restored: genitive },
  { probe: "inflected :s, no brackets", form: (t, n) => `${t}_${n}:s`, expect: "suggest", restored: genitive },
  { probe: "space separator in brackets", form: (t, n) => `[${t} ${n}]`, expect: "suggest" },
  { probe: "bare form glued to a letter", form: (t, n) => `X${t}_${n}`, expect: "untouched" },
];

/** Translated type names (alias table) an LLM may use. Each is a suggestion. */
export const ALIAS_FORMS: Array<[alias: string, type: string]> = [
  ["NAME", "NAMN"],
  ["PERSON", "NAMN"],
  ["FIRST_NAME", "FÖRNAMN"],
  ["SURNAME", "EFTERNAMN"],
  ["LOCATION", "PLATS"],
  ["COMPANY", "ORGANISATION"],
  ["ORGANIZATION", "ORGANISATION"],
  ["ADDRESS", "ADRESS"],
  ["EMAIL", "EPOST"],
  ["E-POST", "EPOST"],
  ["PHONE", "TELEFON"],
  ["SSN", "PERSONNUMMER"],
  ["WORD", "ORD"],
];
