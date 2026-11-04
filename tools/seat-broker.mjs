import { spawnSync } from 'node:child_process';
import { exportTree } from './tree-export.mjs';
import { constants as FS, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { lstat, open, readFile, readlink, realpath, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { runCheckSeat, signReceipt } from './seat-walls.mjs';

const GIT = '/usr/bin/git';
const TAR = '/usr/bin/tar';
const CAP = 8192;

if (!existsSync(GIT)) throw new Error(`${GIT} is required`);

function capOutput(value) {
  return new TextDecoder().decode(Buffer.from(String(value ?? '')).subarray(0, CAP), { stream: true });
}

function combineOutput(result) {
  return capOutput(`${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
}

function fail(output) {
  return { ok: false, output: capOutput(output) };
}

function assertRelPath(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new Error('invalid path');
  }
}

export function brokerEnv(iso) {
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
    // Attributes read from the empty tree, never from a working-tree .gitattributes a lane wrote.
    GIT_ATTR_SOURCE: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
  };
}

function ensureIso(iso) {
  mkdirSync(path.join(iso, 'home'), { recursive: true });
  mkdirSync(path.join(iso, 'tmp'), { recursive: true });
}

function git(ctx, args, { input, env, cwd } = {}) {
  ensureIso(ctx.iso);
  const result = spawnSync(
    GIT,
    [
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.fsmonitor=false',
      '-c', 'core.attributesFile=/dev/null',
      '-c', 'credential.helper=',
      '-c', 'core.sshCommand=/usr/bin/ssh',
      '--git-dir',
      ctx.gitDir,
      ...args,
    ],
    {
      env: { ...brokerEnv(ctx.iso), ...(env ?? {}) },
      cwd,
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    output: combineOutput(result),
  };
}

function gitRaw(ctx, args, { input, env, cwd } = {}) {
  ensureIso(ctx.iso);
  const result = spawnSync(
    GIT,
    [
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.fsmonitor=false',
      '-c', 'core.attributesFile=/dev/null',
      '-c', 'credential.helper=',
      '-c', 'core.sshCommand=/usr/bin/ssh',
      '--git-dir',
      ctx.gitDir,
      ...args,
    ],
    {
      env: { ...brokerEnv(ctx.iso), ...(env ?? {}) },
      cwd,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: null,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0),
    output: capOutput(`${result.stdout ? result.stdout.toString('utf8') : ''}${result.stderr ? result.stderr.toString('utf8') : ''}${result.error ? String(result.error) : ''}`),
  };
}

function parseLsTree(output, rel) {
  const out = [];
  for (const line of output.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const left = line.slice(0, tab).trim().split(/\s+/);
    if (left.length < 3) continue;
    const [mode, type, sha] = left;
    const p = line.slice(tab + 1);
    if (p === rel) out.push({ mode, type, sha, path: p });
  }
  return out;
}

function staticGitEnv() {
  return {
    PATH: '/usr/bin:/bin',
    HOME: '/nonexistent',
    TMPDIR: '/tmp',
    XDG_CONFIG_HOME: '/nonexistent',
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_OPTIONAL_LOCKS: '0',
  };
}

function headModeForWorktree(worktree, rel) {
  const run = spawnSync(
    GIT,
    [
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.fsmonitor=false',
      '-c', 'core.attributesFile=/dev/null',
      '-c', 'credential.helper=',
      '-c', 'core.sshCommand=/usr/bin/ssh',
      '--git-dir',
      path.join(worktree, '.git'),
      'ls-tree',
      'HEAD',
      '--',
      rel,
    ],
    { env: staticGitEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (run.status !== 0) return null;
  const entries = parseLsTree(run.stdout ?? '', rel);
  return entries[0]?.mode ?? null;
}


async function pathIsMissing(file) {
  try {
    await lstat(file);
    return false;
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return true;
    throw error;
  }
}

async function readRegularNoSymlink(file) {
  let fh;
  try {
    fh = await open(file, FS.O_RDONLY | FS.O_NOFOLLOW);
    const st = await fh.stat();
    if (!st.isFile()) throw new Error('not a regular file');
    if (st.nlink > 1) throw new Error('hardlink');
    return await fh.readFile();
  } catch (error) {
    if (error?.code === 'ELOOP') throw new Error('symlink');
    throw error;
  } finally {
    await fh?.close();
  }
}

export async function readSafe(worktree, rel) {
  assertRelPath(rel);
  const root = await realpath(worktree);
  if (headModeForWorktree(root, rel) === '160000') throw new Error('gitlink');
  const parts = rel.split('/');
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    let st;
    try {
      st = await lstat(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw error;
      throw error;
    }
    if (st.isSymbolicLink()) throw new Error('symlink');
  }

  const target = path.join(root, rel);
  const st0 = await lstat(target);
  if (st0.isDirectory()) {
    try {
      await lstat(path.join(target, '.git'));
      throw new Error('gitlink');
    } catch (error) {
      if (error instanceof Error && error.message === 'gitlink') throw error;
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new Error('not a regular file');
      throw error;
    }
  }
  if (!st0.isFile()) throw new Error('not a regular file');

  let fh;
  try {
    fh = await open(target, FS.O_RDONLY | FS.O_NOFOLLOW);
    const linked = await readlink(`/proc/self/fd/${fh.fd}`);
    if (linked !== target) throw new Error('outside');
    const st = await fh.stat();
    if (!st.isFile()) throw new Error('not a regular file');
    if (st.nlink > 1) throw new Error('hardlink');
    const content = await fh.readFile();
    const mode = (st.mode & 0o111) !== 0 ? '100755' : '100644';
    return { mode, content };
  } catch (error) {
    if (error?.message === 'outside' || error?.message === 'hardlink') throw error;
    if (error?.code === 'ELOOP') throw new Error('symlink');
    if (error?.code === 'EISDIR' || error?.code === 'ENOTDIR') throw new Error('not a regular file');
    if (error?.code === 'ENOENT') throw error;
    if (error?.message === 'not a regular file') throw error;
    throw error;
  } finally {
    await fh?.close();
  }
}

function headMode(ctx, rel) {
  const listed = git(ctx, ['ls-tree', 'HEAD', '--', rel]);
  if (!listed.ok) return null;
  const entries = parseLsTree(listed.stdout, rel);
  return entries[0]?.mode ?? null;
}

export function verifyReceipt({ keyFile, receiptsDir, tree, requiredChecks, definitions = [] }) {
  try {
    const payload = JSON.parse(readFileSync(path.join(receiptsDir, `${tree}.json`), 'utf8'));
    if (!payload || payload.tree !== tree || !Array.isArray(payload.checks) || typeof payload.mac !== 'string') {
      return { ok: false, reason: 'shape' };
    }
    const signed = signReceipt({ keyFile, tree, checks: payload.checks, definitions });
    const have = Buffer.from(payload.mac, 'hex');
    const want = Buffer.from(signed.mac, 'hex');
    if (have.length === 0 || want.length === 0 || have.length !== want.length || !timingSafeEqual(have, want)) {
      return { ok: false, reason: 'mac' };
    }
    for (const name of requiredChecks ?? []) {
      if (!payload.checks.includes(name)) return { ok: false, reason: 'checks' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'missing' };
  }
}

function runTarExtract(ctx, tarBytes, dir) {
  ensureIso(ctx.iso);
  const result = spawnSync(TAR, ['-x', '-C', dir], {
    input: tarBytes,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: brokerEnv(ctx.iso),
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ok: result.status === 0, output: combineOutput(result), stdout: result.stdout ?? '' };
}

export async function commitWithReceipt(ctx, { paths, messageFile, expectHead }) {
  if (!Array.isArray(paths) || paths.length === 0) return fail('paths required');
  let head = git(ctx, ['rev-parse', `refs/heads/${ctx.branch}`]);
  if (!head.ok) return fail(head.output);
  head = head.stdout.trim();
  if (expectHead !== head) return fail(`expected old head ${expectHead}`);

  const workRoot = await realpath(ctx.worktree);
  const unique = [...new Set(paths)];
  const entries = [];

  for (const rel of unique) {
    try {
      assertRelPath(rel);
    } catch (error) {
      return fail(error.message);
    }
    const modeAtHead = headMode(ctx, rel);
    if (modeAtHead === '160000') return fail(`gitlink: ${rel}`);
    try {
      const file = await readSafe(workRoot, rel);
      entries.push({ path: rel, remove: false, mode: file.mode, content: file.content });
    } catch (error) {
      const missing = await pathIsMissing(path.join(workRoot, rel));
      if (missing && modeAtHead) {
        entries.push({ path: rel, remove: true });
        continue;
      }
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  const tmpIndex = path.join(ctx.iso, 'tmp', `broker-index-${process.pid}-${Math.random().toString(16).slice(2)}`);
  const idxEnv = { GIT_INDEX_FILE: tmpIndex };
  const readTree = git(ctx, ['read-tree', 'HEAD'], { env: idxEnv });
  if (!readTree.ok) return fail(readTree.output);

  const resolved = [];
  for (const entry of entries) {
    if (entry.remove) {
      const removed = git(ctx, ['update-index', '--force-remove', '--', entry.path], { env: idxEnv });
      if (!removed.ok) return fail(removed.output);
      resolved.push({ path: entry.path, remove: true });
      continue;
    }
    const blob = git(ctx, ['hash-object', '-w', '--no-filters', '--stdin'], { env: idxEnv, input: entry.content });
    if (!blob.ok) return fail(blob.output);
    const sha = blob.stdout.trim();
    const staged = git(ctx, ['update-index', '--add', '--cacheinfo', `${entry.mode},${sha},${entry.path}`], { env: idxEnv });
    if (!staged.ok) return fail(staged.output);
    resolved.push({ path: entry.path, remove: false, mode: entry.mode, sha });
  }

  const treeRun = git(ctx, ['write-tree'], { env: idxEnv });
  if (!treeRun.ok) return fail(treeRun.output);
  const tree = treeRun.stdout.trim();

  const receipt0 = verifyReceipt({ keyFile: ctx.keyFile, receiptsDir: ctx.receiptsDir, tree, requiredChecks: ctx.requiredChecks, definitions: ctx.checks });
  if (!receipt0.ok) {
    const checked = await (ctx.checkRunner ?? runCheckSeat)({ ...ctx, tree });
    if (!checked.ok) return fail(checked.output || 'check failed');
    const receipt1 = verifyReceipt({ keyFile: ctx.keyFile, receiptsDir: ctx.receiptsDir, tree, requiredChecks: ctx.requiredChecks, definitions: ctx.checks });
    if (!receipt1.ok) return fail('check receipt verification failed');
  }

  let message;
  try {
    message = await readRegularNoSymlink(messageFile);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  const commit = git(ctx, ['commit-tree', tree, '-p', head, '-F', '-'], {
    input: message,
    env: {
      GIT_AUTHOR_NAME: ctx.author?.name ?? '',
      GIT_AUTHOR_EMAIL: ctx.author?.email ?? '',
      GIT_COMMITTER_NAME: ctx.author?.name ?? '',
      GIT_COMMITTER_EMAIL: ctx.author?.email ?? '',
    },
  });
  if (!commit.ok) return fail(commit.output);
  const newHead = commit.stdout.trim();

  const moved = git(ctx, ['update-ref', `refs/heads/${ctx.branch}`, newHead, head]);
  if (!moved.ok) return fail(moved.output);

  for (const entry of resolved) {
    const real = entry.remove
      ? git(ctx, ['update-index', '--force-remove', '--', entry.path])
      : git(ctx, ['update-index', '--add', '--cacheinfo', `${entry.mode},${entry.sha},${entry.path}`]);
    if (!real.ok) return fail(real.output);
  }

  return { ok: true, output: '', head: newHead, tree };
}

export async function pushWithGo(ctx) {
  let go;
  try {
    go = await readFile(ctx.goFile, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: false, output: 'no push-go from the controller' };
    return fail(error instanceof Error ? error.message : String(error));
  }

  try { await unlink(ctx.goFile); } catch {}

  const lines = go.replace(/\r/g, '').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length !== 2) return fail('go file requires branch and head');
  const [branch, head] = lines;
  if (branch !== ctx.branch) return fail('go branch mismatch');

  const now = git(ctx, ['rev-parse', `refs/heads/${ctx.branch}`]);
  if (!now.ok) return fail(now.output);
  const current = now.stdout.trim();
  if (head !== current) return fail('go head mismatch');

  // The push runs from a throwaway repo of the broker's own: the lane's .git/config (pushurl, insteadOf, helpers) is never read.
  if (typeof ctx.remoteUrl !== 'string' || !/^(ssh:\/\/|https:\/\/|git@[\w.-]+:|\/)/.test(ctx.remoteUrl)) return fail('push needs a remote url from the controller (ssh, https or an absolute path)');
  const common = git(ctx, ['rev-parse', '--git-path', 'objects']);
  if (!common.ok) return fail(common.output);
  const objects = path.resolve(ctx.gitDir, common.stdout.trim());
  const pushRepo = path.join(ctx.iso, 'pushrepo');
  rmSync(pushRepo, { recursive: true, force: true });
  const made = git({ ...ctx, gitDir: pushRepo }, ['init', '--bare', '-q', pushRepo]);
  if (!made.ok) return fail(made.output);
  writeFileSync(path.join(pushRepo, 'objects', 'info', 'alternates'), `${objects}\n`);
  const shell = { ...ctx, gitDir: pushRepo };
  const placed = git(shell, ['update-ref', `refs/heads/${ctx.branch}`, head]);
  if (!placed.ok) return fail(placed.output);
  const pushed = git(shell, ['push', ctx.remoteUrl, `refs/heads/${ctx.branch}:refs/heads/${ctx.branch}`], {
    env: { HOME: os.userInfo().homedir, GIT_ALLOW_PROTOCOL: 'ssh:https:file' },
  });
  return { ok: pushed.ok, output: pushed.output };
}

function listGitlinks(ctx, base) {
  const out = git(ctx, ['ls-tree', '-r', base]);
  if (!out.ok) return [];
  const paths = [];
  for (const line of out.stdout.split('\n')) {
    if (!line.startsWith('160000 ')) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    paths.push(line.slice(tab + 1));
  }
  return paths;
}

export async function addWorktree(ctx, { path: dest, branch, base }) {
  try {
    await lstat(dest);
    return fail('destination exists');
  } catch (error) {
    if (error?.code !== 'ENOENT') return fail(error instanceof Error ? error.message : String(error));
  }
  if (!existsSync(TAR)) return fail(`${TAR} is required`);

  const added = git(ctx, ['worktree', 'add', '--no-checkout', '-b', branch, dest, base]);
  if (!added.ok) return fail(added.output);

  const baseTree = git(ctx, ['rev-parse', `${base}^{tree}`]);
  if (!baseTree.ok) return fail(baseTree.output);
  const exported = exportTree({ gitDir: ctx.gitDir, tree: baseTree.stdout.toString('utf8').trim(), to: dest, iso: ctx.iso });
  if (!exported.ok) return fail(exported.output);

  for (const gitlink of listGitlinks(ctx, base)) {
    mkdirSync(path.join(dest, gitlink), { recursive: true });
  }

  const newCtx = { ...ctx, gitDir: path.join(dest, '.git') };
  const idxPathRun = git(newCtx, ['rev-parse', '--git-path', 'index']);
  if (!idxPathRun.ok) return fail(idxPathRun.output);
  const indexPath = idxPathRun.stdout.trim();
  const seeded = git(newCtx, ['read-tree', base], { env: { GIT_INDEX_FILE: indexPath } });
  if (!seeded.ok) return fail(seeded.output);

  return { ok: true, output: '' };
}

/** Removes a clean registered worktree; the cleanliness read takes its attributes from the empty tree, so no lane filter runs. */
export async function removeWorktree(ctx, { path: target }) {
  const list = git(ctx, ['worktree', 'list', '--porcelain', '-z']);
  if (!list.ok) return fail(list.output);
  if (!list.stdout.split('\0').includes(`worktree ${target}`)) return fail('not a registered worktree');
  let gitDir = path.join(target, '.git');
  try {
    const dot = readFileSync(gitDir, 'utf8');
    const m = /^gitdir: (.+)$/m.exec(dot);
    if (m) gitDir = path.resolve(target, m[1].trim());
  } catch { /* a plain dir */ }
  const status = git({ ...ctx, gitDir }, ['--work-tree', target, 'status', '--porcelain', '--ignore-submodules=all']);
  if (!status.ok) return fail(status.output);
  if (status.stdout.trim()) return fail('worktree is dirty');
  const removed = git(ctx, ['worktree', 'remove', target]);
  return { ok: removed.ok, output: removed.output };
}
