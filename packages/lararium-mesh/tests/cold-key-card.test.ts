/**
 * cold-key-card.test — the paper a seat's cold key rests on.
 *
 * A pure codec with no caller proves itself by vectors alone. Proven here:
 *   · every character of a code sits under the checksum, and no two groups trade places unseen;
 *   · every unreadable code or seed refuses by ONE name, and no refusal carries a fragment of the code;
 *   · spacing, dashes and case never change what a code reads;
 *   · a seat digest commits a key under its own domain and collides with no key-set hash;
 *   · a mint draws 32 random bytes once and derives from nothing else;
 *   · a card prints purpose, chair label, generation and the charter fingerprint; no display field enters
 *     the code, the checksum or the digest; a card with and without a fingerprint round-trips one code;
 *   · the module stays out of the package barrel.
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import {
  COLD_KEY_CARD_DEFAULT_FIELDS, ColdKeyCardError, coldKeyCardLines, coldKeyCode, coldKeyConfirm,
  coldKeyFromSeed, coldKeySeedFromCode, mintColdKey, seatNextDigest, type ColdKeyCardFields,
} from "../src/cold-key-card.js";
import { sha256HexSync } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";

/** A seed whose 32 bytes all differ, so no two groups of a code repeat by accident of the fixture. */
const SEED = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const OTHER = Uint8Array.from({ length: 32 }, (_, i) => (i * 11 + 5) & 0xff);
const PINNED = new Uint8Array(32).fill(7);
const HEX = "0123456789abcdef";

/** The refusal a code draws, or null when it reads. */
function refusalOf(code: string): string | null {
  try { coldKeySeedFromCode(code); return null; }
  catch (error) {
    expect(error).toBeInstanceOf(ColdKeyCardError);
    return (error as Error).message;
  }
}
const unreadable = (code: string): boolean => /^cold-key-card-unreadable: /.test(refusalOf(code) ?? "");

describe("the code — every character sits under the checksum", () => {
  test("★ one changed character anywhere refuses, whichever digit replaces it ★", () => {
    const code = coldKeyCode(SEED);
    const raw = code.replaceAll("-", "");
    expect(raw).toHaveLength(72);
    let refused = 0;
    for (let i = 0; i < 72; i++) {
      for (const digit of HEX) {
        if (digit === raw[i]) continue;
        expect(unreadable(`${raw.slice(0, i)}${digit}${raw.slice(i + 1)}`)).toBe(true);
        refused++;
      }
    }
    expect(refused).toBe(72 * 15);
    // CONTROL: the untouched code reads the seed back, byte for byte.
    expect(coldKeySeedFromCode(code)).toEqual(SEED);
  });

  test("★ two neighbouring groups that trade places refuse ★", () => {
    const groups = coldKeyCode(SEED).split("-");
    expect(groups).toHaveLength(18);
    let swaps = 0;
    for (let i = 0; i < groups.length - 1; i++) {
      if (groups[i] === groups[i + 1]) continue;
      const swapped = [...groups];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1]!, swapped[i]!];
      expect(unreadable(swapped.join("-"))).toBe(true);
      swaps++;
    }
    expect(swaps).toBe(17);                                   // the fixture seed repeats no neighbouring group
    expect(coldKeySeedFromCode(groups.join("-"))).toEqual(SEED);   // CONTROL
  });

  test("a wrong length, a foreign character and an empty code each refuse by the one name", () => {
    const raw = coldKeyCode(SEED).replaceAll("-", "");
    const bad = [raw.slice(1), `${raw}0`, "", "---", "   ",
      ...["g", "O", "l", "_"].map((c) => `${raw.slice(0, 9)}${c}${raw.slice(10)}`)];
    for (const code of bad) expect(unreadable(code)).toBe(true);
  });

  test("CONTROL: case, spaces, missing separators and outer whitespace all read the one seed", () => {
    const code = coldKeyCode(SEED);
    const raw = code.replaceAll("-", "");
    for (const spelling of [code, code.toUpperCase(), code.replaceAll("-", " "), raw, `  ${code}\n`, code.replaceAll("-", " - ")]) {
      expect(coldKeySeedFromCode(spelling)).toEqual(SEED);
    }
  });

  test("a code spells 18 lowercase groups of four; a seed of another length refuses", async () => {
    expect(coldKeyCode(SEED)).toMatch(/^([0-9a-f]{4}-){17}[0-9a-f]{4}$/);
    for (const length of [0, 31, 33]) {
      expect(() => coldKeyCode(new Uint8Array(length))).toThrow(/^cold-key-card-unreadable: /);
      await expect(coldKeyFromSeed(new Uint8Array(length))).rejects.toThrow(/^cold-key-card-unreadable: /);
    }
    expect((await coldKeyFromSeed(SEED)).seed).toEqual(SEED);   // CONTROL
  });

  test("★ no refusal carries a fragment of the code ★", () => {
    const raw = coldKeyCode(SEED).replaceAll("-", "");
    const flipped = `${raw.slice(0, 71)}${raw[71] === "0" ? "1" : "0"}`;
    const refusing = [raw.slice(1), flipped, `${raw.slice(0, 71)}g`, `${raw}${raw}`];
    for (const input of refusing) {
      const message = refusalOf(input);
      expect(message).not.toBeNull();
      expect(message).not.toMatch(/[0-9a-f]{8,}/i);
      for (let i = 0; i + 4 <= 72; i += 4) expect(message).not.toContain(raw.slice(i, i + 4));
    }
    expect(raw).toMatch(/[0-9a-f]{8,}/);                       // KNOWN POSITIVE: the probe sees a code
  });
});

