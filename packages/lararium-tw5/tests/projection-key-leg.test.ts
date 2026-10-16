/**
 * projection-key-leg — a projected key bubbles up the fake tree to TW5's wrapper-bound keyboard widget, carrying
 * the real key chord; a click stays on its own node.
 */
import { afterEach, describe, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const T = (n: string): string => `lar:///t/key-leg/${n}`;
const NO_MODS = { ctrl: false, meta: false, alt: false, shift: false };
const ENTER = { key: "Enter", code: "Enter", keyCode: 13, repeat: false };
const writes = (name: string): string => `<$action-setfield $tiddler="${T(name)}" text=<<event-key>>/>`;

describe.skipIf(wikiSkip)(`the projected key leg${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("RED: a key reaches the parent keyboard wrapper with its real key — CONTROL: a click on the same field stays target-only", async () => {
    s = await mountSurface([
      `<$button class="wrapper" set="${T("clicked")}" setTo="yes">`,
      `<$keyboard key="enter" actions="""${writes("seen")}"""><$edit-text tiddler="${T("field")}" tag="input" class="field"/></$keyboard>`,
      `</$button>`,
    ].join(""));
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: ENTER, modifiers: NO_MODS }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("seen"))?.fields["text"], "the wrapper read the real key, never a blank").toBe("Enter");
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "refused", reason: "unclaimed" });
    await s.flush();
    expect(s.wiki.getTiddler(T("clicked")), "the click never climbed to the wrapping button").toBeUndefined();
  }, 120_000);

  test("RED: a wrapper that handles the key halts the climb — CONTROL: an inner wrapper that lets it pass, the outer fires", async () => {
    const nested = (innerKey: string): string => [
      `<$keyboard key="enter" actions="""${writes("outer")}""">`,
      `<$keyboard key="${innerKey}" actions="""${writes("inner")}""">`,
      `<$edit-text tiddler="${T("field")}" tag="input" class="field"/>`,
      `</$keyboard></$keyboard>`,
    ].join("");
    s = await mountSurface(nested("enter"));
    dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: ENTER, modifiers: NO_MODS }));
    await s.flush();
    expect(s.wiki.getTiddler(T("inner"))?.fields["text"]).toBe("Enter");
    expect(s.wiki.getTiddler(T("outer")), "the inner wrapper stopped the climb").toBeUndefined();
    s.stop();
    s = await mountSurface(nested("escape"));
    dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: ENTER, modifiers: NO_MODS }));
    await s.flush();
    expect(s.wiki.getTiddler(T("inner"))).toBeUndefined();
    expect(s.wiki.getTiddler(T("outer"))?.fields["text"]).toBe("Enter");
  }, 120_000);
});
