/**
 * handle-kel — the Handle's per-nym KEY-EVENT-LOG: a SIBLING grammar to the persona-KEL, never an
 * extension (identity-classes#the-handle-chain). It reuses the frozen persona-KEL's PRIMITIVES by
 * shape — hash-linked events, a content-addressed cid, a prefix derived over the inception, an ARMED
 * inception carrying a rolling recovery commitment — and mints its OWN kinds the persona grammar
 * lacks: a BURN (terminal — the Shadowtalk ending made structural) and an ATTESTATION (a signed
 * claim carried ON the card, verified reader-locally, never an event and never a board).
 *
 * THE OWNER-BINDING: a Handle's inception folds its owning PERSONA-prefix into the identifier's own
 * bytes, so the Handle's prefix IS the bidirectional handle↔identity proof — no re-parenting, no
 * detachment, and the proof survives every rotation because the prefix does. Rotation authority
 * walks the OWNER's persona-KEL head: the rotation signature verifies against the owner's current
 * op-key. The module stays persona-KEL-DECOUPLED — the mint takes an injected `ownerHeadOpKeyDid`
 * and the full walk takes an injected `OwnerHeadResolver`; nothing here imports the persona grammar.
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

/** The domain the handle-KEL prefix + event bytes tag — separates a Handle's chain from every other hash. */
export { HANDLE_KEL_DOMAIN } from "./domains.js";

/** The handle-KEL's own kinds — a sibling grammar, absent from the persona-KEL. */
export type HandleKelKind = "inception" | "rotation" | "burn";

/**
 * One event in a Handle's hash-linked key-event-log. Content-addressed by `eventCid`.
 *
 * INCEPTION (seq 0) seats the Handle's own signing key, self-certified by the prefix derivation
 * (like the persona inception, no signature rides it). A ROTATION seats a fresh Handle key under
 * the OWNER's authority — `ownerAuthKeyDid` names the owner op-key that authorized and `authSig`
 * carries that key's signature over the event bytes. A BURN terminates the chain — `authSig`
 * carries the seated Handle key's own signature; NOTHING verifies after it, forever.
 */
export interface HandleKelEvent {
  readonly seq:                 number;              // monotonic sequence; inception = 0
  readonly kind:                HandleKelKind;
  readonly eventCid:            string;              // content-address of THIS event (its own hash)
  readonly prefix:              string;              // the STABLE identifier — fixed across every rotation
  readonly handleKeyDid:        string;              // "0x"+hex — the Handle's own key this event seats (head signs attestations)
  readonly ownerPrefix:         string;              // the owning persona's AID — folded into the prefix at inception, stable for life
  readonly recoverySetHash:     string;              // the GENESIS recovery digest — folded into the prefix, fixed (anti-swap)
  readonly nextRecoverySetHash: string;              // the ROLLING commitment — armed at inception like every prefix now is
  readonly prevEventCid:        string | null;       // hash-link to the predecessor (null at inception)
  readonly ownerAuthKeyDid:     string | null;       // rotation only: the owner head op-key that authorized; null elsewhere
  readonly authSig:             string | null;       // rotation: the owner key's sig · burn: the seated Handle key's sig · null at inception (outside the cid)
}

/** The authority fields an event's content-address binds AND the authorizing signature signs over.
 *  `authSig` rides OUTSIDE (the sig-outside-the-cid pattern), so carrying an event never re-signs it. */
type HandleEventCore = Pick<
  HandleKelEvent,
  "seq" | "kind" | "prefix" | "handleKeyDid" | "ownerPrefix" | "recoverySetHash" | "nextRecoverySetHash" | "prevEventCid" | "ownerAuthKeyDid"
>;

/** The canonical bytes an event's cid commits AND the authorizing key signs over. Binding the seq +
 *  kind + prefix + the seated Handle key + the OWNER prefix + the recovery commits + the prev-link
 *  ties an authorization to the EXACT event context — a signature never replays onto another head,
 *  key, owner, or fork. */
export function handleEventBytes(core: HandleEventCore): Uint8Array {
  return canonicalJsonBytes({
    domain:              HANDLE_KEL_DOMAIN,
    seq:                 core.seq,
    kind:                core.kind,
    prefix:              core.prefix,
    handleKeyDid:        core.handleKeyDid,
    ownerPrefix:         core.ownerPrefix,
    recoverySetHash:     core.recoverySetHash,
    nextRecoverySetHash: core.nextRecoverySetHash,
    prevEventCid:        core.prevEventCid,
    ownerAuthKeyDid:     core.ownerAuthKeyDid,
  });
}

