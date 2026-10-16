/**
 * projection-offers — files, drops, order, keys and navigate on the island's side of the camera contract
 * (dreamdom#/what-a-sink-keeps: the import, keyboard and navigation classes).
 *
 * Every vector stands a real booted wiki under a mounted story camera and reads what TW5's own roads did:
 *
 *   - a picked file's bytes, or the tiddlers the page parsed from `text/vnd.tiddler` JSON, land on the `$browse`
 *     input through TW5's own reader and `tm-import-tiddlers`, so `$:/Import` parks; `lar:perform-import` lands it;
 *   - a drop hands its payload to the node's own `drop` listeners: a dropzone imports, a droppable runs its actions
 *     with the whole title list and the modifier;
 *   - a `lar-order-list` writes its whole ordered list; an id it lacks never deletes a member;
 *   - `lar:shortcuts` carries the chords `$:/tags/KeyboardShortcut` declares; the document leg runs the manager;
 *     a declared crossing set (`data-lar-keys`) refuses a chord it never named;
 *   - `$eventcatcher` refuses by name;
 *   - `lar:story-order` carries the story and the history tail; `lar:route` navigates, and an unknown title refuses.
 */
import { afterEach, describe, expect, test } from "vitest";
import { LAR_CONTROL_DOCUMENT, LAR_KEY_MEMBERSHIP, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, type LarMsg_ControlEvent } from "@lararium/mesh";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { htmlOf, keyOf, mountSurface, ridOfClass, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const T = (n: string): string => `lar:///t/offers/${n}`;
const NO_MODS = { ctrl: false, meta: false, alt: false, shift: false };
const NAV = (inner: string): string => `<$navigator story="$:/StoryList" history="$:/HistoryList">${inner}</$navigator>`;
const IMPORT_VIEW = "{{$:/Import||$:/core/ui/ViewTemplate/body/import}}";
const importOf = (s: Surface): Record<string, unknown> | undefined => s.wiki.getTiddler("$:/Import")?.fields;
const pendingTitles = (s: Surface): string[] => Object.keys((JSON.parse(String(importOf(s)?.["text"] ?? "{}")) as { tiddlers?: object }).tiddlers ?? {});
const alerts = (s: Surface): string[] => ["$:/temp/lares/alert/handler-refused"].map((t) => s.wiki.getTiddler(t)?.fields["text"]).filter((t): t is string => typeof t === "string");
/** An act on the document leg or a declared control: it names its control id, never a render id. */
const named = (s: Surface, controlId: string, e: Partial<LarMsg_ControlEvent> & Pick<LarMsg_ControlEvent, "action">): LarMsg_ControlEvent =>
  s.event("", { kind: "lar:act", controlId, ...e });
/** The input a `$browse` renders inside the span classed `cls`. */
const browseRid = (s: Surface, cls: string): string => {
  const html = htmlOf(s.last());
  const at = html.indexOf(`class="${cls}"`);
  const rid = /<input[^>]*data-lar-rid="([^"]+)"[^>]*>/.exec(html.slice(at));
  if (at < 0 || !rid) throw new Error(`no file input under .${cls}`);
  return rid[1]!;
};

