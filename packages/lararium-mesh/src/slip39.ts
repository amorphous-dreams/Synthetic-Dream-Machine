/**
 * slip39 — SatoshiLabs SLIP-0039 (Shamir's Secret-Sharing for Mnemonic Codes), the paper pin's encoding.
 *
 * A paper pin holds a secret on a sheet a human can read back word by word. SLIP-39 gives that sheet a
 * published shape: 10-bit words from a 1024-word list, a header naming the sharing (identifier, iteration
 * exponent, group and member thresholds), and an RS1024 checksum over every word, so a mis-copied word reads as
 * a checksum failure rather than as a different secret. Any SLIP-39 reader recovers a sheet this house prints,
 * and the published vectors pin this reader to the others (`tests/slip39.test.ts`).
 *
 * ONE FIELD. The sharing runs over GF(256) with reduction polynomial 0x11b, the field `shamir-gf256` already
 * holds, so this module adds no second Shamir: it interpolates through `interpolateAt` (SLIP-39 keeps the
 * shared secret at x=255 and its digest at x=254) and carries only what SLIP-39 adds on top — the wordlist, the
 * checksum, the digest share, the two-level group sharing and the Feistel encryption of the master secret.
 *
 * WHAT A SHEET PROVES, AND WHAT IT DOES NOT. The digest share catches a wrong combination of shares; the
 * checksum catches a mis-copied word. A wrong passphrase decrypts to a DIFFERENT secret and reads as no error
 * at all — SLIP-39 makes every passphrase plausible on purpose. A caller that must know it holds the right
 * secret checks that separately (the keyslot's AEAD open does).
 *
 * Pure and browser-shippable: `@noble/hashes` for PBKDF2 and HMAC, the injected `RandomProvider` for
 * randomness, no `node:` import.
 *
 * Spec: https://github.com/satoshilabs/slips/blob/master/slip-0039.md
 */

import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { RandomProvider } from "./crypto.js";
import { interpolateAt, type ShareBytes } from "./shamir-gf256.js";
import { SLIP39_WORDS } from "./slip39-wordlist.js";

/** A refusal from the SLIP-39 reader or generator: a malformed sheet, a mismatched set, or a bad parameter. */
export class Slip39Error extends Error {
  constructor(message: string) { super(`slip39: ${message}`); this.name = "Slip39Error"; }
}

const RADIX_BITS = 10;
const ID_LENGTH_BITS = 15;
const EXTENDABLE_FLAG_LENGTH_BITS = 1;
const ITERATION_EXP_LENGTH_BITS = 4;
const ID_EXP_LENGTH_WORDS = 2;                       // 15 + 1 + 4 bits
const CHECKSUM_LENGTH_WORDS = 3;
const METADATA_LENGTH_WORDS = ID_EXP_LENGTH_WORDS + 2 + CHECKSUM_LENGTH_WORDS;
const MIN_STRENGTH_BITS = 128;
const MIN_MNEMONIC_LENGTH_WORDS = METADATA_LENGTH_WORDS + Math.ceil(MIN_STRENGTH_BITS / RADIX_BITS);
const MAX_SHARE_COUNT = 16;
const DIGEST_LENGTH_BYTES = 4;
const SECRET_INDEX = 255;
const DIGEST_INDEX = 254;
const ROUND_COUNT = 4;
const BASE_ITERATION_COUNT = 10000;
const CUSTOMIZATION_ORIG = "shamir";
const CUSTOMIZATION_EXTENDABLE = "shamir_extendable";

const WORD_INDEX: ReadonlyMap<string, number> = new Map(SLIP39_WORDS.map((w, i) => [w, i]));

/** One decoded sheet: the sharing it belongs to, its place in that sharing, and its share value. */
export interface Slip39Share {
  /** The 15-bit identifier every sheet of one master secret shares. */
  readonly identifier:        number;
  /** The extendable-backup flag: the identifier stays out of the encryption salt, so a new sharing of the same
   *  encrypted secret recovers under the same passphrase. */
  readonly extendable:        boolean;
  /** PBKDF2 runs (10000 << e) iterations across the four Feistel rounds. */
  readonly iterationExponent: number;
  readonly groupIndex:        number;
  readonly groupThreshold:    number;
  readonly groupCount:        number;
  readonly memberIndex:       number;
  readonly memberThreshold:   number;
  readonly value:             Uint8Array;
}

