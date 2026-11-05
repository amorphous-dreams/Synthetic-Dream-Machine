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

import { parentPort, workerData } from "worker_threads";
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
  type IslandMsg_ReceiptRequest,
  type IslandMsg_ReceiptIssued,
  type CustodyWriteCarrier,
  type IslandMsg_CustodyWrite,
  type IslandMsg_CustodyWritten,
  type IslandMsg_SessionSign,
  type IslandMsg_SessionSigned,
  type CasTransitTransport,
  verifyCidBytes,
} from "@lararium/mesh";
import type { IslandBehavior } from "@lararium/tw5";
import type { IslandSessionProof, SessionReading } from "@lararium/keyhive";
import type { Signature } from "@lararium/mesh/face-proof-subjects";
import { casDirFromIslandStorageDir, readCasBlobFromFs, type IslandCasData } from "./node-cas.js";

/** A worker's ask waits this long for the vessel's cas capability before it reads as a miss (PENDING, never a fault). */
const CAS_WANT_TIMEOUT_MS = 20_000;

/**
 * THE CAS CAPABILITY, worker side — a `CasTransitTransport` over the parent port. The worker holds no socket; the
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

/** A worker's receipt ask waits this long on the vessel before it reads as unissued; the mint then records no pointer. */
const VESSEL_ASK_PATIENCE_MS = 60_000;

/** THE DYAD CAPABILITY, worker side. The vessel's live board answers each fleet/device pair; silence reads aside. */
export function vesselDyadAsker(
  port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void },
  patienceMs: number = VESSEL_ASK_PATIENCE_MS,
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
 * THE SESSION SIGN DOOR, worker side (`island-session-proof.ts`). The island names the invocation a session placed; the
 * vessel answers from that session: its certificate, its proof subject and the vessel's own verified chain, and each
 * signature on ask, signed on the main thread behind the owner's table. No answer inside this side's patience reads
 * as a refusal by name, never as a signer: the island holds no key to fall back on.
 */
export function vesselSessionDoor(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }, patienceMs: number = VESSEL_ASK_PATIENCE_MS): IslandSessionProof {
  const pending = new Map<string, (answer: IslandMsg_SessionSigned | null) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_SessionSigned> | null;
    if (!m || m.type !== "session:signed" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m as IslandMsg_SessionSigned);
  });
  let seq = 0;
  const askVessel = (op: "read" | "sign" | "own", ask: { requestId: string; verb: string }, payload?: Uint8Array): Promise<IslandMsg_SessionSigned | null> => new Promise((resolve) => {
    const requestId = `session-sign-${process.pid}-${++seq}`;
    const timer = setTimeout(() => { pending.delete(requestId); resolve(null); }, patienceMs);
    timer.unref?.();
    pending.set(requestId, (answer) => { clearTimeout(timer); resolve(answer); });
    const msg: IslandMsg_SessionSign = { type: "session:sign", requestId, op, ask: ask.requestId, verb: ask.verb, ...(payload ? { payload } : {}) };
    try { port.postMessage(msg); } catch { pending.delete(requestId); clearTimeout(timer); resolve(null); }
  });
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : []);
  return {
    async own() {
      const read = await askVessel("own", { requestId: "", verb: "" });
      if (read === null || !("own" in read)) return { refusal: read !== null && "refusal" in read ? read.refusal : "chain-absent" };
      return { chain: read.chain, foldRead: read.foldRead === true, counted: strings(read.counted), unanswered: strings(read.unanswered) };
    },
    async signer(ask): Promise<SessionReading> {
      if (ask === null) return { refusal: "signer-unavailable" };
      const read = await askVessel("read", ask);
      if (read === null) return { refusal: "signer-unavailable" };
      if ("refusal" in read) return { refusal: read.refusal };
      if (!("certificate" in read)) return { refusal: "signer-unavailable" };
      const certificate = read.certificate as never;
      return {
        subject: read.subject, chain: read.chain, foldRead: read.foldRead === true,
        counted: Array.isArray(read.counted) ? read.counted.filter((c): c is string => typeof c === "string") : [],
        unanswered: Array.isArray(read.unanswered) ? read.unanswered.filter((c): c is string => typeof c === "string") : [],
        signer: {
          certificate,
          async sign(purpose, payload) {
            if (purpose !== "act") return { refusal: "signer-refused" };
            const signed = await askVessel("sign", ask, payload);
            if (signed === null) return { refusal: "signer-refused" };
            if ("signature" in signed) return { signature: signed.signature as Signature };
            return { refusal: "refusal" in signed ? signed.refusal : "signer-refused" };
          },
        },
      };
    },
  };
}

