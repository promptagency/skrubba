import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseNotes } from "./release-notes.ts";

const CHANGELOG = `# Changelog

Intro.

## [Unreleased]

## [1.1.0] - 2026-10-14

Ready for the public announcement.

### Added

- **Thing.** Text.

## [1.0.0] - 2026-10-12

### Fixed

- Old.

[Unreleased]: https://example/compare/v1.1.0...HEAD
[1.1.0]: https://example/compare/v1.0.0...v1.1.0
[1.0.0]: https://example/releases/tag/v1.0.0
`;

describe("releaseNotes", () => {
  it("returns the version's section without its heading, plus a link to the full diff", () => {
    expect(releaseNotes(CHANGELOG, "1.1.0")).toBe(
      "Ready for the public announcement.\n\n### Added\n\n- **Thing.** Text.\n\n**Full changes:** https://example/compare/v1.0.0...v1.1.0\n",
    );
  });

  it("stops before the link list at the bottom for the oldest version", () => {
    expect(releaseNotes(CHANGELOG, "1.0.0")).toBe("### Fixed\n\n- Old.\n\n**Full changes:** https://example/releases/tag/v1.0.0\n");
  });

  it("accepts a tag name with the v", () => {
    expect(releaseNotes(CHANGELOG, "v1.0.0")).toBe(releaseNotes(CHANGELOG, "1.0.0"));
  });

  it("throws for a version the changelog does not have, so a release never goes out empty", () => {
    expect(() => releaseNotes(CHANGELOG, "9.9.9")).toThrow(/9\.9\.9/);
  });

  it("has notes for the version in package.json", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version).length).toBeGreaterThan(20);
  });
});
