/**
 * ed25519-door.test — the one door's law, pinned by published vectors.
 *
 * Sources, each quoted byte for byte:
 *   · RFC 8032 §7.1, TEST 1, TEST 2, TEST 3 and TEST SHA(abc): known answers a lawful signer produces;
 *   · "Taming the many EdDSAs" (Chalkias, Garillot, Nikolaenko, SSR 2020), the twelve edge vectors, as
 *     published in `cases.json` of github.com/novifinancial/ed25519-speccheck. The door stands past the
 *     strictest column of that paper's table (cofactorless equation, canonical encodings, small-order A and
 *     R refused) and refuses a mixed-order A besides: of the twelve it verifies none;
 *   · the eight small-order points of edwards25519 (the same paper, §5; libsodium's `ed25519_ref10.c`
 *     blocklist carries the same canonical encodings).
 *
 * Every refusal reads BY NAME. Each lenient acceptance the door closes shows first as a KNOWN POSITIVE under
 * the curve library's default rule, so a vector that refuses for another reason cannot pass for proof.
 */
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { describe, test, expect } from "vitest";
import * as nobleEd from "@noble/ed25519";
import { ed25519 as curveEd } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes } from "../src/crypto.js";
import { acceptEd25519Key, readEd25519, verifyEd25519 } from "../src/ed25519-door.js";

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const MSG = utf8("the door reads one rule");

// The eight small-order points, canonical encodings, with the order of each.
const SMALL_ORDER: ReadonlyArray<readonly [string, number]> = [
  ["0100000000000000000000000000000000000000000000000000000000000000", 1],
  ["ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f", 2],
  ["0000000000000000000000000000000000000000000000000000000000000000", 4],
  ["0000000000000000000000000000000000000000000000000000000000000080", 4],
  ["26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05", 8],
  ["26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85", 8],
  ["c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a", 8],
  ["c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa", 8],
];
const IDENTITY = SMALL_ORDER[0]![0];
// The signature anyone writes for a small-order key: R the identity, S zero.
const NOBODYS_SIGNATURE = `${IDENTITY}${"00".repeat(32)}`;

// RFC 8032 §7.1: [secret, public, message, signature].
const RFC8032: ReadonlyArray<readonly [string, string, string, string]> = [
  ["9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
   "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "",
   "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"],
  ["4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
   "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c", "72",
   "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00"],
  ["c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7",
   "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025", "af82",
   "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a"],
  ["833fe62409237b9d62ec77587520911e9a759cec1d19755b7da901b96dca3d42",
   "ec172b93ad5e563bf4932c70e1245034c35467ef2efd4d64ebf819683467e2bf",
   "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
   "dc2a4459e7369633a52b1bf277839a00201009a3efbf3ecb69bea2186c26b58909351fc9ac90b3ecfdfbc7c66431e0303dca179c138ac17ad9bef1177331a704"],
];

