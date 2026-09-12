/**
 * handle-kel — the Handle's per-nym KEY-EVENT-LOG: a SIBLING grammar to the persona-KEL, never an
 * extension (identity-classes#the-handle-chain). It reuses the frozen persona-KEL's PRIMITIVES by
 * shape — hash-linked events, a content-addressed cid, a prefix derived over the inception, an ARMED
 * inception carrying a rolling recovery commitment — and mints its OWN kinds the persona grammar
 * lacks: a BURN (terminal — the Shadowtalk ending made structural), an ATTESTATION (a signed claim
 * carried ON the card, verified reader-locally, never an event and never a board), and a GRAFT (the
 * succession move — the presenting owner-set turns over).
 *
 * ★ THE k-of-n HANDLEGLAMOUR (operator, 2026-09-08) — A HANDLE IS A QUORUM-PRESENTED NAME, NOT A LONE KEY. ★ The
 * owner-binding generalizes from a single `ownerPrefix` to a PRESENTING OWNER-SET (persona-prefix
 * members + a graft threshold). A public Handle (the Dread Pirate Roberts) reads VALID against the
 * CURRENT set, and whether ONE or MORE humans hold the right to present it stays unknowable by design
 * — exactly as a cabal refuses "which member signed". ''1-of-1 is the degenerate case that IS the
 * personal face'' — the same shape all the way down, no special civic tier (`mintHandleInception`
 * keeps the single-owner path ergonomic as sugar over a one-member set). The field's own vocabulary
 * (Deseriis, "improper names"): a many-present name is a MULTIPLE-USE NAME (Luther Blissett — hundreds
 * shared one, then retired it), a chartered set is a COLLECTIVE PSEUDONYM (Wu Ming — a controlled
 * group); our 1-of-1-that-many-present and k-of-n-chartered are those two forms.
 *
 * THE OWNER-BINDING: a Handle's inception folds a DIGEST of its GENESIS owner-SET into the identifier's
 * own bytes (`sealKeySetHash(members, graftThreshold)`, the persona shape), so the founding quorum is
 * fixed in the name FOREVER (anti-swap: the name never moves) and the handle↔identity proof never
 * detaches. Alongside the fixed genesis wall each event carries a ROLLING `ownerSetHash` — the CURRENT
 * presenting-set digest — separate from the rolling recovery commitment; genesis seats one set in both
 * the prefix and the rolling slot.
 *
 * PRESENTATION (rotation · burn · attest) is authorized by ANY CURRENT MEMBER: an event names which
 * member presents (`ownerAuthMemberPrefix`) and that member's head op-key (`ownerAuthKeyDid`); verify
 * checks (a) the member stands in the CURRENT owner set and (b) the injected `OwnerHeadResolver`
 * confirms the key is that member's authoritative head. GRAFT (the membership move — succession)
 * reveals the NEW current owner set and carries authorization from the PRIOR set; for THIS build a
 * graft authorized by ONE current member suffices (DPR's real case — Roberts cedes to Westley by one
 * willing hand). TRUE k-of-n graft governance (a guild requiring a THRESHOLD to consent) rides
 * DECLARED, not built (a skipped red — `handle-kel.test.ts`).
 *
 * The module stays persona-KEL-DECOUPLED — the mint takes an injected authorizing key and the full
 * walk takes an injected `OwnerHeadResolver`; nothing here imports the persona grammar.
 *
 * PUBLIC BY DESIGN: a handle-KEL diffuses wherever the card announces — the persona-KEL's per-Nexus
 * board discipline does not govern it. Accordingly the module handles ONE chain per call and exposes
 * NO surface accepting a collection of others' handles (the registry filter,
 * lar:///ha.ka.ba/lares/api/pono/registry-filter).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/handle-kel
 */

