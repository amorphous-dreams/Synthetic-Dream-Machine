/**
 * reseal-record — a roll's replacement signs one causal re-seal record (the road's #/rulings, "The re-seal proof").
 *
 * When a content key rolls at a counted removal, the face session that writes a replacement signs one re-seal record per
 * replacement: the bag locator, the old and new key-version ids, the old and new ciphertext addresses, the logical entry
 * it replaces, and the removal acts that authorized the roll. A reader with partial history verifies the signature and
 * every binding it holds, and reports a missing parent as unverified, never as complete.
 *
 * The key shore here models the measured substrate (`content-key-fixture`). Synthetic names and keys.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records
 */
import { describe, expect, it } from "vitest";
import { hexToBytes, utf8Bytes } from "../src/crypto.js";
import { KeyLineage, contentKeyRollSink, type KeyCause, type RollOutcome } from "../src/content-key-lineage.js";
import type { SealedBlob } from "../src/content-key-holder.js";
import { keyVersionIdOf, mintContentKey, sealChunk, type ContentKey, type KeyVersionId, type SealedAddress } from "../src/sealed-chunk.js";
import {
  RECORD_KINDS, bagLocatorOf, entryLocatorOf, factOfRecord, judgeReseal, readRecord, recordIdOf, signRecord,
  type RecordSigner, type VerifiedRecord,
} from "../src/sealed-records.js";
import type { SeatRoll } from "../src/seat-duties.js";
import { carry, counts, introduce, said, text, vessel, world, type Vessel, type World } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/photo-shelf";
const SCOPE = "fleet:test-scope";

async function seal(v: Vessel, plaintext: string): Promise<SealedBlob> {
  const r = await v.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes(plaintext), signer: v.signer });
  if ("refusal" in r) throw new Error(`setup: seal refused ${said(r)}`);
  return r;
}
const roll = (raiseCids: string[], seat: Vessel): SeatRoll =>
  ({ kind: "seat-roll", scope: SCOPE, edgeId: "edge-1", seat: { group: "0xgroup", member: `0x${seat.id}` }, raiseCids, how: "revoked" });
async function rolls(v: Vessel, r: SeatRoll): Promise<RollOutcome[]> {
  const reports: RollOutcome[] = [];
  await contentKeyRollSink(v.holder.rollerPorts({ bagsOf: (scope) => (scope === SCOPE ? [BAG] : []), signer: () => v.signer, report: (o) => { reports.push(o); } }))(r);
  return reports;
}
async function fleet(...names: string[]): Promise<{ w: World; v: Vessel[] }> {
  const w = world();
  const v: Vessel[] = [];
  for (const name of names) v.push(await vessel(w, name));
  introduce(...v);
  return { w, v };
}
/** A, B and C hold a photo; a raise over C counts on every board; A rolls the bag, leaving C out. */
async function rolledShelf(): Promise<{ a: Vessel; b: Vessel; photo: SealedBlob; successor: string }> {
  const { w, v: [a, b, c] } = await fleet("a", "b", "c");
  const photo = await seal(a!, "the harbour photo");
  await carry(a!, b!, BAG); await carry(a!, c!, BAG);
  counts(w, a!, "raise-1"); counts(w, b!, "raise-1"); counts(w, c!, "raise-1");
  w.group.delete(c!.id);
  const reports = await rolls(a!, roll(["raise-1"], c!));
  expect(reports.map((r) => r.result)).toEqual(["rolled"]);
  return { a: a!, b: b!, photo, successor: reports[0]!.keyVersion! };
}
/** Hand B every re-seal record A rests, as a carrier would. */
async function handOver(a: Vessel, b: Vessel): Promise<void> {
  await carry(a, b, BAG);
  for (const one of await a.store.records("re-seal")) await b.store.putRecord(one);
}

