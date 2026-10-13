/**
 * content-key-memory — the memory section a backup bundle carries, and the one door that imports it.
 *
 * A face's bundle carries the content keys its vessel counted and held. The holder seals that section inside
 * itself to a public key the cut named; an import opens it inside the holder of the vessel that takes it, judges
 * each entry apart, and lands what passes as a lockbox for that vessel's own seat under a `memory-import` record.
 *
 * The vectors here pin, first, what a bundle REACHES apart from what its keys AUTHOR: a restored reader opens a
 * body written after the cut under an unchanged version, and an honest reader rejects a thief's body under that
 * same version. Then each refusal, by name.
 *
 * The key shore models the measured substrate (`content-key-fixture`). Synthetic names and keys.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lararium/mesh/custody#/the-bundle
 */
import { describe, expect, it } from "vitest";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { sealPrivateBody } from "../src/ciphertext-cas.js";
import { contentKeyRollSink } from "../src/content-key-lineage.js";
import { HOLDER_REFUSALS, MEMORY_OUTCOMES, type SealedBlob } from "../src/content-key-holder.js";
import { mintMemoryKeypair, openMemorySection, sealMemorySection, type MemoryKeypair } from "../src/memory-section.js";
import { mintContentKey, type ContentKey, type KeyVersionId, type SealContext } from "../src/sealed-chunk.js";
import {
  RECORD_KINDS, entryLocatorOf, indexRowsOf, readRecord, signRecord,
  type KeyVersionBody, type KeyVersionPrivate, type ManifestBody, type RecordSigner, type WriterStanding,
} from "../src/sealed-records.js";
import type { SeatRoll } from "../src/seat-duties.js";
import { carry, counts, introduce, said, text, vessel, world, type Vessel, type World } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const OTHER = "lar:///ha.ka.ba/@test/bags/kitchen-notes";
const SCOPE = "fleet:test-scope";
const body = (s: string): Uint8Array => utf8Bytes(s);

async function seal(v: Vessel, plaintext: string, bagId = BAG): Promise<SealedBlob> {
  const r = await v.holder.sealBlob({ bagId, plaintext: body(plaintext), signer: v.signer });
  if ("refusal" in r) throw new Error(`setup: seal refused ${said(r)}`);
  return r;
}
async function opens(v: Vessel, ref: string, bagId = BAG): Promise<string> {
  const r = await v.holder.openBlob({ bagId, ref });
  return "plaintext" in r ? text(r.plaintext) : `REFUSED:${said(r)}`;
}
/** Cut one vessel's memory section for `bags`, to a fresh keypair. */
async function cut(v: Vessel, bags: readonly string[] = [BAG]): Promise<{ section: Uint8Array; pair: MemoryKeypair; holds: readonly { bagId: string; keyVersion: KeyVersionId }[] }> {
  const pair = mintMemoryKeypair();
  const r = await v.holder.cutMemory({ bags, to: pair.public });
  if ("refusal" in r) throw new Error(`setup: cut refused ${said(r)}`);
  return { section: r.section, pair, holds: r.holds };
}
/** What a blind carrier holds for one vessel reaches another: records and sealed values, and no lockbox. */
async function carryBlind(from: Vessel, to: Vessel): Promise<void> {
  for (const kind of RECORD_KINDS) for (const record of await from.store.records(kind)) await to.store.putRecord(record);
  for (const [address, bytes] of from.values) to.values.set(address, Uint8Array.from(bytes));
}
const outcomes = (r: Awaited<ReturnType<Vessel["holder"]["importMemory"]>>): string[] =>
  ("results" in r ? r.results.map((one) => `${one.outcome}${one.cause ? `:${one.cause}` : ""}`) : [`REFUSED:${said(r)}`]);
