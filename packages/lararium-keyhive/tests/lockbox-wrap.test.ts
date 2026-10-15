/**
 * Lockbox wrap behavior laws.
 * INVARIANTS: EACH WRAP OWNS A DOCUMENT; A READER OPENS ONLY A WRAP THAT SEATS IT.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import { bagLocatorOf, keyVersionIdOf, mintContentKey, wrapLockbox, openLockbox, readKeyParcel, encodeKeyParcel } from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, encodeLockboxBox, keyhiveLockboxShore, readLockboxBox } from "../src/index.js";

const enc = (s: string) => new TextEncoder().encode(s);
async function provider(seed: number, eventStore = new InMemoryEventStore(), archiveBytes?: Uint8Array) {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(seed), eventStore, ...(archiveBytes ? { archiveBytes } : {}) });
  return p;
}
async function peers(ps: readonly KeyhiveProvider[]) { for (const a of ps) for (const b of ps) if (a !== b) await a.receiveContactCard(await b.contactCard()); }
async function payload(bagId = "lar:///lockbox/wrap", key = mintContentKey()) { return { bagId, locator: bagLocatorOf(key, bagId), keyVersion: keyVersionIdOf(key, bagId), key }; }
const shoreFor = (ps: readonly import("../src/keyhive-lockbox.js").LockboxProvider[], restArchive: (provider: import("../src/keyhive-lockbox.js").LockboxProvider) => Promise<void> = async () => {}) => keyhiveLockboxShore(ps, { restArchive });
function opened<T>(r: T | { refusal: string }): r is T { return !("refusal" in (r as object)); }
async function setup(seed: number) {
  const f = await provider(seed), c = await provider(seed + 1), d = await provider(seed + 2);
  await peers([f, c, d]);
  const sentinel = await f.createSentinelDoc(`lar:///wrap/${seed}`);
  await f.addSentinelMember(await c.vesselIdentifierHex(), sentinel.docIdHex);
  await f.addSentinelMember(await d.vesselIdentifierHex(), sentinel.docIdHex);
  const bag = `lar:///wrap/bag-${seed}`;
  const { docId } = await f.registerBag(bag);
  await f.delegate({ bagUrl: bag, audience: sentinel.agentIdHex, access: "read" });
  for (const p of [c, d]) { await p.ingestPeerEvents(await f.eventsForPeer(await p.vesselIdentifierHex())); p.adoptBag(bag, docId); }
  return { f, c, d, sentinel, bag, docId, shore: shoreFor([f]), readerShore: (p: KeyhiveProvider) => shoreFor([p]) };
}

describe("the bag document cannot hold a lockbox", () => {
  test("a wrap through the bag's own document still opens for a removed reader, so no lockbox wraps there", async () => {
    const { f, c, sentinel, bag } = await setup(0x41);
    const before = await f.encryptContent(bag, enc("before"));
    await c.ingestPeerEvents(await f.eventsForPeer(await c.vesselIdentifierHex()));
    expect(await c.decryptContent(bag, before)).toBeInstanceOf(Uint8Array);
    await f.revokeSentinelMember(await c.vesselIdentifierHex(), sentinel.docIdHex);
    const after = await f.encryptContent(bag, enc("after"));
    await c.ingestPeerEvents(await f.eventsForPeer(await c.vesselIdentifierHex()));
    expect(await c.decryptContent(bag, after)).toBeInstanceOf(Uint8Array);
  });
});

describe("a lockbox wraps to its named seats", () => {
  test("revocation closes later wraps while earlier wraps and controls remain open", async () => {
    const s = await setup(0x51), cId = await s.c.vesselIdentifierHex(), dId = await s.d.vesselIdentifierHex();
    const before = await wrapLockbox({ payload: await payload(), readers: [cId, dId], shore: s.shore });
    await s.f.revokeSentinelMember(cId, s.sentinel.docIdHex);
    const after = await wrapLockbox({ payload: await payload(), readers: await s.f.sentinelCgkaMembers(s.sentinel.docIdHex), shore: s.shore });
    expect(opened(before)).toBe(true); expect(opened(after)).toBe(true);
    if (!opened(before) || !opened(after)) return;
    await s.c.ingestPeerEvents(await s.shore.opsFor(cId)); await s.d.ingestPeerEvents(await s.shore.opsFor(dId));
    expect(opened(await openLockbox({ lockbox: after.lockbox, shore: s.readerShore(s.d) }))).toBe(true);
    expect(opened(await openLockbox({ lockbox: before.lockbox, shore: s.readerShore(s.c) }))).toBe(true);
    expect(await openLockbox({ lockbox: after.lockbox, shore: s.readerShore(s.c) })).toEqual({ refusal: "lockbox-not-ours" });
    const noRemoval = await setup(0x61), c2 = await noRemoval.c.vesselIdentifierHex();
    const control = await wrapLockbox({ payload: await payload(), readers: [c2], shore: noRemoval.shore });
    await noRemoval.c.ingestPeerEvents(await noRemoval.shore.opsFor(c2));
    expect(opened(await openLockbox({ lockbox: opened(control) ? control.lockbox : null, shore: noRemoval.readerShore(noRemoval.c) }))).toBe(true);
  });
  test("a caller cannot hand a seat it does not own", async () => {
    const s = await setup(0x71), cId = await s.c.vesselIdentifierHex(), dId = await s.d.vesselIdentifierHex();
    const w = await wrapLockbox({ payload: await payload(), readers: [dId], shore: s.shore });
    expect(opened(w)).toBe(true);
    if (opened(w)) {
      await s.c.ingestPeerEvents(await s.shore.opsFor(cId)); await s.d.ingestPeerEvents(await s.shore.opsFor(dId));
      expect(await openLockbox({ lockbox: w.lockbox, shore: s.readerShore(s.c) })).toEqual({ refusal: "lockbox-not-ours" });
      expect(opened(await openLockbox({ lockbox: w.lockbox, shore: s.readerShore(s.d) }))).toBe(true);
    }
  });
  test("an outsider and a blind event holder do not open a wrap", async () => {
    const s = await setup(0x81), outsider = await provider(0x84), blind = await provider(0x85);
    const cId = await s.c.vesselIdentifierHex(), w = await wrapLockbox({ payload: await payload(), readers: [cId], shore: s.shore });
    expect(opened(w)).toBe(true);
    if (opened(w)) {
      await s.c.ingestPeerEvents(await s.shore.opsFor(cId));
      const allEvents = (await (s.f as unknown as { eventStore: InMemoryEventStore }).eventStore.list()).map((r) => r.bytes);
      await blind.ingestPeerEvents(allEvents);
      expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([outsider]) })).toEqual({ refusal: "lockbox-not-ours" });
      expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([blind]) })).toEqual({ refusal: "lockbox-not-ours" });
    }
  });
  test("new seats open only later wraps until an explicit hand-over", async () => {
    const s = await setup(0x91), e = await provider(0x94); await peers([s.f, e]);
    const firstPayload = await payload(), first = await wrapLockbox({ payload: firstPayload, readers: [await s.d.vesselIdentifierHex()], shore: s.shore });
    await s.f.addSentinelMember(await e.vesselIdentifierHex(), s.sentinel.docIdHex);
    const secondPayload = await payload(), second = await wrapLockbox({ payload: secondPayload, readers: await s.f.sentinelCgkaMembers(s.sentinel.docIdHex), shore: s.shore });
    await e.ingestPeerEvents(await s.shore.opsFor(await e.vesselIdentifierHex()));
    if (opened(first) && opened(second)) {
      expect(await openLockbox({ lockbox: second.lockbox, shore: shoreFor([e]) })).toHaveProperty("payload");
      expect(await openLockbox({ lockbox: first.lockbox, shore: shoreFor([e]) })).toEqual({ refusal: "lockbox-not-ours" });
      const handover = await wrapLockbox({ payload: firstPayload, readers: [await e.vesselIdentifierHex()], shore: s.shore });
      await e.ingestPeerEvents(await s.shore.opsFor(await e.vesselIdentifierHex()));
      expect(opened(handover)).toBe(true);
      if (opened(handover)) { const openedHandover = await openLockbox({ lockbox: handover.lockbox, shore: shoreFor([e]) }); expect(opened(openedHandover)).toBe(true); if (opened(openedHandover)) expect(openedHandover.payload.key).toEqual(firstPayload.key); }
    }
  });
});

describe("archives preserve wrap seats", () => {
  test("a wrapper restored from its post-wrap archive opens", async () => {
    const f = await provider(0xa1), c = await provider(0xa2); await peers([f, c]);
    let archive = new Map<KeyhiveProvider, Uint8Array>(); const shore = shoreFor([f], async p => { archive.set(p as KeyhiveProvider, await (p as KeyhiveProvider).exportArchive()); });
    const w = await wrapLockbox({ payload: await payload(), readers: [await c.vesselIdentifierHex()], shore });
    const restored = await provider(0xa1, new InMemoryEventStore(), archive.get(f)!);
    if (opened(w)) expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([restored]) })).toHaveProperty("payload");
  });
  test("a reader restored from its post-ingest archive opens", async () => {
    const f = await provider(0xa3), c = await provider(0xa4); await peers([f, c]);
    const shore = shoreFor([f]), id = await c.vesselIdentifierHex(), w = await wrapLockbox({ payload: await payload(), readers: [id], shore });
    await c.ingestPeerEvents(await shore.opsFor(id)); const archive = await c.exportArchive();
    const restored = await provider(0xa4, new InMemoryEventStore(), archive);
    if (opened(w)) expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([restored]) })).toHaveProperty("payload");
  });
  test("a reader restored before the wrap opens after ingesting its operations", async () => {
    const f = await provider(0xa5), c = await provider(0xa6); await peers([f, c]);
    const archive = await c.exportArchive(), id = await c.vesselIdentifierHex(), shore = shoreFor([f]);
    const w = await wrapLockbox({ payload: await payload(), readers: [id], shore });
    const restored = await provider(0xa6, new InMemoryEventStore(), archive); await restored.ingestPeerEvents(await shore.opsFor(id));
    if (opened(w)) expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([restored]) })).toHaveProperty("payload");
  });
  test("an identity's prekeys live in its Archive", async () => {
    const f = await provider(0xa7), c = await provider(0xa8); await peers([f, c]);
    const id = await c.vesselIdentifierHex(), shore = shoreFor([f]), w = await wrapLockbox({ payload: await payload(), readers: [id], shore });
    const fresh = await provider(0xa8); await fresh.ingestPeerEvents(await shore.opsFor(id));
    if (opened(w)) expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([fresh]) })).toEqual({ refusal: "lockbox-not-ours" });
  });
  test("replaying emitted events cannot replace a post-wrap wrapper archive", async () => {
    const f = await provider(0xa9), c = await provider(0xaa); await peers([f, c]);
    const early = await f.exportArchive(), store = (f as unknown as { eventStore: InMemoryEventStore }).eventStore;
    const w = await wrapLockbox({ payload: await payload(), readers: [await c.vesselIdentifierHex()], shore: shoreFor([f]) });
    const replay = await provider(0xa9, new InMemoryEventStore(), early); await replay.ingestPeerEvents((await store.list()).map(r => r.bytes));
    if (opened(w)) expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([replay]) })).toEqual({ refusal: "lockbox-not-ours" });
  });
});

describe("archive rest and persistence order", () => {
  test("restArchive runs before answer and receives the wrapping provider", async () => {
    const f = await provider(0xb1), c = await provider(0xb2); await peers([f, c]); let calls: unknown[] = [];
    const shore = shoreFor([f], async p => { calls.push(p); });
    const result = await shore.wrap({ readers: [await c.vesselIdentifierHex()], ref: new Uint8Array(32).fill(7), payload: enc("payload") });
    expect(result.box.length).toBeGreaterThan(0); expect(calls).toEqual([f]);
  });
  test("an archive rest refusal names wrap-failed and returns no lockbox", async () => {
    const f = await provider(0xb3), c = await provider(0xb4); await peers([f, c]);
    const w = await wrapLockbox({ payload: await payload(), readers: [await c.vesselIdentifierHex()], shore: shoreFor([f], async () => { throw new Error("rest refused"); }) });
    expect(w).toMatchObject({ refusal: "wrap-failed" }); expect("lockbox" in w).toBe(false);
  });
  test("a rejecting event store fails the wrap while an accepting store answers", async () => {
    const reject = { put: async () => { throw new Error("write refused"); }, list: async () => [] };
    const f = await provider(0xb5, reject), c = await provider(0xb6); await peers([f, c]);
    const failed = await wrapLockbox({ payload: await payload(), readers: [await c.vesselIdentifierHex()], shore: shoreFor([f]) });
    expect(failed).toMatchObject({ refusal: "wrap-failed" });
    const good = await provider(0xb7), r = await provider(0xb8); await peers([good, r]);
    expect(opened(await wrapLockbox({ payload: await payload(), readers: [await r.vesselIdentifierHex()], shore: shoreFor([good]) }))).toBe(true);
  });
});

describe("a lockbox binds its clear locator and version", () => {
  test("swapped locator and version refuse while untouched boxes open", async () => {
    const f = await provider(0xc1), r = await provider(0xc2); await peers([f, r]); const id = await r.vesselIdentifierHex(), shore = shoreFor([f]);
    const a = await wrapLockbox({ payload: await payload("lar:///a"), readers: [id], shore }), b = await wrapLockbox({ payload: await payload("lar:///b"), readers: [id], shore });
    await r.ingestPeerEvents(await shore.opsFor(id));
    if (opened(a) && opened(b)) {
      const swapped = { ...a.lockbox, bag: b.lockbox.bag, keyVersion: b.lockbox.keyVersion };
      expect(await openLockbox({ lockbox: swapped, shore: shoreFor([r]) })).toEqual({ refusal: "lockbox-other-locator" });
      expect(opened(await openLockbox({ lockbox: a.lockbox, shore: shoreFor([r]) }))).toBe(true);
    }
  });
  test("decoded ciphertext tampering changes bytes and refuses", async () => {
    const f = await provider(0xc3), r = await provider(0xc4); await peers([f, r]); const id = await r.vesselIdentifierHex(), shore = shoreFor([f]);
    const w = await wrapLockbox({ payload: await payload(), readers: [id], shore }); await r.ingestPeerEvents(await shore.opsFor(id));
    if (opened(w)) {
      const fields = readLockboxBox(w.lockbox.box)!; const ciphertext = fields.ciphertext.slice(); ciphertext[ciphertext.length - 1] ^= 1;
      const changed = encodeLockboxBox(fields.docIdHex, ciphertext); expect(changed).not.toEqual(w.lockbox.box);
      expect(await openLockbox({ lockbox: { ...w.lockbox, box: changed }, shore: shoreFor([r]) })).toEqual({ refusal: "lockbox-not-ours" });
    }
  });
  test("an unminted wrap document id refuses", async () => {
    const r = await provider(0xc5), forged = { bag: "00".repeat(32), keyVersion: "11".repeat(32), wrap: "keyhive", box: encodeLockboxBox("22".repeat(32), enc("opaque")) };
    expect(await openLockbox({ lockbox: forged, shore: shoreFor([r]) })).toEqual({ refusal: "lockbox-not-ours" });
  });
});

describe("the wrap serves exactly reached readers", () => {
  test("unreached readers remain outside the wrap document", async () => {
    const f = await provider(0xd1), served = await provider(0xd2), missing = await provider(0xd3); await peers([f, served]);
    const w = await f.wrapToReaders({ readers: [await served.vesselIdentifierHex(), await missing.vesselIdentifierHex()], contentRef: new Uint8Array(32).fill(2), payload: enc("payload") });
    expect(w.unreached).toContain(await missing.vesselIdentifierHex()); expect(w.served).toContain(await served.vesselIdentifierHex());
    expect(await f.sentinelCgkaMembers(w.docIdHex)).toContain(await served.vesselIdentifierHex()); expect(await f.sentinelCgkaMembers(w.docIdHex)).not.toContain(await missing.vesselIdentifierHex());
  });
  test("wrap documents stay outside bags and separate ciphertexts", async () => {
    const f = await provider(0xd4), r = await provider(0xd5); await peers([f, r]); const bag = "lar:///wrap/no-bag"; await f.registerBag(bag);
    const payloadValue = await payload(), id = await r.vesselIdentifierHex(), shore = shoreFor([f]);
    const a = await wrapLockbox({ payload: payloadValue, readers: [id], shore }), b = await wrapLockbox({ payload: payloadValue, readers: [id], shore });
    expect(opened(a) && opened(b)).toBe(true);
    if (opened(a) && opened(b)) { expect(a.lockbox.box).not.toEqual(b.lockbox.box); expect(await f.holdsHand(bag)).toBe(true); expect(await f.reSealBag(bag)).toEqual([]); }
  });
});

describe("a vessel shore may hold several identities", () => {
  test("the knowledgeable identity wraps, own identities need no seat, and self names both", async () => {
    const veil = await provider(0xe1), vessel = await provider(0xe2), reader = await provider(0xe3); await peers([veil, vessel, reader]);
    const vid = await vessel.vesselIdentifierHex(), rid = await reader.vesselIdentifierHex(), shore = shoreFor([veil, vessel]);
    const w = await wrapLockbox({ payload: await payload(), readers: [rid, vid], shore });
    expect(await shore.self()).toEqual([(await veil.vesselIdentifierHex()).replace(/^0x/, ""), vid.replace(/^0x/, "")]);
    if (opened(w)) {
      await reader.ingestPeerEvents(await shore.opsFor(rid));
      expect(await openLockbox({ lockbox: w.lockbox, shore: shoreFor([reader]) })).toHaveProperty("payload");
    }
  });
});

describe("public operations cross every identity", () => {
  test("unknown opsFor returns an empty list and ingest continues after one refusal", async () => {
    const p = await provider(0xf1), shore = shoreFor([p]); expect(await shore.opsFor("ff".repeat(32))).toEqual([]);
    const throwing = { wrapToReaders: async () => { throw new Error(); }, unwrapFromDocument: async () => new Uint8Array(), eventsForPeer: async () => [], ingestPeerEvents: async () => { throw new Error("refused"); }, vesselIdentifierHex: async () => "00", knowsAgent: async () => false };
    const mixed = shoreFor([throwing, p]); await expect(mixed.ingest([])).resolves.toBeUndefined();
  });
});

describe("the box codec rejects malformed images", () => {
  test("round-trip and every malformed box control", async () => {
    const id = "ab".repeat(32), image = encodeLockboxBox(id, enc("ct")); expect(readLockboxBox(image)?.docIdHex).toBe(`0x${id}`);
    for (const [badId, ct] of [["ab".repeat(31), enc("ct")], [id, new Uint8Array()]] as const) expect(() => encodeLockboxBox(badId, ct)).toThrow();
    expect(readLockboxBox(encodeLockboxBox(id, enc("x")).slice(0, -1))).toBeNull(); expect(readLockboxBox(new Uint8Array(32))).toBeNull();
    expect(() => encodeLockboxBox("ab".repeat(31), enc("x"))).toThrow();
  });
});

describe("the key parcel binds its record", () => {
  test("a malformed parcel image never decodes", async () => {
    const image = encodeKeyParcel as unknown as (v: unknown) => Uint8Array;
    expect(() => image({})).toThrow(); expect(readKeyParcel(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readKeyParcel(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("wrap content references have one fixed width", () => {
  test("wrapToReaders refuses a 31-byte content reference with TypeError", async () => {
    const f = await provider(0xf2); await expect(f.wrapToReaders({ readers: [], contentRef: new Uint8Array(31), payload: enc("x") })).rejects.toBeInstanceOf(TypeError);
  });
});
