/**
 * floor-nexus — WHICH NEXUS A RECIPE'S FLOOR READS: slug -> realm -> Nexus, the home charter where a realm names none.
 *
 * Each recipe mounts its own realm's Nexus (pin step 4, kaula design `plan/pin-steps-4-5`): the edge ledger names the realm a
 * wiki's workbench stands in (`ledgerWorkbenchRealms`), and the realm's Nexus pins (`ledgerRealmNexuses`). A realm that names
 * no Nexus (a private cabal of one at a seed charter) reads the place's HOME charter, since a realm stands under one charter,
 * a seed's or a Nexus's; the daemon island and the floor wiki read the home charter too. No charter at all reads none, and
 * the mount stands on genesis. Two Nexus pins across the slug's realms read `conflicted`: the pick never chooses between
 * two Nexuses, and `floorToMount` mounts genesis under `floor-realm-conflicted`.
 *
 * Pure: the ledger document and the home charter's AID in, the pick out. No clock, no arrival order.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 */
import type { LarDoc } from "./base-doc.js";
import { ledgerWorkbenchRealms } from "./workbench.js";
import { ledgerRealmNexuses } from "./edge-ledger.js";
import type { FloorNexusPick } from "./floor-accept.js";

/** The Nexus `slug`'s floor reads, off the edge ledger; `home` names the place's home charter's AID (null where none stands). */
export function recipeFloorNexusOf(ledger: LarDoc | null | undefined, slug: string, home: string | null): FloorNexusPick {
  const pins = new Set<string>();
  for (const realm of ledgerWorkbenchRealms(ledger, slug)) for (const aid of ledgerRealmNexuses(ledger, realm)) pins.add(aid);
  if (pins.size > 1) return { conflicted: [...pins].sort() };
  if (pins.size === 1) return { nexus: [...pins][0]! };
  return { nexus: home };
}
