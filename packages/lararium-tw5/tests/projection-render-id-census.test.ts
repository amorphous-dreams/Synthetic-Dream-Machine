/**
 * projection-render-id-census — a frame's flush prunes the render-id and event-scope maps to the nodes the
 * frame still paints, so a hundred edits of one button leave the maps the size of one frame, never of the
 * frames that came before.
 *
 * The frame window rests on the test's own hand (fake timers), so the census reads at the flush and never
 * at the machine's speed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { renderIdCensus } from "../src/tw5-projection.js";
import { htmlOf, mountSurface, settle, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const ROOT = "$:/temp/lararium/census-root";
const COUNTER = "$:/temp/lararium/census-counter";

const liveIdsOf = (html: string): number => new Set([...html.matchAll(/data-lar-rid="([^"]+)"/g)].map((m) => m[1])).size;

describe.skipIf(wikiSkip)(`the render-id census after a hundred edits${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("RED: ridMap holds no more than the live nodes plus the roots; CONTROL: the maps grow between flushes", async () => {
    const before = renderIdCensus();
    s = await mountSurface(`{{${ROOT}}}`, [
      { title: COUNTER, text: "0" },
      { title: ROOT, type: "text/vnd.tiddlywiki", text: `<$button tooltip={{${COUNTER}}} class="bump" actions="">bump</$button>` },
    ]);
    expect(s.frames.length).toBe(1);
    const ROOTS = 2; // the story container and the popup root
    for (let i = 1; i <= 100; i++) {
      s.wiki.addTiddler({ title: COUNTER, text: String(i) });
      await s.flush();
    }
    expect(s.frames.length).toBeGreaterThan(100);
    const live = liveIdsOf(htmlOf(s.last()));
    expect(live).toBeGreaterThan(0);
    const after = renderIdCensus();
    expect(after.nodes - before.nodes, "render-id map entries this mount holds").toBeLessThanOrEqual(live + ROOTS);
    expect(after.scopes - before.scopes, "event-scope map entries this mount holds").toBeLessThanOrEqual(live + ROOTS);
    // CONTROL: between a change and its flush the maps carry both the old and the new node, so the prune
    // happens at the flush and never at the binding.
    s.wiki.addTiddler({ title: COUNTER, text: "control" });
    await settle();
    expect(renderIdCensus().nodes).toBeGreaterThan(after.nodes);
    await s.flush();
    expect(renderIdCensus().nodes - before.nodes).toBeLessThanOrEqual(liveIdsOf(htmlOf(s.last())) + ROOTS);
  }, 120_000);
});
