// floor-lock — the tool wall reads the kernel's lock table: inside the floor where an ancestor holds the battery lock.
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ancestry, flocksOf, floorHeld, floorRefusal, heldSlot, slotStatus, statusText, requireFloor, FLOOR_EXIT } from './floor-lock.mjs';
import { spawn } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';

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
  const env = { ...process.env, LARES_BATTERY_LOCK: join(dir(), 'lock') };
  requireFloor('bench-gate.mjs', ['--base', 'x'], { env, held: () => false, exit: (c) => { code = c; }, say: (s) => said.push(s) });
  assert.equal(code, FLOOR_EXIT);
  assert.match(said.join('\n'), /pono: node tools\/floor-run\.mjs -- node tools\/bench-gate\.mjs --base x/);
  assert.equal(requireFloor('bench-gate.mjs', [], { env, held: () => true, exit: () => { throw new Error('exited'); } }), true);
  assert.match(floorRefusal('provision-worktree.mjs'), /^floor: refused/);
});

test('RED: a real battery run reads as held inside, and --held reads unheld outside', () => {
  const lock = join(dir(), 'lock');
  const env = { ...process.env, LARES_BATTERY_LOCK: lock };
  const inside = spawnSync('bash', [BATTERY, process.execPath, join(TOOLS, 'floor-lock.mjs'), '--held'], { encoding: 'utf8', env });
  assert.equal(inside.status, 0, inside.stderr);
  const outside = spawnSync(process.execPath, [join(TOOLS, 'floor-lock.mjs'), '--held'], { encoding: 'utf8', env });
  assert.equal(outside.status, 1);
});

