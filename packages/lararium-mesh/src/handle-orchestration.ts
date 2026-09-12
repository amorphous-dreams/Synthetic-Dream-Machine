/**
 * handle-orchestration — the leased-projection core the handle verbs (rotate · graft · burn · attest) mirror.
 *
 * The WHO board holds the authoritative handle-KEL; a vessel's local record stays a thin projection (an index
 * into the board, never the chain itself — a chain a record OWNED would read as a compiled who-is-X-of-one,
 * which the registry filter refuses). To mint the next event, a vessel resolves the CURRENT chain off the
 * board and LEASE-CHECKS: extend only when the board head still reads as the head the caller last folded — a
 * compare-and-swap (git force-with-lease · KERI accept-on-witness-quorum · SWIM higher-incarnation refutation).
 *
 * The lease guards the COMMON case — a stale local view whose head the board already moved past. It does not,
 * alone, stop a truly-concurrent partition fork (two peers extend one head across a partition); that stays
 * caught SOVEREIGN at read by the recogniser's HandleBook (a forked/rolled-back chain loses at read) and by
 * the equivocation gossip. So the lease reduces forks at the writer; the reader remains the final catch — the
 * two are one instrument reading one attack (a second present that disowns its past) at two places.
 *
 * Research rhyme: lar:///ha.ka.ba/lares/api/pono/field-collision
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { readHandleAnnounces, writeHandleAnnounce } from "./handle-announce.js";
import { mintHandleBurn, mintHandleRotation, handleKeyDigestOf, type HandleKelEvent, type HandleMintResult, type HandleCoSigner } from "./handle-kel.js";
import { deriveVeiledUserKey } from "./persona-identity.js";
import { didFromVerifyingKey } from "./lar-did.js";
import { ed25519SignerFromSeed } from "./auth-wire.js";
import { hexToBytes } from "./crypto.js";
import { PERSONA_GLAMOUR_CONTEXT } from "./persona-glamour.js";
import type { HandleCard } from "./handle-card.js";
import type { LarDoc } from "./base-doc.js";

/** Resolve the authoritative current chain for a nym from a board doc — the board is truth, not a local copy. */
export function resolveOwnHandleChain(boardDoc: LarDoc, nym: string): HandleKelEvent[] | null {
  const found = readHandleAnnounces(boardDoc).find((c) => c.nym === nym);
  return found ? (found.chain as HandleKelEvent[]) : null;
}

/** The head event cid the board currently shows for a nym — the lease value a caller compares against. */
export function boardHeadCid(boardDoc: LarDoc, nym: string): string | null {
  const chain = resolveOwnHandleChain(boardDoc, nym);
  if (!chain || chain.length === 0) return null;
  return chain[chain.length - 1]!.eventCid;
}

/**
 * Extend a Handle safely under a lease. Resolve the board's current chain, refuse unless its head still
 * matches `expectedHeadCid` (the fork-prevention CAS — a stale caller never reaches the mint), then run the
 * verb's own `mintNext` over the RESOLVED chain (never a stale local one), announce the card `buildCard`
 * returns, and hand it back. A verb supplies only its mint + its card build; the lease + resolve + announce
 * stay shared.
 */