// ed25519-speccheck `cases.json`: [public, message, signature, the name the door answers, lenient verdict].
const TAMING: ReadonlyArray<readonly [string, string, string, "ok" | string, boolean]> = [
  /* 0  small A, small R, S = 0 */
  ["c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa", "8c93255d71dcab10e8f379c26200f3c7bd5f09d9bc3068d3ef4edeb4853022b6",
   "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a0000000000000000000000000000000000000000000000000000000000000000", "key-small-order", true],
  /* 1  small A, mixed R */
  ["c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa", "9bd9f44f4dcc75bd531b56b2cd280b0bb38fc1cd6d1230e14861d861de092e79",
   "f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43a5bb704786be79fc476f91d3f3f89b03984d8068dcf1bb7dfc6637b45450ac04", "key-small-order", true],
  /* 2  mixed A, small R */
  ["f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43", "aebf3f2601a0c8c5d39cc7d8911642f740b78168218da8471772b35f9d35b9ab",
   "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa8c4bd45aecaca5b24fb97bc10ac27ac8751a7dfe1baff8b953ec9f5833ca260e", "key-mixed-order", true],
  /* 3  mixed A, mixed R, both equations hold */
  ["cdb267ce40c5cd45306fa5d2f29731459387dbf9eb933b7bd5aed9a765b88d4d", "9bd9f44f4dcc75bd531b56b2cd280b0bb38fc1cd6d1230e14861d861de092e79",
   "9046a64750444938de19f227bb80485e92b83fdb4b6506c160484c016cc1852f87909e14428a7a1d62e9f22f3d3ad7802db02eb2e688b6c52fcd6648a98bd009", "key-mixed-order", true],
  /* 4  mixed A, mixed R, the cofactored equation alone holds */
  ["cdb267ce40c5cd45306fa5d2f29731459387dbf9eb933b7bd5aed9a765b88d4d", "e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec4011eaccd55b53f56c",
   "160a1cb0dc9c0258cd0a7d23e94d8fa878bcb1925f2c64246b2dee1796bed5125ec6bc982a269b723e0668e540911a9a6a58921d6925e434ab10aa7940551a09", "key-mixed-order", true],
  /* 5  mixed A, order-2L R, the cofactored equation alone holds */
  ["cdb267ce40c5cd45306fa5d2f29731459387dbf9eb933b7bd5aed9a765b88d4d", "e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec4011eaccd55b53f56c",
   "21122a84e0b5fca4052f5b1235c80a537878b38f3142356b2c2384ebad4668b7e40bc836dac0f71076f9abe3a53f9c03c1ceeeddb658d0030494ace586687405", "key-mixed-order", true],
  /* 6  S above the group order */
  ["442aad9f089ad9e14647b1ef9099a1ff4798d78589e66f28eca69c11f582a623", "85e241a07d148b41e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec40",
   "e96f66be976d82e60150baecff9906684aebb1ef181f67a7189ac78ea23b6c0e547f7690a0e2ddcd04d87dbc3490dc19b3b3052f7ff0538cb68afb369ba3a514", "signature-scalar-non-canonical", false],
  /* 7  S far above the group order */
  ["442aad9f089ad9e14647b1ef9099a1ff4798d78589e66f28eca69c11f582a623", "85e241a07d148b41e47d62c63f830dc7a6851a0b1f33ae4bb2f507fb6cffec40",
   "8ce5b96c8f26d0ab6c47958c9e68b937104cd36e13c33566acd2fe8d38aa19427e71f98a473474f2f13f06f97c20d58cc3f54b8bd0d272f42b695dd7e89a8c22", "signature-scalar-non-canonical", false],
  /* 8  R non-canonical (a second encoding of a small-order point) */
  ["f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43", "9bedc267423725d473888631ebf45988bad3db83851ee85c85e241a07d148b41",
   "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff03be9678ac102edcd92b0210bb34d7428d12ffc5df5f37e359941266a4e35f0f", "key-mixed-order", false],
  /* 9  R non-canonical, reduced before hashing */
  ["f7badec5b8abeaf699583992219b7b223f1df3fbbea919844e3f7c554a43dd43", "9bedc267423725d473888631ebf45988bad3db83851ee85c85e241a07d148b41",
   "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffca8c5b64cd208982aa38d4936621a4775aa233aa0505711d8fdcfdaa943d4908", "key-mixed-order", true],
  /* 10 A non-canonical (a second encoding of a small-order point) */
  ["ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "e96b7021eb39c1a163b6da4e3093dcd3f21387da4cc4572be588fafae23c155b",
   "a9d55260f765261eb9b84e106f665e00b867287a761990d7135963ee0a7d59dca5bb704786be79fc476f91d3f3f89b03984d8068dcf1bb7dfc6637b45450ac04", "key-non-canonical", true],
  /* 11 A non-canonical, reduced before hashing */
  ["ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "39a591f5321bbe07fd5a23dc2f39d025d74526615746727ceefd6e82ae65c06f",
   "a9d55260f765261eb9b84e106f665e00b867287a761990d7135963ee0a7d59dca5bb704786be79fc476f91d3f3f89b03984d8068dcf1bb7dfc6637b45450ac04", "key-non-canonical", true],
];

