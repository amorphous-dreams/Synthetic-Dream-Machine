/**
 * device-seat — THE SEAT a face's root holder gives one joining device: the tag law, the admission the face's log takes,
 * and the edge the root signs. One core for every vessel that holds a face's root: the node's `device-admit` and the
 * browser's `browser-fleet-root` both seat through here, each handing in what its own shores read.
 *
 * The caller reads the face (`readFace` over the KEL chain and the sealed anchor), its signed records and its lease
 * slots, and opens the root's seed for the act. This core then runs, in order:
 *
 *   1. THE FACE'S PROOF: the log projects founded and unforked, stands at or past the act this device accepted, and the
 *      root's key holds a current seat in the KEL.
 *   2. THE TAG LAW, before the root signs: the joining vessel's tag holds for this face and atom, its ward key proves
 *      itself, and no admission of this face already seats that vessel under another atom.
 *   3. THE EDGE: the root signs the joinee's delegation at the lease epoch read now. A fresh atom takes one `admission`
 *      act and one `device-edge` act; a seated atom whose edge the lease rolled past takes one `device-edge` act alone
 *      (the renewal); a seated atom whose edge still stands takes none (the replay).
 *   4. THE ENROLMENT the caller's door runs over those acts (the payload a joinee founds by).
 *   5. WHAT THE ANSWER SERVES EQUALS WHAT THE LOG HOLDS: a replay whose payload carries another edge refuses by name.
 *
 * The acts it signed come back for the caller to append AFTER the answer's own checks, so a refusal lands nothing.
 * Pure of I/O: no store, no clock. A refusal throws `DeviceSeatRefused`.
 */
import { actCid } from "./signed-act.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "./ed25519-door.js";
import { edgeBodyDigest, type FaceAnchor } from "./face-anchor.js";
import type { FaceReading } from "./face-reading.js";
import { signPersonaAct } from "./persona-act-board.js";
import type { DeviceDelegationRootHalf } from "./device-delegation.js";
import { vesselFaceTagHolds } from "./vessel-face-tag.js";
import { wardKeyPopHolds } from "./ward-answer.js";

export const DEVICE_SEAT_REFUSALS = [
  "face-proof",              // the face's log, frontier or root seat does not hold; the detail names which
  "vessel-tag-absent", "ward-key-absent", "vessel-tag-invalid", "ward-key-unproven",
  "vessel-already-admitted", // this vessel already holds a seat in this face under another atom
  "replay-edge-lapsed",      // a replayed request's answer carries an edge the face's log seats no more
] as const;
export type DeviceSeatRefusalName = (typeof DEVICE_SEAT_REFUSALS)[number];

/** A seat refused by name. `detail` reads as a sentence the caller's door prints under its own prefix. */
export class DeviceSeatRefused extends Error {
  override readonly name = "DeviceSeatRefused";
  constructor(readonly refusal: DeviceSeatRefusalName, readonly detail: string) { super(`${refusal}: ${detail}`); }
}

type SignedPersonaAct = Awaited<ReturnType<typeof signPersonaAct>>;

export interface DeviceSeatInput<P extends { readonly deviceEdge: Parameters<typeof edgeBodyDigest>[0] }> {
  readonly personaGroupId: string;
  /** The face read by the one door (`readFace`) over its KEL chain and this device's sealed anchor. */
  readonly reading: FaceReading;
  readonly issuerAnchor: FaceAnchor;
  /** The epoch the face's KEL stands at: its last event's `seq`. */
  readonly kelEpoch: number;
  /** The face's signed persona records as this replica holds them. */
  readonly records: readonly unknown[];
  /** The lease slot values read off the vessel's control document. */
  readonly leaseSlotValues: readonly string[];
  /** The PersonaGroup root's seed, open for this one act; the caller zero-fills it. */
  readonly signerSeed: Uint8Array;
  /** The hearth's true name the edge binds, or "" where the root holder stands no hearth. */
  readonly hearthTrueName: string;
  /** The joining atom's verifying key, 64 lower-case hex. */
  readonly deviceKey: string;
  readonly vesselTag: { readonly vesselTag?: unknown; readonly vesselSig?: unknown; readonly wardKey?: unknown; readonly wardPop?: unknown };
  /** The root's signature over the joinee's edge (`buildDeviceDelegationRootHalf`), handed in so the caller's own import signs. */
  readonly rootHalf: (args: { personaRootSeed: Uint8Array; deviceVerifyingKey: string; hearthTrueName: string; boundEpoch: number }) => Promise<DeviceDelegationRootHalf>;
  /** The enrolment over the acts this seat carries: the caller's door mints the payload a joinee founds by. */
  readonly enrol: (seat: { readonly boundEpoch: number; readonly personaActs: readonly unknown[]; readonly signedEdge: DeviceDelegationRootHalf }) => Promise<P>;
}

export interface DeviceSeat<P> {
  readonly payload: P;
  /** The acts this seat signed, for the caller to append to the face's log; none on a replay. */
  readonly appended: readonly SignedPersonaAct[];
  readonly boundEpoch: number;
}

