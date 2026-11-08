/**
 * THE SHORE'S CENSUS — what the disk projector has not settled, named by title before a stop.
 *
 *   C1  a carrier whose reconcile threw reads `failed`, and one the queue still owes after the bounded wait reads
 *       `pending`; each names its bag.                                     control: a projector that drained reads clean
 *   C2  a carrier that throws and then lands leaves the failed set: the latest reconcile counts.
 *   C3  the census rides the shore verb as its own act; a malformed cursor refuses by name.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore, shoreCensus } from "../src/shore-verb.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const OK = "lar:///ha.ka.ba/probe/census-lands";
const FAILS = "lar:///ha.ka.ba/probe/census-throws";
const HANGS = "lar:///ha.ka.ba/probe/census-waits";

function stand(uris: string[], fileOf: (uri: string) => Promise<{ ext: string; body: string; encoding: "utf8" }>): LarDiskProjector {
  root = mkdtempSync(join(tmpdir(), "lar-shore-census-"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: fileOf,
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
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
});
