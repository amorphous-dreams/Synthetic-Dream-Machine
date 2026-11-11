/**
 * offer-retire — the second half of `lares meme offer promote`: a seat of the Nexus's charter retires an offer whose bytes canon
 * now carries (`@lararium/mesh` `retireCanonOffer`, offering#/the-canon-offer).
 *
 * WHY HERE. A retire counts only where a charter seat sealed it, its epoch lineage riding the record the way a floor release's
 * does, so every reader proves the seat off the record alone and a retire any other key sealed reads `retire-unauthorised`. The
 * seat keys rest in this vault (`heldSeatSigners`), beside the store door, never in the daemon island that writes canon; so the
 * canon write rides the daemon verb (`offer-promote`, under the Kahu reach) and the retire rides this row.
 *
 * The ports: the offer table (`canonOfferDocUrl`) and the canon documents (the Kahu realm's bag rows in this vessel's catalog), both
 * on the Repo this door holds; the steward is the first held seat of the charter, at its head epoch.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import type { Repo } from "@automerge/automerge-repo";
import { canonOfferDocUrl, materializeSharedLarDoc, retireCanonOffer, type CanonRetireOutcome } from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { heldSeatSigners } from "../held-quorum.js";
import { NexusCabalError, cabalCore } from "./nexus-cabal.js";
import { nodeCanonDocUrl, nodeCanonStore } from "./floor-cut.js";

/** Retire offer `cid` under this vessel's charter seat. Refuses by name where no seat is held here or canon lacks the bytes. */
export async function runOfferRetire(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly cid: string;
  readonly over?: ReadonlyArray<{ readonly title: string; readonly canon: string | null }>;
  readonly aid?: string; readonly vesselKey?: string;
}): Promise<CanonRetireOutcome & { readonly nexus: string }> {
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid, opts.vesselKey);
  const lineage = readNexusDoc(core.home)?.sealLineage;
  if (!lineage || lineage.length === 0) throw new NexusCabalError("this vessel's charter carries no epoch lineage, so a retire has none to carry.");
  const [seat] = heldSeatSigners(core.roster);
  if (seat === undefined) throw new NexusCabalError("this vessel holds no seat of the charter, so it retires no offer (the canon write stands; a seat's vessel retires it).");
  const board = await materializeSharedLarDoc(opts.repo, canonOfferDocUrl(core.nexus), "board:canon-offer");
  const docUrlOf = await nodeCanonDocUrl(opts.repo);
  const out = await retireCanonOffer({
    nexus: core.nexus,
    board: { doc: () => board.doc(), change: (fn) => { board.change(fn); } },
    canon: async (bag) => nodeCanonStore(opts.repo, docUrlOf, bag),
    steward: { key: seat.verifyingKey, sign: seat.sign, epoch: core.roster.sealEpochCid, lineage },
  }, { cid: opts.cid, ...(opts.over ? { over: opts.over } : {}) });
  return { ...out, nexus: core.nexus };
}
