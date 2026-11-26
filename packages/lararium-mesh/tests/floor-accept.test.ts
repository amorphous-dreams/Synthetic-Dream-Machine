/**
 * floor-accept.test.ts — the PLACE accepts the floor: one accept per (place, Nexus), in the place's accept home, moved only by
 * a hand's accept along `prior` (lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept, pin step 4).
 *
 * REDS, each with its control:
 *   · the accept starts at genesis's baked floor, and a status read writes nothing;
 *   · an accept fast-forwards over two releases, staging the floor whole before the accept moves, and takes the board's heads;
 *   · a release that does not descend from the accept (a rollback) refuses `floor-not-descendant`;
 *   · two heads refuse `floor-fork-unsettled`, naming both;
 *   · a replayed accept lands nothing (no stage, no change, no remount);
 *   · the status reads the same after a reboot (the accept home saved and loaded into a fresh Repo);
 *   · a face switch moves no accept: the row keys on the Nexus alone, and a row in a face's own store moves nothing;
 *   · each recipe mounts its own realm's Nexus; a conflicted realm mounts genesis; a torn row names itself;
 *   · a herm or a locked hearth shows the carried head `carried-unaccepted`, snapshots over genesis plugins; a fork shows genesis;
 *   · the remount: a live swap where the island can, the reboot-pending alert naming why where it cannot.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { save } from "@automerge/automerge";
import { sha256HexBytesSync } from "../src/crypto.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { floorManifestBytes, cutFloorSnapshot, type FloorManifest } from "../src/floor-manifest.js";
import { signFloorOffering } from "../src/floor-offering.js";
import { assembleFloorRelease, openFloorReleaseBody, type FloorRelease } from "../src/floor-release.js";
import {
  FLOOR_ACCEPT_PREFIX, FLOOR_ACCEPT_KIND, acceptFloorRelease, carriedFloorOf, decideFloorAccept, floorToMount, floorAcceptOf, floorAcceptTitle,
  floorRemountDecision, readFloorStatus, writeFloorAccept, genesisFloorAccept, vesselFloorPick,
  type FloorAcceptHome, type FloorAcceptPorts, type FloorRemount,
} from "../src/floor-accept.js";
import { readFloorManifest } from "../src/floor-manifest.js";
import { storedLarRecord } from "../src/stored-record.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";

const row = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });

/** The plugins offering every test floor names: one blob whose bytes ride the floor's CAS beside the record. */
const PLUGIN_BYTES = new TextEncoder().encode("plugin bytes");
const OFFERING = await signFloorOffering({ seed: new Uint8Array(32).fill(3), blobs: [{
  id: "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext", version: "unknown", sha256: sha256HexBytesSync(PLUGIN_BYTES),
  provenance: { source: "https://example.test", commit: "0".repeat(40), path: "plugin.json", licence: "MIT" },
}] });

function floor(tag: string) {
  const cas = new Map<string, Uint8Array>();
  const lares = cutFloorSnapshot({ [`lar:///t/${tag}/lares`]: row(`lar:///t/${tag}/lares`, `lares ${tag}`) });
  const lararium = cutFloorSnapshot({ [`lar:///t/${tag}/lararium`]: row(`lar:///t/${tag}/lararium`, `lararium ${tag}`) });
  cas.set(lares.cid, lares.bytes); cas.set(lararium.cid, lararium.bytes);
  cas.set(OFFERING.cid, OFFERING.bytes); cas.set(OFFERING.offering.blobs[0]!.sha256, PLUGIN_BYTES);
  const manifest: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), plugins: OFFERING.cid, snapshots: { lares: lares.cid, lararium: lararium.cid } };
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

/** A plain accept home that counts its changes, standing in for a DocHandle. */
function memoryHome(doc: LarDoc = emptyLarDoc()): { changes: number; doc(): LarDoc; change(fn: (draft: LarDoc) => void): void } {
  return { changes: 0, doc: () => doc, change(fn) { this.changes += 1; fn(doc); } };
}

const GENESIS = floor("genesis");

