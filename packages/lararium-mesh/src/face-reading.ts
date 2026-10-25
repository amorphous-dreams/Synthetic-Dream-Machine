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
import { headOpKey, type PersonaKelEvent } from "./persona-kel.js";

export interface FaceReading {
  /** The verified roster per epoch (epoch = KEL seq). */
  readonly lineage: HandLineage;
  /** May this key sign a lease advance or a current-epoch act now: it stands in the lineage's CURRENT roster. */
  readonly currentSigner: (writerHex: string) => boolean;
  /** The lease epoch the verified advances carry (current roster only), unfloored: what an anchor may RAISE to. */
  readonly observedLease: (group: string, slotTexts: Iterable<unknown>) => number;
  /** The lease epoch a door acts under: the observed epoch, never below what the anchor this reading holds accepted. */
  readonly leaseEpoch: (group: string, slotTexts: Iterable<unknown>) => number;
  /** Floor an epoch some reader observed under the anchor this reading holds (never below what the anchor accepted). */
  readonly floor: (observed: number) => number;
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
    floor: (observed) => anchor ? leaseEpochUnderAnchor(anchor, observed).epoch : observed,
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

/**
 * THE OWNER OF A HANDLE: the selected face's sealed anchor names the owner Persona KEL prefix, and the verified chain beneath
 * that prefix names the head op-key that authorizes burn and rotation. Handle founding, burn and rotation take both from here
 * and from nowhere else: the mutable daemon tiddler never names an owner, so a document change cannot choose a foreign or stale
 * prefix for a signed Handle inception. Only `readFaceOwner` issues one (`isFaceOwner` is the receiving core's check).
 */
export interface FaceOwner {
  readonly personaKelPrefix: string;
  /** The verified head op-key of the chain under the anchor's prefix (every quorum checked). */
  readonly headOpKeyDid: string;
  readonly reading: FaceReading;
}

const issuedOwners = new WeakSet<object>();
export const isFaceOwner = (candidate: unknown): candidate is FaceOwner => typeof candidate === "object" && candidate !== null && issuedOwners.has(candidate);

export async function readFaceOwner(
  chain: readonly PersonaKelEvent[] | null | undefined, anchor: FaceAnchor | null | undefined,
): Promise<{ readonly ok: true; readonly owner: FaceOwner } | { readonly ok: false; readonly reason: string }> {
  if (!anchor) return { ok: false, reason: "this face holds no sealed anchor; re-found or re-admit the face (fail-closed, a Handle never takes its owner from a document)" };
  if (!chain || chain.length === 0) return { ok: false, reason: `the persona-KEL chain for ${anchor.personaKelPrefix.slice(0, 20)}… is absent from the local board (fail-closed)` };
  if (chain.some((e) => e.prefix !== anchor.personaKelPrefix)) return { ok: false, reason: "prefix: the chain names a KEL prefix this face's sealed anchor does not" };
  const reading = readFace(chain, anchor);
  if (!reading) return { ok: false, reason: "no verified lineage: the persona-KEL chain forks or does not verify (fail-closed)" };
  const head = await headOpKey(chain, { verifyQuorums: true });
  if (head === null) return { ok: false, reason: "the persona-KEL head does not verify (fail-closed), so the owner cannot be proven" };
  const owner: FaceOwner = { personaKelPrefix: anchor.personaKelPrefix, headOpKeyDid: head, reading };
  issuedOwners.add(owner);
  return { ok: true, owner };
}
