/**
 * epoch-lease — a lease epoch rises only on a signed advance. Faces sign per-writer slots
 * (`lease-advance.ts`); Nexus and realm hands sign per-cid slots (`quorum-lease.ts`).
 * Distinct slots preserve concurrent advances, so the verified max never falls.
 */

import { VESSEL_STATE_HOME } from "./vessel-state.js";

/** Prefix for a resource's per-writer lease-epoch slots in the vessel's fixed-title state (`vessel-state`, its secret home) — scan tiddlers under this to read all slots. */
export function leaseEpochPrefix(resourceId: string): string {
  return `${VESSEL_STATE_HOME}/lease-epoch/${encodeURIComponent(resourceId)}/`;
}

/** The slot tiddler URI a single writer owns for a resource's lease epoch (LWW-safe — one owner). */
export function leaseEpochSlotUri(resourceId: string, writerId: string): string {
  return `${leaseEpochPrefix(resourceId)}${encodeURIComponent(writerId)}`;
}

/** The value a writer writes to its OWN slot to roll the lease forward — effective + 1. */
export function rolledLeaseEpoch(currentEffective: number): number {
  return currentEffective + 1;
}
