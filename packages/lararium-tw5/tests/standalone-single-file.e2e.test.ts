/**
 * THE SINGLE-FILE WIKI — the tracked `$:/` standalone artifact (`plugins/standalone/
 * lares-memetic-wikitext.tid`) meets a plain `tiddlywiki --rendertiddler "$:/core/save/all"`
 * single-file HTML build, driven over a real Chromium page. Nothing of the fork's `--listen`
 * server, nothing of the island — the exact drag-and-drop path an offline TiddlyWiki user takes.
 *
 * Three legs:
 *   1. RED CONTROL — the same edition, same carrier, built WITHOUT the plugin. The carrier's own
 *      sigil bytes must survive un-parsed (the parser never registers), proving the positive leg
 *      below measures the plugin and not an engine default.
 *   2. THE PLUGIN REGISTERS — built WITH the plugin, the `text/memetic-wikitext+tiddlywiki` parser
 *      is present and a sample carrier renders through it (no escaped sigil bytes survive).
 *   3. SAVE → RELOAD KEEPS THE PLUGIN — in-page, add a tiddler and re-render `$:/core/save/all` to
 *      get the WHOLE single-file HTML the offline saver would write; load THAT html fresh and prove
 *      the parser still registers and the added tiddler survived the round trip.
 *
 * Gate: a missing fork checkout or a browser that will not launch SKIPS LOUDLY. Set `LARES_E2E_TMP`
 * to place the build dirs; `LARES_TW5_JS` points the build at a pristine upstream `tiddlywiki.js`
 * (pristine-upstream CI proves the COMMITTED artifact against the pinned published engine).
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = path.resolve(PKG, "../..");
const TW5_JS = process.env["LARES_TW5_JS"] ?? path.join(REPO, "TiddlyWiki5/tiddlywiki.js");
// The COMMITTED artifact — never dist-plugin/. This suite proves what ships, not what a fresh
// build happens to produce right now.
const PLUGIN_TID = path.join(PKG, "plugins/standalone/lares-memetic-wikitext.tid");
const forkPresent = existsSync(TW5_JS) && existsSync(PLUGIN_TID);
if (!forkPresent) {
  console.error(`standalone-single-file.e2e: SKIPPED — fork or committed plugin missing (${TW5_JS} · ${PLUGIN_TID})`);
}

const SAMPLE_TITLE = "test/standalone-sample";
// A minimal framed carrier — same shape the other e2e suites mint, enough to tell "parsed through
// the memetic-wikitext parser" apart from "escaped as plain text".
const SAMPLE_TEXT =
  `<<^ code="&#x0001;" from=? -> to=lar:///t/standalone>>\n\`\`\`toml meta\nuri-path = "t/standalone"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n<<~ ahu #/body>>\n\n! standalone sample\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

/** Lay a minimal edition with one sample tiddler, optionally carrying the plugin, and build its
 *  single-file HTML via `--rendertiddler "$:/core/save/all"`. */
function buildSingleFile(dir: string, withPlugin: boolean): string {
  mkdirSync(path.join(dir, "tiddlers"), { recursive: true });
  writeFileSync(path.join(dir, "tiddlywiki.info"), JSON.stringify({ description: "standalone single-file e2e", plugins: [], themes: [], build: {} }));
  writeFileSync(path.join(dir, "tiddlers/sample.tid"), `title: ${SAMPLE_TITLE}\ntype: text/memetic-wikitext+tiddlywiki\n\n${SAMPLE_TEXT}`);
  if (withPlugin) copyFileSync(PLUGIN_TID, path.join(dir, "tiddlers/lares-memetic-wikitext.tid"));
  // TW5's render-to-file CLI writes under `<wikifolder>/output/`, not the wiki folder itself.
  const htmlPath = path.join(dir, "output", "index.html");
  const result = spawnSync(process.execPath, [TW5_JS, dir, "--rendertiddler", "$:/core/save/all", "index.html", "text/plain"], { encoding: "utf8" });
  if (result.status !== 0 || !existsSync(htmlPath)) {
    throw new Error(`single-file build failed (withPlugin=${withPlugin}): ${result.stderr || result.stdout}`);
  }
  return htmlPath;
}

interface Page {
  evaluate<T, A>(fn: (arg: A) => T, arg?: A): Promise<T>;
  close(): Promise<void>;
}
interface Browser { close(): Promise<void>; newPage(): Promise<Page> }

