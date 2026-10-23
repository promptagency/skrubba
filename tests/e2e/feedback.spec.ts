import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

test("the warning under the text ends with a link to report an error by email, never with the text", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Johan Lindqvist (850412-1234) ringde.");
  const caveat = page.locator(".caveat");
  await expect(caveat).toHaveText(
    "Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Kontrollera dina val innan du kopierar. Blev något fel? Berätta.",
  );
  const href = await caveat.getByRole("link", { name: "Blev något fel? Berätta." }).getAttribute("href");
  const mail = new URL(href!);
  expect(mail.protocol).toBe("mailto:");
  expect(mail.pathname).toBe("micke@promptagency.se");
  // The version is in the subject, so a report can be tied to a release.
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  expect(mail.searchParams.get("subject")).toBe(`Fel i Skrubba ${version}`);
  expect(mail.searchParams.get("body")).toBe(
    "Skriv en påhittad mening där Skrubba gör samma fel, missar en uppgift eller döljer något som borde stå kvar. Använd påhittade namn och nummer i samma form som de riktiga, till exempel \"Ring Kalle Persson om kundnummer AB-1234-567.\" Testa gärna meningen i Skrubba först, så vet du att den visar felet. Berätta också vilken sorts text det var, som ett mejl eller ett protokoll. Skicka inte den riktiga texten: den innehåller andras uppgifter, och en påhittad mening visar felet lika bra.",
  );
  // The user's text never goes into the email.
  for (const secret of ["Johan", "Lindqvist", "850412-1234"]) expect(decodeURIComponent(href!)).not.toContain(secret);
});