const lockboxes = (v: Vessel): number => [...v.rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length;
const roll = (raiseCids: string[], seat?: Vessel): SeatRoll =>
  ({ kind: "seat-roll", scope: SCOPE, edgeId: "edge-1", ...(seat ? { seat: { group: "0xgroup", member: `0x${seat.id}` } } : {}), raiseCids, how: "revoked" });
async function rolls(v: Vessel, r: SeatRoll): Promise<void> {
  await contentKeyRollSink(v.holder.rollerPorts({ bagsOf: (scope) => (scope === SCOPE ? [BAG] : []), signer: () => v.signer }))(r);
}

/** The old vessel, and the fresh vessel the same face returns on: a new seat, no lockbox, an empty rest. */
async function lostAndReturned(over: { standing?: WriterStanding } = {}): Promise<{ w: World; old: Vessel; fresh: Vessel }> {
  const w = world();
  const old = await vessel(w, "old-device", over);
  const fresh = await vessel(w, "fresh-device", over);
  introduce(old, fresh);
  return { w, old, fresh };
}

describe("REACH APART FROM AUTHORSHIP: what a bundle's keys open, and what they never author", () => {
  it("the restored reader OPENS a body written after the cut under an unchanged version; the honest reader REJECTS a thief's body under that version", async () => {
    // The honest reader counts a writer capable only where its own reading says so: the thief's face holds no standing.
    const capable = new Set<string>();
    const standing: WriterStanding = { holdsWrite: ({ certificate }) => capable.has(certificate.sessionKey) };
    const { w, old, fresh } = await lostAndReturned({ standing });
    capable.add(old.signer.certificate.sessionKey); capable.add(fresh.signer.certificate.sessionKey);

    const before = await seal(old, "written before the cut");
    const V = before.body.keyVersion;
    const bundle = await cut(old);
    expect(bundle.holds).toEqual([{ bagId: BAG, founding: before.founding, keyVersion: V }]);

    // AFTER THE CUT, a capable writer seals a new body and a signed manifest under the SAME version.
    const after = await seal(old, "written after the cut");
    expect(after.body.keyVersion).toBe(V);
    expect(after.founded).toBeUndefined();

    // The device drowns. The sealed bytes and the records survive on a blind carrier; no lockbox does.
    await carryBlind(old, fresh);
    expect(lockboxes(fresh)).toBe(0);
    // CONTROL: before the import the fresh seat opens nothing.
    expect(await opens(fresh, before.body.ref)).toBe("REFUSED:bag-unfounded");

    const imported = await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer });
    expect(outcomes(imported)).toEqual(["imported"]);
    expect(await opens(fresh, before.body.ref)).toBe("written before the cut");
    // THE REACH LAW: the bundle's key opens a value sealed after its cut.
    expect(await opens(fresh, after.body.ref)).toBe("written after the cut");

    // A THIEF holds the bundle and its route, so it holds the bare key. It seals a body of its own under V.
    const stolen = openMemorySection(bundle.section, bundle.pair.secret)!;
    const key = stolen[0]!.key as ContentKey;
    const thief = await vessel(w, "thief");   // a session of a face the honest reader counts as no writer
    const forged = sealPrivateBody(body("the thief's own words"), { bagId: BAG, key });
    if (!("body" in forged)) throw new Error("setup: the thief's seal refused");
    const context: SealContext = { bagId: BAG, keyVersion: V, role: "blob", logicalRef: hexToBytes(forged.body.ref) };
    const manifest: ManifestBody = { bag: before.founding, keyVersion: V, parents: [], entries: [{ role: "blob", address: forged.body.cid, locator: entryLocatorOf(key, context), parents: [] }] };
    const plant = async (signer: RecordSigner): Promise<void> => {
      const signed = await signRecord({ kind: "manifest", body: manifest, private: {}, bagId: BAG, key, signer });
      if (!("record" in signed)) throw new Error(`setup: the manifest did not sign (${signed.refusal})`);
      fresh.values.set(forged.body.cid, forged.body.ciphertext);
      await fresh.store.putRecord(signed.record);
      // The thief writes the index row by hand: a row authorizes nothing.
      const row = { bag: manifest.bag, keyVersion: V, role: "blob" as const, address: forged.body.cid, locator: manifest.entries[0]!.locator, parents: [], manifest: signed.id };
      await fresh.store.putIndexRows([row]);
    };
    await plant(thief.signer);
    // AUTHORSHIP: the key seals valid bytes, and no honest reader counts them.
    expect(await opens(fresh, forged.body.ref)).toBe("REFUSED:reference-unknown");
    // CONTROL: the same bytes under a capable session's manifest open, so the refusal measures the signer alone.
    await plant(fresh.signer);
    fresh.restart();
    expect(await opens(fresh, forged.body.ref)).toBe("the thief's own words");
  });

  it("a span declared CLOSED imports for the same face on a new device, where a hand-over to that device refuses", async () => {
    const { old, fresh } = await lostAndReturned();
    const sealed = await seal(old, "a closed span's note");   // a founding with no declaration stands closed
    const handed = await old.holder.handOver({ bagId: BAG, reader: fresh.id, signer: old.signer });
    expect(said(handed)).toBe("history-closed");
    const bundle = await cut(old);
    await carryBlind(old, fresh);
    expect(outcomes(await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer }))).toEqual(["imported"]);
    expect(await opens(fresh, sealed.body.ref)).toBe("a closed span's note");
  });
});

