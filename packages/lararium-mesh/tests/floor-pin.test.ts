/**
 * floor-pin.test.ts — the VESSEL pins the floor: one pin per (vessel, Nexus), in the vessel's control home, moved only by
 * the vessel's own accept along `prior` (lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin).
 *
 * REDS, each with its control:
 *   · the pin starts at genesis's baked floor, and a status read writes nothing;
 *   · an accept fast-forwards over two releases, staging the floor whole before the pin moves;
 *   · a release that does not descend from the pin (a rollback) refuses `floor-not-descendant`;
 *   · two heads refuse `floor-fork-unsettled`, naming both;
 *   · a replayed accept lands nothing (no stage, no change, no remount);
 *   · the status reads the same after a reboot (the control document saved and loaded into a fresh Repo);
 *   · a face switch moves no pin: the pin keys on the Nexus alone, and a row in a face's own store moves nothing;
 *   · the remount: a live swap where the island can, the reboot-pending alert naming why where it cannot.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { save } from "@automerge/automerge";
import { sha256HexBytesSync } from "../src/crypto.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { floorManifestBytes, cutFloorSnapshot, type FloorManifest } from "../src/floor-manifest.js";
import { assembleFloorRelease, openFloorReleaseBody, type FloorRelease } from "../src/floor-release.js";
import {
  FLOOR_PIN_PREFIX, acceptFloorRelease, decideFloorAccept, floorCidToMount, floorPinOf, floorPinTitle, floorRemountDecision,
  readFloorStatus, writeFloorPin, genesisFloorPin, type FloorPinHome, type FloorPinPorts, type FloorRemount,
} from "../src/floor-pin.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";

const row = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });

function floor(tag: string) {
  const cas = new Map<string, Uint8Array>();
  const lares = cutFloorSnapshot({ [`lar:///t/${tag}/lares`]: row(`lar:///t/${tag}/lares`, `lares ${tag}`) });
  const lararium = cutFloorSnapshot({ [`lar:///t/${tag}/lararium`]: row(`lar:///t/${tag}/lararium`, `lararium ${tag}`) });
  cas.set(lares.cid, lares.bytes); cas.set(lararium.cid, lararium.bytes);
  const manifest: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), snapshots: { lares: lares.cid, lararium: lararium.cid } };
  const manifestBytes = floorManifestBytes(manifest);
  const manifestCid = sha256HexBytesSync(manifestBytes);
  cas.set(manifestCid, manifestBytes);
  return { cas, manifestBytes, manifestCid };
}

async function released(c: SeatedCharter, f: ReturnType<typeof floor>, prior: string | null = null): Promise<FloorRelease> {
  const [steward] = await c.signers([0]);
  return assembleFloorRelease({
    body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior, manifest: f.manifestCid }),
    lineage: c.chain, manifestBytes: f.manifestBytes, steward: steward!, approvers: [...await c.signers()],
  });
}

/** A plain control home that counts its changes, standing in for a DocHandle. */
function memoryHome(doc: LarDoc = emptyLarDoc()): { changes: number; doc(): LarDoc; change(fn: (draft: LarDoc) => void): void } {
  return { changes: 0, doc: () => doc, change(fn) { this.changes += 1; fn(doc); } };
}

const GENESIS = floor("genesis");

/** Ports over one board and one CAS; `staged` and `alerts` record what the accept did. */
function portsOver(args: { home: FloorPinHome; nexus: string; releases: readonly FloorRelease[]; cas: Map<string, Uint8Array>; floorSwap?: boolean }) {
  const staged: string[] = [];
  const alerts: FloorRemount[] = [];
  const swapped: string[] = [];
  const local = new Map<string, Uint8Array>(GENESIS.cas);
  const ports: FloorPinPorts = {
    home: args.home, nexus: args.nexus, genesisManifest: GENESIS.manifestCid,
    rows: async () => args.releases.map((r) => ({ keyCid: r.cid, record: JSON.parse(JSON.stringify(r)) as unknown })),
    fetchCas: async (cid) => local.get(cid) ?? args.cas.get(cid) ?? null,
    stage: async (blobs) => { for (const b of blobs) { staged.push(b.cid); local.set(b.cid, b.bytes); } },
    mount: {
      floorSwap: args.floorSwap === true,
      ...(args.floorSwap === true ? { swap: async (m: string) => { swapped.push(m); } } : {}),
      alert: (r) => { alerts.push(r); },
    },
  };
  return { ports, staged, alerts, swapped, local };
}

