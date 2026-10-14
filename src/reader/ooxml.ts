// Relationships in Word, Excel and PowerPoint files: which part a header,
// slide or sheet is, by id.
import { xmlEvents } from "./xml.ts";

/** The relationships in a .rels part. `type` is the last segment of the type URL; `target` is a zip path. */
export function relationships(xml: string, base: string): Array<{ id: string; type: string; target: string }> {
  const out: Array<{ id: string; type: string; target: string }> = [];
  for (const ev of xmlEvents(xml)) {
    if (ev.type !== "open" || ev.name !== "Relationship" || ev.attrs.TargetMode === "External") continue;
    const { Id: id, Type: type, Target: target } = ev.attrs;
    if (!id || !type || !target) continue;
    out.push({ id, type: type.slice(type.lastIndexOf("/") + 1), target: resolve(base, target) });
  }
  return out;
}

function resolve(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
