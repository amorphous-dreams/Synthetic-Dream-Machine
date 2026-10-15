/**
 * edge-fork — mutual removal, read off one board and named. Nothing here settles it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { describe, expect, test } from "vitest";
import {
  signEdgeKapae, countEdgeActs, foldEdgeReadings, forkStandsOver, forksNaming, memberEdgeId,
  type EdgeAuthority, type EdgeCharter, type EdgeKapae,
} from "../src/index.js";
import { seatedCharter, charterSeatSeeds } from "./charter-fixture.js";
import { pubOf, kahuSigners } from "./fixtures/carriage.js";

const FIX = 9107;
const SEATS = charterSeatSeeds(FIX, 0, 3);
const REALM = "cd".repeat(32);

async function world() {
  const genesis = await seatedCharter({ seats: 3, threshold: 2, seed: FIX });
  const charter: EdgeCharter = { scope: REALM, head: genesis.roster, sealLineage: [...genesis.chain] };
  const [a, b, c] = await Promise.all(SEATS.map((s) => pubOf(s)));
  const edgeOf = (key: string) => memberEdgeId(REALM, key);
  const parties = [a!, b!, c!].map((party) => ({ edgeId: edgeOf(party), party }));
  const quorum = (edgeId: string, raised: boolean, seats: readonly Uint8Array[], parents: string[] = []) =>
    kahuSigners(seats).then((signers) => signEdgeKapae({ edgeId, raised, hand: "quorum", parents, epochCid: charter.head.sealEpochCid }, signers));
  const authority = (): EdgeAuthority => ({ quorum: true });
  const read = async (acts: EdgeKapae[]) => {
    const counted = await countEdgeActs(acts, [], authority, charter);
    return forkStandsOver({ counted: counted.acts, readings: foldEdgeReadings(counted.acts), parties });
  };
  return { a: a!, b: b!, c: c!, edgeOf, quorum, read };
}

describe("mutual removal surfaces as a fork", () => {
  test("two seats that each join a raise over the other's edge read as one fork, with both acts kept", async () => {
    const w = await world();
    const overB = await w.quorum(w.edgeOf(w.b), true, [SEATS[0]!, SEATS[2]!]);   // a and c set b aside
    const overA = await w.quorum(w.edgeOf(w.a), true, [SEATS[1]!, SEATS[2]!]);   // b and c set a aside
    const forks = await w.read([overB, overA]);
    const [first, second] = [w.a, w.b].sort();
    expect(forks).toHaveLength(1);
    expect([forks[0]!.a, forks[0]!.b]).toEqual([first, second]);
    expect([...forks[0]!.overA, ...forks[0]!.overB].sort()).toEqual([overA.actCid, overB.actCid].sort());
    // The third seat signed both raises and stands under no shadow: it names both sides and belongs to neither.
    expect(forksNaming(forks, w.c)).toEqual([]);
    expect(forksNaming(forks, `0x${w.a.toUpperCase()}`)).toHaveLength(1);
  });

  test("CONTROL: a removal the other party never answered reads as no fork", async () => {
    const w = await world();
    expect(await w.read([await w.quorum(w.edgeOf(w.b), true, [SEATS[0]!, SEATS[2]!])])).toEqual([]);
  });

  test("a lift on one side ends the fork, and the other shadow stands alone", async () => {
    const w = await world();
    const overB = await w.quorum(w.edgeOf(w.b), true, [SEATS[0]!, SEATS[2]!]);
    const overA = await w.quorum(w.edgeOf(w.a), true, [SEATS[1]!, SEATS[2]!]);
    const liftA = await w.quorum(w.edgeOf(w.a), false, [SEATS[1]!, SEATS[2]!], [overA.actCid]);
    expect(await w.read([overB, overA, liftA])).toEqual([]);
  });

  test("a raise the other party did not sign names no fork, whoever else signed it", async () => {
    const w = await world();
    const overB = await w.quorum(w.edgeOf(w.b), true, [SEATS[0]!, SEATS[2]!]);   // a signs
    const overA = await w.quorum(w.edgeOf(w.a), true, [SEATS[2]!, SEATS[0]!]);   // b does not sign
    expect(await w.read([overB, overA])).toEqual([]);
  });

  test("an act that fails the count names no fork", async () => {
    const w = await world();
    const overB = await w.quorum(w.edgeOf(w.b), true, [SEATS[0]!, SEATS[2]!]);
    const short = await w.quorum(w.edgeOf(w.a), true, [SEATS[1]!]);              // one seat, under the threshold
    expect(await w.read([overB, short])).toEqual([]);
  });
  test("a seat whose raise a later raise cites signs no part of the shadow that stands", async () => {
    const w = await world();
    // b once joined a raise over a. The quorum lowered it, and a later raise over a stands without b's hand.
    const old = await w.quorum(w.edgeOf(w.a), true, [SEATS[1]!, SEATS[2]!]);                 // b signs
    const lift = await w.quorum(w.edgeOf(w.a), false, [SEATS[1]!, SEATS[2]!], [old.actCid]);
    const again = await w.quorum(w.edgeOf(w.a), true, [SEATS[2]!, SEATS[0]!], [lift.actCid]); // b does not sign
    const overB = await w.quorum(w.edgeOf(w.b), true, [SEATS[0]!, SEATS[2]!]);               // a signs
    expect(await w.read([old, lift, again, overB])).toEqual([]);
    // CONTROL: with b's raise at the head of a's line, the fork stands.
    expect(await w.read([old, overB])).toHaveLength(1);
  });
});
