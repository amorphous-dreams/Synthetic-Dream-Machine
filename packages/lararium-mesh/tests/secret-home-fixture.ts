/**
 * secret-home-fixture — a secret home for a ceremony suite whose Repo holds NO storage at all.
 *
 * A Repo built with no storage adapter rests no byte anywhere, so its secret home can rest nothing clear: the fixture's
 * rest answers sealed on that ground alone, and refuses a Repo that holds a storage adapter (a suite whose Repo rests
 * bytes stands its home through the real rest: `bindSecretHomeRest`, `enrollSecretHome`). The ceremony's own contract
 * reads unchanged: a handle apart from the daemon document, and a rest that answers before every secret write.
 */
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { SECRET_HOME_ID } from "../src/lar-uris.js";

export function memorySecretHome(repo: Repo): { secretHandle: DocHandle<LarDoc>; secretRest: { assertSealed(): Promise<boolean> } } {
  const storage = (repo as unknown as { storageSubsystem?: unknown }).storageSubsystem;
  if (storage !== undefined) throw new Error("memorySecretHome: this Repo rests bytes; stand its secret home through its real rest");
  const secretHandle = repo.create<LarDoc>(emptyLarDoc());
  return { secretHandle, secretRest: { assertSealed: async () => true } };
}

/** A founded place with its storage-less Repo's secret home beside it, as a ceremony suite hands both to a face. */
export function withMemorySecretHome<P extends object>(place: P, repo: Repo): P & { secretHandle: DocHandle<LarDoc>; secretUrl: string } {
  const { secretHandle } = memorySecretHome(repo);
  return { ...place, secretHandle, secretUrl: secretHandle.url };
}

/** The sealed-rest answer of a storage-less Repo's secret home: it rests nothing, so nothing rests clear. */
export const MEMORY_SEALED = { assertSealed: async (): Promise<boolean> => true } as const;

/** A storage-less Repo's secret home as a Keyhive event store reads it: the store and its sealed-rest answer. */
export function memorySecretStore(handle: DocHandle<unknown>): { secretStore: AutomergeDocStore; secretRest: typeof MEMORY_SEALED } {
  return { secretStore: new AutomergeDocStore(handle as DocHandle<LarDoc>, SECRET_HOME_ID), secretRest: MEMORY_SEALED };
}
