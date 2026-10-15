/**
 * edge-board — how THIS vessel reads an edge board: the board replica, the vessel's own ledger, the charter
 * the realm stands under, in one call every door shares.
 *
 * A door never folds a board it did not check, and never forgets an act it once counted (kapae#/accretion):
 * each read keeps what counted in the vessel's own ledger and writes a kept act back onto a board that lost
 * it (`readLedgeredEdgeBoard`, in mesh, so a browser leaf composes the same read). This module adds what a
 * node alone holds: the charters on its disk.
 *
 * A REALM STANDS UNDER ONE NEXUS (house reading, kapae#/edge-hands). The vessel's first act in a realm names
 * the Nexus (`actingRealmNexus`: the act's own word, else the primary charter's), the ledger keeps that word
 * (`noteVesselRealm`), and every reader takes the realm's quorum roster off THAT Nexus's charter
 * (`realmEdgeCharter`), never off the vessel's own primary one. A realm noted under no Nexus, or under one whose
 * charter this vessel holds none of, reads no quorum hand and roots no lineage.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/edge-hands
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  readLedgeredEdgeBoard, edgeLedgerDocUrl, materializeSharedLarDoc, noteRealm, ledgerRealms, ledgerRealmNexus, ledgerRealmNexuses, foundingRoster,
  NEXUS_AID_PATTERN,
  type EdgeCharter, type LarDoc, type LedgeredEdgeBoardRead,
} from "@lararium/mesh";
import { readNexusDoc } from "./nexus-doc.js";
import { charterHomeFor, primaryNexusAid, readCarriedCharters } from "./carried-set.js";

/**
 * The charter a realm's quorum hand answers to, as THIS vessel holds it: the head roster and the epoch lineage
 * of the charter of `nexusAid`, wherever this vessel keeps it (its primary home or a carried one). Null when
 * the realm stands under no Nexus here, or no seated charter of that Nexus stands here; then no quorum act counts.
 */
export function vesselEdgeCharter(scope: string, sealHome: string, nexusAid: string | null): EdgeCharter | null {
  if (nexusAid === null) return null;
  const home = charterHomeFor(sealHome, nexusAid);
  if (home === null) return null;
  const doc = readNexusDoc(home);
  const head = foundingRoster(doc);
  if (head.sealEpochCid.length === 0) return null;
  return { scope, head, sealLineage: doc?.sealLineage ?? [] };
}

/**
 * The Nexus a realm stands under at this vessel, read off a ledger: the AID its first act named. The charter's
 * own realm (named by the Nexus AID itself) stands under that Nexus.
 */
export function realmNexusIn(ledger: LarDoc | undefined | null, realm: string): string | null {
  const scope = realm.trim().toLowerCase();
  if (NEXUS_AID_PATTERN.test(scope)) return scope;
  return ledgerRealmNexus(ledger, scope);
}

/** The Nexus a realm stands under at this vessel (`realmNexusIn` over its own ledger). */
export async function readRealmNexus(repo: Repo, vesselKey: string, realm: string): Promise<string | null> {
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  return realmNexusIn(ledger.doc(), realm);
}

/** The charter a realm's quorum answers to at this vessel: the Nexus its ledger names, and that Nexus's charter. */
export async function realmEdgeCharter(repo: Repo, vesselKey: string, realm: string, sealHome: string): Promise<EdgeCharter | null> {
  return vesselEdgeCharter(realm.trim().toLowerCase(), sealHome, await readRealmNexus(repo, vesselKey, realm));
}

/**
 * The Nexus an ACT in a realm stands under: the one this vessel's ledger already names for the realm, else the
 * one the act names (`named`), else the primary charter's. Refuses (`refuse`) where the act names a Nexus other
 * than the one the realm stands under, where the ledger holds two pins that conflict (no act settles that by
 * itself), and where this vessel holds no charter of the answer.
 */
