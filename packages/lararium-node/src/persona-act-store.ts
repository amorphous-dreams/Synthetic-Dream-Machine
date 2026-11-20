/** Carry persona acts in LarDocs; proof decides which records count. */
import type { DocHandle, Repo, AutomergeUrl, StorageAdapterInterface } from "@automerge/automerge-repo";
import { heldDocOf, readRestingDoc, personaActRecordsOfGroup, writePersonaAct, type LarDoc, type RestingAbsence, type SignedAct } from "@lararium/mesh";

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
 * The face's custody opening, read twice around a sibling's plane read: `open` asks before the read and answers the opening it
 * found (a token naming that one opening, or null while the face stands shut); `stillOpen` answers synchronously whether that
 * SAME opening still stands. A lock that lands while the read runs, or before its proof is accepted, turns it false, and so
 * does a lock and re-open of the same face: the re-open is a new opening.
 *
 * THE RESIDUAL WINDOW, NAMED: under a pūlama, a lock there reaches this vessel as the pūlama's next standing, which it sends the
 * moment the face shuts (`onClosed`); until that message lands the vessel holds the opening it read under, so a read that finishes
 * within the message's own latency is accepted. Two processes over a socket share no instant, so no check here closes it. It
 * proves nothing a read finished just before the lock would not: the lock moves no byte of the plane; the relation and every
 * plane url take their first pin only, before the face's first admission, and no later act re-pins them (`projectPersonaLog`,
 * act `plane`); this proof names no device, so admissions, edges and their revocations never enter it. A later fork or plane
 * rewrite refuses the whole log (`fork`, `plane`), and a read that landed before it arrived proves the same pins it proved
 * before: sync staleness, independent of any lock, which the next proof reads; the anchor's frontier keeps every read at or
 * above the head this vessel accepted (`frontier-falls`).
 */
export interface SiblingFaceGate {
  open(): Promise<string | null>;
  stillOpen(): boolean;
}

/** What became of the sibling's plane: read, the face shut at the read, a lock mid-read, or the resting read's own absence. */
export type SiblingPlaneReading = "read" | "face-shut" | "lock-mid-read" | RestingAbsence;

/**
 * A LIT SIBLING PROVES FROM ITS OWN REST: the composition mounts the worn face's plane alone, so a sibling's founding act
 * rests unread on disk. The plane reads from this vessel's own store (`readRestingDoc`: the adapter's bytes into a scratch
 * document, never a Repo handle and never a peer), so a plane whose log fails its proof never reaches the live Repo.
 *
 * Custody decides at both ends, by OPENING: the face must stand open before the read (a shut face reads no plane and its store
 * goes unasked), the read keys its one outstanding adapter call to that opening (`scope`), and the same opening must still
 * stand when the proof is accepted. `prove` runs synchronously on the records and this checks `stillOpen` in the same turn, so
 * a plane read under an opening that closed (a lock, or a lock and re-open) never proves; the answer reads null, fail closed.
 *
 * `carried` names the documents that carry admit acts beside the plane (the vessel's secret home: a joined face's admit
 * bundle rests there until its plane syncs). They answer whether or not the plane rests, as they did for every sibling
 * before this read: each record still proves only through the same anchor, KEL chain and signed-log fold. `plane` names
 * what became of the plane, so a caller tells an `over-cap` plane from one that rests nowhere.
 */
export async function proveSiblingFromRest<T>(input: {
  readonly storage: Pick<StorageAdapterInterface, "loadRange">;
  readonly personaUrl: string;
  readonly group: string;
  readonly face: SiblingFaceGate;
  readonly carried?: readonly (LarDoc | null | undefined)[];
  readonly boundMs?: number;
  readonly prove: (records: unknown[]) => T | null;
}): Promise<{ readonly proved: T | null; readonly plane: SiblingPlaneReading }> {
  const opening = await input.face.open();
  let plane: LarDoc | undefined;
  let reading: SiblingPlaneReading = "face-shut";
  if (opening !== null) {
    const read = await readRestingDoc(input.storage, input.personaUrl, { ...(input.boundMs !== undefined ? { boundMs: input.boundMs } : {}), scope: opening });
    if ("doc" in read) {
      // A lock that landed while the read ran drops the plane: only the carried acts may answer.
      if (input.face.stillOpen()) { plane = read.doc; reading = "read"; } else reading = "lock-mid-read";
    } else reading = read.absent;
  }
  const records = [plane, ...(input.carried ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
  const proved = input.prove(records);
  // ACCEPTANCE: a proof that leaned on the plane stands only while the opening it was read under still stands.
  if (proved !== null && plane !== undefined && !input.face.stillOpen()) return { proved: null, plane: "lock-mid-read" };
  return { proved, plane: reading };
}
