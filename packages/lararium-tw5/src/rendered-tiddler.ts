/**
 * rendered-tiddler — a tiddler marked `projection: rendered` derives a LIVE TIDDLER OF ITS OWN (backlog-awakens, "The
 * rendered tiddler"; operator 2026-11-18: "The rendered artifact can live in the wikis/ folder with a meta sidecar AS a
 * live wiki object").
 *
 * THE RENDER. The island renders the source through its own engine as `wiki-render` renders a title (the global import
 * leads, the source transcludes in block mode under its own `currentTiddler`), so a `<$list>` resolves and every
 * transclusion fills. The output stands as a record of the source's `render-type` (`text/plain` by default, `text/html`
 * allowed; any other value reads as the default), carrying `rendered-from: <source title>`, at the title the source's
 * `render-title` names, else `<source title>.rendered`. The projector then writes it natively through the file-info
 * cascade it already holds: a text/html render lands as `<name>.html` beside `<name>.html.meta` in its wiki's workbench.
 *
 * THE DEPENDENCY SET DERIVES FROM THE RENDER. Each render keeps the widget tree it built alive, and every widget in that
 * tree names what it read (a transclusion its tiddler, a list its filter's answer): TiddlyWiki's own refresh asks the
 * tree whether a change set reaches it, and only a change it reached re-renders and writes. The rendered tiddler's own
 * title leaves every change set before the tree hears it, and the tree computes over the wiki minus that title, so a
 * render never reads itself and never feeds its own loop; a write lands only where the output moved.
 *
 * THE ISLAND-BOOT RULE (#260). The render runs only the code the engine already holds (the floor-admitted preloads; a
 * module record in the wiki stays data), and NO ACTION WIDGET FIRES: while a render or a refresh runs, the widget
 * prototype's action and message doors (`invokeActions`, `invokeActionString`, `invokeActionsByTag`, `dispatchEvent`)
 * answer nothing, and the tree hangs under no parent, so no `tm-*` message reaches a handler.
 *
 * THE RENDER STANDS WHERE ITS SOURCE TAKES WRITES. A source renders in the island whose composite holds the bag it surfaced
 * from (`$origin-bag`) as a writable layer; a source this island only reads (the oracle floor every recipe stands on, a
 * read-only library) renders nowhere here, and a render standing from one leaves at arm. So a floor row marked rendered
 * derives its render in the wiki whose own live layer carries it, never one copy per wiki that reads the floor, and a cold
 * wiki's workbench holds no render it never wrote. A source copied up into a writable layer renders from then on; a source
 * whose writable copy leaves (the floor answers again) takes its render with it.
 *
 * ONLY THE RENDERER WRITES A RENDERED TIDDLER: a hand's door refuses `rendered-derives`, and a wave lands none and
 * answers each render carrier `derived` on its rung (`@lararium/mesh` `rendered-derives.ts`). A source that drops its mark, or leaves, takes its render with it; a render whose source no
 * longer marks it leaves at arm.
 *
 * Runs daemon-side and island-side alike (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/backlog-awakens
 */

