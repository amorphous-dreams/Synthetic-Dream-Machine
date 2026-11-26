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
  landed: head => (over.landed ?? []).includes(head),
  codexDirs: () => Array.from({ length: (over.codex ?? 0) + (over.codexEmpty ?? 0) }, (_, i) => ({ name: `c${i}`, empty: i >= (over.codex ?? 0), mtimeMs: Date.UTC(2026, 9, 10 + (i % 5)) })),
  env: { HOME: '/home/u', ...(over.env ?? {}) },
  ...over.extra,
});
function porcelain(built, prunable, root = '/home/u/.lares-scratch/wt') {
  const over_root = root;
  const out = ['worktree /main', 'HEAD aaa', 'branch refs/heads/x', ''];
  for (let i = 0; i < built; i++) out.push(`worktree ${over_root}/${i}`, `HEAD bbb${i}`, `branch refs/heads/lane/${i}`, '');
  for (let i = 0; i < prunable; i++) out.push(`worktree /gone/${i}`, 'HEAD ccc', 'detached', 'prunable gitdir file points to non-existent location', '');
  return out.join('\n');
}

test('C: at 34G refuses, naming C:; 36G passes (the known positive and its control)', () => {
  const red = checkDisk(reading({ c: 34 }));
  assert.equal(red.ok, false);
  assert.match(red.reasons.join('\n'), /C: has 34\.0G available, under the 35G floor/);
  const green = checkDisk(reading({ c: 36 }));
  assert.equal(green.ok, true);
  assert.deepEqual(green.reasons, []);
});

test('/ at 39G refuses; 41G passes', () => {
  assert.match(checkDisk(reading({ root: 39 })).reasons.join('\n'), /\/ has 39\.0G available, under the 40G floor/);
  assert.equal(checkDisk(reading({ root: 41 })).ok, true);
});

test('eleven unlanded lanes refuse, naming count, lanes and cure; ten pass; the main checkout never counts', () => {
  const r = checkDisk(reading({ built: 11 }));
  assert.equal(r.ok, false);
  const text = r.reasons.join('\n');
  assert.match(text, /11 active spirit lanes stand, over the 10 cap/);
  assert.match(text, /\/home\/u\/\.lares-scratch\/wt\/0/);
  assert.match(text, /git worktree remove/);
  assert.match(text, /land a lane/);
  assert.equal(checkDisk(reading({ built: 10 })).ok, true);
  assert.equal(checkDisk(reading({ built: 0 })).built.length, 0);
});