describe.skipIf(wikiSkip)(`files, drops, order, keys and navigate on the island${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("RED: a picked file's bytes park in $:/Import through TW5's own reader, and perform-import lands them — CONTROL: an offer under another epoch parks nothing", async () => {
    s = await mountSurface(NAV(`<span class="pick"><$browse/></span>${IMPORT_VIEW}`));
    const bytes = new TextEncoder().encode(`title: ${T("from-bytes")}\ntags: imported\n\nbody from bytes`);
    const stale = s.event("", { kind: "lar:act", renderId: browseRid(s, "pick"), action: "lar:import-offer", wholeValue: bytes, file: { name: "b.tid", type: "application/x-tiddler" } });
    expect(dispatchLarControlEvent({ ...stale, mountEpoch: stale.mountEpoch - 1, eventId: "stale-offer" })).toMatchObject({ status: "stale-target" });
    await s.flush();
    expect(importOf(s), "CONTROL: a stale offer parks nothing").toBeUndefined();

    expect(dispatchLarControlEvent(stale)).toMatchObject({ status: "applied" });
    await s.flush();
    expect(importOf(s)).toMatchObject({ "plugin-type": "import", status: "pending" });
    expect(pendingTitles(s)).toEqual([T("from-bytes")]);
    expect(htmlOf(s.last()), "the parked import paints its listing").toContain(T("from-bytes"));
    expect(s.wiki.getTiddler(T("from-bytes")), "nothing lands before perform-import").toBeUndefined();

    expect(dispatchLarControlEvent(named(s, "$:/Import", { action: "lar:perform-import" }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("from-bytes"))?.fields).toMatchObject({ text: "body from bytes", tags: ["imported"] });
    expect(importOf(s)).toMatchObject({ status: "complete" });
    expect(dispatchLarControlEvent(named(s, "$:/Import", { action: "lar:perform-import" })), "CONTROL: a landed import performs no second time").toMatchObject({ status: "refused", reason: "binding-unavailable" });
    expect(alerts(s)).toEqual([]);
  }, 120_000);

  test("RED: tiddlers the page parsed from text/vnd.tiddler JSON park as they read — CONTROL: JSON naming no tiddler refuses unsupported-control", async () => {
    s = await mountSurface(NAV(`<span class="pick"><$browse/></span>`));
    const rid = browseRid(s, "pick");
    expect(dispatchLarControlEvent(s.event("", { kind: "lar:act", renderId: rid, action: "lar:import-offer", controlType: "lar-file-picker", wholeValue: "[{\"text\":\"untitled\"}]" }))).toMatchObject({ status: "refused", reason: "unsupported-control" });
    await s.flush();
    expect(importOf(s)).toBeUndefined();
    expect(dispatchLarControlEvent(s.event("", { kind: "lar:act", renderId: rid, action: "lar:import-offer", controlType: "lar-file-picker", wholeValue: JSON.stringify([{ title: T("json-one"), text: "one" }, { title: T("json-two"), text: "two" }]) }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(pendingTitles(s)).toEqual([T("json-one"), T("json-two")]);
  }, 120_000);

  test("RED: a drop on a dropzone imports JSON, and a drop on a droppable runs its actions with the whole list and the modifier — CONTROL: a node that binds no drop answers unclaimed", async () => {
    const log = `<$action-setfield $tiddler="${T("log")}" text={{{ [<actionTiddler>] [<modifier>] +[join[|]] }}}/>`;
    s = await mountSurface(NAV([
      `<$dropzone class="zone">zone</$dropzone>`,
      `<$droppable class="dz" actions="""${log}""">dz</$droppable>`,
      `<$button class="plain" set="${T("pressed")}" setTo="yes">plain</$button>`,
    ].join("")));
    expect(dispatchLarControlEvent(s.event("zone", { kind: "lar:act", action: "lar:drop", wholeValue: JSON.stringify([{ title: T("dropped-json"), text: "j" }]) }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(pendingTitles(s)).toEqual([T("dropped-json")]);

    s.wiki.addTiddler({ title: T("dragged"), text: "dragged body" });
    await s.flush();
    expect(dispatchLarControlEvent(s.event("dz", { kind: "lar:act", action: "lar:drop", wholeValue: [T("dragged"), T("absent")], modifiers: { ...NO_MODS, shift: true } }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(alerts(s)).toEqual([]);
    expect(s.wiki.getTiddler(T("log"))?.fields["text"], "the droppable ran once per dropped title, the last one standing").toBe(`${T("absent")}|shift`);

    expect(dispatchLarControlEvent(s.event("plain", { kind: "lar:act", action: "lar:drop", wholeValue: ["x"] }))).toMatchObject({ status: "refused", reason: "unclaimed" });
    await s.flush();
    expect(s.wiki.getTiddler(T("pressed")), "CONTROL: the button never ran").toBeUndefined();
  }, 120_000);

  test("RED: a lar-order-list writes its whole order; an id it lacks never deletes a member, an id outside never adds one — CONTROL: a value that is no list refuses", async () => {
    s = await mountSurface(`<lar-order-list data-control-id="order" data-tiddler="${T("order")}" data-field="list"><ol><$list filter="[list[${T("order")}]]"><li data-item-id=<<currentTiddler>>><$text text=<<currentTiddler>>/></li></$list></ol></lar-order-list>`,
      [{ title: T("order"), list: ["a", "b", "c"] }]);
    const order = (wholeValue: unknown) => dispatchLarControlEvent(named(s!, "order", { action: "lar:order", controlType: "lar-order-list", wholeValue: wholeValue as string[] }));
    expect(order(["c", "a", "b"])).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("order"))?.fields["list"]).toEqual(["c", "a", "b"]);
    expect(htmlOf(s.last())).toMatch(/data-item-id="c"[\s\S]*data-item-id="a"[\s\S]*data-item-id="b"/);
    expect(order(["b", "zz"])).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("order"))?.fields["list"], "b leads; c and a keep their order; zz never joins").toEqual(["b", "c", "a"]);
    expect(order("c a b")).toMatchObject({ status: "refused", reason: "unsupported-control" });
    expect(dispatchLarControlEvent(named(s, "elsewhere", { action: "lar:order", wholeValue: ["a"] })), "CONTROL: a control the frame never painted").toMatchObject({ status: "stale-target" });
  }, 120_000);

  test("RED: lar:shortcuts carries the chords $:/tags/KeyboardShortcut declares, and the document leg runs them — CONTROL: a chord no shortcut names answers unclaimed and writes nothing", async () => {
    s = await mountSurface(`<p>keys</p>`, [
      { title: "$:/config/shortcuts/lar-offers", text: "alt-shift-G ctrl-enter" },
      { title: T("global"), tags: ["$:/tags/KeyboardShortcut"], key: "((lar-offers))", text: `<$action-setfield $tiddler="${T("hit")}" text="global"/>` },
    ]);
    const first = s.last();
    expect(keyOf(first, LAR_KEY_MEMBERSHIP)?.members).toContain(LAR_KEY_SHORTCUTS);
    const chords = keyOf(first, LAR_KEY_SHORTCUTS)?.chords ?? [];
    expect(chords.map((c) => c.descriptor)).toEqual(expect.arrayContaining(["alt-shift-G", "ctrl-enter"]));
    expect(chords.find((c) => c.descriptor === "alt-shift-G")).toEqual({ descriptor: "alt-shift-G", keyCode: 71, ctrl: false, shift: true, alt: true, meta: false });

    const G = { key: "G", code: "KeyG", keyCode: 71, repeat: false };
    expect(dispatchLarControlEvent(named(s, LAR_CONTROL_DOCUMENT, { action: "lar:key", key: G, modifiers: { ...NO_MODS, alt: true } }))).toMatchObject({ status: "refused", reason: "unclaimed" });
    await s.flush();
    expect(s.wiki.getTiddler(T("hit")), "CONTROL: alt-G names no shortcut").toBeUndefined();
    expect(dispatchLarControlEvent(named(s, LAR_CONTROL_DOCUMENT, { action: "lar:key", key: G, modifiers: { ...NO_MODS, alt: true, shift: true } }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("hit"))?.fields["text"]).toBe("global");

    const before = keyOf(first, LAR_KEY_SHORTCUTS)!.rev;
    expect(s.frames.slice(1).some((f) => keyOf(f, LAR_KEY_SHORTCUTS)), "an unmoved chord set rides no later frame").toBe(false);
    s.wiki.addTiddler({ title: "$:/config/shortcuts/lar-offers", text: "alt-shift-H" });
    await s.flush();
    const moved = keyOf(s.last(), LAR_KEY_SHORTCUTS);
    expect(moved?.rev).toBeGreaterThan(before);
    expect(moved?.chords?.map((c) => c.descriptor)).toContain("alt-shift-H");
    expect(moved?.chords?.map((c) => c.descriptor)).not.toContain("alt-shift-G");
  }, 120_000);

  test("RED: a chord no crossing set on its path declares refuses unclaimed and runs nothing — CONTROL: the declared chord applies, and an outer binding that declares the chord takes it", async () => {
    const field = (outer: string) => `${outer ? `<$keyboard key="${outer}" actions="""<$action-setfield $tiddler="${T("outer")}" text=<<event-key>>/>""">` : ""}<$keyboard key="enter" actions="""<$action-setfield $tiddler="${T("kb")}" text=<<event-key>>/>"""><$edit-text class="field" tiddler="${T("typed")}" tag="input"/></$keyboard>${outer ? "</$keyboard>" : ""}`;
    s = await mountSurface(field(""));
    expect(htmlOf(s.last()), "the island stamps the crossing set").toContain('data-lar-keys="enter"');
    const A = { key: "a", code: "KeyA", keyCode: 65, repeat: false };
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: A, modifiers: NO_MODS }))).toMatchObject({ status: "refused", reason: "unclaimed" });
    await s.flush();
    expect(s.wiki.getTiddler(T("kb")), "the undeclared chord ran no binding").toBeUndefined();
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: { key: "Enter", code: "Enter", keyCode: 13, repeat: false }, modifiers: NO_MODS }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("kb"))?.fields["text"]).toBe("Enter");
    s.stop();
    s = await mountSurface(field("a"));
    expect(dispatchLarControlEvent(s.event("field", { kind: "lar:act", action: "lar:key", key: A, modifiers: NO_MODS })), "CONTROL: the outer binding declares a").toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("outer"))?.fields["text"]).toBe("a");
  }, 120_000);

  test("RED: an act that reaches a $eventcatcher refuses unsupported-control and runs nothing — CONTROL: a button beside it applies", async () => {
    s = await mountSurface([
      `<$eventcatcher $click="""<$action-setfield $tiddler="${T("caught")}" text="yes"/>""" selector=".inside" class="catcher"><span class="inside">inside</span></$eventcatcher>`,
      `<$button class="beside" set="${T("beside")}" setTo="yes">beside</$button>`,
    ].join(""));
    expect(dispatchLarControlEvent(s.event("catcher", { kind: "lar:act", action: "lar:click", modifiers: NO_MODS }))).toMatchObject({ status: "refused", reason: "unsupported-control" });
    await s.flush();
    expect(s.wiki.getTiddler(T("caught"))).toBeUndefined();
    expect(dispatchLarControlEvent(s.event("beside", { kind: "lar:act", action: "lar:click", modifiers: NO_MODS }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("beside"))?.fields["text"]).toBe("yes");
  }, 120_000);

  test("RED: lar:story-order carries the story and the history tail; a navigation deepens it and lar:route navigates — CONTROL: an unknown title refuses route-unresolved, and an unmoved story rides no later frame", async () => {
    s = await mountSurface(NAV(`<$link class="go" to="${T("B")}">go</$link><$list filter="[list[$:/StoryList]]"><div class="tc-tiddler-frame" data-tiddler-title=<<currentTiddler>>><$text text=<<currentTiddler>>/></div></$list>`),
      [{ title: T("A"), text: "a" }, { title: T("B"), text: "b" }, { title: "$:/StoryList", list: [T("A")] }]);
    const first = keyOf(s.last(), LAR_KEY_STORY_ORDER);
    expect(first?.story?.order).toEqual([T("A")]);
    const depth = first!.story!.depth;
    s.wiki.addTiddler({ title: T("unrelated"), text: "x" });
    await s.flush();
    expect(keyOf(s.last(), LAR_KEY_STORY_ORDER), "CONTROL: the story did not move").toBeUndefined();

    expect(dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click", modifiers: { ...NO_MODS, button: 0 }, geometry: { top: 0, left: 0, right: 20, bottom: 10, width: 20, height: 10 } }))).toMatchObject({ status: "applied" });
    await s.flush();
    const navigated = keyOf(s.last(), LAR_KEY_STORY_ORDER);
    expect(navigated?.story).toMatchObject({ tail: T("B"), depth: depth + 1 });
    expect(navigated?.story?.order).toEqual(expect.arrayContaining([T("A"), T("B")]));
    expect(navigated!.rev).toBeGreaterThan(first!.rev);

    expect(dispatchLarControlEvent(named(s, LAR_CONTROL_DOCUMENT, { action: "lar:route", wholeValue: T("A") }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(keyOf(s.last(), LAR_KEY_STORY_ORDER)?.story).toMatchObject({ tail: T("A"), depth: depth + 2 });
    expect(dispatchLarControlEvent(named(s, LAR_CONTROL_DOCUMENT, { action: "lar:route", wholeValue: T("nowhere") }))).toMatchObject({ status: "refused", reason: "route-unresolved" });
    expect(ridOfClass(htmlOf(s.last()), "go")).toBeTruthy();
  }, 120_000);
});
