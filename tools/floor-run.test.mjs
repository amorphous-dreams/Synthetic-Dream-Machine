// floor-run — one metered heavy run inside the floor lock: bytes decide the stop, the receipt lands in the ledger (or mirror).
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { admits, awaitAdmission, meteredRun, othersOf, parseArgs, remainingOf, reserve, stopVerdict, verdictOf, DEFAULT_BUDGET_GB, STOPPED_EXIT } from './floor-run.mjs';
import { writeFileSync } from 'node:fs';

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
  assert.match(r.stderr, /floor: GREEN slot=1 wrote=/);
  const log = readFileSync(join(d, '.floor', 'queue.log'), 'utf8').trim().split('\n');
  assert.match(log[0], /^TAKE lane-a@abcdef012 test-familiar c-free=\S+ slot=1$/);
  assert.match(log[1], /^DONE lane-a@abcdef012 GREEN wrote=\S+ c-drop=\S+ slot=1 · exit 0 · bash -c echo inside; exit 0$/);
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

// THE SHARED BYTE FLOOR (operator, 2026-11-25). RED-FIRST: written by floor-wright#1, run by the familiar.
test('RED: a lone run always admits; a second run admits only where C: less both budgets holds the 35G floor', () => {
  const b = { floorBytes: 35 * G, budgetBytes: 4 * G };
  assert.equal(admits({ freeNow: 36 * G, ...b, others: [] }), true);
  const other = { free0: 50 * G, budgetBytes: 4 * G };
  assert.equal(admits({ freeNow: 44 * G, ...b, others: [other] }), true);   // 44 - 4 - 4 = 36
  assert.equal(admits({ freeNow: 42 * G, ...b, others: [other] }), false);  // 42 - 4 - 4 = 34, past the floor
  assert.equal(admits({ freeNow: null, ...b, others: [other] }), true);     // no C: here: unmetered
});

test('RED: the other run counts only its unspent budget: bytes it already wrote sit in the free reading', () => {
  const other = { free0: 50 * G, budgetBytes: 4 * G };
  assert.equal(remainingOf(other, 48 * G), 2 * G);
  assert.equal(remainingOf(other, 40 * G), 0);
  assert.equal(admits({ freeNow: 43 * G, floorBytes: 35 * G, budgetBytes: 4 * G, others: [{ ...other, free0: 47 * G }] }), true); // spent 4G, remaining 0: 43 - 4 >= 35
});

test('RED: othersOf reads live reservations of other slots; a gone pid and its own slot read as none', () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-slots-'));
  writeFileSync(join(d, 'slot-1.run'), JSON.stringify({ pid: 111, free0: 50 * G, budgetBytes: 4 * G }));
  writeFileSync(join(d, 'slot-2.run'), JSON.stringify({ pid: 222, free0: 50 * G, budgetBytes: 3 * G }));
  const alive = (pid) => pid === 111;
  assert.deepEqual(othersOf(d, 2, alive).map((o) => o.slot), [1]);
  assert.deepEqual(othersOf(d, 1, alive), []);   // slot 2's pid is gone, slot 1 is its own
  assert.deepEqual(othersOf(join(d, 'absent'), 1, alive), []);
});

test('RED: reserve writes this slot once and a nested take under a live holder leaves the ancestor\'s reservation standing', () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-resv-'));
  const release = reserve(d, 1, { pid: process.pid, free0: 1, budgetBytes: 2 });
  assert.ok(existsSync(join(d, 'slot-1.run')));
  const nested = reserve(d, 1, { pid: process.pid + 1, free0: 9, budgetBytes: 9 });
  nested();
  assert.ok(existsSync(join(d, 'slot-1.run')), 'the nested release never removes the ancestor\'s reservation');
  assert.equal(JSON.parse(readFileSync(join(d, 'slot-1.run'), 'utf8')).free0, 1);
  release();
  assert.ok(!existsSync(join(d, 'slot-1.run')));
});

test('RED: the second run waits until bytes admit it: the first reading refuses, a later reading past the freed bytes admits', async () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-wait-'));
  writeFileSync(join(d, 'slot-1.run'), JSON.stringify({ pid: process.pid, free0: 50 * G, budgetBytes: 4 * G }));
  const reads = [42 * G, 42 * G, 44 * G]; // the third reading carries C: back up (the first run freed bytes)
  const said = [];
  await awaitAdmission({ floorDir: d, slot: 2, floorBytes: 35 * G, budgetBytes: 4 * G, readFree: () => reads.shift() ?? 44 * G, pace: 1, say: (s) => said.push(s) });
  assert.equal(reads.length, 0, 'it read until the bytes admitted');
  assert.equal(said.length, 1);
  assert.match(said[0], /slot 2 waits/);
});

test('RED: two floor-runs fly at once on two slots; the third waits for one', async () => {
  const { spawn } = await import('node:child_process');
  const { d, env } = scratchEnv();
  const rel = join(d, 'rel'), a = join(d, 'a'), b = join(d, 'b'), c = join(d, 'c');
  const hold = (mark) => ['--budget-gb', '0.001', '--', 'bash', '-c', `touch ${mark}; while [ ! -e ${rel} ]; do :; done`];
  const until = async (p) => { for (let i = 0; i < 4000 && !existsSync(p); i++) await new Promise((r) => setTimeout(r, 5)); assert.ok(existsSync(p), `no handshake at ${p}`); };
  const exited = (ch) => new Promise((res) => ch.on('exit', (code) => res(code)));
  const kids = [];
  const fly = (args) => { const k = spawn(process.execPath, args, { env, stdio: 'ignore', detached: true }); kids.push(k); return k; };
  try {
  const one = fly([TOOL, ...hold(a)]);
  await until(a);
  const two = fly([TOOL, ...hold(b)]);
  await until(b);
  const three = fly([TOOL, '--budget-gb', '0.001', '--', 'touch', c]);
  for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r));
  assert.ok(!existsSync(c), 'the third ran while both slots stood held');
  writeFileSync(rel, '');
  assert.equal(await exited(one), 0); assert.equal(await exited(two), 0); assert.equal(await exited(three), 0);
  assert.ok(existsSync(c));
  } finally { writeFileSync(rel, ''); for (const k of kids) { try { process.kill(-k.pid, 'SIGKILL'); } catch { /* gone */ } } }
});
