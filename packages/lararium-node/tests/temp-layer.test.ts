/**
 * temp-layer — the USER temp layer on disk: a consented row lands, an unconsented one never does, the volatile VM plane
 * and the house's internal state never do; read-back restores a carrier before the projector's first pass;
 * housekeeping removes an orphan temp and a settled obsolete carrier and spares an edited, a pending and a sole-copy
 * file; opt-in expiry moves to the trash and purges after the window; the audit holds one content-free line per act.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { volatileVmUri, wikiSlotUri } from "@lararium/mesh";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { daemonDiskMirrors, isTempLayerInternalTitle } from "../src/bag-paths.js";
import { parseTidCarrier, readBackTempCarriers, TempLayerHousekeeper, tempAuditPath, TEMP_ORPHAN_SETTLE_MS } from "../src/temp-layer.js";
import type { TempHousekeepingClock, TempHousekeepingPolicy } from "../src/temp-layer.js";
import { tempConsentedSlugs, tempExpiryDays, tempProjectionConsented } from "../src/lares-config.js";

const SLUG = "notes";
const BAG = wikiSlotUri(SLUG, "temp");
const DAY = 24 * 60 * 60 * 1000;
const ORIGIN = { kind: "operator-import" as const, sessionId: "test" };

let scratch = "";
afterEach(() => { if (scratch) { rmSync(scratch, { recursive: true, force: true }); scratch = ""; } });

/** The draft recovery render: the field block, a blank line, the text. */
function tidOf(fields: Record<string, unknown>): string {
  const head = Object.keys(fields).filter((k) => k !== "text").sort().map((k) => `${k}: ${String(fields[k])}`).join("\n");
  return `${head}\n\n${typeof fields["text"] === "string" ? fields["text"] : ""}`;
}

interface Rig {
  readonly projections: string;
  readonly mirrorRoot: string;
  readonly store: MemoryTiddlerStore;
  readonly tree: SyncedTree;
  readonly projector: LarDiskProjector;
  reconcile(uri: string): Promise<void>;
}

function rig(store = new MemoryTiddlerStore(BAG)): Rig {
  scratch = mkdtempSync(join(tmpdir(), "lar-temp-layer-"));
  const projections = join(scratch, "projections");
  const mirrorRoot = join(projections, "wikis", SLUG, "temp");
  const tree = new SyncedTree(join(scratch, "synced-tree"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot, mirrorClass: "recovery", tempLayer: true }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === BAG ? store : null,
    recoveryFileFn: async (fields) => ({ ext: ".tid", body: tidOf(fields), defaultRelPath: `${encodeURIComponent(String(fields["title"]))}.tid` }),
    syncedTree: tree,
    // The composition's word on which bags hold a carrier: the temp layer, while its record lives.
    bagsHolding: async (uri) => { const rec = await store.get(uri); return rec !== null && !rec.meta?.deleted ? [BAG] : []; },
    onRefusal: (info) => { throw new Error(`refused: ${info.reason}`); },
    onConflict: (info) => { throw new Error(`conflict: ${info.reason}`); },
  });
  (projector as unknown as { _tw5: unknown })._tw5 = { $tw: { wiki: { getTiddler: () => undefined } } };
  const reconcile = (projector as unknown as { reconcile: (uri: string) => Promise<void> }).reconcile.bind(projector);
  return { projections, mirrorRoot, store, tree, projector, reconcile };
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => join(d.parentPath, d.name));
}

/** A clock that never schedules: each test calls `run` by hand. */
function clockAt(ms: number): TempHousekeepingClock & { set(ms: number): void } {
  let now = ms;
  return { now: () => now, every: () => () => {}, set: (t) => { now = t; } };
}

function housekeeper(r: Rig, clock: TempHousekeepingClock, policy: () => TempHousekeepingPolicy, open: Set<string> = new Set()): TempLayerHousekeeper {
  return new TempLayerHousekeeper({
    bagId: BAG, slug: SLUG, mirrorRoot: r.mirrorRoot, projectionsRoot: r.projections, policy, clock,
    record: async (title) => { const rec = await r.store.get(title); return rec === null ? "absent" : rec.meta?.deleted ? "gone" : "live"; },
    lastWritten: (title, path) => r.tree.baseAt(syncedTreeKey(BAG, title), path)?.disk ?? null,
    forget: (title, path) => r.tree.deleteAt(syncedTreeKey(BAG, title), path),
    holdsOpen: (title) => open.has(title),
  });
}