// ── the RS1024 checksum ────────────────────────────────────────────────────────────────────────────

const GEN = [0xe0e040, 0x1c1c080, 0x3838100, 0x7070200, 0xe0e0009, 0x1c0c2412, 0x38086c24, 0x3090fc48, 0x21b1f890, 0x3f3f120];

function polymod(values: readonly number[]): number {
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 20;
    chk = (((chk & 0xfffff) << 10) ^ v) >>> 0;
    for (let i = 0; i < 10; i++) if (((b >>> i) & 1) !== 0) chk = (chk ^ GEN[i]!) >>> 0;
  }
  return chk;
}

const customization = (extendable: boolean): number[] =>
  Array.from(extendable ? CUSTOMIZATION_EXTENDABLE : CUSTOMIZATION_ORIG, (c) => c.charCodeAt(0));

function createChecksum(data: readonly number[], extendable: boolean): number[] {
  const pm = polymod([...customization(extendable), ...data, 0, 0, 0]) ^ 1;
  return [2, 1, 0].map((i) => (pm >>> (10 * i)) & 1023);
}

const verifyChecksum = (data: readonly number[], extendable: boolean): boolean =>
  polymod([...customization(extendable), ...data]) === 1;

// ── integer ↔ word-index helpers (bigint: a 256-bit value overflows a double) ────────────────────────

function intToIndices(value: bigint, length: number, bits: number): number[] {
  const mask = (1n << BigInt(bits)) - 1n;
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i--) out.push(Number((value >> BigInt(i * bits)) & mask));
  return out;
}

function intFromIndices(indices: readonly number[]): bigint {
  let v = 0n;
  for (const i of indices) v = (v << BigInt(RADIX_BITS)) | BigInt(i);
  return v;
}

function bytesToInt(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

function intToBytes(value: bigint, length: number): Uint8Array | null {
  if (value >> BigInt(8 * length) !== 0n) return null;            // the value overflows the width: bad padding
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) { out[i] = Number(value & 0xffn); value >>= 8n; }
  return out;
}

const wordsOf = (mnemonic: string): string[] => mnemonic.trim().split(/\s+/).filter((w) => w !== "").map((w) => w.toLowerCase());

// ── the share codec ────────────────────────────────────────────────────────────────────────────────

/** Read one sheet. Refuses an unknown word, a short sheet, bad padding, a failed checksum, or a group threshold
 *  above the group count. */
export function decodeShare(mnemonic: string): Slip39Share {
  const words = wordsOf(mnemonic);
  const data = words.map((w) => {
    const i = WORD_INDEX.get(w);
    if (i === undefined) throw new Slip39Error(`invalid mnemonic word "${w}"`);
    return i;
  });
  if (data.length < MIN_MNEMONIC_LENGTH_WORDS) {
    throw new Slip39Error(`a mnemonic holds at least ${MIN_MNEMONIC_LENGTH_WORDS} words; this one holds ${data.length}`);
  }
  const paddingLen = (RADIX_BITS * (data.length - METADATA_LENGTH_WORDS)) % 16;
  if (paddingLen > 8) throw new Slip39Error("invalid mnemonic length");

  const idExp = Number(intFromIndices(data.slice(0, ID_EXP_LENGTH_WORDS)));
  const identifier = idExp >>> (EXTENDABLE_FLAG_LENGTH_BITS + ITERATION_EXP_LENGTH_BITS);
  const extendable = ((idExp >>> ITERATION_EXP_LENGTH_BITS) & 1) === 1;
  const iterationExponent = idExp & ((1 << ITERATION_EXP_LENGTH_BITS) - 1);

  const prefix = words.slice(0, ID_EXP_LENGTH_WORDS + 2).join(" ");
  if (!verifyChecksum(data, extendable)) throw new Slip39Error(`invalid mnemonic checksum for "${prefix} ..."`);

  const params = intToIndices(intFromIndices(data.slice(ID_EXP_LENGTH_WORDS, ID_EXP_LENGTH_WORDS + 2)), 5, 4);
  const [groupIndex, groupThresholdM1, groupCountM1, memberIndex, memberThresholdM1] = params as [number, number, number, number, number];
  if (groupCountM1 < groupThresholdM1) {
    throw new Slip39Error(`invalid mnemonic "${prefix} ...": the group threshold exceeds the group count`);
  }

  const valueData = data.slice(ID_EXP_LENGTH_WORDS + 2, data.length - CHECKSUM_LENGTH_WORDS);
  const valueByteCount = Math.ceil((RADIX_BITS * valueData.length - paddingLen) / 8);
  const value = intToBytes(intFromIndices(valueData), valueByteCount);
  if (value === null) throw new Slip39Error(`invalid mnemonic padding for "${prefix} ..."`);

  return {
    identifier, extendable, iterationExponent,
    groupIndex, groupThreshold: groupThresholdM1 + 1, groupCount: groupCountM1 + 1,
    memberIndex, memberThreshold: memberThresholdM1 + 1, value,
  };
}

