import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregate, fileLines, loadReadings, parseArgs, project, usageRecords, weigh } from './mana-ledger.mjs';
import { reading, tee } from './mana-statusline.mjs';

const line = (id, ts, model, u, extra = {}) => JSON.stringify({
  type: 'assistant', requestId: `r${id}`, timestamp: ts, isSidechain: false, ...extra,
  message: { id: `m${id}`, model, role: 'assistant', content: [{ type: 'text', text: 'SECRET PROSE' }], usage: u },
});
const U = { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 20 };

test('streaming repeats count once per request; synthetic and usage-less lines drop', () => {
  const lines = [
    line(1, '2026-11-24T10:00:00Z', 'claude-opus-5-5', U),
    line(1, '2026-11-24T10:00:01Z', 'claude-opus-5-5', U),
    line(2, '2026-11-24T10:30:00Z', 'claude-sonnet-5-5', U, { isSidechain: true }),
    line(3, '2026-11-24T10:40:00Z', '<synthetic>', U),
    JSON.stringify({ type: 'user', timestamp: '2026-11-24T10:00:00Z', message: { content: 'hi' } }),
    'not json',
  ];
  const agg = aggregate([...usageRecords(lines)]);
  assert.equal(agg.requests, 2);
  assert.equal(agg.byModel['claude-opus-5-5'].requests, 1);
  assert.equal(agg.byModel['claude-sonnet-5-5'].sidechain_requests, 1);
  assert.equal(agg.byModel['claude-opus-5-5'].cache_read, 1000);
  assert.equal(agg.weighted, 2 * weigh({ input: 10, cache_write: 100, cache_read: 1000, output: 20 }));
  assert.ok(!JSON.stringify(agg).includes('SECRET'), 'no message text leaves the aggregate');
});

test('window bounds and the calibration span price percent per token', () => {
  const recs = [...usageRecords([
    line(1, '2026-11-24T00:00:00Z', 'm', { output_tokens: 200000 }),
    line(2, '2026-11-24T10:00:00Z', 'm', { output_tokens: 200000 }),
  ])];
  const between = (a, b) => aggregate(recs, { since: a, until: b }).weighted;
  const since = Date.parse('2026-11-24T05:00:00Z'), until = Date.parse('2026-11-24T15:00:00Z');
  const agg = aggregate(recs, { since, until });
  assert.equal(agg.weighted, 1e6);
  const p = project(agg, {
    since, until, weightedBetween: between,
    spans: [[{ t: Date.parse('2026-11-23T23:00:00Z'), pct: 0 }, { t: Date.parse('2026-11-24T11:00:00Z'), pct: 20 }]],
    readings: [{ t: Date.parse('2026-11-24T12:00:00Z'), pct: 4 }],
    reset: Date.parse('2026-11-24T23:00:00Z'),
  });
  assert.equal(p.pct_per_mweighted, 10);
  assert.equal(p.pct_now, 4);
  assert.equal(p.weighted_per_hour, 1e5);
  assert.equal(p.pct_per_hour, 1);
  assert.equal(p.pct_at_reset, 12);
});

test('one reading and no span names the missing calibration instead of a number', () => {
  const p = project({ weighted: 5, last: 0 }, { since: 0, until: 3.6e6, readings: [{ t: 0, pct: 4 }], weightedBetween: () => 5 });
  assert.equal(p.pct_per_mweighted, undefined);
  assert.equal(p.pct_at_reset, undefined);
});