export async function extendOwnHandle(opts: {
  board:           DocHandle<LarDoc>;
  nym:             string;
  expectedHeadCid: string;
  mintNext:        (currentChain: HandleKelEvent[]) => Promise<HandleMintResult>;
  buildCard:       (event: HandleKelEvent, newChain: HandleKelEvent[]) => HandleCard | Promise<HandleCard>;
}): Promise<{ ok: true; card: HandleCard } | { ok: false; reason: string }> {
  const doc = opts.board.doc();
  if (!doc) return { ok: false, reason: "the board doc is not ready — the WHO board resolved to nothing (fail-closed)" };
  const chain = resolveOwnHandleChain(doc as LarDoc, opts.nym);
  if (!chain || chain.length === 0) {
    return { ok: false, reason: `no chain on the board for ${opts.nym.slice(0, 16)}… — publish the Handle first` };
  }
  const head = chain[chain.length - 1]!;
  if (head.eventCid !== opts.expectedHeadCid) {
    return {
      ok: false,
      reason: `lease violation: board head ${head.eventCid.slice(0, 12)}… trails the expected ${opts.expectedHeadCid.slice(0, 12)}… — refold from the board and retry (a stale head never forks the name)`,
    };
  }
  const minted = await opts.mintNext(chain);
  if (!minted.ok) return { ok: false, reason: minted.reason };
  const newChain = [...chain, minted.event];
  const card = await opts.buildCard(minted.event, newChain);
  opts.board.change((d) => writeHandleAnnounce(d, card));
  return { ok: true, card };
}

/**
 * BURN a Handle — the first verb specialized over the leased-projection core, and the template the others
 * (rotate · graft · attest) follow: supply only the verb's mint + card-build; the lease + resolve + announce
 * stay shared. EITHER HAND (Option C): the SEATED handle key closes its own name (`sign` — the panic
 * self-burn, local, card-self-verifiable) OR the OWNER buries it from above (`ownerBurn` — a burn a
 * thief-of-the-face cannot forge). Exactly one hand; supplying neither or both refuses. The burn's effect
 * needs no valid card signature — a reader refuses a burned chain BEFORE checking the sig — so an owner-burn
 * lands even when the seated key is lost. The mint runs over the board's CURRENT chain, so a stale lease
 * cannot burn a name off a head the board already moved past.
 */
export async function burnOwnHandle(opts: {
  board:           DocHandle<LarDoc>;
  nym:             string;
  expectedHeadCid: string;
  /** THE SELF-BURN — the seated handle key signs. Mutually exclusive with `ownerBurn`. */
  sign?:           (bytes: Uint8Array) => Promise<string>;
  /** THE OWNER-BURN — a current member (a personal face's owning persona) buries the name from above. */
  ownerBurn?:      { ownerAuthMemberPrefix: string; ownerAuthKeyDid: string; sign: (bytes: Uint8Array) => Promise<string> };
  /** OWNER-BURN co-signers — DISTINCT current members BEYOND the presenter, gathered toward the current
   *  witness threshold: burying a SHARED (k-of-n) name is a quorum act. A 1-of-1 needs none; the self-burn
   *  refuses them (a single-hand panic). Ignored on the self path. */
  coSigners?:      readonly HandleCoSigner[];
  buildCard:       (event: HandleKelEvent, newChain: HandleKelEvent[]) => HandleCard | Promise<HandleCard>;
}): Promise<{ ok: true; card: HandleCard } | { ok: false; reason: string }> {
  if ((opts.sign === undefined) === (opts.ownerBurn === undefined)) {
    return { ok: false, reason: "a burn strikes with EXACTLY ONE hand — pass `sign` (self) or `ownerBurn` (owner), never neither nor both" };
  }
  return extendOwnHandle({
    board:           opts.board,
    nym:             opts.nym,
    expectedHeadCid: opts.expectedHeadCid,
    mintNext:        (chain) => mintHandleBurn(
      opts.sign !== undefined
        ? { head: chain[chain.length - 1]!, sign: opts.sign }
        : { head: chain[chain.length - 1]!, ownerBurn: opts.ownerBurn!, ...(opts.coSigners ? { coSigners: opts.coSigners } : {}) },   // the one-hand guard above proved it set
    ),
    buildCard:       opts.buildCard,
  });
}

/** Count the rotations already in a chain — the context-ladder rung the NEXT rotation seats a key at. */
function rotationCount(chain: readonly HandleKelEvent[]): number {
  return chain.reduce((n, e) => (e.kind === "rotation" ? n + 1 : n), 0);
}