describe("the cut: the section seals inside the holder", () => {
  it("answers ciphertext and a list of bags and versions; no bare key reaches the answer or the section's bytes", async () => {
    const { old } = await lostAndReturned();
    await seal(old, "one"); await seal(old, "two", OTHER);
    const bundle = await cut(old, [BAG, OTHER]);
    expect(bundle.holds.map((h) => h.bagId).sort()).toEqual([BAG, OTHER].sort());
    const keys = openMemorySection(bundle.section, bundle.pair.secret)!.map((e) => hex(e.key));
    expect(keys).toHaveLength(2);
    // CONTROL FIRST: the hunt finds a key in bytes that hold one.
    expect(hex(hexToBytes(keys[0]!)).includes(keys[0]!)).toBe(true);
    for (const key of keys) {
      expect(hex(bundle.section).includes(key)).toBe(false);
      expect(JSON.stringify(bundle.holds).includes(key)).toBe(false);
    }
    // Another keypair opens nothing.
    expect(openMemorySection(bundle.section, mintMemoryKeypair().secret)).toBeNull();
  });

  it("carries only the bags the cut names, and only versions the holder counted and held", async () => {
    const { old } = await lostAndReturned();
    await seal(old, "garden"); await seal(old, "kitchen", OTHER);
    const bundle = await cut(old, [BAG]);
    expect(bundle.holds.map((h) => h.bagId)).toEqual([BAG]);
    // A bag no key ever served yields no entry, and the cut still answers.
    const none = await cut(old, ["lar:///ha.ka.ba/@test/bags/never-founded"]);
    expect(none.holds).toEqual([]);
    expect(openMemorySection(none.section, none.pair.secret)).toEqual([]);
  });

  it("leaves out a key the holder holds and never counted: a lockbox no counted record names carries nothing into a bundle", async () => {
    const { w, old, fresh } = await lostAndReturned();
    const first = await seal(old, "before the roll");
    counts(w, old, "raise-1");
    await rolls(old, roll(["raise-1"]));
    const second = await seal(old, "after the roll");
    // The fresh vessel receives both lockboxes over the member lane, and its own ledger counts no raise.
    await carry(old, fresh, BAG);
    const reading = await fresh.holder.reading(BAG);
    if ("refusal" in reading) throw new Error("setup: no reading");
    expect(reading.foundings[0]!.uncounted.map((u) => u.keyVersion)).toEqual([second.body.keyVersion]);
    const bundle = await cut(fresh);
    expect(bundle.holds.map((h) => h.keyVersion)).toEqual([first.body.keyVersion]);
    // CONTROL: the vessel that counts the raise carries both.
    expect((await cut(old)).holds).toHaveLength(2);
  });

  it("REFUSES under the vessel's own shadow, by name, and answers no section", async () => {
    const { old } = await lostAndReturned();
    await seal(old, "one");
    old.shadowed = true;
    const r = await old.holder.cutMemory({ bags: [BAG], to: mintMemoryKeypair().public });
    expect(said(r)).toBe("own-edge-shadowed");
    expect("section" in r).toBe(false);
    // CONTROL: the same cut runs once the shadow lifts.
    old.shadowed = false;
    expect("section" in await old.holder.cutMemory({ bags: [BAG], to: mintMemoryKeypair().public })).toBe(true);
  });

  it("a locked holder refuses the cut and the import by name", async () => {
    const { old, fresh } = await lostAndReturned();
    await seal(old, "one");
    const bundle = await cut(old);
    old.holder.lock(); fresh.holder.lock();
    expect(said(await old.holder.cutMemory({ bags: [BAG], to: bundle.pair.public }))).toBe("holder-locked");
    expect(said(await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer }))).toBe("holder-locked");
  });
});

