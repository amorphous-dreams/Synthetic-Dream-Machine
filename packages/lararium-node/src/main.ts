/**
 * Lararium Node Server — local-first relay + TW5 engine entrypoint.
 *
 * Boots one LarPeer per configured wiki, wires a WebSocket + HTTP server for
 * browser peers to sync against, and attaches a LarDiskProjector so
 * the packages/lares-core/memes tree stays in sync with the Automerge store.
 *
 * HTTP surface:
 *   GET /api/health    → { ok: true, phase, wikiId }  (infra probe only)
 *
 * WS surface (sync):
 *   ws://localhost:8080/ws  → Automerge sync protocol
 *   (Vite dev proxy: /ws → ws://localhost:8080)
 *
 * Usage:
 *   node dist/main.js [--port 8080] [--storage .lararium] [--wiki altar-fire] [--root /alt/root]
 *
 * Environment:
 *   LAR_PORT     — HTTP+WS server port (default 8080)
 *   LAR_STORAGE  — storage directory (default {root}/.lararium)
 *   LAR_WIKI     — wiki id (default altar-fire)
 *   LAR_CATALOG  — existing catalog automerge URL to join (optional)
 *   LAR_ROOT     — alternate repo root for all mirror paths (default: monorepo root).
 *                  Set to an isolated test dir so promote/sync writes never touch
 *                  canonical packages/ or wikis/ paths.
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
import { join } from "path";
import { makeDiskProjectionKind }        from "./projection-kinds.js";
import { REPO_ROOT }   from "./node-host.js";
import {
  LarProjectionRegistry,
  LARES_DOC_URI, LARARIUM_DOC_URI,
} from "@lararium/mesh";
import type { CompositeStore }               from "@lararium/mesh";
import { exportMemeText }                    from "@lararium/tw5";
import { namedBagPath, wikiBagPath } from "./bag-paths.js";
import type { BagMirrorConfig } from "./bag-paths.js";

const WIKI_ORACLE_PREFIX = "lar:///ha.ka.ba/@lararium/wikis/";

/**
 * Build bag-mirror configs from the named-bag layout.
 *
 * Static bags (lares, lararium) derive their mirror paths from scope alone —
 * no oracle fields needed. Wiki bags are discovered by scanning visible
 * tiddlers for the wiki oracle prefix; each wiki name determines its mirror.
 */
async function buildBagMirrors(
  composite: CompositeStore,
  rootDir: string,
): Promise<BagMirrorConfig[]> {
  const mirrors: BagMirrorConfig[] = [
    { bagId: LARES_DOC_URI,    mirrorRoot: join(rootDir, "bags/@lares"),    toRelPath: namedBagPath("@lares") },
    { bagId: LARARIUM_DOC_URI, mirrorRoot: join(rootDir, "bags/@lararium"), toRelPath: namedBagPath("@lararium") },
  ];

  // Wiki bags — discovered from well-known oracle URI prefix.
  const allTitles = await composite.listVisible();
  const wikiPath  = wikiBagPath();
  for (const title of allTitles) {
    if (!title.startsWith(WIKI_ORACLE_PREFIX)) continue;
    if (title.includes("/drafts/"))           continue;
    const wikiName = title.slice(WIKI_ORACLE_PREFIX.length);
    if (!wikiName || wikiName.includes("/"))  continue;
    mirrors.push({
      bagId:      title,
      mirrorRoot: join(rootDir, "wikis", wikiName),
      toRelPath:  wikiPath,
    });
  }

  console.log(`[lararium] ${mirrors.length} bag-mirror config(s)`);
  return mirrors;
}


// ---------------------------------------------------------------------------
// CLI / env config
// ---------------------------------------------------------------------------

function parseArgs(): { port: number; storageDir: string; genesisDir: string; wikiId: string; rootDir: string; catalogUrl: string | null; debugJson: boolean } {
  const args = process.argv.slice(2);
  const get  = (flag: string, env: string, fallback: string) => {
    const i = args.indexOf(flag);
    return (i !== -1 ? args[i + 1] : undefined) ?? process.env[env] ?? fallback;
  };
  const rootDir    = resolve(get("--root", "LAR_ROOT", REPO_ROOT));
  const storageDir = resolve(get("--storage", "LAR_STORAGE", join(rootDir, ".lararium")));
  const genesisDir = resolve(get("--genesis", "LAR_GENESIS", join(rootDir === REPO_ROOT ? join(REPO_ROOT, "packages", "lararium-node") : rootDir, "genesis")));
  return {
    port:       Number(get("--port", "LAR_PORT", "8080")),
    storageDir,
    genesisDir,
    wikiId:     get("--wiki", "LAR_WIKI", "altar-fire"),
    rootDir,
    catalogUrl: process.env["LAR_CATALOG"] ?? null,
    debugJson:  args.includes("--debug") || process.env["LAR_DEBUG_JSON"] === "1",
  };
}

// ---------------------------------------------------------------------------
// HTTP handler — cold-bootstrap Tier 0
// ---------------------------------------------------------------------------

function makeHandler(
  state: { phase: string; wikiId: string },
) {
  return (req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (url.pathname === "/api/health") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, phase: state.phase, wikiId: state.wikiId }));
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
  const { port, storageDir, genesisDir, wikiId, rootDir, catalogUrl, debugJson } = parseArgs();

  // Shared state — updated as boot phases fire.
  const state: { phase: string; wikiId: string } = {
    phase:  "boot",
    wikiId,
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

  const result = await openNodeLarPeer({
    hostId:     "lararium-node",
    wikiId,
    storageDir,
    genesisDir,
    rootDir,
    wss,
    catalogUrl,
    onPhase: (phase) => {
      state.phase = phase;
      console.log(`[lararium] phase → ${phase}`);
    },
  });
  const { peer, tw5 } = result;

  // Projection registry — declarative wiring for system projections.
  // Configs are programmatic here; migrate to admin-wiki tiddlers tagged
  // $:/tags/LarariumProjection once the admin VM lands (S5.6).
  const projections = new LarProjectionRegistry();

  // TODO: ReactionEngine not yet implemented in @lararium/mesh. Re-register
  // the "reaction" kind once it lands; current ReactionGraph maintenance is a
  // no-op here.

  const mirrors = await buildBagMirrors(result.store, rootDir);

  projections.registerKind("disk", makeDiskProjectionKind({
    mirrors,
    tw5,
    renderFn: async (uri) => { try { return exportMemeText(tw5, uri); } catch { return null; } },
    debugJson,
  }));

  await projections.enable({ id: "disk", kind: "disk", enabled: true, fields: {} }, peer);

  console.log(`[lararium] live — wiki: ${wikiId} | storage: ${storageDir} | root: ${rootDir}`);
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
