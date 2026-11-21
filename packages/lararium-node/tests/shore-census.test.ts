/**
 * THE SHORE'S CENSUS — what the disk projector has not settled, named by title before a stop.
 *
 *   C1  a carrier whose reconcile threw reads `failed`, and one the queue still owes after the bounded wait reads
 *       `pending`; each names its bag.                                     control: a projector that drained reads clean
 *   C2  a carrier that throws and then lands leaves the failed set: the latest reconcile counts.
 *   C3  the census rides the shore verb as its own act; a malformed cursor refuses by name.
 *   C4  a file a mirror's checkout never tracked reads by path on the first page (an owed commit); an ignored one
 *       and a committed one read none, a mirror under the projections root (a face pool) reads none, and a checkout
 *       git cannot read lands in `untrackedUnread`, never clean.
 */
import { describe, test, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore, shoreCensus } from "../src/shore-verb.js";
import { checkoutTracking, type CarrierTracking } from "../src/checkout-carriers.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const OK = "lar:///ha.ka.ba/probe/census-lands";
const FAILS = "lar:///ha.ka.ba/probe/census-throws";
const HANGS = "lar:///ha.ka.ba/probe/census-waits";

function stand(uris: string[], fileOf: (uri: string) => Promise<{ ext: string; body: string; encoding: "utf8" }>, untrackedAt?: (root: string) => CarrierTracking): LarDiskProjector {
  root = mkdtempSync(join(tmpdir(), "lar-shore-census-"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: fileOf,
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    ...(untrackedAt ? { untrackedAt: untrackedAt(root) } : {}),
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (uris.includes(title) ? { fields: { title, "$origin-bag": BAG } } : undefined),
    allTitles: () => uris,
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  projector.start(engine);
  return projector;
}
const renders = async (uri: string) => ({ ext: MEME_EXT, body: `title: ${uri}\n\nbody\n`, encoding: "utf8" as const });

describe("the shore's census", () => {
  test("C1 — a thrown reconcile reads failed, an owed one reads pending, each by title and bag", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    const projector = stand([OK, FAILS, HANGS], async (uri) => {
      if (uri === FAILS) throw new Error("the render fell over");
      if (uri === HANGS) await held;
      return renders(uri);
    });
    const census = await shoreCensus(projector, null, 200);
    expect(census.drained).toBe(false);
    expect(census.carriers).toEqual([
      { state: "failed", uri: FAILS, bagId: BAG },
      { state: "pending", uri: HANGS, bagId: BAG },
    ]);
    expect(census.carrierCount).toBe(2);
    expect(census.next).toBeNull();
    release();
    await projector.idle();
    await projector.stop();
  });

  test("C1 CONTROL — a projector that drained reads clean", async () => {
    const projector = stand([OK], renders);
    const census = await shoreCensus(projector, null, 2_000);
    expect(census).toEqual({ carriers: [], carrierCount: 0, drained: true, next: null });
    await projector.stop();
  });

  test("C2 — a carrier that throws and then lands leaves the failed set", async () => {
    let throws = true;
    const projector = stand([FAILS], async (uri) => { if (throws) throw new Error("not yet"); return renders(uri); });
    await projector.idle();
    expect(projector.unsettled().failed).toEqual([{ uri: FAILS, bagId: BAG }]);
    throws = false;
    await projector.sense([FAILS]);
    await projector.idle();
    expect(projector.unsettled()).toEqual({ pending: [], failed: [] });
    await projector.stop();
  });

  test("C3 — the census rides the shore verb; a malformed cursor refuses by name", async () => {
    const projector = stand([OK], renders);
    expect(await answerShore(projector, { op: "census" })).toMatchObject({ ok: true, op: "census", carriers: [], carrierCount: 0, next: null });
    expect(await answerShore(projector, { op: "census", after: 7 })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    await projector.stop();
  });

  test("C4 — a file the checkout never tracked reads by path; ignored, committed and pool files read none", async () => {
    const projector = stand([OK], renders, () => checkoutTracking(() => null));
    const git = (...a: string[]): void => {
      const r = spawnSync("git", ["-c", "user.name=Heron", "-c", "user.email=heron@probe.invalid", ...a], { cwd: root, encoding: "utf8", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
      if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    };
    git("init", "-q");
    writeFileSync(join(root, ".gitignore"), ".projection/\nheld-out.txt\n");
    writeFileSync(join(root, "held-out.txt"), "ignored on purpose\n");
    git("add", ".gitignore"); git("commit", "-q", "-m", "lar:///probe.ignores.held-out/commit");
    await projector.idle();
    const census = await shoreCensus(projector, null, 2_000);
    const file = join(root, "ha.ka.ba", "probe", `census-lands${MEME_EXT}`);
    expect(census.untracked).toEqual([{ path: file, bagId: BAG }]);
    expect(census.untrackedUnread).toBeUndefined();
    expect(await answerShore(projector, { op: "census" })).toMatchObject({ ok: true, untracked: [{ path: file, bagId: BAG }] });
    git("add", "-A"); git("commit", "-q", "-m", "lar:///probe.keeps.the-carrier/commit");
    expect((await shoreCensus(projector, null, 2_000)).untracked).toBeUndefined();
    await projector.stop();
    // A mirror under the projections root: the house commits its own pool, so nothing reads owed.
    const pool = stand([OK], renders, (at) => checkoutTracking(() => at));
    git("init", "-q");
    await pool.idle();
    expect((await shoreCensus(pool, null, 2_000)).untracked).toBeUndefined();
    await pool.stop();
    // A checkout git cannot read never reads clean.
    const blind = stand([OK], renders, () => checkoutTracking(() => null, () => ({ code: 1, stdout: "", stderr: "spawnSync git ENOENT" })));
    git("init", "-q");
    await blind.idle();
    const unread = await shoreCensus(blind, null, 2_000);
    expect(unread.untracked).toBeUndefined();
    expect(unread.untrackedUnread).toEqual([{ root: expect.stringContaining("lar-shore-census-"), why: expect.stringMatching(/git cannot run in this runtime/) }]);
    await blind.stop();
  });
});
