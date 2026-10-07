/**
 * raise-challenge — the door a recognised operator walks through to raise a vessel off its floor.
 *
 * ── WHY A CHALLENGE AND NOT A CREDENTIAL ────────────────────────────────────────────────────────
 * `vessel-standing` carries the FENCE — a raise stands while `boundEpoch >= effective`. It says nothing
 * about how a raise gets minted, and the missing half is the dangerous one: a vessel at the floor holds no
 * clock and no trustworthy wall time, so any signed material PRESENTED to it replays forever. A thief
 * holding the disk and one captured raise-packet raises the stolen vessel, and the whole point of sealing
 * against a stolen disk evaporates (waking-floor#the-breaks b).
 *
 * So the freshness is VERIFIER-CHOSEN. The vessel emits a nonce bound to its own epoch head; the recogniser
 * signs THAT. A grant is answerable only to the exact challenge that provoked it, on the vessel that
 * provoked it, at the epoch it provoked it under — never a pre-baked blob anyone may carry.
 *
 * ── NOTHING HERE TOUCHES DISK, AND THAT IS THE RULING ───────────────────────────────────────────
 * A raise is PRESENCE, not storage. It lives for as long as the process holding it lives, and a reboot
 * drops the vessel back to its floor with nothing to resume. That is what keeps `SEATED ⊥ RAISED` true at
 * rest: a stolen disk still yields nothing of anybody's person, because no raise was ever written to one.
 * A caller that persists a grant re-opens exactly the bearer-credential hole the nonce closes.
 *
 * ── RECOGNITION IS A PRESENTED ADMIT, READ BY THE VERIFIER ─────────────────────────────────────
 * This module holds no roster and folds no allow set. A grant CARRIES its recogniser's own admit for the
 * challenge's Nexus — the quorum-signed admit and its closed, tight lineage (`presentedAdmit`) — and signs
 * the challenge with that admit's LEAF. The leaf's signature over `raiseChallengeBytes` (vessel, Nexus,
 * lease epoch, single-use nonce) IS the leaf's proof over the raise nonce; no second domain rides beside it.
 *
 * The vessel supplies what it reads off its own replica for each Nexus it carries (`RaiseNexusReading`: the
 * roster at the held charter head, the carriage board read as a DENY board, the Kapae antigen). The grant
 * raises only when the admit roots on the challenge's Nexus — at its head epoch, or at an ancestor epoch its
 * lineage's roll anchors carry to the head (walked against the reading's `sealLineage`, every roll of which
 * the revealed keys signed) — `verifyPresentedAdmit`
 * reads it `held` there, that Nexus is the one the challenge names, the signer IS the admit's leaf, and the leaf's
 * signature verifies. A persona ROOT signing beside the same admit names a key the admit does not, and
 * refuses: the root never reaches a raise.
 *
 * A raise is a ①-VESSEL-layer act (waking-floor#the-raise-is-a-vessel-layer-act). The recogniser's caps
 * ride the recogniser's OWN key; nothing seats a persona root on the raised vessel, and
 * `personaSlotCeiling("herm") === 0` keeps that true whatever stands here.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/waking-floor
 */

import { RAISE_CHALLENGE_DOMAIN } from "./domains.js";
import { canonicalJsonBytes } from "./crypto.js";
import {
  verifyPresentedAdmit, type CarriageEntry, type PresentedAdmitState, type PresentedLineageAct,
} from "./carriage-registry.js";
import type { SealEpoch } from "./wax-stamp.js";
import { makeMultiSigQuorumVerifier, type KahuQuorumSeats, type KapaeAntigenEntry } from "./kapae-antigen.js";
import type { RaisedCaps } from "./vessel-standing.js";

/** Domain separation — a raise signature can never be replayed as any other act this house signs. */
const RAISE_DOMAIN = RAISE_CHALLENGE_DOMAIN;

/**
 * What a vessel EMITS to invite a raise. The nonce is the vessel's own; the epoch head names the fence the
 * resulting grant will bind to, so a challenge minted under one epoch cannot answer for another.
 */
export interface RaiseChallenge {
  /** Which vessel asks — its own verifying key. A grant for another vessel answers nothing here. */
  readonly vesselId: string;
  /** The AID of the Nexus whose admit counts for this raise (`realmIdOfCharter`, the charter's genesis epoch
   *  CID). A raise crosses no Nexus boundary: an admit for any other Nexus raises nothing here. */
  readonly nexus:    string;
  /** The lease epoch standing when the challenge was minted — the fence the grant binds to. */
  readonly epoch:    number;
  /** Fresh, single-use, chosen by the VERIFIER. Never reused; never guessable. */
  readonly nonce:    string;
}

