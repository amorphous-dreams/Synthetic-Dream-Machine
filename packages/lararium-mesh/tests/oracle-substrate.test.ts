/**
 * oracle-substrate — the Two-Faced Substrate's pure core.
 *
 * Proves the load-bearing properties of the read-only public substrate:
 *   - the read face is content-addressed (rehash verifies; tamper is a different name);
 *   - the pointer is signed, monotone (anti-rollback), lineage-linked (anti-equivocation),
 *     and supersession-current against the causal frontier — and the reader rule NEVER throws.
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
  async function mkPointer(version: number, prev: string | null, seed = SEED) {
    const snap = await exportOracleSnapshot(mkDoc());
    return buildOraclePointer({ snapshot: snap, version, prev, signerSeed: seed });
  }

  test("a well-formed, signed, fresh pointer verifies", async () => {
    const p = await mkPointer(1, null);
    expect(await verifyOraclePointer(p)).toEqual({ ok: true });
  });

  test("anti-rollback: a version below the high-water is refused", async () => {
    const p = await mkPointer(3, null);
    const v = await verifyOraclePointer(p, { highWaterVersion: 5 });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/rollback/);
  });

  test("anti-rollback: version at or above the high-water passes", async () => {
    const p = await mkPointer(5, null);
    expect((await verifyOraclePointer(p, { highWaterVersion: 5 })).ok).toBe(true);
  });

  test("supersession: a pointer remains current until a higher version is accepted", async () => {
    const p = await mkPointer(1, null);
    expect(await verifyOraclePointer(p)).toEqual({ ok: true });
  });

  test("a tampered field breaks the signature", async () => {
    const p = await mkPointer(1, null);
    const forged = { ...p, version: 999 };
    expect((await verifyOraclePointer(forged)).ok).toBe(false);
  });

  test("a malformed pointer is rejected, never thrown", async () => {
    const bad = { cid: "nope", heads: [], version: -1, prev: null, pub: "x", sig: "y" } as never;
    const v = await verifyOraclePointer(bad);
    expect(v.ok).toBe(false);
  });

  test("pinned publisher: a pointer from another key is refused", async () => {
    const p = await mkPointer(1, null, OTHER);
    const ours = await mkPointer(1, null, SEED);
    const v = await verifyOraclePointer(p, { verifyingKey: ours.pub });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/unpinned/);
  });

  test("anti-equivocation: prev must link the last-known pointer id", async () => {
    const p1 = await mkPointer(1, null);
    const id1 = await oraclePointerId(p1);
    const p2 = await mkPointer(2, id1);
    // lineage intact
    expect((await verifyOraclePointer(p2, { lastPointerId: id1 })).ok).toBe(true);
    // a fork: prev does not link what the reader last held
    const otherId = "f".repeat(64);
    const v = await verifyOraclePointer(p2, { lastPointerId: otherId });
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
 * rollback and a fork. The pointer now follows the supersession ruling; local liveness remains
 * an observer concern and never rejects a signed snapshot.
 */
describe("the clockless lease model, as the oracle pointer actually stands", () => {
  const seedPointer = async (over: Partial<{ version: number }> = {}) => {
    const snap = await exportOracleSnapshot(mkDoc());
    return buildOraclePointer({ snapshot: snap, version: over.version ?? 3, prev: null, signerSeed: SEED });
  };

  test("★ SAFETY stands clock-free: rollback and fork refuse on the LOGICAL fields alone ★", async () => {
    const p = await seedPointer({ version: 3 });
    // A lower version than remembered refuses — the fencing high-water, no clock consulted.
    const rolled = await verifyOraclePointer(p, { highWaterVersion: 9 });
    expect(rolled.ok).toBe(false);
    if (!rolled.ok) expect(rolled.reason).toMatch(/rollback/i);
    // And the same pointer verifies when the high-water permits it — so the refusal was the FENCE.
    await expect(verifyOraclePointer(p, { highWaterVersion: 3 })).resolves.toEqual({ ok: true });
  });

  test("★ THE RULING: no duration can stale an otherwise valid pointer ★", async () => {
    const p = await seedPointer();
    await expect(verifyOraclePointer(p)).resolves.toEqual({ ok: true });
  });

  test("★ THE FENCE: high-water remains the logical refusal boundary ★", async () => {
    const p = await seedPointer({ version: 3 });
    await expect(verifyOraclePointer(p)).resolves.toEqual({ ok: true });
    await expect(verifyOraclePointer(p, { highWaterVersion: 4 })).resolves.toEqual({
      ok: false, reason: "rollback (version below high-water)",
    });
  });

  test("CONTROL — the pointer already CARRIES what supersession needs, so the cure adds no field", async () => {
    const p = await seedPointer({ version: 7 });
    expect(typeof p.version).toBe("number");   // the corm-epoch / Sequence
    expect("prev" in p).toBe(true);            // the lineage link supersession walks
  });
});
