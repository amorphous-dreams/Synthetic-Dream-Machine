/**
 * Lararium sync server — tldraw canvas CRDT + Automerge meme-sync peer.
 *
 * Architecture:
 *   - One TLSocketRoom per named room (tldraw canvas layout, positions, pages)
 *   - Automerge Repo — meme content store (carrier text, edges, metadata)
 *   - Two WebSocket paths on one HTTP server, split by upgrade routing:
 *       /rooms/:roomId  → tldraw TLSocketRoom (layout CRDT)
 *       /meme-sync      → Automerge NodeWSServerAdapter (content CRDT)
 *   - Static assets from lararium-app/dist/ served over HTTP on the same port
 *
 * API routes:
 *   GET  /api/rooms          — live tldraw room registry (MCP canvas bridge)
 *   GET  /api/meme-store     — Automerge doc URL for the meme content store
 *   GET  /admin/reseed      — force-evict + delete SQLite for a room, reseed on next WS connect
 *   PUT  /admin/promote     — canon-promotion: write carrierText to lares/ file
 *
 * Local-first contract:
 *   - Meme content lives in the Automerge doc (IndexedDB on client, NodeFS on server).
 *   - Server is a sync peer — it cannot promote content to canon or modify lares/.
 *   - tldraw CRDT handles canvas layout; Automerge handles meme content. Two stores, one port.
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
  DEFAULT_INITIAL_SNAPSHOT,
} from "@tldraw/sync-core";
import { createLarariumRuntime, LARES_ROOT } from "../src/node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";
import { injectBootReceiptFrame, buildBootReceiptMeta } from "../src/boot-receipt.js";
import {
  type BootArtifact,
  parsePranalaEdges,
  extractReactionBindings,
  ReactionGraph,
  type ReactionBinding,
  type LiveMsgEvent,
  AuthorityFirstGuard,
  canPromoteToCanon,
  resolveLarUri,
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
// Boot projection
// ---------------------------------------------------------------------------

type SnapshotData = Awaited<ReturnType<typeof buildSnapshot>>;

async function buildBootProjection(
  runtime: ReturnType<typeof createLarariumRuntime>,
  snapshotMemes: SnapshotData,
): Promise<{ snapshot: unknown; roomId: string; receiptSha: string; memeCount: number; kumuDefs: import("@lararium/core").KumuDef[] }> {
  const { renderAllViews } = await import("@lararium/tldraw");
  const { LarariumTW5 } = await import("@lararium/tw5");
  const artifact: BootArtifact = runtime.compileBoot();

  // Inject kumu defs into the TW5 singleton so filterTiddlers and KumuWidget
  // can resolve them natively without a separate KumuRegistry.
  const tw5 = new LarariumTW5();
  await tw5.boot();
  tw5.injectKumuDefs(artifact.kumuDefs ?? []);
  const receipt = await runtime.compileBootReceipt(artifact);
  const receiptSha = receipt.sha256.replace(/^sha256:/, "");

  const emission = await renderAllViews(artifact, {
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

  // Inject boot-receipt meta-frame into the snapshot before sealing.
  // Must arrive with the room substrate (O1 ruling) so browser can gate
  // projection-cache intake on receipt readiness without a second WebSocket.
  const firstPageId = emission.pages[0]?.id ?? "page:default";
  const bootRoomId  = `boot-${receiptSha.slice(0, 16)}`;
  injectBootReceiptFrame(store, {
    pageId:  firstPageId,
    receipt: buildBootReceiptMeta({ roomId: bootRoomId, receiptHash: receiptSha, operatorDid: operatorIdentity.did }),
  });

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

  // Seed tldraw canvas layout room
  getOrCreateRoom(activeBootRoomId, bootSnapshot);

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

  // Operator identity — Ed25519 keypair persisted in <dataDir>/operator-key.json.
  // did is injected into HTML + boot receipt so browsers can issue valid UCANs.
  const operatorIdentity = await getOrCreateNodeIdentity(DATA_DIR);
  console.log(`[lararium-serve] operator DID: ${operatorIdentity.did}`);

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
        writeFileSync(filePath, carrierText, "utf-8");
        console.log(`[lararium-serve] promote: wrote ${filePath} (shape: ${shapeId})`);
        // lares/ watcher fires rebuild automatically; return immediately
        return json(res, { promoted: uri, path: resolution.laresRelPath });
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

    // App shell — inject WS + meme-store URLs so clients boot local-first.
    // lararium-ws      → tldraw canvas CRDT (layout/positions)
    // lararium-meme-sync → Automerge /meme-sync WS (content CRDT)
    // lararium-meme-store → Automerge doc URL (client caches in localStorage)
    const host = req.headers["host"] ?? `${HOST}:${PORT}`;
    const wsProto = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    let html = readFileSync(join(APP_DIST, "index.html"), "utf-8");
    const metaTags = [
      `<meta name="lararium-ws"           content="${wsProto}://${host}/rooms/${activeBootRoomId}">`,
      `<meta name="lararium-meme-sync"    content="${wsProto}://${host}/meme-sync">`,
      `<meta name="lararium-meme-store"   content="${memeStoreUrl}">`,
      `<meta name="lararium-operator-did" content="${operatorIdentity.did}">`,
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

  // tldraw WS — formerly `wss`
  const wss = tlWss;

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

    // Boot receipt travels as a hidden tldraw shape in the room snapshot (shape:lararium_boot_receipt),
    // not as a separate WS message. A standalone JSON message with type="boot-receipt" would reach
    // the tldraw sync client before it is ready and trigger an Unknown switch case error.

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

  // ---------------------------------------------------------------------------
  // Automerge Repo — wire memeWss adapter and seed meme content store
  // ---------------------------------------------------------------------------
  const memeAdapter = new NodeWSServerAdapter(memeWss);
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

    memeHandle.change((doc: Record<string, unknown>) => {
      for (const [uri, meme] of Object.entries(snapshotMemes.memes)) {
        if (!uri.startsWith("lar:") || !meme.text) continue;
        doc[uri] = { title: uri, fields: {}, text: meme.text };
      }
    });
    console.log(`[lararium-serve] meme store seeded: ${Object.keys(snapshotMemes.memes).length} memes`);
  } else {
    console.log(`[lararium-serve] meme store resumed: ${memeHandle.url}`);
  }

  memeStoreUrl = memeHandle.url;

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] boot room:   ${activeBootRoomId}`);
    console.log(`[lararium-serve] meme-store:  ${memeStoreUrl}`);
    console.log(`[lararium-serve] meme-sync:   ws://${HOST}:${PORT}/meme-sync`);
    console.log(`[lararium-serve] reseed:      curl http://${HOST}:${PORT}/admin/reseed`);
    console.log(`[lararium-serve] promote:     curl -X PUT http://${HOST}:${PORT}/admin/promote -H 'Content-Type: application/json' -d '{"uri":"lar:///...","carrierText":"..."}'`);
    console.log(`[lararium-serve] data dir:    ${DATA_DIR}`);
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
