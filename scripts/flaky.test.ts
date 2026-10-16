import { describe, expect, it } from "vitest";
import { flakyTests, summary } from "./flaky.ts";

// The shape of Playwright's JSON report, cut down to what the script reads.
const report = {
  suites: [
    {
      title: "flow.spec.ts",
      file: "flow.spec.ts",
      specs: [
        { title: "Skrubba shows the result", tests: [{ projectName: "chromium", status: "expected" }] },
        { title: "changing the text clears the result", tests: [{ projectName: "firefox", status: "flaky" }] },
      ],
      suites: [
        {
          title: "PDF",
          specs: [{ title: "a scanned PDF says it has no text", tests: [{ projectName: "webkit", status: "flaky" }] }],
        },
      ],
    },
    { title: "deploy.spec.ts", file: "deploy.spec.ts", specs: [{ title: "kill switch", tests: [{ projectName: "chromium", status: "unexpected" }] }] },
  ],
};

describe("flakyTests", () => {
  it("lists every test that passed only on a retry, with its file, describe and browser", () => {
    expect(flakyTests(report)).toEqual([
      "flow.spec.ts › changing the text clears the result [firefox]",
      "flow.spec.ts › PDF › a scanned PDF says it has no text [webkit]",
    ]);
  });

  it("finds none in a clean run", () => {
    expect(flakyTests({ suites: [{ title: "a.spec.ts", specs: [{ title: "t", tests: [{ projectName: "chromium", status: "expected" }] }] }] })).toEqual([]);
  });
});

describe("summary", () => {
  it("says plainly when nothing was flaky", () => {
    expect(summary([])).toBe("No flaky browser tests: every test passed on its first try.\n");
  });

  it("lists flaky tests and says to check whether the test or the app is at fault", () => {
    expect(summary(["a.spec.ts › t [firefox]"])).toBe(
      "## Flaky browser tests\n\nThese failed once and passed on the retry. Check whether the test or the app is at fault: an app bug that only shows up sometimes looks like this too.\n\n- a.spec.ts › t [firefox]\n",
    );
  });
});
