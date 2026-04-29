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
 *   GET /api/rooms          — live room registry (MCP canvas bridge)
 *   GET /admin/reseed       — force-evict + delete SQLite for a room, reseed on next WS connect
 *                             ?roomId=boot (default: current boot room alias)
 *
 * Usage:
 *   pnpm --filter @lararium/node serve
 *   LARARIUM_PORT=4321 LARARIUM_HOST=0.0.0.0 pnpm --filter @lararium/node serve
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync, statSync, mkdirSync, unlinkSync, watch } from "fs";
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
import { createLarariumRuntime, LARES_ROOT } from "../src/node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";
import {
  type BootArtifact,
  parsePranalaEdges,
  extractReactionBindings,
  ReactionGraph,
  type ReactionBinding,
  type LiveMsgEvent,
  type LiveMsgBootReceipt,
  AuthorityFirstGuard,
  makeEdgeIslandId,
  buildKumuRegistry,
} from "@lararium/core";

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
): Promise<{ snapshot: unknown; roomId: string; receiptSha: string; memeCount: number; kumuDefs: import("@lararium/core").KumuDef[] }> {
  const { renderAllViews } = await import("@lararium/tldraw");
  const { filterMemesWikitext } = await import("@lararium/tw5");
  const artifact: BootArtifact = runtime.compileBoot();
  const receipt = await runtime.compileBootReceipt(artifact);
  const receiptSha = receipt.sha256.replace(/^sha256:/, "");

  const registry = buildKumuRegistry(artifact.kumuDefs ?? []);

  const emission = await renderAllViews(artifact, {
    readText: (uri: string) => {
      const meme = snapshotMemes.memes[uri];
      if (!meme) throw new Error(`${uri} not in snapshot`);
      return meme.text;
    },
    includeAhuFrames: true,
    registry,
    filterEngine: (expr, closure, edges) => filterMemesWikitext(closure, expr, edges),
  });

  const store: Record<string, unknown> = {};
  for (const page of emission.pages) store[page.id] = page;
  for (const shape of emission.shapes) store[(shape as { id: string }).id] = shape;
  for (const binding of emission.bindings) store[binding.id] = binding;

  const ev = artifact.validation.edgeViolations ?? [];
  const evErrors = ev.filter((v: { severity: string }) => v.severity === "error").length;
  if (ev.length > 0)
    console.warn(`[lararium-serve] edge violations: ${ev.length} (${evErrors} errors, ${ev.length - evErrors} warnings)`);
  console.log(`[lararium-serve] projection ready: ${emission.pages.length} pages, ${emission.shapes.length} shapes`);
  return {
    snapshot: { store, schema: DEFAULT_INITIAL_SNAPSHOT.schema },
    roomId: `boot-${receiptSha.slice(0, 16)}`,
    receiptSha,
    memeCount: artifact.memeCount,
    kumuDefs: artifact.kumuDefs ?? [],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const runtime = createLarariumRuntime();
  // let so the reseed handler can rebuild from fresh lares/ reads
  let snapshotMemes = await buildSnapshot(runtime);

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

  // HTTP server
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";
    const params = new URL(url, `http://${HOST}:${PORT}`).searchParams;

    // ── API ────────────────────────────────────────────────────────────────
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

      // Rebuild projection for the boot room — refresh snapshot from disk first
      if (targetId === activeBootRoomId || targetId === "boot") {
        try {
          snapshotMemes = await buildSnapshot(runtime);
          const fresh = await buildBootProjection(runtime, snapshotMemes);
          getOrCreateRoom(fresh.roomId, fresh.snapshot);
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

    // Tag socket for reaction-graph broadcast targeting
    (ws as WebSocket & { _larariumRoomId?: string })._larariumRoomId = roomId;

    // Authority-first sync order — step 1: authenticate peer (bootstrap local-operator)
    const guard = new AuthorityFirstGuard();
    guard.advance("authenticate-peer");

    // Step 2: Orichalcum authority graph — in dev, local-operator passes immediately
    guard.advance("sync-authority-graph");

    // Step 3: derive visible rooms + step 4: manifest
    // For local-operator: all rooms are visible; skip to manifest
    guard.advance("sync-collection-manifest");

    // Send boot receipt BEFORE handing off to tldraw CRDT room.
    // This is the "join artifact" — the shape of the visible world at join time.
    // Clients use receiptHash as a prompt cache key and offset for delta resumption.
    if (bootProjection) {
      const edgeIslandId = makeEdgeIslandId("lararium-node", sessionId.slice(0, 8), bootProjection.receiptSha.slice(0, 8));
      const bootReceipt: LiveMsgBootReceipt = {
        type:          "boot-receipt",
        edgeIslandId,
        issuedAt:      new Date().toISOString(),
        visibleRooms:  ["system", "invariants", "graph", "entry"],
        visibleMemes:  bootProjection.memeCount,
        offset:        0,
        receiptHash:   bootProjection.receiptSha,
        authorityMode: "local-operator",
      };
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(bootReceipt));
    }

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

    // Reaction graph "fire" messages — guard: only allowed in "live" state
    // (guard reached "live" after step 4 above; this is the delta streaming phase)
    ws.on("message", (raw) => {
      let msg: unknown;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== "object") return;
      const m = msg as Record<string, unknown>;
      if (m["type"] !== "fire") return;
      const fromUri = typeof m["fromUri"] === "string" ? m["fromUri"] : null;
      const trigger = typeof m["trigger"] === "string" ? m["trigger"] : null;
      if (!fromUri || !trigger) return;

      reactionGraph.fire(fromUri, trigger, m["payload"] ?? {}).then(() => {
        const event: LiveMsgEvent = {
          type: "event",
          fromUri,
          trigger,
          targetFn: null,
          payload: m["payload"] ?? {},
          timestamp: new Date().toISOString(),
        };
        broadcastToRoom(roomId, event);
      }).catch((e: unknown) => {
        console.error(`[lararium-serve] reaction fire error ${fromUri}#${trigger}:`, e);
      });
    });

    console.log(`[lararium-serve] + ${sessionId.slice(0, 8)} room=${roomId}`);
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] boot room: ${activeBootRoomId}`);
    console.log(`[lararium-serve] reseed:    curl http://${HOST}:${PORT}/admin/reseed`);
    console.log(`[lararium-serve] data dir:  ${DATA_DIR}`);
  });

  // ---------------------------------------------------------------------------
  // Reaction graph — Verse-style live event routing over the CRDT room
  //
  // The reaction graph runs server-side. When a client fires an event (WS
  // message type "fire"), the server validates the binding, executes handlers,
  // and broadcasts the event as a "event" message to all room members.
  //
  // The CRDT room handles canvas state. The reaction graph handles Verse-style
  // event wiring on top of it — two layers, one transport.
  // ---------------------------------------------------------------------------

  let reactionGraph = buildReactionGraph(runtime);

  function buildReactionGraph(rt: ReturnType<typeof createLarariumRuntime>): ReactionGraph {
    const artifact: BootArtifact = rt.compileBoot();
    const edges = artifact.pranalaEdges ?? [];
    const bindings: ReactionBinding[] = extractReactionBindings(
      edges.map((e) => ({
        fromUri:  e.fromUri,
        toUri:    e.toUri,
        family:   e.family,
        role:     e.role,
        payload:  (e as unknown as { payload?: Record<string, unknown> }).payload ?? {},
      }))
    );
    const g = new ReactionGraph();
    g.load(bindings);
    return g;
  }

  // Broadcast to all WebSocket clients connected to a room
  function broadcastToRoom(roomId: string, msg: object): void {
    const text = JSON.stringify(msg);
    for (const ws of wss.clients) {
      // tag sockets with their roomId on connection — see wss.on("connection") above
      const tagged = ws as WebSocket & { _larariumRoomId?: string };
      if (tagged._larariumRoomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(text);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // lares/ file watcher — UEFN operational model
  //
  // Carrier changes re-project the boot room via evict + reseed. The CRDT room
  // starts fresh from the new projection; clients reconnect to the stable "boot"
  // alias and get the updated state. No snapshot+delta, no patch-over-stale-base.
  //
  // Debounced 400ms — batch rapid saves (editor auto-save bursts).
  // ---------------------------------------------------------------------------

  let reloadDebounce: ReturnType<typeof setTimeout> | null = null;

  watch(LARES_ROOT, { recursive: true }, (event, filename) => {
    if (!filename) return;
    if (filename.includes("node_modules") || filename.endsWith(".sqlite")) return;

    if (reloadDebounce) clearTimeout(reloadDebounce);
    reloadDebounce = setTimeout(async () => {
      reloadDebounce = null;
      console.log(`[lararium-serve] lares/ changed (${filename}) — reseeding boot room`);
      try {
        snapshotMemes = await buildSnapshot(runtime);
        const fresh = await buildBootProjection(runtime, snapshotMemes);
        evictRoom(activeBootRoomId);
        getOrCreateRoom(fresh.roomId, fresh.snapshot);
        reactionGraph = buildReactionGraph(runtime);
        console.log(`[lararium-serve] reseeded → ${fresh.roomId}`);
        // Notify connected clients via reaction graph broadcast — they refresh to new room
        broadcastToRoom(activeBootRoomId, { type: "reseed", roomId: fresh.roomId });
      } catch (e) {
        console.error("[lararium-serve] reseed failed:", e);
      }
    }, 400);
  });

  console.log(`[lararium-serve] watching lares/ for changes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
