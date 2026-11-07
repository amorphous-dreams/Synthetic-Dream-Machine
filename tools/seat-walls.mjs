import { spawn, spawnSync } from 'node:child_process';
import { exportTree } from './tree-export.mjs';
import { openHeldSync, readHeld } from './held-dir.mjs';
import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const GIT = '/usr/bin/git';
const TAR = '/usr/bin/tar';
const BWRAP = '/usr/bin/bwrap';
const CAP = 8192;

const HAVE_GIT = existsSync(GIT); // broker-owned
const HAVE_TAR = existsSync(TAR); // broker-owned

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

export const HAVE_BWRAP = !process.env.SEAT_WALLS_NO_BWRAP && existsSync(BWRAP) // broker-owned
  && spawnSync(BWRAP, ['--unshare-pid', '--die-with-parent', '--dev-bind', '/', '/', '--proc', '/proc', '/usr/bin/true'], { stdio: 'ignore' }).status === 0;

/** The mac covers the tree, the check names AND the check definitions (name and argv), so a receipt earned under a weaker check never satisfies a changed one. */
export function signReceipt({ key, tree, checks, definitions = [] }) {
  if (!Buffer.isBuffer(key) || key.length < 32) throw new Error('receipt key must be at least 32 bytes held in memory');
  const sorted = checks.slice().sort();
  const defs = createHash('sha256').update(JSON.stringify(definitions.map((d) => [d.name, d.argv]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))).digest('hex');
  const mac = createHmac('sha256', key).update(`${tree}\n${sorted.join(',')}\n${defs}`).digest('hex');
  return { tree, checks, mac };
}

async function extractTree({ gitDir, tree, to, iso }) {
  return exportTree({ gitDir, tree, to, iso });
}

export async function runCheckSeat({ gitDir, tree, checks, key, receipts, iso, bwrap, keepWork }) {
  const named = (checks ?? []).map((c) => c?.name).join(', ') || '<none>';
  if (!bwrap || !HAVE_GIT || !HAVE_TAR || !HAVE_BWRAP) return { ok: false, output: `no wall available: refusing to run check ${named} unwalled` };

  mkdirSync(path.join(iso, 'tmp'), { recursive: true }); // broker-owned
  mkdirSync(path.join(iso, 'home'), { recursive: true }); // broker-owned

  const work = await mkdtemp(path.join(iso, 'tmp', 'check-seat-')); // broker-owned
  const treeDir = path.join(work, 'tree');
  const scratchDir = path.join(work, 'scratch');
  mkdirSync(treeDir, { recursive: true }); // broker-owned
  mkdirSync(scratchDir, { recursive: true }); // broker-owned

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
        '--ro-bind', treeDir, '/work/tree',
        '--bind', scratchDir, '/work/scratch',
        '--chdir', '/work/tree',
        '--setenv', 'PATH', '/usr/bin:/bin',
        '--setenv', 'HOME', '/work/scratch',
        '--setenv', 'LC_ALL', 'C',
        ...check.argv,
      ];
      const ran = run(BWRAP, args);
      if (!ran.ok) return { ok: false, output: `check ${check.name} failed: ${ran.output}` };
    }

    // The receipt lives in the broker's memory under a key that never touched disk: a lead can neither read the key nor plant a receipt.
    receipts.set(tree, signReceipt({ key, tree, checks: (checks ?? []).map((c) => c.name), definitions: checks ?? [] }));
    if (keepWork) {
      kept = true;
      return { ok: true, output: '', work };
    }
    return { ok: true, output: '' };
  } finally {
    if (!kept) rmSync(work, { recursive: true, force: true }); // broker-owned
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
  const real = (p) => { try { return realpathSync(p); } catch { return null; } }; // broker-owned
  for (const d of ['.ssh', '.gnupg', '.aws', '.config', '.codex', '.claude', '.azure', '.kube']) { const r = real(path.join(home, d)); if (r && statSync(r).isDirectory()) out.push('--tmpfs', r); } // broker-owned
  for (const f of ['.netrc', '.npmrc', '.git-credentials']) { const r = real(path.join(home, f)); if (r && statSync(r).isFile()) out.push('--ro-bind', '/dev/null', r); } // broker-owned
  return out;
}

/**
 * The install seat. The worktree (and the store, the git dir, every extra root, every protected path) is HELD open once and bound
 * into the wall by bubblewrap's fd binds (`--bind-fd`, `--ro-bind-fd`), so a parent a lead swaps after validation changes
 * nothing: the installer gets exactly the directories that were opened. `.npmrc` is read through the held worktree handle with
 * O_NOFOLLOW before the wall opens (a symlink there refuses by name).
 */
