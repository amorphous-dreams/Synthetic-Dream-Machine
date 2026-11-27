// floor-lock — the tool wall reads the kernel's lock table: inside the floor where an ancestor holds a run's own lock.
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ancestry, flocksOf, floorHeld, floorRefusal, heldRun, runLocks, runStatus, statusText, requireFloor, FLOOR_EXIT } from './floor-lock.mjs';
import { spawn } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { exited, floorEnv, gone, FLOOR_MARKS } from './floor-test-kit.mjs';

const TOOLS = fileURLToPath(new URL('.', import.meta.url));
const BATTERY = join(TOOLS, 'battery.sh');
const dir = () => mkdtempSync(join(tmpdir(), 'floor-lock-'));

/** A fixture /proc: pids with parents, and a locks table. */
function fakeProc(d, parents, locks) {
  const proc = join(d, 'proc'); mkdirSync(proc, { recursive: true });
  for (const [pid, ppid] of Object.entries(parents)) { mkdirSync(join(proc, pid), { recursive: true }); writeFileSync(join(proc, pid, 'stat'), `${pid} (node a b) S ${ppid} 1 1 0`); }
  writeFileSync(join(proc, 'locks'), locks);
  return proc;
}

test('RED: flocksOf reads holders by inode and skips a blocked waiter', () => {
  const table = flocksOf('1: FLOCK  ADVISORY  WRITE 4242 08:20:777 0 EOF\n1: -> FLOCK  ADVISORY  WRITE 5151 08:20:777 0 EOF\n2: POSIX  ADVISORY  WRITE 9 08:20:777 0 EOF\n');
  assert.deepEqual([...table.get(777)], [4242]);
});

test('RED: ancestry walks parents through a name holding spaces and parens', () => {
  const d = dir();
  const proc = fakeProc(d, { 30: 20, 20: 10, 10: 1, 1: 0 }, '');
  writeFileSync(join(proc, '20', 'stat'), '20 (bash (x) y) S 10 1 1 0');
  assert.deepEqual(ancestry(30, proc), [30, 20, 10, 1]);
});

test('RED: held where an ancestor holds a FLOCK on the lock inode; unheld for a stranger holder or another inode', () => {
  const d = dir(); const lock = join(d, 'lock'); writeFileSync(lock, '');
  const ino = statSync(lock).ino;
  const parents = { 30: 20, 20: 10, 10: 1, 1: 0, 99: 1 };
  assert.equal(floorHeld({ lock, pid: 30, proc: fakeProc(join(d, 'a'), parents, `1: FLOCK  ADVISORY  WRITE 20 08:20:${ino} 0 EOF\n`) }), true);
  assert.equal(floorHeld({ lock, pid: 30, proc: fakeProc(join(d, 'b'), parents, `1: FLOCK  ADVISORY  WRITE 99 08:20:${ino} 0 EOF\n`) }), false);
  assert.equal(floorHeld({ lock, pid: 30, proc: fakeProc(join(d, 'c'), parents, `1: FLOCK  ADVISORY  WRITE 20 08:20:${ino + 1} 0 EOF\n`) }), false);
  assert.equal(floorHeld({ lock: join(d, 'absent'), pid: 30, proc: fakeProc(join(d, 'e'), parents, '') }), false);
});

test('RED: requireFloor refuses with exit 64 and the floor-run cure; passes where held', () => {
  const said = []; let code = null;
  const env = floorEnv(join(dir(), 'lock'));
  requireFloor('bench-gate.mjs', ['--base', 'x'], { env, held: () => false, exit: (c) => { code = c; }, say: (s) => said.push(s) });
  assert.equal(code, FLOOR_EXIT);
  assert.match(said.join('\n'), /pono: node tools\/floor-run\.mjs -- node tools\/bench-gate\.mjs --base x/);
  assert.equal(requireFloor('bench-gate.mjs', [], { env, held: () => true, exit: () => { throw new Error('exited'); } }), true);
  assert.match(floorRefusal('provision-worktree.mjs'), /^floor: refused/);
});

