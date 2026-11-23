/**
 * ONE INGEST WAVE CARRIES A BOUNDED WEIGHT INTO ONE DOCUMENT.
 *
 * The 2026-11-22 lay sent 194 lares carriers (about 3.6 MB, about 1,400 records) as one INGEST, and the shared Automerge
 * engine ran out of memory applying it. Automerge memory follows objects and ops, not file size, so a wave weighs on three
 * axes: carriers, encoded bytes and an estimate of the objects its records write. Past the budget the daemon refuses
 * `ingest-wave-over-budget` before dispatch; a lone carrier always rides (it cannot split further).
 */
import { describe, expect, test } from "vitest";
import {
  INGEST_WAVE_LIMITS, INGEST_WAVE_OVER_BUDGET, ingestCarrierWeight, ingestWaveOf, ingestWaveRefusal, ingestWaveWeight,
} from "../src/index.js";

/** A carrier shaped like a lares `.mem`: a body with `slots` ahu slots, each of which lands as its own record. */
const carrier = (i: number, bodyBytes = 18_000, slots = 6): Record<string, unknown> => {
  const slot = "<<~ ahu slot=`#/s`>>\n";
  const filler = "x".repeat(Math.max(0, bodyBytes - slot.length * slots));
  return { uri: `lar:///ha.ka.ba/t/c${i}`, file: `/b/c${i}.mem`, size: bodyBytes, diskHash: "sha256:a", syncedHash: null, ext: ".mem", text: slot.repeat(slots) + filler };
};
const wave = (n: number, bodyBytes?: number, slots?: number): Record<string, unknown> => ({
  "source-uri": "/b", "to-bag": "lar:///ha.ka.ba/bags/lares", "change-id": "c", carriers: Array.from({ length: n }, (_, i) => carrier(i, bodyBytes, slots)),
});

describe("ingest wave weight", () => {
  test("a carrier weighs its encoded bytes and one record per slot beside its root", () => {
    const w = ingestCarrierWeight(carrier(0, 18_000, 6));
    expect(w.count).toBe(1);
    expect(w.bytes).toBeGreaterThanOrEqual(18_000);
    expect(w.ops).toBeGreaterThan(ingestCarrierWeight(carrier(0, 18_000, 0)).ops);
  });

  test("the wave sums its carriers and weighs each deletion's tombstone", () => {
    const base = ingestWaveWeight(wave(3));
    expect(base.count).toBe(3);
    const withDeletes = ingestWaveWeight({ ...wave(3), deletions: [{ uri: "lar:///gone", syncedHash: "sha256:b" }] });
    expect(withDeletes.ops).toBeGreaterThan(base.ops);
  });
});

describe("the daemon's per-doc wave budget", () => {
  test("the incident's wave (194 lares-shaped carriers) refuses by name, on every axis it crosses", () => {
    const refusal = ingestWaveRefusal("INGEST", wave(194));
    expect(refusal?.reason).toBe(INGEST_WAVE_OVER_BUDGET);
    expect(refusal?.message).toMatch(/194 carriers/);
    expect(refusal!.weight.count).toBeGreaterThan(INGEST_WAVE_LIMITS.count);
    expect(refusal!.weight.bytes).toBeGreaterThan(INGEST_WAVE_LIMITS.bytes);
    expect(refusal!.weight.ops).toBeGreaterThan(INGEST_WAVE_LIMITS.ops);
  });

  test("a wave under every limit passes", () => {
    expect(ingestWaveRefusal("INGEST", wave(8))).toBeNull();
  });

  test("objects alone refuse a wave whose carriers and bytes fit", () => {
    expect(ingestWaveRefusal("INGEST", wave(40, 2_000, 200))?.reason).toBe(INGEST_WAVE_OVER_BUDGET);
  });

  test("a lone carrier rides whatever it weighs: it cannot split further", () => {
    expect(ingestWaveRefusal("INGEST", wave(1, 3_000_000, 900))).toBeNull();
  });

  test("the wiki-act road wraps the same wave and meets the same budget; other verbs pass untouched", () => {
    expect(ingestWaveOf("wiki-act", { verb: "INGEST", args: wave(2) })).not.toBeNull();
    expect(ingestWaveRefusal("wiki-act", { verb: "INGEST", args: wave(194) })?.reason).toBe(INGEST_WAVE_OVER_BUDGET);
    expect(ingestWaveRefusal("PUT", wave(194))).toBeNull();
    expect(ingestWaveRefusal("wiki-act", { verb: "PUT", args: wave(194) })).toBeNull();
  });

  test("HOLE: one carrier beside 5,000 deletions refuses; only a lone family rides free", () => {
    const deletions = Array.from({ length: 5_000 }, (_, i) => ({ uri: `lar:///gone/${i}`, syncedHash: "sha256:g" }));
    expect(ingestWaveRefusal("INGEST", { ...wave(1), deletions })?.reason).toBe(INGEST_WAVE_OVER_BUDGET);
    expect(ingestWaveRefusal("INGEST", { ...wave(1), deletions: deletions.slice(0, 1) })).toBeNull();
  });

  test("HOLE: no carriers, 5,000 deletions and 5,000 kāpae refuse", () => {
    const deletions = Array.from({ length: 5_000 }, (_, i) => ({ uri: `lar:///gone/${i}`, syncedHash: "sha256:g" }));
    const kapae = Array.from({ length: 5_000 }, (_, i) => `lar:///shade/${i}`);
    expect(ingestWaveRefusal("INGEST", { "to-bag": "lar:///ha.ka.ba/bags/lares", carriers: [], deletions, kapae })?.reason).toBe(INGEST_WAVE_OVER_BUDGET);
  });

  test("HOLE: CAS-pointer carriers weigh their staged size, since a framed body lands inline", () => {
    const pointer = (i: number) => ({ uri: `lar:///t/p${i}`, file: `/b/p${i}.mem`, size: 8 * 1024 * 1024, diskHash: "sha256:a", syncedHash: null, ext: ".mem", textCid: `cid${i}` });
    expect(ingestCarrierWeight(pointer(0)).bytes).toBeGreaterThanOrEqual(8 * 1024 * 1024);
    expect(ingestCarrierWeight(pointer(0)).ops).toBeGreaterThan(ingestCarrierWeight({ ...pointer(0), size: 100 }).ops);
    expect(ingestWaveRefusal("INGEST", { "to-bag": "lar:///ha.ka.ba/bags/lares", carriers: Array.from({ length: 48 }, (_, i) => pointer(i)) })?.reason).toBe(INGEST_WAVE_OVER_BUDGET);
  });
});

