/**
 * resting-repo — a storage-backed Repo a vector can put to REST before its directory leaves.
 *
 * A Repo's `shutdown()` flushes what it holds, then asks its storage adapter to close. The stock
 * `NodeFSStorageAdapter` answers no `close`, so a Repo over it keeps writing whatever reaches it afterwards: a
 * debounced save, a change a vector still makes. A vector that removes or reads the store's directory right then
 * meets a writer it started itself: a recursive removal that finds a fresh file, a save that lands in a directory
 * already gone (an unhandled rejection that reddens whichever vector runs next), a listing that counts one file
 * more. No pause of any length closes that. The crash-atomic adapter's own `close()` does: it returns once every
 * write the adapter issued has landed, and from then on the adapter lands no byte.
 *
 * `restingRepo` builds the Repo over that adapter, the one the product's own holders use, and hands it back with
 * `rest()`: shut the Repo down, then close its adapter by name (so a shutdown that faults still leaves it closed).
 * `restEvery()` rests each Repo this module built that still stands, so a suite's `afterEach` awaits it once, then
 * removes the directory.
 *
 * A vector that wants the store held the way a direct CLI act holds it uses `direct-store.ts` instead: that
 * path claims the store's name as well.
 */
import { Repo, type RepoConfig, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { SealedDocumentStore, bindSecretHomeRest, vesselHeldHomes } from "@lararium/mesh";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";

/** A Repo over a store on disk, with the one act that lets its directory leave. */
export type RestingRepo = Repo & {
  /** Shut the Repo down, then close its storage adapter. Resolves once no write of this Repo can land. Runs once. */
  rest(): Promise<void>;
  /** The adapter this Repo writes through; `lateWrites` counts what arrived after `rest()` and landed nothing. */
  readonly restingStorage: DurableNodeFSStorageAdapter;
};

const standing = new Set<RestingRepo>();

/** Open a Repo over `storageDir`. `config` carries everything a Repo takes except its storage. */
export function restingRepo(storageDir: string, config: Omit<RepoConfig, "storage"> = {}, opts: { readonly heldHomes?: boolean } = {}): RestingRepo {
  const storage = new DurableNodeFSStorageAdapter(storageDir);
  // `heldHomes`: the Repo holds the vessel's held homes the way a standing vessel does (the secret home and the control
  // document map sealed under the vessel's key, opened through its custody on demand), so a fence read reaches them.
  const held = opts.heldHomes ? vesselHeldHomes() : null;
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const sealed = held ? new SealedDocumentStore({ inner: storage, bagOf: (id) => held.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, refuseClearOverSealed: true }) : null;
  const repo = new Repo({ ...config, storage: (sealed ?? storage) as StorageAdapterInterface }) as RestingRepo;
  if (held && sealed) {
    bindSecretHomeRest(repo, held.rest((id) => sealed.holdsSealed(id), undefined, async () => {
      try { await (await import("../src/secret-home-store.js")).openVesselSecretHome(repo); return true; } catch { return false; }
    }));
  }
  let resting: Promise<void> | null = null;
  Object.defineProperty(repo, "restingStorage", { value: storage });
  Object.defineProperty(repo, "rest", {
    value: (): Promise<void> => {
      resting ??= (async () => {
        // The adapter closes whatever the shutdown answered: a Repo whose shutdown faulted still holds armed saves.
        // The Repo stays on the standing list until it rests, so a `restEvery` that runs meanwhile waits for it.
        try { await repo.shutdown(); }
        finally {
          try { await storage.close(); }
          finally { standing.delete(repo); }
        }
      })();
      return resting;
    },
  });
  standing.add(repo);
  return repo;
}

/** Rest every Repo `restingRepo` built that still stands. A suite's teardown awaits this, then removes its directories. */
export async function restEvery(): Promise<void> {
  const faults: unknown[] = [];
  for (const repo of [...standing].reverse()) await repo.rest().catch((err: unknown) => { faults.push(err); });
  if (faults.length > 0) throw faults[0];
}
