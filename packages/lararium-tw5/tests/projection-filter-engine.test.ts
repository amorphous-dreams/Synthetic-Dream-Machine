/** The operator projection knob agrees with TiddlyWiki's own filter engine. */
import { describe, test, expect, beforeAll } from "vitest";
import { PROJECTION_FILTER, PROJECTION_FILTER_TEXT, projectionFilterTitle, filterSelects, type ProjectionClass } from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const TITLES = ["$:/temp/x", "$:/state/tab", "$:/StoryList", "lar:///ha.ka.ba/lararium/config/x", "lar:///ha.ka.ba/bags/daemon/receipts/r1", "$:/lares/swarm/house-cap", "A Plain Note"];
const CLASSES: Array<"base" | ProjectionClass> = ["base", "temp"];
const titleOf = (c: "base" | ProjectionClass) => c === "base" ? PROJECTION_FILTER : projectionFilterTitle(c);

describe.skipIf(wikiSkip)(`the projection preference in TiddlyWiki's engine${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);
  const wiki = () => engine.$tw.wiki as unknown as { getTiddlerText(t: string): string | undefined; filterTiddlers(f: string, w?: unknown, s?: unknown): string[]; getTiddler(t: string): unknown };

  test("the plugin ships base and temp preferences as shadows", () => {
    for (const c of CLASSES) expect(wiki().getTiddlerText(titleOf(c))?.trim(), c).toBe(PROJECTION_FILTER_TEXT[c]);
  });

  test("TiddlyWiki and the house evaluator agree for each shipped preference", () => {
    for (const c of CLASSES) for (const title of TITLES) {
      const text = PROJECTION_FILTER_TEXT[c];
      const source = (fn: (tiddler: unknown, title: string) => void) => fn(wiki().getTiddler(title), title);
      const result = wiki().filterTiddlers(text, undefined, source);
      expect(result.some((row) => row.startsWith("Filter error")), `${c} ${title}`).toBe(false);
      expect(result.length > 0, `${c} ${title}`).toBe(filterSelects(text, title));
    }
  });
});
