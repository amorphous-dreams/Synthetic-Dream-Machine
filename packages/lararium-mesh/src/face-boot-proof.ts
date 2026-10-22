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
import { personaLineageFromKel } from "./persona-act-board.js";
import { projectPersonaLog, type PersonaProjection } from "./persona-act.js";
import type { PersonaKelEvent } from "./persona-kel.js";

/** The planes of a face, by the name a `plane` act carries. */
export const FACE_PLANE_NAMES = ["persona", "identities", "circles", "sessions"] as const;
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
  /** This device's atom verifying key (hex). */
  readonly deviceKey: string;
  /** This device's edge: the log's device-edge act for this device must commit to it. */
  readonly edge?: { readonly personaRootDid: string; readonly deviceVerifyingKey: string; readonly hearthTrueName: string; readonly boundEpoch: string | number };
  /** The plane URLs the boot is about to register, by plane name. */
  readonly planes: Readonly<Record<string, string | null | undefined>>;
}): { readonly ok: true; readonly projection: PersonaProjection } | { readonly ok: false; readonly refusal: FaceBootRefusal } {
  const lineage = personaLineageFromKel(input.chain);
  if (!lineage) return { ok: false, refusal: { why: "no-lineage" } };
  const projection = projectPersonaLog(input.records, { group: input.group, lineage, authorize: () => true });
  if (projection.fork) return { ok: false, refusal: { why: "fork", seq: projection.fork.seq } };
  if (!projection.founded) return { ok: false, refusal: { why: "no-founding" } };
  if (projection.personaKelPrefix !== input.anchor.personaKelPrefix) return { ok: false, refusal: { why: "prefix" } };
  // The founding commits the root it was founded under (a rotation since moves the anchor, which the KEL head attests).
  if (projection.rootCommitment === null) return { ok: false, refusal: { why: "root" } };
  for (const [plane, url] of Object.entries(input.planes)) {
    if (url && projection.planes[plane] !== url) return { ok: false, refusal: { why: "plane", plane } };
  }
  if (!projection.devices.includes(input.deviceKey.toLowerCase())) return { ok: false, refusal: { why: "device-unseated" } };
  // THE LOG NEVER FALLS BEHIND WHAT THIS DEVICE ACCEPTED: the anchor's pinned head must stand in the verified lineage at its
  // seq, so deleting later signed acts, or replaying an older valid log, names `frontier-falls` rather than reading as current.
  const pinned = input.anchor.frontier;
  if (pinned.actSeq >= 0 && projection.cids[pinned.actSeq] !== pinned.actCid) return { ok: false, refusal: { why: "frontier-falls" } };
  if (input.edge && projection.edges[input.deviceKey.toLowerCase()] !== edgeBodyDigest(input.edge)) return { ok: false, refusal: { why: "edge" } };
  return { ok: true, projection };
}
