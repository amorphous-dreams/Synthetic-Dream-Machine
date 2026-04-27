/**
 * Lararium sync server — TLSocketRoom + SQLiteSyncStorage WebSocket backend.
 *
 * Architecture:
 *   - One TLSocketRoom per named room, content-addressed by BootReceipt SHA
 *   - SQLiteSyncStorage persists room state; survives process restarts
 *   - On first connection to a new room, seeds from renderAllViews() projection
 *   - Browser clients connect via useSync({ uri: "ws://..." }) — no loadSnapshot()
 *   - Static assets from lararium-app/dist/ served over HTTP on the same port
 *
 * API routes:
 *   GET /api/memes          — minimal boot meme list for command palette
 *   GET /admin/reseed       — force-evict + delete SQLite for a room, reseed on next WS connect
 *                             ?roomId=boot (default: current boot room alias)
 *
 * Usage:
 *   pnpm --filter @lararium/node serve
 *   LARARIUM_PORT=4321 LARARIUM_HOST=0.0.0.0 pnpm --filter @lararium/node serve
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync, statSync, mkdirSync, unlinkSync } from "fs";
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
import type { BootArtifact } from "@lararium/core";

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
  // Path traversal guard: resolved path must stay within APP_DIST
  const resolved = resolve(filePath);
  if (!resolved.startsWith(APP_DIST + "/") && resolved !== APP_DIST) {
    res.writeHead(403); res.end(); return true;
  }
  if (!existsSync(resolved) || statSync(resolved).isDirectory()) return false;
  const ext = extname(resolved);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(readFileSync(resolved));
  return true;
}

function json(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
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
    ...(isNew && initialSnapshot
      ? { snapshot: initialSnapshot as ConstructorParameters<typeof SQLiteSyncStorage>[0]["snapshot"] }
      : {}),
  });

  const room = new TLSocketRoom({ storage });
  rooms.set(roomId, room);
  console.log(`[lararium-serve] room ${roomId} ${isNew ? "(seeded)" : "(resumed)"}`);
  return room;
}

/** Evict a room from memory and delete its SQLite file so next connect reseeds. */
function evictRoom(roomId: string): boolean {
  const room = rooms.get(roomId);
  if (room) {
    try { room.close(); } catch { /* ignore */ }
    rooms.delete(roomId);
  }
  const dbPath = join(DATA_DIR, `${roomId}.sqlite`);
  if (existsSync(dbPath)) { unlinkSync(dbPath); return true; }
  return false;
}

// ---------------------------------------------------------------------------
// Boot projection
// ---------------------------------------------------------------------------

type SnapshotData = Awaited<ReturnType<typeof buildSnapshot>>;

