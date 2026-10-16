/**
 * frame-baseline — the numbers the DreamDOM train measures before it reaches for a finer grain.
 *
 * Boots the engine a founded vessel runs (the genesis CAS: core, boot shadows, grammar), ingests the house's own
 * carriers under `bags/lares` as the reference corpus, mounts the story-river projection over the fake
 * document, and records: the boot, the corpus ingest, the first frame's HTML and CSS bytes, the per-edit frame
 * bytes and the camera's render and refresh times across a run of edits, and the render-id census at the end.
 *
 * The timings name the house's own camera (`cameraRender`, `cameraRefresh`, `styleRefresh`), measured around
 * the same calls TW5's `render.js` wraps in a browser (`mainRender`, `mainRefresh`, `styleRefresh`): the island
 * never runs `render.js`, so the camera carries the measure. TW5's own `$tw.perf` stays off: its `utils.timer`
 * reads `window.performance` wherever `$tw.node` stands null, and the island holds no window.
 *
 * Usage:  pnpm --filter @lararium/tw5 measure:frames [edits=100]
 * Prints one JSON row; boots nothing in the tracked tree and writes nothing.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pluginCidsFromIslandBlobs } from "@lararium/mesh";
import { TW5Engine } from "../src/tw5-vm.js";
import { preloadsFromCasBlob } from "../src/cas-preloads.js";
import { mountProjection, renderIdCensus } from "../src/tw5-projection.js";
import type { IslandContext } from "../src/island-context.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const GENESIS = path.join(REPO, "genesis");
const CORPUS = path.join(REPO, "bags", "lares");
const EDITS = Number(process.argv[2] ?? 100);

interface Seed { blobs: Record<string, { id: string; sha256: string; mimeType: string }> }
const seed = JSON.parse(readFileSync(path.join(GENESIS, "seed.json"), "utf8")) as Seed;
const cas = (sha: string): Uint8Array => new Uint8Array(readFileSync(path.join(GENESIS, "cas", sha)));
const core = Object.values(seed.blobs).find((b) => b.id === "tiddlywikicore")!;
const preloads = pluginCidsFromIslandBlobs(seed.blobs).flatMap((cid) => preloadsFromCasBlob(cas(cid)));

function* carriers(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* carriers(full);
    else if (entry.endsWith(".mem")) yield full;
  }
}
const titleOf = (text: string): string | null => /^title\s*=\s*"(lar:\/\/\/[^"]+)"/m.exec(text)?.[1] ?? null;

const row: Record<string, unknown> = { corpus: path.relative(REPO, CORPUS), edits: EDITS };
const t0 = performance.now();
const engine = new TW5Engine();
await engine.boot({ bytes: cas(core.sha256), sha256: core.sha256 }, preloads);
row["bootMs"] = Math.round(performance.now() - t0);

const t1 = performance.now();
let ingested = 0, records = 0;
for (const file of carriers(CORPUS)) {
  const text = readFileSync(file, "utf8");
  const title = titleOf(text);
  if (!title) continue;
  try { records += engine.ingestCarrier(title, text).length; ingested++; } catch { /* a carrier the reader refuses stays out of the corpus */ }
}
row["ingestMs"] = Math.round(performance.now() - t1);
row["carriers"] = ingested;
row["records"] = records;
row["tiddlers"] = engine.wiki.filterTiddlers("[all[tiddlers]]").length;

// Open a story over the corpus's first carriers, as a person would.
const story = engine.wiki.filterTiddlers("[all[tiddlers]!is[system]sort[title]limit[12]]");
engine.setTiddler({ title: "$:/StoryList", list: story });

const tw = engine.$tw as unknown as { wiki: { makeTranscludeWidget: (...a: unknown[]) => { render: (...a: unknown[]) => void; refresh: (...a: unknown[]) => void } } };
const origMake = tw.wiki.makeTranscludeWidget.bind(tw.wiki);
const measures: Record<string, { time: number; invocations: number }> = {};
const measure = (name: string, fn: () => void): void => {
  const s = performance.now(); fn();
  const m = measures[name] ??= { time: 0, invocations: 0 };
  m.time += performance.now() - s; m.invocations++;
};
// Wrap every root widget the projection makes (the story camera and the stylesheet camera), timing render and refresh.
tw.wiki.makeTranscludeWidget = (title: unknown, ...rest: unknown[]) => {
  const widget = origMake(title, ...rest);
  const tag = title === "$:/core/ui/PageStylesheet" ? "styleRefresh" : "cameraRefresh";
  const render = widget.render.bind(widget), refresh = widget.refresh.bind(widget);
  widget.render = (...a: unknown[]) => measure(title === "$:/core/ui/PageStylesheet" ? "styleRender" : "cameraRender", () => render(...a));
  widget.refresh = (...a: unknown[]) => measure(tag, () => refresh(...a));
  return widget;
};

const frames: { html: number; css: number; rev: number }[] = [];
const stop = mountProjection({
  wikiUri: "lar:///baseline/wiki",
  tw5: engine,
  post: (msg) => {
    if (msg.listenable !== "projection:frame") return;
    const p = msg.payload as { html: string; css: string; rev: number };
    frames.push({ html: Buffer.byteLength(p.html), css: Buffer.byteLength(p.css), rev: p.rev });
  },
} as IslandContext);
const nextFrame = (): Promise<void> => new Promise((resolve, reject) => {
  const n = frames.length; const started = performance.now();
  const tick = (): void => {
    if (frames.length > n) resolve();
    else if (performance.now() - started > 10_000) reject(new Error("frame-baseline: no frame within 10 s"));
    else setTimeout(tick, 2);
  };
  tick();
});
await nextFrame();
row["firstFrame"] = { htmlBytes: frames[0]!.html, cssBytes: frames[0]!.css };

const target = story[0]!;
const t2 = performance.now();
for (let i = 1; i <= EDITS; i++) {
  const fields = engine.wiki.getTiddler(target)!.fields as Record<string, unknown>;
  engine.setTiddler({ ...(fields as Record<string, string | string[]>), text: `${String(fields["text"] ?? "")}\n\nedit ${i}` } as Record<string, string | string[]>);
  await nextFrame();
}
row["editRunMs"] = Math.round(performance.now() - t2);
const editFrames = frames.slice(1);
row["framesPerEdit"] = editFrames.length / EDITS;
row["frameBytesPerEdit"] = { html: Math.round(editFrames.reduce((a, f) => a + f.html, 0) / editFrames.length), css: Math.round(editFrames.reduce((a, f) => a + f.css, 0) / editFrames.length) };
row["camera"] = Object.fromEntries(Object.entries(measures).map(([k, v]) => [k, { invocations: v.invocations, avgMs: Number((v.time / v.invocations).toFixed(2)), totalMs: Math.round(v.time) }]));
row["renderIdCensus"] = renderIdCensus();
stop();
console.log(JSON.stringify(row, null, 2));
process.exit(0);
