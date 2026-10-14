// A minimal XML tokenizer for office files. Workers have no DOMParser, and
// the readers only need elements, attributes and text in document order.
// It never throws: a broken document yields what it can.

export type XmlEvent =
  | { type: "open"; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { type: "close"; name: string }
  | { type: "text"; text: string };

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (whole, body: string) => {
    if (body[0] !== "#") return ENTITIES[body.toLowerCase()] ?? whole;
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function tagEnd(xml: string, from: number): number {
  let quote: string | null = null;
  for (let j = from; j < xml.length; j++) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return j;
  }
  return xml.length;
}

const ATTR = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function* xmlEvents(xml: string): Generator<XmlEvent> {
  const n = xml.length;
  let i = 0;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      yield { type: "text", text: decodeEntities(xml.slice(i)) };
      return;
    }
    if (lt > i) yield { type: "text", text: decodeEntities(xml.slice(i, lt)) };
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      yield { type: "text", text: xml.slice(lt + 9, end === -1 ? n : end) };
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<?", lt) || xml.startsWith("<!", lt)) {
      const end = xml.indexOf(">", lt + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const gt = tagEnd(xml, lt + 1);
    const raw = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith("/")) {
      yield { type: "close", name: raw.slice(1).trim() };
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const name = /^[^\s/>]+/.exec(body)?.[0] ?? "";
    const attrs: Record<string, string> = {};
    for (const m of body.slice(name.length).matchAll(ATTR)) attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? "");
    yield { type: "open", name, attrs, selfClosing };
    if (selfClosing) yield { type: "close", name };
  }
}
