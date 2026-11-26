/**
 * floor-restand — THE HOUSE RESTANDS ITSELF to mount an adopted floor. The hand's apply arms the lane; events alone (the verb door
 * turning idle, the sealed rest telling a document rested) open the quiet point; at quiet the vessel restands once; the boot after
 * commits the staged floor at par, or reverts it to the prior floor and names why, under one receipt.
 *
 * REDS, each with its control:
 *   · apply → quiet → restand → par → a committed receipt naming the floor, the seed and par;
 *   · apply → restand → not par → reverted to the prior floor, the cause named, the staged bytes kept;
 *   · no restand while a write flies: a busy door, an act standing, a save held, an unwritten shore, a call begun mid-flush.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync, utf8Bytes } from "@lararium/mesh/crypto";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { FLOOR_MANIFEST_FORMAT, cutFloorSnapshot, floorManifestBytes, type FloorManifest } from "@lararium/mesh/floor-manifest";
import { signFloorOffering } from "@lararium/mesh/floor-offering";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh/lar-uris";
import { FLOOR_PIN_KIND, adoptFloorSeed, floorPinOf, readFloorSettle, type FloorPinPorts } from "@lararium/mesh/floor-pin";
import { floorRestandLane, readFloorQuiet, settleFloorAtBootLines, type FloorQuietParts } from "../src/floor-restand.js";

const NEXUS = "nexus-aid";
const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
const blob = (label: string) => { const bytes = utf8Bytes(JSON.stringify({ label })); return { bytes, sha256: sha256HexBytesSync(bytes) }; };
const G1 = blob("grammar-1"), G2 = blob("grammar-2");
const offerOf = (b: { sha256: string }) => signFloorOffering({ seed: new Uint8Array(32).fill(5), blobs: [{ id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "1", sha256: b.sha256, provenance }] });
const OFFER1 = await offerOf(G1), OFFER2 = await offerOf(G2);
const SNAP_LARES = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "lares" } } });
const SNAP_LARARIUM = cutFloorSnapshot({ "lar:///t/lararium": { tiddler: { title: "lar:///t/lararium", text: "lararium" } } });
const manifestOf = (m: FloorManifest) => { const bytes = floorManifestBytes(m); return { m, bytes, cid: sha256HexBytesSync(bytes) }; };
const BASE = manifestOf({ format: FLOOR_MANIFEST_FORMAT, engine: "e".repeat(64), plugins: OFFER1.cid, snapshots: { lares: SNAP_LARES.cid, lararium: SNAP_LARARIUM.cid } });
const SEED = manifestOf({ format: FLOOR_MANIFEST_FORMAT, engine: "e".repeat(64), plugins: OFFER2.cid, snapshots: { lares: "c".repeat(64), lararium: "d".repeat(64) } });
const RECEIPT = "5".repeat(64);

function memoryHome(doc: LarDoc = emptyLarDoc()) { return { changes: 0, doc: () => doc, change(fn: (d: LarDoc) => void) { this.changes += 1; fn(doc); } }; }

/** A vessel as the lane sees it: a door with calls in flight, acts standing, saves held, a shore that flushes. */
function vessel() {
  const v = { calls: 0, acts: 0, held: 0, shoreWhole: true, onFlush: (): void => {}, flushes: 0 };
  const parts: FloorQuietParts = {
    doorIdle: () => v.calls === 0,
    actsStanding: () => v.acts,
    heldSaves: () => v.held,
    flushShores: async () => { v.flushes += 1; v.onFlush(); return { whole: v.shoreWhole }; },
  };
  return { v, parts };
}

/** The standing vessel: its door holds the apply in flight, the adopt's restand arms the lane, and each event pokes it. */
function standing() {
  const home = memoryHome();
  const cas = new Map<string, Uint8Array>([[BASE.cid, BASE.bytes], [SEED.cid, SEED.bytes], [OFFER1.cid, OFFER1.bytes], [OFFER2.cid, OFFER2.bytes],
    [G1.sha256, G1.bytes], [G2.sha256, G2.bytes], [SNAP_LARES.cid, SNAP_LARES.bytes], [SNAP_LARARIUM.cid, SNAP_LARARIUM.bytes]]);
  const { v, parts } = vessel();
  const restands: string[] = [];
  const logs: string[] = [];
  const lane = floorRestandLane({ quiet: () => readFloorQuiet(parts), restand: (why) => { restands.push(why); }, log: (l) => { logs.push(l); } });
  const alerts: string[] = [];
  const ports: FloorPinPorts = {
    home, nexus: NEXUS, genesisManifest: BASE.cid, requiredBlobIds: [LARES_MEMETIC_WIKITEXT_PLUGIN_URI],
    rows: async () => [], fetchCas: async (cid) => cas.get(cid) ?? null,
    stage: async (blobs) => { for (const b of blobs) cas.set(b.cid, b.bytes); },
    mount: { floorSwap: false, restand: (m) => lane.arm(m), alert: (r) => { alerts.push(r.why); } },
  };
  /** The door settles a call: the seat turns idle where it was the last, and the idle event pokes the lane. */
  const settleCall = () => { v.calls -= 1; if (v.calls === 0) lane.poke(); };
  return { home, cas, v, lane, ports, restands, logs, alerts, settleCall };
}

/** Let the lane's reading run to its end (it awaits the shore's flush). */
const turn = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };

