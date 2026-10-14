/**
 * THE SHORE'S LIST PAGES UNDER THE OUTCOME'S ROW CAP.
 *
 * A verb's outcome carries at most 32 rows of any array and turns a longer one into a count and a sample
 * (`boundOutcomeOutput`). A mass vanish of 50 files stood as 50 pending removals, and one `list` answer
 * carried them past the cap: the rows stayed behind and a person read a count. `list` answers a page at a
 * time, standoffs and pending removals together, and names the cursor of the page behind (`next`).
 *
 * The real projector runs over a scratch mirror; each page passes through the real outcome cap.
 * Controls: a shore under the cap answers one page with no cursor; `sense` and an answer over many removals
 * name their counts, whatever the rows.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { answerShore, shoreCursorOf, shoreList, SHORE_LIST_PAGE } from "../src/shore-verb.js";
import { boundOutcomeOutput } from "../../lararium-tw5/src/verb-vm.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const uriOf = (n: number): string => `lar:///ha.ka.ba/probe/vanish-${String(n).padStart(3, "0")}`;
const fileOf = (uri: string): string => join(root, `${uri.slice("lar:///".length)}${MEME_EXT}`);

/** Stand a projector over `n` carriers, let each project and pin its base, then vanish `gone` of the files. */
async function stand(n: number, gone: number): Promise<LarDiskProjector> {
  root = mkdtempSync(join(tmpdir(), "lar-shore-pages-"));
  const uris = Array.from({ length: n }, (_, i) => uriOf(i));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async (uri) => ({ ext: MEME_EXT, body: `title: ${uri}\n\nWHAT THE RECORDS SAY\n`, encoding: "utf8" }),
    syncedTree: new SyncedTree(join(root, ".projection", "synced-tree")),
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (uris.includes(title) ? { fields: { title, "$origin-bag": BAG } } : undefined),
    allTitles: () => uris,
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  projector.start(engine);
  await projector.idle();
  for (const uri of uris) expect(existsSync(fileOf(uri))).toBe(true);
  for (const uri of uris.slice(0, gone)) unlinkSync(fileOf(uri));
  return projector;
}

/** One page as the CLI reads it: through the outcome's own cap. */
const capped = (answer: Record<string, unknown>): Record<string, unknown> => boundOutcomeOutput(answer);

