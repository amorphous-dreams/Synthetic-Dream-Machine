/**
 * nexus-cabal — the door that admits a PersonaGroup into a Nexus's Kahu cabal, as its own authority act at the
 * seat quorum (`@lararium/mesh` `kahu-cabal-admission`), and reads where one group stands.
 *
 * TWO HANDS, ONE ON EACH VESSEL WHERE THE SEATS REST APART. `runCabalAct` opens the act and signs with every
 * seat this vessel holds; where those seats meet the high-impact threshold the act lands on the Nexus's
 * carriage board, and short of it the door hands back a PARTIAL for a person to carry. `runCabalCosign` reads a
 * partial on another seat's vessel, judges it against that vessel's OWN charter head, adds the seats it holds,
 * and lands the act once it counts. A person confirms each cosign by naming the act's CID, as the edge cosign
 * door asks; no seat signs for another, and no session signs at all.
 *
 * WHERE THE ACT RESTS. The Nexus's carriage board, which every member already carries, under the act's own
 * prefix: the carriage reader skips it by kind, so no carriage fold ever reads it.
 *
 * WHAT IT NEVER DOES. It writes no Keyhive membership: the sentinel add stays its own capability act, and the
 * access path to shared canon reads both facts apart (`kahuCabalCanonAccess`). A vouch never reaches here.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  carriageDocUrl, materializeSharedLarDoc, foundingRoster, nexusAidOf,
  openKahuCabalAct, signKahuCabalAct, kahuCabalActCounts, kahuCabalActCid, kahuCabalStanding,
  kahuCabalActsFromBoard, writeKahuCabalAct, readKahuCabalAct, rollAnchorsFromBoard,
  type KahuCabalAct, type KahuCabalAction, type KahuCabalStanding, type KahuQuorumSeats,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { charterHomeFor } from "../carried-set.js";
import { heldSeatSigners } from "../held-quorum.js";

export class NexusCabalError extends Error {}

const HEX64 = /^[0-9a-f]{64}$/;

/** What one hand of the act answers: the act as it stands, whether it landed, and its count. */
export interface NexusCabalActResult {
  readonly nexus:     string;
  readonly act:       KahuCabalAct;
  readonly actCid:    string;
  /** True once the act counted and rests on the board; false hands back a partial to carry. */
  readonly landed:    boolean;
  readonly seated:    number;
  readonly threshold: number;
  /** The seats THIS vessel added. */
  readonly signedHere: readonly string[];
}

interface CabalCore {
  readonly home:   string;
  readonly nexus:  string;
  readonly roster: KahuQuorumSeats;
  readonly sealLineage: NonNullable<ReturnType<typeof readNexusDoc>>["sealLineage"];
  readonly handle: Awaited<ReturnType<typeof materializeSharedLarDoc>>;
}

async function cabalCore(repo: Repo, sealHome: string, aid: string | undefined): Promise<CabalCore> {
  let home = sealHome;
  if (aid !== undefined) {
    const held = charterHomeFor(sealHome, aid.trim().toLowerCase());
    if (held === null) throw new NexusCabalError(`this vessel holds no charter for ${aid.slice(0, 18)}… — import or found it first.`);
    home = held;
  }
  const doc = readNexusDoc(home);
  const roster = foundingRoster(doc);
  const nexus = nexusAidOf(doc);
  if (roster.sealEpochCid.length === 0 || nexus === null) {
    throw new NexusCabalError("no seated charter stands here — a cabal admission takes the charter's seat quorum.");
  }
  const ownVesselKey = await loadVesselVerifyingKey();
  const boardUrl = carriageDocUrl(nodeNexusIsland({ ownVesselKey, sealHome: home }));
  const handle = await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts");
  return { home, nexus, roster, sealLineage: doc?.sealLineage, handle };
}

