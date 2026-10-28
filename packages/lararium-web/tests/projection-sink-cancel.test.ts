/**
 * projection-sink-cancel.test — THE PAGE CANCELS ONLY WHAT A BINDING DECLARED (dreamdom#/the-crossings, "Declared
 * at mount, never decided at handling"; dreamdom#/what-a-sink-keeps, "the blanket preventDefault").
 *
 * The island stamps each bound node with `data-lar-on`, `data-lar-cancel`, `data-lar-keys` and `data-lar-bubble`.
 * A click or a key relays only to the first node up its path whose `data-lar-on` binds that type, and the page
 * cancels only what the stamps on that climb declare. Each vector stands beside a control that MUST read the other
 * way. Real Chromium; the page's default reads off a window listener after the sink had its turn, which then
 * cancels an anchor's so the test page never navigates.
 */
import { afterEach, describe, expect, test } from "vitest";
import { LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, type LarMsg_ControlEvent } from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

/** Every mount tears down after its test, red or green, so no window listener outlives the test that set it. */
const teardowns: Array<() => void> = [];
afterEach(() => { for (const t of teardowns.splice(0)) t(); });

function mount(html: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host);
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_surface, ev) => { if (!sent.some((prior) => prior.eventId === ev.eventId)) sent.push(ev); } });
  const frame: LarSurfaceFrame = {
    type: LAR_FRAME, wikiUri: "lar:///wiki/lares", cameraId: LAR_CAMERA_STORY, mountEpoch: 1,
    keys: [{ key: LAR_KEY_SURFACE, rev: 1, html }], sensedRevision: {}, surface: "lares",
  };
  expect(sink.apply(frame)).toBe("painted");
  const pane = host.shadowRoot!.querySelector<HTMLElement>(".lar-projection")!;
  let prevented: boolean | null = null;
  const read = (e: Event): void => {
    prevented = e.defaultPrevented;
    // An anchor would navigate the test page; every other default (a checkbox's toggle) stands as the page left it.
    if (e.composedPath().some((n) => n instanceof HTMLAnchorElement)) e.preventDefault();
  };
  window.addEventListener("click", read);
  window.addEventListener("auxclick", read);
  window.addEventListener("keydown", read);
  const at = (selector: string): HTMLElement => pane.querySelector<HTMLElement>(selector) ?? (() => { throw new Error(`no ${selector}`); })();
  /** Make one real act and read what the page did: what it relayed, and whether it cancelled the default. */
  const act = (selector: string, event: Event): { relayed: LarMsg_ControlEvent | undefined; prevented: boolean } => {
    const mark = sent.length;
    prevented = null;
    at(selector).dispatchEvent(event);
    return { relayed: sent[mark], prevented: prevented ?? false };
  };
  const click = (init: MouseEventInit = {}): MouseEvent => new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, button: 0, ...init });
  const middle = (): MouseEvent => new MouseEvent("auxclick", { bubbles: true, composed: true, cancelable: true, button: 1 });
  const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent("keydown", { bubbles: true, composed: true, cancelable: true, ...init });
  let live = true;
  const done = (): void => {
    if (!live) return;
    live = false;
    window.removeEventListener("click", read); window.removeEventListener("auxclick", read); window.removeEventListener("keydown", read);
    host.remove();
  };
  teardowns.push(done);
  return { act, click, middle, key, done };
}

const LINK = `data-lar-on="click dragstart dragend" data-lar-cancel="click:ordinary" data-lar-bubble="no"`;
/** The page template's shape: a `$dropzone` wrapper (bound, but not to click) around the story's content. */
const DROPZONE = `data-lar-rid="1" data-lar-on="dragenter dragover drop" data-lar-cancel="dragenter dragover drop" data-lar-bubble="no"`;

describe("★ the blanket preventDefault is gone: a click cancels only by its binding's stamp ★", () => {
  test("a click on unbound text inside the page's dropzone relays nothing and leaves the default; CONTROL: an ordinary click on a link inside it relays and cancels", () => {
    const m = mount(`<div ${DROPZONE}><p><span class="plain">plain</span> <a class="ln" data-lar-rid="2" ${LINK} href="#lar%3Abeta">beta</a></p></div>`);
    expect(m.act(".plain", m.click())).toEqual({ relayed: undefined, prevented: false });
    const link = m.act(".ln", m.click());
    expect([link.relayed?.action, link.relayed?.renderId, link.prevented]).toEqual(["lar:click", "2", true]);
    m.done();
  });

  test("a node whose data-lar-on lacks the type never relays, render id or not; CONTROL: the same node stamped for click relays", () => {
    const m = mount(`<button class="unstamped" data-lar-rid="3">a</button><button class="stamped" data-lar-rid="4" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">b</button>`);
    expect(m.act(".unstamped", m.click())).toEqual({ relayed: undefined, prevented: false });
    const stamped = m.act(".stamped", m.click());
    expect([stamped.relayed?.renderId, stamped.prevented]).toEqual(["4", true]);
    m.done();
  });
});

