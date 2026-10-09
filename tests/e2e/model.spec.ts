import { expect, test } from "@playwright/test";
import { editor, openReady, rows } from "./helpers.ts";

// Runs in every browser project: the model must load and find names.
test("the model loads and finds a name", async ({ page, context }, info) => {
  const runtime: string[] = [];
  context.on("request", (r) => {
    if (/\/(runtime|models)\//.test(r.url())) runtime.push(new URL(r.url()).pathname);
  });
  await openReady(page);
  await editor(page).fill("Igår ringde Johan Lindqvist från Umeå.");
  await expect(rows(page).filter({ hasText: "Johan Lindqvist" })).toContainText("Namn");
  await expect(rows(page).filter({ hasText: "Umeå" })).toHaveCount(1);
  info.annotations.push({ type: "runtime", description: [...new Set(runtime)].join(", ") });
});