import { PROJECTION_FIELD, PROJECTION_RENDERED, RENDERED_FROM_FIELD, renderedFromOf } from "@lararium/mesh/rendered-derives";
import { type ChangeOrigin, type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { filtersTextOfWiki, functionPragmasOf } from "./house-filters.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { IslandCap } from "./island-caps.js";
import type { IslandContext } from "./island-context.js";

export { RENDERED_FROM_FIELD, PROJECTION_FIELD, PROJECTION_RENDERED } from "@lararium/mesh/rendered-derives";

/** The field naming the rendered tiddler's content type, and the field naming its title. */
export const RENDER_TYPE_FIELD = "render-type" as const;
export const RENDER_TITLE_FIELD = "render-title" as const;
/** The suffix a rendered tiddler's title takes where the source names no `render-title`. */
export const RENDERED_TITLE_SUFFIX = ".rendered" as const;

const GLOBAL_IMPORT = "\\import [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]]\n";
const wrapperOf = (pragmas: string): string => `${GLOBAL_IMPORT}${pragmas}\n\n<$tiddler tiddler=<<lares-render-title>>>\n\n<$transclude $tiddler=<<lares-render-title>> $mode="block"/>\n\n</$tiddler>`;
const ACTION_DOORS = ["invokeActions", "invokeActionString", "invokeActionsByTag", "dispatchEvent"] as const;

type Fields = Readonly<Record<string, unknown>>;
type Changes = Record<string, { modified?: boolean; deleted?: boolean }>;
interface FakeNode { innerHTML: string; textContent: string }
interface LiveWidget { render(parent: FakeNode, next: null): void; refresh(changes: Changes): boolean }
interface RenderWiki {
  getTiddler(title: string): { fields: Fields } | undefined;
  tiddlerExists(title: string): boolean;
  filterTiddlers(filter: string): string[];
  parseText(type: string, text: string): unknown;
  makeWidget(parser: unknown, options: Record<string, unknown>): LiveWidget;
  addEventListener(type: string, listener: (changes: Changes) => void): void;
  removeEventListener(type: string, listener: (changes: Changes) => void): void;
}

/** Whether a record's fields mark it a source the island renders. */
export function marksRendered(fields: Fields | null | undefined): boolean {
  return !!fields && fields[PROJECTION_FIELD] === PROJECTION_RENDERED && renderedFromOf(fields) === null;
}

/** The rendered tiddler's title for a source's fields: its `render-title`, else `<source title>.rendered`. */
export function renderedTitleOf(fields: Fields): string {
  const named = fields[RENDER_TITLE_FIELD];
  return typeof named === "string" && named.trim() !== "" ? named.trim() : `${String(fields["title"])}${RENDERED_TITLE_SUFFIX}`;
}

/** The rendered tiddler's content type for a source's fields: `text/html` where it names that, else `text/plain`. */
export function renderTypeOf(fields: Fields): "text/html" | "text/plain" {
  return fields[RENDER_TYPE_FIELD] === "text/html" ? "text/html" : "text/plain";
}

/** Where a render's writes go: `write` lands the rendered record, `remove` takes a render whose source left; `ownsBag`
 *  answers whether this island writes the bag a source surfaced from (a writable layer of its composite). */
export interface RenderedTiddlerPorts {
  write(fields: Record<string, string>): Promise<void>;
  remove(title: string): Promise<void>;
  ownsBag(bag: string): boolean;
}

interface Render {
  readonly source: string;
  readonly title: string;
  readonly type: "text/html" | "text/plain";
  readonly widget: LiveWidget;
  readonly container: FakeNode;
  last: string | null;
}

/**
 * Arm the renderer over one engine: every standing source renders once, and the wiki's change stream keeps each render
 * live. Returns the teardown.
 */
export function armRenderedTiddlers(tw5: TW5Engine, ports: RenderedTiddlerPorts): () => void {
  const $tw = tw5.$tw as unknown as { wiki: RenderWiki; fakeDocument: { createElement(tag: string): FakeNode } };
  const wiki = $tw.wiki;
  const renders = new Map<string, Render>();
  let chain: Promise<void> = Promise.resolve();
  const queue = (step: () => Promise<void>): void => {
    chain = chain.then(step).catch((err: unknown) => console.error(`[rendered-tiddler] ${err instanceof Error ? err.message : String(err)}`));
  };

  // THE ISLAND-BOOT RULE: no action door answers while a render or a refresh runs.
  const guarded = <T>(widget: LiveWidget, run: () => T): T => {
    const proto = Object.getPrototypeOf(widget) as Record<string, unknown>;
    const held = ACTION_DOORS.map((name) => [name, proto[name]] as const);
    for (const [name] of held) proto[name] = () => false;
    try { return run(); } finally { for (const [name, door] of held) proto[name] = door; }
  };

  // THE RENDER NEVER READS ITSELF: it computes over the wiki minus its own rendered title, which reads absent to every
  // transclusion, text reference and field read in the tree. The view inherits the engine's wiki and its caches (one
  // engine, never a second parser), so a change the wiki clears clears here too; a hidden title never reaches a cache.
  const without = (title: string): RenderWiki => {
    const view = Object.create(wiki) as RenderWiki;
    view.getTiddler = (t) => (t === title ? undefined : wiki.getTiddler(t));
    view.tiddlerExists = (t) => t !== title && wiki.tiddlerExists(t);
    return view;
  };

  // THE RENDER STANDS WHERE ITS SOURCE TAKES WRITES: a marked source surfaced from a bag this island only reads derives
  // nothing here. A tiddler that never crossed a layer (no `$origin-bag`) renders as the engine holds it.
  const derives = (fields: Fields | null | undefined): boolean => {
    if (!marksRendered(fields)) return false;
    const bag = fields!["$origin-bag"];
    return typeof bag !== "string" || bag === "" || ports.ownsBag(bag);
  };

  const output = (render: Render): string => render.type === "text/html" ? render.container.innerHTML : render.container.textContent;

  const emit = (render: Render): void => {
    const text = output(render);
    if (text === render.last) return;
    render.last = text;
    const fields = { title: render.title, type: render.type, text, [RENDERED_FROM_FIELD]: render.source };
    queue(() => ports.write(fields));
  };

  const build = (source: string, fields: Fields): Render | null => {
    const title = renderedTitleOf(fields);
    if (title === source) {
      console.warn(`[rendered-tiddler] ${source}: render-title names the source itself; nothing renders`);
      return null;
    }
    const type = renderTypeOf(fields);
    const view = without(title);
    const widget = view.makeWidget(view.parseText("text/vnd.tiddlywiki", wrapperOf(functionPragmasOf(filtersTextOfWiki(wiki as never)))), { variables: { "lares-render-title": source } });
    const container = $tw.fakeDocument.createElement("div");
    guarded(widget, () => widget.render(container, null));
    // A render that stands already with these very fields writes nothing (a re-armed island, a boot over a standing render).
    const standing = wiki.getTiddler(title)?.fields;
    const same = standing && standing[RENDERED_FROM_FIELD] === source && standing["type"] === type;
    const render: Render = { source, title, type, widget, container, last: same ? String(standing["text"] ?? "") : null };
    renders.set(source, render);
    emit(render);
    return render;
  };

  const disarm = (source: string, keep?: string): void => {
    const render = renders.get(source);
    if (!render) return;
    renders.delete(source);
    if (render.title !== keep) queue(() => ports.remove(render.title));
  };

  // THE FIRST PASS: every standing source renders, and a render no source claims any longer leaves.
  for (const source of wiki.filterTiddlers(`[field:${PROJECTION_FIELD}[${PROJECTION_RENDERED}]]`)) {
    const fields = wiki.getTiddler(source)?.fields;
    if (derives(fields)) build(source, fields!);
  }
  const claimed = new Set([...renders.values()].map((render) => render.title));
  for (const title of wiki.filterTiddlers(`[has[${RENDERED_FROM_FIELD}]]`)) {
    if (!claimed.has(title)) queue(() => ports.remove(title));
  }

  const onChange = (changes: Changes): void => {
    const rebuilt = new Set<string>();
    for (const title of Object.keys(changes)) {
      const fields = changes[title]?.deleted ? undefined : wiki.getTiddler(title)?.fields;
      const armed = renders.get(title);
      if (!armed && !derives(fields)) continue;
      // A SOURCE MOVED: it builds afresh (its text, type or title may have moved), or leaves where it dropped its mark or
      // fell back to a layer this island only reads.
      if (!derives(fields)) { disarm(title); continue; }
      const next = renderedTitleOf(fields!);
      if (armed) disarm(title, next);
      if (build(title, fields!)) rebuilt.add(title);
    }
    for (const render of renders.values()) {
      if (rebuilt.has(render.source)) continue;
      // THE RENDER NEVER FEEDS ITS OWN LOOP: its own title leaves the change set before the tree hears it.
      const reach: Changes = { ...changes };
      delete reach[render.title];
      if (Object.keys(reach).length === 0) continue;
      if (guarded(render.widget, () => render.widget.refresh(reach))) emit(render);
    }
  };
  wiki.addEventListener("change", onChange);
  return () => { wiki.removeEventListener("change", onChange); renders.clear(); };
}


/**
 * `#has` rendered-tiddlers — every TW5 VM island renders its marked sources (the pool wiki and the daemon surface alike).
 * A source renders only where the island writes the bag it surfaced from (`ownsBag`, the composite's writable layers).
 * The render lands in the island's composite as any record lands (the working layer the recipe writes), so the projector
 * writes it natively to its wiki's workbench and every read door answers it; its source's leaving tombstones it there.
 */
export function hasRenderedTiddlers(): IslandCap {
  return {
    name: "rendered-tiddlers",
    onEa(ctx: IslandContext) {
      const origin = (source: string): ChangeOrigin => ({ kind: "lares-verb", requestId: `rendered:${source}` });
      return armRenderedTiddlers(ctx.tw5, {
        write: (fields) => ctx.composite.put({ tiddler: fields as LarTiddlerRecord["tiddler"], meta: {} }, origin(fields[RENDERED_FROM_FIELD] ?? "")),
        remove: (title) => ctx.composite.tombstone(title, origin(title)),
        ownsBag: (bag) => ctx.composite.hasWritableBag(bag),
      });
    },
  };
}
