import { spawnSync } from 'node:child_process';
import { exportTree } from './tree-export.mjs';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const GIT = '/usr/bin/git';
const TAR = '/usr/bin/tar';
const BWRAP = '/usr/bin/bwrap';
const CAP = 8192;

const HAVE_GIT = existsSync(GIT);
const HAVE_TAR = existsSync(TAR);

function capOutput(value) {
  return new TextDecoder().decode(Buffer.from(String(value ?? '')).subarray(0, CAP), { stream: true });
}

function mergeOutput(result) {
  return capOutput(`${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
}

function baseEnv(iso) {
  return {
    PATH: '/usr/bin:/bin',
    HOME: path.join(iso, 'home'),
    TMPDIR: path.join(iso, 'tmp'),
    XDG_CONFIG_HOME: path.join(iso, 'home'),
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_OPTIONAL_LOCKS: '0',
  };
}

function run(command, args, { env, cwd, input } = {}) {
  const result = spawnSync(command, args, {
    env,
    cwd,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ok: result.status === 0, output: mergeOutput(result), result };
}

export const HAVE_BWRAP = existsSync(BWRAP)
  && spawnSync(BWRAP, ['--ro-bind', '/', '/', '/usr/bin/true'], { stdio: 'ignore' }).status === 0;

export function signReceipt({ keyFile, tree, checks }) {
  const key = readFileSync(keyFile);
  const sorted = checks.slice().sort();
  const mac = createHmac('sha256', key).update(`${tree}\n${sorted.join(',')}`).digest('hex');
  return { tree, checks, mac };
}

async function extractTree({ gitDir, tree, to, iso }) {
  return exportTree({ gitDir, tree, to, iso });
}

export async function runCheckSeat({ gitDir, tree, checks, keyFile, receiptsDir, iso, bwrap, keepWork }) {
  if (!bwrap) return { ok: false, output: 'no wall available' };
  if (!HAVE_GIT || !HAVE_TAR || !HAVE_BWRAP) return { ok: false, output: 'no wall available' };

  mkdirSync(path.join(iso, 'tmp'), { recursive: true });
  mkdirSync(path.join(iso, 'home'), { recursive: true });

  const work = await mkdtemp(path.join(iso, 'tmp', 'check-seat-'));
  const treeDir = path.join(work, 'tree');
  const homeDir = path.join(work, 'home');
  mkdirSync(treeDir, { recursive: true });
  mkdirSync(homeDir, { recursive: true });

  let kept = false;
  try {
    const unpack = await extractTree({ gitDir, tree, to: treeDir, iso });
    if (!unpack.ok) return { ok: false, output: unpack.output };

    for (const check of checks ?? []) {
      if (!check || typeof check.name !== 'string' || !Array.isArray(check.argv) || check.argv.length === 0) {
        return { ok: false, output: `check ${check?.name ?? '<unknown>'} failed: invalid check argv` };
      }
      const args = [
        '--die-with-parent',
        '--new-session',
        '--unshare-pid',
        '--unshare-ipc',
        '--unshare-net',
        '--clearenv',
        '--ro-bind', '/usr', '/usr',
        '--symlink', 'usr/bin', '/bin',
        '--symlink', 'usr/lib', '/lib',
        '--symlink', 'usr/lib64', '/lib64',
        '--tmpfs', '/tmp',
        '--ro-bind', gitDir, gitDir,
        '--dev', '/dev',
        '--proc', '/proc',
        '--dir', '/work',
        '--bind', work, '/work',
        '--chdir', '/work/tree',
        '--setenv', 'PATH', '/usr/bin:/bin',
        '--setenv', 'HOME', '/work/home',
        '--setenv', 'LC_ALL', 'C',
        ...check.argv,
      ];
      const ran = run(BWRAP, args);
      if (!ran.ok) return { ok: false, output: `check ${check.name} failed: ${ran.output}` };
    }

    mkdirSync(receiptsDir, { recursive: true });
    const receipt = signReceipt({ keyFile, tree, checks: (checks ?? []).map((c) => c.name) });
    await writeFile(path.join(receiptsDir, `${tree}.json`), `${JSON.stringify(receipt)}\n`);
    if (keepWork) {
      kept = true;
      return { ok: true, output: '', work };
    }
    return { ok: true, output: '' };
  } finally {
    if (!kept) rmSync(work, { recursive: true, force: true });
  }
}

const ALLOWED_NPMRC = new Set([
  'registry',
  'store-dir',
  'strict-peer-dependencies',
  'auto-install-peers',
  'shamefully-hoist',
  'node-linker',
  'public-hoist-pattern',
]);

function parseNpmrcKeys(text) {
  const keys = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    keys.push(line.slice(0, idx).trim());
  }
  return keys;
}

/** The home's credential dirs read empty and its credential files read as /dev/null; only what exists, since a bind needs its target. */
function hideCredentials() {
  const home = os.userInfo().homedir, out = [];
  const real = (p) => { try { return realpathSync(p); } catch { return null; } };
  for (const d of ['.ssh', '.gnupg', '.aws', '.config', '.codex', '.claude', '.azure', '.kube']) { const r = real(path.join(home, d)); if (r && statSync(r).isDirectory()) out.push('--tmpfs', r); }
  for (const f of ['.netrc', '.npmrc', '.git-credentials']) { const r = real(path.join(home, f)); if (r && statSync(r).isFile()) out.push('--ro-bind', '/dev/null', r); }
  return out;
}

export async function runInstallSeat({ worktree, gitDir, installer, storeDir, iso, protect = [], env, extraRw = [], bwrap = HAVE_BWRAP }) {
  void env;
  if (!bwrap || !HAVE_BWRAP) return { ok: false, output: 'no wall available' };

  const npmrc = path.join(worktree, '.npmrc');
  if (existsSync(npmrc)) {
    const keys = parseNpmrcKeys(await readFile(npmrc, 'utf8'));
    for (const key of keys) {
      if (!ALLOWED_NPMRC.has(key)) return { ok: false, output: `disallowed .npmrc key: ${key}` };
    }
  }

  mkdirSync(path.join(iso, 'home'), { recursive: true });
  mkdirSync(path.join(iso, 'tmp'), { recursive: true });

  const args = [
    '--die-with-parent',
    '--unshare-net',
    '--unshare-pid',
    '--clearenv',
    '--ro-bind', '/', '/',
    ...extraRw.flatMap((p) => ['--bind', p, p]),
    '--bind', worktree, worktree,
    '--bind', storeDir, storeDir,
    '--ro-bind', gitDir, gitDir,
    ...protect.flatMap((p) => ['--ro-bind', p, p]),
    ...hideCredentials(),
    '--dev', '/dev',
    '--proc', '/proc',
    '--chdir', worktree,
    '--setenv', 'PATH', `/usr/bin:/bin:${path.dirname(installer)}`,
    '--setenv', 'HOME', path.join(iso, 'home'),
    '--setenv', 'LC_ALL', 'C',
    installer,
    'install',
    '--offline',
    '--frozen-lockfile',
    '--ignore-scripts',
    '--store-dir',
    storeDir,
  ];

  const ran = run(BWRAP, args);
  return { ok: ran.ok, output: ran.output };
}