/** The content-address of a handle-KEL event — a hash BINDING its authority core; one bit-flip in a
 *  bound field yields a different cid, so the hash-link the successor carries is tamper-evident. */
export function handleEventCidOf(core: HandleEventCore): string {
  return `hkel${core.seq}-${sha256HexSync(canonicalJson({
    domain:              HANDLE_KEL_DOMAIN,
    seq:                 core.seq,
    kind:                core.kind,
    prefix:              core.prefix,
    handleKeyDid:        core.handleKeyDid,
    ownerPrefix:         core.ownerPrefix,
    recoverySetHash:     core.recoverySetHash,
    nextRecoverySetHash: core.nextRecoverySetHash,
    prevEventCid:        core.prevEventCid,
    ownerAuthKeyDid:     core.ownerAuthKeyDid,
  }))}`;
}

/**
 * THE OWNER-BINDING. The Handle identifier — a content-address over the inception Handle key + the
 * owning PERSONA prefix + the pre-committed recovery digest. It stays FIXED for the Handle's whole
 * life, so the handle↔identity proof never detaches: re-writing the carried `ownerPrefix` no longer
 * derives the pinned prefix, and the SAME key under a DIFFERENT owner mints a DIFFERENT identifier.
 */
export function handlePrefixOf(inceptionHandleKeyDid: string, ownerPrefix: string, recoverySetHash: string): string {
  return `handle-${sha256HexSync(canonicalJson({
    domain: HANDLE_KEL_DOMAIN,
    key:    inceptionHandleKeyDid,
    ownerPrefix,
    recoverySetHash,
  }))}`;
}

/**
 * Seat the INCEPTION (seq 0, no predecessor): the Handle's own key + its owning persona's prefix +
 * a rolling recovery pre-commitment. INCEPTS ARMED — an empty `recoverySetHash` or an empty
 * `ownerPrefix` THROWS: no Handle prefix ever incepts unarmed or unowned (the settlement's rule that
 * every prefix now carries a rolling commitment from birth, and a Handle's whole point rides its
 * owner-binding). Self-certified by the prefix derivation, like the persona inception.
 */
export function mintHandleInception(handleKeyDid: string, ownerPrefix: string, recoverySetHash: string): HandleKelEvent {
  if (recoverySetHash.length === 0) {
    throw new Error("handle inception unarmed — an empty recovery pre-commitment mints no prefix");
  }
  if (ownerPrefix.length === 0) {
    throw new Error("handle inception unowned — the owner-binding is the identifier's whole proof");
  }
  const prefix = handlePrefixOf(handleKeyDid, ownerPrefix, recoverySetHash);
  const core: HandleEventCore = {
    seq: 0, kind: "inception", prefix, handleKeyDid, ownerPrefix,
    recoverySetHash, nextRecoverySetHash: recoverySetHash,   // the genesis set fills BOTH slots, the persona shape
    prevEventCid: null, ownerAuthKeyDid: null,
  };
  return { ...core, eventCid: handleEventCidOf(core), authSig: null };
}

/**
 * The exact bytes the OWNER's head op-key signs to authorize a rotation — bound to the next seq +
 * the stable prefix + the fresh Handle key + the recovery commits + the prev-link + the authorizing
 * owner key itself. `mintHandleRotation` recomputes the identical bytes to verify.
 */
export function handleRotationSigningBytes(
  head: HandleKelEvent, freshHandleKeyDid: string, ownerHeadOpKeyDid: string,
  nextRecoverySetHash: string = head.nextRecoverySetHash,
): Uint8Array {
  return handleEventBytes({
    seq:                 head.seq + 1,
    kind:                "rotation",
    prefix:              head.prefix,
    handleKeyDid:        freshHandleKeyDid,
    ownerPrefix:         head.ownerPrefix,
    recoverySetHash:     head.recoverySetHash,   // the genesis wall, carried unchanged
    nextRecoverySetHash,                         // the graft rides INSIDE the signed bytes
    prevEventCid:        head.eventCid,
    ownerAuthKeyDid:     ownerHeadOpKeyDid,
  });
}

