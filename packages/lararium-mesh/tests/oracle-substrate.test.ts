/**
 * oracle-substrate — the Two-Faced Substrate's pure core.
 *
 * Proves the load-bearing properties of the read-only public substrate:
 *   - the read face is content-addressed (rehash verifies; tamper is a different name);
 *   - the pointer is signed, monotone (anti-rollback), lineage-linked (anti-equivocation),
 *     and freshness-leased against the LOCAL clock — and the reader rule NEVER throws.
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#the-oracle-plane
 */

import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import {
  exportOracleSnapshot,
  verifyOracleSnapshotBytes,
  buildOraclePointer,
  oraclePointerId,
  verifyOraclePointer,
} from "../src/oracle-substrate.js";

const SEED   = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const OTHER  = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);
const NOW    = 1_000_000;
const EXPIRY = NOW + 60_000;

function mkDoc() {
  return A.from({ tiddlers: { "oracle": { text: "the constitution" } } });
}

describe("oracle-substrate — content-addressed read face", () => {
  test("export yields a sha256 cid + heads, and the bytes rehash to the cid", async () => {
    const snap = await exportOracleSnapshot(mkDoc());
    expect(snap.cid).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.heads.length).toBeGreaterThan(0);
    expect(snap.bytes.byteLength).toBeGreaterThan(0);
    expect(await verifyOracleSnapshotBytes(snap.bytes, snap.cid)).toBe(true);
  });

  test("tampered bytes do not match the cid (a different name)", async () => {
    const snap = await exportOracleSnapshot(mkDoc());
    const tampered = snap.bytes.slice();
    tampered[0] = (tampered[0]! ^ 0xff) & 0xff;
    expect(await verifyOracleSnapshotBytes(tampered, snap.cid)).toBe(false);
  });

  test("the export round-trips through Automerge.load read-only", async () => {
    const snap = await exportOracleSnapshot(mkDoc());
    const loaded = A.load<{ tiddlers: Record<string, { text: string }> }>(snap.bytes);
    expect(loaded.tiddlers["oracle"]!.text).toBe("the constitution");
  });
});

describe("oracle-substrate — the signed monotone pointer (reader rule)", () => {
  async function mkPointer(version: number, prev: string | null, seed = SEED, expiry = EXPIRY) {
    const snap = await exportOracleSnapshot(mkDoc());
    return buildOraclePointer({ snapshot: snap, version, prev, expiry, signerSeed: seed });
  }

  test("a well-formed, signed, fresh pointer verifies", async () => {
    const p = await mkPointer(1, null);
    expect(await verifyOraclePointer(p, { nowMs: NOW })).toEqual({ ok: true });
  });

  test("anti-rollback: a version below the high-water is refused", async () => {
    const p = await mkPointer(3, null);
    const v = await verifyOraclePointer(p, { nowMs: NOW, highWaterVersion: 5 });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/rollback/);
  });

  test("anti-rollback: version at or above the high-water passes", async () => {
    const p = await mkPointer(5, null);
    expect((await verifyOraclePointer(p, { nowMs: NOW, highWaterVersion: 5 })).ok).toBe(true);
  });

  test("freshness: a pointer past its expiry on the local clock is stale", async () => {
    const p = await mkPointer(1, null);
    const v = await verifyOraclePointer(p, { nowMs: EXPIRY + 1 });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/expired/);
  });

  test("a tampered field breaks the signature", async () => {
    const p = await mkPointer(1, null);
    const forged = { ...p, version: 999 };
    expect((await verifyOraclePointer(forged, { nowMs: NOW })).ok).toBe(false);
  });

  test("a malformed pointer is rejected, never thrown", async () => {
    const bad = { cid: "nope", heads: [], version: -1, prev: null, expiry: 0, pub: "x", sig: "y" } as never;
    const v = await verifyOraclePointer(bad, { nowMs: NOW });
    expect(v.ok).toBe(false);
  });

  test("pinned publisher: a pointer from another key is refused", async () => {
    const p = await mkPointer(1, null, OTHER);
    const ours = await mkPointer(1, null, SEED);
    const v = await verifyOraclePointer(p, { nowMs: NOW, verifyingKey: ours.pub });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/unpinned/);
  });

  test("anti-equivocation: prev must link the last-known pointer id", async () => {
    const p1 = await mkPointer(1, null);
    const id1 = await oraclePointerId(p1);
    const p2 = await mkPointer(2, id1);
    // lineage intact
    expect((await verifyOraclePointer(p2, { nowMs: NOW, lastPointerId: id1 })).ok).toBe(true);
    // a fork: prev does not link what the reader last held
    const otherId = "f".repeat(64);
    const v = await verifyOraclePointer(p2, { nowMs: NOW, lastPointerId: otherId });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/lineage/);
  });
});

