/**
 * published-bag-key — a public or crossroads bag's content key rides its published lookup (sealed-store#/owed, R1:
 * "public/crossroads, etc, available as invitees have the 'public keys or lookups'"). The bag rests sealed under the
 * key its lookup derives, so whoever holds the lookup opens it, and nobody else.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { utf8Bytes } from "../src/crypto.js";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import { authorizeAddress, openChunk, sealedAddressOf, keyVersionIdOf } from "../src/sealed-chunk.js";
import { SealedDocumentStore, logicalRefOf } from "../src/sealed-doc-store.js";
import { mintPublishedLookup, openPublished, publishedBagKey, publishedLookupText, readPublishedLookup } from "../src/published-bag-key.js";
import { vessel, world } from "./content-key-fixture.js";

const PUBLIC = "lar:///ha.ka.ba/@test/bags/crossroads-notice-board";
const PRIVATE = "lar:///ha.ka.ba/@test/bags/garden-notes";
const WORD = "the-market-opens-at-the-second-bell";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}
const holds = (hay: Uint8Array, needle: readonly number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};
const restsClear = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean =>
  [...inner.bytes].some(([key, data]) => key.startsWith(docId) && (holds(data, [...utf8Bytes(WORD)]) || holds(data, MAGIC)));

/** A store whose one public bag rests under its published lookup; no session, no holder, no face stands. */
function publicStore(inner: StorageAdapterInterface, lookup: Uint8Array | null) {
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  return new SealedDocumentStore({
    inner,
    bagOf: () => (lookup === null ? null : { bagId: PUBLIC, face: "no-face", published: readPublishedLookup(publishedLookupText(lookup))! }),
    sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse,
  });
}

describe("T5: a public bag's content key rides its published lookup", () => {
  it("POSITIVE FIRST: with no lookup named the same writes rest Automerge's own clear bytes", async () => {
    const inner = memoryAdapter();
    const repo = new Repo({ storage: publicStore(inner, null), network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = WORD; });
    await repo.flush();
    await repo.shutdown();
    expect(restsClear(inner, doc.documentId)).toBe(true);
  });

  it("a public bag rests sealed with no session standing, and a stranger holding the lookup alone opens it", async () => {
    const lookup = mintPublishedLookup();
    const inner = memoryAdapter();
    const repo = new Repo({ storage: publicStore(inner, lookup), network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = WORD; });
    await repo.flush();
    await repo.shutdown();
    // The setup took: values rest, none of them clear.
    expect([...inner.bytes.keys()].some((k) => k.startsWith(doc.documentId))).toBe(true);
    expect(restsClear(inner, doc.documentId)).toBe(false);
    // The lookup alone opens it: a stranger's store, no face, no session, no holder.
    const stranger = new Repo({ storage: publicStore(inner, Uint8Array.from(lookup)), network: [] });
    expect((await stranger.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc().note).toBe(WORD);
    await stranger.shutdown();
    // Another lookup opens nothing.
    for (const [key, data] of inner.bytes) {
      if (!key.startsWith(doc.documentId) || key.includes("storage-adapter-id")) continue;
      const parts = key.split("\u0000");
      const role = parts[1] === "snapshot" ? "checkpoint" : "change";
      expect("plaintext" in openPublished({ bagId: PUBLIC, lookup: mintPublishedLookup(), role, ref: logicalRefOf(parts), sealed: data })).toBe(false);
      expect("plaintext" in openPublished({ bagId: PUBLIC, lookup, role, ref: logicalRefOf(parts), sealed: data })).toBe(true);
    }
  });

  it("CONTROL: a private bag's sealed value does not open with any published key", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const lookup = mintPublishedLookup();
    const sealed = await a.holder.sealValues({ bagId: PRIVATE, values: [{ role: "change", ref: "ab".repeat(32), parents: [], plaintext: utf8Bytes(WORD) }], signer: a.signer });
    expect("refusal" in sealed).toBe(false);
    if ("refusal" in sealed) return;
    const address = sealed.values[0]!.address;
    const bytes = a.values.get(address);
    expect(bytes).toBeTruthy();
    const key = publishedBagKey(PRIVATE, lookup);
    const out = openChunk({ key, context: { bagId: PRIVATE, keyVersion: keyVersionIdOf(key, PRIVATE), role: "change", logicalRef: Uint8Array.from(Buffer.from("ab".repeat(32), "hex")) }, sealed: bytes!, authorized: authorizeAddress(sealedAddressOf(bytes!), "own-receipt")! });
    expect("plaintext" in out).toBe(false);
    expect(faceProofSubjectRef).toBeTypeOf("function");
  });
});
