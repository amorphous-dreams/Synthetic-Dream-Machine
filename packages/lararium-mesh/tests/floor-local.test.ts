/**
 * floor-local (3d, follow-lei S2) — THE LOCAL FLOOR. The accept grows a local form over its base: the local manifest it mounts (the
 * base's engine and canon snapshots, the adopted seed's plugins offering), the base its descent walks from, a receipt (the adopted
 * seed's CID) and the prior accept kept alive. An adopt moves forward only and never stacks on an uncommitted one; the engine never
 * adopts here (held). A commit lands at par; a revert lands the prior back as a forward row, never a deletion. A release accept
 * over a local floor moves (the let-go), never reads as held.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync, utf8Bytes } from "../src/crypto.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { FLOOR_MANIFEST_FORMAT, cutFloorSnapshot, floorManifestBytes, readFloorManifest, type FloorManifest } from "../src/floor-manifest.js";
import { signFloorOffering } from "../src/floor-offering.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import {
  FLOOR_ACCEPT_KIND, adoptFloorSeed, commitLocalFloor, decideFloorAccept, decideFloorAdopt, floorToMount, floorAcceptBase, floorAcceptOf,
  readFloorAccept, revertLocalFloor, writeFloorAccept, type FloorAccept, type FloorAcceptPorts,
} from "../src/floor-accept.js";
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
const genesisAccept: FloorAccept = { kind: FLOOR_ACCEPT_KIND, nexus: NEXUS, release: null, manifest: BASE.cid, took: [] };

function memoryHome(doc: LarDoc = emptyLarDoc()) { return { changes: 0, doc: () => doc, change(fn: (d: LarDoc) => void) { this.changes += 1; fn(doc); } }; }
function portsOver(home: ReturnType<typeof memoryHome>) {
  const cas = new Map<string, Uint8Array>([[BASE.cid, BASE.bytes], [SEED.cid, SEED.bytes], [SEED_ENGINE_MOVED.cid, SEED_ENGINE_MOVED.bytes],
    [OFFER1.cid, OFFER1.bytes], [OFFER2.cid, OFFER2.bytes], [G1.sha256, G1.bytes], [G2.sha256, G2.bytes], [SNAP_LARES.cid, SNAP_LARES.bytes], [SNAP_LARARIUM.cid, SNAP_LARARIUM.bytes]]);
  const staged: string[] = []; const alerts: string[] = [];
  const ports: FloorAcceptPorts = {
    home, nexus: NEXUS, genesisManifest: BASE.cid, requiredBlobIds: [LARES_MEMETIC_WIKITEXT_PLUGIN_URI],
    rows: async () => [], fetchCas: async (cid) => cas.get(cid) ?? null,
    stage: async (blobs) => { for (const b of blobs) { staged.push(b.cid); cas.set(b.cid, b.bytes); } },
    mount: { floorSwap: false, alert: (r) => { alerts.push(r.why); } },
  };
  return { ports, cas, staged, alerts };
}

describe("the local floor's shape", () => {
  test("RED: a local accept reads at its exact shape, names its base, and mounts its local manifest; CONTROL: a plain accept still reads", () => {
    const local: FloorAccept = { ...genesisAccept, manifest: "9".repeat(64), local: { base: BASE.cid, receipt: RECEIPT, prior: { release: null, manifest: BASE.cid, base: null, receipt: null }, state: "staged" } };
    expect(readFloorAccept(JSON.parse(JSON.stringify(local)), NEXUS)).toEqual(local);
    expect(floorAcceptBase(local)).toBe(BASE.cid);
    expect(floorAcceptBase(genesisAccept)).toBe(BASE.cid);
    expect(readFloorAccept({ ...genesisAccept }, NEXUS)).toEqual(genesisAccept);
    expect(readFloorAccept({ ...local, local: { ...local.local, state: "maybe" } }, NEXUS)).toBeNull();
    expect(readFloorAccept({ ...local, local: { ...local.local, extra: 1 } }, NEXUS)).toBeNull();
    const doc = emptyLarDoc();
    writeFloorAccept(doc, local);
    expect(floorAcceptOf(doc, NEXUS, BASE.cid)).toEqual({ accept: local, source: "accepted" });
    expect(floorToMount({ accepts: doc, pick: { nexus: NEXUS }, genesis: BASE.cid })).toEqual({ cid: "9".repeat(64), standing: "accepted", nexus: NEXUS });
  });
});

describe("the adopt decision", () => {
  test("RED: an adopt over the base carries the base's engine and snapshots, the seed's plugins, the receipt and the prior accept", () => {
    const d = decideFloorAdopt({ accept: genesisAccept, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    expect(d.ok && d.moved).toBe(true);
    if (!d.ok || !d.moved) return;
    expect(readFloorManifest(d.manifestBytes)).toEqual({ manifest: { format: FLOOR_MANIFEST_FORMAT, engine: ENGINE, plugins: OFFER2.cid, snapshots: SNAPS } });
    expect(d.accept).toEqual({ kind: FLOOR_ACCEPT_KIND, nexus: NEXUS, release: null, manifest: sha256HexBytesSync(d.manifestBytes), took: [],
      local: { base: BASE.cid, receipt: RECEIPT, prior: { release: null, manifest: BASE.cid, base: null, receipt: null }, state: "staged" } });
    expect(d.moves).toEqual(["plugins"]);
  });

  test("RED: the engine never adopts here; an uncommitted adopt refuses a second; a replay lands nothing", () => {
    expect(decideFloorAdopt({ accept: genesisAccept, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED_ENGINE_MOVED.m } })).toMatchObject({ ok: false, refusal: "adopt-engine-held" });
    const first = decideFloorAdopt({ accept: genesisAccept, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("first adopt");
    expect(decideFloorAdopt({ accept: first.accept, base: BASE.m, seed: { cid: "6".repeat(64), manifest: SEED.m } })).toMatchObject({ ok: false, refusal: "adopt-uncommitted" });
    const committed = commitLocalFloor(first.accept);
    if (!committed.ok) throw new Error("commit");
    expect(decideFloorAdopt({ accept: committed.accept, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } })).toMatchObject({ ok: true, moved: false });
    expect(decideFloorAdopt({ accept: genesisAccept, base: BASE.m, seed: { cid: RECEIPT, manifest: BASE.m } })).toMatchObject({ ok: true, moved: false });
  });

  test("RED: commit lands at par; revert lands the prior back as a forward row; CONTROL: neither moves a plain accept", () => {
    const first = decideFloorAdopt({ accept: genesisAccept, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("adopt");
    const c = commitLocalFloor(first.accept);
    expect(c).toMatchObject({ ok: true, moved: true, accept: { manifest: first.accept.manifest, local: { state: "committed" } } });
    expect(commitLocalFloor(c.ok ? c.accept : first.accept)).toMatchObject({ ok: true, moved: false });
    expect(revertLocalFloor(first.accept)).toEqual({ ok: true, moved: true, accept: genesisAccept });
    expect(commitLocalFloor(genesisAccept)).toMatchObject({ ok: false, refusal: "adopt-none-local" });
    expect(revertLocalFloor(genesisAccept)).toMatchObject({ ok: false, refusal: "adopt-none-local" });
  });

  test("RED: a release accept over a local floor on its own base moves (the let-go), never reads held", () => {
    const releaseCid = "7".repeat(64);
    const standing = { standing: "released", head: { cid: releaseCid, body: { manifest: BASE.cid, prior: null } }, counted: [{ cid: releaseCid, body: { manifest: BASE.cid, prior: null } }], refused: [] } as unknown as FloorReleaseStanding;
    const onRelease: FloorAccept = { ...genesisAccept, release: releaseCid };
    const first = decideFloorAdopt({ accept: onRelease, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("adopt");
    expect(first.accept.release).toBe(releaseCid);
    expect(decideFloorAccept({ accept: first.accept, standing, target: releaseCid })).toMatchObject({ ok: true, moved: true, accept: { release: releaseCid, manifest: BASE.cid } });
    const after = decideFloorAccept({ accept: first.accept, standing, target: releaseCid });
    if (after.ok) expect(after.accept.local).toBeUndefined();
    expect(decideFloorAccept({ accept: onRelease, standing, target: releaseCid })).toMatchObject({ ok: true, moved: false });
  });
});

describe("the adopt door: previews, then applies by hand", () => {
  test("RED: the preview writes nothing; the apply stages the local manifest, moves the accept and raises the reboot alert", async () => {
    const home = memoryHome();
    const { ports, staged, alerts, cas } = portsOver(home);
    const preview = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: false });
    expect(preview).toMatchObject({ ok: true, moved: true, applied: false });
    expect(home.changes).toBe(0);
    expect(staged).toEqual([]);
    const applied = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    expect(applied).toMatchObject({ ok: true, moved: true, applied: true });
    if (!applied.ok || !applied.moved) return;
    expect(staged).toContain(applied.accept.manifest);
    expect(cas.get(applied.accept.manifest)).toBeDefined();
    expect(floorAcceptOf(home.doc(), NEXUS, BASE.cid).accept).toEqual(applied.accept);
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
    const first = decideFloorAdopt({ accept: { ...genesisAccept, release: releaseCid }, base: BASE.m, seed: { cid: RECEIPT, manifest: SEED.m } });
    if (!first.ok || !first.moved) throw new Error("adopt");
    expect(decideFloorAccept({ accept: first.accept, standing })).toMatchObject({ ok: true, moved: false });
    expect(decideFloorAccept({ accept: first.accept, standing, target: releaseCid })).toMatchObject({ ok: true, moved: true });
  });

  test("RED: a local row whose prior names another release reads torn", () => {
    const local: FloorAccept = { ...genesisAccept, manifest: "9".repeat(64), local: { base: BASE.cid, receipt: RECEIPT, prior: { release: "1".repeat(64), manifest: BASE.cid, base: null, receipt: null }, state: "staged" } };
    expect(readFloorAccept(JSON.parse(JSON.stringify(local)), NEXUS)).toBeNull();
  });

  test("RED: a local floor adopts at one Nexus while another Nexus holds an accept, and that other accept and its mount stay", async () => {
    const home = memoryHome();
    const other = { kind: FLOOR_ACCEPT_KIND, nexus: "other-nexus", release: "2".repeat(64), manifest: "8".repeat(64), took: ["2".repeat(64)] } as const;
    writeFloorAccept(home.doc(), other);
    const { ports } = portsOver(home);
    const applied = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    expect(applied).toMatchObject({ ok: true, moved: true, applied: true });
    if (!applied.ok || !applied.moved) return;
    expect(floorAcceptOf(home.doc(), "other-nexus", BASE.cid)).toEqual({ accept: other, source: "accepted" });
    expect(floorToMount({ accepts: home.doc(), pick: { nexus: "other-nexus" }, genesis: BASE.cid })).toEqual({ cid: "8".repeat(64), standing: "accepted", nexus: "other-nexus" });
    expect(floorToMount({ accepts: home.doc(), pick: { nexus: NEXUS }, genesis: BASE.cid })).toEqual({ cid: applied.accept.manifest, standing: "accepted", nexus: NEXUS });
  });

  test("RED: an adopt whose local manifest would not resolve whole (a base snapshot absent) refuses before the accept moves", async () => {
    const home = memoryHome();
    const { ports, cas } = portsOver(home);
    cas.delete(SNAP_LARARIUM.cid);
    const out = await adoptFloorSeed(ports, { seedCid: RECEIPT, seedFloor: SEED.cid, apply: true });
    expect(out).toMatchObject({ ok: false, refusal: "floor-bytes-absent" });
    expect(home.changes).toBe(0);
  });
});
