/**
 * persona-admit-flow — the node orchestration of the airgapped 3-hop persona-admission, composing the ceremony
 * library (@lararium/mesh persona-admit) + the per-vessel multitude-view store + the QR transport.
 *
 * Each hop is a SEPARATE, offline invocation (a QR crosses the airgap between them), so the on-device secret
 * persists in the consume-once pending store between hops. These flow functions carry the WHOLE per-hop logic —
 * mint/seal/open/ack + the store reads/writes + the QR render — behind injected dependencies (signers, the KEL
 * head resolver, a store dir), so the `lares persona admit` CLI thin-wraps them and the flow stays testable with
 * two simulated vessels and no real vault / camera.
 *
 * INVARIANTS held here: per-vessel-multitude-view-NEVER-syncs (every write lands in the local store, never a
 * bag); no-global-now (§2a gate-removal v3 — no step compares a wall clock to anything; the carried `expiry`
 * field itself retired, and liveness lives in consumption, withdrawal, and the held session's own monotonic
 * patience); type-blind (a PersonaRef is
 * prefix + key-material, no branch); wax-seals-only (the grant is the persona's own signature). The B side keeps
 * its ephemeral SECRET on-device (the store, sealed under the vessel key) and drops it once the admission it
 * enabled stands recorded. THE ADMISSION COMMITS A HOP on both sides: the pending entry drops after the record,
 * an offer binds to the first grant that verifies against it and completes no other, and a drop that fails never
 * costs the caller the acknowledgment the record already owes.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-admit-flow
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  mintEnrollmentOffer, sealPersonaGrant, openPersonaGrant, mintJoinAck, verifyJoinAck,
  headOpKey, personaKelChainForPrefix, personaKelBoardDocUrl, materializeSharedLarDoc, type PersonaKelEvent,
  type PersonaRef, type AdmitSigner, type JoinRecord, type EnrollmentOffer, type SealedGrant, type JoinAck,
} from "@lararium/mesh";
import {
  toEnrollmentCarriage, parseEnrollmentCarriage, toGrantCarriage, parseGrantCarriage,
  toAckCarriage, parseAckCarriage,
} from "./persona-admit-carriage.js";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import {
  recordAdmittedPersona, stashEnrollmentSecret, peekEnrollmentSecrets, takeEnrollmentSecret,
  peekSentMemo, stashSentMemo, takeSentMemo, withdrawAdmitOffer, withdrawAdmitGrant, bindEnrollmentToGrant,
} from "./node-persona-admit-store.js";
import { qrCarriageToTerminalResilient } from "./qr-transport.js";

/** A flow result carrying the hop's carriage + a terminal QR of it (a tabletop hand-off). */
export interface HopRender {
  readonly carriage:   string;
  /** The scannable terminal QR (empty when oversized — the carriage still travels as a paste / PNG). */
  readonly terminalQr: string;
  /** The ECC the QR fit at (H for small hops; degraded only if forced), or null when oversized. */
  readonly qrEcc:      "H" | "Q" | "M" | "L" | null;
  /** True when the carriage exceeds a single static QR even at ECC-L — the reserved bc-ur multi-part leg's cue. */
  readonly qrOversized: boolean;
}

async function render(carriage: string): Promise<HopRender> {
  const r = await qrCarriageToTerminalResilient(carriage);
  return { carriage, terminalQr: r.qr, qrEcc: r.ecc, qrOversized: r.oversized };
}

/**
 * ONE materialize of THIS vessel's LOCAL persona-KEL board replica — the shared root both head resolvers below
 * read, so the board door (`personaKelBoardDocUrl`) is addressed from exactly ONE call site in this file
 * regardless of how many resolver SHAPES are built off it (op-key, KEL seq, …). `repo` names the store's one
 * holder — the standing vessel's own Repo, or the direct holder's (`ownedStore`).
 */
async function localPersonaKelBoard(repo: Repo) {
  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  return materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
}

/**
 * One face's key event log as THIS vessel's local persona-KEL board holds it, inception first; empty where the
 * board holds no event under `prefix`. A face's backup bundle carries this log, and a restore reads it beside the
 * log a bundle carried (custody#/the-bundle). Reads the board; verifies nothing.
 */
