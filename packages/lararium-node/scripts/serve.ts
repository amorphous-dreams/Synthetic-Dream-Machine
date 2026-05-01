/**
 * Lararium node peer — always-online local-first Automerge peer with seed capability.
 *
 * Local-first law:
 *   The server is NOT an authority. It is one peer among equals.
 *   It has two capabilities other peers typically lack:
 *     (1) Seed capability: reads lares/ + runs TW5 engine → writes canonical snapshot
 *         into shared docs. Any peer with this capability could do the same.
 *     (2) Always-online relay: NodeFS-backed Repo persists docs durably across
 *         browser disconnects. Acts as the rendezvous point until Beelay/p2p lands.
 *
 *   Automerge is source of truth. Server cannot overwrite client changes.
 *   Server creates docs at first boot only — subsequent boots resume from NodeFS.
 *   Browser creates its own docs if server is unreachable (offline-first).
 *
 * One Repo, one storage dir (.lararium-data/automerge/), all island docs inside.
 * Island doc URLs tracked in .lararium-data/islands/ by opaque URL files.
 *
 * Island layout:
 *   catalog  — hallway: names all rooms, corpora, recipes, snapshot URLs, heads
 *   rooms    — one per roomId; durable room content (pins, notes, recipe overrides)
 *   corpora  — one per corpus bag; content from lares/ carriers or projection codec
 *
 * Canon promotion: disabled. POST /keyhive/promotions is a future Keyhive seam.
 *
 * API routes:
 *   GET  /api/rooms      — room registry
 *   GET  /api/catalog    — catalog Automerge doc URL (rendezvous hint for new peers)
 *   GET  /admin/reseed   — re-run seed capability from lares/ into docs
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
  type CatalogDoc,
  type CatalogRoomEntry,
  type CatalogCorpusEntry,
  emptyCatalogDoc,
  type MemeStoreDoc,
} from "@lararium/core";
import { loadCorpusSources } from "../src/node-host.js";
import { getGhCliOperatorReceipt } from "../src/github-cli-auth.js";
import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
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

  // Operator receipt — prefer gh CLI identity, fall back to local-dev.
  const ghReceipt       = await getGhCliOperatorReceipt();
  const nodeAuthReceipt = ghReceipt ?? (await getOrCreateNodeAuthReceipt(DATA_DIR));
  console.log(`[lararium-serve] auth provider: ${nodeAuthReceipt.provider} (${nodeAuthReceipt.subject})`);
  // base64-encode for meta tag injection; browser reads via readServerInjectedReceipt()
  const operatorReceiptB64 = Buffer.from(JSON.stringify(nodeAuthReceipt)).toString("base64");

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

  const DEFAULT_ROOM = "altar-fire";

  // One Repo, one storage dir — all island docs (catalog, rooms, corpora) inside.
  // Island URL files tracked under islands/ by type and id.
  const AUTOMERGE_DIR = join(DATA_DIR, "automerge");
  const ISLANDS_DIR   = join(DATA_DIR, "islands");
  mkdirSync(AUTOMERGE_DIR, { recursive: true });
  mkdirSync(ISLANDS_DIR,   { recursive: true });

  // Peer authorization registry — populated by /auth/session, consumed by sharePolicy.
  const peerRegistry = new LarAuthSessionRegistry();
  peerRegistry.registerPeer("server:self", nodeAuthReceipt);

  // Evict expired auth sessions every 10 minutes.
  setInterval(() => peerRegistry.evictExpired(), 10 * 60 * 1000);

  // catalogUrl declared here so the HTTP handler can reference it.
  let catalogUrl = "";

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
        // Reseed lares corpus island only — room doc stays untouched (island law).
        const corpusDir = join(ISLANDS_DIR, "corpora", "lares");
        const urlFile   = join(corpusDir, "doc-url.txt");
        if (existsSync(urlFile)) {
          const corpusUrl    = readFileSync(urlFile, "utf8").trim() as AutomergeUrl;
          const corpusHandle = await memeRepo.find<MemeStoreDoc>(corpusUrl);
          corpusHandle.change((doc) => {
            for (const [uri, meme] of Object.entries(snapshotMemes.memes)) {
              if (!uri.startsWith("lar:") || !meme.text) continue;
              doc[uri] = { title: uri, fields: meme.fields ?? {}, text: meme.text, bag: "lares" };
            }
          });
        }
        return json(res, { reseeded: "corpus:lares", sha: receiptSha });
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

    // ── /api/catalog ──────────────────────────────────────────────────────
    if (pathname === "/api/catalog") {
      return json(res, { url: catalogUrl });
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

      const result = await verifyAuthClaim({ provider, ...(receipt !== undefined && { receipt }), proof });
      if (!result.ok) return json(res, { error: result.reason }, 403);

      peerRegistry.registerPeer(peerId, result.receipt);
      console.log(`[lararium-serve] /auth/session: authorized peer ${peerId} via ${result.receipt.provider} (${result.receipt.subject})`);
      return json(res, { ok: true, provider: result.receipt.provider, subject: result.receipt.subject });
    }

    // ── Bluesky AT Proto OAuth — client-side PKCE+DPoP flow ─────────────────
    // The browser handles the full AT Proto OAuth dance via @atproto/oauth-client-browser.
    // The server only needs to serve the client metadata document and handle the
    // callback redirect (which the browser intercepts via client.init() on load).
    //
    // For localhost: AT Proto allows client_id = "http://localhost" — no metadata doc needed.
    // For production (elyncia.app): serve client-metadata.json at /oauth/client-metadata.json.
    if (pathname === "/oauth/client-metadata.json") {
      const host = req.headers["host"] ?? "localhost";
      const proto = req.headers["x-forwarded-proto"] ?? "http";
      const base = `${proto}://${host}`;
      return json(res, {
        client_id:     `${base}/oauth/client-metadata.json`,
        client_name:   "Lararium",
        redirect_uris: [`${base}/auth/bluesky/callback`],
        scope:         "atproto transition:generic",
        grant_types:   ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        dpop_bound_access_tokens: true,
      });
    }

    // Bluesky callback — the browser's @atproto/oauth-client-browser handles
    // the token exchange client-side via client.init() on this page load.
    // The server just serves the app shell; the browser does the rest.
    if (pathname === "/auth/bluesky/callback") {
      // Fall through to app shell serving below.
    }

    // ── GitHub OAuth — env-var-gated web flow ────────────────────────────────
    // Wire GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET to enable.
    const ghClientId     = process.env["GITHUB_CLIENT_ID"];
    const ghClientSecret = process.env["GITHUB_CLIENT_SECRET"];

    if (pathname === "/auth/github/start") {
      if (!ghClientId) return json(res, { error: "github-oauth-not-configured" }, 501);
      const state = Math.random().toString(36).slice(2);
      const host  = req.headers["host"] ?? `${HOST}:${PORT}`;
      const proto = req.headers["x-forwarded-proto"] ?? "http";
      const redirectUri = encodeURIComponent(`${proto}://${host}/auth/github/callback`);
      const url = `https://github.com/login/oauth/authorize?client_id=${ghClientId}&scope=read:user&state=${state}&redirect_uri=${redirectUri}`;
      res.writeHead(302, { Location: url });
      res.end();
      return;
    }

    if (pathname === "/auth/github/callback") {
      if (!ghClientId || !ghClientSecret) return json(res, { error: "github-oauth-not-configured" }, 501);
      const code = new URL(`http://x${url}`).searchParams.get("code");
      if (!code) return json(res, { error: "missing-code" }, 400);
      try {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: ghClientId, client_secret: ghClientSecret, code }),
        });
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
        if (!tokenData.access_token) throw new Error(tokenData.error ?? "no-token");
        const userRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "lararium-node/0.1" },
        });
        const user = await userRes.json() as { login: string; id: number; name?: string };
        const now     = new Date();
        const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const receipt: LarAuthReceipt = {
          provider:    "github-vscode",
          subject:     `github:${user.login}`,
          displayName: user.name ?? user.login,
          issuedAt:    now.toISOString(),
          expiresAt:   expires.toISOString(),
          scopes:      [{ with: "lararium:*", can: "*" }],
          principal: {
            provider: "github-vscode", login: user.login,
            githubId: String(user.id), editor: "vscode",
            localInstanceId: `github-oauth:${user.login}`,
          },
        };
        // Inject receipt via meta tag on next page load — redirect back to app.
        const b64 = Buffer.from(JSON.stringify(receipt)).toString("base64");
        // Short-lived cookie so the receipt survives the redirect without being in the URL.
        res.writeHead(302, {
          Location: "/",
          "Set-Cookie": `lararium_auth=${b64}; Path=/; HttpOnly; SameSite=Lax; Max-Age=60`,
        });
        res.end();
      } catch (e) {
        return json(res, { error: String(e) }, 500);
      }
      return;
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
      `<meta name="lararium-room"             content="${serveRoomId}">`,
      `<meta name="lararium-meme-sync"        content="${wsProto}://${host}/meme-sync">`,
      `<meta name="lararium-catalog"          content="${catalogUrl}">`,
      `<meta name="lararium-receipt"          content="${receiptSha}">`,
      `<meta name="lararium-operator-receipt" content="${operatorReceiptB64}">`,
      ...(process.env["GITHUB_CLIENT_ID"] ? [`<meta name="lararium-github-oauth" content="1">`] : []),
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

  // CatalogDoc has readonly fields; Automerge change() receives a mutable draft.
  type DraftCatalogDoc = {
    -readonly [K in keyof import("@lararium/core").CatalogDoc]: import("@lararium/core").CatalogDoc[K];
  };

  // ---------------------------------------------------------------------------
  // Automerge Repo — one Repo, per-island docs inside
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memeAdapter = new NodeWSServerAdapter(memeWss as any);
  const memeRepo    = new Repo({
    storage: new NodeFSStorageAdapter(AUTOMERGE_DIR),
    network: [memeAdapter],
    sharePolicy: async (peerId: string) => peerRegistry.isAuthorized(peerId),
  });

  // ---------------------------------------------------------------------------
  // Helper: open or create a persisted Automerge doc by URL file
  // ---------------------------------------------------------------------------
  async function openOrCreate<T>(
    urlFile: string,
    init: () => T,
  ): Promise<DocHandle<T>> {
    if (existsSync(urlFile)) {
      const url = readFileSync(urlFile, "utf8").trim() as AutomergeUrl;
      return memeRepo.find<T>(url);
    }
    const handle = memeRepo.create<T>(init());
    writeFileSync(urlFile, handle.url, "utf8");
    return handle;
  }

  // ---------------------------------------------------------------------------
  // Catalog doc — hallway; names all islands
  // ---------------------------------------------------------------------------
  const catalogHandle = await openOrCreate<CatalogDoc>(
    join(ISLANDS_DIR, "catalog.txt"),
    emptyCatalogDoc,
  );
  catalogUrl = catalogHandle.url;
  console.log(`[lararium-serve] catalog: ${catalogUrl}`);

  // ---------------------------------------------------------------------------
  // Helper: open or create a room content doc, register in catalog.
  //
  // Island law: room doc starts EMPTY. Corpus content lives in corpus islands
  // (openOrCreateCorpus). CompositeStore recipe on the browser merges
  // corpus (canon, read-only) below room (writable) — no duplication.
  // Seeding the room doc with corpus content would bloat the room island and
  // defeat the causal-island split.
  // ---------------------------------------------------------------------------
  async function openOrCreateRoom(roomId: string): Promise<DocHandle<MemeStoreDoc>> {
    const roomDir = join(ISLANDS_DIR, "rooms", roomId);
    mkdirSync(roomDir, { recursive: true });
    const urlFile = join(roomDir, "doc-url.txt");
    const firstBoot = !existsSync(urlFile);

    const handle = await openOrCreate<MemeStoreDoc>(urlFile, () => ({}));

    if (firstBoot) {
      console.log(`[lararium-serve] room ${roomId} created (empty): ${handle.url}`);
    } else {
      console.log(`[lararium-serve] room ${roomId} resumed: ${handle.url}`);
    }

    // Register room entry in catalog doc
    const roomEntry: CatalogRoomEntry = {
      id:             roomId,
      contentDocUrl:  handle.url,
      schemaVersion:  "0.1",
    };
    catalogHandle.change((doc) => {
      const d = doc as DraftCatalogDoc;
      d.rooms ??= {};
      d.rooms[roomId] = roomEntry;
    });

    return handle;
  }

  // ---------------------------------------------------------------------------
  // openOrCreateCorpus — one content doc per corpus bag (M12 island split)
  //
  // Corpus docs start empty; content seeding from raw markdown → tiddler records
  // travels through the projection codec (separate M12 sub-task).
  // The catalog entry is written immediately so browsers can resolve the doc URL.
  // ---------------------------------------------------------------------------
  async function openOrCreateCorpus(bagId: string): Promise<DocHandle<MemeStoreDoc>> {
    const corpusDir = join(ISLANDS_DIR, "corpora", bagId);
    mkdirSync(corpusDir, { recursive: true });
    const urlFile  = join(corpusDir, "doc-url.txt");
    const firstBoot = !existsSync(urlFile);

    const handle = await openOrCreate<MemeStoreDoc>(urlFile, () => ({}));

    if (firstBoot) {
      console.log(`[lararium-serve] corpus ${bagId} created: ${handle.url}`);
      // Content seeding from lares/ carriers for the quine corpus only.
      // Non-quine corpora (elyncia, ftls, sdm, wtf) seed via projection codec — pending.
      if (bagId === "lares") {
        handle.change((doc) => {
          for (const [uri, meme] of Object.entries(snapshotMemes.memes)) {
            if (!uri.startsWith("lar:") || !meme.text) continue;
            // Top-level bag field stamps the recipe layer for CompositeStore._freeze().
            doc[uri] = { title: uri, fields: meme.fields ?? {}, text: meme.text, bag: bagId };
          }
        });
        console.log(`[lararium-serve] corpus lares seeded: ${Object.keys(snapshotMemes.memes).length} memes`);
      }
    } else {
      console.log(`[lararium-serve] corpus ${bagId} resumed: ${handle.url}`);
    }

    const entry: CatalogCorpusEntry = {
      id:            bagId,
      docUrl:        handle.url,
      schemaVersion: "0.1",
    };
    catalogHandle.change((doc) => {
      const d = doc as DraftCatalogDoc;
      d.corpora ??= {};
      d.corpora[bagId] = entry;
    });

    return handle;
  }

  // Warm the default room at boot so its URL is in the catalog immediately.
  await openOrCreateRoom(DEFAULT_ROOM);

  // Warm all corpus islands from the registry.
  const corpusSources = loadCorpusSources();
  await Promise.all(corpusSources.map((c) => openOrCreateCorpus(c.bag)));

  // Disk write-back and lares/ file watcher removed — file sync refactor in progress.

  httpServer.listen(PORT, HOST, () => {
    console.log(`[lararium-serve] http://${HOST}:${PORT}`);
    console.log(`[lararium-serve] default room: /room/${DEFAULT_ROOM}  (or /room/<any-id>)`);
    console.log(`[lararium-serve] receipt:      ${receiptSha.slice(0, 16) || "(none)"}`);
    console.log(`[lararium-serve] catalog:      ${catalogUrl}`);
    console.log(`[lararium-serve] corpora:      ${corpusSources.map((c) => c.bag).join(", ")}`);
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
