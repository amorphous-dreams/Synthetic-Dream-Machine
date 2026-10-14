/**
 * vessel-kel.test — the floor key's inception names the key, signed under `vessel-kel`, commits no next key and
 * holds no clock and no version: the same seed mints the same bytes.
 *
 * K1 THE INCEPTION COMMITS NO NEXT KEY. It holds `t`, `k` and `sig` alone. Control: it verifies.
 * K2 AN INCEPTION CARRYING A NEXT-KEY COMMITMENT REFUSES. The reader and the check both turn away `n` or `nt`, signed
 *    or not. Control: the inception as minted reads and verifies.
 * K3 ONE SEED MINTS ONE BYTE STRING. No clock enters. Control: two seeds mint two strings.
 * K4 A FOREIGN KEY OR A MOVED SIGNATURE FAILS. Control: the minted inception verifies.
 */
import { describe, test, expect } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJsonBytes, hex } from "../src/crypto.js";
import { VESSEL_KEL_DOMAIN } from "../src/domains.js";
import { inceptVesselKel, verifyVesselKelInception, decodeVesselKelInception, type VesselKelInception } from "../src/vessel-kel.js";

const seed = (b: number): Uint8Array => new Uint8Array(32).fill(b);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** A record carrying `extra` beside the inception's fields, signed by the current key over every field it holds. */
function signedWith(s: Uint8Array, extra: Record<string, unknown>): Record<string, unknown> {
  const core = { t: "icp", k: [hex(ed25519.getPublicKey(s))], ...extra };
  return { ...core, sig: hex(ed25519.sign(canonicalJsonBytes({ domain: VESSEL_KEL_DOMAIN, ...core }), s)) };
}

describe("the floor key's inception", () => {
  test("K1 RED: the inception holds t, k and sig alone: no next key, no threshold, no date, no version", () => {
    const { bytes, inception } = inceptVesselKel(seed(1));
    expect(Object.keys(JSON.parse(text(bytes))).sort()).toEqual(["k", "sig", "t"]);
    expect(text(bytes)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(text(bytes)).not.toMatch(/\/v\d/);
    expect(inception.t).toBe("icp");
    expect(inception.k).toEqual([hex(ed25519.getPublicKey(seed(1)))]);
    expect(verifyVesselKelInception(inception)).toBe(true);                              // control
  });

  test("K2 RED: an inception that carries `n` or `nt` refuses at the reader and at the check, signed or not", () => {
    const { bytes, inception } = inceptVesselKel(seed(1));
    expect(decodeVesselKelInception(bytes)).toEqual(inception);                           // control
    const digest = hex(new Uint8Array(32).fill(7));
    for (const extra of [{ n: [digest] }, { nt: "1" }, { nt: "1", n: [digest] }, { n: [] }]) {
      const signed = signedWith(seed(1), extra);
      const encoded = new TextEncoder().encode(JSON.stringify(signed));
      expect(text(encoded), "the probe moved the decoded fields").toMatch(/"nt?"/);
      expect(decodeVesselKelInception(encoded), JSON.stringify(extra)).toBeNull();
      expect(verifyVesselKelInception(signed as unknown as VesselKelInception), JSON.stringify(extra)).toBe(false);
      const unsigned = { ...inception, ...extra } as unknown as VesselKelInception;
      expect(verifyVesselKelInception(unsigned), `unsigned ${JSON.stringify(extra)}`).toBe(false);
    }
  });

  test("K3: one seed mints one byte string, and another seed another", () => {
    const a = inceptVesselKel(seed(1));
    const b = inceptVesselKel(seed(1));
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
    expect(Buffer.from(inceptVesselKel(seed(2)).bytes).equals(Buffer.from(a.bytes))).toBe(false);   // control
  });

  test("K4: a foreign key, a moved signature or a torn or reshaped record fails", () => {
    const { bytes, inception } = inceptVesselKel(seed(1));
    expect(verifyVesselKelInception(inception)).toBe(true);                              // control
    const foreign = inceptVesselKel(seed(4)).inception;
    expect(verifyVesselKelInception({ ...inception, k: foreign.k })).toBe(false);
    expect(verifyVesselKelInception({ ...inception, sig: foreign.sig })).toBe(false);
    expect(verifyVesselKelInception({ ...inception, k: [...inception.k, ...foreign.k] })).toBe(false);
    expect(decodeVesselKelInception(bytes.subarray(0, bytes.length - 3))).toBeNull();
    const dated = new TextEncoder().encode(JSON.stringify({ ...inception, createdAt: "2026-01-01T00:00:00Z" }));
    expect(decodeVesselKelInception(dated)).toBeNull();
  });

  test("the seed must ride 32 bytes", () => {
    expect(() => inceptVesselKel(new Uint8Array(31))).toThrow(/32 bytes/);
  });
});
