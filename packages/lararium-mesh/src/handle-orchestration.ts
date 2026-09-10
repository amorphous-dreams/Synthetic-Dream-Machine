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
import type { HandleKelEvent, HandleMintResult } from "./handle-kel.js";
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
  buildCard:       (event: HandleKelEvent, newChain: HandleKelEvent[]) => HandleCard;
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
  const card = opts.buildCard(minted.event, newChain);
  opts.board.change((d) => writeHandleAnnounce(d, card));
  return { ok: true, card };
}
