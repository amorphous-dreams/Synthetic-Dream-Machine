/**
 * daemon-surface-origin — K19 slice 4, R5: no daemon-surface button goes dark under the origin law (house ruling
 * 2026-10-29). Each button family on the daemon's own projected surface, clicked as a person's act over the surface
 * leg (`dispatchLarControlEvent`), emits its verb with origin `surface`; the very same summon written into the store
 * (synced or content-written, no control event) emits `content`.
 *
 * Families: switcher and recipe (`wiki-switch`, `remove-bag`, `add-bag`), persona (`persona-wear`, `persona-mint`),
 * circle (`circle-remove`), intent (`intent-view`), roster (`roster`, `reconcile`, `promote`, `retire`, `purge`), and
 * `custody-clear`, which the root services write after a person's confirm.
 *
 * RED today: the reaction router's verse event carries no origin at all.
 */
import { afterEach, describe, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import {
  DAEMON_UI_TIDDLERS, DAEMON_PERSONA_TIDDLERS, DAEMON_CIRCLE_TIDDLERS, DAEMON_INTENT_TIDDLERS, DAEMON_ROSTER_TIDDLERS,
  SWITCHER_STATE_TITLE, PERSONA_STATE_TITLE, CIRCLE_STATE_TITLE, ROSTER_STATE_TITLE, LIFECYCLE_APPROVE_CAP, INTENT_VIEW_CAP,
} from "../src/index.js";
import { mountSurface, htmlOf, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

type Spec = Readonly<Record<string, string>>;
type Click = { readonly verb: string; readonly cls?: string; readonly attr?: string };

/** The render id of the first painted node whose tag carries `attr` (a button that wears no class of its own). */
function ridOfAttr(html: string, attr: string): string {
  const tag = [...html.matchAll(/<[a-zA-Z][\w-]*\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(attr));
  const rid = tag?.match(/data-lar-rid="([^"]+)"/);
  if (!rid) throw new Error(`no projected node carrying ${attr}`);
  return rid[1]!;
}

/** The pane in `specs` that paints the family's first button, transcluded as the root. */
function paneOf(specs: readonly Spec[], marker: string): string {
  const pane = specs.find((s) => (s["text"] ?? "").includes(marker));
  if (!pane) throw new Error(`no pane carries ${marker}`);
  return `<$transclude $tiddler="${pane["title"]}" $mode="block"/>`;
}

const FAMILIES: ReadonlyArray<{ name: string; specs: readonly Spec[]; marker: string; state: Array<Record<string, string>>; clicks: readonly Click[] }> = [
  {
    name: "switcher and recipe", specs: DAEMON_UI_TIDDLERS as readonly Spec[], marker: "lares-switch-btn",
    state: [{ title: SWITCHER_STATE_TITLE, list: "home", recipeSlug: "home", recipe: "lar:///b/one", availableBags: "lar:///b/two" }],
    clicks: [{ verb: "wiki-switch", cls: "lares-switch-btn" }, { verb: "remove-bag", cls: "lares-recipe-remove" }, { verb: "add-bag", cls: "lares-recipe-add-btn" }],
  },
  {
    name: "persona", specs: DAEMON_PERSONA_TIDDLERS as readonly Spec[], marker: "lares-persona-mint-btn",
    state: [{ title: PERSONA_STATE_TITLE, list: "0 1", active: "0", held: "0 1", custody: "sealed", custodyClears: "face h0" }],
    clicks: [{ verb: "persona-wear", cls: "lares-persona-wear" }, { verb: "persona-mint", cls: "lares-persona-mint-btn" }, { verb: "custody-clear", cls: "lares-persona-clear-btn" }],
  },
  {
    name: "circle", specs: DAEMON_CIRCLE_TIDDLERS as readonly Spec[], marker: "lares-circle-unfollow",
    state: [{ title: CIRCLE_STATE_TITLE, list: "0", "nym-0": "nym-a", circle: "following" }],
    clicks: [{ verb: "circle-remove", cls: "lares-circle-unfollow" }],
  },
  {
    name: "intent", specs: DAEMON_INTENT_TIDDLERS as readonly Spec[], marker: "data-lares-intent-refresh",
    state: [{ title: INTENT_VIEW_CAP, text: "1" }],
    clicks: [{ verb: "intent-view", attr: 'data-lares-intent-refresh="1"' }],
  },
  {
    name: "roster", specs: DAEMON_ROSTER_TIDDLERS as readonly Spec[], marker: "lares-roster-refresh",
    state: [
      { title: ROSTER_STATE_TITLE, list: "alpha", type: "application/json", text: JSON.stringify({ alpha: { lifecycle: "active" } }) },
      { title: LIFECYCLE_APPROVE_CAP, text: "1" },
    ],
    clicks: [
      { verb: "roster", cls: "lares-roster-refresh" }, { verb: "reconcile", cls: "lares-life-reconcile" },
      { verb: "promote", cls: "lares-life-promote" }, { verb: "retire", cls: "lares-life-retire" }, { verb: "purge", cls: "lares-life-purge" },
    ],
  },
];

describe.skipIf(wikiSkip)(`R5: every daemon-surface button family keeps its verb under the origin law${skipNote}`, () => {
  let surface: Surface | undefined;
  afterEach(() => { surface?.stop(); surface = undefined; });

  for (const family of FAMILIES) {
    test(`RED: ${family.name} — a click reads surface; the same summon written into the store reads content`, async () => {
      surface = await mountSurface(paneOf(family.specs, family.marker), [...family.specs.map((s) => ({ ...s })), ...family.state]);
      // `custody-clear` asks the person to confirm: the person says yes.
      const tw = (surface.ctx.tw5 as unknown as { $tw: { utils: { confirm?: unknown } } }).$tw;
      tw.utils.confirm = () => true;
      const events: Array<Record<string, unknown>> = [];
      const wiki = surface.wiki as unknown as { addEventListener(t: string, f: (e: Record<string, unknown>) => void): void; removeEventListener(t: string, f: (e: Record<string, unknown>) => void): void };
      const record = (e: Record<string, unknown>) => events.push(e);
      wiki.addEventListener("tm-verse-event", record);
      try {
        for (const click of family.clicks) {
          const renderId = click.attr ? ridOfAttr(htmlOf(surface.last()), click.attr) : undefined;
          const ev = surface.event(click.cls ?? "", { kind: "lar:act", action: "lar:click", ...(renderId ? { renderId } : {}) });
          expect(dispatchLarControlEvent(ev), `${click.verb} click applies`).toMatchObject({ status: "applied" });
          await surface.flush();
          // Silent-zero guard: the click must reach the router at all before its origin is read.
          const fired = events.filter((e) => e["verb"] === click.verb);
          expect(fired.length, `${click.verb} fired from its button`).toBeGreaterThan(0);
          expect(fired.at(-1), `${click.verb} as a surface act`).toMatchObject({ verb: click.verb, origin: "surface" });
        }
        // The same summon, written into the store with no control event under it, reads content.
        const first = family.clicks[0]!.verb;
        surface.wiki.addTiddler({ title: `lar:///test/daemon-surface/synced/${first}`, verb: first, "lares-dispatch": "1", "arg-synced": "yes" });
        await surface.flush();
        expect(events.filter((e) => e["verb"] === first).at(-1), `${first} written by the store`).toMatchObject({ verb: first, origin: "content" });
      } finally { wiki.removeEventListener("tm-verse-event", record); }
    }, 120_000);
  }
});
