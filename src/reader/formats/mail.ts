// The text of an email, .eml or .msg: the headers people read, then the body.
import { t } from "../../ui/copy.ts";

export interface MailHeaders {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
}

const LABELS = [
  ["from", "read.from"],
  ["to", "read.to"],
  ["cc", "read.cc"],
  ["subject", "read.subject"],
  ["date", "read.date"],
] as const;

export function mailText(headers: MailHeaders, body: string): string {
  const head = LABELS.flatMap(([key, label]) => {
    const value = headers[key]?.trim();
    return value ? [`${t(label)}: ${value}`] : [];
  }).join("\n");
  return [head, body.replace(/\r\n?/g, "\n").trim()].filter(Boolean).join("\n\n");
}
