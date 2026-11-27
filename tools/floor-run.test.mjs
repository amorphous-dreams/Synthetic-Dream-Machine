// floor-run — one metered heavy run admitted by headroom: bytes decide the stop, the receipt lands in the ledger (or mirror).
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { admits, awaitAdmission, benchCommand, coresOf, headroom, meteredRun, othersOf, parseArgs, remainingOf, removeBench, reserve, stopVerdict, sweepGone, verdictOf, BENCH_GB, DEFAULT_BUDGET_GB, STOPPED_EXIT } from './floor-run.mjs';
import { writeFileSync } from 'node:fs';
import { exited, floorEnv } from './floor-test-kit.mjs';

const TOOL = fileURLToPath(new URL('./floor-run.mjs', import.meta.url));
const G = 1024 ** 3;
const scratchEnv = () => { const d = mkdtempSync(join(tmpdir(), 'floor-run-')); return { d, env: floorEnv(join(d, 'lock'), { LARES_BIN: '/nonexistent/lares' }) }; };

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

test('RED: the CLI re-enters the door, runs, and receipts TAKE then DONE in the mirror, keyed by the run, while the doors stand dark', () => {
  const { d, env } = scratchEnv();
  const r = spawnSync(process.execPath, [TOOL, '--ticket', 'lane-a@abcdef012', '--holder', 'test-familiar', '--', 'bash', '-c', 'echo inside; exit 0'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /inside/);
  const key = /battery: holding the box, run (\d+)/.exec(r.stderr)?.[1];
  assert.ok(key, r.stderr);
  assert.match(r.stderr, new RegExp(`floor: GREEN run=${key} wrote=`));
  const log = readFileSync(join(d, '.floor', 'queue.log'), 'utf8').trim().split('\n');
  assert.match(log[0], new RegExp(`^TAKE lane-a@abcdef012 test-familiar c-free=\\S+ run=${key}$`));
  assert.match(log[1], new RegExp(`^DONE lane-a@abcdef012 GREEN wrote=\\S+ c-drop=\\S+ run=${key} · exit 0 · bash -c echo inside; exit 0$`));
});

test('RED: the CLI passes the command code through, refuses usage with 2, and exits 64 where the door cannot open', () => {
  const { d, env } = scratchEnv();
  assert.equal(spawnSync(process.execPath, [TOOL, '--', 'bash', '-c', 'exit 5'], { env }).status, 5);
  assert.equal(spawnSync(process.execPath, [TOOL, 'pnpm', 'build'], { env }).status, 2);
  const walled = spawnSync(process.execPath, [TOOL, '--', 'touch', join(d, 'ran')], { env: { ...env, LARES_BATTERY_LOCK: join(d, 'no-such-dir', 'lock') } });
  assert.equal(walled.status, 64);
  assert.ok(!existsSync(join(d, 'ran')), 'the command ran unlocked');
  assert.equal(STOPPED_EXIT, 65);
});

// THE SHARED BYTE FLOOR (operator, 2026-11-25). RED-FIRST: written by floor-wright#1, run by the familiar.
test('RED: a lone run always admits; a run beside another admits only where C: less both budgets holds the 35G floor', () => {
  const b = { floorBytes: 35 * G, budgetBytes: 4 * G };
  assert.equal(admits({ freeNow: 36 * G, ...b, others: [] }), true);
  // Hermetic: every reading rides in as an argument; the other run took its baseline at the same free bytes (4G unspent).
  assert.equal(admits({ freeNow: 44 * G, ...b, others: [{ free0: 44 * G, budgetBytes: 4 * G }] }), true);   // 44 - 4 - 4 = 36
  assert.equal(admits({ freeNow: 42 * G, ...b, others: [{ free0: 42 * G, budgetBytes: 4 * G }] }), false);  // 42 - 4 - 4 = 34, past the floor
  const other = { free0: 44 * G, budgetBytes: 4 * G };
  assert.equal(admits({ freeNow: null, ...b, others: [other] }), true);     // no C: here: unmetered
});

test('RED: the other run counts only its unspent budget: bytes it already wrote sit in the free reading', () => {
  const other = { free0: 50 * G, budgetBytes: 4 * G };
  assert.equal(remainingOf(other, 48 * G), 2 * G);
  assert.equal(remainingOf(other, 40 * G), 0);
  assert.equal(admits({ freeNow: 43 * G, floorBytes: 35 * G, budgetBytes: 4 * G, others: [{ ...other, free0: 47 * G }] }), true); // spent 4G, remaining 0: 43 - 4 >= 35
});

// THE HEADROOM (no count of runs stands). RED-FIRST: written by floor-wright#2, run by the familiar.
test('RED: no count decides: five small runs beside a sixth admit where the bytes and the cores hold them', () => {
  const others = Array.from({ length: 5 }, () => ({ free0: 100 * G, budgetBytes: 1 * G }));
  assert.equal(headroom({ freeNow: 100 * G, floorBytes: 35 * G, budgetBytes: 1 * G, others, load: 2, cores: 16 }), null);
  // The bytes refuse once the unspent budgets would carry C: past the floor: five runs that took at 40G, none spent, 40 - 1 - 5 = 34.
  const fresh = Array.from({ length: 5 }, () => ({ free0: 40 * G, budgetBytes: 1 * G }));
  assert.match(headroom({ freeNow: 40 * G, floorBytes: 35 * G, budgetBytes: 1 * G, others: fresh, load: 2, cores: 16 }), /past the 35\.00G floor/);
});

test('RED: the cores read the load: beside another run the load must stand under the cores, each live run counting at least one', () => {
  const one = [{ free0: 100 * G, budgetBytes: 1 * G }];
  const b = { freeNow: 100 * G, floorBytes: 35 * G, budgetBytes: 1 * G };
  assert.equal(headroom({ ...b, others: one, load: 3.5, cores: 4 }), null);
  assert.match(headroom({ ...b, others: one, load: 4.2, cores: 4 }), /the load reads 4\.20 against 4 cores/);
  // The load average trails a fresh run: three live runs on a quiet box still count three cores.
  const three = [...one, ...one, ...one];
  assert.match(headroom({ ...b, others: three, load: 0.1, cores: 3 }), /the load reads 3\.00 against 3 cores/);
  // A lone run admits on any reading.
  assert.equal(headroom({ ...b, others: [], load: 99, cores: 1 }), null);
  assert.equal(coresOf({}, 8), 8);
  assert.equal(coresOf({ LARES_FLOOR_LOAD_PER_CORE: '1.5' }, 8), 12);
  assert.throws(() => coresOf({ LARES_FLOOR_LOAD_PER_CORE: 'many' }, 8), /non-negative/);
});

test('RED: othersOf reads live reservations keyed by each run\'s pid; a gone pid and its own key read as none', () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-runs-'));
  writeFileSync(join(d, 'run-111.json'), JSON.stringify({ pid: 111, free0: 50 * G, budgetBytes: 4 * G }));
  writeFileSync(join(d, 'run-222.json'), JSON.stringify({ pid: 222, free0: 50 * G, budgetBytes: 3 * G }));
  writeFileSync(join(d, 'run-333.lock'), '');
  const alive = (pid) => pid === 111;
  assert.deepEqual(othersOf(d, 222, alive).map((o) => o.key), [111]);
  assert.deepEqual(othersOf(d, 111, alive), []);   // run 222's pid is gone, run 111 is its own
  assert.deepEqual(othersOf(join(d, 'absent'), 111, alive), []);
  sweepGone(d, alive);
  assert.deepEqual(readdirSync(d).sort(), ['run-111.json'], 'the gone runs\' leavings swept, the live one standing');
});