/** Write one sheet: header, padded value, checksum, as space-joined words. */
export function encodeShare(share: Slip39Share): string {
  const idExp = (BigInt(share.identifier) << BigInt(EXTENDABLE_FLAG_LENGTH_BITS + ITERATION_EXP_LENGTH_BITS))
    | (BigInt(share.extendable ? 1 : 0) << BigInt(ITERATION_EXP_LENGTH_BITS))
    | BigInt(share.iterationExponent);
  let params = BigInt(share.groupIndex);
  for (const p of [share.groupThreshold - 1, share.groupCount - 1, share.memberIndex, share.memberThreshold - 1]) {
    params = (params << 4n) | BigInt(p);
  }
  const valueWords = Math.ceil((share.value.length * 8) / RADIX_BITS);
  const data = [
    ...intToIndices(idExp, ID_EXP_LENGTH_WORDS, RADIX_BITS),
    ...intToIndices(params, 2, RADIX_BITS),
    ...intToIndices(bytesToInt(share.value), valueWords, RADIX_BITS),
  ];
  return [...data, ...createChecksum(data, share.extendable)].map((i) => SLIP39_WORDS[i]!).join(" ");
}

// ── the sharing ───────────────────────────────────────────────────────────────────────────────────

const createDigest = (randomData: Uint8Array, sharedSecret: Uint8Array): Uint8Array =>
  hmac(sha256, randomData, sharedSecret).subarray(0, DIGEST_LENGTH_BYTES);

function randomBytes(rng: RandomProvider, n: number): Uint8Array {
  const out = new Uint8Array(n);
  if (n > 0) rng.getRandomValues(out);
  return out;
}

function splitRaw(threshold: number, count: number, secret: Uint8Array, rng: RandomProvider): ShareBytes[] {
  if (!Number.isInteger(threshold) || threshold < 1) throw new Slip39Error("a threshold must be a positive integer");
  if (threshold > count) throw new Slip39Error("a threshold must not exceed its share count");
  if (count > MAX_SHARE_COUNT) throw new Slip39Error(`a share count must not exceed ${MAX_SHARE_COUNT}`);
  if (threshold === 1) return Array.from({ length: count }, (_, x) => ({ x, ys: Uint8Array.from(secret) }));

  const randomShareCount = threshold - 2;
  const shares: ShareBytes[] = Array.from({ length: randomShareCount }, (_, x) => ({ x, ys: randomBytes(rng, secret.length) }));
  const randomPart = randomBytes(rng, secret.length - DIGEST_LENGTH_BYTES);
  const digestShare = new Uint8Array(secret.length);
  digestShare.set(createDigest(randomPart, secret), 0);
  digestShare.set(randomPart, DIGEST_LENGTH_BYTES);
  const base: ShareBytes[] = [...shares, { x: DIGEST_INDEX, ys: digestShare }, { x: SECRET_INDEX, ys: secret }];
  for (let x = randomShareCount; x < count; x++) shares.push({ x, ys: interpolateAt(base, x) });
  return shares;
}

