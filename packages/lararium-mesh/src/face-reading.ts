/**
 * face-reading — THE ONE DOOR every authority decision about a face reads through.
 *
 * A face's authority rests on four kinds of record: its persona KEL (who may sign, per epoch), its signed `@persona` acts, its
 * signed lease advances and its signed fleet frontiers, all pinned by the device's sealed anchor. Each is carried by sync and
 * decided by a verifier, never by order, shape or a mutable document. A gate, an admit door, a boot, a registration or a
 * writer that must decide from them asks THIS reading: the chain is folded through the one KEL reader (a rejected event seats
 * nothing, a fork has no lineage), a lease counts only from the CURRENT roster, the act log projects from the anchor's accepted
 * frontier, and a lease epoch never reads below what the anchor accepted.
 *
 * No other file reads those records raw: `tests/face-reading-census.test.ts` greps the source tree for the primitives below and
 * names every file that touches one outside this door and its definitions. Where a site needs more than the door gives, the
 * door widens; the site never reaches past it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import type { LarDoc } from "./base-doc.js";
import { leaseEpochUnderAnchor, type FaceAnchor } from "./face-anchor.js";
import { currentSignerOf, type HandLineage } from "./hand-lineage.js";
import { signedLeaseEpoch } from "./lease-advance.js";
import { personaActRecordsOfGroup, personaLineageFromKel } from "./persona-act-board.js";
import { projectPersonaLog, type PersonaProjection } from "./persona-act.js";
import type { PersonaKelEvent } from "./persona-kel.js";

export interface FaceReading {
  /** The verified roster per epoch (epoch = KEL seq). */
  readonly lineage: HandLineage;
  /** May this key sign a lease advance or a current-epoch act now: it stands in the lineage's CURRENT roster. */
  readonly currentSigner: (writerHex: string) => boolean;
  /** The lease epoch the verified advances carry (current roster only), unfloored: what an anchor may RAISE to. */
  readonly observedLease: (group: string, slotTexts: Iterable<unknown>) => number;
  /** The lease epoch a door acts under: the observed epoch, never below what the anchor this reading holds accepted. */
  readonly leaseEpoch: (group: string, slotTexts: Iterable<unknown>) => number;
  /** The act log's projection under this lineage, from the anchor's accepted frontier (so a rotated-past key adds nothing new). */
  readonly project: (records: readonly unknown[], group: string) => PersonaProjection;
}

/** Read a face from its persona-KEL chain (the heap a ring carries is fine: the one reader folds it) and, where one is held, its sealed anchor. Null: no verified lineage. */
export function readFace(chain: readonly PersonaKelEvent[] | null | undefined, anchor?: FaceAnchor | null): FaceReading | null {
  const lineage = personaLineageFromKel(chain ?? []);
  if (!lineage) return null;
  const currentSigner = currentSignerOf(lineage);
  const observedLease = (group: string, slotTexts: Iterable<unknown>): number => signedLeaseEpoch(group, slotTexts, currentSigner);
  return {
    lineage, currentSigner, observedLease,
    leaseEpoch: (group, slotTexts) => {
      const observed = observedLease(group, slotTexts);
      return anchor ? leaseEpochUnderAnchor(anchor, observed).epoch : observed;
    },
    project: (records, group) => projectPersonaLog(records, {
      group, lineage, authorize: () => true,
      ...(anchor ? { acceptedThrough: anchor.frontier.actSeq } : {}),
    }),
  };
}

/** The persona-act records a set of held documents carry for one group: unjudged transport for `FaceReading.project`. */
export function faceRecordsOf(docs: readonly (LarDoc | undefined | null)[], group: string): unknown[] {
  return docs.flatMap((doc) => personaActRecordsOfGroup(doc, group));
}
