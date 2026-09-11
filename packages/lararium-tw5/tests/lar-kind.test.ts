/**
 * lar-kind — the kind of a raw tiddler, one word, read the way TiddlyWiki reads it.
 *
 * ── THE PARITY THIS HOLDS ───────────────────────────────────────────────────────────────────────
 * A stock `tiddlywiki --listen` carrying the plugin and a lararium island MUST answer the same kind
 * for the same tiddler. Every vector here drives the REAL engine over the PACKED plugin, and the
 * answers are checked against TiddlyWiki's OWN spellings of the predicates (`is[draft]`, `is[system]`,
 * the `$:/temp/` prefixes) rather than against a hand-written table — a table would bless whatever
 * the operator did.
 *
 * ── THE FIELD DECIDES ───────────────────────────────────────────────────────────────────────────
 * Operator ruling (2026-09-11, quote license): "Approve moving to `draft.of` as the switch (pono w/
 * TW5 server/client setups)." `Tiddler.isDraft` reads `hasField("draft.of")`; so does `lar-kind`;
 * so does the cascade's `[is[draft]…]` rule. The CONTROL is a tiddler titled `Draft of Beer` with no
 * field: content, routed to working.
 *
 * ── THE DELETE PATH, RED FIRST ──────────────────────────────────────────────────────────────────
 * A delete runs after the tiddler has gone, so no field can be read then. The cascade's draft rule
 * yields nothing for a gone title and the walk falls to the catch-all — working — while the record
 * lives in the draft slot above it: the tombstone lands under the record and the draft resurrects.
 * `island-adaptor.ts` answers with a LAST-KNOWN-SLOT map, fed at every outbound save with the
 * cascade's verdict AND at every inbound apply with the envelope's `$origin-bag`, read by
 * `deleteTiddler` before the cascade; a title never seen this session falls back to the cascade's
 * title read. The witness below holds it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/recipe-layer-model
 */