/** A mint attempt's outcome — the advanced event, or a fail-closed REFUSAL naming the mismatch. */
export type HandleMintResult =
  | { readonly ok: true;  readonly event: HandleKelEvent }
  | { readonly ok: false; readonly reason: string };

/**
 * ROTATE: seat a fresh Handle key under the OWNER's authority — the persona buries and renews its
 * own name. The signature verifies here against the injected `ownerHeadOpKeyDid` (a signer whose
 * bytes do not verify against the key it claims rotates nothing); WHETHER that key stands as the
 * owner's CURRENT head is the full walk's question (`verifyHandleKelFull` + the resolver) — a
 * rotation minted under a superseded owner key passes this gate and falls at that one. FAILS
 * CLOSED on a burned head: a burn is terminal, forever.
 */
export async function mintHandleRotation(input: {
  readonly head:              HandleKelEvent;
  readonly freshHandleKeyDid: string;                          // the Handle key this rotation seats
  readonly ownerHeadOpKeyDid: string;                          // the owner persona's CURRENT head op-key (injected — no persona import)
  readonly sign:              (bytes: Uint8Array) => Promise<string>;   // the owner head op-key's signer
  /** The NEXT recovery-set digest this rotation commits. Absent, the standing commitment carries
   *  forward: a set change is always an explicit act, never a silent drop. */
  readonly nextRecoverySetHash?: string;
}): Promise<HandleMintResult> {
  const { head, freshHandleKeyDid, ownerHeadOpKeyDid } = input;
  if (head.kind === "burn") {
    return { ok: false, reason: "the Handle is burned — a burn is terminal; no successor, forever" };
  }
  const nextRecoverySetHash = input.nextRecoverySetHash ?? head.nextRecoverySetHash;
  const core: HandleEventCore = {
    seq:                 head.seq + 1,
    kind:                "rotation",
    prefix:              head.prefix,            // the identifier stays FIXED
    handleKeyDid:        freshHandleKeyDid,
    ownerPrefix:         head.ownerPrefix,       // ★ the owner-binding carries forward unchanged
    recoverySetHash:     head.recoverySetHash,   // the genesis wall
    nextRecoverySetHash,
    prevEventCid:        head.eventCid,
    ownerAuthKeyDid:     ownerHeadOpKeyDid,
  };
  const bytes = handleEventBytes(core);
  const sig   = await input.sign(bytes);
  if (!(await verifySig(sig, bytes, ownerHeadOpKeyDid))) {
    return { ok: false, reason: "rotation signature does not verify against the claimed owner head op-key" };
  }
  return { ok: true, event: { ...core, eventCid: handleEventCidOf(core), authSig: sig } };
}

/**
 * BURN: the TERMINAL event — the Shadowtalk ending made structural. EITHER HAND may strike it
 * (operator ruling, Option C, 2026-09-08): the SEATED Handle key closes its own name (a panic burn,
 * local, card-self-verifiable), OR the OWNER's head op-key buries it from above (a burn a
 * thief-of-the-face cannot forge — "the persona buries its own name"). The core's `ownerAuthKeyDid`
 * records WHICH hand. After a burn `verifyHandleKel` REFUSES any successor forever, `headHandleKey`
 * seats nothing, and `attestUnderHead` throws. FAILS CLOSED on an already burned head.
 */
