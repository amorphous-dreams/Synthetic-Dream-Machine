import { placeSignerFromSeed } from "../src/place-signer.js";
/** Red-first proofs for the clock-free, causally addressed flow substrate. */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import {
  exportFlowSnapshot, verifyFlowSnapshotBytes, buildFlowPointer,
  flowPointerId, verifyFlowPointer, foldFlowPointerVerdict,
} from "../src/flow-substrate.js";

const SEED  = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const OTHER = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);

function mkDoc(text = "the constitution") {
  return A.from({ tiddlers: { flow: { text } } });
}

async function mkPointer(parents: readonly string[] = [], seed = SEED, text = "the constitution") {
  const snapshot = await exportFlowSnapshot(mkDoc(text));
  return buildFlowPointer({ snapshot, parents, signer: placeSignerFromSeed(seed) });
}

describe("flow snapshot", () => {
  test("exports content-addressed bytes and round-trips", async () => {
    const snap = await exportFlowSnapshot(mkDoc());
    expect(snap.cid).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.heads.length).toBeGreaterThan(0);
    expect(await verifyFlowSnapshotBytes(snap.bytes, snap.cid)).toBe(true);
    expect(A.load<{ tiddlers: Record<string, { text: string }> }>(snap.bytes).tiddlers.flow.text)
      .toBe("the constitution");
  });

  test("tampered bytes fail the content address", async () => {
    const snap = await exportFlowSnapshot(mkDoc());
    const tampered = snap.bytes.slice();
    tampered[0] = (tampered[0]! ^ 0xff) & 0xff;
    expect(await verifyFlowSnapshotBytes(tampered, snap.cid)).toBe(false);
  });
});

describe("flow causal pointer", () => {
  test("signed pointer verifies and has no scalar currentness field", async () => {
    const p = await mkPointer();
    expect(await verifyFlowPointer(p)).toEqual({ ok: true });
    expect(p.actCid).toMatch(/^[0-9a-f]{64}$/);
    expect(p.parents).toEqual([]);
    expect("version" in p).toBe(false);
    expect("prev" in p).toBe(false);
  });

  test("parent sets are canonical and duplicate/order variants have one semantic act", async () => {
    const a = "a".repeat(64), b = "b".repeat(64);
    const snapshot = await exportFlowSnapshot(mkDoc("same snapshot"));
    const one = await buildFlowPointer({ snapshot, parents: [b, a, b], signer: placeSignerFromSeed(SEED) });
    const two = await buildFlowPointer({ snapshot, parents: [a, b], signer: placeSignerFromSeed(SEED) });
    expect(one.parents).toEqual([a, b]);
    expect(one.actCid).toBe(two.actCid);
    expect(one.sig).toBe(two.sig);
  });

  test("inbound head sets are canonical and signed frontier order cannot vary", async () => {
    const p = await mkPointer();
    expect((await verifyFlowPointer({ ...p, heads: [p.heads[0]!, p.heads[0]!] })).reason)
      .toMatch(/non-canonical heads/);
  });

  test("a causal descendant verifies only when its parent is locally held", async () => {
    const root = await mkPointer([], SEED, "root");
    const rootId = await flowPointerId(root);
    const child = await mkPointer([rootId], SEED, "child");
    expect((await verifyFlowPointer(child, { knownPointerIds: [rootId] })).ok).toBe(true);
    expect((await verifyFlowPointer(child, { knownPointerIds: [] })).reason).toMatch(/unavailable/);
  });

  test("concurrent contradictory heads are unsettled in either arrival order", async () => {
    const a = await mkPointer([], SEED, "raise");
    const b = await mkPointer([], SEED, "lower");
    expect(await foldFlowPointerVerdict([a, b])).toBe("unsettled");
    expect(await foldFlowPointerVerdict([b, a])).toBe("unsettled");
  });

  test("missing grandparent makes the whole branch unavailable", async () => {
    const missing = "f".repeat(64);
    const parent = await mkPointer([missing], SEED, "parent");
    const child = await mkPointer([await flowPointerId(parent)], SEED, "child");
    expect(await foldFlowPointerVerdict([parent, child])).toBe("unavailable");
  });

  test("fold precedence is deterministic and exposes forged records over missing evidence", async () => {
    const valid = await mkPointer([], SEED, "valid");
    const forged = { ...valid, actCid: "0".repeat(64) };
    const unavailable = await mkPointer(["f".repeat(64)], SEED, "unavailable");
    expect(await foldFlowPointerVerdict([forged, unavailable])).toBe("rejected");
    expect(await foldFlowPointerVerdict([unavailable, forged])).toBe("rejected");
  });

  test("semantic act CID tamper is rejected", async () => {
    const p = await mkPointer();
    const forged = { ...p, actCid: "0".repeat(64) };
    expect(await verifyFlowPointer(forged)).toEqual({ ok: false, reason: "rejected semantic act cid" });
  });

  test("signed field tamper and publisher mismatch fail closed", async () => {
    const p = await mkPointer();
    expect((await verifyFlowPointer({ ...p, cid: "f".repeat(64) })).ok).toBe(false);
    const foreign = await mkPointer([], OTHER);
    expect((await verifyFlowPointer(foreign, { verifyingKey: p.pub })).reason).toMatch(/unpinned/);
  });

  test("malformed input is rejected without throwing", async () => {
    expect((await verifyFlowPointer({ cid: "nope" } as never)).ok).toBe(false);
  });
});
