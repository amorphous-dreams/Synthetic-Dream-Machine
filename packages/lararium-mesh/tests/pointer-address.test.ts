/**
 * pointer-address.test.ts — the ONE reading of a pointer tiddler's content address.
 *
 * A pointer names bytes by their SHA-256 and nothing else. The proofs:
 *   · every spelling the house reads (`ni:///sha-256;…`, `cid:<hex>`, `cid:sha256:<hex>`, `lar:///…/cid/<hex>`, a bare key)
 *     names the same lowercase digest;
 *   · a name under another algorithm, a truncated or non-canonical digest, and a name carrying a version read as no address;
 *   · a record's `_canonical_uri`, `textCid` and `_integrity` must agree, and a disagreement refuses by name;
 *   · a web2 address reads as a source and references no blob; a record holding `text` reads inline;
 *   · the GC reference reader counts a pointer authored by `_canonical_uri` alone.
 */
import { describe, test, expect } from "vitest";
import { sha256HexBytesSync, niUriSha256FromHex } from "../src/crypto.js";
import { cidUri } from "../src/lar-uris.js";
import { casCidOfRecord, casReferences } from "../src/cas.js";
import {
  casKeyOfCanonicalUri, isContentAddress, readPointerAddress, sha256HexOfAddress,
  POINTER_ADDRESS_CODE, POINTER_INTEGRITY_CODE,
} from "../src/pointer-address.js";

const BYTES = new TextEncoder().encode("the bytes a pointer names");
const HEX = sha256HexBytesSync(BYTES);
const NI = niUriSha256FromHex(HEX);
const OTHER = sha256HexBytesSync(new TextEncoder().encode("other bytes"));

describe("sha256HexOfAddress — one digest under every spelling", () => {
  test("RED: ni, cid:, cid:sha256:, the lar cid name and a bare key each read the same lowercase hex", () => {
    for (const address of [NI, `cid:${HEX}`, `cid:sha256:${HEX}`, `cid:${HEX.toUpperCase()}`, cidUri(HEX), HEX, `sha256:${HEX.toUpperCase()}`]) {
      expect(sha256HexOfAddress(address)).toBe(HEX);
    }
  });

  test("RED: another algorithm, a short digest, a non-canonical ni and a versioned name read as no address", () => {
    const flipped = NI.slice(0, -1) + (NI.endsWith("A") ? "B" : "A");
    for (const address of ["ni:///md5;AAAA", "ni:///sha-256;AAAA", `ni:///sha-256;${NI.slice("ni:///sha-256;".length)}=`, `cid:blake3:${HEX}`, `cid:${HEX}@v2`, `cid:${HEX.slice(2)}`, "https://example.org/a.png", ""]) {
      expect(sha256HexOfAddress(address)).toBeNull();
    }
    // 43 base64url characters carry two spare bits: a name that sets them spells no digest, or another one, never this one.
    expect(sha256HexOfAddress(flipped)).not.toBe(HEX);
  });

  test("a content address reads apart from a source; the CAS key of a `_canonical_uri` follows", () => {
    expect([NI, `cid:${HEX}`, cidUri(HEX)].map(isContentAddress)).toEqual([true, true, true]);
    expect(["https://example.org/a.png", "data:image/png;base64,AAAA", "blob:x", "lar:///ha.ka.ba/lares/api/x"].map(isContentAddress)).toEqual([false, false, false, false]);
    expect(casKeyOfCanonicalUri(NI)).toBe(HEX);
    expect(casKeyOfCanonicalUri(`cid:${HEX}`)).toBe(HEX);
    expect(casKeyOfCanonicalUri(cidUri(HEX))).toBe(HEX);
    expect(casKeyOfCanonicalUri("https://example.org/a.png")).toBeNull();
  });
});

describe("readPointerAddress — one pointer names one digest", () => {
  test("RED: a `_canonical_uri` with `_integrity` reads as an address; each field alone reads as one too", () => {
    expect(readPointerAddress({ title: "P", type: "image/png", _canonical_uri: NI, _integrity: NI })).toEqual({ kind: "address", cid: HEX, integrity: NI });
    expect(readPointerAddress({ _canonical_uri: `cid:${HEX}` })).toEqual({ kind: "address", cid: HEX, integrity: NI });
    expect(readPointerAddress({ _is_skinny: "yes", textCid: `sha256:${HEX.toUpperCase()}` })).toEqual({ kind: "address", cid: HEX, integrity: NI });
    expect(readPointerAddress({ _is_skinny: "yes", textCid: HEX, _canonical_uri: cidUri(HEX), _integrity: NI })).toEqual({ kind: "address", cid: HEX, integrity: NI });
  });

  test("RED: names that disagree refuse `pointer-integrity-mismatch` and name both fields", () => {
    const split = readPointerAddress({ _canonical_uri: NI, _integrity: niUriSha256FromHex(OTHER) });
    expect(split).toMatchObject({ kind: "refused", code: POINTER_INTEGRITY_CODE, why: expect.stringMatching(/_canonical_uri.*_integrity/) });
    expect(readPointerAddress({ textCid: HEX, _canonical_uri: `cid:${OTHER}` })).toMatchObject({ kind: "refused", code: POINTER_INTEGRITY_CODE });
  });

  test("RED: an address under no spelling the house reads, and a pointer mark naming no bytes, refuse `pointer-address-malformed` with the spellings", () => {
    for (const fields of [{ _canonical_uri: "ni:///md5;AAAA" }, { _canonical_uri: `cid:${HEX}@v2` }, { textCid: "abad1dea" }, { _canonical_uri: NI, _integrity: "ni:///sha-256;x" }, { _is_skinny: "yes" }]) {
      expect(readPointerAddress(fields)).toMatchObject({ kind: "refused", code: POINTER_ADDRESS_CODE, why: expect.stringContaining("ni:///sha-256;<base64url>") });
    }
  });

  test("CONTROL: a record holding text reads inline whatever else it carries; a web2 address reads as a source; a browser's blob: URL beside a `textCid` leaves the address standing", () => {
    expect(readPointerAddress({ text: "inline", _canonical_uri: NI })).toEqual({ kind: "inline" });
    expect(readPointerAddress({ title: "plain" })).toEqual({ kind: "inline" });
    expect(readPointerAddress({ type: "image/png", _canonical_uri: "https://example.org/a.png" })).toEqual({ kind: "source", uri: "https://example.org/a.png" });
    expect(readPointerAddress({ textCid: HEX, _canonical_uri: "blob:session-url" })).toEqual({ kind: "address", cid: HEX, integrity: NI });
  });
});

describe("the reference reader counts an authored pointer", () => {
  test("RED: a record naming its bytes by `_canonical_uri` alone (ni or cid:) references that blob; a web2 address references none", () => {
    expect(casCidOfRecord({ title: "a", _canonical_uri: NI })).toBe(HEX);
    expect(casCidOfRecord({ title: "b", _canonical_uri: `cid:${HEX}` })).toBe(HEX);
    expect(casCidOfRecord({ title: "c", _canonical_uri: "https://example.org/a.png" })).toBeNull();
    const refs = casReferences([{ title: "a", bagId: "lares", record: { tiddler: { title: "a", _canonical_uri: NI } } }]);
    expect(refs.get(HEX)?.size).toBe(1);
  });
});