function auditLines(r: Rig, ms: number): Array<Record<string, unknown>> {
  const path = tempAuditPath(r.projections, new Date(ms).toISOString().slice(0, 10));
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
}

const fileOf = (r: Rig, title: string): string | undefined =>
  filesUnder(r.mirrorRoot).find((f) => f.endsWith(".tid") && parseTidCarrier(readFileSync(f, "utf8"))?.title === title);

describe("the consent grant", () => {
  const grant: DiskMirrorGrant = [
    { bagId: "temp", mirrorRoot: "/p/wikis", scope: "temp", wikiSlot: "temp", mirrorClass: "recovery", consentSlugs: [SLUG] },
  ];

  test("a consented slug's recipe-designated temp layer resolves to wikis/<slug>/temp, marked as the temp layer", () => {
    expect(resolveDiskMirrors(grant, [BAG], SLUG)).toEqual([
      { bagId: BAG, mirrorRoot: `/p/wikis/${SLUG}/temp`, scope: "temp", wikiSlot: "temp", mirrorClass: "recovery", tempLayer: true },
    ]);
  });

  test("an unconsented slug, or a recipe that designates no temp layer, resolves to nothing", () => {
    expect(resolveDiskMirrors(grant, [wikiSlotUri("other", "temp")], "other")).toEqual([]);
    expect(resolveDiskMirrors(grant, [], SLUG)).toEqual([]);
  });

  test("the consent rows read by slug from the config; a malformed row throws", () => {
    const cfg = { projection: { temp: { notes: true, other: false }, tempExpiryDays: { notes: 7 } } };
    expect(tempConsentedSlugs(cfg)).toEqual(["notes"]);
    expect(tempProjectionConsented(cfg, "other")).toBe(false);
    expect(tempProjectionConsented({}, "notes")).toBe(false);
    expect(tempExpiryDays(cfg, "notes")).toBe(7);
    expect(tempExpiryDays(cfg, "other")).toBeNull();
    expect(() => tempConsentedSlugs({ projection: { temp: { notes: "yes" } } } as never)).toThrow(/projection\.temp\.notes/);
    expect(() => tempExpiryDays({ projection: { tempExpiryDays: { notes: 0 } } }, "notes")).toThrow(/whole number of days/);
  });

  test("the daemon wiki's temp mirror stands beside its working top only under consent", () => {
    const face = "0b0e7f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
    const base = { projectionRoot: "/p", canonBags: "/canon", faceRelation: face };
    expect(daemonDiskMirrors(base).some((m) => m.bagId === wikiSlotUri("daemon", "temp"))).toBe(false);
    const temp = daemonDiskMirrors({ ...base, temp: true }).find((m) => m.bagId === wikiSlotUri("daemon", "temp"));
    expect(temp).toMatchObject({ mirrorRoot: `/p/wikis/daemon-${face}/temp`, mirrorClass: "recovery", tempLayer: true });
  });
});

describe("projection", () => {
  test("a consented temp row lands on disk under wikis/<slug>/temp", async () => {
    const r = rig();
    await r.store.put({ tiddler: { title: "Shopping", text: "eggs" } }, ORIGIN);
    await r.reconcile("Shopping");
    const file = fileOf(r, "Shopping");
    expect(file, "the row lands").toBeDefined();
    expect(readFileSync(file!, "utf8")).toContain("eggs");
  });

  test("an unconsented wiki holds no temp mirror, so nothing lands", async () => {
    scratch = mkdtempSync(join(tmpdir(), "lar-temp-layer-"));
    const store = new MemoryTiddlerStore(BAG);
    const grant: DiskMirrorGrant = [{ bagId: "temp", mirrorRoot: join(scratch, "wikis"), scope: "temp", wikiSlot: "temp", mirrorClass: "recovery", consentSlugs: [] }];
    const mirrors = resolveDiskMirrors(grant, [BAG], SLUG);
    const projector = new LarDiskProjector({
      mirrors, carrierFileFn: async () => null,
      recoveryStore: (bag) => bag === BAG ? store : null,
      recoveryFileFn: async (fields) => ({ ext: ".tid", body: tidOf(fields), defaultRelPath: "x.tid" }),
    });
    (projector as unknown as { _tw5: unknown })._tw5 = { $tw: { wiki: { getTiddler: () => undefined } } };
    await store.put({ tiddler: { title: "Shopping", text: "eggs" } }, ORIGIN);
    await (projector as unknown as { reconcile: (uri: string) => Promise<void> }).reconcile("Shopping");
    expect(filesUnder(scratch)).toEqual([]);
  });

  test("a VM-volatile title and the house's internal state never land, by namespace", async () => {
    const r = rig();
    const barred = [volatileVmUri("verb/save"), "$:/state/popup/x", "$:/temp/lares/alert/k", "lar:///ha.ka.ba/lararium/config/current-wiki-bag"];
    for (const title of barred) {
      expect(isTempLayerInternalTitle(title), title).toBe(true);
      r.store._seed({ tiddler: { title, text: "internal" } });
      await r.reconcile(title);
    }
    expect(filesUnder(r.projections)).toEqual([]);
    expect(isTempLayerInternalTitle("lar:///notes.scratch.held/today")).toBe(false);
  });
});