function recoverRaw(threshold: number, shares: readonly ShareBytes[]): Uint8Array {
  if (threshold === 1) return Uint8Array.from(shares[0]!.ys);
  let secret: Uint8Array, digestShare: Uint8Array;
  try {
    secret = interpolateAt(shares, SECRET_INDEX);
    digestShare = interpolateAt(shares, DIGEST_INDEX);
  } catch (err) {
    throw new Slip39Error(`invalid set of shares: ${(err as Error).message}`);
  }
  const expected = createDigest(digestShare.subarray(DIGEST_LENGTH_BYTES), secret);
  for (let i = 0; i < DIGEST_LENGTH_BYTES; i++) {
    if (expected[i] !== digestShare[i]) throw new Slip39Error("invalid digest of the shared secret");
  }
  return secret;
}

// ── the Feistel encryption of the master secret ──────────────────────────────────────────────────

function feistel(input: Uint8Array, passphrase: string, e: number, identifier: number, extendable: boolean, decrypt: boolean): Uint8Array {
  if (input.length % 2 !== 0) throw new Slip39Error("the master secret's length in bytes must be even");
  const half = input.length / 2;
  let l = input.slice(0, half);
  let r = input.slice(half);
  const salt = extendable ? new Uint8Array(0) : Uint8Array.from([...customization(false), identifier >>> 8, identifier & 0xff]);
  const pass = Uint8Array.from(passphrase, (c) => c.charCodeAt(0));
  const rounds = decrypt ? [3, 2, 1, 0] : [0, 1, 2, 3];
  for (const i of rounds) {
    const key = Uint8Array.from([i, ...pass]);
    const s = new Uint8Array(salt.length + r.length);
    s.set(salt, 0);
    s.set(r, salt.length);
    const f = pbkdf2(sha256, key, s, { c: Math.floor((BASE_ITERATION_COUNT << e) / ROUND_COUNT), dkLen: r.length });
    const next = l.map((b, j) => b ^ f[j]!);
    l = r;
    r = next;
  }
  const out = new Uint8Array(input.length);
  out.set(r, 0);
  out.set(l, half);
  return out;
}

function checkPassphrase(passphrase: string): void {
  for (let i = 0; i < passphrase.length; i++) {
    const c = passphrase.charCodeAt(i);
    if (c < 32 || c > 126) throw new Slip39Error("a passphrase holds only printable ASCII (code points 32-126)");
  }
}

// ── the user-facing pair ──────────────────────────────────────────────────────────────────────────

/**
 * Split `masterSecret` into sheets: `groupThreshold` of the `groups` must each reach their own member threshold.
 * `groups` lists `[memberThreshold, memberCount]` per group. Returns one array of sheets per group.
 */
export function generateMnemonics(args: {
  readonly groupThreshold:     number;
  readonly groups:             readonly (readonly [number, number])[];
  readonly masterSecret:       Uint8Array;
  readonly passphrase?:        string;
  readonly extendable?:        boolean;
  readonly iterationExponent?: number;
  readonly rng:                RandomProvider;
}): string[][] {
  const passphrase = args.passphrase ?? "";
  const extendable = args.extendable ?? true;
  const e = args.iterationExponent ?? 1;
  checkPassphrase(passphrase);
  if (!Number.isInteger(e) || e < 0 || e > 15) throw new Slip39Error("the iteration exponent must be an integer in 0..15");
  if (args.masterSecret.length * 8 < MIN_STRENGTH_BITS) throw new Slip39Error(`the master secret holds at least ${MIN_STRENGTH_BITS / 8} bytes`);
  if (args.masterSecret.length % 2 !== 0) throw new Slip39Error("the master secret's length in bytes must be even");
  if (args.groupThreshold > args.groups.length) throw new Slip39Error("the group threshold must not exceed the number of groups");
  if (args.groups.some(([t, n]) => t === 1 && n > 1)) {
    throw new Slip39Error("several member shares at member threshold 1 copy one secret; use 1-of-1 instead");
  }

  const idBytes = randomBytes(args.rng, 2);
  const identifier = ((idBytes[0]! << 8) | idBytes[1]!) & ((1 << ID_LENGTH_BITS) - 1);
  const ems = feistel(args.masterSecret, passphrase, e, identifier, extendable, false);
  const groupShares = splitRaw(args.groupThreshold, args.groups.length, ems, args.rng);

  return args.groups.map(([memberThreshold, memberCount], g) =>
    splitRaw(memberThreshold, memberCount, groupShares[g]!.ys, args.rng).map((member) => encodeShare({
      identifier, extendable, iterationExponent: e,
      groupIndex: groupShares[g]!.x, groupThreshold: args.groupThreshold, groupCount: args.groups.length,
      memberIndex: member.x, memberThreshold, value: member.ys,
    })));
}

