/**
 * projection-reveal — retained reveal state crosses the projected fake DOM.
 *
 * TW5's browser startup installs `$tw.anim`, but a worker projection deliberately
 * boots the Node/fake-DOM path. A retained reveal still calls `anim.perform` for
 * both directions, including its close callback. This fixture mounts a real TW5
 * widget tree and crosses the same render-id event return leg as the browser.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { dispatchLarControlEvent, patchFakeDomAnimation } from "../src/tw5-projection.js";
import { htmlOf, mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const ROOT = "$:/temp/lararium/projection-reveal-root";
const OPEN = "$:/state/lararium/projection-reveal";

function renderIdFor(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<button\\b[^>]*data-lar-rid="([^"]+)"[^>]*>${escaped}</button>`));
  if (!match) throw new Error(`missing projected ${label} button`);
  return match[1]!;
}

describe.skipIf(wikiSkip)(`retained reveal projection${skipNote}`, () => {
  let s: Surface | undefined;

  afterEach(() => {
    s?.stop();
    s = undefined;
  });

  test("open then close changes the real fake-DOM projection, and close runs its callback", async () => {
    // The projection owns this root normally; the focused fixture replaces it
    // before mounting so the test observes exactly one retained reveal.
    s = await mountSurface(`{{${ROOT}}}`, [{
      title: ROOT,
      type: "text/vnd.tiddlywiki",
      text: [
        `<$button set="${OPEN}" setTo="open">open</$button>`,
        `<$button set="${OPEN}" setTo="closed">close</$button>`,
        `<$reveal state="${OPEN}" type="match" text="open" retain="yes" animate="yes">revealed</$reveal>`,
      ].join("\n"),
    }]);
    const click = (renderId: string) => dispatchLarControlEvent(s!.event("", { kind: "lar:act", action: "lar:click", renderId }));

    expect(s.frames.length).toBeGreaterThan(0);
    const open = renderIdFor(htmlOf(s.last()), "open");
    const initialClose = renderIdFor(htmlOf(s.last()), "close");

    expect(click(open)).toMatchObject({ status: "applied" });
    await s.flush();
    expect(htmlOf(s.last())).toContain("revealed");
    expect(htmlOf(s.last())).not.toContain('hidden="true"');

    // Opening the reveal re-renders TW5's widget tree, so the old close button belongs to a
    // superseded absolute frame. A real page relays the render-id on its currently painted frame.
    expect(initialClose).not.toBe(renderIdFor(htmlOf(s.last()), "close"));
    const close = renderIdFor(htmlOf(s.last()), "close");
    expect(click(close)).toMatchObject({ status: "applied" });
    await s.flush();
    expect(htmlOf(s.last())).toContain('hidden="true"');
    // `retain=yes` deliberately keeps its child nodes; the close callback is what applies hidden.
    expect(htmlOf(s.last())).toContain("revealed");
  }, 120_000);

  test("control: fake nodes complete once while the original animator owns real nodes", () => {
    const receivers: unknown[] = [];
    const perform = vi.fn(function (this: unknown): void { receivers.push(this); });
    const existing = { perform };
    const tw: Record<string, any> = { anim: existing };
    patchFakeDomAnimation(tw);
    patchFakeDomAnimation(tw); // Mounting twice must not stack real-node wrappers.
    const callback = vi.fn();

    tw.anim.perform("close", { isTiddlyWikiFakeDom: true }, { callback });
    expect(callback).toHaveBeenCalledOnce();
    expect(perform).not.toHaveBeenCalled();

    const realNode = {};
    tw.anim.perform("open", realNode, { callback });
    expect(perform).toHaveBeenCalledWith("open", realNode, { callback });
    expect(receivers).toEqual([existing]);
    expect(callback).toHaveBeenCalledOnce();

    const headless: Record<string, any> = {};
    patchFakeDomAnimation(headless);
    const onOpen = vi.fn(), onClose = vi.fn();
    expect(() => headless.anim.perform("open", { isTiddlyWikiFakeDom: true }, { callback: onOpen })).not.toThrow();
    expect(() => headless.anim.perform("close", { isTiddlyWikiFakeDom: true }, { callback: onClose })).not.toThrow();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
