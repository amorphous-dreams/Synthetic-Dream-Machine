/**
 * Lararium sync server — local-first Automerge peer + legacy tldraw layout channel.
 *
 * Architecture:
 *   - Server is a local-first PEER, not an authority. Automerge is source of truth.
 *   - Automerge Repo (NodeFS storage) syncs meme content with all connected clients.
 *   - TW5 runs on client; server does NOT render TW5. Server manages lares/ on disk.
 *   - Two WebSocket paths on one HTTP server:
 *       /meme-sync      → Automerge NodeWSServerAdapter (content CRDT, primary)
 *       /rooms/:roomId  → TLSocketRoom (legacy tldraw layout CRDT, shared canvas state)
 *   - Static assets from lararium-app/dist/ served over HTTP on the same port.
 *
 * Canon promotion:
 *   PUT /admin/promote  — localhost-only; writes carrier text to lares/, patches Automerge,
 *                         stamps promoted-at/promoted-by on module memes (capability gate).
 *
 * API routes:
 *   GET  /api/rooms      — live tldraw room registry (MCP canvas bridge)
 *   GET  /api/meme-store — Automerge doc URL for the meme content store
 *   GET  /admin/reseed   — force-evict SQLite room + rebuild snapshot/receipt from lares/
 *
 * Boot contract:
 *   1. Build lares/ snapshot → seed Automerge doc
 *   2. Compute boot receipt SHA (corpus integrity fingerprint) → inject into HTML <meta>
 *   3. All subsequent client loads receive receipt + Automerge doc URL via <meta> tags
 *   4. lares/ file watcher patches Automerge on external file changes (git, editor, promote)
 *
 * Known gaps (M11):
 *   - Legacy TLSocketRoom write-back is not wired to Automerge or lares/
 *   - Per-room Automerge docs not yet implemented (all clients share one doc)
 *   - Playwright e2e tests wired but Automerge doc ready-timeout is the primary boot gate
 *
 * Usage:
 *   pnpm --filter @lararium/node serve
 *   LARARIUM_PORT=4321 LARARIUM_HOST=0.0.0.0 pnpm --filter @lararium/node serve
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync, statSync, mkdirSync, unlinkSync, watch, writeFileSync } from "fs";
import { join, extname, resolve } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { WebSocketServer, WebSocket } from "ws";
import { Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  TLSocketRoom,
  SQLiteSyncStorage,
  NodeSqliteWrapper,
} from "@tldraw/sync-core";
import { createLarariumRuntime, LARES_ROOT } from "../src/node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";
import {
  type BootArtifact,
  extractReactionBindings,
  ReactionGraph,
  type ReactionBinding,
  type LiveMsgEvent,
  AuthorityFirstGuard,
  canPromoteToCanon,
  resolveLarUri,
  laresRelPathToLarUri,
  UcanPeerRegistry,
  verifyUcan,
} from "@lararium/core";
import { getOrCreateNodeIdentity } from "../src/operator-key.js";

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
// Boot receipt — SHA delivered via HTML meta tag, not a hidden tldraw shape.
// Rooms are stable opaque strings; clients self-layout from Automerge.
// ---------------------------------------------------------------------------

async function computeReceiptSha(
  runtime: ReturnType<typeof createLarariumRuntime>,
): Promise<string> {
  const artifact = runtime.compileBoot();
  const receipt  = await runtime.compileBootReceipt(artifact);
  return receipt.sha256.replace(/^sha256:/, "");
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

  // Operator identity — Ed25519 keypair persisted in <dataDir>/operator-key.json.
  const operatorIdentity = await getOrCreateNodeIdentity(DATA_DIR);
  console.log(`[lararium-serve] operator DID: ${operatorIdentity.did}`);

  // Receipt SHA — delivered to clients via <meta name="lararium-receipt"> in the HTML
  // shell; no hidden tldraw shape needed. Recomputed on reseed.
  let receiptSha = "";
  try {
    receiptSha = await computeReceiptSha(runtime);
  } catch (e) {
    // Log loudly — empty receipt means clients boot without corpus verification.
    // Server continues; operators should investigate lares/ state.
    console.error("[lararium-serve] ⚠ receipt compute failed — clients will boot without corpus verification:", e);
  }

  // Rooms are stable opaque strings for the legacy layout channel. Active clients
  // self-layout from the Automerge/TW5 corpus. Any roomId is valid; the default
  // route room is "main". Multi-room HTTP: /room/:id routes.
  const DEFAULT_ROOM = "main";
  getOrCreateRoom(DEFAULT_ROOM);

  // ---------------------------------------------------------------------------
  // Automerge meme-sync peer — content CRDT (separate from tldraw layout CRDT)
  //
  // One Automerge Repo per server process, backed by NodeFSStorageAdapter.
  // The meme store doc is seeded from snapshotMemes on first boot; on restart
  // it resumes from the NodeFS snapshot (local-first: server is a sync peer).
  //
  // Doc URL is stable across restarts (persisted in .lararium-data/meme-store/).
  // Clients receive the URL via <meta name="lararium-meme-store"> in HTML.
  // ---------------------------------------------------------------------------
  const MEME_STORE_DIR = join(DATA_DIR, "meme-store");
  mkdirSync(MEME_STORE_DIR, { recursive: true });


  // Peer authorization registry — populated by /auth/ucan, consumed by sharePolicy.
  const peerRegistry = new UcanPeerRegistry();

  // Evict expired UCAN registrations every 10 minutes.
  setInterval(() => peerRegistry.evictExpired(), 10 * 60 * 1000);

  // memeWss is declared below after httpServer; adapter is wired then.
  // memeStoreUrl declared here so the HTTP handler can reference it.
  let memeStoreUrl = "";

  // ---------------------------------------------------------------------------
  // HTTP server
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";
    const params = new URL(url, `http://${HOST}:${PORT}`).searchParams;

    // ── API ────────────────────────────────────────────────────────────────
    if (pathname === "/api/rooms") {
      return json(res, { defaultRoom: DEFAULT_ROOM, rooms: [...rooms.keys()] });
    }

    // Admin: force-reseed — evict legacy SQLite layout room + rebuild snapshot/receipt from lares/
    if (pathname === "/admin/reseed") {
      const remoteAddr = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
      if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1") {
        return json(res, { error: "forbidden" }, 403);
      }
      const targetId = params.get("roomId") ?? DEFAULT_ROOM;
      const deleted = evictRoom(targetId);
      console.log(`[lararium-serve] reseed: ${targetId} sqlite ${deleted ? "deleted" : "not found"}`);
      try {
        snapshotMemes = await buildSnapshot(runtime);
        receiptSha    = await computeReceiptSha(runtime);
        getOrCreateRoom(targetId);
        return json(res, { reseeded: targetId, sha: receiptSha, deleted });
      } catch (e) {
        return json(res, { error: String(e) }, 500);
      }
    }

    // Admin: canon-promotion (localhost-only, POST body: { uri, carrierText, shapeId? })
    if (pathname === "/admin/promote" && req.method === "PUT") {
      const remoteAddr = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
      if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1") {
        return json(res, { error: "forbidden" }, 403);
      }

      // Read + parse request body
      let body: { uri?: string; carrierText?: string; shapeId?: string };
      try {
        const raw = await new Promise<string>((ok, fail) => {
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => ok(Buffer.concat(chunks).toString("utf-8")));
          req.on("error", fail);
        });
        body = JSON.parse(raw) as typeof body;
      } catch {
        return json(res, { error: "invalid-json-body" }, 400);
      }

      const { uri, carrierText, shapeId = "unknown" } = body;
      if (!uri || !carrierText) {
        return json(res, { error: "uri and carrierText are required" }, 400);
      }

      // Canon-promotion policy guard
      const guard = canPromoteToCanon({
        origin:        { kind: "operator-import" },
        authorityMode: "local-operator",
        target:        uri,
      });
      if (!guard.ok) {
        return json(res, { error: guard.reason }, 403);
      }

      // Resolve URI → lares/ file path
      const resolution = resolveLarUri(uri);
      if (!resolution.laresRelPath) {
        return json(res, { error: `uri-not-resolvable:${uri}` }, 400);
      }
      const filePath = join(LARES_ROOT, resolution.laresRelPath);

      // Path traversal guard: resolved path must stay within LARES_ROOT
      if (!resolve(filePath).startsWith(resolve(LARES_ROOT) + "/")) {
        return json(res, { error: "path-traversal-rejected" }, 403);
      }

      try {
        mkdirSync(resolve(filePath, ".."), { recursive: true });
        writeFileSync(filePath, carrierText, "utf-8");
        console.log(`[lararium-serve] promote: wrote ${filePath} (shape: ${shapeId})`);

        const promotedAt = new Date().toISOString();
        const promotedBy = `lararium-node:${HOST}:${PORT}`;

        // Mirror into Automerge so connected clients see the change immediately
        // without waiting for the lares/ watcher round-trip.
        // Module memes (content-type: application/javascript) receive ceremony
        // stamps — promoted-at and promoted-by — which the client kernel requires
        // before injecting the meme body into TW5 ($tw.wiki capability gate).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (memeHandle as any).change((doc: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing: Record<string, string> = (doc[uri] as any) ?? {};
          const isModule = existing["content-type"] === "application/javascript"
            || carrierText.includes('content-type    = "application/javascript"')
            || carrierText.includes("content-type = \"application/javascript\"");
          doc[uri] = {
            ...existing,
            title: uri,
            text:  carrierText,
            ...(isModule ? { "promoted-at": promotedAt, "promoted-by": promotedBy } : {}),
          };
        });
        return json(res, { promoted: uri, path: resolution.laresRelPath, promotedAt });
      } catch (e) {
        return json(res, { error: String(e) }, 500);
      }
    }

    // ── /api/meme-store ────────────────────────────────────────────────────
    if (pathname === "/api/meme-store") {
      return json(res, { url: memeStoreUrl });
    }

    // ── /auth/ucan — UCAN handshake (browser → server) ────────────────────
    // Browser posts: { peerId, token }
    //   peerId — Automerge-repo peerId assigned during /meme-sync handshake
    //   token  — UCAN issued by browser operator, audience = server DID,
    //            resource = "lararium:*" or specific doc URL
    //
    // Server verifies signature + audience + expiry, then registers the peerId
    // in peerRegistry so sharePolicy can authorize the doc sync session.
    if (pathname === "/auth/ucan" && req.method === "POST") {
      let body: { peerId?: string; token?: string };
      try {
        const raw = await new Promise<string>((ok, fail) => {
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => ok(Buffer.concat(chunks).toString("utf-8")));
          req.on("error", fail);
        });
        body = JSON.parse(raw) as typeof body;
      } catch {
        return json(res, { error: "invalid-json-body" }, 400);
      }
      const { peerId, token } = body;
      if (!peerId || !token) return json(res, { error: "peerId and token are required" }, 400);

      const result = await verifyUcan(token, {
        audience: operatorIdentity.did,
        ability:  "automerge/sync",
      });
      if (!result.ok) return json(res, { error: result.reason }, 403);

      peerRegistry.registerPeer(peerId, result.payload.iss, result.payload.exp);
      console.log(`[lararium-serve] /auth/ucan: authorized peer ${peerId} (iss: ${result.payload.iss.slice(0, 30)}...)`);
      return json(res, { ok: true, operatorDid: operatorIdentity.did });
    }

    // ── Static ─────────────────────────────────────────────────────────────
    const isAsset = pathname !== "/" && /\.[a-z0-9]+$/i.test(pathname);
    if (isAsset) {
      if (serveStatic(res, join(APP_DIST, pathname))) return;
    }

    // Multi-room routing: /room/:roomId serves the app pointed at that room.
    // Any other path (including /) serves the default room.
    // Room IDs are opaque strings — they're lazy-created on first WS connect.
    const roomRouteMatch = pathname.match(/^\/room\/([a-zA-Z0-9_-]{1,64})$/);
    const serveRoomId = roomRouteMatch ? roomRouteMatch[1]! : DEFAULT_ROOM;

    // App shell — inject WS + meme-store URLs so clients boot local-first.
    const host    = req.headers["host"] ?? `${HOST}:${PORT}`;
    const wsProto = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    let html = readFileSync(join(APP_DIST, "index.html"), "utf-8");
    const metaTags = [
      `<meta name="lararium-room"         content="${serveRoomId}">`,
      `<meta name="lararium-ws"           content="${wsProto}://${host}/rooms/${serveRoomId}">`,
      `<meta name="lararium-meme-sync"    content="${wsProto}://${host}/meme-sync">`,
      `<meta name="lararium-meme-store"   content="${memeStoreUrl}">`,
      `<meta name="lararium-operator-did" content="${operatorIdentity.did}">`,
      `<meta name="lararium-receipt"      content="${receiptSha}">`,
    ].join("\n  ");
    html = html.replace("</head>", `  ${metaTags}\n</head>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  // ---------------------------------------------------------------------------
  // WebSocket routing — noServer mode, split by path on the upgrade event.
  //   /rooms/:roomId  → tldraw TLSocketRoom
  //   /meme-sync      → Automerge NodeWSServerAdapter
  // ---------------------------------------------------------------------------
  const tlWss    = new WebSocketServer({ noServer: true });
  const memeWss  = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    const pathname = new URL(req.url ?? "/", `ws://${HOST}:${PORT}`).pathname;
    if (pathname.startsWith("/meme-sync")) {
      memeWss.handleUpgrade(req, socket, head, (ws) => memeWss.emit("connection", ws, req));
    } else if (pathname.startsWith("/rooms")) {
      tlWss.handleUpgrade(req, socket, head, (ws) => tlWss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  // tldraw WS — legacy/shared-layout channel
  const wss = tlWss;

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const wsUrl = new URL(req.url ?? "/", `ws://${HOST}:${PORT}`);
    const match = wsUrl.pathname.match(/^\/rooms\/([^/?#]+)/);
    if (!match) { ws.close(1008, "Invalid room path"); return; }

    // Redirect stable alias "boot" → current content-addressed room
    const rawRoomId = match[1]!;
    const roomId = rawRoomId === "boot" ? DEFAULT_ROOM : rawRoomId;
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

    const buffered: import("ws").RawData[] = [];
    const buffer = (msg: import("ws").RawData) => buffered.push(msg);
    ws.on("message", buffer);

    const room = getOrCreateRoom(roomId);
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

  // ---------------------------------------------------------------------------
  // Automerge Repo — wire memeWss adapter and seed meme content store
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memeAdapter = new NodeWSServerAdapter(memeWss as any);
  const memeRepo    = new Repo({
    storage: new NodeFSStorageAdapter(MEME_STORE_DIR),
    network: [memeAdapter],
    // Authorization hook — local-operator mode allows all registered peers plus self.
    // Plug Keyhive/UCAN membership check here when federation arrives.
    sharePolicy: async (peerId: string) => peerRegistry.isAuthorized(peerId),
  });

  // URL_FILE holds the Automerge doc URL so it survives process restarts.
  const URL_FILE = join(MEME_STORE_DIR, "doc-url.txt");
  let memeHandle = existsSync(URL_FILE)
    ? await memeRepo.find(readFileSync(URL_FILE, "utf8").trim() as import("@automerge/automerge-repo").AutomergeUrl)
    : null;

  if (!memeHandle) {
    // First boot — create doc and seed from lares/ carriers
    memeHandle = memeRepo.create<Record<string, unknown>>({});
    writeFileSync(URL_FILE, memeHandle.url, "utf8");
    console.log(`[lararium-serve] meme store created: ${memeHandle.url}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memeHandle.change((doc: any) => {
      for (const [uri, meme] of Object.entries(snapshotMemes.memes)) {
        if (!uri.startsWith("lar:") || !meme.text) continue;
        doc[uri] = { title: uri, fields: meme.fields ?? {}, text: meme.text };
      }
    });
    console.log(`[lararium-serve] meme store seeded: ${Object.keys(snapshotMemes.memes).length} memes`);
  } else {
    console.log(`[lararium-serve] meme store resumed: ${memeHandle.url}`);
  }

  memeStoreUrl = memeHandle.url;

  // ---------------------------------------------------------------------------
  // Disk write-back — Automerge → lares/ files
  //
  // All changes that reach the Automerge doc have already passed sharePolicy
  // (peerRegistry.isAuthorized / UCAN gate). Every surviving lar: URI write
  // is trusted and written to disk. resolveLarUri() derives the lares/ path
  // from the URI — no pre-built index. Virtual caps URIs (laresRelPath: null)
  // are silently skipped.
  //
  // Echo-loop guard: diskAdaptor.writing tracks URIs pending a debounced write.
  // The lares/ watcher checks this before reflecting disk changes back into
  // Automerge, preventing disk→Automerge→TW5→saveTiddler→disk loops.
  //
  // Seeding guard: diskSyncSeeding blocks write-back during initial doc
  // population so lares/ files are not redundantly re-written on first boot.
  // ---------------------------------------------------------------------------
  const { LarDiskSyncAdaptor } = await import("@lararium/tw5");
  const diskAdaptor = new LarDiskSyncAdaptor(LARES_ROOT);

  let diskSyncSeeding = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (memeHandle as any).on("change", ({ doc, patches }: { doc: Record<string, unknown>; patches: { path: unknown[] }[] }) => {
    if (diskSyncSeeding) return;
    const changedUris = new Set<string>();
    for (const patch of patches) {
      const uri = patch.path[0];
      if (typeof uri === "string" && uri.startsWith("lar:")) changedUris.add(uri);
    }
    for (const uri of changedUris) {
      const entry = doc[uri] as { text?: string } | undefined;
      if (typeof entry?.text === "string") {
        diskAdaptor.saveTiddler({ title: uri, text: entry.text }, () => { /* fire-and-forget */ });
      }
    }
  });
  diskSyncSeeding = false;

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] default room: /room/${DEFAULT_ROOM}  (or /room/<any-id>)`);
    console.log(`[lararium-serve] receipt:      ${receiptSha.slice(0, 16) || "(none)"}`);
    console.log(`[lararium-serve] meme-store:   ${memeStoreUrl}`);
    console.log(`[lararium-serve] meme-sync:    ws://${HOST}:${PORT}/meme-sync`);
    console.log(`[lararium-serve] reseed:       curl http://${HOST}:${PORT}/admin/reseed`);
    console.log(`[lararium-serve] promote:      curl -X PUT http://${HOST}:${PORT}/admin/promote -H 'Content-Type: application/json' -d '{"uri":"lar:///...","carrierText":"..."}'`);
    console.log(`[lararium-serve] data dir:     ${DATA_DIR}`);
  });

  // ---------------------------------------------------------------------------
  // Reaction graph — Verse-style live event routing over the CRDT room
  //
  // The reaction graph runs server-side. When a client fires an event (WS
  // message type "fire"), the server validates the binding, executes handlers,
  // and broadcasts the event as a "event" message to all room members.
  //
  // Automerge/TW5 handles meme content in the active browser path. The legacy
  // tldraw room can still carry canvas layout/socket messages. The reaction graph
  // handles Verse-style event wiring on top of the room socket where used.
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
  // Historical note: carrier changes once re-projected the boot room via evict +
  // reseed. Active local-first content refresh is disk → Automerge → TW5; tldraw
  // projection diffing in the browser is the remaining M11 step.
  //
  // Debounced 400ms — batch rapid saves (editor auto-save bursts).
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // lares/ file watcher — disk → Automerge (trusted, one direction)
  //
  // When a carrier file changes on disk (editor save, MCP write, git pull),
  // read the new text and patch the Automerge doc directly. Connected clients
  // pick it up via their Automerge sync session; their TW5 wikis update through
  // LarariumCrdtSyncAdaptor (Automerge → TW5 direction).
  //
  // Echo-loop guard: diskAdaptor.writing contains URIs currently being written
  // from Automerge → disk. Skip those files to break the loop.
  //
  // After patching Automerge, recompute the receipt SHA and reaction graph so
  // the server's in-memory view stays consistent with the corpus.
  // ---------------------------------------------------------------------------

  const fileDebounces = new Map<string, ReturnType<typeof setTimeout>>();

  watch(LARES_ROOT, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (filename.includes("node_modules") || filename.endsWith(".sqlite")) return;
    if (!filename.endsWith(".md")) return;

    // Derive URI from the changed file path; skip files with no known mapping.
    let uri: string;
    try {
      uri = laresRelPathToLarUri(filename.replace(/\\/g, "/"));
    } catch {
      return; // unrecognised path structure — not a meme carrier
    }

    // Echo-loop guard: skip if this write originated from Automerge→disk.
    if (diskAdaptor.writing.has(uri)) return;

    const existing = fileDebounces.get(filename);
    if (existing) clearTimeout(existing);

    fileDebounces.set(filename, setTimeout(async () => {
      fileDebounces.delete(filename);
      // Re-check echo guard after debounce — write may have completed by now.
      if (diskAdaptor.writing.has(uri)) return;

      try {
        const text = readFileSync(join(LARES_ROOT, filename), "utf-8");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (memeHandle as any).change((doc: any) => {
          doc[uri] = { title: uri, text };
        });
        console.log(`[lararium-serve] lares/ → automerge: ${filename}`);

        // Keep server-side receipt and reaction graph consistent.
        receiptSha    = await computeReceiptSha(runtime);
        reactionGraph = buildReactionGraph(runtime);
        broadcastToRoom(DEFAULT_ROOM, { type: "reseed" });
      } catch (e) {
        console.error(`[lararium-serve] lares/ watcher error (${filename}):`, e);
      }
    }, 400));
  });

  console.log(`[lararium-serve] watching lares/ for changes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
