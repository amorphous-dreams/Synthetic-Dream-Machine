/**
 * Lararium Node Server — local-first relay + TW5 engine entrypoint.
 *
 * Boots one LarPeer per configured room, wires a WebSocket + HTTP server for
 * browser peers to sync against, and attaches a LarDiskProjector so
 * the packages/lares/memes tree stays in sync with the Automerge store.
 *
 * HTTP surface:
 *   GET /api/health    → { ok: true, phase, roomId }  (infra probe only)
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
 *
 * Bootstrap:
 *   The catalog Automerge URL is printed to stdout on boot.
 *   Share it as a URL fragment: http://HOST:PORT/#CATALOG_URL
 *   Browser peers read it from location.hash on first visit, cache to
 *   localStorage for offline return visits.
 */

import { createServer }                  from "http";
import WebSocket                         from "isomorphic-ws";
import { resolve }                       from "path";
import { openNodeLarPeer }               from "./open-node-lar-peer.js";
import { generateOrLoadOperatorKeypair } from "./operator-key.js";
import { join } from "path";
import { makeDiskProjectionKind }        from "./projection-kinds.js";
import { LARES_MEMES_ROOT, REPO_ROOT }   from "./node-host.js";
import {
  LarProjectionRegistry,
  laresPathStrategy, enginePathStrategy, roomShadowPathStrategy,
  BAG_IDS, roomBagId,
} from "@lararium/core";
import type { BagMirrorConfig } from "@lararium/core";
import { exportMemeText }                from "@lararium/tw5";


// ---------------------------------------------------------------------------
// CLI / env config
// ---------------------------------------------------------------------------

function parseArgs(): { port: number; storageDir: string; roomId: string; catalogUrl: string | null } {
  const args = process.argv.slice(2);
  const get  = (flag: string, env: string, fallback: string) => {
    const i = args.indexOf(flag);
    return (i !== -1 ? args[i + 1] : undefined) ?? process.env[env] ?? fallback;
  };
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
  state: { phase: string; roomId: string },
) {
  return (req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (url.pathname === "/api/health") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, phase: state.phase, roomId: state.roomId }));
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { port, storageDir, roomId, catalogUrl } = parseArgs();

  // Shared state — updated as boot phases fire.
  const state: { phase: string; roomId: string } = {
    phase:  "boot",
    roomId,
  };

  // HTTP server — /api/health for infra probes only. Relay does not serve content.
  const httpServer = createServer(makeHandler(state));

  // WS server — path-scoped to /ws only (local-first best practice: reject other upgrade paths
  // so a stray browser probe or dev tool WS never gets wired into Automerge sync).
  // `noServer: true` + manual handleProtocols lets us filter by path before upgrade.
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`[lararium] HTTP+WS server on :${port}  (GET /api/health  WS /ws)`);
  });

  // S7.1: device keypair generation moves to scripts/init-lararium.ts (lararium:init).
  // Loaded here for future use by createNodeSession / capability layer.
  const _operatorIdentity = await generateOrLoadOperatorKeypair(storageDir);

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
  const { peer, tw5 } = result;

  // Projection registry — declarative wiring for system projections.
  // Configs are programmatic here; migrate to admin-room tiddlers tagged
  // $:/tags/LarariumProjection once the admin VM lands (S5.6).
  const projections = new LarProjectionRegistry();

  // TODO: ReactionEngine not yet implemented in @lararium/core. Re-register
  // the "reaction" kind once it lands; current ReactionGraph maintenance is a
  // no-op here.

  // Bag mirror configs — which bags reflect to disk, and where.
  // TODO(S5.6): read from admin-room tiddlers tagged $:/tags/LarariumBagMirror.
  // Operator-private bags (identities/groups/sessions/admin) are absent — they
  // never reach disk; they live solely in .lararium/ Automerge storage.
  const mirrors: BagMirrorConfig[] = [
    // Canonical lares — only written via promotion ceremony (room → lares).
    { bagId: BAG_IDS.lares,    mirrorRoot: LARES_MEMES_ROOT,   toRelPath: laresPathStrategy },
    // Engine corpus — `lar:///ha.ka.ba/@lararium/{pkg}/v{ver}/{path}` →
    // `packages/{pkg-slug}/memes/{path}.md`. Workspace root is the mirror root.
    { bagId: BAG_IDS.lararium, mirrorRoot: join(REPO_ROOT, "packages"), toRelPath: enginePathStrategy },
    // Room bag — gitignored scratch. Edits land here; promotion is the move.
    { bagId: roomBagId(roomId), mirrorRoot: join(REPO_ROOT, "rooms", roomId), toRelPath: roomShadowPathStrategy },
  ];

  projections.registerKind("disk", makeDiskProjectionKind({
    mirrors,
    renderFn: async (uri) => { try { return exportMemeText(tw5, uri); } catch { return null; } },
  }));

  await projections.enable({ id: "disk", kind: "disk", enabled: true, fields: {} }, peer);

  console.log(`[lararium] live — room: ${roomId} | storage: ${storageDir}`);
  console.log(`[lararium] catalog:  ${result.catalogHandleUrl ?? "(none)"}`);
  console.log(`[lararium] lararium: ${result.larariumDocUrl ?? "(none)"}`);
  console.log(`[lararium] admin:    ${result.admin.adminHandle.url}`);
  console.log(`[lararium] connect:  http://localhost:${port}/#${result.larariumDocUrl ?? result.catalogHandleUrl ?? ""}`);

  const shutdown = () => {
    console.log("[lararium] shutting down");
    result.admin.dispose();
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
