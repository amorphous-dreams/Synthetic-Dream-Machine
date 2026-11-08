import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, utimesSync, symlinkSync, statSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForReceipt } from './wait-receipt.mjs';
import { RECEIPT_CAP_MS, RECEIPT_SILENCE_MS, DOOR_SILENCE_MS, DOOR_RUN_MAX_MS, RELAY_PAUSE_MS, claimName, openClaim } from './relay-claim.mjs';
import { openHeldSync } from './held-dir.mjs';

const relayDir = () => mkdtempSync(join(tmpdir(), 'receipt-wait-'));
const touch = (p) => { const t = new Date(); try { utimesSync(p, t, t); } catch { writeFileSync(p, '{}'); } };

test('waitForReceipt reads its own answer, completes a read begun before the broker finished writing, and reads one already there', async () => {
  const dir = relayDir();
  try {
    const file = join(dir, 'res-001.json');
    const pending = waitForReceipt(file, { silenceMs: 1000, capMs: 2000 });
    writeFileSync(file, ''); // creation can precede a completed broker write
    writeFileSync(join(dir, 'res-002.json'), '{}');
    const timer = setTimeout(() => writeFileSync(file, '{"ok":true}'), 30);
    try { assert.deepEqual(await pending, { ok: true }); } finally { clearTimeout(timer); }
    assert.deepEqual(await waitForReceipt(file), { ok: true }, 'CONTROL already arrived');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('RED: a dead broker (no claim stirs) releases the lead at the silence bound', async () => {
  const dir = relayDir();
  try {
    const t0 = Date.now();
    await assert.rejects(waitForReceipt(join(dir, 'res-001.json'), { silenceMs: 60, capMs: 1000 }), /receipt-silent.*60ms.*broker may have died/);
    assert.ok(Date.now() - t0 < 900, 'the silence bound speaks, not the cap');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CONTROL: a slow broker whose claim stirs keeps the wait alive past the silence bound, and its answer lands (lease-end step 16: a 140 s test read as a dead broker)', async () => {
  const dir = relayDir();
  const beat = setInterval(() => touch(join(dir, claimName('001'))), 15);
  try {
    const file = join(dir, 'res-001.json');
    const pending = waitForReceipt(file, { silenceMs: 60, capMs: 2000 });
    const timer = setTimeout(() => writeFileSync(file, '{"ok":true,"pass":15}'), 250);
    try { assert.deepEqual(await pending, { ok: true, pass: 15 }); } finally { clearTimeout(timer); }
  } finally { clearInterval(beat); rmSync(dir, { recursive: true, force: true }); }
});

test('CONTROL: a request queued behind another reads the running request\'s claim as the broker\'s life', async () => {
  const dir = relayDir();
  const beat = setInterval(() => touch(join(dir, claimName('000'))), 15);
  try {
    const file = join(dir, 'res-001.json');
    const pending = waitForReceipt(file, { silenceMs: 60, capMs: 2000 });
    const timer = setTimeout(() => writeFileSync(file, '{"ok":true}'), 200);
    try { assert.deepEqual(await pending, { ok: true }); } finally { clearTimeout(timer); }
  } finally { clearInterval(beat); rmSync(dir, { recursive: true, force: true }); }
});

test('RED: a forged claim (the walled lead can write the relay dir) stirring forever never stretches the wait past the cap', async () => {
  const dir = relayDir();
  const beat = setInterval(() => touch(join(dir, claimName('001'))), 10);
  try {
    writeFileSync(join(dir, claimName('001')), JSON.stringify({ boundMs: 10 ** 12 })); // a claim's text never sets a bound
    const t0 = Date.now();
    await assert.rejects(waitForReceipt(join(dir, 'res-001.json'), { silenceMs: 50, capMs: 200 }), /receipt-cap.*200ms/);
    const took = Date.now() - t0;
    assert.ok(took >= 190 && took < 1500, `the cap speaks at its own bound (${took}ms)`);
  } finally { clearInterval(beat); rmSync(dir, { recursive: true, force: true }); }
});

test('the bounds derive from the doors and refuse anything wider: silence past the door silence, a cap past the door run, a cap under the silence, a non-integer', async () => {
  assert.equal(RECEIPT_SILENCE_MS, DOOR_SILENCE_MS + 2 * RELAY_PAUSE_MS);
  assert.equal(RECEIPT_CAP_MS, DOOR_RUN_MAX_MS + 2 * RELAY_PAUSE_MS);
  const file = join(tmpdir(), 'res-009.json');
  await assert.rejects(waitForReceipt(file, { silenceMs: RECEIPT_SILENCE_MS + 1 }), /receipt-bound/);
  await assert.rejects(waitForReceipt(file, { capMs: RECEIPT_CAP_MS + 1 }), /receipt-bound/);
  await assert.rejects(waitForReceipt(file, { silenceMs: 100, capMs: 50 }), /receipt-bound/);
  await assert.rejects(waitForReceipt(file, { silenceMs: Infinity }), /receipt-bound/);
  await assert.rejects(waitForReceipt(join(tmpdir(), 'answer.json')), /receipt-name/);
});

test('the CLI takes exactly the receipt path: a bound argument refuses', () => {
  const cli = fileURLToPath(new URL('./wait-receipt.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [cli, join(tmpdir(), 'res-001.json'), '120000'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: wait-receipt\.mjs <res-id\.json>$/m);
});

test('openClaim: the broker writes its claim inside the held relay, stirs it, and clears it; RED: a lead-planted symlink claim never moves the file it points at', () => {
  const dir = relayDir(), outside = relayDir();
  try {
    const held = openHeldSync(dir, dir);
    try {
      const claim = openClaim(held, '001');
      assert.ok(existsSync(join(dir, claimName('001'))), 'the claim stands at pickup');
      const before = statSync(join(dir, claimName('001'))).mtimeMs;
      claim.beat({ now: before + 10_000 });
      assert.ok(statSync(join(dir, claimName('001'))).mtimeMs > before, 'a beat stirs the claim');
      claim.clear();
      assert.ok(!existsSync(join(dir, claimName('001'))), 'the claim clears after the answer');

      const target = join(outside, 'victim');
      writeFileSync(target, 'keep');
      const old = new Date(0); utimesSync(target, old, old);
      symlinkSync(target, join(dir, claimName('002')));
      const planted = openClaim(held, '002');
      planted.beat({ now: Date.now() + 10_000 });
      planted.clear();
      assert.equal(readFileSync(target, 'utf8'), 'keep');
      assert.equal(statSync(target).mtimeMs, 0, 'the beat never follows the planted link');
      assert.ok(!existsSync(join(dir, claimName('002'))), 'clear removes the link itself');
    } finally { held.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});

test('openClaim paces its beats: at most one stir per relay pause, so a chatty door never floods the relay dir', () => {
  const dir = relayDir();
  try {
    const held = openHeldSync(dir, dir);
    try {
      const claim = openClaim(held, '001', { now: 1_000 });
      assert.equal(claim.beat({ now: 1_000 + RELAY_PAUSE_MS - 1 }), false);
      assert.equal(claim.beat({ now: 1_000 + RELAY_PAUSE_MS }), true);
      assert.equal(claim.beat({ now: 1_000 + RELAY_PAUSE_MS + 1 }), false);
      claim.clear();
    } finally { held.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
