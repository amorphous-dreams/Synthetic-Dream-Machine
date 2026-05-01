/**
 * Lararium sync server — local-first Automerge peer.
 *
 * Architecture:
 *   - Server plays two roles:
 *     (1) Seeder: boots a TW5 wiki-engine instance at startup (and on /admin/reseed) to
 *         compute the lares/ snapshot and seed the shared Automerge meme-store doc.
 *     (2) Wiki-VM peer: MCP sidecar may invoke the server for live TW5 filter queries,
 *         projections, and canonical receipt computation without a browser client.
 *   - Server is a local-first PEER, not an authority. Automerge is source of truth.
 *   - Automerge Repo (NodeFS storage) syncs meme content with all connected clients.
 *   - One WebSocket path: /meme-sync → Automerge NodeWSServerAdapter (content CRDT).
 *   - Static assets from lararium-app/dist/ served over HTTP on the same port.
 *
 * Canon promotion:
 *   Removed from this server. Future promotion belongs to a Keyhive-backed
 *   proposal/receipt graph plus a separate projection/write-back worker.
 *
 * API routes:
 *   GET  /api/rooms      — room registry (MCP canvas bridge)
 *   GET  /api/meme-store — Automerge doc URL for the meme content store
 *   GET  /admin/reseed   — rebuild snapshot/receipt from lares/ and reseed Automerge doc
 *
 * Boot contract:
 *   1. Build lares/ snapshot → seed Automerge doc (skipped if doc already exists on disk)
 *   2. Compute boot receipt SHA (corpus integrity fingerprint) → inject into HTML <meta>
 *   3. All subsequent client loads receive receipt + Automerge doc URL via <meta> tags
 *
 * Known gaps:
 *   - Per-room Automerge docs not yet implemented (all clients share one doc) — M12
 *   - Disk↔Automerge sync loop (projector + watcher) being redesigned — M11+
 *   - Browser e2e (Playwright smoke) not yet run against live server — M11 P0
 *
 * Usage:
 *   pnpm --filter @lararium/node serve
 *   LARARIUM_PORT=4321 LARARIUM_HOST=0.0.0.0 pnpm --filter @lararium/node serve
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "fs";
import { join, extname, resolve } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { createLarariumRuntime } from "../src/node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";
import {
  LarAuthSessionRegistry,
  verifyAuthClaim,
  type LarAuthProvider,
  type LarAuthReceipt,
} from "@lararium/core";
import { getOrCreateNodeAuthReceipt } from "../src/operator-key.js";
import { TW5_CORE_SCRIPT_URL } from "@lararium/tw5";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../");
const APP_DIST  = join(REPO_ROOT, "packages/lararium-app/dist");
const APP_PUBLIC = join(REPO_ROOT, "packages/lararium-app/public");
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

function serveStatic(res: ServerResponse, filePath: string, root: string): boolean {
  const resolved = resolve(filePath);
  if (!resolved.startsWith(root + "/") && resolved !== root) {
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

  // Local auth receipt — provider-neutral placeholder until BlueSky OAuth and
  // GitHub VS Code claim verification land.
  const nodeAuthReceipt = await getOrCreateNodeAuthReceipt(DATA_DIR);
  console.log(`[lararium-serve] auth provider: ${nodeAuthReceipt.provider} (${nodeAuthReceipt.subject})`);

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

  // DEFAULT_ROOM — stable room ID for meta tag injection and /api/rooms.
  // Multi-room HTTP: /room/:id routes all serve the same Automerge doc.
  const DEFAULT_ROOM = "altar-fire";

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


  // Peer authorization registry — populated by /auth/session, consumed by sharePolicy.
  const peerRegistry = new LarAuthSessionRegistry();
  peerRegistry.registerPeer("server:self", nodeAuthReceipt);

  // Evict expired auth sessions every 10 minutes.
  setInterval(() => peerRegistry.evictExpired(), 10 * 60 * 1000);

  // memeWss is declared below after httpServer; adapter is wired then.
  // memeStoreUrl declared here so the HTTP handler can reference it.
  let memeStoreUrl = "";

  // ---------------------------------------------------------------------------
  // HTTP server
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";
    // ── API ────────────────────────────────────────────────────────────────
    if (pathname === "/api/rooms") {
      return json(res, { defaultRoom: DEFAULT_ROOM });
    }

    // Admin: force-reseed — rebuild snapshot/receipt from lares/ and patch Automerge
    if (pathname === "/admin/reseed") {
      const remoteAddr = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
      if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1") {
        return json(res, { error: "forbidden" }, 403);
      }
      try {
        snapshotMemes = await buildSnapshot(runtime);
        receiptSha    = await computeReceiptSha(runtime);
        return json(res, { reseeded: DEFAULT_ROOM, sha: receiptSha });
      } catch (e) {
        return json(res, { error: String(e) }, 500);
      }
    }

    // Canon promotion stub — the old localhost mutation path is gone.
    // Future flow: POST proposal to a Keyhive-backed authority graph, receive a
    // promotion receipt, then let a separate projection/write-back worker touch
    // disk. This endpoint only marks the territory; it performs no mutation.
    if (pathname === "/keyhive/promotions" && req.method === "POST") {
      return json(res, {
        error: "keyhive-promotion-graph-not-wired",
        next: "Submit room/draft proposals here once Keyhive membership and promotion receipts exist.",
      }, 501);
    }

    // ── /api/meme-store ────────────────────────────────────────────────────
    if (pathname === "/api/meme-store") {
      return json(res, { url: memeStoreUrl });
    }

    // ── /auth/session — provider-neutral auth claim (browser/editor → server) ───
    // Browser/local UX posts: { peerId, provider, receipt?, proof? }
    //
    // Provider plan:
    //   bluesky-oauth  — web OAuth callback on elyncia.app materializes receipt.
    //   github-vscode  — VS Code / Insiders extension signs in to GitHub and hands
    //                    this local app a receipt over loopback or command bridge.
    //   local-dev      — temporary permissive local receipt for current development.
    if (pathname === "/auth/session" && req.method === "POST") {
      let body: { peerId?: string; provider?: LarAuthProvider; receipt?: LarAuthReceipt; proof?: unknown };
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

      const { peerId, provider = "local-dev", receipt, proof } = body;
      if (!peerId) return json(res, { error: "peerId is required" }, 400);

      const result = await verifyAuthClaim({ provider, receipt, proof });
      if (!result.ok) return json(res, { error: result.reason }, 403);

      peerRegistry.registerPeer(peerId, result.receipt);
      console.log(`[lararium-serve] /auth/session: authorized peer ${peerId} via ${result.receipt.provider} (${result.receipt.subject})`);
      return json(res, { ok: true, provider: result.receipt.provider, subject: result.receipt.subject });
    }

    // Future provider route placeholders. They intentionally return 501 until
    // the OAuth metadata/callback and VS Code local UX exist.
    if (pathname === "/auth/bluesky/start") {
      return json(res, { error: "bluesky-oauth-not-implemented" }, 501);
    }
    if (pathname === "/auth/github-vscode/claim") {
      return json(res, { error: "github-vscode-claim-not-implemented" }, 501);
    }

    // ── Static ─────────────────────────────────────────────────────────────
    const isAsset = pathname !== "/" && /\.[a-z0-9]+$/i.test(pathname);
    if (isAsset) {
      // Check public/ first (vendored assets like tiddlywikicore-*.js) then dist/
      if (serveStatic(res, join(APP_PUBLIC, pathname), APP_PUBLIC)) return;
      if (serveStatic(res, join(APP_DIST, pathname), APP_DIST)) return;
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
      `<meta name="lararium-meme-sync"    content="${wsProto}://${host}/meme-sync">`,
      `<meta name="lararium-meme-store"   content="${memeStoreUrl}">`,
      `<meta name="lararium-receipt"      content="${receiptSha}">`,
    ].join("\n  ");
    // External core script — suppress auto-boot so LarariumTW5 controls the
    // boot sequence (preloadTiddlers injected before boot() is called).
    const tw5Scripts = [
      `<script>window.$tw = window.$tw || {}; window.$tw.boot = window.$tw.boot || {}; window.$tw.boot.suppressBoot = true;</script>`,
      `<script src="${TW5_CORE_SCRIPT_URL}"></script>`,
    ].join("\n  ");
    html = html.replace("</head>", `  ${metaTags}\n  ${tw5Scripts}\n</head>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  // ---------------------------------------------------------------------------
  // WebSocket routing — noServer mode.
  //   /meme-sync  → Automerge NodeWSServerAdapter (content CRDT, sole WS path)
  // ---------------------------------------------------------------------------
  const memeWss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    const pathname = new URL(req.url ?? "/", `ws://${HOST}:${PORT}`).pathname;
    if (pathname.startsWith("/meme-sync")) {
      memeWss.handleUpgrade(req, socket, head, (ws) => memeWss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  // ---------------------------------------------------------------------------
  // Automerge Repo — wire memeWss adapter and seed meme content store
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memeAdapter = new NodeWSServerAdapter(memeWss as any);
  const memeRepo    = new Repo({
    storage: new NodeFSStorageAdapter(MEME_STORE_DIR),
    network: [memeAdapter],
    // Authorization hook — sync peers must hold a provider-neutral auth receipt.
    // Policy remains coarse here; catalog/room/corpus checks will refine ability.
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

  // Disk write-back and lares/ file watcher removed — file sync refactor in progress.

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] default room: /room/${DEFAULT_ROOM}  (or /room/<any-id>)`);
    console.log(`[lararium-serve] receipt:      ${receiptSha.slice(0, 16) || "(none)"}`);
    console.log(`[lararium-serve] meme-store:   ${memeStoreUrl}`);
    console.log(`[lararium-serve] meme-sync:    ws://${HOST}:${PORT}/meme-sync`);
    console.log(`[lararium-serve] reseed:       curl http://${HOST}:${PORT}/admin/reseed`);
    console.log(`[lararium-serve] promote:      disabled; future stub POST /keyhive/promotions`);
    console.log(`[lararium-serve] data dir:     ${DATA_DIR}`);
  });

  // ---------------------------------------------------------------------------
  // Reaction graph (MCP wiki-VM peer role): compile pranala edges from the boot
  // artifact into a ReactionGraph and wire into the MCP sidecar "fire"/projection
  // handler when that endpoint lands. Import ReactionGraph, extractReactionBindings,
  // BootArtifact, ReactionBinding from @lararium/core at that point.
  //
  // Disk↔Automerge sync loop (projector + watcher) being redesigned — M11+.
}

main().catch((e) => { console.error(e); process.exit(1); });
