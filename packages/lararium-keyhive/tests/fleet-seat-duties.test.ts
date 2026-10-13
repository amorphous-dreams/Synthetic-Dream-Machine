/**
 * fleet-seat-duties — the key side of a dyad's removal, answered over REAL Keyhive and REAL signed acts.
 *
 * The verb's caller hands in the acts it counted. The island counts them again under the fleet root its own
 * edge pins, so only an act that root signed moves a seat. Every vector carries a control.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { describe, test, expect } from "vitest";
import { deviceEdgeId, signEdgeKapae, ed25519SignerFromSeed, verifiedSeatRoll, type EdgeKapae, type SeatRoll } from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore, answerFleetSeatDuties } from "../src/index.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const ROOT_SEED = seed(0xd1), STRANGER_SEED = seed(0xd2), VESSEL_SEED = seed(0xd3);

async function stand(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: seed(fill), eventStore: new InMemoryEventStore() });
  return p;
}
/** A seed's verifying key: a provider's identifier IS its signer's verifying key. */
const pub = async (s: Uint8Array): Promise<string> => {
  const p = new KeyhiveProvider();
  await p.init({ seed: s, eventStore: new InMemoryEventStore() });
  return (await p.whoami()).replace(/^0x/, "").toLowerCase();
};
async function introduce(all: readonly KeyhiveProvider[]): Promise<void> {
  for (const a of all) for (const b of all) if (a !== b) await a.receiveContactCard(await b.contactCard());
}
async function ship(from: KeyhiveProvider, to: KeyhiveProvider): Promise<void> {
  await to.ingestPeerEvents(await from.eventsForPeer(await to.vesselIdentifierHex()));
}
const keyOf = (identifier: string): string => identifier.replace(/^0x/, "").toLowerCase();

/** A fleet: one root, a founder that holds the group, and devices it seated. */
async function fleet(base: number, devices = 2) {
  const fleetRoot = await pub(ROOT_SEED);
  const founder = await stand(base);
  const others = await Promise.all(Array.from({ length: devices }, (_, i) => stand(base + 1 + i)));
  await introduce([founder, ...others]);
  const { docIdHex } = await founder.createSentinelDoc(`lar:///test.fleet-seat/${base}`);
  const ids: string[] = [];
  for (const d of others) { const id = await d.vesselIdentifierHex(); ids.push(id); await founder.addSentinelMember(id, docIdHex); }
  const act = async (deviceId: string, raised: boolean, parents: string[] = [], by = ROOT_SEED): Promise<EdgeKapae> =>
    signEdgeKapae({ edgeId: deviceEdgeId(fleetRoot, keyOf(deviceId)), raised, hand: "holder", parents, epochCid: "no-charter" },
      [{ signer: await pub(by), sign: ed25519SignerFromSeed(by) }]);
  const holds = async (p: KeyhiveProvider, id: string) => (await p.verifySentinelMembership(id, docIdHex)).ok;
  const answer = (provider: KeyhiveProvider, acts: readonly unknown[], opts: { rolled?: string[]; own?: string[]; sink?: (r: SeatRoll) => void | Promise<void> } = {}) =>
    answerFleetSeatDuties({
      provider, facts: { fleetRoot, acts, rolled: opts.rolled ?? [] }, wornFleetRoot: fleetRoot, groupDocIdHex: docIdHex,
      ownIdentifiers: opts.own ?? [], sink: opts.sink ?? (() => undefined), signReceipt: ed25519SignerFromSeed(VESSEL_SEED),
    });
  return { fleetRoot, founder, others, ids, docIdHex, act, holds, answer };
}

