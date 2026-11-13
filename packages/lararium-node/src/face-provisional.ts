/**
 * face-provisional — A RESTORED FACE STANDS PROVISIONAL until one party to its relation agrees with its head.
 *
 * The restore reads the newest key history this vessel holds, and no vessel reads a head it never received
 * (stable-founding-road#/rulings, "The restore's key history"). So the restore leaves a MARK on the face: the head it
 * read, and where it read it. While the mark stands the face reads, recovers and serves its own content, and every
 * act that changes who holds authority refuses by name (`face-provisional`) and names who could confirm.
 *
 * ── THE MARK ────────────────────────────────────────────────────────────────────────────────────
 * One sealed row per face (`face-provisional-h<N>.json`, hot): the face's fixed prefix and the head the restore read,
 * by sequence and event id, and whether this vessel's board or the bundle's log supplied it. The restore lands it
 * among the rows its one commit row holds, before the root, so a face never stands restored without it.
 *
 * ── THE CONFIRM ─────────────────────────────────────────────────────────────────────────────────
 * A party shows its OWN view of the face's head, signed by its own key (`face-log-view`). The view confirms where it
 * names the face's prefix, agrees with the head the mark holds, verifies under the key it names, and that key stands
 * as the party it claims, judged against this vessel's own rows and never a list compiled about the face:
 *   · a RECOVERY CONTACT: a key in the set the face's own sealed `recovery-contact-set` row holds, under the face's prefix;
 *   · a SEATED CHAIR: a key a charter this vessel keeps seats, and that no seat row of this vessel holds (a chair
 *     this vessel holds speaks for this vessel, never as another party);
 *   · a SIBLING DEVICE: unread. The face's root signs every device edge, and the restorer holds that root, so an
 *     edge alone proves no sibling apart from the restorer; the view refuses `party-unread`, and no door reads one.
 * A view that disagrees keeps the mark (`view-disagrees`) and says which head the party holds. The residue stays
 * stated: one agreeing party may itself sit stale.
 *
 * ── WHERE NO PARTY ANSWERS ──────────────────────────────────────────────────────────────────────
 * The recovery contacts' recovery path answers, under the impersonation quorum (a rotation the recovery contacts sign), and never the
 * local read alone. The recovery contacts' rotation carries that path (road `K18`, stable-founding-road#/stride-1-spine); this module names
 * it and builds none.
 *
 * Node-main only. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  faceLogViewImage, faceLogViewSigned, foldPersonaContests, nexusAidOf, readFaceLogViewLine,
  type FaceLogView, type FaceLogViewParty, type NexusDoc,
} from "@lararium/mesh";
import { readLocalPersonaKelEvents } from "./local-persona-kel.js";
import { readCarriedCharters } from "./carried-set.js";
import { readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { readRecoveryContactSet } from "./recovery-contact-enrolment.js";
import { readNexusDoc } from "./nexus-doc.js";
import { heldSeatKey, signAsSeat } from "./seat-key-store.js";
import { larSealHome } from "./vessel-paths.js";

/** One face's provisional mark: its sealed row's filename. */
export const FACE_PROVISIONAL_FILE = /^face-provisional-h(\d+)\.json$/;
export function faceProvisionalFile(handleIndex: number): string {
  return `face-provisional-h${handleIndex}.json`;
}

/** What a mark holds: the face's prefix and the head the restore read, and where it read it. */
export interface ProvisionalMark {
  readonly prefix: string;
  readonly head:   { readonly seq: number; readonly eventCid: string };
  readonly from:   "board" | "bundle";
}

/** An authority-changing act that refused while the face stands provisional. */
export class FaceProvisional extends Error {
  override readonly name = "FaceProvisional";
  readonly reason = "face-provisional" as const;
  constructor(readonly handleIndex: number, readonly act: string, message: string) { super(message); }
}

/** Why a confirm refused, by name. Every refusal leaves the mark standing. */
export type ConfirmRefusal =
  | "not-provisional"       // no mark stands for this face
  | "view-malformed"        // the line reads as no view
  | "view-other-face"       // the view names another face's prefix
  | "view-unsigned"         // the view's signature fails under the key it names
  | "view-disagrees"        // the view names another head than the one the mark holds
  | "party-not-standing"    // the key stands as no party of the kind it claims, on this vessel's rows
  | "party-unread";         // no door reads that kind of party (a sibling device)

