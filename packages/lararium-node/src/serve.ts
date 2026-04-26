/**
 * Snapshot injection server for lararium-app.
 *
 * TiddlyWiki analogy: the TW Node.js server reads tiddlers from lares/
 * and bakes them into the single-file wiki HTML before sending it to the browser.
 * This does the same: reads the built lararium-app/index.html, injects the
 * current LarSnapshot into <script id="lararium-snapshot">, and serves it.
 *
 * Usage:
 *   pnpm --filter @lararium/node serve
 *   LARARIUM_PORT=4242 pnpm --filter @lararium/node serve
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname, resolve } from "path";
import { fileURLToPath } from "url";
import { createLarariumRuntime } from "./node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../");
const APP_DIST = join(REPO_ROOT, "packages/lararium-app/dist");

const PORT = parseInt(process.env["LARARIUM_PORT"] ?? "4321", 10);
const HOST = process.env["LARARIUM_HOST"] ?? "127.0.0.1";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".map":  "application/json",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".woff2": "font/woff2",
};

function serveStatic(res: ServerResponse, filePath: string): boolean {
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) return false;
  const ext = extname(filePath);
  const mime = MIME[ext] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(filePath));
  return true;
}

function injectSnapshot(html: string, snapshot: unknown): string {
  const payload = JSON.stringify(snapshot);
  // Replace the empty snapshot placeholder injected by the build
  return html.replace(
    /<script type="application\/json" id="lararium-snapshot">[^<]*<\/script>/,
    `<script type="application/json" id="lararium-snapshot">${payload}</script>`,
  );
}

async function main() {
  const runtime = createLarariumRuntime();
  const snapshot = await buildSnapshot(runtime);

  const appDistExists = existsSync(join(APP_DIST, "index.html"));
  if (!appDistExists) {
    console.error(
      `[lararium-serve] lararium-app not built — run: pnpm --filter @lararium/app build\n` +
      `  Expected: ${APP_DIST}/index.html`
    );
    process.exit(1);
  }

  const indexTemplate = readFileSync(join(APP_DIST, "index.html"), "utf-8");
  const indexHtml = injectSnapshot(indexTemplate, snapshot);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";

    // All non-asset paths get the app shell (SPA routing)
    const isAsset = pathname !== "/" && /\.[a-z0-9]+$/i.test(pathname);

    if (isAsset) {
      const filePath = join(APP_DIST, pathname);
      if (serveStatic(res, filePath)) return;
    }

    // App shell with injected snapshot
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] snapshot: ${snapshot.memeCount} memes, ${snapshot.edgeCount} edges`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
