/**
 * fleet-seat-duties — the key side of a DYAD's removal, answered where a face's group keys live (kapae#/keys).
 *
 * The vessel folds its fleet's edge board and hands in the ACTS it counted, with the raises it already answered.
 * This function trusts none of it for standing. It counts the acts AGAIN under the fleet root this island's own
 * device edge pins (`countEdgeActs`), folds them, reads the group's seats off the key shore, joins the two,
 * plans (`planSeatDuties`), and runs the plan (`runSeatDuties`).
 *
 * WHY THE ACTS, AND NEVER A SUMMARY. A verb's caller can type any summary. A raise it cannot type: only the
 * fleet root signs one, and every act here passes the root's signature and its own id before it moves a seat.
 * A caller that withholds a lift gets a seat revoked that a counted raise already owed a roll; a caller that
 * withholds a raise delays that roll until an honest read brings it. Neither mints a removal.
 *
 * A DEVICE EDGE NAMES A DEVICE BY A HASH, so the join runs from the seats: a seat's identifier IS its device's
 * verifying key, and `deviceEdgeId(fleetRoot, key)` names its edge. An edge that matches no seat here names a
 * device that already left, or one this replica never seated: its raises settle with no key act. A fresh seat
 * for a device that returned therefore rides that device's own summons (`runFaceJoin`), which alone carries
 * the card a seat needs.
 *
 * ONE FACE, ONE FLEET. The acts must count under the fleet root this island's own device edge pins. A vessel
 * answers its own face's seats alone.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import {
  countEdgeActs, foldEdgeReadings, edgeKapaeActsFromJson, fleetEdgeAuthority, deviceEdgeId, planSeatDuties, signSeatRoll,
  type SeatDuty, type SignedSeatRoll, type SeatRollSink, type SeatStanding, type SeatlessRaises,
} from "@lararium/mesh";
import { keyhiveSeatShore, runSeatDuties, type SeatDutyOutcome, type SeatShoreProvider } from "./seat-duty-executor.js";

/** What a vessel read off one fleet's edge board, as plain data a verb carries. */
export interface FleetSeatFacts {
  /** The fleet root, bare 64-hex or `0x`-prefixed. */
  readonly fleetRoot: string;
  /** The edge acts the vessel counted on that fleet's board, signatures and all. The island counts them again. */
  readonly acts:      readonly unknown[];
  /** The raises this vessel already answered on the key side (`rolledRaises`). */
  readonly rolled:    readonly string[];
}

export interface FleetSeatProvider extends SeatShoreProvider {
  sentinelCgkaMembers(sentinelDocIdHex: string): Promise<string[]>;
  verifySentinelMembership(agentIdentifierHex: string, sentinelDocIdHex: string): Promise<{ ok: boolean }>;
}

export interface FleetSeatAnswer {
  readonly fleetRoot: string;
  readonly duties:    readonly SeatDuty[];
  readonly outcomes:  readonly SeatDutyOutcome[];
  /** Every roll a subscriber took in this run, each under this vessel's own receipt: what the vessel keeps in
   *  its own ledger, one mark per raise. */
  readonly rolls:     readonly SignedSeatRoll[];
}

const HEX64 = /^[0-9a-f]{64}$/;
const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");
/** A seat's identifier reads as a device key only at the exact shape of one: 32 bytes, nothing before them. */
const deviceKeyOf = (identifier: string): string | null => { const key = bare(identifier); return HEX64.test(key) ? key : null; };

export async function answerFleetSeatDuties(input: {
  readonly provider:       FleetSeatProvider;
  readonly facts:          FleetSeatFacts;
  /** The fleet root this island's own device edge pins. */
  readonly wornFleetRoot:  string;
  /** The face's group: its sentinel id on the key shore. */
  readonly groupDocIdHex:  string;
  /** This vessel's own identifiers in the group (its veil, its vessel), and its own device key. */
  readonly ownIdentifiers: readonly string[];
  readonly sink:           SeatRollSink;
  /** Signs a roll's receipt with the vessel's own key (`ed25519SignerFromSeed(vesselSeed)`). */
  readonly signReceipt:    (bytes: Uint8Array) => Promise<string>;
}): Promise<FleetSeatAnswer> {
  const fleetRoot = bare(input.wornFleetRoot);
  if (!HEX64.test(fleetRoot) || bare(input.facts.fleetRoot) !== fleetRoot) {
    throw new Error("[seat-duties] the facts name a fleet this island's face does not belong to — a vessel answers its own face's seats alone.");
  }
  // COUNT AGAIN, HERE: only an act the worn fleet root signed moves a seat, whatever the caller says it read.
  const counted = await countEdgeActs(edgeKapaeActsFromJson(input.facts.acts), [], fleetEdgeAuthority(fleetRoot));
  const readings = foldEdgeReadings(counted.acts);
  const ownKeys = input.ownIdentifiers.map(deviceKeyOf).filter((k): k is string => k !== null);
  const ownEdges = new Set(ownKeys.map((key) => deviceEdgeId(fleetRoot, key)));
  const selfAside = [...ownEdges].some((edgeId) => readings.get(edgeId)?.stands === true);

  const seats: SeatStanding[] = [];
  // A raise over this vessel's OWN edge names this vessel as the party: it answers none of those, by any row.
  const matched = new Set<string>(ownEdges);
  for (const member of await input.provider.sentinelCgkaMembers(input.groupDocIdHex)) {
    const key = deviceKeyOf(member);
    if (key === null || ownKeys.includes(key)) continue;
    const edgeId = deviceEdgeId(fleetRoot, key);
    const reading = readings.get(edgeId);
    if (!reading) continue;                                 // a seat no counted act names owes nothing
    matched.add(edgeId);
    const seatStands = (await input.provider.verifySentinelMembership(member, input.groupDocIdHex)).ok;
    seats.push({ scope: fleetRoot, edgeId, seat: { group: input.groupDocIdHex, member }, aside: reading.stands, raiseCids: reading.raiseCids, seatStands });
  }
  const seatless: SeatlessRaises[] = [...readings].filter(([edgeId, r]) => !matched.has(edgeId) && r.raiseCids.length > 0)
    .map(([edgeId, r]) => ({ scope: fleetRoot, edgeId, raiseCids: r.raiseCids }));
  const rolled = new Set(input.facts.rolled.filter((c): c is string => typeof c === "string"));
  const duties = planSeatDuties({ seats, seatless, rolled: () => rolled, selfAside: () => selfAside });
  const rolls: SignedSeatRoll[] = [];
  const outcomes = await runSeatDuties(keyhiveSeatShore(input.provider), duties, async (roll) => {
    await input.sink(roll);
    rolls.push(await signSeatRoll(roll, input.signReceipt));
  });
  return { fleetRoot, duties, outcomes, rolls };
}