import { HANDLE_KEL_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { sha256HexSync, canonicalJson, canonicalJsonBytes, hexToBytes } from "./crypto.js";
import { sealKeySetHash } from "./wax-stamp.js";

/** The domain the handle-KEL prefix + event bytes tag — separates a Handle's chain from every other hash. */
export { HANDLE_KEL_DOMAIN } from "./domains.js";

/** The handle-KEL's own kinds — a sibling grammar, absent from the persona-KEL. A GRAFT turns the
 *  presenting owner-set over (succession); a BURN ends the name. */
export type HandleKelKind = "inception" | "rotation" | "burn" | "graft";

/**
 * One event in a Handle's hash-linked key-event-log. Content-addressed by `eventCid`.
 *
 * INCEPTION (seq 0) seats the Handle's own signing key and REVEALS the genesis owner-set, self-certified
 * by the prefix derivation (like the persona inception, no signature rides it). A ROTATION seats a fresh
 * Handle key under a CURRENT member's authority — `ownerAuthMemberPrefix` + `ownerAuthKeyDid` name the
 * presenter and `authSig` carries that key's signature. A GRAFT reveals a NEW current owner-set under a
 * PRIOR member's authority (succession). A BURN terminates the chain — `authSig` carries the seated
 * Handle key's own signature (self-burn) OR a current member's (owner-burn); NOTHING verifies after it.
 *
 * The owner-set MEMBERS + THRESHOLD ride OUTSIDE the cid (the persona-KEL roster pattern): they are
 * REVEALED at inception and at every graft, verified against the bound digest (`genesisOwnerSetHash` at
 * inception, `ownerSetHash` at a graft), and stay EMPTY on presentation events (rotation · burn), which
 * change no set.
 */
/** One co-signer's consent to a MEMBER-AUTHORIZED THRESHOLD act — a distinct current member's head key
 *  signing the event bytes, beside the presenter's own `authSig`. Rides OUTSIDE the cid (the
 *  sig-outside-the-cid pattern), so a rotation, a graft, or an owner-burn gathers a WITNESS THRESHOLD of
 *  the current owner-set (the persona-KEL QuorumSignature shape): a shared name is seized (rotation),
 *  succeeded (graft), or buried (owner-burn) only by a quorum, never a lone hand. */
export interface HandleCoSig {
  readonly memberPrefix: string;   // a current owner-set member's persona prefix
  readonly keyDid:       string;   // that member's head op-key that signed
  readonly sig:          string;   // its signature over handleEventBytes(core), the SAME bytes the presenter signed
}

export interface HandleKelEvent {
  readonly seq:                 number;              // monotonic sequence; inception = 0
  readonly kind:                HandleKelKind;
  readonly eventCid:            string;              // content-address of THIS event (its own hash)
  readonly prefix:              string;              // the STABLE identifier — fixed across every rotation/graft
  readonly handleKeyDid:        string;              // "0x"+hex — the Handle's own key this event seats (head signs attestations)
  readonly genesisOwnerSetHash: string;              // the GENESIS owner-set digest — folded into the prefix, fixed for life (anti-swap)
  readonly ownerSetHash:        string;              // the ROLLING commitment — the CURRENT presenting-set digest; grafts advance it
  readonly ownerSetMembers:     readonly string[];   // the CURRENT owner set's persona prefixes — REVEALED at inception + graft; [] on presentation
  readonly ownerSetThreshold:   number;              // the graft threshold of the current set — REVEALED with the members; 0 on presentation
  readonly recoverySetHash:     string;              // the GENESIS recovery digest — folded into the prefix, fixed (anti-swap)
  readonly nextRecoverySetHash: string;              // the ROLLING recovery commitment — armed at inception like every prefix now is
  readonly nextHandleKeyDigest: string;              // the ROLLING next-HANDLE-KEY pre-commitment (KERI pre-rotation) — bound per-event, NOT in the prefix; "" = unarmed
  readonly prevEventCid:        string | null;       // hash-link to the predecessor (null at inception)
  readonly ownerAuthMemberPrefix: string | null;     // presentation/graft: WHICH member presents; null at inception
  readonly ownerAuthKeyDid:     string | null;       // presentation/graft: that member's head op-key; null at inception + self-burn
  readonly authSig:             string | null;       // rotation/graft: the member key's sig · burn: self-key OR member sig · null at inception (outside the cid)
  readonly coSigs?:             readonly HandleCoSig[];   // rotation/graft/owner-burn: co-signers BEYOND the presenter — the member-authorized act gathers ≥ current-threshold DISTINCT current-member sigs (outside the cid); absent on a lone-hand or self-burn event
}

/** The authority fields an event's content-address binds AND the authorizing signature signs over.
 *  The owner-set MEMBERS + THRESHOLD ride OUTSIDE (verified against the bound digest), and `authSig`
 *  rides OUTSIDE too (the sig-outside-the-cid pattern), so carrying an event never re-signs it. */
type HandleEventCore = Pick<
  HandleKelEvent,
  | "seq" | "kind" | "prefix" | "handleKeyDid" | "genesisOwnerSetHash" | "ownerSetHash"
  | "recoverySetHash" | "nextRecoverySetHash" | "nextHandleKeyDigest" | "prevEventCid" | "ownerAuthMemberPrefix" | "ownerAuthKeyDid"
>;

/**
 * The digest a chain pre-commits for its NEXT handle key (KERI pre-rotation). A rotation must REVEAL a
 * handleKeyDid hashing to the prior event's `nextHandleKeyDigest` — a thief of the current key lacks the
 * next preimage (it lives behind the seed), so a rotation they mint reveals a wrong key and REFUSES.
 * Domain-tagged apart from event + attestation bytes by its `kind`.
 */
export function handleKeyDigestOf(handleKeyDid: string): string {
  return `hkeynext-${sha256HexSync(canonicalJson({ domain: HANDLE_KEL_DOMAIN, kind: "next-handle-key", key: handleKeyDid }))}`;
}

/** The canonical bytes an event's cid commits AND the authorizing key signs over. Binding the seq +
 *  kind + prefix + the seated Handle key + the genesis-owner wall + the CURRENT owner digest + the
 *  recovery commits + the prev-link + the presenting member ties an authorization to the EXACT event
 *  context — a signature never replays onto another head, key, set-epoch, owner, or fork. */
export function handleEventBytes(core: HandleEventCore): Uint8Array {
  return canonicalJsonBytes({
    domain:                HANDLE_KEL_DOMAIN,
    seq:                   core.seq,
    kind:                  core.kind,
    prefix:                core.prefix,
    handleKeyDid:          core.handleKeyDid,
    genesisOwnerSetHash:   core.genesisOwnerSetHash,
    ownerSetHash:          core.ownerSetHash,
    recoverySetHash:       core.recoverySetHash,
    nextRecoverySetHash:   core.nextRecoverySetHash,
    nextHandleKeyDigest:   core.nextHandleKeyDigest,
    prevEventCid:          core.prevEventCid,
    ownerAuthMemberPrefix: core.ownerAuthMemberPrefix,
    ownerAuthKeyDid:       core.ownerAuthKeyDid,
  });
}

/** The content-address of a handle-KEL event — a hash BINDING its authority core; one bit-flip in a
 *  bound field yields a different cid, so the hash-link the successor carries is tamper-evident. */
export function handleEventCidOf(core: HandleEventCore): string {
  return `hkel${core.seq}-${sha256HexSync(canonicalJson({
    domain:                HANDLE_KEL_DOMAIN,
    seq:                   core.seq,
    kind:                  core.kind,
    prefix:                core.prefix,
    handleKeyDid:          core.handleKeyDid,
    genesisOwnerSetHash:   core.genesisOwnerSetHash,
    ownerSetHash:          core.ownerSetHash,
    recoverySetHash:       core.recoverySetHash,
    nextRecoverySetHash:   core.nextRecoverySetHash,
    nextHandleKeyDigest:   core.nextHandleKeyDigest,
    prevEventCid:          core.prevEventCid,
    ownerAuthMemberPrefix: core.ownerAuthMemberPrefix,
    ownerAuthKeyDid:       core.ownerAuthKeyDid,
  }))}`;
}

/**
 * THE OWNER-BINDING. The Handle identifier — a content-address over the inception Handle key + the
 * GENESIS owner-SET digest + the pre-committed recovery digest. It stays FIXED for the Handle's whole
 * life, so the handle↔identity proof never detaches: re-writing the revealed owner set no longer
 * derives the pinned prefix (the founding quorum is fixed in the name), and the SAME key under a
 * DIFFERENT genesis set mints a DIFFERENT identifier. `sealKeySetHash([ownerPrefix], 1)` for the
 * degenerate personal face is the same derivation, one member deep.
 */
export function handlePrefixOf(inceptionHandleKeyDid: string, genesisOwnerSetHash: string, recoverySetHash: string): string {
  return `handle-${sha256HexSync(canonicalJson({
    domain: HANDLE_KEL_DOMAIN,
    key:    inceptionHandleKeyDid,
    genesisOwnerSetHash,
    recoverySetHash,
  }))}`;
}

/**
 * Seat the INCEPTION over a GENESIS OWNER-SET (seq 0, no predecessor): the Handle's own key + its
 * founding owner quorum (members + graft threshold) + a rolling recovery pre-commitment. INCEPTS ARMED
 * — an empty `recoverySetHash`, an empty owner set, or a threshold out of `[1, members.length]` THROWS:
 * no Handle prefix ever incepts unarmed, unowned, or with an unsatisfiable graft rule. Self-certified by
 * the prefix derivation, like the persona inception. The genesis set fills BOTH the prefix wall
 * (`genesisOwnerSetHash`) and the rolling slot (`ownerSetHash`).
 */
export function mintHandleInceptionSet(
  handleKeyDid: string, ownerSetMembers: readonly string[], ownerSetThreshold: number, recoverySetHash: string,
  /** The KERI pre-rotation commitment — H(the next handle key). "" (default) incepts UNARMED for handle-key
   *  pre-rotation; a face founding path (mintPersonaGlamour) arms it from its own (seed, handleIndex). */
  nextHandleKeyDigest: string = "",
): HandleKelEvent {
  if (recoverySetHash.length === 0) {
    throw new Error("handle inception unarmed — an empty recovery pre-commitment mints no prefix");
  }
  if (ownerSetMembers.length === 0) {
    throw new Error("handle inception unowned — the owner-set binding is the identifier's whole proof");
  }
  if (ownerSetThreshold < 1 || ownerSetThreshold > ownerSetMembers.length) {
    throw new Error("handle inception — the graft threshold must sit within [1, members.length]");
  }
  const genesisOwnerSetHash = sealKeySetHash(ownerSetMembers, ownerSetThreshold);
  const prefix = handlePrefixOf(handleKeyDid, genesisOwnerSetHash, recoverySetHash);
  const core: HandleEventCore = {
    seq: 0, kind: "inception", prefix, handleKeyDid,
    genesisOwnerSetHash,
    ownerSetHash: genesisOwnerSetHash,       // the genesis set fills BOTH slots, the persona shape
    recoverySetHash, nextRecoverySetHash: recoverySetHash,
    nextHandleKeyDigest,
    prevEventCid: null, ownerAuthMemberPrefix: null, ownerAuthKeyDid: null,
  };
  return {
    ...core, ownerSetMembers, ownerSetThreshold,
    eventCid: handleEventCidOf(core), authSig: null,
  };
}

/**
 * The 1-of-1 CONVENIENCE — the degenerate case that IS the personal face. Sugar over
 * `mintHandleInceptionSet` for a single owning persona: the founding quorum is the one hand, the graft
 * threshold is 1. The common single-owner path stays ergonomic and unchanged in shape.
 */
export function mintHandleInception(
  handleKeyDid: string, ownerPrefix: string, recoverySetHash: string, nextHandleKeyDigest: string = "",
): HandleKelEvent {
  if (ownerPrefix.length === 0) {
    throw new Error("handle inception unowned — the owner-set binding is the identifier's whole proof");
  }
  return mintHandleInceptionSet(handleKeyDid, [ownerPrefix], 1, recoverySetHash, nextHandleKeyDigest);
}

/**
 * The exact bytes a CURRENT member's head op-key signs to authorize a rotation — bound to the next seq +
 * the stable prefix + the fresh Handle key + the genesis-owner wall + the current owner digest + the
 * recovery commits + the prev-link + the presenting member. `mintHandleRotation` recomputes the identical
 * bytes to verify.
 */
export function handleRotationSigningBytes(
  head: HandleKelEvent, freshHandleKeyDid: string,
  ownerAuthMemberPrefix: string, ownerHeadOpKeyDid: string,
  nextRecoverySetHash: string = head.nextRecoverySetHash,
  nextHandleKeyDigest: string = head.nextHandleKeyDigest,
): Uint8Array {
  return handleEventBytes({
    seq:                   head.seq + 1,
    kind:                  "rotation",
    prefix:                head.prefix,
    handleKeyDid:          freshHandleKeyDid,
    genesisOwnerSetHash:   head.genesisOwnerSetHash,   // the genesis wall, carried unchanged
    ownerSetHash:          head.ownerSetHash,          // the current presenting-set, unchanged by a rotation
    recoverySetHash:       head.recoverySetHash,       // the genesis recovery wall, carried unchanged
    nextRecoverySetHash,                               // the recovery graft rides INSIDE the signed bytes
    nextHandleKeyDigest,                               // the NEXT-key pre-commitment this rotation itself commits
    prevEventCid:          head.eventCid,
    ownerAuthMemberPrefix,
    ownerAuthKeyDid:       ownerHeadOpKeyDid,
  });
}

/** A mint attempt's outcome — the advanced event, or a fail-closed REFUSAL naming the mismatch. */
export type HandleMintResult =
  | { readonly ok: true;  readonly event: HandleKelEvent }
  | { readonly ok: false; readonly reason: string };

/** A co-signer a mint gathers toward the witness threshold — a distinct current member + its head key +
 *  its signer over the SAME event bytes the presenter signs. */
export interface HandleCoSigner {
  readonly memberPrefix: string;
  readonly keyDid:       string;
  readonly sign:         (bytes: Uint8Array) => Promise<string>;
}

/** Gather each co-signer's consent over the presenter's exact `bytes` — the presenter names the message,
 *  the quorum consents to it. Each signature verifies here against its claimed key (WHETHER each signer
 *  stands in the current set and REACHES the threshold is verify's structural question). Fails closed on
 *  the first co-signature that does not verify. */
async function gatherCoSigs(
  bytes: Uint8Array, coSigners: readonly HandleCoSigner[] | undefined,
): Promise<{ ok: true; coSigs: HandleCoSig[] } | { ok: false; reason: string }> {
  const coSigs: HandleCoSig[] = [];
  for (const c of coSigners ?? []) {
    const cSig = await c.sign(bytes);
    if (!(await verifySig(cSig, bytes, c.keyDid))) {
      return { ok: false, reason: `co-signature for ${c.memberPrefix.slice(0, 16)}… does not verify against its claimed key` };
    }
    coSigs.push({ memberPrefix: c.memberPrefix, keyDid: c.keyDid, sig: cSig });
  }
  return { ok: true, coSigs };
}

/** THE WITNESS-THRESHOLD COUNTER — count DISTINCT current-member authorizers of a member-authorized act
 *  (the presenter plus each co-signer that stands in the current set; a co-sig from a non-member never
 *  counts) and answer whether it REACHES `threshold`. The one structural gate a rotation, graft, and
 *  owner-burn share: a shared name is seized, succeeded, or buried only by a quorum. */
function reachesWitnessThreshold(
  presenterPrefix: string, coSigs: readonly HandleCoSig[] | undefined,
  curMembers: ReadonlySet<string>, threshold: number,
): boolean {
  const authorizers = new Set<string>([presenterPrefix.toLowerCase()]);
  for (const s of coSigs ?? []) {
    const m = s.memberPrefix.toLowerCase();
    if (curMembers.has(m)) authorizers.add(m);
  }
  return authorizers.size >= threshold;
}

/**
 * ROTATE: seat a fresh Handle key — the key that speaks AS the handle (its head signs attestations) —
 * under a CURRENT member's authority. A rotation is a WITNESS-THRESHOLD act: it gathers the presenter
 * plus `coSigners` (each a distinct current member signing the SAME rotation bytes) so that seizing a
 * shared name's signing key takes ≥ the current owner-set's threshold of distinct members — a single
 * turned member cannot rotate a k-of-n name's key and thereafter attest as the name. A 1-of-1 personal
 * face (threshold 1) rotates by one signature, unchanged. Each signature verifies here against its
 * claimed key (a signer whose bytes do not verify rotates nothing); WHETHER the signers stand in the
 * CURRENT set and REACH its threshold is `verifyHandleKel`'s structural question, and whether each key is
 * that member's authoritative head is the full walk's (`verifyHandleKelFull` + the resolver). FAILS
 * CLOSED on a burned head.
 */
export async function mintHandleRotation(input: {
  readonly head:                  HandleKelEvent;
  readonly freshHandleKeyDid:     string;                     // the Handle key this rotation seats
  readonly ownerAuthMemberPrefix: string;                     // WHICH current member presents (their persona AID)
  readonly ownerHeadOpKeyDid:     string;                     // that member's CURRENT head op-key (injected — no persona import)
  readonly sign:                  (bytes: Uint8Array) => Promise<string>;   // that member's head op-key signer
  /** DISTINCT current members BEYOND the presenter, gathered toward the current set's WITNESS THRESHOLD.
   *  A 2-of-2 shared name passes one co-signer here; a 1-of-1 personal face passes none. */
  readonly coSigners?:           readonly HandleCoSigner[];
  /** The NEXT recovery-set digest this rotation commits. Absent, the standing commitment carries
   *  forward: a set change is always an explicit act, never a silent drop. */
  readonly nextRecoverySetHash?: string;
  /** The NEXT handle-key digest this rotation commits (KERI pre-rotation). Absent, the standing commitment
   *  carries forward. When the HEAD armed a commitment, `freshHandleKeyDid` MUST reveal a key matching it. */
  readonly nextHandleKeyDigest?: string;
}): Promise<HandleMintResult> {
  const { head, freshHandleKeyDid, ownerAuthMemberPrefix, ownerHeadOpKeyDid } = input;
  if (head.kind === "burn") {
    return { ok: false, reason: "the Handle is burned — a burn is terminal; no successor, forever" };
  }
  // KERI pre-rotation: when the head armed a commitment, the fresh key MUST reveal the pre-committed preimage.
  // A thief of the current key seats a key the seed never pre-committed, so its digest misses and the mint refuses.
  if (head.nextHandleKeyDigest.length > 0 && handleKeyDigestOf(freshHandleKeyDid) !== head.nextHandleKeyDigest) {
    return { ok: false, reason: "rotation reveal does not match the prior next-handle-key pre-commitment — a dead key cannot rotate the name" };
  }
  const nextRecoverySetHash = input.nextRecoverySetHash ?? head.nextRecoverySetHash;
  const nextHandleKeyDigest = input.nextHandleKeyDigest ?? head.nextHandleKeyDigest;
  const core: HandleEventCore = {
    seq:                   head.seq + 1,
    kind:                  "rotation",
    prefix:                head.prefix,               // the identifier stays FIXED
    handleKeyDid:          freshHandleKeyDid,
    genesisOwnerSetHash:   head.genesisOwnerSetHash,  // ★ the genesis owner wall carries forward unchanged
    ownerSetHash:          head.ownerSetHash,         // a rotation changes no set
    recoverySetHash:       head.recoverySetHash,      // the genesis recovery wall
    nextRecoverySetHash,
    nextHandleKeyDigest,                              // this rotation's own next-key pre-commitment
    prevEventCid:          head.eventCid,
    ownerAuthMemberPrefix,
    ownerAuthKeyDid:       ownerHeadOpKeyDid,
  };
  const bytes = handleEventBytes(core);
  const sig   = await input.sign(bytes);
  if (!(await verifySig(sig, bytes, ownerHeadOpKeyDid))) {
    return { ok: false, reason: "rotation signature does not verify against the claimed member head op-key" };
  }
  // Gather the witness quorum's co-signatures over the SAME bytes — a shared name's key rotates only by a threshold.
  const gathered = await gatherCoSigs(bytes, input.coSigners);
  if (!gathered.ok) return { ok: false, reason: `rotation ${gathered.reason}` };
  return {
    ok: true,
    event: {
      ...core, ownerSetMembers: [], ownerSetThreshold: 0, eventCid: handleEventCidOf(core), authSig: sig,
      ...(gathered.coSigs.length > 0 ? { coSigs: gathered.coSigs } : {}),
    },
  };
}

/**
 * GRAFT: turn the presenting OWNER-SET over — succession. Reveals the NEW current owner set (members +
 * threshold, hashing to the new rolling `ownerSetHash`) and carries authorization from the PRIOR set.
 * SUCCESSION answers to the PRIOR set's THRESHOLD: k of the current n consent, gathered as the presenter
 * (`ownerAuthMemberPrefix` + `sign`) plus `coSigners` — each a distinct current member signing the SAME
 * graft bytes. A 1-of-1 (Roberts cedes to Westley) grafts by one willing hand; a k-of-n guild gathers k.
 * Each signature verifies here against its claimed key; WHETHER the signers stood in the PRIOR set and
 * REACH its threshold is `verifyHandleKel`'s question, and whether each key is that member's head is the
 * resolver's. FAILS CLOSED on a burned head. The Handle key carries forward unchanged — a graft seats no
 * fresh key.
 */
export async function mintHandleGraft(input: {
  readonly head:                  HandleKelEvent;
  readonly newOwnerSetMembers:    readonly string[];          // the NEW current owner set (revealed)
  readonly newOwnerSetThreshold:  number;                     // the NEW set's graft threshold
  readonly ownerAuthMemberPrefix: string;                     // a PRIOR-set member who presents the graft
  readonly ownerHeadOpKeyDid:     string;                     // that prior member's head op-key
  readonly sign:                  (bytes: Uint8Array) => Promise<string>;
  /** DISTINCT prior-set members BEYOND the presenter, gathered toward the prior set's threshold. A 2-of-2
   *  guild passes one co-signer here; a 1-of-1 passes none. */
  readonly coSigners?:            readonly HandleCoSigner[];
  readonly nextRecoverySetHash?:  string;
}): Promise<HandleMintResult> {
  const { head, newOwnerSetMembers, newOwnerSetThreshold, ownerAuthMemberPrefix, ownerHeadOpKeyDid } = input;
  if (head.kind === "burn") {
    return { ok: false, reason: "the Handle is burned — a burn is terminal; no successor, forever" };
  }
  if (newOwnerSetMembers.length === 0) {
    return { ok: false, reason: "a graft reveals a non-empty owner set — an empty presenting set is no name" };
  }
  if (newOwnerSetThreshold < 1 || newOwnerSetThreshold > newOwnerSetMembers.length) {
    return { ok: false, reason: "graft threshold out of range — it must sit within [1, members.length]" };
  }
  const newOwnerSetHash     = sealKeySetHash(newOwnerSetMembers, newOwnerSetThreshold);
  const nextRecoverySetHash = input.nextRecoverySetHash ?? head.nextRecoverySetHash;
  const core: HandleEventCore = {
    seq:                   head.seq + 1,
    kind:                  "graft",
    prefix:                head.prefix,               // the identifier stays FIXED — the name never moves
    handleKeyDid:          head.handleKeyDid,         // a graft seats no fresh Handle key
    genesisOwnerSetHash:   head.genesisOwnerSetHash,  // ★ the founding quorum stays fixed in the name forever
    ownerSetHash:          newOwnerSetHash,           // the NEW current presenting-set digest
    recoverySetHash:       head.recoverySetHash,
    nextRecoverySetHash,
    nextHandleKeyDigest:   head.nextHandleKeyDigest,  // a graft seats no fresh handle key — the commitment carries forward
    prevEventCid:          head.eventCid,
    ownerAuthMemberPrefix,
    ownerAuthKeyDid:       ownerHeadOpKeyDid,
  };
  const bytes = handleEventBytes(core);
  const sig   = await input.sign(bytes);
  if (!(await verifySig(sig, bytes, ownerHeadOpKeyDid))) {
    return { ok: false, reason: "graft signature does not verify against the claimed presenting member key" };
  }
  // Gather each co-signer over the SAME bytes — the presenter names the message, the quorum consents to it.
  const gathered = await gatherCoSigs(bytes, input.coSigners);
  if (!gathered.ok) return { ok: false, reason: `graft ${gathered.reason}` };
  return {
    ok: true,
    event: {
      ...core, ownerSetMembers: newOwnerSetMembers, ownerSetThreshold: newOwnerSetThreshold,
      eventCid: handleEventCidOf(core), authSig: sig,
      ...(gathered.coSigs.length > 0 ? { coSigs: gathered.coSigs } : {}),
    },
  };
}

/**
 * BURN: the TERMINAL event — the Shadowtalk ending made structural. EITHER HAND may strike it
 * (operator ruling, Option C, 2026-09-08): the SEATED Handle key closes its own name (a panic burn,
 * local, card-self-verifiable), OR the CURRENT OWNER-SET buries it from above (a burn a
 * thief-of-the-face cannot forge — the presenting quorum buries its own name). The core's
 * `ownerAuthMemberPrefix` records WHICH member presents the owner-burn (null on a self-burn).
 *
 * The OWNER-BURN is a WITNESS-THRESHOLD act: burying a SHARED name takes the presenter plus `coSigners`
 * (each a distinct current member) reaching ≥ the current owner-set's threshold, so a single turned
 * member cannot silence a k-of-n name. The SELF-BURN stays SINGLE-HAND — the seated key's own panic is a
 * different hand from the members and is not threshold-gated; a 1-of-1 personal face (threshold 1)
 * owner-burns by one signature, unchanged. After a burn `verifyHandleKel` REFUSES any successor forever,
 * `headHandleKey` seats nothing, and `attestUnderHead` throws. FAILS CLOSED on an already burned head.
 */
export async function mintHandleBurn(input: {
  readonly head: HandleKelEvent;
  /** THE SELF-BURN (Option C, path one): the seated Handle head key closes its own name — fast,
   *  local, card-self-verifiable, no owner lookup, single-hand. The panic burn a compromised face strikes now. */
  readonly sign?: (bytes: Uint8Array) => Promise<string>;
  /** THE OWNER-BURN (Option C, path two): a CURRENT member of the presenting set strikes the name from
   *  above, a burn a thief-of-the-face cannot forge. Names the member + its head key in the core;
   *  `verifyHandleKel` checks membership + the witness threshold and `verifyHandleKelFull` checks the heads. */
  readonly ownerBurn?: { readonly ownerAuthMemberPrefix: string; readonly ownerAuthKeyDid: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
  /** OWNER-BURN co-signers: DISTINCT current members BEYOND the presenter, gathered toward the current
   *  set's witness threshold. A shared name is buried only by its quorum. Meaningless on a self-burn (the
   *  seated key's single-hand panic) — passing them there refuses. */
  readonly coSigners?: readonly HandleCoSigner[];
}): Promise<HandleMintResult> {
  const { head } = input;
  if (head.kind === "burn") {
    return { ok: false, reason: "the Handle is already burned — a burn is terminal" };
  }
  if ((input.sign && input.ownerBurn) || (!input.sign && !input.ownerBurn)) {
    return { ok: false, reason: "a burn is struck by EXACTLY one hand — the seated key (`sign`) OR a current member (`ownerBurn`), never both, never neither" };
  }
  if (input.sign && input.coSigners && input.coSigners.length > 0) {
    return { ok: false, reason: "a self-burn is the seated key's single-hand panic — co-signers accompany an owner-burn, never a self-burn" };
  }
  const core: HandleEventCore = {
    seq:                   head.seq + 1,
    kind:                  "burn",
    prefix:                head.prefix,
    handleKeyDid:          head.handleKeyDid,      // a burn seats no fresh key, either hand
    genesisOwnerSetHash:   head.genesisOwnerSetHash,
    ownerSetHash:          head.ownerSetHash,      // a burn changes no set
    recoverySetHash:       head.recoverySetHash,
    nextRecoverySetHash:   head.nextRecoverySetHash,
    nextHandleKeyDigest:   head.nextHandleKeyDigest,   // a burn seats no fresh handle key — the commitment carries forward
    prevEventCid:          head.eventCid,
    ownerAuthMemberPrefix: input.ownerBurn ? input.ownerBurn.ownerAuthMemberPrefix : null,   // the record says WHICH hand
    ownerAuthKeyDid:       input.ownerBurn ? input.ownerBurn.ownerAuthKeyDid       : null,
  };
  const bytes  = handleEventBytes(core);
  const signer = input.ownerBurn ? input.ownerBurn.sign : input.sign!;
  const sig    = await signer(bytes);
  // An OWNER-burn gathers the witness quorum over the SAME bytes; a self-burn gathers nothing (single-hand).
  const gathered = await gatherCoSigs(bytes, input.ownerBurn ? input.coSigners : undefined);
  if (!gathered.ok) return { ok: false, reason: `owner-burn ${gathered.reason}` };
  return {
    ok: true,
    event: {
      ...core, ownerSetMembers: [], ownerSetThreshold: 0, eventCid: handleEventCidOf(core), authSig: sig,
      ...(gathered.coSigs.length > 0 ? { coSigs: gathered.coSigs } : {}),
    },
  };
}

/**
 * Verify the chain's STRUCTURAL integrity: monotonic sequence + hash-links + a STABLE prefix, STABLE
 * genesis-owner wall, and STABLE genesis recovery-commit across every event, each cid recomputing over
 * its bound core, and BURN TERMINALITY — any event following a burn REFUSES the whole chain. Inception
 * (seq 0) carries no predecessor, incepts ARMED, REVEALS a genesis owner set whose digest derives the
 * prefix (the owner-binding). The CURRENT presenting set is tracked forward: a rotation/burn must name a
 * member of the CURRENT set (structural membership) and carry the CURRENT `ownerSetHash`; a GRAFT reveals
 * a new set (its digest recomputing to the new `ownerSetHash`), authorized by a PRIOR-set member. PURE
 * and sync — it verifies no signatures NOR resolver heads (those ride `verifyHandleKelFull`). Mirrors
 * `verifyPersonaKel` by shape.
 */
export function verifyHandleKel(chain: readonly HandleKelEvent[]): boolean {
  if (chain.length === 0) return false;
  const g = chain[0]!;
  if (g.seq !== 0 || g.kind !== "inception" || g.prevEventCid !== null) return false;
  if (g.recoverySetHash.length === 0)                                    return false;   // armed, from birth
  if (g.ownerSetMembers.length === 0)                                    return false;   // owned, from birth
  if (g.ownerSetThreshold < 1 || g.ownerSetThreshold > g.ownerSetMembers.length) return false;
  if (g.genesisOwnerSetHash !== sealKeySetHash(g.ownerSetMembers, g.ownerSetThreshold)) return false;   // the reveal matches the genesis digest
  if (g.prefix !== handlePrefixOf(g.handleKeyDid, g.genesisOwnerSetHash, g.recoverySetHash))            return false;   // the owner-set is fixed in the name
  if (g.ownerSetHash !== g.genesisOwnerSetHash)               return false;   // inception seats ONE set in both slots
  if (g.nextRecoverySetHash !== g.recoverySetHash)            return false;   // and one recovery set in both slots
  if (g.ownerAuthMemberPrefix !== null || g.ownerAuthKeyDid !== null) return false;
  if (g.eventCid !== handleEventCidOf(g))                     return false;

  let curMembers = new Set(g.ownerSetMembers.map((m) => m.toLowerCase()));
  let curOwnerSetHash = g.genesisOwnerSetHash;
  let curThreshold = g.ownerSetThreshold;   // the PRIOR set's graft threshold, tracked forward across grafts

  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!, prev = chain[i - 1]!;
    if (prev.kind === "burn")                             return false;   // ★ a burn is terminal, forever
    if (e.kind === "inception")                           return false;   // one birth per name
    if (e.seq !== prev.seq + 1)                           return false;   // monotonic
    if (e.prevEventCid !== prev.eventCid)                 return false;   // hash-linked
    if (e.prefix !== prev.prefix)                         return false;   // the identifier stays fixed
    if (e.genesisOwnerSetHash !== prev.genesisOwnerSetHash) return false; // ★ the founding quorum never detaches
    if (e.recoverySetHash !== prev.recoverySetHash)       return false;   // the genesis recovery wall stays fixed

    if (e.kind === "rotation") {
      if (e.ownerAuthMemberPrefix === null || e.ownerAuthKeyDid === null || !e.authSig) return false;   // a member is named + signs
      if (e.ownerSetMembers.length !== 0 || e.ownerSetThreshold !== 0) return false;   // presentation reveals no set
      if (e.ownerSetHash !== curOwnerSetHash)             return false;   // bound to the current set-epoch
      if (!curMembers.has(e.ownerAuthMemberPrefix.toLowerCase())) return false;   // ★ a CURRENT member presents (non-member refuses)
      // ★ THE WITNESS THRESHOLD: seating a fresh signing key on a SHARED name is a quorum act — count
      // DISTINCT current members (presenter + co-signers) and refuse below the current threshold. A single
      // turned member cannot rotate a k-of-n name's key; a 1-of-1 (threshold 1) passes on the presenter alone.
      if (!reachesWitnessThreshold(e.ownerAuthMemberPrefix, e.coSigs, curMembers, curThreshold)) return false;
      // ★ KERI pre-rotation: an ARMED predecessor pins WHICH key rotates next — the reveal must match the
      // pre-commitment. A thief holding only the dead current key seats a key the seed never committed → refuse.
      if (prev.nextHandleKeyDigest.length > 0 && handleKeyDigestOf(e.handleKeyDid) !== prev.nextHandleKeyDigest) return false;
    } else if (e.kind === "graft") {
      if (e.ownerAuthMemberPrefix === null || e.ownerAuthKeyDid === null || !e.authSig) return false;
      if (e.handleKeyDid !== prev.handleKeyDid)           return false;   // a graft seats no fresh Handle key
      if (e.nextHandleKeyDigest !== prev.nextHandleKeyDigest) return false;   // no fresh key → the next-key commitment carries forward unchanged
      if (e.ownerSetMembers.length === 0)                 return false;   // reveals a NEW set
      if (e.ownerSetThreshold < 1 || e.ownerSetThreshold > e.ownerSetMembers.length) return false;
      if (e.ownerSetHash !== sealKeySetHash(e.ownerSetMembers, e.ownerSetThreshold))  return false;   // the reveal hashes to the new rolling digest
      if (!curMembers.has(e.ownerAuthMemberPrefix.toLowerCase())) return false;   // the presenter stood in the PRIOR set
      // ★ SUCCESSION reaches the PRIOR set's THRESHOLD — the same witness-threshold count a rotation and an
      // owner-burn use, here over the prior set: DISTINCT prior members (presenter + co-signers), non-members never count.
      if (!reachesWitnessThreshold(e.ownerAuthMemberPrefix, e.coSigs, curMembers, curThreshold)) return false;   // below the prior threshold — no succession
      curMembers = new Set(e.ownerSetMembers.map((m) => m.toLowerCase()));   // the presenting set turns over AFTER the threshold check
      curOwnerSetHash = e.ownerSetHash;
      curThreshold    = e.ownerSetThreshold;   // the new set carries its own threshold forward
    } else if (e.kind === "burn") {
      if (e.handleKeyDid !== prev.handleKeyDid)           return false;   // a burn seats no fresh key, either hand
      if (e.nextHandleKeyDigest !== prev.nextHandleKeyDigest) return false;   // no fresh key → the next-key commitment carries forward unchanged
      if (!e.authSig)                                     return false;   // a burn is always signed (self OR member)
      if (e.ownerSetMembers.length !== 0 || e.ownerSetThreshold !== 0) return false;
      if (e.ownerSetHash !== curOwnerSetHash)             return false;
      if (e.ownerAuthMemberPrefix !== null) {
        if (e.ownerAuthKeyDid === null)                   return false;   // owner-burn names a member key
        if (!curMembers.has(e.ownerAuthMemberPrefix.toLowerCase())) return false;   // ★ a CURRENT member buries it
        // ★ THE WITNESS THRESHOLD: burying a SHARED name from above is a quorum act — a single turned member
        // cannot silence a k-of-n name. A 1-of-1 (threshold 1) buries on the presenter alone, unchanged.
        if (!reachesWitnessThreshold(e.ownerAuthMemberPrefix, e.coSigs, curMembers, curThreshold)) return false;
      } else {
        if (e.ownerAuthKeyDid !== null)                   return false;   // self-burn names no member
        if (e.coSigs && e.coSigs.length > 0)              return false;   // ★ a self-burn is single-hand — no co-signers ride it
      }
    } else {
      return false;
    }
    if (e.eventCid !== handleEventCidOf(e))               return false;   // cid recomputes over the bound core
  }
  return true;
}

/**
 * The injected owner-head oracle — the ONE seam where the sibling grammar touches the persona plane,
 * kept as an interface so this module never imports the persona-KEL. Answers whether `authKeyDid`
 * stands as the persona `memberPersonaPrefix`'s AUTHORITATIVE head op-key under the CALLER's policy —
 * typically a walk of that member's local persona-KEL replica to its verified head
 * (`headOpKey(chain, {verifyQuorums:true})`), so a SUPERSEDED member key answers false. A verifier
 * holding the members' chain snapshots (carried beside the card) resolves reader-locally; one without
 * them needs the members' boards — the resolver names that dependency instead of hiding it.
 */
export type OwnerHeadResolver = (memberPersonaPrefix: string, authKeyDid: string) => Promise<boolean>;

/** Verify every co-signer's consent on a member-authorized threshold act: each signature verifies against
 *  its named key AND that key stands as the member's head per the resolver — the witness-threshold COUNT
 *  held structurally, here every gathered signature proves genuine and unsuperseded. Fails closed on the
 *  first break. */
async function verifyCoSigsFull(
  kind: HandleKelKind, seq: number, coSigs: readonly HandleCoSig[] | undefined,
  bytes: Uint8Array, ownerHeadResolver: OwnerHeadResolver,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  for (const s of coSigs ?? []) {
    if (!(await verifySig(s.sig, bytes, s.keyDid))) {
      return { ok: false, reason: `${kind} seq ${seq}: a co-signature does not verify against its named member key` };
    }
    if (!(await ownerHeadResolver(s.memberPrefix, s.keyDid))) {
      return { ok: false, reason: `${kind} seq ${seq}: a co-signer's key does not stand as that member's head (superseded or unrecognized)` };
    }
  }
  return { ok: true };
}

/**
 * Verify the chain structurally AND verify every signature + presentation authority — the full assurance
 * a reader needs before trusting the head Handle key. Each ROTATION and GRAFT `authSig` MUST verify over
 * the event bytes against its named `ownerAuthKeyDid`, and that key MUST stand as the named member's head
 * per the injected resolver — a presentation signed by a SUPERSEDED member key refuses HERE (the
 * settlement's rule: presentation authority walks the presenting member's persona-KEL head). Each gathered
 * co-signature (rotation · graft · owner-burn) verifies the same. Each OWNER-BURN checks the presenter +
 * its co-signers; each SELF-BURN `authSig` MUST verify against the seated Handle key (no resolver). FAILS
 * CLOSED on the first break.
 */
export async function verifyHandleKelFull(
  chain: readonly HandleKelEvent[],
  ownerHeadResolver: OwnerHeadResolver,
): Promise<{ ok: boolean; reason?: string }> {
  if (!verifyHandleKel(chain)) {
    return { ok: false, reason: "structural integrity failed (sequence / hash-link / prefix / owner-binding / membership / burn-terminality / cid)" };
  }
  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!;
    const core: HandleEventCore = {
      seq: e.seq, kind: e.kind, prefix: e.prefix, handleKeyDid: e.handleKeyDid,
      genesisOwnerSetHash: e.genesisOwnerSetHash, ownerSetHash: e.ownerSetHash,
      recoverySetHash: e.recoverySetHash, nextRecoverySetHash: e.nextRecoverySetHash, nextHandleKeyDigest: e.nextHandleKeyDigest,
      prevEventCid: e.prevEventCid, ownerAuthMemberPrefix: e.ownerAuthMemberPrefix, ownerAuthKeyDid: e.ownerAuthKeyDid,
    };
    if (e.kind === "rotation" || e.kind === "graft") {
      if (!e.authSig || e.ownerAuthMemberPrefix === null || e.ownerAuthKeyDid === null) {
        return { ok: false, reason: `${e.kind} seq ${e.seq}: unsigned or unnamed presenter` };
      }
      if (!(await verifySig(e.authSig, handleEventBytes(core), e.ownerAuthKeyDid))) {
        return { ok: false, reason: `${e.kind} seq ${e.seq}: signature does not verify against its named member key` };
      }
      if (!(await ownerHeadResolver(e.ownerAuthMemberPrefix, e.ownerAuthKeyDid))) {
        return { ok: false, reason: `${e.kind} seq ${e.seq}: its member key does not stand as that member's head (superseded or unrecognized)` };
      }
      // Each gathered co-signer (a rotation's or a graft's witness quorum) proves genuine + unsuperseded.
      const co = await verifyCoSigsFull(e.kind, e.seq, e.coSigs, handleEventBytes(core), ownerHeadResolver);
      if (!co.ok) return co;
    } else if (e.kind === "burn") {
      if (!e.authSig) return { ok: false, reason: `burn seq ${e.seq}: unsigned` };
      if (e.ownerAuthMemberPrefix === null) {
        // SELF-BURN — the seated Handle head key closed its own name; no owner lookup.
        if (!(await verifySig(e.authSig, handleEventBytes(core), e.handleKeyDid))) {
          return { ok: false, reason: `burn seq ${e.seq}: self-burn signature does not verify against the seated Handle key` };
        }
      } else {
        // OWNER-BURN — a current member buries the name; its key must sign AND stand as that member's head.
        if (e.ownerAuthKeyDid === null) return { ok: false, reason: `burn seq ${e.seq}: owner-burn names no member key` };
        if (!(await verifySig(e.authSig, handleEventBytes(core), e.ownerAuthKeyDid))) {
          return { ok: false, reason: `burn seq ${e.seq}: owner-burn signature does not verify against its named member key` };
        }
        if (!(await ownerHeadResolver(e.ownerAuthMemberPrefix, e.ownerAuthKeyDid))) {
          return { ok: false, reason: `burn seq ${e.seq}: its member key does not stand as that member's head (a superseded key cannot bury the name)` };
        }
        // The owner-burn's witness quorum — burying a shared name gathers ≥ threshold genuine, unsuperseded members.
        const co = await verifyCoSigsFull(e.kind, e.seq, e.coSigs, handleEventBytes(core), ownerHeadResolver);
        if (!co.ok) return co;
      }
    }
  }
  return { ok: true };
}

