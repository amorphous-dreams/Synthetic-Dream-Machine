#!/usr/bin/env node
// flush-bench — the per-verb flush instrument (road G8).
//
// A verb ends when its writes rest: the awaited `Repo.flush()` of the vessel's store. This bench times that
// boundary as a microbenchmark: a one-field change to a synthetic document in a `Repo` over the product's own
// store adapter (`DurableNodeFSStorageAdapter`, the crash-atomic adapter every vessel opens), with the whole
// carrier corpus resident as documents, and against a one-document store for contrast. It dispatches no
// product verb; it reads what the flush a verb awaits costs, and whether that cost follows the corpus.
//
//   node tools/flush-bench.mjs [--corpus <dir>] [--verbs <n>] [--json]
//
//   corpus   the carrier tree to load, one document per `*.mem` carrier (default: bags/lares/ha.ka.ba)
//   verbs    how many one-document verbs to time at the corpus store (default: every carrier); the one-document control times at most 100
//
// One flush sample is a one-field change to one document followed by `flush([thatDocument])`, the call a verb's
// dispatch awaits before it answers. The contrast reading flushes the whole repo (`flush()`) after one change,
// the call a verb would pay if it named no document.
//
// Run it from the lane's built tree (`pnpm build` first): it imports the built node package. The scratch store
// lives under the operating system's temp directory and is removed when the bench ends.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FLOOR = 400;   // the corpus is 443 carriers at the reading; a walk that finds fewer than this read nothing

/** Percentile of an ascending array by the nearest-rank rule. */
export function percentile(sorted, p) {
  if (sorted.length === 0) throw new RangeError("flush-bench: a percentile of no samples");
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

/** The reading a set of millisecond samples gives. Refuses an empty set: a zero count never reads as fast. */
export function summarize(samples) {
  if (!Array.isArray(samples) || samples.length === 0) throw new RangeError("flush-bench: no samples to summarize");
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    meanMs: total / sorted.length,
    totalMs: total,
  };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (name.endsWith(".mem")) out.push(path);
  }
  return out;
}

async function loadModules() {
  const nodeDir = join(ROOT, "packages/lararium-node");
  const need = createRequire(join(nodeDir, "package.json"));
  const repoMod = await import(pathToFileURL(need.resolve("@automerge/automerge-repo")).href);
  const adapter = await import(pathToFileURL(join(nodeDir, "dist/src/durable-storage-adapter.js")).href);
  return { Repo: repoMod.Repo, Durable: adapter.DurableNodeFSStorageAdapter };
}

async function measure({ Repo, Durable }, label, carriers, verbs) {
  const dir = mkdtempSync(join(tmpdir(), "flush-bench-"));
  try {
    const repo = new Repo({ storage: new Durable(dir) });
    const handles = carriers.map((text) => repo.create({ text, n: 0 }));
    const loadStart = performance.now();
    await repo.flush();
    const loadFlushMs = performance.now() - loadStart;
    // A store holding fewer documents than verbs asked cycles through them, so the control reads the same count of verbs.
    const picks = Array.from({ length: verbs }, (_, i) => handles[i % handles.length]);
    const perVerb = [];
    for (const handle of picks) {
      handle.change((d) => { d.n = (d.n ?? 0) + 1; });
      const t0 = performance.now();
      await repo.flush([handle.documentId]);
      perVerb.push(performance.now() - t0);
    }
    const wholeRepo = [];
    for (const handle of picks.slice(0, Math.min(20, picks.length))) {
      handle.change((d) => { d.n = (d.n ?? 0) + 1; });
      const t0 = performance.now();
      await repo.flush();
      wholeRepo.push(performance.now() - t0);
    }
    await repo.shutdown?.();
    return { label, documents: handles.length, loadFlushMs, perVerb: summarize(perVerb), wholeRepo: summarize(wholeRepo) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(argv) {
  const opt = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
  const corpus = resolve(opt("--corpus", join(ROOT, "bags/lares/ha.ka.ba")));
  const files = walk(corpus);
  if (files.length < FLOOR) {
    console.error(`flush-bench: ${corpus} holds ${files.length} carriers, under the floor of ${FLOOR}; refusing to read a corpus that is not there`);
    return 2;
  }
  const texts = files.map((f) => readFileSync(f, "utf8"));
  const verbs = Number(opt("--verbs", String(files.length)));
  const mods = await loadModules();
  const empty = await measure(mods, "one-document store (control)", [""], Math.min(100, verbs));
  const full = await measure(mods, `corpus resident (${files.length} carriers)`, texts, verbs);
  const reading = { corpus, carriers: files.length, instrument: "tools/flush-bench.mjs", node: process.version, empty, full };
  if (argv.includes("--json")) console.log(JSON.stringify(reading, null, 2));
  else {
    const fmt = (s) => `n=${s.n} p50=${s.p50.toFixed(2)}ms p95=${s.p95.toFixed(2)}ms p99=${s.p99.toFixed(2)}ms max=${s.max.toFixed(2)}ms`;
    for (const r of [empty, full]) {
      console.log(`${r.label}: ${r.documents} document(s), load flush ${r.loadFlushMs.toFixed(1)}ms`);
      console.log(`  per-verb flush([doc])  ${fmt(r.perVerb)}`);
      console.log(`  whole-repo flush()     ${fmt(r.wholeRepo)}`);
    }
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exit(await main(process.argv.slice(2)));
}
