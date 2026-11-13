/**
 * reset-core — the reset ceremony's own parts (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-reset).
 *
 * A browser vessel MUST always return to its anon floor (dreamnet-rhizome#/the-ground), and the device's holder owns that
 * return: no ward and no passphrase stands before it, and it runs while the vessel stands locked, half-founded or not at all.
 * So the reset asks nothing of the vessel worker. The ceremony document takes one typed confirmation and burns the place
 * itself, from its own clean heap: every IndexedDB database this origin names, the origin-private file system, the caches, the
 * storage keys the vessel owns (`lares:`), and the service worker's registration.
 *
 * THE TABS LET GO FIRST. A database a tab still holds open cannot delete, so the ceremony says `reset:stand-down` on the
 * origin's reset channel and each tab stands its vessel worker down (`reset-tab.ts`). A tab that does not let go blocks the
 * delete, and the ceremony names the store it waits on; the delete lands when that tab closes. No clock gives up for it.
 *
 * This module imports the protocol's types alone, so the ceremony document's graph stays its own directory.
 */
import type { ResetSignal } from "../ceremony-protocol.js";

/** The words a person types to confirm. Public: they prove a deliberate hand, never a secret. */
export const RESET_PHRASE = "reset this browser";

/** The prefix of every storage key the vessel's page writes; the reset removes these and leaves any other key as it stands. */
export const OWNED_STORAGE_PREFIX = "lares:";

/** A refusal by name. */
export class ResetRefused extends Error {
  override readonly name = "ResetRefused";
  constructor(readonly refusal: string, reason: string) { super(`${refusal}: ${reason}`); }
}

/**
 * The first refusal the reset ceremony stands under, or null. It needs its clean document alone: a top-level window and its
 * policy in force. It needs no secure context and no broker, since no secret and no port crosses.
 */
export function resetRefusal(env: { readonly framed: boolean; readonly evalRuns: boolean }): string | null {
  if (env.framed) return "ceremony-framed";
  if (env.evalRuns) return "ceremony-csp-absent";
  return null;
}

/** Whether what a person typed confirms the reset: the phrase itself, whatever its case or outer spacing. */
export function typedConfirms(typed: string): boolean {
  return typed.trim().replace(/\s+/g, " ").toLowerCase() === RESET_PHRASE;
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
  readonly workers: { getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]> } | null;
  /** Say one signal on the origin's reset channel. */
  readonly signal: (msg: ResetSignal) => void;
  /** Tell the person where the burn stands. */
  readonly say: (words: string) => void;
}

/** What the burn removed, counted and named. */
export interface ResetReport { readonly databases: readonly string[]; readonly files: number; readonly caches: number; readonly storageKeys: number; readonly workers: number }

/** Remove every key under the vessel's prefix from one storage; answers how many left. */
export function clearOwnedKeys(storage: Pick<Storage, "length" | "key" | "removeItem">): number {
  const owned: string[] = [];
  for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key !== null && key.startsWith(OWNED_STORAGE_PREFIX)) owned.push(key); }
  for (const key of owned) storage.removeItem(key);
  return owned.length;
}

/**
 * BURN THE PLACE. The census reads first, so an engine that names no database list refuses `reset-census-absent` before any
 * tab stands down or any byte burns. Then every tab stands down, each database deletes (a held one names itself and waits),
 * the file system, the caches, the owned storage keys and the service worker follow, and `reset:burned` tells every tab to boot
 * afresh. A step that fails rejects with its own words; what burned before it stays burned, and a second run goes on.
 */
export async function burnPlace(env: ResetEnv, askId: string): Promise<ResetReport> {
  if (!env.databases) throw new ResetRefused("reset-census-absent", "this engine names no list of this site's databases, so the ceremony cannot tell what the vessel holds here; clear this site's data in the browser's own settings");
  const databases = [...await env.databases()].sort();
  env.signal({ t: "reset:stand-down", askId });
  env.say("Every tab of this site stands its vessel down.");
  for (const name of databases) {
    await env.deleteDatabase(name, () => env.say(`The reset waits: another tab or window of this site still holds "${name}" open. Close it and the reset lands.`));
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
  for (const storage of env.storages) storageKeys += clearOwnedKeys(storage);
  let workers = 0;
  if (env.workers) for (const registration of await env.workers.getRegistrations()) { if (await registration.unregister()) workers++; }
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
    storages,
    workers: "serviceWorker" in navigator ? navigator.serviceWorker : null,
    signal, say,
  };
}
