// How deploys reach returning visitors, and the kill switch. Builds three
// versions of the app and swaps them under one origin.
import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { type DeployServer, startDeployServer } from "./deployServer.ts";

const BUILDS = ".cache/e2e";

function build(name: string, env: Record<string, string>) {
  execFileSync("npx", ["vite", "build", "--outDir", `${BUILDS}/${name}`, "--emptyOutDir", "--logLevel", "error"], {
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  return `${BUILDS}/${name}`;
}

const buildId = (page: Page) => page.locator('meta[name="skrubba-build"]').getAttribute("content");
const status = (page: Page) => page.getByRole("status").first();
const safely = <T>(fn: () => Promise<T>) => fn().catch(() => null);

// The page's own requests go through the service worker in control, so the
// shell it hands out says which build that is. Polled without reloading:
// each navigation restarts the browser's update check.
async function newBuildInControl(page: Page, id: string) {
  await expect
    .poll(
      () =>
        safely(() =>
          page.evaluate(async () => {
            const html = await (await fetch("/index.html")).text();
            return html.match(/name="skrubba-build" content="([^"]+)"/)?.[1] ?? null;
          }),
        ),
      { timeout: 30_000 },
    )
    .toBe(id);
}

test.describe("deploys", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "service worker lifecycle checked in Chromium");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let a: string;
  let b: string;
  let kill: string;
  let server: DeployServer;

  test.beforeAll(async () => {
    a = build("a", { BUILD_ID: "a" });
    b = build("b", { BUILD_ID: "b" });
    kill = build("kill", { BUILD_ID: "kill", SW_KILL: "1" });
  });

  test.beforeEach(async () => {
    server = await startDeployServer(a);
  });

  test.afterEach(async () => {
    await server.close();
  });

  async function visitA(page: Page) {
    await page.goto(server.url);
    await expect(status(page)).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    expect(await buildId(page)).toBe("a");
  }

  test("a returning visitor gets a new deploy within two loads, with the model working", async ({ page }) => {
    await visitA(page);
    server.deploy(b);

    // The load that finds the update is still served by the old build, and
    // installs the new one in the background.
    await page.reload();
    expect(await buildId(page)).toBe("a");
    await newBuildInControl(page, "b");

    // The next load is the new build.
    await page.reload();
    expect(await buildId(page)).toBe("b");
    await expect(status(page)).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
  });

  test("the kill switch removes the service worker and its caches, and the app keeps working", async ({ page }) => {
    await visitA(page);
    server.deploy(kill);

    await page.reload();
    await expect
      .poll(
        () =>
          safely(() =>
            page.evaluate(async () => ({
              registrations: (await navigator.serviceWorker.getRegistrations()).length,
              // transformers.js may recreate its own model cache once the
              // page runs without a service worker; that one is expected.
              swCache: (await caches.keys()).includes("skrubba"),
            })),
          ),
        { timeout: 30_000 },
      )
      .toEqual({ registrations: 0, swCache: false });

    await safely(() => page.reload());
    expect(await buildId(page)).toBe("kill");
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    await expect(status(page)).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
  });

  test("an old tab keeps working after a newer build takes over", async ({ page, context }) => {
    await visitA(page);
    server.deploy(b);

    // Another tab loads and installs build b, which takes over every tab.
    const other = await context.newPage();
    await other.goto(server.url);
    await newBuildInControl(other, "b");
    await other.reload();
    expect(await buildId(other)).toBe("b");

    // The first tab still runs build a and can still mask with its model.
    expect(await buildId(page)).toBe("a");
    await page.getByRole("textbox", { name: "Skrubba" }).fill("Igår ringde Johan Lindqvist.");
    await expect(page.locator(".row-main").filter({ hasText: "Johan Lindqvist" })).toContainText("Namn");
  });
});
