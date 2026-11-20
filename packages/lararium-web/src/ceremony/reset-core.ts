/**
 * reset-core — the reset ceremony's own parts (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-reset).
 *
 * A browser vessel MUST always return to its anon floor (dreamnet-rhizome#/the-ground), and the device's holder owns that
 * return. The reset burns a whole place, so it stands in the class of CRITICAL PROCEDURES and passes the confirm gate
 * (`critical-gate.ts`; the operator's note, 2026-11-13): where this browser holds custody the gate asks a passphrase that
 * opens it, and at a bare floor the typed phrase confirms. The burn runs only on the pass that gate mints (`gate-unpassed`
 * otherwise). No ward stands before it, and it runs while the vessel stands locked, half-founded or not at all: the reset
 * asks nothing of the vessel worker, and the gate proves a passphrase against custody at rest. The ceremony document burns
 * the place itself, from its own clean heap: every IndexedDB database this origin names, the origin-private file system, the
 * caches, the storage keys the vessel owns (`lares:`), and the service worker's registration. A holder who lost every
 * passphrase keeps the platform's own clearing of this site's data, which no house door gates.
 *
 * IT BURNS ONLY FOR AN ASK A PAGE OF THIS ORIGIN RAISED (the ask record, below): the ceremony's own navigation names an id,
 * and an id no page recorded refuses `reset-unasked` at the ceremony's stand and again at the burn.
 *
 * THE TABS LET GO FIRST. A database a tab still holds open cannot delete, so the ceremony says `reset:stand-down` on the
 * origin's reset channel and each tab stands its vessel worker down (`reset-tab.ts`). A tab that does not let go blocks the
 * delete, and the ceremony names the store it waits on; the delete lands when that tab closes. No clock gives up for it.
 *
 * This module imports the protocol's types alone, so the ceremony document's graph stays its own directory.
 */
import type { ResetSignal } from "../ceremony-protocol.js";
import { spendGatePass, type CriticalProcedure, type GatePass } from "./critical-gate.js";

/** The words a person types to confirm at a bare floor. Public: they prove a deliberate hand, never a secret. */
export const RESET_PHRASE = "reset this browser";

/** The reset as the confirm gate names it (`critical-gate.ts`): the procedure its burn spends a pass under. */
export const RESET_PROCEDURE: CriticalProcedure = { name: "vessel reset", phrase: RESET_PHRASE };

/** The prefix of every storage key the vessel's page writes; the reset removes these and leaves any other key as it stands. */
export const OWNED_STORAGE_PREFIX = "lares:";

/**
 * THE ASK RECORD. A page that paints a reset ask records its id in the origin's own storage, one key per ask under the
 * vessel's prefix (`lares:reset-ask:<id>`), and the ceremony burns only for an id that record names: a navigation to
 * `ceremony.html#reset=<id>` from anywhere else names an id nobody raised, and refuses `reset-unasked`. The record leaves when
 * the person declines, and when the page withdraws the ask ("not now"); the burn turns it from `raised` to `burned`, its
 * receipt. Either way a settled id stands no ceremony again. localStorage carries it because the ceremony's window opens with
 * no opener and shares no sessionStorage.
 *
 * THE BURNED RECEIPT lets a tab that hears the ceremony late still honour it. The channel and the storage carry no order
 * between them, so a tab can read the record after the burn settled it; the receipt names that id as confirmed and burned,
 * and a tab honours that id's `reset:stand-down` and `reset:burned` on it (`reset-tab.ts`). It carries no secret and stands no
 * ceremony (`resetAskStands` reads `raised` alone), and it rides the vessel's prefix, so the next reset's burn clears it.
 *
 * WHAT THIS DEFENDS: a bare inbound link, and an id no standing ask answers to. WHAT IT CANNOT: script already running in a page of
 * this origin writes the same storage a page writes, and deletes a database as the burn does. The confirm gate asks the
 * device's holder; it stands against a hand at the device and a mistaken press, never against that script.
 */
export const RESET_ASK_KEY = "lares:reset-ask";
export const resetAskKey = (askId: string): string => `${RESET_ASK_KEY}:${askId}`;
export type AskRecord = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const RAISED = "raised";
const BURNED = "burned";

