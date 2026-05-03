/**
 * Lararium Node Server — local-first relay + TW5 engine entrypoint.
 *
 * Boots one LarPeer per configured room, wires a WebSocket + HTTP server for
 * browser peers to sync against, and attaches a LarDiskProjector so
 * the packages/lares/memes tree stays in sync with the Automerge store.
 *
 * HTTP surface (cold-bootstrap Tier 0):
 *   GET /api/catalog   → { catalogUrl: "automerge:..." }
 *   GET /api/health    → { ok: true, phase, roomId }
 *
 * WS surface (sync):
 *   ws://localhost:8080/ws  → Automerge sync protocol
 *   (Vite dev proxy: /ws → ws://localhost:8080)
 *
 * Usage:
 *   node dist/main.js [--port 8080] [--storage .lararium] [--room altar-fire]
 *
 * Environment:
 *   LAR_PORT     — HTTP+WS server port (default 8080)
 *   LAR_STORAGE  — storage directory (default .lararium)
 *   LAR_ROOM     — room id (default altar-fire)
 *   LAR_CATALOG  — existing catalog automerge URL to join (optional)
 */

import { createServer }    from "http";
import { WebSocketServer } from "ws";
import { resolve }         from "path";
import { openNodeLarPeer } from "./open-node-lar-peer.js";
import { LarDiskProjector } from "./disk-projector.js";
import { LARES_MEMES_ROOT } from "./node-host.js";
import { ReactionEngine }   from "@lararium/core";
import { exportMemeText }   from "@lararium/tw5";
import { seedLarariumDoc, reconcileEngineBlobIfChanged, reconcilePreloadsBlobIfChanged } from "./lararium-island.js";
import type { NodeLarPeerResult } from "./open-node-lar-peer.js";

// ---------------------------------------------------------------------------
// CLI / env config
// ---------------------------------------------------------------------------

function parseArgs(): { port: number; storageDir: string; roomId: string; catalogUrl: string | null } {
  const args = process.argv.slice(2);
  const get  = (flag: string, env: string, fallback: string) =>
    args[args.indexOf(flag) + 1] ?? process.env[env] ?? fallback;
  return {
    port:       Number(get("--port",    "LAR_PORT",    "8080")),
    storageDir: resolve(get("--storage","LAR_STORAGE", ".lararium")),
    roomId:     get("--room",    "LAR_ROOM",    "altar-fire"),
    catalogUrl: process.env["LAR_CATALOG"] ?? null,
  };
}

// ---------------------------------------------------------------------------
// HTTP handler — cold-bootstrap Tier 0
// ---------------------------------------------------------------------------

function makeHandler(
  state: { result: NodeLarPeerResult | null; phase: string; roomId: string },
) {
  return (req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    if (url.pathname === "/api/catalog") {
      // Retrieve catalogUrl from the repo's catalog handle.
      // The Automerge Repo exposes all handles; catalog was the first doc created.
      // We store it on the result object for easy access.
      const catalogUrl = state.result?.catalogHandleUrl ?? null;
      if (!catalogUrl) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: "catalog not yet ready", phase: state.phase }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ catalogUrl, roomId: state.roomId }));
      return;
    }

    if (url.pathname === "/api/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, phase: state.phase, roomId: state.roomId }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { port, storageDir, roomId, catalogUrl } = parseArgs();

  // Shared state — populated after openNodeLarPeer resolves.
  const state: { result: NodeLarPeerResult | null; phase: string; roomId: string } = {
    result: null,
    phase:  "boot",
    roomId,
  };

  // HTTP server — handles /api/* requests.
  const httpServer = createServer(makeHandler(state));

  // WS server — path-scoped to /ws only (local-first best practice: reject other upgrade paths
  // so a stray browser probe or dev tool WS never gets wired into Automerge sync).
  // `noServer: true` + manual handleProtocols lets us filter by path before upgrade.
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`[lararium] HTTP+WS server on :${port}  (HTTP /api/*  WS /ws)`);
  });

  const result = await openNodeLarPeer({
    hostId:     "lararium-node",
    roomId,
    storageDir,
    wss,
    catalogUrl,
    onPhase: (phase) => {
      state.phase = phase;
      console.log(`[lararium] phase → ${phase}`);
    },
  });
  state.result = result;

  const { peer, tw5, repo } = result;

  // ── LarariumDoc seeder — system bag bootstrap ────────────────────────────
  // Loop B: seed once on first boot; reconcile blob on resume if version changed.
  const catalogHandle = repo.find<import("@lararium/core").CatalogDoc>(
    result.catalogHandleUrl as import("@automerge/automerge-repo").AutomergeUrl,
  );
  const existingLarariumDocUrl = (await catalogHandle).doc()?.larariumDoc?.docUrl ?? null;

  if (!existingLarariumDocUrl) {
    try {
      const { handle: larariumDocHandle } = await seedLarariumDoc(repo);
      (await catalogHandle).change((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).larariumDoc = {
          version: (larariumDocHandle.doc() as any)?.blobs?.["tiddlywikicore"]?.version ?? "unknown",
          docUrl:  larariumDocHandle.url,
          sha256:  (larariumDocHandle.doc() as any)?.blobs?.["tiddlywikicore"]?.sha256 ?? "",
        };
      });
      console.log(`[lararium] larariumDoc seeded: ${larariumDocHandle.url}`);
    } catch (err) {
      // Non-fatal: TW5 core blob may be missing in dev without build step.
      console.warn(`[lararium] larariumDoc seed skipped: ${String(err)}`);
    }
  } else {
    // Resume boot: reconcile TW5 core blob if version changed on disk.
    try {
      const larariumDocHandle = await repo.find<import("@lararium/core").LarariumDoc>(
        existingLarariumDocUrl as import("@automerge/automerge-repo").AutomergeUrl,
      );
      await reconcileEngineBlobIfChanged(larariumDocHandle);
      await reconcilePreloadsBlobIfChanged(larariumDocHandle);
    } catch { /* blob unchanged or file missing — no-op */ }
  }

  // Reaction bus — maintains ReactionGraph from CRDT changes.
  const engine = new ReactionEngine();
  engine.boot(tw5);
  peer.addProjection(engine);

  // Disk projector — write meme files on any lar: change.
  // exportMemeText gives lossless .md round-trip (TOML iam block + wikitext body).
  const projector = new LarDiskProjector(
    LARES_MEMES_ROOT,
    async (uri) => { try { return exportMemeText(tw5, uri); } catch { return null; } },
  );
  projector.start(peer.store);

  console.log(`[lararium] live — room: ${roomId} | storage: ${storageDir}`);
  console.log(`[lararium] catalog: ${result.catalogHandleUrl ?? "(none)"}`);

  const shutdown = () => {
    console.log("[lararium] shutting down");
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[lararium] fatal:", err);
  process.exit(1);
});
