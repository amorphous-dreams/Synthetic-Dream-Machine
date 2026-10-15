/**
 * lockbox-guards — the small guards around a lockbox's wrap: the box and parcel codecs, the shore's order of
 * work across several identities, and the provider's chunk shelf at a remint.
 *
 * Where a law reads off Keyhive itself, real providers stand (`lockbox-wrap.test.ts`). Here the shore's own
 * ordering and its guards read off doubles that record what they got asked, since only the asking matters.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records (the lockbox)
 */
import { describe, expect, test } from "vitest";
import {
  bagLocatorOf, encodeKeyParcel, encodeLockboxRecord, hex, keyVersionIdOf, mintContentKey, openLockbox, readKeyParcel, signRecord, wrapLockbox,
  type KeyParcel, type KeyVersionId, type LockboxRecord, type RecordSigner, type SealedRecord,
} from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, encodeLockboxBox, keyhiveLockboxShore, memoryProviderChunkRest, readLockboxBox, type LockboxProvider } from "../src/index.js";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/guards";
const id = (n: number): string => `0x${n.toString(16).padStart(2, "0").repeat(32)}`;
/** A provider double that records what the shore asked of it. */
function double(n: number, over: Partial<LockboxProvider> & { knows?: string[]; opens?: boolean } = {}) {
  const calls: string[] = [];
  const p: LockboxProvider & { calls: string[] } = {
    calls,
    wrapToReaders: async (args) => { calls.push(`wrap:${args.readers.join(",")}`); return { docIdHex: id(0xd0 + n), ciphertext: new Uint8Array([n, 1, 2, 3]), served: [...args.readers], unreached: [] }; },
    unwrapFromDocument: async () => { calls.push("unwrap"); if (over.opens !== true) throw new Error("no seat"); return new Uint8Array([9, 9, n]); },
    eventsForPeer: async (peer) => { calls.push(`events:${peer}`); return [new Uint8Array([n])]; },
    ingestPeerEvents: async (events) => { calls.push(`ingest:${events.length}`); },
    vesselIdentifierHex: async () => id(n),
    knowsAgent: async (agent) => (over.knows ?? []).includes(agent),
    ...over,
  };
  return p;
}
async function signedKeyVersion(bagId = BAG): Promise<{ lockbox: LockboxRecord; record: SealedRecord<"key-version">; keyVersion: KeyVersionId }> {
  const c = await chain("guards", "nexus-test-one");
  const signer: RecordSigner = { certificate: c.sessionCertificate, sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }) };
  const key = mintContentKey(), keyVersion = keyVersionIdOf(key, bagId), locator = bagLocatorOf(key, bagId);
  const signed = await signRecord({ kind: "key-version", bagId, key, signer, body: { bag: locator, keyVersion, parents: [], span: keyVersion }, private: { cause: { kind: "founding" }, history: "closed", joinProofs: [], unserved: [] } });
  if (!("record" in signed)) throw new Error("setup");
  return { lockbox: { bag: locator, keyVersion, wrap: "keyhive", box: new Uint8Array([1, 2, 3]) }, record: signed.record, keyVersion };
}

describe("the box holds a wrap document's id and a ciphertext, and nothing else", () => {
  test("an empty ciphertext never encodes and never reads; a box with no ciphertext answers `lockbox-not-ours`", async () => {
    expect(() => encodeLockboxBox(id(1), new Uint8Array(0))).toThrow(TypeError);
    expect(() => encodeLockboxBox(id(1), "abc" as never)).toThrow(TypeError);
    expect(() => encodeLockboxBox("0x" + "ab".repeat(31), new Uint8Array([1]))).toThrow(TypeError);
    const sound = encodeLockboxBox(id(1), new Uint8Array([7]));
    expect(readLockboxBox(sound)).toEqual({ docIdHex: id(1), ciphertext: new Uint8Array([7]) });
    // The same image with its ciphertext field emptied: decode the box, rebuild it by hand, assert the bytes moved.
    const { sealedImage, SEALED_LOCKBOX_BOX_DOMAIN, hexToBytes } = await import("@lararium/mesh");
    const emptied = sealedImage(SEALED_LOCKBOX_BOX_DOMAIN, hexToBytes(id(1).slice(2)), new Uint8Array(0));
    expect(hex(emptied)).not.toBe(hex(sound));
    expect(readLockboxBox(emptied)).toBeNull();
    // A 31-byte wrap document id, with a ciphertext that reads whole.
    expect(readLockboxBox(sealedImage(SEALED_LOCKBOX_BOX_DOMAIN, hexToBytes(id(1).slice(2)).slice(0, 31), new Uint8Array([7])))).toBeNull();
    const shore = keyhiveLockboxShore([double(1, { opens: true })], { restArchive: async () => {} });
    expect(await shore.unwrap(emptied)).toBeNull();
    expect(await shore.unwrap(sound)).toEqual(new Uint8Array([9, 9, 1]));   // CONTROL: the sound box opens
  });
});

