/**
 * THE HTML PROJECTION RENDERS INSIDE THE ISLAND — `lar:///ha.ka.ba/lararium/templates/meme/html`.
 *
 * TiddlyWiki's own `$:/core/templates/static.tiddler.html` renders the story river through
 * `$:/core/ui/ViewTemplate`, which transcludes EVERY `$:/tags/ViewTemplate` the wiki holds. The island
 * vends the streams plugin, whose `stream-view-template` requires `$:/plugins/sq/lib/swipeevents.js`
 * — a browser-platform library reaching `window` at load — so the core template dies inside a worker
 * where no `window` stands. The plain server renders it only because it holds no streams plugin.
 *
 * A meme projects ITSELF, never the wiki's UI cascade: the house template renders the root's title and
 * body through the core's own static frame and nothing else, so it renders the same in the island, in
 * the browser and on a plain server. The suite boots the island's composition (grammar + streams) and
 * the control (grammar alone) and asks for the same bytes-shape from both.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { MEME_TEMPLATE, PROJECT_TARGETS } from "../src/meme-project.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";

/** The streams plugin the island vends, whatever version stands in `plugins/`. */
const PLUGINS = new URL("../plugins/", import.meta.url);
const streamsFile = readdirSync(PLUGINS).find((f) => f.startsWith("sq-streams") && f.endsWith(".json"));
if (!streamsFile) throw new Error("meme-html-template: no sq-streams plugin stands in plugins/ — the island's composition cannot be booted");
const STREAMS = JSON.parse(readFileSync(new URL(streamsFile, PLUGINS), "utf8")) as Record<string, unknown>;
const CORE_STATIC = "$:/core/templates/static.tiddler.html";

const URI = "lar:///t/html";
const meme =
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\`\`\`toml meta\nuri-path = "t/html"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  `<<~ ahu #/a>>\n\n! Alpha heading\n\nA body line.\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

async function placed(extraPlugins: Array<Record<string, unknown>>) {
  const engine = await bootTestWiki({ extraPlugins });
  const face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  await face.place(URI, meme);
  const render = (template: string): string =>
    engine.wiki.renderTiddler("text/plain", template, { variables: { currentTiddler: URI, storyTiddler: URI } });
  return { engine, face, render };
}

describe.skipIf(wikiSkip)(`the house html template${skipNote}`, () => {
  test("CONTROL: the core static template reaches `window` once the streams plugin stands, and renders without it", async () => {
    const island = await placed([STREAMS]);
    expect(() => island.render(CORE_STATIC)).toThrow(/window is not defined/);
    const plain = await placed([]);
    expect(plain.render(CORE_STATIC)).toMatch(/^<!doctype html>/);
  });

  test("the html route names the house template", () => {
    expect(PROJECT_TARGETS.html.template).toBe(MEME_TEMPLATE.html);
    expect(MEME_TEMPLATE.html).toBe("lar:///ha.ka.ba/lararium/templates/meme/html");
  });

  test("the house template renders the root inside the island's composition — a document, the title, the heading", async () => {
    const island = await placed([STREAMS]);
    const html = island.face.project(URI, "html").text;
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("tc-story-river");
    expect(html).toContain(`<title>${URI}</title>`);
    expect(html).toMatch(/<h1[^>]*>Alpha heading<\/h1>/);
    expect(html).toContain("A body line.");
    expect(html).not.toContain("tc-btn-");
  });

  test("one law, two contexts: the plain composition renders the same document", async () => {
    const [island, plain] = [await placed([STREAMS]), await placed([])];
    const doc = plain.render(MEME_TEMPLATE.html);
    expect(doc).toMatch(/^<!doctype html>/);
    expect(doc).toBe(island.render(MEME_TEMPLATE.html));
  });
});
