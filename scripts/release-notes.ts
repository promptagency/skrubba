// The release notes for one version, taken from CHANGELOG.md, for the GitHub
// release page that .github/workflows/release.yml creates when a v* tag is
// pushed. Runs with plain Node (24 strips the types), no npm install needed:
//   node scripts/release-notes.ts v1.1.1 > notes.md
import { readFileSync } from "node:fs";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The version's section without its heading, plus a link to its full diff. Throws if there is none. */
export function releaseNotes(changelog: string, tagOrVersion: string): string {
  const version = tagOrVersion.replace(/^v/, "");
  const heading = new RegExp(`^## \\[${escape(version)}\\][^\\n]*\\n`, "m").exec(changelog);
  if (!heading) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const rest = changelog.slice(heading.index + heading[0].length);
  const end = rest.search(/^## \[|^\[[^\]]+\]: /m);
  const body = (end === -1 ? rest : rest.slice(0, end)).trim();
  const link = new RegExp(`^\\[${escape(version)}\\]: (\\S+)`, "m").exec(changelog)?.[1];
  return `${body}\n${link ? `\n**Full changes:** ${link}\n` : ""}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), process.argv[2] ?? ""));
}