test('statusline tee logs only plan percents and only on change; ledger reads it back', () => {
  const log = join(mkdtempSync(join(tmpdir(), 'mana-')), 'r.jsonl');
  const reset = Date.parse('2026-11-26T12:00:00Z') / 1000;
  const input = p => JSON.stringify({ model: { id: 'x' }, cwd: '/secret', rate_limits: { seven_day: { used_percentage: p, resets_at: reset }, five_hour: { used_percentage: 1, resets_at: reset } } });
  assert.equal(tee(input(4), log, new Date('2026-11-25T04:00:00Z')), '7d:4% 5h:1%');
  tee(input(4), log, new Date('2026-11-25T04:01:00Z'));
  tee(input(9), log, new Date('2026-11-25T08:00:00Z'));
  const text = readFileSync(log, 'utf8');
  assert.equal(text.trim().split('\n').length, 2);
  assert.ok(!text.includes('secret'));
  const { readings, spans } = loadReadings(text);
  assert.equal(readings.length, 2);
  assert.deepEqual(spans.map(([a, b]) => [a.pct, b.pct]), [[4, 9]]);
  assert.equal(parseArgs(['--readings-file', log]).reset, reset * 1000);
  assert.equal(reading({ model: {} }), null);
  assert.equal(tee('not json', log), '');
});

test('arguments refuse with the usage line', () => {
  assert.throws(() => parseArgs(['--calibrate', '2026-11-25T00:00Z=5..2026-11-24T00:00Z=9']), /later and higher/);
  assert.throws(() => parseArgs(['--reading', 'nope']), /usage/);
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
});

test('the readings log defaults to the claude home\'s mana-readings.jsonl, and an explicit file wins', () => {
  const home = mkdtempSync(join(tmpdir(), 'mana-home-'));
  mkdirSync(join(home, '.claude'));
  const log = join(home, '.claude', 'mana-readings.jsonl');
  writeFileSync(log, JSON.stringify({ t: '2026-11-24T10:00:00Z', seven_day: { used_percentage: 40, resets_at: 1790000000 } }) + '\n');
  const o = parseArgs([], home);
  assert.equal(o.readingsFile, log);
  assert.equal(o.readings.length, 1);
  const none = parseArgs([], mkdtempSync(join(tmpdir(), 'mana-bare-')));
  assert.equal(none.readings.length, 0);
});

test('a request keeps its LAST streamed usage block, and id-less records key on their own content', () => {
  const a = line(1, '2026-11-24T10:00:00Z', 'm', { output_tokens: 5 });
  const b = line(1, '2026-11-24T10:00:01Z', 'm', { output_tokens: 50 });
  assert.equal(aggregate([...usageRecords([a, b])]).byModel.m.output, 50);
  const bare = (ts, out) => JSON.stringify({ type: 'assistant', timestamp: ts, message: { model: 'm', usage: { output_tokens: out } } });
  const agg = aggregate([...usageRecords([bare('2026-11-24T10:00:00Z', 7), bare('2026-11-24T10:00:02Z', 9), bare('2026-11-24T10:00:02Z', 9)])]);
  assert.equal(agg.requests, 2, 'two distinct id-less records stand; the byte-identical repeat collapses');
});

test('a reading with no resets_at never wins the reset', () => {
  const f = loadReadings([
    JSON.stringify({ t: '2026-11-24T10:00:00Z', seven_day: { used_percentage: 10, resets_at: 1790000000 } }),
    JSON.stringify({ t: '2026-11-24T11:00:00Z', seven_day: { used_percentage: 12 } }),
  ].join('\n'));
  assert.equal(f.readings.length, 2);
  assert.ok(f.readings.every(r => r.reset === undefined || Number.isFinite(r.reset)));
  assert.equal(f.readings.filter(r => Number.isFinite(r.reset)).at(-1).reset, 1790000000000);
});

test('fileLines streams a file line by line, across chunk edges', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mana-lines-'));
  const text = Array.from({ length: 5000 }, (_, i) => `line-${i}-${'x'.repeat(i % 40)}`).join('\n');
  writeFileSync(join(dir, 'a.jsonl'), text);
  assert.deepEqual([...fileLines(join(dir, 'a.jsonl'))], text.split('\n'));
});

// THE GREY FAILURE (2026-11-26): a burn spike just before the weekly reset, read through a window that crossed the reset,
// inflated this week's velocity, and the projection raised an alarm the true readings did not hold.
const H = 3.6e6, RESET_PREV = Date.parse('2026-11-26T12:00:00Z'), RESET_NEXT = RESET_PREV + 7 * 24 * H;
const at = (iso) => Date.parse(iso);
const rd = (iso, pct, reset) => ({ t: at(iso), pct, reset, src: 'statusline' });

