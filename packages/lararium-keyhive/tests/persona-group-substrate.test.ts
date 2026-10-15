/**
 * persona-group-substrate — THE PERSONAGROUP AS A KEYHIVE GROUP, measured through the provider's group surface
 * (kapae#/keys; roadmap loop `K12`).
 *
 * The face's key group founds as a Keyhive GROUP (`createGroup`), where a sentinel Document stood before. These
 * vectors re-run the substrate probe's readings (`seat-roll-substrate.probe.test.ts`) through the surface every
 * production caller rides:
 *
 *   G1  a group's id names its agent: one value serves as membership target and as a bag's audience.
 *   G2  revoke authority follows the seating lineage: the seating hand revokes, a peer beside holds none, and a
 *       second ask finds the seat gone.
 *   G3  a junior never revokes the founder.
 *   G4  THE ROLL: a revocation rolls the key of a bag the group reaches, forward only (G9 its control).
 *   G5  a seat reaches a bag the group already held with no re-delegation; only the chunks before it stay shut.
 *   G6  the members the group reaches, and a revoked party gone from them.
 *   G7  an id that names no group refuses by name, never as an empty answer.
 *   G8  CANARY: the founder's own departure while it seated others throws, and its seat leaves anyway.
 *   G10 a Document's read on a group id answers "no access" in silence: the reason the group surface stands apart.
 *   G11 a party that reaches the group only through a member group holds no seat here: its revoke reads `gone`
 *       and moves nothing, while the member group's own seat revokes.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const enc = (s: string) => new TextEncoder().encode(s);

async function stand(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
async function introduce(all: readonly KeyhiveProvider[]): Promise<void> {
  for (const a of all) for (const b of all) if (a !== b) await a.receiveContactCard(await b.contactCard());
}
async function ship(from: KeyhiveProvider, to: KeyhiveProvider): Promise<void> {
  await to.ingestPeerEvents(await from.eventsForPeer(await to.vesselIdentifierHex()));
}

/** A founder `f` and four parties, everyone knowing everyone's card, and a fresh group `f` founded. */
async function found(base: number) {
  const f = await stand(base), a = await stand(base + 1), b = await stand(base + 2), c = await stand(base + 3), d = await stand(base + 4);
  await introduce([f, a, b, c, d]);
  const { groupId } = await f.createGroup();
  const ids = {
    f: await f.vesselIdentifierHex(), a: await a.vesselIdentifierHex(), b: await b.vesselIdentifierHex(),
    c: await c.vesselIdentifierHex(), d: await d.vesselIdentifierHex(),
  };
  return { f, a, b, c, d, groupId, ids };
}

/** The founder seats `a` and `b`; `a` seats `c`. So `f` and `a` stand upstream of `c`, and `b` beside it. */
async function lineage(base: number) {
  const w = await found(base);
  const { f, a, b, c, groupId, ids } = w;
  await f.addGroupMember(ids.a, groupId);
  await f.addGroupMember(ids.b, groupId);
  await ship(f, a);
  await a.addGroupMember(ids.c, groupId);
  for (const [from, to] of [[a, f], [f, b], [a, b], [f, c], [a, c]] as const) await ship(from, to);
  return w;
}

const BAG = "lar:///probe.persona-group/a-bag-the-group-reaches";
const opens = (p: KeyhiveProvider, ct: Uint8Array) => p.decryptContent(BAG, ct).then(() => true, () => false);

/** `f` registers the bag and delegates it at read to the group; `sync` ships `f`'s events and the bag's mapping. */
async function bagUnderGroup(w: Awaited<ReturnType<typeof found>>) {
  const { docId } = await w.f.registerBag(BAG);
  await w.f.delegate({ bagUrl: BAG, audience: w.groupId, access: "read" });
  const sync = async (...to: KeyhiveProvider[]) => { for (const p of to) { await ship(w.f, p); p.adoptBag(BAG, docId); } };
  return { docId, sync };
}