describe("the eight small-order keys", () => {
  test.each(SMALL_ORDER)("%s (order %i) refuses as a key, by name", (key) => {
    expect(curveEd.Point.fromBytes(hexToBytes(key), false).isSmallOrder()).toBe(true);   // the list names what it claims
    expect(acceptEd25519Key(key)).toEqual({ ok: false, refusal: "key-small-order" });
    expect(acceptEd25519Key(hexToBytes(key))).toEqual({ ok: false, refusal: "key-small-order" });
  });

  test.each(SMALL_ORDER)("%s (order %i) signs for nobody", async (key) => {
    // KNOWN POSITIVE: both curve libraries' default rule reads nobody's signature as this key's, on any message.
    expect(curveEd.verify(hexToBytes(NOBODYS_SIGNATURE), MSG, hexToBytes(key))).toBe(true);
    expect(await nobleEd.verifyAsync(hexToBytes(NOBODYS_SIGNATURE), MSG, hexToBytes(key))).toBe(true);
    expect(readEd25519(NOBODYS_SIGNATURE, MSG, key)).toEqual({ ok: false, refusal: "key-small-order" });
    expect(verifyEd25519(hexToBytes(NOBODYS_SIGNATURE), MSG, hexToBytes(key))).toBe(false);
  });

  test("the identity key passes the bare equation: the NAME refuses it, and nothing else does", () => {
    // R + [k]A = identity = [0]B whatever the message, so no equation, cofactored or not, catches it.
    const k = 7n;
    const B = curveEd.Point.BASE, A = curveEd.Point.fromBytes(hexToBytes(IDENTITY), false);
    expect(B.multiplyUnsafe(0n).equals(A.add(A.multiplyUnsafe(k)))).toBe(true);
    expect(readEd25519(NOBODYS_SIGNATURE, MSG, IDENTITY)).toEqual({ ok: false, refusal: "key-small-order" });
  });
});

describe("a second encoding refuses", () => {
  test("a non-canonical key encoding, by name", () => {
    // y = p + 1 names the identity again; y = 1 with the sign bit names it a third time ("negative zero").
    for (const key of [`ee${"ff".repeat(30)}7f`, `01${"00".repeat(30)}80`, `ec${"ff".repeat(31)}`, `ed${"ff".repeat(30)}7f`]) {
      expect(acceptEd25519Key(key), key).toEqual({ ok: false, refusal: "key-non-canonical" });
      expect(readEd25519(NOBODYS_SIGNATURE, MSG, key), key).toEqual({ ok: false, refusal: "key-non-canonical" });
    }
    // KNOWN POSITIVE: the default rule seats `p + 1` as a key and reads nobody's signature under it.
    expect(curveEd.verify(hexToBytes(NOBODYS_SIGNATURE), MSG, hexToBytes(`ee${"ff".repeat(30)}7f`))).toBe(true);
  });

  test("a value that names no point, by name", () => {
    expect(acceptEd25519Key(`02${"00".repeat(31)}`)).toEqual({ ok: false, refusal: "key-off-curve" });
  });

  test("a non-canonical S: the same signature with the group order added", async () => {
    const [secret, pub, , ] = RFC8032[0]!;
    const sig = await nobleEd.signAsync(MSG, hexToBytes(secret));
    expect(readEd25519(sig, MSG, pub)).toEqual({ ok: true });
    const L = curveEd.Point.Fn.ORDER;
    let s = 0n; for (let i = 63; i >= 32; i--) s = (s << 8n) | BigInt(sig[i]!);
    let lifted = s + L;
    const forged = new Uint8Array(sig);
    for (let i = 32; i < 64; i++) { forged[i] = Number(lifted & 0xffn); lifted >>= 8n; }
    expect(lifted).toBe(0n);                                             // S + L still rides 32 bytes
    expect(readEd25519(forged, MSG, pub)).toEqual({ ok: false, refusal: "signature-scalar-non-canonical" });
  });
});

describe("the published edge vectors (Taming the many EdDSAs)", () => {
  test.each(TAMING.map((v, i) => [i, ...v] as const))("vector %i", (_i, pub, message, signature, answer, lenient) => {
    const read = readEd25519(signature, hexToBytes(message), pub);
    expect(read.ok ? "ok" : read.refusal).toBe(answer);
    // The curve library's default rule, pinned beside it: where the two part, the door closed something.
    expect(curveEd.verify(hexToBytes(signature), hexToBytes(message), hexToBytes(pub))).toBe(lenient);
  });

  test("of the twelve, the door verifies NONE; the default rule verifies nine", () => {
    const door = TAMING.map(([pub, m, sig]) => verifyEd25519(sig, hexToBytes(m), pub));
    expect(door.filter(Boolean)).toEqual([]);
    expect(TAMING.filter((v) => v[4]).length).toBe(9);
  });
});