describe("the import door: the act judged whole, then each entry apart", () => {
  it("refuses whole, by name: no session signer, no seat of its own, its own shadow, a section that opens to nothing", async () => {
    const { old, fresh } = await lostAndReturned();
    await seal(old, "one");
    const bundle = await cut(old);
    await carryBlind(old, fresh);
    const ask = (over: Partial<{ section: Uint8Array; secret: Uint8Array; signer: RecordSigner | null }> = {}) =>
      fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer, ...over });
    expect(said(await ask({ signer: null }))).toBe("signer-unavailable");
    fresh.seated = false;
    expect(said(await ask())).toBe("seat-not-standing");
    fresh.seated = true;
    fresh.shadowed = true;
    expect(said(await ask())).toBe("own-edge-shadowed");
    fresh.shadowed = false;
    expect(said(await ask({ secret: mintMemoryKeypair().secret }))).toBe("memory-malformed");
    const torn = Uint8Array.from(bundle.section); torn[torn.length - 1]! ^= 1;
    expect(said(await ask({ section: torn }))).toBe("memory-malformed");
    // Nothing landed across every refusal.
    expect(lockboxes(fresh)).toBe(0);
    expect((await fresh.store.records("memory-import")).length).toBe(0);
    // CONTROL: the same import, whole, lands.
    expect(outcomes(await ask())).toEqual(["imported"]);
  });

  it("a FORGED key and a SWAPPED key each stop at `key-forged`, and nothing of them lands", async () => {
    const { old, fresh } = await lostAndReturned();
    const one = await seal(old, "garden"); const two = await seal(old, "kitchen", OTHER);
    const bundle = await cut(old, [BAG, OTHER]);
    await carryBlind(old, fresh);
    const real = openMemorySection(bundle.section, bundle.pair.secret)!;
    const pair = mintMemoryKeypair();
    // FORGED: a fresh random key under an honest entry's names.
    const forged = sealMemorySection([{ ...real[0]!, key: mintContentKey() }, real[1]!], pair.public);
    // The tamper moved the decoded bytes, and only the forged entry's.
    const reread = openMemorySection(forged, pair.secret)!;
    expect(hex(reread[0]!.key)).not.toBe(hex(real[0]!.key));
    expect(hex(reread[1]!.key)).toBe(hex(real[1]!.key));
    const first = await fresh.holder.importMemory({ section: forged, secret: pair.secret, signer: fresh.signer });
    expect(outcomes(first).sort()).toEqual(["imported", "key-forged"]);
    // SWAPPED: each entry carries the other's key.
    const fresh2 = (await lostAndReturned()).fresh;
    await carryBlind(old, fresh2);
    const swapped = sealMemorySection([{ ...real[0]!, key: real[1]!.key }, { ...real[1]!, key: real[0]!.key }], pair.public);
    expect(outcomes(await fresh2.holder.importMemory({ section: swapped, secret: pair.secret, signer: fresh2.signer }))).toEqual(["key-forged", "key-forged"]);
    expect(lockboxes(fresh2)).toBe(0);
    expect(await opens(fresh2, one.body.ref)).toBe("REFUSED:bag-unfounded");
    expect(await opens(fresh2, two.body.ref, OTHER)).toBe("REFUSED:bag-unfounded");
  });

  it("a key whose record this vessel cannot verify stays out (`record-unverified`), and lands once the record rests here", async () => {
    const { old, fresh } = await lostAndReturned();
    const sealed = await seal(old, "one");
    const bundle = await cut(old);
    // No record reached the fresh vessel: the key names a version nothing here vouches for.
    const ask = () => fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer });
    expect(outcomes(await ask())).toEqual(["record-unverified"]);
    expect(lockboxes(fresh)).toBe(0);
    await carryBlind(old, fresh);
    expect(outcomes(await ask())).toEqual(["imported"]);
    expect(await opens(fresh, sealed.body.ref)).toBe("one");
  });

  it("a CONFLICTED version stops at `version-conflicted`: two unlike verified records under one id count for nobody", async () => {
    const { old, fresh } = await lostAndReturned();
    const sealed = await seal(old, "one");
    const V = sealed.body.keyVersion;
    const bundle = await cut(old);
    await carryBlind(old, fresh);
    // A capable writer signs a second, unlike record under the same id: the same clear part, another declaration.
    const key = openMemorySection(bundle.section, bundle.pair.secret)![0]!.key as ContentKey;
    const clear: KeyVersionBody = { bag: sealed.founding, keyVersion: V, parents: [], span: V };
    const unlike: KeyVersionPrivate = { cause: { kind: "founding" }, history: "shareable", joinProofs: [], unserved: [] };
    const twin = await signRecord({ kind: "key-version", body: clear, private: unlike, bagId: BAG, key, signer: old.signer });
    if (!("record" in twin)) throw new Error("setup: the unlike twin did not sign");
    await fresh.store.putRecord(twin.record);
    expect((await fresh.store.records("key-version")).length).toBe(2);
    expect(outcomes(await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer }))).toEqual(["version-conflicted"]);
    expect(lockboxes(fresh)).toBe(0);
    expect(await opens(fresh, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
  });

  it("a removal's version counts by this vessel's OWN ledger: `transition-uncounted` until the raise counts here, then it lands", async () => {
    const { w, old, fresh } = await lostAndReturned();
    await seal(old, "before the roll");
    counts(w, old, "raise-1");
    await rolls(old, roll(["raise-1"]));
    const after = await seal(old, "after the roll");
    const bundle = await cut(old);
    expect(bundle.holds).toHaveLength(2);
    await carryBlind(old, fresh);
    const ask = () => fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer });
    const first = outcomes(await ask()).sort();
    expect(first).toEqual(["imported", "transition-uncounted:cause-unverified"]);
    expect(await opens(fresh, after.body.ref)).toBe("REFUSED:reference-unknown");
    // The bundle keeps the key: once this vessel's own ledger counts the raise, the same import lands it.
    counts(w, fresh, "raise-1");
    expect(outcomes(await ask()).sort()).toEqual(["held", "imported"]);
    expect(await opens(fresh, after.body.ref)).toBe("after the roll");
  });

  it("AN OLD BUNDLE OVER A NEWER HOLDER adds nothing and moves nothing: `held`, no lockbox, the newer head stands", async () => {
    const { w, old } = await lostAndReturned();
    const first = await seal(old, "before the roll");
    const bundle = await cut(old);              // the old bundle: one version
    counts(w, old, "raise-1");
    await rolls(old, roll(["raise-1"]));
    const second = await seal(old, "after the roll");
    expect(second.body.keyVersion).not.toBe(first.body.keyVersion);
    const before = { lockboxes: lockboxes(old), reading: JSON.stringify(await old.holder.reading(BAG)), imports: (await old.store.records("memory-import")).length };
    expect(outcomes(await old.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: old.signer }))).toEqual(["held"]);
    expect({ lockboxes: lockboxes(old), reading: JSON.stringify(await old.holder.reading(BAG)), imports: (await old.store.records("memory-import")).length }).toEqual(before);
    expect(await opens(old, second.body.ref)).toBe("after the roll");
    // It keeps sealing under the newer head.
    expect((await seal(old, "a third")).body.keyVersion).toBe(second.body.keyVersion);
  });
});