describe("read-back", () => {
  test("a temp carrier reads back into the layer; the observe plane and internal titles refuse", async () => {
    const r = rig();
    await r.store.put({ tiddler: { title: "Shopping", text: "eggs\nmilk", tags: "[[to do]]" } }, ORIGIN);
    await r.reconcile("Shopping");
    mkdirSync(r.mirrorRoot, { recursive: true });
    writeFileSync(join(r.mirrorRoot, "internal.tid"), "title: $:/state/x\n\ninternal");
    writeFileSync(join(r.mirrorRoot, "x.tid.lar-tmp-123"), "title: torn\n\nhalf");

    const fresh = new MemoryTiddlerStore(BAG);
    const read = readBackTempCarriers({
      mirrorRoot: r.mirrorRoot, projectionsRoot: r.projections,
      holds: (t) => fresh.readNow(t).record !== null,
      put: (fields) => { void fresh.put({ tiddler: fields }, ORIGIN); },
    });
    expect(read).toEqual({ read: 1, refused: 1 });
    expect(fresh.readNow("Shopping").record?.tiddler).toMatchObject({ title: "Shopping", text: "eggs\nmilk", tags: "[[to do]]" });
    expect(fresh.readNow("torn").record).toBeNull();

    const observe = join(r.projections, "observe", "daemon");
    mkdirSync(observe, { recursive: true });
    writeFileSync(join(observe, "a.tid"), "title: A\n\nx");
    expect(readBackTempCarriers({ mirrorRoot: observe, projectionsRoot: r.projections, holds: () => false, put: () => { throw new Error("no"); } }))
      .toEqual({ read: 0, refused: 1 });
  });
});