test('RED: a real battery run reads as held inside, and --held reads unheld outside', () => {
  const lock = join(dir(), 'lock');
  const env = floorEnv(lock);
  const inside = spawnSync('bash', [BATTERY, process.execPath, join(TOOLS, 'floor-lock.mjs'), '--held'], { encoding: 'utf8', env });
  assert.equal(inside.status, 0, inside.stderr);
  const outside = spawnSync(process.execPath, [join(TOOLS, 'floor-lock.mjs'), '--held'], { encoding: 'utf8', env });
  assert.equal(outside.status, 1);
});

test('RED: battery.sh re-enters: a battery run inside a held battery runs at once instead of waiting on itself', () => {
  const lock = join(dir(), 'lock');
  const env = floorEnv(lock);
  // The timeout guards a hang only (a nested flock would wait forever); the verdict reads the exit and the output.
  const r = spawnSync('bash', [BATTERY, 'bash', BATTERY, 'echo', 'nested-ran'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /nested-ran/);
  assert.match(r.stderr, /already stands held/);
});

test('RED: the heavy CLIs refuse outside the floor (64, naming the cure) and their read verbs pass', () => {
  const env = floorEnv(join(dir(), 'lock'));
  const node = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', env, cwd: join(TOOLS, '..') });
  const gate = node([join(TOOLS, 'bench-gate.mjs')]);
  assert.equal(gate.status, FLOOR_EXIT, gate.stderr);
  assert.match(gate.stderr, /pono: node tools\/floor-run\.mjs -- node tools\/bench-gate\.mjs/);
  assert.equal(node([join(TOOLS, 'bench-gate.mjs'), '--list']).status, 0);
  const prov = node([join(TOOLS, 'provision-worktree.mjs'), join(dir(), 'wt')]);
  assert.equal(prov.status, FLOOR_EXIT, prov.stderr);
  const existing = node([join(TOOLS, 'provision-worktree.mjs'), '--existing', dir()]);
  assert.equal(existing.status, FLOOR_EXIT, existing.stderr);
  assert.equal(node([join(TOOLS, 'provision-worktree.mjs'), '--help']).status, 0);
});

test('RED: the shim takes the floor around the compose build, prunes the build cache after it (never an image), and gives it back', async () => {
  const { readFileSync } = await import('node:fs');
  const shim = readFileSync(join(TOOLS, 'lares-container.sh'), 'utf8');
  const body = shim.slice(shim.indexOf('build_image() {'), shim.indexOf('\n}\n', shim.indexOf('build_image() {')));
  const take = body.indexOf('floor_take'), build = body.indexOf('docker compose'), prune = body.indexOf('prune_build_cache'), give = body.indexOf('floor_give');
  assert.ok(take > -1 && take < build && build < prune && prune < give, 'floor_take -> compose build -> prune_build_cache -> floor_give');
  assert.match(shim, /prune_build_cache\(\) \{\n\s+if docker builder prune --all --force/);
  assert.doesNotMatch(shim.slice(shim.indexOf('prune_build_cache() {'), shim.indexOf('build_image() {')), /docker (image|system) prune|docker rmi/);
  assert.match(shim, /node "\$HERE\/floor-lock\.mjs" --held/);
});

// THE NESTED-TAKE DEADLOCK (2026-11-25): battery.sh runs `flock 9`, and flock(1) locks the shell's open file from a CHILD that
// exits, so /proc/locks names a pid no heavy run descends from. The hold reads by open file: an ancestor's fd on the lock whose
// fdinfo lists the FLOCK. RED-FIRST: written by floor-warden#2, run by the familiar.
test('RED: held where /proc/locks names a gone flock(1) pid but an ancestor holds a descriptor whose fdinfo lists the FLOCK', async () => {
  const { symlinkSync } = await import('node:fs');
  const d = dir(); const lock = join(d, 'lock'); writeFileSync(lock, '');
  const ino = statSync(lock).ino;
  const flockLine = `1: FLOCK  ADVISORY  WRITE 4444 08:20:${ino} 0 EOF`;
  const proc = fakeProc(join(d, 'p'), { 30: 20, 20: 10, 10: 1, 1: 0 }, `${flockLine}\n`);
  mkdirSync(join(proc, '20', 'fd'), { recursive: true }); mkdirSync(join(proc, '20', 'fdinfo'), { recursive: true });
  symlinkSync(lock, join(proc, '20', 'fd', '9'));
  writeFileSync(join(proc, '20', 'fdinfo', '9'), `pos:\t0\nflags:\t0100001\nmnt_id:\t30\nino:\t${ino}\nlock:\t${flockLine}\n`);
  assert.equal(floorHeld({ lock, pid: 30, proc }), true);
  // A waiter: the same descriptor with no lock line on its open file reads unheld.
  writeFileSync(join(proc, '20', 'fdinfo', '9'), `pos:\t0\nflags:\t0100001\nmnt_id:\t30\nino:\t${ino}\n`);
  assert.equal(floorHeld({ lock, pid: 30, proc }), false);
});

test('RED: a nested take under floor-run never waits on itself: floor-run -> battery.sh, floor-run -> floor-run, both run at once', () => {
  const lock = join(dir(), 'lock');
  const env = floorEnv(lock, { LARES_BIN: '/nonexistent/lares' });
  const RUN = join(TOOLS, 'floor-run.mjs');
  // The timeout guards a hang only (the deadlock waited forever); the verdict reads the exit and the output.
  const viaBattery = spawnSync(process.execPath, [RUN, '--', 'bash', BATTERY, 'echo', 'nested-battery-ran'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(viaBattery.status, 0, viaBattery.stderr);
  assert.match(viaBattery.stdout, /nested-battery-ran/);
  assert.match(viaBattery.stderr, /already stands held/);
  assert.equal((viaBattery.stderr.match(/battery: waiting for headroom/g) ?? []).length, 1, 'one take, never a second wait');
  const viaRun = spawnSync(process.execPath, [RUN, '--', process.execPath, RUN, '--', 'echo', 'nested-run-ran'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(viaRun.status, 0, viaRun.stderr);
  assert.match(viaRun.stdout, /nested-run-ran/);
  assert.equal((viaRun.stderr.match(/battery: waiting for headroom/g) ?? []).length, 1, 'one take, never a second wait');
  // The familiar's step 1 shape: a heavy CLI under floor-run passes the wall (its own usage refusal, never the floor's 64).
  const wall = spawnSync(process.execPath, [RUN, '--', process.execPath, join(TOOLS, 'provision-worktree.mjs'), '--existing', join(dir(), 'nowhere')], { encoding: 'utf8', env, timeout: 60_000 });
  assert.notEqual(wall.status, 64, wall.stderr);
  assert.doesNotMatch(wall.stderr, /floor: refused/);
});

// EACH RUN HOLDS ITS OWN LOCK, keyed by its battery's pid; no count of runs stands. RED-FIRST: written by floor-wright#1 and
// floor-wright#2, run by the familiar.
const until = async (path, turns = 4000) => { for (let i = 0; i < turns && !existsSync(path); i++) await new Promise((r) => setTimeout(r, 5)); if (!existsSync(path)) throw new Error(`no handshake at ${path}`); };
const runShape = (d, heldKey) => {
  const floor = join(d, '.floor'); mkdirSync(floor, { recursive: true });
  for (const key of [111, 222]) writeFileSync(join(floor, `run-${key}.lock`), '');
  writeFileSync(join(floor, 'run-111.json'), '{}');
  const proc = fakeProc(join(d, 'p'), { 30: 20, 20: 10, 10: 1, 1: 0 }, '');
  mkdirSync(join(proc, '20', 'fd'), { recursive: true }); mkdirSync(join(proc, '20', 'fdinfo'), { recursive: true });
  symlinkSync(join(floor, `run-${heldKey}.lock`), join(proc, '20', 'fd', '9'));
  writeFileSync(join(proc, '20', 'fdinfo', '9'), `pos:\t0\nlock:\t1: FLOCK  ADVISORY  WRITE 4444 08:20:1 0 EOF\n`);
  writeFileSync(join(proc, '20', 'cmdline'), 'bash\0battery.sh\0pnpm\0test');
  return { floor, proc };
};

test('RED: runLocks lists each run lock by the pid that keys it, never a reservation or a stranger file', () => {
  const { floor } = runShape(dir(), 222);
  writeFileSync(join(floor, 'queue.log'), '');
  assert.deepEqual(runLocks(floor).map((r) => r.key).sort(), [111, 222]);
  assert.deepEqual(runLocks(join(floor, 'absent')), []);
});

test('RED: heldRun names the run an ancestor holds by open file: run 222 reads 222, run 111 reads 111, a stranger reads none', () => {
  const d = dir();
  const two = runShape(join(d, 'a'), 222);
  assert.equal(heldRun({ dir: two.floor, pid: 30, proc: two.proc }).key, 222);
  const one = runShape(join(d, 'b'), 111);
  assert.equal(heldRun({ dir: one.floor, pid: 30, proc: one.proc }).key, 111);
  assert.equal(heldRun({ dir: one.floor, pid: 99, proc: one.proc }), null);
});

test('RED: runStatus names each held run (its key, pid and command) and lists no run lock nobody holds', () => {
  const { floor, proc } = runShape(dir(), 222);
  const rows = runStatus({ dir: floor, proc });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 222);
  assert.equal(rows[0].holder.pid, 20);
  assert.equal(statusText(rows), 'run 222 held by pid 20 (bash battery.sh pnpm test)');
  assert.equal(statusText([]), 'no run holds the floor');
});

test('RED: three real batteries hold three runs at once; each reads its own run, and --status names all three', async () => {
  const d = dir(); const lock = join(d, '.battery.lock');
  const env = floorEnv(lock);
  const marks = ['a', 'b', 'c'].map((n) => join(d, n)), rel = join(d, 'rel');
  const hold = (mark) => `touch ${mark}; node ${join(TOOLS, 'floor-lock.mjs')} --run > ${mark}.tmp && mv ${mark}.tmp ${mark}.run; while [ ! -e ${rel} ]; do :; done`;
  const kids = marks.map((m) => spawn('bash', [BATTERY, 'bash', '-c', hold(m)], { env, stdio: 'ignore', detached: true }));
  try {
  for (const m of marks) { await until(m); await until(`${m}.run`); }
  const { readFileSync } = await import('node:fs');
  const keys = marks.map((m) => readFileSync(`${m}.run`, 'utf8').trim());
  assert.equal(new Set(keys).size, 3, 'three runs, three keys, each reading its own');
  // Each key names its battery shell: the shell that spawned the run.
  kids.forEach((k, i) => assert.equal(keys[i], String(k.pid)));
  const status = spawnSync(process.execPath, [join(TOOLS, 'floor-lock.mjs'), '--status'], { encoding: 'utf8', env }).stdout;
  for (const key of keys) assert.match(status, new RegExp(`^run ${key} held by pid \\d+`, 'm'));
  writeFileSync(rel, '');
  for (const k of kids) assert.equal(await exited(k), 0);
  } finally { writeFileSync(rel, ''); for (const c of kids) { try { process.kill(-c.pid, 'SIGKILL'); } catch { /* gone */ } } }
});

test('RED: a nested take inside a run runs at once, never waiting on itself, with another run holding the floor beside it', async () => {
  const d = dir(); const lock = join(d, '.battery.lock');
  const env = floorEnv(lock);
  const inA = join(d, 'a'), rel = join(d, 'rel');
  const a = spawn('bash', [BATTERY, 'bash', '-c', `touch ${inA}; while [ ! -e ${rel} ]; do :; done`], { env, stdio: 'ignore', detached: true });
  try {
  await until(inA);
  // This battery takes its own run; the nested battery inside it reads that run held by its ancestor and runs at once.
  const r = spawnSync('bash', [BATTERY, 'bash', BATTERY, 'node', join(TOOLS, 'floor-lock.mjs'), '--run'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  const key = /holding the box, run (\d+)/.exec(r.stderr)?.[1];
  assert.ok(key, r.stderr);
  assert.equal(r.stdout.trim(), key);
  assert.notEqual(key, String(a.pid));
  assert.match(r.stderr, /already stands held/);
  writeFileSync(rel, '');
  assert.equal(await exited(a), 0);
  } finally { writeFileSync(rel, ''); try { process.kill(-a.pid, 'SIGKILL'); } catch { /* gone */ } }
});

// THE GATE HUNG HERE (2026-11-26, 50 minutes at 0% CPU inside a floor run's tool-tests leg). Measured: the two-batteries
// case wrote its release once and never reached its `finally`; no later case began. It awaited the first holder's exit and
// only then listened for the second's, which had already gone on the loaded box, and node:test keeps a file alive for a
// pending case while another stands queued. Nothing rode down from the live floor: the lock descriptor stops at floor-run
// (node marks it close-on-exec) and no floor mark stands in the environment. RED-FIRST: written by ahi-loa#1, run by the familiar.
test('RED: exited() answers for a child that has already gone: the event fired with no listener, the record still reads', async () => {
  const child = spawn('true', [], { stdio: 'ignore' });
  for (let i = 0; i < 4000 && !gone(child); i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(child.exitCode, 0, 'the child never exited');
  // One loop turn decides, never a clock: an answer off the record settles before the next turn; a late listener never does.
  const got = await Promise.race([exited(child), new Promise((r) => setImmediate(() => r('never')))]);
  assert.equal(got, 0);
});

test('RED: floorEnv hands a spawned floor tool no mark of the floor that runs the test: its own lock, a zero disk floor, no runner context', () => {
  const live = Object.fromEntries(FLOOR_MARKS.map((k) => [k, 'live-floor']));
  const env = floorEnv('/tmp/x/lock', { LARES_BIN: '/nonexistent/lares' }, { PATH: '/bin', ...live });
  assert.deepEqual(env, { PATH: '/bin', LARES_BATTERY_LOCK: '/tmp/x/lock', LARES_DISK_MIN_C_GB: '0', LARES_FLOOR_LOAD_PER_CORE: '1000000', LARES_BIN: '/nonexistent/lares' });
  assert.ok(!Object.values(floorEnv('/tmp/x/lock', {}, live)).includes('live-floor'));
});

test('RED: a floor case run NESTED under a held floor finishes: a parent holds a run, a node --test child runs the three-batteries case inside it', async () => {
  const d = dir();
  const SELF = fileURLToPath(import.meta.url);
  // The parent's floor: a battery holding its own run under its own door, the shape the gate's tool-tests leg stands under.
  const env = floorEnv(join(d, '.battery.lock'));
  // The name pattern picks one case and never this one, so the nested run cannot nest again.
  const args = [BATTERY, process.execPath, '--test', '--test-isolation=process', '--test-reporter=tap', '--test-name-pattern=three real batteries hold three runs at once', SELF];
  const child = spawn('bash', args, { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let out = '', err = '';
  child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { err += c; });
  const closed = new Promise((res) => child.once('close', res));
  try {
  // Bounded by turns: the bound only keeps a nested hang from hanging this file too; the verdict reads the exit and the report.
  for (let i = 0; i < 24000 && !gone(child); i++) await new Promise((r) => setTimeout(r, 5));
  assert.ok(gone(child), `the nested floor case never finished under a held floor\n${out}\n${err}`);
  await closed;
  assert.equal(child.exitCode, 0, `${out}\n${err}`);
  assert.match(err, /battery: holding the box, run \d+/, 'the parent held a run around the nested run');
  assert.match(out, /^# pass [1-9]\d*$/m, out);
  assert.match(out, /^# fail 0$/m, out);
  assert.match(out, /^# cancelled 0$/m, out);
  } finally { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }
});
