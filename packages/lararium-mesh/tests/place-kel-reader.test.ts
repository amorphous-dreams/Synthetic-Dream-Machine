import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import { hex } from "../src/crypto.js";
import { acceptPlaceHead, foldPlaceKel, mintPlaceInception, mintPlaceRotation, PLACE_KEL_FORK_EVIDENCE, PLACE_KEL_ROWS_PER_AID, type PlaceKelEvent } from "../src/vessel-kel.js";

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

  const wide = (n: number) => { const b = new Uint8Array(32); new DataView(b.buffer).setUint32(0, n + 1000); return b; };
  const wideKey = (n: number) => hex(ed25519.getPublicKey(wide(n)));
  /** A lawful chain of `rotations` rotations: cold seed n reveals at rotation n, signer n+1_000_000 signs the floor. */
  const lawful = (rotations: number) => {
    const start = mintPlaceInception({ signerSeed: wide(0), coldVerifyingKey: wideKey(1) });
    const chain: PlaceKelEvent[] = [start.event];
    for (let n = 1; n <= rotations; n++) {
      chain.push(mintPlaceRotation({ chain, coldSeed: wide(n), newSignerKey: wideKey(500_000 + n), nextColdVerifyingKey: wideKey(n + 1) }));
    }
    return { start, chain };
  };
  it("a lawful chain at the ceiling folds; a board past it refuses in bounded work", () => {
    const at = lawful(PLACE_KEL_ROWS_PER_AID - 1);
    const read = foldPlaceKel(at.chain, { aid: at.start.aid });
    expect(read.ok && read.seq).toBe(PLACE_KEL_ROWS_PER_AID - 1);
    const past = lawful(PLACE_KEL_ROWS_PER_AID + 1);   // one rotation past the ceiling
    expect(refusal(foldPlaceKel(past.chain, { aid: past.start.aid }))).toBe("too-many-rows");
  }, 240_000);
  it("a key-holder fork flood reads the fork with bounded evidence, and unsigned or foreign rows never reach a digest walk", () => {
    const f = fixture();
    const flood = Array.from({ length: 20 }, (_, i) =>
      mintPlaceRotation({ chain: [f.start.event], coldSeed: seed(2), newSignerKey: wideKey(700_000 + i), nextColdVerifyingKey: wideKey(800_000 + i) }));
    const read = foldPlaceKel([f.start.event, ...flood], f.pin);
    expect(refusal(read)).toBe("fork");
    if (!read.ok) expect(read.forks).toHaveLength(PLACE_KEL_FORK_EVIDENCE);
    const unsigned = Array.from({ length: 20 }, (_, i) => ({ ...f.one, sig: "00".repeat(64), next: wideKey(900_000 + i) }));
    const foreign = Array.from({ length: 5000 }, (_, i) => ({ ...f.one, aid: wideKey(i + 1) }));
    const noisy = foldPlaceKel([f.start.event, f.one, ...unsigned.slice(0, 20), ...foreign], f.pin);
    expect(noisy.ok && noisy.seq).toBe(1);   // CONTROL: noise under the ceiling reads the lawful head
  }, 120_000);
});