describe("the shore over several identities", () => {
  test("a shore stands over one identity or more: none refuses at once", () => {
    expect(() => keyhiveLockboxShore([], { restArchive: async () => {} })).toThrow(TypeError);
    expect(() => keyhiveLockboxShore([double(1)], { restArchive: async () => {} })).not.toThrow();
  });

  test("A WRAP ANSWERS ONLY ONCE ITS ARCHIVE RESTS: `restArchive` gets awaited, with the identity that wrapped, before any box leaves", async () => {
    const order: string[] = [];
    const a = double(1), b = double(2, { knows: [id(9)] });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const shore = keyhiveLockboxShore([a, b], { restArchive: async (p) => { order.push(`rest:${await p.vesselIdentifierHex()}`); await gate; order.push("rested"); } });
    const pending = shore.wrap({ readers: [id(9)], ref: new Uint8Array(32), payload: new Uint8Array([1]) }).then((r) => { order.push("answered"); return r; });
    await new Promise((r) => setTimeout(r, 5));
    expect(order).toEqual([`rest:${id(2)}`]);                       // the identity that knows the reader wrapped; no answer yet
    release();
    await pending;
    expect(order).toEqual([`rest:${id(2)}`, "rested", "answered"]);
    expect(a.calls.some((c) => c.startsWith("wrap"))).toBe(false);
    expect(b.calls.filter((c) => c.startsWith("wrap"))).toEqual([`wrap:${id(9)}`]);
  });

  test("`unwrap` tries every identity in turn: a seat the second identity holds opens, and none holding one answers null", async () => {
    const first = double(1), second = double(2, { opens: true });
    const box = encodeLockboxBox(id(5), new Uint8Array([1]));
    expect(await keyhiveLockboxShore([first, second], { restArchive: async () => {} }).unwrap(box)).toEqual(new Uint8Array([9, 9, 2]));
    expect(first.calls).toEqual(["unwrap"]);
    expect(second.calls).toEqual(["unwrap"]);
    expect(await keyhiveLockboxShore([first, double(3)], { restArchive: async () => {} }).unwrap(box)).toBeNull();
  });

  test("`opsFor` asks only the identities that know the reader; `ingest` hands the operations to every identity past one that throws", async () => {
    const knows = double(1, { knows: [id(9)] }), stranger = double(2);
    const shore = keyhiveLockboxShore([stranger, knows], { restArchive: async () => {} });
    expect(await shore.opsFor(id(9))).toEqual([new Uint8Array([1])]);
    expect(stranger.calls).toEqual([]);                             // an identity that cannot name the reader hands it nothing
    expect(await shore.opsFor(id(8))).toEqual([]);
    const throws = double(3, { ingestPeerEvents: async () => { throw new Error("this identity refuses"); } });
    const takes = double(4);
    await keyhiveLockboxShore([throws, takes], { restArchive: async () => {} }).ingest([new Uint8Array([1]), new Uint8Array([2])]);
    expect(takes.calls).toEqual(["ingest:2"]);
  });

  test("a reader that names this vessel's own other identity gets no seat asked for it", async () => {
    const veil = double(1, { knows: [id(9)] }), vessel = double(2);
    const shore = keyhiveLockboxShore([veil, vessel], { restArchive: async () => {} });
    await shore.wrap({ readers: [id(2), id(9), id(1)], ref: new Uint8Array(32), payload: new Uint8Array([1]) });
    expect(veil.calls.filter((c) => c.startsWith("wrap"))).toEqual([`wrap:${id(9)}`]);
    expect(await shore.self()).toEqual([id(1).slice(2), id(2).slice(2)]);
  });
});

