/**
 * THE RENDERED TIDDLER — a tiddler marked `projection: rendered` derives a live tiddler of its own: the island renders it
 * (list resolved, transclusions filled) and the render stands as a record of its `render-type` (text/plain by default,
 * text/html allowed), carrying `rendered-from: <source title>` (backlog-awakens, "The rendered tiddler").
 *
 * Each red beside a control:
 *   - the render stands as its own tiddler, typed and marked, its list resolved and its transclusions filled;
 *   - the file-info cascade sites a text/html render as `<name>.html` plus its `.html.meta` sidecar;
 *   - a change the render reached re-renders it, a change it never reached writes nothing, and the rendered tiddler's
 *     own landing never feeds its own loop;
 *   - the render fires no action widget;
 *   - the agent surface: one `tiddler-get` answers the whole render, and `wiki-filter` over the sources answers a slice.
 *
 * A real engine boots here (`bootTestWiki`), so the render answers as TiddlyWiki answers it.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, type CompositeStore as Composite } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { exportCarrierFile } from "../src/meme-write.js";
import { makeTiddlerGetReactor, makeWikiFilterReactor } from "../src/tiddler-verbs.js";
import { armRenderedTiddlers, renderedTitleOf, RENDERED_FROM_FIELD } from "../src/rendered-tiddler.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const ROAD_TEXT = `<$list filter="[tag[road/rank]sort[order]]"><h2><$text text=<<currentTiddler>>/></h2><$transclude mode="block"/></$list>`;

/** Let TiddlyWiki's queued change events dispatch, and the writes they cause settle. */
const settle = async (): Promise<void> => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 5)); };

async function rig(extra: Array<Record<string, string>> = []) {
  const engine = await bootTestWiki({ tiddlers: [
    { title: WORKING_POINTER, text: DAEMON },
    { title: "Rank A", tags: "road/rank", order: "1", type: "text/vnd.tiddlywiki", text: "first rank" },
    { title: "Rank B", tags: "road/rank", order: "2", type: "text/vnd.tiddlywiki", text: "second rank: {{Note}}" },
    { title: "Note", type: "text/vnd.tiddlywiki", text: "noted" },
    { title: "Other", text: "unreached" },
    { title: "Road", type: "text/vnd.tiddlywiki", projection: "rendered", "render-type": "text/html", text: ROAD_TEXT },
    ...extra,
  ] });
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
  // THE SHORE, IN SMALL: a store change lands in the wiki, as the island adaptor lands it.
  composite.subscribe((change) => {
    void (async () => {
      const top = await composite.resolveLayered(change.title);
      if (top && !top.record.meta?.deleted) engine.wiki.addTiddler({ ...(top.record.tiddler as Record<string, unknown>), "$origin-bag": top.bagId });
      else if (engine.wiki.tiddlerExists(change.title)) engine.wiki.deleteTiddler(change.title);
    })();
  });
  const writes: Array<Record<string, string>> = [];
  const removes: string[] = [];
  const stop = armRenderedTiddlers(engine, {
    write: async (fields) => { writes.push(fields); await composite.put({ tiddler: fields as never, meta: {} }, { kind: "lares-verb", requestId: "render" }); },
    remove: async (title) => { removes.push(title); await composite.tombstone(title, { kind: "lares-verb", requestId: "render" }); },
  });
  await settle();
  const writesOf = (title: string) => writes.filter((w) => w["title"] === title);
  return { engine, composite, writes, writesOf, removes, stop };
}

const ctx = (composite: Composite): VerbContext => ({
  daemon: composite, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: async () => ({ ok: true }),
});