/**
 * THE RECEIPT CAPABILITY, worker side. A worker's Repo keeps no store for a document it mints beside its own bag; the
 * vessel's Repo saves it. `receiptFromVessel` posts `receipt:request` and resolves on `receipt:issued` with `issued: true`;
 * an unissued answer, or none inside this side's own patience, rejects, so the caller records no pointer.
 */
export function vesselReceiptAsker(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }, patienceMs: number = VESSEL_ASK_PATIENCE_MS, gateClear?: Promise<void>): (documentIds: readonly string[], gateForCall?: Promise<void>, heads?: Record<string, string[]>) => Promise<void> {
  const pending = new Map<string, (answer: IslandMsg_ReceiptIssued | null) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_ReceiptIssued> | null;
    if (!m || m.type !== "receipt:issued" || typeof m.requestId !== "string") return;
    const settle = pending.get(m.requestId);
    if (!settle) return;
    pending.delete(m.requestId);
    settle(m as IslandMsg_ReceiptIssued);
  });
  let seq = 0;
  const ask = (documentIds: readonly string[], heads?: Record<string, string[]>) => {
    let cancel = () => {};
    const promise = new Promise<void>((resolve, reject) => {
      const requestId = `receipt-${process.pid}-${++seq}`;
      const timer = setTimeout(() => { pending.delete(requestId); settleWith(null); }, patienceMs);
      timer.unref?.();
      const settleWith = (answer: IslandMsg_ReceiptIssued | null): void => {
        clearTimeout(timer);
        const proof = answer?.proof?.documentIds;
        if (answer?.issued === true && Array.isArray(proof) && proof.length === documentIds.length
          && documentIds.every((id, index) => proof[index] === id)) resolve();
        else reject(new Error(`the vessel's store did not acknowledge ${documentIds.join(", ")} at rest (${answer ? answer.why ?? "missing storage proof" : "no answer"})`));
      };
      pending.set(requestId, settleWith);
      cancel = () => { pending.delete(requestId); clearTimeout(timer); };
      const message: IslandMsg_ReceiptRequest = { type: "receipt:request", requestId, documentIds: [...documentIds], ...(heads ? { heads } : {}) };
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
 * THE CUSTODY WRITE CAPABILITY, worker side. Workers hold bytes to seal but never the vessel key; the vessel seals the
 * named carrier and answers on the same request id. A refusal or silence rejects without exposing the bytes.
 */
export function vesselCustodyWriter(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): void }, patienceMs: number = VESSEL_ASK_PATIENCE_MS): (carrier: CustodyWriteCarrier, bytes: Uint8Array) => Promise<void> {
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

  // The CAS dirs the VESSEL handed this island at construction (`workerData`, `IslandCasData`): the vessel's one runtime
  // `cid/` dir and the CORPUS CAS dir where the operator gesture stages oversized carrier bodies (whole books) that ride
  // LOAD/INGEST verbs BY REFERENCE, never inline. The island reads no env: a dir the vessel did not hand reads absent.
  // The runtime `casDir` (engine/plugin bytes) falls back to the sibling of its storage dir where the vessel handed none.
  const handed = (workerData ?? {}) as Partial<IslandCasData>;
  const corpusCasDir: string | null = handed.corpusCasDir ?? null;
  if (handed.cidDir) casDir = handed.cidDir;

  const host: IslandHostShore = {
    post:    (msg: IslandToVesselMsg) => port.postMessage(msg),
    listen:  (onMessage) => port.on("message", onMessage),
    storage: (msg) => {
      if (msg.storage?.type === "nodefs" && !handed.cidDir) casDir = casDirFromIslandStorageDir(msg.storage.dir);
      return _buildStorage(msg.storage);
    },
    // Resolve by content-address — the vessel's cas capability (basket-one #/the-fetch-door), composed here as
    // `makeCidResolver(localRead, portTransit, cacheWriteThrough)` (@lararium/mesh):
    //   · localRead — the runtime CID plane first (engine/plugin bytes), then the corpus CAS (staged
    //     carrier bodies); the caller re-verifies cid==hash(bytes), so a two-dir lookup never widens trust;
    //   · portTransit — a local miss asks the VESSEL over the parent port (the worker holds no socket; the
    //     vessel's cas capability reaches Socket B and its fleet holders); the transit leg re-verifies the bytes
    //     against the cid's own class before they return — a body that fails verify never returns;
    //   · cacheWriteThrough — the verified body lands in the local `cid/` so the next read stays local.
    // Absent a cas capability (the vessel answers every ask with a miss) the leg degenerates to exactly the local
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

  runSovereignKernel(host, behaviorOrFactory, { caps: { receipt: true } });
}
