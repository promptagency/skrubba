import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("CHANGELOG.md", () => {
  const changelog = read("CHANGELOG.md");
  const { version } = JSON.parse(read("package.json")) as { version: string };

  it("has an entry for the version in package.json", () => {
    expect(changelog).toMatch(new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m"));
  });

  it("keeps an Unreleased section on top for changes since then", () => {
    expect(changelog.indexOf("## [Unreleased]")).toBeGreaterThan(-1);
    expect(changelog.indexOf("## [Unreleased]")).toBeLessThan(changelog.indexOf(`## [${version}]`));
  });
});