export async function runInstallSeat({ worktree, worktreeHeld, gitDir, installer, storeDir, iso, protect = [], env, extraRw = [], bwrap = HAVE_BWRAP }) {
  void env;
  const label = worktree ?? "the held worktree";
  if (!bwrap || !HAVE_BWRAP) return { ok: false, output: `no wall available: refusing to run the install of ${installer} in ${label} unwalled` };
  const opened = [];
  const hold = (dir) => { const h = openHeldSync(dir, dir); opened.push(h); return h; }; // broker-owned: a controller-supplied path, verified as a real directory
  try {
    const wt = worktreeHeld ?? hold(worktree);
    let npmrc = null;
    try { npmrc = readHeld(wt, '.npmrc'); } catch (error) { if (!/ENOENT/.test(error.message)) return { ok: false, output: `.npmrc refused: ${error.message}` }; }
    if (npmrc !== null) {
      for (const key of parseNpmrcKeys(npmrc)) {
        if (!ALLOWED_NPMRC.has(key)) return { ok: false, output: `disallowed .npmrc key: ${key}` };
      }
    }

    mkdirSync(path.join(iso, 'home'), { recursive: true }); // broker-owned
    mkdirSync(path.join(iso, 'tmp'), { recursive: true }); // broker-owned
    // A protected path reads as an empty read-only directory: the controller's go, key and receipts stay unreadable and unwritable.
    const emptyDir = path.join(iso, 'empty'); mkdirSync(emptyDir, { recursive: true }); // broker-owned
    const empty = hold(emptyDir);
    const fds = [];
    const bind = (flag, held, dest) => { fds.push(held.fd); return [flag, String(2 + fds.length), dest]; };
    // With only a held handle (no path), the worktree mounts at a neutral place inside a tmpfs; a given path keeps its own name inside the wall.
    const dest = worktree ?? '/mnt/worktree';
    const args = [
      '--die-with-parent',
      '--unshare-net',
      '--unshare-pid',
      '--clearenv',
      '--ro-bind', '/', '/',
      ...(worktree ? [] : ['--tmpfs', '/mnt']),
      ...extraRw.flatMap((p) => bind('--bind-fd', hold(p), p)),
      ...bind('--bind-fd', wt, dest),
      ...bind('--bind-fd', hold(storeDir), storeDir),
      ...bind('--ro-bind-fd', hold(gitDir), gitDir),
      ...protect.flatMap((p) => bind('--ro-bind-fd', empty, p)),
      ...hideCredentials(),
      '--dev', '/dev',
      '--proc', '/proc',
      '--chdir', dest,
      '--setenv', 'PATH', `/usr/bin:/bin:${path.dirname(installer)}`,
      '--setenv', 'HOME', path.join(iso, 'home'),
      '--setenv', 'LC_ALL', 'C',
      installer,
      'install',
      '--offline',
      '--frozen-lockfile',
      '--ignore-scripts',
      '--ignore-pnpmfile',
      '--store-dir',
      storeDir,
    ];
    const ran = spawnSync(BWRAP, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe', ...fds] });
    return { ok: ran.status === 0, output: capOutput(`${ran.stdout ?? ''}${ran.stderr ?? ''}${ran.error ? String(ran.error) : ''}`) };
  } finally { for (const h of opened) h.close(); }
}

/** Validate the test request before opening the execution boundary. */
export async function runTestSeat({ worktreeHeld, laneHeld, runner, files }) {
  if (!['node', 'vitest'].includes(runner)) return { ok: false, output: `refused: unknown runner ${String(runner)}` };
  if (!Array.isArray(files) || files.length === 0 || files.some((f) => typeof f !== 'string' || !f)) return { ok: false, output: 'refused: nonempty named files required' };
  for (const file of files) {
    if (path.isAbsolute(file)) return { ok: false, output: `refused: absolute path ${file}` };
    if (file.includes('\0') || file.startsWith('-')) return { ok: false, output: `refused: invalid file ${file}` };
    if (file.split('/').includes('..')) return { ok: false, output: `refused: parent traversal ${file}` };
    if (/[*?\[\]{}]/.test(file)) return { ok: false, output: `refused: glob ${file}` };
  }
  const refuse = message => ({ ok: false, output: `refused: ${message}` });
  let root;
  try {
    root = realpathSync(worktreeHeld.at());
    for (const file of files) {
      const resolved = realpathSync(worktreeHeld.at(file));
      if (!resolved.startsWith(`${root}${path.sep}`)) return refuse(`symlink leaves worktree: ${file}`);
      if (!statSync(worktreeHeld.at(file)).isFile()) return refuse(`not a file: ${file}`);
    }
  } catch (error) { return refuse(`invalid file: ${error.message}`); }
  if (!HAVE_BWRAP) return refuse('no test wall available');

  // Resolve the nearest package for each file through the held worktree; one vitest invocation has one package cwd.
  let packageDir = '.', vitestPath;
  if (runner === 'vitest') {
    const packages = [];
    for (const file of files) {
      let dir = path.dirname(path.normalize(file));
      while (true) {
        try {
          const packageFile = path.join(dir, 'package.json');
          const resolved = realpathSync(worktreeHeld.at(packageFile));
          if (!resolved.startsWith(`${root}${path.sep}`)) return refuse(`symlink leaves worktree: ${packageFile}`);
          if (statSync(worktreeHeld.at(packageFile)).isFile()) { packages.push(dir); break; }
        } catch (error) { if (error.code !== 'ENOENT') return refuse(`package lookup: ${error.message}`); }
        if (dir === '.') return refuse(`no package for ${file}`);
        dir = path.dirname(dir);
      }
    }
    if (packages.some(dir => dir !== packages[0])) return refuse('files belong to different packages');
    packageDir = packages[0];
    let packageName = packageDir;
    try { packageName = JSON.parse(readFileSync(worktreeHeld.at(path.join(packageDir, 'package.json')), 'utf8')).name || packageDir; }
    catch (error) { return refuse(`package lookup: ${error.message}`); }
    vitestPath = path.join(packageDir, 'node_modules/vitest/vitest.mjs');
    try {
      const resolved = realpathSync(worktreeHeld.at(vitestPath));
      if (!resolved.startsWith(`${root}${path.sep}`)) return refuse(`symlink leaves worktree: ${vitestPath}`);
      if (!statSync(worktreeHeld.at(vitestPath)).isFile()) return refuse(`vitest not installed for ${packageName}`);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return refuse(`vitest not installed for ${packageName}`);
      return refuse(`vitest lookup: ${error.message}`);
    }
  }

  const nvm = path.join(os.userInfo().homedir, '.nvm');
  const node = process.execPath;
  if (!node.startsWith(`${nvm}${path.sep}`)) return refuse('Node toolchain outside ~/.nvm');
  const scratch = await mkdtemp(laneHeld.at('test-seat-'));
  let scratchHeld;
  try {
    scratchHeld = openHeldSync(scratch, laneHeld.at());
    mkdirSync(scratchHeld.at('home'));
    mkdirSync(scratchHeld.at('lar-root'));
    const bin = path.dirname(node);
    const args = [
      '--die-with-parent', '--unshare-pid', '--unshare-net', '--clearenv',
      '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
      '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
      '--dir', '/etc', '--ro-bind', '/etc/ssl', '/etc/ssl',
      '--tmpfs', '/tmp', '--dev', '/dev', '--proc', '/proc',
      '--ro-bind', nvm, nvm,
      '--bind-fd', '3', '/work', '--bind-fd', '4', '/scratch',
      '--chdir', path.posix.join('/work', packageDir),
      '--setenv', 'PATH', `${bin}:/usr/bin:/bin`, '--setenv', 'HOME', '/scratch/home',
      '--setenv', 'LAR_ROOT', '/scratch/lar-root', '--setenv', 'TMPDIR', '/tmp', '--setenv', 'LC_ALL', 'C',
      ...(runner === 'node'
        ? [node, '--test', '--test-reporter=tap', '--', ...files.map(f => path.posix.join('/work', f))]
        : [node, path.posix.join('/work', vitestPath), 'run', '--reporter=json', '--outputFile=/scratch/vitest.json', '--root', path.posix.join('/work', packageDir), '--', ...files.map(f => path.posix.join('/work', f))]),
    ];
    const result = await new Promise(resolve => {
      const child = spawn(BWRAP, args, { stdio: ['ignore', 'pipe', 'pipe', worktreeHeld.fd, scratchHeld.fd] });
      let output = '', stderrTail = Buffer.alloc(0), overflow = false;
      const append = chunk => { output += chunk; if (output.length > 16 * 1024 * 1024) { overflow = true; output = output.slice(-8192); } };
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', append); child.stderr.on('data', chunk => { append(chunk); stderrTail = Buffer.concat([stderrTail, Buffer.from(chunk)]).subarray(-2048); });
      child.on('error', error => resolve({ error, output, stderrTail }));
      child.on('close', (code, signal) => resolve({ code, signal, output, overflow, stderrTail }));
    });
    const childRefuse = message => ({ ok: false, exitCode: result.code ?? null, output: `refused: ${message}; exitCode: ${result.code ?? 'null'}; stderr tail: ${result.stderrTail.toString('utf8')}` });
    if (result.error || result.signal || result.code === null || result.overflow) return childRefuse(`test execution failed: ${result.error?.message ?? result.signal ?? 'output overflow'}`);
    let pass, fail, skip;
    try {
      if (runner === 'node') {
        const readCount = name => {
          const matches = [...result.output.matchAll(new RegExp(`^# ${name} (\\d+)\\s*$`, 'gm'))];
          if (matches.length !== 1) throw new Error(`missing or ambiguous ${name}`);
          return Number(matches[0][1]);
        };
        const tests = readCount('tests');
        pass = readCount('pass'); fail = readCount('fail'); skip = readCount('skipped');
        if (!Number.isSafeInteger(tests) || tests < 0) throw new Error('invalid counts');
      } else {
        const report = JSON.parse(readHeld(scratchHeld, 'vitest.json'));
        pass = report.numPassedTests; fail = report.numFailedTests; skip = report.numPendingTests;
      }
      if (![pass, fail, skip].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('invalid counts');
    } catch (error) { return childRefuse(`unparseable ${runner} output: ${error.message}`); }
    return { ok: true, runner, files, pass, fail, skip, exitCode: result.code, logTail: result.output.slice(-8192) };
  } finally {
    scratchHeld?.close();
    rmSync(laneHeld.at(path.basename(scratch)), { recursive: true, force: true });
  }
}