describe("a counted raise moves the seat it names", () => {
  test("a device set aside leaves the group, its roll reaches the subscriber, and a seat no act names stays", async () => {
    const f = await fleet(0x10);
    const raise = await f.act(f.ids[0]!, true);
    const heard: SeatRoll[] = [];
    const out = await f.answer(f.founder, [raise], { sink: (r) => { heard.push(r); } });
    expect(await f.holds(f.founder, f.ids[0]!)).toBe(false);
    expect(await f.holds(f.founder, f.ids[1]!)).toBe(true);            // CONTROL
    expect(out.outcomes.map((o) => o.did)).toEqual(["revoked"]);
    expect(heard).toEqual([{ kind: "seat-roll", scope: f.fleetRoot, edgeId: raise.edgeId, seat: { group: f.docIdHex, member: f.ids[0]! }, raiseCids: [raise.actCid], how: "revoked" }]);
    // Each roll leaves under the vessel's own receipt: it verifies under the vessel key and under no other.
    expect(out.rolls.map(({ receipt: _r, ...roll }) => roll)).toEqual(heard);
    expect(verifiedSeatRoll(out.rolls[0], await pub(VESSEL_SEED))).toEqual(heard[0]);
    expect(verifiedSeatRoll(out.rolls[0], await pub(STRANGER_SEED))).toBeNull();
    expect(verifiedSeatRoll({ ...out.rolls[0]!, how: "gone" }, await pub(VESSEL_SEED))).toBeNull();
  });

  test("the same acts with the raise already answered owe nothing", async () => {
    const f = await fleet(0x20);
    const raise = await f.act(f.ids[0]!, true);
    await f.answer(f.founder, [raise]);
    const again = await f.answer(f.founder, [raise], { rolled: [raise.actCid] });
    expect(again.duties).toEqual([]);
    // And with the mark lost, the raise settles as answered: the seat had left already.
    const lost = await f.answer(f.founder, [raise]);
    expect(lost.outcomes.map((o) => o.did)).toEqual(["settled"]);
    expect(lost.rolls.map((r) => r.how)).toEqual(["gone"]);
  });

  test("a raise and its lift read together revoke the earlier seat, then seat the device afresh", async () => {
    const f = await fleet(0x30);
    const raise = await f.act(f.ids[0]!, true);
    const lift = await f.act(f.ids[0]!, false, [raise.actCid]);
    const order: string[] = [];
    const out = await f.answer(f.founder, [raise, lift], { sink: (r) => { order.push(`roll:${r.how}`); } });
    expect(out.outcomes).toHaveLength(1);
    expect(out.outcomes[0]!.did).toBe("revoked");
    expect(out.outcomes[0]!.fresh).toBe("seated");
    expect(order).toEqual(["roll:revoked"]);
    expect(await f.holds(f.founder, f.ids[0]!)).toBe(true);
  });
});

