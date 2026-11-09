/**
 * projection-roots-split — the house's disk mirrors split by ORIGIN (operator ruling, 2026-11-01: "Are those things that
 * start in bags? then they should 'end up back in bags/'. Only live edits end up in the wiki layers ... the dirs in the
 * workspace right now (and the wikis they shall compose) DO need to get written back to the main repo checkout").
 *
 *   · a bag whose source dir stands under the canon source (`LAR_BAGS`) projects back to `<canon>/<slug>`, and the wiki it
 *     composes to `<canon parent>/wikis/<slug>`;
 *   · every other bag and wiki (house-minted, a user's own) projects under the house's projections root
 *     (`<root>/projections`), never the state root it sits in and never the hearth;
 *   · a PRIVATE plane (the daemon wiki at `wikis/daemon-<F>`, the kahua stage at `bags/kahua-<F>`) projects under the
 *     projections root even where a source dir of its name stands; the daemon wiki's canon (`bags/daemon`, non-control
 *     records alone) projects to `<projections>/bags/daemon`, never beside the canon source.
 *
 * Membership reads the source tree; no bag name is listed, save the private planes.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { CROSSROADS_DOC_URI, DAEMON_BAG_ID, KAHUA_BAG, wikiSlotUri } from "@lararium/mesh";
import {
  projectionRoots, daemonWorkingMirror, kahuaStageMirror, daemonDiskMirrors, daemonFaceFolder, kahuaFaceFolder,
  isPrivateProjectionSlug, daemonObserveRoot,
} from "../src/bag-paths.js";
import { atomicWriteFileSync, durableSyncIo } from "../src/fs-atomic.js";
import { LarDiskProjector, PROJECTION_FILE_MODE } from "../src/disk-projector.js";

const TAG = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31";
let dir = "";
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = ""; });

/** Three distinct roots: the house root (state), its projections root, and a canon source in a checkout. */
function tree(...bags: string[]): { state: string; projections: string; canon: string } {
  dir = mkdtempSync(join(tmpdir(), "proj-split-"));
  const state = join(dir, "house"), projections = join(state, "projections"), canon = join(dir, "checkout", "bags");
  for (const b of bags) mkdirSync(join(canon, b), { recursive: true });
  mkdirSync(projections, { recursive: true });
  return { state, projections, canon };
}

describe("projectionRoots — the mirror root splits by origin", () => {
  test("a bag present in the canon source projects back to it, and its wiki beside it", () => {
    const { projections, canon } = tree("lares", "elyncia");
    const roots = projectionRoots({ projectionRoot: projections, canonBags: canon });
    expect(roots.bagRoot("lares")).toBe(join(canon, "lares"));
    expect(roots.bagRoot("elyncia")).toBe(join(canon, "elyncia"));
    expect(roots.wikisRootFor("elyncia")).toBe(join(dir, "checkout", "wikis"));
    expect(roots.sourcedSlugs()).toEqual(["elyncia", "lares"]);
  });
  test("a house bag with no source dir projects under the projections root, never the state root", () => {
    const { state, projections, canon } = tree("lares");
    const roots = projectionRoots({ projectionRoot: projections, canonBags: canon });
    expect(roots.bagRoot("notes")).toBe(join(projections, "bags", "notes"));
    expect(roots.wikisRootFor("notes")).toBe(join(projections, "wikis"));
    expect(roots.bagRoot("notes").startsWith(join(state, "bags"))).toBe(false);
  });
  test("a private plane stays under the projections root even where a source dir of its name stands", () => {
    const { projections, canon } = tree("daemon", "kahua", `daemon-${TAG}`, `kahua-${TAG}`);
    const roots = projectionRoots({ projectionRoot: projections, canonBags: canon });
    expect(roots.wikisRootFor("kahua")).toBe(join(projections, "wikis"));
    expect(roots.sourcedSlugs()).toEqual([]);
    expect(isPrivateProjectionSlug(`daemon-${TAG}`)).toBe(true);
  });
  test("an absent canon source sources nothing: every root stays under the projections root", () => {
    dir = mkdtempSync(join(tmpdir(), "proj-split-"));
    const roots = projectionRoots({ projectionRoot: join(dir, "projections"), canonBags: join(dir, "nowhere") });
    expect(roots.sourcedSlugs()).toEqual([]);
    expect(roots.bagRoot("lares")).toBe(join(dir, "projections", "bags", "lares"));
  });
});