async function buildBootProjection(
  runtime: ReturnType<typeof createLarariumRuntime>,
  snapshotMemes: SnapshotData,
): Promise<{ snapshot: unknown; roomId: string; receiptSha: string }> {
  const { renderAllViews } = await import("@lararium/tldraw");
  const artifact: BootArtifact = runtime.compileMinimalBoot();
  const receipt = await runtime.compileBootReceipt(artifact);
  const receiptSha = receipt.sha256.replace(/^sha256:/, "");

  const emission = renderAllViews(artifact, {
    readText: (uri: string) => {
      const meme = snapshotMemes.memes[uri];
      if (!meme) throw new Error(`${uri} not in snapshot`);
      return meme.text;
    },
    includeAhuFrames: true,
  });

  const store: Record<string, unknown> = {};
  for (const page of emission.pages) store[page.id] = page;
  for (const shape of emission.shapes) store[(shape as { id: string }).id] = shape;
  for (const binding of emission.bindings) store[binding.id] = binding;

  console.log(`[lararium-serve] projection ready: ${emission.pages.length} pages, ${emission.shapes.length} shapes`);
  return {
    snapshot: { store, schema: DEFAULT_INITIAL_SNAPSHOT.schema },
    roomId: `boot-${receiptSha.slice(0, 16)}`,
    receiptSha,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const runtime = createLarariumRuntime();
  const snapshotMemes = await buildSnapshot(runtime);

  if (!existsSync(join(APP_DIST, "index.html"))) {
    console.error(
      `[lararium-serve] lararium-app not built — run: pnpm --filter @lararium/app build\n` +
      `  Expected: ${APP_DIST}/index.html`
    );
    process.exit(1);
  }

  // Build tldraw projection and content-addressed room key
  let bootProjection: Awaited<ReturnType<typeof buildBootProjection>> | null = null;
  try {
    bootProjection = await buildBootProjection(runtime, snapshotMemes);
  } catch (e) {
    console.warn("[lararium-serve] projection failed — rooms will start empty:", e);
  }

  const activeBootRoomId = bootProjection?.roomId ?? "boot";
  const bootSnapshot = bootProjection?.snapshot;

  // Also maintain a stable alias "boot" → current content-addressed id for WS URL injection
  // (clients bookmark the stable alias; server redirects or forwards as needed)
  getOrCreateRoom(activeBootRoomId, bootSnapshot);

  // Meme list — rebuilds after reseed
  function buildMemeList() {
    const artifact: BootArtifact = runtime.compileMinimalBoot();
    return artifact.closure.map((e: { uri: string; depth?: number; kind?: string }) => ({
      uri: e.uri,
      depth: e.depth ?? 0,
      kind: e.kind ?? "meme",
    }));
  }
  let memeList = buildMemeList();

  // HTTP server
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";
    const params = new URL(url, `http://${HOST}:${PORT}`).searchParams;

    // ── API ────────────────────────────────────────────────────────────────
    if (pathname === "/api/memes") {
      return json(res, memeList);
    }

    if (pathname === "/api/rooms") {
      return json(res, {
        activeBootRoomId,
        rooms: [...rooms.keys()],
      });
    }

    // Admin: force-reseed a room (localhost-only guard)
    if (pathname === "/admin/reseed") {
      const remoteAddr = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
      if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1") {
        return json(res, { error: "forbidden" }, 403);
      }
      const targetId = params.get("roomId") ?? activeBootRoomId;
      const deleted = evictRoom(targetId);
      console.log(`[lararium-serve] reseed requested for ${targetId} — sqlite ${deleted ? "deleted" : "not found"}`);

      // Rebuild projection for the boot room
      if (targetId === activeBootRoomId || targetId === "boot") {
        try {
          const fresh = await buildBootProjection(runtime, snapshotMemes);
          getOrCreateRoom(fresh.roomId, fresh.snapshot);
          memeList = buildMemeList();
          return json(res, { reseeded: fresh.roomId, sha: fresh.receiptSha, deleted });
        } catch (e) {
          return json(res, { error: String(e) }, 500);
        }
      }
      return json(res, { reseeded: targetId, deleted });
    }

    // ── Static ─────────────────────────────────────────────────────────────
    const isAsset = pathname !== "/" && /\.[a-z0-9]+$/i.test(pathname);
    if (isAsset) {
      if (serveStatic(res, join(APP_DIST, pathname))) return;
    }

    // App shell — inject WS URL derived from request Host header so LAN/proxy
    // clients get the correct address without hardcoding HOST:PORT.
    const host = req.headers["host"] ?? `${HOST}:${PORT}`;
    const wsProto = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    let html = readFileSync(join(APP_DIST, "index.html"), "utf-8");
    const wsMeta = `<meta name="lararium-ws" content="${wsProto}://${host}/rooms/${activeBootRoomId}">`;
    html = html.replace("</head>", `  ${wsMeta}\n</head>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  // WebSocket server — /rooms/:roomId
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const wsUrl = new URL(req.url ?? "/", `ws://${HOST}:${PORT}`);
    const match = wsUrl.pathname.match(/^\/rooms\/([^/?#]+)/);
    if (!match) { ws.close(1008, "Invalid room path"); return; }

    // Redirect stable alias "boot" → current content-addressed room
    const rawRoomId = match[1]!;
    const roomId = rawRoomId === "boot" ? activeBootRoomId : rawRoomId;
    const sessionId = wsUrl.searchParams.get("sessionId") ?? crypto.randomUUID();

    const buffered: import("ws").RawData[] = [];
    const buffer = (msg: import("ws").RawData) => buffered.push(msg);
    ws.on("message", buffer);

    const room = getOrCreateRoom(roomId, bootSnapshot);
    room.handleSocketConnect({
      sessionId,
      socket: ws as unknown as Parameters<typeof room.handleSocketConnect>[0]["socket"],
    });

    ws.off("message", buffer);
    for (const msg of buffered) ws.emit("message", msg);

    console.log(`[lararium-serve] + ${sessionId.slice(0, 8)} room=${roomId}`);
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] boot room: ${activeBootRoomId}`);
    console.log(`[lararium-serve] reseed:    curl http://${HOST}:${PORT}/admin/reseed`);
    console.log(`[lararium-serve] data dir:  ${DATA_DIR}`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
