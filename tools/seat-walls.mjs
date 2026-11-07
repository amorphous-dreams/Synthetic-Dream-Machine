import { spawn, spawnSync } from 'node:child_process';
import { killGroup } from './launch-codex.mjs';
import { exportTree } from './tree-export.mjs';
import { openHeldSync, readHeld } from './held-dir.mjs';
import { createHash, createHmac } from 'node:crypto';
import { closeSync, constants as FS, existsSync, fchmodSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, rmdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
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
  // Walk only from held directories; inspect an ENOTDIR component without following it.
  const openWorktreeFile = (name, use) => {
    const opened = [];
    try {
      let parent = worktreeHeld.fd;
      const parts = name.split('/').filter(part => part && part !== '.');
      if (!parts.length) throw Object.assign(new Error('not a file'), { code: 'ENOTDIR' });
      for (const [index, part] of parts.entries()) {
        let fd;
        try {
          fd = openSync(`/proc/self/fd/${parent}/${part}`, FS.O_RDONLY | FS.O_NOFOLLOW | FS.O_NONBLOCK | (index < parts.length - 1 ? FS.O_DIRECTORY : 0));
        } catch (error) {
          if (error.code === 'ENOTDIR') {
            let probe;
            try {
              probe = openSync(`/proc/self/fd/${parent}/${part}`, 0x200000 | FS.O_NOFOLLOW); // Linux O_PATH
              if (fstatSync(probe).isSymbolicLink()) error.code = 'ELOOP';
            } catch {} finally { if (probe !== undefined) closeSync(probe); }
          }
          throw error;
        }
        opened.push(fd); parent = fd;
      }
      return use(parent, fstatSync(parent));
    } finally { for (const fd of opened.reverse()) closeSync(fd); }
  };
  try {
    for (const file of files) {
      try {
        if (!openWorktreeFile(file, (_fd, stat) => stat.isFile())) return refuse(`not a file: ${file}`);
      } catch (error) {
        if (error.code === 'ELOOP') return refuse(`symlink: ${file}`);
        throw error;
      }
    }
  } catch (error) { return refuse(`invalid file: ${error.message}`); }
  if (!HAVE_BWRAP) return refuse('no test wall available');

  // Resolve the nearest package for each file through the held worktree; one vitest invocation has one package cwd.
  let packageDir = '.', vitestPath, build;
  if (runner === 'vitest') {
    const packages = [];
    for (const file of files) {
      let dir = path.dirname(path.normalize(file));
      while (true) {
        const packageFile = path.join(dir, 'package.json');
        try {
          const packageData = openWorktreeFile(packageFile, (fd, stat) => {
            if (!stat.isFile()) throw new Error('not a file');
            return readFileSync(`/proc/self/fd/${fd}`, 'utf8');
          });
          packages.push({ dir, packageData });
          break;
        } catch (error) {
          if (error.code === 'ELOOP') return refuse(`symlink: ${packageFile}`);
          if (error.code !== 'ENOENT') return refuse('package.json unreadable');
        }
        if (dir === '.') return refuse(`no package for ${file}`);
        dir = path.dirname(dir);
      }
    }
    if (packages.some(pkg => pkg.dir !== packages[0].dir)) return refuse('files belong to different packages');
    packageDir = packages[0].dir;
    try { build = JSON.parse(packages[0].packageData).scripts?.build; if (build !== undefined && typeof build !== 'string') throw new Error('invalid build'); }
    catch { return refuse('package.json unreadable'); }
    vitestPath = path.join(packageDir, 'node_modules/vitest/vitest.mjs');
  }

  const node = process.execPath;
  const nodeVersion = path.dirname(path.dirname(node));
  const nodeVersionReal = realpathSync(nodeVersion); // broker-owned: derived solely from process.execPath
  const inside = (child, parent) => child === parent || child.startsWith(parent === path.sep ? parent : `${parent}${path.sep}`);
  for (const [name, held] of [['worktree', worktreeHeld], ['lane root', laneHeld]]) {
    if (inside(nodeVersionReal, realpathSync(held.at()))) return refuse(`Node toolchain inside ${name}`);
  }
  const scratch = await mkdtemp(laneHeld.at('test-seat-'));
  let scratchHeld, gitFd;
  try {
    try {
      gitFd = openSync(worktreeHeld.at('.git'), FS.O_RDONLY | FS.O_NOFOLLOW);
      const gitStat = fstatSync(gitFd);
      if (!gitStat.isFile() && !gitStat.isDirectory()) return refuse('worktree .git must be a file or directory');
    } catch (error) {
      if (error.code === 'ENOENT') return refuse('worktree holds no .git');
      return refuse('worktree .git unreadable');
    }
    scratchHeld = openHeldSync(scratch, laneHeld.at());
    if (inside(nodeVersionReal, realpathSync(scratchHeld.at()))) return refuse('Node toolchain inside scratch directory');
    mkdirSync(scratchHeld.at('home'));
    mkdirSync(scratchHeld.at('lar-root'));
    const bin = path.dirname(node);
    // One wall owns build -> stamp -> test. A failed build never reaches Vitest or earns a fresh stamp.
    // Positional argv carries the manifest script and test names; no filename enters shell source.
    const packageTest = `
      const { spawnSync } = require('node:child_process');
      const { writeFileSync } = require('node:fs');
      const [build, packageDir, vitest, ...files] = process.argv.slice(1);
      if (build) {
        const built = spawnSync('/bin/sh', ['-c', build], { stdio: 'inherit' });
        if (built.error) console.error(built.error.message);
        if (built.status !== 0) process.exit(built.status || 1);
        if (/^packages\\/[^/]+$/.test(packageDir)) {
          const stamped = spawnSync(process.execPath, ['/work/tools/stamp-build.mjs', '/work', '--pkg', packageDir.slice(9)], { stdio: 'inherit' });
          if (stamped.error) console.error(stamped.error.message);
          if (stamped.status !== 0) process.exit(stamped.status || 1);
        }
      }
      writeFileSync('/scratch/build-ok', 'built'); // broker-owned: wall-side script; /scratch binds scratchHeld.fd, never a host pathname
      const tested = spawnSync(process.execPath, [vitest, 'run', '--reporter=json', '--outputFile=/scratch/vitest.json', '--reporter=dot', '--root', process.cwd(), ...files], { stdio: 'inherit' });
      if (tested.error) console.error(tested.error.message);
      process.exit(tested.status ?? 1);
    `;
    const args = [
      '--die-with-parent', '--new-session', '--unshare-pid', '--unshare-ipc', '--unshare-net', '--clearenv',
      '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
      '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
      '--dir', '/etc', '--ro-bind', '/etc/ssl', '/etc/ssl',
      '--tmpfs', '/tmp', '--dev', '/dev', '--proc', '/proc',
      '--ro-bind', nodeVersion, nodeVersion,
      '--bind-fd', '3', '/work', '--ro-bind-fd', '5', '/work/.git', '--bind-fd', '4', '/scratch',
      '--chdir', path.posix.join('/work', packageDir),
      '--setenv', 'PATH', `${path.posix.join('/work', packageDir, 'node_modules/.bin')}:/work/node_modules/.bin:${bin}:/usr/bin:/bin`, '--setenv', 'HOME', '/scratch/home',
      '--setenv', 'LAR_ROOT', '/scratch/lar-root', '--setenv', 'TMPDIR', '/tmp', '--setenv', 'LC_ALL', 'C',
      ...(runner === 'node'
        ? [node, '--test', '--test-reporter=tap', '--', ...files.map(f => path.posix.join('/work', f))]
        : [node, '-e', packageTest, build ?? '', packageDir, path.posix.join('/work', vitestPath), ...files.map(f => path.posix.join('/work', f))]),
    ];
    const result = await new Promise(resolve => {
      const child = spawn(BWRAP, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe', worktreeHeld.fd, scratchHeld.fd, gitFd] });
      let output = '', stderrTail = Buffer.alloc(0), overflow = false, silent = false, timer;
      // LIVENESS: 30 seconds without stdout or stderr releases the single relay; active output resets the bound.
      const silenceSeconds = 30;
      const resetSilence = () => { clearTimeout(timer); timer = setTimeout(() => { silent = true; try { killGroup(child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') child.kill('SIGKILL'); } }, silenceSeconds * 1000); };
      resetSilence();
      const append = chunk => { resetSilence(); output += chunk; if (output.length > 16 * 1024 * 1024) { overflow = true; output = output.slice(-8192); } };
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', append); child.stderr.on('data', chunk => { append(chunk); stderrTail = Buffer.concat([stderrTail, Buffer.from(chunk)]).subarray(-2048); });
      child.on('error', error => { clearTimeout(timer); resolve({ error, output, stderrTail, silent }); });
      child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, output, overflow, stderrTail, silent }); });
    });
    const childRefuse = message => ({ ok: false, exitCode: result.code ?? null, output: `refused: ${message}; exitCode: ${result.code ?? 'null'}; stderr tail: ${result.stderrTail.toString('utf8')}` });
    if (result.silent) return childRefuse('liveness: silent 30s');
    if (result.error || result.signal || result.code === null || result.overflow) return childRefuse(`test execution failed: ${result.error?.message ?? result.signal ?? 'output overflow'}`);
    if (runner === 'vitest') {
      try { readHeld(scratchHeld, 'build-ok'); }
      catch { return { ok: false, exitCode: result.code, output: `refused: package build or stamp failed before tests; ${result.output.slice(-8192)}` }; }
    }
    let pass, fail, skip, total;
    try {
      if (runner === 'node') {
        const readCount = name => {
          const matches = [...result.output.matchAll(new RegExp(`^# ${name} (\\d+)\\s*$`, 'gm'))];
          if (matches.length !== 1) throw new Error(`missing or ambiguous ${name}`);
          return Number(matches[0][1]);
        };
        const tests = readCount('tests');
        // Node counts an empty file's synthetic file subtest as one test.
        const emptyFiles = [...result.output.matchAll(/^# Subtest: (\/work\/[^\r\n]+)\s*$/gm)].filter(match => files.some(file => path.posix.join('/work', file) === match[1])).length;
        total = tests - emptyFiles;
        pass = readCount('pass'); fail = readCount('fail'); skip = readCount('skipped');
        if (!Number.isSafeInteger(tests) || tests < 0) throw new Error('invalid counts');
      } else {
        const report = JSON.parse(readHeld(scratchHeld, 'vitest.json'));
        total = report.numTotalTests;
        pass = report.numPassedTests; fail = report.numFailedTests; skip = report.numPendingTests;
      }
      if (![total, pass, fail, skip].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('invalid counts');
    } catch (error) { return childRefuse(`unparseable ${runner} output: ${error.message}`); }
    if (total === 0) return childRefuse('no tests ran');
    // These tallies advise the requester; they never constitute a check receipt.
    return { ok: true, runner, files, pass, fail, skip, exitCode: result.code, logTail: result.output.slice(-8192) };
  } finally {
    // Walk and remove through held directories; symlinks are unlinked, never opened.
    const clearDir = fd => {
      fchmodSync(fd, 0o700);
      for (const name of readdirSync(`/proc/self/fd/${fd}`)) {
        let child;
        try {
          child = openSync(`/proc/self/fd/${fd}/${name}`, FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW);
        } catch (error) {
          if (error.code === 'ENOTDIR' || error.code === 'ELOOP') {
            try { unlinkSync(`/proc/self/fd/${fd}/${name}`); } catch { /* raced or unavailable */ }
          }
          continue;
        }
        try { clearDir(child); } catch { /* continue with other entries */ } finally { closeSync(child); }
        try { rmdirSync(`/proc/self/fd/${fd}/${name}`); } catch { /* raced or not empty */ }
      }
    };
    try {
      if (scratchHeld) {
        const fd = openSync(scratchHeld.at('.'), FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW);
        try { clearDir(fd); } finally { closeSync(fd); }
      }
    } catch { /* cleanup cannot replace the test answer */ }
    scratchHeld?.close();
    if (gitFd !== undefined) closeSync(gitFd);
    try { rmdirSync(laneHeld.at(path.basename(scratch))); } catch { /* cleanup cannot replace the test answer */ }
  }
}
