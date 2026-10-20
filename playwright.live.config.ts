import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";

// Smoke test of a deployed site: npm run smoke, or SKRUBBA_URL=https://… npm run smoke.
// The privacy check, the model, a full round trip and offline use, in all
// three browsers, against the real host and its headers. The feedback link too,
// since its text is the copy a user acts on.
export default defineConfig({
  ...base,
  testMatch: ["no-egress.spec.ts", "model.spec.ts", "flow.spec.ts", "restore.spec.ts", "offline.spec.ts", "feedback.spec.ts"],
  use: { ...base.use, baseURL: process.env.SKRUBBA_URL ?? "https://skrubba.promptagency.se" },
  webServer: undefined,
});