describe("a roll's replacement signs one re-seal record", () => {
  it("CONTROL (the ground the replacement stands on): the roll mints a removal successor, and a remaining reader still opens the photo", async () => {
    const { a, b, photo, successor } = await rolledShelf();
    expect(successor).not.toBe(photo.body.keyVersion);
    const reading = await a.holder.reading(BAG);
    expect("foundings" in reading && reading.foundings[0]!.heads).toEqual([successor]);
    const atB = await b.holder.openBlob({ bagId: BAG, ref: photo.body.ref });
    expect("plaintext" in atB ? text(atB.plaintext) : said(atB)).toBe("the harbour photo");
  });

  it("the record kind stands among the kinds a store rests and carries", () => {
    expect(RECORD_KINDS).toContain("re-seal");
  });

  it("A REPLACEMENT AFTER A ROLL RE-SEALS THE BODY UNDER THE SUCCESSOR AND SIGNS ONE RECORD naming both versions, both addresses and the entry; a remaining reader judges it complete", async () => {
    const { a, b, photo, successor } = await rolledShelf();
    const replaced = await a.holder.resealBlob({ bagId: BAG, ref: photo.body.ref, signer: a.signer });
    if ("refusal" in replaced) throw new Error(`reseal refused ${said(replaced)}`);
    expect(replaced.body.keyVersion).toBe(successor);
    expect(replaced.body.ref).toBe(photo.body.ref);                 // the same plaintext, a new ciphertext
    expect(replaced.body.cid).not.toBe(photo.body.cid);
    const records = await a.store.records("re-seal");
    expect(records.length).toBe(1);                                  // one record per replacement
    expect(records[0]!.body).toMatchObject({ keyVersion: successor, replaced: photo.body.keyVersion, from: photo.body.cid, to: replaced.body.cid });
    expect(recordIdOf("re-seal", records[0]!.body)).toBe(replaced.reseal);
    // B, a remaining reader, verifies the record as any record, and every binding it holds stands.
    await handOver(a, b);
    expect(await b.holder.judgeReseals(BAG)).toEqual([{ id: replaced.reseal, verdict: "complete" }]);
    const atB = await b.holder.openBlob({ bagId: BAG, ref: photo.body.ref });
    expect("plaintext" in atB ? text(atB.plaintext) : said(atB)).toBe("the harbour photo");
  });

  it("CONTROL: with no roll standing, a replacement owes no re-seal: it refuses `head-not-rolled` and no record rests", async () => {
    const { v: [a] } = await fleet("a");
    const photo = await seal(a!, "a photo before any removal");
    expect(said(await a!.holder.resealBlob({ bagId: BAG, ref: photo.body.ref, signer: a!.signer }))).toBe("head-not-rolled");
    expect(await a!.store.records("re-seal")).toEqual([]);
  });

  it("a replacement no session signs rests no value and no record: `signer-unavailable`, `record-refused:signer-refused`", async () => {
    const { a, photo } = await rolledShelf();
    const before = a.values.size;
    const refusing: RecordSigner = { certificate: a.signer.certificate, sign: async () => ({ refusal: "session-closed" }) };
    expect(said(await a.holder.resealBlob({ bagId: BAG, ref: photo.body.ref, signer: null }))).toBe("signer-unavailable");
    expect(said(await a.holder.resealBlob({ bagId: BAG, ref: photo.body.ref, signer: refusing }))).toMatch(/^record-refused:signer-refused/);
    expect(a.values.size).toBe(before);
    expect(await a.store.records("re-seal")).toEqual([]);
  });
});

describe("a forged or unsigned re-seal record refuses by name", () => {
  it("a clear part moved to another address reads `sealed-part-refused` at the reader; a signature by another session reads `signature-refused`", async () => {
    const { a, b, photo } = await rolledShelf();
    const replaced = await a.holder.resealBlob({ bagId: BAG, ref: photo.body.ref, signer: a.signer });
    if ("refusal" in replaced) throw new Error(said(replaced));
    const [record] = await a.store.records("re-seal");
    // A forgery points the replacement at another body's ciphertext: its id moves, so its sealed part opens under no id it names.
    const other = await seal(a, "a photo of somewhere else");
    const forged = { ...record!, body: { ...record!.body, to: other.body.cid as SealedAddress } };
    await handOver(a, b);
    await b.store.putRecord(forged);
    const verdicts = await b.holder.judgeReseals(BAG);
    expect(verdicts).toContainEqual({ id: replaced.reseal, verdict: "complete" });          // CONTROL: the record as signed
    expect(verdicts).toContainEqual({ id: recordIdOf("re-seal", forged.body), verdict: "refused", refusal: "sealed-part-refused" });
    // B's session signing over A's certificate: the signature covers no record A's session signed, so nothing rests.
    const swapped = await a.holder.resealBlob({ bagId: BAG, ref: photo.body.ref, signer: { certificate: a.signer.certificate, sign: b.signer.sign } });
    expect(said(swapped)).toMatch(/^record-refused:signature-refused/);
  });

  it("a record whose removal acts the successor never names reads `reseal-unbound`; a reader holding neither manifest reads `unverified`, never complete", async () => {
    const s = await keyShore(2);
    const v0 = await s.version(0, [], 0, { kind: "founding" });
    const v1 = await s.version(1, [0], 0, { kind: "removal", acts: ["raise-1"] });
    const lineage = s.lineageOf([v0, v1]);
    const body = { from: s.address(0, PHOTO), to: s.address(1, PHOTO), entry: s.entry(0, PHOTO) };
    const held = { bagId: BAG, lineage, keys: s.keyMap(0, 1), manifests: [] };
    expect(judgeReseal(await s.reseal(1, 0, body, { acts: ["raise-other"] }), held)).toMatchObject({ verdict: "refused", refusal: "reseal-unbound", binding: "successor" });
    expect(judgeReseal(await s.reseal(1, 0, body, { acts: ["raise-1"] }), held)).toMatchObject({ verdict: "unverified" });
  });
});

