/**
 * agile-digest — the algorithm-tagged content-digest grammar + the R3 pin.
 * Canon: lar:///ha.ka.ba/lararium/mesh/agile-digest
 */

import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  parseDigest,
  formatDigest,
  tagDigest,
  digestsEqual,
  reprDigestOf,
  SHA256_ALGO,
} from "../src/agile-digest.js";
import { sha256HexSync, sha256HexBytesSync, utf8Bytes } from "../src/crypto.js";

const HEX64 = "a".repeat(64);
const HEX64_B = "b".repeat(64);

describe("parseDigest", () => {
  test("★ a bare 64-char hex names no algorithm and is refused, named ★", () => {
    expect(() => parseDigest(HEX64)).toThrow(/bare hex .* names no algorithm/);
    expect(() => parseDigest("AB".repeat(32))).toThrow(/names no algorithm/);
    expect(SHA256_ALGO).toBe("sha256");
  });

  test("uppercase tagged hex normalizes to lowercase", () => {
    expect(parseDigest(`SHA256:${"AB".repeat(32)}`)).toEqual({ algo: "sha256", hex: "ab".repeat(32) });
  });

  test("the canonical tagged form splits on the first colon", () => {
    expect(parseDigest(`sha256:${HEX64}`)).toEqual({ algo: "sha256", hex: HEX64 });
  });

  test("the legacy SRI / sourceCidOf `algo-hex` form parses", () => {
    // `sourceCidOf` emits "sha256-" + hex; the dual-read must accept it.
    expect(parseDigest(`sha256-${HEX64}`)).toEqual({ algo: "sha256", hex: HEX64 });
  });

  test("a future algorithm rides free", () => {
    const b3 = "c".repeat(64);
    expect(parseDigest(`blake3:${b3}`)).toEqual({ algo: "blake3", hex: b3 });
  });

  test("a malformed tagged digest refuses, never fuses a corrupt value in", () => {
    expect(() => parseDigest("sha256:xyz")).toThrow(/malformed/);
    expect(() => parseDigest("sha256:")).toThrow();
  });

  test("a non-64 bare value that is not tagged refuses", () => {
    expect(() => parseDigest("deadbeef")).toThrow();       // 8 hex, not a bare sha256, no tag
    expect(() => parseDigest("")).toThrow();
    expect(() => parseDigest("not-hex-at-all!!")).toThrow();
  });
});

describe("formatDigest / tagDigest", () => {
  test("formatDigest emits canonical `algo:hex`, lowercased", () => {
    expect(formatDigest("SHA256", "AB".repeat(32))).toBe(`sha256:${"ab".repeat(32)}`);
  });

  test("formatDigest validates its inputs", () => {
    expect(() => formatDigest("bad tag", HEX64)).toThrow();
    expect(() => formatDigest("sha256", "nothex")).toThrow();
  });

  test("tagDigest re-spells an accepted form as canonical, is idempotent, and refuses a bare value", () => {
    const tagged = `sha256:${HEX64}`;
    expect(tagDigest(tagged)).toBe(tagged);              // idempotent
    expect(tagDigest(`sha256-${HEX64}`)).toBe(tagged);   // SRI spelling → canonical
    expect(() => tagDigest(HEX64)).toThrow(/names no algorithm/);
  });
});

describe("digestsEqual — one digest, every tagged spelling", () => {
  test("★ a bare hex is unequal to its own tagged form, and to itself ★", () => {
    expect(digestsEqual(HEX64, `sha256:${HEX64}`)).toBe(false);
    expect(digestsEqual(`sha256:${HEX64}`, HEX64)).toBe(false);
    expect(digestsEqual(HEX64, HEX64)).toBe(false);
  });

  test("CONTROL: tagged equals tagged", () => {
    expect(digestsEqual(`sha256:${HEX64}`, `sha256:${HEX64}`)).toBe(true);
  });

  test("the legacy `-` form equals the canonical `:` form", () => {
    expect(digestsEqual(`sha256-${HEX64}`, `sha256:${HEX64}`)).toBe(true);
  });

  test("case-insensitive on the hex", () => {
    expect(digestsEqual(`sha256:${"AB".repeat(32)}`, `sha256:${"ab".repeat(32)}`)).toBe(true);
  });

  test("different content never reads equal", () => {
    expect(digestsEqual(`sha256:${HEX64}`, `sha256:${HEX64_B}`)).toBe(false);
  });

  test("a different algorithm over the same hex never reads equal", () => {
    expect(digestsEqual(`sha256:${HEX64}`, `blake3:${HEX64}`)).toBe(false);
  });

  test("a malformed digest reads NOT-equal, never throws on the hot path", () => {
    expect(digestsEqual("garbage", `sha256:${HEX64}`)).toBe(false);
    expect(digestsEqual(`sha256:${HEX64}`, "")).toBe(false);
  });
});

