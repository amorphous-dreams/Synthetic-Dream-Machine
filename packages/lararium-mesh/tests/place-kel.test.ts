import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import { canonicalJsonBytes, hex } from "../src/crypto.js";
import { VESSEL_KEL_DOMAIN } from "../src/domains.js";
import { decodePlaceKelEvent, mintPlaceInception, mintPlaceRotation, placeNextDigest, verifyPlaceKel } from "../src/vessel-kel.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const key = (n: number) => hex(ed25519.getPublicKey(seed(n)));
const refusal = (events: unknown[]) => { const result = verifyPlaceKel(events as never); return result.ok ? null : result.refusal; };

describe("place KEL", () => {
  it("reads an armed inception and two cold rotations under one AID", () => {
    const first = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
    const one = mintPlaceRotation({ chain: [first.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(4) });
    const two = mintPlaceRotation({ chain: [first.event, one], coldSeed: seed(4), newSignerKey: key(5), nextColdVerifyingKey: key(6) });
    expect(decodePlaceKelEvent(first.bytes)).toEqual(first.event);
    const read = verifyPlaceKel([first.event, one, two]);
    expect(read.ok).toBe(true);
    if (read.ok) { expect(read.aid).toBe(first.aid); expect(read.seq).toBe(2); expect(read.signerKey).toBe(key(5)); }
  });

  it("refuses an unarmed inception and a one-key inception, while the armed control verifies", () => {
    const first = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
    expect(verifyPlaceKel([first.event]).ok).toBe(true);
    expect(refusal([{ kind: VESSEL_KEL_DOMAIN, t: "icp", seq: 0, key: key(1), sig: first.event.sig }])).toBe("unarmed-inception");
  });

  it("refuses wrong card, reused commitment and reused signer", () => {
    const first = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
    expect(() => mintPlaceRotation({ chain: [first.event], coldSeed: seed(7), newSignerKey: key(3), nextColdVerifyingKey: key(4) })).toThrow();
    expect(() => mintPlaceRotation({ chain: [first.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(2) })).toThrow();
    expect(() => mintPlaceRotation({ chain: [first.event], coldSeed: seed(2), newSignerKey: key(1), nextColdVerifyingKey: key(4) })).toThrow();
    const one = mintPlaceRotation({ chain: [first.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(4) });
    const wrong = { ...one, reveal: key(7) };
    const wrongCore = { kind: wrong.kind, t: wrong.t, aid: wrong.aid, seq: wrong.seq, prev: wrong.prev,
      reveal: wrong.reveal, key: wrong.key, next: wrong.next };
    const wrongSigned = { ...wrongCore, sig: hex(ed25519.sign(canonicalJsonBytes(wrongCore), seed(7))) };
    expect(refusal([first.event, wrongSigned])).toBe("wrong-reveal");
    expect(refusal([first.event, { ...one, sig: hex(ed25519.sign(canonicalJsonBytes({ kind: one.kind, t: one.t,
      aid: one.aid, seq: one.seq, prev: one.prev, reveal: one.reveal, key: one.key, next: one.next }), seed(7))) }])).toBe("bad-signature");
    expect(() => mintPlaceRotation({ chain: [first.event, one], coldSeed: seed(4), newSignerKey: key(1), nextColdVerifyingKey: key(6) })).toThrow();
  });

  it("refuses mismatched signatures and torn or extra fields", () => {
    const first = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
    expect(refusal([{ ...first.event, sig: hex(ed25519.sign(canonicalJsonBytes({ kind: VESSEL_KEL_DOMAIN, t: "icp", seq: 0, key: key(1), next: placeNextDigest(key(2)) }), seed(3))) }])).toBe("bad-signature");
    expect(decodePlaceKelEvent(first.bytes.subarray(0, first.bytes.length - 1))).toBeNull();
    expect(decodePlaceKelEvent({ ...first.event, clock: 1 })).toBeNull();
    expect(refusal([{ ...first.event, clock: 1 }])).toBe("malformed");
  });
});
