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
 * The face's custody standing, read twice around a sibling's plane read: `open` asks before the read (and captures what it
 * opened), and `stillOpen` answers synchronously whether that same opening still stands. A lock that lands while the read
 * runs, or before its proof is accepted, turns `stillOpen` false.
 */
export interface SiblingFaceGate {
  open(): Promise<boolean>;
  stillOpen(): boolean;
}

/**
 * A LIT SIBLING PROVES FROM ITS OWN REST: the composition mounts the worn face's plane alone, so a sibling's founding act
 * rests unread on disk. The plane reads from this vessel's own store (`readRestingDoc`: the adapter's bytes into a scratch
 * document, never a Repo handle and never a peer), so a plane whose log fails its proof never reaches the live Repo.
 *
 * Custody decides at both ends: the face must stand open before the read (a shut face reads no plane and its store goes
 * unasked), and the same opening must still stand when the proof is accepted. `prove` runs synchronously on the records and
 * this checks `stillOpen` in the same turn, with nothing awaited between, so a plane read under an opening that a lock
 * closed before acceptance never proves (the answer reads null, fail closed).
 *
 * `carried` names the documents that carry admit acts beside the plane (the vessel's secret home: a joined face's admit
 * bundle rests there until its plane syncs). They answer whether or not the plane rests, as they did for every sibling
 * before this read: each record still proves only through the same anchor, KEL chain and signed-log fold.
 */
export async function proveSiblingFromRest<T>(input: {
  readonly storage: Pick<StorageAdapterInterface, "loadRange">;
  readonly personaUrl: string;
  readonly group: string;
  readonly face: SiblingFaceGate;
  readonly carried?: readonly (LarDoc | null | undefined)[];
  readonly boundMs?: number;
  readonly prove: (records: unknown[]) => T | null;
}): Promise<T | null> {
  const opened = await input.face.open();
  const plane = opened ? await readRestingDoc(input.storage, input.personaUrl, input.boundMs) : undefined;
  const planeRead = plane !== undefined;
  // A lock that landed while the read ran drops the plane: only the carried acts may answer.
  const usable = planeRead && input.face.stillOpen() ? plane : undefined;
  const records = [usable, ...(input.carried ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
  const proved = input.prove(records);
  // ACCEPTANCE: a proof that leaned on the plane stands only while the opening it was read under still stands.
  if (proved !== null && usable !== undefined && !input.face.stillOpen()) return null;
  return proved;
}