/** The recogniser's own admit for the challenge's Nexus, as it would present it at the wire: the counted
 *  admit head for its leaf and that admit's closed, tight causal lineage, with the roll anchors that carry
 *  an admit at a rolled epoch to the head. Public bytes only. */
export interface RaisePresentedAdmit {
  readonly admit:   CarriageEntry;
  readonly lineage: readonly PresentedLineageAct[];
}

/** A recogniser's answer: their LEAF for the challenge's Nexus, over this exact challenge, with its admit. */
export interface RaiseGrant {
  readonly challenge:      RaiseChallenge;
  /** The recogniser's per-Nexus LEAF — MUST equal `presentedAdmit.admit.nym`. Caps ride this key. */
  readonly byNym:          string;
  /** ed25519 over `raiseChallengeBytes(challenge)`, by `byNym` — the leaf's proof over the raise nonce. */
  readonly sig:            string;
  /** The admit that makes `byNym` a recogniser. Absent → nothing presents, and the grant refuses. */
  readonly presentedAdmit: RaisePresentedAdmit;
}

/**
 * One Nexus the vessel carries for, read off its own replica: what a grant's admit is judged against.
 * Structurally the subset of the node's `CarriedNexusReading` the raise needs.
 */
export interface RaiseNexusReading {
  /** The Nexus's AID — what `RaiseChallenge.nexus` names. */
  readonly aid:           string;
  /** The Nexus's membership roster at the head of the charter the vessel holds for it. */
  readonly roster:        KahuQuorumSeats;
  /** The Nexus's carriage board, read as a DENY board (counted revokes only). */
  readonly denyBoard:     readonly CarriageEntry[];
  /** The Nexus's Kapae antigen entries. */
  readonly antigen:       readonly KapaeAntigenEntry[];
  /** The ANTIGEN quorum's roster, held apart from the membership roster. */
  readonly antigenRoster: KahuQuorumSeats;
  /** The charter's epoch lineage, genesis first — what an admit at a rolled epoch is walked against. A lineage
   *  whose rolls do not verify reads no ancestor. Absent → only an admit at the head reads held. */
  readonly sealLineage?:  readonly SealEpoch[];
}

/**
 * Why a grant did not stand. A reason, never a throw — untrusted input crosses this shore. The last four
 * are `verifyPresentedAdmit`'s own refusals, read against the challenge's Nexus.
 */
export type RaiseRefusal =
  | "wrong-vessel"      // the grant answers a challenge some other vessel emitted
  | "wrong-nexus"       // the challenge names a Nexus this vessel does not carry, or the admit roots on another carried Nexus
  | "stale-challenge"   // the epoch moved under it, or the nonce is not the live one
  | "bad-signature"     // the bytes do not verify under the named leaf
  | Exclude<PresentedAdmitState, "held">;  // unsettled · wrong-epoch · denied · rejected

/** A refused answer: the named refusal, and the local reason behind it (never a timestamp). */
export interface RaiseRefused {
  readonly ok:     false;
  readonly why:    RaiseRefusal;
  readonly detail: string;
}

/** The exact bytes a recogniser signs. Strict field set — nothing about the vessel's contents rides here. */
export function raiseChallengeBytes(c: RaiseChallenge): Uint8Array {
  return canonicalJsonBytes({
    kind: RAISE_DOMAIN, vesselId: c.vesselId, nexus: c.nexus, epoch: c.epoch, nonce: c.nonce,
  });
}

/**
 * Mint the challenge a vessel emits. The caller supplies the randomness, so this stays platform-blind and
 * a test may pin it; a live caller MUST pass cryptographically random bytes, since the nonce IS the
 * freshness. A guessable nonce hands back the bearer credential the design removed.
 */
export function mintRaiseChallenge(args: {
  vesselId: string; nexus: string; epoch: number; nonce: string;
}): RaiseChallenge {
  return { vesselId: args.vesselId, nexus: args.nexus, epoch: args.epoch, nonce: args.nonce };
}

function refused(why: RaiseRefusal, detail: string): RaiseRefused {
  return { ok: false, why, detail };
}

/**
 * Read a grant against the challenge this vessel actually emitted, and mint the caps it earns.
 *
 * Every check FAILS CLOSED and names its refusal, in this order:
 *   1. the challenge: a live one exists, names this vessel and this Nexus, and carries the live nonce and
 *      epoch (`stale-challenge`, `wrong-vessel`, `wrong-nexus`);
 *   2. the challenge's Nexus stands in `readings` (`wrong-nexus`);
 *   3. an admit rooted on ANOTHER carried Nexus's head epoch refuses `wrong-nexus`; an admit at any other
 *      epoch passes on to the verifier, which walks its roll anchors to the head or reads it `wrong-epoch`;
 *   4. `verifyPresentedAdmit` reads the admit against the challenge's Nexus: its roster head, its charter
 *      lineage (for an admit at an ancestor epoch), its deny board and its antigen. Anything but `held` refuses with the verifier's own state;
 *   5. the signer is the admit's leaf (`rejected`, detail `signer-is-not-the-admit-leaf`);
 *   6. the leaf's signature over `raiseChallengeBytes` verifies (`bad-signature`).
 * No check is skipped on the strength of another, because each closes a different door.
 *
 * `live` is the one the vessel holds RIGHT NOW. Passing a remembered challenge re-opens replay; the caller
 * MUST drop its live challenge after one answer, whichever way that answer went.
 */
