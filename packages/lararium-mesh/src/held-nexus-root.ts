/**
 * held-nexus-root — THE ROOT OF ONE NEXUS AS THIS VESSEL HOLDS IT, and the one door a presented admit reads through.
 *
 * THE LAW. The carriage verifier checks an admit's epoch, its signatures AND a root this vessel holds locally,
 * and refuses by name without that root. `verifyPresentedAdmit` reads whatever roster its caller hands it: a
 * caller that handed in a roster the PRESENTER implied would believe any admit that presenter signed for
 * itself. So no door hands the verifier a roster. Each door hands in a HELD ROOT, and a held root comes from
 * one place: the charter this vessel keeps for that Nexus, read off its own store.
 *
 * WHAT A HELD ROOT BINDS, checked once where the root gets built (`heldNexusRoot`):
 *   · the charter's seal lineage verifies, link by link;
 *   · the lineage's GENESIS epoch names the very Nexus the vessel filed the charter under, so a charter kept
 *     under one name never answers for another;
 *   · the seated key-set hashes to the lineage's HEAD, so the roster reads as the charter's own and no other.
 * A charter that fails any of these names no root, and every door then refuses `no-held-root`.
 *
 * WHAT READS THROUGH IT. The socket seat (a dial that presents an admit), the raise (a recogniser's grant),
 * the admit bundle a joiner takes, and the gate of the face-proof exchange all call `readAdmitAtHeldRoot`.
 * Each picks the root by the Nexus it serves or by the epoch the admit roots on (`heldRootFor`), never by
 * anything else the presenter says.
 *
 * NO GLOBAL NOW: a held root reads this vessel's own replica as of its last sync. `revision` names the causal
 * position that reading stands at (the head epoch, the deny board's acts and the antigen's acts), so two
 * readings at one position wear one revision and a moved board wears another.
 *
 * Platform-blind: this module holds no key and opens no store. The vessel supplies the charter and the boards.
 * Canon: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-held-root
 */
import { canonicalJson, sha256HexSync } from "./crypto.js";
import {
  carriageEntryActCid, readAdmitCarriage, verifyPresentedAdmit,
  type AdmitCarriage, type CarriageEntry, type PresentedAdmitVerdict, type PresentedLineageAct,
} from "./carriage-registry.js";
import type { KahuQuorumSeats, KapaeAntigenEntry, QuorumVerifier } from "./kapae-antigen.js";
import { foundingRoster, type NexusDoc } from "./nexus-seal-seed.js";
import { followNexusKeyLine, nexusKeyHandOverId, type NexusKeyHandOver } from "./nexus-key-line.js";
import type { SealEpoch } from "./wax-stamp.js";

/** The root of one Nexus as this vessel holds it locally: what a presented admit gets read against. */
export interface HeldNexusRoot {
  /** The Nexus this root belongs to: its AID, the charter's genesis epoch. */
  readonly nexus:           string;
  /** The causal position this reading stands at: the head epoch and the acts the verifier folds. */
  readonly revision:        string;
  /** The seated quorum at the head of the charter this vessel holds. */
  readonly roster:          KahuQuorumSeats;
  /** The charter's epoch lineage, genesis first, its last epoch the roster's head. */
  readonly sealLineage?:    readonly SealEpoch[];
  /** The Nexus's carriage board, read as a DENY board: the verifier reads its counted revokes alone. A list,
   *  so the revision and the verifier each read it whole. */
  readonly denyBoard:       readonly CarriageEntry[];
  /** The Nexus's Kapae antigen entries. */
  readonly antigen:         readonly KapaeAntigenEntry[];
  /** Every per-Nexus key hand-over the Nexus's carriage board holds for this Nexus, every face's together. */
  readonly handOvers:       readonly NexusKeyHandOver[];
  /** The antigen quorum's roster, held apart from the membership roster. */
  readonly antigenRoster:   KahuQuorumSeats;
  readonly antigenVerifier: QuorumVerifier;
}

/** Why a vessel holds no root for a Nexus. */
export type HeldRootAbsence =
  | "no-charter"                    // the vessel keeps no charter under this name
  | "charter-names-another-nexus"   // the kept charter's genesis epoch names a different Nexus
  | "charter-unseated";             // the lineage breaks, a seat reads weak, or the head does not bind the seated keys

/** The one name every door answers when no root stands behind a presented admit. */
export const NO_HELD_ROOT = "no-held-root" as const;