/** Whether the chain ends in a BURN — a buried name. Reads the tail; pair with `verifyHandleKel`. */
export function isBurned(chain: readonly HandleKelEvent[]): boolean {
  return chain.length > 0 && chain[chain.length - 1]!.kind === "burn";
}

/**
 * The authoritative Handle key — the LATEST head's `handleKeyDid`, IFF the chain verifies structurally
 * AND does not end burned. A buried name seats NO key (null), and a broken chain seats none either (a
 * reader MUST NOT trust a head off a broken lineage).
 */
export function headHandleKey(chain: readonly HandleKelEvent[]): string | null {
  if (!verifyHandleKel(chain)) return null;
  if (isBurned(chain))         return null;
  return chain[chain.length - 1]!.handleKeyDid;
}

/**
 * The CURRENT presenting owner-set — the members + threshold + digest standing at the chain's head,
 * IFF the chain verifies structurally. The genesis set unless a graft turned it over; a later graft
 * wins. NULL on a broken chain. A reader tests "may this persona present as this Handle" against the
 * returned members; the degenerate 1-of-1 returns its single member.
 */
export function currentOwnerSet(
  chain: readonly HandleKelEvent[],
): { readonly members: readonly string[]; readonly threshold: number; readonly hash: string } | null {
  if (!verifyHandleKel(chain)) return null;
  const g = chain[0]!;
  let members = g.ownerSetMembers, threshold = g.ownerSetThreshold, hash = g.genesisOwnerSetHash;
  for (const e of chain) {
    if (e.kind === "graft") { members = e.ownerSetMembers; threshold = e.ownerSetThreshold; hash = e.ownerSetHash; }
  }
  return { members, threshold, hash };
}