export async function readLocalPersonaKelChain(repo: Repo, prefix: string): Promise<PersonaKelEvent[]> {
  const board = await localPersonaKelBoard(repo);
  return [...(personaKelChainForPrefix(board.doc(), prefix) ?? [])];
}

/**
 * Build the ruling-#3 head resolver off THIS vessel's LOCAL persona-KEL board replica: a prefix → its CURRENT
 * head op-key (verifying the KEL's structure + rotation quorums), or null when the prefix is unknown / unsynced
 * (fail-closed). The open step checks the grant's op-key IS this head (rotate-not-resurrect); a same-Nexus
 * target already carries the granter's persona-KEL (it federates once), a cross-Nexus one that lacks it draws
 * the fail-closed refusal.
 */
export async function makeLocalPersonaKelHeadResolver(repo: Repo): Promise<(prefix: string) => Promise<string | null>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<string | null> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return null;
    return headOpKey(chain, { verifyQuorums: true });
  };
}

/**
 * M12's sibling resolver — the SAME local persona-KEL board replica, read for the head event's KEL SEQUENCE
 * NUMBER rather than its op-key. ADVISORY ONLY end to end (see `openPersonaGrant`'s `resolveHeadSeq` /
 * `JoinRecord.granterSeq`): feeds `recordAdmittedPersona`'s causal supersede order, never a verdict. Finds the
 * head by the SAME walk `headOpKey` does (skip provisional, newest-first) and reads that event's own `seq` —
 * so the seq named here is always the seq of the SAME key `makeLocalPersonaKelHeadResolver` would have named.
 */
export async function makeLocalPersonaKelHeadSeqResolver(repo: Repo): Promise<(prefix: string) => Promise<number | null>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<number | null> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return null;
    const head = await headOpKey(chain, { verifyQuorums: true });
    if (!head) return null;
    for (let i = chain.length - 1; i >= 0; i--) {
      const e = chain[i]!;
      if (e.provisional) continue;
      if (e.opKeyDid === head) return e.seq;
    }
    return null;
  };
}

/**
 * L11 — the SAME head + seq read as `makeLocalPersonaKelHeadResolver` / `makeLocalPersonaKelHeadSeqResolver`
 * above, but off ONE board materialize instead of two. A caller that wants both (as `store-door-verbs.ts`'s
 * `persona-kel-head` door does) previously called both builders, each materializing the board independently
 * — a comment there claimed "the SAME board read" while the code made two, so a sync landing between them
 * could let head and seq straddle it. This builds the board once and derives both from that single chain
 * walk, so they can never disagree about which board state they read.
 */
export async function makeLocalPersonaKelHeadAndSeqResolver(
  repo: Repo,
): Promise<(prefix: string) => Promise<{ head: string | null; seq: number | null }>> {
  const board = await localPersonaKelBoard(repo);
  return async (prefix: string): Promise<{ head: string | null; seq: number | null }> => {
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    if (!chain || chain.length === 0) return { head: null, seq: null };
    const head = await headOpKey(chain, { verifyQuorums: true });
    if (!head) return { head: null, seq: null };
    for (let i = chain.length - 1; i >= 0; i--) {
      const e = chain[i]!;
      if (e.provisional) continue;
      if (e.opKeyDid === head) return { head, seq: e.seq };
    }
    return { head, seq: null };
  };
}

/**
 * HOP 1 (B): mint an enrollment offer for this vessel's device key, STASH the on-device ephemeral secret
 * (consume-once), and render QR#1. The secret never leaves the store; only the offer travels.
 */
export async function offerAdmitFlow(args: {
  readonly deviceVerifyingKey: string;
  /** The pending-offer set's count bound (§2a) — omit to take the store's own named default. */
  readonly maxPendingOffers?:  number;
}): Promise<{ offer: EnrollmentOffer } & HopRender> {
  const { offer, secret } = mintEnrollmentOffer({ targetVesselId: args.deviceVerifyingKey });
  if (args.maxPendingOffers !== undefined) await stashEnrollmentSecret(offer.ephemeralPubkey, secret, args.maxPendingOffers);
  else await stashEnrollmentSecret(offer.ephemeralPubkey, secret);
  return { offer, ...(await render(toEnrollmentCarriage(offer))) };
}

