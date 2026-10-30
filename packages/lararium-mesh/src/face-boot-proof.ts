/**
 * face-boot-proof — what a boot proves about its face from the signed `@persona` log, on node and browser alike.
 *
 * The anchor (face-anchor) pins WHICH face this device wears; this proof reads the face's signed acts against that
 * anchor and the verified KEL and answers whether the face's planes may register: the founding act carries the
 * anchored prefix and root, every plane the boot would mount stands in a signed `plane` act, and this device's atom
 * stands seated by a signed admission. A plane URL, a device or a root named by any other record proves nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import { edgeBodyDigest, type FaceAnchor } from "./face-anchor.js";
import { readFace } from "./face-reading.js";
import type { PersonaProjection } from "./persona-act.js";
import type { PersonaKelEvent } from "./persona-kel.js";

/** The planes of a face, by the name a `plane` act carries. */
export const FACE_PLANE_NAMES = ["persona", "identities", "circles", "sessions", "intents"] as const;
export type FacePlaneName = (typeof FACE_PLANE_NAMES)[number];

export type FaceBootRefusal =
  | { readonly why: "no-lineage" }
  | { readonly why: "no-founding" }
  | { readonly why: "fork"; readonly seq: number }
  | { readonly why: "prefix" }
  | { readonly why: "root" }
  | { readonly why: "plane"; readonly plane: string }
  | { readonly why: "device-unseated" }
  | { readonly why: "frontier-falls" }
  | { readonly why: "edge" };

export function proveFaceFromLog(input: {
  /** Every carried `@persona` record, from every doc that carries them (the plane doc, the admit bundle). */
  readonly records: readonly unknown[];
  readonly chain: readonly PersonaKelEvent[];
  readonly group: string;
  readonly anchor: FaceAnchor;
  /** This device's atom verifying key (hex). Absent: a registration proof of a face this boot does not wear (no device seat to prove). */
  readonly deviceKey?: string;
  /** This device's edge: the log's device-edge act for this device must commit to it. */
  readonly edge?: { readonly personaRootDid: string; readonly deviceVerifyingKey: string; readonly hearthTrueName: string; readonly boundEpoch: string | number };
  /** The plane URLs the boot is about to register, by plane name. */
  readonly planes: Readonly<Record<string, string | null | undefined>>;
}): { readonly ok: true; readonly projection: PersonaProjection } | { readonly ok: false; readonly refusal: FaceBootRefusal } {
  const reading = readFace(input.chain, input.anchor);
  if (!reading) return { ok: false, refusal: { why: "no-lineage" } };
  const projection = reading.project(input.records, input.group);
  if (projection.fork) return { ok: false, refusal: { why: "fork", seq: projection.fork.seq } };
  if (!projection.founded) return { ok: false, refusal: { why: "no-founding" } };
  if (projection.personaKelPrefix !== input.anchor.personaKelPrefix) return { ok: false, refusal: { why: "prefix" } };
  // The founding commits the root it was founded under (a rotation since moves the anchor, which the KEL head attests).
  if (projection.rootCommitment === null) return { ok: false, refusal: { why: "root" } };
  for (const [plane, url] of Object.entries(input.planes)) {
    if (url && projection.planes[plane] !== url) return { ok: false, refusal: { why: "plane", plane } };
  }
  if (input.deviceKey !== undefined && !projection.devices.includes(input.deviceKey.toLowerCase())) return { ok: false, refusal: { why: "device-unseated" } };
  // THE LOG NEVER FALLS BEHIND WHAT THIS DEVICE ACCEPTED: the anchor's pinned head must stand in the verified lineage at its
  // seq, so deleting later signed acts, or replaying an older valid log, names `frontier-falls` rather than reading as current.
  const pinned = input.anchor.frontier;
  if (pinned.actSeq >= 0 && projection.cids[pinned.actSeq] !== pinned.actCid) return { ok: false, refusal: { why: "frontier-falls" } };
  if (input.edge && input.deviceKey !== undefined && projection.edges[input.deviceKey.toLowerCase()] !== edgeBodyDigest(input.edge)) return { ok: false, refusal: { why: "edge" } };
  return { ok: true, projection };
}

/** The four sibling planes a face carries, each a url or absent. */
export type ProvenFacePlanes = { circles: string | null; identities: string | null; sessions: string | null; intents: string | null };

/** Of the urls a vessel carries unsealed, only those the face's signed log names stand; a forged intents url voids all. */
export function provenPlaneUrls(projection: { planes: Readonly<Record<string, string | undefined>> }, urls: ProvenFacePlanes): ProvenFacePlanes | null {
  if (!urls.intents || projection.planes.intents !== urls.intents) return null;
  return {
    circles: urls.circles && projection.planes.circles === urls.circles ? urls.circles : null,
    identities: urls.identities && projection.planes.identities === urls.identities ? urls.identities : null,
    sessions: urls.sessions && projection.planes.sessions === urls.sessions ? urls.sessions : null,
    intents: urls.intents,
  };
}