/** The origin's own record, or null where the browser withholds its storage. */
export function originAskRecord(): AskRecord | null { try { return localStorage; } catch { return null; } }

/** Record one raised ask. Answers whether the record now names it: a storage that withholds itself records nothing. */
export function recordResetAsk(record: AskRecord | null, askId: string): boolean {
  if (!record) return false;
  try { record.setItem(resetAskKey(askId), RAISED); return record.getItem(resetAskKey(askId)) === RAISED; } catch { return false; }
}

const recordReads = (record: Pick<Storage, "getItem"> | null, askId: string): string | null => {
  if (!record) return null;
  try { return record.getItem(resetAskKey(askId)); } catch { return null; }
};

/** Whether the record names this ask as raised and still standing. */
export function resetAskStands(record: Pick<Storage, "getItem"> | null, askId: string): boolean { return recordReads(record, askId) === RAISED; }

/** Whether the record holds this ask's burned receipt: the holder confirmed it and the place burned. It stands no ceremony. */
export function resetAskBurned(record: Pick<Storage, "getItem"> | null, askId: string): boolean { return recordReads(record, askId) === BURNED; }

/** Settle one ask as burned: one write turns its record into the receipt. A storage that refuses the write forgets the ask. */
function settleBurnedAsk(record: AskRecord | null, askId: string): void {
  try { record?.setItem(resetAskKey(askId), BURNED); } catch { forgetResetAsk(record, askId); }
}

/** Forget one ask: it burned, the person declined it, or the page withdrew it. */
export function forgetResetAsk(record: AskRecord | null, askId: string): void {
  try { record?.removeItem(resetAskKey(askId)); } catch { /* a withheld storage holds no record to forget */ }
}

/** A refusal by name. */
export class ResetRefused extends Error {
  override readonly name = "ResetRefused";
  constructor(readonly refusal: string, reason: string) { super(`${refusal}: ${reason}`); }
}

/**
 * The first refusal the reset ceremony stands under, or null. It needs its clean document (a top-level window, its policy in
 * force) and an ask the origin's record names (`asked`). It needs no secure context and no broker, since no secret and no
 * port crosses, and nothing of the vessel worker: the record rests in storage a page wrote.
 */
export function resetRefusal(env: { readonly framed: boolean; readonly opened: boolean; readonly evalRuns: boolean; readonly asked: boolean }): string | null {
  if (env.framed) return "ceremony-framed";
  // The gate's field may take a passphrase: a window some script opened and still holds refuses, as every ceremony does.
  if (env.opened) return "ceremony-has-opener";
  if (env.evalRuns) return "ceremony-csp-absent";
  if (!env.asked) return "reset-unasked";
  return null;
}

/** What the burn reaches, each as the platform hands it; null names a surface this engine lacks. */
export interface ResetEnv {
  /** The name of every database this origin holds. Null where the engine names none (no `indexedDB.databases`). */
  readonly databases: (() => Promise<readonly string[]>) | null;
  /** Delete one database; `blocked` fires while another context still holds it open, and the promise settles when it lands. */
  readonly deleteDatabase: (name: string, blocked: () => void) => Promise<void>;
  /** The origin-private file system's root: its entry names, and a recursive removal. */
  readonly opfs: (() => Promise<{ entries(): Promise<readonly string[]>; remove(name: string): Promise<void> }>) | null;
  readonly caches: { keys(): Promise<readonly string[]>; delete(name: string): Promise<boolean> } | null;
  /** The storages this document reaches (the origin's localStorage; this window's own sessionStorage). */
  readonly storages: readonly Pick<Storage, "length" | "key" | "removeItem">[];
  /** The origin's ask record: the burn runs only for an id it names. Null where the browser withholds it, which reads unasked. */
  readonly record: AskRecord | null;
  readonly workers: { getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]> } | null;
  /** Say one signal on the origin's reset channel. */
  readonly signal: (msg: ResetSignal) => void;
  /** Tell the person where the burn stands. */
  readonly say: (words: string) => void;
  /** Name the database the burn waits on while another context holds it open, and null once it lands. */
  readonly waits?: (database: string | null) => void;
}

/** What the burn removed, counted and named. */
export interface ResetReport { readonly databases: readonly string[]; readonly files: number; readonly caches: number; readonly storageKeys: number; readonly workers: number }