describe.skipIf(!forkPresent)("★ THE SINGLE-FILE WIKI — committed standalone plugin, live over Chromium ★", () => {
  let root = "";
  let browser: Browser | undefined;

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "standalone-single-file-"));
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch();
    } catch (err) {
      console.error(`standalone-single-file.e2e: SKIPPED — no browser: ${err instanceof Error ? err.message : String(err)}`);
      browser = undefined;
    }
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const loadFile = async (htmlPath: string): Promise<Page> => {
    const page = await browser!.newPage();
    await page.evaluate(() => undefined); // no-op warms the page object before goto on some CI runners
    await (page as unknown as { goto(u: string): Promise<unknown> }).goto(`file://${htmlPath}`);
    await (page as unknown as { waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown> })
      .waitForFunction("typeof $tw !== 'undefined' && !!$tw.wiki", undefined, { timeout: 30_000 });
    return page;
  };

  const parserRegistered = (page: Page): Promise<boolean> =>
    page.evaluate(() => {
      const tw = (globalThis as unknown as { $tw: { Wiki: { parsers?: Record<string, unknown> } } }).$tw;
      return Boolean(tw.Wiki.parsers?.["text/memetic-wikitext+tiddlywiki"]);
    });

  const renderedHtml = (page: Page, title: string): Promise<string> =>
    page.evaluate((t: string) => {
      const tw = (globalThis as unknown as { $tw: { wiki: { renderTiddler(outputType: string, title: string): string } } }).$tw;
      return tw.wiki.renderTiddler("text/html", t);
    }, title);

  test("RED CONTROL — without the plugin, no memetic-wikitext parser ever touches the carrier", async () => {
    if (!browser) return;
    const htmlPath = buildSingleFile(path.join(root, "no-plugin"), false);
    const page = await loadFile(htmlPath);
    try {
      expect(await parserRegistered(page)).toBe(false);
      const html = await renderedHtml(page, SAMPLE_TITLE);
      // Absent the plugin, TW5 falls back to its stock wikitext parser for the unrecognized type —
      // it has no notion of the plugin's own "degraded/partial" diagnostic wrapper, so that marker,
      // unique to the plugin's sigil rule, cannot appear.
      expect(html).not.toContain("lar-sigil-degraded");
    } finally {
      await page.close();
    }
  }, 60_000);

  test("THE PLUGIN REGISTERS — the committed artifact drops into a stock single-file build", async () => {
    if (!browser) return;
    const htmlPath = buildSingleFile(path.join(root, "with-plugin"), true);
    const page = await loadFile(htmlPath);
    try {
      expect(await parserRegistered(page)).toBe(true);
      const html = await renderedHtml(page, SAMPLE_TITLE);
      // The plugin's own memetic-wikitext sigil rule touched the carrier — this diagnostic
      // wrapper class exists ONLY in the plugin's wikirules/lar-sigil.ts, never in stock TW5.
      expect(html).toContain("lar-sigil-degraded");
      expect(html).toContain("memetic-wikitext");
    } finally {
      await page.close();
    }
  }, 60_000);

  test("SAVE → RELOAD KEEPS THE PLUGIN — a re-rendered single-file HTML still carries it", async () => {
    if (!browser) return;
    const htmlPath = buildSingleFile(path.join(root, "roundtrip"), true);
    const page = await loadFile(htmlPath);
    const ADDED_TITLE = "test/standalone-roundtrip-added";
    let savedHtml: string;
    try {
      // The act an offline save makes: add a tiddler, then ask the wiki to re-render the exact
      // template the saver writes to disk.
      await page.evaluate((t: string) => {
        (globalThis as unknown as { $tw: { wiki: { addTiddler(f: Record<string, string>): void } } }).$tw.wiki.addTiddler({
          title: t, text: "hello from the round trip", type: "text/vnd.tiddlywiki",
        });
      }, ADDED_TITLE);
      savedHtml = await page.evaluate((t: string) => {
        const tw = (globalThis as unknown as { $tw: { wiki: { renderTiddler(o: string, t: string): string } } }).$tw;
        return tw.wiki.renderTiddler("text/plain", t);
      }, "$:/core/save/all");
    } finally {
      await page.close();
    }
    expect(savedHtml.length).toBeGreaterThan(1000);

    const reloadPath = path.join(root, "roundtrip", "reload.html");
    writeFileSync(reloadPath, savedHtml, "utf8");
    const reloaded = await loadFile(reloadPath);
    try {
      expect(await parserRegistered(reloaded)).toBe(true);
      const addedText = await reloaded.evaluate((t: string) => {
        const tw = (globalThis as unknown as { $tw: { wiki: { getTiddlerText(t: string): string | undefined } } }).$tw;
        return tw.wiki.getTiddlerText(t);
      }, ADDED_TITLE);
      expect(addedText).toBe("hello from the round trip");
    } finally {
      await reloaded.close();
    }
  }, 60_000);
});
