/**
 * browser-ward — THE VESSEL'S DOOR TO ONE WARD ACT (seat-harness#/the-ward): the face root signs in a per-act worker, fresh from the
 * passphrase a person typed for this act, and the vessel's own unlock never takes part.
 *
 * The door reads the keystore's slot tree and the root's sealed row as raw bytes (it opens nothing), spawns one worker, hands the
 * request over a MessagePort, reads one answer and terminates the worker. The answer holds the root's public key and one signature.
 * `readBrowserCustody(...).unlocked` reads the same before, during and after: the act never touches the vessel's held key.
 *
 * The passphrase arrives from the unlock ceremony's clean document, down its own brokered port to the vessel worker, which
 * hands it to the act's worker; the surface page never holds it (browser-vessel-lift#/the-ceremony). The root rests under its
 * own face's tree (`face-sealed/<fcid>/persona-root`, browser-face-custody.ts), so the act opens that face's tree fresh and no
 * other face's. Residual, named: the face's own unlock reads the root by its own doors while the face stands unlocked, and a
 * passkey slot in the face's tree refuses every ward act `ward-passkey-refused` (the ward opens no tree a passkey widened)
 * until the root moves under a ward key of its own. The ward here binds the daemon realm's bound acts (a daemon or kahua
 * commit, a kāpae-lower), which sign through this door alone.
 */
import { faceWardRows } from "./browser-face-custody.js";
import type { WardActAnswer, WardActRequest } from "./ward-core.js";

/** One worker for one act. The default spawns `ward.worker.ts`; a witness passes a spawn that runs the pure core in-process. */
export interface WardWorkerHandle {
  postMessage(msg: unknown, transfer: Transferable[]): void;
  terminate(): void;
  /** A worker that fails to stand raises `error`: the act then refuses `ward-worker-failed` rather than wait on an answer that never comes. */
  addEventListener?(type: "error", listener: (e: Event) => void): void;
}
export type WardWorkerSpawn = () => WardWorkerHandle;

const defaultSpawn: WardWorkerSpawn = () => new Worker(new URL("./ward.worker.js", import.meta.url), { type: "module" });

/** Refused ward acts answer by name: no credential and no byte of the root rides the error. */
export class BrowserWardRefused extends Error {
  override readonly name = "BrowserWardRefused";
  constructor(readonly reading: string) { super(`${reading}: the face root opened to no ward act in this browser`); }
}

/** The ward acts a page may miss before it refuses every one until it reloads: the node holder's own bound, per keystore. */
export const WARD_ATTEMPTS_PER_PAGE = 3;
const spent = new Map<string, number>();

/** Sign `bytes` as `face`'s root (its PersonaGroup) in one ward act. A miss spends one of the page's attempts for this keystore. */
export async function browserWardSign(idbName: string, face: string, passphrase: string, bytes: Uint8Array, spawn: WardWorkerSpawn = defaultSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  if (typeof passphrase !== "string" || passphrase.length === 0) throw new BrowserWardRefused("ward-needs-fresh-unlock");
  if ((spent.get(idbName) ?? 0) >= WARD_ATTEMPTS_PER_PAGE) throw new BrowserWardRefused("ward-attempts-spent");
  // CHARGE FIRST: the attempt pays before the worker derives, so a throw keeps it; an act that signs earns it back.
  spent.set(idbName, (spent.get(idbName) ?? 0) + 1);
  const signed = await browserWardSignOnce(idbName, face, passphrase, bytes, spawn);
  spent.set(idbName, (spent.get(idbName) ?? 1) - 1);
  return signed;
}

async function browserWardSignOnce(idbName: string, face: string, passphrase: string, bytes: Uint8Array, spawn: WardWorkerSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  const rows = await faceWardRows(idbName, face).catch(() => null);
  if (rows === null) throw new BrowserWardRefused("ward-absent");
  const request: WardActRequest = { tree: rows.tree, sealedRoot: rows.sealedRoot, carrier: rows.carrier, passphrase, bytes };
  const worker = spawn();
  const channel = new MessageChannel();
  try {
    const answer = await new Promise<WardActAnswer>((resolve) => {
      worker.addEventListener?.("error", (e: Event) => {
        console.error("[ward] the ward act's worker failed to stand:", (e as ErrorEvent).message ?? "error");
        resolve({ refused: "ward-worker-failed" });
      });
      channel.port1.onmessage = (m: MessageEvent) => resolve(m.data as WardActAnswer);
      worker.postMessage(null, [channel.port2]);
      channel.port1.postMessage(request);
    });
    if ("refused" in answer) throw new BrowserWardRefused(answer.refused);
    return { key: answer.key, signature: answer.signature };
  } finally { channel.port1.close(); worker.terminate(); }
}

/** The face root as a signer for one ward act: each signature runs its own worker under the passphrase this act carries. */
export async function browserWardSigner(idbName: string, face: string, passphrase: string, spawn?: WardWorkerSpawn): Promise<{ readonly key: string; sign(bytes: Uint8Array): Promise<string> }> {
  // The key comes off one ward act over empty bytes; each later signature opens the ward again.
  const probe = await browserWardSign(idbName, face, passphrase, new Uint8Array(0), spawn);
  return { key: probe.key, sign: async (bytes) => (await browserWardSign(idbName, face, passphrase, bytes, spawn)).signature };
}