test('RED: reserve writes this run\'s reservation by its own key, beside another run\'s, and its release removes only its own', () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-resv-'));
  const mine = reserve(d, 4242, { pid: 4242, free0: 1, budgetBytes: 2 });
  const theirs = reserve(d, 5151, { pid: 5151, free0: 9, budgetBytes: 9 });
  assert.deepEqual(readdirSync(d).sort(), ['run-4242.json', 'run-5151.json']);
  mine();
  assert.deepEqual(readdirSync(d), ['run-5151.json']);
  assert.equal(JSON.parse(readFileSync(join(d, 'run-5151.json'), 'utf8')).free0, 9);
  theirs();
});

test('RED: a run waits until the readings admit it: the first reading refuses, a later reading past the freed bytes admits', async () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-wait-'));
  writeFileSync(join(d, 'run-111.json'), JSON.stringify({ pid: process.pid, free0: 42 * G, budgetBytes: 4 * G }));
  const reads = [42 * G, 42 * G, 44 * G]; // the third reading carries C: back up (the other run freed bytes)
  const said = [];
  await awaitAdmission({ floorDir: d, key: 222, floorBytes: 35 * G, budgetBytes: 4 * G, readFree: () => reads.shift() ?? 44 * G, readLoad: () => 0, cores: 64, pace: 1, say: (s) => said.push(s) });
  assert.equal(reads.length, 0, 'it read until the bytes admitted');
  assert.equal(said.length, 1);
  assert.match(said[0], /run 222 waits: .*past the 35\.00G floor/);
});

