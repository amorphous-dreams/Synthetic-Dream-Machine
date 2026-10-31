/**
 * custodian-card — the shared "Recovery-card" 2-of-3 primitive: ONE card shape, ONE handshake, MANY uses.
 *
 * Two keels split a secret 2-of-3 across the same three custodian slots and hand the operator printable
 * cards to place BY HAND (web3-pure — no cloud/email/API coupling): the CHARTER RESERVE splits the
 * pre-rotation's reserve seed (seal-reserve), and PERSONAL IDENTITY RECOVERY splits the PersonaGroup
 * root (recovery-keel-core). This module holds the piece they share — the card layout, the confirmation
 * handshake, and the split/reconstruct bridge — so BOTH issue the IDENTICAL card:
 *
 *   · "Recovery-card mine"        → custodian "device"       (the operator's copy, vessel-sealed at rest)
 *   · "Recovery-card custodian-A"  → custodian "custodian"     (a custodian holds it, off-device)
 *   · "Recovery-card custodian-B"  → custodian "escrow-peer"  (a second custodian holds it, off-device)
 *
 * The three custodian tags stay DISTINCT so EVERY two-card subset — including {custodian-A, custodian-B} —
 * forms a ≥2-distinct-custodian quorum (recovery-share's impersonation-quorum wall): the two custodians
 * rebuild WITHOUT the operator, and an operator-full-compromise reveals exactly ONE share → nothing. The
 * custodians who hold a citizen's reserve cards hold the SAME card shape that helps recover their identity —
 * one pattern integrity, two uses (isomorphism by composition).
 *
 * WHAT THE CARD RECONSTRUCTS stays the caller's concern, NOT this module's: the reserve rebuilds a reserve
 * seed, identity recovery rebuilds a root the caller uses transiently to sign a re-admit edge then zeroizes
 * (recovery-keel-core). This primitive shares the CARD + HANDSHAKE + 2-of-3 split; it makes NO claim about
 * what the rebuilt secret authorizes.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/custodian-card
 */

import {
  splitToShares, encodeShareBytes, decodeShareBytes,
  type RecoveryShare, type CustodianTag,
} from "./recovery-share.js";
import { CUSTODIAN_CONFIRM_DOMAIN } from "./domains.js";
import { sha256HexSync } from "./crypto.js";
import type { RandomProvider } from "./crypto.js";

/** Any two DISTINCT custodians reconstruct — the impersonation-quorum floor the two keels both ride. */
export const CUSTODIAN_CARD_THRESHOLD = 2;

/** Which custodian holds a card. The three slots map to DISTINCT recovery-share custodian tags below. */
export type CustodianCardSlot = "mine" | "custodian-a" | "custodian-b";

/**
 * Slot → recovery-share custodian tag. The tags stay DISTINCT so EVERY two-card subset — including
 * {custodian-a, custodian-b} — forms a ≥2-distinct-custodian quorum (recovery-share's impersonation-quorum
 * wall). That is the compromise-resistance both keels vow: the custodians recover WITHOUT "mine".
 */
export const CUSTODIAN_SLOT_TAG: Record<CustodianCardSlot, CustodianTag> = {
  "mine":       "device",
  "custodian-a": "custodian",
  "custodian-b": "escrow-peer",
};

/** A printable recovery card the operator places by hand (web3-pure — no cloud/email/API coupling here). */
export interface CustodianCard {
  readonly slot:          CustodianCardSlot;
  /** The human label ("Recovery-card mine" / "Recovery-card custodian-A (name)"). */
  readonly label:         string;
  /** The recovery-share custodian tag this card carries (the type-wall identity, not the human label). */
  readonly custodian:     CustodianTag;
  /** The transcribable share code — checksummed hex (encodeShareBytes), decode-guarded against a slip. */
  readonly shareCode:     string;
  /** A short out-of-band confirmation phrase — distinct per card, the receipt + recovery handshake. */
  readonly confirmPhrase: string;
}

/** A split's output: the three cards + the raw "mine" share the vessel seals at rest. */
export interface CustodianCardSplit {
  readonly cards:     CustodianCard[];
  /** The "mine" share (custodian "device") — the ONLY share the vessel persists, sealed. */
  readonly mineShare: RecoveryShare;
}

function custodianCardLabel(slot: CustodianCardSlot, custodianA: string | null, custodianB: string | null): string {
  switch (slot) {
    case "mine":       return "Recovery-card mine";
    case "custodian-a": return `Recovery-card custodian-A (${custodianA ?? "unassigned"})`;
    case "custodian-b": return `Recovery-card custodian-B (${custodianB ?? "unassigned"})`;
  }
}