/**
 * ROTATE a Handle over the leased-projection core — a current holder seats a FRESH presentation key under the
 * same name, the owning persona authorizing (rotate · Option A: the CONTEXT-LADDER). The fresh key derives at
 * `deriveVeiledUserKey(seed, handleIndex, contextBase + rotationCountAfter)`, where `contextBase` is the face's
 * inception context and `rotationCountAfter` counts this rotation — so the seated key is ALWAYS re-derivable
 * from (seed, handleIndex, chain-rotation-count), reproducible and seed-rooted. The rotation itself commits the
 * NEXT rung's digest (KERI pre-rotation), so a chain a thief cannot advance stays advanceable by the seed-holder.
 *
 * The mint is authorized by the OWNING PERSONA's head op-key — a lost handle key recovers THROUGH the persona.
 * The card re-signs under the FRESH head handle key (a rotated head certifies the card the recogniser accepts);
 * the mint hands that fresh signer to `buildCard`. The mint runs over the board's CURRENT chain, so a stale
 * lease cannot rotate a name off a head the board already moved past.
 */
export async function rotateOwnHandle(opts: {
  board:           DocHandle<LarDoc>;
  nym:             string;
  expectedHeadCid: string;
  /** The persona master-seed the face derives from — the fresh key rides its context ladder. */
  seed:            Uint8Array;
  handleIndex:     number;
  /** The face's inception context (default PERSONA_GLAMOUR_CONTEXT) — the ladder's base rung. */
  contextBase?:    number;
  /** The owning persona (a current owner-set member) and its head op-key + signer — the rotation authority. */
  ownerAuthMemberPrefix: string;
  ownerHeadOpKeyDid:     string;
  sign:                  (bytes: Uint8Array) => Promise<string>;
  /** ROTATION co-signers — DISTINCT current members BEYOND the presenter, toward the current witness
   *  threshold: seating a fresh key on a SHARED (k-of-n) name is a quorum act. A 1-of-1 needs none. */
  coSigners?:            readonly HandleCoSigner[];
  /** Build the renewed card; the mint yields the FRESH head handle key's signer to sign it under. */
  buildCard:       (event: HandleKelEvent, newChain: HandleKelEvent[], freshHandleSign: (bytes: Uint8Array) => Promise<string>) => HandleCard | Promise<HandleCard>;
}): Promise<{ ok: true; card: HandleCard } | { ok: false; reason: string }> {
  const base = opts.contextBase ?? PERSONA_GLAMOUR_CONTEXT;
  let freshSign: ((bytes: Uint8Array) => Promise<string>) | null = null;
  return extendOwnHandle({
    board:           opts.board,
    nym:             opts.nym,
    expectedHeadCid: opts.expectedHeadCid,
    mintNext:        async (chain): Promise<HandleMintResult> => {
      const head        = chain[chain.length - 1]!;
      const nextContext = base + rotationCount(chain) + 1;   // rotation N (this one) rides context base + N
      const fresh       = await deriveVeiledUserKey(opts.seed, opts.handleIndex, nextContext);
      const freshHandleKeyDid = didFromVerifyingKey(fresh.verifyingKey);
      freshSign = ed25519SignerFromSeed(hexToBytes(fresh.signingKey));
      // Pre-commit the rung AFTER this one — the seated key here revealed the prior commitment; this commits the next.
      const after              = await deriveVeiledUserKey(opts.seed, opts.handleIndex, nextContext + 1);
      const nextHandleKeyDigest = handleKeyDigestOf(didFromVerifyingKey(after.verifyingKey));
      return mintHandleRotation({
        head, freshHandleKeyDid,
        ownerAuthMemberPrefix: opts.ownerAuthMemberPrefix,
        ownerHeadOpKeyDid:     opts.ownerHeadOpKeyDid,
        sign:                  opts.sign,
        ...(opts.coSigners ? { coSigners: opts.coSigners } : {}),
        nextHandleKeyDigest,
      });
    },
    buildCard:       (event, newChain) => opts.buildCard(event, newChain, freshSign!),
  });
}
