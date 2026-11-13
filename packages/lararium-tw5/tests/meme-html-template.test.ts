/**
 * THE HTML PROJECTION RENDERS INSIDE THE ISLAND — `lar:///ha.ka.ba/lararium/templates/meme/html`.
 *
 * A meme projects ITSELF, never the wiki's UI cascade: the house template renders the root's title and
 * body through the core's own static frame and nothing else, so it renders the SAME bytes whether the
 * island carries an extra plugin or not. The suite boots the island's composition (grammar + the PoC
 * `highlight` offering, through an EXPLICIT composition — never a boot-set member) and the control
 * (grammar alone) and asks for the same bytes-shape from both.
 *
 * `highlight` replaces the formerly-vendored `sq-streams` as this suite's optional plugin (Streams is
 * DEFERRED — golden-path-p2-recipe.md OPERATOR RULING 2026-10-10). Streams' `stream-view-template`
 * registered a `$:/tags/ViewTemplate` reaching `window` at load, which made the point sharply — the
 * CORE static template's own cascade crashed on it while the house template never touched it at all.
 * `highlight` carries no view-template and adds no such hazard; the CONTROL below instead proves the
 * weaker, still load-bearing half of the same claim directly: the island composition actually DIFFERS
 * from the control (it carries the plugin the control does not), and the house template's output is
 * identical regardless — the house template's isolation is not merely untested by accident.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { MEME_TEMPLATE, PROJECT_TARGETS } from "../src/meme-project.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";

/** The PoC signed offering's packed plugin (R2c) — grammar-only is the control; this is the ONE
 *  optional plugin the island's composition carries, through an explicit composition (never a
 *  boot-set member — see `offerings/highlight/`). */
const HIGHLIGHT_PLUGIN_PATH = new URL("../offerings/highlight/highlight-plugin.json", import.meta.url);
const HIGHLIGHT = JSON.parse(readFileSync(HIGHLIGHT_PLUGIN_PATH, "utf8")) as Record<string, unknown>;
const CORE_STATIC = "$:/core/templates/static.tiddler.html";

const URI = "lar:///t/html";
const meme =
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/html"\n\`\`\`\n\n` +
  `<<~ ahu slot=\`#/a\`>>\n\n! Alpha heading\n\nA body line.\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

async function placed(extraPlugins: Array<Record<string, unknown>>) {
  const engine = await bootTestWiki({ extraPlugins });
  const face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  await face.place(URI, meme);
  const render = (template: string): string =>
    engine.wiki.renderTiddler("text/plain", template, { variables: { currentTiddler: URI, storyTiddler: URI } });
  return { engine, face, render };
}

describe.skipIf(wikiSkip)(`the house html template${skipNote}`, () => {
  test("CONTROL: the island composition actually carries highlight; the grammar-alone control does not — yet both render the house template identically", async () => {
    const island = await placed([HIGHLIGHT]);
    const plain = await placed([]);
    expect(island.engine.wiki.getTiddler("$:/plugins/tiddlywiki/highlight")).toBeTruthy();
    expect(plain.engine.wiki.getTiddler("$:/plugins/tiddlywiki/highlight")).toBeFalsy();
    // Both still boot and render the CORE static template without error — unlike Streams, `highlight`
    // carries no `window`-reaching view-template, so it adds no cascade hazard to compare against.
    expect(island.render(CORE_STATIC)).toMatch(/^<!doctype html>/);
    expect(plain.render(CORE_STATIC)).toMatch(/^<!doctype html>/);
  });

  test("the html route names the house template", () => {
    expect(PROJECT_TARGETS.html.template).toBe(MEME_TEMPLATE.html);
    expect(MEME_TEMPLATE.html).toBe("lar:///ha.ka.ba/lararium/templates/meme/html");
  });

  test("the house template renders the root inside the island's composition — a document, the title, the heading", async () => {
    const island = await placed([HIGHLIGHT]);
    const html = island.face.project(URI, "html").text;
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("tc-story-river");
    expect(html).toContain(`<title>${URI}</title>`);
    expect(html).toMatch(/<h1[^>]*>Alpha heading<\/h1>/);
    expect(html).toContain("A body line.");
    expect(html).not.toContain("tc-btn-");
  });

  test("one law, two contexts: the plain composition renders the same document", async () => {
    const [island, plain] = [await placed([HIGHLIGHT]), await placed([])];
    const doc = plain.render(MEME_TEMPLATE.html);
    expect(doc).toMatch(/^<!doctype html>/);
    expect(doc).toBe(island.render(MEME_TEMPLATE.html));
  });
});