describe("★ a link's ordinary click cancels; modified, middle and external clicks keep the browser's default ★", () => {
  test("ctrl-click and cmd-click relay with their modifier and leave the default; a middle click relays as button 1 and leaves it; CONTROL: a plain click cancels", () => {
    const m = mount(`<a class="ln" data-lar-rid="2" ${LINK} href="#lar%3Abeta">beta</a>`);
    const ctrl = m.act(".ln", m.click({ ctrlKey: true }));
    expect([ctrl.relayed?.modifiers?.ctrl, ctrl.prevented]).toEqual([true, false]);
    const cmd = m.act(".ln", m.click({ metaKey: true }));
    expect([cmd.relayed?.modifiers?.meta, cmd.prevented]).toEqual([true, false]);
    const mid = m.act(".ln", m.middle());
    expect([mid.relayed?.action, mid.relayed?.modifiers?.button, mid.prevented]).toEqual(["lar:click", 1, false]);
    expect(m.act(".ln", m.click()).prevented).toBe(true);
    m.done();
  });

  test("a middle click on a $button relays nothing; CONTROL: its primary click relays and cancels", () => {
    const m = mount(`<button class="b" data-lar-rid="5" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">go</button>`);
    expect(m.act(".b", m.middle())).toEqual({ relayed: undefined, prevented: false });
    expect(m.act(".b", m.click()).prevented).toBe(true);
    m.done();
  });

  test("an href with a scheme, rel=external and the stock external class each relay and leave the default; CONTROL: a # href cancels", () => {
    const m = mount([
      `<a class="scheme" data-lar-rid="6" ${LINK} href="https://example.test/">out</a>`,
      `<a class="rel" data-lar-rid="7" ${LINK} rel="noopener external" href="/elsewhere">out</a>`,
      `<a class="tc-tiddlylink-external" data-lar-rid="8" ${LINK} href="/elsewhere">out</a>`,
      `<a class="internal" data-lar-rid="9" ${LINK} href="#lar%3Abeta">in</a>`,
    ].join(""));
    for (const sel of [".scheme", ".rel", ".tc-tiddlylink-external"]) {
      const r = m.act(sel, m.click());
      expect([sel, r.relayed?.action, r.prevented]).toEqual([sel, "lar:click", false]);
    }
    expect(m.act(".internal", m.click()).prevented).toBe(true);
    m.done();
  });
});

describe("★ a click climbs past a binding that lets it on, and stops at one that ends it ★", () => {
  test("an inner binding with data-lar-bubble=yes lets the outer binding's cancel stand; CONTROL: data-lar-bubble=no ends the climb uncancelled", () => {
    const html = (bubble: string): string =>
      `<div data-lar-rid="10" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no"><button class="inner" data-lar-rid="11" data-lar-on="click" data-lar-bubble="${bubble}">idle</button></div>`;
    const yes = mount(html("yes"));
    const climbed = yes.act(".inner", yes.click());
    expect([climbed.relayed?.renderId, climbed.prevented]).toEqual(["11", true]);
    yes.done();
    const no = mount(html("no"));
    const ended = no.act(".inner", no.click());
    expect([ended.relayed?.renderId, ended.prevented]).toEqual(["11", false]);
    no.done();
  });
});

describe("★ a keyboard binding cancels its declared chords and no other ★", () => {
  const KB = `data-lar-rid="12" data-lar-on="keydown" data-lar-cancel="keydown:declared" data-lar-keys="enter alt-shift-N" data-lar-bubble="yes"`;

  test("a declared Enter and a declared alt-shift-N relay and cancel; an undeclared ctrl-s relays and keeps its default; a bare letter neither relays nor cancels", () => {
    const m = mount(`<div class="kb" ${KB}><input class="field"></div>`);
    const enter = m.act(".field", m.key({ key: "Enter", code: "Enter", keyCode: 13 }));
    expect([enter.relayed?.action, enter.relayed?.renderId, enter.relayed?.key?.keyCode, enter.prevented]).toEqual(["lar:key", "12", 13, true]);
    const alt = m.act(".field", m.key({ key: "N", code: "KeyN", keyCode: 78, altKey: true, shiftKey: true }));
    expect([alt.relayed?.key?.keyCode, alt.prevented]).toEqual([78, true]);
    const ctrl = m.act(".field", m.key({ key: "s", code: "KeyS", keyCode: 83, ctrlKey: true }));
    expect([ctrl.relayed?.modifiers?.ctrl, ctrl.prevented]).toEqual([true, false]);
    expect(m.act(".field", m.key({ key: "x", code: "KeyX", keyCode: 88 }))).toEqual({ relayed: undefined, prevented: false });
    m.done();
  });

  test("CONTROL: the same wrapper without its data-lar-keys stamp lets Enter type: no relay, no cancel", () => {
    const m = mount(`<div class="kb" ${KB.replace(` data-lar-keys="enter alt-shift-N"`, "")}><input class="field"></div>`);
    expect(m.act(".field", m.key({ key: "Enter", code: "Enter", keyCode: 13 }))).toEqual({ relayed: undefined, prevented: false });
    m.done();
  });
});
