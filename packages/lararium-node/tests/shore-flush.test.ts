/**
 * THE SHORE'S FLUSH — write what an island holds in memory to its mirrors now, and answer what reached disk, what did
 * not, and why.
 *
 *   S1  one projector: a carrier whose reconcile threw retries and lands (`written`); one that throws again reads
 *       `failed` with why; one the queue still owes when the bounded wait ends reads `pending` with why.
 *   S2  the flush rides the shore verb as its own op, beside census.
 *   S3  every island at once (`flushEveryShore`): each island answers for itself; an island that mounts no projection
 *       drops out; one that refuses, throws or stays silent reads unanswered, by name, and never as written.
 *   S4  the op joins the shore verb under its old name, and the MCP seat mirrors the shore (`shore`, `shore_flush`).
 *   S5  a lit sibling's shore answers by its face (`answerShoreSeats`): an act naming `face` reaches that face's projector (the
 *       worn one's or a sibling's) and names the face; a face with no projector refuses `face-unprojected`; a flush naming no
 *       face reaches the worn projector and every lit sibling's, each sibling row naming its face.
 *   S7  no base waits silent: the `base` act lands a wave's bases in the projector's own Synced tree (one owner of pending
 *       state), and every flush counts the pins that wait, the ones on an unread rest, and the wave bases that wait with them.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore, answerShoreSeats, flushEveryShore, shoreFlush, shoreFlushLines, shoreHandCode, shoreStuckFaces, SHORE_HAND_CODE, SHORE_OPS, SHORE_VERB } from "../src/shore-verb.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
const roots: string[] = [];
afterEach(() => { for (const r of [root, ...roots.splice(0)]) if (r) rmSync(r, { recursive: true, force: true }); root = ""; });

const BAG = "lares";
const LANDS = "lar:///ha.ka.ba/probe/flush-lands";
const RETRIES = "lar:///ha.ka.ba/probe/flush-retries";
const FAILS = "lar:///ha.ka.ba/probe/flush-throws";
const HANGS = "lar:///ha.ka.ba/probe/flush-waits";

function stand(uris: string[], fileOf: (uri: string) => Promise<{ ext: string; body: string; encoding: "utf8" }>): LarDiskProjector {
  if (root) roots.push(root);
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

  test("RED S4 — the op keeps its verb, and the MCP seat mirrors the shore", () => {
    expect(SHORE_VERB).toBe("shore");
    // `drafts` reads titles alone; `keep-both` settles a stand-off and rides a person's hand like `take-records`.
    expect(SHORE_OPS).toEqual(["list", "sense", "settle", "take-records", "render", "restore", "remove", "census", "flush", "drafts", "keep-both", "base"]);
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(readFileSync(join(here, "../../lararium-sensorium/scripts/fixtures/cli-verbs.json"), "utf8")) as { mirrored: string[]; not_yet_mirrored: string[] };
    expect(fixture.mirrored).toEqual(expect.arrayContaining(["shore", "shore_flush"]));
    expect(fixture.not_yet_mirrored).not.toContain("shore");
  });

  test("RED S5 — a lit sibling's shore answers by its face; a flush naming no face reaches every face's projector", async () => {
    let siblingThrows = true;
    const worn = stand([LANDS], renders);
    const sibling = stand([RETRIES], async (uri) => { if (siblingThrows) throw new Error("not yet"); return renders(uri); });
    await Promise.all([worn.idle(), sibling.idle()]);
    const seats = { own: worn, worn: 0, lit: (face: number) => (face === 2 ? sibling : null), litFaces: () => [2] };
    expect(await answerShoreSeats(seats, { op: "list", face: 2 })).toMatchObject({ ok: true, op: "list", face: 2 });
    expect(await answerShoreSeats(seats, { op: "list", face: 0 })).toMatchObject({ ok: true, op: "list", face: 0 });
    const unprojected = await answerShoreSeats(seats, { op: "list", face: 1 });
    expect(unprojected).toMatchObject({ ok: false, refusal: "face-unprojected", face: 1 });
    expect(String(unprojected["why"])).toMatch(/lares vessel census.*lares vault unlock --face 1/);
    expect(await answerShoreSeats(seats, { op: "list", face: "h2" })).toMatchObject({ ok: false, refusal: "face-malformed" });
    // The sibling's failed carrier reads through its face, and a flush naming no face reaches it beside the worn one.
    expect((await answerShoreSeats(seats, { op: "census", face: 2 }))["carriers"]).toEqual([{ state: "failed", uri: RETRIES, bagId: BAG }]);
    siblingThrows = false;
    const flushed = await answerShoreSeats(seats, { op: "flush" });
    expect(flushed).toMatchObject({ ok: true, op: "flush", written: [{ uri: RETRIES, bagId: BAG, face: 2 }], writtenCount: 1, unwrittenCount: 0, faces: [0, 2] });
    // CONTROL: an island with no projector of any face holds no shore; a list naming no face reads the worn one.
    expect(await answerShoreSeats({ own: null, worn: null, lit: () => null, litFaces: () => [] }, { op: "flush" })).toMatchObject({ ok: false, refusal: "no-disk-shore" });
    expect(await answerShoreSeats(seats, { op: "list" })).toMatchObject({ ok: true, op: "list" });
    expect((await answerShoreSeats(seats, { op: "list" }))["face"]).toBeUndefined();
    await worn.stop(); await sibling.stop();
  });

  test("RED S7 — no base waits silent: the `base` act lands a wave's bases in the projector's own tree, and a flush counts each pin that waits", async () => {
    if (root) roots.push(root);
    root = mkdtempSync(join(tmpdir(), "lar-shore-flush-"));
    const dir = join(root, ".projection", "synced-tree");
    const rest = { reading: "unread" as "rested" | "waiting" | "unread" };
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: root }],
      carrierFileFn: renders,
      documentOf: () => "doc-lares",
      syncedTree: new SyncedTree(dir, { rests: async () => rest.reading }),
    });
    projector.start({ $tw: { wiki: { getTiddler: () => undefined, allTitles: () => [], addEventListener: () => {}, removeEventListener: () => {} } } } as unknown as TW5Engine);
    await projector.idle();
    const file = join(root, "holding", "note.md");
    const base = { uri: LANDS, file, disk: "sha256:" + "a".repeat(64), records: "sha256:" + "b".repeat(64), heads: ["h1"] };
    // The wave's base names heads: it sets in the island's own tree, under the island's document, and waits on a rest that
    // answers nothing readable. Nothing reaches the directory, and the answer counts the pin.
    const first = await answerShore(projector, { op: "base", bag: BAG, bases: [base] });
    expect(first).toMatchObject({ ok: true, op: "base", bag: BAG, recorded: 1, kept: 0, waiting: 0, moved: 0, pendingPinCount: 1, pendingPinUnreadCount: 1, waitingBaseCount: 0 });
    expect(new SyncedTree(dir).size).toBe(0);
    // The same agreement asked again (the echo) waits with that pin, and the shore counts it.
    expect(await answerShore(projector, { op: "base", bag: BAG, bases: [base] })).toMatchObject({ ok: true, recorded: 0, waiting: 1, pendingPinCount: 1, waitingBaseCount: 1 });
    // The flush names every pin that waits, on one projector and across a daemon island's faces alike, and its line says so.
    const flushed = await shoreFlush(projector, 100);
    expect(flushed).toMatchObject({ pendingPinCount: 1, pendingPinUnreadCount: 1, waitingBaseCount: 1, pendingPins: [{ uri: LANDS, bagId: BAG, why: "pending: rest unread" }] });
    const seats = { own: projector, worn: 0, lit: () => null, litFaces: () => [] };
    expect(await answerShoreSeats(seats, { op: "flush" })).toMatchObject({ ok: true, pendingPinCount: 1, pendingPinUnreadCount: 1, waitingBaseCount: 1, pendingPins: [{ uri: LANDS }] });
    const reading = await flushEveryShore([{ island: "daemon", ask: () => answerShoreSeats(seats, { op: "flush" }) }]);
    expect(shoreFlushLines(reading).join("\n")).toMatch(/1 base pin\(s\) wait on their seal, 1 on a rest that answered nothing readable, and 1 wave base\(s\) wait with them/);
    // The rest answers: the pin lands with its document and its heads, and the shore's counts read zero.
    rest.reading = "rested";
    expect(await shoreFlush(projector, 100)).toMatchObject({ pendingPinCount: 0, pendingPinUnreadCount: 0, waitingBaseCount: 0 });
    expect(new SyncedTree(dir).rows().map((r) => r.base)).toEqual([expect.objectContaining({ doc: "doc-lares", heads: ["h1"], disk: base.disk, records: base.records })]);
    // A base act that names no bag, or a base in another shape, refuses by name.
    expect(await answerShore(projector, { op: "base", bases: [base] })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(await answerShore(projector, { op: "base", bag: BAG, bases: [{ uri: LANDS }] })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    await projector.stop();
  });

  test("RED S6 — the shore's settling ops read hand-only per op, on the shore verb and through wiki-act; the stuck faces read off the rows", () => {
    for (const op of ["take-records", "restore", "remove"]) {
      expect(shoreHandCode("shore", { op })).toBe(SHORE_HAND_CODE);
      expect(shoreHandCode("wiki-act", { verb: "shore", args: { op } })).toBe(SHORE_HAND_CODE);
    }
    for (const op of ["list", "sense", "settle", "render", "census", "flush"]) expect(shoreHandCode("shore", { op }), op).toBeNull();
    expect(shoreHandCode("wiki-act", { verb: "tiddler-get", args: { op: "remove" } })).toBeNull();
    const reading = { whole: false, islands: [
      { island: "daemon", answered: true as const, written: [], writtenCount: 0, unwritten: [{ state: "failed" as const, uri: "u", bagId: null, why: "w", face: 2 } as never], unwrittenCount: 1, fileWrites: 0, drained: true },
      { island: "wiki:home", answered: true as const, written: [], writtenCount: 0, unwritten: [{ state: "pending" as const, uri: "v", bagId: null, why: "w" }], unwrittenCount: 1, fileWrites: 0, drained: false },
    ] };
    expect(shoreStuckFaces(reading, 0)).toEqual([0, 2]);
  });
});
