/** A Nexus or realm lease answers to the verified seal lineage of the charter this vessel holds. */
import type { Repo } from "@automerge/automerge-repo";
import { charterHandLineage, foundingRoster, NEXUS_AID_PATTERN, type HandLineage, type KahuQuorumSeats } from "@lararium/mesh";
import { charterHomeFor } from "./carried-set.js";
import { readNexusDoc } from "./nexus-doc.js";
import { actingRealmNexus, readRealmNexus } from "./edge-board.js";

export class LeaseCharterError extends Error {
  constructor(message: string) { super(`lease-charter: ${message}`); }
}

export interface LeaseCharter {
  readonly nexus: string;
  readonly home: string;
  readonly lineage: HandLineage;
  readonly roster: KahuQuorumSeats;
}

const REALM_ID = /^[0-9a-f]{64}$/;

function heldCharter(sealHome: string, aid: string): LeaseCharter {
  const home = charterHomeFor(sealHome, aid);
  if (home === null) throw new LeaseCharterError(`no-nexus-charter: this vessel holds no charter of ${aid}`);
  const doc = readNexusDoc(home);
  const hand = charterHandLineage(doc?.sealLineage ?? []);
  if (!hand) throw new LeaseCharterError("forged-or-unreadable-lineage");
  const roster = foundingRoster(doc);
  if (!roster.sealEpochCid || roster.keys.length === 0 || roster.threshold < 1) throw new LeaseCharterError("no-seated-charter");
  if (roster.threshold !== hand.roster.threshold || roster.sealEpochCid !== hand.roster.sealEpochCid ||
      roster.keys.length !== hand.roster.keys.length ||
      [...roster.keys].map((k) => k.toLowerCase()).sort().some((k, i) => k !== hand.roster.keys[i])) {
    throw new LeaseCharterError("roster-disagrees");
  }
  return { nexus: aid, home, lineage: hand.lineage, roster };
}

/** Resolve the resource's own Nexus, with the ledger's realm pin taking precedence over a caller's name. */
export async function leaseCharterOf(opts: {
  readonly repo: Repo; readonly vesselKey: string; readonly sealHome: string;
  readonly resource: string; readonly named?: string;
}): Promise<LeaseCharter> {
  const resource = opts.resource.trim().toLowerCase();
  let aid: string;
  if (NEXUS_AID_PATTERN.test(resource)) {
    if (opts.named && opts.named.trim().toLowerCase() !== resource) throw new LeaseCharterError("realm-under-another-nexus");
    aid = resource;
  } else if (REALM_ID.test(resource)) {
    aid = await actingRealmNexus({ repo: opts.repo, vesselKey: opts.vesselKey, sealHome: opts.sealHome,
      realm: resource, ...(opts.named ? { named: opts.named } : {}), refuse: (message) => new LeaseCharterError(message) });
  } else throw new LeaseCharterError(`invalid-resource: ${opts.resource}`);
  return heldCharter(opts.sealHome, aid);
}

/** A reader with only an AID and a seal home takes no guessed lineage. */
export function leaseLineageOfNexus(sealHome: string, aid: string): HandLineage | null {
  try { return heldCharter(sealHome, aid.trim().toLowerCase()).lineage; } catch { return null; }
}

/** A realm with no ledger pin or verified charter reads no lease lineage. */
export async function leaseLineageOfRealm(repo: Repo, vesselKey: string, sealHome: string, realm: string): Promise<HandLineage | null> {
  const aid = await readRealmNexus(repo, vesselKey, realm);
  return aid === null ? null : leaseLineageOfNexus(sealHome, aid);
}
