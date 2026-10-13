/**
 * walk-carry-key — one carried document's key, pinned by an independent derivation.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/keys
 */
import { describe, expect, it } from "vitest";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, sha256HexBytesSync, utf8Bytes } from "../src/crypto.js";
import { WALK_CARRY_DOCUMENT_INFO } from "../src/domains.js";
import { walkCarrySecret } from "../src/hosting.js";
import { sealedImage } from "../src/sealed-chunk.js";
import { walkCarriageBagId, walkCarryDocumentKey } from "../src/walk-carry.js";

const LEAF = new Uint8Array(32).fill(72);
const AID = "epoch0-" + "a".repeat(64);
const ref = sha256HexBytesSync(utf8Bytes("a page the walker wrote"));

describe("a carried document's key", () => {
  it("derives from the walker's carry secret and the document's digest, as the law states", () => {
    const expected = hkdf(sha256, walkCarrySecret(LEAF, AID), undefined, sealedImage(WALK_CARRY_DOCUMENT_INFO, hexToBytes(ref)), 32);
    expect(hex(walkCarryDocumentKey(LEAF, AID, ref))).toBe(hex(expected));
  });
  it("differs per document, per Nexus and per leaf, and never equals the carry secret", () => {
    const other = sha256HexBytesSync(utf8Bytes("another page"));
    const k = hex(walkCarryDocumentKey(LEAF, AID, ref));
    expect(hex(walkCarryDocumentKey(LEAF, AID, other))).not.toBe(k);
    expect(hex(walkCarryDocumentKey(LEAF, "epoch0-" + "b".repeat(64), ref))).not.toBe(k);
    expect(hex(walkCarryDocumentKey(new Uint8Array(32).fill(73), AID, ref))).not.toBe(k);
    expect(hex(walkCarrySecret(LEAF, AID))).not.toBe(k);
  });
  it("refuses a digest that reads as no SHA-256, and names one bag per document", () => {
    expect(() => walkCarryDocumentKey(LEAF, AID, "page-one")).toThrow(/SHA-256/);
    expect(walkCarriageBagId(AID.toUpperCase(), ref)).toBe(`walk-carriage:${AID}:${ref}`);
    expect(walkCarriageBagId(AID, ref)).not.toBe(walkCarriageBagId(AID, "0".repeat(64)));
  });
});
