import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDisk, parseWorktrees, readLimits, render } from './disk-guard.mjs';

const GB = 1024 ** 3;
const gb = n => n * GB;
// Injected readers only: no test here reads the real disk, the real worktree list or the real home.
const reading = (over = {}) => ({
  statfs: path => {
    if (path === '/mnt/c') return over.c === null ? null : { bavail: Math.floor(gb(over.c ?? 99) / 4096), bsize: 4096 };
    return { bavail: Math.floor(gb(over.root ?? 800) / 4096), bsize: 4096 };
  },
  worktreeList: () => over.porcelain ?? porcelain(over.built ?? 0, over.prunable ?? 0),
  codexDirs: () => Array.from({ length: over.codex ?? 0 }, (_, i) => `c${i}`),
  env: over.env ?? {},
  ...over.extra,
});
function porcelain(built, prunable) {
  const out = ['worktree /main', 'HEAD aaa', 'branch refs/heads/x', ''];
  for (let i = 0; i < built; i++) out.push(`worktree /wt/${i}`, 'HEAD bbb', 'detached', '');
  for (let i = 0; i < prunable; i++) out.push(`worktree /gone/${i}`, 'HEAD ccc', 'detached', 'prunable gitdir file points to non-existent location', '');
  return out.join('\n');
}

test('C: at 59G refuses, naming C:; 61G passes (the known positive and its control)', () => {
  const red = checkDisk(reading({ c: 59 }));
  assert.equal(red.ok, false);
  assert.match(red.reasons.join('\n'), /C: has 59\.0G available, under the 60G floor/);
  const green = checkDisk(reading({ c: 61 }));
  assert.equal(green.ok, true);
  assert.deepEqual(green.reasons, []);
});

test('/ at 39G refuses; 41G passes', () => {
  assert.match(checkDisk(reading({ root: 39 })).reasons.join('\n'), /\/ has 39\.0G available, under the 40G floor/);
  assert.equal(checkDisk(reading({ root: 41 })).ok, true);
});

test('seven built worktrees refuse; six pass; the main checkout never counts', () => {
  assert.match(checkDisk(reading({ built: 7 })).reasons.join('\n'), /7 built worktrees stand, over the 6 cap/);
  assert.equal(checkDisk(reading({ built: 6 })).ok, true);
  assert.equal(checkDisk(reading({ built: 0 })).built.length, 0);
});

test('thirteen Codex worktrees refuse; twelve pass', () => {
  assert.match(checkDisk(reading({ codex: 13 })).reasons.join('\n'), /13 Codex worktrees stand, over the 12 cap/);
  assert.equal(checkDisk(reading({ codex: 12 })).ok, true);
});

test('Codex-home worktrees in the git list count once, as Codex, never as built', () => {
  const text = ['worktree /main', 'HEAD a', 'branch refs/heads/x', '', 'worktree /home/u/.codex/worktrees/ab12/R', 'HEAD b', 'detached', ''].join('\n');
  const r = checkDisk(reading({ porcelain: text, env: { HOME: '/home/u' } }));
  assert.equal(r.built.length, 0);
});

test('prunable records list by path, stay out of the built count, and do not by themselves refuse', () => {
  const r = checkDisk(reading({ built: 2, prunable: 9 }));
  assert.equal(r.built.length, 2);
  assert.equal(r.prunable.length, 9);
  assert.equal(r.ok, true);
  assert.match(render(r), /prunable: \/gone\/0/);
});

test('absent /mnt/c skips the C: check by name, never silently', () => {
  const r = checkDisk(reading({ c: null }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.skipped, ['C: check skipped: no /mnt/c']);
  assert.match(render(r), /C: check skipped: no \/mnt\/c/);
});

test('limits come from env; defaults hold without it', () => {
  assert.deepEqual(readLimits({}), { minC: 60, minRoot: 40, maxBuilt: 6, maxCodex: 12 });
  assert.deepEqual(readLimits({ LARES_DISK_MIN_C_GB: '10', LARES_DISK_MIN_ROOT_GB: '5', LARES_DISK_MAX_WORKTREES: '2', LARES_DISK_MAX_CODEX: '3' }), { minC: 10, minRoot: 5, maxBuilt: 2, maxCodex: 3 });
  assert.equal(checkDisk(reading({ c: 59, env: { LARES_DISK_MIN_C_GB: '50' } })).ok, true);
  assert.equal(checkDisk(reading({ built: 3, env: { LARES_DISK_MAX_WORKTREES: '2' } })).ok, false);
  assert.throws(() => readLimits({ LARES_DISK_MIN_C_GB: 'lots' }), /LARES_DISK_MIN_C_GB/);
});

test('several reds all name themselves', () => {
  const r = checkDisk(reading({ c: 1, root: 1, built: 9, codex: 20 }));
  assert.equal(r.reasons.length, 4);
});

test('parseWorktrees drops the first record (the main checkout) and separates prunable', () => {
  const p = parseWorktrees(porcelain(2, 1));
  assert.deepEqual(p.built, ['/wt/0', '/wt/1']);
  assert.deepEqual(p.prunable, ['/gone/0']);
});