describe("apply → quiet → restand → the boot settles by par", () => {
  test("RED: the apply arms, its own call holds the restand; the door's idle fires it once; the boot at par commits under one receipt", async () => {
    const s = standing();
    s.v.calls = 1; // the apply rides the door: a write in flight
    const applied = await adoptFloorSeed(s.ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    if (!applied.ok || !applied.moved) throw new Error("apply");
    expect(applied.remount).toMatchObject({ act: "restand" });
    expect(s.alerts).toEqual([]);
    await turn();
    expect(s.restands).toEqual([]);
    expect(s.lane.standing()).toEqual({ armed: applied.pin.manifest, fired: false });
    s.settleCall();
    await turn();
    expect(s.restands).toHaveLength(1);
    expect(s.lane.standing().fired).toBe(true);
    // A later event never fires a second restand.
    s.lane.poke();
    await turn();
    expect(s.restands).toHaveLength(1);

    // THE BOOT AFTER: the daemon island's mount stood on the staged floor.
    const { settle, lines } = settleFloorAtBootLines(s.home, { source: "floor", manifest: applied.pin.manifest });
    expect(settle).toMatchObject({ act: "committed" });
    expect(lines.join("\n")).toContain(`committed local floor ${applied.pin.manifest} at par (seed ${RECEIPT})`);
    expect(readFloorSettle(s.home.doc(), NEXUS)).toMatchObject({ act: "committed", floor: applied.pin.manifest, seed: RECEIPT, par: "par" });
    expect(floorPinOf(s.home.doc(), NEXUS, BASE.cid).pin.local?.state).toBe("committed");
  });

  test("RED: apply → restand → a boot not at par reverts to the prior floor, names why, and keeps the staged bytes", async () => {
    const s = standing();
    const applied = await adoptFloorSeed(s.ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    if (!applied.ok || !applied.moved) throw new Error("apply");
    await turn();
    expect(s.restands).toHaveLength(1);
    const { settle, lines } = settleFloorAtBootLines(s.home, { source: "island", manifest: applied.pin.manifest, why: "floor-offering-incomplete: a blob reads absent" });
    expect(settle).toMatchObject({ act: "reverted" });
    expect(lines.join("\n")).toMatch(/reverted local floor .* to .*floor-offering-incomplete/);
    expect(floorPinOf(s.home.doc(), NEXUS, BASE.cid).pin).toEqual({ kind: FLOOR_PIN_KIND, nexus: NEXUS, release: null, manifest: BASE.cid });
    expect(readFloorSettle(s.home.doc(), NEXUS)).toMatchObject({ act: "reverted", floor: applied.pin.manifest, seed: RECEIPT, pinned: BASE.cid, par: expect.stringContaining("floor-offering-incomplete") });
    expect(s.cas.get(applied.pin.manifest)).toBeDefined();
  });
});

describe("no restand while a write flies", () => {
  test("RED: a busy door, a standing act, a held save and an unwritten shore each hold it, by name; each clearing event re-reads", async () => {
    const { v, parts } = vessel();
    const restands: string[] = [];
    const logs: string[] = [];
    const lane = floorRestandLane({ quiet: () => readFloorQuiet(parts), restand: (why) => { restands.push(why); }, log: (l) => { logs.push(l); } });
    v.calls = 2; v.acts = 1; v.held = 3; v.shoreWhole = false;
    lane.arm("a".repeat(64));
    await turn();
    v.calls = 0; lane.poke(); await turn();
    v.acts = 0; lane.poke(); await turn();
    v.held = 0; lane.poke(); await turn(); // the sealed rest told a document rested
    expect(restands).toEqual([]);
    expect(logs.join("\n")).toMatch(/waits: a door call flies/);
    expect(logs.join("\n")).toMatch(/waits: 1 promote or kapae act\(s\) stand/);
    expect(logs.join("\n")).toMatch(/waits: the sealed rest holds 3 save\(s\) unsealed/);
    expect(logs.join("\n")).toMatch(/waits: the shore's flush left records unwritten/);
    v.shoreWhole = true; lane.poke(); await turn(); // the hand settled the shore through the door
    expect(restands).toHaveLength(1);
  });

  test("RED: a call that begins while the shores flush holds the restand until the door idles again", async () => {
    const { v, parts } = vessel();
    const restands: string[] = [];
    const lane = floorRestandLane({ quiet: () => readFloorQuiet(parts), restand: (why) => { restands.push(why); }, log: () => {} });
    v.onFlush = () => { v.calls = 1; v.onFlush = () => {}; };
    lane.arm("a".repeat(64));
    await turn();
    expect(restands).toEqual([]);
    expect(v.flushes).toBe(1);
    v.calls = 0; lane.poke(); await turn();
    expect(restands).toHaveLength(1);
  });

  test("RED: a stop by another road (a signal, a recomposition) disarms the lane: the drain's idle never asks a second stop", async () => {
    const { v, parts } = vessel();
    const restands: string[] = [];
    const lane = floorRestandLane({ quiet: () => readFloorQuiet(parts), restand: (why) => { restands.push(why); }, log: () => {} });
    v.calls = 1;
    lane.arm("a".repeat(64));
    await turn();
    lane.disarm();
    v.calls = 0; lane.poke(); await turn();
    expect(restands).toEqual([]);
    lane.arm("b".repeat(64)); await turn();
    expect(restands).toEqual([]);
  });

  test("CONTROL: an unarmed lane reads nothing at any event and never restands", async () => {
    const { v, parts } = vessel();
    const restands: string[] = [];
    const lane = floorRestandLane({ quiet: () => readFloorQuiet(parts), restand: (why) => { restands.push(why); }, log: () => {} });
    lane.poke(); lane.poke();
    await turn();
    expect(v.flushes).toBe(0);
    expect(restands).toEqual([]);
  });
});