import { describe, expect, test, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { bootTestWiki, wikiSkip, skipNote, REPO } from "./test-wiki.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { PERSONAL_TITLE_PREFIXES } from "../src/filters/lar-kind.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { ChangeOrigin, LarTiddlerRecord, LarWriteOptions } from "@lararium/mesh";

const SLOT_WORKING  = "lar:///ha.ka.ba/wikis/test/working";
const SLOT_DRAFT    = "lar:///ha.ka.ba/wikis/test/draft";
const SLOT_PERSONAL = "lar:///ha.ka.ba/wikis/test/personal";
const SLOT_TEMP     = "lar:///ha.ka.ba/wikis/test/temp";

/** A census of titles, one or more per kind, the plain-titled ones a hand would type. */
const CENSUS: ReadonlyArray<Record<string, string>> = [
  { title: "$:/temp/volatile/scratch", text: "" },
  { title: "$:/temp/session", text: "" },
  { title: "Draft of 'X' by Alice", "draft.of": "X", "draft.title": "X", text: "" },
  { title: "下書き 'X'", "draft.of": "X", "draft.title": "X", text: "" },
  { title: "Draft of Beer", text: "a recipe, not a draft" },
  { title: "$:/StoryList", list: "HelloThere", text: "" },
  { title: "$:/state/folded/HelloThere", text: "hide" },
  { title: "$:/state/tab-sidebar", text: "$:/core/ui/SideBar/Open" },
  { title: "$:/palette", text: "$:/palettes/Vanilla" },
  { title: "$:/status/UserName", text: "Alice" },
  { title: "$:/SiteTitle", text: "Parity" },
  { title: "$:/state/other", text: "" },
  { title: "HelloThere", text: "content" },
  { title: "lar:///ha.ka.ba/lares/api/pono/thing", text: "content" },
];

type Wiki = {
  filterTiddlers(f: string, w?: unknown, s?: unknown): string[];
  getTiddler(t: string): unknown;
  addTiddler(t: unknown): void;
  isSystemTiddler(t: string): boolean;
  isTemporaryTiddler(t: string): boolean;
  isVolatileTiddler(t: string): boolean;
};

describe.skipIf(wikiSkip)(`lar-kind — one word for the kind of a raw tiddler${skipNote}`, () => {
  let engine: TW5Engine;
  let wiki: Wiki;
  const kindOf = (title: string): string => wiki.filterTiddlers(`[[${title}]lar-kind[]]`)[0] ?? "";
  const ofKind = (kind: string): string[] =>
    wiki.filterTiddlers(`[all[tiddlers]] :filter[lar-kind[]match[${kind}]] +[sort[]]`);

  beforeAll(async () => {
    engine = await bootTestWiki({ tiddlers: CENSUS });
    wiki = engine.$tw.wiki as never as Wiki;
  }, 120_000);

  test("★ the operator is REGISTERED under its hyphenated name ★", () => {
    // An unregistered operator yields an EMPTY list, which reads like a kind that matched nothing.
    expect(kindOf("HelloThere"), "`lar-kind` resolves to nothing — the export binding lost its name").toBe("content");
  });

  test("★ draft reads the `draft.of` FIELD — the localized, user-attributed title decides nothing ★", () => {
    expect(kindOf("Draft of 'X' by Alice")).toBe("draft");
    expect(kindOf("下書き 'X'")).toBe("draft");
  });

  test("CONTROL: `Draft of Beer` with no `draft.of` field reads content", () => {
    expect(kindOf("Draft of Beer")).toBe("content");
  });

  test("the kinds agree with TiddlyWiki's own spellings of the same predicates", () => {
    expect(ofKind("draft")).toEqual(wiki.filterTiddlers("[all[tiddlers]is[draft]sort[]]"));
    expect(ofKind("volatile")).toEqual(wiki.filterTiddlers("[all[tiddlers]prefix[$:/temp/volatile/]sort[]]"));
    expect(ofKind("temporary")).toEqual(wiki.filterTiddlers("[all[tiddlers]prefix[$:/temp/]!prefix[$:/temp/volatile/]sort[]]"));
    // system = TW5's `is[system]` minus the kinds that read more specifically.
    const personal = wiki.filterTiddlers("[all[tiddlers]is[system]] :filter[lar-kind[]match[personal]] +[sort[]]");
    expect(ofKind("personal")).toEqual(personal);
    expect(ofKind("system")).toEqual(
      wiki.filterTiddlers("[all[tiddlers]is[system]!prefix[$:/temp/]sort[]]").filter((t) => !personal.includes(t)),
    );
    expect(ofKind("content")).toEqual(wiki.filterTiddlers("[all[tiddlers]!is[system]!is[draft]sort[]]"));
  });

  test("every tiddler answers exactly one kind", () => {
    const all = wiki.filterTiddlers("[all[tiddlers]]");
    const words = new Set(["volatile", "temporary", "draft", "personal", "system", "content"]);
    for (const t of all) expect(words.has(kindOf(t)), `${t} answers "${kindOf(t)}"`).toBe(true);
  });

  test("a title with no tiddler still answers, by its title alone", () => {
    expect(kindOf("$:/temp/never-made")).toBe("temporary");
    expect(kindOf("never made")).toBe("content");
  });
});

/**
 * THE CASCADE READS THE SAME PREDICATES. The packed `bag-paths` cascade routes `personal` through
 * `lar-kind` and `draft` through `is[draft]`, so the slot a save lands in and the word the kind
 * operator answers cannot drift apart — one spelling of each set.
 */
describe.skipIf(wikiSkip)(`lar-kind — the cascade reads the kind${skipNote}`, () => {
  let engine: TW5Engine;
  let wiki: Wiki;
  let route: (title: string) => string | null;

  beforeAll(async () => {
    engine = await bootTestWiki({ tiddlers: CENSUS });
    wiki = engine.$tw.wiki as never as Wiki;
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag",      SLOT_WORKING],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp",     SLOT_TEMP],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft",    SLOT_DRAFT],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOT_PERSONAL],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    const cascade = (engine.$tw.wiki as never as { getTiddlerText(t: string, d: string): string })
      .getTiddlerText("lar:///ha.ka.ba/lararium/config/bag-paths", "")
      .split("\n").map((s) => s.trim()).filter(Boolean);
    route = (title: string): string | null => {
      const source = (fn: (t: unknown, ti: string) => void): void => fn(wiki.getTiddler(title), title);
      for (const f of cascade) {
        const r = wiki.filterTiddlers(f, undefined, source as never);
        if (r.length === 0) continue;
        return (r[0] ?? "") === "" ? null : r[0]!;
      }
      return null;
    };
  }, 120_000);

  test("★ a user-attributed draft routes to the draft slot; the field-less control routes to working ★", () => {
    expect(route("Draft of 'X' by Alice")).toBe(SLOT_DRAFT);
    expect(route("下書き 'X'")).toBe(SLOT_DRAFT);
    expect(route("Draft of Beer")).toBe(SLOT_WORKING);
  });

  test("every title lar-kind calls personal routes to the personal slot, and no other does", () => {
    for (const t of wiki.filterTiddlers("[all[tiddlers]]")) {
      const kind = wiki.filterTiddlers(`[[${t}]lar-kind[]]`)[0];
      if (kind === "personal") expect(route(t), t).toBe(SLOT_PERSONAL);
      else expect(route(t), t).not.toBe(SLOT_PERSONAL);
    }
    for (const p of PERSONAL_TITLE_PREFIXES) expect(route(`${p}x`)).toBe(SLOT_PERSONAL);
  });
});

