// floor-run — one metered heavy run inside the floor lock: bytes decide the stop, the receipt lands in the ledger (or mirror).
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { meteredRun, parseArgs, stopVerdict, verdictOf, DEFAULT_BUDGET_GB, STOPPED_EXIT } from './floor-run.mjs';

const TOOL = fileURLToPath(new URL('./floor-run.mjs', import.meta.url));
const G = 1024 ** 3;
const scratchEnv = () => { const d = mkdtempSync(join(tmpdir(), 'floor-run-')); return { d, env: { ...process.env, LARES_BATTERY_LOCK: join(d, 'lock'), LARES_BIN: '/nonexistent/lares' } }; };

test('RED: the stop verdict reads bytes alone: past the budget, under the floor, or run on; no C: never stops', () => {
  const b = { budgetBytes: 4 * G, floorBytes: 35 * G };
  assert.equal(stopVerdict({ free0: 90 * G, freeNow: 87 * G, ...b }), null);
  assert.equal(stopVerdict({ free0: 90 * G, freeNow: 85.9 * G, ...b }), 'budget');
  assert.equal(stopVerdict({ free0: 38 * G, freeNow: 34.9 * G, ...b }), 'floor');
  assert.equal(stopVerdict({ free0: null, freeNow: null, ...b }), null);
});

test('RED: parseArgs takes the command after --, the 4G default budget, and refuses a bad budget or a missing command', () => {
  const o = parseArgs(['--ticket', 'a@1234567', '--', 'pnpm', 'build']);
  assert.deepEqual(o.command, ['pnpm', 'build']);
  assert.equal(o.ticket, 'a@1234567');
  assert.equal(o.budgetGb, DEFAULT_BUDGET_GB);
  assert.equal(DEFAULT_BUDGET_GB, 4);
  assert.throws(() => parseArgs(['pnpm', 'build']), /after --/);
  assert.throws(() => parseArgs(['--budget-gb', '0', '--', 'x']), /positive/);
});

test('RED: a run whose C: readings fall past the budget stops its whole group and reads STOPPED', async () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-run-grp-'));
  const grandchild = join(d, 'grandchild-survived');
  // The first reading takes the baseline; every later reading has dropped 5G. The pace runs fast here: it paces, never decides.
  let reads = 0;
  const readFree = () => (reads++ === 0 ? 90 * G : 85 * G);
  const r = await meteredRun(['bash', '-c', `(sleep 30; touch ${grandchild}) & wait`], { budgetBytes: 4 * G, floorBytes: 35 * G, readFree, pace: 20, grace: 200, say: () => {} });
  assert.equal(r.stopped, 'budget');
  assert.equal(verdictOf(r), 'STOPPED');
  assert.equal(r.cDropBytes, 5 * G);
  assert.ok(!existsSync(grandchild), 'the stop reached the whole process group');
});

test('RED: a green run reports its code; a red one reads RED', async () => {
  const quiet = { budgetBytes: 4 * G, floorBytes: 35 * G, readFree: () => null, say: () => {} };
  const green = await meteredRun(['true'], quiet);
  assert.equal(verdictOf(green), 'GREEN');
  const red = await meteredRun(['bash', '-c', 'exit 3'], quiet);
  assert.equal(red.code, 3);
  assert.equal(verdictOf(red), 'RED');
});

test('RED: the CLI re-enters the lock, runs, and receipts TAKE then DONE in the mirror while the doors stand dark', () => {
  const { d, env } = scratchEnv();
  const r = spawnSync(process.execPath, [TOOL, '--ticket', 'lane-a@abcdef012', '--holder', 'test-familiar', '--', 'bash', '-c', 'echo inside; exit 0'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /inside/);
  assert.match(r.stderr, /battery: holding the box/);
  assert.match(r.stderr, /floor: GREEN wrote=/);
  const log = readFileSync(join(d, '.floor', 'queue.log'), 'utf8').trim().split('\n');
  assert.match(log[0], /^TAKE lane-a@abcdef012 test-familiar c-free=/);
  assert.match(log[1], /^DONE lane-a@abcdef012 GREEN wrote=\S+ c-drop=\S+ · exit 0 · bash -c echo inside; exit 0$/);
});

test('RED: the CLI passes the command code through, refuses usage with 2, and exits 64 where the lock cannot open', () => {
  const { d, env } = scratchEnv();
  assert.equal(spawnSync(process.execPath, [TOOL, '--', 'bash', '-c', 'exit 5'], { env }).status, 5);
  assert.equal(spawnSync(process.execPath, [TOOL, 'pnpm', 'build'], { env }).status, 2);
  const walled = spawnSync(process.execPath, [TOOL, '--', 'touch', join(d, 'ran')], { env: { ...env, LARES_BATTERY_LOCK: join(d, 'no-such-dir', 'lock') } });
  assert.equal(walled.status, 64);
  assert.ok(!existsSync(join(d, 'ran')), 'the command ran unlocked');
  assert.equal(STOPPED_EXIT, 65);
});
