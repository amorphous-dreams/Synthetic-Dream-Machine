import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const witness = join(dirname(fileURLToPath(import.meta.url)), 'disk-witness.sh');
// The limits below sit at extremes no real disk or worktree list reaches, so the verdict never rides the real disk's state.
const loose = { LARES_DISK_MIN_C_GB: '0', LARES_DISK_MIN_ROOT_GB: '0', LARES_DISK_MAX_WORKTREES: '100000', LARES_DISK_MAX_CODEX: '100000' };
const run = env => spawnSync('bash', [witness], { encoding: 'utf8', env: { ...process.env, ...env } });

test('the witness reads RED under an impossible floor and names the reason', () => {
  const r = run({ ...loose, LARES_DISK_MIN_ROOT_GB: '999999999' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /RED: \/ has .*G available, under the 999999999G floor/);
});

test('the witness reads green under loose limits, and prints the counts it weighs', () => {
  const r = run(loose);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /VHD size:/);
  assert.match(r.stdout, /built worktrees \d+\/100000 · Codex worktrees \d+\/100000 · prunable records \d+/);
  assert.match(r.stdout, /disk-guard: ok/);
});

test('on CI the / floor drops to zero by name', () => {
  const env = { ...process.env, CI: 'true' };
  delete env.LARES_DISK_MIN_ROOT_GB;
  const r = spawnSync('bash', [witness], { encoding: 'utf8', env: { ...env, LARES_DISK_MIN_C_GB: '0', LARES_DISK_MAX_WORKTREES: '100000', LARES_DISK_MAX_CODEX: '100000' } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /\/ floor: 0G on CI/);
});
