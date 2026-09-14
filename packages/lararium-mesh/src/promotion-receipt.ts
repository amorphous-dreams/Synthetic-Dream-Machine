/**
 * promotion-receipt — THE AUDIT HALF OF THE PRIESTHOOD ACT.
 *
 * `lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary` names the declared blocker
 * plainly: a promotion into a canon bag is PERMITTED by capability and RECORDED by nothing. Every
 * residency verb demands `cap("admin", destBag)`, so the line holds — but //a cap gate is a decision at a
 * moment; a receipt is a record you can walk backwards//, and without one a promotion leaves no artifact
 * to audit or revoke against.
 *
 * THIS IS CONTENT-LEVEL PROVENANCE, NOT AN AUTHORITY RECORD. A capability delegation already answers //who
 * may write canon//. What was missing is //what was promoted, by whom, from where// — proposer, approver,
 * source, destination, content hash — signed, with the approver's hold on the destination checked AT THE
 * MOMENT OF SIGNING.
 *
 * ── THE SIGNED REGION AND THE ATTACHED REGION ───────────────────────────────────────────────────
 * The boundary demands this discipline by name, and the split is the module's whole shape:
 *
 *   · WHAT THE SIGNER ASSERTS rides INSIDE the signature — the six fields above, plus the domain and the
 *     signer's own asserted clock reading. Moving any of them invalidates the receipt.
 *   · WHAT THE WORLD CAN CHECK FOR ITSELF — chains, memberships, freshness — rides ATTACHED and UNSIGNED.
 *     A reader re-derives it whenever they like.
 *
 * //Signing evidence causes freshness coupling and pins staleness//: fold a membership proof into the
 * signed bytes and refreshing that proof wakes a cold key, so the record rots exactly as fast as its
 * weakest attached fact. Here it rots not at all, and the attached region moves freely.
 *
 * ── THE FOUR REFUSALS, AND WHY EACH IS THE BOUNDARY'S OWN PROSE ─────────────────────────────────
 *   · NO ADMIN CAP on the destination — the cap gate's own answer, recorded rather than assumed.
 *   · AN UNGOVERNED SUBJECT — the boundary crosses a thing with a LIFECYCLE; a carrier declaring none
 *     names no state to cross from.
 *   · A SUBJECT WITH NO ADDRESS — a receipt records WHAT crossed, and an unaddressed thing names nothing.
 *   · A MOVE THAT MOVES NOTHING — same bag either side, or a bag missing. Residency IS the crossing here,
 *     so an unmoved envelope leaves nothing to record.
 *
 * And the SESSION wall, which is a refusal of a different kind: //nothing may travel from SESSION to
 * CANON: an unrecorded gesture has no content hash to sign and no source to name, so the receipt could not
 * be written even in principle//. A subject carrying no content hash is refused rather than hashed here —
 * a thing is RECORDED before it is promoted, always in that order.
 *
 * THE MODULE HOLDS NO KEY AND READS NO CAP. The signer arrives injected and the admin reading arrives
 * injected, so a receipt can be minted, and refused, in a witness with no vessel anywhere.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/canon-boundary
 */

import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes } from "./crypto.js";
import { PROMOTION_RECEIPT_DOMAIN } from "./domains.js";

export { PROMOTION_RECEIPT_DOMAIN } from "./domains.js";

/** THE SIGNED REGION — what the approver asserts, and nothing a reader could check for themselves. */
export interface PromotionAssertion {
  /** The domain tag, inside the bytes — a receipt never verifies as any other signed thing. */
  readonly domain:       string;
  /** WHAT crossed: the subject's own declared address, identical either side of the crossing. A residency
   *  move changes the envelope's bag and nothing else, so this address names the same thing before and
   *  after and a reader who holds either copy resolves the same edge. */
  readonly subjectUri:   string;
  /** The subject's canonical hash AT CROSSING (`ni:///sha-256;…`). An address is stable and its bytes are
   *  versioned; this pins WHICH bytes crossed, which is the claim git alone cannot make. */
  readonly carrierHash:  string;
  /** The bag the record left. */
  readonly fromBag:      string;
  /** The canon bag crossed into. */
  readonly toBag:        string;
  /** Who proposed the crossing. */
  readonly proposerNym:  string;
  /** Who approved it — the hand that held `cap("admin", destBag)` when this was signed. */
  readonly approverNym:  string;
  /** The approver's signing key at crossing. A reader resolves the chain ATTACHED; the key is asserted. */
  readonly approverKeyDid: string;
  /** The approver's OWN clock reading. Asserted, never proven — no global now (`#/causal-islands`). */
  readonly crossedAt:    string;
}

/** THE WHOLE RECEIPT — the signed region, its signature, and the attached region that moves freely. */
export interface PromotionReceipt {
  readonly assertion: PromotionAssertion;
  /** The approver's signature over `promotionAssertionBytes(assertion)`, hex. Outside the assertion. */
  readonly sig:       string;
  /** THE ATTACHED REGION — unsigned, refreshable, and never part of what the receipt claims. */
  readonly attached:  Readonly<Record<string, unknown>>;
}