describe("a lockbox that reads malformed opens nothing", () => {
  test("`openLockbox` answers `lockbox-record-malformed` for a lockbox with no box, another wrap, or a short locator, before it asks the shore", async () => {
    const shore = double(1, { opens: true });
    const s = keyhiveLockboxShore([shore], { restArchive: async () => {} });
    const { lockbox } = await signedKeyVersion();
    for (const bad of [{ ...lockbox, box: new Uint8Array(0) }, { ...lockbox, wrap: "other" }, { ...lockbox, bag: "ab".repeat(31) }, null, "text", new Uint8Array([1, 2, 3])]) {
      expect(await openLockbox({ lockbox: bad as never, shore: s })).toEqual({ refusal: "lockbox-record-malformed" });
    }
    expect(shore.calls).toEqual([]);
    // CONTROL: a well-formed lockbox reaches the shore (its box opens to bytes that read as no payload).
    expect(await openLockbox({ lockbox: { ...lockbox, box: encodeLockboxBox(id(5), new Uint8Array([1])) }, shore: s })).toEqual({ refusal: "lockbox-malformed" });
    expect(shore.calls).toEqual(["unwrap"]);
    // The encoded form reads the same as the record.
    expect(await openLockbox({ lockbox: encodeLockboxRecord({ ...lockbox, box: encodeLockboxBox(id(5), new Uint8Array([1])) }), shore: s })).toEqual({ refusal: "lockbox-malformed" });
  });

  test("A BOX MOVED UNDER ANOTHER VERSION'S CLEAR PART REFUSES `lockbox-other-version`: two versions of one bag under ONE locator", async () => {
    const { encodeLockboxPayload } = await import("@lararium/mesh");
    const founding = mintContentKey(), next = mintContentKey();
    const locator = bagLocatorOf(founding, BAG);
    const one = { bagId: BAG, locator, keyVersion: keyVersionIdOf(founding, BAG), key: founding };
    const two = { bagId: BAG, locator, keyVersion: keyVersionIdOf(next, BAG), key: next };
    // A shore whose boxes hold their payloads in the clear: the binding under test lives in the payload's own image.
    const shore = { ...keyhiveLockboxShore([double(1)], { restArchive: async () => {} }), unwrap: async (box: Uint8Array) => Uint8Array.from(box) };
    const boxOf = (payload: typeof one): LockboxRecord => ({ bag: payload.locator, keyVersion: payload.keyVersion, wrap: "keyhive", box: encodeLockboxPayload(payload) });
    expect(await openLockbox({ lockbox: boxOf(one), shore })).toHaveProperty("payload");              // CONTROL: each opens under its own clear part
    expect(await openLockbox({ lockbox: boxOf(two), shore })).toHaveProperty("payload");
    const swapped = { ...boxOf(two), box: boxOf(one).box };
    expect(hex(swapped.box)).not.toBe(hex(boxOf(two).box));
    expect(await openLockbox({ lockbox: swapped, shore })).toEqual({ refusal: "lockbox-other-version" });
    // Another founding's locator over the same box.
    const elsewhere = { ...boxOf(one), bag: bagLocatorOf(next, BAG) };
    expect(await openLockbox({ lockbox: elsewhere, shore })).toEqual({ refusal: "lockbox-other-locator" });
    // What the reader expects of the bag itself.
    expect(await openLockbox({ lockbox: boxOf(one), shore, expect: { bagId: "lar:///ha.ka.ba/@test/bags/other" } })).toEqual({ refusal: "lockbox-other-bag" });
  });

  test("`wrapLockbox` refuses a payload whose key stands as another version, and a shore that answers no box", async () => {
    const key = mintContentKey();
    const shore = keyhiveLockboxShore([double(1)], { restArchive: async () => {} });
    const wrong = { bagId: BAG, locator: bagLocatorOf(key, BAG), keyVersion: keyVersionIdOf(mintContentKey(), BAG), key };
    expect(await wrapLockbox({ payload: wrong, readers: [], shore })).toEqual({ refusal: "payload-malformed" });
    const empty = keyhiveLockboxShore([double(1)], { restArchive: async () => {} });
    const hollow = { ...empty, wrap: async () => ({ box: new Uint8Array(0), served: [], unreached: [] }) };
    const sound = { bagId: BAG, locator: bagLocatorOf(key, BAG), keyVersion: keyVersionIdOf(key, BAG), key };
    expect(await wrapLockbox({ payload: sound, readers: [], shore: hollow })).toEqual({ refusal: "wrap-failed", cause: "the shore answered no box" });
    expect("lockbox" in (await wrapLockbox({ payload: sound, readers: [], shore }))).toBe(true);   // CONTROL
  });
});

describe("a wrap whose own operations never rested answers nothing", () => {
  test("an event store that THROWS at the capture, and one that rejects, each fail the wrap; one that accepts answers a lockbox", async () => {
    const reader = new KeyhiveProvider();
    await reader.init({ seed: new Uint8Array(32).fill(0xa2), eventStore: new InMemoryEventStore() });
    for (const mode of ["throws", "rejects", "accepts"] as const) {
      const inner = new InMemoryEventStore();
      let failing = false;
      const store = {
        put: (record: Parameters<InMemoryEventStore["put"]>[0]) => {
          if (failing && mode === "throws") throw new Error("the store threw");
          if (failing && mode === "rejects") return Promise.reject(new Error("the store rejected"));
          return inner.put(record);
        },
        list: (island?: string) => inner.list(island),
      };
      const wrapper = new KeyhiveProvider();
      await wrapper.init({ seed: new Uint8Array(32).fill(0xa1), eventStore: store as never });
      await wrapper.receiveContactCard(await reader.contactCard());
      failing = true;
      const key = mintContentKey();
      const wrapped = await wrapLockbox({
        payload: { bagId: BAG, locator: bagLocatorOf(key, BAG), keyVersion: keyVersionIdOf(key, BAG), key },
        readers: [await reader.vesselIdentifierHex()], shore: keyhiveLockboxShore([wrapper], { restArchive: async () => {} }),
      });
      if (mode === "accepts") expect("lockbox" in wrapped, mode).toBe(true);
      else expect(wrapped, mode).toMatchObject({ refusal: "wrap-failed" });
    }
  });
});

