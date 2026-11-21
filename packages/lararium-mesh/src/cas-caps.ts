/**
 * cas-caps — the two RETENTION caps a bag holds beside its read caps: PIN (keep these bytes) and PREFETCH (pull
 * pointers' bytes as they cross). Both name a holder and (optionally) the holder's LIFE — never a wall-clock expiry
 * (standing law: a wall clock never decides a verdict).
 *
 * PIN at CID grain: `{ cid, tier, holder, life? }` — a pinned blob never sweeps while the pin stands. "Stands"
 * is PRESENCE, decided by the sidecar (`node-cas.ts`'s `pinCas`/`releaseCas`), never a clock read here; `life`
 * (M7) is OPTIONAL and, when present, names the holder's OWN life at pin time (the id its store claim minted) —
 * the pin holds while the holder's CURRENT life matches it, and ends the moment another life holds the
 * store: a CAUSAL event, compared by equality and never by order. `releaseCas` ends it earlier still, explicitly.
 * The tier binds to the bag whose pointer the pin protects.
 *
 * PREFETCH per peer: `{ tier, holder, life? }` — DECLARED, gated, DEFAULT OFF. Fetch-on-read stays the house
 * default (the road stays light, the absence stays honest); a prefetch cap opens only for the ONE peer it names,
 * for as long as that peer's own life stays the one recorded. Absent cap → nothing prefetches.
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

/** A PIN cap — keep the bytes a cid names, at cid grain, until an explicit release or the holder's own life ends
 *  (another life holds its store). NO clock field (M7): a wall clock never decides this house's pin verdicts,
 *  and a field that decides nothing invites a reader to think it does. */
export interface PinCap {
  readonly cid:    string;
  readonly tier:   CapTier;
  /** The vessel / persona that holds the pin (its verifying-key hex or a persona slug). */
  readonly holder: string;
  /** The holder's OWN life at pin time. OPTIONAL — absent means "no life recorded", under which presence alone
   *  decides (the `node-cas.ts` sidecar law: `pinHolds`/`pinnedCids` read it as standing forever, until an
   *  explicit release). */
  readonly life?: string;
}

/** A PREFETCH cap — pull the bytes behind pointers as they cross, for ONE peer, until an explicit release or
 *  that peer's own life ends. */
export interface PrefetchCap {
  readonly tier:   CapTier;
  /** The one peer (its proven key) the cap opens for. */
  readonly holder: string;
  readonly life?: string;
}

/**
 * Does a PIN hold `cid` under the holder's CURRENT life? Presence alone decides when no life was ever recorded
 * (`pin.life === undefined` — the sidecar-presence law); a recorded life holds while it IS the current one, and
 * nothing once another life stands. Equality alone: no clock and no order (M7 — lost `now`).
 */
export function pinHolds(pin: PinCap | undefined, cid: string, currentLife: string): boolean {
  if (!pin) return false;
  if (pin.cid !== cid) return false;
  return pin.life === undefined || pin.life === currentLife;
}

/** The pins that still hold under `currentLife`, as the set of cids they protect — the sweep's "never" set. */
export function pinnedCids(pins: Iterable<PinCap>, currentLife: string): Set<string> {
  const out = new Set<string>();
  for (const p of pins) if (p.life === undefined || p.life === currentLife) out.add(p.cid);
  return out;
}

/** Does a PREFETCH cap open for `peer` under its `currentLife`? Absent → OFF (the default); another holder → off;
 *  another life than the one recorded → off. */
export function prefetchAllows(cap: PrefetchCap | undefined, peer: string, currentLife: string): boolean {
  if (!cap) return false;
  if (cap.holder !== peer) return false;
  return cap.life === undefined || cap.life === currentLife;
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
