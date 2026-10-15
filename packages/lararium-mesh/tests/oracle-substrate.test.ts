/** Red-first proofs for the clock-free, causally addressed Oracle substrate. */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import {
  exportOracleSnapshot, verifyOracleSnapshotBytes, buildOraclePointer,
  oraclePointerId, verifyOraclePointer, foldOraclePointerVerdict,
  publicOracleFloor, snapshotPublicOracle,
} from "../src/oracle-substrate.js";
import type { GenesisSeed } from "../src/genesis-doc.js";
import type { LarDoc } from "../src/base-doc.js";
import { tiddlerText } from "../src/index.js";

const SEED  = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const OTHER = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);

function mkDoc(text = "the constitution") {
  return A.from({ tiddlers: { oracle: { text } } });
}

async function mkPointer(parents: readonly string[] = [], seed = SEED, text = "the constitution") {
  const snapshot = await exportOracleSnapshot(mkDoc(text));
  return buildOraclePointer({ snapshot, parents, signerSeed: seed });
}

describe("oracle snapshot", () => {
  test("exports content-addressed bytes and round-trips", async () => {
    const snap = await exportOracleSnapshot(mkDoc());
    expect(snap.cid).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.heads.length).toBeGreaterThan(0);
    expect(await verifyOracleSnapshotBytes(snap.bytes, snap.cid)).toBe(true);
    expect(A.load<{ tiddlers: Record<string, { text: string }> }>(snap.bytes).tiddlers.oracle.text)
      .toBe("the constitution");
  });

  test("tampered bytes fail the content address", async () => {
    const snap = await exportOracleSnapshot(mkDoc());
    const tampered = snap.bytes.slice();
    tampered[0] = (tampered[0]! ^ 0xff) & 0xff;
    expect(await verifyOracleSnapshotBytes(tampered, snap.cid)).toBe(false);
  });
});

describe("oracle causal pointer", () => {
  test("signed pointer verifies and has no scalar currentness field", async () => {
    const p = await mkPointer();
    expect(await verifyOraclePointer(p)).toEqual({ ok: true });
    expect(p.actCid).toMatch(/^[0-9a-f]{64}$/);
    expect(p.parents).toEqual([]);
    expect("version" in p).toBe(false);
    expect("prev" in p).toBe(false);
  });

  test("parent sets are canonical and duplicate/order variants have one semantic act", async () => {
    const a = "a".repeat(64), b = "b".repeat(64);
    const snapshot = await exportOracleSnapshot(mkDoc("same snapshot"));
    const one = await buildOraclePointer({ snapshot, parents: [b, a, b], signerSeed: SEED });
    const two = await buildOraclePointer({ snapshot, parents: [a, b], signerSeed: SEED });
    expect(one.parents).toEqual([a, b]);
    expect(one.actCid).toBe(two.actCid);
    expect(one.sig).toBe(two.sig);
  });

  test("inbound head sets are canonical and signed frontier order cannot vary", async () => {
    const p = await mkPointer();
    expect((await verifyOraclePointer({ ...p, heads: [p.heads[0]!, p.heads[0]!] })).reason)
      .toMatch(/non-canonical heads/);
  });

  test("a causal descendant verifies only when its parent is locally held", async () => {
    const root = await mkPointer([], SEED, "root");
    const rootId = await oraclePointerId(root);
    const child = await mkPointer([rootId], SEED, "child");
    expect((await verifyOraclePointer(child, { knownPointerIds: [rootId] })).ok).toBe(true);
    expect((await verifyOraclePointer(child, { knownPointerIds: [] })).reason).toMatch(/unavailable/);
  });

  test("concurrent contradictory heads are unsettled in either arrival order", async () => {
    const a = await mkPointer([], SEED, "raise");
    const b = await mkPointer([], SEED, "lower");
    expect(await foldOraclePointerVerdict([a, b])).toBe("unsettled");
    expect(await foldOraclePointerVerdict([b, a])).toBe("unsettled");
  });

  test("missing grandparent makes the whole branch unavailable", async () => {
    const missing = "f".repeat(64);
    const parent = await mkPointer([missing], SEED, "parent");
    const child = await mkPointer([await oraclePointerId(parent)], SEED, "child");
    expect(await foldOraclePointerVerdict([parent, child])).toBe("unavailable");
  });

  test("fold precedence is deterministic and exposes forged records over missing evidence", async () => {
    const valid = await mkPointer([], SEED, "valid");
    const forged = { ...valid, actCid: "0".repeat(64) };
    const unavailable = await mkPointer(["f".repeat(64)], SEED, "unavailable");
    expect(await foldOraclePointerVerdict([forged, unavailable])).toBe("rejected");
    expect(await foldOraclePointerVerdict([unavailable, forged])).toBe("rejected");
  });

  test("semantic act CID tamper is rejected", async () => {
    const p = await mkPointer();
    const forged = { ...p, actCid: "0".repeat(64) };
    expect(await verifyOraclePointer(forged)).toEqual({ ok: false, reason: "rejected semantic act cid" });
  });

  test("signed field tamper and publisher mismatch fail closed", async () => {
    const p = await mkPointer();
    expect((await verifyOraclePointer({ ...p, cid: "f".repeat(64) })).ok).toBe(false);
    const foreign = await mkPointer([], OTHER);
    expect((await verifyOraclePointer(foreign, { verifyingKey: p.pub })).reason).toMatch(/unpinned/);
  });

  test("malformed input is rejected without throwing", async () => {
    expect((await verifyOraclePointer({ cid: "nope" } as never)).ok).toBe(false);
  });
});

