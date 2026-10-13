/**
 * sealed-records — the key version, manifest and checkpoint records, the manifest's authorized address, and
 * the lockbox payload: what a reader verifies before it trusts an expected address.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records
 */
import { describe, expect, it } from "vitest";
import { canonicalJson, hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import { sessionSignatureImage, type SessionCertificate, type Signature } from "../src/face-proof-subjects.js";
import { KeyLineage } from "../src/content-key-lineage.js";
import {
  authorizeAddress, keyVersionIdOf, openChunk, readContentKey, sealChunk, sealedAddressOf,
  type ContentKey, type KeyVersionId, type SealContext, type SealedAddress,
} from "../src/sealed-chunk.js";
import {
  authorizeFromManifest, bagLocatorOf, encodeLockboxPayload, entryLocatorOf, factOfRecord, indexRowsOf, joinProofOf,
  joinProven, readLockboxPayload, readRecord, recordIdOf, signRecord,
  type BagLocator, type CheckpointBody, type KeyVersionBody, type KeyVersionPrivate, type ManifestBody, type ManifestEntry,
  type RecordId, type RecordKind, type RecordSigner, type SealedRecord, type VerifiedRecord, type WriterStanding,
} from "../src/sealed-records.js";
import { chain, signHex, type Chain } from "./face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const NEXUS = "nexus-test-one";
const k1 = readContentKey(new Uint8Array(32).fill(0x31))!;   // the founding version
const k2 = readContentKey(new Uint8Array(32).fill(0x32))!;   // its successor
const k3 = readContentKey(new Uint8Array(32).fill(0x33))!;   // a sibling of the successor
const v1 = keyVersionIdOf(k1, BAG), v2 = keyVersionIdOf(k2, BAG), v3 = keyVersionIdOf(k3, BAG);
const LOCATOR = bagLocatorOf(k1, BAG);

const signerOf = (c: Chain): RecordSigner => ({
  certificate: c.sessionCertificate,
  sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
});
const everyone: WriterStanding = { holdsWrite: () => true };
const only = (c: Chain): WriterStanding => ({ holdsWrite: ({ certificate, bagId }) => bagId === BAG && certificate.scope.faceKey === c.scope.faceKey });
const reader = (key: ContentKey, standing: WriterStanding = everyone) => ({ bagId: BAG, locator: LOCATOR, key, standing });

const foundingBody: KeyVersionBody = { bag: LOCATOR, keyVersion: v1, parents: [], span: v1 };
const foundingPrivate: KeyVersionPrivate = { cause: { kind: "founding" }, history: "shareable", joinProofs: [] };
const removalBody: KeyVersionBody = { bag: LOCATOR, keyVersion: v2, parents: [v1], span: v1 };
const removalPrivate: KeyVersionPrivate = { cause: { kind: "removal", acts: ["raise-0001"] }, history: "shareable", joinProofs: [] };

async function sign<K extends RecordKind>(kind: K, body: SealedRecord<K>["body"], secret: VerifiedRecord<K>["private"], key: ContentKey, c: Chain): Promise<SealedRecord<K>> {
  const r = await signRecord({ kind, body, private: secret, bagId: BAG, key, signer: signerOf(c) });
  if (!("record" in r)) throw new Error(`setup: sign refused ${r.refusal} ${r.cause ?? ""}`);
  return r.record;
}
const refusalOf = (r: { record: unknown } | { refusal: string; cause?: string }): string => ("refusal" in r ? `${r.refusal}${r.cause ? `:${r.cause}` : ""}` : "READ");

/** Seal one value and build its manifest entry. */
function value(key: ContentKey, role: SealContext["role"], ref: string, text: string, parents: SealedAddress[] = []) {
  const context: SealContext = { bagId: BAG, keyVersion: keyVersionIdOf(key, BAG), role, logicalRef: utf8Bytes(ref) };
  const r = sealChunk({ key, context, plaintext: utf8Bytes(text) });
  if (!("chunk" in r)) throw new Error(r.refusal);
  const entry: ManifestEntry = { role, address: r.chunk.address, locator: entryLocatorOf(key, context), parents: [...parents].sort() };
  return { context, chunk: r.chunk, entry };
}

describe("a record reads whole, or refuses by name", async () => {
  const writer = await chain("writer", NEXUS);
  const stranger = await chain("stranger", NEXUS);
  const founding = await sign("key-version", foundingBody, foundingPrivate, k1, writer);
  const removal = await sign("key-version", removalBody, removalPrivate, k2, writer);

  it("CONTROL: a key version record signs, travels and reads back", () => {
    const r = readRecord("key-version", founding, reader(k1, only(writer)));
    if (!("record" in r)) throw new Error(refusalOf(r));
    expect(r.record.id).toBe(recordIdOf("key-version", foundingBody));
    expect(r.record.private).toEqual(foundingPrivate);
    expect(r.record.certificate.scope.faceKey).toBe(writer.scope.faceKey);
    expect(factOfRecord(r.record)).toEqual({ keyVersion: v1, parents: [], span: v1, history: "shareable", cause: { kind: "founding" } });
  });

  it("the sealed part hides the writer and the cause from a holder of no key", () => {
    const sealedHex = hex(removal.sealed);
    expect(sealedHex.includes(writer.scope.faceKey)).toBe(false);
    expect(sealedHex.includes(hex(utf8Bytes("raise-0001")))).toBe(false);
    expect(canonicalJson(removal.body).includes(writer.scope.faceKey)).toBe(false);
    expect(Object.keys(removal.body).sort()).toEqual(["bag", "keyVersion", "parents", "span"]);
  });

  it("a carrier that edits the clear part breaks the record: the sealed part binds the record's id", () => {
    const edited = { ...removal, body: { ...removalBody, parents: [] } };
    expect(recordIdOf("key-version", edited.body)).not.toBe(recordIdOf("key-version", removalBody));   // the setup took
    expect(refusalOf(readRecord("key-version", edited, reader(k2)))).toBe("sealed-part-refused:context-mismatch");
    const respanned = { ...removal, body: { ...removalBody, span: v2 } };
    expect(refusalOf(readRecord("key-version", respanned, reader(k2)))).toBe("sealed-part-refused:context-mismatch");
  });

  it("a sealed part moved from another record opens nothing", async () => {
    const other = await sign("key-version", { ...removalBody, span: v2 }, { cause: { kind: "admission", act: "admit-0001" }, history: "closed", joinProofs: [] }, k2, writer);
    expect(hex(other.sealed)).not.toBe(hex(removal.sealed));
    expect(refusalOf(readRecord("key-version", { ...removal, sealed: other.sealed }, reader(k2)))).toBe("sealed-part-refused:context-mismatch");
  });

  it("an altered sealed part refuses", () => {
    const sealed = Uint8Array.from(removal.sealed);
    sealed[sealed.length - 3] = sealed[sealed.length - 3]! ^ 1;
    expect(hex(sealed)).not.toBe(hex(removal.sealed));
    expect(refusalOf(readRecord("key-version", { ...removal, sealed }, reader(k2)))).toBe("sealed-part-refused:sequence-broken");
  });

  it("a record of another bag's locator refuses `locator-mismatch`; a key of another version refuses `key-mismatch`", () => {
    const elsewhere = bagLocatorOf(k1, "lar:///ha.ka.ba/@test/bags/kitchen-notes");
    expect(refusalOf(readRecord("key-version", removal, { ...reader(k2), locator: elsewhere }))).toBe("locator-mismatch");
    expect(refusalOf(readRecord("key-version", removal, reader(k1)))).toBe("key-mismatch");
    expect(refusalOf(readRecord("key-version", removal, reader(k2)))).toBe("READ");
  });

  it("a writer with no standing in the bag refuses `writer-not-capable`", async () => {
    const forged = await sign("key-version", removalBody, removalPrivate, k2, stranger);
    expect(refusalOf(readRecord("key-version", forged, reader(k2, only(writer))))).toBe("writer-not-capable");
    expect(refusalOf(readRecord("key-version", forged, reader(k2, only(stranger))))).toBe("READ");   // the signature itself stands
  });

  it("a reader holding one key version forges no record under another", async () => {
    // A removed reader holds k1 alone. It cannot sign under v2 ...
    expect(await signRecord({ kind: "key-version", body: removalBody, private: removalPrivate, bagId: BAG, key: k1, signer: signerOf(writer) })).toEqual({ refusal: "key-mismatch" });
    // ... and a sealed part it built under k1 for a v2 record opens nothing under k2.
    const underOld = await sign("key-version", { ...removalBody, keyVersion: v1, parents: [] }, removalPrivate, k1, writer);
    expect(refusalOf(readRecord("key-version", { kind: "key-version", body: removalBody, sealed: underOld.sealed }, reader(k2)))).toBe("sealed-part-refused:version-mismatch");
  });

  describe("authorship a key holder forges", () => {
    /** Build a sealed part by hand, as a capable-but-lying key holder could. */
    function craft(part: unknown, body: KeyVersionBody = removalBody): SealedRecord<"key-version"> {
      const id = recordIdOf("key-version", body);
      const r = sealChunk({ key: k2, context: { bagId: BAG, keyVersion: v2, role: "record", logicalRef: hexToBytes(id) }, plaintext: utf8Bytes(canonicalJson(part)) });
      if (!("chunk" in r)) throw new Error(r.refusal);
      return { kind: "key-version", body, sealed: r.chunk.sealed };
    }
    const authorshipOf = async (c: Chain, secret: KeyVersionPrivate, body: KeyVersionBody = removalBody): Promise<{ private: KeyVersionPrivate; certificate: SessionCertificate; signature: Signature }> => {
      const real = await sign("key-version", body, secret, k2, c);
      const opened = openChunk({ key: k2, context: { bagId: BAG, keyVersion: v2, role: "record", logicalRef: hexToBytes(recordIdOf("key-version", body)) }, sealed: real.sealed, authorized: authorizeAddress(sealedAddressOf(real.sealed), "record-part")! });
      if (!("plaintext" in opened)) throw new Error(opened.refusal);
      return JSON.parse(new TextDecoder().decode(opened.plaintext));
    };

    it("CONTROL: a hand-built sealed part with the true authorship reads", async () => {
      expect(refusalOf(readRecord("key-version", craft(await authorshipOf(writer, removalPrivate)), reader(k2)))).toBe("READ");
    });
    it("private fields changed under a kept signature refuse `signature-refused`", async () => {
      const a = await authorshipOf(writer, removalPrivate);
      const swapped = { ...a, private: { ...a.private, cause: { kind: "removal", acts: ["raise-9999"] } } };
      expect(refusalOf(readRecord("key-version", craft(swapped), reader(k2)))).toBe("signature-refused:signature-refused");
      const reopened = { ...a, private: { ...a.private, history: "closed" } };
      expect(refusalOf(readRecord("key-version", craft(reopened), reader(k2)))).toBe("signature-refused:signature-refused");
    });
    it("a signature lifted from another record of the same writer refuses", async () => {
      const elsewhere = await authorshipOf(writer, removalPrivate, { ...removalBody, parents: [] });
      expect(refusalOf(readRecord("key-version", craft(elsewhere), reader(k2)))).toBe("signature-refused:signature-refused");
    });
    it("another session's certificate over this writer's signature refuses", async () => {
      const a = await authorshipOf(writer, removalPrivate);
      expect(refusalOf(readRecord("key-version", craft({ ...a, certificate: stranger.sessionCertificate }), reader(k2)))).toBe("signature-refused:signature-refused");
    });
    it("a certificate no vessel key signed refuses `certificate-refused`", async () => {
      const a = await authorshipOf(writer, removalPrivate);
      const forgedCertificate = { ...a.certificate, sessionKey: stranger.sessionCertificate.sessionKey };
      expect(refusalOf(readRecord("key-version", craft({ ...a, certificate: forgedCertificate }), reader(k2)))).toBe("certificate-refused:signature-refused");
    });
    it("an act id of ill-formed text never signs: two unlike ids would share one signed image", async () => {
      const lone = { cause: { kind: "removal" as const, acts: ["raise-\ud800"] }, history: "shareable" as const, joinProofs: [] };
      expect(await signRecord({ kind: "key-version", body: removalBody, private: lone, bagId: BAG, key: k2, signer: signerOf(writer) })).toEqual({ refusal: "record-malformed" });
      // An admission's act id and a checkpoint's frontier ids take the same rule.
      const admitted = { cause: { kind: "admission" as const, act: "admit-\ud800" }, history: "closed" as const, joinProofs: [] };
      expect(await signRecord({ kind: "key-version", body: { ...removalBody, span: v2 }, private: admitted, bagId: BAG, key: k2, signer: signerOf(writer) })).toEqual({ refusal: "record-malformed" });
      expect(await signRecord({ kind: "key-version", body: { ...removalBody, span: v2 }, private: { ...admitted, cause: { kind: "admission", act: "admit-0001" } }, bagId: BAG, key: k2, signer: signerOf(writer) })).toHaveProperty("record");
      const a = await authorshipOf(writer, { cause: { kind: "removal", acts: ["raise-\ufffd"] }, history: "shareable", joinProofs: [] });
      // The signature covers the well-formed id; the same signature under the ill-formed twin reads as no record.
      expect(refusalOf(readRecord("key-version", craft(a), reader(k2)))).toBe("READ");
      expect(refusalOf(readRecord("key-version", craft({ ...a, private: { ...a.private, cause: { kind: "removal", acts: ["raise-\ud800"] } } }), reader(k2)))).toBe("authorship-malformed");
    });

    it("a sealed part of another shape refuses `authorship-malformed`", async () => {
      const a = await authorshipOf(writer, removalPrivate);
      expect(refusalOf(readRecord("key-version", craft({ ...a, note: "extra" }), reader(k2)))).toBe("authorship-malformed");
      expect(refusalOf(readRecord("key-version", craft({ ...a, private: { ...a.private, joinProofs: ["00".repeat(32)] } }), reader(k2)))).toBe("authorship-malformed");
      expect(refusalOf(readRecord("key-version", craft("not a record"), reader(k2)))).toBe("authorship-malformed");
    });
  });

  it("a record carried as another kind refuses", async () => {
    expect(refusalOf(readRecord("manifest", removal, reader(k2)))).toBe("record-malformed");
    expect(refusalOf(readRecord("checkpoint", { ...removal, kind: "checkpoint" }, reader(k2)))).toBe("record-malformed");
    expect(refusalOf(readRecord("key-version", { ...removal, extra: 1 }, reader(k2)))).toBe("record-malformed");
    expect(refusalOf(readRecord("key-version", null, reader(k2)))).toBe("record-malformed");
  });

  it("a clear part reads malformed: unsorted parents, a self parent, a blob with parents, no entries", async () => {
    const sorted = [v2, v3].sort() as KeyVersionId[];
    const body = { bag: LOCATOR, keyVersion: v1, parents: [...sorted].reverse(), span: v1 };
    expect(await signRecord({ kind: "key-version", body, private: foundingPrivate, bagId: BAG, key: k1, signer: signerOf(writer) })).toEqual({ refusal: "record-malformed" });
    expect(() => recordIdOf("key-version", { ...foundingBody, parents: [v1] })).toThrow(/malformed/);
    const blob = value(k1, "blob", "digest-1", "bytes");
    expect(() => recordIdOf("manifest", { bag: LOCATOR, keyVersion: v1, parents: [], entries: [{ ...blob.entry, parents: [blob.entry.address] }] })).toThrow(/malformed/);
    expect(() => recordIdOf("manifest", { bag: LOCATOR, keyVersion: v1, parents: [], entries: [] })).toThrow(/malformed/);
  });

  it("the lineage counts verified records, and a join proves the parents its reader holds", async () => {
    const sibling = await sign("key-version", { bag: LOCATOR, keyVersion: v3, parents: [v1], span: v1 }, removalPrivate, k3, writer);
    const k4 = readContentKey(new Uint8Array(32).fill(0x34))!;
    const v4 = keyVersionIdOf(k4, BAG);
    const parents = [v2, v3].sort() as KeyVersionId[];
    const proofs = parents.map((p) => joinProofOf(p === v2 ? k2 : k3, v4));
    const join = await sign("key-version", { bag: LOCATOR, keyVersion: v4, parents, span: v1 }, { cause: { kind: "join" }, history: "shareable", joinProofs: proofs }, k4, writer);
    const read = <T extends SealedRecord<"key-version">>(record: T, key: ContentKey): VerifiedRecord<"key-version"> => {
      const r = readRecord("key-version", record, reader(key));
      if (!("record" in r)) throw new Error(refusalOf(r));
      return r.record;
    };
    const joined = read(join, k4);
    const evidence = (heldParents: Map<KeyVersionId, ContentKey>) => ({ raiseCounts: () => true, admissionVerifies: () => true, joinProven: () => joinProven(joined, heldParents) });
    let lineage = KeyLineage.empty();
    for (const [record, key] of [[founding, k1], [removal, k2], [sibling, k3]] as const) {
      const r = lineage.count(factOfRecord(read(record, key)), evidence(new Map()));
      if (!("lineage" in r)) throw new Error(r.refusal);
      lineage = r.lineage;
    }
    expect(lineage.heads()).toEqual(parents);
    // A reader that holds one parent's key checks that one proof; a reader that holds neither proves nothing.
    expect(lineage.count(factOfRecord(joined), evidence(new Map([[v2, k2]])))).toHaveProperty("lineage");
    expect(lineage.count(factOfRecord(joined), evidence(new Map()))).toEqual({ refusal: "join-unproven" });
    // A proof made under a key that never stood as the parent refuses.
    expect(joinProven(joined, new Map([[v2, k3]]))).toBe(false);
    expect(joinProven(joined, new Map([[v2, k2], [v3, k3]]))).toBe(true);
    // A join whose minter held only one parent carries one true proof and one guess.
    const guessed = await sign("key-version", { bag: LOCATOR, keyVersion: v4, parents, span: v1 }, { cause: { kind: "join" }, history: "shareable", joinProofs: parents.map((p) => (p === v2 ? joinProofOf(k2, v4) : "ab".repeat(32))) }, k4, writer);
    expect(joinProven(read(guessed, k4), new Map([[v3, k3]]))).toBe(false);
    // A join with a proof missing reads as no record.
    expect(await signRecord({ kind: "key-version", body: { bag: LOCATOR, keyVersion: v4, parents, span: v1 }, private: { cause: { kind: "join" }, history: "shareable", joinProofs: [proofs[0]!] }, bagId: BAG, key: k4, signer: signerOf(writer) })).toEqual({ refusal: "record-malformed" });
    // Only a verified record states a fact.
    expect(() => factOfRecord({ ...joined } as VerifiedRecord<"key-version">)).toThrow(/verified/);
  });
});

describe("a verified manifest entry authorizes its address", async () => {
  const writer = await chain("writer", NEXUS);
  const change1 = value(k1, "change", "change-0001", "set the title to Garden");
  const change2 = value(k1, "change", "change-0002", "add a row for beans", [change1.chunk.address]);
  const blob = value(k1, "blob", "digest-of-photo", "photo bytes");
  const body: ManifestBody = { bag: LOCATOR, keyVersion: v1, parents: [], entries: [change1.entry, change2.entry, blob.entry] };
  const carried = await sign("manifest", body, {}, k1, writer);
  const read = (record: unknown = carried, standing: WriterStanding = everyone): VerifiedRecord<"manifest"> => {
    const r = readRecord("manifest", record, reader(k1, standing));
    if (!("record" in r)) throw new Error(refusalOf(r));
    return r.record;
  };

  it("CONTROL: the reader finds an address by its logical reference and opens the value", () => {
    const manifest = read();
    const authorized = authorizeFromManifest(manifest, k1, change2.context);
    expect(authorized).toEqual({ address: change2.chunk.address, source: "manifest-entry" });
    const opened = openChunk({ key: k1, context: change2.context, sealed: change2.chunk.sealed, authorized: authorized! });
    expect("plaintext" in opened && new TextDecoder().decode(opened.plaintext)).toBe("add a row for beans");
  });

  it("the manifest shows a carrier no logical reference", () => {
    const clear = canonicalJson(carried.body);
    for (const ref of ["change-0001", "change-0002", "digest-of-photo"]) expect(clear.includes(ref)).toBe(false);
    expect(hex(carried.sealed).includes(hex(utf8Bytes("change-0001")))).toBe(false);
  });

  it("no entry authorizes another reference, another role or another key version", () => {
    const manifest = read();
    expect(authorizeFromManifest(manifest, k1, { ...change1.context, logicalRef: utf8Bytes("change-0003") })).toBeNull();
    expect(authorizeFromManifest(manifest, k1, { ...change1.context, role: "checkpoint" })).toBeNull();
    expect(authorizeFromManifest(manifest, k2, { ...change1.context, keyVersion: v2 })).toBeNull();
    expect(authorizeFromManifest(manifest, k2, change1.context)).toBeNull();
    expect(authorizeFromManifest(manifest, k1, change1.context)?.address).toBe(change1.chunk.address);
  });

  it("an entry whose clear role differs from the role its locator binds authorizes nothing", async () => {
    // The writer tells the carrier `checkpoint` and binds the locator to a `change`.
    const mislabelled = await sign("manifest", { ...body, entries: [{ ...change1.entry, role: "checkpoint" }] }, {}, k1, writer);
    const manifest = read(mislabelled);
    expect(authorizeFromManifest(manifest, k1, change1.context)).toBeNull();
    expect(authorizeFromManifest(manifest, k1, { ...change1.context, role: "checkpoint" })).toBeNull();
  });

  it("a verified record stays as its reader verified it: no later hand moves an entry", () => {
    const manifest = read();
    const entries = manifest.body.entries as ManifestEntry[];
    // A caller that holds the verified record tries to point change-0001 at another value.
    expect(() => { (entries[0] as { address: SealedAddress }).address = change2.chunk.address; }).toThrow(TypeError);
    expect(() => { entries.push({ ...change2.entry, locator: change1.entry.locator }); }).toThrow(TypeError);
    expect(() => { (manifest.body as { entries: ManifestEntry[] }).entries = []; }).toThrow(TypeError);
    expect(() => { (manifest.certificate.scope as { nexus: string }).nexus = "nexus-other"; }).toThrow(TypeError);
    expect(authorizeFromManifest(manifest, k1, change1.context)?.address).toBe(change1.chunk.address);
    expect(indexRowsOf(manifest)[0]!.address).toBe(change1.chunk.address);
    // The carried record a reader handed in stays the caller's own: a change to it after the read changes no verified reading.
    const mine = { kind: "manifest" as const, body: structuredClone(body), sealed: carried.sealed };
    const verified = read(mine);
    (mine.body.entries[0] as { address: SealedAddress }).address = change2.chunk.address;
    expect(authorizeFromManifest(verified, k1, change1.context)?.address).toBe(change1.chunk.address);
  });

  it("a manifest no reader verified authorizes nothing", () => {
    const manifest = read();
    const lookalike = { ...manifest } as VerifiedRecord<"manifest">;
    expect(authorizeFromManifest(lookalike, k1, change1.context)).toBeNull();
    const unverified = { kind: "manifest", id: manifest.id, body, private: {}, certificate: manifest.certificate } as VerifiedRecord<"manifest">;
    expect(authorizeFromManifest(unverified, k1, change1.context)).toBeNull();
    expect(() => indexRowsOf(lookalike)).toThrow(/verified/);
  });

  it("a writer that lists another value under an entry's locator opens nothing with it", async () => {
    // The writer claims change-0002's address for change-0001's reference.
    const lying = await sign("manifest", { ...body, entries: [{ ...change1.entry, address: change2.chunk.address }] }, {}, k1, writer);
    const authorized = authorizeFromManifest(read(lying), k1, change1.context);
    expect(authorized?.address).toBe(change2.chunk.address);
    const opened = openChunk({ key: k1, context: change1.context, sealed: change2.chunk.sealed, authorized: authorized! });
    expect(opened).toEqual({ refusal: "context-mismatch" });
  });

  it("two entries under one locator that name unlike addresses authorize nothing", async () => {
    const twice = await sign("manifest", { ...body, entries: [change1.entry, { ...change1.entry, address: change2.chunk.address }] }, {}, k1, writer);
    expect(authorizeFromManifest(read(twice), k1, change1.context)).toBeNull();
    const same = await sign("manifest", { ...body, entries: [change1.entry, change1.entry] }, {}, k1, writer);
    expect(authorizeFromManifest(read(same), k1, change1.context)?.address).toBe(change1.chunk.address);
  });

  it("a carrier that drops or re-orders entries breaks the manifest", () => {
    const dropped = { ...carried, body: { ...body, entries: [change1.entry, blob.entry] } };
    const reordered = { ...carried, body: { ...body, entries: [change2.entry, change1.entry, blob.entry] } };
    expect(refusalOf(readRecord("manifest", dropped, reader(k1)))).toBe("sealed-part-refused:context-mismatch");
    expect(refusalOf(readRecord("manifest", reordered, reader(k1)))).toBe("sealed-part-refused:context-mismatch");
  });

  it("a verified manifest yields the chunk index rows a later step persists", () => {
    const manifest = read();
    const rows = indexRowsOf(manifest);
    expect(rows.map((r) => r.address)).toEqual([change1.chunk.address, change2.chunk.address, blob.chunk.address]);
    expect(rows[1]).toEqual({ bag: LOCATOR, keyVersion: v1, role: "change", address: change2.chunk.address, locator: change2.entry.locator, parents: [change1.chunk.address], manifest: manifest.id });
    expect(Object.keys(rows[0]!).sort()).toEqual(["address", "bag", "keyVersion", "locator", "manifest", "parents", "role"]);
  });

  it("a checkpoint record keeps its frontier sealed and reads back", async () => {
    const state = value(k1, "checkpoint", "checkpoint-0001", "the whole document state");
    const checkpoint: CheckpointBody = { bag: LOCATOR, keyVersion: v1, span: v1, base: "continuation", address: state.chunk.address, covers: [change1.chunk.address, change2.chunk.address].sort() as SealedAddress[] };
    const record = await sign("checkpoint", checkpoint, { frontier: ["head-a", "head-b"] }, k1, writer);
    expect(hex(record.sealed).includes(hex(utf8Bytes("head-a")))).toBe(false);
    const r = readRecord("checkpoint", record, reader(k1));
    if (!("record" in r)) throw new Error(refusalOf(r));
    expect(r.record.private.frontier).toEqual(["head-a", "head-b"]);
    expect(r.record.body.base).toBe("continuation");
    // A carrier that relabels the base, or trims the cover, breaks the record.
    expect(refusalOf(readRecord("checkpoint", { ...record, body: { ...checkpoint, base: "fresh" } }, reader(k1)))).toBe("sealed-part-refused:context-mismatch");
    expect(refusalOf(readRecord("checkpoint", { ...record, body: { ...checkpoint, covers: [] } }, reader(k1)))).toBe("sealed-part-refused:context-mismatch");
    expect(await signRecord({ kind: "checkpoint", body: { ...checkpoint, base: "rebase" as never }, private: { frontier: [] }, bagId: BAG, key: k1, signer: signerOf(writer) })).toEqual({ refusal: "record-malformed" });
  });

  it("a record id belongs to one kind", () => {
    const ids = new Set<RecordId>([recordIdOf("key-version", foundingBody), recordIdOf("manifest", body)]);
    expect(ids.size).toBe(2);
  });
});

describe("the lockbox payload", () => {
  const payload = { bagId: BAG, locator: LOCATOR, keyVersion: v2, key: k2 };
  const bytes = encodeLockboxPayload(payload);

  it("CONTROL: a payload reads back to its key, its locator and its version", () => {
    const r = readLockboxPayload(bytes, { bagId: BAG });
    if (!("payload" in r)) throw new Error(r.refusal);
    expect(hex(r.payload.key)).toBe(hex(k2));
    expect(r.payload.locator).toBe(LOCATOR);
    expect(r.payload.keyVersion).toBe(v2);
    expect(readLockboxPayload(bytes, { bagId: BAG, locator: LOCATOR, keyVersion: v2 })).toHaveProperty("payload");
  });
  it("a payload for another bag, another locator or another version refuses by name", () => {
    expect(readLockboxPayload(bytes, { bagId: "lar:///ha.ka.ba/@test/bags/kitchen-notes" })).toEqual({ refusal: "lockbox-other-bag" });
    expect(readLockboxPayload(bytes, { bagId: BAG, locator: "cd".repeat(32) as BagLocator })).toEqual({ refusal: "lockbox-other-locator" });
    expect(readLockboxPayload(bytes, { bagId: BAG, keyVersion: v1 })).toEqual({ refusal: "lockbox-other-version" });
  });
  it("a substituted key refuses `key-mismatch`: the version id commits the key", () => {
    const swapped = Uint8Array.from(bytes);
    swapped.set(k3, swapped.length - 32);
    expect(hex(swapped)).not.toBe(hex(bytes));
    expect(readLockboxPayload(swapped, { bagId: BAG, keyVersion: v2 })).toEqual({ refusal: "key-mismatch" });
    // A lockbox for version three presented as version two never yields version three's key under two's name.
    expect(readLockboxPayload(encodeLockboxPayload({ ...payload, keyVersion: v3, key: k3 }), { bagId: BAG, keyVersion: v2 })).toEqual({ refusal: "lockbox-other-version" });
  });
  it("torn bytes refuse `lockbox-malformed`, and the encoder refuses a key of another version", () => {
    expect(readLockboxPayload(bytes.subarray(0, bytes.length - 1), { bagId: BAG })).toEqual({ refusal: "lockbox-malformed" });
    expect(readLockboxPayload(new Uint8Array(0), { bagId: BAG })).toEqual({ refusal: "lockbox-malformed" });
    expect(readLockboxPayload("text", { bagId: BAG })).toEqual({ refusal: "lockbox-malformed" });
    expect(() => encodeLockboxPayload({ ...payload, key: k3 })).toThrow(/another key version/);
  });
  it("a locator derives under the founding key and reads opaque", () => {
    expect(bagLocatorOf(k1, BAG)).toBe(LOCATOR);
    expect(bagLocatorOf(k2, BAG)).not.toBe(LOCATOR);
    expect(bagLocatorOf(k1, "lar:///ha.ka.ba/@test/bags/kitchen-notes")).not.toBe(LOCATOR);
    expect(LOCATOR).not.toBe(v1);
  });
});
