/**
 * declared-cancellation.engine — the island declares each binding at mount and bubbles every act up its fake tree
 * (dreamdom#/the-crossings, "Declared at mount, never decided at handling").
 *
 * Each vector walks a small script through the interaction-golden runner over a real booted engine, and each
 * carries a control: a claim the island never makes reads red, so a green carries information.
 *
 *   - STAMPS AT BINDING. The patched `addEventListener` stamps `data-lar-on`; the per-widget table stamps
 *     `data-lar-cancel`, `data-lar-keys`, `data-lar-bubble` and `data-lar-live`. A node TW5 never bound carries none.
 *   - EVERY TYPE BUBBLES. A click on a node that binds only `keydown` climbs to the `$button` around it; a link's
 *     own `stopPropagation` ends the climb before the button; a node no binding reaches answers `unclaimed`.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { runEngineGolden, type EngineRunHooks, type GoldenScript } from "./goldens/interaction/engine-runner.js";
import { skipNote, wikiSkip } from "./test-wiki.js";
import { mountSurface } from "./projection-surface.js";

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => process.nextTick(resolve)); };
const hooks = (): EngineRunHooks => {
  let faked = false;
  const fake = (): void => { if (!faked) { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); faked = true; } };
  return {
    settle: async () => { fake(); await settle(); },
    advance: async () => { fake(); await settle(); vi.advanceTimersByTime(100); await settle(); },
  };
};
const RECT = { top: 10, left: 10, right: 60, bottom: 30, width: 50, height: 20 };
const script = (root: string, steps: Record<string, unknown>[], tiddlers: Record<string, string>[] = []): GoldenScript => ({
  golden: "lar:///ha.ka.ba/lares/docs/pono/dreamdom#/the-crossings", pins: "declared at mount",
  world: { tiddlers: [{ title: "lar:///t/d/target", text: "0" }, ...tiddlers], story: [], root }, steps,
});
const walk = async (s: GoldenScript): Promise<string[]> => (await runEngineGolden(s, hooks())).failures;

const STAMPED_ROOT = [
  `<$navigator story="$:/StoryList" history="$:/HistoryList">`,
  `<$link to="lar:///t/d/target" class="ln">target</$link>`,
  `<$button class="setter" set="lar:///t/d/target" setTo="1">set</$button>`,
  `<$button class="idle">idle</$button>`,
  `<$keyboard key="enter alt-shift-N" actions="<$action-setfield $tiddler='lar:///t/d/target' text='key'/>" class="kb">keys</$keyboard>`,
  `<$dropzone class="dz">drop here</$dropzone>`,
  `<$edit-text tiddler="lar:///t/d/target" class="field"/>`,
  `<span class="browse"><$browse message="tm-import-tiddlers"/></span>`,
  `<$checkbox tiddler="lar:///t/d/target" field="flag" checked="yes" class="tick">tick</$checkbox>`,
  `<span class="bare">bare</span>`,
  `</$navigator>`,
].join("");

describe.skipIf(wikiSkip)(`declared cancellation and bubbling, engine half${skipNote}`, () => {
  afterEach(() => { vi.useRealTimers(); });

  test("each binding carries its declaration: link, button, keyboard, dropzone, edit-text, checkbox; a bare node none", async () => {
    expect(await walk(script(STAMPED_ROOT, [
      { frame: "first" },
      { expect: { frame: { stamps: {
        "a.ln": { "data-lar-on": "click", "data-lar-cancel": "click:ordinary", "data-lar-bubble": "no" },
        "button.setter": { "data-lar-on": "click", "data-lar-cancel": "click", "data-lar-bubble": "no" },
        "button.idle": { "data-lar-on": "click", "data-lar-cancel": null, "data-lar-bubble": "yes" },
        ".kb": { "data-lar-on": "keydown", "data-lar-cancel": "keydown:declared", "data-lar-keys": "enter alt-shift-N", "data-lar-bubble": "yes" },
        ".dz": { "data-lar-on": "dragenter dragover drop", "data-lar-cancel": "dragenter dragover drop", "data-lar-bubble": "no" },
        ".field": { "data-lar-on": "input", "data-lar-live": "value" },
        ".browse input": { "data-lar-on": "change", "data-lar-bubble": "yes" },
        ".bare": { "data-lar-on": null, "data-lar-cancel": null, "data-lar-rid": null },
      } } } },
    ]))).toEqual([]);
  }, 120_000);

  test("CONTROL: a stamp the island never declares reads red, token by token and for an absent stamp", async () => {
    const failures = await walk(script(STAMPED_ROOT, [
      { frame: "first" },
      { expect: { frame: { stamps: {
        "a.ln": { "data-lar-cancel": "click" },
        "button.idle": { "data-lar-cancel": "click" },
        ".kb": { "data-lar-keys": "escape" },
        ".bare": { "data-lar-on": "click" },
      } } } },
    ]));
    expect(failures).toEqual([
      `step 2: a.ln carries data-lar-cancel="click:ordinary", the script expects "click"`,
      `step 2: button.idle carries data-lar-cancel=none, the script expects "click"`,
      `step 2: .kb carries data-lar-keys="enter alt-shift-N", the script expects "escape"`,
      `step 2: .bare carries data-lar-on=none, the script expects "click"`,
    ]);
  }, 120_000);

  test("a click climbs: on a node that binds only keydown it reaches the $button around it and applies", async () => {
    expect(await walk(script(`<$button class="outer" set="lar:///t/d/target" setTo="climbed"><$keyboard key="enter" class="inner">inner</$keyboard></$button>`, [
      { frame: "first" },
      { act: { control: ".inner", action: "lar:click", geometry: RECT } },
      { expect: { answers: ["applied"], writes: [{ title: "lar:///t/d/target", text: "climbed" }] } },
    ]))).toEqual([]);
  }, 120_000);

  test("CONTROL: the same climb read as unclaimed, or as writing nothing, reads red", async () => {
    const failures = await walk(script(`<$button class="outer" set="lar:///t/d/target" setTo="climbed"><$keyboard key="enter" class="inner">inner</$keyboard></$button>`, [
      { frame: "first" },
      { act: { control: ".inner", action: "lar:click", geometry: RECT } },
      { expect: { answers: ["refused:unclaimed"], writes: [{ title: "lar:///t/d/target", text: "0" }] } },
    ]));
    expect(failures).toEqual([
      `step 3: answers ["applied"], the script expects ["refused:unclaimed"]`,
      `step 3: lar:///t/d/target holds text="climbed", the script expects "0"`,
    ]);
  }, 120_000);

  test("a link's own stopPropagation ends the climb: the story moves and the $button around it never fires", async () => {
    const root = `<$navigator story="$:/StoryList" history="$:/HistoryList"><$button class="outer" set="lar:///t/d/target" setTo="climbed"><$link to="lar:///t/d/other" class="ln">other</$link></$button></$navigator>`;
    expect(await walk(script(root, [
      { frame: "first" },
      { act: { control: "a.ln", action: "lar:click", modifiers: { ctrl: false, meta: false, alt: false, shift: false, button: 0 }, geometry: RECT } },
      { expect: { answers: ["applied"], writes: [{ title: "$:/StoryList", list: ["lar:///t/d/other"] }, { title: "$:/HistoryList", "current-tiddler": "lar:///t/d/other" }] } },
    ], [{ title: "lar:///t/d/other", text: "other" }]))).toEqual([]);
  }, 120_000);

  test("CONTROL: a script claiming the button also fired under the link reads red", async () => {
    const root = `<$navigator story="$:/StoryList" history="$:/HistoryList"><$button class="outer" set="lar:///t/d/target" setTo="climbed"><$link to="lar:///t/d/other" class="ln">other</$link></$button></$navigator>`;
    const failures = await walk(script(root, [
      { frame: "first" },
      { act: { control: "a.ln", action: "lar:click", geometry: RECT } },
      { expect: { writes: [{ title: "$:/StoryList", list: ["lar:///t/d/other"] }, { title: "$:/HistoryList" }, { title: "lar:///t/d/target", text: "climbed" }] } },
    ], [{ title: "lar:///t/d/other", text: "other" }]));
    expect(failures).toEqual([`step 3: lar:///t/d/target holds text="0", the script expects "climbed"`]);
  }, 120_000);

  test("RED: a modified click and a middle click on a link dispatch nothing and still answer applied — CONTROL: the ordinary click on the same link moves the story", async () => {
    const root = `<$navigator story="$:/StoryList" history="$:/HistoryList"><$link to="lar:///t/d/other" class="ln">other</$link></$navigator>`;
    const s = await mountSurface(root, [{ title: "lar:///t/d/other", text: "other" }]);
    try {
      const { dispatchLarControlEvent } = await import("../src/tw5-projection.js");
      const click = (ctrl: boolean, button: number) => dispatchLarControlEvent(s.event("ln", {
        kind: "lar:act", action: "lar:click", modifiers: { ctrl, meta: false, alt: false, shift: false, button }, geometry: RECT,
      }));
      const story = (): string => JSON.stringify(s.wiki.getTiddler("$:/StoryList")?.fields["list"] ?? null);
      const before = story();
      click(true, 0);
      await s.flush();
      click(false, 1);
      await s.flush();
      expect(s.results.map((r) => r.status), "each modified click answers applied").toEqual(["applied", "applied"]);
      expect(story(), "a modified or middle click opens nothing in the story").toBe(before);
      click(false, 0);
      await s.flush();
      expect(s.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
      expect(story(), "CONTROL: the ordinary click opens the tiddler").toContain("lar:///t/d/other");
    } finally { s.stop(); }
  }, 120_000);

  test("a click no binding reaches climbs to the camera's top element and answers unclaimed, touching nothing", async () => {
    expect(await walk(script(`<$button class="b" set="lar:///t/d/target" setTo="1">b</$button><span class="bare">bare</span>`, [
      { frame: "first" },
      { act: { control: ".bare", action: "lar:click" } },
      { expect: { answers: ["refused:unclaimed"], writes: [] } },
      { act: { control: ".bare", action: "lar:key", key: { key: "Enter", code: "Enter", keyCode: 13, repeat: false } } },
      { expect: { answers: ["refused:unclaimed"], writes: [] } },
    ]))).toEqual([]);
  }, 120_000);

  test("CONTROL: the unclaimed click read as applied reads red", async () => {
    const failures = await walk(script(`<$button class="b" set="lar:///t/d/target" setTo="1">b</$button><span class="bare">bare</span>`, [
      { frame: "first" },
      { act: { control: ".bare", action: "lar:click" } },
      { expect: { answers: ["applied"] } },
    ]));
    expect(failures).toEqual([`step 3: answers ["refused:unclaimed"], the script expects ["applied"]`]);
  }, 120_000);

  test("$eventcatcher stamps its discrete declaration; matching descendants run it, outside nodes do not, and continuous events refuse by name", async () => {
    const root = `<$eventcatcher $click="<$action-setfield $tiddler='lar:///t/d/target' text=<<event-type>>/>" selector=".hit" class="catch"><button class="hit">inside</button><button class="miss">outside</button></$eventcatcher>`;
    expect(await walk(script(root, [
      { frame: "first" },
      { expect: { frame: { stamps: { ".catch": { "data-lar-on": "click", "data-lar-cancel": "click" } } } } },
      { act: { control: ".hit", action: "lar:click", geometry: RECT } },
      { expect: { answers: ["applied"], writes: [{ title: "lar:///t/d/target", text: "click" }] } },
      { act: { control: ".miss", action: "lar:click", geometry: RECT } },
      { expect: { answers: ["refused:unclaimed"], writes: [{ title: "lar:///t/d/target", text: "click" }] } },
      { act: { control: ".hit", action: "lar:pointermove", geometry: RECT } },
      { expect: { answers: ["refused:continuous-event-refused"] } },
      { act: { control: ".hit", action: "lar:pointerdown", geometry: RECT } },
      { expect: { answers: ["refused:continuous-event-refused"] } },
    ]))).toEqual([]);
  }, 120_000);

  test("$eventcatcher that asks for pointer capture refuses it by name, even for a declared click", async () => {
    const root = `<$eventcatcher $click="<$action-setfield $tiddler='lar:///t/d/target' text='ran'/>" pointerCapture="yes" class="catch"><button class="hit">inside</button></$eventcatcher>`;
    expect(await walk(script(root, [
      { frame: "first" },
      { act: { control: ".hit", action: "lar:click", geometry: RECT } },
      { expect: { answers: ["refused:pointer-capture-refused"], writes: [] } },
    ]))).toEqual([]);
  }, 120_000);

  test("$keyboard refuses a reserved chord by name and matches a declared key across layouts using real key and code", async () => {
    const root = `<$keyboard key="a" actions="<$action-setfield $tiddler='lar:///t/d/target' text=<<event-key>>/>" class="kb">keys</$keyboard>`;
    expect(await walk(script(root, [
      { frame: "first" },
      { act: { control: ".kb", action: "lar:key", key: { key: "l", code: "KeyL", keyCode: 76, repeat: false }, modifiers: { ctrl: true, meta: false, alt: false, shift: false } } },
      { expect: { answers: ["refused:reserved-chord"] } },
      { act: { control: ".kb", action: "lar:key", key: { key: "a", code: "KeyQ", keyCode: 65, repeat: false } } },
      { expect: { answers: ["applied"], writes: [{ title: "lar:///t/d/target", text: "a" }] } },
    ]))).toEqual([]);
  }, 120_000);
});