describe("R3 PIN — the two SHA-256 implementations must stay byte-equal", () => {
  // The stack carries TWO sha256 impls: the mesh `sha256HexSync` (@noble/hashes)
  // and `synced-tree.ts` `contentHash` (node `crypto.createHash`). The Confluence
  // echo gate compares a value hashed by one against a value hashed by the other,
  // so a divergence would silently read every carrier as `changed`. This test
  // pins them EQUAL over UTF-8 text — a future drift (an impl bump, an encoding
  // change) surfaces HERE, loudly, before it corrupts ingest quiescence.
  const nodeContentHash = (text: string): string =>
    createHash("sha256").update(text, "utf8").digest("hex");

  const samples = [
    "",
    "hello world",
    "lar:///ha.ka.ba/lares/api/pono/meme",
    "unicode: café ☕ 🜂 ॐ ँ — NFC body",
    "a".repeat(10_000),
    "line1\n\nline2\nfield: value",   // the carrierHash `${meta}\n\n${body}` shape
  ];

  test.each(samples)("noble sha256HexSync === node crypto contentHash for %j", (text) => {
    expect(sha256HexSync(text)).toBe(nodeContentHash(text));
  });

  test("the bytes-path agrees too (sha256HexBytesSync over utf8Bytes)", () => {
    const text = "lar:///ha.ka.ba/lararium/mesh/agile-digest";
    expect(sha256HexBytesSync(utf8Bytes(text))).toBe(nodeContentHash(text));
    expect(sha256HexSync(text)).toBe(sha256HexBytesSync(utf8Bytes(text)));
  });
});

describe("★ RFC 9530 `Repr-Digest` — the third form of one digest ★", () => {
  const hex = createHash("sha256").update("the one meme").digest("hex");
  const b64 = Buffer.from(hex, "hex").toString("base64");

  test("CONTROL: `sha-256=:<base64>:` parses to the same (algo, hex) the tagged forms carry", () => {
    expect(parseDigest(`sha-256=:${b64}:`)).toEqual({ algo: "sha256", hex });
    expect(digestsEqual(`sha-256=:${b64}:`, `sha256:${hex}`)).toBe(true);
    expect(digestsEqual(`sha-256=:${b64}:`, `sha256-${hex}`)).toBe(true);
    expect(digestsEqual(`sha-256=:${b64}:`, hex)).toBe(false);   // the bare side names no algorithm
  });

  test("reprDigestOf emits the header value from any tagged form; it round-trips through parseDigest", () => {
    const want = `sha-256=:${b64}:`;
    expect(reprDigestOf(`sha256:${hex}`)).toBe(want);
    expect(reprDigestOf(`sha256-${hex}`)).toBe(want);
    expect(reprDigestOf(want)).toBe(want);
    expect(parseDigest(reprDigestOf(`sha256:${hex}`))).toEqual({ algo: "sha256", hex });
    expect(() => reprDigestOf(hex)).toThrow(/names no algorithm/);
  });

  test("CONTROL: a different body's Repr-Digest never reads equal; a torn header refuses", () => {
    const other = Buffer.from(createHash("sha256").update("another meme").digest("hex"), "hex").toString("base64");
    expect(digestsEqual(`sha-256=:${other}:`, `sha256:${hex}`)).toBe(false);
    expect(digestsEqual(`sha-256=:${b64.slice(1)}:`, `sha256:${hex}`)).toBe(false);
    expect(() => parseDigest(`sha-256=:${b64}`)).toThrow(/malformed/);
    expect(() => parseDigest(`sha-256=::`)).toThrow(/malformed/);
    expect(() => reprDigestOf(`blake3:${hex}`)).toThrow(/sha-256/);
  });
});