export async function mintHandleBurn(input: {
  readonly head: HandleKelEvent;
  /** THE SELF-BURN (Option C, path one): the seated Handle head key closes its own name — fast,
   *  local, card-self-verifiable, no owner lookup. The panic burn a compromised face strikes now. */
  readonly sign?: (bytes: Uint8Array) => Promise<string>;
  /** THE OWNER-BURN (Option C, path two — "the persona buries its own name"): the owning persona's
   *  head op-key strikes the name from above, a burn a thief-of-the-face cannot forge. Names the
   *  owner key in the core; `verifyHandleKelFull` checks it against the owner-head resolver. */
  readonly ownerBurn?: { readonly ownerAuthKeyDid: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
}): Promise<HandleMintResult> {
  const { head } = input;
  if (head.kind === "burn") {
    return { ok: false, reason: "the Handle is already burned — a burn is terminal" };
  }
  if ((input.sign && input.ownerBurn) || (!input.sign && !input.ownerBurn)) {
    return { ok: false, reason: "a burn is struck by EXACTLY one hand — the seated key (`sign`) OR the owner (`ownerBurn`), never both, never neither" };
  }
  const core: HandleEventCore = {
    seq:                 head.seq + 1,
    kind:                "burn",
    prefix:              head.prefix,
    handleKeyDid:        head.handleKeyDid,      // a burn seats no fresh key, either hand
    ownerPrefix:         head.ownerPrefix,
    recoverySetHash:     head.recoverySetHash,
    nextRecoverySetHash: head.nextRecoverySetHash,
    prevEventCid:        head.eventCid,
    ownerAuthKeyDid:     input.ownerBurn ? input.ownerBurn.ownerAuthKeyDid : null,   // the record says WHICH hand
  };
  const signer = input.ownerBurn ? input.ownerBurn.sign : input.sign!;
  const sig = await signer(handleEventBytes(core));
  return { ok: true, event: { ...core, eventCid: handleEventCidOf(core), authSig: sig } };
}

/**
 * Verify the chain's STRUCTURAL integrity: monotonic sequence + hash-links + a STABLE prefix,
 * STABLE owner-binding, and STABLE genesis recovery-commit across every event, each cid recomputing
 * over its bound core, and BURN TERMINALITY — any event following a burn REFUSES the whole chain.
 * Inception (seq 0) carries no predecessor, incepts ARMED, and its prefix MUST derive from its own
 * (key + owner + recovery-set) — the owner-binding. PURE and sync — it verifies no signatures
 * (those ride `verifyHandleKelFull`). Mirrors `verifyPersonaKel` by shape.
 */
export function verifyHandleKel(chain: readonly HandleKelEvent[]): boolean {
  if (chain.length === 0) return false;
  const genesis = chain[0]!;
  if (genesis.seq !== 0 || genesis.kind !== "inception" || genesis.prevEventCid !== null) return false;
  if (genesis.recoverySetHash.length === 0 || genesis.ownerPrefix.length === 0)           return false;   // armed + owned, from birth
  if (genesis.prefix !== handlePrefixOf(genesis.handleKeyDid, genesis.ownerPrefix, genesis.recoverySetHash)) return false;
  if (genesis.nextRecoverySetHash !== genesis.recoverySetHash) return false;   // inception seats ONE set in both slots
  if (genesis.ownerAuthKeyDid !== null)                        return false;
  if (genesis.eventCid !== handleEventCidOf(genesis))          return false;
  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!, prev = chain[i - 1]!;
    if (prev.kind === "burn")                       return false;   // ★ a burn is terminal, forever
    if (e.kind === "inception")                     return false;   // one birth per name
    if (e.seq !== prev.seq + 1)                     return false;   // monotonic
    if (e.prevEventCid !== prev.eventCid)           return false;   // hash-linked
    if (e.prefix !== prev.prefix)                   return false;   // the identifier stays fixed
    if (e.ownerPrefix !== prev.ownerPrefix)         return false;   // ★ the owner-binding never detaches
    if (e.recoverySetHash !== prev.recoverySetHash) return false;   // the genesis wall stays fixed; the rolling slot grafts freely
    if (e.kind === "rotation" && (e.ownerAuthKeyDid === null || !e.authSig)) return false;   // owner authority named + signed
    if (e.kind === "burn") {
      if (e.handleKeyDid !== prev.handleKeyDid)     return false;   // a burn seats no fresh key, either hand
      if (!e.authSig)                               return false;   // a burn is always signed (self OR owner)
      // ownerAuthKeyDid null → self-burn (seated key); set → owner-burn — full-verify checks the hand
    }
    if (e.eventCid !== handleEventCidOf(e))         return false;   // cid recomputes over the bound core
  }
  return true;
}

/**
 * The injected owner-head oracle — the ONE seam where the sibling grammar touches the persona plane,
 * kept as an interface so this module never imports the persona-KEL. Answers whether `ownerAuthKeyDid`
 * stands as the owner persona's AUTHORITATIVE head op-key under the CALLER's policy — typically a walk
 * of the owner's local persona-KEL replica to its verified head (`headOpKey(chain, {verifyQuorums:true})`),
 * so a SUPERSEDED owner key answers false. A verifier holding the owner's chain snapshot (carried
 * beside the card) resolves reader-locally; one without it needs the owner's board — the resolver
 * names that dependency instead of hiding it.
 */
