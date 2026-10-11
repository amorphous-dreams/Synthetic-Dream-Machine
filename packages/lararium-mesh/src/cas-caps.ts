/**
 * cas-caps — the two RETENTION caps a bag holds beside its read caps: PIN (keep these bytes) and PREFETCH (pull
 * pointers' bytes as they cross). Both name a holder and (optionally) a FENCE — never a wall-clock expiry
 * (standing law: a wall clock never decides a verdict).
 *
 * PIN at CID grain: `{ cid, tier, holder, fence? }` — a pinned blob never sweeps while the pin stands. "Stands"
 * is PRESENCE, decided by the sidecar (`node-cas.ts`'s `pinCas`/`releaseCas`), never a clock read here; `fence`
 * (M7) is OPTIONAL and, when present, names the holder's OWN fence (its boot epoch) at pin time — the pin
 * holds while the holder's CURRENT fence has not yet superseded it (a reboot moves the fence forward), ending
 * the pin on that CAUSAL event rather than a span. `releaseCas` ends it earlier still, explicitly. The tier
 * binds to the bag whose pointer the pin protects.
 *
 * PREFETCH per peer: `{ tier, holder, fence? }` — DECLARED, gated, DEFAULT OFF. Fetch-on-read stays the house
 * default (the road stays light, the absence stays honest); a prefetch cap opens only for the ONE peer it names,
 * for as long as that peer's own fence has not superseded the one recorded. Absent cap → nothing prefetches.
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

/** A PIN cap — keep the bytes a cid names, at cid grain, until an explicit release or the holder's own fence
 *  (its boot epoch) supersedes it. NO `expiry` field (M7): a wall clock never decided this house's pin
 *  verdicts even while the field stood, and a retired field left standing invites a reader to think it does. */
export interface PinCap {
  readonly cid:    string;
  readonly tier:   CapTier;
  /** The vessel / persona that holds the pin (its verifying-key hex or a persona slug). */
  readonly holder: string;
  /** The holder's OWN fence (its boot epoch) at pin time. OPTIONAL — absent means "no fence recorded", under
   *  which presence alone decides (the `node-cas.ts` sidecar law: `pinHolds`/`pinnedCids` read it as standing
   *  forever, until an explicit release). */
  readonly fence?: number;
}

/** A PREFETCH cap — pull the bytes behind pointers as they cross, for ONE peer, until an explicit release or
 *  that peer's own fence supersedes the one recorded. */
export interface PrefetchCap {
  readonly tier:   CapTier;
  /** The one peer (its proven key) the cap opens for. */
  readonly holder: string;
  readonly fence?: number;
}

/**
 * Does a PIN hold `cid` under this holder's CURRENT fence? Presence alone decides when no fence was ever
 * recorded (`pin.fence === undefined` — the sidecar-presence law); a recorded fence that `currentFence` has
 * since moved past no longer holds. Never a clock comparison either way (M7 — lost `now`).
 */
export function pinHolds(pin: PinCap | undefined, cid: string, currentFence: number): boolean {
  if (!pin) return false;
  if (pin.cid !== cid) return false;
  return pin.fence === undefined || currentFence <= pin.fence;
}

/** The pins that still hold under `currentFence`, as the set of cids they protect — the sweep's "never" set. */
export function pinnedCids(pins: Iterable<PinCap>, currentFence: number): Set<string> {
  const out = new Set<string>();
  for (const p of pins) if (p.fence === undefined || currentFence <= p.fence) out.add(p.cid);
  return out;
}

/** Does a PREFETCH cap open for `peer` under `currentFence`? Absent → OFF (the default); another holder → off;
 *  a fence the peer has since superseded → off. */
export function prefetchAllows(cap: PrefetchCap | undefined, peer: string, currentFence: number): boolean {
  if (!cap) return false;
  if (cap.holder !== peer) return false;
  return cap.fence === undefined || currentFence <= cap.fence;
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