describe("the daemon VM's mirrors under distinct state, canon and projection roots", () => {
  test("house bags, both face folders and the daemon canon land under projections; canon sources in the checkout", () => {
    const { state, projections, canon } = tree("crossroads");
    const mirrors = daemonDiskMirrors({ projectionRoot: projections, canonBags: canon, faceRelation: TAG });
    const byBag = new Map(mirrors.map((m) => [m.bagId, m.mirrorRoot]));
    expect(byBag.get(wikiSlotUri("daemon", "working"))).toBe(join(projections, "wikis", `daemon-${TAG}`));
    expect(byBag.get(KAHUA_BAG)).toBe(join(projections, "bags", `kahua-${TAG}`));
    expect(byBag.get(CROSSROADS_DOC_URI)).toBe(join(canon, "crossroads"));
    expect(mirrors.filter((m) => m.bagId === DAEMON_BAG_ID)).toEqual([{ bagId: DAEMON_BAG_ID, mirrorRoot: join(projections, "bags", "daemon"), scope: "daemon-canon" }]);
    for (const root of byBag.values()) expect(root.startsWith(join(state, "bags")) || root.startsWith(join(state, "wikis"))).toBe(false);
    expect(mirrors.some((m) => m.mirrorRoot.startsWith(join(canon, "daemon")))).toBe(false);
  });
  test("the observe toggle adds the daemon bag's one-way render under projections/observe/daemon", () => {
    const { projections, canon } = tree();
    const mirrors = daemonDiskMirrors({ projectionRoot: projections, canonBags: canon, faceRelation: TAG, observeDaemon: true });
    const observe = mirrors.find((m) => m.bagId === DAEMON_BAG_ID && m.mirrorClass === "observe");
    expect(observe).toEqual({ bagId: DAEMON_BAG_ID, mirrorRoot: daemonObserveRoot(projections), scope: "daemon-observe", mirrorClass: "observe" });
    expect(observe!.mirrorRoot).toBe(join(projections, "observe", "daemon"));
  });
  test("the daemon wiki's folder names the face as daemon-<F>; the kahua stage keeps kahua-<F>", () => {
    expect(daemonFaceFolder(TAG)).toBe(`daemon-${TAG}`);
    expect(kahuaFaceFolder(TAG)).toBe(`kahua-${TAG}`);
    expect(() => daemonFaceFolder("not-a-relation")).toThrow(/relation/);
    expect(daemonWorkingMirror("/p", TAG).mirrorRoot).toBe(join("/p", "wikis", `daemon-${TAG}`));
    expect(kahuaStageMirror("/p", TAG).mirrorRoot).toBe(join("/p", "bags", `kahua-${TAG}`));
  });
});

describe("the projector's write lands durably", () => {
  test("an atomic write fsyncs the temp file and the parent dir around the rename", () => {
    dir = mkdtempSync(join(tmpdir(), "proj-fsync-"));
    const calls: string[] = [];
    const { fsyncSync, renameSync } = durableSyncIo;
    durableSyncIo.fsyncSync = (fd) => { calls.push("fsync"); fsyncSync(fd); };
    durableSyncIo.renameSync = (a, b) => { calls.push("rename"); renameSync(a, b); };
    try {
      atomicWriteFileSync(join(dir, "f.mem"), "body", join(dir, "f.mem.tmp"), { mode: 0o600 });
    } finally {
      durableSyncIo.fsyncSync = fsyncSync;
      durableSyncIo.renameSync = renameSync;
    }
    expect(calls).toEqual(["fsync", "rename", "fsync"]);
    expect(statSync(join(dir, "f.mem")).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual(["f.mem"]);
  });

  test("a projected carrier lands at mode 0600 with fsync before and after its rename", async () => {
    dir = mkdtempSync(join(tmpdir(), "proj-mode-"));
    const calls: string[] = [];
    const { fsyncSync } = durableSyncIo;
    durableSyncIo.fsyncSync = (fd) => { calls.push("fsync"); fsyncSync(fd); };
    const projector = new LarDiskProjector({
      mirrors: [daemonWorkingMirror(dir, TAG)],
      carrierFileFn: async () => ({ ext: ".mem", body: "carrier", defaultRelPath: "ha.ka.ba/t/x.mem" }),
    });
    try {
      await (projector as unknown as { flush(b: string, t: string): Promise<void> }).flush(wikiSlotUri("daemon", "working"), "lar:///ha.ka.ba/t/x");
    } finally { durableSyncIo.fsyncSync = fsyncSync; }
    const file = join(dir, "wikis", `daemon-${TAG}`, "ha.ka.ba/t/x.mem");
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).mode & 0o777).toBe(PROJECTION_FILE_MODE);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
