/**
 * sealed-chunk — the sealed value: every refusal by name, each tamper probe over DECODED bytes.
 *
 * A carrier that controls the address source recomputes the address after it alters bytes, so the probes
 * below run in two modes: under the ORIGINAL authorized address (the address check answers) and under an
 * address the attacker recomputed (the envelope itself must answer).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-sealed-value
 */
import { describe, expect, it } from "vitest";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import {
  SEALED_CHUNK_DOMAIN, SEALED_CHUNK_KEY_INFO, SEALED_CHUNK_COMMITMENT_INFO, CONTENT_KEY_ID_INFO,
} from "../src/domains.js";
import {
  authorizeAddress, contextDigest, keyVersionIdOf, mintContentKey, openChunk, readContentKey, sealChunk,
  sealedAddressOf, sealedImage, SEALED_CHUNK_MARK, SEALED_HEADER_LEN, SEALED_SEGMENT_LEN, SEALED_TAG_LEN,
  type AuthorizedAddress, type ContentKey, type OpenResult, type SealContext, type SealedChunk,
} from "../src/sealed-chunk.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const OTHER_BAG = "lar:///ha.ka.ba/@test/bags/kitchen-notes";
const key = readContentKey(new Uint8Array(32).fill(0x11))!;
const otherKey = readContentKey(new Uint8Array(32).fill(0x22))!;
const ref = (text: string): Uint8Array => utf8Bytes(text);
const ctx = (over: Partial<SealContext> = {}, k: ContentKey = key, bagId = BAG): SealContext =>
  ({ bagId, keyVersion: keyVersionIdOf(k, bagId), role: "change", logicalRef: ref("change-0001"), ...over });
const body = (n: number, seed = 7): Uint8Array => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed) & 0xff; return b; };

function seal(plaintext: Uint8Array, context = ctx(), k: ContentKey = key): SealedChunk {
  const r = sealChunk({ key: k, context, plaintext });
  if (!("chunk" in r)) throw new Error(`setup: seal refused ${r.refusal}`);
  return r.chunk;
}
const own = (address: string): AuthorizedAddress => authorizeAddress(address, "own-receipt")!;
const open = (sealed: Uint8Array, authorized: AuthorizedAddress, context = ctx(), k: ContentKey = key): OpenResult =>
  openChunk({ key: k, context, sealed, authorized });
const refusalOf = (r: OpenResult): string => ("refusal" in r ? r.refusal : `OPENED ${r.plaintext.length} bytes`);
/** Alter decoded bytes and prove the encoding moved. */
function altered(sealed: Uint8Array, at: number): Uint8Array {
  const out = Uint8Array.from(sealed);
  out[at] = out[at]! ^ 0x01;
  expect(hex(out)).not.toBe(hex(sealed));
  return out;
}
/** What a carrier that controls the address source presents: the altered bytes under their own address. */
const recomputed = (bytes: Uint8Array): AuthorizedAddress => own(sealedAddressOf(bytes));
const SEG = SEALED_SEGMENT_LEN + SEALED_TAG_LEN;

