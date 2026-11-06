/**
 * browser-ward — THE PAGE'S DOOR TO ONE WARD ACT (seat-harness#/the-ward): the face root signs in a per-act worker, fresh from the
 * route a person typed for this act, and the page's own unlock never takes part.
 *
 * The door reads the face's ward tree and its warded root row as raw bytes (it opens nothing; `browser-ward-tree.ts`), spawns one
 * worker, hands the request over a MessagePort, reads one answer and terminates the worker. The answer holds the root's public key
 * and one signature. `readBrowserCustody(...).unlocked` reads the same before, during and after: the act never touches the page's
 * held key, and the keystore's tree key opens no part of the root.
 *
 * A face's WARD KEY (the co-sign signer; logical name `ward-sign/<group>`, which every custody door refuses by name) rests under a
 * ward of its own (`ward/sign/<group>/…`, `ward-core`), which no slot of the keystore's tree wraps: it mints inside one worker act
 * (`browserWardKeyMint`: the ward binds over the route typed for it, the seed seals under it, the pop signs, and the page lands
 * bytes it cannot open) and signs inside one (`browserWardKeySign`). Its public half reads off plain bytes (`browserWardKeyOf`).
 *
 * Residual, named: the page passes the typed route over the port (a page script reads what the page's dialog collects).
 */
import { browserKeystoreCustodyIo, BrowserWardRefused } from "./browser-custody.js";
import { chargeWardAttempt, landBrowserWardRows, readBrowserWardKey, readBrowserWardRows } from "./browser-ward-tree.js";
import {
  wardCredentialOf, wardSignRowsOf, type WardActAnswer, type WardActRequest, type WardKeyActRequest, type WardKeyMintAnswer, type WardKeyMintRequest, type WardRoute,
} from "./ward-core.js";
import { WardRefused } from "@lararium/mesh";

export { BrowserWardRefused } from "./browser-custody.js";
export { WARD_ATTEMPTS_PER_PAGE } from "./browser-ward-tree.js";

/** One worker for one act. The default spawns `ward.worker.ts`; a witness passes a spawn that runs the pure core in-process. */
export interface WardWorkerHandle { postMessage(msg: unknown, transfer: Transferable[]): void; terminate(): void }
export type WardWorkerSpawn = () => WardWorkerHandle;

const workerSpawn: WardWorkerSpawn = () => new Worker(new URL("./ward.worker.js", import.meta.url), { type: "module" });
/** THE SPAWN SEAT: only the test-only entry (`@lararium/browser/testing`) seats another; no door takes a caller's spawn. */
let seatedSpawn: WardWorkerSpawn | null = null;
/** Seat the spawn every ward act of this page runs (null takes the worker back). The test-only entry alone re-exports it. */
export function seatWardWorkerSpawnForTests(spawn: WardWorkerSpawn | null): void { seatedSpawn = spawn; }
const defaultSpawn: WardWorkerSpawn = () => (seatedSpawn ?? workerSpawn)();

/**
 * THE KIND OF ONE WARD ASK: `open` reads a ward that stands, `bind` binds a fresh ward over the route typed for it, and `retype`
 * asks that route once more, so a bind lands only over a route typed twice alike (a ward bound over a typo opens for nobody).
 */
export type WardAskKind = "open" | "bind" | "retype";
/** The page's dialog: the route the person types for one act, asked by its kind. */
export type WardRouteAsk<R> = (act: string, kind: WardAskKind) => Promise<R>;

/** The words a ward dialog shows for one ask: a bind names a bind, an open names an open. */
export function wardAskWords(act: string, kind: WardAskKind): string {
  if (kind === "bind") return `This act will bind a passphrase for this face's ward: ${act}. Type the passphrase every later act of this face asks for.`;
  if (kind === "retype") return `Type the same passphrase again, so the ward binds only over the one you meant: ${act}.`;
  return `Type this face's passphrase to open its ward for one act: ${act}. It opens for this act alone.`;
}

/**
 * The route one BIND rides: asked twice, `bind` then `retype`, and answered only where both match; a mismatch refuses
 * `ward-route-mismatch`, so nothing binds. A paper sheet the person holds reads no typo and asks once; a passkey refuses by name.
 */
export async function browserWardBindRoute<R>(ask: WardRouteAsk<R>, act: string): Promise<R> {
  const first = await ask(act, "bind");
  let credential: ReturnType<typeof wardCredentialOf>;
  try { credential = wardCredentialOf(first as WardRoute); } catch (e) { return refusedBy(e); }
  if (credential.kind !== "passphrase") return first;
  const again = await ask(act, "retype");
  let second: ReturnType<typeof wardCredentialOf>;
  try { second = wardCredentialOf(again as WardRoute); } catch (e) { return refusedBy(e); }
  if (second.kind !== "passphrase" || second.passphrase !== credential.passphrase) {
    throw new BrowserWardRefused("ward-route-mismatch", "the passphrase typed again differs from the first, so no ward binds");
  }
  return first;
}

