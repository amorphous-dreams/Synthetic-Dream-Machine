/**
 * chore-face — NO SILENT STEWARD (keeper-and-hands#/the-direction). The daemon island mounts one face, the daemon mount, so
 * every chore it runs (a meme write, a projection, a promote, a sweep, a reconcile, a kahua stage: anything it writes or signs)
 * spends the mount's authority, whichever lent face asked. This process carries the mount alone, so each chore door builds a
 * `ChoreAsk` and reads `actingFaceOf` (`@lararium/mesh/chore-ask`) with the mount as the one face carried: asked under the
 * mount the chore runs and its answer carries the `ChoreReceiptMark` naming that face (`chore`); asked under another lent face
 * it refuses `chore-face-not-mounted`, naming both, and never runs as the mount. A face island per lent face rides the road
 * as `C13` in the ONE FACE band (rank 34).
 *
 * THE GATE DENIES BY DEFAULT. Every verb reads as a chore except the ones `CHORE_FREE_VERBS` names with their reasons: the
 * reads, which keep their path, and the rows of the place, which act as the place and never as a face. A new verb stands a
 * chore until it joins the list with its reason. The face rows ride `session:act` as the session's own face, outside this gate.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/place-and-face-islands
 */
import { actingFaceOf, choreReceiptMark, type ChoreAsk, type ChoreReceiptMark } from "@lararium/mesh/chore-ask";
import { lentFacesOf } from "@lararium/mesh/lent-faces";
import type { Hand } from "@lararium/mesh/session-contract";
import { STORE_DOOR_FACE_VERBS, STORE_DOOR_VERBS } from "./store-door-verbs.js";

const READ = "reads and writes nothing under any face's authority";
const PLACE = "a row of the place: acts as the place, never as a face";

/** The verbs a session of a face other than the mount still places, each with its reason; every other verb reads as a chore. */
export const CHORE_FREE_VERBS: Readonly<Record<string, string>> = Object.freeze({
  // The daemon island's reads (its content fence still judges each presenter).
  "where": READ, "resolve": READ, "unbound-docs": READ, "fresher-canon": READ,
  "meme-list": READ, "meme-project": "renders a meme root to text and answers it; writes nothing",
  "wiki-filter": READ, "tiddler-get": READ, "wiki-render": READ, "wiki-status": READ, "circle-list": READ,
  "list-wikis": READ, "share-list": READ, "workbench-seat": READ, "intent-view": READ, "sealed-reading": READ, "events": READ,
  "realm-clock": READ,
  "realm-feed": "rolls the presenter's own leaf slot, its writer bound to the presenter; spends no mounted face's material",
  // The main thread's reads.
  "recall": READ, "status": READ, "rejim": READ, "worldline": READ, "worldline-compare": READ, "worldline-trajectory": READ,
  "analyze": READ, "ki": READ, "li": READ, "jing": READ, "couple-r": READ, "forecast": READ, "mismatch": READ, "flow": READ,
  "roster": READ, "inspect": READ, "residency": READ, "wiki-active": READ, "echo": READ, "ddate": READ,
  ...Object.fromEntries(STORE_DOOR_VERBS.filter((verb) => !STORE_DOOR_FACE_VERBS.has(verb)).map((verb) => [verb, PLACE])),
});

/**
 * EACH HAT REACHED BY NAME: the chores a LIT sibling's own session carries as ITSELF, on its own lane (the island's per-face
 * lane writes that face's own document, sealed under its own chain): the meme writes, and the tiddler door's writes, which land
 * through that face's own engine in its own working document. Every other chore still spends the mount's authority alone and
 * refuses from a sibling's session.
 */
export const FACE_LANE_CHORES: ReadonlySet<string> = new Set(["meme-put", "meme-delete", "tiddler-put", "tiddler-delete", "oracle-cast"]);

/**
 * The chore-free verbs that still write into a face's daemon layer, each with its reason. A chore-free verb passes the chore
 * gate (it spends no mounted face's material), but a write into the daemon layer can still enter that face's drain, so the
 * one-shot line's work gate takes it ({@link entersADrain}). The house lean: a write takes the gate unless proven outside every
 * face's drain.
 */
export const CHORE_FREE_WRITES: Readonly<Record<string, string>> = Object.freeze({
  "realm-feed": "rolls the presenter's lease slot and lands its receipt in the daemon layer",
});

/** True for a verb whose one-shot dispatch writes into a face's layers: every chore, and each chore-free write. */
export function entersADrain(verb: string): boolean {
  return isChore(verb) || Object.hasOwn(CHORE_FREE_WRITES, verb);
}

/** True for a verb that writes or signs under the daemon mount's authority. */
export function isChore(verb: string): boolean {
  return !Object.hasOwn(CHORE_FREE_VERBS, verb);
}

/** A chore's verdict at a door: it acts for the face its mark names, or it refuses by class with the message naming the faces. */
export type ChoreAtDoor = { readonly ok: true; readonly mark: ChoreReceiptMark } | { readonly ok: false; readonly refusal: string; readonly message: string };

/**
 * The verdict a door reads for one verb, or null where no chore gate stands: a verb free of the gate, or a vessel that
 * mounts no face (the floor, or a door handed no mount reader). The ask designates `face` (a session's face, the face a
 * one-shot names, or with none named the mount, as `face.resolve` answers a seat); `actingFaceOf` judges it against the lend
 * and the one face this process carries, the daemon mount. Where custody names no set (`lent` null or empty: it rests shut,
 * or the door holds no reader), the lend reads as the mount and the asked face, so it narrows nothing and the carry alone
 * judges.
 */
export function choreAtDoor(input: {
  readonly verb: string; readonly face: number; readonly mount: number | null; readonly lent: readonly number[] | null;
  /** The sibling faces lit beside the mount: a session wearing one carries its own lane's chores (`FACE_LANE_CHORES`). */
  readonly lit?: readonly number[];
  readonly hand: Hand; readonly session: string | null; readonly generation: number | null;
}): ChoreAtDoor | null {
  if (input.mount === null || !isChore(input.verb)) return null;
  const read = lentFacesOf(input.lent && input.lent.length > 0 ? input.lent : [...new Set([input.mount, input.face])]);
  if (!read.ok) return { ok: false, refusal: read.refusal, message: read.message };
  const ask: ChoreAsk = { chore: input.verb, face: input.face, asker: { hand: input.hand, session: input.session, generation: input.generation } };
  // A lit sibling's session carries its own lane's chores as itself: the process carries that face for this act alone.
  const carried = FACE_LANE_CHORES.has(input.verb) && input.face !== input.mount && (input.lit ?? []).includes(input.face)
    ? [input.mount, input.face] : [input.mount];
  const acting = actingFaceOf(ask, read.faces, carried);
  return acting.ok ? { ok: true, mark: choreReceiptMark(ask, acting.face) } : acting;
}
