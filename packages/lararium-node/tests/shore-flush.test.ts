/**
 * THE SHORE'S FLUSH — write what an island holds in memory to its mirrors now, and answer what reached disk, what did
 * not, and why.
 *
 *   S1  one projector: a carrier whose reconcile threw retries and lands (`written`); one that throws again reads
 *       `failed` with why; one the queue still owes when the bounded wait ends reads `pending` with why.
 *   S2  the flush rides the shore verb as its own op, beside census.
 *   S3  every island at once (`flushEveryShore`): each island answers for itself; an island that mounts no projection
 *       drops out; one that refuses, throws or stays silent reads unanswered, by name, and never as written.
 *   S4  a seat's reach stays where it stood: the op joins the shore verb under its old name, and the MCP seat mirrors no
 *       shore tool (shore stays not yet mirrored there).
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore, flushEveryShore, shoreFlush, SHORE_OPS, SHORE_VERB } from "../src/shore-verb.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const LANDS = "lar:///ha.ka.ba/probe/flush-lands";
const RETRIES = "lar:///ha.ka.ba/probe/flush-retries";
const FAILS = "lar:///ha.ka.ba/probe/flush-throws";
const HANGS = "lar:///ha.ka.ba/probe/flush-waits";

function stand(uris: string[], fileOf: (uri: string) => Promise<{ ext: string; body: string; encoding: "utf8" }>): LarDiskProjector {
  root = mkdtempSync(join(tmpdir(), "lar-shore-flush-"));
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

describe("the shore's flush", () => {
  test("S1 — a retried carrier lands, a failing one names why, a waiting one names why", async () => {
    let retryThrows = true;
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    const projector = stand([LANDS, RETRIES, FAILS], async (uri) => {
      if (uri === FAILS) throw new Error("the render fell over");
      if (uri === RETRIES && retryThrows) throw new Error("not yet");
      return renders(uri);
    });
    await projector.idle();
    expect(projector.unsettled().failed.map((f) => f.uri).sort()).toEqual([FAILS, RETRIES].sort());
    retryThrows = false;
    const flushed = await shoreFlush(projector, 2_000);
    expect(flushed.written).toEqual([{ uri: RETRIES, bagId: BAG }]);
    expect(flushed.writtenCount).toBe(1);
    expect(flushed.fileWrites).toBeGreaterThan(0);
    expect(flushed.unwritten).toEqual([{ state: "failed", uri: FAILS, bagId: BAG, why: expect.stringMatching(/threw again/) }]);
    expect(flushed.unwrittenCount).toBe(1);
    expect(flushed.drained).toBe(true);
    await projector.stop();

    const waiting = stand([HANGS], async (uri) => { await held; return renders(uri); });
    const owed = await shoreFlush(waiting, 100);
    expect(owed.drained).toBe(false);
    expect(owed.unwritten).toEqual([{ state: "pending", uri: HANGS, bagId: BAG, why: "the queue still owed it when the 100ms wait ended" }]);
    release();
    await waiting.idle();
    await waiting.stop();
  });

  test("S2 — the flush rides the shore verb as its own op", async () => {
    const projector = stand([LANDS], renders);
    await projector.idle();
    expect(await answerShore(projector, { op: "flush" })).toMatchObject({ ok: true, op: "flush", written: [], writtenCount: 0, unwritten: [], unwrittenCount: 0, drained: true });
    await projector.stop();
  });

  test("S3 — every island answers for itself; none that fails reads as written", async () => {
    const answered = { ok: true, op: "flush", written: [{ uri: LANDS, bagId: BAG }], writtenCount: 1, unwritten: [], unwrittenCount: 0, fileWrites: 1, drained: true };
    const reading = await flushEveryShore([
      { island: "daemon", ask: async () => answered },
      { island: "wiki:home", ask: async () => ({ ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" }) },
      { island: "wiki:notes", ask: async () => ({ ok: false, refusal: "engine-terminated", why: "the engine stopped" }) },
      { island: "wiki:thrown", ask: async () => { throw Object.assign(new Error("the island went away"), { reason: "island-gone" }); } },
      { island: "wiki:silent", ask: () => new Promise(() => {}) },
    ], 50);
    expect(reading.islands).toEqual([
      { island: "daemon", answered: true, written: [{ uri: LANDS, bagId: BAG }], writtenCount: 1, unwritten: [], unwrittenCount: 0, fileWrites: 1, drained: true },
      { island: "wiki:notes", answered: false, why: "the engine stopped", refusal: "engine-terminated" },
      { island: "wiki:thrown", answered: false, why: "the island went away", refusal: "island-gone" },
      { island: "wiki:silent", answered: false, why: "the island gave no answer within 50ms" },
    ]);
    expect(reading.whole).toBe(false);
    expect((await flushEveryShore([{ island: "daemon", ask: async () => answered }])).whole).toBe(true);
  });

  test("S4 — a seat's reach stays where it stood", () => {
    expect(SHORE_VERB).toBe("shore");
    expect(SHORE_OPS).toEqual(["list", "sense", "settle", "take-records", "render", "restore", "remove", "census", "flush"]);
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(readFileSync(join(here, "../../lararium-sensorium/scripts/fixtures/cli-verbs.json"), "utf8")) as { mirrored: string[]; not_yet_mirrored: string[] };
    expect(fixture.mirrored.some((tool) => /shore|flush/.test(tool))).toBe(false);
    expect(fixture.not_yet_mirrored).toContain("shore");
  });
});