const refusedBy = (e: unknown): never => {
  if (e instanceof WardRefused) throw new BrowserWardRefused(e.reading, e.message);
  throw e;
};

/** A face's ward key rows, a malformed face name refusing in this page's own class (`ward-key-unnamed`). */
const signRowsOf = (group: string): ReturnType<typeof wardSignRowsOf> => { try { return wardSignRowsOf(group); } catch (e) { return refusedBy(e); } };

/** Sign `bytes` as face `handleIndex`'s root in one ward act. A miss spends one of the page's attempts for this keystore. */
export async function browserWardSign(idbName: string, handleIndex: number, route: WardRoute, bytes: Uint8Array, spawn: WardWorkerSpawn = defaultSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  try { wardCredentialOf(route); } catch (e) { refusedBy(e); }
  const rows = await readBrowserWardRows(idbName, handleIndex).catch(refusedBy);
  return chargeWardAttempt(idbName, () => browserWardSignOnce({ ...rows, handleIndex, route, bytes }, spawn)).catch(refusedBy);
}

/** The PUBLIC half of face `group`'s ward key on this browser, off plain bytes beside its ward (no seed opens), or null where none stands. */
export async function browserWardKeyOf(idbName: string, group: string): Promise<string | null> {
  const bytes = await browserKeystoreCustodyIo(idbName).read(signRowsOf(group).key);
  if (bytes === null) return null;
  const key = new TextDecoder().decode(bytes);
  if (!/^[0-9a-f]{64}$/.test(key)) throw new BrowserWardRefused("ward-key-unreadable", "the face's ward key row reads malformed");
  return key;
}

/**
 * Sign `bytes` with face `group`'s ward key in one ward act, fresh from the route typed for it: the page hands the worker the ward's
 * tree and the sealed seed as raw bytes and reads back the key and one signature. A miss spends one of the page's attempts.
 */
export async function browserWardKeySign(idbName: string, group: string, route: WardRoute, bytes: Uint8Array, spawn: WardWorkerSpawn = defaultSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  try { wardCredentialOf(route); } catch (e) { refusedBy(e); }
  const rows = signRowsOf(group), io = browserKeystoreCustodyIo(idbName);
  const [tree, sealedSeed] = await Promise.all([io.read(rows.tree), io.read(rows.seed)]);
  if (tree === null || sealedSeed === null) throw new BrowserWardRefused("ward-absent", `face ${group} holds no ward key in this browser`);
  const request: WardKeyActRequest = { act: "ward-key-sign", group, tree, sealedSeed, route, bytes };
  return chargeWardAttempt(idbName, () => browserWardSignOnce(request, spawn)).catch(refusedBy);
}

/**
 * MINT face `group`'s ward key in one ward act and sign its pop for `deviceKey`: the worker binds a fresh ward over `route`, seals a
 * fresh seed under it and signs once; the page lands the tree, the seed and the public key in ONE transaction, only where none of the
 * three stands. Answers null where a ward key already stood (another tab minted first): the caller signs under that one instead.
 */
export async function browserWardKeyMint(idbName: string, group: string, deviceKey: string, route: WardRoute, spawn: WardWorkerSpawn = defaultSpawn): Promise<{ readonly key: string; readonly pop: string } | null> {
  try { wardCredentialOf(route); } catch (e) { refusedBy(e); }
  const rows = signRowsOf(group);
  const request: WardKeyMintRequest = { act: "ward-key-mint", group, deviceKey, route };
  const minted = await chargeWardAttempt(idbName, () => browserWardActOnce<WardKeyMintAnswer>(request, spawn)).catch(refusedBy);
  if ("refused" in minted) throw new BrowserWardRefused(minted.refused);
  const landed = await landBrowserWardRows(idbName, [[rows.tree, minted.tree], [rows.seed, minted.sealedSeed], [rows.key, new TextEncoder().encode(minted.key)]]);
  return landed ? { key: minted.key, pop: minted.signature } : null;
}

async function browserWardSignOnce(request: WardActRequest | WardKeyActRequest, spawn: WardWorkerSpawn): Promise<{ readonly key: string; readonly signature: string }> {
  const answer = await browserWardActOnce<WardActAnswer>(request, spawn);
  if ("refused" in answer) throw new BrowserWardRefused(answer.refused);
  return { key: answer.key, signature: answer.signature };
}

/** One worker, one request, one answer; the worker terminates either way. */
async function browserWardActOnce<A>(request: WardActRequest | WardKeyActRequest | WardKeyMintRequest, spawn: WardWorkerSpawn): Promise<A> {
  const worker = spawn();
  const channel = new MessageChannel();
  try {
    return await new Promise<A>((resolve) => {
      channel.port1.onmessage = (m: MessageEvent) => resolve(m.data as A);
      worker.postMessage(null, [channel.port2]);
      channel.port1.postMessage(request);
    });
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
