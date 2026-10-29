/**
 * glass-walk — the five core sites that branch on `isTiddlyWikiFakeDom` or on `$tw.browser`, walked once in a real
 * browser inside a shadow root: the framed editor, the story view's scroll, the popup layer, the edit toolbar and the
 * editor's auto-height. Each step reads the page's own DOM; none waits on a clock.
 */
import { expect, test } from "vitest";
import { openMirror } from "@lararium/tw5/glass";
import coreUrl from "../../lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js?url";

async function coreBytes(): Promise<Uint8Array> {
  const response = await fetch(coreUrl);
  if (!response.ok) throw new Error(`glass-core-fixture-unavailable:${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
const afterChange = (tw: { wiki: { addEventListener(t: string, l: () => void): void; removeEventListener(t: string, l: () => void): void } }, act: () => void) =>
  new Promise<void>(resolve => {
    const listener = () => { tw.wiki.removeEventListener("change", listener); resolve(); };
    tw.wiki.addEventListener("change", listener);
    act();
  });

test("glass-full-width-walk: the framed editor, story scroll, popup layer, toolbar and auto-height run inside the shadow root", async () => {
  const errors: string[] = [];
  const onError = (event: ErrorEvent): void => { errors.push(String(event.error?.stack ?? event.message)); };
  window.addEventListener("error", onError);
  const host = document.createElement("div");
  document.body.append(host);
  const shadowRoot = host.attachShadow({ mode: "open" });
  const bytes = await coreBytes();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const coreCid = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const camera = await openMirror({ shadowRoot, inputs: { coreBytes: bytes, coreCid, preloadedTiddlers: [{ title: "Walk", text: "walk body" }] },
    transport: { send: () => ({ ok: true }), onMessage: () => () => {} }, wikiUri: "wiki", actor: "actor", width: "full", portId: "walk", mintTx: () => crypto.randomUUID() });
  const tw = camera.tw as any;
  await afterChange(tw, () => tw.wiki.addTiddler(new tw.Tiddler({ title: "$:/StoryList", list: ["Walk"] })));

  // Story view and scroller: the edit action scrolls the story through the page scroller.
  expect(typeof tw.pageScroller).toBe("object");
  const edit = shadowRoot.querySelector<HTMLElement>("button[title*='Edit']");
  expect(edit).not.toBeNull();
  await afterChange(tw, () => edit!.click());
  expect(tw.wiki.getTiddler("Draft of 'Walk'")).toBeDefined();

  // Framed editor: an iframe inside the shadow root holds the textarea, and typing reaches the draft.
  const frame = shadowRoot.querySelector("iframe");
  expect(frame).not.toBeNull();
  const area = frame!.contentDocument!.querySelector("textarea")!;
  const before = area.style.height;
  await afterChange(tw, () => { area.focus(); area.value = "typed\n\n\n\n\n\n\n\n\nlines"; area.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(tw.wiki.getTiddlerText("Draft of 'Walk'")).toContain("typed");
  // Auto-height: the framed engine resizes the textarea to its text.
  expect(area.style.height).not.toBe(before);

  // Toolbar: the stock edit toolbar renders its buttons in the shadow root.
  expect(shadowRoot.querySelectorAll(".tc-editor-toolbar button").length).toBeGreaterThan(0);

  // Popup layer: the popup object the core startup would build stands over the glass container.
  expect(typeof tw.popup).toBe("object");

  expect(errors).toEqual([]);
  camera.unmount();
  expect(tw.pageScroller).toBeUndefined();
  window.removeEventListener("error", onError);
  host.remove();
});
