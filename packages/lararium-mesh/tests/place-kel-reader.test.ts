import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import { hex } from "../src/crypto.js";
import { acceptPlaceHead, foldPlaceKel, mintPlaceInception, mintPlaceRotation } from "../src/vessel-kel.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const key = (n: number) => hex(ed25519.getPublicKey(seed(n)));
const fixture = () => {
  const start = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
  const one = mintPlaceRotation({ chain: [start.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(4) });
  const two = mintPlaceRotation({ chain: [start.event, one], coldSeed: seed(4), newSignerKey: key(5), nextColdVerifyingKey: key(6) });
  return { start, one, two, pin: { aid: start.aid } };
};
const refusal = (value: ReturnType<typeof foldPlaceKel>) => value.ok ? null : value.refusal;

describe("place KEL reader", () => {
  it("descends through shuffled duplicates and catches a seq 0 herm up to seq 2", () => {
    const f = fixture();
    const held = foldPlaceKel([f.start.event], f.pin);
    const read = foldPlaceKel([f.two, f.start.event, f.one, f.one], f.pin);
    expect(read.ok).toBe(true);
    expect(held.ok).toBe(true);
    if (held.ok && read.ok) {
      expect(acceptPlaceHead(null, held).ok).toBe(true);
      const accepted = acceptPlaceHead({ aid: held.aid, seq: held.seq, headDigest: held.headDigest }, read);
      expect(accepted.ok).toBe(true);
      if (accepted.ok) expect(accepted.seq).toBe(2);
      expect(acceptPlaceHead({ aid: held.aid, seq: held.seq, headDigest: held.headDigest }, held).ok).toBe(true);
    }
  });
  it("names a missing sequence and refuses rollback", () => {
    const f = fixture();
    expect(refusal(foldPlaceKel([f.start.event, f.two], f.pin))).toBe("gap");
    const held = foldPlaceKel([f.start.event, f.one], f.pin);
    const old = foldPlaceKel([f.start.event], f.pin);
    if (held.ok && old.ok) expect(refusal(acceptPlaceHead({ aid: held.aid, seq: held.seq, headDigest: held.headDigest }, old))).toBe("rollback");
  });
  it("surfaces both verifying fork successors and refuses a forged aid row", () => {
    const f = fixture();
    const other = mintPlaceRotation({ chain: [f.start.event], coldSeed: seed(2), newSignerKey: key(8), nextColdVerifyingKey: key(9) });
    const fork = foldPlaceKel([f.start.event, f.one, other], f.pin);
    expect(refusal(fork)).toBe("fork");
    if (!fork.ok && fork.refusal === "fork") expect(fork.forks).toHaveLength(2);
    const forged = foldPlaceKel([f.start.event, { ...f.one, sig: "00".repeat(64) }], f.pin);
    expect(forged.ok && forged.seq).toBe(0);   // a forged row never advances the head
  });
  it("a row signed by a stranger's key never blocks the lawful head, and a gap hands back the verified prefix", () => {
    const f = fixture();
    const stranger = { ...f.one, reveal: key(9), next: key(9), sig: f.one.sig };   // fails its own signature: dropped as noise
    const lawful = foldPlaceKel([f.start.event, stranger, f.one], f.pin);
    expect(lawful.ok && lawful.seq).toBe(1);
    const gapped = foldPlaceKel([f.start.event, f.two], f.pin);
    expect(gapped.ok).toBe(false);
    if (!gapped.ok) expect(gapped.verified?.seq).toBe(0);
  });
});
