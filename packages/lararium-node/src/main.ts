/**
 * Lararium Node Server — local-first relay + TW5 engine entrypoint.
 *
 * Boots one LarPeer per configured room, wires a WebSocket server for
 * browser peers to sync against, and attaches a LarDiskProjector so
 * the packages/lares/memes tree stays in sync with the Automerge store.
 *
 * Usage:
 *   node dist/main.js [--port 8080] [--storage .lararium] [--room altar-fire]
 *
 * Environment:
 *   LAR_PORT     — WS server port (default 8080)
 *   LAR_STORAGE  — storage directory (default .lararium)
 *   LAR_ROOM     — room id (default altar-fire)
 *   LAR_CATALOG  — existing catalog automerge URL to join (optional)
 */

import { WebSocketServer } from "ws";
import { resolve }         from "path";
import { openNodeLarPeer } from "./open-node-lar-peer.js";
import { LarDiskProjector } from "./disk-projector.js";
import { LARES_MEMES_ROOT } from "./node-host.js";
import { ReactionEngine }   from "@lararium/core";

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
// Boot
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { port, storageDir, roomId, catalogUrl } = parseArgs();

  const wss = new WebSocketServer({ port });
  console.log(`[lararium] WS server listening on :${port}`);

  const { peer, tw5 } = await openNodeLarPeer({
    hostId:     "lararium-node",
    roomId,
    storageDir,
    wss,
    catalogUrl,
    onPhase: (phase) => console.log(`[lararium] phase → ${phase}`),
  });

  // Reaction bus — maintains ReactionGraph from CRDT changes.
  const engine = new ReactionEngine();
  engine.boot(tw5);
  peer.addProjection(engine);

  // Disk projector — write meme files on any lar: change.
  // renderFn: use tw5 to render the carrier. Swap for renderCarrier() when server-api is wired.
  const projector = new LarDiskProjector(
    LARES_MEMES_ROOT,
    async (parentUri) => tw5.getTiddlerText(parentUri) ?? null,
  );
  projector.start(peer.store);

  console.log(`[lararium] live — room: ${roomId} | storage: ${storageDir}`);

  // Graceful shutdown.
  const shutdown = () => {
    console.log("[lararium] shutting down");
    wss.close();
    process.exit(0);
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[lararium] fatal:", err);
  process.exit(1);
});