/** Sign with the seats held here, then land the act where it counts. */
async function signAndMaybeLand(core: CabalCore, carried: KahuCabalAct): Promise<NexusCabalActResult> {
  // Only carried signatures that verify name a seat as signed: a forged one under a seat held here never
  // locks that seat out.
  const act = await signKahuCabalAct(carried, [], core.roster);
  const before = new Set(act.signatures.map((s) => s.signer));
  const held = heldSeatSigners(core.roster, before).map((s) => ({ signer: s.verifyingKey, sign: s.sign }));
  const signed = await signKahuCabalAct(act, held, core.roster);
  const count = kahuCabalActCounts(signed, core.roster, core.nexus);
  if (count.reason !== "seat-quorum-counted" && count.reason !== "below-seat-quorum") {
    throw new NexusCabalError(`the act counts nothing here: ${count.reason}`);
  }
  if (count.counted) core.handle.change((draft) => writeKahuCabalAct(draft, signed));
  return {
    nexus: core.nexus, act: signed, actCid: kahuCabalActCid(signed), landed: count.counted,
    seated: count.seated ?? 0, threshold: count.threshold ?? 0,
    signedHere: signed.signatures.map((s) => s.signer).filter((k) => !before.has(k)),
  };
}

/**
 * Open an admission or a removal of `group` in the named (or primary) Nexus and sign it with every seat held
 * here. A removal cites the group's standing heads; an admission cites them too, so a re-admission after a
 * removal descends from it. Refuses a vessel that holds no seat of the charter.
 */
export async function runCabalAct(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly group: string; readonly action: KahuCabalAction; readonly aid?: string;
}): Promise<NexusCabalActResult> {
  const group = opts.group.trim().toLowerCase();
  if (!HEX64.test(group)) throw new NexusCabalError(`"${opts.group}" reads as no PersonaGroup id — expected 64 hex.`);
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid);
  if (heldSeatSigners(core.roster).length === 0) {
    throw new NexusCabalError("this vessel holds no seat of the charter — only the seats admit, and a vouch admits nobody.");
  }
  const { heads } = kahuCabalStanding(kahuCabalActsFromBoard(core.handle.doc()), group, core.roster, core.nexus,
    { sealLineage: core.sealLineage ?? [], anchors: rollAnchorsFromBoard(core.handle.doc()) });
  const act = openKahuCabalAct({ nexus: core.nexus, group, action: opts.action, parents: heads, roster: core.roster });
  return signAndMaybeLand(core, act);
}

/**
 * Cosign a carried partial: judged against THIS vessel's own charter head, confirmed by the act's CID a person
 * names, then signed with the seats held here and landed once it counts.
 */
export async function runCabalCosign(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly partial: unknown; readonly confirmActCid: string; readonly aid?: string;
}): Promise<NexusCabalActResult> {
  const act = readKahuCabalAct(opts.partial);
  if (act === null) throw new NexusCabalError("the file carries no cabal admission act — a vouch or any other record admits nobody.");
  const actCid = kahuCabalActCid(act);
  if (opts.confirmActCid.trim().toLowerCase() !== actCid) {
    throw new NexusCabalError(`the confirmation names another act — this partial carries ${actCid}; read it aloud and confirm that one.`);
  }
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid);
  if (act.nexus !== core.nexus) throw new NexusCabalError("the partial names another Nexus than the charter it reads here.");
  if (act.sealEpochCid !== core.roster.sealEpochCid) {
    throw new NexusCabalError("the partial roots on another charter epoch than this vessel's head — open a fresh act at the head.");
  }
  return signAndMaybeLand(core, act);
}

/** Where one group stands in the cabal, read off this vessel's board as of its last sync. */
export async function runCabalStanding(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly group: string; readonly aid?: string;
}): Promise<{ readonly nexus: string; readonly group: string; readonly standing: KahuCabalStanding; readonly heads: readonly string[] }> {
  const group = opts.group.trim().toLowerCase();
  if (!HEX64.test(group)) throw new NexusCabalError(`"${opts.group}" reads as no PersonaGroup id — expected 64 hex.`);
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid);
  const { standing, heads } = kahuCabalStanding(kahuCabalActsFromBoard(core.handle.doc()), group, core.roster, core.nexus,
    { sealLineage: core.sealLineage ?? [], anchors: rollAnchorsFromBoard(core.handle.doc()) });
  return { nexus: core.nexus, group, standing, heads };
}
