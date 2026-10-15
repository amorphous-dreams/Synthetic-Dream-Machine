/**
 * THE SHORE VERB — a person's answers reach the projector that holds the mirror.
 *
 * `lares shore` rides `wiki-act` into the active wiki's island as an ordinary `wiki:place-verb`. The
 * node-held door (`claimShoreVerb`) claims it ahead of the island's verb table and answers from the
 * projector the island mounts. These vectors drive the real projector over a scratch mirror.
 *
 * Controls: any other verb passes the door unclaimed; an island that mounts no projector refuses by name;
 * an answer that names a key which no longer stands takes nothing and leaves the file as the hand left it.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { SHORE_VERB, answerShore } from "../src/shore-verb.js";
import { claimShoreVerb } from "../src/island-behaviors.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const URI = "lar:///ha.ka.ba/probe/shore-verb";
const RECORDS = "title: records\n\nWHAT THE RECORDS SAY\n";
const HAND = "title: records\n\nA HAND ON DISK\n";

async function stand(): Promise<{ projector: LarDiskProjector; file: string; key: string; resolved: string[] }> {
  root = mkdtempSync(join(tmpdir(), "lar-shore-verb-"));
  const file = join(root, `${URI.slice("lar:///".length)}${MEME_EXT}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, HAND, "utf-8");
  const conflicts: string[] = [];
  const resolved: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS, encoding: "utf8" }),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
    onConflict: (info) => { conflicts.push(info.standoff); },
    onConflictResolved: (info) => { resolved.push(info.standoff); },
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (title === URI ? { fields: { title, "$origin-bag": BAG } } : undefined),
    allTitles: () => [URI],
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  projector.start(engine);
  await projector.idle();
  expect(conflicts).toHaveLength(1);
  return { projector, file, key: conflicts[0]!, resolved };
}

describe("the shore verb answers from the projector", () => {
  test("list names each standoff with the key a person answers by", async () => {
    const s = await stand();
    const listed = await answerShore(s.projector, { op: "list" });
    expect(listed).toMatchObject({ ok: true, op: "list", standoffCount: 1, pending: [], pendingCount: 0 });
    // Each standoff names its key and the states that key folds: the file weighed, and both hashes.
    expect((listed["standoffs"] as Array<Record<string, unknown>>)).toHaveLength(1);
    expect((listed["standoffs"] as Array<Record<string, unknown>>)[0]).toMatchObject({ bagId: BAG, uri: URI, standoff: s.key, kind: "sides", path: s.file });
    expect(String((listed["standoffs"] as Array<Record<string, unknown>>)[0]!["reason"])).toContain(s.key);
    expect(await answerShore(s.projector, {})).toMatchObject({ ok: true, op: "list" });
  });

  test("take-records under the standing key writes the records' render and clears the standoff", async () => {
    const s = await stand();
    expect(await answerShore(s.projector, { op: "take-records", uri: URI, key: s.key })).toEqual({ ok: true, op: "take-records", bag: BAG, uri: URI, key: s.key, took: "records" });
    expect(readFileSync(s.file, "utf-8")).toBe(RECORDS);
    expect(s.resolved).toEqual([s.key]);
    expect(await answerShore(s.projector, { op: "list" })).toMatchObject({ standoffs: [] });
  });

  test("CONTROL: a key that does not stand, a carrier in no standoff, a missing name and an unknown act each refuse by name and write nothing", async () => {
    const s = await stand();
    expect(await answerShore(s.projector, { op: "take-records", uri: URI, key: "f".repeat(24) })).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
    expect(await answerShore(s.projector, { op: "take-records", uri: `${URI}-other`, key: s.key })).toMatchObject({ ok: false, refusal: "no-standoff-stands" });
    expect(await answerShore(s.projector, { op: "take-records", uri: URI, key: s.key, bag: "another-bag" })).toMatchObject({ ok: false, refusal: "no-standoff-stands" });
    expect(await answerShore(s.projector, { op: "take-records", uri: URI })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(await answerShore(s.projector, { op: "take-disk", uri: URI, key: s.key })).toMatchObject({ ok: false, refusal: "shore-op-unknown" });
    expect(readFileSync(s.file, "utf-8")).toBe(HAND);
    expect(s.resolved).toEqual([]);
  });

  test("the answer names the state its giver read: a hand that edits the file again voids the key", async () => {
    const s = await stand();
    writeFileSync(s.file, `${HAND}AND A SECOND EDIT\n`, "utf-8");
    const answer = await s.projector.takeRecords(BAG, URI, s.key);
    expect(answer.took).toBe(false);
    expect(readFileSync(s.file, "utf-8")).toBe(`${HAND}AND A SECOND EDIT\n`);
    const standing = s.projector.standing();
    expect(standing).toHaveLength(1);
    expect(standing[0]!.standoff).not.toBe(s.key);
  });
});

describe("the island's shore door", () => {
  const place = (verb: string, args: Record<string, unknown>, requestId?: string) =>
    ({ type: "wiki:place-verb", verb, args, requestedBy: "did:test", ...(requestId ? { requestId } : {}) });

  test("claims the shore verb and posts the projector's answer under the request's id", async () => {
    const s = await stand();
    const posted: Array<Record<string, unknown>> = [];
    const done = new Promise<void>((resolve) => {
      expect(claimShoreVerb("wiki:place-verb", place(SHORE_VERB, { op: "list" }, "req-1"), (msg) => { posted.push(msg as unknown as Record<string, unknown>); resolve(); }, () => s.projector)).toBe(true);
    });
    await done;
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "wiki:verb-result", requestId: "req-1", result: { ok: true, op: "list", standoffs: [{ uri: URI, standoff: s.key }] } });
  });

  test("CONTROL: another verb and another message pass unclaimed", () => {
    const post = (): void => { throw new Error("nothing posts for a message the door leaves alone"); };
    expect(claimShoreVerb("wiki:place-verb", place("INGEST", {}, "req-2"), post, () => null)).toBe(false);
    expect(claimShoreVerb("wiki:dom-event", place(SHORE_VERB, {}, "req-3"), post, () => null)).toBe(false);
  });

  test("an island that mounts no projector refuses by name", async () => {
    const posted: Array<Record<string, unknown>> = [];
    const done = new Promise<void>((resolve) => {
      expect(claimShoreVerb("wiki:place-verb", place(SHORE_VERB, { op: "list" }, "req-4"), (msg) => { posted.push(msg as unknown as Record<string, unknown>); resolve(); }, () => null)).toBe(true);
    });
    await done;
    expect(posted[0]).toMatchObject({ requestId: "req-4", result: { ok: false, refusal: "no-disk-shore" } });
  });
});
