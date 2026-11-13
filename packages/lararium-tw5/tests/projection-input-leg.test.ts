/**
 * projection-input-leg.test — a relayed value reaches TW5 where TW5 reads a local one.
 *
 * A projected wiki paints in a shadow root on the main thread while its widgets live in the worker, so an
 * edit only works when the value lands ON THE NODE the widget holds, before that widget's own handler
 * runs — TW5's edit widgets read `domNodes[0].value` inside the handler and never read the event. These
 * vectors mount a real TW5 widget tree over the fake document and drive the leg through
 * `dispatchLarControlEvent` and the projection cap's door; the caret verbs and the geometry refusal read off
 * the patched fake element itself.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import {
  LAR_CONTROL_EVENT, LAR_RESEND, LAR_WHOLE_VALUE_MAX_CHARS, mkLarResend,
} from "@lararium/mesh";
import { patchFakeElementForEvents, dispatchLarControlEvent } from "../src/tw5-projection.js";
import { hasProjection } from "../src/has-island-watches.js";
import { mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

/** The two members the patch reads off a fakedom element: an attribute bag and a setter. */
class FakeEl {
  attributes: Record<string, string | undefined> = {};
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}
const fakeDoc = { createElement: (_t: string): FakeEl => new FakeEl() };
patchFakeElementForEvents(fakeDoc as unknown as Parameters<typeof patchFakeElementForEvents>[0]);

const T = (n: string): string => `lar:///t/input-leg/${n}`;
const text = (s: Surface, title: string): unknown => s.wiki.getTiddler(title)?.fields["text"];
const FIELD = `<$edit-text tiddler="${T("field")}" tag="textarea" class="field"/>`;
const CHOICE = `<$select tiddler="${T("choice")}" class="choice"><option>a</option><option>b</option></$select>`;

