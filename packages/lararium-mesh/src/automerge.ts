/**
 * The Automerge names mesh lends its readers, behind their own subpath (`@lararium/mesh/automerge`), so a
 * reader that wants a Repo type or a doc load names this door rather than the whole barrel. The barrel
 * re-exports it unchanged.
 */
export {
  load as automergeLoad,
  save as automergeSave,
  init as automergeInit,
  change as automergeChange,
  getHeads,
} from "@automerge/automerge";
export type { Heads, Doc as AutomergeDoc } from "@automerge/automerge";
export type { Repo, DocHandle, AutomergeUrl, StorageAdapterInterface } from "@automerge/automerge-repo";
