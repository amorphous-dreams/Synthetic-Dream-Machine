/**
 * sealed-store-rest tests: codec, naming, byte integrity, idempotence and memory rest laws.
 * INVARIANTS: malformed images refuse; names derive from bytes; names alone disclose no values.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it } from "vitest";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { SEALED_INDEX_ROW_DOMAIN, SEALED_LOCKBOX_RECORD_DOMAIN, SEALED_RECORD_REST_DOMAIN } from "../src/domains.js";
import { readContentKey, keyVersionIdOf, sealedImage, type KeyVersionId } from "../src/sealed-chunk.js";
import { bagLocatorOf, recordIdOf, signRecord, type BagLocator, type KeyVersionBody, type KeyVersionPrivate, type RecordSigner, type SealedRecord, type SealedChunkIndexRow, type LockboxRecord } from "../src/sealed-records.js";
import { chain, signHex } from "./face-proof-fixture.js";
import { encodeCarriedRecord, encodeIndexRow, encodeLockboxRecord, indexRowNameOf, isRestKind, isRestName, lockboxNameOf, memorySealedStoreRest, readCarriedRecord, readIndexRow, readLockboxRecord, recordNameOf, restDigest, restNameHolds, SealedStore, type RestKind, type SealedStoreRest } from "../src/sealed-store-rest.js";

const BAG_ID = "lar:///ha.ka.ba/@test/bags/garden";
const nexus = "nexus-test-one";
const k1 = readContentKey(new Uint8Array(32).fill(0x31))!;
const k2 = readContentKey(new Uint8Array(32).fill(0x32))!;
const v1 = keyVersionIdOf(k1, BAG_ID), v2 = keyVersionIdOf(k2, BAG_ID);
const bag = bagLocatorOf(k1, BAG_ID);
const writerPromise = chain("writer", nexus);
const signer = async (): Promise<RecordSigner> => { const c = await writerPromise; return { certificate: c.sessionCertificate, sign: async (purpose, payload) => ({ signature: await signHex((await import("../src/face-proof-subjects.js")).sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }) }; };
const body: KeyVersionBody = { bag, keyVersion: v1, parents: [], span: v1 };
const secret: KeyVersionPrivate = { cause: { kind: "founding" }, history: "shareable", joinProofs: [], unserved: [] };
const signed = async (span: KeyVersionId = v1): Promise<SealedRecord<"key-version">> => {
  const r = await signRecord({ kind: "key-version", body: { ...body, span }, private: secret, bagId: BAG_ID, key: k1, signer: await signer() });
  if (!("record" in r)) throw new Error(`fixture signing refused ${r.refusal}`);
  return r.record;
};
const lockbox: LockboxRecord = { bag, keyVersion: v1, wrap: "keyhive", box: new Uint8Array([1, 2, 3]) };
const row: SealedChunkIndexRow = { bag, keyVersion: v1, role: "blob", address: (`blake3:${"c".repeat(64)}`) as SealedChunkIndexRow["address"], locator: "d".repeat(64), parents: [], manifest: "e".repeat(64) as SealedChunkIndexRow["manifest"] };
const spyRest = (base: SealedStoreRest) => {
  const gets: string[] = [];
  const overrides = new Map<string, Uint8Array>();
  const key = (kind: RestKind, name: string) => `${kind}/${name}`;
  const api: SealedStoreRest & { bytes(kind: RestKind, name: string, value: Uint8Array): Promise<void>; gets: string[] } = {
    gets,
    put: async (kind, name, bytes) => {
      const existing = overrides.get(key(kind, name)) ?? await base.get(kind, name);
      if (kind !== "own" && existing !== null && (restNameHolds(name, existing) || !restNameHolds(name, bytes))) return;
      await base.put(kind, name, bytes);
      overrides.set(key(kind, name), Uint8Array.from(bytes));
    },
    get: async (kind, name) => { gets.push(name); return overrides.get(key(kind, name)) ?? base.get(kind, name); },
    list: (...args) => base.list(...args),
    bytes: (kind, name, value) => { overrides.set(key(kind, name), Uint8Array.from(value)); return Promise.resolve(); },
  };
  return api;
};
const tamper = (bytes: Uint8Array): Uint8Array => { const copy = Uint8Array.from(bytes); copy[copy.length - 1] ^= 1; return copy; };

describe("codec round trips preserve each encoded value", () => {
  it("codec round trips preserve lockboxes, signed key versions, manifests, hand-overs and rows", async () => {
    const lock = encodeLockboxRecord(lockbox); expect(readLockboxRecord(lock)).toEqual(lockbox);
    const key = await signed(); expect(readCarriedRecord(encodeCarriedRecord(key))).toEqual(key);
    const manifest = { kind: "manifest" as const, body: { bag, keyVersion: v1, parents: [], entries: [{ role: "blob" as const, address: row.address, locator: row.locator, parents: [] }] }, sealed: new Uint8Array([4]) };
    const handover = { kind: "hand-over" as const, body: { bag, keyVersion: v1, span: v1, versions: [v1] }, sealed: new Uint8Array([5]) };
    expect(readCarriedRecord(encodeCarriedRecord(manifest))).toEqual(manifest);
    expect(readCarriedRecord(encodeCarriedRecord(handover))).toEqual(handover);
    expect(readIndexRow(encodeIndexRow(row))).toEqual(row);
  });
});

describe("lockbox readers refuse malformed images", () => {
  it("lockbox reader refuses each malformed image while the untouched image reads", () => {
    const image = encodeLockboxRecord(lockbox);
    expect(readLockboxRecord(image)).toEqual(lockbox);
    expect(readLockboxRecord(image.subarray(0, -1))).toBeNull();
    expect(readLockboxRecord(Uint8Array.from([...image, 0]))).toBeNull();
    expect(readLockboxRecord(sealedImage("other-domain", hexToBytes(bag), hexToBytes(v1), utf8Bytes("keyhive"), lockbox.box))).toBeNull();
    expect(readLockboxRecord(sealedImage(SEALED_LOCKBOX_RECORD_DOMAIN, new Uint8Array(31), hexToBytes(v1), utf8Bytes("keyhive"), lockbox.box))).toBeNull();
    expect(readLockboxRecord(sealedImage(SEALED_LOCKBOX_RECORD_DOMAIN, hexToBytes(bag), new Uint8Array(31), utf8Bytes("keyhive"), lockbox.box))).toBeNull();
    expect(readLockboxRecord(sealedImage(SEALED_LOCKBOX_RECORD_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("other"), lockbox.box))).toBeNull();
    expect(readLockboxRecord(sealedImage(SEALED_LOCKBOX_RECORD_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("keyhive"), new Uint8Array()))).toBeNull();
  });
});

describe("carried record readers require known canonical shapes", () => {
  it("carried reader refuses unknown, incomplete, noncanonical, empty and trailing images", () => {
    const valid = encodeCarriedRecord({ kind: "manifest", body: { bag, keyVersion: v1, parents: [], entries: [{ role: "blob", address: row.address, locator: row.locator, parents: [] }] }, sealed: new Uint8Array([1]) });
    expect(readCarriedRecord(valid)).not.toBeNull();
    expect(readCarriedRecord(sealedImage(SEALED_RECORD_REST_DOMAIN, utf8Bytes("mystery"), utf8Bytes("{}"), new Uint8Array([1])))).toBeNull();
    expect(readCarriedRecord(sealedImage(SEALED_RECORD_REST_DOMAIN, utf8Bytes("manifest"), utf8Bytes(JSON.stringify({ bag, keyVersion: v1, parents: [] })), new Uint8Array([1])))).toBeNull();
    const reordered = `{"keyVersion":"${v1}","bag":"${bag}","parents":[],"entries":[{"role":"blob","address":"${row.address}","locator":"${row.locator}","parents":[]}]}`;
    expect(readCarriedRecord(sealedImage(SEALED_RECORD_REST_DOMAIN, utf8Bytes("manifest"), utf8Bytes(reordered), new Uint8Array([1])))).toBeNull();
    expect(readCarriedRecord(sealedImage(SEALED_RECORD_REST_DOMAIN, utf8Bytes("manifest"), utf8Bytes(JSON.stringify({ bag, keyVersion: v1, parents: [], entries: [{ role: "blob", address: row.address, locator: row.locator, parents: [] }] })), new Uint8Array()))).toBeNull();
    expect(readCarriedRecord(Uint8Array.from([...valid, 0]))).toBeNull();
  });
});

describe("index rows enforce canonical fields", () => {
  it("row reader and encoder refuse malformed roles, parents, locators and addresses", () => {
    const malformed = [
      { ...row, role: "unknown" as never },
      { ...row, role: "change", parents: [`blake3:${"b".repeat(64)}`, `blake3:${"a".repeat(64)}`] as SealedChunkIndexRow["parents"] },
      { ...row, parents: [`blake3:${"a".repeat(64)}`, `blake3:${"a".repeat(64)}`] as SealedChunkIndexRow["parents"] },
      { ...row, parents: [`blake3:${"a".repeat(64)}`] as SealedChunkIndexRow["parents"] },
      { ...row, locator: "a".repeat(62) },
      { ...row, address: "none" as SealedChunkIndexRow["address"] },
    ];
    expect(readIndexRow(encodeIndexRow(row))).toEqual(row);
    for (const bad of malformed) expect(() => encodeIndexRow(bad)).toThrow(TypeError);
    for (const bad of malformed) {
      const image = (() => { try { return encodeIndexRow({ ...row, role: "blob", parents: [] }); } catch { return new Uint8Array(); } })();
      if (image.length) expect(readIndexRow(image)).not.toBeNull();
      expect(() => encodeIndexRow(bad)).toThrow();
    }
  });
});

describe("index row images refuse every malformed field", () => {
  it("row reader refuses unknown roles, unsorted and repeated parents, blob parents, short locators and none addresses", () => {
    const valid = encodeIndexRow(row);
    expect(readIndexRow(valid)).toEqual(row);
    const images = [
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("unknown"), utf8Bytes(row.address), hexToBytes(row.locator), new Uint8Array([0, 0, 0, 0]), hexToBytes(row.manifest)),
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("blob"), utf8Bytes(row.address), hexToBytes(row.locator), new Uint8Array([0, 0, 0, 71, ...utf8Bytes(`blake3:${"a".repeat(64)}`)]), hexToBytes(row.manifest)),
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("blob"), utf8Bytes(row.address), hexToBytes(row.locator), new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1, ...utf8Bytes("blake3:z"), 0, 0, 0, 8, ...utf8Bytes("blake3:a")]), hexToBytes(row.manifest)),
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("blob"), utf8Bytes(row.address), hexToBytes(row.locator), new Uint8Array([0, 0, 0, 71, ...utf8Bytes(`blake3:${"a".repeat(64)}`), 0, 0, 0, 71, ...utf8Bytes(`blake3:${"a".repeat(64)}`)]), hexToBytes(row.manifest)),
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("blob"), utf8Bytes(row.address), hexToBytes(row.locator), new Uint8Array([0, 0, 0, 71, ...utf8Bytes(`blake3:${"a".repeat(64)}`)]), hexToBytes(row.manifest)),
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("blob"), utf8Bytes(row.address), new Uint8Array(31), new Uint8Array([0, 0, 0, 0]), hexToBytes(row.manifest)),
      sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(bag), hexToBytes(v1), utf8Bytes("blob"), utf8Bytes("none"), hexToBytes(row.locator), new Uint8Array([0, 0, 0, 0]), hexToBytes(row.manifest)),
    ];
    for (const image of images) expect(readIndexRow(image)).toBeNull();
  });
});

describe("rest names bind prefixes and bytes", () => {
  it("names lead with required ids, end in digests and reject unsafe spellings", async () => {
    const ln = lockboxNameOf(lockbox), rn = indexRowNameOf(row), lb = encodeLockboxRecord(lockbox), rb = encodeIndexRow(row);
    expect(ln.startsWith(`${v1}.${bag}.`)).toBe(true); expect(rn.startsWith(`${bag}.${v1}.${row.locator}.`)).toBe(true);
    expect(ln.endsWith(restDigest(lb))).toBe(true); expect(rn.endsWith(restDigest(rb))).toBe(true);
    for (const name of [ln, rn]) expect(isRestName(name)).toBe(true);
    for (const name of ["A", "a/b", "..", "", ".lead", "a".repeat(513)]) expect(isRestName(name)).toBe(false);
    expect(isRestKind("lockbox")).toBe(true); expect(isRestKind("unknown")).toBe(false);
  });
});

describe("stored bytes must prove their names", () => {
  it("tampered lockboxes, records and rows disappear while untouched neighbours remain", async () => {
    const base = memorySealedStoreRest(), rest = spyRest(base), store = new SealedStore(rest);
    const lb = await store.putLockbox(lockbox), lock2 = { ...lockbox, keyVersion: v2 };
    const key = await signed(), key2 = { ...key, sealed: Uint8Array.from([...key.sealed, 1]) };
    await store.putLockbox(lock2); await store.putRecord(key); await store.putRecord(key2); await store.putIndexRows([row]);
    const ln = lb, kn = recordNameOf(key), rn = indexRowNameOf(row);
    const oldLock = await base.get("lockbox", ln), oldRecord = await base.get(key.kind, kn), oldRow = await base.get("index", rn);
    await rest.bytes("lockbox", ln, tamper(oldLock!)); await rest.bytes(key.kind, kn, tamper(oldRecord!)); await rest.bytes("index", rn, tamper(oldRow!));
    expect(hex((await rest.get("lockbox", ln))!)).not.toBe(hex(oldLock!));
    expect(hex((await rest.get(key.kind, kn))!)).not.toBe(hex(oldRecord!));
    expect(hex((await rest.get("index", rn))!)).not.toBe(hex(oldRow!));
    expect(await store.lockboxes()).toHaveLength(1); expect(await store.records("key-version")).toHaveLength(1);
    expect(await store.rowsOf(bag)).toEqual([]);
    expect(await store.lockboxes()).toContainEqual(lock2); expect(await store.records("key-version")).toContainEqual(key2);
  });
});

describe("forged lockbox names do not read", () => {
  it("forged lockbox names do not read because listing re-derives decoded names", async () => {
    const rest = memorySealedStoreRest(), store = new SealedStore(rest), bytes = encodeLockboxRecord(lockbox);
    await rest.put("lockbox", `${v2}.${bag}.${restDigest(bytes)}`, bytes);
    expect(await store.lockboxes()).toEqual([]);
  });
});

describe("write once replaces only broken named values", () => {
  it("keeps sound bytes, heals tampering only with proven bytes and always replaces own notes", async () => {
    const name = lockboxNameOf(lockbox), encoded = encodeLockboxRecord(lockbox), other = Uint8Array.of(9);
    const direct = memorySealedStoreRest(); await direct.put("lockbox", name, encoded); await direct.put("lockbox", name, other); expect(hex((await direct.get("lockbox", name))!)).toBe(hex(encoded));
    const rest = spyRest(memorySealedStoreRest()); await rest.put("lockbox", name, encoded);
    const altered = tamper(encoded); await rest.bytes("lockbox", name, altered); await rest.put("lockbox", name, other); expect(hex((await rest.get("lockbox", name))!)).toBe(hex(altered));
    await rest.put("lockbox", name, encoded); expect(hex((await rest.get("lockbox", name))!)).toBe(hex(encoded));
    await rest.put("own", "note", Uint8Array.of(1)); await rest.put("own", "note", Uint8Array.of(2)); expect([...(await rest.get("own", "note"))!]).toEqual([2]);
  });
});

describe("restarts preserve one copy of each value", () => {
  it("repeated writes and a new vessel recover lockbox, record and row", async () => {
    const rest = memorySealedStoreRest(), first = new SealedStore(rest), key = await signed();
    await first.putLockbox(lockbox); await first.putLockbox(lockbox); await first.putRecord(key); await first.putRecord(key); await first.putIndexRows([row, row]);
    const restarted = new SealedStore(rest); expect(await restarted.lockboxes()).toHaveLength(1); expect(await restarted.records("key-version")).toHaveLength(1); expect(await restarted.rowsOf(bag)).toHaveLength(1);
  });
});

describe("record ids may hold unlike sealed parts", () => {
  it("returns both sealed encodings for one id and keeps another id apart", async () => {
    const store = new SealedStore(memorySealedStoreRest()), a = await signed(), b = { ...a, sealed: Uint8Array.from([...a.sealed, 2]) }, c = await signed(v1);
    await store.putRecord(a); await store.putRecord(b); await store.putRecord({ ...c, body: { ...c.body, span: v2 } });
    expect(await store.record("key-version", recordIdOf("key-version", a.body))).toHaveLength(2);
  });
});

describe("forged record names do not read", () => {
  it("forged record names do not read because listing re-derives carried ids", async () => {
    const rest = memorySealedStoreRest(), store = new SealedStore(rest), record = await signed();
    const bytes = encodeCarriedRecord(record), forgedId = "f".repeat(64);
    await rest.put("key-version", `${forgedId}.${restDigest(bytes)}`, bytes);
    expect(await store.record("key-version", forgedId as never)).toEqual([]);
    expect(await store.record("key-version", recordIdOf("key-version", record.body))).toEqual([]);
  });
});

describe("held names require no value reads", () => {
  it("lists locator and version names without get calls and rejects malformed locators", async () => {
    const rest = spyRest(memorySealedStoreRest()), store = new SealedStore(rest);
    await store.putLockbox(lockbox); await store.putIndexRows([row]);
    const names = await store.heldNames(bag); expect(names.lockboxes).toContain(lockboxNameOf(lockbox)); expect(names.rows).toContain(indexRowNameOf(row));
    expect(rest.gets).toEqual([]); expect(await store.heldNames("bad" as BagLocator)).toEqual({ lockboxes: [], rows: [] });
    expect(await store.heldNames(bag, v1)).toEqual(names);
  });
});

describe("held names filter bags and versions by name", () => {
  it("returns only requested bag names and narrows to a requested version", async () => {
    const store = new SealedStore(memorySealedStoreRest());
    await store.putLockbox(lockbox);
    await store.putLockbox({ ...lockbox, keyVersion: v2 });
    const otherBag = { ...lockbox, bag: "f".repeat(64) as BagLocator };
    await store.putLockbox(otherBag);
    await store.putIndexRows([row, { ...row, bag: "f".repeat(64) as BagLocator }]);
    expect((await store.heldNames(bag)).lockboxes).toEqual([lockboxNameOf(lockbox), lockboxNameOf({ ...lockbox, keyVersion: v2 })].sort());
    expect((await store.heldNames(bag, v2)).lockboxes).toEqual([lockboxNameOf({ ...lockbox, keyVersion: v2 })]);
    expect((await store.heldNames(bag)).rows).toEqual([indexRowNameOf(row)]);
    expect(await store.heldNames(bag, "bad" as KeyVersionId)).toEqual({ lockboxes: [], rows: [] });
  });
});

describe("store queries refuse malformed ids before listing", () => {
  it("record, held-name, row and row-at queries answer empty for malformed ids", async () => {
    const rest = spyRest(memorySealedStoreRest()), store = new SealedStore(rest);
    expect(await store.record("key-version", "bad" as never)).toEqual([]);
    expect(await store.heldNames(bag, "bad" as KeyVersionId)).toEqual({ lockboxes: [], rows: [] });
    expect(await store.rowsOf("bad" as BagLocator)).toEqual([]);
    expect(await store.rowsAt(bag, v1, "bad")).toEqual([]);
    expect(rest.gets).toEqual([]);
  });
});

describe("row and lockbox queries honor their prefixes", () => {
  it("finds one locator row, narrows lockboxes and rejects a row under a forged name", async () => {
    const base = memorySealedStoreRest(), rest = spyRest(base), store = new SealedStore(rest);
    const neighbour = { ...row, locator: "f".repeat(64) }, second = { ...row, bag: "f".repeat(64) as BagLocator };
    await store.putIndexRows([row, neighbour, second]); await store.putLockbox(lockbox); await store.putLockbox({ ...lockbox, keyVersion: v2 });
    expect(await store.rowsAt(bag, v1, row.locator)).toEqual([row]); expect(await store.lockboxes(v2)).toHaveLength(1);
    const forged = `${second.bag}.${second.keyVersion}.${second.locator}.${restDigest(encodeIndexRow(row))}`;
    await rest.put("index", forged, encodeIndexRow(row)); expect(await store.rowsOf(bag)).toEqual([row, neighbour]); expect(await store.rowsOf(second.bag)).toEqual([second]);
  });
});

describe("resting lockboxes and rows hide bag identifiers", () => {
  it("stores no recognisable bag id bytes and the control buffer contains them", async () => {
    const secretId = "lar:///ha.ka.ba/@test/bags/SEARCH-ME", locator = bagLocatorOf(k1, secretId), rest = memorySealedStoreRest(), store = new SealedStore(rest);
    await store.putLockbox({ ...lockbox, bag: locator }); await store.putIndexRows([{ ...row, bag: locator }]);
    const contains = (bytes: Uint8Array) => new TextDecoder().decode(bytes).includes(secretId);
    expect(contains(utf8Bytes(secretId))).toBe(true);
    for (const kind of ["lockbox", "index"] as const) for (const name of await rest.list(kind)) expect(contains((await rest.get(kind, name))!)).toBe(false);
  });
});

describe("every name fits one file name, and the outbox stays apart", () => {
  it("a name holds 255 characters at most; a lockbox name, a record name and a row name each fit", async () => {
    expect(isRestName("a".repeat(255))).toBe(true);
    expect(isRestName("a".repeat(256))).toBe(false);
    expect(restDigest(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{32}$/);
    for (const name of [lockboxNameOf(lockbox), recordNameOf(await signed()), indexRowNameOf(row)]) {
      expect(name.length).toBeLessThanOrEqual(255);
      expect(isRestName(name)).toBe(true);
    }
    // The longest name the store forms: three 64-character ids and the digest.
    expect(indexRowNameOf(row).length).toBe(64 * 3 + 32 + 3);
  });

  it("a parcel rests in the outbox under a digest of its reader, lists for that reader alone, and reads back whole", async () => {
    const rest = memorySealedStoreRest();
    const store = new SealedStore(rest);
    const one = new Uint8Array([1, 2, 3]), two = new Uint8Array([4, 5]);
    const nameOne = await store.putOutbox("0xREADER-ONE".toLowerCase(), one);
    const nameTwo = await store.putOutbox("reader-two", two);
    expect(await store.putOutbox("reader-one", one)).toBe(nameOne);           // the `0x` lead and the case name one reader
    expect(nameOne).not.toBe(nameTwo);
    expect(nameOne.includes("reader")).toBe(false);                            // the reader's name reads opaque
    expect((await store.outbox("reader-one")).map((p) => hex(p.parcel))).toEqual([hex(one)]);
    expect((await store.outbox("reader-two")).map((p) => p.name)).toEqual([nameTwo]);
    expect((await store.outbox()).length).toBe(2);
    expect(await store.outbox("reader-three")).toEqual([]);
    // No other shelf holds it: a carrier that takes lockboxes, records and rows takes no parcel.
    for (const kind of ["lockbox", "key-version", "manifest", "index", "own"] as const) expect(await rest.list(kind)).toEqual([]);
    expect(isRestKind("outbox")).toBe(true);
  });
});