describe.skipIf(wikiSkip)(`the projected input leg${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("the value lands on the NODE before the handler runs — TW5 reads it where it always reads it", async () => {
    s = await mountSurface(FIELD, [{ title: T("field"), text: "" }]);
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:sense", action: "lar:sense", wholeValue: "a tiddler being typed", localRev: 1 }))).toBeNull();
    await s.flush();
    expect(text(s, T("field")), "the input handler read the value off the node it holds").toBe("a tiddler being typed");
  }, 120_000);

  test("only the handlers bound to THAT leg fire: a sense runs input, a commit runs change", async () => {
    s = await mountSurface(CHOICE, [{ title: T("choice"), text: "a" }]);
    expect(dispatchLarControlEvent(s.event("choice", { kind: "lar:sense", action: "lar:sense", wholeValue: "b", localRev: 1 }))).toBeNull();
    await s.flush();
    expect(text(s, T("choice")), "the select binds no input listener, so the sense ran nothing").toBe("a");
    expect(dispatchLarControlEvent(s.event("choice", { kind: "lar:act", action: "lar:commit", wholeValue: "b" }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("choice"))).toBe("b");
  }, 120_000);

  test("an unknown render-id answers stale-target and names itself on the console", async () => {
    s = await mountSurface(FIELD, [{ title: T("field"), text: "" }]);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:commit", wholeValue: "x", renderId: "no-such-rid" }))).toMatchObject({ status: "stale-target" });
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:click", renderId: "no-such-rid" }))).toMatchObject({ status: "stale-target" });
    expect(warning).toHaveBeenCalledWith("[wiki-worker] stale-target: no-such-rid");
    warning.mockRestore();
  }, 120_000);

  test("the CLICK leg carries the act's modifiers onto the event, untouched", async () => {
    s = await mountSurface(`<$button class="mod" actions="""<$action-setfield $tiddler="${T("mod")}" text=<<modifier>>/>""">mod</$button>`);
    dispatchLarControlEvent(s.event("mod", { kind: "lar:act", action: "lar:click", modifiers: { ctrl: false, meta: true, alt: false, shift: false, button: 0 } }));
    await s.flush();
    expect(text(s, T("mod"))).toBe("meta");
  }, 120_000);

  test("popup triggers read the click-time geometry carried onto the fake node", async () => {
    s = await mountSurface(`<$button class="opener" popup="${T("popup")}">open</$button>`);
    dispatchLarControlEvent(s.event("opener", { kind: "lar:act", action: "lar:click", geometry: { top: 34, left: 12, right: 112, bottom: 54, width: 100, height: 20 } }));
    await s.flush();
    expect(String(text(s, T("popup")))).toContain("12,34,100,20");
  }, 120_000);
});

describe("the patched fake element", () => {
  test("the caret verbs an edit widget calls answer harmlessly instead of throwing mid-handler, and the caret lands where set", () => {
    const el = fakeDoc.createElement("textarea") as unknown as Record<string, (...a: number[]) => void> & { selectionStart?: number; selectionEnd?: number };
    for (const verb of ["focus", "blur", "select"]) expect(() => el[verb]!()).not.toThrow();
    el["setSelectionRange"]!(4, 4);
    expect(el).toMatchObject({ selectionStart: 4, selectionEnd: 4 });
  });

  test("an uncarried synchronous geometry read refuses by capability name", () => {
    const el = fakeDoc.createElement("button") as unknown as { getBoundingClientRect(): unknown };
    expect(() => el.getBoundingClientRect()).toThrow(/CapabilityRefused: DOM geometry requires an event-time rectangle/);
  });
});

describe.skipIf(wikiSkip)(`the projection cap's door${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });
  const cap = hasProjection();

  test("RED: the cap CLAIMS lar:control-event and lar:resend — CONTROL: a foreign kind stays unclaimed", async () => {
    s = await mountSurface(FIELD, [{ title: T("field"), text: "" }]);
    expect(cap.onSignal!(LAR_CONTROL_EVENT, s.event("field", { kind: "lar:sense", action: "lar:sense", wholeValue: "hi", localRev: 1 }), s.ctx)).toBe(true);
    expect(cap.onSignal!(LAR_RESEND, mkLarResend(), s.ctx)).toBe(true);
    expect(cap.onSignal!("daemon:place-verb", {}, s.ctx)).toBe(false);
    await s.flush();
    expect(text(s, T("field")), "the lar:control-event landed").toBe("hi");
  }, 120_000);

  test("RED: a malformed or over-bound control event reaching the cap DROPS — claimed, never dispatched; CONTROL: the well-formed twin lands", async () => {
    s = await mountSurface(FIELD, [{ title: T("field"), text: "kept" }]);
    const good = s.event("field", { kind: "lar:act", action: "lar:commit", wholeValue: "landed" });
    // Hand-built, bypassing mkLarControlEvent's throw: these stand in for a sender that never called it.
    const twoTargets = { ...good, eventId: "two", controlId: "also-this" };
    const overBound = { ...good, eventId: "long", wholeValue: "x".repeat(LAR_WHOLE_VALUE_MAX_CHARS + 1) };
    const noEpoch = { ...good, eventId: "no-epoch", mountEpoch: undefined };
    for (const forged of [twoTargets, overBound, noEpoch]) expect(cap.onSignal!(LAR_CONTROL_EVENT, forged, s.ctx)).toBe(true);
    await s.flush();
    expect(text(s, T("field"))).toBe("kept");
    expect(s.results, "a refused read answers nothing: it never reached the dispatcher").toEqual([]);
    expect(cap.onSignal!(LAR_CONTROL_EVENT, good, s.ctx)).toBe(true);
    await s.flush();
    expect(text(s, T("field"))).toBe("landed");
    expect(s.results.map((r) => r.status)).toEqual(["applied"]);
  }, 120_000);
});

describe.skipIf(wikiSkip)(`projected handler refusals${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("a throwing listener is warned and the act still answers — control: a healthy listener warns nothing", async () => {
    s = await mountSurface(`<$navigator story="$:/StoryList" history="$:/HistoryList"><$link class="go" to="${T("target")}">go</$link></$navigator><$button class="plain" set="${T("plain")}" setTo="yes">plain</$button>`);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A link click with no carried geometry: TW5's layout read throws inside the handler.
    expect(dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0]?.[0]).toContain("[wiki-worker] handler refused:");
    expect(warning.mock.calls[0]?.[0]).toContain("CapabilityRefused");
    warning.mockClear();
    expect(dispatchLarControlEvent(s.event("plain", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  }, 120_000);
});

describe("never-persisted core temporary titles", () => {
  test("core question and alert titles are transient — control: unrelated temporary title persists", async () => {
    const { neverPersists } = await import("../src/island-adaptor.js");
    expect(neverPersists("$:/temp/confirm/1")).toBe(true);
    expect(neverPersists("$:/temp/alerts/alert")).toBe(true);
    expect(neverPersists("$:/temp/other")).toBe(false);
  });
});
