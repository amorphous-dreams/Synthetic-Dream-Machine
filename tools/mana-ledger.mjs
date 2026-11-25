#!/usr/bin/env node
/**
 * Mana ledger: aggregate token burn from Claude Code session transcripts.
 *
 * Reads ~/.claude/projects/<project>/**\/*.jsonl READ-ONLY and sums the
 * per-request `usage` blocks by model and by hour. It reads counts only:
 * no message text, prompt, tool output or identity leaves this script.
 *
 * The plan's percent-used reaches no file a session can read; the operator's
 * own reading (a percent at a time) anchors it. Given anchor readings, the
 * script calibrates percent per weighted token and projects to the reset as
 * testimony. It annotates and paces; it never refuses a launch.
 */
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const USAGE = `usage: mana-ledger.mjs [--dir <transcripts-dir>] [--since <iso>] [--until <iso>]
  [--readings-file <jsonl>] [--reading <iso>=<percent>]... [--calibrate <iso>=<pct>..<iso>=<pct>]... [--reset <iso>] [--json]
  --dir      transcripts root (default ~/.claude/projects: the plan meter spans every project)
  --readings-file  the log tools/mana-statusline.mjs appends (default ~/.claude/mana-readings.jsonl, where lares home tend seats it; seven_day used_percentage + resets_at
             from Claude Code's statusline input); each window's first..last prices % per token
  --since    window start (default: the earliest --reading, else 24h ago)
  --reading  an operator reading of plan percent-used at a time; two or more calibrate %/token
  --calibrate a span with no reset inside it (e.g. last reset=0 .. limit hit=100); prices % per token
  --reset    the plan's next reset (prints a projection to it, as testimony)`;

/** Weights approximate relative plan cost per token class (cache reads bill light). */
export const WEIGHTS = { input: 1, cache_write: 1.25, cache_read: 0.1, output: 5 };

/** Statusline log lines -> readings and calibration spans (one span per reset window). */
export function loadReadings(text) {
  const readings = [], windows = new Map();
  for (const line of text.split('\n')) {
    let d; try { d = JSON.parse(line); } catch { continue; }
    const w = d?.seven_day, t = Date.parse(d?.t);
    if (!w || typeof w.used_percentage !== 'number' || Number.isNaN(t)) continue;
    const reset = typeof w.resets_at === 'number' && Number.isFinite(w.resets_at) ? w.resets_at * 1000 : undefined;
    const r = { t, pct: w.used_percentage, ...(reset !== undefined && { reset }) };
    readings.push(r);
    if (reset === undefined) continue;
    const g = windows.get(reset) ?? []; g.push(r); windows.set(reset, g);
  }
  const spans = [];
  for (const g of windows.values()) {
    g.sort((a, b) => a.t - b.t);
    const a = g[0], b = g[g.length - 1];
    if (b.t > a.t && b.pct > a.pct) spans.push([a, b]);
  }
  readings.sort((a, b) => a.t - b.t);
  return { readings, spans };
}

export function parseArgs(argv, home = homedir()) {
  const o = { readings: [], spans: [], json: false };
  const point = x => { const m = /^(.+)=(\d+(?:\.\d+)?)%?$/.exec(x); return m && !Number.isNaN(Date.parse(m[1])) ? { t: Date.parse(m[1]), pct: Number(m[2]) } : null; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw new Error(`${a} needs a value\n${USAGE}`); return x; };
    if (a === '--help') return { help: true };
    else if (a === '--dir') o.dir = v();
    else if (a === '--readings-file') o.readingsFile = v();
    else if (a === '--since') o.since = Date.parse(v());
    else if (a === '--until') o.until = Date.parse(v());
    else if (a === '--reset') o.reset = Date.parse(v());
    else if (a === '--json') o.json = true;
    else if (a === '--reading') {
      const r = point(v()); if (!r) throw new Error(`--reading takes <iso>=<percent>\n${USAGE}`);
      o.readings.push(r);
    } else if (a === '--calibrate') {
      const [x, y] = v().split('..').map(point);
      if (!x || !y || y.t <= x.t || y.pct <= x.pct) throw new Error(`--calibrate takes <iso>=<pct>..<iso>=<pct>, later and higher\n${USAGE}`);
      o.spans.push([x, y]);
    } else throw new Error(`unknown argument ${a}\n${USAGE}`);
  }
  for (const k of ['since', 'until', 'reset']) if (Number.isNaN(o[k])) throw new Error(`--${k} takes an ISO time\n${USAGE}`);
  o.readingsFile ??= join(home, '.claude', 'mana-readings.jsonl');
  if (existsSync(o.readingsFile)) {
    const f = loadReadings(readFileSync(o.readingsFile, 'utf8'));
    o.readings.push(...f.readings); o.spans.push(...f.spans);
    o.reset ??= f.readings.findLast(r => Number.isFinite(r.reset))?.reset;
  }
  o.readings.sort((x, y) => x.t - y.t);
  o.dir ??= join(home, '.claude', 'projects');
  return o;
}

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && e.name.endsWith('.jsonl')) yield p;
  }
}