/**
 * Recover the master secret from sheets. Refuses a set that mixes sharings, a group with the wrong number of
 * sheets, too few groups, duplicate member indices, or a digest that does not hold. A wrong `passphrase`
 * recovers a different secret without error (see the module note).
 */
export function combineMnemonics(mnemonics: readonly string[], passphrase = ""): Uint8Array {
  if (mnemonics.length === 0) throw new Slip39Error("the list of mnemonics is empty");
  checkPassphrase(passphrase);
  const shares = mnemonics.map(decodeShare);
  const first = shares[0]!;
  const common = (s: Slip39Share): string => [s.identifier, s.extendable, s.iterationExponent, s.groupThreshold, s.groupCount].join("|");
  if (shares.some((s) => common(s) !== common(first))) {
    throw new Slip39Error("all mnemonics must begin with the same two words and carry the same group threshold and group count");
  }

  const groups = new Map<number, Slip39Share[]>();
  for (const s of shares) {
    const group = groups.get(s.groupIndex) ?? [];
    if (group.length > 0 && group[0]!.memberThreshold !== s.memberThreshold) {
      throw new Slip39Error("all shares in a group must carry the same member threshold");
    }
    // One sheet counted twice is still one sheet: the reference reads its input as a set.
    if (!group.some((g) => g.memberIndex === s.memberIndex && bytesEqual(g.value, s.value))) group.push(s);
    groups.set(s.groupIndex, group);
  }

  if (groups.size < first.groupThreshold) {
    throw new Slip39Error(`insufficient groups: ${first.groupThreshold} are required, ${groups.size} were provided`);
  }
  if (groups.size !== first.groupThreshold) {
    throw new Slip39Error(`wrong number of groups: expected ${first.groupThreshold}, ${groups.size} were provided`);
  }
  const groupSecrets: ShareBytes[] = [];
  for (const [groupIndex, members] of groups) {
    const t = members[0]!.memberThreshold;
    if (members.length !== t) throw new Slip39Error(`wrong number of mnemonics in group ${groupIndex}: expected ${t}, ${members.length} were provided`);
    groupSecrets.push({ x: groupIndex, ys: recoverRaw(t, members.map((m) => ({ x: m.memberIndex, ys: m.value }))) });
  }
  const ems = recoverRaw(first.groupThreshold, groupSecrets);
  return feistel(ems, passphrase, first.iterationExponent, first.identifier, first.extendable, true);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Where a read-back first departs from its sheet: a 1-based word position, the sheet's word there, and the typed
 *  word (null when the read-back ended early). Case and spacing never count as a departure. */
export interface ReadBackMismatch {
  readonly position: number;
  readonly expected: string | null;
  readonly typed:    string | null;
}

/** Compare a typed read-back against its sheet word by word. `null` means the human holds what was printed. */
export function readBackMismatch(sheet: string, typed: string): ReadBackMismatch | null {
  const want = wordsOf(sheet);
  const got = wordsOf(typed);
  const n = Math.max(want.length, got.length);
  for (let i = 0; i < n; i++) {
    if (want[i] !== got[i]) return { position: i + 1, expected: want[i] ?? null, typed: got[i] ?? null };
  }
  return null;
}
