/**
 * filter-cts in a real browser — the frozen filter suite runs over the same frozen world inside a stock single-file
 * TiddlyWiki in Chromium, the house plugin dropped in from its committed standalone artifact, so a host drift between
 * Node and a browser names its case on the day it lands.
 *
 * The page binds each case's context through TW5's own fake widget and reads a "Filter error" answer as the case's
 * fault, exactly as `filter-cts-run.ts` does on Node. The world's tiddlers ride the build as `.tid` files; the
 * engine's own shadows and boot tiddlers differ between a single-file build and the Node boot, so a case whose answer
 * reads the whole store (`all[tiddlers]`, `all[shadows]`, `search`) compares only the world's own titles.
 *
 * Gate: a missing fork checkout or a browser that will not launch SKIPS LOUDLY, as the standalone suite does.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/goldens/filter-cts
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = path.resolve(PKG, "../..");
const TW5_JS = process.env["LARES_TW5_JS"] ?? path.join(REPO, "TiddlyWiki5/tiddlywiki.js");
const PLUGIN_TID = path.join(PKG, "plugins/standalone/lares-memetic-wikitext.tid");
const GOLDENS = path.join(PKG, "tests/goldens");
const forkPresent = existsSync(TW5_JS) && existsSync(PLUGIN_TID);
if (!forkPresent) console.error(`filter-cts-chromium.e2e: SKIPPED — fork or committed plugin missing (${TW5_JS} · ${PLUGIN_TID})`);

interface Row { id: string; filter: string; context?: Record<string, string>; results?: string[]; fault?: string; "host-bound": boolean }
const suite = JSON.parse(readFileSync(path.join(GOLDENS, "filter-cts.json"), "utf8")) as { world: string; sections: Record<string, Row[]> };
const world = JSON.parse(readFileSync(path.join(GOLDENS, "worlds", `${suite.world}.json`), "utf8")) as { tiddlers: Array<Record<string, string | string[]>> };
const worldTitles = new Set(world.tiddlers.map((t) => String(t["title"])));

function tidOf(fields: Record<string, string | string[]>): string {
  const head = Object.entries(fields).filter(([k]) => k !== "text")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.map((x) => (/\s/.test(x) ? `[[${x}]]` : x)).join(" ") : v}`);
  return `${head.join("\n")}\n\n${String(fields["text"] ?? "")}`;
}

function buildWorldFile(dir: string): string {
  mkdirSync(path.join(dir, "tiddlers"), { recursive: true });
  writeFileSync(path.join(dir, "tiddlywiki.info"), JSON.stringify({ description: "filter-cts e2e", plugins: [], themes: [], build: {} }));
  world.tiddlers.forEach((t, i) => writeFileSync(path.join(dir, "tiddlers", `world-${i}.tid`), tidOf(t)));
  copyFileSync(PLUGIN_TID, path.join(dir, "tiddlers/lares-memetic-wikitext.tid"));
  const htmlPath = path.join(dir, "output", "index.html");
  const result = spawnSync(process.execPath, [TW5_JS, dir, "--rendertiddler", "$:/core/save/all", "index.html", "text/plain"], { encoding: "utf8" });
  if (result.status !== 0 || !existsSync(htmlPath)) throw new Error(`single-file build failed: ${result.stderr || result.stdout}`);
  return htmlPath;
}

interface Page {
  evaluate<T, A>(fn: (arg: A) => T, arg?: A): Promise<T>;
  goto(url: string): Promise<unknown>;
  waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  close(): Promise<void>;
}
interface Browser { close(): Promise<void>; newPage(): Promise<Page> }

describe.skipIf(!forkPresent)("filter-cts over Chromium — the frozen suite on a second host", () => {
  let root = "";
  let browser: Browser | undefined;

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "filter-cts-"));
    try {
      const { chromium } = await import("playwright");
      browser = (await chromium.launch()) as unknown as Browser;
    } catch (err) {
      console.error(`filter-cts-chromium.e2e: SKIPPED — no browser: ${err instanceof Error ? err.message : String(err)}`);
      browser = undefined;
    }
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("every frozen case answers in the browser as it answered on Node", async () => {
    if (!browser) return;
    const page = await browser.newPage();
    try {
      await page.goto(`file://${buildWorldFile(path.join(root, "world"))}`);
      await page.waitForFunction("typeof $tw !== 'undefined' && !!$tw.wiki && !!$tw.rootWidget", undefined, { timeout: 30_000 });
      const cases = Object.values(suite.sections).flat().map(({ id, filter, context }) => ({ id, filter, ...(context ? { context } : {}) }));
      const answers = await page.evaluate((list: Array<{ id: string; filter: string; context?: Record<string, string> }>) => {
        const tw = (globalThis as unknown as { $tw: {
          wiki: { filterTiddlers(f: string, w?: unknown): string[] };
          rootWidget: { makeFakeWidgetWithVariables(v: Record<string, string>): unknown };
        } }).$tw;
        return list.map(({ id, filter, context }) => {
          try {
            const results = tw.wiki.filterTiddlers(filter, context ? tw.rootWidget.makeFakeWidgetWithVariables(context) : undefined);
            if (results.length === 1 && /^Filter error:/.test(results[0]!)) return { id, fault: results[0]! };
            return { id, results };
          } catch (e) { return { id, fault: e instanceof Error ? e.message : String(e) }; }
        });
      }, cases);
      const byId = new Map(answers.map((a) => [a.id, a]));
      const drift: string[] = [];
      for (const row of Object.values(suite.sections).flat()) {
        const got = byId.get(row.id)!;
        if (row.fault !== undefined) { if (!("fault" in got)) drift.push(`${row.id}: answered where Node faulted`); continue; }
        if (!("results" in got)) { drift.push(`${row.id}: faulted where Node answered (${got.fault})`); continue; }
        const keep = (xs: readonly string[]) => (row["host-bound"] ? xs.filter((t) => worldTitles.has(t)) : xs);
        if (JSON.stringify(keep(got.results)) !== JSON.stringify(keep(row.results ?? []))) {
          drift.push(`${row.id}: ${JSON.stringify(keep(got.results)).slice(0, 120)} where Node reads ${JSON.stringify(keep(row.results ?? [])).slice(0, 120)}`);
        }
      }
      expect(drift, "every case answers alike on both hosts").toEqual([]);
    } finally {
      await page.close();
    }
  }, 120_000);
});
