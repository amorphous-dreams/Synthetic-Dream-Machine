/**
 * slip39.test — the paper pin's encoding answers to the PUBLISHED SLIP-0039 vectors, riding the house GF(256) field.
 *
 * The red set is SatoshiLabs' own (`tests/fixtures/slip39-vectors.json`, from `trezor/python-shamir-mnemonic`
 * `vectors.json`, passphrase "TREZOR"): every valid vector recovers its master secret byte-for-byte, and every
 * invalid vector refuses. An encoder that agrees only with itself proves nothing a second implementation can read;
 * these vectors make a sheet this house prints recoverable by any SLIP-39 reader, and the reverse.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  combineMnemonics, generateMnemonics, decodeShare, encodeShare, readBackMismatch, Slip39Error,
} from "../src/slip39.js";
import { SLIP39_WORDS } from "../src/slip39-wordlist.js";
import type { RandomProvider } from "../src/crypto.js";

interface Vector { readonly description: string; readonly mnemonics: readonly string[]; readonly masterSecret: string }
const VECTORS = JSON.parse(readFileSync(new URL("./fixtures/slip39-vectors.json", import.meta.url), "utf8")) as Vector[];
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

/** A deterministic RNG (LCG) so a split pins its output — never for production. */
function seededRng(seed: number): RandomProvider {
  let s = seed >>> 0;
  return {
    getRandomValues<T extends Uint8Array<ArrayBuffer>>(arr: T): T {
      for (let i = 0; i < arr.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; arr[i] = (s >>> 24) & 0xff; }
      return arr;
    },
    randomUUID: () => "00000000-0000-4000-8000-000000000000",
  };
}

describe("the wordlist", () => {
  test("holds the published 1024 words in order (sha256 of the newline-terminated list)", () => {
    expect(SLIP39_WORDS.length).toBe(1024);
    const digest = createHash("sha256").update(SLIP39_WORDS.join("\n") + "\n").digest("hex");
    expect(digest).toBe("bcc4555340332d169718aed8bf31dd9d5248cb7da6e5d355140ef4f1e601eec3");
  });
});

describe("the published SLIP-0039 vectors", () => {
  test("the fixture carries all 45 vectors, valid and invalid both (a non-empty control)", () => {
    expect(VECTORS.length).toBe(45);
    expect(VECTORS.filter((v) => v.masterSecret !== "").length).toBe(15);
    expect(VECTORS.filter((v) => v.masterSecret === "").length).toBe(30);
  });

  for (const v of VECTORS) {
    if (v.masterSecret !== "") {
      test(`recovers: ${v.description}`, () => {
        expect(hex(combineMnemonics(v.mnemonics, "TREZOR"))).toBe(v.masterSecret);
      });
    } else {
      test(`refuses: ${v.description}`, () => {
        expect(() => combineMnemonics(v.mnemonics, "TREZOR")).toThrow(Slip39Error);
      });
    }
  }
});

describe("the share codec", () => {
  test("decode then encode returns every valid vector's words unchanged", () => {
    for (const v of VECTORS.filter((x) => x.masterSecret !== "")) {
      for (const m of v.mnemonics) expect(encodeShare(decodeShare(m))).toBe(m);
    }
  });

  test("a word outside the list refuses, naming the word", () => {
    const words = VECTORS[0]!.mnemonics[0]!.split(" ");
    words[5] = "notaword";
    expect(() => decodeShare(words.join(" "))).toThrow(/notaword/);
  });
});

describe("generate → combine", () => {
  const secret = Uint8Array.from({ length: 32 }, (_, i) => (i * 53 + 7) & 0xff);

  test("a 1-of-1 sheet recovers the secret (the paper pin's default)", () => {
    const sheets = generateMnemonics({ groupThreshold: 1, groups: [[1, 1]], masterSecret: secret, rng: seededRng(1) });
    expect(sheets.length).toBe(1);
    expect(sheets[0]!.length).toBe(1);
    expect(sheets[0]![0]!.split(" ").length).toBe(33);                 // 4 header + 26 value + 3 checksum
    expect(hex(combineMnemonics(sheets[0]!))).toBe(hex(secret));
  });

  test("2-of-3 recovers from ANY two sheets, and one sheet alone refuses", () => {
    const [group] = generateMnemonics({ groupThreshold: 1, groups: [[2, 3]], masterSecret: secret, rng: seededRng(2) });
    const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
    for (const [a, b] of pairs) expect(hex(combineMnemonics([group![a]!, group![b]!]))).toBe(hex(secret));
    expect(() => combineMnemonics([group![0]!])).toThrow(Slip39Error);
  });

  test("two groups of two recover across groups, and a passphrase moves the secret it opens", () => {
    const groups = generateMnemonics({
      groupThreshold: 2, groups: [[2, 2], [1, 1], [2, 3]], masterSecret: secret, passphrase: "hearth", rng: seededRng(3),
    });
    const picked = [groups[0]![0]!, groups[0]![1]!, groups[2]![1]!, groups[2]![2]!];
    expect(hex(combineMnemonics(picked, "hearth"))).toBe(hex(secret));
    expect(hex(combineMnemonics([groups[1]![0]!, groups[2]![0]!, groups[2]![2]!], "hearth"))).toBe(hex(secret));
    expect(hex(combineMnemonics(picked, "other"))).not.toBe(hex(secret));
  });

  test("the generator refuses what the reader would refuse", () => {
    const rng = seededRng(4);
    expect(() => generateMnemonics({ groupThreshold: 1, groups: [[1, 1]], masterSecret: secret.subarray(0, 15), rng })).toThrow(Slip39Error);
    expect(() => generateMnemonics({ groupThreshold: 1, groups: [[1, 1]], masterSecret: secret.subarray(0, 17), rng })).toThrow(Slip39Error);
    expect(() => generateMnemonics({ groupThreshold: 2, groups: [[1, 1]], masterSecret: secret, rng })).toThrow(Slip39Error);
    expect(() => generateMnemonics({ groupThreshold: 1, groups: [[1, 3]], masterSecret: secret, rng })).toThrow(Slip39Error);
    expect(() => generateMnemonics({ groupThreshold: 1, groups: [[1, 1]], masterSecret: secret, passphrase: "é", rng })).toThrow(Slip39Error);
  });
});

describe("read-back", () => {
  const sheet = VECTORS[0]!.mnemonics[0]!;

  test("an exact read-back names no mismatch; case and spacing do not count against it", () => {
    expect(readBackMismatch(sheet, sheet)).toBeNull();
    expect(readBackMismatch(sheet, `  ${sheet.toUpperCase().split(" ").join("   ")} `)).toBeNull();
  });

  test("one word wrong names its position; a short read-back names the first missing word", () => {
    const words = sheet.split(" ");
    const typed = [...words];
    typed[7] = "academic";
    expect(readBackMismatch(sheet, typed.join(" "))).toEqual({ position: 8, expected: words[7], typed: "academic" });
    expect(readBackMismatch(sheet, words.slice(0, 10).join(" "))).toEqual({ position: 11, expected: words[10], typed: null });
  });
});
