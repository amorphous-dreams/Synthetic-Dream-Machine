/**
 * floor-local (3d, follow-lei S2) — THE LOCAL FLOOR. The pin grows a local form over its base: the local manifest it mounts (the
 * base's engine and canon snapshots, the adopted seed's plugins offering), the base its descent walks from, a receipt (the adopted
 * seed's CID) and the prior pin kept alive. An adopt moves forward only and never stacks on an uncommitted one; the engine never
 * adopts here (held). A commit lands at par; a revert lands the prior back as a forward row, never a deletion. A release accept
 * over a local floor moves (the let-go), never reads as held. Where the vessel binds a restand (a pūlama holds its custody), the
 * apply asks the house to restand itself, and the boot after settles the staged floor by its par under one receipt.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync, utf8Bytes } from "../src/crypto.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { FLOOR_MANIFEST_FORMAT, cutFloorSnapshot, floorManifestBytes, readFloorManifest, type FloorManifest } from "../src/floor-manifest.js";
import { signFloorOffering } from "../src/floor-offering.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import {
  FLOOR_PIN_KIND, FLOOR_SETTLE_KIND, adoptFloorSeed, commitLocalFloor, decideFloorAccept, decideFloorAdopt, floorCidToMount, floorPinBase, floorPinOf,
  floorRemountDecision, readFloorPin, readFloorSettle, revertLocalFloor, settleFloorAtBoot, writeFloorPin, type FloorPin, type FloorPinPorts,
} from "../src/floor-pin.js";
import type { FloorReleaseStanding } from "../src/floor-release.js";

const NEXUS = "nexus-aid";
const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
const blob = (label: string) => { const bytes = utf8Bytes(JSON.stringify({ label })); return { bytes, sha256: sha256HexBytesSync(bytes) }; };
const G1 = blob("grammar-1"), G2 = blob("grammar-2");
const offerOf = (b: { sha256: string }) => signFloorOffering({ seed: new Uint8Array(32).fill(5), blobs: [{ id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "1", sha256: b.sha256, provenance }] });
const OFFER1 = await offerOf(G1), OFFER2 = await offerOf(G2);
const ENGINE = "e".repeat(64);
const SNAP_LARES = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "lares" } } });
const SNAP_LARARIUM = cutFloorSnapshot({ "lar:///t/lararium": { tiddler: { title: "lar:///t/lararium", text: "lararium" } } });
const SNAPS = { lares: SNAP_LARES.cid, lararium: SNAP_LARARIUM.cid };
const manifestOf = (m: FloorManifest) => { const bytes = floorManifestBytes(m); return { m, bytes, cid: sha256HexBytesSync(bytes) }; };
const BASE = manifestOf({ format: FLOOR_MANIFEST_FORMAT, engine: ENGINE, plugins: OFFER1.cid, snapshots: SNAPS });
/** The seed's own floor: a newer offering, its own snapshots (never carried), the same engine. */
const SEED = manifestOf({ format: FLOOR_MANIFEST_FORMAT, engine: ENGINE, plugins: OFFER2.cid, snapshots: { lares: "c".repeat(64), lararium: "d".repeat(64) } });
const SEED_ENGINE_MOVED = manifestOf({ ...SEED.m, engine: "f".repeat(64) });
const RECEIPT = "5".repeat(64);
const genesisPin: FloorPin = { kind: FLOOR_PIN_KIND, nexus: NEXUS, release: null, manifest: BASE.cid };

function memoryHome(doc: LarDoc = emptyLarDoc()) { return { changes: 0, doc: () => doc, change(fn: (d: LarDoc) => void) { this.changes += 1; fn(doc); } }; }
function portsOver(home: ReturnType<typeof memoryHome>) {
  const cas = new Map<string, Uint8Array>([[BASE.cid, BASE.bytes], [SEED.cid, SEED.bytes], [SEED_ENGINE_MOVED.cid, SEED_ENGINE_MOVED.bytes],
    [OFFER1.cid, OFFER1.bytes], [OFFER2.cid, OFFER2.bytes], [G1.sha256, G1.bytes], [G2.sha256, G2.bytes], [SNAP_LARES.cid, SNAP_LARES.bytes], [SNAP_LARARIUM.cid, SNAP_LARARIUM.bytes]]);
  const staged: string[] = []; const alerts: string[] = [];
  const ports: FloorPinPorts = {
    home, nexus: NEXUS, genesisManifest: BASE.cid, requiredBlobIds: [LARES_MEMETIC_WIKITEXT_PLUGIN_URI],
    rows: async () => [], fetchCas: async (cid) => cas.get(cid) ?? null,
    stage: async (blobs) => { for (const b of blobs) { staged.push(b.cid); cas.set(b.cid, b.bytes); } },
    mount: { floorSwap: false, alert: (r) => { alerts.push(r.why); } },
  };
  return { ports, cas, staged, alerts };
}