test('RED: three floor-runs fly at once where the readings admit them; no count holds the third', async () => {
  const { spawn } = await import('node:child_process');
  const { d, env } = scratchEnv();
  const rel = join(d, 'rel');
  const marks = ['a', 'b', 'c'].map((n) => join(d, n));
  const hold = (mark) => ['--budget-gb', '0.001', '--', 'bash', '-c', `touch ${mark}; while [ ! -e ${rel} ]; do :; done`];
  const until = async (p) => { for (let i = 0; i < 4000 && !existsSync(p); i++) await new Promise((r) => setTimeout(r, 5)); assert.ok(existsSync(p), `no handshake at ${p}`); };
  const kids = [];
  const fly = (args) => { const k = spawn(process.execPath, args, { env, stdio: 'ignore', detached: true }); kids.push(k); return k; };
  try {
  const runs = marks.map((m) => fly([TOOL, ...hold(m)]));
  for (const m of marks) await until(m);
  writeFileSync(rel, '');
  for (const r of runs) assert.equal(await exited(r), 0);
  } finally { writeFileSync(rel, ''); for (const k of kids) { try { process.kill(-k.pid, 'SIGKILL'); } catch { /* gone */ } } }
});

// THE EPHEMERAL BENCH: a proof needs no standing worktree. RED-FIRST: written by floor-wright#2, run by the familiar.
test('RED: --ref budgets the bench beside the run: 4G plus the measured 2G bench, unless --budget-gb names another', () => {
  assert.equal(BENCH_GB, 2);
  const o = parseArgs(['--ref', 'origin/develop', '--', 'node', 'tools/bench-gate.mjs']);
  assert.equal(o.ref, 'origin/develop');
  assert.equal(o.budgetGb, DEFAULT_BUDGET_GB + BENCH_GB);
  assert.equal(parseArgs(['--ref', 'x', '--budget-gb', '9', '--', 'y']).budgetGb, 9);
});

test('RED: a bench run adds a worktree at the ref, provisions it by the floor\'s own tool, runs inside it, and leaves nothing standing', async () => {
  const d = mkdtempSync(join(tmpdir(), 'floor-bench-'));
  const repo = join(d, 'repo'); mkdirSync(join(repo, 'tools'), { recursive: true });
  const git = (...a) => { const r = spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q');
  // A provisioner stub that marks the tree it provisions; the ref also carries a refusing one, which the bench never runs.
  writeFileSync(join(repo, 'tools', 'provision-worktree.mjs'), "import { writeFileSync } from 'node:fs'; import { join } from 'node:path'; if (process.argv[2] !== '--existing') process.exit(9); writeFileSync(join(process.argv[3], 'provisioned'), 'yes\\n');\n");
  const floorTool = join(d, 'floor-provision.mjs'); writeFileSync(floorTool, readFileSync(join(repo, 'tools', 'provision-worktree.mjs'), 'utf8'));
  // The ref's own provisioner refuses, as an older floor's guard does; the bench never runs it.
  writeFileSync(join(repo, 'tools', 'provision-worktree.mjs'), 'process.exit(64);');
  git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'stub');
  const head = git('rev-parse', 'HEAD');
  const bench = join(d, 'floor', 'bench-1');
  const out = join(d, 'out');
  const r = await meteredRun(benchCommand(repo, bench, head, ['bash', '-c', `cat provisioned > ${out}; git rev-parse HEAD >> ${out}`], floorTool), { budgetBytes: 4 * G, floorBytes: 0, readFree: () => null, say: () => {} });
  assert.equal(r.code, 0);
  assert.deepEqual(readFileSync(out, 'utf8').trim().split('\n'), ['yes', head]);
  removeBench(repo, bench);
  assert.ok(!existsSync(bench), 'the bench left with its run');
  assert.doesNotMatch(git('worktree', 'list'), /bench-1/);
});
