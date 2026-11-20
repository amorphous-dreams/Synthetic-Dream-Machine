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
 * WHAT EACH READING LETS THE PROOF DO. `plane`: the plane's records join the carried acts. `carried`: ONLY a read that
 * succeeded and found nothing at rest (`nothing-rests`) lets the carried acts answer alone, as for a fleet-joined face's admit
 * bundle before its plane syncs. `refuse`: every other reading refuses the proof outright, so the carried acts never stand in
 * for a plane whose history this read did not see whole: a plane known to rest that did not read whole (a gap or corruption,
 * a chunk unread or empty, past the caps, a url that names no document), where restoring the missing part could expose a
 * signed fork that makes the same proof refuse; a store that did not answer in time or refused (a flaky or disrupted store,
 * no byte changed, would otherwise turn a plane that refuses into a carried-only proof); a face shut at the read; and a lock,
 * or a lock and re-open, while the read waited, whether it found a plane or an empty rest (the carried founding would otherwise prove pins the full log
 * refuses). THE LIVENESS COST: a slow or refusing store, or a face shut at the moment, refuses the sibling until the next ask
 * (the next light, the next custody open, the next boot), and that ask reads the plane afresh under the opening it finds.
 */
export const SIBLING_PLANE_USE: Readonly<Record<SiblingPlaneReading, "plane" | "carried" | "refuse">> = {
  "read": "plane",
  "nothing-rests": "carried",
  "face-shut": "refuse", "lock-mid-read": "refuse", "bound-spent": "refuse", "refused": "refuse",
  "torn": "refuse", "chunk-unread": "refuse", "chunk-empty": "refuse", "over-cap": "refuse", "url-malformed": "refuse",
};

/**
 * A LIT SIBLING PROVES FROM ITS OWN REST: the composition mounts the worn face's plane alone, so a sibling's founding act
 * rests unread on disk. The plane reads from this vessel's own store (`readRestingDoc`: the adapter's bytes into a scratch
 * document, never a Repo handle and never a peer), so a plane whose log fails its proof never reaches the live Repo.
 *
 * Custody decides at both ends, by OPENING: the face must stand open before the read (a shut face reads no plane and its store
 * goes unasked), the read keys its one outstanding adapter call to that opening (`scope`), and the same opening must still
 * stand before either proof path runs and again when ANY proof is accepted, carried-only included. `prove` runs synchronously on
 * the records and this checks `stillOpen` in the same turn, so nothing read under an opening that closed (a lock, or a lock and
 * re-open), a decoded plane or an empty rest, ever proves; the answer reads null, fail closed.
 *
 * `carried` names the documents that carry admit acts beside the plane (the vessel's secret home: a joined face's admit
 * bundle rests there until its plane syncs). They answer alone only where the read succeeded and found nothing at rest; every
 * other reading refuses (`SIBLING_PLANE_USE`); each record still proves only through the same anchor, KEL chain and signed-log
 * fold. `plane` names what became of the plane, so a caller tells each case apart.
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
    reading = "doc" in read ? "read" : read.absent;
    if ("doc" in read) plane = read.doc;
    // THE OPENING BEFORE EITHER PATH: a lock, or a lock and re-open, while the read waited voids whatever it found, a decoded
    // plane and an empty rest alike; neither the plane nor the carried acts prove under an opening that closed.
    if (!input.face.stillOpen()) { plane = undefined; reading = "lock-mid-read"; }
  }
  // Every reading but a plane read whole, or a read that found nothing at rest, refuses before the proof runs.
  if (SIBLING_PLANE_USE[reading] === "refuse") return { proved: null, plane: reading };
  const records = [plane, ...(input.carried ?? [])].flatMap((doc) => personaActRecordsOfGroup(doc, input.group));
  const proved = input.prove(records);
  // ACCEPTANCE: ANY proof, carried-only included, stands only while the opening it was read under still stands.
  if (proved !== null && !input.face.stillOpen()) return { proved: null, plane: "lock-mid-read" };
  return { proved, plane: reading };
}