// ── The judge, over a key shore this suite mints ───────────────────────────────────────────────
/** Every transition this suite counts verifies: the judge's own reading is what each case moves. */
const EVIDENCE = { raiseCounts: () => true, admissionVerifies: () => true, joinProven: () => true };
/** N content keys of one bag, the locator its founding key derives, and two capable writers to sign with. */
async function keyShore(n: number) {
  const { v: [x, y] } = await fleet("x", "y");
  const keys = Array.from({ length: n }, () => mintContentKey());
  const ids = keys.map((key) => keyVersionIdOf(key, BAG));
  const locator = bagLocatorOf(keys[0]!, BAG);
  const reader = (i: number) => ({ bagId: BAG, locator, key: keys[i]!, standing: { holdsWrite: () => true } });
  /** A key version record for version i, verified under its own key. */
  const version = async (i: number, parents: number[], span: number, cause: KeyCause): Promise<VerifiedRecord<"key-version">> => {
    const signed = await signRecord({ kind: "key-version", bagId: BAG, key: keys[i]!, signer: x!.signer,
      body: { bag: locator, keyVersion: ids[i]!, parents: parents.map((p) => ids[p]!).sort(), span: ids[span]! },
      private: { cause, history: "closed", joinProofs: [], unserved: [] } });
    if (!("record" in signed)) throw new Error(said(signed));
    const read = readRecord("key-version", signed.record, reader(i));
    if (!("record" in read)) throw new Error(said(read));
    return read.record;
  };
  /** Count the versions, in order, into one reader's lineage; `unheld` names parents it holds no record for. */
  const lineageOf = (records: VerifiedRecord<"key-version">[], unheld: KeyVersionId[] = []): KeyLineage => {
    let lineage = KeyLineage.empty();
    for (const record of records) {
      const counted = lineage.count(factOfRecord(record), EVIDENCE, unheld);
      if (!("lineage" in counted)) throw new Error(`setup: count refused ${counted.refusal}`);
      lineage = counted.lineage;
    }
    return lineage;
  };
  const ctx = (i: number, ref: string) => ({ bagId: BAG, keyVersion: ids[i]!, role: "blob" as const, logicalRef: hexToBytes(ref) });
  /** A sealed blob address under version i for a logical reference. */
  const address = (i: number, ref: string, plaintext = "photo"): SealedAddress => {
    const out = sealChunk({ key: keys[i]!, context: ctx(i, ref), plaintext: utf8Bytes(plaintext) });
    if (!("chunk" in out)) throw new Error("setup: seal refused");
    return out.chunk.address;
  };
  /** A verified manifest under version i naming one blob address under the reference's entry locator. */
  const manifest = async (i: number, ref: string, at: SealedAddress, signer: RecordSigner = x!.signer): Promise<VerifiedRecord<"manifest">> => {
    const signed = await signRecord({ kind: "manifest", bagId: BAG, key: keys[i]!, signer,
      body: { bag: locator, keyVersion: ids[i]!, parents: [], entries: [{ role: "blob", address: at, locator: entryLocatorOf(keys[i]!, ctx(i, ref)), parents: [] }] },
      private: { writer: `session:${signer.certificate.sessionKey}` } });
    if (!("record" in signed)) throw new Error(said(signed));
    const read = readRecord("manifest", signed.record, reader(i));
    if (!("record" in read)) throw new Error(said(read));
    return read.record;
  };
  /** A verified re-seal record riding under version `under`, replacing a value of version `old`. */
  const reseal = async (under: number, old: number, body: { from: SealedAddress; to: SealedAddress; entry: string }, secret: Record<string, unknown>): Promise<VerifiedRecord<"re-seal">> => {
    const signed = await signRecord({ kind: "re-seal", bagId: BAG, key: keys[under]!, signer: x!.signer,
      body: { bag: locator, keyVersion: ids[under]!, replaced: ids[old]!, ...body }, private: secret as never });
    if (!("record" in signed)) throw new Error(said(signed));
    const read = readRecord("re-seal", signed.record, reader(under));
    if (!("record" in read)) throw new Error(said(read));
    return read.record;
  };
  const keyMap = (...held: number[]) => new Map(held.map((i) => [ids[i]!, keys[i]!] as const));
  const entry = (i: number, ref: string) => entryLocatorOf(keys[i]!, ctx(i, ref));
  return { x: x!, y: y!, keys, ids, locator, version, lineageOf, ctx, address, manifest, reseal, keyMap, entry };
}
const PHOTO = "a".repeat(64);

describe("the judge reads counted history alone", () => {
  it("a successor the reader verified and never counted stands as no history: unverified, never complete", async () => {
    const s = await keyShore(2);
    const v0 = await s.version(0, [], 0, { kind: "founding" });
    await s.version(1, [0], 0, { kind: "removal", acts: ["raise-1"] });
    const from = s.address(0, PHOTO), to = s.address(1, PHOTO);
    const record = await s.reseal(1, 0, { from, to, entry: s.entry(0, PHOTO) }, { acts: ["raise-1"] });
    const manifests = [await s.manifest(0, PHOTO, from), await s.manifest(1, PHOTO, to)];
    // The reader counted the founding alone: the successor's record reached it, and its count never landed.
    const verdict = judgeReseal(record, { bagId: BAG, lineage: s.lineageOf([v0]), keys: s.keyMap(0, 1), manifests });
    expect(verdict).toMatchObject({ verdict: "unverified" });
    expect((verdict as { missing: string[] }).missing).toContain("successor");
  });
});
