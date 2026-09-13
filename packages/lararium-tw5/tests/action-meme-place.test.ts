/**
 * THE IN-WIKI DOOR — a button places a meme, with no script and no binary.
 *
 * `$tw.lares.meme.place` stands published inside every wiki carrying the grammar, and until this
 * widget only a script reached it: wikitext could render a meme, project it and link to it, and had
 * no way to PLACE one. Every other skin over `placeMeme` — the HTTP routes, the CLI, the daemon
 * reactors — carried a door an author could type. The wiki, which holds the author, carried none.
 *
 * Two readings, because the widget answers to two things. The FAKE-$tw unit drives the widget class
 * over a stubbed base widget and a stubbed face: it reads what reaches `place` and what lands as the
 * receipt, which a live wiki cannot show without also proving the grammar. The LIVE witness boots a
 * wiki holding the packed grammar and fires `<$action-meme-place>` through `rootWidget`, so the
 * registration, the attribute parse and the real face all stand in the same reading.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";

const URI = "lar:///t/widget";
const meme = (slots: readonly string[], uri = URI, uriPath = "t/widget"): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n\`\`\`toml meta\nuri-path = "${uriPath}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

// ---------------------------------------------------------------------------
// The fake $tw: a stubbed base widget, a stubbed wiki, a stubbed face.
// ---------------------------------------------------------------------------

interface FakeTiddler { title: string; [field: string]: string }

function fakeStage(): {
  placed: Array<{ uri: string; text: string }>;
  tiddlers: Map<string, FakeTiddler>;
  face: Pick<LaresMemeFace, "place">;
} {
  const placed: Array<{ uri: string; text: string }> = [];
  const tiddlers = new Map<string, FakeTiddler>();
  const face = {
    place: vi.fn(async (uri: string, text: string) => {
      placed.push({ uri, text });
      return {
        uri, decision: "ingest" as const, grade: "clean" as const,
        landed: [uri], tombstoned: [], canonicalHash: "sha256:feed", warnings: [], diagnostics: [],
      };
    }),
  };
  return { placed, tiddlers, face };
}

interface WidgetLike {
  render(parent: unknown, next: unknown): void;
  invokeAction(triggering: unknown, event: unknown): boolean;
  refresh(changed: unknown): boolean;
}
type WidgetClass = new (node: unknown, options: unknown) => WidgetLike;

/**
 * Load the widget module with `$tw` and `require` standing as TW5's evalGlobal supplies them.
 *
 * The module caches after the first import, so the base class each instance inherits comes from the
 * FIRST stage. Every later stage reaches its own wiki through the `options` a widget is constructed
 * with — which is how TW5 hands a widget its wiki too.
 */
async function loadWidget(stage: ReturnType<typeof fakeStage>): Promise<{ Widget: WidgetClass; wiki: unknown }> {
  const wiki = {
    addTiddler: (fields: Record<string, string>) => { stage.tiddlers.set(fields["title"]!, fields as FakeTiddler); },
  };
  class FakeWidget {
    attributes: Record<string, string> = {};
    wiki: unknown = wiki;
    initialise(node: unknown, options: unknown): void {
      this.attributes = (node as { attributes?: Record<string, string> })?.attributes ?? {};
      this.wiki = (options as { wiki?: unknown })?.wiki ?? wiki;
    }
    computeAttributes(): Record<string, boolean> { return {}; }
    getAttribute(name: string, fallback = ""): string { return this.attributes[name] ?? fallback; }
    refreshSelf(): void { /* nothing to re-render in a test */ }
    refreshChildren(): boolean { return false; }
  }
  const g = globalThis as unknown as Record<string, unknown>;
  g["require"] = (id: string) => (id === "$:/core/modules/widgets/widget.js" ? { widget: FakeWidget } : {});
  g["$tw"] = { lares: { meme: stage.face }, wiki };
  const mod = await import("../src/widgets/action-meme-place.js");
  return { Widget: (mod as unknown as Record<string, WidgetClass>)["action-meme-place"]!, wiki };
}

const fire = (loaded: { Widget: WidgetClass; wiki: unknown }, attributes: Record<string, string>): boolean => {
  const w = new loaded.Widget({ attributes }, { wiki: loaded.wiki });
  w.render(null, null);
  return w.invokeAction(null, null);
};