describe("the local floor's shape", () => {
  test("RED: a local pin reads at its exact shape, names its base, and mounts its local manifest; CONTROL: a plain pin still reads", () => {
    const local: FloorPin = { ...genesisPin, manifest: "9".repeat(64), local: { base: BASE.cid, receipt: RECEIPT, prior: { release: null, manifest: BASE.cid, base: null, receipt: null }, state: "staged" } };
    expect(readFloorPin(JSON.parse(JSON.stringify(local)), NEXUS)).toEqual(local);
    expect(floorPinBase(local)).toBe(BASE.cid);
    expect(floorPinBase(genesisPin)).toBe(BASE.cid);
    expect(readFloorPin({ ...genesisPin }, NEXUS)).toEqual(genesisPin);
    expect(readFloorPin({ ...local, local: { ...local.local, state: "maybe" } }, NEXUS)).toBeNull();
    expect(readFloorPin({ ...local, local: { ...local.local, extra: 1 } }, NEXUS)).toBeNull();
    const doc = emptyLarDoc();
    writeFloorPin(doc, local);
    expect(floorPinOf(doc, NEXUS, BASE.cid)).toEqual({ pin: local, source: "accepted" });
    expect(floorCidToMount({ controlDoc: doc, nexus: NEXUS, genesis: BASE.cid })).toEqual({ cid: "9".repeat(64), source: "pin" });
  });
});

