import { spawn, spawnSync } from 'node:child_process';
import { killGroup } from './launch-codex.mjs';
import { exportTree } from './tree-export.mjs';
import { openHeldSync, readHeld } from './held-dir.mjs';
import { createHash, createHmac } from 'node:crypto';
import { closeSync, constants as FS, existsSync, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, rmdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sharedModuleFiles, sharedInodeRefusal } from './module-inodes.mjs';
import { DOOR_RUN_MAX_MS, DOOR_SILENCE_MS } from './relay-claim.mjs';

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

/** A check runs synchronously, so no output can reset a bound: each check stops at the door silence. */
export const checkTimeoutMs = DOOR_SILENCE_MS;

/**
 * Supervises a door's detached child until it closes: collects stdout and stderr, beats `onBeat` on each chunk, and stops
 * the child's group on silence or on the whole-run bound (relay-claim), so no child holds the one broker.
 */
export async function superviseChild(child, { silenceMs = DOOR_SILENCE_MS, runMaxMs = DOOR_RUN_MAX_MS, onBeat = () => {} } = {}) {
  const stop = () => { try { killGroup(child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') child.kill('SIGKILL'); } };
  const within = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
  if (!within(silenceMs, DOOR_SILENCE_MS) || !within(runMaxMs, DOOR_RUN_MAX_MS)) { stop(); throw new Error(`seat-bound: silence 1..${DOOR_SILENCE_MS} ms, run 1..${DOOR_RUN_MAX_MS} ms`); }
  return new Promise(resolve => {
    let output = '', stderrTail = Buffer.alloc(0), overflow = false, silent = false, overran = false, quiet;
    // LIVENESS: `silenceMs` without stdout or stderr stops the child; active output resets the bound.
    const resetSilence = () => { clearTimeout(quiet); quiet = setTimeout(() => { silent = true; stop(); }, silenceMs); };
    // LIVENESS: the whole run stops at `runMaxMs`, however much the child talks.
    const whole = setTimeout(() => { overran = true; stop(); }, runMaxMs);
    const settle = (fields) => { clearTimeout(quiet); clearTimeout(whole); resolve({ ...fields, output, overflow, stderrTail, silent, overran }); };
    resetSilence();
    const append = chunk => { resetSilence(); onBeat(); output += chunk; if (output.length > 16 * 1024 * 1024) { overflow = true; output = output.slice(-CAP * 2); } };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', append);
    child.stderr.on('data', chunk => { append(chunk); stderrTail = Buffer.concat([stderrTail, Buffer.from(chunk)]).subarray(-2048); });
    child.on('error', error => settle({ error }));
    child.on('close', (code, signal) => settle({ code, signal }));
  });
}

function run(command, args, { env, cwd, input, timeout } = {}) {
  const result = spawnSync(command, args, {
    env,
    cwd,
    input,
    timeout,
    killSignal: 'SIGKILL',
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

export async function runCheckSeat({ gitDir, tree, checks, key, receipts, iso, bwrap, keepWork, onBeat = () => {} }) {
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
      onBeat();
      const ran = run(BWRAP, args, { timeout: checkTimeoutMs });
      if (ran.result.error?.code === 'ETIMEDOUT') return { ok: false, output: `check ${check.name} failed: liveness: ran past ${checkTimeoutMs}ms` };
      if (!ran.ok) return { ok: false, output: `check ${check.name} failed: ${ran.output}` };
      onBeat();
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
export async function runInstallSeat({ worktree, worktreeHeld, gitDir, installer, storeDir, cacheDir, iso, protect = [], env, extraRw = [], bwrap = HAVE_BWRAP, silenceSeconds = DOOR_SILENCE_MS / 1000, onBeat = () => {} }) {
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

    if (typeof cacheDir !== 'string' || !path.isAbsolute(cacheDir)) return { ok: false, output: 'install seat refused: the metadata cache dir must be an absolute path' };
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
      // The store binds READ-ONLY and the install copies out of it: a lane's node_modules shares no inode with the store, the
      // main checkout or another lane, and nothing inside the wall can rewrite a package every later install would trust.
      ...bind('--ro-bind-fd', hold(storeDir), storeDir),
      // The metadata cache binds READ-ONLY in the same shape: an offline install verifies the lockfile against the supply-chain
      // policy from these package documents, and nothing inside the wall can rewrite the metadata every later check would trust.
      // pnpm's only cache write on this path (the lockfile-verified record) fails soft, so the next install re-verifies.
      ...bind('--ro-bind-fd', hold(cacheDir), cacheDir),
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
      '--package-import-method=copy',
      // frozenStore opens the store's SQLite index immutable (read-only); without it pnpm opens index.db for writing and the
      // read-only bind refuses (ERR_SQLITE_ERROR: unable to open database file).
      '--frozen-store',
      '--store-dir',
      storeDir,
      '--cache-dir',
      cacheDir,
    ];
    // A stalled installer (a lane dependency naming a FIFO, a wedged open) goes silent; pnpm reports progress while it works.
    const ran = await superviseChild(spawn(BWRAP, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe', ...fds] }), { silenceMs: silenceSeconds * 1000, onBeat });
    if (ran.silent) return { ok: false, output: capOutput(`refused: install liveness: silent ${silenceSeconds}s; ${ran.output}`) };
    if (ran.overran) return { ok: false, output: capOutput(`refused: install liveness: ran past ${DOOR_RUN_MAX_MS}ms; ${ran.output}`) };
    return { ok: ran.code === 0, output: capOutput(`${ran.output}${ran.error ? String(ran.error) : ''}${ran.signal ? `signal ${ran.signal}` : ''}`) };
  } finally { for (const h of opened) h.close(); }
}

/** Validate the test request before opening the execution boundary. */
export async function runTestSeat({ worktreeHeld, laneHeld, runner, files, onBeat = () => {} }) {
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
  const moduleFds = [], stampFds = [];
  try {
    try {
      gitFd = openSync(worktreeHeld.at('.git'), FS.O_RDONLY | FS.O_NOFOLLOW);
      const gitStat = fstatSync(gitFd);
      if (!gitStat.isFile() && !gitStat.isDirectory()) return refuse('worktree .git must be a file or directory');
    } catch (error) {
      if (error.code === 'ENOENT') return refuse('worktree holds no .git');
      return refuse('worktree .git unreadable');
    }
    // Every node_modules farm (the root, each top-level workspace dir, each package) binds READ-ONLY over the writable /work:
    // code under test can build dist/ and stamps but never rewrite the tooling (vitest, tsc, any package) a later run trusts.
    // Each opens through the held worktree, one component at a time, no symlink followed; a symlinked farm resolves inside
    // the wall's own view, so it is left to that view.
    const openFarm = rel => {
      let parent = worktreeHeld.fd; const opened = [];
      try {
        for (const part of rel.split('/')) { const fd = openSync(`/proc/self/fd/${parent}/${part}`, FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW); opened.push(fd); parent = fd; }
        return opened.pop();
      } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return null;
        throw error;
      } finally { for (const fd of opened) closeSync(fd); }
    };
    const realDirs = rel => { const fd = openFarm(rel); if (fd === null) return []; try { return readdirSync(`/proc/self/fd/${fd}`, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map(e => e.name); } finally { closeSync(fd); } };
    const farms = ['node_modules', ...realDirs('.').filter(d => d !== 'packages').map(d => `${d}/node_modules`), ...realDirs('packages').map(d => `packages/${d}/node_modules`)];
    // A symlinked root farm would resolve inside the wall's own view, past the read-only bind: refuse it by name.
    try { if (!lstatSync(`/proc/self/fd/${worktreeHeld.fd}/node_modules`).isDirectory()) return refuse('root node_modules must be a real directory'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const rel of farms) { const fd = openFarm(rel); if (fd !== null) moduleFds.push({ rel, fd }); }
    // The wall never rests on how the tree was installed: a module file sharing an inode with another tree (the store, the
    // main checkout, another lane) refuses by name before any code runs, since a read-only bind fences paths, not inodes.
    const shared = sharedInodeRefusal(sharedModuleFiles(moduleFds.map(({ rel, fd }) => ({ rel, dir: `/proc/self/fd/${fd}` }))));
    if (shared) return refuse(shared);
    // The build stamps (node_modules/.lares-build) bind WRITABLE over the read-only root farm: the wall's build -> stamp step
    // records what its dist came from, at the trust of the dist it built (both lane-owned output, neither tooling). The stamp
    // dir opens relative to the held root farm, never by a second walk from the worktree.
    if (moduleFds[0]?.rel === 'node_modules') {
      try { mkdirSync(`/proc/self/fd/${moduleFds[0].fd}/.lares-build`); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      let fd;
      try { fd = openSync(`/proc/self/fd/${moduleFds[0].fd}/.lares-build`, FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW); }
      catch (error) { if (['ELOOP', 'ENOTDIR'].includes(error.code)) return refuse('node_modules/.lares-build must be a real directory'); throw error; }
      stampFds.push({ rel: 'node_modules/.lares-build', fd });
    }
    const boundFds = [...moduleFds, ...stampFds];
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
      // node_modules reads read-only here, so every vite/vitest write it would take lands in /scratch or nowhere: the config
      // loads through the runner (no .vite-temp bundle), results keep no cache, the module cache lives under /scratch.
      const tested = spawnSync(process.execPath, [vitest, 'run', '--reporter=json', '--outputFile=/scratch/vitest.json', '--reporter=dot',
        '--configLoader', 'runner', '--no-cache', '--fsModuleCachePath', '/scratch/vitest-cache', '--root', process.cwd(), ...files], { stdio: 'inherit' });
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
      ...moduleFds.flatMap(({ rel }, i) => ['--ro-bind-fd', String(6 + i), path.posix.join('/work', rel)]),
      ...stampFds.flatMap(({ rel }, i) => ['--bind-fd', String(6 + moduleFds.length + i), path.posix.join('/work', rel)]),
      '--chdir', path.posix.join('/work', packageDir),
      '--setenv', 'PATH', `${path.posix.join('/work', packageDir, 'node_modules/.bin')}:/work/node_modules/.bin:${bin}:/usr/bin:/bin`, '--setenv', 'HOME', '/scratch/home',
      '--setenv', 'LAR_ROOT', '/scratch/lar-root', '--setenv', 'TMPDIR', '/tmp', '--setenv', 'LC_ALL', 'C',
      ...(runner === 'node'
        ? [node, '--test', '--test-reporter=tap', '--', ...files.map(f => path.posix.join('/work', f))]
        : [node, '-e', packageTest, '--', build ?? '', packageDir, path.posix.join('/work', vitestPath), ...files.map(f => path.posix.join('/work', f))]),
    ];
    // A test runner prints as it goes; 30 seconds without a word reads as a hang.
    const result = await superviseChild(spawn(BWRAP, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe', worktreeHeld.fd, scratchHeld.fd, gitFd, ...boundFds.map(m => m.fd)] }), { silenceMs: 30_000, onBeat });
    const childRefuse = message => ({ ok: false, exitCode: result.code ?? null, output: `refused: ${message}; exitCode: ${result.code ?? 'null'}; stderr tail: ${result.stderrTail.toString('utf8')}` });
    if (result.silent) return childRefuse('liveness: silent 30s');
    if (result.overran) return childRefuse(`liveness: ran past ${DOOR_RUN_MAX_MS}ms`);
    if (result.error || result.signal || result.code === null || result.overflow) return childRefuse(`test execution failed: ${result.error?.message ?? result.signal ?? 'output overflow'}`);
    if (runner === 'vitest') {
      try { readHeld(scratchHeld, 'build-ok'); }
      catch (error) { return { ok: false, exitCode: result.code, output: `refused: package build or stamp failed before tests; ${error.message}; ${result.output.slice(-8192)}` }; }
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
    for (const { fd } of [...moduleFds, ...stampFds]) closeSync(fd);
    try { rmdirSync(laneHeld.at(path.basename(scratch))); } catch { /* cleanup cannot replace the test answer */ }
  }
}