describe("the PersonaGroup as a Keyhive group", () => {
  test("G1: a group's id answers 0x-hex and names its agent", async () => {
    const { f, groupId } = await found(0x10);
    expect(groupId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await f.knowsAgent(groupId)).toBe(true);
  });

  test("G2: revoke authority follows the seating lineage", async () => {
    const { f, a, b, groupId, ids } = await lineage(0x20);
    expect((await b.verifyGroupMembership(ids.c, groupId)).ok).toBe(true);      // b sees the seat it cannot touch
    expect(await b.revokeGroupSeat(ids.c, groupId)).toEqual({ how: "no-authority" });
    expect((await b.verifyGroupMembership(ids.c, groupId)).ok).toBe(true);      // the refusal moved nothing
    expect(await a.revokeGroupSeat(ids.c, groupId)).toEqual({ how: "revoked" });
    await ship(a, f);
    expect(await f.revokeGroupSeat(ids.c, groupId)).toEqual({ how: "gone" });   // a second ask finds the seat gone
    expect(await f.revokeGroupSeat(ids.d, groupId)).toEqual({ how: "gone" });   // a stranger never sat
  });

  test("G3: a junior never revokes the founder", async () => {
    const { a, groupId, ids } = await lineage(0x30);
    expect(await a.revokeGroupSeat(ids.f, groupId)).toEqual({ how: "no-authority" });
    expect((await a.verifyGroupMembership(ids.f, groupId)).ok).toBe(true);
  });

  test("G4: THE ROLL — a revocation rolls the key of a bag the group reaches, forward only", async () => {
    const w = await found(0x40);
    const { f, c, d, groupId, ids } = w;
    await f.addGroupMember(ids.c, groupId);
    await f.addGroupMember(ids.d, groupId);
    const { sync } = await bagUnderGroup(w);
    const before = await f.encryptContent(BAG, enc("sealed while c stood"));
    await sync(c, d);
    expect(await opens(c, before)).toBe(true);
    expect(await f.revokeGroupSeat(ids.c, groupId)).toEqual({ how: "revoked" });
    const after = await f.encryptContent(BAG, enc("sealed after c left"));
    await sync(c, d);
    expect(await opens(c, after)).toBe(false);                                  // the removed party opens nothing new
    expect(await opens(d, after)).toBe(true);                                   // a member that stayed reads on
    expect(await opens(c, before)).toBe(true);                                  // forward only: it keeps what it read
  });

  test("G9 CONTROL for G4: with no revocation the same flow keeps opening", async () => {
    const w = await found(0x90);
    const { f, c, d, groupId, ids } = w;
    await f.addGroupMember(ids.c, groupId);
    await f.addGroupMember(ids.d, groupId);
    const { sync } = await bagUnderGroup(w);
    await sync(c, d);
    const after = await f.encryptContent(BAG, enc("sealed with no revocation"));
    await sync(c, d);
    expect(await opens(c, after)).toBe(true);
    expect(await opens(d, after)).toBe(true);
  });

  test("G5: a seat reaches a bag the group already held with no re-delegation; the chunks before it stay shut", async () => {
    const w = await found(0x50);
    const { f, d, groupId, ids } = w;
    const { sync } = await bagUnderGroup(w);
    const before = await f.encryptContent(BAG, enc("sealed before d sat"));
    await f.addGroupMember(ids.d, groupId);
    const after = await f.encryptContent(BAG, enc("sealed after d sat"));
    await sync(d);
    expect(await opens(d, after)).toBe(true);
    expect(await opens(d, before)).toBe(false);                                 // only a re-seal carries these across
  });

  test("G6: the members a group reaches, its founder included, and a revoked party gone from them", async () => {
    const { f, a, groupId, ids } = await lineage(0x60);
    expect(new Set(await f.groupMembers(groupId))).toEqual(new Set([ids.f, ids.a, ids.b, ids.c]));
    expect(await a.revokeGroupSeat(ids.c, groupId)).toEqual({ how: "revoked" });
    await ship(a, f);
    expect(new Set(await f.groupMembers(groupId))).toEqual(new Set([ids.f, ids.a, ids.b]));
  });

  test("G7: an id that names no group refuses by name, never as an empty answer", async () => {
    const f = await stand(0x70);
    const id = await f.vesselIdentifierHex();
    const { docId } = await f.registerBag(BAG);                                 // a real id, of a document
    for (const missing of ["0x" + "ab".repeat(32), docId]) {
      await expect(f.groupMembers(missing)).rejects.toThrow(/group not found/);
      await expect(f.addGroupMember(id, missing)).rejects.toThrow(/group not found/);
      await expect(f.revokeGroupSeat(id, missing)).rejects.toThrow(/group not found/);
      const verdict = await f.verifyGroupMembership(id, missing);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/group not found/);
    }
  });

  test("G8 CANARY (a measurement of Keyhive 0.3.0-alpha.1): the founder's own departure throws, and its seat leaves", async () => {
    const { f, groupId, ids } = await found(0x80);
    await f.addGroupMember(ids.a, groupId);
    await expect(f.revokeGroupSeat(ids.f, groupId)).rejects.toThrow(/redel/i);
    expect(await f.groupMembers(groupId)).not.toContain(ids.f);
    expect(await f.groupMembers(groupId)).toContain(ids.a);
  });

  test("G10: a Document's read on a group id answers no access in silence, where the group read answers the seat", async () => {
    const { f, groupId, ids } = await found(0xa0);
    await f.addGroupMember(ids.a, groupId);
    expect((await f.verifyGroupMembership(ids.a, groupId)).ok).toBe(true);
    expect((await f.verifySentinelMembership(ids.a, groupId)).ok).toBe(false);  // the silent zero the surface avoids
  });

  test("G11: a party reaching the group only through a member group reads gone, and the member group's seat revokes", async () => {
    const { f, groupId, ids } = await found(0xb0);
    const { groupId: inner } = await f.createGroup();
    await f.addGroupMember(ids.a, inner);
    await f.addGroupMember(inner, groupId);
    expect(await f.groupMembers(groupId)).toContain(ids.a);                      // a reaches through the member group
    expect(await f.revokeGroupSeat(ids.a, groupId)).toEqual({ how: "gone" });    // no seat of its own here
    expect(await f.groupMembers(groupId)).toContain(ids.a);                      // and the answer moved nothing
    expect(await f.revokeGroupSeat(inner, groupId)).toEqual({ how: "revoked" });
    expect(await f.groupMembers(groupId)).not.toContain(ids.a);
  });
});