/** The causal position a reading stands at: the head epoch, the deny board's acts and the antigen's acts. */
export function heldRootRevision(
  headEpochCid: string, denyBoard: readonly CarriageEntry[], antigen: readonly KapaeAntigenEntry[],
  handOvers: readonly NexusKeyHandOver[] = [],
): string {
  const acts: string[] = [];
  for (const entry of denyBoard) {
    try { acts.push(carriageEntryActCid(entry)); } catch { /* an entry with no readable image holds no position */ }
  }
  const bans: string[] = [];
  for (const entry of antigen) if (typeof entry?.actCid === "string") bans.push(entry.actCid);
  const lines: string[] = [];
  for (const h of handOvers) {
    try { lines.push(nexusKeyHandOverId(h)); } catch { /* a record with no readable image holds no position */ }
  }
  return `held-${sha256HexSync(canonicalJson({ head: headEpochCid, deny: [...new Set(acts)].sort(), antigen: [...new Set(bans)].sort(),
    ...(lines.length > 0 ? { handOvers: [...new Set(lines)].sort() } : {}) }))}`;
}

/**
 * Build the root this vessel holds for `nexus` from the charter it keeps under that name and the boards it
 * reads for it, or name why none stands. The antigen quorum reads off the same charter roster unless the
 * caller seats another.
 */
export function heldNexusRoot(input: {
  /** The AID this vessel files the charter under. */
  readonly nexus:            string;
  /** The charter this vessel keeps for that Nexus, off its own store; null where it keeps none. */
  readonly charter:          NexusDoc | null | undefined;
  readonly denyBoard:        readonly CarriageEntry[];
  readonly antigen:          readonly KapaeAntigenEntry[];
  readonly antigenVerifier:  QuorumVerifier;
  readonly antigenRoster?:   KahuQuorumSeats;
  /** The per-Nexus key hand-overs off the Nexus's carriage board (`nexusKeyHandOversFromBoard`); absent → none. */
  readonly handOvers?:       readonly NexusKeyHandOver[];
}): HeldNexusRoot | { readonly absent: HeldRootAbsence } {
  const charter = input.charter ?? null;
  if (charter === null) return { absent: "no-charter" };
  const genesis = charter.sealLineage?.[0]?.epochCid;
  if (typeof genesis !== "string" || genesis.length === 0) return { absent: "charter-unseated" };
  if (genesis !== input.nexus) return { absent: "charter-names-another-nexus" };
  const roster = foundingRoster(charter);
  if (roster.sealEpochCid.length === 0) return { absent: "charter-unseated" };
  return {
    nexus: input.nexus,
    revision: heldRootRevision(roster.sealEpochCid, input.denyBoard, input.antigen, input.handOvers ?? []),
    roster,
    sealLineage: charter.sealLineage ?? [],
    denyBoard: input.denyBoard,
    antigen: input.antigen,
    handOvers: input.handOvers ?? [],
    antigenRoster: input.antigenRoster ?? roster,
    antigenVerifier: input.antigenVerifier,
  };
}

/** The root, among those a vessel holds, that a presented admit roots on: the one whose head the admit names,
 *  else the one whose lineage holds the admit's epoch. Null where none does: the admit names no Nexus this
 *  vessel holds a root for. */
export function heldRootFor(
  admit: Pick<CarriageEntry, "sealEpochCid"> | null | undefined, roots: readonly HeldNexusRoot[],
): HeldNexusRoot | null {
  const epoch = admit?.sealEpochCid;
  if (typeof epoch !== "string" || epoch.length === 0) return null;
  return roots.find((r) => r.roster.sealEpochCid === epoch)
    ?? roots.find((r) => (r.sealLineage ?? []).some((e) => e.epochCid === epoch))
    ?? null;
}

/** What a door reads of a presented admit: the verifier's own verdict at a held root, or the named refusal. */
export type HeldAdmitReading =
  | {
      readonly verdict: PresentedAdmitVerdict; readonly nexus: string; readonly admitRef: string; readonly revision: string;
      /** The key the presenter must hold: the head of the admitted nym's line at this Nexus, the nym itself where no
       *  hand-over stands. Empty when the line refused (the verdict then names why). */
      readonly head: string;
      /** The gate pin and canon list the admit's quorum signed, or null where it signed none. Trust it only where
       *  the verdict reads `held` (`verifySignedAdmitBundle` reads it no other way). */
      readonly carriage: AdmitCarriage | null;
    }
  | { readonly refusal: typeof NO_HELD_ROOT };

/**
 * THE ONE DOOR. Read a presented admit against the root this vessel holds, or refuse `no-held-root` where it
 * holds none. The roster, the lineage, the deny board and the antigen all come off the root, so no caller
 * hands the verifier a roster of its own making.
 */