/** Remove every key under the vessel's prefix from one storage, but for `keep` where one is named; answers how many left. */
export function clearOwnedKeys(storage: Pick<Storage, "length" | "key" | "removeItem">, keep?: string): number {
  const owned: string[] = [];
  for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key !== null && key !== keep && key.startsWith(OWNED_STORAGE_PREFIX)) owned.push(key); }
  for (const key of owned) storage.removeItem(key);
  return owned.length;
}

/**
 * BURN THE PLACE, on a pass the confirm gate minted for the reset and for nothing else: no pass, another procedure's or a
 * spent one refuses `gate-unpassed` first. Then the ask: an id the origin's record does not name refuses `reset-unasked`
 * before anything reads or moves. The census reads next, so an engine that names no database list refuses `reset-census-absent` before any
 * tab stands down or any byte burns. Then every tab stands down, each database deletes (a held one names itself and waits,
 * `waits`), the file system, the caches, the owned storage keys and the service worker follow, the ask's own record turns to
 * its burned receipt last, and `reset:burned` tells every tab to boot afresh. A step that fails rejects with its own words; what burned before it stays
 * burned, the ask still stands recorded, and a second run passes the gate again and goes on.
 */
export async function burnPlace(env: ResetEnv, askId: string, pass: GatePass): Promise<ResetReport> {
  spendGatePass(pass, RESET_PROCEDURE);
  if (!resetAskStands(env.record, askId)) throw new ResetRefused("reset-unasked", "no page of this site raised this reset ask, or the ask no longer stands; raise it from the vessel's own page (its reset button, or lares(\"vessel\", \"reset\"))");
  if (!env.databases) throw new ResetRefused("reset-census-absent", "this engine names no list of this site's databases, so the ceremony cannot tell what the vessel holds here; clear this site's data in the browser's own settings");
  const databases = [...await env.databases()].sort();
  env.signal({ t: "reset:stand-down", askId });
  env.say("Every tab of this site stands its vessel down.");
  for (const name of databases) {
    let held = false;
    await env.deleteDatabase(name, () => {
      held = true;
      env.waits?.(name);
      env.say(`The reset waits: another tab or window of this site still holds "${name}" open. Close it and the reset lands.`);
    });
    if (held) env.waits?.(null);
    env.say(`Burned "${name}".`);
  }
  let files = 0;
  if (env.opfs) {
    const root = await env.opfs();
    for (const name of await root.entries()) { await root.remove(name); files++; }
  }
  let cachesGone = 0;
  if (env.caches) for (const name of await env.caches.keys()) { if (await env.caches.delete(name)) cachesGone++; }
  let storageKeys = 0;
  for (const storage of env.storages) storageKeys += clearOwnedKeys(storage, resetAskKey(askId));
  let workers = 0;
  if (env.workers) for (const registration of await env.workers.getRegistrations()) { if (await registration.unregister()) workers++; }
  settleBurnedAsk(env.record, askId);
  env.signal({ t: "reset:burned", askId });
  return { databases, files, caches: cachesGone, storageKeys, workers };
}

/** The burn's reach over this document's own platform. */
export function ambientResetEnv(signal: (msg: ResetSignal) => void, say: (words: string) => void): ResetEnv {
  const storages: Storage[] = [];
  for (const read of [() => localStorage, () => sessionStorage]) { try { storages.push(read()); } catch { /* a storage this document may not read holds nothing it wrote */ } }
  const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
  return {
    databases: typeof indexedDB.databases === "function"
      ? async () => (await indexedDB.databases()).map((db) => db.name).filter((name): name is string => typeof name === "string")
      : null,
    deleteDatabase: (name, blocked) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onblocked = () => blocked();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`the database "${name}" did not delete`));
    }),
    opfs: storage && typeof storage.getDirectory === "function"
      ? async () => {
        const root = await storage.getDirectory() as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> };
        return {
          entries: async () => { const names: string[] = []; for await (const name of root.keys()) names.push(name); return names; },
          remove: (name) => root.removeEntry(name, { recursive: true }),
        };
      }
      : null,
    caches: typeof caches === "undefined" ? null : caches,
    storages, record: originAskRecord(),
    workers: "serviceWorker" in navigator ? navigator.serviceWorker : null,
    signal, say,
  };
}
