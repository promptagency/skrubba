import { mkdtempSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { startDeployServer } from "../tests/e2e/deployServer.ts";

// The deploy tests close this server after each test, while the browser is
// still open. server.close() drops idle connections but waits for any that
// are mid-request, which hung the 1.2.0 release run on CI until the test
// timed out. A half-sent request stands in for the browser's.
it("closes at once even while a connection is mid-request", async () => {
  const root = mkdtempSync(join(tmpdir(), "skrubba-deploy-"));
  writeFileSync(join(root, "index.html"), "<p>hej</p>");
  const server = await startDeployServer(root);
  const { port } = new URL(server.url);
  const socket = connect(Number(port), "127.0.0.1");
  await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
  socket.on("error", () => {});
  socket.write("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const outcome = await Promise.race([
    server.close().then(() => "closed"),
    new Promise((resolve) => setTimeout(() => resolve("hung"), 2000)),
  ]);
  socket.destroy();
  expect(outcome).toBe("closed");
});