export async function verifyRaiseGrant(args: {
  grant:    RaiseGrant;
  /** The challenge this vessel emitted and still holds. `null` → nothing was asked, so nothing answers. */
  live:     RaiseChallenge | null;
  /** The Nexuses this vessel carries for, read off its own replica as of its last sync. */
  readings: readonly RaiseNexusReading[];
  /** Verify `sig` over `bytes` by `nym`. Supplied so this module stays free of any one crypto binding. */
  verify:   (nym: string, bytes: Uint8Array, sig: string) => boolean | Promise<boolean>;
}): Promise<{ ok: true; caps: RaisedCaps } | RaiseRefused> {
  const { grant, live } = args;
  if (!live)                                      return refused("stale-challenge", "no-live-challenge");
  if (grant.challenge.vesselId !== live.vesselId) return refused("wrong-vessel", "challenge-for-another-vessel");
  if (grant.challenge.nexus    !== live.nexus)    return refused("wrong-nexus", "challenge-names-another-nexus");
  // Nonce AND epoch both, never either alone: the nonce closes replay, the epoch closes a grant minted
  // under a fence that has since rolled.
  if (grant.challenge.nonce !== live.nonce || grant.challenge.epoch !== live.epoch) {
    return refused("stale-challenge", "nonce-or-epoch-not-live");
  }

  const reading = args.readings.find((r) => r.aid === live.nexus && r.roster.sealEpochCid.length > 0);
  if (!reading) return refused("wrong-nexus", "challenge-nexus-not-carried");

  const presented = grant.presentedAdmit as RaisePresentedAdmit | undefined;
  const admit = presented?.admit;
  // An admit rooted on ANOTHER carried Nexus's head counts for that Nexus alone.
  const rootsOn = typeof admit?.sealEpochCid === "string"
    ? args.readings.find((r) => r.roster.sealEpochCid.length > 0 && r.roster.sealEpochCid === admit.sealEpochCid)
    : undefined;
  if (rootsOn && rootsOn.aid !== reading.aid) return refused("wrong-nexus", "admit-for-another-nexus");

  let verdict;
  try {
    verdict = await verifyPresentedAdmit({
      admit:           admit as CarriageEntry,
      lineage:         presented?.lineage as readonly PresentedLineageAct[],
      roster:          reading.roster,
      ...(reading.sealLineage ? { sealLineage: reading.sealLineage } : {}),
      denyBoard:       reading.denyBoard,
      antigen:         reading.antigen,
      antigenRoster:   reading.antigenRoster,
      antigenVerifier: makeMultiSigQuorumVerifier(),
    });
  } catch {
    return refused("rejected", "presented-admit-unreadable");
  }
  if (verdict.state !== "held") return refused(verdict.state, verdict.reason);

  const byNym = typeof grant.byNym === "string" ? grant.byNym.toLowerCase() : "";
  if (byNym.length === 0 || byNym !== verdict.nym) return refused("rejected", "signer-is-not-the-admit-leaf");
  if (!(await args.verify(byNym, raiseChallengeBytes(grant.challenge), grant.sig))) {
    return refused("bad-signature", "leaf-signature-does-not-verify");
  }
  // The caps bind to the epoch the CHALLENGE named, so the fence `raiseStands` reads is the one the
  // recogniser actually consented under — never whatever the epoch has become since.
  return { ok: true, caps: { byNym, nexus: live.nexus, boundEpoch: live.epoch } };
}

/** A recogniser's half — sign the challenge as handed, with its LEAF, and attach that leaf's admit. */
export async function signRaiseGrant(args: {
  challenge:      RaiseChallenge;
  /** The recogniser's per-Nexus leaf for `challenge.nexus` — the admit's nym. Never a persona root. */
  byNym:          string;
  presentedAdmit: RaisePresentedAdmit;
  /** The LEAF's signer. */
  sign:           (bytes: Uint8Array) => Promise<string> | string;
}): Promise<RaiseGrant> {
  return {
    challenge:      args.challenge,
    byNym:          args.byNym,
    sig:            await args.sign(raiseChallengeBytes(args.challenge)),
    presentedAdmit: { admit: args.presentedAdmit.admit, lineage: [...args.presentedAdmit.lineage] },
  };
}