describe("a mass vanish lists whole, a page at a time", () => {
  test("50 vanished files: two pages under the cap name all 50, each row once, and the counts name 50 on each page", async () => {
    const projector = await stand(50, 50);
    const first = capped(await answerShore(projector, { op: "list" }));
    expect(first).toMatchObject({ ok: true, op: "list", pendingCount: 50, standoffCount: 0 });
    expect(Array.isArray(first["pending"])).toBe(true);
    expect((first["pending"] as unknown[]).length).toBe(SHORE_LIST_PAGE);
    expect(typeof first["next"]).toBe("string");
    const second = capped(await answerShore(projector, { op: "list", after: first["next"] }));
    expect(second).toMatchObject({ ok: true, pendingCount: 50, next: null });
    expect((second["pending"] as unknown[]).length).toBe(50 - SHORE_LIST_PAGE);
    const named = [...(first["pending"] as Array<{ uri: string }>), ...(second["pending"] as Array<{ uri: string }>)].map((p) => p.uri);
    expect(new Set(named).size).toBe(50);
    expect([...named].sort()).toEqual(Array.from({ length: 50 }, (_, i) => uriOf(i)));
  });

  test("standoffs and pending removals share one order: a page past the cap holds both kinds, and no row repeats", () => {
    // A stand-in projector answers the two reads the listing makes.
    const standing = Array.from({ length: 20 }, (_, i) => ({ bagId: BAG, uri: uriOf(i), standoff: `k${i}`, kind: "sides" as const, reason: "r" }));
    const pending = Array.from({ length: 20 }, (_, i) => ({ bagId: BAG, uri: uriOf(i + 100), path: `/p/${i}` }));
    const projector = { standing: () => standing, pendingRemovals: () => pending } as unknown as LarDiskProjector;
    const a = shoreList(projector, null, null, { limit: 25 });
    expect(a.standoffs.length + a.pending.length).toBe(25);
    expect(a.next).not.toBeNull();
    const b = shoreList(projector, null, null, { after: a.next });
    expect(b.standoffs.length + b.pending.length).toBe(15);
    expect(b.next).toBeNull();
    expect([...a.pending, ...b.pending]).toHaveLength(20);
    expect([...a.standoffs, ...b.standoffs]).toHaveLength(20);
    expect(a.next! < shoreList(projector, null, null, { after: a.next, limit: 1 }).next!).toBe(true);
  });

  test("names that hold a NUL or a quote never share a cursor, and every row lists once across pages", () => {
    expect(shoreCursorOf("pending", { bagId: "a\u0000b", uri: "c" })).not.toBe(shoreCursorOf("pending", { bagId: "a", uri: "b\u0000c" }));
    const names = ["a", "a\u0000", "a\u0000b", "a\"", "a\\", "b"];
    const pending = names.flatMap((bagId) => names.map((uri) => ({ bagId, uri, path: `/p/${bagId}/${uri}` })));
    const projector = { standing: () => [], pendingRemovals: () => pending } as unknown as LarDiskProjector;
    const read: string[] = [];
    for (let after: string | null = null; ;) {
      const page = shoreList(projector, null, null, { after, limit: 5 });
      read.push(...page.pending.map((p) => JSON.stringify([p.bagId, p.uri])));
      if (page.next === null) break;
      after = page.next;
    }
    expect(read).toHaveLength(pending.length);
    expect(new Set(read).size).toBe(pending.length);
  });

  test("the mark moves where a row swaps for another and the counts hold, and stands still where nothing moved", () => {
    const rows = (first: number) => Array.from({ length: 3 }, (_, i) => ({ bagId: BAG, uri: uriOf(i === 0 ? first : i), path: `/p/${i}` }));
    let pending = rows(0);
    const projector = { standing: () => [], pendingRemovals: () => pending } as unknown as LarDiskProjector;
    const before = shoreList(projector).mark;
    expect(shoreList(projector, null, null, { after: shoreList(projector, null, null, { limit: 1 }).next }).mark).toBe(before);
    pending = rows(77);
    expect(shoreList(projector).pendingCount).toBe(3);
    expect(shoreList(projector).mark).not.toBe(before);
  });

  test("a restore over all 50 names the counts it reached, and the rows stay readable beside the cap", async () => {
    const projector = await stand(50, 50);
    await answerShore(projector, { op: "list" });
    const answer = capped(await answerShore(projector, { op: "restore", all: true, count: 50 }));
    expect(answer).toMatchObject({ ok: true, op: "restore", doneCount: 50, leftCount: 0, left: [] });
    for (let i = 0; i < 50; i++) expect(existsSync(fileOf(uriOf(i)))).toBe(true);
  });

  test("CONTROL: a shore under the cap names every row in one answer, and `sense` names its counts", async () => {
    const projector = await stand(5, 3);
    const one = capped(await answerShore(projector, { op: "list" }));
    expect(one).toMatchObject({ ok: true, pendingCount: 3, standoffCount: 0 });
    expect((one["pending"] as unknown[]).length).toBe(3);
    expect(await answerShore(projector, { op: "sense" })).toMatchObject({ ok: true, op: "sense", standoffCount: 0, pendingCount: 3 });
  });

  test("a shore under the cap names no cursor, and `sense` answers its counts alone (the rows ride `list`)", async () => {
    const projector = await stand(5, 3);
    expect(await answerShore(projector, { op: "list" })).toMatchObject({ next: null });
    expect(await answerShore(projector, { op: "sense" })).toEqual({ ok: true, op: "sense", standoffCount: 0, pendingCount: 3 });
  });

  test("a cursor that names no text refuses by name", async () => {
    const projector = await stand(2, 1);
    expect(await answerShore(projector, { op: "list", after: 7 })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });
});