// ── ATTESTATION — a signed statement, never an event kind ───────────────────────────────────────
// A claim must not bloat the lineage or need a board: it travels ON the card and verifies
// reader-locally against the head key. Binding the head's cid ties the claim to a chain STATE —
// a rotation, graft, or burn stales it, and the fresh head re-attests to renew.

/** A claim signed under the Handle's head — "this Handle controls example.net" — carried on the card. */
export interface HandleAttestation {
  readonly prefix:       string;   // the Handle the claim speaks for
  readonly headEventCid: string;   // the chain state the claim was made under — a moved head stales it
  readonly claim:        string;   // the claim text, verified against the claimed surface by the reader
  readonly sig:          string;   // the head Handle key's signature over the attestation bytes
}

/** The canonical bytes an attestation signs — domain-tagged apart from event bytes by the `kind`. */
export function handleAttestationBytes(prefix: string, headEventCid: string, claim: string): Uint8Array {
  return canonicalJsonBytes({ domain: HANDLE_KEL_DOMAIN, kind: "attestation", prefix, headEventCid, claim });
}

/**
 * ATTEST under the chain's head: sign a claim with the seated head Handle key. THROWS on a broken chain
 * and on a burned one — nothing attests under a buried name. The returned statement is self-describing
 * carriage for the card; `verifyAttestation` is its reader-local other half.
 */
