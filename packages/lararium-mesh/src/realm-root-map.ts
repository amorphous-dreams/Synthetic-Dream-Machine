/**
 * realm-root-map — the ROOT map a realm member consult reads, filled from the co-signed `keptBy` of standing
 * registrations and from nothing else.
 *
 * THE TWO MAPS (membership-doctrine#/two-maps). The per-Nexus LEAF map answers the carriage consult; this ROOT
 * map answers the realm consult. They fill independently and never link: this module imports no carriage
 * module and holds no leaf-map type, no reader joins the two, and a peer without a root answers null — an
 * honest nothing, never a leaf promoted to stand in.
 *
 * HOUSE READING (marked as one). A registration fills the map only where it stands CO-SIGNED: its `keptBy`
 * holds two or more names. Standing already means every named steward sealed (n-of-n), so a name in a
 * co-signed record carries a relation that another hand consented to. A one-steward record names one hand's
 * own book and roots nobody else's relation, so it fills nothing. A registration whose `realmId` differs from
 * the asked realm fills nothing. A name enters under its lower-case form when it reads a steward class (Face
 * or Handle, `stewardClassOf`); a name reading neither enters nothing.
 *
 * Pure: takes the standing a vessel already folded, holds no key, no clock, no I/O.
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine
 */

import { stewardClassOf, type RealmBagRegistration } from "./realm-bag.js";

/** One realm's ROOT map: steward name (lower-case) to the bagUris whose co-signed `keptBy` names it, sorted. */
export interface RealmRootMap {
  readonly realmId: string;
  readonly roots:   ReadonlyMap<string, readonly string[]>;
}

/** Fill the root map of `realmId` from its standing registrations. */
export function realmRootMap(realmId: string, standing: ReadonlyMap<string, RealmBagRegistration>): RealmRootMap {
  const held = new Map<string, Set<string>>();
  for (const rec of standing.values()) {
    if (rec.realmId !== realmId) continue;                  // a record of another realm fills nothing
    if (rec.keptBy.length < 2) continue;                    // one hand's own book roots nobody else's relation
    for (const raw of rec.keptBy) {
      const name = raw.trim().toLowerCase();
      if (stewardClassOf(name) === null) continue;          // a name reading neither class enters nothing
      const bags = held.get(name) ?? new Set<string>();
      bags.add(rec.bagUri);
      held.set(name, bags);
    }
  }
  const roots = new Map<string, readonly string[]>();
  for (const [name, bags] of held) roots.set(name, [...bags].sort());
  return { realmId, roots };
}

/** The bags a key roots in this map, or null when the map holds no root for it. */
export function realmRootOf(map: RealmRootMap, key: string): readonly string[] | null {
  return map.roots.get(key.trim().toLowerCase()) ?? null;
}
