/**
 * sovereign-island-model — Node.js host shore for the sovereign island kernel.
 *
 * The lifecycle itself lives in @lararium/tw5 `runSovereignKernel` — ONE flow
 * both vessels compose. This file supplies only the node platform pieces:
 *   - transport : worker_threads parentPort (.postMessage / .on("message"))
 *   - storage   : DurableNodeFSStorageAdapter (crash-atomic; driven by manifest IslandStorageConfig)
 *                 or in-memory when no storage config is present
 *   - ready     : omitted — the node worker has no WASM-load handshake
 *
 * Divergence is COMPOSITION (which pieces the shore resolves), not an OO
 * platform interface. See feedback_isomorphism_by_composition.
 *
 * ## VM Pool alignment
 *
 *   Node vessel: Daemon island (sovereign island) + Pinned (PrimaryWiki in-process)
 *                + N hot islands (session wikis, LRU-evicted to cold).
 *   Every hot island runs via runSovereignWorker(behavior).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/sovereign-island-model
 */

import { parentPort } from "worker_threads";
import { join } from "node:path";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { DurableNodeFSStorageAdapter } from "./durable-storage-adapter.js";
import {
  runSovereignKernel,
  type IslandHostShore,
} from "@lararium/tw5";
import {
  makeCidResolver, ISLAND_PROTOCOL_VERSION,
  type StorageAdapterInterface,
  type IslandMsg_Manifest,
  type IslandStorageConfig,
  type IslandToVesselMsg,
  type IslandMsg_CasWant,
  type IslandMsg_CasBlock,
  type CasTransitTransport,
} from "@lararium/mesh";
import type { IslandBehavior } from "@lararium/tw5";
import { casDirFromIslandStorageDir, readCasBlobFromFs } from "./node-cas.js";

/** A worker's ask waits this long for the vessel's door before it reads as a miss (PENDING, never a fault). */
const CAS_WANT_TIMEOUT_MS = 20_000;

/**
 * THE FETCH DOOR, worker side — a `CasTransitTransport` over the parent port. The worker holds no socket; the
 * vessel does. `discover` names the one holder it can reach (the vessel); `fetchBlock` posts `cas:want` and
 * awaits `cas:block` on the same requestId. No answer inside the window → null (a miss stays a miss).
 */
function portTransit(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }): CasTransitTransport {
  const pending = new Map<string, (bytes: Uint8Array | null) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CasBlock> | null;
    if (!m || m.type !== "cas:block" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m.bytes instanceof Uint8Array ? m.bytes : null);
  });
  let seq = 0;
  return {
    async discover() { return ["vessel"]; },
    fetchBlock(cid) {
      return new Promise<Uint8Array | null>((resolve) => {
        const requestId = `cas-${process.pid}-${++seq}`;
        const timer = setTimeout(() => { pending.delete(requestId); resolve(null); }, CAS_WANT_TIMEOUT_MS);
        timer.unref?.();
        pending.set(requestId, (bytes) => { clearTimeout(timer); resolve(bytes); });
        const ask: IslandMsg_CasWant = { schema_version: ISLAND_PROTOCOL_VERSION, type: "cas:want", requestId, cid };
        port.postMessage(ask);
      });
    },
  };
}

function _buildStorage(cfg: IslandStorageConfig | undefined): StorageAdapterInterface | undefined {
  if (!cfg || cfg.type === "memory") return undefined;
  if (cfg.type === "nodefs") return new DurableNodeFSStorageAdapter(cfg.dir);
  return undefined;
}

// ── runSovereignWorker — node host shore over the shared kernel ──────────────

export function runSovereignWorker(
  behaviorOrFactory: IslandBehavior | ((manifest: IslandMsg_Manifest) => IslandBehavior),
): void {
  if (!parentPort) {
    throw new Error("[sovereign-island] parentPort is null — must run as a Worker thread.");
  }
  const port = parentPort;

  // The fs CAS dir — captured from the manifest storage dir when the kernel builds the repo
  // (host.storage runs before resolveByCid). Engine + plugin bytes ride this local CID plane,
  // pulled by content-address off the sync port — the nodefs face of the worker CAS. A
  // memory-storage island carries no CAS dir; resolveByCid yields null and the kernel faults
  // (the CID plane is required).
  let casDir: string | null = null;

  // The CORPUS CAS dir — where the operator gesture stages oversized carrier bodies (whole
  // books) that ride LOAD/INGEST verbs BY REFERENCE, never inline. Read from the inherited
  // env (LAR_CAS, else <LAR_ROOT>/cas) so the fs-less worker resolves the SAME dir the CLI
  // stager wrote — process-shared filesystem, no IPC. The `wake` gesture exports LAR_CAS =
  // larCasDir() when it spawns the daemon, so this stays deterministic across the two processes.
  // Distinct from the runtime `casDir` (engine/plugin bytes under <storage>/cas, wiped on reset):
  // the corpus CAS is repo-relative and persistent.
  const corpusCasDir: string | null =
    process.env["LAR_CAS"] ?? (process.env["LAR_ROOT"] ? join(process.env["LAR_ROOT"], "cas") : null);

  const host: IslandHostShore = {
    post:    (msg: IslandToVesselMsg) => port.postMessage(msg),
    listen:  (onMessage) => port.on("message", onMessage),
    storage: (msg) => {
      if (msg.storage?.type === "nodefs") casDir = casDirFromIslandStorageDir(msg.storage.dir);
      return _buildStorage(msg.storage);
    },
    // Resolve by content-address — THE FETCH DOOR (basket-one #/the-fetch-door), composed here as
    // `makeCidResolver(localRead, portTransit, cacheWriteThrough)` (@lararium/mesh):
    //   · localRead — the runtime CID plane first (engine/plugin bytes), then the corpus CAS (staged
    //     carrier bodies); the caller re-verifies cid==hash(bytes), so a two-dir lookup never widens trust;
    //   · portTransit — a local miss asks the VESSEL over the parent port (the worker holds no socket; the
    //     vessel's door reaches Socket B and its fleet holders); the transit leg re-verifies the bytes
    //     against the cid's own class before they return — a body that fails verify never returns;
    //   · cacheWriteThrough — the verified body lands in the local `cid/` so the next read stays local.
    // Absent a door (the vessel answers every ask with a miss) the leg degenerates to exactly the local
    // read: a miss is a miss, PENDING stays PENDING, never an unverified body, never a fault.
    resolveByCid: makeCidResolver(
      (cid) => {
        const runtime = casDir ? readCasBlobFromFs(cid, casDir) : null;
        if (runtime) return runtime;
        return corpusCasDir ? readCasBlobFromFs(cid, corpusCasDir) : null;
      },
      portTransit(port),
      (cid, bytes) => {
        const dir = casDir ?? corpusCasDir;
        if (!dir) return;
        try {
          mkdirSync(dir, { recursive: true });
          const path = join(dir, cid);
          if (!existsSync(path)) writeFileSync(path, bytes);
        } catch { /* a failed write-through costs the next read a re-fetch, never the bytes */ }
      },
    ),
  };

  runSovereignKernel(host, behaviorOrFactory);
}