export async function attestUnderHead(
  chain: readonly HandleKelEvent[],
  claim: string,
  sign: (bytes: Uint8Array) => Promise<string>,   // the head Handle key's signer
): Promise<HandleAttestation> {
  if (!verifyHandleKel(chain)) throw new Error("attestation refused — the chain fails structural verification");
  if (isBurned(chain))         throw new Error("attestation refused — the Handle is burned; a buried name claims nothing");
  const head = chain[chain.length - 1]!;
  const sig  = await sign(handleAttestationBytes(head.prefix, head.eventCid, claim));
  return { prefix: head.prefix, headEventCid: head.eventCid, claim, sig };
}

/**
 * Verify an attestation READER-LOCALLY against the chain it claims under: the chain verifies
 * structurally, stands unburned, matches the statement's prefix, its HEAD is the very event the
 * statement bound, and the signature verifies against that head's Handle key. A rotation, graft, or burn
 * since the attestation REFUSES (stale — the fresh head re-attests); no board is consulted.
 */
export async function verifyAttestation(
  chain: readonly HandleKelEvent[],
  statement: HandleAttestation,
): Promise<{ ok: boolean; reason?: string }> {
  if (!verifyHandleKel(chain)) return { ok: false, reason: "the chain fails structural verification" };
  if (isBurned(chain))         return { ok: false, reason: "the Handle is burned — a buried name claims nothing" };
  const head = chain[chain.length - 1]!;
  if (statement.prefix !== head.prefix)             return { ok: false, reason: "the statement names a different Handle" };
  if (statement.headEventCid !== head.eventCid)     return { ok: false, reason: "stale — the head moved since this attestation; the fresh head re-attests" };
  const bytes = handleAttestationBytes(statement.prefix, statement.headEventCid, statement.claim);
  if (!(await verifySig(statement.sig, bytes, head.handleKeyDid))) {
    return { ok: false, reason: "the signature does not verify against the head Handle key" };
  }
  return { ok: true };
}

/** Verify one ed25519 signature against a "0x"-prefixed (or bare) hex key — malformed input counts as no signature. */
async function verifySig(sigHex: string, bytes: Uint8Array, keyDid: string): Promise<boolean> {
  try {
    return await ed25519.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(keyDid.replace(/^0x/, "")));
  } catch {
    return false;
  }
}