describe("housekeeping", () => {
  test("removes an orphan .lar-tmp and a settled obsolete carrier; spares an edited, a pending and a sole-copy file", async () => {
    const r = rig();
    for (const title of ["Gone", "Edited", "Pending", "Sole", "Kept"]) {
      await r.store.put({ tiddler: { title, text: `${title} words` } }, ORIGIN);
      await r.reconcile(title);
    }
    const now = Date.parse("2026-11-08T12:00:00Z");
    // Gone: the record left the layer (a tombstone) while the projector stood away; its file stands as last written.
    await r.store.tombstone("Gone", ORIGIN);
    // Edited: a hand changed the bytes.
    writeFileSync(fileOf(r, "Edited")!, "title: Edited\n\nhand words");
    // Sole: the layer holds no word of it (a restart before read-back).
    await r.store.remove("Sole", ORIGIN);
    // An orphan atomic temp, settled long ago, and a fresh one a write may still hold.
    const orphan = join(r.mirrorRoot, "Kept.tid.lar-tmp-999");
    writeFileSync(orphan, "torn");
    utimesSync(orphan, new Date(now - TEMP_ORPHAN_SETTLE_MS - 1000), new Date(now - TEMP_ORPHAN_SETTLE_MS - 1000));
    const fresh = join(r.mirrorRoot, "Kept.tid.lar-tmp-1000");
    writeFileSync(fresh, "in flight");
    utimesSync(fresh, new Date(now), new Date(now));

    await housekeeper(r, clockAt(now), () => ({ consent: true, expiryDays: null }), new Set(["Pending"])).run();

    expect(existsSync(orphan), "the settled orphan goes").toBe(false);
    expect(existsSync(fresh), "a fresh temp may hold a write in flight").toBe(true);
    expect(fileOf(r, "Gone"), "the settled obsolete carrier goes").toBeUndefined();
    expect(r.tree.base(syncedTreeKey(BAG, "Gone")), "its base leaves with it").toBeNull();
    expect(fileOf(r, "Edited"), "an edited file stays").toBeDefined();
    expect(fileOf(r, "Pending"), "a pending file stays").toBeDefined();
    expect(fileOf(r, "Sole"), "a sole copy stays").toBeDefined();
    expect(fileOf(r, "Kept"), "a live consented carrier stays").toBeDefined();

    const lines = auditLines(r, now);
    expect(lines.map((l) => l["action"]).sort()).toEqual(["obsolete-removed", "orphan-removed"]);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(["action", "bag", "id", "outcome", "ts"]);
      expect(line).toMatchObject({ bag: SLUG, outcome: "ok", ts: new Date(now).toISOString() });
      expect(String(line["id"])).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    const raw = readFileSync(tempAuditPath(r.projections, "2026-11-08"), "utf8");
    expect(raw).not.toContain("Gone");
    expect(raw).not.toContain("words");
    expect(lines.find((l) => l["action"] === "obsolete-removed")!["id"]).toBe(`sha256:${createHash("sha256").update("Gone").digest("hex")}`);
  });

  test("a withdrawn consent removes the settled carriers of live records and spares the sole copies", async () => {
    const r = rig();
    for (const title of ["Live", "Sole"]) {
      await r.store.put({ tiddler: { title, text: "x" } }, ORIGIN);
      await r.reconcile(title);
    }
    await r.store.remove("Sole", ORIGIN);
    const now = Date.parse("2026-11-08T12:00:00Z");
    await housekeeper(r, clockAt(now), () => ({ consent: false, expiryDays: null })).run();
    expect(fileOf(r, "Live")).toBeUndefined();
    expect(fileOf(r, "Sole")).toBeDefined();
    expect(auditLines(r, now).map((l) => l["action"])).toEqual(["obsolete-removed"]);
  });

  test("a policy the config cannot answer skips the run whole", async () => {
    const r = rig();
    await r.store.put({ tiddler: { title: "Live", text: "x" } }, ORIGIN);
    await r.reconcile("Live");
    const errors: unknown[] = [];
    const h = new TempLayerHousekeeper({
      bagId: BAG, slug: SLUG, mirrorRoot: r.mirrorRoot, projectionsRoot: r.projections, clock: clockAt(0),
      policy: () => { throw new Error("malformed"); },
      record: async () => "live", lastWritten: () => null, forget: () => {}, holdsOpen: () => false, onError: (e) => errors.push(e),
    });
    await h.run();
    expect(errors).toHaveLength(1);
    expect(fileOf(r, "Live")).toBeDefined();
  });

  test("the schedule runs at start and then once per period, on the injected scheduler", async () => {
    const r = rig();
    let tick: (() => void) | null = null;
    let periods: number[] = [];
    let runs = 0;
    const clock: TempHousekeepingClock = { now: () => 0, every: (ms, fn) => { periods.push(ms); tick = fn; return () => { tick = null; }; } };
    const h = new TempLayerHousekeeper({
      bagId: BAG, slug: SLUG, mirrorRoot: r.mirrorRoot, projectionsRoot: r.projections, clock,
      policy: () => { runs++; return { consent: true, expiryDays: null }; },
      record: async () => "live", lastWritten: () => null, forget: () => {}, holdsOpen: () => false,
    });
    h.start();
    await h.stop().then(() => { h.start(); });   // the first run settles; a restart re-arms
    expect(periods).toEqual([DAY, DAY]);
    tick!();
    await h.stop();
    expect(runs).toBe(3);
    expect(tick).toBeNull();
    periods = [];
  });
});

