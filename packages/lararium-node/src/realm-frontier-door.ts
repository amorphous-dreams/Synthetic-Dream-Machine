/** Realm frontier writers sign before the board change and land their act with its signed head. */
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  prepareRealmFrontier, registerRealmFrontierInto,
  readRealmFrontier, realmRaiseCids, readFrontierPins, writeFrontierPin, REALM_HAND,
  type LarDoc, type EdgeKapae, type HandLineage, type WideningRead,
} from "@lararium/mesh";
import { leaseCharterOf } from "./lease-charter.js";
export { prepareRealmFrontier, registerRealmFrontierInto, type PreparedRealmFrontier } from "@lararium/mesh";
import { heldSeatSigners } from "./held-quorum.js";

/** One realm read for both the ring and admission; only a known head raises this vessel's pin. */
export function readVesselRealmFrontier(input: {
  readonly realm: string; readonly board: LarDoc | undefined | null; readonly ledger: LarDoc | undefined | null;
  readonly lineage: HandLineage | null; readonly counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand">[];
}): WideningRead {
  if (!input.lineage) return { status: "unknown", missing: [{ hand: REALM_HAND, why: "no-frontier" }] };
  return readRealmFrontier({ realm: input.realm, board: input.board, lineage: input.lineage,
    seenRaises: realmRaiseCids(input.counted), pinned: readFrontierPins(input.ledger, input.realm)[REALM_HAND] ?? null });
}

/** A holder with fewer than k seats signs nothing; the board awaits a seated vessel's frontier. */
export async function registerRealmFrontier(input: {
  readonly repo: Repo; readonly vesselKey: string; readonly sealHome: string; readonly realm: string;
  readonly nexus?: string; readonly handle: DocHandle<LarDoc>; readonly counted: readonly string[];
}): Promise<{ landed: boolean; why?: "seats-not-held" }> {
  const charter = await leaseCharterOf({ repo: input.repo, vesselKey: input.vesselKey, sealHome: input.sealHome,
    resource: input.realm, ...(input.nexus ? { named: input.nexus } : {}) });
  const held = heldSeatSigners(charter.roster);
  if (held.length < charter.roster.threshold) return { landed: false, why: "seats-not-held" };
  const prepared = await prepareRealmFrontier({ realm: input.realm, board: input.handle.doc(), lineage: charter.lineage,
    counted: input.counted, signers: held.slice(0, charter.roster.threshold).map((s) => ({ key: s.verifyingKey, sign: s.sign })) });
  if (prepared.kind === "none") return { landed: false };
  input.handle.change((draft) => { registerRealmFrontierInto(draft, prepared); });
  return { landed: true };
}

/** Raise a known frontier pin in the ledger after the read. */
export function pinRealmFrontier(ledger: DocHandle<LarDoc>, realm: string, read: WideningRead): void {
  if (read.status === "known") ledger.change((draft) => { writeFrontierPin(draft, realm, REALM_HAND, read.asOf[REALM_HAND]!); });
}
