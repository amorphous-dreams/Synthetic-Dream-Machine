/**
 * projection-detached-id — a node a re-render detached fires nothing, even before the next frame lands.
 *
 * The page relays a click by the render-id the last frame carried. A wiki change can re-render the widget
 * tree and detach that node before the coalesce gate flushes the next frame, so the id still reads live
 * in the frame the page holds. TW5's fakedom `removeChild` splices the node out of its parent's children
 * and leaves `parentNode` standing, so only a walk through each parent's `children` tells a detached node
 * from a live one. The dispatch answers `stale-target` for such a node and runs no handler.
 *
 * The frame window rests on the test's own hand: the coalesce gate's timer stands faked, so no frame
 * flushes until the test advances it, and the window between the detach and the next frame holds by
 * construction, never by the machine's speed.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { dispatchProjectedEvent, dispatchProjectedInput, mountProjection } from "../src/tw5-projection.js";
import type { IslandContext } from "../src/island-context.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const ROOT = "$:/temp/lararium/detached-id-root";
const SHOW = "$:/temp/lararium/detached-id-show";
const CLICKED = "$:/temp/lararium/detached-id-clicked";

interface LooseWiki {
  getTiddler(title: string): { fields: Record<string, unknown> } | undefined;
  addTiddler(fields: Record<string, unknown>): void;
}

function ridOf(html: string, cls: string): string {
  const tag = [...html.matchAll(/<(?:button|input)\b[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(t));
  if (!tag) throw new Error(`no projected node of class ${cls}`);
  const rid = tag.match(/data-lar-rid="([^"]+)"/);
  if (!rid) throw new Error(`the ${cls} node carries no render-id`);
  return rid[1]!;
}

/** Let TW5 deliver its change event and the camera refresh, with no timer advanced (so no frame flushes). */
const settleChange = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => process.nextTick(resolve)); };

describe.skipIf(wikiSkip)(`a detached render id${skipNote}`, () => {
  let stop: (() => void) | undefined;
  let dispose: (() => void) | undefined;
  afterEach(() => { stop?.(); dispose?.(); stop = undefined; dispose = undefined; vi.useRealTimers(); });

  test("RED: a click and an input on nodes a re-render detached answer stale-target before the next frame — CONTROL: while attached they fire", async () => {
    const engine = await bootTestWiki({ tiddlers: [
      { title: SHOW, text: "yes" },
      { title: ROOT, type: "text/vnd.tiddlywiki", text: [
        `<$reveal state="${SHOW}" type="match" text="yes">`,
        `<$button class="go" set="${CLICKED}" setTo="clicked">go</$button>`,
        `<$edit-text tiddler="${CLICKED}" field="typed" tag="input" class="typed"/>`,
        `</$reveal>`,
      ].join("") },
    ] });
    dispose = () => engine.dispose();
    engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: `{{${ROOT}}}` });
    const wiki = (engine.$tw as unknown as { wiki: LooseWiki }).wiki;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const frames: string[] = [];
    stop = mountProjection({
      wikiUri: "lar:///test/detached-id",
      tw5: engine,
      post: (msg) => { if (msg.listenable === "projection:frame") frames.push((msg.payload as { html: string }).html); },
    } as IslandContext);
    vi.advanceTimersByTime(100);
    expect(frames.length).toBeGreaterThan(0);
    const goRid = ridOf(frames.at(-1)!, "go");
    const typedRid = ridOf(frames.at(-1)!, "typed");

    // CONTROL: attached and live, the button fires.
    expect(dispatchProjectedEvent(goRid, "click", { button: 0 })).toBe("dispatched");
    await settleChange();
    expect(wiki.getTiddler(CLICKED)?.fields["text"]).toBe("clicked");
    vi.advanceTimersByTime(100);
    const liveGo = ridOf(frames.at(-1)!, "go");
    const liveTyped = ridOf(frames.at(-1)!, "typed");
    const framesBefore = frames.length;

    // The reveal closes: the re-render detaches both nodes, and no frame flushes yet.
    wiki.addTiddler({ title: SHOW, text: "no" });
    await settleChange();
    expect(frames.length, "no frame flushed inside the window").toBe(framesBefore);
    wiki.addTiddler({ title: CLICKED, text: "untouched" });
    await settleChange();

    expect(dispatchProjectedEvent(liveGo, "click", { button: 0 })).toBe("stale-target");
    expect(dispatchProjectedInput(liveTyped, "input", "late keystroke")).toBe("stale-target");
    await settleChange();
    expect(wiki.getTiddler(CLICKED)?.fields["text"], "the detached button ran no handler").toBe("untouched");
    expect(wiki.getTiddler(CLICKED)?.fields["typed"], "the detached input wrote nothing").toBeUndefined();
    expect(goRid).toBeDefined();
    expect(typedRid).toBeDefined();
  }, 120_000);
});