test('RED: the pace never crosses a reset; a pre-reset spike leaves this week\'s projection alone', () => {
  const recs = [...usageRecords([
    line(1, '2026-11-26T10:00:00Z', 'm', { output_tokens: 4_000_000 }), // the spike, last week
    line(2, '2026-11-26T14:00:00Z', 'm', { output_tokens: 100_000 }),
    line(3, '2026-11-26T20:00:00Z', 'm', { output_tokens: 100_000 }),
  ])];
  const readings = [
    rd('2026-11-26T11:59:00Z', 62, RESET_PREV),
    rd('2026-11-26T12:00:00Z', 1, RESET_NEXT),
    rd('2026-11-26T16:00:00Z', 3, RESET_NEXT),
    rd('2026-11-26T20:00:00Z', 5, RESET_NEXT),
  ];
  const end = at('2026-11-26T20:00:00Z');
  const between = (a, b) => aggregate(recs, { since: a, until: b }).weighted;
  const proj = project(aggregate(recs, { since: RESET_PREV, until: end }), { since: RESET_PREV, until: end, readings, spans: [], reset: RESET_NEXT, weightedBetween: between });
  assert.equal(proj.window.reset, RESET_NEXT);
  assert.equal(proj.pct_now, 5);
  assert.equal(proj.level_source, 'reading');
  assert.match(proj.pace_source, /^readings/);
  assert.ok(Math.abs(proj.pct_per_hour - 0.5) < 1e-9, `pace reads 0.5%/h off this week's readings, got ${proj.pct_per_hour}`);
  assert.ok(proj.hours_to_100 > 150, 'no false alarm');
  assert.ok(proj.burn.slow < 1, 'under even spend');
});

test('a burst at the window\'s opening weighs the slow slope; the projection rides the fast one', () => {
  const readings = [
    rd('2026-11-26T12:01:00Z', 1, RESET_NEXT), rd('2026-11-26T12:18:00Z', 6, RESET_NEXT),
    rd('2026-11-26T19:00:00Z', 8, RESET_NEXT), rd('2026-11-26T22:00:00Z', 9, RESET_NEXT),
  ];
  const end = at('2026-11-26T22:00:00Z');
  const proj = project({ weighted: 0, last: end }, { since: RESET_PREV, until: end, readings, spans: [], reset: RESET_NEXT, weightedBetween: () => 0 });
  assert.ok(proj.burn.slow > proj.burn.fast, 'the opening burst lifts the slow slope above the fast one');
  assert.equal(proj.pace_source, 'readings (fast window)');
  assert.ok(Math.abs(proj.pct_per_hour - 1 / 3) < 1e-9);
});

test('staggered readings from parallel sessions read as the running maximum', () => {
  const readings = [
    rd('2026-11-26T18:00:00Z', 10, RESET_NEXT), rd('2026-11-26T18:30:00Z', 9, RESET_NEXT),
    rd('2026-11-26T19:00:00Z', 10, RESET_NEXT), rd('2026-11-26T20:00:00Z', 9, RESET_NEXT),
  ];
  const end = at('2026-11-26T20:00:00Z');
  const proj = project({ weighted: 0, last: end }, { since: RESET_PREV, until: end, readings, spans: [], reset: RESET_NEXT, weightedBetween: () => 0 });
  assert.equal(proj.pct_now, 10);
  assert.equal(proj.pct_per_hour, 0);
});

test('the anchor names its source', () => {
  const { readings } = loadReadings(JSON.stringify({ t: '2026-11-26T20:00:00Z', seven_day: { used_percentage: 5, resets_at: RESET_NEXT / 1000 } }));
  assert.equal(readings[0].src, 'statusline');
  assert.equal(parseArgs(['--reading', '2026-11-26T20:00:00Z=5']).readings.find(r => r.src === 'operator')?.pct, 5);
});