/** One record per API request: streaming repeats the usage block once per content block. */
export function* usageRecords(lines) {
  for (const line of lines) {
    if (!line.includes('"usage"')) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    const m = d?.message, u = m?.usage;
    if (!u || typeof u !== 'object' || !d.timestamp) continue;
    const model = m.model;
    if (!model || model === '<synthetic>') continue;
    yield {
      key: m.id || d.requestId ? `${m.id ?? ''}|${d.requestId ?? ''}` : `h:${createHash('sha256').update(line).digest('hex')}`,
      t: Date.parse(d.timestamp), model, sidechain: d.isSidechain === true,
      input: u.input_tokens ?? 0, cache_write: u.cache_creation_input_tokens ?? 0,
      cache_read: u.cache_read_input_tokens ?? 0, output: u.output_tokens ?? 0,
    };
  }
}

/** A file's lines, read in chunks: a transcript of any size never loads whole. */
export function* fileLines(path) {
  const fd = openSync(path, 'r'), buf = Buffer.allocUnsafe(1 << 16), dec = new StringDecoder('utf8');
  let rest = '';
  try {
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0;) {
      const parts = (rest + dec.write(buf.subarray(0, n))).split('\n');
      rest = parts.pop();
      yield* parts;
    }
  } finally { closeSync(fd); }
  rest += dec.end();
  if (rest) yield rest;
}

export const weigh = r => Object.entries(WEIGHTS).reduce((s, [k, w]) => s + (r[k] ?? 0) * w, 0);

export function aggregate(records, { since = -Infinity, until = Infinity } = {}) {
  // Streaming grows a request's usage block: the LAST record per key stands.
  const latest = new Map();
  for (const r of records) latest.set(r.key, r);
  const seen = new Set(), byModel = {}, byHour = {};
  let first = Infinity, last = -Infinity;
  for (const r of latest.values()) {
    if (!(r.t >= since && r.t < until)) continue;
    seen.add(r.key);
    const row = byModel[r.model] ??= { requests: 0, sidechain_requests: 0, input: 0, cache_write: 0, cache_read: 0, output: 0, weighted: 0 };
    row.requests++; if (r.sidechain) row.sidechain_requests++;
    for (const k of Object.keys(WEIGHTS)) row[k] += r[k];
    const w = weigh(r); row.weighted += w;
    const h = new Date(r.t).toISOString().slice(0, 13) + ':00Z';
    byHour[h] = (byHour[h] ?? 0) + w;
    first = Math.min(first, r.t); last = Math.max(last, r.t);
  }
  const weighted = Object.values(byModel).reduce((s, r) => s + r.weighted, 0);
  return { byModel, byHour, weighted, first, last, requests: seen.size };
}

