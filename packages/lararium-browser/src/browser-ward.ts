/**
 * browser-ward — THE PAGE'S DOOR TO ONE WARD ACT (seat-harness#/the-ward): the face root signs in a per-act worker, fresh from the
 * route a person typed for this act, and the page's own unlock never takes part.
 *
 * The door reads the face's ward tree and its warded root row as raw bytes (it opens nothing; `browser-ward-tree.ts`), spawns one
 * worker, hands the request over a MessagePort, reads one answer and terminates the worker. The answer holds the root's public key
 * and one signature. `readBrowserCustody(...).unlocked` reads the same before, during and after: the act never touches the page's
 * held key, and the keystore's tree key opens no part of the root.
 *
 * Residual, named: the page passes the typed passphrase over the port (a page script reads what the page's dialog collects).
 */
import { BrowserWardRefused } from "./browser-custody.js";
import { chargeWardAttempt, readBrowserWardKey, readBrowserWardRows } from "./browser-ward-tree.js";
import { wardCredentialOf, type WardActAnswer, type WardActRequest, type WardRoute } from "./ward-core.js";
import { WardRefused } from "@lararium/mesh";

export { BrowserWardRefused } from "./browser-custody.js";
export { WARD_ATTEMPTS_PER_PAGE } from "./browser-ward-tree.js";

/** One worker for one act. The default spawns `ward.worker.ts`; a witness passes a spawn that runs the pure core in-process. */
export interface WardWorkerHandle { postMessage(msg: unknown, transfer: Transferable[]): void; terminate(): void }
export type WardWorkerSpawn = () => WardWorkerHandle;

const defaultSpawn: WardWorkerSpawn = () => new Worker(new URL("./ward.worker.js", import.meta.url), { type: "module" });

const refusedBy = (e: unknown): never => {
  if (e instanceof WardRefused) throw new BrowserWardRefused(e.reading, e.message);
  throw e;
};

/** Sign `bytes` as face `handleIndex`'s root in one ward act. A miss spends one of the page's attempts for this keystore. */
export async function browserWardSign(idbName: string, handleIndex: number, route: WardRoute, bytes: Uint8Array, spawn: WardWorkerSpawn = defaultSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  try { wardCredentialOf(route); } catch (e) { refusedBy(e); }
  const rows = await readBrowserWardRows(idbName, handleIndex).catch(refusedBy);
  return chargeWardAttempt(idbName, () => browserWardSignOnce({ ...rows, handleIndex, route, bytes }, spawn)).catch(refusedBy);
}

async function browserWardSignOnce(request: WardActRequest, spawn: WardWorkerSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  const worker = spawn();
  const channel = new MessageChannel();
  try {
    const answer = await new Promise<WardActAnswer>((resolve) => {
      channel.port1.onmessage = (m: MessageEvent) => resolve(m.data as WardActAnswer);
      worker.postMessage(null, [channel.port2]);
      channel.port1.postMessage(request);
    });
    if ("refused" in answer) throw new BrowserWardRefused(answer.refused);
    return { key: answer.key, signature: answer.signature };
  } finally { channel.port1.close(); worker.terminate(); }
}

/**
 * The face root as a signer for ONE ward act: its key reads off the public key beside the ward (no seed, and no unlock of the
 * page's custody), and its one signature runs one worker
 * under the route this act carries. A second signature refuses `ward-needs-fresh-unlock`: the next act asks its own route.
 */
export async function browserWardSigner(idbName: string, handleIndex: number, route: WardRoute, spawn?: WardWorkerSpawn): Promise<{ readonly key: string; sign(bytes: Uint8Array): Promise<string> }> {
  try { wardCredentialOf(route); } catch (e) { refusedBy(e); }
  const line = { verifyingKey: await readBrowserWardKey(idbName, handleIndex).catch(refusedBy) };
  let held: WardRoute | null = route;
  return {
    key: line.verifyingKey,
    async sign(bytes) {
      const once = held;
      held = null;
      if (once === null) throw new BrowserWardRefused("ward-needs-fresh-unlock", "this act's route signed once; the next act asks its own");
      const signed = await browserWardSign(idbName, handleIndex, once, bytes, spawn);
      if (signed.key !== line.verifyingKey) throw new BrowserWardRefused("ward-root-unopenable", "the warded root names another key than the roster");
      return signed.signature;
    },
  };
}