export async function actingRealmNexus(opts: {
  readonly repo:      Repo;
  readonly vesselKey: string;
  readonly realm:     string;
  readonly sealHome:  string;
  readonly named?:    string;
  readonly refuse:    (message: string) => Error;
}): Promise<string> {
  const ledger = await materializeSharedLarDoc(opts.repo, edgeLedgerDocUrl(opts.vesselKey), "ledger:edge");
  const pins = NEXUS_AID_PATTERN.test(opts.realm.trim().toLowerCase()) ? [] : ledgerRealmNexuses(ledger.doc(), opts.realm);
  if (pins.length > 1) throw opts.refuse(`realm-nexus-conflict: this vessel's ledger stands this realm under ${pins.length} Nexuses at once, and no act here picks one`);
  const noted = realmNexusIn(ledger.doc(), opts.realm);
  const named = opts.named?.trim().toLowerCase() || undefined;
  if (named !== undefined && !NEXUS_AID_PATTERN.test(named)) throw opts.refuse(`"${opts.named}" reads as no Nexus AID (nexus- and 64 hex)`);
  if (noted !== null && named !== undefined && named !== noted) {
    throw opts.refuse(`realm-under-another-nexus: this realm stands under ${noted.slice(0, 22)}… here, and an act in it answers to that Nexus alone`);
  }
  const aid = noted ?? named ?? primaryNexusAid(opts.sealHome);
  if (aid === null) throw opts.refuse("no-nexus-charter: a realm stands under a Nexus, and this vessel holds no charter — seat one (`lares nexus rite quorum`) or import one (`lares nexus seal import`)");
  if (charterHomeFor(opts.sealHome, aid) === null) throw opts.refuse(`no-nexus-charter: this vessel holds no charter of ${aid.slice(0, 22)}…, the Nexus this realm stands under`);
  return aid;
}

/**
 * The Nexus whose charter, held here, carries `epochCid` in its lineage: the primary's, else a carried one's.
 * A quorum act names the epoch it counts under, so a vessel that never acted in a realm reads off the act which
 * Nexus it answers to. Null where no charter held here carries that epoch.
 */
export function nexusOfEpoch(sealHome: string, epochCid: string): string | null {
  const carries = (doc: ReturnType<typeof readNexusDoc>): boolean => (doc?.sealLineage ?? []).some((e) => e.epochCid === epochCid);
  const primary = primaryNexusAid(sealHome);
  if (primary !== null && carries(readNexusDoc(sealHome))) return primary;
  for (const [aid, doc] of readCarriedCharters(sealHome)) if (carries(doc)) return aid;
  return null;
}

export type VesselEdgeBoardRead = LedgeredEdgeBoardRead;

/** Read one edge board as this vessel (`readLedgeredEdgeBoard`, the read every shore shares). */
export const readVesselEdgeBoard = readLedgeredEdgeBoard;

/**
 * Note in this vessel's own ledger that it reads one realm's boards (`noteRealm`), and, for an act, the Nexus the
 * realm stands under: the first act's word stands.
 */
export async function noteVesselRealm(repo: Repo, vesselKey: string, realm: string, nexusAid?: string): Promise<void> {
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  const known = ledgerRealms(ledger.doc()).includes(realm.trim().toLowerCase());
  const placed = nexusAid === undefined || ledgerRealmNexuses(ledger.doc(), realm).length > 0;
  if (!known || !placed) ledger.change((d) => { noteRealm(d, realm, nexusAid); });
}

/**
 * The realms this vessel's own ledger notes, each with the Nexus it stands under (null where no act named one),
 * and `conflict` where two pins disagree.
 */
export async function readVesselRealms(repo: Repo, vesselKey: string): Promise<readonly { readonly realm: string; readonly nexus: string | null; readonly conflict?: true }[]> {
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  const doc = ledger.doc();
  return ledgerRealms(doc).map((realm) => {
    const pins = ledgerRealmNexuses(doc, realm);
    return pins.length > 1 ? { realm, nexus: null, conflict: true as const } : { realm, nexus: pins[0] ?? null };
  });
}
