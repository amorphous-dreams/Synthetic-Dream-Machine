/**
 * seat-roll-substrate — THE PROBE UNDER THE KEY SIDE (kapae#/keys · #/re-admission).
 *
 * The law says a seat without standing gets revoked by every vessel that reads the shadow and holds revoke
 * authority, with no coordinator. That holds only as far as the substrate holds it, so this file MEASURES
 * Keyhive 0.3.0-alpha.1 and asserts what it read. Each assertion stands as a canary: an upstream that answers
 * otherwise re-scopes the key side, and this file says so first.
 *
 * WHAT IT READ.
 *   1. REVOKE AUTHORITY FOLLOWS THE SEATING LINEAGE. The hand that seated a party revokes it, and so does any
 *      hand upstream of that seat. A peer seated beside the party, admin or not, holds no revoke authority.
 *   2. Two hands of one lineage that revoke at once land one outcome on every replica.
 *   3. A revocation runs forward only: the removed party keeps what it read and opens nothing sealed after.
 *   4. A second revocation of a seat already gone produces no event (the provider throws on it).
 *   5. A fresh seat after a revocation opens nothing from the span it missed.
 *   6. A party seated by two hands leaves only under a hand upstream of BOTH seats; a hand upstream of one
 *      meets a refusal for the whole call.
 *   7. A junior never revokes its senior, so two peers cannot revoke each other at the key layer.
 *   8. A SENTINEL DOCUMENT'S REVOCATION ROLLS NO BAG KEY. A bag delegated to a sentinel Document keeps the removed
 *      party's leaf: the lattice answers "no access" while content sealed AFTER the revocation still opens for
 *      the removed party, re-delegated or not. Keyhive carries a removal down to the documents a GROUP reaches
 *      and to nothing a Document reaches.
 *   9. A true Keyhive Group in the same seat rolls the bag's key at the revocation.
 *
 * A probe measures; it does not wish.
 */
import { describe, test, expect } from "vitest";
import * as KH from "@keyhive/keyhive/slim";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import { ensureKeyhiveWasm } from "../src/keyhive-provider.js";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function stand(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}

/** Everyone learns everyone's card: the precondition every ceremony here leans on. */
async function introduce(all: readonly KeyhiveProvider[]): Promise<void> {
  for (const a of all) for (const b of all) if (a !== b) await a.receiveContactCard(await b.contactCard());
}

/** Ship what `from` holds for `to`. */
async function ship(from: KeyhiveProvider, to: KeyhiveProvider): Promise<void> {
  await to.ingestPeerEvents(await from.eventsForPeer(await to.vesselIdentifierHex()));
}

const BAG = "lar:///probe.seat.roll/the-group-itself";

/**
 * A lineage of three seats under a founder: the founder seats `a` and `b`, and `a` seats `c`. So the founder
 * and `a` stand upstream of `c`, while `b` stands beside it.
 */
async function lineage(base: number) {
  const f = await stand(base), a = await stand(base + 1), b = await stand(base + 2), c = await stand(base + 3);
  const all = [f, a, b, c] as const;
  await introduce(all);
  const { docIdHex } = await f.createSentinelDoc(`lar:///probe.seat.roll/${base}`);
  const ids = { f: await f.vesselIdentifierHex(), a: await a.vesselIdentifierHex(), b: await b.vesselIdentifierHex(), c: await c.vesselIdentifierHex() };
  await f.addSentinelMember(ids.a, docIdHex);
  await f.addSentinelMember(ids.b, docIdHex);
  await ship(f, a);
  await a.addSentinelMember(ids.c, docIdHex);
  await ship(a, f);
  for (const p of all) p.adoptBag(BAG, docIdHex);
  for (const p of [a, b, c]) await ship(f, p);
  await ship(a, c);
  return { f, a, b, c, ids, docIdHex };
}
const holds = async (p: KeyhiveProvider, id: string, doc: string) => (await p.verifySentinelMembership(id, doc)).ok;

