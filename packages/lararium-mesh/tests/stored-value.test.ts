/**
 * A RECORD RESTS IMMUTABLE AND FIELD GRAIN HOLDS.
 *
 * The store rests every string of a record as an Automerge immutable scalar (`stored-record.ts`) and
 * every reader past the shore holds plain strings (`stored-value.ts`). These vectors pin what a person
 * can lose if either door slips:
 *   · a round trip keeps every value, at any depth, and the record crosses a worker port whole;
 *   · two writers who set the SAME field to different values both surface (a multi-value conflict);
 *   · two writers who set DIFFERENT fields both land, and nothing surfaces;
 *   · a re-save of standing content assigns nothing, so it never supersedes a concurrent value.
 * Each vector carries its control beside it.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, tiddlerText, type LarDoc } from "../src/base-doc.js";
import { plainEntries, plainField, plainMeta, plainRecord, plainValue, sameStoredRecord } from "../src/stored-value.js";
import { storedRecord, storedValue } from "../src/stored-record.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";

const TITLE = "lar:///t/stored/value";
const origin: ChangeOrigin = { kind: "tw-local", instanceId: "stored-value" };

type Raw = Record<string, { tiddler: Record<string, unknown>; meta?: Record<string, unknown> }>;
const rawOf = (handle: DocHandle<LarDoc>): Raw => handle.doc().tiddlers as unknown as Raw;

function twoPeers(): { a: AutomergeDocStore; b: AutomergeDocStore; ha: DocHandle<LarDoc>; hb: DocHandle<LarDoc> } {
  const repo = new Repo({ network: [] });
  const ha = repo.create<LarDoc>(emptyLarDoc());
  const hb = repo.clone(ha);
  return { a: new AutomergeDocStore(ha, "bag"), b: new AutomergeDocStore(hb, "bag"), ha, hb };
}

describe("the two doors", () => {
  test("a record wraps on the way in and unwraps on the way out, at any depth", () => {
    const record: LarTiddlerRecord = {
      tiddler: { title: TITLE, text: "body", tags: ["one", "two"], count: 3, flag: true, nested: { inner: "deep", list: ["x"] }, created: new Date("2026-10-12T00:00:00.000Z") },
      meta: { changeId: "c-1", deleted: false },
    };
    let doc = A.from<{ tiddlers: Record<string, unknown> }>({ tiddlers: {} });
    doc = A.change(doc, (d) => { d.tiddlers[TITLE] = storedRecord(record); });

    const raw = (doc.tiddlers as Raw)[TITLE]!;
    expect(A.isImmutableString(raw.tiddler["text"])).toBe(true);
    expect(A.isImmutableString((raw.tiddler["tags"] as unknown[])[0])).toBe(true);
    expect(A.isImmutableString((raw.tiddler["nested"] as Record<string, unknown>)["inner"])).toBe(true);
    expect(A.isImmutableString(raw.meta!["changeId"])).toBe(true);
    // CONTROL: a raw read answers a wrapper, never the string. A reader that skips the door misreads.
    expect(typeof raw.tiddler["text"]).toBe("object");

    const plain = plainRecord(raw as never);
    expect(plain).toEqual({
      tiddler: { title: TITLE, text: "body", tags: ["one", "two"], count: 3, flag: true, nested: { inner: "deep", list: ["x"] }, created: "2026-10-12T00:00:00.000Z" },
      meta: { changeId: "c-1", deleted: false },
    });
    expect(Object.isFrozen(plain) && Object.isFrozen(plain.tiddler)).toBe(true);
    expect(tiddlerText(raw as never)).toBe("body");
    expect(plainField(raw as never, "count")).toBe(3);
    expect(plainMeta(raw as never, "changeId")).toBe("c-1");
    expect(plainEntries(doc.tiddlers as never).map(([title]) => title)).toEqual([TITLE]);
    expect(sameStoredRecord(raw as never, { ...record, tiddler: { ...record.tiddler, created: "2026-10-12T00:00:00.000Z" } })).toBe(true);
    expect(sameStoredRecord(raw as never, { ...record, tiddler: { ...record.tiddler, text: "other" } })).toBe(false);
  });

  test("the read door reads a list inside a change, where the list stands as a document proxy", () => {
    let doc = A.from<{ t: Record<string, unknown> }>({ t: {} });
    doc = A.change(doc, (d) => { d.t["a"] = storedValue({ tags: ["base", "next"] }); });
    let inside: unknown;
    A.change(doc, (d) => { inside = plainValue((d.t["a"] as { tags: unknown }).tags); });
    expect(inside).toEqual(["base", "next"]);
  });

  test("a plain string passes the read door unchanged: a document may hold either", () => {
    let doc = A.from<{ tiddlers: Record<string, unknown> }>({ tiddlers: {} });
    doc = A.change(doc, (d) => { d.tiddlers[TITLE] = { tiddler: { title: TITLE, text: "plain" } }; });
    expect(tiddlerText((doc.tiddlers as Raw)[TITLE] as never)).toBe("plain");
  });

  test("a record the store hands out crosses a worker port whole", async () => {
    const { a } = twoPeers();
    await a.put({ tiddler: { title: TITLE, text: "body", tags: ["one"] }, meta: { changeId: "c" } }, origin);
    const record = (await a.get(TITLE))!;
    expect(structuredClone(record)).toEqual({ tiddler: { title: TITLE, text: "body", tags: ["one"] }, meta: { changeId: "c" } });
    // CONTROL: the raw record does not survive the clone: the port strips the scalar's mark.
    expect(structuredClone(rawOf((a as unknown as { handle: DocHandle<LarDoc> }).handle)[TITLE]!.tiddler["text"])).not.toBe("body");
  });
});

describe("field grain holds over immutable values", () => {
  test("two writers set the SAME field to different values: both surface, and the live value stays one of them", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put({ tiddler: { title: TITLE, text: "base", caption: "base caption" } }, origin);
    hb.merge(ha);

    await a.put({ tiddler: { title: TITLE, text: "from A", caption: "base caption" } }, origin);
    await b.put({ tiddler: { title: TITLE, text: "from B", caption: "base caption" } }, origin);
    ha.merge(hb);

    expect(A.isImmutableString(rawOf(ha)[TITLE]!.tiddler["text"])).toBe(true);
    const live = (await a.get(TITLE))!.tiddler.text;
    expect(["from A", "from B"]).toContain(live);
    const drafts = a.parallelDrafts(TITLE);
    expect(drafts.map((d) => d.tiddler.text).sort()).toEqual(["from A", "from B"]);
    for (const d of drafts) {
      expect(d.tiddler["lar-conflict-fields"]).toBe("text");
      expect(typeof d.tiddler.text).toBe("string");
      expect(d.tiddler["caption"]).toBe("base caption");
    }
  });

  test("two writers set DIFFERENT fields: both land and nothing surfaces", async () => {
    const { a, b, ha, hb } = twoPeers();
    await a.put({ tiddler: { title: TITLE, text: "base", caption: "base caption", tags: ["base"] } }, origin);
    hb.merge(ha);

    // Each writer hands the WHOLE record, as a wiki does; only the field that moved may be assigned.
    await a.put({ tiddler: { title: TITLE, text: "from A", caption: "base caption", tags: ["base"] } }, origin);
    await b.put({ tiddler: { title: TITLE, text: "base", caption: "from B", tags: ["base"] } }, origin);
    ha.merge(hb);
    hb.merge(ha);

    for (const store of [a, b]) {
      expect((await store.get(TITLE))!.tiddler).toEqual({ title: TITLE, text: "from A", caption: "from B", tags: ["base"] });
      expect(store.parallelDrafts(TITLE)).toEqual([]);
    }
  });

  test("a re-save of standing content makes no change, so it supersedes nothing", async () => {
    const { a, ha } = twoPeers();
    const record: LarTiddlerRecord = { tiddler: { title: TITLE, text: "body", tags: ["one", "two"], modified: new Date("2026-10-12T00:00:00.000Z") }, meta: { changeId: "c-1" } };
    await a.put(record, origin);
    const heads = a.headsNow();
    await a.put(record, origin);
    await a.put({ tiddler: { ...record.tiddler, modified: "2026-10-12T00:00:00.000Z" }, meta: { changeId: "c-1" } }, origin);
    expect(a.headsNow()).toEqual(heads);
    // CONTROL: a moved field does make a change.
    await a.put({ ...record, tiddler: { ...record.tiddler, text: "moved" } }, origin);
    expect(a.headsNow()).not.toEqual(heads);
    expect(A.getAllChanges(ha.doc()).length).toBeGreaterThan(0);
  });
});
