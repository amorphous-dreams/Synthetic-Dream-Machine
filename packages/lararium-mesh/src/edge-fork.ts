/**
 * edge-fork — MUTUAL REMOVAL, SURFACED (kapae#/keys).
 *
 * Two parties may each set the other aside before either reads the other's act. No rule prevents that and none
 * picks a winner: both signed acts stay, both shadows hold, and the place lands in a LEGIBLE state. This module
 * reads that state off one board and names it. Surfacing belongs to the code; deciding which side stays
 * legitimate belongs to the humans (cabal-realm#the-unswept-corner).
 *
 * WHAT COUNTS AS A FORK HERE. Two parties, each with an edge that names it, where a shadow stands over each
 * party's edge and the OTHER party signed a counted raise that heads that shadow's line. A quorum raise carries every
 * seat that signed it, so a seat that joined a raise over another seat's member edge reads as one of its hands.
 * A shadow no named party signed reads as a plain removal and no fork.
 *
 * NOTHING SETTLES HERE. The reading names the two parties and the acts on each side. It ranks neither, lifts
 * nothing, and moves no key; the planner keeps a vessel that reads a shadow over its own edge from minting a
 * key epoch (`planSeatDuties`), and the exit runs through an explicit fork.
 *
 * Platform-blind: rides ./edge-kapae types. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { edgeLineHeads, type EdgeKapae, type EdgeReading } from "./edge-kapae.js";

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

/** One edge and the party it sets aside, as the reader itself names them (a member, a joiner, a device). */
export interface EdgeParty {
  readonly edgeId: string;
  /** The party's key, the same key it signs with. */
  readonly party:  string;
}

/** Two parties that each stand set aside under a raise the other signed. `a` sorts before `b`. */
export interface ForkStanding {
  readonly a:     string;
  readonly b:     string;
  /** The counted raises over `a`'s edges that `b` signed, sorted. */
  readonly overA: readonly string[];
  /** The counted raises over `b`'s edges that `a` signed, sorted. */
  readonly overB: readonly string[];
}

/**
 * Every mutual removal one board shows, as this replica reads it. `counted` holds acts that passed
 * `countEdgeActs`, so each signature here verified under a hand that holds its edge.
 */
export function forkStandsOver(input: {
  readonly counted:  readonly EdgeKapae[];
  readonly readings: ReadonlyMap<string, EdgeReading>;
  readonly parties:  readonly EdgeParty[];
}): ForkStanding[] {
  const partyOf = new Map<string, string>();
  for (const p of input.parties) partyOf.set(p.edgeId, bare(p.party));
  // party → (signer → the raises that signer put over the party's edges), over edges whose shadow stands.
  const over = new Map<string, Map<string, Set<string>>>();
  // THE STANDING FRONTIER ALONE. A raise holds a party aside only while it heads its own hand's line: a raise a
  // later act cites sits in the past, and the hands that signed it then sign no part of the shadow that stands.
  const heads = new Map<string, Set<string>>();
  const headsOf = (edgeId: string, hand: EdgeKapae["hand"]): Set<string> => {
    const key = `${edgeId}/${hand}`;
    return heads.get(key) ?? (heads.set(key, new Set(edgeLineHeads(input.counted, edgeId, hand))), heads.get(key)!);
  };
  for (const act of input.counted) {
    if (!act.raised) continue;
    const party = partyOf.get(act.edgeId);
    if (party === undefined) continue;
    const reading = input.readings.get(act.edgeId);
    // Only a hand whose own reading still stands holds the party aside: a raise its own hand lifted sets nobody aside.
    const handVerdict = act.hand === "holder" ? reading?.holder : reading?.quorum;
    if (reading?.stands !== true || handVerdict === undefined || handVerdict === "withdrawn") continue;
    if (!headsOf(act.edgeId, act.hand).has(act.actCid)) continue;
    const bySigner = over.get(party) ?? new Map<string, Set<string>>();
    over.set(party, bySigner);
    for (const s of act.signatures) {
      const signer = bare(s.signer);
      if (signer === party) continue;                        // a party never forks with itself
      (bySigner.get(signer) ?? (bySigner.set(signer, new Set()), bySigner.get(signer)!)).add(act.actCid);
    }
  }
  const out: ForkStanding[] = [];
  const parties = [...over.keys()].sort();
  for (let i = 0; i < parties.length; i++) {
    for (let j = i + 1; j < parties.length; j++) {
      const a = parties[i]!, b = parties[j]!;
      const overA = over.get(a)!.get(b), overB = over.get(b)!.get(a);
      if (!overA || !overB) continue;
      out.push({ a, b, overA: [...overA].sort(), overB: [...overB].sort() });
    }
  }
  return out;
}

/** The forks that name one party: what that party's own doors show. */
export function forksNaming(forks: readonly ForkStanding[], party: string): ForkStanding[] {
  const key = bare(party);
  return forks.filter((f) => f.a === key || f.b === key);
}
