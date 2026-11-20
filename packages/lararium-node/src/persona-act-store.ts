/** Carry persona acts in LarDocs; proof decides which records count. */
import type { DocHandle, Repo, AutomergeUrl, StorageAdapterInterface } from "@automerge/automerge-repo";
import { heldDocOf, readRestingDoc, personaActRecordsOfGroup, writePersonaAct, type LarDoc, type SignedAct } from "@lararium/mesh";

export function appendPersonaActs(handle: DocHandle<LarDoc>, acts: readonly SignedAct[]): void {
  handle.change((draft) => { for (const act of acts) writePersonaAct(draft, act); });
}

export async function readFacePersonaRecords(repo: Repo, input: {
  readonly personaUrl: string;
  readonly group: string;
  readonly extraDocs?: readonly (LarDoc | null | undefined)[];
  /** A boot reads the plane only if this replica already holds it; a founder's door waits for its own doc. */
  readonly heldOnly?: boolean;
}): Promise<unknown[]> {
  const plane = input.heldOnly ? heldDocOf(repo, input.personaUrl) : (await repo.find<LarDoc>(input.personaUrl as AutomergeUrl)).doc();
  return [plane, ...(input.extraDocs ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
}

/**
 * A LIT SIBLING'S RECORDS, read from this vessel's own store alone (`readRestingDoc`): the composition mounts the worn face's
 * plane alone, so a sibling's founding act rests unread on disk. The plane reads from the storage adapter's bytes into a
 * scratch document, never a Repo handle and never a peer, so a plane whose log fails its proof never reaches the live Repo;
 * `faceOpen` decides at read time (a face that stands shut reads no plane), and the bound holds at acceptance.
 *
 * `carried` names the documents that carry admit acts beside the plane (the vessel's secret home: a joined face's admit
 * bundle rests there until its plane syncs). They answer whether or not the plane rests, as they did for every sibling
 * before this read: each record still proves only through the same anchor, KEL chain and signed-log fold.
 */
export async function readSiblingPersonaRecords(input: {
  readonly storage: Pick<StorageAdapterInterface, "loadRange">;
  readonly personaUrl: string;
  readonly group: string;
  readonly faceOpen: () => Promise<boolean>;
  readonly carried?: readonly (LarDoc | null | undefined)[];
  readonly boundMs?: number;
}): Promise<unknown[]> {
  const plane = (await input.faceOpen()) ? await readRestingDoc(input.storage, input.personaUrl, input.boundMs) : undefined;
  return [plane, ...(input.carried ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
}
