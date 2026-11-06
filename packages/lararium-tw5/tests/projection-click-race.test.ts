/**
 * projection-click-race — a click that races a repaint re-resolves its target by the stable control id, once.
 *
 * The page relays a click by the control id the last frame carried. A wiki change can re-render the widget
 * tree and replace that node (a fresh render id) before the coalesce gate flushes the next frame, so the held
 * node reads detached. The cure re-resolves the control id against the live tree and retries once, only while
 * that id still names the same tiddler (`data-tiddler`); otherwise the click lands nothing and answers
 * `stale-target`, which the page paints as the refusal. The coalesce timer stands faked, so the window between
 * the repaint and the next frame holds by construction, never by the machine's speed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { mountSurface, settle, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const ROOT = "$:/temp/lararium/click-race-root";
const EPOCH = "$:/temp/lararium/click-race-epoch";
const NAMED = "$:/temp/lararium/click-race-named";
const A = "lar:///t/click-race/a";
const B = "lar:///t/click-race/b";
const HIT = "$:/temp/lararium/click-race-hit";

/** The button keys on the epoch, so a change to EPOCH replaces the node; it names the tiddler NAMED holds. */
const ROOT_TEXT = [
  `<$list filter="[[${EPOCH}]get[text]]" variable="epoch">`,
  `<$button class="go" data-control-id="go" data-tiddler={{${NAMED}}} set="${HIT}" setTo="hit">go</$button>`,
  `</$list>`,
].join("");

describe.skipIf(wikiSkip)(`a click racing a repaint${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  const mount = () => mountSurface(`{{${ROOT}}}`, [
    { title: EPOCH, text: "1" },
    { title: NAMED, text: A },
    { title: ROOT, type: "text/vnd.tiddlywiki", text: ROOT_TEXT },
  ]);
  const click = (surface: Surface) => surface.event("go", { kind: "lar:act", action: "lar:click", controlId: "go" });
  const hit = (surface: Surface) => surface.wiki.getTiddler(HIT)?.fields["text"];

  test("CONTROL: a click on a settled page lands once", async () => {
    s = await mount();
    const ev = click(s);
    expect(dispatchLarControlEvent(ev)).toMatchObject({ status: "applied" });
    await s.flush();
    expect(hit(s)).toBe("hit");
    expect(s.results.filter((r) => r.eventId === ev.eventId)).toHaveLength(1);
  }, 120_000);

  test("RED: a click racing a repaint lands on the re-resolved target while the id still names the same tiddler", async () => {
    s = await mount();
    const ev = click(s);
    const framesBefore = s.frames.length;
    s.wiki.addTiddler({ title: EPOCH, text: "2" });   // the repaint replaces the node; no frame flushes yet
    await settle();
    expect(s.frames.length, "no frame flushed inside the window").toBe(framesBefore);
    expect(dispatchLarControlEvent(ev)).toMatchObject({ eventId: ev.eventId, status: "applied" });
    await s.flush();
    expect(hit(s), "the re-resolved button ran its handler once").toBe("hit");
  }, 120_000);

  test("RED: a click whose id names another tiddler after the repaint lands nothing and answers the refusal", async () => {
    s = await mount();
    const ev = click(s);
    s.wiki.addTiddler({ title: NAMED, text: B });
    s.wiki.addTiddler({ title: EPOCH, text: "2" });
    await settle();
    expect(dispatchLarControlEvent(ev)).toMatchObject({ eventId: ev.eventId, status: "stale-target" });
    await s.flush();
    expect(hit(s), "the other tiddler's button ran nothing").toBeUndefined();
  }, 120_000);
});