describe("a key parcel binds its lockbox to its record", () => {
  test("a parcel round-trips; a record of another kind, another locator or another version never reads as a parcel", async () => {
    const one = await signedKeyVersion(), two = await signedKeyVersion("lar:///ha.ka.ba/@test/bags/other");
    const parcel: KeyParcel = { lockbox: one.lockbox, record: one.record, ops: [new Uint8Array([1, 2]), new Uint8Array([3])] };
    const read = readKeyParcel(encodeKeyParcel(parcel));
    expect(read?.lockbox.keyVersion).toBe(one.keyVersion);
    expect(read?.ops).toEqual(parcel.ops);
    expect(hex(read!.record.sealed)).toBe(hex(one.record.sealed));
    // Another bag's lockbox beside this record: the locator differs.
    const crossed = encodeKeyParcel({ ...parcel, lockbox: two.lockbox });
    expect(hex(crossed)).not.toBe(hex(encodeKeyParcel(parcel)));
    expect(readKeyParcel(crossed)).toBeNull();
    // The same locator, another version.
    expect(readKeyParcel(encodeKeyParcel({ ...parcel, lockbox: { ...one.lockbox, keyVersion: two.keyVersion } }))).toBeNull();
    expect(readKeyParcel(encodeKeyParcel({ ...parcel, lockbox: { ...one.lockbox, bag: two.lockbox.bag } }))).toBeNull();
    // A manifest in the record's slot.
    const c = await chain("guards", "nexus-test-one");
    void c;
    const { encodeCarriedRecord, sealedImage, SEALED_KEY_PARCEL_DOMAIN } = await import("@lararium/mesh");
    const manifestish = { kind: "manifest" as const, body: { bag: one.lockbox.bag, keyVersion: one.keyVersion, parents: [], entries: [{ role: "blob" as const, address: `blake3:${"ab".repeat(32)}`, locator: "cd".repeat(32), parents: [] }] }, sealed: new Uint8Array([1]) };
    const wrongKind = sealedImage(SEALED_KEY_PARCEL_DOMAIN, encodeLockboxRecord(one.lockbox), encodeCarriedRecord(manifestish as never), sealedImage(""));
    expect(readKeyParcel(wrongKind)).toBeNull();
    // A trailing byte, and bytes of no parcel.
    expect(readKeyParcel(new Uint8Array([...encodeKeyParcel(parcel), 0]))).toBeNull();
    expect(readKeyParcel(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readKeyParcel("text")).toBeNull();
  });
});

describe("a reminted bag leaves its chunk shelf behind", () => {
  test("`remintBag` drops the shelf of the document that leaves, in the rest and in memory", async () => {
    const inner = memoryProviderChunkRest();
    const dropped: string[] = [], put: string[] = [];
    const rest = {
      put: async (shelf: string, refHex: string, ciphertext: Uint8Array) => { put.push(shelf); await inner.put(shelf, refHex, ciphertext); },
      list: (shelf: string) => inner.list(shelf),
      drop: async (shelf: string) => { dropped.push(shelf); await inner.drop(shelf); },
    };
    const p = new KeyhiveProvider();
    await p.init({ seed: new Uint8Array(32).fill(0xe1), eventStore: new InMemoryEventStore(), chunkRest: rest });
    const bag = "lar:///ha.ka.ba/@test/bags/reminted";
    await p.registerBag(bag);
    await p.encryptContent(bag, new TextEncoder().encode("tracked"));
    expect(put.length).toBe(1);
    expect((await inner.list(put[0]!)).length).toBe(1);
    await p.remintBag(bag);
    expect(dropped).toEqual([put[0]]);                               // the departing document's shelf, and no other
    expect(await inner.list(put[0]!)).toEqual([]);
    expect(await p.reSealBag(bag)).toEqual([]);
    await p.encryptContent(bag, new TextEncoder().encode("tracked again"));
    expect(put[1]).not.toBe(put[0]);                                 // the fresh document takes a shelf of its own
  });
});