describe("a mixed-order key refuses, at acceptance and at every reading", () => {
  const MIXED = TAMING[3]![0], OTHER_MIXED = TAMING[2]![0];
  test("it names a point outside the small-order set and outside the prime-order subgroup", () => {
    for (const key of [MIXED, OTHER_MIXED]) {
      const point = curveEd.Point.fromBytes(hexToBytes(key), false);
      expect(point.isSmallOrder()).toBe(false);
      expect(point.isTorsionFree()).toBe(false);
      expect(acceptEd25519Key(key)).toEqual({ ok: false, refusal: "key-mixed-order" });
    }
  });
  test("a signature both equations read true under it still refuses, by the key's name", () => {
    // KNOWN POSITIVE: vector 3 satisfies the cofactorless equation too; the library's strict branch reads it true.
    expect(curveEd.verify(hexToBytes(TAMING[3]![2]), hexToBytes(TAMING[3]![1]), hexToBytes(MIXED), { zip215: false })).toBe(true);
    expect(readEd25519(TAMING[3]![2], hexToBytes(TAMING[3]![1]), MIXED)).toEqual({ ok: false, refusal: "key-mixed-order" });
  });
});

describe("a torsion component in R refuses under an ordinary key", () => {
  test("the cofactored equation reads it true, in the lenient branch and the library's strict one; the door reads signature-mismatch", () => {
    const secret = hexToBytes(RFC8032[0]![0]), pub = hexToBytes(RFC8032[0]![1]);
    const L = curveEd.Point.Fn.ORDER, le = (b: Uint8Array): bigint => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]!); return n; };
    const a = curveEd.utils.getExtendedPublicKey(secret).scalar;
    const r = 123456789n;
    const R = curveEd.Point.BASE.multiply(r).add(curveEd.Point.fromBytes(hexToBytes(SMALL_ORDER[6]![0]), false)).toBytes();
    const k = le(sha512(new Uint8Array([...R, ...pub, ...MSG]))) % L;
    let s = (r + k * a) % L;
    const sig = new Uint8Array(64); sig.set(R, 0);
    for (let i = 32; i < 64; i++) { sig[i] = Number(s & 0xffn); s >>= 8n; }
    expect(acceptEd25519Key(pub)).toEqual({ ok: true });
    expect(curveEd.verify(sig, MSG, pub)).toBe(true);
    expect(curveEd.verify(sig, MSG, pub, { zip215: false })).toBe(true);
    expect(readEd25519(sig, MSG, pub)).toEqual({ ok: false, refusal: "signature-mismatch" });
  });
});

describe("RFC 8032 known answers", () => {
  test.each(RFC8032)("secret %s", async (secret, pub, message, signature) => {
    const m = hexToBytes(message);
    expect(hex(await nobleEd.getPublicKeyAsync(hexToBytes(secret)))).toBe(pub);            // the vector, re-derived
    expect(hex(await nobleEd.signAsync(m, hexToBytes(secret)))).toBe(signature);
    expect(acceptEd25519Key(pub)).toEqual({ ok: true });
    expect(readEd25519(signature, m, pub)).toEqual({ ok: true });
    expect(verifyEd25519(hexToBytes(signature), m, hexToBytes(pub))).toBe(true);
    const tampered = new Uint8Array([...m, 0]);
    expect(readEd25519(signature, tampered, pub)).toEqual({ ok: false, refusal: "signature-mismatch" });
  });
});

