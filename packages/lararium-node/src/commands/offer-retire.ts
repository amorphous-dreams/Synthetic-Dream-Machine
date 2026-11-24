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
 * THE WAIT, CAUSAL. The canon write lands in the daemon island's replica; this door reads its own replica of the same document.
 * A retire that follows a promotion names the heads the promotion answered (`after`), and this door waits until its replica
 * CONTAINS those heads, woken by the document's own change. A clock bounds the wait and decides nothing else: where the bound
 * runs out the answer reads `canon-trails`: the canon write stands, the retire still pends, and it names the re-run that
 * completes it. A retire that names no promotion decides on one read.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import * as A from "@automerge/automerge";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { canonOfferDocUrl, foundingRoster, materializeSharedLarDoc, retireCanonOffer, type CanonRetireOutcome, type LarDoc, type OfferSeat } from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { heldSeatSigners, type HeldQuorumSigner } from "../held-quorum.js";
import { NexusCabalError, cabalCore } from "./nexus-cabal.js";
import { nodeCanonDocUrl, nodeCanonStore } from "./canon-rows.js";

/** The longest a retire waits for its own replica of canon to contain the heads a promotion answered. It bounds the wait alone. */
export const OFFER_RETIRE_WAIT_MS = 10_000;

/**
 * THE CHARTER SEAT THIS VESSEL HOLDS, read by name and never opened: the first seat of the charter at `sealHome` this vessel holds
 * a seat row for, at the charter's head epoch, with the lineage that proves it. Null where no seated charter stands here, its
 * lineage reads empty, or the vessel holds none of its seats. The promotion's door asks it before canon moves (`offer-promote`,
 * `OfferSeat`), and the retire seals under the same seat.
 */
export function heldCharterSeat(sealHome: string): { readonly proof: OfferSeat; readonly signer: HeldQuorumSigner } | null {
  const doc = readNexusDoc(sealHome);
  const lineage = doc?.sealLineage;
  if (!doc || !lineage || lineage.length === 0) return null;
  const roster = foundingRoster(doc);
  if (roster.sealEpochCid.length === 0) return null;
  const [signer] = heldSeatSigners(roster);
  return signer === undefined ? null : { signer, proof: { key: signer.verifyingKey, epoch: roster.sealEpochCid, lineage } };
}

/**
 * Resolve true once `handle`'s document contains `heads`, woken by the document's own change; false where `waitMs` ran out first.
 * The clock bounds the wait and names nothing about canon.
 */
async function containsHeads(handle: DocHandle<LarDoc>, heads: readonly string[], waitMs: number): Promise<boolean> {
  const has = (): boolean => { const doc = handle.doc(); return doc !== undefined && A.hasHeads(doc, [...heads]); };
  if (has()) return true;
  return new Promise<boolean>((resolve) => {
    const done = (answer: boolean): void => { clearTimeout(bound); handle.off("change", onChange); resolve(answer); };
    const onChange = (): void => { if (has()) done(true); };
    const bound = setTimeout(() => done(has()), waitMs);
    handle.on("change", onChange);
  });
}

const HEAD = /^[0-9a-f]{64}$/;

/** Retire offer `cid` under this vessel's charter seat. Refuses by name where no seat is held here or canon lacks the bytes. */
export async function runOfferRetire(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly cid: string;
  readonly over?: ReadonlyArray<{ readonly title: string; readonly canon: string | null }>;
  readonly aid?: string; readonly vesselKey?: string;
  /** The catalog the held store names (`StoreDoorDeps.catalogUrl`): the Kahu realm's bag rows in it name the canon documents. */
  readonly catalogUrl?: string | undefined;
  /** The canon document's heads the promotion answered (`canonHeads`): the retire waits until this door's replica contains them. */
  readonly after?: readonly string[];
  /** The bound on that wait (default `OFFER_RETIRE_WAIT_MS`). */
  readonly waitMs?: number;
}): Promise<CanonRetireOutcome & { readonly nexus: string; readonly pending?: string }> {
  if (opts.after !== undefined && (opts.after.length === 0 || opts.after.some((h) => !HEAD.test(h)))) {
    throw new NexusCabalError("offer-retire: `after` names the canon document's heads a promotion answered (each 64 hex); it named none this door reads.");
  }
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid, opts.vesselKey);
  const lineage = readNexusDoc(core.home)?.sealLineage;
  if (!lineage || lineage.length === 0) throw new NexusCabalError("this vessel's charter carries no epoch lineage, so a retire has none to carry.");
  const [seat] = heldSeatSigners(core.roster);
  if (seat === undefined) throw new NexusCabalError("this vessel holds no seat of the charter, so it retires no offer (a seat's vessel promotes and retires it).");
  const board = await materializeSharedLarDoc(opts.repo, canonOfferDocUrl(core.nexus), "board:canon-offer");
  const docUrlOf = await nodeCanonDocUrl(opts.repo, opts.catalogUrl);
  const ports = {
    nexus: core.nexus,
    board: { doc: () => board.doc(), change: (fn: Parameters<typeof board.change>[0]) => { board.change(fn); } },
    canon: async (bag: string) => nodeCanonStore(opts.repo, docUrlOf, bag),
    steward: { key: seat.verifyingKey, sign: seat.sign, epoch: core.roster.sealEpochCid, lineage },
  };
  const after = opts.after;
  const carried = after === undefined ? undefined : async (bag: string): Promise<boolean> => {
    const url = docUrlOf(bag);
    if (url === null) return true;   // no canon document stands here: the one read below refuses by its own name
    return containsHeads(await opts.repo.find<LarDoc>(url as AutomergeUrl), after, opts.waitMs ?? OFFER_RETIRE_WAIT_MS);
  };
  const out = await retireCanonOffer({ ...ports, ...(carried ? { carried } : {}) }, { cid: opts.cid, ...(opts.over ? { over: opts.over } : {}) });
  if (!out.retired && out.why === "canon-trails") {
    return { ...out, nexus: core.nexus, pending: `the canon write stands; the retire still pends: this door's replica of canon has not yet taken the promotion's write (heads ${after!.map((h) => h.slice(0, 12)).join(", ")}…). Run \`lares meme offer promote ${out.cid}\` again to retire it: canon already carries the bytes, so it writes nothing.` };
  }
  return { ...out, nexus: core.nexus };
}