describe("the sealed value opens whole, or refuses by name", () => {
  it("CONTROL: bodies of every framing length round-trip", () => {
    for (const n of [0, 1, 200, SEALED_SEGMENT_LEN - 1, SEALED_SEGMENT_LEN, SEALED_SEGMENT_LEN + 1, 2 * SEALED_SEGMENT_LEN, 2 * SEALED_SEGMENT_LEN + 17]) {
      const plaintext = body(n);
      const chunk = seal(plaintext);
      const segments = n === 0 ? 1 : Math.ceil(n / SEALED_SEGMENT_LEN);
      expect(chunk.sealed.length, `sealed length for ${n}`).toBe(SEALED_HEADER_LEN + n + segments * SEALED_TAG_LEN);
      const r = open(chunk.sealed, own(chunk.address));
      expect("plaintext" in r && hex(r.plaintext), `body of ${n}`).toBe(hex(plaintext));
    }
  });

  it("seals at random: one body, two unlike values under two unlike addresses", () => {
    const a = seal(body(300)), b = seal(body(300));
    expect(hex(a.sealed)).not.toBe(hex(b.sealed));
    expect(a.address).not.toBe(b.address);
    // The plaintext appears nowhere in the sealed bytes.
    expect(hex(a.sealed).includes(hex(body(300)).slice(0, 64))).toBe(false);
  });

  it("the address hashes every sealed byte", () => {
    const chunk = seal(body(64));
    expect(chunk.address).toBe(`blake3:${hex(blake3(chunk.sealed))}`);
  });

  it("altered bytes under the authorized address refuse `address-mismatch`", () => {
    const chunk = seal(body(500));
    for (const at of [0, 5, 25, 60, SEALED_HEADER_LEN + 3, chunk.sealed.length - 1]) {
      expect(refusalOf(open(altered(chunk.sealed, at), own(chunk.address))), `byte ${at}`).toBe("address-mismatch");
    }
  });

  it("a swapped value under the authorized address refuses `address-mismatch`", () => {
    const a = seal(utf8Bytes("pay the gardener forty")), b = seal(utf8Bytes("pay the gardener ninety"));
    expect(refusalOf(open(b.sealed, own(a.address)))).toBe("address-mismatch");
  });

  describe("a carrier that recomputes the address still opens nothing", () => {
    const chunk = seal(body(500));
    it("an altered mark refuses `format-unknown`", () => {
      const bytes = altered(chunk.sealed, 1);
      expect(refusalOf(open(bytes, recomputed(bytes)))).toBe("format-unknown");
    });
    it("an altered version hint refuses `version-mismatch`", () => {
      const bytes = altered(chunk.sealed, 6);
      expect(refusalOf(open(bytes, recomputed(bytes)))).toBe("version-mismatch");
    });
    it("an altered salt refuses `context-mismatch`", () => {
      const bytes = altered(chunk.sealed, 30);
      expect(refusalOf(open(bytes, recomputed(bytes)))).toBe("context-mismatch");
    });
    it("an altered commitment refuses `context-mismatch`", () => {
      const bytes = altered(chunk.sealed, 70);
      expect(refusalOf(open(bytes, recomputed(bytes)))).toBe("context-mismatch");
    });
    it("an altered segment byte, or an altered tag, refuses `sequence-broken`", () => {
      for (const at of [SEALED_HEADER_LEN, SEALED_HEADER_LEN + 250, chunk.sealed.length - 1]) {
        const bytes = altered(chunk.sealed, at);
        expect(refusalOf(open(bytes, recomputed(bytes))), `byte ${at}`).toBe("sequence-broken");
      }
    });
    it("cleartext never reads as a sealed value: `format-unknown`", () => {
      const clear = utf8Bytes("a plain body long enough to hold a header and one tag: ".repeat(4));
      expect(refusalOf(open(clear, recomputed(clear)))).toBe("format-unknown");
    });
  });

  it("a wrong key refuses `key-mismatch`", () => {
    const chunk = seal(body(100));
    expect(refusalOf(open(chunk.sealed, own(chunk.address), ctx(), otherKey))).toBe("key-mismatch");
  });

  it("a value of another key version refuses `version-mismatch`, whichever side moves", () => {
    const underOther = seal(body(100), ctx({}, otherKey), otherKey);
    // The reader names its own version and holds its own key; the carrier serves the other version's value.
    expect(refusalOf(open(underOther.sealed, own(underOther.address)))).toBe("version-mismatch");
  });

  it("a reader holding one key version forges nothing under another", () => {
    // A removed reader holds `otherKey`. It seals under its own key and stamps the current version's hint.
    const forged = Uint8Array.from(seal(body(100), ctx({}, otherKey), otherKey).sealed);
    forged.set(hexToBytes(ctx().keyVersion).subarray(0, 16), 4);
    expect(refusalOf(open(forged, recomputed(forged)))).toBe("context-mismatch");
  });

  it("a swapped role or reference refuses `context-mismatch`", () => {
    const chunk = seal(body(100));
    expect(refusalOf(open(chunk.sealed, own(chunk.address), ctx({ role: "checkpoint" })))).toBe("context-mismatch");
    expect(refusalOf(open(chunk.sealed, own(chunk.address), ctx({ logicalRef: ref("change-0002") })))).toBe("context-mismatch");
    expect(refusalOf(open(chunk.sealed, own(chunk.address), ctx({ logicalRef: ref("change-000") })))).toBe("context-mismatch");
  });

  it("a value sealed for one bag opens in no other, even where one key served both", () => {
    const chunk = seal(body(100));
    // The same key bytes installed under another bag name another key version there.
    expect(keyVersionIdOf(key, OTHER_BAG)).not.toBe(keyVersionIdOf(key, BAG));
    expect(refusalOf(open(chunk.sealed, own(chunk.address), ctx({}, key, OTHER_BAG)))).toBe("version-mismatch");
    // A writer that stamps the other bag's hint still fails the commitment.
    const stamped = Uint8Array.from(chunk.sealed);
    stamped.set(hexToBytes(keyVersionIdOf(key, OTHER_BAG)).subarray(0, 16), 4);
    expect(refusalOf(open(stamped, recomputed(stamped), ctx({}, key, OTHER_BAG)))).toBe("context-mismatch");
  });

  describe("a cut, dropped, re-ordered or repeated sequence", () => {
    const plaintext = body(2 * SEALED_SEGMENT_LEN + 900);
    const chunk = seal(plaintext);
    const head = chunk.sealed.subarray(0, SEALED_HEADER_LEN);
    const seg = (i: number): Uint8Array => chunk.sealed.subarray(SEALED_HEADER_LEN + i * SEG, Math.min(chunk.sealed.length, SEALED_HEADER_LEN + (i + 1) * SEG));
    const join = (...parts: Uint8Array[]): Uint8Array => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };
    const refuses = (bytes: Uint8Array): string => { expect(hex(bytes)).not.toBe(hex(chunk.sealed)); return refusalOf(open(bytes, recomputed(bytes))); };

    it("CONTROL: the three segments open whole", () => {
      const r = open(chunk.sealed, own(chunk.address));
      expect("plaintext" in r && hex(r.plaintext) === hex(plaintext)).toBe(true);
      expect(seg(0).length).toBe(SEG); expect(seg(2).length).toBe(900 + SEALED_TAG_LEN);
    });
    it("cut at a segment boundary refuses `truncated`, and never opens as a shorter body", () => {
      expect(refuses(join(head, seg(0), seg(1)))).toBe("truncated");
      expect(refuses(join(head, seg(0)))).toBe("truncated");
    });
    it("cut inside a segment refuses `sequence-broken`", () => {
      expect(refuses(chunk.sealed.subarray(0, chunk.sealed.length - 5))).toBe("sequence-broken");
      expect(refuses(join(head, seg(0), seg(1).subarray(0, 4000)))).toBe("sequence-broken");
    });
    it("a dropped middle segment refuses `sequence-broken`", () => {
      expect(refuses(join(head, seg(0), seg(2)))).toBe("sequence-broken");
    });
    it("re-ordered segments refuse `sequence-broken`", () => {
      expect(refuses(join(head, seg(1), seg(0), seg(2)))).toBe("sequence-broken");
    });
    it("a repeated segment refuses `sequence-broken`", () => {
      expect(refuses(join(head, seg(0), seg(0), seg(1), seg(2)))).toBe("sequence-broken");
    });
    it("bytes after the final segment refuse `sequence-broken`", () => {
      expect(refuses(join(chunk.sealed, new Uint8Array(40)))).toBe("sequence-broken");
      expect(refuses(join(chunk.sealed, seg(2)))).toBe("sequence-broken");
    });
    it("a header with no segment, and a segment shorter than its tag, refuse", () => {
      expect(refuses(head)).toBe("envelope-malformed");
      expect(refuses(join(head, seg(0), new Uint8Array(7)))).toBe("sequence-broken");
    });
    it("a segment of one value never opens inside another value of the same key and context", () => {
      const twin = seal(plaintext);
      const twinSeg1 = twin.sealed.subarray(SEALED_HEADER_LEN + SEG, SEALED_HEADER_LEN + 2 * SEG);
      expect(refuses(join(head, seg(0), twinSeg1, seg(2)))).toBe("sequence-broken");
    });
  });

  it("an address no named source vouched for opens nothing: `address-unauthorized`", () => {
    const chunk = seal(body(10));
    const bare = { address: chunk.address, source: "own-receipt" } as AuthorizedAddress;
    expect(refusalOf(open(chunk.sealed, bare))).toBe("address-unauthorized");
    expect(authorizeAddress("blake3:nothex", "own-receipt")).toBeNull();
    expect(authorizeAddress(chunk.address, "a-rumour" as never)).toBeNull();
  });

  it("the seal refuses by name: a key that names another version, a torn context, a short key", () => {
    expect(sealChunk({ key: otherKey, context: ctx(), plaintext: body(1) })).toEqual({ refusal: "key-mismatch" });
    expect(sealChunk({ key, context: ctx({ logicalRef: new Uint8Array(0) }), plaintext: body(1) })).toEqual({ refusal: "context-malformed" });
    expect(sealChunk({ key, context: ctx({ role: "gossip" as never }), plaintext: body(1) })).toEqual({ refusal: "context-malformed" });
    expect(sealChunk({ key: new Uint8Array(16) as never, context: ctx(), plaintext: body(1) })).toEqual({ refusal: "key-malformed" });
  });

  it("no input shape throws: every malformed reading answers a named refusal", () => {
    const chunk = seal(body(10));
    const a = own(chunk.address);
    expect(refusalOf(openChunk({ key: null as never, context: ctx(), sealed: chunk.sealed, authorized: a }))).toBe("key-malformed");
    expect(refusalOf(openChunk({ key, context: null as never, sealed: chunk.sealed, authorized: a }))).toBe("context-malformed");
    expect(refusalOf(openChunk({ key, context: ctx(), sealed: "bytes" as never, authorized: a }))).toBe("envelope-malformed");
    expect(refusalOf(openChunk({ key, context: ctx(), sealed: chunk.sealed, authorized: null as never }))).toBe("address-unauthorized");
  });
});

