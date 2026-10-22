/**
 * chartered-classes.test.ts — the four chartered classes read off one charter epoch's seats.
 *
 * Pinned:
 *   · the threshold table at n = 1, 2, 3, 4, 5 (two seats never sign a Kahu act alone; 3-of-5 and 2-of-3
 *     for high-impact; emergency 2 with a review owed),
 *   · a roster that seats nobody, holds a threshold outside 1..n, or carries a malformed key answers null,
 *   · revocation takes the threshold of the act it revokes, and revoking a revocation answers null,
 *   · charter, admission and trust-root need high-impact; every other surface needs ordinary,
 *   · emergency covers emergency alone; high-impact covers ordinary,
 *   · a signature counts only from a DISTINCT SEATED key over the EXACT bytes: an active persona's key, a
 *     repeat, a malformed sig and a signature over other bytes each count nothing (the nonsense control).
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, utf8Bytes } from "../src/crypto.js";
import {
  charteredClassTable, classThreshold, requiredClassFor, classCovers, countSeatedSignatures,
  HIGH_IMPACT_SURFACES, type CharteredClassTable,
} from "../src/chartered-classes.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";

const EPOCH = "epoch-cid-charter-1";
const seed  = (n: number) => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const sigOf = (s: Uint8Array, bytes: Uint8Array) => ed.signAsync(bytes, s).then(hex);

async function rosterOf(n: number, threshold: number): Promise<KahuQuorumSeats> {
  const keys = await Promise.all(Array.from({ length: n }, (_, i) => pubOf(seed(i + 1))));
  return { keys, threshold, sealEpochCid: EPOCH };
}

const row = (t: CharteredClassTable) => [t.ordinary.threshold, t.highImpact.threshold, t.emergency.threshold];

describe("the threshold table derives from the epoch's seats", () => {
  test("n=1: every class reads 1", async () => {
    const t = charteredClassTable(await rosterOf(1, 1))!;
    expect(t.seats).toBe(1);
    expect(row(t)).toEqual([1, 1, 1]);
  });

  test("n=2: every class reads 2 — no seat signs any Kahu act alone", async () => {
    expect(row(charteredClassTable(await rosterOf(2, 2))!)).toEqual([2, 2, 2]);
    expect(row(charteredClassTable(await rosterOf(2, 1))!)).toEqual([2, 2, 2]);
  });

  test("n=3: ordinary 1, high-impact 2-of-3, emergency 2", async () => {
    expect(row(charteredClassTable(await rosterOf(3, 2))!)).toEqual([1, 2, 2]);
  });

  test("n=4: high-impact takes a majority, 3", async () => {
    expect(row(charteredClassTable(await rosterOf(4, 2))!)).toEqual([1, 3, 2]);
  });

  test("n=5: high-impact 3-of-5; a higher roster threshold lifts it, capped at n", async () => {
    expect(row(charteredClassTable(await rosterOf(5, 3))!)).toEqual([1, 3, 2]);
    expect(row(charteredClassTable(await rosterOf(5, 4))!)).toEqual([1, 4, 2]);
    expect(row(charteredClassTable(await rosterOf(5, 5))!)).toEqual([1, 5, 2]);
  });

  test("emergency owes a review at every n; ordinary and high-impact owe none", async () => {
    for (const [n, k] of [[1, 1], [2, 2], [3, 2], [4, 3], [5, 3]] as const) {
      const t = charteredClassTable(await rosterOf(n, k))!;
      expect(t.emergency.reviewOwed).toBe(true);
      expect(t.ordinary.reviewOwed).toBe(false);
      expect(t.highImpact.reviewOwed).toBe(false);
      expect(t.sealEpochCid).toBe(EPOCH);
    }
  });

  test("a repeated key seats once", async () => {
    const r = await rosterOf(3, 2);
    const t = charteredClassTable({ ...r, keys: [...r.keys, r.keys[0]!] })!;
    expect(t.seats).toBe(3);
  });

  test("null where the roster seats nobody, its threshold falls outside 1..n, or a key reads malformed", async () => {
    const r = await rosterOf(3, 2);
    expect(charteredClassTable({ keys: [], threshold: 1, sealEpochCid: EPOCH })).toBeNull();
    expect(charteredClassTable({ ...r, threshold: 0 })).toBeNull();
    expect(charteredClassTable({ ...r, threshold: 4 })).toBeNull();
    expect(charteredClassTable({ ...r, threshold: 1.5 })).toBeNull();
    expect(charteredClassTable({ ...r, keys: [...r.keys, "not-a-key"] })).toBeNull();
    expect(charteredClassTable({ ...r, keys: [r.keys[0]!.toUpperCase(), r.keys[1]!, r.keys[2]!] })).toBeNull();
    expect(charteredClassTable({ ...r, sealEpochCid: "" })).toBeNull();
  });
});

describe("classThreshold", () => {
  test("each class answers its row; revocation answers the revoked act's threshold", async () => {
    const t = charteredClassTable(await rosterOf(5, 3))!;
    expect(classThreshold(t, "ordinary")).toBe(1);
    expect(classThreshold(t, "high-impact")).toBe(3);
    expect(classThreshold(t, "emergency")).toBe(2);
    expect(classThreshold(t, "revocation", "high-impact")).toBe(3);
    expect(classThreshold(t, "revocation", "ordinary")).toBe(1);
    expect(classThreshold(t, "revocation", "emergency")).toBe(2);
  });

  test("revocation naming no act, or naming a revocation, answers null", async () => {
    const t = charteredClassTable(await rosterOf(5, 3))!;
    expect(classThreshold(t, "revocation")).toBeNull();
    expect(classThreshold(t, "revocation", "revocation")).toBeNull();
    expect(classThreshold(t, "nonsense" as never)).toBeNull();
  });
});

describe("surfaces and coverage", () => {
  test("charter, admission and trust-root need high-impact; anything else ordinary", () => {
    expect([...HIGH_IMPACT_SURFACES]).toEqual(["charter", "admission", "trust-root", "floor-release"]);
    for (const s of HIGH_IMPACT_SURFACES) expect(requiredClassFor(s)).toBe("high-impact");
    expect(requiredClassFor("crossroads")).toBe("ordinary");
    // A spelling that folds onto a high-impact surface (case, edge space, `_` or a space for `-`) takes the
    // high bar: the class reads the surface's meaning, never its byte-exact spelling.
    for (const s of ["Charter", " charter", "charter ", "CHARTER", "Admission", "trust_root", "trust root", "Trust-Root"]) {
      expect(requiredClassFor(s)).toBe("high-impact");
    }
  });

  test("high-impact covers ordinary; emergency covers emergency alone; ordinary covers nothing higher", () => {
    expect(classCovers("ordinary", "ordinary")).toBe(true);
    expect(classCovers("high-impact", "ordinary")).toBe(true);
    expect(classCovers("high-impact", "high-impact")).toBe(true);
    expect(classCovers("emergency", "emergency")).toBe(true);
    expect(classCovers("ordinary", "high-impact")).toBe(false);
    expect(classCovers("emergency", "high-impact")).toBe(false);
    expect(classCovers("emergency", "ordinary")).toBe(false);
    expect(classCovers("high-impact", "emergency")).toBe(false);
    expect(classCovers("ordinary", "emergency")).toBe(false);
  });
});

describe("countSeatedSignatures", () => {
  const bytes = utf8Bytes("the exact bytes");
  const other = utf8Bytes("other bytes");

  test("counts each distinct seated key whose signature verifies", async () => {
    const r = await rosterOf(3, 2);
    const sigs = [
      { signer: r.keys[0]!, sig: await sigOf(seed(1), bytes) },
      { signer: r.keys[1]!, sig: await sigOf(seed(2), bytes) },
    ];
    expect(countSeatedSignatures(bytes, sigs, r)).toBe(2);
  });

  test("an active persona's key (not seated) counts zero", async () => {
    const r = await rosterOf(3, 2);
    const persona = seed(9);
    expect(countSeatedSignatures(bytes, [{ signer: await pubOf(persona), sig: await sigOf(persona, bytes) }], r)).toBe(0);
  });

  test("a repeat counts once; a malformed sig counts nothing", async () => {
    const r = await rosterOf(3, 2);
    const good = { signer: r.keys[0]!, sig: await sigOf(seed(1), bytes) };
    expect(countSeatedSignatures(bytes, [good, good, { ...good }], r)).toBe(1);
    expect(countSeatedSignatures(bytes, [{ signer: r.keys[1]!, sig: "zz" }, { signer: r.keys[2]!, sig: "" }], r)).toBe(0);
  });

  test("nonsense control: a signature over other bytes counts nothing", async () => {
    const r = await rosterOf(3, 2);
    const sigs = [
      { signer: r.keys[0]!, sig: await sigOf(seed(1), other) },
      { signer: r.keys[1]!, sig: await sigOf(seed(2), other) },
    ];
    expect(countSeatedSignatures(other, sigs, r)).toBe(2);   // the setup took: they verify over their own bytes
    expect(countSeatedSignatures(bytes, sigs, r)).toBe(0);
  });

  test("a seated key signing under another seat's name counts nothing", async () => {
    const r = await rosterOf(3, 2);
    expect(countSeatedSignatures(bytes, [{ signer: r.keys[1]!, sig: await sigOf(seed(1), bytes) }], r)).toBe(0);
  });
});
