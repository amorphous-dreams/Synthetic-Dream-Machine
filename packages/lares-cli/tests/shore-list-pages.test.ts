/**
 * `lares shore` reads every page of the shore's list.
 *
 * The island answers its list a page at a time under the outcome's row cap and names the cursor of the
 * page behind (`next`). The door hands each cursor back as `after` until none remains, so a mass vanish of
 * 50 files lists 50. A page that carries a count where its rows belong refuses by name; so do a cursor
 * that stands still and counts that move between two pages.
 *
 * Control: a shore that answers one page reads in one ask; an island's own refusal keeps its name.
 */
import { describe, test, expect } from "vitest";
import { readShoreList, type ShoreAnswer } from "../src/shore-core.js";
import { answeredRows } from "../src/commands/shore.js";
import { takeDisk } from "../src/shore-take-disk.js";

const row = (n: number): Record<string, unknown> => ({ bagId: "lares", uri: `lar:///a.b.c/v-${String(n).padStart(3, "0")}`, path: `/m/v-${n}.mem` });
const ok = (output: Record<string, unknown>): ShoreAnswer => ({ ok: true, output, refusal: null, why: null, requestId: "req" });

/** An island holding `n` pending removals that answers pages of 32, each under the mark of the shore it read. */
function island(n: number, opts: { capAt?: number; stuck?: boolean; moveAfterFirst?: boolean; swapAfterFirst?: boolean; noMark?: boolean } = {}) {
  const asked: Array<Record<string, unknown>> = [];
  const ask = async (a: Readonly<Record<string, unknown>>): Promise<ShoreAnswer> => {
    asked.push({ ...a });
    const start = typeof a["after"] === "string" ? Number(a["after"]) : 0;
    // A later page may read a shore that moved: one more row, or one row swapped for another (the counts hold).
    const moved = start > 0 && (opts.moveAfterFirst || opts.swapAfterFirst);
    const all = Array.from({ length: opts.moveAfterFirst && moved ? n + 1 : n }, (_, i) => row(opts.swapAfterFirst && moved && i === 0 ? 999 : i));
    const page = all.slice(start, start + 32);
    const next = start + 32 < all.length ? String(opts.stuck ? 0 : start + 32) : null;
    const pending = opts.capAt !== undefined && page.length > opts.capAt ? { boundedArrayCount: page.length, sample: page.slice(0, 3) } : page;
    const mark = all.map((r) => String(r["uri"])).join("|");
    return ok({ ok: true, op: "list", standoffs: [], standoffCount: 0, pending, pendingCount: all.length, ...(opts.noMark ? {} : { mark }), next });
  };
  return { ask, asked };
}

describe("the door reads every page", () => {
  test("50 pending removals read across two pages: 50 rows, the cursor handed back once", async () => {
    const i = island(50);
    const listed = await readShoreList(i.ask, { op: "list" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.pending).toHaveLength(50);
    expect(new Set(listed.pending.map((p) => p["uri"])).size).toBe(50);
    expect(i.asked).toEqual([{ op: "list" }, { op: "list", after: "32" }]);
  });

  test("a page that carries a count where its rows belong refuses by name, and lists nothing", async () => {
    const listed = await readShoreList(island(50, { capAt: 10 }).ask, { op: "list" });
    expect(listed).toMatchObject({ ok: false, refusal: "shore-list-unpaged" });
    expect(listed.ok ? "" : listed.why).toContain("count of 32");
  });

  test("a cursor that stands still refuses by name", async () => {
    expect(await readShoreList(island(100, { stuck: true }).ask, { op: "list" })).toMatchObject({ ok: false, refusal: "shore-list-unpaged" });
  });

  test("counts that move between two pages refuse by name", async () => {
    expect(await readShoreList(island(50, { moveAfterFirst: true }).ask, { op: "list" })).toMatchObject({ ok: false, refusal: "shore-list-moved" });
  });

  test("a row swapped for another between two pages, the counts unmoved, refuses by name", async () => {
    expect(await readShoreList(island(50, { swapAfterFirst: true }).ask, { op: "list" })).toMatchObject({ ok: false, refusal: "shore-list-moved" });
  });

  test("a page that names no mark of the shore it read refuses by name", async () => {
    expect(await readShoreList(island(3, { noMark: true }).ask, { op: "list" })).toMatchObject({ ok: false, refusal: "shore-list-unpaged" });
  });

  test("pages that name fewer rows than the counts refuse by name", async () => {
    const ask = async (): Promise<ShoreAnswer> => ok({ ok: true, op: "list", standoffs: [], standoffCount: 0, pending: [row(1)], pendingCount: 40, mark: "m", next: null });
    expect(await readShoreList(ask, { op: "list" })).toMatchObject({ ok: false, refusal: "shore-list-unpaged" });
  });

  test("CONTROL: one page reads in one ask, and the island's own refusal keeps its name", async () => {
    const i = island(3);
    const listed = await readShoreList(i.ask, { op: "list", bag: "lares" });
    expect(listed).toMatchObject({ ok: true });
    expect(listed.ok ? listed.pending : []).toHaveLength(3);
    expect(i.asked).toEqual([{ op: "list", bag: "lares" }]);
    const refused = await readShoreList(async () => ({ ok: false, output: {}, refusal: "no-disk-shore", why: "no projection" }), { op: "list" });
    expect(refused).toMatchObject({ ok: false, refusal: "no-disk-shore" });
  });
});

describe("take-disk reads the key across every page", () => {
  test("a keyed standoff on the second page gets found: the door weighs it (here, a `home` standoff holds no disk side)", async () => {
    const uri = "lar:///a.b.c/many";
    const all = Array.from({ length: 40 }, (_, i) => ({ bagId: `bag-${String(i).padStart(2, "0")}`, uri, standoff: `k${i}`, kind: i === 39 ? "home" : "sides", reason: "r" }));
    const ask = async (a: Readonly<Record<string, unknown>>): Promise<ShoreAnswer> => {
      const start = typeof a["after"] === "string" ? Number(a["after"]) : 0;
      return ok({ ok: true, op: "list", standoffs: all.slice(start, start + 32), standoffCount: 40, pending: [], pendingCount: 0, mark: "one", next: start + 32 < 40 ? String(start + 32) : null });
    };
    const taken = await takeDisk({ uri, key: "k39" }, { ask, tree: {} as never, root: "/nowhere", did: "did:test" });
    expect(taken).toMatchObject({ ok: false, refusal: "standoff-holds-no-disk-side" });
  });
});

describe("an answer over many removals reads its counts", () => {
  test("past the cap the counts decide what the answer reached and left", () => {
    const capped = { boundedArrayCount: 50, sample: [] };
    expect(answeredRows({ done: capped, doneCount: 50, left: [], leftCount: 0 })).toEqual({ done: [], doneCount: 50, left: [], leftCount: 0 });
    expect(answeredRows({ done: [], doneCount: 0, left: capped, leftCount: 40 }).leftCount).toBe(40);
  });
  test("CONTROL: rows under the cap read as they stand", () => {
    expect(answeredRows({ done: ["a"], left: ["b"] })).toEqual({ done: ["a"], doneCount: 1, left: ["b"], leftCount: 1 });
  });
});
