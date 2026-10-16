/**
 * stock-tab-baseline — the browser-side numbers D0 owes beside `measure:frames`: a STOCK TiddlyWiki tab.
 *
 * Renders a stock single-file wiki from the TW5 fork (`tiddlywiki.js`, `editions/empty`, `--render $:/core/save/all`)
 * holding the house's carriers under `bags/lares` as the reference corpus (each `.mem` loads as one tiddler of type
 * `text/memetic-wikitext+tiddlywiki`, titled by its toml meta `title`, read the way `frame-baseline.ts` reads them),
 * with `$:/config/Performance/Instrumentation` = `yes` baked in and a `$:/StoryList` naming the first twelve
 * non-system titles sorted. Stock startup replaces `$:/StoryList` from `$:/DefaultTiddlers`, so the baked
 * `$:/DefaultTiddlers` reads `[list[$:/StoryList]]` and the tab opens the baked story.
 *
 * Opens that file in headless Chromium through the repo's own Playwright and reads:
 *   - TW5's own `$tw.perf.report` lines (`mainRender`, `mainRefresh`, `styleRefresh`, `throttledRefresh`) off the
 *     page console, split into the first paint and a run of edits to the first story tiddler, each edit awaited by
 *     the page's own `th-page-refreshed` hook and then the next animation frame (never a sleep);
 *   - a `long-animation-frame` PerformanceObserver (`buffered: true`) registered by `page.addInitScript`;
 *   - `$tw.perf.measures`, the filter table, top five by total time.
 *
 * Usage:  pnpm --filter @lararium/tw5 measure:stock-tab [edits=100]
 * Prints one JSON row and exits 0. Writes only under a temp dir in `os.tmpdir()`, removed at exit.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const TW5 = path.join(REPO, "TiddlyWiki5");
const CORPUS = path.join(REPO, "bags", "lares");
const EDITS = Number(process.argv[2] ?? 100);
const REPORTS = ["mainRender", "mainRefresh", "styleRefresh", "throttledRefresh"] as const;
const MEM_TYPE = "text/memetic-wikitext+tiddlywiki";

function* carriers(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* carriers(full);
    else if (entry.endsWith(".mem")) yield full;
  }
}
const titleOf = (text: string): string | null => /^title\s*=\s*"(lar:\/\/\/[^"]+)"/m.exec(text)?.[1] ?? null;
// TW5's `sort[title]` compares lower-cased titles with `<`; mirror it so the story names what the filter names.
const twSort = (a: string, b: string): number => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; };
const stringifyList = (titles: string[]): string => titles.map((t) => (/[\s\]]/.test(t) || t.startsWith("[") ? `[[${t}]]` : t)).join(" ");

const tmp = mkdtempSync(path.join(os.tmpdir(), "stock-tab-"));
const watchdog = setTimeout(() => { console.error("stock-tab-baseline: watchdog fired after 300 s"); rmSync(tmp, { recursive: true, force: true }); process.exit(1); }, 300_000);
watchdog.unref();

try {
  // (a) The stock single-file wiki over the reference corpus.
  const byTitle = new Map<string, { title: string; type: string; text: string }>();
  let files = 0;
  for (const file of carriers(CORPUS)) {
    const text = readFileSync(file, "utf8");
    const title = titleOf(text);
    if (!title) continue;
    files++;
    byTitle.set(title, { title, type: MEM_TYPE, text });
  }
  const story = [...byTitle.keys()].filter((t) => !t.startsWith("$:/")).sort(twSort).slice(0, 12);
  const tiddlers = [
    ...byTitle.values(),
    { title: "$:/config/Performance/Instrumentation", text: "yes" },
    { title: "$:/StoryList", text: "", list: stringifyList(story) },
    { title: "$:/DefaultTiddlers", text: "[list[$:/StoryList]]" },
  ];
  const corpusJson = path.join(tmp, "corpus.json");
  writeFileSync(corpusJson, JSON.stringify(tiddlers));
  const rendered = spawnSync(process.execPath, [
    path.join(TW5, "tiddlywiki.js"), path.join(TW5, "editions", "empty"),
    "--load", corpusJson,
    "--output", tmp,
    "--render", "$:/core/save/all", "stock.html", "text/plain",
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const html = path.join(tmp, "stock.html");
  if (rendered.status !== 0 || !existsSync(html)) throw new Error(`stock render failed (${rendered.status}): ${rendered.stderr || rendered.stdout}`);
  const htmlBytes = statSync(html).size;

  // (b) Headless Chromium through the repo's own Playwright.
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleSeen: Record<string, number> = Object.fromEntries(REPORTS.map((n) => [n, 0]));
  const reportLine = /\b(mainRender|mainRefresh|styleRefresh|throttledRefresh): (\d+(?:\.\d+)?)ms\b/;
  page.on("console", (msg) => { const m = reportLine.exec(msg.text()); if (m) consoleSeen[m[1]!]!++; });

  // tsx keeps function names through an injected `__name(fn, name)` helper that the page never defines; lend it first.
  await page.addInitScript("globalThis.__name = (fn) => fn;");
  // (c, d) Before any page script: tap the console for TW5's report lines, observe long animation frames.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const lines: { name: string; ms: number; phase: string }[] = [];
    const loaf: { startTime: number; duration: number; blockingDuration: number }[] = [];
    w.__stockPhase = "firstPaint";
    w.__stockLines = lines;
    w.__stockLoaf = loaf;
    const re = /\b(mainRender|mainRefresh|styleRefresh|throttledRefresh): (\d+(?:\.\d+)?)ms\b/;
    const log = console.log;
    console.log = function (...args: unknown[]) {
      const m = re.exec(args.map(String).join(" "));
      if (m) lines.push({ name: m[1]!, ms: Number(m[2]), phase: String(w.__stockPhase) });
      return log.apply(console, args);
    };
    const supported = typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("long-animation-frame");
    w.__stockLoafSupported = supported;
    if (supported) {
      const take = (entries: PerformanceEntryList): void => {
        for (const e of entries as unknown as { startTime: number; duration: number; blockingDuration: number }[]) {
          loaf.push({ startTime: e.startTime, duration: e.duration, blockingDuration: e.blockingDuration });
        }
      };
      const obs = new PerformanceObserver((list) => take(list.getEntries()));
      obs.observe({ type: "long-animation-frame", buffered: true });
      w.__stockLoafFlush = (): void => take(obs.takeRecords());
    }
  });

  await page.goto(pathToFileURL(html).href);
  // The first paint lands when render.js has mounted the page widget and the story river stands in the DOM.
  await page.waitForFunction(() => {
    const tw = (window as unknown as { $tw?: { pageWidgetNode?: unknown } }).$tw;
    return Boolean(tw?.pageWidgetNode) && document.querySelector(".tc-story-river") !== null;
  }, undefined, { polling: "raf", timeout: 120_000 });

  // (c) The edits, made in the page: each awaited by `th-page-refreshed`, then the next animation frame.
  const run = await page.evaluate(async (edits: number) => {
    const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
    await raf(); await raf(); // let the startup's queued change events refresh and paint inside the first-paint phase
    const w = window as unknown as Record<string, unknown>;
    const $tw = (w as unknown as { $tw: {
      wiki: { getTiddlerList(t: string): string[]; getTiddler(t: string): { fields: Record<string, unknown> } | undefined; addTiddler(t: unknown): void; filterTiddlers(f: string): string[] };
      hooks: { addHook(name: string, fn: () => void): void };
      Tiddler: new (...a: unknown[]) => unknown;
      perf: { enabled: boolean };
      version: string;
    } }).$tw;
    const storyList = $tw.wiki.getTiddlerList("$:/StoryList");
    const filterStory = $tw.wiki.filterTiddlers("[all[tiddlers]!is[system]sort[title]limit[12]]");
    const title = storyList[0]!;
    const storyTiddlersInDom = document.querySelectorAll(".tc-story-river > .tc-tiddler-frame").length;
    let pending: (() => void) | null = null;
    let hooked = 0;
    $tw.hooks.addHook("th-page-refreshed", () => { if (pending) { const r = pending; pending = null; hooked++; r(); } });
    w.__stockPhase = "edits";
    const editStart = performance.now();
    for (let i = 1; i <= edits; i++) {
      const tiddler = $tw.wiki.getTiddler(title)!;
      const refreshed = new Promise<void>((r) => { pending = r; });
      $tw.wiki.addTiddler(new $tw.Tiddler(tiddler, { text: `${String(tiddler.fields.text ?? "")}\n\nedit ${i}` }));
      await refreshed;
      await raf();
    }
    const editEnd = performance.now();
    await raf(); await raf();
    w.__stockPhase = "after";
    (w.__stockLoafFlush as (() => void) | undefined)?.();
    const finalText = String($tw.wiki.getTiddler(title)!.fields.text ?? "");
    return {
      tw5Version: $tw.version,
      perfEnabled: $tw.perf.enabled,
      tiddlers: $tw.wiki.filterTiddlers("[all[tiddlers]]").length,
      storyList,
      storyMatchesFilter: JSON.stringify(storyList) === JSON.stringify(filterStory),
      storyTiddlersInDom,
      title,
      lastEditLanded: finalText.endsWith(`\n\nedit ${edits}`),
      hooked,
      editStart,
      editRunMs: editEnd - editStart,
      lines: w.__stockLines as { name: string; ms: number; phase: string }[],
      loafSupported: Boolean(w.__stockLoafSupported),
      loaf: w.__stockLoaf as { startTime: number; duration: number; blockingDuration: number }[],
      measures: (w as unknown as { $tw: { perf: { measures: Record<string, { time: number; invocations: number }> } } }).$tw.perf.measures,
    };
  }, EDITS);
  const browserVersion = browser.version();
  await browser.close();

  const round = (n: number): number => Number(n.toFixed(2));
  const summarize = (ms: number[]): Record<string, number> => {
    if (!ms.length) return { count: 0 };
    const s = [...ms].sort((a, b) => a - b);
    const total = s.reduce((a, b) => a + b, 0);
    const rank = (p: number): number => s[Math.max(0, Math.ceil(p * s.length) - 1)]!; // nearest-rank percentile
    return { count: s.length, totalMs: round(total), avgMs: round(total / s.length), p50Ms: rank(0.5), p95Ms: rank(0.95), maxMs: s[s.length - 1]! };
  };
  const phaseReport = (phase: string): Record<string, unknown> =>
    Object.fromEntries(REPORTS.map((n) => [n, summarize(run.lines.filter((l) => l.phase === phase && l.name === n).map((l) => l.ms))]));
  const loafOf = (entries: typeof run.loaf): Record<string, number> => ({
    count: entries.length,
    totalDurationMs: round(entries.reduce((a, e) => a + e.duration, 0)),
    maxDurationMs: round(entries.reduce((a, e) => Math.max(a, e.duration), 0)),
    totalBlockingMs: round(entries.reduce((a, e) => a + e.blockingDuration, 0)),
  });
  const measures = Object.entries(run.measures);
  const top5 = measures.sort(([, a], [, b]) => b.time - a.time).slice(0, 5)
    .map(([name, m]) => ({ name, invocations: m.invocations, totalMs: round(m.time), avgMs: round(m.time / m.invocations) }));

  const row = {
    corpus: path.relative(REPO, CORPUS),
    carrierFiles: files,
    carrierTitles: byTitle.size,
    tiddlers: run.tiddlers,
    htmlBytes,
    tw5: run.tw5Version,
    browser: `chromium ${browserVersion}`,
    perfEnabled: run.perfEnabled,
    story: { count: run.storyList.length, matchesBakedList: JSON.stringify(run.storyList) === JSON.stringify(story), matchesFilter: run.storyMatchesFilter, framesInDom: run.storyTiddlersInDom },
    edits: EDITS,
    editTarget: run.title,
    editsHooked: run.hooked,
    lastEditLanded: run.lastEditLanded,
    editRunMs: round(run.editRunMs),
    firstPaint: phaseReport("firstPaint"),
    editRun: phaseReport("edits"),
    afterRun: run.lines.filter((l) => l.phase === "after").length,
    consoleCrossCheck: { pageTap: run.lines.length, playwright: Object.values(consoleSeen).reduce((a, b) => a + b, 0) },
    longAnimationFrames: run.loafSupported
      ? { supported: true, run: loafOf(run.loaf), firstPaint: loafOf(run.loaf.filter((e) => e.startTime < run.editStart)), editRun: loafOf(run.loaf.filter((e) => e.startTime >= run.editStart)) }
      : { supported: false },
    filters: { distinct: measures.length, invocations: measures.reduce((a, [, m]) => a + m.invocations, 0), totalMs: round(measures.reduce((a, [, m]) => a + m.time, 0)), top5 },
  };
  console.log(JSON.stringify(row));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(0);
