// The browser tests that passed only on CI's retry, for the run's summary on
// GitHub. A retry hides a bug that only shows up sometimes, so every flaky
// test is listed for someone to check. Runs with plain Node (24 strips the
// types), on Playwright's JSON report:
//   node scripts/flaky.ts test-results/report.json >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from "node:fs";

interface Suite {
  title: string;
  specs?: Array<{ title: string; tests: Array<{ projectName: string; status: string }> }>;
  suites?: Suite[];
}

/** "file › describe › test [browser]" for every test Playwright marked flaky. */
export function flakyTests(report: { suites?: Suite[] }): string[] {
  const out: string[] = [];
  const walk = (suite: Suite, path: string[]) => {
    const here = [...path, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) if (test.status === "flaky") out.push(`${[...here, spec.title].join(" › ")} [${test.projectName}]`);
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return out;
}

export function summary(flaky: string[]): string {
  if (!flaky.length) return "No flaky browser tests: every test passed on its first try.\n";
  return `## Flaky browser tests\n\nThese failed once and passed on the retry. Check whether the test or the app is at fault: an app bug that only shows up sometimes looks like this too.\n\n${flaky.map((t) => `- ${t}`).join("\n")}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] ?? "test-results/report.json";
  process.stdout.write(existsSync(file) ? summary(flakyTests(JSON.parse(readFileSync(file, "utf8")))) : `No browser test report at ${file}.\n`);
}
