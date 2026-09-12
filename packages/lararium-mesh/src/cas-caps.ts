/**
 * cas-caps — the two RETENTION caps a bag holds beside its read caps: PIN (keep these bytes) and PREFETCH (pull
 * pointers' bytes as they cross). Both name a holder and an expiry; both read the expiry against the realm's own
 * clock (`graceForTier` in rolls of `realmPace`), never a wall-clock alone.
 *
 * PIN at CID grain: `{ cid, tier, holder, expiry }` — a pinned blob never sweeps while the pin stands; an EXPIRED
 * pin releases the blob to the ordinary grace. The tier binds to the bag whose pointer the pin protects.
 *
 * PREFETCH per peer: `{ tier, holder, expiry }` — DECLARED, gated, DEFAULT OFF. Fetch-on-read stays the house
 * default (the road stays light, the absence stays honest); a prefetch cap opens only for the ONE peer it names
 * (a phone leaving the house), only before its expiry. Absent cap → nothing prefetches.
 *
 * GRACE per tier: `graceForTier(tier, unit)` — ratios over the realm's own clock (one roll), never a constant.
 * VEIL / PERSONAGROUP hold LONGER than CONTRACT / PUBLIC: a private tier's bytes have exactly one holder-set that
 * can ever re-fetch them (this vessel, this fleet) — sweeping early there loses the only copy; a CONTRACT or PUBLIC
 * blob stands with other holders (the cabal, the world, the Herm re-share), so a shorter local grace costs a
 * re-fetch, never the bytes.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/tiddler-carriage#/pin-and-release
 */

import { type CapTier, CAP_TIER_ORDER } from "./cap-tier.js";

/** A PIN cap — keep the bytes a cid names, at cid grain, until `expiry` (ms on the realm's clock reading). */
export interface PinCap {
  readonly cid:    string;
  readonly tier:   CapTier;
  /** The vessel / persona that holds the pin (its verifying-key hex or a persona slug). */
  readonly holder: string;
  /** The pin's end, inclusive — at or past it the pin no longer holds. */
  readonly expiry: number;
}

/** A PREFETCH cap — pull the bytes behind pointers as they cross, for ONE peer, until `expiry`. */
export interface PrefetchCap {
  readonly tier:   CapTier;
  /** The one peer (its proven key) the cap opens for. */
  readonly holder: string;
  readonly expiry: number;
}

/** Does a PIN hold `cid` for this reading of `now`? An absent / expired / other-cid pin holds nothing. */
export function pinHolds(pin: PinCap | undefined, cid: string, now: number): boolean {
  if (!pin) return false;
  return pin.cid === cid && now < pin.expiry;
}

/** The pins that still hold at `now`, as the set of cids they protect — the sweep's "never" set. */
export function pinnedCids(pins: Iterable<PinCap>, now: number): Set<string> {
  const out = new Set<string>();
  for (const p of pins) if (now < p.expiry) out.add(p.cid);
  return out;
}

/** Does a PREFETCH cap open for `peer` at `now`? Absent → OFF (the default); another holder → off; expired → off. */
export function prefetchAllows(cap: PrefetchCap | undefined, peer: string, now: number): boolean {
  if (!cap) return false;
  return cap.holder === peer && now < cap.expiry;
}

/**
 * The per-tier grace ratios over the realm's own unit — one roll of its clock (`realmPace`, the ahi-kā
 * reading); the ratios say how many rolls a blob rests
 * unreferenced before it may sweep. Private tiers (one holder-set, no re-fetch road) hold longest.
 */
export const GRACE_RATIO_BY_TIER: Readonly<Record<CapTier, number>> = {
  veil:         8,
  personagroup: 4,
  contract:     2,
  public:       1,
};

/**
 * The grace for a tier, in the unit the caller names — `unit` = one ROLL of the realm's own clock (`realmPace`,
 * ahi-ka: the sweep passes 1 and counts rolls), never a wall-clock span. A non-finite / non-positive unit reads
 * as ONE so a torn reading never yields a zero grace (a zero grace sweeps a staged body before its verb lands).
 */
export function graceForTier(tier: CapTier, unit: number): number {
  const u = Number.isFinite(unit) && unit > 0 ? unit : 1;
  return GRACE_RATIO_BY_TIER[tier] * u;
}

/** The tiers ordered by their grace, longest first — the doc comment's claim, checkable. */
export function tiersByGraceDescending(): readonly CapTier[] {
  return [...CAP_TIER_ORDER].sort((a, b) => GRACE_RATIO_BY_TIER[b] - GRACE_RATIO_BY_TIER[a]);
}
