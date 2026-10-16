/**
 * projection-render-id-census — a frame's flush prunes the render-id and event-scope maps to the nodes the
 * frame still paints, so a hundred edits of one button leave the maps the size of one frame, never of the
 * frames that came before.
 *
 * The frame window rests on the test's own hand (fake timers), so the census reads at the flush and never
 * at the machine's speed.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mountProjection, renderIdCensus } from "../src/tw5-projection.js";
import type { IslandContext } from "../src/island-context.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const ROOT = "$:/temp/lararium/census-root";
const COUNTER = "$:/temp/lararium/census-counter";

interface LooseWiki { addTiddler(fields: Record<string, unknown>): void }
const settleChange = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => process.nextTick(resolve)); };
const liveIdsOf = (html: string): number => new Set([...html.matchAll(/data-lar-rid="([^"]+)"/g)].map((m) => m[1])).size;

describe.skipIf(wikiSkip)(`the render-id census after a hundred edits${skipNote}`, () => {
  let stop: (() => void) | undefined;
  let dispose: (() => void) | undefined;
  afterEach(() => { stop?.(); dispose?.(); stop = undefined; dispose = undefined; vi.useRealTimers(); });

  test("RED: ridMap holds no more than the live nodes plus the roots; CONTROL: the maps grow between flushes", async () => {
    const engine = await bootTestWiki({ tiddlers: [
      { title: COUNTER, text: "0" },
      { title: ROOT, type: "text/vnd.tiddlywiki", text: `<$button tooltip={{${COUNTER}}} class="bump" actions="">bump</$button>` },
    ] });
    dispose = () => engine.dispose();
    engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: `{{${ROOT}}}` });
    const wiki = (engine.$tw as unknown as { wiki: LooseWiki }).wiki;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const frames: string[] = [];
    const before = renderIdCensus();
    stop = mountProjection({
      wikiUri: "lar:///test/census",
      tw5: engine,
      post: (msg) => { if (msg.listenable === "projection:frame") frames.push((msg.payload as { html: string }).html); },
    } as IslandContext);
    vi.advanceTimersByTime(100);
    expect(frames.length).toBe(1);
    const ROOTS = 2; // the story container and the popup root
    for (let i = 1; i <= 100; i++) {
      wiki.addTiddler({ title: COUNTER, text: String(i) });
      await settleChange();
      vi.advanceTimersByTime(100);
    }
    expect(frames.length).toBeGreaterThan(100);
    const live = liveIdsOf(frames.at(-1)!);
    expect(live).toBeGreaterThan(0);
    const after = renderIdCensus();
    expect(after.nodes - before.nodes, "render-id map entries this mount holds").toBeLessThanOrEqual(live + ROOTS);
    expect(after.scopes - before.scopes, "event-scope map entries this mount holds").toBeLessThanOrEqual(live + ROOTS);
    // CONTROL: between a change and its flush the maps carry both the old and the new node, so the prune
    // happens at the flush and never at the binding.
    wiki.addTiddler({ title: COUNTER, text: "control" });
    await settleChange();
    expect(renderIdCensus().nodes).toBeGreaterThan(after.nodes);
    vi.advanceTimersByTime(100);
    expect(renderIdCensus().nodes - before.nodes).toBeLessThanOrEqual(liveIdsOf(frames.at(-1)!) + ROOTS);
  }, 120_000);
});