/** A store that records WHICH bag each write and each tombstone named. */
class SlotRecordingStore extends MemoryTiddlerStore {
  readonly putBags = new Map<string, string | undefined>();
  readonly tombstoneBags: Array<{ title: string; bag: string | null }> = [];
  override async put(record: LarTiddlerRecord, origin: ChangeOrigin, options?: LarWriteOptions): Promise<void> {
    this.putBags.set(record.tiddler.title, options?.bag);
    return super.put(record, origin, options);
  }
  override async tombstone(title: string, origin: ChangeOrigin): Promise<void> {
    this.tombstoneBags.push({ title, bag: null });
    return super.tombstone(title, origin);
  }
  async tombstoneInBag(bag: string, title: string, origin: ChangeOrigin): Promise<void> {
    this.tombstoneBags.push({ title, bag });
    return super.tombstone(title, origin);
  }
}

describe.skipIf(wikiSkip)(`lar-kind — the adaptor lands a draft where the field says${skipNote}`, () => {
  let engine: TW5Engine;

  beforeAll(async () => { engine = await bootTestWiki(); }, 120_000);

  const rig = (): { adaptor: IslandAdaptor; store: SlotRecordingStore; wiki: Wiki } => {
    const wiki = engine.$tw.wiki as never as Wiki;
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag",      SLOT_WORKING],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp",     SLOT_TEMP],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft",    SLOT_DRAFT],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOT_PERSONAL],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    const store = new SlotRecordingStore();
    return { adaptor: new IslandAdaptor(engine, store, "lar-kind"), store, wiki };
  };

  test("★ a save carrying `draft.of` lands in the draft slot ★", async () => {
    const { adaptor, store, wiki } = rig();
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    const fields = { title: "Draft of 'X' by Alice", "draft.of": "X", "draft.title": "X", text: "drafting" };
    wiki.addTiddler(new Tiddler(fields));
    await adaptor.saveTiddler({ fields });
    expect(store.putBags.get(fields.title)).toBe(SLOT_DRAFT);
  });

  /**
   * `deleteTiddler` runs after the wiki has dropped the tiddler; `is[draft]` reads nothing; the
   * cascade falls to working. The adaptor tombstones in the slot it last routed this title to.
   */
  test("★ deleting a draft tombstones in the DRAFT slot, not working ★", async () => {
    const { adaptor, store, wiki } = rig();
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    const fields = { title: "Draft of 'Y' by Alice", "draft.of": "Y", "draft.title": "Y", text: "drafting" };
    wiki.addTiddler(new Tiddler(fields));
    await adaptor.saveTiddler({ fields });
    (wiki as never as { deleteTiddler(t: string): void }).deleteTiddler(fields.title);
    await adaptor.deleteTiddler(fields.title);
    expect(store.tombstoneBags).toEqual([{ title: fields.title, bag: SLOT_DRAFT }]);
  });
});

/** The packed cascade reads the field and the kind — rebuild the plugin if this reds. */
describe("the packed cascade reads `is[draft]` and `lar-kind[]match[personal]`", () => {
  test("the plugin's bag-paths carries no title-prefix draft rule", () => {
    const plugin = JSON.parse(
      readFileSync(path.join(REPO, "packages/lararium-tw5/plugins/lares-memetic-wikitext.json"), "utf8"),
    ) as { text: string };
    const packed = (JSON.parse(plugin.text) as { tiddlers: Record<string, { text: string }> })
      .tiddlers["lar:///ha.ka.ba/lararium/config/bag-paths"]!.text;
    expect(packed).toContain("[is[draft]then{lar:///ha.ka.ba/lararium/config/current-wiki-draft}]");
    expect(packed).toContain("[lar-kind[]match[personal]then{lar:///ha.ka.ba/lararium/config/current-wiki-personal}]");
    expect(packed).not.toContain("Draft of ");
  });
});