describe("the format, pinned by an independent derivation", () => {
  // The test derives every byte from the primitives alone, so a drifted label, field order or nonce shape reads red.
  const image = (name: string, ...fields: Uint8Array[]): Uint8Array => {
    const parts = [utf8Bytes(name), ...fields];
    const out: number[] = [];
    for (const p of parts) { out.push((p.length >>> 24) & 255, (p.length >>> 16) & 255, (p.length >>> 8) & 255, p.length & 255, ...p); }
    return Uint8Array.from(out);
  };
  const salt = new Uint8Array(32).fill(0x5a);
  const fixed = { getRandomValues: <T extends Uint8Array<ArrayBuffer>>(a: T): T => { a.set(salt); return a; } };

  it("the key version id, the context digest and the mark derive as the law states", () => {
    const id = hex(hkdf(sha256, key, undefined, image(CONTENT_KEY_ID_INFO, utf8Bytes(BAG)), 32));
    expect(keyVersionIdOf(key, BAG)).toBe(id);
    expect(hex(contextDigest(ctx()))).toBe(hex(sha256(image(SEALED_CHUNK_DOMAIN, utf8Bytes(BAG), hexToBytes(id), utf8Bytes("change"), ref("change-0001")))));
    expect(hex(SEALED_CHUNK_MARK)).toBe(hex(sha256(utf8Bytes(SEALED_CHUNK_DOMAIN)).slice(0, 4)));
    expect(hex(sealedImage("n", new Uint8Array([1, 2]), new Uint8Array(0)))).toBe("000000016e00000002010200000000");
  });

  it("a two-segment value equals the bytes an independent sealer writes", () => {
    const plaintext = body(SEALED_SEGMENT_LEN + 5);
    const context = ctx({ role: "blob", logicalRef: ref("digest-of-the-body") });
    const r = sealChunk({ key, context, plaintext, random: fixed });
    if (!("chunk" in r)) throw new Error(r.refusal);
    const digest = sha256(image(SEALED_CHUNK_DOMAIN, utf8Bytes(BAG), hexToBytes(context.keyVersion), utf8Bytes("blob"), ref("digest-of-the-body")));
    const bodyKey = hkdf(sha256, key, salt, image(SEALED_CHUNK_KEY_INFO, digest), 32);
    const commitment = hkdf(sha256, key, salt, image(SEALED_CHUNK_COMMITMENT_INFO, digest), 32);
    expect(hex(bodyKey)).not.toBe(hex(commitment));
    const nonce = (i: number, last: boolean): Uint8Array => { const n = new Uint8Array(12); n[10] = i; n[11] = last ? 1 : 0; return n; };
    const s0 = chacha20poly1305(bodyKey, nonce(0, false), digest).encrypt(plaintext.subarray(0, SEALED_SEGMENT_LEN));
    const s1 = chacha20poly1305(bodyKey, nonce(1, true), digest).encrypt(plaintext.subarray(SEALED_SEGMENT_LEN));
    const expected = hex(SEALED_CHUNK_MARK) + context.keyVersion.slice(0, 32) + hex(salt) + hex(commitment) + hex(s0) + hex(s1);
    expect(hex(r.chunk.sealed)).toBe(expected);
  });

  it("a sealer that appends an empty final segment after a full one opens nothing", () => {
    // Only a key holder builds this; the rule keeps one body from taking two sealed shapes.
    const plaintext = body(SEALED_SEGMENT_LEN);
    const context = ctx();
    const digest = contextDigest(context);
    const bodyKey = hkdf(sha256, key, salt, image(SEALED_CHUNK_KEY_INFO, digest), 32);
    const commitment = hkdf(sha256, key, salt, image(SEALED_CHUNK_COMMITMENT_INFO, digest), 32);
    const nonce = (i: number, last: boolean): Uint8Array => { const n = new Uint8Array(12); n[10] = i; n[11] = last ? 1 : 0; return n; };
    const s0 = chacha20poly1305(bodyKey, nonce(0, false), digest).encrypt(plaintext);
    const s1 = chacha20poly1305(bodyKey, nonce(1, true), digest).encrypt(new Uint8Array(0));
    const crafted = hexToBytes(hex(SEALED_CHUNK_MARK) + context.keyVersion.slice(0, 32) + hex(salt) + hex(commitment) + hex(s0) + hex(s1));
    expect(refusalOf(open(crafted, recomputed(crafted)))).toBe("sequence-broken");
    // CONTROL: the same crafting with the full segment marked final opens.
    const whole = chacha20poly1305(bodyKey, nonce(0, true), digest).encrypt(plaintext);
    const lawful = hexToBytes(hex(SEALED_CHUNK_MARK) + context.keyVersion.slice(0, 32) + hex(salt) + hex(commitment) + hex(whole));
    const r = open(lawful, recomputed(lawful));
    expect("plaintext" in r && r.plaintext.length).toBe(SEALED_SEGMENT_LEN);
  });

  it("a minted key draws 32 bytes and reads back", () => {
    const k = mintContentKey();
    expect(k.length).toBe(32);
    expect(hex(mintContentKey())).not.toBe(hex(k));
    expect(readContentKey(new Uint8Array(31))).toBeNull();
  });
});
