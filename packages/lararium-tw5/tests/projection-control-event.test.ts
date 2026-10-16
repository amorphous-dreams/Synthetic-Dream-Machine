/**
 * projection-control-event — `dispatchLarControlEvent` carries a person's act into TW5's own handler and answers
 * it (dreamdom#/the-crossings, page-controls#/the-wire).
 *
 *   - An act under another mount epoch, on an unknown render id or on a detached node answers `stale-target` and
 *     runs nothing.
 *   - An act on a node that binds no listener of its type answers `refused: unclaimed`, so the page leaves the
 *     browser's default alone.
 *   - `lar:click` runs the popup closer leg, then the node's listeners, with the act's geometry and modifiers.
 *   - `lar:key` bubbles up the fake tree carrying the real key chord.
 *   - `lar:commit` writes the whole value onto the node and runs its `change` listeners (an edit engine that
 *     saves on `input` alone runs that leg instead).
 *   - `lar:sense` writes the whole value, records its `localRev`, runs the `input` listeners, and answers nothing.
 *   - An answer ring re-answers a repeated `eventId` within the epoch without re-applying it.
 *   - Every answered act posts its `lar:control-result` through `ctx.post`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkLarResend, type LarMsg_ControlEvent } from "@lararium/mesh";
import { dispatchLarControlEvent, resendLarCamera } from "../src/tw5-projection.js";
import { mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const T = (n: string): string => `lar:///t/control/${n}`;
const text = (s: Surface, title: string): unknown => s.wiki.getTiddler(title)?.fields["text"];
const NO_MODS = { ctrl: false, meta: false, alt: false, shift: false };

describe.skipIf(wikiSkip)(`the control-event dispatcher${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  const counter = `<$button class="count" actions="""<$action-setfield $tiddler="${T("count")}" text={{{ [{${T("count")}}add[1]] }}}/>""">count</$button>`;

  test("RED: an act under another mount epoch answers stale-target and runs nothing — CONTROL: the same act under the live epoch applies", async () => {
    s = await mountSurface(counter, [{ title: T("count"), text: "0" }]);
    const stale = s.event("count", { kind: "lar:act", action: "lar:click", mountEpoch: s.last().mountEpoch + 1000 });
    expect(dispatchLarControlEvent(stale)).toMatchObject({ eventId: stale.eventId, status: "stale-target" });
    await s.flush();
    expect(text(s, T("count")), "the stale act ran no handler").toBe("0");
    const live = s.event("count", { kind: "lar:act", action: "lar:click" });
    expect(dispatchLarControlEvent(live)).toMatchObject({ eventId: live.eventId, status: "applied", renderId: live.renderId });
    await s.flush();
    expect(text(s, T("count"))).toBe("1");
    expect(s.results.map((r) => r.status), "every answer crossed ctx.post").toEqual(["stale-target", "applied"]);
  }, 120_000);

  test("RED: an unknown render id answers stale-target through ctx.post — CONTROL: the answer names the act's camera and epoch", async () => {
    s = await mountSurface(counter, [{ title: T("count"), text: "0" }]);
    const ghost = s.event("count", { kind: "lar:act", action: "lar:click", renderId: "no-such-render-id" });
    const answer = dispatchLarControlEvent(ghost);
    expect(answer).toMatchObject({ type: "lar:control-result", eventId: ghost.eventId, status: "stale-target", cameraId: ghost.cameraId, mountEpoch: ghost.mountEpoch });
    expect(s.results).toEqual([answer]);
  }, 120_000);

  test("RED: a click on a node binding no click listener answers refused: unclaimed and runs nothing — CONTROL: a button claims its click", async () => {
    s = await mountSurface(`${counter}<$edit-text tiddler="${T("field")}" tag="input" class="field"/>`, [{ title: T("count"), text: "0" }, { title: T("field"), text: "kept" }]);
    const onField = s.event("field", { kind: "lar:act", action: "lar:click" });
    expect(dispatchLarControlEvent(onField)).toMatchObject({ status: "refused", reason: "unclaimed" });
    const onButton = s.event("count", { kind: "lar:act", action: "lar:click" });
    expect(dispatchLarControlEvent(onButton)).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("count"))).toBe("1");
    expect(text(s, T("field"))).toBe("kept");
  }, 120_000);

  test("RED: a click runs the popup closer, then the node's listeners with the act's geometry and modifiers — CONTROL: the popup stands open until another click closes it", async () => {
    s = await mountSurface([
      `<$button class="opener" popup="${T("popup")}">open</$button>`,
      `<$button class="mod" actions="""<$action-setfield $tiddler="${T("mod")}" text=<<modifier>>/>""">mod</$button>`,
    ].join(""));
    const geometry = { top: 34, left: 12, right: 112, bottom: 54, width: 100, height: 20 };
    expect(dispatchLarControlEvent(s.event("opener", { kind: "lar:act", action: "lar:click", geometry, modifiers: { ...NO_MODS, button: 0 } }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(String(text(s, T("popup"))), "the popup opened at the act's own rectangle").toContain("12,34,100,20");
    await s.flush();
    expect(s.wiki.getTiddler(T("popup")), "CONTROL: the popup stands while nothing else is clicked").toBeDefined();
    expect(dispatchLarControlEvent(s.event("mod", { kind: "lar:act", action: "lar:click", modifiers: { ...NO_MODS, ctrl: true, button: 0 } }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("mod")), "the handler read the act's modifiers").toBe("ctrl");
    expect(s.wiki.getTiddler(T("popup")), "the closer leg ran before the handler and closed the open popup").toBeUndefined();
  }, 120_000);

  test("RED: geometry answers the act that carried it and no other — CONTROL: a link click carrying geometry navigates", async () => {
    s = await mountSurface(`<$navigator story="$:/StoryList" history="$:/HistoryList"><$link class="go" to="${T("target")}">go</$link></$navigator>`);
    const geometry = { top: 5, left: 6, right: 56, bottom: 25, width: 50, height: 20 };
    const go = s.rid("go");
    expect(dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click", geometry }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler("$:/StoryList")?.fields["list"]).toContain(T("target"));
    s.wiki.addTiddler({ title: "$:/StoryList", list: [] });
    await s.flush();
    expect(s.rid("go"), "the same link node stands painted").toBe(go);
    // The same node, an act that carried no geometry: the link's layout read refuses by name and navigates nowhere.
    expect(dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler("$:/StoryList")?.fields["list"]).toEqual([]);
    expect(String(s.wiki.getTiddler("$:/temp/lares/alert/handler-refused")?.fields["text"])).toMatch(/CapabilityRefused: DOM geometry/);
  }, 120_000);

  test("RED: a key bubbles to the keyboard wrapper carrying the real key and code — CONTROL: an unmatched key claims and writes nothing; a key off any keydown path answers unclaimed", async () => {
    s = await mountSurface([
      `<$keyboard key="enter" actions="""<$action-setfield $tiddler="${T("key")}" text=<<event-key>> code=<<event-code>>/>""">`,
      `<$edit-text tiddler="${T("field")}" tag="input" class="field"/>`,
      `</$keyboard>`,
      counter,
    ].join(""), [{ title: T("count"), text: "0" }]);
    const enter = { key: "Enter", code: "Enter", keyCode: 13, repeat: false };
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: enter, modifiers: NO_MODS }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("key"))?.fields).toMatchObject({ text: "Enter", code: "Enter" });
    s.wiki.addTiddler({ title: T("key"), text: "untouched" });
    await s.flush();
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: { key: "a", code: "KeyA", keyCode: 65, repeat: false }, modifiers: NO_MODS }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("key"))).toBe("untouched");
    expect(dispatchLarControlEvent(s.event("count", { kind: "lar:act", action: "lar:key", key: enter, modifiers: NO_MODS }))).toMatchObject({ status: "refused", reason: "unclaimed" });
  }, 120_000);

  test("RED: a commit writes the whole value and runs the change listeners — CONTROL: an edit field's commit lands a value no sense carried", async () => {
    s = await mountSurface([
      `<$select tiddler="${T("choice")}" class="choice"><option>a</option><option>b</option></$select>`,
      `<$edit-text tiddler="${T("field")}" tag="input" class="field"/>`,
    ].join(""), [{ title: T("choice"), text: "a" }, { title: T("field"), text: "" }]);
    expect(dispatchLarControlEvent(s.event("choice", { kind: "lar:act", action: "lar:commit", wholeValue: "b" }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("choice"))).toBe("b");
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:sense", action: "lar:sense", wholeValue: "ab", localRev: 1 }))).toBeNull();
    // The last sense dropped on the wire: the commit carries the settled whole value on its own.
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:commit", wholeValue: "abc", localRev: 2 }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("field"))).toBe("abc");
  }, 120_000);

  test("RED: a sense writes the value, records its revision, runs the input leg and answers nothing — CONTROL: an older sense arriving late drops", async () => {
    s = await mountSurface(`<$edit-text tiddler="${T("field")}" tag="input" class="field"/>`, [{ title: T("field"), text: "" }]);
    const newer = s.event("field", { kind: "lar:sense", action: "lar:sense", wholeValue: "newer", localRev: 2 });
    expect(dispatchLarControlEvent(newer)).toBeNull();
    await s.flush();
    expect(text(s, T("field"))).toBe("newer");
    expect(s.last().sensedRevision).toEqual({ [newer.renderId!]: 2 });
    const older = s.event("field", { kind: "lar:sense", action: "lar:sense", wholeValue: "older", localRev: 1 });
    expect(dispatchLarControlEvent(older)).toBeNull();
    await s.flush();
    expect(text(s, T("field")), "newest wins by the page's own revision").toBe("newer");
    expect(s.last().sensedRevision).toEqual({ [newer.renderId!]: 2 });
    expect(s.results, "a sense never answers").toEqual([]);
  }, 120_000);

  test("RED: a repeated eventId re-answers without re-applying — CONTROL: a fresh id applies, and the ring dies with the epoch", async () => {
    s = await mountSurface(counter, [{ title: T("count"), text: "0" }]);
    const once = s.event("count", { kind: "lar:act", action: "lar:click" });
    const first = dispatchLarControlEvent(once);
    await s.flush();
    const again = dispatchLarControlEvent(once);
    await s.flush();
    expect(again).toEqual(first);
    expect(text(s, T("count")), "the repeat re-answered and ran nothing").toBe("1");
    expect(s.results.map((r) => r.eventId), "each answer crossed ctx.post").toEqual([once.eventId, once.eventId]);
    dispatchLarControlEvent(s.event("count", { kind: "lar:act", action: "lar:click" }));
    await s.flush();
    expect(text(s, T("count"))).toBe("2");
    resendLarCamera(mkLarResend(), s.ctx.wikiUri);
    await s.flush();
    const reborn: LarMsg_ControlEvent = { ...once, mountEpoch: s.last().mountEpoch };
    expect(dispatchLarControlEvent(reborn)).toMatchObject({ status: "applied", mountEpoch: s.last().mountEpoch });
    await s.flush();
    expect(text(s, T("count")), "a new epoch keeps no answer from the old").toBe("3");
  }, 120_000);

  test("RED: a write or an act this camera holds no road for refuses by name — CONTROL: both answers cross ctx.post", async () => {
    s = await mountSurface(counter, [{ title: T("count"), text: "0" }]);
    expect(dispatchLarControlEvent(s.event("count", { kind: "lar:write", action: "lar:write", records: [{ title: T("count"), fields: { text: "9" } }], txId: "tx-1" }))).toMatchObject({ status: "refused", reason: "binding-unavailable" });
    expect(dispatchLarControlEvent(s.event("count", { kind: "lar:act", action: "lar:drop" }))).toMatchObject({ status: "refused", reason: "unsupported-control" });
    await s.flush();
    expect(text(s, T("count"))).toBe("0");
    expect(s.results.map((r) => r.reason)).toEqual(["binding-unavailable", "unsupported-control"]);
  }, 120_000);
});