/**
 * WITHDRAW a pending offer this vessel minted (§2a) — the operator's own causal act when their own patience
 * for a hand-off ends (never a clock comparison inside the store). Pass `"all"` to drop every pending offer.
 */
export function withdrawOfferFlow(target: string | "all"): Promise<number> {
  return withdrawAdmitOffer(target);
}

/** WITHDRAW a sent grant memo this vessel minted (§2a) — the granter's own causal act; a late ACK against the
 *  withdrawn nonce_A then refuses by name, exactly as a consumed one already does. */
export function withdrawGrantFlow(nonceA: string): Promise<boolean> {
  return withdrawAdmitGrant(nonceA);
}

/**
 * HOP 2 (A): read B's offer carriage, seal a persona→vessel grant signed by the persona-prefix op-key, STASH
 * the sent memo (to verify B's ACK later), and render QR#2. Refuses a torn offer carriage (fail-closed) —
 * never on a wall clock (§2a gate-removal v3; the carried `expiry` field itself retired).
 */
export async function grantAdmitFlow(args: {
  readonly offerCarriage: string;
  readonly personaRef:    PersonaRef;
  readonly personaSigner: AdmitSigner;
}): Promise<({ sealed: SealedGrant } & HopRender) | { error: string }> {
  const offer = parseEnrollmentCarriage(args.offerCarriage);
  if (!offer) return { error: "not a valid enrollment offer carriage — the QR did not arrive" };
  let sealed: SealedGrant;
  let sent;
  try {
    ({ sealed, sent } = await sealPersonaGrant({ offer, personaRef: args.personaRef, personaSigner: args.personaSigner }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  await stashSentMemo(sent);
  return { sealed, ...(await render(toGrantCarriage(sealed))) };
}

/**
 * HOP 3 (B): read A's sealed grant, try to open it against EACH pending enrollment (B cannot know which offer a
 * grant answers until one decrypts), verify against the persona PREFIX head, consume the matching secret, RECORD
 * the join into THIS vessel's multitude-view, mint + render the ACK (QR#3). Fail-closed at every shore.
 */
export async function openAdmitFlow(args: {
  readonly grantCarriage:    string;
  readonly resolveHeadOpKey: (prefix: string) => Promise<string | null> | string | null;
  readonly deviceSigner:     AdmitSigner;
  /** OPTIONAL (M12) — resolve the SAME prefix's head KEL seq; rides into `JoinRecord.granterSeq` as an ADVISORY
   *  ordering hint for `recordAdmittedPersona`'s causal supersede. `makeLocalPersonaKelHeadSeqResolver` builds one
   *  off the same board `resolveHeadOpKey` reads. Omit it and the view falls back to its nonce-only tiebreak. */
  readonly resolveHeadSeq?: (prefix: string) => Promise<number | null> | number | null;
  /**
   * M8 — restrict the match search to THIS held session's own offer (its ephemeral pubkey). Omitted → try
   * every pending offer (the original behavior; `lares persona admit open` keeps using it, since it holds
   * no single "own" offer context). A HELD offer's post-paste open must scope to itself: without this, a
   * grant answering a DIFFERENT pending offer Y could be consumed inside offer X's held session, leaving Y
   * believing it still stands pending while its secret has already been taken.
   */
  readonly onlyEphemeral?: string;
}): Promise<({ joinRecord: JoinRecord; pendingStands?: true } & HopRender) | { error: string }> {
  const sealed = parseGrantCarriage(args.grantCarriage);
  if (!sealed) return { error: "not a valid sealed-grant carriage — the QR did not arrive" };

  const allPending = await peekEnrollmentSecrets();
  const pending = args.onlyEphemeral
    ? allPending.filter((p) => p.ephemeralPubkey === args.onlyEphemeral)
    : allPending;
  if (pending.length === 0) {
    return {
      error: args.onlyEphemeral
        ? "this session's own offer is no longer pending (withdrawn or already opened)"
        : "no pending enrollment on this vessel — run `persona admit offer` first",
    };
  }

  // L10 — `lastReason` used to report whichever offer was tried LAST, which is usually the least
  // informative "decrypt-failed" (every offer that simply isn't the matching one fails to decrypt). Prefer
  // the first NON-decrypt reason any candidate drew (a real cause: a torn head, a replayed nonce) — that is
  // the informative refusal a human can act on; a decrypt-only set of misses falls back to naming that.
  let lastReason = "no pending enrollment matched this grant";
  let informativeReason: string | null = null;
  for (const { ephemeralPubkey, secret } of pending) {
    const verdict = await openPersonaGrant({
      sealed, secret, resolveHeadOpKey: args.resolveHeadOpKey,
      ...(args.resolveHeadSeq ? { resolveHeadSeq: args.resolveHeadSeq } : {}),
    });
    if (!verdict.ok) {
      lastReason = verdict.reason;
      if (informativeReason === null && !verdict.reason.startsWith("decrypt-failed")) informativeReason = verdict.reason;
      continue;
    }
    // ONE OFFER, ONE GRANT. The first grant that verifies against an enrollment BINDS it, before anything gets
    // signed (`bindEnrollmentToGrant`, one custody hold). The same grant opens again to the same steps; any other
    // grant sealed to that offer refuses for as long as the enrollment stands, so no second grant rides an offer
    // whose first open died midway, and two commands at once never complete two grants for one offer.
    const bound = await bindEnrollmentToGrant(ephemeralPubkey, verdict.accepted.transcript.nonceA);
    if (bound === "absent") { lastReason = "no pending enrollment matched this grant"; continue; }
    if (bound === "bound-other") {
      return { error: "this offer stands bound to another grant — open that grant again, or withdraw the offer and mint a fresh one" };
    }
    // THE ADMISSION COMMITS THE HOP. The acknowledgment gets signed, the join gets recorded,
    // and only then does the enrollment drop. An open that dies before the record leaves the enrollment pending;
    // one that dies between the record and the drop leaves both, and the same grant opens again to the same
    // acknowledgment (every step before the drop repeats to the same bytes). No order of deaths drops an
    // enrollment that left no admission and no acknowledgment to carry back.
    const { ack, joinRecord } = await mintJoinAck({ accepted: verdict.accepted, secret, deviceSigner: args.deviceSigner });
    await recordAdmittedPersona(joinRecord);
    // The record committed, so the acknowledgment travels whatever the drop does: a drop that fails leaves the
    // enrollment standing (`pendingStands`), where it completes this same grant again and no other.
    let pendingStands = false;
    try { await takeEnrollmentSecret(ephemeralPubkey); } catch { pendingStands = true; }
    return {
      joinRecord,
      ...(pendingStands ? { pendingStands: true as const } : {}),
      ...(await render(toAckCarriage(ack))),
    };
  }
  return { error: informativeReason ?? lastReason };
}

/**
 * HOP 3-close (A): read B's ACK, look up the sent memo by nonce_A, verify the ACK against it + B's device key,
 * and RECORD the matching join into A's OWN multitude-view. Both vessels now hold the mutually-signed record.
 */
export async function acceptAdmitFlow(args: {
  readonly ackCarriage: string;
}): Promise<{ joinRecord: JoinRecord; pendingStands?: true } | { error: string }> {
  const ack: JoinAck | null = parseAckCarriage(args.ackCarriage);
  if (!ack) return { error: "not a valid ACK carriage — the QR did not arrive" };
  // The memo stays standing while the ACK gets verified, so an ACK that fails verification costs the pending grant
  // nothing. THE ADMISSION COMMITS THE HOP: the join gets recorded, and only then does the memo drop. An accept
  // that dies between the two leaves both, and the same ACK accepts again.
  const memo = await peekSentMemo(ack.joinRecord.nonceA);
  if (!memo) return { error: "no sent grant matches this ACK's nonce — the grant was never issued from this vessel (or already accepted)" };
  const verdict = await verifyJoinAck({ ack, sent: memo });
  if (!verdict.ok) return { error: verdict.reason };
  await recordAdmittedPersona(verdict.joinRecord);
  // The record committed: a drop that fails leaves the memo standing, where the same ACK accepts again to the
  // same record. Two accepts of one ACK at once both record that one join, and the second drop finds nothing.
  let pendingStands = false;
  try { await takeSentMemo(ack.joinRecord.nonceA); } catch { pendingStands = true; }
  return { joinRecord: verdict.joinRecord, ...(pendingStands ? { pendingStands: true as const } : {}) };
}
