/**
 * projection-detached-id — a node a re-render detached fires nothing, even before the next frame lands.
 *
 * The page relays an act by the render-id the last frame carried. A wiki change can re-render the widget
 * tree and detach that node before the coalesce gate flushes the next frame, so the id still reads live
 * in the frame the page holds. TW5's fakedom `removeChild` splices the node out of its parent's children
 * and leaves `parentNode` standing, so only a walk through each parent's `children` tells a detached node
 * from a live one. The dispatcher answers `stale-target` for such a node and runs no handler; a sense on it
 * answers nothing and writes nothing.
 *
 * The frame window rests on the test's own hand: the coalesce gate's timer stands faked, so no frame
 * flushes until the test advances it, and the window between the detach and the next frame holds by
 * construction, never by the machine's speed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { mountSurface, settle, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const ROOT = "$:/temp/lararium/detached-id-root";
const SHOW = "$:/temp/lararium/detached-id-show";
const CLICKED = "$:/temp/lararium/detached-id-clicked";

describe.skipIf(wikiSkip)(`a detached render id${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("RED: a click, a commit and a sense on nodes a re-render detached run nothing before the next frame — CONTROL: while attached they fire", async () => {
    s = await mountSurface(`{{${ROOT}}}`, [
      { title: SHOW, text: "yes" },
      { title: ROOT, type: "text/vnd.tiddlywiki", text: [
        `<$reveal state="${SHOW}" type="match" text="yes">`,
        `<$button class="go" set="${CLICKED}" setTo="clicked">go</$button>`,
        `<$edit-text tiddler="${CLICKED}" field="typed" tag="input" class="typed"/>`,
        `</$reveal>`,
      ].join("") },
    ]);
    expect(s.frames.length).toBeGreaterThan(0);

    // CONTROL: attached and live, the button fires.
    expect(dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(CLICKED)?.fields["text"]).toBe("clicked");
    const click = s.event("go", { kind: "lar:act", action: "lar:click" });
    const commit = s.event("typed", { kind: "lar:act", action: "lar:commit", wholeValue: "late keystroke" });
    const sense = s.event("typed", { kind: "lar:sense", action: "lar:sense", wholeValue: "late keystroke", localRev: 1 });
    const framesBefore = s.frames.length;

    // The reveal closes: the re-render detaches both nodes, and no frame flushes yet.
    s.wiki.addTiddler({ title: SHOW, text: "no" });
    await settle();
    expect(s.frames.length, "no frame flushed inside the window").toBe(framesBefore);
    s.wiki.addTiddler({ title: CLICKED, text: "untouched" });
    await settle();

    expect(dispatchLarControlEvent(click)).toMatchObject({ eventId: click.eventId, status: "stale-target" });
    expect(dispatchLarControlEvent(commit)).toMatchObject({ eventId: commit.eventId, status: "stale-target" });
    expect(dispatchLarControlEvent(sense), "a droppable sense answers nothing, stale or live").toBeNull();
    await settle();
    expect(s.wiki.getTiddler(CLICKED)?.fields["text"], "the detached button ran no handler").toBe("untouched");
    expect(s.wiki.getTiddler(CLICKED)?.fields["typed"], "the detached input wrote nothing").toBeUndefined();
    expect(s.results.slice(-2).map((r) => r.status), "both stale answers crossed ctx.post").toEqual(["stale-target", "stale-target"]);
  }, 120_000);
});
