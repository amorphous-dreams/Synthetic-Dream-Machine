/**
 * ciphertext-cas — a private body on the content-addressed store: sealed, addressed over its ciphertext, and
 * opened only whole.
 *
 * The first three vectors stood RED against the earlier opener, which returned altered plaintext, another
 * body's bytes and a cut body with no refusal. They read green only where the opener authenticates.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store · lar:///ha.ka.ba/lararium/mesh/content-resolution#/cad-storage
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ciphertextCid, verifyCiphertextCid, sealPrivateBody, openPrivateBody, authorizeAddress, readContentKey,
  keyVersionIdOf, parseDigest, hex, hexToBytes, sha256HexBytesSync, sealChunk,
  type AuthorizedAddress, type OpenPrivateBodyResult, type PrivateBodyKey, type SealedPrivateBody,
} from "../src/index.js";
import * as mesh from "../src/index.js";

const BAG = "lar:///ha.ka.ba/@test/bags/household-ledger";
const under: PrivateBodyKey = { bagId: BAG, key: readContentKey(new Uint8Array(32).fill(7))! };
const other: PrivateBodyKey = { bagId: BAG, key: readContentKey(new Uint8Array(32).fill(9))! };
const body = new TextEncoder().encode("pay the gardener forty on the first of the month");
const text = (r: OpenPrivateBodyResult): string => ("plaintext" in r ? new TextDecoder().decode(r.plaintext) : `REFUSED ${r.refusal}`);
function seal(plaintext: Uint8Array, k = under): SealedPrivateBody {
  const r = sealPrivateBody(plaintext, k);
  if (!("body" in r)) throw new Error(`setup: ${r.refusal}`);
  return r.body;
}
const receipt = (cid: string): AuthorizedAddress => authorizeAddress(cid, "own-receipt")!;
const open = (ciphertext: Uint8Array, authorized: AuthorizedAddress, ref: string, k = under): OpenPrivateBodyResult =>
  openPrivateBody({ ciphertext, under: k, ref, authorized });

describe("the opener authenticates what it returns", () => {
  it("an altered ciphertext refuses to open", () => {
    const sealed = seal(body);
    const altered = Uint8Array.from(sealed.ciphertext);
    altered[altered.length - 20] = altered[altered.length - 20]! ^ 0x01;       // DECODED bytes move
    expect(hex(altered)).not.toBe(hex(sealed.ciphertext));                     // the encoding changed first
    expect(text(open(altered, receipt(sealed.cid), sealed.ref))).toBe("REFUSED address-mismatch");
    // A carrier that also controls the address source gains nothing.
    expect(text(open(altered, receipt(ciphertextCid(altered)), sealed.ref))).toBe("REFUSED sequence-broken");
  });

  it("a swapped ciphertext under an address from an untrusted source refuses to open", () => {
    const a = seal(body);
    const b = seal(new TextEncoder().encode("pay the gardener ninety on the first of the month"));
    // The carrier serves `b` and names b's own address: the blind verify passes, as it must.
    expect(verifyCiphertextCid(b.ciphertext, ciphertextCid(b.ciphertext))).toBe(true);
    // The reader asked for the body its pointer names.
    expect(text(open(b.ciphertext, receipt(ciphertextCid(b.ciphertext)), a.ref))).toBe("REFUSED context-mismatch");
    expect(text(open(b.ciphertext, receipt(a.cid), a.ref))).toBe("REFUSED address-mismatch");
  });

  it("a truncated ciphertext refuses to open", () => {
    const sealed = seal(body);
    const cut = sealed.ciphertext.slice(0, sealed.ciphertext.length - 16);
    expect(text(open(cut, receipt(ciphertextCid(cut)), sealed.ref))).toMatch(/^REFUSED (sequence-broken|envelope-malformed)$/);
    const long = seal(new Uint8Array(70_000).fill(3));
    const oneSegment = long.ciphertext.slice(0, 84 + 65_536 + 16);
    expect(text(open(oneSegment, receipt(ciphertextCid(oneSegment)), long.ref))).toBe("REFUSED truncated");
  });

  it("CONTROL: the untouched ciphertext opens, and so does the empty body", () => {
    const sealed = seal(body);
    expect(text(open(sealed.ciphertext, receipt(sealed.cid), sealed.ref))).toBe(new TextDecoder().decode(body));
    const empty = seal(new Uint8Array(0));
    expect(open(empty.ciphertext, receipt(empty.cid), empty.ref)).toEqual({ plaintext: new Uint8Array(0) });
  });
});

describe("the address: BLAKE3 over the ciphertext, verified holding no key", () => {
  it("cid === blake3:<hex> of the ciphertext", () => {
    const { ciphertext, cid } = seal(body);
    expect(parseDigest(cid).algo).toBe("blake3");
    expect(ciphertextCid(ciphertext)).toBe(cid);
  });
  it("a carrier verifies with only the bytes, and a flipped byte fails", () => {
    const { ciphertext, cid } = seal(body);
    expect(verifyCiphertextCid(ciphertext, cid)).toBe(true);
    const tampered = ciphertext.slice(); tampered[0] = tampered[0]! ^ 0xff;
    expect(verifyCiphertextCid(tampered, cid)).toBe(false);
    expect(verifyCiphertextCid(ciphertext, "not-a-digest")).toBe(false);
    expect(verifyCiphertextCid(ciphertext, `sha256:${"0".repeat(64)}`)).toBe(false);
  });
});

describe("no convergent seal stands in the private tier", () => {
  it("one body sealed twice shares no address, so no holder confirms a guessed body", () => {
    const a = seal(body), b = seal(body);
    expect(a.cid).not.toBe(b.cid);
    expect(hex(a.ciphertext)).not.toBe(hex(b.ciphertext));
    expect(a.ref).toBe(b.ref);                                   // the logical reference stays the plaintext digest
    expect(a.ref).toBe(sha256HexBytesSync(body));
    expect(text(open(b.ciphertext, receipt(b.cid), b.ref))).toBe(new TextDecoder().decode(body));
  });
  it("the body's plaintext appears nowhere in what a carrier holds", () => {
    const sealed = seal(body);
    expect(hex(sealed.ciphertext).includes(hex(body))).toBe(false);
    expect(hex(sealed.ciphertext).includes(sealed.ref)).toBe(false);
  });
  it("the earlier seal and its unauthenticated opener left the tree", () => {
    const surface = mesh as Record<string, unknown>;
    expect(surface["sealBodyOnCas"]).toBeUndefined();
    expect(surface["openBodyOnCas"]).toBeUndefined();
    const source = readFileSync(join(import.meta.dirname, "../src/ciphertext-cas.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(source.length).toBeGreaterThan(1500);
    expect(source).not.toMatch(/xor|keystream/i);
    // CONTROL: the surface read sees what does stand.
    expect(typeof surface["openPrivateBody"]).toBe("function");
  });
});

describe("the read takes the right key, the right bag and the right digest", () => {
  it("a wrong key opens nothing", () => {
    const sealed = seal(body);
    expect(text(open(sealed.ciphertext, receipt(sealed.cid), sealed.ref, other))).toBe("REFUSED version-mismatch");
    expect(sealed.keyVersion).toBe(keyVersionIdOf(under.key, BAG));
  });
  it("a body sealed for one bag opens in no other", () => {
    const sealed = seal(body);
    const elsewhere: PrivateBodyKey = { bagId: "lar:///ha.ka.ba/@test/bags/kitchen-notes", key: under.key };
    expect(text(open(sealed.ciphertext, receipt(sealed.cid), sealed.ref, elsewhere))).toBe("REFUSED version-mismatch");
  });
  it("a body opens only under the digest its pointer names", () => {
    const sealed = seal(body);
    const wrongRef = sha256HexBytesSync(new TextEncoder().encode("another body"));
    expect(text(open(sealed.ciphertext, receipt(sealed.cid), wrongRef))).toBe("REFUSED context-mismatch");
    expect(text(open(sealed.ciphertext, receipt(sealed.cid), "not-a-digest"))).toBe("REFUSED reference-malformed");
  });
  it("a sealer that binds one body to another body's digest opens nothing: `plaintext-mismatch`", () => {
    // Only a key holder builds this: the bytes of one body, sealed as a blob under the digest of another.
    const claimed = sha256HexBytesSync(new TextEncoder().encode("the body the pointer names"));
    const crafted = sealChunk({ key: under.key, context: { bagId: BAG, keyVersion: keyVersionIdOf(under.key, BAG), role: "blob", logicalRef: hexToBytes(claimed) }, plaintext: body });
    if (!("chunk" in crafted)) throw new Error(crafted.refusal);
    expect(text(open(crafted.chunk.sealed, receipt(crafted.chunk.address), claimed))).toBe("REFUSED plaintext-mismatch");
    // CONTROL: the same crafting over the body the digest names opens.
    const honest = sealChunk({ key: under.key, context: { bagId: BAG, keyVersion: keyVersionIdOf(under.key, BAG), role: "blob", logicalRef: hexToBytes(sha256HexBytesSync(body)) }, plaintext: body });
    if (!("chunk" in honest)) throw new Error(honest.refusal);
    expect(text(open(honest.chunk.sealed, receipt(honest.chunk.address), sha256HexBytesSync(body)))).toBe(new TextDecoder().decode(body));
  });
  it("a private body seals as a `blob`: the same bytes sealed as a `change` open as no body", () => {
    const ref = sha256HexBytesSync(body);
    const asChange = sealChunk({ key: under.key, context: { bagId: BAG, keyVersion: keyVersionIdOf(under.key, BAG), role: "change", logicalRef: hexToBytes(ref) }, plaintext: body });
    if (!("chunk" in asChange)) throw new Error(asChange.refusal);
    expect(text(open(asChange.chunk.sealed, receipt(asChange.chunk.address), ref))).toBe("REFUSED context-mismatch");
  });
  it("an address no source vouched for opens nothing", () => {
    const sealed = seal(body);
    expect(text(open(sealed.ciphertext, { address: sealed.cid, source: "own-receipt" } as AuthorizedAddress, sealed.ref))).toBe("REFUSED address-unauthorized");
  });
  it("a short key refuses at the seal and at the open", () => {
    const short = { bagId: BAG, key: new Uint8Array(16) } as unknown as PrivateBodyKey;
    expect(sealPrivateBody(body, short)).toEqual({ refusal: "key-malformed" });
    const sealed = seal(body);
    expect(text(open(sealed.ciphertext, receipt(sealed.cid), sealed.ref, short))).toBe("REFUSED key-malformed");
  });
});