describe("opt-in expiry", () => {
  test("an aged settled carrier moves to the trash, then purges after the same window", async () => {
    const r = rig();
    await r.store.put({ tiddler: { title: "Old", text: "aged words" } }, ORIGIN);
    await r.reconcile("Old");
    await r.store.put({ tiddler: { title: "New", text: "fresh words" } }, ORIGIN);
    await r.reconcile("New");
    const written = Date.parse("2026-11-01T12:00:00Z");
    utimesSync(fileOf(r, "Old")!, new Date(written), new Date(written));
    const now = Date.parse("2026-11-08T13:00:00Z");
    utimesSync(fileOf(r, "New")!, new Date(now), new Date(now));
    const clock = clockAt(now);
    const policy = (): TempHousekeepingPolicy => ({ consent: true, expiryDays: 7 });

    const unopted = housekeeper(r, clock, () => ({ consent: true, expiryDays: null }));
    await unopted.run();
    expect(fileOf(r, "Old"), "no window named, no expiry").toBeDefined();

    await housekeeper(r, clock, policy).run();
    expect(fileOf(r, "Old")).toBeUndefined();
    expect(fileOf(r, "New")).toBeDefined();
    const trashed = join(r.projections, "trash", "2026-11-08", "wikis", SLUG, "temp");
    const inTrash = filesUnder(trashed);
    expect(inTrash).toHaveLength(1);
    expect(readFileSync(inTrash[0]!, "utf8")).toContain("aged words");

    clock.set(Date.parse("2026-11-14T12:00:00Z"));
    await housekeeper(r, clock, policy).run();
    expect(filesUnder(trashed), "inside the window the trash holds").toHaveLength(1);

    clock.set(Date.parse("2026-11-15T12:00:00Z"));
    await housekeeper(r, clock, policy).run();
    expect(existsSync(join(r.projections, "trash", "2026-11-08")), "past the window the day purges").toBe(false);

    expect(auditLines(r, now).map((l) => l["action"])).toEqual(["expired-to-trash"]);
    expect(auditLines(r, Date.parse("2026-11-15T12:00:00Z")).map((l) => l["action"])).toEqual(["trash-purged"]);
  });
});

describe("the mount", () => {
  test("a consented temp mirror reads its carriers back before the first pass, projects new user rows, and bars internal state", async () => {
    const { CompositeStore } = await import("@lararium/mesh");
    const { TW5Engine } = await import("../../lararium-tw5/src/tw5-vm.js");
    const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import("../../lararium-tw5/src/generated-tw5-version.js");
    const { mountDiskProjection, mountedDiskProjector } = await import("../src/island-behaviors.js");
    const { larProjectionsHome } = await import("../src/vessel-paths.js");
    const mirrorRoot = join(larProjectionsHome(), "wikis", SLUG, "temp");
    rmSync(mirrorRoot, { recursive: true, force: true });
    mkdirSync(mirrorRoot, { recursive: true });
    const { larConfigHome } = await import("../src/vessel-paths.js");
    const configPath = join(larConfigHome(), "config.json");
    const configBefore = existsSync(configPath) ? readFileSync(configPath, "utf8") : null;
    mkdirSync(larConfigHome(), { recursive: true });
    writeFileSync(configPath, JSON.stringify({ projection: { temp: { [SLUG]: true } } }));
    const kept = join(mirrorRoot, "Kept%20note.tid");
    writeFileSync(kept, "title: Kept note\n\nwords from before the restart");

    const temp = new MemoryTiddlerStore(BAG);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG, store: temp, writable: true });
    const engine = new TW5Engine();
    await engine.boot(new Uint8Array(readFileSync(join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME))));
    const stop = mountDiskProjection({ recipe: { wikiSlug: SLUG }, diskMirrors: [
      { bagId: BAG, mirrorRoot, scope: "temp", mirrorClass: "recovery", tempLayer: true },
    ] } as never, { tw5: engine, composite, post: () => {}, wikiUri: "test" } as never)!;
    try {
      expect(temp.readNow("Kept note").record?.tiddler["text"], "the carrier read back").toBe("words from before the restart");
      await mountedDiskProjector()!.idle();
      expect(existsSync(kept), "the start scan finds the record standing and keeps its file").toBe(true);

      await temp.put({ tiddler: { title: "Fresh", text: "new words" } }, ORIGIN);
      await temp.put({ tiddler: { title: "$:/state/popup/x", text: "internal" } }, ORIGIN);
      await mountedDiskProjector()!.sense(["Fresh", "$:/state/popup/x"]);
      const bodies = filesUnder(mirrorRoot).map((f) => readFileSync(f, "utf8"));
      expect(bodies.some((b) => b.includes("new words"))).toBe(true);
      expect(bodies.some((b) => b.includes("internal"))).toBe(false);
    } finally {
      await stop();
      expect(existsSync(kept), "housekeeping under consent spares a live carrier").toBe(true);
      if (configBefore === null) rmSync(configPath, { force: true }); else writeFileSync(configPath, configBefore);
      rmSync(join(larProjectionsHome(), "wikis", SLUG), { recursive: true, force: true });
      rmSync(join(larProjectionsHome(), "audit"), { recursive: true, force: true });
    }
  });
});
