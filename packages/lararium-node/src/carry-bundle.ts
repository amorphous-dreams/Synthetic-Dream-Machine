/**
 * carry-bundle — a herm's EXPLICIT JOIN, carried by hand: the quorum's counted `carry` over the herm's own vessel key, its
 * counted causal past, and the place floor-pin statements the issuing hearth's board carries. The herm's take writes them
 * onto its OWN replica of that Nexus's carriage board, so its own fold counts it carried there (`placeCarriedNexuses`,
 * `via: "carrier-seal"`) and its floor gate stands at that Nexus and only there (house reading "Only there").
 *
 * WHY BY HAND. The herm membership relay (herm → hearth board sync) stays shut, so the carry act never crosses a wire to
 * the herm it names. The admit bundle travels the same way for an operator (`admit-bundle`); this is its twin for a place.
 *
 * WHAT IT HOLDS — public bytes only:
 *   · `contract`  — the quorum-signed `carry` naming the herm's vessel key (the board's carry head for it);
 *   · `lineage`   — that act's counted causal past (`placeArmFor`);
 *   · `floorPins` — every place floor-pin statement the hearth's board carried at the write, the herm's own among them.
 *
 * THE TAKE refuses, writing nothing, unless the herm holds a charter for the AID, every act COUNTS under that charter's
 * seated roster, the contract names THIS vessel's own key, and the union of its own board and the bundle reads a place arm
 * for its key. A floor-pin statement lands only where it reads under the carrier set that union folds (a stranger's pin,
 * a forged one, or one for another Nexus lands nowhere: house reading "The herm's floor pin").
 *
 * Meme: lar:///ha.ka.ba/lararium/node/carry-bundle
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  carriageDocUrl, carriageEntriesFromBoard, carriageEntryActCid, carriageEntryCounts, coerceCarriageEntry, foldCarrierSet,
  foundingRoster, materializeSharedLarDoc, placeArmFor, placeFloorPinsFromBoard, readPlaceFloorPin, writeCarriageEntry,
  writePlaceFloorPin, NEXUS_AID_PATTERN, ORACLE_SOCKET_ROUTE,
  type CarriageEntry, type PlaceFloorPinStatement,
} from "@lararium/mesh";
import { charterHomeFor } from "./carried-set.js";
import { readNexusDoc } from "./nexus-doc.js";
import { nodeNexusIsland } from "./nexus-standing.js";

export const CARRY_BUNDLE_KIND = "lar/carry-bundle/v1" as const;

/** A refusal the CLI renders as a clean message. Nothing was written when one is thrown. */
export class CarryBundleError extends Error {}

export interface CarryBundle {
  readonly kind:      typeof CARRY_BUNDLE_KIND;
  readonly aid:       string;
  readonly contract:  CarriageEntry;
  readonly lineage:   readonly CarriageEntry[];
  readonly floorPins: readonly unknown[];
}

/** The bundle a hearth hands a herm it just carried: the arm off its own board, and the board's statements. */
export async function carryBundleFrom(opts: {
  readonly aid: string; readonly nym: string; readonly board: Parameters<typeof carriageEntriesFromBoard>[0];
  readonly roster: Parameters<typeof placeArmFor>[1];
}): Promise<CarryBundle | null> {
  const arm = await placeArmFor(carriageEntriesFromBoard(opts.board), opts.roster, opts.nym);
  if (arm === null) return null;
  return { kind: CARRY_BUNDLE_KIND, aid: opts.aid, contract: arm.contract, lineage: arm.lineage, floorPins: placeFloorPinsFromBoard(opts.board) };
}

export interface CarryTakeResult {
  readonly aid:        string;
  readonly nym:        string;
  readonly carryCid:   string;
  readonly lineage:    number;
  /** The place keys whose floor-pin statements landed on this vessel's replica. */
  readonly floorPins:  readonly string[];
  readonly boardUrl:   string;
}

