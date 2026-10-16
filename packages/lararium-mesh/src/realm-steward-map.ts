/**
 * realm-steward-map — a realm's co-signed STEWARD map: each worn face or Handle a standing registration's
 * co-signed `keptBy` names, with the bags it keeps. Filled from those registrations and from nothing else.
 *
 * A LEAF MAP, NEVER THE ROOT MAP (membership-doctrine#/two-maps). A `keptBy` name is a steward's worn per-Nexus
 * face or a Handle, so this map answers "which bags does this steward keep in this realm", and never a root
 * question. The realm consult's ROOT map (`peerContractNymMap`, filled only by a root edge proven at the wire)
 * stands apart; this module imports no carriage module, and no reader joins the two.
 *
 * HOUSE READING (marked as one). A registration fills the map only where it stands CO-SIGNED: its `keptBy`
 * holds two or more names. Standing already means every named steward sealed (n-of-n), so a name in a
 * co-signed record carries a relation that another hand consented to. A one-steward record names one hand's
 * own book and fills nothing. A registration whose `realmId` differs from the asked realm fills nothing. A name
 * enters under its lower-case form when it reads a steward class (Face or Handle, `stewardClassOf`); a name
 * reading neither enters nothing.
 *
 * Pure: takes the standing a vessel already folded, holds no key, no clock, no I/O.
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine
 */

import { stewardClassOf, type RealmBagRegistration } from "./realm-bag.js";

/** One realm's steward map: steward name (lower-case) to the bagUris whose co-signed `keptBy` names it, sorted. */
export interface RealmStewardMap {
  readonly realmId:  string;
  readonly stewards: ReadonlyMap<string, readonly string[]>;
}

/** Fill the steward map of `realmId` from its standing registrations. */
export function realmStewardMap(realmId: string, standing: ReadonlyMap<string, RealmBagRegistration>): RealmStewardMap {
  const held = new Map<string, Set<string>>();
  for (const rec of standing.values()) {
    if (rec.realmId !== realmId) continue;                  // a record of another realm fills nothing
    if (rec.keptBy.length < 2) continue;                    // one hand's own book co-signs nobody else's relation
    for (const raw of rec.keptBy) {
      const name = raw.trim().toLowerCase();
      if (stewardClassOf(name) === null) continue;          // a name reading neither class enters nothing
      const bags = held.get(name) ?? new Set<string>();
      bags.add(rec.bagUri);
      held.set(name, bags);
    }
  }
  const stewards = new Map<string, readonly string[]>();
  for (const [name, bags] of held) stewards.set(name, [...bags].sort());
  return { realmId, stewards };
}

/** The bags a steward keeps in this map, or null when the map names no such steward. */
export function realmBagsKeptBy(map: RealmStewardMap, key: string): readonly string[] | null {
  return map.stewards.get(key.trim().toLowerCase()) ?? null;
}