/** The subject a promotion crosses — read for its declared lifecycle alone. */
export interface PromotionSubject {
  readonly tags?: readonly string[];
}

/** A subject the boundary knows how to cross declares a LIFECYCLE. A carrier declaring none names no
 *  state to cross from, so the crossing has no meaning to record. */
export function declaresLifecycle(subject: PromotionSubject): boolean {
  return (subject.tags ?? []).some((t) => t.startsWith("lifecycle/"));
}

/** The canonical bytes the approver signs. The assertion WHOLE — no field of it rides outside. */
export function promotionAssertionBytes(assertion: PromotionAssertion): Uint8Array {
  return canonicalJsonBytes({
    domain:         assertion.domain,
    subjectUri:     assertion.subjectUri,
    carrierHash:    assertion.carrierHash,
    fromBag:        assertion.fromBag,
    toBag:          assertion.toBag,
    proposerNym:    assertion.proposerNym,
    approverNym:    assertion.approverNym,
    approverKeyDid: assertion.approverKeyDid,
    crossedAt:      assertion.crossedAt,
  });
}

/**
 * Mint a promotion receipt, or REFUSE with the reason the boundary's own prose gives.
 *
 * The refusals run BEFORE the signature: a receipt that records a crossing the boundary forbids would be
 * worse than none, since it reads as an audit trail while certifying the thing it was built to catch.
 */
export async function mintPromotionReceipt(input: {
  readonly subjectUri:     string;
  readonly carrierHash:    string;
  readonly fromBag:        string;
  readonly toBag:          string;
  readonly proposerNym:    string;
  readonly approverNym:    string;
  readonly approverKeyDid: string;
  readonly subject:        PromotionSubject;
  /** The cap reading, injected — the module opens no keyring and resolves no delegation. */
  readonly holdsAdmin:     (nym: string, bag: string) => boolean | Promise<boolean>;
  readonly sign:           (bytes: Uint8Array) => Promise<string>;
  /** The approver's own clock. Injected so a witness reads a fixed one. */
  readonly now?:           () => string;
  /** The attached region to carry — unsigned, and the mint never reads it. */
  readonly attached?:      Readonly<Record<string, unknown>>;
}): Promise<{ ok: true; receipt: PromotionReceipt } | { ok: false; reason: string }> {
  if (!input.carrierHash) {
    return { ok: false, reason: "a promotion carries the subject's content hash at crossing — an unrecorded gesture has none, and SESSION never crosses to CANON in one step" };
  }
  if (!input.subjectUri) {
    return { ok: false, reason: "a promotion records WHAT crossed — a subject declaring no address names nothing to record a crossing of" };
  }
  if (!input.fromBag || !input.toBag || input.fromBag === input.toBag) {
    return { ok: false, reason: `a promotion moves residency — ${input.fromBag || "(no bag)"} -> ${input.toBag || "(no bag)"} moves nothing, and a move that moves nothing records nothing` };
  }
  if (!declaresLifecycle(input.subject)) {
    return { ok: false, reason: "the subject declares no lifecycle/standing — an ungoverned carrier names no state to cross from, and the crossing has nothing to record" };
  }
  if (!(await input.holdsAdmin(input.approverNym, input.toBag))) {
    return { ok: false, reason: `the approver holds no cap("admin", ${input.toBag}) — promotion-down is the kahu-cabal's act` };
  }
  const assertion: PromotionAssertion = {
    domain:         PROMOTION_RECEIPT_DOMAIN,
    subjectUri:     input.subjectUri,
    carrierHash:    input.carrierHash,
    fromBag:        input.fromBag,
    toBag:          input.toBag,
    proposerNym:    input.proposerNym,
    approverNym:    input.approverNym,
    approverKeyDid: input.approverKeyDid,
    crossedAt:      (input.now ?? ((): string => new Date().toISOString()))(),
  };
  const sig = await input.sign(promotionAssertionBytes(assertion));
  return { ok: true, receipt: { assertion, sig, attached: input.attached ?? {} } };
}

/**
 * Verify a receipt against its OWN asserted key. Answers one question — //did this hand assert exactly
 * these bytes// — and deliberately not //may that hand promote//, which is a reading of the boards as they
 * stand today rather than a property of the record. The attached region is never read here.
 */
export async function verifyPromotionReceipt(receipt: PromotionReceipt): Promise<boolean> {
  if (receipt.assertion.domain !== PROMOTION_RECEIPT_DOMAIN) return false;
  try {
    return await ed25519.verifyAsync(
      hexToBytes(receipt.sig),
      promotionAssertionBytes(receipt.assertion),
      hexToBytes(receipt.assertion.approverKeyDid),
    );
  } catch { return false; }
}

/** Where a receipt rests: BESIDE the promoted carrier, sharing its name. A reader that holds the carrier
 *  holds the record of how it arrived, with no index to consult and none to fall out of step. */
export function promotionReceiptPath(carrierFilePath: string): string {
  return `${carrierFilePath.replace(/\.mem$/, "")}.promotion.json`;
}
