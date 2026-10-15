// A static server whose root can be swapped mid-test, to simulate deploying
// a new build to the same origin.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
};

export interface DeployServer {
  url: string;
  deploy(root: string): void;
  close(): Promise<void>;
}

export async function startDeployServer(root: string): Promise<DeployServer> {
  let current = root;
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
    let file = join(current, path);
    if (!file.startsWith(current) || !existsSync(file) || statSync(file).isDirectory()) {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      file = join(current, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}`,
    deploy: (next) => {
      current = next;
    },
    // The browser is still open when a test closes the server; drop its
    // connections, or close() waits for any that are mid-request.
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