export async function seatDeviceInFace<P extends { readonly deviceEdge: Parameters<typeof edgeBodyDigest>[0] }>(input: DeviceSeatInput<P>): Promise<DeviceSeat<P>> {
  const { personaGroupId, reading, issuerAnchor, records, signerSeed, deviceKey } = input;
  const boundEpoch = reading.leaseEpoch(personaGroupId, [...input.leaseSlotValues]);
  const projection = reading.project([...records], personaGroupId);
  if (!projection.founded || projection.fork || !projection.head) {
    throw new DeviceSeatRefused("face-proof", "Face proof: founding log absent or forked; re-found the face");
  }
  // THE WRITER NEVER BRANCHES BELOW WHAT THIS DEVICE ACCEPTED: the log it signs from must hold the anchor's pinned act at the
  // pinned seq (the boot's own `frontier-falls` check), so a replica that replays an older valid log signs nothing.
  if (issuerAnchor.frontier.actSeq >= 0 && projection.cids[issuerAnchor.frontier.actSeq] !== issuerAnchor.frontier.actCid) {
    throw new DeviceSeatRefused("face-proof", "Face proof: frontier-falls; this replica's log stands below the act this device accepted; sync the face's persona plane and retry");
  }
  const signerKey = await ed25519VerifyingKeyFromSeed(signerSeed);
  if (!reading.currentSigner(signerKey)) {
    throw new DeviceSeatRefused("face-proof", "Face proof: root signer has no current KEL seat; re-admit the face");
  }
  // THE TAG LAW, before the root signs: the joining vessel's tag holds for this face and atom, and no admission of this face
  // already seats it, so one vessel never takes two seats here.
  const { vesselTag, vesselSig, wardKey, wardPop } = input.vesselTag;
  if (vesselTag === undefined || vesselSig === undefined) throw new DeviceSeatRefused("vessel-tag-absent", "the join carries no blinded vessel tag for this face");
  if (wardKey === undefined) throw new DeviceSeatRefused("ward-key-absent", "the join names no per-face ward key for its device");
  if (!vesselFaceTagHolds(personaGroupId, deviceKey, { vesselTag, vesselSig, wardKey })) throw new DeviceSeatRefused("vessel-tag-invalid", "the vessel tag's signature covers another face, atom or ward key");
  if (!wardKeyPopHolds(personaGroupId, deviceKey, { wardKey, wardPop })) throw new DeviceSeatRefused("ward-key-unproven", "the join's ward key signs no proof over this face, atom and key: the joinee holds no key it names");
  // A retried answer for the atom that already holds this tag is a replay, not a second seat: the same vessel under another atom refuses.
  const bodyOf = (r: unknown): Record<string, unknown> | undefined => (r as { body?: Record<string, unknown> } | null)?.body;
  const seatedAdmission = records.find((r) => {
    const b = bodyOf(r);
    return b?.["act"] === "admission" && b["deviceKey"] === deviceKey && b["vesselTag"] === vesselTag
      && projection.admissions.some((a) => a.cid === actCid(b as never));
  });
  if (projection.vesselTags.includes(vesselTag as string) && !seatedAdmission) throw new DeviceSeatRefused("vessel-already-admitted", "this vessel already holds a seat in this face");
  // A retried answer for a seated atom and tag serves the seat as it stands. The edge the log seats for it reads off the
  // fold (`projection.edges`, the latest verified device-edge act for that device), never off the act linked first.
  const seatedDigest = seatedAdmission ? projection.edges[deviceKey] : undefined;
  // THE ROOT SIGNS ONLY PAST THE TAG LAW: every refusal above reaches no signature over the joinee's edge.
  const signedEdge = await input.rootHalf({ personaRootSeed: signerSeed, deviceVerifyingKey: deviceKey, hearthTrueName: input.hearthTrueName, boundEpoch });
  // The edge mints deterministically from root, device, hearth and epoch, so it rebuilds the seated edge exactly while none
  // of them moved, and the replay appends nothing. Where the seated edge binds an epoch the lease rolled past (or a root or
  // hearth the face moved off), THE RENEWAL: the root appends one `device-edge` act for the seated admission at the current
  // epoch, and the answer serves that edge. It never appends a second admission and never moves the tag.
  const servedDigest = edgeBodyDigest(signedEdge);
  const signer = { key: signerKey, sign: ed25519SignerFromSeed(signerSeed) };
  const epoch = input.kelEpoch;
  let appended: SignedPersonaAct[] = [];
  if (!seatedAdmission) {
    const admission = await signPersonaAct(projection.head, { group: personaGroupId, act: "admission", epoch,
      fields: { deviceKey, vesselTag, vesselSig, wardKey, wardPop } }, signer);
    const edgeAct = await signPersonaAct({ seq: admission.body.seq, cid: actCid(admission.body) },
      { group: personaGroupId, act: "device-edge", epoch,
        fields: { deviceKey, edgeDigest: servedDigest } }, signer);
    appended = [admission, edgeAct];
  } else if (seatedDigest !== servedDigest) {
    appended = [await signPersonaAct(projection.head, { group: personaGroupId, act: "device-edge", epoch,
      fields: { deviceKey, edgeDigest: servedDigest } }, signer)];
  }
  const payload = await input.enrol({ boundEpoch, personaActs: [...records, ...appended], signedEdge });
  // WHAT THE ANSWER SERVES EQUALS WHAT THE LOG HOLDS: the operation cache never decides a replay. A request whose cached
  // answer carries an edge the log seats no more refuses by name, before any act lands.
  if (seatedAdmission && edgeBodyDigest(payload.deviceEdge) !== servedDigest) {
    throw new DeviceSeatRefused("replay-edge-lapsed", `this request's answer carries an edge the face's log does not seat (now epoch ${boundEpoch}); retry the join with a fresh request`);
  }
  return { payload, appended, boundEpoch };
}
