import { expect, test } from "@playwright/test";
import { APP_NAME, APP_URL } from "../../src/config.ts";
import { COPY } from "../../src/ui/copy.ts";

// What LinkedIn, Slack, Teams, Messenger and X show when the link is shared.
test("the page has share tags with the approved title, description and image", async ({ page }) => {
  await page.goto("/");
  const meta = (key: string) => page.locator(`meta[property="${key}"], meta[name="${key}"]`).getAttribute("content");
  expect(await meta("og:type")).toBe("website");
  expect(await meta("og:site_name")).toBe(APP_NAME);
  expect(await meta("og:locale")).toBe("sv_SE");
  expect(await meta("og:url")).toBe(`${APP_URL}/`);
  expect(await meta("og:title")).toBe(COPY["app.title"]);
  expect(await meta("og:description")).toBe(COPY["app.tagline"]);
  expect(await meta("og:image")).toBe(`${APP_URL}/og-image.png`);
  expect(await meta("og:image:width")).toBe("1200");
  expect(await meta("og:image:height")).toBe("630");
  expect(await meta("og:image:alt")).toBe(COPY["app.title"]); // the image shows the logo and that line
  expect(await meta("twitter:card")).toBe("summary_large_image");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`${APP_URL}/`);
});

test("the share image is a 1200 × 630 PNG served from our own origin", async ({ request }) => {
  const res = await request.get("/og-image.png");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toBe("image/png");
  const png = await res.body();
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