describe.skipIf(wikiSkip)(`the rendered tiddler${skipNote}`, () => {
  test("RED: a `projection: rendered` source derives a live text/html tiddler marked rendered-from, its list resolved and transclusions filled; CONTROL: an unmarked tiddler derives nothing", async () => {
    const r = await rig();
    const rendered = r.engine.wiki.getTiddler("Road.rendered");
    expect(rendered, "the render stands as a tiddler of its own").toBeDefined();
    const fields = rendered!.fields as Record<string, unknown>;
    expect(fields["type"]).toBe("text/html");
    expect(fields[RENDERED_FROM_FIELD]).toBe("Road");
    const text = String(fields["text"]);
    expect(text).toContain("<h2>Rank A</h2>");
    expect(text).toContain("first rank");
    expect(text).toContain("noted");             // the transclusion filled
    expect(text).not.toContain("<$list");         // the list resolved
    expect(text.indexOf("Rank A")).toBeLessThan(text.indexOf("Rank B"));
    expect(r.engine.wiki.getTiddler("Other.rendered")).toBeUndefined();
    expect(r.engine.wiki.getTiddler("Note.rendered")).toBeUndefined();
    r.stop();
  }, 60_000);

  test("RED: no render-type renders text/plain; `render-title` names the rendered tiddler", async () => {
    const r = await rig([
      { title: "Plain", type: "text/vnd.tiddlywiki", projection: "rendered", text: "''bold'' {{Note}}" },
      { title: "Named", type: "text/vnd.tiddlywiki", projection: "rendered", "render-type": "text/html", "render-title": "road.html", text: "{{Note}}" },
    ]);
    const plain = r.engine.wiki.getTiddler("Plain.rendered")!.fields as Record<string, unknown>;
    expect(plain["type"]).toBe("text/plain");
    expect(String(plain["text"]).trim()).toBe("bold noted");
    expect((r.engine.wiki.getTiddler("road.html")!.fields as Record<string, unknown>)[RENDERED_FROM_FIELD]).toBe("Named");
    expect(renderedTitleOf({ title: "Road" })).toBe("Road.rendered");
    expect(renderedTitleOf({ title: "Road", "render-title": "road.html" })).toBe("road.html");
    r.stop();
  }, 60_000);

  test("RED: the file-info cascade sites a text/html render as `<name>.html` plus `<name>.html.meta`, the sidecar naming rendered-from", async () => {
    const r = await rig([{ title: "Named", type: "text/vnd.tiddlywiki", projection: "rendered", "render-type": "text/html", "render-title": "road.html", text: "{{Note}}" }]);
    for (const [title, path] of [["Road.rendered", "Road.rendered.html"], ["road.html", "road.html"]] as const) {
      const file = exportCarrierFile(r.engine, title);
      expect(file, title).not.toBeNull();
      expect(file!.ext).toBe(".html");
      expect(file!.defaultRelPath).toBe(path);
      expect(file!.metaBody).toMatch(/^rendered-from: /m);
      expect(file!.metaBody).toMatch(/^type: text\/html$/m);
      expect(file!.body).not.toMatch(/rendered-from/);
    }
    r.stop();
  }, 60_000);

  test("RED: a change the render reached re-renders it, a new member of its list joins; CONTROL: a change it never reached writes nothing", async () => {
    const r = await rig();
    const before = r.writesOf("Road.rendered").length;
    expect(before).toBe(1);
    r.engine.setTiddler({ title: "Other", text: "still unreached" });
    await settle();
    expect(r.writesOf("Road.rendered").length, "an unreached change writes nothing").toBe(before);
    r.engine.setTiddler({ title: "Note", type: "text/vnd.tiddlywiki", text: "re-noted" });
    await settle();
    expect(r.writesOf("Road.rendered").length).toBe(before + 1);
    expect(String(r.engine.wiki.getTiddler("Road.rendered")!.fields["text"])).toContain("re-noted");
    r.engine.setTiddler({ title: "Rank C", tags: "road/rank", order: "3", type: "text/vnd.tiddlywiki", text: "third rank" });
    await settle();
    expect(String(r.engine.wiki.getTiddler("Road.rendered")!.fields["text"])).toContain("third rank");
    r.stop();
  }, 60_000);

  test("RED: the rendered tiddler never feeds its own loop — a source that transcludes its own render settles after one write", async () => {
    const r = await rig([{ title: "Echo", type: "text/vnd.tiddlywiki", projection: "rendered", text: "x{{Echo.rendered}}" }]);
    await settle();
    await settle();
    expect(r.writesOf("Echo.rendered").map((w) => w["text"])).toEqual(["x"]);
    r.stop();
  }, 60_000);

  test("RED: the render fires no action widget, inline or behind a button; CONTROL: the button's label renders", async () => {
    const r = await rig([{
      title: "Acts", type: "text/vnd.tiddlywiki", projection: "rendered",
      text: `<$action-setfield $tiddler="Fired" text="inline"/><$button actions="""<$action-setfield $tiddler="Fired" text="button"/>""">press</$button>`,
    }]);
    expect(r.engine.wiki.getTiddler("Fired")).toBeUndefined();
    expect(String(r.engine.wiki.getTiddler("Acts.rendered")!.fields["text"])).toContain("press");
    r.stop();
  }, 60_000);

  test("RED: a source that drops its mark removes its render; CONTROL: the other render stands", async () => {
    const r = await rig([{ title: "Plain", type: "text/vnd.tiddlywiki", projection: "rendered", text: "plain" }]);
    expect(r.engine.wiki.getTiddler("Plain.rendered")).toBeDefined();
    r.engine.setTiddler({ title: "Plain", type: "text/vnd.tiddlywiki", text: "plain" });
    await settle();
    expect(r.removes).toContain("Plain.rendered");
    expect(r.engine.wiki.getTiddler("Plain.rendered")).toBeUndefined();
    expect(r.engine.wiki.getTiddler("Road.rendered")).toBeDefined();
    r.stop();
  }, 60_000);

  test("RED: the agent surface — one tiddler-get answers the whole render, and wiki-filter over the sources answers a slice", async () => {
    const r = await rig();
    const got = await makeTiddlerGetReactor({ composite: r.composite, tw5: r.engine })({ recipe: "default", title: "Road.rendered" }, ctx(r.composite));
    const tiddler = got["tiddler"] as { fields: Record<string, string> };
    expect(tiddler.fields[RENDERED_FROM_FIELD]).toBe("Road");
    expect(tiddler.fields["text"]).toContain("first rank");
    expect(tiddler.fields["text"]).toContain("noted");
    const slice = await makeWikiFilterReactor({ composite: r.composite, tw5: r.engine })(
      { recipe: "default", filter: "[tag[road/rank]sort[order]]", fields: ["text"], limit: 1 }, ctx(r.composite));
    expect(slice["rows"]).toEqual([{ title: "Rank A", fields: { text: "first rank" } }]);
    expect(slice["total"]).toBe(2);
    r.stop();
  }, 60_000);
});
