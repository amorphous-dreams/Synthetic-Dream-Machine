/**
 * THE SHORE VERB — a person's answers reach the projector that holds the mirror.
 *
 * `lares shore` rides `wiki-act` into the active wiki's island as an ordinary `wiki:place-verb`. The
 * node-held door (`claimShoreVerb`) claims it ahead of the island's verb table and answers from the
 * projector the island mounts. These vectors drive the real projector over a scratch mirror: one carrier
 * projects, a hand removes its file, and the shore names the pending removal.
 *
 * Controls: any other verb passes the door unclaimed; an island that mounts no projector refuses by name;
 * an op the verb carries no longer (a projector that decides every moved file by itself holds no side to
 * take) refuses `shore-op-unknown` and writes nothing.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/** Stand a projector over one carrier, let it project and pin its base, then remove the file by hand. */
async function stand(): Promise<{ projector: LarDiskProjector; file: string }> {
  root = mkdtempSync(join(tmpdir(), "lar-shore-verb-"));
  const file = join(root, `${URI.slice("lar:///".length)}${MEME_EXT}`);
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS, encoding: "utf8" }),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (title === URI ? { fields: { title, "$origin-bag": BAG } } : undefined),
    allTitles: () => [URI],
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  projector.start(engine);
  await projector.idle();
  expect(existsSync(file)).toBe(true);
  unlinkSync(file);
  return { projector, file };
}

describe("the shore verb answers from the projector", () => {
  test("list looks at the disk first and names the pending removal with its path", async () => {
    const s = await stand();
    const listed = await answerShore(s.projector, { op: "list" });
    expect(listed).toMatchObject({ ok: true, op: "list", pendingCount: 1, next: null });
    expect(listed["pending"]).toEqual([expect.objectContaining({ bagId: BAG, uri: URI, path: s.file })]);
    expect(listed).not.toHaveProperty("standoffs");
    expect(await answerShore(s.projector, {})).toMatchObject({ ok: true, op: "list" });
  });

  test("restore writes the file back from the records and the shore lists nothing", async () => {
    const s = await stand();
    await answerShore(s.projector, { op: "list" });
    expect(await answerShore(s.projector, { op: "restore", uris: [URI] })).toMatchObject({ ok: true, op: "restore", bag: BAG, done: [URI], leftCount: 0 });
    expect(existsSync(s.file)).toBe(true);
    expect(await answerShore(s.projector, { op: "list" })).toMatchObject({ pending: [], pendingCount: 0 });
  });

  test("CONTROL: an op the verb no longer carries refuses shore-op-unknown and writes nothing back", async () => {
    const s = await stand();
    await answerShore(s.projector, { op: "list" });
    for (const op of ["take-records", "take-disk", "keep-both", "render", "drafts"]) {
      expect(await answerShore(s.projector, { op, uri: URI, key: "k" }, "cli"), op).toMatchObject({ ok: false, refusal: "shore-op-unknown" });
    }
    expect(existsSync(s.file)).toBe(false);
    expect(await answerShore(s.projector, { op: "list" })).toMatchObject({ pendingCount: 1 });
  });
});

describe("the island's shore door", () => {
  const place = (verb: string, args: Record<string, unknown>, requestId?: string, asker?: string) =>
    ({ type: "wiki:place-verb", verb, args, requestedBy: "did:test", ...(requestId ? { requestId } : {}), ...(asker ? { asker } : {}) });

  test("claims the shore verb and posts the projector's answer under the request's id", async () => {
    const s = await stand();
    const posted: Array<Record<string, unknown>> = [];
    const done = new Promise<void>((resolve) => {
      expect(claimShoreVerb("wiki:place-verb", place(SHORE_VERB, { op: "list" }, "req-1"), (msg) => { posted.push(msg as unknown as Record<string, unknown>); resolve(); }, () => s.projector)).toBe(true);
    });
    await done;
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "wiki:verb-result", requestId: "req-1", result: { ok: true, op: "list", pending: [{ uri: URI }] } });
  });

  test("carries the asker the vessel's door read: a seat's base refuses at the island", async () => {
    const s = await stand();
    const posted: Array<Record<string, unknown>> = [];
    const done = new Promise<void>((resolve) => {
      claimShoreVerb("wiki:place-verb", place(SHORE_VERB, { op: "base", bag: BAG, bases: [{ uri: URI, file: s.file }] }, "req-5", "seat"), (msg) => { posted.push(msg as unknown as Record<string, unknown>); resolve(); }, () => s.projector);
    });
    await done;
    expect(posted[0]).toMatchObject({ requestId: "req-5", result: { ok: false, refusal: "hand-act-only" } });
    expect(existsSync(s.file)).toBe(false);
  });

  test("CONTROL: another verb and another message pass unclaimed", () => {
    const post = (): void => { throw new Error("nothing posts for a message the door leaves alone"); };
    expect(claimShoreVerb("wiki:place-verb", place("INGEST", {}, "req-2"), post, () => null)).toBe(false);
    expect(claimShoreVerb("lar:control-event", place(SHORE_VERB, {}, "req-3"), post, () => null)).toBe(false);
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