describe("what an import leaves at rest", () => {
  it("one lockbox for this vessel's own seat and one `memory-import` record under the version, which every reader of that version reads", async () => {
    const { w, old, fresh } = await lostAndReturned();
    const sealed = await seal(old, "one");
    const V = sealed.body.keyVersion;
    const bundle = await cut(old);
    await carryBlind(old, fresh);
    const docsBefore = new Set(w.docs.keys());
    await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer });
    expect(lockboxes(fresh)).toBe(1);
    // THE WRAP SEATS THIS VESSEL'S OWN SEAT ALONE: the bag's other readers gain no lockbox by a recovery.
    const wrapped = [...w.docs].filter(([docId]) => !docsBefore.has(docId)).map(([, doc]) => [...doc.seats]);
    expect(wrapped).toEqual([[fresh.id]]);
    const records = await fresh.store.records("memory-import");
    expect(records).toHaveLength(1);
    expect(records[0]!.body).toEqual({ bag: sealed.founding, keyVersion: V });
    // Any reader of the version verifies it as any record, and reads which seat holds the version by recovery.
    const key = openMemorySection(bundle.section, bundle.pair.secret)![0]!.key as ContentKey;
    const read = readRecord("memory-import", records[0]!, { bagId: BAG, locator: sealed.founding, key, standing: { holdsWrite: () => true } });
    if (!("record" in read)) throw new Error(`the record did not read: ${read.refusal}`);
    expect(read.record.private).toEqual({ seat: fresh.id });
    // The clear part names no seat and no bag id.
    expect(JSON.stringify(records[0]!.body).includes(fresh.id)).toBe(false);
    // THE RECORD GRANTS NOTHING: a vessel that holds the record and no key still opens nothing.
    const bystander = (await lostAndReturned()).fresh;
    await carryBlind(fresh, bystander);
    expect(await opens(bystander, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    // A restart finds the version by its lockbox alone: nothing private rested.
    fresh.restart();
    expect(await opens(fresh, sealed.body.ref)).toBe("one");
    // A second import of the same section adds nothing.
    expect(outcomes(await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer }))).toEqual(["held"]);
    expect(lockboxes(fresh)).toBe(1);
    expect((await fresh.store.records("memory-import")).length).toBe(1);
  });

  it("the record rests BEFORE the lockbox: a stop between the two leaves no key held, and the same import runs again", async () => {
    const { old, fresh } = await lostAndReturned();
    const sealed = await seal(old, "one");
    const bundle = await cut(old);
    await carryBlind(old, fresh);
    const order: string[] = [];
    fresh.rest.failOn = (kind) => { order.push(kind); return kind === "lockbox"; };
    const stopped = await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer });
    expect(said(stopped)).toMatch(/^store-failed/);
    expect(order.filter((k) => k === "memory-import" || k === "lockbox")).toEqual(["memory-import", "lockbox"]);
    expect(lockboxes(fresh)).toBe(0);
    fresh.rest.failOn = null;
    fresh.restart();
    expect(await opens(fresh, sealed.body.ref)).toBe("REFUSED:bag-unfounded");
    expect(outcomes(await fresh.holder.importMemory({ section: bundle.section, secret: bundle.pair.secret, signer: fresh.signer }))).toEqual(["imported"]);
    expect(await opens(fresh, sealed.body.ref)).toBe("one");
  });
});