/**
 * THE CLOCKLESS PROBE — the novelty this model asked to be collided before anyone trusts it.
 *
 * Fork-4 resolved the wall-clock-free lease model (`project_clockless_lease_model`), and left ONE
 * design-time question standing for the parity pass: does the read-face hold a per-object HIGH-WATER
 * MARK, and does any validity branch read a physical clock? Its own warnings answer why it matters:
 *
 *   (1) "MANDATE resource-side fencing (high-water-mark) or the whole model is nothing — a resource
 *        that doesn't fence lets two holders act."
 *   (3) "Lint that the soft witness field never colors an ordering/revocation branch — the moment code
 *        branches on it for those, the global-now is back."
 *
 * And the pointer rule: "REPLACE the RFC3339 EOL Validity with a SUPERSESSION rule ('live until a
 * higher-Sequence record appears') + an OPTIONAL soft grain hint that reads as ADVICE, never a hard gate."
 *
 * MEASURED HERE, so the answer stops living in prose. The model is most of the way built: the pointer
 * already carries `version` (the corm-epoch) and `prev` (lineage), and the verify already refuses a
 * rollback and a fork. Two things still read the other way, and these tests PIN THE GAP rather than
 * pretend it away — each fails when the ruling lands, telling the next hand to update it.
 */
describe("the clockless lease model, as the oracle pointer actually stands", () => {
  const seedPointer = async (over: Partial<{ version: number; expiry: number }> = {}) => {
    const snap = await exportOracleSnapshot(mkDoc());
    return buildOraclePointer({ snapshot: snap, version: over.version ?? 3, prev: null, expiry: over.expiry ?? EXPIRY, signerSeed: SEED });
  };

  test("★ SAFETY stands clock-free: rollback and fork refuse on the LOGICAL fields alone ★", async () => {
    const p = await seedPointer({ version: 3 });
    // A lower version than remembered refuses — the fencing high-water, no clock consulted.
    const rolled = await verifyOraclePointer(p, { nowMs: NOW, highWaterVersion: 9 });
    expect(rolled.ok).toBe(false);
    if (!rolled.ok) expect(rolled.reason).toMatch(/rollback/i);
    // And the same pointer verifies when the high-water permits it — so the refusal was the FENCE.
    await expect(verifyOraclePointer(p, { nowMs: NOW, highWaterVersion: 3 })).resolves.toEqual({ ok: true });
  });

  test("★ THE GAP: validity still gates on a DURATION ELAPSING, where the ruling wants supersession ★", async () => {
    const p = await seedPointer({ expiry: NOW + 10 });
    // Nothing superseded this pointer — no higher version exists anywhere. It still reads dead, purely
    // because a local clock advanced. The ruling replaces this branch with "live until a higher-Sequence
    // record appears", keeping a soft grain hint as ADVICE.
    const late = await verifyOraclePointer(p, { nowMs: NOW + 11 });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.reason).toBe("expired");
    // WHEN SUPERSESSION LANDS this flips to ok and the assertion above fails — that red means the ruling
    // arrived, and the cure is to rewrite this test around supersession, never to loosen it.
  });

  test("★ THE GAP: the FENCE is optional while the CLOCK gate is mandatory — backwards from warning (1) ★", async () => {
    const p = await seedPointer({ version: 3, expiry: NOW + 60_000 });
    // A reader that supplies NO high-water still verifies: the fence the model MANDATES can be skipped.
    await expect(verifyOraclePointer(p, { nowMs: NOW })).resolves.toEqual({ ok: true });
    // Meanwhile the clock gate cannot be skipped at all — there is no way to ask for a clock-free verdict.
    const expired = await verifyOraclePointer(await seedPointer({ expiry: NOW - 1 }), { nowMs: NOW });
    expect(expired.ok, "a clock-free verdict became reachable — the ruling may have landed").toBe(false);
  });

  test("CONTROL — the pointer already CARRIES what supersession needs, so the cure adds no field", async () => {
    const p = await seedPointer({ version: 7 });
    expect(typeof p.version).toBe("number");   // the corm-epoch / Sequence
    expect("prev" in p).toBe(true);            // the lineage link supersession walks
  });
});