describe("every producer the house uses signs through the door", () => {
  const SEED = hexToBytes(RFC8032[2]![0]);
  test("@noble/ed25519, sync and async", async () => {
    const pub = await nobleEd.getPublicKeyAsync(SEED);
    expect(verifyEd25519(await nobleEd.signAsync(MSG, SEED), MSG, pub)).toBe(true);
  });
  test("@noble/curves", () => {
    expect(verifyEd25519(curveEd.sign(MSG, SEED), MSG, curveEd.getPublicKey(SEED))).toBe(true);
  });
  test("Node crypto, a generated KeyObject", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pub = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
    const sig = nodeSign(null, MSG, privateKey);
    expect(acceptEd25519Key(new Uint8Array(pub))).toEqual({ ok: true });
    expect(verifyEd25519(new Uint8Array(sig), MSG, new Uint8Array(pub))).toBe(true);
  });
  test("WebCrypto, a NON-EXTRACTABLE key (the browser leaf's custody shape)", async () => {
    const subtle = globalThis.crypto.subtle;
    const pair = await subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]) as CryptoKeyPair;
    expect(pair.privateKey.extractable).toBe(false);
    const pub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
    const sig = new Uint8Array(await subtle.sign({ name: "Ed25519" }, pair.privateKey, new Uint8Array(MSG)));
    expect(acceptEd25519Key(pub)).toEqual({ ok: true });
    expect(verifyEd25519(sig, MSG, pub)).toBe(true);
  });
  test("100 fresh keys and signatures all pass (no honest signature leans on a lenient rule)", { timeout: 60_000 }, () => {
    for (let i = 0; i < 100; i++) {
      const secret = curveEd.utils.randomSecretKey();
      const pub = curveEd.getPublicKey(secret);
      const msg = globalThis.crypto.getRandomValues(new Uint8Array(i));
      expect(acceptEd25519Key(pub).ok).toBe(true);
      expect(verifyEd25519(curveEd.sign(msg, secret), msg, pub)).toBe(true);
    }
  });
});

describe("the door never throws", () => {
  const hostile: unknown[] = [undefined, null, 7, {}, [], "zz".repeat(32), "ab", new Uint8Array(31), new Uint8Array(65),
    new Proxy({}, { get() { throw new Error("read"); } }), "0x" + "ab".repeat(32)];
  test("a hostile key answers key-malformed", () => {
    for (const k of hostile) expect(acceptEd25519Key(k)).toEqual({ ok: false, refusal: "key-malformed" });
  });
  test("a hostile signature or message answers signature-malformed", () => {
    const pub = RFC8032[0]![1];
    for (const s of hostile) expect(readEd25519(s, MSG, pub)).toEqual({ ok: false, refusal: "signature-malformed" });
    for (const m of hostile.filter((v) => !(v instanceof Uint8Array)))
      expect(readEd25519(RFC8032[0]![3], m, pub)).toEqual({ ok: false, refusal: "signature-malformed" });
  });
  test("a typed array behind a Proxy that throws while read answers by name", () => {
    const [, pub, , sig] = RFC8032[0]!;
    const trap = (): never => { throw new Error("read"); };
    const hostileBytes = (length: number): Uint8Array =>
      new Proxy(new Uint8Array(length), { get: (target, key) => (key === Symbol.iterator || key === "length" || typeof key === "string" && /^\d+$/.test(key) ? trap() : Reflect.get(target, key)) });
    expect(hostileBytes(1) instanceof Uint8Array).toBe(true);                       // it passes the type test
    expect(readEd25519(sig, hostileBytes(1), pub)).toEqual({ ok: false, refusal: "signature-malformed" });
    expect(readEd25519(hostileBytes(64), MSG, pub)).toEqual({ ok: false, refusal: "signature-malformed" });
    expect(acceptEd25519Key(hostileBytes(32))).toEqual({ ok: false, refusal: "key-malformed" });
  });
  test("one key, one spelling: upper-case hex names nobody", () => {
    const [, pub, , sig] = RFC8032[0]!;
    expect(verifyEd25519(sig, new Uint8Array(0), pub)).toBe(true);
    expect(acceptEd25519Key(pub.toUpperCase())).toEqual({ ok: false, refusal: "key-malformed" });
    expect(readEd25519(sig, new Uint8Array(0), pub.toUpperCase())).toEqual({ ok: false, refusal: "key-malformed" });
    expect(readEd25519(sig.toUpperCase(), new Uint8Array(0), pub)).toEqual({ ok: false, refusal: "signature-malformed" });
    // `Number.parseInt` forgives a trailing non-hex digit and reads a sign; the door reads neither.
    expect(acceptEd25519Key(`${pub.slice(0, 62)}1g`).ok).toBe(false);
    expect(acceptEd25519Key(`-1${pub.slice(2)}`).ok).toBe(false);
  });
});
