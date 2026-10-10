/**
 * direct-store — run a store command the way a CLI runs it with no vessel standing: hold the store for the act
 * (`ownedStore`) and hand the command that holder's Repo.
 *
 * `direct(runX)(opts)` reads as the command itself, so a suite calls a door exactly as the direct path does. The
 * store is `opts.storageDir` when the suite names one, else this root's own (`larDataDir()`).
 */
import type { Repo } from "@automerge/automerge-repo";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir } from "../src/vessel-paths.js";

export function direct<O extends { readonly repo: Repo }, R, X extends unknown[]>(
  run: (opts: O, ...rest: X) => Promise<R>,
): (opts: Omit<O, "repo"> & { readonly storageDir?: string }, ...rest: X) => Promise<R> {
  return (opts, ...rest) =>
    ownedStore(opts.storageDir ?? larDataDir(), (repo) => run({ ...opts, repo } as unknown as O, ...rest));
}