// ── The public floor: only the genesis-named rows cross, at their live values, with no history ──

const FLOOR_SEED = {
  format: "lararium-genesis-seed/v1", actorSeed: "ab".repeat(16),
  blobs: { "lar:///core": { id: "core", version: "1", sha256: "c".repeat(64), mimeType: "application/javascript" } },
  tiddlers: { "lar:///seeded": { tiddler: { title: "lar:///seeded", text: "seed value" } } },
} as unknown as GenesisSeed;

function liveDoc(extra: (d: Record<string, any>) => void = () => {}): LarDoc {
  let d = A.from<any>({
    schemaVersion: "0.1",
    blobs: { "lar:///core": { ...(FLOOR_SEED.blobs["lar:///core"] as object) } },
    tiddlers: { "lar:///seeded": { tiddler: { title: "lar:///seeded", text: "seed value" } } },
  });
  d = A.change(d, (x: any) => extra(x));
  return d as unknown as LarDoc;
}

describe("oracle public floor", () => {
  test("drops a non-seed title and blob row, keeps a seed title at its LIVE value, strips the bytes field", () => {
    const live = liveDoc((d) => {
      d.tiddlers["bags/catalog"] = { tiddler: { text: "private" } };
      d.blobs["lar:///private-blob"] = { id: "p", version: "1", sha256: "d".repeat(64), mimeType: "x/y" };
      d.tiddlers["lar:///seeded"].tiddler.text = "advanced value";
      d.blobs["lar:///core"].blob = new Uint8Array([1, 2, 3]);
    });
    const floor = publicOracleFloor(live, FLOOR_SEED) as any;
    expect(Object.keys(floor.tiddlers)).toEqual(["lar:///seeded"]);
    expect(Object.keys(floor.blobs)).toEqual(["lar:///core"]);
    expect(tiddlerText(floor.tiddlers["lar:///seeded"])).toBe("advanced value");
    expect("blob" in floor.blobs["lar:///core"]).toBe(false);
    expect(floor.blobs["lar:///core"].sha256).toBe("c".repeat(64));
  });

  test("CONTROL: a doc holding the seed alone projects to all of it", () => {
    const floor = publicOracleFloor(liveDoc(), FLOOR_SEED) as any;
    expect(Object.keys(floor.tiddlers)).toEqual(Object.keys(FLOOR_SEED.tiddlers));
    expect(Object.keys(floor.blobs)).toEqual(Object.keys(FLOOR_SEED.blobs));
  });

  test("purity: docs differing only in a private key share one cid; the snapshot carries one change and the seed cid", async () => {
    const a = await snapshotPublicOracle(liveDoc(), FLOOR_SEED, "5".repeat(64));
    const b = await snapshotPublicOracle(liveDoc((d) => {
      d.tiddlers["bags/daemon"] = { tiddler: { text: "x" } };
      d.tiddlers["bags/daemon"].tiddler.text = "superseded-private-value";
    }), FLOOR_SEED, "5".repeat(64));
    expect(b.cid).toBe(a.cid);
    expect(A.getAllChanges(A.load(a.bytes)).length).toBe(1);
    expect(a.seedCid).toBe("5".repeat(64));
  });
});