export class ConfirmRefused extends Error {
  override readonly name = "ConfirmRefused";
  constructor(readonly reason: ConfirmRefusal, message: string) { super(message); }
}
const refuse = (reason: ConfirmRefusal, message: string): never => { throw new ConfirmRefused(reason, message); };

function readMark(bytes: Uint8Array | null): ProvisionalMark | null {
  if (bytes === null) return null;
  const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ProvisionalMark;
  if (typeof raw?.prefix !== "string" || !Number.isSafeInteger(raw.head?.seq) || typeof raw.head?.eventCid !== "string" || (raw.from !== "board" && raw.from !== "bundle")) {
    throw new Error("a face-provisional row stands and reads as no mark");
  }
  return raw;
}

/** The face's provisional mark, or null where the face stands confirmed (or never stood restored here). */
export async function readProvisionalMark(handleIndex: number): Promise<ProvisionalMark | null> {
  return readMark(await readCustodyRow("identity", faceProvisionalFile(handleIndex)));
}

/**
 * Land the mark for a face a restore brings back. A resumed restore reads the history again and its mark names the
 * head that run read; the same mark standing stays as it stands.
 */
export async function markProvisional(handleIndex: number, mark: ProvisionalMark): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify({ prefix: mark.prefix, head: { seq: mark.head.seq, eventCid: mark.head.eventCid }, from: mark.from }));
  await updateCustodyRow("identity", faceProvisionalFile(handleIndex), (standing) => {
    const held = readMark(standing);
    const same = held !== null && held.prefix === mark.prefix && held.head.eventCid === mark.head.eventCid && held.from === mark.from;
    return { plaintext: same ? null : bytes, value: undefined };
  });
}

/** The keys of every chair a charter this vessel keeps seats: its own charter, and each charter it carries. */
function seatedChairKeys(): Set<string> {
  const docs: NexusDoc[] = [];
  const own = readNexusDoc(larSealHome());
  if (own) docs.push(own);
  for (const doc of readCarriedCharters(larSealHome()).values()) if (nexusAidOf(doc) !== nexusAidOf(own)) docs.push(doc);
  const keys = new Set<string>();
  for (const doc of docs) for (const k of doc.kahu) if (k.verifyingKey) keys.add(k.verifyingKey.toLowerCase());
  return keys;
}

/** Who could confirm the face, in words a person reads: the recovery contacts by key, and the kinds of party beside them. */
export async function couldConfirm(handleIndex: number): Promise<string[]> {
  const mark = await readProvisionalMark(handleIndex);
  if (mark === null) return [];
  const out: string[] = [];
  const set = await readRecoveryContactSet(handleIndex);
  if (set && set.prefix === mark.prefix) for (const g of set.recoveryContacts) out.push(`a recovery contact of this face (${g.recoveryPubKey.slice(0, 16)}…), with its own view`);
  out.push("a chair seated in a charter this face stands in, with its own view");
  out.push("a sibling device of the same human (unread: an edge alone proves no sibling apart from the restorer)");
  out.push("where none answers: the recovery contacts' recovery path, under their quorum");
  return out;
}

/**
 * Refuse `act` by name while the face at `handleIndex` stands provisional. Every door that signs an act changing who
 * holds authority calls this before it opens a key.
 */
export async function refuseWhileProvisional(handleIndex: number, act: string): Promise<void> {
  const mark = await readProvisionalMark(handleIndex);
  if (mark === null) return;
  const who = await couldConfirm(handleIndex);
  throw new FaceProvisional(handleIndex, act,
    `the face at h${handleIndex} stands provisional since its restore read head ${mark.head.seq} off ${mark.from === "board" ? "this vessel's board" : "its bundle's log"}: ` +
    `it reads, recovers and serves its own content, and signs no act that changes who holds authority (${act}) until a party to its relation agrees with that head. ` +
    `Who could confirm: ${who.join("; ")}.`);
}

