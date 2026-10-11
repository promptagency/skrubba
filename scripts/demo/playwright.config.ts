// Records the Så här funkar det walkthrough. Run with npm run demo-video
// against a preview server on port 4173 (npm run build && npm run preview).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "walkthrough.spec.ts",
  timeout: 300_000,
  workers: 1,
  outputDir: "../../.cache/demo",
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
    // Tall enough that the captions sit below the Uppgifter and kodnyckel windows.
    viewport: { width: 1280, height: 1100 },
    video: { mode: "on", size: { width: 1280, height: 1100 } },
    colorScheme: "light",
    permissions: ["clipboard-read", "clipboard-write"],
  },
});
