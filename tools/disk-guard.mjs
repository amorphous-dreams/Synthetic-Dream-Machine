#!/usr/bin/env node
/**
 * disk-guard — refuse new bulk when the disk beneath the house runs low.
 *
 * The WSL VHD never shrinks and sits on a C: drive that Linux cannot see filling: `df /` read 85% free while C: ran
 * out twice. This guard reads C: (when /mnt/c stands) and /, counts the built worktrees git lists (the main checkout
 * excluded) and the Codex worktree directories, and reds on any limit. Every reader injects, so a test never touches
 * the real disk. Limits come from the environment:
 *   LARES_DISK_MIN_C_GB (60) · LARES_DISK_MIN_ROOT_GB (40) · LARES_DISK_MAX_WORKTREES (6) · LARES_DISK_MAX_CODEX (12)
 */
import { readdirSync, statfsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GB = 1024 ** 3;
const C_MOUNT = '/mnt/c';
export const SKIP_C = 'C: check skipped: no /mnt/c';

const LIMIT_ENV = [
  ['minC', 'LARES_DISK_MIN_C_GB', 60],
  ['minRoot', 'LARES_DISK_MIN_ROOT_GB', 40],
  ['maxBuilt', 'LARES_DISK_MAX_WORKTREES', 6],
  ['maxCodex', 'LARES_DISK_MAX_CODEX', 12],
];

export function readLimits(env = process.env) {
  const limits = {};
  for (const [key, name, fallback] of LIMIT_ENV) {
    const raw = env[name];
    if (raw === undefined || raw === '') { limits[key] = fallback; continue; }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must read a non-negative number; got "${raw}"`);
    limits[key] = value;
  }
  return limits;
}

/** The first record of `git worktree list --porcelain` names the main checkout; the rest stand built or prunable. */
export function parseWorktrees(text) {
  const records = String(text).split(/\n\s*\n/).map(block => block.split('\n').filter(Boolean)).filter(lines => lines.length);
  const built = [], prunable = [];
  for (const lines of records.slice(1)) {
    const path = lines.find(line => line.startsWith('worktree '))?.slice('worktree '.length);
    if (!path) continue;
    if (lines.some(line => line === 'prunable' || line.startsWith('prunable '))) prunable.push(path);
    else built.push(path);
  }
  return { built, prunable };
}

function availableGb(statfs, path) {
  const stat = statfs(path);
  return stat ? (Number(stat.bavail) * Number(stat.bsize)) / GB : null;
}

const realReaders = {
  statfs: path => { try { return statfsSync(path); } catch { return null; } },
  worktreeList: () => {
    const result = spawnSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return result.status === 0 ? result.stdout : '';
  },
  codexDirs: home => {
    try { return readdirSync(join(home, '.codex', 'worktrees'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name); }
    catch { return []; }
  },
  env: process.env,
};

export function checkDisk(readers = {}) {
  const { statfs, worktreeList, codexDirs, env } = { ...realReaders, ...readers };
  const limits = readLimits(env);
  const home = env.HOME || homedir();
  const codexRoot = join(home, '.codex', 'worktrees') + sep;
  const cFree = availableGb(statfs, C_MOUNT);
  const rootFree = availableGb(statfs, '/');
  const listed = parseWorktrees(worktreeList());
  const built = listed.built.filter(path => !resolve(path).startsWith(codexRoot));
  const codex = codexDirs(home);
  const reasons = [], skipped = [];
  if (cFree === null) skipped.push(SKIP_C);
  else if (cFree < limits.minC) reasons.push(`C: has ${cFree.toFixed(1)}G available, under the ${limits.minC}G floor`);
  if (rootFree === null) skipped.push('/ check skipped: statfs unreadable');
  else if (rootFree < limits.minRoot) reasons.push(`/ has ${rootFree.toFixed(1)}G available, under the ${limits.minRoot}G floor`);
  if (built.length > limits.maxBuilt) reasons.push(`${built.length} built worktrees stand, over the ${limits.maxBuilt} cap`);
  if (codex.length > limits.maxCodex) reasons.push(`${codex.length} Codex worktrees stand, over the ${limits.maxCodex} cap`);
  return { ok: reasons.length === 0, reasons, skipped, cFree, rootFree, built, codex, prunable: listed.prunable, limits };
}

export function render(result) {
  const lines = [];
  const free = value => (value === null ? 'unread' : `${value.toFixed(1)}G`);
  lines.push(`C: free ${free(result.cFree)} (floor ${result.limits.minC}G) · / free ${free(result.rootFree)} (floor ${result.limits.minRoot}G)`);
  lines.push(`built worktrees ${result.built.length}/${result.limits.maxBuilt} · Codex worktrees ${result.codex.length}/${result.limits.maxCodex} · prunable records ${result.prunable.length}`);
  for (const path of result.prunable) lines.push(`prunable: ${path}`);
  for (const note of result.skipped) lines.push(note);
  for (const reason of result.reasons) lines.push(`RED: ${reason}`);
  lines.push(result.ok ? 'disk-guard: ok' : 'disk-guard: refuse');
  return lines.join('\n');
}

/** Throws with every reason named; provision-worktree calls this before `git worktree add`. */
export function assertDisk(readers) {
  const result = checkDisk(readers);
  if (!result.ok) throw new Error(`disk-guard refuses: ${result.reasons.join('; ')}`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkDisk();
    console.log(render(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
