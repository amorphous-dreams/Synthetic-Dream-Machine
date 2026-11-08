import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { superviseChild, checkTimeoutMs } from './seat-walls.mjs';
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
