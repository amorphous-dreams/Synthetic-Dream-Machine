/**
 * gate-ambient — the confirm gate's reach over this document's own platform
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-confirm-gate).
 *
 * THE CENSUS reads here, in the ceremony document: every database this origin names, opened as it stands (no version, so
 * nothing upgrades), and the row names of each one that holds a keystore. A bare floor therefore needs no worker at all.
 *
 * THE PROOF runs in a worker of the ceremony's own (`workers/custody-proof.worker.ts`), spawned for one question and ended
 * with its answer: the slot trees' decoding and the KDF live in `@lararium/browser`, and this document's graph stays its own
 * directory (the worker's URL crosses, never its modules). The proof needs no vessel worker, no session, no broker and no
 * secure context, so the gate stands while the vessel rests locked, half-founded or down. A proof that cannot stand refuses
 * `gate-verifier-absent` and passes nothing: the gate never falls back to typed words where custody reads.
 */
import proofWorkerUrl from "../workers/custody-proof.worker.ts?worker&url";
import type { ProofAnswer, ProofAsk } from "../ceremony-protocol.js";
import { custodyRowsOf, GATE_KEYSTORE, GateRefused, type GateEnv } from "./critical-gate.js";

/** One store's keystore row names, or null where the database holds no keystore. The open mints and upgrades nothing. */
function keystoreRows(name: string): Promise<readonly string[] | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    let minted = false;
    request.onupgradeneeded = () => { minted = true; request.transaction?.abort(); };
    request.onerror = (e) => { if (minted) { e.preventDefault(); resolve(null); } else reject(request.error ?? new Error(`the database "${name}" did not open`)); };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GATE_KEYSTORE)) { db.close(); resolve(null); return; }
      const keys = db.transaction(GATE_KEYSTORE, "readonly").objectStore(GATE_KEYSTORE).getAllKeys();
      keys.onsuccess = () => { db.close(); resolve(keys.result.map(String)); };
      keys.onerror = () => { db.close(); reject(keys.error); };
    };
  });
}

/** Ask the proof one question in a worker of its own, ended with its answer. */
function askProof(spawn: () => Worker, ask: ProofAsk, transfer: Transferable[] = []): Promise<ProofAnswer> {
  return new Promise<ProofAnswer>((resolve, reject) => {
    let worker: Worker;
    try { worker = spawn(); } catch { reject(new GateRefused("gate-verifier-absent", "this browser stood no worker to prove a passphrase against its custody; nothing burned")); return; }
    worker.onmessage = (e: MessageEvent) => { worker.terminate(); resolve(e.data as ProofAnswer); };
    worker.onerror = (e) => { e.preventDefault(); worker.terminate(); reject(new GateRefused("gate-verifier-absent", "the worker that proves a passphrase against this browser's custody did not stand; nothing burned")); };
    worker.postMessage(ask, transfer);
  }).then((answer) => {
    if (answer.t === "proof:failed") throw new GateRefused("gate-proof-failed", `the proof read this browser's custody and stopped (${answer.why}); nothing burned`);
    return answer;
  });
}

/** The census alone, over this document's own IndexedDB: each store that holds a keystore, its custody rows counted. */
export async function ambientCustodyCensus(names?: readonly string[]): Promise<readonly { readonly store: string; readonly trees: number; readonly sealed: number }[]> {
  if (!names && typeof indexedDB.databases !== "function") throw new GateRefused("gate-census-absent", "this engine names no list of this site's databases, so the gate cannot read what custody stands here; clear this site's data in the browser's own settings");
  const stores = names ?? (await indexedDB.databases()).map((db) => db.name).filter((name): name is string => typeof name === "string");
  const out: { store: string; trees: number; sealed: number }[] = [];
  for (const store of [...stores].sort()) { const rows = await keystoreRows(store); if (rows) out.push({ store, ...custodyRowsOf(rows) }); }
  return out;
}

/** The proof worker as this document spawns it. */
export const spawnProofWorker = (): Worker => new Worker(new URL(proofWorkerUrl, import.meta.url), { type: "module", name: "lares-custody-proof" });

/** The gate's reach over this document's platform. `names` scopes the census to named databases (a witness's own). */
export function ambientGateEnv(spawn: () => Worker = spawnProofWorker, names?: readonly string[]): GateEnv {
  return {
    census: () => ambientCustodyCensus(names),
    readable: async (stores) => { const answer = await askProof(spawn, { t: "proof:read", stores }); return answer.t === "proof:readable" ? answer.readable : 0; },
    prove: async (stores, bytes) => {
      const answer = await askProof(spawn, { t: "proof:prove", stores, bytes }, [bytes]);
      if (answer.t !== "proof:proved") throw new GateRefused("gate-proof-failed", "the proof answered no reading; nothing burned");
      return answer.reading;
    },
  };
}
