/**
 * browser-ward — THE PAGE'S DOOR TO ONE WARD ACT (seat-harness#/the-ward): the face root signs in a per-act worker, fresh from the
 * passphrase a person typed for this act, and the page's own unlock never takes part.
 *
 * The door reads the keystore's slot tree and the root's sealed row as raw bytes (it opens nothing), spawns one worker, hands the
 * request over a MessagePort, reads one answer and terminates the worker. The answer holds the root's public key and one signature.
 * `readBrowserCustody(...).unlocked` reads the same before, during and after: the act never touches the page's held key.
 *
 * Residuals, named: the page passes the typed passphrase over the port (a page script reads what the page's dialog collects); and
 * the browser root still rests under the keystore's tree key, so a page that holds the keystore unlocked reads the root by the
 * vessel's own doors. The ward here binds the daemon realm's bound acts (a daemon or kahua commit, a kāpae-lower), which sign
 * through this door alone; moving the browser root under a ward key of its own stays owed.
 */
import { browserKeystoreCustodyIo, CUSTODY_TREE_ROW, sealedCarrierOf } from "./browser-custody.js";
import type { WardActAnswer, WardActRequest } from "./ward-core.js";

/** One worker for one act. The default spawns `ward.worker.ts`; a witness passes a spawn that runs the pure core in-process. */
export interface WardWorkerHandle { postMessage(msg: unknown, transfer: Transferable[]): void; terminate(): void }
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

/** Sign `bytes` as face `handleIndex`'s root in one ward act. A miss spends one of the page's attempts for this keystore. */
export async function browserWardSign(idbName: string, handleIndex: number, passphrase: string, bytes: Uint8Array, spawn: WardWorkerSpawn = defaultSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  if (typeof passphrase !== "string" || passphrase.length === 0) throw new BrowserWardRefused("ward-needs-fresh-unlock");
  if ((spent.get(idbName) ?? 0) >= WARD_ATTEMPTS_PER_PAGE) throw new BrowserWardRefused("ward-attempts-spent");
  // CHARGE FIRST: the attempt pays before the worker derives, so a throw keeps it; an act that signs earns it back.
  spent.set(idbName, (spent.get(idbName) ?? 0) + 1);
  const signed = await browserWardSignOnce(idbName, handleIndex, passphrase, bytes, spawn);
  spent.set(idbName, (spent.get(idbName) ?? 1) - 1);
  return signed;
}

async function browserWardSignOnce(idbName: string, handleIndex: number, passphrase: string, bytes: Uint8Array, spawn: WardWorkerSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  const io = browserKeystoreCustodyIo(idbName);
  const tree = await io.read(CUSTODY_TREE_ROW);
  const carrier = sealedCarrierOf(`persona-root-h${handleIndex}`);
  const sealedRoot = await io.read(carrier.path);
  if (tree === null || sealedRoot === null) throw new BrowserWardRefused("ward-absent");
  const request: WardActRequest = { tree, sealedRoot, carrier: carrier.name, passphrase, bytes };
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

/** The face root as a signer for one ward act: each signature runs its own worker under the passphrase this act carries. */
export async function browserWardSigner(idbName: string, handleIndex: number, passphrase: string, spawn?: WardWorkerSpawn): Promise<{ readonly key: string; sign(bytes: Uint8Array): Promise<string> }> {
  // The key comes off one ward act over empty bytes; each later signature opens the ward again.
  const probe = await browserWardSign(idbName, handleIndex, passphrase, new Uint8Array(0), spawn);
  return { key: probe.key, sign: async (bytes) => (await browserWardSign(idbName, handleIndex, passphrase, bytes, spawn)).signature };
}