/** Whether `key` stands as a party of kind `party` for the face at `handleIndex`, on this vessel's own rows. */
async function partyStands(handleIndex: number, prefix: string, party: FaceLogViewParty, key: string): Promise<boolean> {
  if (party === "recovery-contact") {
    const set = await readRecoveryContactSet(handleIndex);
    return set !== null && set.prefix === prefix && set.recoveryContacts.some((g) => g.recoveryPubKey.toLowerCase() === key);
  }
  if (party === "chair") return seatedChairKeys().has(key) && heldSeatKey(key) === null;
  return refuse("party-unread", "no door reads a sibling device's standing: the face's root signs every device edge, and a restorer holds that root, so an edge alone proves no sibling apart from it. Nothing moved.");
}

/**
 * CONFIRM a provisional face by one party's own view. On a confirm the mark leaves; every refusal leaves it standing.
 * Answers who confirmed and the head they agreed on.
 */
export async function confirmProvisional(input: { readonly handleIndex: number; readonly view: string | FaceLogView }): Promise<{
  readonly handleIndex: number; readonly party: FaceLogViewParty; readonly key: string; readonly head: ProvisionalMark["head"];
}> {
  const { handleIndex } = input;
  const mark = await readProvisionalMark(handleIndex);
  if (mark === null) return refuse("not-provisional", `the face at h${handleIndex} stands confirmed, or never stood restored here: nothing to confirm`);
  const view = typeof input.view === "string" ? readFaceLogViewLine(input.view) : input.view;
  if (view === null) return refuse("view-malformed", "the line reads as no log view (lar-log-view:…). Nothing moved.");
  if (view.prefix !== mark.prefix) return refuse("view-other-face", `the view names another face (${view.prefix.slice(0, 24)}…). Nothing moved.`);
  if (!faceLogViewSigned(view)) return refuse("view-unsigned", "the view's signature fails under the key it names. Nothing moved.");
  if (!(await partyStands(handleIndex, mark.prefix, view.party, view.key.toLowerCase()))) {
    return refuse("party-not-standing", `the key ${view.key.slice(0, 16)}… stands as no ${view.party} of this face on this vessel's own rows. Nothing moved.`);
  }
  if (view.seq !== mark.head.seq || view.eventCid !== mark.head.eventCid) {
    return refuse("view-disagrees", `the ${view.party} holds head ${view.seq} (${view.eventCid.slice(0, 20)}…), and the restore read head ${mark.head.seq} (${mark.head.eventCid.slice(0, 20)}…): the face stays provisional. A head the restore never read may stand; the recovery contacts' recovery path answers a fork.`);
  }
  await removeCustodyRow("identity", faceProvisionalFile(handleIndex));
  return { handleIndex, party: view.party, key: view.key, head: mark.head };
}

/**
 * The head of a face's key history as this vessel's own board holds it: the head a party's view names. Refuses where
 * the board holds no history for the face, or a history that forks: a party shows only a head it holds.
 */
export async function boardHeadOf(repo: Repo, prefix: string): Promise<{ readonly seq: number; readonly eventCid: string }> {
  const fold = foldPersonaContests((await readLocalPersonaKelEvents(repo, prefix)).sort((a, b) => a.seq - b.seq));
  const head = fold.kel[fold.kel.length - 1];
  if (!head || fold.fork !== null) {
    throw new Error(`this vessel's board holds ${fold.fork ? `a history that forks at sequence ${fold.fork.seq}` : "no history"} for ${prefix.slice(0, 24)}…: a party shows only a head it holds`);
  }
  return { seq: head.seq, eventCid: head.eventCid };
}

/**
 * A CHAIR'S OWN VIEW: this vessel reads the face's head off its own board and signs that head with the seat key
 * `seatKey` names, under the log view's own domain. Refuses where the board holds no unforked history for the face.
 */
export async function chairLogView(input: { readonly repo: Repo; readonly prefix: string; readonly seatKey: string }): Promise<FaceLogView> {
  const head = await boardHeadOf(input.repo, input.prefix);
  const key = input.seatKey.toLowerCase();
  const unsigned = { prefix: input.prefix, seq: head.seq, eventCid: head.eventCid, party: "chair" as const, key };
  return { ...unsigned, sig: Buffer.from(await signAsSeat(key, faceLogViewImage(unsigned))).toString("hex") };
}