describe("the substrate under a seat's roll", () => {
  test("PROBE 1: revoke authority follows the seating lineage, and a peer beside the seat holds none", async () => {
    const { b, ids, docIdHex } = await lineage(0x40);
    expect(await holds(b, ids.c, docIdHex)).toBe(true);
    await expect(b.revokeSentinelMember(ids.c, docIdHex)).rejects.toThrow(/proof missing/i);
    expect(await holds(b, ids.c, docIdHex)).toBe(true);
  });

  test("PROBE 2: the seating hand and a hand upstream revoke at once, and every replica lands one outcome", async () => {
    const { f, a, b, ids, docIdHex } = await lineage(0x50);
    // Neither sees the other's act.
    await a.revokeSentinelMember(ids.c, docIdHex);
    await f.revokeSentinelMember(ids.c, docIdHex);
    await ship(a, f); await ship(f, a); await ship(f, b); await ship(a, b);
    for (const p of [f, a, b]) {
      expect(await holds(p, ids.c, docIdHex)).toBe(false);
      expect(await holds(p, ids.a, docIdHex)).toBe(true);
      expect(await holds(p, ids.b, docIdHex)).toBe(true);
    }
  });

  test("PROBE 3: a revocation runs forward only, and what follows it stays shut", async () => {
    const { f, a, c, ids, docIdHex } = await lineage(0x60);
    const before = await f.encryptContent(BAG, enc("sealed while c stood"));
    await ship(f, c);
    expect(dec(await c.decryptContent(BAG, before))).toBe("sealed while c stood");
    await a.revokeSentinelMember(ids.c, docIdHex);
    await ship(a, f);
    const after = await f.encryptContent(BAG, enc("sealed after c left"));
    await ship(f, c); await ship(a, c);
    expect(dec(await c.decryptContent(BAG, before))).toBe("sealed while c stood");   // the removed party keeps what it read
    await expect(c.decryptContent(BAG, after)).rejects.toThrow();
    await ship(f, a);
    expect(dec(await a.decryptContent(BAG, after))).toBe("sealed after c left");     // a member that stayed reads on
  });

  test("PROBE 4: a second revocation of a seat already gone produces no event", async () => {
    const { f, a, ids, docIdHex } = await lineage(0x70);
    await a.revokeSentinelMember(ids.c, docIdHex);
    await ship(a, f);
    expect(await holds(f, ids.c, docIdHex)).toBe(false);
    await expect(f.revokeSentinelMember(ids.c, docIdHex)).rejects.toThrow(/no revocation events/i);
  });

  test("PROBE 5: a fresh seat after a revocation opens nothing from the span it missed", async () => {
    const { f, a, c, ids, docIdHex } = await lineage(0x80);
    await a.revokeSentinelMember(ids.c, docIdHex);
    await ship(a, f);
    const missed = await f.encryptContent(BAG, enc("sealed in the span c missed"));
    await f.addSentinelMember(ids.c, docIdHex);
    const fresh = await f.encryptContent(BAG, enc("sealed after the fresh seat"));
    await ship(a, c); await ship(f, c);
    expect(await holds(f, ids.c, docIdHex)).toBe(true);
    expect(dec(await c.decryptContent(BAG, fresh))).toBe("sealed after the fresh seat");
    await expect(c.decryptContent(BAG, missed)).rejects.toThrow();
  });

  test("PROBE 6: a party seated by two hands leaves only under a hand upstream of BOTH seats", async () => {
    const { f, a, ids, docIdHex } = await lineage(0x90);
    await f.addSentinelMember(ids.c, docIdHex);          // a second seat for c, from the founder's own hand
    await ship(f, a);
    // The junior hand seated c once and stands upstream of that seat alone: its revoke REFUSES whole.
    await expect(a.revokeSentinelMember(ids.c, docIdHex)).rejects.toThrow(/proof missing/i);
    const afterJunior = await holds(a, ids.c, docIdHex);
    await ship(a, f);
    await f.revokeSentinelMember(ids.c, docIdHex);       // the founder stands upstream of both
    await ship(f, a);
    expect(afterJunior).toBe(true);                      // the refused call left the seat standing
    expect(await holds(f, ids.c, docIdHex)).toBe(false);
    expect(await holds(a, ids.c, docIdHex)).toBe(false);
  });

  test("PROBE 7: a junior never revokes its senior", async () => {
    const { a, c, ids, docIdHex } = await lineage(0xa0);
    await expect(c.revokeSentinelMember(ids.a, docIdHex)).rejects.toThrow(/proof missing/i);
    await a.revokeSentinelMember(ids.c, docIdHex);       // while the senior revokes the junior freely
    expect(await holds(a, ids.c, docIdHex)).toBe(false);
    expect(await holds(a, ids.a, docIdHex)).toBe(true);
  });
  test("PROBE 8: a sentinel Document's revocation rolls no key of a bag delegated to it", async () => {
    const f = await stand(0xb0), c = await stand(0xb1), d = await stand(0xb2);
    await introduce([f, c, d]);
    const pg = await f.createSentinelDoc("lar:///probe.seat.roll/sentinel-over-a-bag");
    const idC = await c.vesselIdentifierHex(), idD = await d.vesselIdentifierHex();
    await f.addSentinelMember(idC, pg.docIdHex);
    await f.addSentinelMember(idD, pg.docIdHex);
    const HELD = "lar:///probe.seat.roll/a-bag-the-group-reads";
    const { docId } = await f.registerBag(HELD);
    await f.delegate({ bagUrl: HELD, audience: pg.agentIdHex, access: "read" });
    const sync = async () => { for (const p of [c, d]) { await ship(f, p); p.adoptBag(HELD, docId); } };
    const opens = async (p: KeyhiveProvider, ct: Uint8Array) => p.decryptContent(HELD, ct).then(() => true, () => false);

    // The party holds the bag's key state before it leaves: the case of a seated device set aside.
    const before = await f.encryptContent(HELD, enc("sealed while c stood"));
    await sync();
    expect(await opens(c, before)).toBe(true);

    await f.revokeSentinelMember(idC, pg.docIdHex);
    // The lattice closes: every cap check refuses the removed party from here on.
    expect((await f.verify({ bagUrl: HELD, presenter: idC, access: "read" })).ok).toBe(false);
    const after = await f.encryptContent(HELD, enc("sealed after the revocation"));
    await sync();
    // CANARY (measured on 0.3.0-alpha.1): the bag's key agreement keeps the removed party's leaf.
    expect(await opens(c, after)).toBe(true);
    expect(await opens(d, after)).toBe(true);
    // A re-delegation to the same sentinel rolls nothing either.
    await f.delegate({ bagUrl: HELD, audience: pg.agentIdHex, access: "read" });
    const regranted = await f.encryptContent(HELD, enc("sealed after the re-delegation"));
    await sync();
    expect(await opens(c, regranted)).toBe(true);
  });

  test("PROBE 9: a Keyhive Group in the same seat rolls the bag's key at the revocation", async () => {
    ensureKeyhiveWasm();
    const raw = (fill: number) => KH.Keyhive.init(KH.Signer.memorySignerFromBytes(new Uint8Array(32).fill(fill)), KH.CiphertextStore.newInMemory(), () => {});
    const cid = (n: number) => new KH.ChangeId(new Uint8Array(32).fill(n));
    const f = await raw(0xc0), c = await raw(0xc1), d = await raw(0xc2);
    const cInd = await f.receiveContactCard(await c.contactCard());
    const dInd = await f.receiveContactCard(await d.contactCard());
    await c.receiveContactCard(await f.contactCard());
    await d.receiveContactCard(await f.contactCard());
    const gid = await f.generateGroup([]);
    const group = (await f.getGroup(gid))!;
    const admin = KH.Access.tryFromString("admin")!, read = KH.Access.tryFromString("read")!;
    const cAgent = (await f.getAgent(cInd.toIdentifier()))!, dAgent = (await f.getAgent(dInd.toIdentifier()))!;
    await f.addMember(cAgent.id, KH.MemberedId.group(gid), admin, []);
    await f.addMember(dAgent.id, KH.MemberedId.group(gid), admin, []);
    const docId = await f.generateDocument([], cid(1), []);
    await f.addMember(group.toAgent().id, KH.MemberedId.document(docId), read, []);
    const sync = async () => {
      for (const p of [c, d]) {
        const agent = (await f.getAgent((await p.individual()).id))!;
        await p.ingestEventsBytes([...(await f.eventsForAgent(agent) as Map<unknown, Uint8Array>).values()]);
      }
    };
    const opens = (p: KH.Keyhive, ct: Uint8Array) => p.tryDecrypt(docId, KH.Encrypted.fromBytes(ct)).then(() => true, () => false);
    const before = (await f.tryEncrypt(docId, cid(2), [cid(1)], enc("sealed while c stood"))).encryptedContent().toBytes();
    await sync();
    expect(await opens(c, before)).toBe(true);
    await f.revokeMember(cAgent.id, true, KH.MemberedId.group(gid));
    const after = (await f.tryEncrypt(docId, cid(3), [cid(2)], enc("sealed after the revocation"))).encryptedContent().toBytes();
    await sync();
    expect(await opens(c, after)).toBe(false);
    expect(await opens(d, after)).toBe(true);
    expect(await opens(c, before)).toBe(true);           // forward only
  });
});