/**
 * Split a secret 2-of-3 across the three custodian slots and render one card per slot. The "mine" share
 * seals to the vessel (the caller's node adapter does the sealing); the two custodian cards leave the device
 * entirely. Each card carries a checksummed, decode-guarded share code + a distinct confirmation phrase.
 * The secret itself is never returned in a card — only its shares.
 */
export function splitToCustodianCards(
  secret:        Uint8Array,
  custodianA:     string | null,
  custodianB:     string | null,
  recoveryEpoch: number,
  rng:           RandomProvider,
  confirmDomain: string = CUSTODIAN_CONFIRM_DOMAIN,
): CustodianCardSplit {
  const slots: CustodianCardSlot[] = ["mine", "custodian-a", "custodian-b"];
  const custodians = slots.map((s) => CUSTODIAN_SLOT_TAG[s]);
  const shares = splitToShares(secret, CUSTODIAN_CARD_THRESHOLD, custodians, recoveryEpoch, rng);
  const cards: CustodianCard[] = slots.map((slot, i) => {
    const shareCode = encodeShareBytes(shares[i]!.bytes);
    return {
      slot,
      label:         custodianCardLabel(slot, custodianA, custodianB),
      custodian:     shares[i]!.custodian,
      shareCode,
      confirmPhrase: confirmationPhrase(shareCode, confirmDomain),
    };
  });
  return { cards, mineShare: shares[0]! };
}

/**
 * Reconstruct a RecoveryShare from a card's printed code — checksum-guarded (decodeShareBytes THROWS on a
 * transcription slip BEFORE a doomed reconstruct). A recovery ceremony feeds two of these to
 * `assembleQuorum` / `reconstructFromQuorum` (recovery-share) to rebuild the secret. FAILS CLOSED: a
 * tampered code, or fewer than two distinct-custodian shares, never reconstructs.
 */
export function custodianShareFromCard(card: CustodianCard, recoveryEpoch: number): RecoveryShare {
  return { bytes: decodeShareBytes(card.shareCode), custodian: card.custodian, recoveryEpoch };
}

// ── The confirmation phrase — a short human-verifiable cross-check, distinct per card ─────────────────
// Derived from a domain-separated hash of the card's share code. A card's own holder already holds the
// share, so the phrase reveals nothing new to them; it lets the operator confirm out-of-band ("does your
// card read heron-amber-tide?") that a custodian holds the RIGHT card before a recovery ceremony trusts it.
// A tiny self-contained 64-word list keeps this pure-TS (no BIP39/wordlist dependency). ONE domain binds
// BOTH keels — the reserve and identity recovery speak the SAME handshake (different secrets already yield
// different share codes → different phrases; the shared domain keeps the receipt one shape).

/** The default domain both keels share — one handshake across the reserve card and the identity card. */
export { CUSTODIAN_CONFIRM_DOMAIN } from "./domains.js";
const CONFIRM_WORDS: readonly string[] = [
  "amber", "anchor", "arbor", "ash", "aster", "birch", "brass", "brook",
  "cedar", "cinder", "clay", "cliff", "cove", "crane", "crest", "dawn",
  "delta", "dune", "ember", "fern", "flint", "frost", "gale", "glade",
  "grove", "harbor", "hazel", "heron", "ivy", "kelp", "lark", "loam",
  "maple", "marsh", "mesa", "mist", "moss", "oak", "onyx", "opal",
  "pearl", "pine", "quartz", "reed", "ridge", "river", "sable", "sage",
  "sand", "shale", "shore", "slate", "spruce", "tide", "topaz", "vale",
  "vine", "wave", "willow", "wind", "wren", "yarrow", "zephyr", "zinc",
];

/**
 * A 3-word confirmation phrase over 18 bits (three 6-bit picks) of the share code's digest — distinct per
 * card because each share differs. Deterministic: the same (code, domain) always reads the same phrase, so
 * the operator and a custodian confirm a match over the phone.
 */
export function confirmationPhrase(shareCode: string, domain: string = CUSTODIAN_CONFIRM_DOMAIN): string {
  const digest = sha256HexSync(`${domain}|${shareCode}`);
  const n = Number.parseInt(digest.slice(0, 8), 16) >>> 0;
  const word = (shift: number): string => CONFIRM_WORDS[(n >>> shift) & 0x3f]!;
  return `${word(0)}-${word(6)}-${word(12)}`;
}
