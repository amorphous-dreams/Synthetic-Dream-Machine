/**
 * A SURFACED PARALLEL DRAFT NEVER VANISHES IN SILENCE. Automerge drops a conflict from `getConflicts`
 * on the next write to the property, so the reading wiki's persist IS the draft's survival. Each way
 * the persist can go reads apart:
 *
 *   · the write FAILS   → the wiki's alert rail holds the draft whole (`$:/temp/lares/alert/parallel-draft/<title>`):
 *                          its text, the bag the write aimed at, and the error — the only surviving copy.
 *   · the cascade GAPS  → the draft falls to the write layer and the console names the missing rule,
 *                          exactly as a save's gap does.
 *   · a rule WITHHOLDS  → a lawful quiet skip: nothing written, nothing raised.
 *
 * CONTROL: a routed draft persists in its slot and raises nothing.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import type { ChangeOrigin, LarTiddlerRecord, ParallelDraftsChange } from "@lararium/mesh";
import { IslandAdaptor, parallelDraftAlertTitle, type IslandStore } from "../src/island-adaptor.js";
import { quoteblockFence } from "../src/deserializer.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const TITLE = "lar:///t/story";
const SHARED = "lar:///ha.ka.ba/bags/shared";
const DRAFT_BAG = "lar:///ha.ka.ba/wikis/test-wiki/draft";
const WRITE_LAYER = "lar:///ha.ka.ba/wikis/test-wiki/working";
const CASCADE = "lar:///ha.ka.ba/lararium/config/bag-paths";
const DRAFT_TITLE = `Draft of '${TITLE}' by Bob`;

/** A draft off the live value: Bob's text lost the merge. */
const draft: LarTiddlerRecord = {
  tiddler: {
    title: DRAFT_TITLE, text: "from Bob <<~ ahu #/x>> stays inert", "draft.of": TITLE, "draft.title": TITLE,
    "lar-conflict-actor": "bbbb", "lar-conflict-fields": "text", "lar-conflict-live": "",
  },
};
const change: ParallelDraftsChange = { title: TITLE, bag: SHARED, drafts: [draft] };

/** A TW5 just wide enough for the cascade walk and the alert rail. `rules` is the cascade's text. */
function fakeTw5(rules: readonly string[]) {
  const texts = new Map<string, string>([
    [CASCADE, rules.join("\n")],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", DRAFT_BAG],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", WRITE_LAYER],
  ]);
  const added = new Map<string, Record<string, unknown>>();
  class Tiddler {
    fields: Record<string, unknown>;
    constructor(fields: Record<string, unknown>) { this.fields = fields; }
  }
  const wiki = {
    getTiddler: (_t: string) => undefined,
    getTiddlerText: (t: string, fallback?: string) => texts.get(t) ?? fallback ?? "",
    filterTiddlers: (filter: string, _w: unknown, source: unknown): string[] => {
      // `[is[draft]then{ref}]` routes a draft to the slot `ref` names; `[is[draft]then[]]` withholds it.
      const m = /^\[is\[draft\]then(?:\{([^}]+)\}|\[\])\]$/.exec(filter);
      if (!m) return [];
      let tiddler: unknown;
      (source as (fn: (t: unknown, ti: string) => void) => void)((t) => { tiddler = t; });
      const fields = (tiddler as { fields?: Record<string, unknown> } | undefined)?.fields;
      if (!fields || !("draft.of" in fields)) return [];
      return [m[1] ? texts.get(m[1]) ?? "" : ""];
    },
    addTiddler: (fields: Record<string, unknown>) => { added.set(String(fields["title"]), fields); },
  };
  const engine = {
    $tw: { Tiddler, wiki, lares: { enqueueNalu: () => {}, isApplyingNalu: () => false } },
  } as unknown as TW5Engine;
  return { engine, added };
}

/** A store whose `writeFamily` records each write, or rejects with `fail`. */
function fakeStore(fail?: Error) {
  const writes: Array<{ titles: string[]; bag: string | undefined }> = [];
  const store = {
    writeFamily: (puts: LarTiddlerRecord[], _t: string[], _o: ChangeOrigin, opts?: { bag?: string }) => {
      writes.push({ titles: puts.map((p) => p.tiddler.title), bag: opts?.bag });
      return fail ? Promise.reject(fail) : Promise.resolve();
    },
  } as unknown as IslandStore;
  return { store, writes };
}

const settle = () => new Promise((res) => setTimeout(res, 0));

afterEach(() => { vi.restoreAllMocks(); });

describe("★ a parallel draft that cannot persist surfaces whole ★", () => {
  test("a failed persist raises an alert that EMBEDS the draft text, the bag and the error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { engine, added } = fakeTw5(["[is[draft]then{lar:///ha.ka.ba/lararium/config/current-wiki-draft}]"]);
    const { store, writes } = fakeStore(new Error("doc unavailable"));
    new IslandAdaptor(engine, store, "reading-wiki").onParallelDrafts(change);
    await settle();

    expect(writes).toEqual([{ titles: [DRAFT_TITLE], bag: DRAFT_BAG }]);
    const alert = added.get(parallelDraftAlertTitle(DRAFT_TITLE));
    expect(alert).toBeDefined();
    expect(alert!["tags"]).toBe("$:/tags/Alert");
    expect(alert!["bag"]).toBe(DRAFT_BAG);
    expect(alert!["error"]).toBe("doc unavailable");
    expect(alert!["draft-of"]).toBe(TITLE);
    expect(alert!["draft-text"]).toBe(draft.tiddler.text);
    // The text carries the draft inside a fence, so its sigils stay inert on the rail.
    expect(String(alert!["text"])).toContain(quoteblockFence(String(draft.tiddler.text)));
    expect(String(alert!["text"])).toContain(DRAFT_BAG);
    expect(String(alert!["text"])).toContain("doc unavailable");
  });

  test("a cascade GAP falls to the write layer and names the missing rule, as a save's gap does", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { engine, added } = fakeTw5([]);
    const { store, writes } = fakeStore();
    new IslandAdaptor(engine, store, "reading-wiki").onParallelDrafts(change);
    await settle();

    expect(writes).toEqual([{ titles: [DRAFT_TITLE], bag: WRITE_LAYER }]);
    expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/no cascade rule routes .*writing to the write layer/);
    expect(added.size).toBe(0);
  });

  test("a WITHHELD draft is a lawful quiet skip — nothing written, nothing raised", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { engine, added } = fakeTw5(["[is[draft]then[]]"]);
    const { store, writes } = fakeStore();
    new IslandAdaptor(engine, store, "reading-wiki").onParallelDrafts(change);
    await settle();

    expect(writes).toEqual([]);
    expect(added.size).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  test("CONTROL: a routed draft persists in its slot and raises nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { engine, added } = fakeTw5(["[is[draft]then{lar:///ha.ka.ba/lararium/config/current-wiki-draft}]"]);
    const { store, writes } = fakeStore();
    new IslandAdaptor(engine, store, "reading-wiki").onParallelDrafts(change);
    await settle();

    expect(writes).toEqual([{ titles: [DRAFT_TITLE], bag: DRAFT_BAG }]);
    expect(added.size).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });
});