describe("action-meme-place — the widget over a fake $tw", () => {
  test("★ the attributes reach `place` and the receipt lands in $:/temp ★", async () => {
    const stage = fakeStage();
    const loaded = await loadWidget(stage);
    const text = meme(["/a"]);
    expect(fire(loaded, { uri: URI, text })).toBe(true);
    await vi.waitFor(() => expect(stage.tiddlers.size).toBe(1));
    expect(stage.placed).toEqual([{ uri: URI, text }]);
    const receipt = stage.tiddlers.get(`$:/temp/lares/meme-place/${URI}`)!;
    expect(receipt["decision"]).toBe("ingest");
    expect(receipt["grade"]).toBe("clean");
    expect(receipt["canonical-hash"]).toBe("sha256:feed");
    expect(JSON.parse(receipt["text"]!)).toMatchObject({ uri: URI, decision: "ingest", landed: [URI] });
  });

  test("CONTROL: an empty uri or an empty text places nothing and leaves no receipt", async () => {
    const stage = fakeStage();
    const loaded = await loadWidget(stage);
    expect(fire(loaded, { uri: "", text: meme(["/a"]) })).toBe(true);
    expect(fire(loaded, { uri: URI, text: "" })).toBe(true);
    expect(fire(loaded, {})).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(stage.placed).toEqual([]);
    expect(stage.tiddlers.size).toBe(0);
  });

  test("the container rides the receipt as provenance; naming both names none", async () => {
    const stage = fakeStage();
    const loaded = await loadWidget(stage);
    fire(loaded, { uri: URI, text: meme(["/a"]), bag: "default" });
    await vi.waitFor(() => expect(stage.tiddlers.size).toBe(1));
    expect(stage.tiddlers.get(`$:/temp/lares/meme-place/${URI}`)!["container"]).toBe("bags/default");

    const both = fakeStage();
    const loaded2 = await loadWidget(both);
    fire(loaded2, { uri: URI, text: meme(["/a"]), bag: "default", recipe: "default" });
    await vi.waitFor(() => expect(both.tiddlers.size).toBe(1));
    expect(both.tiddlers.get(`$:/temp/lares/meme-place/${URI}`)!["container"]).toBeUndefined();
  });
});

describe.skipIf(wikiSkip)(`★ the live door — <$action-meme-place> in a booted wiki ★${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;
  const LIVE = "lar:///t/widget-live";
  beforeAll(async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g["require"]; delete g["$tw"];
    engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  });
  afterAll(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g["require"]; delete g["$tw"];
  });

  test("the wiki places the meme the action names, and hands the receipt back through $:/temp", async () => {
    const text = meme(["/a", "/b"], LIVE, "t/widget-live");
    const root = (engine.$tw as unknown as { rootWidget: { invokeActionString(s: string): void } }).rootWidget;
    engine.wiki.addTiddler({ title: "$:/temp/lares/widget-source", uri: LIVE, text });
    root.invokeActionString(
      `<$action-meme-place uri={{$:/temp/lares/widget-source!!uri}} text={{$:/temp/lares/widget-source!!text}}/>`,
    );
    await vi.waitFor(() => expect(engine.wiki.getTiddler(`$:/temp/lares/meme-place/${LIVE}`)).toBeTruthy());
    const receipt = engine.wiki.getTiddler(`$:/temp/lares/meme-place/${LIVE}`)!.fields as Record<string, string>;
    expect(receipt["decision"]).toBe("ingest");
    expect(engine.wiki.getTiddler(`${LIVE}#/b`)).toBeTruthy();
    const back = await face.read(LIVE);
    expect(back?.text).toContain("<<~ ahu #/b>>");
    expect(receipt["canonical-hash"]).toBe(back?.canonicalHash);
  });

  test("CONTROL: the same action with an empty uri leaves the wiki unmoved", async () => {
    const before = (await face.list()).length;
    const root = (engine.$tw as unknown as { rootWidget: { invokeActionString(s: string): void } }).rootWidget;
    root.invokeActionString(`<$action-meme-place uri="" text="anything at all"/>`);
    await new Promise((r) => setTimeout(r, 50));
    expect((await face.list()).length).toBe(before);
  });
});
