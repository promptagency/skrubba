import { defineConfig, devices } from "@playwright/test";

// Runs against the production build so the CSP meta tag is in place.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  // On CI a test that fails is run once more: a one-off timing flake then
  // passes and is reported as flaky, while a real bug fails both tries and
  // still blocks the release. Locally a failure is a failure.
  retries: process.env.CI ? 1 : 0,
  // On CI also a JSON report, from which scripts/flaky.ts lists every test
  // that passed only on the retry in the run's summary. The privacy tests do
  // not retry at all (test.describe.configure in their files).
  reporter: process.env.CI ? [["list"], ["json", { outputFile: "test-results/report.json" }]] : "list",
  use: { baseURL: "http://localhost:4174" },
  projects: [
    // Only Chromium lets a test read the clipboard.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read", "clipboard-write"] },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174",
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