describe("the vessel's pin", () => {
  test("RED: the pin starts at genesis's baked floor, and a status read writes nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const home = memoryHome();
    const { ports } = portsOver({ home, nexus: c.aid, releases: [r1], cas: f1.cas });
    const status = await readFloorStatus(ports);
    expect(status.pinned).toEqual(genesisFloorPin(c.aid, GENESIS.manifestCid));
    expect(status).toMatchObject({ pinSource: "genesis", board: "released", newest: r1.cid, descends: true, fastForward: true, path: [r1.cid], fork: null });
    expect(home.changes).toBe(0);
    expect(Object.keys(home.doc().tiddlers)).toEqual([]);
  });

  test("RED: an accept fast-forwards over two releases, staging each floor blob before the pin moves", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), f2 = floor("two");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const home = memoryHome();
    const { ports, staged, alerts } = portsOver({ home, nexus: c.aid, releases: [r2, r1], cas: new Map([...f1.cas, ...f2.cas]) });
    const out = await acceptFloorRelease(ports);
    expect(out).toMatchObject({ ok: true, moved: true, path: [r1.cid, r2.cid], pin: { release: r2.cid, manifest: f2.manifestCid } });
    expect(new Set(staged)).toEqual(new Set(f2.cas.keys()));
    expect(floorPinOf(home.doc(), c.aid, GENESIS.manifestCid)).toMatchObject({ source: "accepted", pin: { release: r2.cid } });
    expect(alerts).toHaveLength(1);
    // CONTROL: the status now reads current: the head IS the pin, nothing to fast-forward.
    expect(await readFloorStatus(ports)).toMatchObject({ newest: r2.cid, descends: true, fastForward: false, path: [] });
  });

  test("RED: a release that does not descend from the pin refuses `floor-not-descendant` (a rollback), and lands nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), f2 = floor("two");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const home = memoryHome();
    const { ports, staged } = portsOver({ home, nexus: c.aid, releases: [r1, r2], cas: new Map([...f1.cas, ...f2.cas]) });
    expect(await acceptFloorRelease(ports)).toMatchObject({ ok: true, moved: true });
    const changes = home.changes, stagedBefore = staged.length;
    expect(await acceptFloorRelease(ports, r1.cid)).toMatchObject({ ok: false, refusal: "floor-not-descendant" });
    expect(home.changes).toBe(changes);
    expect(staged.length).toBe(stagedBefore);
    // CONTROL: an unknown CID refuses by its own name.
    expect(await acceptFloorRelease(ports, "0".repeat(64))).toMatchObject({ ok: false, refusal: "floor-release-unknown" });
  });

  test("RED: two heads refuse `floor-fork-unsettled`, naming both, even for a named release that descends", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), fa = floor("a"), fb = floor("b");
    const r1 = await released(c, f1);
    const ra = await released(c, fa, r1.cid);
    const rb = await released(c, fb, r1.cid);
    const home = memoryHome();
    const { ports } = portsOver({ home, nexus: c.aid, releases: [r1, ra, rb], cas: new Map([...f1.cas, ...fa.cas, ...fb.cas]) });
    const heads = [ra.cid, rb.cid].sort();
    const out = await acceptFloorRelease(ports, ra.cid);
    expect(out).toMatchObject({ ok: false, refusal: "floor-fork-unsettled", heads });
    expect(!out.ok && out.detail).toContain(ra.cid);
    expect(!out.ok && out.detail).toContain(rb.cid);
    expect(await readFloorStatus(ports)).toMatchObject({ board: "unsettled", newest: null, fork: heads, descends: null, fastForward: false });
    expect(home.changes).toBe(0);
  });

  test("RED: a replayed accept lands nothing: no stage, no change, no remount", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const home = memoryHome();
    const { ports, staged, alerts } = portsOver({ home, nexus: c.aid, releases: [r1], cas: f1.cas });
    await acceptFloorRelease(ports, r1.cid);
    const before = { changes: home.changes, staged: staged.length, alerts: alerts.length };
    expect(await acceptFloorRelease(ports, r1.cid)).toMatchObject({ ok: true, moved: false, staged: [], remount: null });
    expect(await acceptFloorRelease(ports)).toMatchObject({ ok: true, moved: false });
    expect({ changes: home.changes, staged: staged.length, alerts: alerts.length }).toEqual(before);
    // and the write itself stays idempotent: the same pin over the same row changes nothing
    const doc = home.doc();
    expect(writeFloorPin(doc, floorPinOf(doc, c.aid, GENESIS.manifestCid).pin)).toBe(false);
  });

  test("RED: the status reads the same after a reboot (the control document saved, loaded into a fresh Repo)", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), f2 = floor("two");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const cas = new Map([...f1.cas, ...f2.cas]);
    const repo1 = new Repo({ network: [] });
    const handle1 = repo1.create<LarDoc>(emptyLarDoc());
    await acceptFloorRelease(portsOver({ home: handle1, nexus: c.aid, releases: [r1], cas }).ports);
    const before = await readFloorStatus(portsOver({ home: handle1, nexus: c.aid, releases: [r1, r2], cas }).ports);
    const bytes = save(handle1.doc()!);
    const repo2 = new Repo({ network: [] });
    const handle2 = repo2.import<LarDoc>(bytes);
    const after = await readFloorStatus(portsOver({ home: handle2, nexus: c.aid, releases: [r1, r2], cas }).ports);
    expect(after).toEqual(before);
    expect(after).toMatchObject({ pinSource: "accepted", pinned: { release: r1.cid }, newest: r2.cid, fastForward: true, path: [r2.cid] });
    await repo1.shutdown(); await repo2.shutdown();
  });

  test("RED: a face switch moves no pin: the row keys on the Nexus alone, and a pin row in a face's own store moves nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const control = memoryHome();
    await acceptFloorRelease(portsOver({ home: control, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    expect(Object.keys(control.doc().tiddlers)).toEqual([floorPinTitle(c.aid)]);
    expect(floorPinTitle(c.aid)).toBe(`${FLOOR_PIN_PREFIX}${c.aid}`);
    // Face A and face B read through the same control home: one pin.
    const asFaceA = await readFloorStatus(portsOver({ home: control, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    const asFaceB = await readFloorStatus(portsOver({ home: control, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    expect(asFaceB.pinned).toEqual(asFaceA.pinned);
    // A face's store carrying a forged pin row stands outside the control home and moves no mount.
    const faceStore = emptyLarDoc();
    writeFloorPin(faceStore, { kind: "floor-pin", nexus: c.aid, release: "9".repeat(64), manifest: "8".repeat(64) });
    expect(floorCidToMount({ controlDoc: control.doc(), nexus: c.aid, genesis: GENESIS.manifestCid })).toEqual({ cid: f1.manifestCid, source: "pin" });
  });
});

describe("the remount, by capability", () => {
  test("RED: an island that swaps live swaps; one that mounts at boot raises the reboot-pending alert naming why", async () => {
    expect(floorRemountDecision({ floorSwap: true }, "a".repeat(64))).toEqual({ act: "swap-live" });
    const alert = floorRemountDecision({ floorSwap: false }, "a".repeat(64));
    expect(alert).toMatchObject({ act: "alert", kind: "reboot-pending" });
    expect(alert.act === "alert" && alert.why).toMatch(/no live floor swap/);

    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const live = portsOver({ home: memoryHome(), nexus: c.aid, releases: [r1], cas: f1.cas, floorSwap: true });
    expect(await acceptFloorRelease(live.ports)).toMatchObject({ remount: { act: "swap-live" } });
    expect(live.swapped).toEqual([f1.manifestCid]);
    expect(live.alerts).toEqual([]);
    const boot = portsOver({ home: memoryHome(), nexus: c.aid, releases: [r1], cas: f1.cas });
    expect(await acceptFloorRelease(boot.ports)).toMatchObject({ remount: { act: "alert" } });
    expect(boot.alerts).toHaveLength(1);
  });

  test("the mount pick: the named Nexus's pin; the sole pin; genesis where two pins disagree and no Nexus is named", () => {
    const doc = emptyLarDoc();
    expect(floorCidToMount({ controlDoc: doc, nexus: null, genesis: GENESIS.manifestCid })).toEqual({ cid: GENESIS.manifestCid, source: "genesis" });
    writeFloorPin(doc, { kind: "floor-pin", nexus: "nexus-a", release: "1".repeat(64), manifest: "a".repeat(64) });
    expect(floorCidToMount({ controlDoc: doc, nexus: null, genesis: GENESIS.manifestCid })).toEqual({ cid: "a".repeat(64), source: "pin" });
    writeFloorPin(doc, { kind: "floor-pin", nexus: "nexus-b", release: "2".repeat(64), manifest: "b".repeat(64) });
    expect(floorCidToMount({ controlDoc: doc, nexus: null, genesis: GENESIS.manifestCid })).toMatchObject({ cid: GENESIS.manifestCid, source: "genesis", note: expect.stringMatching(/2 Nexuses/) });
    expect(floorCidToMount({ controlDoc: doc, nexus: "nexus-b", genesis: GENESIS.manifestCid })).toEqual({ cid: "b".repeat(64), source: "pin" });
  });

  test("decideFloorAccept is pure: the same pin and standing decide the same way, and an empty board refuses `floor-no-release`", () => {
    const pin = genesisFloorPin("nexus-a", GENESIS.manifestCid);
    expect(decideFloorAccept({ pin, standing: { standing: "absent", head: null, counted: [], refused: [] } })).toMatchObject({ ok: false, refusal: "floor-no-release" });
  });
});