describe("the adopt decision", () => {
  test("RED: an adopt over the base carries the base's engine and snapshots, the seed's plugins, the receipt and the prior pin", () => {
    const d = decideFloorAdopt({ pin: genesisPin, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    expect(d.ok && d.moved).toBe(true);
    if (!d.ok || !d.moved) return;
    expect(readFloorManifest(d.manifestBytes)).toEqual({ manifest: { format: FLOOR_MANIFEST_FORMAT, engine: ENGINE, plugins: OFFER2.cid, snapshots: SNAPS } });
    expect(d.pin).toEqual({ kind: FLOOR_PIN_KIND, nexus: NEXUS, release: null, manifest: sha256HexBytesSync(d.manifestBytes),
      local: { base: BASE.cid, receipt: RECEIPT, prior: { release: null, manifest: BASE.cid, base: null, receipt: null }, state: "staged" } });
    expect(d.moves).toEqual(["plugins"]);
  });

  test("RED: the engine never adopts here; an uncommitted adopt refuses a second; a replay lands nothing", () => {
    expect(decideFloorAdopt({ pin: genesisPin, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED_ENGINE_MOVED.m } })).toMatchObject({ ok: false, refusal: "adopt-engine-held" });
    const first = decideFloorAdopt({ pin: genesisPin, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("first adopt");
    expect(decideFloorAdopt({ pin: first.pin, base: BASE.m, seed: { cid: "6".repeat(64), manifest: SEED.m } })).toMatchObject({ ok: false, refusal: "adopt-uncommitted" });
    const committed = commitLocalFloor(first.pin);
    if (!committed.ok) throw new Error("commit");
    expect(decideFloorAdopt({ pin: committed.pin, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } })).toMatchObject({ ok: true, moved: false });
    expect(decideFloorAdopt({ pin: genesisPin, base: BASE.m, seed: { cid: RECEIPT, manifest: BASE.m } })).toMatchObject({ ok: true, moved: false });
  });

  test("RED: commit lands at par; revert lands the prior back as a forward row; CONTROL: neither moves a plain pin", () => {
    const first = decideFloorAdopt({ pin: genesisPin, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("adopt");
    const c = commitLocalFloor(first.pin);
    expect(c).toMatchObject({ ok: true, moved: true, pin: { manifest: first.pin.manifest, local: { state: "committed" } } });
    expect(commitLocalFloor(c.ok ? c.pin : first.pin)).toMatchObject({ ok: true, moved: false });
    expect(revertLocalFloor(first.pin)).toEqual({ ok: true, moved: true, pin: genesisPin });
    expect(commitLocalFloor(genesisPin)).toMatchObject({ ok: false, refusal: "adopt-none-local" });
    expect(revertLocalFloor(genesisPin)).toMatchObject({ ok: false, refusal: "adopt-none-local" });
  });

  test("RED: a release accept over a local floor on its own base moves (the let-go), never reads held", () => {
    const releaseCid = "7".repeat(64);
    const standing = { standing: "released", head: { cid: releaseCid, body: { manifest: BASE.cid, prior: null } }, counted: [{ cid: releaseCid, body: { manifest: BASE.cid, prior: null } }], refused: [] } as unknown as FloorReleaseStanding;
    const onRelease: FloorPin = { ...genesisPin, release: releaseCid };
    const first = decideFloorAdopt({ pin: onRelease, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("adopt");
    expect(first.pin.release).toBe(releaseCid);
    expect(decideFloorAccept({ pin: first.pin, standing, target: releaseCid })).toMatchObject({ ok: true, moved: true, pin: { release: releaseCid, manifest: BASE.cid } });
    const after = decideFloorAccept({ pin: first.pin, standing, target: releaseCid });
    if (after.ok) expect(after.pin.local).toBeUndefined();
    expect(decideFloorAccept({ pin: onRelease, standing, target: releaseCid })).toMatchObject({ ok: true, moved: false });
  });
});

describe("the adopt door: previews, then applies by hand", () => {
  test("RED: the preview writes nothing; the apply stages the local manifest, moves the pin and raises the reboot alert", async () => {
    const home = memoryHome();
    const { ports, staged, alerts, cas } = portsOver(home);
    const preview = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: false });
    expect(preview).toMatchObject({ ok: true, moved: true, applied: false });
    expect(home.changes).toBe(0);
    expect(staged).toEqual([]);
    const applied = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    expect(applied).toMatchObject({ ok: true, moved: true, applied: true });
    if (!applied.ok || !applied.moved) return;
    expect(staged).toContain(applied.pin.manifest);
    expect(cas.get(applied.pin.manifest)).toBeDefined();
    expect(floorPinOf(home.doc(), NEXUS, BASE.cid).pin).toEqual(applied.pin);
    expect(alerts.length).toBe(1);
  });

  test("CONTROL: a seed floor whose bytes the vessel lacks refuses by name and lands nothing", async () => {
    const home = memoryHome();
    const { ports } = portsOver(home);
    const out = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: "0".repeat(64), apply: true });
    expect(out).toMatchObject({ ok: false, refusal: "floor-bytes-absent" });
    expect(home.changes).toBe(0);
  });
});

describe("the cold read's answers (#577, S2)", () => {
  test("RED: a bare accept never lets a local floor go; only the named release does", () => {
    const releaseCid = "7".repeat(64);
    const standing = { standing: "released", head: { cid: releaseCid, body: { manifest: BASE.cid, prior: null } }, counted: [{ cid: releaseCid, body: { manifest: BASE.cid, prior: null } }], refused: [] } as unknown as FloorReleaseStanding;
    const first = decideFloorAdopt({ pin: { ...genesisPin, release: releaseCid }, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("adopt");
    expect(decideFloorAccept({ pin: first.pin, standing })).toMatchObject({ ok: true, moved: false });
    expect(decideFloorAccept({ pin: first.pin, standing, target: releaseCid })).toMatchObject({ ok: true, moved: true });
  });

  test("RED: a local row whose prior names another release reads torn", () => {
    const local: FloorPin = { ...genesisPin, manifest: "9".repeat(64), local: { base: BASE.cid, receipt: RECEIPT, prior: { release: "1".repeat(64), manifest: BASE.cid, base: null, receipt: null }, state: "staged" } };
    expect(readFloorPin(JSON.parse(JSON.stringify(local)), NEXUS)).toBeNull();
  });

  test("RED: an adopt refuses where the vessel holds pins at another Nexus (the mount would drop to genesis)", async () => {
    const home = memoryHome();
    writeFloorPin(home.doc(), { kind: FLOOR_PIN_KIND, nexus: "other-nexus", release: "2".repeat(64), manifest: BASE.cid });
    const { ports } = portsOver(home);
    const before = home.changes;
    expect(await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true })).toMatchObject({ ok: false, refusal: "adopt-many-floors" });
    expect(home.changes).toBe(before);
  });

  test("RED: an adopt whose local manifest would not resolve whole (a base snapshot absent) refuses before the pin moves", async () => {
    const home = memoryHome();
    const { ports, cas } = portsOver(home);
    cas.delete(SNAP_LARARIUM.cid);
    const out = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    expect(out).toMatchObject({ ok: false, refusal: "floor-bytes-absent" });
    expect(home.changes).toBe(0);
  });
});

describe("the house restands itself, and the boot after settles by par", () => {
  test("RED: an apply whose vessel binds a restand asks it with the staged manifest and raises no alert; its why names no next boot", async () => {
    const home = memoryHome();
    const { ports, alerts } = portsOver(home);
    const restands: string[] = [];
    const out = await adoptFloorSeed({ ...ports, mount: { ...ports.mount, restand: (m) => { restands.push(m); } } }, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    expect(out).toMatchObject({ ok: true, moved: true, applied: true, remount: { act: "restand" } });
    if (!out.ok || !out.moved) return;
    expect(restands).toEqual([out.pin.manifest]);
    expect(alerts).toEqual([]);
    const why = out.remount?.act === "restand" ? out.remount.why : "";
    expect(why).toMatch(/restands itself at its next quiet point/);
    expect(why).not.toMatch(/next boot/);
    // CONTROL: the restand never rides a preview, and a vessel that binds none raises the alert as before.
    expect(floorRemountDecision({ floorSwap: false }, "a".repeat(64))).toMatchObject({ act: "alert" });
    expect(floorRemountDecision({ floorSwap: true, restand: true }, "a".repeat(64))).toEqual({ act: "swap-live" });
  });

  test("RED: a boot whose daemon mount stood on the staged floor commits it under one receipt naming the floor, the seed and par", async () => {
    const home = memoryHome();
    const { ports } = portsOver(home);
    const applied = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    if (!applied.ok || !applied.moved) throw new Error("apply");
    const settle = settleFloorAtBoot(home, { source: "floor", manifest: applied.pin.manifest });
    expect(settle).toMatchObject({ act: "committed", receipt: { kind: FLOOR_SETTLE_KIND, nexus: NEXUS, act: "committed", floor: applied.pin.manifest, seed: RECEIPT, par: "par", pinned: applied.pin.manifest } });
    expect(floorPinOf(home.doc(), NEXUS, BASE.cid).pin.local?.state).toBe("committed");
    expect(readFloorSettle(home.doc(), NEXUS)).toMatchObject({ act: "committed", floor: applied.pin.manifest, seed: RECEIPT, par: "par" });
    // A second boot finds nothing staged and lands nothing.
    const before = home.changes;
    expect(settleFloorAtBoot(home, { source: "floor", manifest: applied.pin.manifest })).toEqual({ act: "none" });
    expect(home.changes).toBe(before);
  });

  test("RED: a boot whose mount fell back (or stood on another floor) reverts to the prior floor and names why in the receipt", async () => {
    for (const mount of [
      { source: "island" as const, manifest: "x".repeat(64), why: "floor-offering-incomplete: a blob reads absent" },
      { source: "floor" as const, manifest: BASE.cid },
      null,
    ]) {
      const home = memoryHome();
      const { ports, cas } = portsOver(home);
      const applied = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
      if (!applied.ok || !applied.moved) throw new Error("apply");
      const settle = settleFloorAtBoot(home, mount);
      expect(settle.act).toBe("reverted");
      if (settle.act !== "reverted") continue;
      expect(settle.cause.length).toBeGreaterThan(0);
      if (mount?.source === "island") expect(settle.cause).toContain("floor-offering-incomplete");
      expect(floorPinOf(home.doc(), NEXUS, BASE.cid).pin).toEqual(genesisPin);
      expect(readFloorSettle(home.doc(), NEXUS)).toMatchObject({ act: "reverted", floor: applied.pin.manifest, seed: RECEIPT, par: settle.cause, pinned: BASE.cid });
      // The staged floor's bytes stay for the hand to read.
      expect(cas.get(applied.pin.manifest)).toBeDefined();
    }
  });

  test("CONTROL: a boot with no staged floor (a plain pin, or a committed one) settles nothing and writes nothing", () => {
    const home = memoryHome();
    writeFloorPin(home.doc(), genesisPin);
    const before = home.changes;
    expect(settleFloorAtBoot(home, null)).toEqual({ act: "none" });
    expect(home.changes).toBe(before);
    expect(readFloorSettle(home.doc(), NEXUS)).toBeNull();
  });
});