/** Velocity over the window; %/token from operator readings; projection to reset. Testimony only. */
export function project(agg, { since, until, readings = [], spans = [], reset, weightedBetween }) {
  const end = Number.isFinite(until) ? until : agg.last;
  const hours = Math.max((end - since) / 3.6e6, 1 / 60);
  const out = { window_hours: hours, weighted_per_hour: agg.weighted / hours };
  if (!spans.length && readings.length >= 2) spans = [[readings[0], readings[readings.length - 1]]];
  let dp = 0, dw = 0;
  for (const [a, b] of spans) if (b.pct > a.pct) { dp += b.pct - a.pct; dw += weightedBetween(a.t, b.t); }
  if (dw > 0) out.pct_per_mweighted = dp / (dw / 1e6);
  if (readings.length) {
    const a = readings[readings.length - 1];
    out.anchor = a;
    if (out.pct_per_mweighted) {
      const since_anchor = weightedBetween(a.t, end);
      out.pct_now = a.pct + since_anchor / 1e6 * out.pct_per_mweighted;
      out.pct_per_hour = out.weighted_per_hour / 1e6 * out.pct_per_mweighted;
      if (Number.isFinite(reset)) {
        const left = Math.max((reset - end) / 3.6e6, 0);
        out.hours_to_reset = left;
        out.pct_at_reset = out.pct_now + left * out.pct_per_hour;
        out.hours_to_100 = out.pct_per_hour > 0 ? (100 - out.pct_now) / out.pct_per_hour : Infinity;
      }
    }
  }
  return out;
}

const fmt = n => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n));

export function render(agg, proj, o) {
  const L = [`window ${new Date(o.since).toISOString()} -> ${new Date(o.until ?? agg.last).toISOString()} (${proj.window_hours.toFixed(1)} h), ${agg.requests} requests`];
  L.push('model | requests (sidechain) | input | cache-write | cache-read | output | weighted');
  for (const [m, r] of Object.entries(agg.byModel).sort((a, b) => b[1].weighted - a[1].weighted))
    L.push(`${m} | ${r.requests} (${r.sidechain_requests}) | ${fmt(r.input)} | ${fmt(r.cache_write)} | ${fmt(r.cache_read)} | ${fmt(r.output)} | ${fmt(r.weighted)}`);
  L.push(`velocity: ${fmt(proj.weighted_per_hour)} weighted tokens/h (weights ${JSON.stringify(WEIGHTS)})`);
  if (proj.anchor) L.push(`anchor: ${proj.anchor.pct}% at ${new Date(proj.anchor.t).toISOString()} (operator reading)`);
  if (proj.pct_per_mweighted) {
    L.push(`calibration: ${proj.pct_per_mweighted.toFixed(3)}% per M weighted -> est now ${proj.pct_now.toFixed(1)}%, ${proj.pct_per_hour.toFixed(2)}%/h`);
    if (proj.pct_at_reset !== undefined) L.push(`projection (testimony): ${proj.pct_at_reset.toFixed(0)}% at reset in ${proj.hours_to_reset.toFixed(1)} h; 100% in ${proj.hours_to_100.toFixed(1)} h at this pace`);
  } else if (proj.anchor) L.push('calibration: needs a second operator reading after burn, or a --calibrate span, to price % per token');
  return L.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const o = parseArgs(argv);
  if (o.help) { console.log(USAGE); return 0; }
  const now = Date.now();
  o.since ??= o.readings[0]?.t ?? now - 24 * 3.6e6;
  const from = Math.min(o.since, o.readings[0]?.t ?? o.since, ...o.spans.map(([a]) => a.t));
  const records = [];
  for (const p of walk(o.dir)) {
    if (statSync(p).mtimeMs < from) continue;
    for (const r of usageRecords(fileLines(p))) records.push(r);
  }
  const agg = aggregate(records, { since: o.since, until: o.until ?? Infinity });
  const between = (a, b) => aggregate(records, { since: a, until: b }).weighted;
  const proj = project(agg, { since: o.since, until: o.until ?? now, readings: o.readings, spans: o.spans, reset: o.reset, weightedBetween: between });
  console.log(o.json ? JSON.stringify({ ...agg, projection: proj }, null, 1) : render(agg, proj, { ...o, until: o.until ?? now }));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (e) { console.error(e.message); process.exitCode = 2; }
}