test('RED: battery.sh re-enters: a battery run inside a held battery runs at once instead of waiting on itself', () => {
  const lock = join(dir(), 'lock');
  const env = { ...process.env, LARES_BATTERY_LOCK: lock };
  // The timeout guards a hang only (a nested flock would wait forever); the verdict reads the exit and the output.
  const r = spawnSync('bash', [BATTERY, 'bash', BATTERY, 'echo', 'nested-ran'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /nested-ran/);
  assert.match(r.stderr, /already stands held/);
});

test('RED: the heavy CLIs refuse outside the floor (64, naming the cure) and their read verbs pass', () => {
  const env = { ...process.env, LARES_BATTERY_LOCK: join(dir(), 'lock') };
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
  const env = { ...process.env, LARES_BATTERY_LOCK: lock, LARES_BIN: '/nonexistent/lares' };
  const RUN = join(TOOLS, 'floor-run.mjs');
  // The timeout guards a hang only (the deadlock waited forever); the verdict reads the exit and the output.
  const viaBattery = spawnSync(process.execPath, [RUN, '--', 'bash', BATTERY, 'echo', 'nested-battery-ran'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(viaBattery.status, 0, viaBattery.stderr);
  assert.match(viaBattery.stdout, /nested-battery-ran/);
  assert.match(viaBattery.stderr, /already stands held/);
  assert.equal((viaBattery.stderr.match(/battery: waiting for the box/g) ?? []).length, 1, 'one take, never a second wait');
  const viaRun = spawnSync(process.execPath, [RUN, '--', process.execPath, RUN, '--', 'echo', 'nested-run-ran'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(viaRun.status, 0, viaRun.stderr);
  assert.match(viaRun.stdout, /nested-run-ran/);
  assert.equal((viaRun.stderr.match(/battery: waiting for the box/g) ?? []).length, 1, 'one take, never a second wait');
  // The familiar's step 1 shape: a heavy CLI under floor-run passes the wall (its own usage refusal, never the floor's 64).
  const wall = spawnSync(process.execPath, [RUN, '--', process.execPath, join(TOOLS, 'provision-worktree.mjs'), '--existing', join(dir(), 'nowhere')], { encoding: 'utf8', env, timeout: 60_000 });
  assert.notEqual(wall.status, 64, wall.stderr);
  assert.doesNotMatch(wall.stderr, /floor: refused/);
});

// TWO SLOTS (operator, 2026-11-25). RED-FIRST: written by floor-wright#1, run by the familiar.
const until = async (path, turns = 4000) => { for (let i = 0; i < turns && !existsSync(path); i++) await new Promise((r) => setTimeout(r, 5)); if (!existsSync(path)) throw new Error(`no handshake at ${path}`); };
const exited = (child) => new Promise((res) => child.on('exit', (code) => res(code)));
const slotShape = (d, slot2Held) => {
  mkdirSync(d, { recursive: true });
  const l1 = join(d, 'l1'), l2 = join(d, 'l2'); writeFileSync(l1, ''); writeFileSync(l2, '');
  const proc = fakeProc(join(d, 'p'), { 30: 20, 20: 10, 10: 1, 1: 0 }, '');
  mkdirSync(join(proc, '20', 'fd'), { recursive: true }); mkdirSync(join(proc, '20', 'fdinfo'), { recursive: true });
  symlinkSync(slot2Held ? l2 : l1, join(proc, '20', 'fd', '9'));
  writeFileSync(join(proc, '20', 'fdinfo', '9'), `pos:\t0\nlock:\t1: FLOCK  ADVISORY  WRITE 4444 08:20:1 0 EOF\n`);
  writeFileSync(join(proc, '20', 'cmdline'), 'bash\0battery.sh\0pnpm\0test');
  return { locks: [l1, l2], proc };
};

test('RED: heldSlot names the slot an ancestor holds by open file: slot 2 reads 2, slot 1 reads 1, a stranger reads 0', () => {
  const d = dir();
  const two = slotShape(join(d, 'a'), true);
  assert.equal(heldSlot({ locks: two.locks, pid: 30, proc: two.proc }), 2);
  const one = slotShape(join(d, 'b'), false);
  assert.equal(heldSlot({ locks: one.locks, pid: 30, proc: one.proc }), 1);
  assert.equal(heldSlot({ locks: one.locks, pid: 99, proc: one.proc }), 0);
});

test('RED: slotStatus names which slot each run holds (pid and command) and reads the other free', () => {
  const d = dir();
  const { locks, proc } = slotShape(d, true);
  const rows = slotStatus({ locks, proc });
  assert.equal(rows[0].holder, null);
  assert.equal(rows[1].holder.pid, 20);
  assert.equal(statusText(rows), 'slot 1 free\nslot 2 held by pid 20 (bash battery.sh pnpm test)');
});

test('RED: two real batteries hold slot 1 and slot 2 at once; each reads its own slot, and --status names both', async () => {
  const d = dir(); const lock = join(d, '.battery.lock');
  const env = { ...process.env, LARES_BATTERY_LOCK: lock };
  const inA = join(d, 'a'), inB = join(d, 'b'), rel = join(d, 'rel');
  const hold = (mark) => `touch ${mark}; node ${join(TOOLS, 'floor-lock.mjs')} --slot > ${mark}.tmp && mv ${mark}.tmp ${mark}.slot; while [ ! -e ${rel} ]; do :; done`;
  const a = spawn('bash', [BATTERY, 'bash', '-c', hold(inA)], { env, stdio: 'ignore', detached: true });
  const b = spawn('bash', [BATTERY, 'bash', '-c', hold(inB)], { env, stdio: 'ignore', detached: true });
  try {
  await until(inA);
  await until(inB);
  await until(`${inA}.slot`); await until(`${inB}.slot`);
  const { readFileSync } = await import('node:fs');
  const slots = [readFileSync(`${inA}.slot`, 'utf8').trim(), readFileSync(`${inB}.slot`, 'utf8').trim()];
  assert.deepEqual([...slots].sort(), ['1', '2'], 'two runs, two slots, each reading its own (the take order races)');
  const status = spawnSync(process.execPath, [join(TOOLS, 'floor-lock.mjs'), '--status'], { encoding: 'utf8', env }).stdout;
  assert.match(status, /^slot 1 held by pid \d+/m);
  assert.match(status, /^slot 2 held by pid \d+/m);
  writeFileSync(rel, '');
  assert.equal(await exited(a), 0); assert.equal(await exited(b), 0);
  } finally { writeFileSync(rel, ''); for (const c of [a, b]) { try { process.kill(-c.pid, 'SIGKILL'); } catch { /* gone */ } } }
});

test('RED: a nested take inside slot 2 runs at once, never waiting on itself, with slot 1 held by another run', async () => {
  const d = dir(); const lock = join(d, '.battery.lock');
  const env = { ...process.env, LARES_BATTERY_LOCK: lock };
  const inA = join(d, 'a'), rel = join(d, 'rel');
  const a = spawn('bash', [BATTERY, 'bash', '-c', `touch ${inA}; while [ ! -e ${rel} ]; do :; done`], { env, stdio: 'ignore', detached: true });
  try {
  await until(inA);
  // This battery takes slot 2; the nested battery inside it reads slot 2 held by its ancestor and runs at once.
  const r = spawnSync('bash', [BATTERY, 'bash', BATTERY, 'node', join(TOOLS, 'floor-lock.mjs'), '--slot'], { encoding: 'utf8', env, timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '2');
  assert.match(r.stderr, /already stands held/);
  assert.match(r.stderr, /holding the box, slot 2/);
  writeFileSync(rel, '');
  assert.equal(await exited(a), 0);
  } finally { writeFileSync(rel, ''); try { process.kill(-a.pid, 'SIGKILL'); } catch { /* gone */ } }
});