export type OwnerHeadResolver = (ownerPrefix: string, ownerAuthKeyDid: string) => Promise<boolean>;

/**
 * Verify the chain structurally AND verify every signature + rotation authority — the full assurance
 * a reader needs before trusting the head Handle key. Each ROTATION's `authSig` MUST verify over the
 * event bytes against its named `ownerAuthKeyDid`, and that key MUST stand as the owner's head per
 * the injected resolver — a rotation signed by a SUPERSEDED owner key refuses HERE (the settlement's
 * rule: rotation authority walks the OWNER's persona-KEL head). Each BURN's `authSig` MUST verify
 * against the seated Handle key. FAILS CLOSED on the first break.
 */
export async function verifyHandleKelFull(
  chain: readonly HandleKelEvent[],
  ownerHeadResolver: OwnerHeadResolver,
): Promise<{ ok: boolean; reason?: string }> {
  if (!verifyHandleKel(chain)) {
    return { ok: false, reason: "structural integrity failed (sequence / hash-link / prefix / owner-binding / burn-terminality / cid)" };
  }
  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!;
    const core: HandleEventCore = {
      seq: e.seq, kind: e.kind, prefix: e.prefix, handleKeyDid: e.handleKeyDid, ownerPrefix: e.ownerPrefix,
      recoverySetHash: e.recoverySetHash, nextRecoverySetHash: e.nextRecoverySetHash,
      prevEventCid: e.prevEventCid, ownerAuthKeyDid: e.ownerAuthKeyDid,
    };
    if (e.kind === "rotation") {
      if (!e.authSig || e.ownerAuthKeyDid === null) return { ok: false, reason: `rotation seq ${e.seq}: unsigned` };
      if (!(await verifySig(e.authSig, handleEventBytes(core), e.ownerAuthKeyDid))) {
        return { ok: false, reason: `rotation seq ${e.seq}: signature does not verify against its named owner key` };
      }
      if (!(await ownerHeadResolver(e.ownerPrefix, e.ownerAuthKeyDid))) {
        return { ok: false, reason: `rotation seq ${e.seq}: its owner key does not stand as the owner's head (superseded or unrecognized)` };
      }
    } else if (e.kind === "burn") {
      if (!e.authSig) return { ok: false, reason: `burn seq ${e.seq}: unsigned` };
      if (e.ownerAuthKeyDid === null) {
        // SELF-BURN — the seated Handle head key closed its own name; no owner lookup.
        if (!(await verifySig(e.authSig, handleEventBytes(core), e.handleKeyDid))) {
          return { ok: false, reason: `burn seq ${e.seq}: self-burn signature does not verify against the seated Handle key` };
        }
      } else {
        // OWNER-BURN — the persona buries its own name; the owner key must sign AND stand as the owner's head.
        if (!(await verifySig(e.authSig, handleEventBytes(core), e.ownerAuthKeyDid))) {
          return { ok: false, reason: `burn seq ${e.seq}: owner-burn signature does not verify against its named owner key` };
        }
        if (!(await ownerHeadResolver(e.ownerPrefix, e.ownerAuthKeyDid))) {
          return { ok: false, reason: `burn seq ${e.seq}: its owner key does not stand as the owner's head (a superseded key cannot bury the name)` };
        }
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
 * The authoritative Handle key — the LATEST head's `handleKeyDid`, IFF the chain verifies
 * structurally AND does not end burned. A buried name seats NO key (null), and a broken chain
 * seats none either (a reader MUST NOT trust a head off a broken lineage).
 */
export function headHandleKey(chain: readonly HandleKelEvent[]): string | null {
  if (!verifyHandleKel(chain)) return null;
  if (isBurned(chain))         return null;
  return chain[chain.length - 1]!.handleKeyDid;
}

// ── ATTESTATION — a signed statement, never an event kind ───────────────────────────────────────
// A claim must not bloat the lineage or need a board: it travels ON the card and verifies
// reader-locally against the head key. Binding the head's cid ties the claim to a chain STATE —
// a rotation or burn stales it, and the fresh head re-attests to renew.

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
 * ATTEST under the chain's head: sign a claim with the seated head Handle key. THROWS on a broken
 * chain and on a burned one — nothing attests under a buried name. The returned statement is
 * self-describing carriage for the card; `verifyAttestation` is its reader-local other half.
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
 * statement bound, and the signature verifies against that head's Handle key. A rotation or burn
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