/** Take a carry bundle onto this vessel's own replica of the Nexus's carriage board. REFUSES, writing nothing, as the header says. */
export async function takeCarryBundle(opts: {
  readonly sealHome:     string;
  readonly repo:         Repo;
  readonly raw:          string;
  readonly ownVesselKey: string;
}): Promise<CarryTakeResult> {
  let parsed: unknown;
  try { parsed = JSON.parse(opts.raw); } catch {
    throw new CarryBundleError("the carry bundle does not parse as JSON — take the file `lares nexus carry --json` wrote, whole.");
  }
  const b = (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
  const aid = typeof b["aid"] === "string" ? b["aid"] : "";
  const contract = coerceCarriageEntry(b["contract"]);
  const lineage = Array.isArray(b["lineage"]) ? b["lineage"].map(coerceCarriageEntry) : null;
  const floorPins = Array.isArray(b["floorPins"]) ? b["floorPins"] : null;
  if (b["kind"] !== CARRY_BUNDLE_KIND || !NEXUS_AID_PATTERN.test(aid) || aid.includes("..") || contract === null
    || lineage === null || lineage.some((e) => e === null) || floorPins === null) {
    throw new CarryBundleError("the carry bundle is malformed — it needs its kind, an `aid`, the quorum's `carry` contract, its lineage and the floor pins.");
  }
  const own = opts.ownVesselKey.toLowerCase();
  if (contract.action !== "carry" || contract.nym.toLowerCase() !== own) {
    throw new CarryBundleError(`the bundle's contract carries ${contract.nym.slice(0, 16)}…, not this vessel's key — another place's carry grants this one nothing. Nothing was written.`);
  }
  const home = charterHomeFor(opts.sealHome, aid);
  if (home === null) throw new CarryBundleError(`this vessel holds no charter for ${aid.slice(0, 18)}… — import it (\`lares nexus seal import\`) before taking its carry.`);
  const roster = foundingRoster(readNexusDoc(home));
  if (roster.sealEpochCid.length === 0) throw new CarryBundleError("the held charter seats no quorum — no carry can count under it. Nothing was written.");
  const acts = [contract, ...(lineage as CarriageEntry[])];
  for (const act of acts) {
    if (!(await carriageEntryCounts(act, roster))) {
      throw new CarryBundleError(`an act of the bundle (${carriageEntryActCid(act).slice(0, 12)}…) does not COUNT under the seated roster this vessel holds. Nothing was written.`);
    }
  }
  const island = nodeNexusIsland({ ownVesselKey: opts.ownVesselKey, sealHome: home });
  const boardUrl = carriageDocUrl(island);
  const handle = await materializeSharedLarDoc(opts.repo, boardUrl, "board:carriage-contracts");
  const union = [...carriageEntriesFromBoard(handle.doc()), ...acts];
  if ((await placeArmFor(union, roster, own)) === null) {
    throw new CarryBundleError("the bundle's carry does not head this vessel's relation on its own replica (an uncarry descends from it, or its past does not chain). Nothing was written.");
  }
  const carriers = await foldCarrierSet(union, roster);
  const nexusHex = Buffer.from(aid, "utf8").toString("hex");
  const landing: PlaceFloorPinStatement[] = [];
  for (const raw of floorPins) {
    const read = readPlaceFloorPin(raw, { nexusHex, route: ORACLE_SOCKET_ROUTE, carriers });
    if (!("refusal" in read)) landing.push(raw as PlaceFloorPinStatement);
  }
  handle.change((d) => {
    for (const act of acts) writeCarriageEntry(d, act);
    for (const s of landing) writePlaceFloorPin(d, s);
  });
  await opts.repo.flush().catch(() => { /* best effort */ });
  return { aid, nym: own, carryCid: carriageEntryActCid(contract), lineage: lineage.length, floorPins: landing.map((s) => s.placeKey), boardUrl };
}
