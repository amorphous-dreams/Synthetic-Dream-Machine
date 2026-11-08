import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { superviseChild, checkTimeoutMs, openRootFarm, INSTALL_RUN_WALL } from './seat-walls.mjs';
import { DOOR_RUN_MAX_MS, DOOR_SILENCE_MS } from './relay-claim.mjs';

const child = (script) => spawn(process.execPath, ['-e', script], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });

test('superviseChild collects the output and the exit, and beats once per chunk the child speaks', async () => {
  let beats = 0;
  const ran = await superviseChild(child('process.stdout.write("a"); setTimeout(() => { process.stderr.write("b"); }, 20)'), { silenceMs: 2000, runMaxMs: 5000, onBeat: () => { beats++; } });
  assert.equal(ran.code, 0);
  assert.equal(ran.output, 'ab');
  assert.equal(ran.silent, false); assert.equal(ran.overran, false);
  assert.ok(beats >= 2, `a beat per chunk (${beats})`);
});

test('RED: a silent child dies at the silence bound', async () => {
  const ran = await superviseChild(child('setTimeout(() => {}, 60000)'), { silenceMs: 80, runMaxMs: 5000 });
  assert.equal(ran.silent, true);
  assert.equal(ran.overran, false);
});

test('RED: a child that keeps talking past the run bound dies there; CONTROL: talk alone never stretches it', async () => {
  const t0 = Date.now();
  const ran = await superviseChild(child('setInterval(() => process.stdout.write("."), 10)'), { silenceMs: 1000, runMaxMs: 150 });
  assert.equal(ran.overran, true);
  assert.equal(ran.silent, false);
  assert.ok(Date.now() - t0 < 2000);
});

test('the bounds come from the doors: wider refuses, and the check seat bounds each check by the door silence', async () => {
  await assert.rejects(superviseChild(child(''), { silenceMs: DOOR_SILENCE_MS + 1 }), /seat-bound/);
  await assert.rejects(superviseChild(child(''), { runMaxMs: DOOR_RUN_MAX_MS + 1 }), /seat-bound/);
  assert.equal(checkTimeoutMs, DOOR_SILENCE_MS);
});

test('root farm refuses when a checked directory loses its handle', () => {
  const result = openRootFarm(0, () => null, () => ({ isDirectory: () => true }));
  assert.match(result.refusal ?? '', /root node_modules/);
});

test('root farm refuses a link appearing after an absent name', () => {
  const absent = () => { const error = new Error('absent'); error.code = 'ENOENT'; throw error; };
  for (const code of ['ELOOP', 'ENOTDIR']) {
    const result = openRootFarm(0, () => { const error = new Error(code); error.code = code; throw error; }, absent);
    assert.match(result.refusal ?? '', /root node_modules/);
  }
});

test('install wall masks host run sockets', () => {
  assert.deepEqual(INSTALL_RUN_WALL, ['--tmpfs', '/run']);
});

test('RED (blind read F1): a child that exits while another process holds its pipe releases the broker at the drain bound, never waits on the holder', async () => {
  const holderScript = 'const { spawn } = require("node:child_process"); const h = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] }); h.unref(); process.stdout.write(String(h.pid) + "\\n");';
  const t0 = Date.now();
  const ran = await superviseChild(child(holderScript), { silenceMs: 5000, runMaxMs: 10_000, drainMs: 100 });
  const held = Number(ran.output.trim());
  try { process.kill(held, 'SIGKILL'); } catch { /* already gone */ }
  assert.equal(ran.code, 0);
  assert.ok(Date.now() - t0 < 3000, 'the drain bound settles; the holder never holds the broker');
});

test('RED (blind read F1): the whole-run bound settles the door even when a holder keeps the pipe open after the kill', async () => {
  const holderScript = 'const { spawn } = require("node:child_process"); const h = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] }); h.unref(); process.stdout.write(String(h.pid) + "\\n"); setInterval(() => process.stdout.write("."), 10);';
  const t0 = Date.now();
  const ran = await superviseChild(child(holderScript), { silenceMs: 5000, runMaxMs: 150, drainMs: 100 });
  try { process.kill(Number(ran.output.split('\n')[0]), 'SIGKILL'); } catch { /* already gone */ }
  assert.equal(ran.overran, true);
  assert.ok(Date.now() - t0 < 3000);
});

test('the check seat refuses a check list whose bounds together pass the door run bound (blind read F3)', async () => {
  const { runCheckSeat } = await import('./seat-walls.mjs');
  const checks = Array.from({ length: Math.ceil(DOOR_RUN_MAX_MS / checkTimeoutMs) }, (_, i) => ({ name: `c${i}`, argv: ['/usr/bin/true'] }));
  const out = await runCheckSeat({ gitDir: '/nonexistent', tree: 'x', checks, key: Buffer.alloc(32), receipts: new Map(), iso: '/nonexistent', bwrap: true });
  assert.match(out.output, /checks together bound/);
});