test('seven trees elsewhere plus one house tree pass, and list the elsewhere ones as not the house\'s', () => {
  const elsewhere = Array.from({ length: 7 }, (_, i) => `/srv/elsewhere/e${i}`);
  const text = ['worktree /main', 'HEAD a', 'detached', '', ...elsewhere.flatMap(p => [`worktree ${p}`, 'HEAD b', 'detached', '']), 'worktree /home/u/.lares-scratch/x/wt', 'HEAD c', 'branch refs/heads/lane/x', ''].join('\n');
  const r = checkDisk(reading({ porcelain: text }));
  assert.equal(r.ok, true);
  assert.equal(r.built.length, 1);
  assert.deepEqual(r.notHouse, elsewhere);
  assert.match(render(r), /not the house's: \/srv\/elsewhere\/e0/);
});

test('thirteen non-empty Codex dirs refuse with count and oldest date; twelve pass', () => {
  const r = checkDisk(reading({ codex: 13 }));
  assert.equal(r.ok, false);
  assert.match(r.reasons.join('\n'), /13 Codex worktrees stand, oldest 2026-10-10, over the 12 cap/);
  assert.equal(checkDisk(reading({ codex: 12 })).ok, true);
});

test('99 Codex dirs of which 63 stand empty count as 36 and refuse; 12 plus 87 empty pass', () => {
  const r = checkDisk(reading({ codex: 36, codexEmpty: 63 }));
  assert.equal(r.codex.length, 36);
  assert.equal(r.ok, false);
  assert.equal(checkDisk(reading({ codex: 12, codexEmpty: 87 })).ok, true);
});

test('Codex-home worktrees in the git list never count as house or elsewhere', () => {
  const text = ['worktree /main', 'HEAD a', 'branch refs/heads/x', '', 'worktree /home/u/.codex/worktrees/ab12/R', 'HEAD b', 'detached', ''].join('\n');
  const r = checkDisk(reading({ porcelain: text, env: { HOME: '/home/u' } }));
  assert.equal(r.built.length, 0);
  assert.equal(r.notHouse.length, 0);
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
  assert.deepEqual(readLimits({}), { minC: 35, minRoot: 40, maxSpirits: 10, maxCodex: 12 });
  assert.deepEqual(readLimits({ LARES_DISK_MIN_C_GB: '10', LARES_DISK_MIN_ROOT_GB: '5', LARES_DISK_MAX_SPIRITS: '2', LARES_DISK_MAX_CODEX: '3' }), { minC: 10, minRoot: 5, maxSpirits: 2, maxCodex: 3 });
  assert.equal(checkDisk(reading({ c: 59, env: { LARES_DISK_MIN_C_GB: '50' } })).ok, true);
  assert.equal(checkDisk(reading({ built: 3, env: { LARES_DISK_MAX_SPIRITS: '2' } })).ok, false);
  assert.equal(checkDisk(reading({ codex: 5, env: { LARES_DISK_MAX_CODEX: '3' } })).ok, false);
  assert.throws(() => readLimits({ LARES_DISK_MIN_C_GB: 'lots' }), /LARES_DISK_MIN_C_GB/);
});

test('several reds all name themselves', () => {
  const r = checkDisk(reading({ c: 1, root: 1, built: 12, codex: 20 }));
  assert.equal(r.reasons.length, 4);
});

test('parseWorktrees drops the first record (the main checkout) and separates prunable', () => {
  const p = parseWorktrees(porcelain(2, 1));
  assert.deepEqual(p.built, ['/home/u/.lares-scratch/wt/0', '/home/u/.lares-scratch/wt/1']);
  assert.deepEqual(p.prunable, ['/gone/0']);
});

test('lane branches count wherever located, including the main record and Codex trees', () => {
  const paths = ['/main', '/home/u/.claude/worktrees/a', '/other/b', '/home/u/.codex/worktrees/c/r'];
  const text = paths.flatMap((p, i) => [`worktree ${p}`, 'HEAD a', `branch refs/heads/${i === 2 ? 'develop--x' : 'lane/x' + i}`, '']).join('\n');
  const r = checkDisk(reading({ porcelain: text, env: { LARES_DISK_MAX_SPIRITS: '3' } }));
  assert.deepEqual(r.built, paths);
  assert.equal(r.ok, false);
});

test('landed benches read as ash and never count; their unlanded siblings still do', () => {
  const heads = Array.from({ length: 14 }, (_, i) => `bbb${i}`);
  const r = checkDisk(reading({ built: 14, landed: heads.slice(0, 5) }));
  assert.equal(r.built.length, 9);
  assert.equal(r.landed.length, 5);
  assert.equal(r.ok, true);
  assert.match(render(r), /ash \(landed\): \/home\/u\/\.lares-scratch\/wt\/0/);
  assert.equal(checkDisk(reading({ built: 14, landed: heads.slice(0, 2) })).ok, false);
});

test('a detached bench under .worktrees or .claude/worktrees counts by its head; landed, it does not', () => {
  const text = ['worktree /main', 'HEAD a', 'branch refs/heads/x', '',
    'worktree /r/.worktrees/pet', 'HEAD h1', 'detached', '',
    'worktree /r/.claude/worktrees/agent-1', 'HEAD h2', 'detached', '',
    'worktree /r/.worktrees/old', 'HEAD h3', 'branch refs/heads/spirit/old', ''].join('\n');
  const r = checkDisk(reading({ porcelain: text, landed: ['h3'] }));
  assert.deepEqual(r.built, ['/r/.worktrees/pet', '/r/.claude/worktrees/agent-1']);
  assert.deepEqual(r.landed, ['/r/.worktrees/old']);
});