describe("only an act the worn fleet root signed moves a seat", () => {
  test("a raise a stranger signed moves nothing", async () => {
    const f = await fleet(0x40);
    const forged = await f.act(f.ids[0]!, true, [], STRANGER_SEED);
    const out = await f.answer(f.founder, [forged]);
    expect(out.duties).toEqual([]);
    expect(await f.holds(f.founder, f.ids[0]!)).toBe(true);
  });

  test("a typed summary with no signed act behind it moves nothing", async () => {
    const f = await fleet(0x50);
    const typed = { edgeId: deviceEdgeId(f.fleetRoot, keyOf(f.ids[0]!)), aside: true, raiseCids: ["c1".repeat(32)] };
    const relabeled = { ...(await f.act(f.ids[1]!, true)), edgeId: deviceEdgeId(f.fleetRoot, keyOf(f.ids[0]!)) };   // a true act, re-aimed
    const out = await f.answer(f.founder, [typed, relabeled]);
    expect(out.duties).toEqual([]);
    expect(await f.holds(f.founder, f.ids[0]!)).toBe(true);
  });

  test("facts that name another fleet meet a refusal", async () => {
    const f = await fleet(0x60);
    await expect(answerFleetSeatDuties({
      provider: f.founder, facts: { fleetRoot: "b2".repeat(32), acts: [], rolled: [] }, wornFleetRoot: f.fleetRoot,
      groupDocIdHex: f.docIdHex, ownIdentifiers: [], sink: () => undefined, signReceipt: ed25519SignerFromSeed(VESSEL_SEED),
    })).rejects.toThrow(/its own face's seats alone/);
  });
});

describe("a vessel under its own shadow performs no key act", () => {
  test("a shadow over this vessel's own edge forks the scope, and every seat stays", async () => {
    const f = await fleet(0x70);
    const ownId = await f.founder.vesselIdentifierHex();
    const overSelf = await f.act(ownId, true), overDevice = await f.act(f.ids[0]!, true);
    const out = await f.answer(f.founder, [overSelf, overDevice], { own: [ownId] });
    expect(out.duties).toEqual([{ kind: "forked", scope: f.fleetRoot }]);
    expect(await f.holds(f.founder, f.ids[0]!)).toBe(true);
    // CONTROL: the same raise over the device, with no shadow over this vessel, revokes it.
    const clear = await f.answer(f.founder, [overDevice], { own: [ownId] });
    expect(clear.outcomes.map((o) => o.did)).toEqual(["revoked"]);
  });

  test("a lifted shadow over this vessel's own edge names no duty for its own seat", async () => {
    const f = await fleet(0x80);
    const ownId = await f.founder.vesselIdentifierHex();
    const raise = await f.act(ownId, true), lift = await f.act(ownId, false, [raise.actCid]);
    expect((await f.answer(f.founder, [raise, lift], { own: [ownId] })).duties).toEqual([]);
  });
});

describe("revoke authority follows the seating lineage", () => {
  test("a hearth that did not seat the device says so, keeps the roll, and leaves the seat standing", async () => {
    const f = await fleet(0x90);
    const peer = f.others[1]!;                                  // seated beside the device, by the founder
    await ship(f.founder, peer);
    const raise = await f.act(f.ids[0]!, true);
    const out = await f.answer(peer, [raise], { own: [f.ids[1]!] });
    expect(out.outcomes.map((o) => o.did)).toEqual(["no-authority"]);
    expect(out.rolls.map((r) => r.how)).toEqual(["no-authority"]);
    expect(await f.holds(peer, f.ids[0]!)).toBe(true);
    // CONTROL: the hand that seated it revokes it.
    expect((await f.answer(f.founder, [raise])).outcomes.map((o) => o.did)).toEqual(["revoked"]);
  });

  test("a subscriber that refuses the roll leaves the raise owed, and the next run brings the roll again", async () => {
    const f = await fleet(0xa0);
    const raise = await f.act(f.ids[0]!, true);
    const refused = await f.answer(f.founder, [raise], { sink: () => { throw new Error("the key store stands locked"); } });
    expect(refused.outcomes.map((o) => o.did)).toEqual(["undelivered"]);
    expect(refused.rolls).toEqual([]);
    const next = await f.answer(f.founder, [raise]);
    expect(next.rolls.map((r) => r.how)).toEqual(["gone"]);       // the seat left on the first run; the roll arrives on the second
  });
});

describe("the provider says how a seat answered", () => {
  test("the seating hand revokes, a second ask finds the seat gone, a peer holds no authority, and a stranger never sat", async () => {
    const f = await fleet(0xb0);
    const peer = f.others[1]!;
    await ship(f.founder, peer);
    expect(await peer.revokeSentinelSeat(f.ids[0]!, f.docIdHex)).toEqual({ how: "no-authority" });
    expect(await f.holds(peer, f.ids[0]!)).toBe(true);
    expect(await f.founder.revokeSentinelSeat(f.ids[0]!, f.docIdHex)).toEqual({ how: "revoked" });
    expect(await f.founder.revokeSentinelSeat(f.ids[0]!, f.docIdHex)).toEqual({ how: "gone" });      // done reads as done, and throws nothing
    expect(await f.founder.revokeSentinelSeat(`0x${"7e".repeat(32)}`, f.docIdHex)).toEqual({ how: "gone" });
    expect(await f.holds(f.founder, f.ids[1]!)).toBe(true);                                             // CONTROL
  });
});
