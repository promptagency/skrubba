import { expect, test } from "@playwright/test";
import { editor, openReady } from "./helpers.ts";

test("the warning under the text ends with a link to report a miss by email, never with the text", async ({ page }) => {
  await openReady(page);
  await editor(page).fill("Johan Lindqvist (850412-1234) ringde.");
  const caveat = page.locator(".caveat");
  await expect(caveat).toHaveText(
    "Skrubba hittar inte allt och gör inte texten anonym i lagens mening. Kontrollera dina val innan du kopierar. Missade Skrubba något? Berätta.",
  );
  const href = await caveat.getByRole("link", { name: "Missade Skrubba något? Berätta." }).getAttribute("href");
  const mail = new URL(href!);
  expect(mail.protocol).toBe("mailto:");
  expect(mail.pathname).toBe("micke@promptagency.se");
  expect(mail.searchParams.get("subject")).toBe("Skrubba missade något");
  expect(mail.searchParams.get("body")).toBe(
    "Berätta vilken sorts uppgift Skrubba missade och hur den såg ut, till exempel ett kundnummer i stil med AB-1234-567. Skicka inte den riktiga uppgiften eller din text.",
  );
  // The user's text never goes into the email.
  for (const secret of ["Johan", "Lindqvist", "850412-1234"]) expect(decodeURIComponent(href!)).not.toContain(secret);
});
