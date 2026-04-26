/**
 * Lararium sync server — TLSocketRoom + SQLiteSyncStorage WebSocket backend.
 *
 * Architecture:
 *   - One TLSocketRoom per named room, keyed by BootReceipt SHA (content-addressed)
 *   - SQLiteSyncStorage persists room state; survives process restarts
 *   - On first connection to a new room, seeds from renderAllViews() projection
 *   - Browser clients connect via useSync({ uri: "ws://..." }) — no loadSnapshot() needed
 *   - Static assets from lararium-app/dist/ served over HTTP on the same port
 *
 * Usage:
 *   pnpm --filter @lararium/node serve
 *   LARARIUM_PORT=4321 pnpm --filter @lararium/node serve
 *
 * Offline / embedded mode:
 *   bootFromEmbedded() + loadSnapshot() remains valid for single-file wiki mode.
 *   This server is the primary path for all live sessions.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync, statSync, mkdirSync } from "fs";
import { join, extname, resolve } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { WebSocketServer, WebSocket } from "ws";
import {
  TLSocketRoom,
  SQLiteSyncStorage,
  NodeSqliteWrapper,
  DEFAULT_INITIAL_SNAPSHOT,
} from "@tldraw/sync-core";
import { createLarariumRuntime } from "../src/node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../");
const APP_DIST = join(REPO_ROOT, "packages/lararium-app/dist");
const DATA_DIR = join(REPO_ROOT, ".lararium-data");

const PORT = parseInt(process.env["LARARIUM_PORT"] ?? "4321", 10);
const HOST = process.env["LARARIUM_HOST"] ?? "127.0.0.1";

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Room registry
// ---------------------------------------------------------------------------

const rooms = new Map<string, TLSocketRoom>();

function getOrCreateRoom(roomId: string, initialSnapshot?: unknown): TLSocketRoom {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const dbPath = join(DATA_DIR, `${roomId}.sqlite`);
  const db = new Database(dbPath);
  const sql = new NodeSqliteWrapper(db);
  const isNew = !SQLiteSyncStorage.hasBeenInitialized(sql);

  const storage = new SQLiteSyncStorage({
    sql,
    ...(isNew && initialSnapshot ? { snapshot: initialSnapshot as Parameters<typeof SQLiteSyncStorage>[0]["snapshot"] } : {}),
  });

  const room = new TLSocketRoom({ storage });
  rooms.set(roomId, room);

  console.log(`[lararium-serve] room ${roomId} ${isNew ? "(seeded)" : "(resumed from SQLite)"}`);
  return room;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

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

  // Compile boot artifact and project to tldraw shapes for the boot room seed.
  // SQLiteSyncStorage accepts a TLStoreSnapshot: { store: Record<id, record>, schema: SerializedSchema }
  // We build one from the emission's pages + shapes arrays.
  let bootSnapshot: unknown = undefined;
  try {
    const { renderAllViews } = await import("@lararium/tldraw");
    const artifact = runtime.compileMinimalBoot();
    const emission = renderAllViews(artifact, {
      readText: (uri: string) => {
        const meme = snapshot.memes[uri];
        if (!meme) throw new Error(`${uri} not in snapshot`);
        return meme.text;
      },
      includeAhuFrames: true,
    });

    // Build TLStoreSnapshot from emission records
    const store: Record<string, unknown> = {};
    for (const page of emission.pages) store[page.id] = page;
    for (const shape of emission.shapes) {
      const s = shape as { id: string };
      store[s.id] = shape;
    }

    // Use the default schema from sync-core (same schema TLSocketRoom uses internally)
    bootSnapshot = { store, schema: DEFAULT_INITIAL_SNAPSHOT.schema };
    console.log(`[lararium-serve] projection ready: ${emission.pages.length} pages, ${emission.shapes.length} shapes`);
  } catch (e) {
    console.warn("[lararium-serve] renderAllViews failed — rooms will start empty:", e);
  }

  // Pre-create the boot room so first connection is instant
  const bootRoomId = `boot`;
  getOrCreateRoom(bootRoomId, bootSnapshot);

  // HTTP server for static assets
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";
    const isAsset = pathname !== "/" && /\.[a-z0-9]+$/i.test(pathname);

    if (isAsset) {
      const filePath = join(APP_DIST, pathname);
      if (serveStatic(res, filePath)) return;
    }

    // App shell — inject WS URL via meta tag so client knows where to connect
    let html = readFileSync(join(APP_DIST, "index.html"), "utf-8");
    const wsMeta = `<meta name="lararium-ws" content="ws://${HOST}:${PORT}/rooms/boot">`;
    html = html.replace("</head>", `  ${wsMeta}\n</head>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  // WebSocket server — path: /rooms/:roomId
  // Follow the official tldraw simple-server-example pattern exactly:
  //   - sessionId comes from the client query param (useSync appends ?sessionId=<TAB_ID>)
  //   - pass ws socket directly (ws v8+ implements addEventListener natively)
  //   - buffer messages received before room.handleSocketConnect, then replay
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", `ws://${HOST}:${PORT}`);
    const match = url.pathname.match(/^\/rooms\/([^/?#]+)/);
    if (!match) {
      ws.close(1008, "Invalid room path");
      return;
    }

    const roomId = match[1]!;
    // sessionId must come from the client — useSync appends ?sessionId=<TAB_ID>
    const sessionId = url.searchParams.get("sessionId") ?? crypto.randomUUID();

    // Buffer messages that arrive before handleSocketConnect (avoid race on async room load)
    const buffered: import("ws").RawData[] = [];
    const buffer = (msg: import("ws").RawData) => buffered.push(msg);
    ws.on("message", buffer);

    const room = getOrCreateRoom(roomId, bootSnapshot);

    // Pass ws directly — ws v8+ implements addEventListener/removeEventListener
    room.handleSocketConnect({
      sessionId,
      socket: ws as unknown as Parameters<typeof room.handleSocketConnect>[0]["socket"],
    });

    // Unregister buffer listener and replay any caught messages
    ws.off("message", buffer);
    for (const msg of buffered) ws.emit("message", msg);

    console.log(`[lararium-serve] + ${sessionId.slice(0, 8)} room=${roomId}`);
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] ws://${HOST}:${PORT}/rooms/boot`);
    console.log(`[lararium-serve] data dir: ${DATA_DIR}`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