describe("the names stay closed", () => {
  it("the holder names its two new refusals and the door its six outcomes", () => {
    expect(HOLDER_REFUSALS).toContain("seat-not-standing");
    expect(HOLDER_REFUSALS).toContain("memory-malformed");
    expect([...MEMORY_OUTCOMES]).toEqual(["imported", "held", "key-forged", "record-unverified", "version-conflicted", "transition-uncounted"]);
    expect(RECORD_KINDS).toContain("memory-import");
  });
});

describe("no copy of a section's plaintext outlives its reading", () => {
  it("no buffer the reader cut out while it read still holds a key once it returns", async () => {
    const { old } = await lostAndReturned();
    await seal(old, "one");
    const bundle = await cut(old);
    const key = openMemorySection(bundle.section, bundle.pair.secret)![0]!.key;
    // Watch every buffer the reader slices while it runs: the plaintext, each field, each entry.
    const cutOut: Uint8Array[] = [];
    const realSlice = Uint8Array.prototype.slice;
    Uint8Array.prototype.slice = function (...a: [number?, number?]) { const out = realSlice.apply(this, a); cutOut.push(out); return out; } as never;
    let entries: ReturnType<typeof openMemorySection>;
    try { entries = openMemorySection(bundle.section, bundle.pair.secret); } finally { Uint8Array.prototype.slice = realSlice; }
    const holdsKey = (bytes: Uint8Array): boolean => hex(bytes).includes(hex(key));
    // CONTROL: the entry handed back holds the key, so the hunt finds one where one rests.
    expect(holdsKey(entries![0]!.key)).toBe(true);
    expect(cutOut.length).toBeGreaterThan(3);
    expect(cutOut.filter(holdsKey)).toEqual([]);
  });
});
