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
  makeCidResolver, type StorageAdapterInterface,
  type IslandMsg_Manifest,
  type IslandStorageConfig,
  type IslandToVesselMsg,
  type IslandMsg_CasWant,
  type IslandMsg_CasBlock,
  type IslandMsg_DyadAsk,
  type IslandMsg_DyadRead,
  type EdgeStanding,
  type IslandMsg_DocRest,
  type IslandMsg_DocRested,
  type CustodyWriteCarrier,
  type IslandMsg_CustodyWrite,
  type IslandMsg_CustodyWritten,
  type CasTransitTransport,
  verifyCidBytes,
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
export function portTransit(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }): CasTransitTransport {
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
      return new Promise<Uint8Array | null>((resolve, reject) => {
        const requestId = `cas-${process.pid}-${++seq}`;
        const timer = setTimeout(() => { pending.delete(requestId); resolve(null); }, CAS_WANT_TIMEOUT_MS);
        timer.unref?.();
        pending.set(requestId, (bytes) => {
          clearTimeout(timer);
          if (bytes && !verifyCidBytes(bytes, cid)) reject(new Error(`CID mismatch for ${cid}`));
          else resolve(bytes);
        });
        const ask: IslandMsg_CasWant = { type: "cas:want", requestId, cid };
        port.postMessage(ask);
      });
    },
  };
}

/** A worker's rest ask waits this long on the vessel before it reads as unrested; the mint then records no pointer. */
const DOC_REST_PATIENCE_MS = 60_000;

/** THE DYAD DOOR, worker side. The vessel's live board answers each fleet/device pair; silence reads aside. */
export function vesselDyadAsker(
  port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void },
  patienceMs: number = DOC_REST_PATIENCE_MS,
): (fleetRoot: string, deviceKey: string) => Promise<EdgeStanding> {
  const pending = new Map<string, (standing: EdgeStanding) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_DyadRead> | null;
    if (!m || m.type !== "dyad:read" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    const standing = m.standing;
    settle(standing === "clear" || standing === "aside" || standing === "owing" || standing === "returned" || standing === "unknown" ? standing : "aside");
  });
  let seq = 0;
  return (fleetRoot, deviceKey) => new Promise<EdgeStanding>((resolve) => {
    const requestId = `dyad-${process.pid}-${++seq}`;
    const timer = setTimeout(() => { pending.delete(requestId); resolve("aside"); }, patienceMs);
    timer.unref?.();
    pending.set(requestId, (standing) => { clearTimeout(timer); resolve(standing); });
    const ask: IslandMsg_DyadAsk = { type: "dyad:ask", requestId, fleetRoot, deviceKey };
    try { port.postMessage(ask); } catch { pending.delete(requestId); clearTimeout(timer); resolve("aside"); }
  });
}

/**
 * THE REST DOOR, worker side. A worker's Repo keeps no store for a document it mints beside its own bag; the
 * vessel's Repo saves it. `restOnVessel` posts `doc:rest` and resolves on `doc:rested` with `rested: true`; an
 * unrested answer, or none inside this side's own patience, rejects, so the caller records no pointer.
 */
export function vesselRestAsker(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }, patienceMs: number = DOC_REST_PATIENCE_MS, gateClear?: Promise<void>): (documentIds: readonly string[], gateForCall?: Promise<void>, heads?: Record<string, string[]>) => Promise<void> {
  const pending = new Map<string, (answer: IslandMsg_DocRested | null) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_DocRested> | null;
    if (!m || m.type !== "doc:rested" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m as IslandMsg_DocRested);
  });
  let seq = 0;
  const ask = (documentIds: readonly string[], heads?: Record<string, string[]>) => {
    let cancel = () => {};
    const promise = new Promise<void>((resolve, reject) => {
      const requestId = `rest-${process.pid}-${++seq}`;
      const timer = setTimeout(() => { pending.delete(requestId); settleWith(null); }, patienceMs);
      timer.unref?.();
      const settleWith = (answer: IslandMsg_DocRested | null): void => {
        clearTimeout(timer);
        const proof = answer?.proof?.documentIds;
        if (answer?.rested === true && Array.isArray(proof) && proof.length === documentIds.length
          && documentIds.every((id, index) => proof[index] === id)) resolve();
        else reject(new Error(`the vessel's store did not acknowledge ${documentIds.join(", ")} at rest (${answer ? answer.why ?? "missing storage proof" : "no answer"})`));
      };
      pending.set(requestId, settleWith);
      cancel = () => { pending.delete(requestId); clearTimeout(timer); };
      const message: IslandMsg_DocRest = { type: "doc:rest", requestId, documentIds: [...documentIds], ...(heads ? { heads } : {}) };
      port.postMessage(message);
    });
    return { promise, cancel };
  };
  return async (documentIds, gateForCall, heads) => {
    const gate = gateForCall ?? gateClear;
    if (!gate) { await ask(documentIds, heads).promise; return; }
    // A reply heard during proof remains provisional, including an early refusal.
    const provisional = ask(documentIds, heads);
    void provisional.promise.catch(() => undefined);
    try { await gate; } finally { provisional.cancel(); }
    await ask(documentIds, heads).promise;
  };
}

/**
 * THE CUSTODY WRITE DOOR, worker side. Workers hold bytes to seal but never the vessel key; the vessel seals the
 * named carrier and answers on the same request id. A refusal or silence rejects without exposing the bytes.
 */
export function vesselCustodyWriter(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }, patienceMs: number = DOC_REST_PATIENCE_MS): (carrier: CustodyWriteCarrier, bytes: Uint8Array) => Promise<void> {
  const pending = new Map<string, (answer: IslandMsg_CustodyWritten | null) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CustodyWritten> | null;
    if (!m || m.type !== "custody:written" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m as IslandMsg_CustodyWritten);
  });
  let seq = 0;
  return (carrier, bytes) => new Promise<void>((resolve, reject) => {
    const requestId = `custody-${process.pid}-${++seq}`;
    const timer = setTimeout(() => { pending.delete(requestId); settleWith(null); }, patienceMs);
    timer.unref?.();
    const settleWith = (answer: IslandMsg_CustodyWritten | null): void => {
      clearTimeout(timer);
      if (answer?.written === true) resolve();
      else reject(new Error(`the vessel did not seal the ${carrier} carrier (${answer ? answer.why ?? "unwritten" : "no answer"})`));
    };
    pending.set(requestId, settleWith);
    const ask: IslandMsg_CustodyWrite = { type: "custody:write", requestId, carrier, bytes };
    port.postMessage(ask);
  });
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
  // Distinct from the runtime `casDir` (engine/plugin bytes under <storage>/cas, held by the runtime store):
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