describe("the seat digest — a key committed under its own domain", () => {
  test("two keys differ, case folds, and a malformed key refuses", async () => {
    const a = await coldKeyFromSeed(SEED), b = await coldKeyFromSeed(OTHER);
    expect(a.digest).not.toBe(b.digest);
    expect(seatNextDigest(a.verifyingKey)).toBe(a.digest);
    expect(seatNextDigest(a.verifyingKey.toUpperCase())).toBe(a.digest);
    expect(() => seatNextDigest("g".repeat(64))).toThrow(ColdKeyCardError);
    expect(() => seatNextDigest("a".repeat(62))).toThrow(ColdKeyCardError);
    expect(() => seatNextDigest("")).toThrow(ColdKeyCardError);
  });

  test("★ a seat digest collides with no bare hash and no key-set hash of the same key ★", async () => {
    const key = await coldKeyFromSeed(SEED);
    expect(key.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(key.digest).not.toBe(sha256HexSync(key.verifyingKey));
    expect(key.digest).not.toBe(sealKeySetHash([key.verifyingKey], 1));
  });

  test("the pinned vector (computed apart from the module: Ed25519 of the seed, then SHA-256 over the sorted-key JSON)", async () => {
    const key = await coldKeyFromSeed(PINNED);
    expect(key.verifyingKey).toBe("ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c");
    expect(key.digest).toBe("8bf401a3e930746cb7e01479ccf67def452a0abd28e6cb4b879ba7218d430145");
    expect(coldKeyCode(key.seed)).toBe("0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-0707-67e3-5614");
    expect(coldKeyConfirm(coldKeyCode(key.seed))).toBe("marsh-glade-moss");
  });
});

describe("the mint — 32 random bytes and nothing else", () => {
  test("two mints differ; KNOWN POSITIVE: a constant source yields equal seeds, asked once for 32 bytes", async () => {
    const calls: number[] = [];
    const rng = {
      getRandomValues<T extends Uint8Array<ArrayBuffer>>(array: T): T { calls.push(array.byteLength); array.fill(19); return array; },
      randomUUID: () => "unused",
    };
    const first = await mintColdKey(rng);
    expect(calls).toEqual([32]);
    const second = await mintColdKey(rng);
    expect(calls).toEqual([32, 32]);
    expect(second.seed).toEqual(first.seed);
    expect(first.seed).toEqual(new Uint8Array(32).fill(19));   // the seed IS the drawn bytes, untransformed
    expect(first.digest).toBe(seatNextDigest(first.verifyingKey));
    const x = await mintColdKey(), y = await mintColdKey();
    expect(x.seed).not.toEqual(y.seed);
    expect(x.seed).toHaveLength(32);
  });
});

describe("the card — four fields beside the code", () => {
  const fields: ColdKeyCardFields = { purpose: "seed seat", chairLabel: "copper chair", generation: 2, charterFingerprint: "fp-synthetic-0042" };
  const THREE = ["purpose", "chairLabel", "generation"] as const;
  const codeOf = (lines: readonly string[]): string => lines.filter((l) => /^([0-9a-f]{4}-)*[0-9a-f]{4}$/.test(l)).join("-");

  test("★ a card prints purpose, chair, generation and the charter fingerprint, in that order ★", () => {
    const lines = coldKeyCardLines(SEED, fields);
    expect(COLD_KEY_CARD_DEFAULT_FIELDS).toEqual(["purpose", "chairLabel", "generation", "charterFingerprint"]);
    expect(lines.slice(0, 4)).toEqual(["purpose: seed seat", "chair: copper chair", "generation: 2", "charter: fp-synthetic-0042"]);
    expect(lines).toHaveLength(4 + 3 + 1);                     // four fields, three rows of six groups, the phrase
    // A field the caller leaves unnamed never prints (KNOWN POSITIVE above: named, it does).
    const three = coldKeyCardLines(SEED, fields, THREE).join("\n");
    expect(three).not.toContain(fields.charterFingerprint!);
    expect(three).toContain("copper chair");
  });

  test("a named field with no value refuses; a generation that counts nothing refuses", () => {
    const bare: ColdKeyCardFields = { purpose: "p", chairLabel: "c", generation: 0 };
    expect(() => coldKeyCardLines(SEED, bare)).toThrow("cold-key-card-field-absent: charterFingerprint");
    expect(() => coldKeyCardLines(SEED, { ...bare, charterFingerprint: "" })).toThrow("cold-key-card-field-absent: charterFingerprint");
    expect(() => coldKeyCardLines(SEED, { ...bare, generation: -1 }, THREE)).toThrow("cold-key-card-field-invalid: generation");
    expect(() => coldKeyCardLines(SEED, { ...bare, generation: 1.5 }, THREE)).toThrow(ColdKeyCardError);
    expect(coldKeyCardLines(SEED, bare, THREE)).toHaveLength(3 + 3 + 1);   // CONTROL
  });

  test("★ a card with and without a fingerprint round-trips one code, and no display field moves it ★", () => {
    const withFp = coldKeyCardLines(SEED, fields);
    const without = coldKeyCardLines(SEED, { purpose: "nexus seat", chairLabel: "tin chair", generation: 9 }, THREE);
    for (const lines of [withFp, without]) {
      expect(coldKeySeedFromCode(codeOf(lines))).toEqual(SEED);
      expect(codeOf(lines)).toBe(coldKeyCode(SEED));
      expect(lines.at(-1)).toBe(`confirm: ${coldKeyConfirm(coldKeyCode(SEED))}`);
    }
    // CONTROL: another seed prints another code under the same fields.
    expect(codeOf(coldKeyCardLines(OTHER, fields))).not.toBe(codeOf(withFp));
  });
});

describe("the confirm phrase", () => {
  test("three spellings of one code read one phrase; another seed reads another; an unreadable code throws", () => {
    const a = coldKeyCode(PINNED), b = coldKeyCode(OTHER);
    expect(coldKeyConfirm(a)).toBe(coldKeyConfirm(a.toUpperCase().replaceAll("-", " ")));
    expect(coldKeyConfirm(a)).toBe(coldKeyConfirm(a.replaceAll("-", "")));
    expect(coldKeyConfirm(a)).not.toBe(coldKeyConfirm(b));
    const last = a.at(-1) === "0" ? "1" : "0";
    expect(() => coldKeyConfirm(`${a.slice(0, -1)}${last}`)).toThrow(/^cold-key-card-unreadable: /);
  });
});

describe("the barrel stays shut until a caller consumes the card", () => {
  test("the package barrel names the module nowhere", () => {
    const barrel = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(barrel).not.toContain("cold-key-card");
    expect(barrel).toContain("guardian-card");                 // KNOWN POSITIVE: the probe reads the barrel
  });
});