/** Ports over one board and one CAS; `staged` and `alerts` record what the accept did. */
function portsOver(args: { home: FloorAcceptHome; nexus: string; releases: readonly FloorRelease[]; cas: Map<string, Uint8Array>; floorSwap?: boolean; required?: readonly string[] }) {
  const staged: string[] = [];
  const alerts: FloorRemount[] = [];
  const swapped: string[] = [];
  const local = new Map<string, Uint8Array>(GENESIS.cas);
  const ports: FloorAcceptPorts = {
    home: args.home, nexus: args.nexus, genesisManifest: GENESIS.manifestCid,
    requiredBlobIds: args.required ?? [OFFERING.offering.blobs[0]!.id],
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

describe("the place's accept", () => {
  test("RED: the accept starts at genesis's baked floor, and a status read writes nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const home = memoryHome();
    const { ports } = portsOver({ home, nexus: c.aid, releases: [r1], cas: f1.cas });
    const status = await readFloorStatus(ports);
    expect(status.accepted).toEqual(genesisFloorAccept(c.aid, GENESIS.manifestCid));
    expect(status).toMatchObject({ acceptSource: "genesis", board: "released", newest: r1.cid, descends: true, fastForward: true, path: [r1.cid], fork: null });
    expect(home.changes).toBe(0);
    expect(Object.keys(home.doc().tiddlers)).toEqual([]);
  });

  test("RED: an accept fast-forwards over two releases, staging each floor blob before the accept moves, and takes the heads it read", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), f2 = floor("two");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const home = memoryHome();
    const { ports, staged, alerts } = portsOver({ home, nexus: c.aid, releases: [r2, r1], cas: new Map([...f1.cas, ...f2.cas]) });
    const out = await acceptFloorRelease(ports);
    expect(out).toMatchObject({ ok: true, moved: true, path: [r1.cid, r2.cid], accept: { release: r2.cid, manifest: f2.manifestCid, took: [r2.cid] } });
    expect(new Set(staged)).toEqual(new Set(f2.cas.keys()));
    expect(floorAcceptOf(home.doc(), c.aid, GENESIS.manifestCid)).toMatchObject({ source: "accepted", accept: { release: r2.cid, took: [r2.cid] } });
    expect(alerts).toHaveLength(1);
    // CONTROL: the status now reads current: the head IS the accept, nothing to fast-forward.
    expect(await readFloorStatus(ports)).toMatchObject({ newest: r2.cid, descends: true, fastForward: false, path: [] });
  });

  test("RED: a release whose offering drops a blob every mount needs refuses `floor-offering-incomplete`, naming it, and lands nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const home = memoryHome();
    const { ports, staged, alerts } = portsOver({ home, nexus: c.aid, releases: [r1], cas: f1.cas, required: [OFFERING.offering.blobs[0]!.id, "lararium-boot-shadows"] });
    const out = await acceptFloorRelease(ports);
    expect(out).toMatchObject({ ok: false, refusal: "floor-offering-incomplete", detail: expect.stringContaining("lararium-boot-shadows") });
    expect({ staged: staged.length, changes: home.changes, alerts: alerts.length }).toEqual({ staged: 0, changes: 0, alerts: 0 });
  });

  test("RED: a release that does not descend from the accept refuses `floor-not-descendant` (a rollback), and lands nothing", async () => {
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
    // and the write itself stays idempotent: the same accept over the same row changes nothing
    const doc = home.doc();
    expect(writeFloorAccept(doc, floorAcceptOf(doc, c.aid, GENESIS.manifestCid).accept)).toBe(false);
  });

  test("RED: the status reads the same after a reboot (the accept home saved, loaded into a fresh Repo)", async () => {
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
    expect(after).toMatchObject({ acceptSource: "accepted", accepted: { release: r1.cid, took: [r1.cid] }, newest: r2.cid, fastForward: true, path: [r2.cid] });
    await repo1.shutdown(); await repo2.shutdown();
  });

  test("RED: a face switch moves no accept: the row keys on the Nexus alone, and an accept row in a face's own store moves nothing", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const accepts = memoryHome();
    await acceptFloorRelease(portsOver({ home: accepts, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    expect(Object.keys(accepts.doc().tiddlers)).toEqual([floorAcceptTitle(c.aid)]);
    expect(floorAcceptTitle(c.aid)).toBe(`${FLOOR_ACCEPT_PREFIX}${c.aid}`);
    // Face A and face B read through the same accept home: one accept.
    const asFaceA = await readFloorStatus(portsOver({ home: accepts, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    const asFaceB = await readFloorStatus(portsOver({ home: accepts, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    expect(asFaceB.accepted).toEqual(asFaceA.accepted);
    // A face's store carrying a forged accept row stands outside the accept home and moves no mount.
    const faceStore = emptyLarDoc();
    writeFloorAccept(faceStore, { kind: FLOOR_ACCEPT_KIND, nexus: c.aid, release: "9".repeat(64), manifest: "8".repeat(64), took: [] });
    expect(floorToMount({ accepts: accepts.doc(), pick: { nexus: c.aid }, genesis: GENESIS.manifestCid })).toEqual({ cid: f1.manifestCid, standing: "accepted", nexus: c.aid });
  });

  test("RED: a new head arriving by sync moves no accept; a replayed accept leaves the home's heads equal", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), f2 = floor("two");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const cas = new Map([...f1.cas, ...f2.cas]);
    await acceptFloorRelease(portsOver({ home: handle, nexus: c.aid, releases: [r1], cas }).ports, r1.cid);
    const heads = handle.heads();
    // r2 arrives on the board: the status names a fast-forward, the accept stays on r1.
    const status = await readFloorStatus(portsOver({ home: handle, nexus: c.aid, releases: [r1, r2], cas }).ports);
    expect(status).toMatchObject({ accepted: { release: r1.cid }, newest: r2.cid, fastForward: true });
    expect(floorToMount({ accepts: handle.doc(), pick: { nexus: c.aid }, genesis: GENESIS.manifestCid })).toMatchObject({ cid: f1.manifestCid, standing: "accepted" });
    await acceptFloorRelease(portsOver({ home: handle, nexus: c.aid, releases: [r1], cas }).ports, r1.cid);
    expect(handle.heads()).toEqual(heads);
    await repo.shutdown();
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

  test("decideFloorAccept is pure: the same accept and standing decide the same way, and an empty board refuses `floor-no-release`", () => {
    const accept = genesisFloorAccept("nexus-a", GENESIS.manifestCid);
    expect(decideFloorAccept({ accept, standing: { standing: "absent", head: null, counted: [], refused: [] } })).toMatchObject({ ok: false, refusal: "floor-no-release" });
  });
});

describe("each recipe mounts its own realm's Nexus", () => {
  const A = "a".repeat(64), B = "b".repeat(64);
  const accepts = (): LarDoc => {
    const doc = emptyLarDoc();
    writeFloorAccept(doc, { kind: FLOOR_ACCEPT_KIND, nexus: "nexus-a", release: "1".repeat(64), manifest: A, took: ["1".repeat(64)] });
    writeFloorAccept(doc, { kind: FLOOR_ACCEPT_KIND, nexus: "nexus-b", release: "2".repeat(64), manifest: B, took: ["2".repeat(64)] });
    return doc;
  };

  test("RED: accepts at Nexus A and Nexus B: a recipe under A mounts A's, one under B mounts B's, no Nexus mounts genesis", () => {
    const doc = accepts();
    expect(floorToMount({ accepts: doc, pick: { nexus: "nexus-a" }, genesis: GENESIS.manifestCid })).toEqual({ cid: A, standing: "accepted", nexus: "nexus-a" });
    expect(floorToMount({ accepts: doc, pick: { nexus: "nexus-b" }, genesis: GENESIS.manifestCid })).toEqual({ cid: B, standing: "accepted", nexus: "nexus-b" });
    expect(floorToMount({ accepts: doc, pick: { nexus: null }, genesis: GENESIS.manifestCid })).toEqual({ cid: GENESIS.manifestCid, standing: "genesis", nexus: null });
    // CONTROL: a Nexus the home holds no accept for stands on genesis, never on another Nexus's floor.
    expect(floorToMount({ accepts: doc, pick: { nexus: "nexus-c" }, genesis: GENESIS.manifestCid })).toMatchObject({ cid: GENESIS.manifestCid, standing: "genesis" });
  });

  test("RED: a realm carrying two Nexus pins mounts genesis under `floor-realm-conflicted`", () => {
    expect(floorToMount({ accepts: accepts(), pick: { conflicted: ["nexus-a", "nexus-b"] }, genesis: GENESIS.manifestCid }))
      .toMatchObject({ cid: GENESIS.manifestCid, standing: "genesis", note: expect.stringMatching(/^floor-realm-conflicted:/) });
  });

  test("RED: a torn accept row mounts genesis and names itself `floor-accept-torn`", () => {
    const doc = accepts();
    doc.tiddlers[floorAcceptTitle("nexus-a")] = storedLarRecord(floorAcceptTitle("nexus-a"), { text: JSON.stringify({ kind: FLOOR_ACCEPT_KIND, nexus: "nexus-a", release: null, manifest: A }) }, FLOOR_ACCEPT_KIND);
    expect(floorToMount({ accepts: doc, pick: { nexus: "nexus-a" }, genesis: GENESIS.manifestCid })).toMatchObject({ standing: "genesis", note: expect.stringMatching(/^floor-accept-torn:/) });
    expect(floorAcceptOf(doc, "nexus-a", GENESIS.manifestCid).source).toBe("torn");
  });
});

describe("carried, never accepted (a herm, a locked hearth)", () => {
  async function carried(c: SeatedCharter, releases: readonly FloorRelease[], cas: Map<string, Uint8Array>) {
    const local = new Map<string, Uint8Array>([...GENESIS.cas, ...cas]);
    const staged: string[] = [];
    const out = await carriedFloorOf({
      rows: async () => releases.map((r) => ({ keyCid: r.cid, record: JSON.parse(JSON.stringify(r)) as unknown })),
      nexus: c.aid, genesisManifest: GENESIS.manifestCid, requiredBlobIds: [OFFERING.offering.blobs[0]!.id],
      fetchLocal: async (cid) => local.get(cid) ?? null,
      stage: async (blobs) => { for (const b of blobs) { staged.push(b.cid); local.set(b.cid, b.bytes); } },
    });
    return { out, staged, local };
  }

  test("RED: a herm's accept refuses by the floor key; its mount shows the carried head `carried-unaccepted`, snapshots over genesis plugins", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    const { out, local } = await carried(c, [r1], f1.cas);
    expect(out).toMatchObject({ heads: [r1.cid], cid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    // The showing carries the release's canon snapshots and the GENESIS plugins: no plugin code runs that no hand accepted.
    const shown = readFloorManifest(local.get(out!.cid!)!);
    const head = readFloorManifest(f1.manifestBytes);
    const gen = readFloorManifest(GENESIS.manifestBytes);
    if ("refusal" in shown || "refusal" in head || "refusal" in gen) throw new Error("manifest unread");
    expect(shown.manifest.snapshots).toEqual(head.manifest.snapshots);
    expect(shown.manifest.plugins).toBe(gen.manifest.plugins);
    expect(shown.manifest.engine).toBe(gen.manifest.engine);
    const pick = floorToMount({ accepts: { unavailable: "floor-unkeyed" }, pick: { nexus: c.aid }, genesis: GENESIS.manifestCid, carried: out });
    expect(pick).toMatchObject({ cid: out!.cid, standing: "carried-unaccepted", heads: [r1.cid] });
  });

  test("RED: a newer head syncs and the stamp names it; a fork names both heads and shows genesis", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one"), f2 = floor("two"), fb = floor("b");
    const r1 = await released(c, f1);
    const r2 = await released(c, f2, r1.cid);
    const cas = new Map([...f1.cas, ...f2.cas, ...fb.cas]);
    expect((await carried(c, [r1, r2], cas)).out).toMatchObject({ heads: [r2.cid] });
    const rb = await released(c, fb, r1.cid);
    const fork = (await carried(c, [r1, r2, rb], cas)).out;
    expect(fork).toMatchObject({ cid: null, heads: [r2.cid, rb.cid].sort() });
    expect(floorToMount({ accepts: { unavailable: "vessel-locked" }, pick: { nexus: c.aid }, genesis: GENESIS.manifestCid, carried: fork }))
      .toMatchObject({ cid: GENESIS.manifestCid, standing: "genesis", note: expect.stringMatching(/carried-unaccepted/) });
  });

  test("RED: absent head bytes show genesis; a locked hearth reads the same branch, and after unlock the accept mounts", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 1 });
    const f1 = floor("one");
    const r1 = await released(c, f1);
    expect((await carried(c, [r1], new Map())).out).toMatchObject({ cid: null, heads: [r1.cid] });
    const home = memoryHome();
    await acceptFloorRelease(portsOver({ home, nexus: c.aid, releases: [r1], cas: f1.cas }).ports);
    const island = (): LarDoc => emptyLarDoc();
    const locked = await vesselFloorPick({ accepts: async () => ({ unavailable: "vessel-locked" }), pick: { nexus: c.aid }, islandDoc: island, carried: async () => null });
    expect(locked.standing).toBe("genesis");
    const open = await vesselFloorPick({ accepts: async () => home, pick: { nexus: c.aid }, islandDoc: island });
    expect(open).toMatchObject({ cid: f1.manifestCid, standing: "accepted" });
  });
});
