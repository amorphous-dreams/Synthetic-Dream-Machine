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
