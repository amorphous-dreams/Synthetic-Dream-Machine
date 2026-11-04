#!/usr/bin/env node
import { realpath, readdir, readFile, writeFile, unlink, lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--once') options.once = true;
  else if (['--lane-root', '--worktree', '--branch', '--go-file', '--launcher'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg.slice(2)] = args[++i];
  else throw new Error(`invalid argument: ${arg}`);
}
if (!options['lane-root'] || !options.worktree || !options.branch || !options['go-file'] || !options.launcher) throw new Error('usage: --lane-root <dir> --worktree <wt> --branch <branch> --go-file <path outside lane-root> --launcher <path> [--once]');
const lane = await realpath(options['lane-root']);
const worktree = await realpath(options.worktree);
const scratch = await realpath(path.join(os.homedir(), '.lares-scratch'));
const inside = (root, target) => target !== root && !path.relative(root, target).startsWith(`..${path.sep}`) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target));
if (!inside(scratch, worktree)) throw new Error('worktree must sit under the real home .lares-scratch');
// THE GO LIVES WHERE THE LEAD CANNOT WRITE: a lead's wall covers its lane root, so a go inside it would let a lead grant its own push.
const goFile = path.resolve(options['go-file']);
const goDir = await realpath(path.dirname(goFile));
if (goDir === lane || inside(lane, goDir) || goDir === worktree || inside(worktree, goDir)) throw new Error('go-file must sit outside the lane root and the worktree');
const launcher = await realpath(options.launcher);
if (launcher === lane || inside(lane, launcher)) throw new Error('launcher must sit outside the lane root');
const branch = options.branch;
const git = (...argv) => spawnSync('git', ['-C', worktree, ...argv], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' } });
if (branch.startsWith('-') || git('check-ref-format', `refs/heads/${branch}`).status !== 0) throw new Error('invalid branch');
const relay = path.join(lane, 'relay');
await (await import('node:fs/promises')).mkdir(relay, { recursive: true });
const cap = value => new TextDecoder().decode(Buffer.from(value).subarray(0, 8192), { stream: true });
const result = run => ({ ok: run.status === 0, head: (git('rev-parse', '--short', 'HEAD').stdout || '').trim(), output: cap((run.stdout || '') + (run.stderr || '') + (run.error ? String(run.error) : '')) });

async function validatePath(item) {
  if (typeof item !== 'string' || !item || path.isAbsolute(item) || item.split(/[\\/]/).includes('..')) throw new Error(`invalid path: ${String(item)}`);
  const target = path.resolve(worktree, item);
  if (!inside(worktree, target)) throw new Error(`path outside worktree: ${item}`);
  try {
    if (!inside(worktree, await realpath(target))) throw new Error(`path resolves outside worktree: ${item}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // A deleted tracked file can lack parents; resolve the nearest existing ancestor.
    let ancestor = path.dirname(target);
    while (true) {
      try {
        const resolved = await realpath(ancestor);
        if (resolved !== worktree && !inside(worktree, resolved)) throw new Error(`path resolves outside worktree: ${item}`);
        break;
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw err;
        ancestor = parent;
      }
    }
    if (git('ls-files', '--error-unmatch', '--', item).status !== 0) throw new Error(`path does not exist or match a tracked deletion: ${item}`);
  }
}

// Resolve existing paths and the parent of a new worktree through symlinks.
async function lanePath(value, create = false) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('path must be absolute');
  const target = path.resolve(value);
  if (!inside(lane, target)) throw new Error('path outside lane-root');
  if (create) {
    try { await lstat(target); throw new Error('path already exists'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = await realpath(path.dirname(target));
    if (parent !== lane && !inside(lane, parent)) throw new Error('path resolves outside lane-root');
    return path.join(parent, path.basename(target));
  }
  const resolved = await realpath(target);
  if (!inside(lane, resolved)) throw new Error('path resolves outside lane-root');
  return resolved;
}
const run = (command, argv) => spawnSync(command, argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const output = r => cap((r.stdout || '') + (r.stderr || '') + (r.error ? String(r.error) : ''));

async function handle(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be an object');
  const schemas = { commit: ['kind', 'paths', 'message'], push: ['kind'], worktree: ['kind', 'path', 'branch', 'base'], 'worktree-remove': ['kind', 'path'], launch: ['kind', 'seatDir', 'model', 'effort', 'mode', 'worktree'] };
  if (Object.hasOwn(schemas, request.kind) && Object.keys(request).some(key => !schemas[request.kind].includes(key))) throw new Error('unknown field');
  if (request.kind === 'worktree') {
    const target = await lanePath(request.path, true);
    if (typeof request.branch !== 'string' || !request.branch.startsWith(`${branch}-`) || git('check-ref-format', `refs/heads/${request.branch}`).status !== 0) throw new Error('invalid worktree branch');
    if (typeof request.base !== 'string' || !request.base || request.base.startsWith('-')) throw new Error('invalid base');
    const steps = [
      ['worktree add', () => git('worktree', 'add', '-b', request.branch, target, request.base)],
      ['submodule update', () => run('git', ['-C', target, 'submodule', 'update', '--init'])],
      ['pnpm install', () => run('pnpm', ['--dir', target, 'install', '--offline', '--frozen-lockfile'])],
    ];
    let transcript = '';
    for (const [name, execute] of steps) {
      const step = execute(); transcript += `${name}:\n${output(step)}\n`;
      if (step.status !== 0) return { ok: false, output: transcript };
    }
    return { ok: true, output: transcript };
  }
  if (request.kind === 'worktree-remove') {
    const target = await lanePath(request.path);
    if (target === worktree) throw new Error('cannot remove relay worktree');
    const list = git('worktree', 'list', '--porcelain', '-z');
    if (list.status !== 0) return result(list);
    if (!list.stdout.split('\0').includes(`worktree ${target}`)) throw new Error('not a registered worktree');
    const status = run('git', ['-C', target, 'status', '--porcelain']);
    if (status.status !== 0) return { ok: false, output: output(status) };
    if (status.stdout) throw new Error('worktree is dirty');
    return result(git('worktree', 'remove', target));
  }
  if (request.kind === 'launch') {
    if (!['gpt-6.1-terra', 'gpt-6-luna'].includes(request.model)) throw new Error('invalid model');
    if (!['low', 'medium', 'high'].includes(request.effort)) throw new Error('invalid effort');
    if (!['build', 'read', 'research'].includes(request.mode)) throw new Error('invalid mode');
    if (request.mode !== 'build' && Object.hasOwn(request, 'worktree')) throw new Error('worktree only allowed for build');
    const seat = await lanePath(request.seatDir);
    const brief = await realpath(path.join(seat, 'brief.md'));
    if (!inside(seat, brief) || !(await stat(brief)).isFile()) throw new Error('invalid brief');
    const argv = [launcher, '--seat-dir', seat, '--model', request.model, '--effort', request.effort, '--mode', request.mode];
    if (request.mode === 'build') argv.push('--worktree', await lanePath(request.worktree));
    const launched = run(process.execPath, argv);
    return { ok: launched.status === 0, output: output(launched) };
  }
  if (request.kind === 'commit') {
    if (!Array.isArray(request.paths) || request.paths.length === 0) throw new Error('commit requires nonempty paths');
    if (typeof request.message !== 'string' || !request.message) throw new Error('commit requires a message file');
    const message = await realpath(path.resolve(lane, request.message));
    if (!inside(lane, message)) throw new Error('message file resolves outside lane-root');
    for (const item of request.paths) await validatePath(item);
    return result(git('commit', '-F', message, '--only', '--', ...request.paths));
  }
  if (request.kind === 'push') {
    const go = path.join(goDir, path.basename(goFile));
    let contents;
    try { contents = await readFile(go, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (contents === undefined || contents.split(/\r?\n/, 1)[0] !== branch) return { ok: false, output: 'no push-go from the controller' };
    try { return result(git('push', 'origin', branch)); } finally { await unlink(go); }
  }
  throw new Error(`unknown kind: ${String(request.kind)}`);
}

async function poll() {
  const names = (await readdir(relay)).filter(name => /^req-(.+)\.json$/.test(name)).sort();
  for (const name of names) {
    const id = name.slice(4, -5);
    const response = path.join(relay, `res-${id}.json`);
    try { await readFile(response); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let answer;
    try { answer = await handle(JSON.parse(await readFile(path.join(relay, name), 'utf8'))); }
    catch (error) { answer = { ok: false, output: cap(`refused: ${error.message}`) }; }
    await writeFile(response, JSON.stringify(answer) + '\n', { flag: 'wx' });
  }
}
do { await poll(); if (!options.once) await new Promise(resolve => setTimeout(resolve, 5000)); } while (!options.once);
