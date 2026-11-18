/**
 * projection-lar-frame — the story camera speaks `lar:frame`: keyed absolute state under a mount epoch, naming
 * the sensed revisions it had taken in when it rendered (dreamdom#/the-ruling, page-controls#/the-wire).
 *
 *   - Every frame crosses `ctx.post` as its own kind, never the scalar `event` envelope.
 *   - `lar:surface` carries the story container's whole HTML under its own monotone revision; `lar:style` carries
 *     the whole stylesheet only when its text moved since the mount's last frame; `lar:membership` names the set.
 *   - `mountEpoch` stands minted at mount and re-mints on `lar:resend`, which re-emits every key whole.
 *   - `sensedRevision` names, per control, the page revision the island took in before the render.
 *   - Frames never answer events: an answer travels on `lar:control-result`, and no frame paints one.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_CONTROL_EVENT, LAR_FRAME, LAR_KEY_MEMBERSHIP, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, LAR_KEY_STYLE, LAR_KEY_SURFACE, LAR_RESEND,
  mkLarResend, readLarFrame,
} from "@lararium/mesh";
import { hasProjection } from "../src/has-island-watches.js";
import { htmlOf, keyOf, mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const BODY = "lar:///t/frame/body";
const COUNTER = "lar:///t/frame/counter";
const ROOT = [
  `<$button class="bump" set="${COUNTER}" setTo="pressed">bump {{${COUNTER}}}</$button>`,
  `<$edit-text tiddler="${BODY}" field="text" tag="textarea" class="body"/>`,
].join("");
const SHEET = "lar:///t/frame/sheet";

describe.skipIf(wikiSkip)(`the keyed lar:frame${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });
  const cap = hasProjection();

  test("RED: the island posts lar:frame through ctx.post and never the scalar event envelope — CONTROL: the reader refuses the old envelope", async () => {
    s = await mountSurface(ROOT, [{ title: BODY, text: "first" }, { title: COUNTER, text: "0" }]);
    expect(s.frames.length).toBe(1);
    expect(s.others.filter((m) => (m as { type?: string }).type === "event"), "no scalar event carries a frame").toEqual([]);
    const f = s.last();
    expect(f.type).toBe(LAR_FRAME);
    expect(f.cameraId).toBe(LAR_CAMERA_STORY);
    expect(f.wikiUri).toBe("lar:///test/projection-surface");
    expect(f.keys.map((k) => k.key)).toEqual([LAR_KEY_SURFACE, LAR_KEY_STYLE, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, LAR_KEY_MEMBERSHIP]);
    expect(htmlOf(f)).toContain("bump 0");
    expect(keyOf(f, LAR_KEY_STYLE)?.css?.length, "the first frame carries the whole stylesheet").toBeGreaterThan(1000);
    expect(keyOf(f, LAR_KEY_MEMBERSHIP)?.members).toEqual([LAR_KEY_SURFACE, LAR_KEY_STYLE, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER]);
    expect(f.sensedRevision).toEqual({});
    // CONTROL: the envelope the island used to post reads as no frame at all.
    expect(readLarFrame({ type: "event", wikiUri: "lar:///x", listenable: "projection:frame", payload: { html: "", css: "", rev: 1 } })).toBeNull();
  }, 120_000);

  test("RED: lar:style rides only when the stylesheet's text moved — CONTROL: lar:surface rides every frame under a rising revision", async () => {
    s = await mountSurface(ROOT, [{ title: BODY, text: "first" }, { title: COUNTER, text: "0" }]);
    const first = s.last();
    s.wiki.addTiddler({ title: COUNTER, text: "1" });
    await s.flush();
    const plain = s.last();
    expect(plain).not.toBe(first);
    expect(htmlOf(plain)).toContain("bump 1");
    expect(keyOf(plain, LAR_KEY_STYLE), "an edit that leaves the CSS standing carries no style key").toBeUndefined();
    expect(keyOf(plain, LAR_KEY_SURFACE)!.rev).toBeGreaterThan(keyOf(first, LAR_KEY_SURFACE)!.rev);
    expect(keyOf(plain, LAR_KEY_MEMBERSHIP)?.members, "membership still names the style key it omitted").toEqual([LAR_KEY_SURFACE, LAR_KEY_STYLE, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER]);

    s.wiki.addTiddler({ title: SHEET, tags: "$:/tags/Stylesheet", text: ".lar-frame-probe { color: rebeccapurple; }" });
    await s.flush();
    const styled = s.last();
    const style = keyOf(styled, LAR_KEY_STYLE);
    expect(style?.css, "the moved stylesheet rides whole").toContain(".lar-frame-probe { color: rebeccapurple; }");
    expect(style!.css!.length).toBeGreaterThan(keyOf(first, LAR_KEY_STYLE)!.css!.length);
    expect(style!.rev).toBeGreaterThan(keyOf(first, LAR_KEY_STYLE)!.rev);
    expect(keyOf(styled, LAR_KEY_SURFACE)!.rev).toBeGreaterThan(keyOf(plain, LAR_KEY_SURFACE)!.rev);
  }, 120_000);

  test("RED: lar:resend re-mints the epoch and re-emits every key whole — CONTROL: frames within one mount share one epoch", async () => {
    s = await mountSurface(ROOT, [{ title: BODY, text: "first" }, { title: COUNTER, text: "0" }]);
    const first = s.last();
    s.wiki.addTiddler({ title: COUNTER, text: "1" });
    await s.flush();
    expect(s.last().mountEpoch, "one mount, one epoch").toBe(first.mountEpoch);

    expect(cap.onSignal!(LAR_RESEND, mkLarResend(), s.ctx)).toBe(true);
    await s.flush();
    const resent = s.last();
    expect(resent.mountEpoch).toBeGreaterThan(first.mountEpoch);
    expect(resent.keys.map((k) => k.key), "every key whole, the unchanged stylesheet among them").toEqual([LAR_KEY_SURFACE, LAR_KEY_STYLE, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, LAR_KEY_MEMBERSHIP]);
    expect(keyOf(resent, LAR_KEY_STYLE)!.css).toBe(keyOf(first, LAR_KEY_STYLE)!.css);
    expect(htmlOf(resent)).toContain("bump 1");
    // A resend for another camera asks nothing of this one.
    const before = s.frames.length;
    expect(cap.onSignal!(LAR_RESEND, mkLarResend("lar:other-camera"), s.ctx)).toBe(true);
    await s.flush();
    expect(s.frames.length).toBe(before);
  }, 120_000);

  test("RED: a frame names the sense it took in before it rendered — CONTROL: the frame before the sense names none", async () => {
    s = await mountSurface(ROOT, [{ title: BODY, text: "first" }, { title: COUNTER, text: "0" }]);
    const before = s.last();
    const sense = s.event("body", { kind: "lar:sense", action: "lar:sense", wholeValue: "first typed", localRev: 3 });
    expect(cap.onSignal!(LAR_CONTROL_EVENT, sense, s.ctx)).toBe(true);
    await s.flush();
    const after = s.last();
    expect(after).not.toBe(before);
    expect(before.sensedRevision[sense.renderId!]).toBeUndefined();
    expect(after.sensedRevision).toEqual({ [sense.renderId!]: 3 });
  }, 120_000);

  test("RED: frames never answer events — a stale act answers on lar:control-result and no frame paints it; CONTROL: the result names the act", async () => {
    s = await mountSurface(ROOT, [{ title: BODY, text: "first" }, { title: COUNTER, text: "0" }]);
    const stale = s.event("bump", { kind: "lar:act", action: "lar:click", renderId: "no-such-render-id" });
    expect(cap.onSignal!(LAR_CONTROL_EVENT, stale, s.ctx)).toBe(true);
    s.wiki.addTiddler({ title: COUNTER, text: "2" });
    await s.flush();
    expect(s.results.map((r) => [r.eventId, r.status])).toEqual([[stale.eventId, "stale-target"]]);
    expect(htmlOf(s.last())).not.toContain("data-lar-interaction-result");
    expect(htmlOf(s.last())).toContain("bump 2");
  }, 120_000);
});
