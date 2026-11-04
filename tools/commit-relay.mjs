#!/usr/bin/env node
import { realpath, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--once') options.once = true;
  else if (['--lane-root', '--worktree', '--branch', '--go-file'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg.slice(2)] = args[++i];
  else throw new Error(`invalid argument: ${arg}`);
}
if (!options['lane-root'] || !options.worktree || !options.branch || !options['go-file']) throw new Error('usage: --lane-root <dir> --worktree <wt> --branch <branch> --go-file <path outside lane-root> [--once]');
const lane = await realpath(options['lane-root']);
const worktree = await realpath(options.worktree);
const scratch = await realpath(path.join(os.homedir(), '.lares-scratch'));
const inside = (root, target) => target !== root && !path.relative(root, target).startsWith(`..${path.sep}`) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target));
if (!inside(scratch, worktree)) throw new Error('worktree must sit under the real home .lares-scratch');
// THE GO LIVES WHERE THE LEAD CANNOT WRITE: a lead's wall covers its lane root, so a go inside it would let a lead grant its own push.
const goFile = path.resolve(options['go-file']);
const goDir = await realpath(path.dirname(goFile));
if (goDir === lane || inside(lane, goDir) || goDir === worktree || inside(worktree, goDir)) throw new Error('go-file must sit outside the lane root and the worktree');
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

async function handle(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be an object');
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