export async function readAdmitAtHeldRoot(
  arm: { readonly admit: CarriageEntry; readonly lineage: readonly PresentedLineageAct[] },
  root: HeldNexusRoot | null | undefined,
): Promise<HeldAdmitReading> {
  if (root === null || root === undefined) return { refusal: NO_HELD_ROOT };
  let admitRef = "";
  const carriage = arm.admit?.carriage === undefined ? null : readAdmitCarriage(arm.admit.carriage);
  try { admitRef = carriageEntryActCid(arm.admit); } catch { /* a malformed admit reads rejected below and wears no reference */ }
  // THE LINE. The admitted nym's keys at this Nexus, walked off the hand-overs the root's board holds. A line that
  // forks or loops shows the face's key signed two standings: the admit reads denied, whatever else holds.
  const nym = typeof arm.admit?.nym === "string" ? arm.admit.nym.toLowerCase() : "";
  const line = followNexusKeyLine({ nexus: root.nexus, admitted: nym, carried: root.handOvers ?? [] });
  if ("refusal" in line && /^[0-9a-f]{64}$/.test(nym)) {
    return { verdict: { state: "denied", reason: `key-line-${line.refusal}`, nym }, nexus: root.nexus, admitRef, revision: root.revision, head: "", carriage };
  }
  const verdict = await verifyPresentedAdmit({
    admit: arm.admit, lineage: arm.lineage, roster: root.roster, denyBoard: root.denyBoard,
    antigen: root.antigen, antigenRoster: root.antigenRoster, antigenVerifier: root.antigenVerifier,
    ...(root.sealLineage ? { sealLineage: root.sealLineage } : {}),
    ...("keys" in line ? { lineKeys: line.keys } : {}),
  });
  return { verdict, nexus: root.nexus, admitRef, revision: root.revision, head: "head" in line ? line.head : "", carriage };
}

/** Why a carried admit bundle hands out no pin and no canon. */
export const SIGNED_ADMIT_BUNDLE_REFUSALS = [
  "bundle-malformed",       // no AID, no 64-hex gate key, or no admit and lineage
  NO_HELD_ROOT,             // this vessel holds no root to read the admit against
  "bundle-other-nexus",     // the bundle names another Nexus than the held root
  "admit-not-held",         // the admit reads anything but held at that root; `state` names which
  "admit-carries-no-pin",   // the quorum signed no carriage into this admit
  "pin-differs",            // the bundle's gate key names another key than the pin the quorum signed
] as const;
export type SignedAdmitBundleRefusal = (typeof SIGNED_ADMIT_BUNDLE_REFUSALS)[number];

/**
 * THE ONE DOOR A CARRIED ADMIT'S PIN AND CANON PASS (face-proof#/the-gate-exchange, step 5). A bundle carries an
 * admit by hand from the hearth that wrote it, with that hearth's gate key beside it. The quorum signed the pin
 * and the canon list inside the admit; this door reads the admit at the root this vessel holds for the bundle's
 * Nexus and hands out the carriage only where the admit reads `held` and the bundle's gate key equals the signed
 * pin. A moved pin, a moved canon entry, a carriage lifted from another admit or another Nexus each refuse here.
 */
export async function verifySignedAdmitBundle(
  bundle: unknown, root: HeldNexusRoot | null | undefined,
): Promise<{ readonly carriage: AdmitCarriage; readonly reading: Extract<HeldAdmitReading, { verdict: unknown }> }
  | { readonly refusal: SignedAdmitBundleRefusal; readonly state?: string }> {
  if (typeof bundle !== "object" || bundle === null) return { refusal: "bundle-malformed" };
  const { aid, gatePubKey, admit, lineage } = bundle as Record<string, unknown>;
  if (typeof aid !== "string" || aid.length === 0 || typeof gatePubKey !== "string" || !/^[0-9a-f]{64}$/.test(gatePubKey)) {
    return { refusal: "bundle-malformed" };
  }
  if (typeof admit !== "object" || admit === null || !Array.isArray(lineage)) return { refusal: "bundle-malformed" };
  if (root === null || root === undefined) return { refusal: NO_HELD_ROOT };
  if (root.nexus !== aid) return { refusal: "bundle-other-nexus" };
  const reading = await readAdmitAtHeldRoot({ admit: admit as CarriageEntry, lineage: lineage as PresentedLineageAct[] }, root);
  if ("refusal" in reading) return { refusal: reading.refusal };
  if (reading.verdict.state !== "held") return { refusal: "admit-not-held", state: reading.verdict.state };
  if (reading.carriage === null) return { refusal: "admit-carries-no-pin" };
  if (reading.carriage.gatePin !== gatePubKey) return { refusal: "pin-differs" };
  return { carriage: reading.carriage, reading };
}
