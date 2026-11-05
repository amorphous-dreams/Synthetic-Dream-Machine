#!/usr/bin/env node
import { realpath, readdir, readFile, writeFile, unlink, lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { openHeld } from './held-dir.mjs';
import { brokerRootPath, ensureBrokerRoot, ensureLaneDir } from './broker-root.mjs';
import { addWorktree, commitWithReceipt, pushWithGo, removeWorktree } from './seat-broker.mjs';
import { runInstallSeat } from './seat-walls.mjs';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--once') options.once = true;
  else if (['--lane-root', '--worktree', '--branch', '--launcher', '--checks', '--installer', '--store-dir', '--author-name', '--author-email', '--remote-url'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg.slice(2)] = args[++i];
  else throw new Error(`invalid argument: ${arg}`);
}
if (!options['remote-url']) throw new Error('--remote-url is required: the push target comes from the controller, never from the lane\'s config');
if (!options['lane-root'] || !options.worktree || !options.branch || !options.launcher) throw new Error('usage: --lane-root <dir> --worktree <wt> --branch <branch> --launcher <path> [--once]');
const lane = await realpath(options['lane-root']);
const worktree = await realpath(options.worktree);
const scratch = await realpath(path.join(os.homedir(), '.lares-scratch'));
const inside = (root, target) => target !== root && !path.relative(root, target).startsWith(`..${path.sep}`) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target));
if (!inside(scratch, worktree)) throw new Error('worktree must sit under the real home .lares-scratch');
// THE GO AND THE BROKER'S STATE LIVE UNDER THE ONE FIXED BROKER ROOT (the same root the seat dirs use), and no caller names either path:
// <root>/go/<lane>/push-go and <root>/iso/<lane>. One verifier (broker-root.mjs) checks the root before anything is created: ours, exactly
// 0700, no symlinked or group/other-writable component, nothing under ~/.lares-scratch (every lane included), no ancestor of a granted root.
const homeReal = await realpath(os.homedir());
const brokerRoot = brokerRootPath(homeReal, process.env);
const rootOpts = { realHome: homeReal, guarded: [lane, worktree, scratch] };
ensureBrokerRoot(brokerRoot, rootOpts);
const goDir = ensureLaneDir(brokerRoot, 'go', lane, rootOpts);
const goFile = path.join(goDir, 'push-go');
const iso = ensureLaneDir(brokerRoot, 'iso', lane, rootOpts);
// A made worktree is a GRANTED root for its builder, so it lives under the scratch tree (house law) but in a broker-owned dir no lane grants: .broker-worktrees/<lane>.
const stageRoot = path.join(scratch, '.broker-worktrees', path.basename(lane));
await (await import('node:fs/promises')).mkdir(stageRoot, { recursive: true, mode: 0o700 });
const launcher = await realpath(options.launcher);
if (launcher === scratch || inside(scratch, launcher)) throw new Error('launcher must sit outside the scratch tree entirely: a lead can write anywhere a lane or worktree lives under it');
const branch = options.branch;
const git = (...argv) => spawnSync('/usr/bin/git', ['-C', worktree, ...argv], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' } });
if (branch.startsWith('-') || git('check-ref-format', `refs/heads/${branch}`).status !== 0) throw new Error('invalid branch');
const relayDir = path.join(lane, 'relay');
await (await import('node:fs/promises')).mkdir(relayDir, { recursive: true });
// The request directory is held open by handle: a lead that swaps `relay` for a symlink afterwards redirects nothing.
const relay = await openHeld(relayDir, lane);

// THE RECEIPT KEY NEVER TOUCHES DISK: a workspace-write sandbox fences writes, not reads, so any key file the user can read a lead can read. The key and the receipts live in this process's memory alone.
const key = randomBytes(32);
const receipts = new Map();
const checks = options.checks ? JSON.parse(await readFile(options.checks, 'utf8')) : [];
const gitDirOf = async () => { const dot = path.join(worktree, '.git'); try { const text = await readFile(dot, 'utf8'); const m = /^gitdir: (.+)$/m.exec(text); return m ? path.resolve(worktree, m[1].trim()) : dot; } catch (error) { if (error.code === 'EISDIR') return dot; throw error; } };
const identity = () => { const read = key => (spawnSync('/usr/bin/git', ['config', '--global', key], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: os.homedir(), GIT_CONFIG_NOSYSTEM: '1' } }).stdout || '').trim(); return { name: options['author-name'] || read('user.name') || 'Relay', email: options['author-email'] || read('user.email') || 'relay@example.invalid' }; };
const pinnedGitDir = await gitDirOf();
const brokerCtx = async () => ({ gitDir: pinnedGitDir, laneRoot: lane, worktree, iso, stageRoot, branch, author: identity(), receipts, key, remoteUrl: options['remote-url'], requiredChecks: checks.map(c => c.name), checks, bwrap: true, goFile: path.join(goDir, path.basename(goFile)) });
const cap = value => new TextDecoder().decode(Buffer.from(value).subarray(0, 8192), { stream: true });
const result = run => ({ ok: run.status === 0, head: (git('rev-parse', '--short', 'HEAD').stdout || '').trim(), output: cap((run.stdout || '') + (run.stderr || '') + (run.error ? String(run.error) : '')) });

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

// Worktrees the broker made stand in the lane as symlinks to a staging dir that never moves; this maps each lane link to its stage.
const madeFile = path.join(iso, 'made.json');
const made = new Map();
try { for (const [k, v] of Object.entries(JSON.parse(await readFile(madeFile, 'utf8')))) made.set(k, v); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const saveMade = async () => { await (await import('node:fs/promises')).mkdir(iso, { recursive: true }); await writeFile(madeFile, JSON.stringify(Object.fromEntries(made))); };
async function handle(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be an object');
  const schemas = { commit: ['kind', 'paths', 'message', 'expectHead'], push: ['kind'], install: ['kind', 'path'], worktree: ['kind', 'path', 'branch', 'base'], 'worktree-remove': ['kind', 'path'], launch: ['kind', 'seatDir', 'model', 'effort', 'mode', 'worktree'] };
  if (Object.hasOwn(schemas, request.kind) && Object.keys(request).some(key => !schemas[request.kind].includes(key))) throw new Error('unknown field');
  if (request.kind === 'worktree') {
    const target = await lanePath(request.path, true);
    if (typeof request.branch !== 'string' || !request.branch.startsWith(`${branch}-`) || git('check-ref-format', `refs/heads/${request.branch}`).status !== 0) throw new Error('invalid worktree branch');
    if (typeof request.base !== 'string' || !request.base || request.base.startsWith('-')) throw new Error('invalid base');
    const built = await addWorktree({ ...(await brokerCtx()), onStaged: async (stage) => { made.set(target, stage); await saveMade(); } }, { path: target, branch: request.branch, base: request.base });
    if (!built.ok && made.delete(target)) await saveMade();
    return { ok: built.ok, output: cap(built.output) };
  }
  if (request.kind === 'worktree-remove') {
    const link = path.resolve(String(request.path));
    const stage = made.get(link);
    const target = stage ?? await lanePath(request.path);
    if (target === worktree) throw new Error('cannot remove relay worktree');
    const gone = await removeWorktree(await brokerCtx(), { path: target });
    if (gone.ok && stage) { (await import('node:fs')).rmSync(path.dirname(stage), { recursive: true, force: true }); made.delete(link); await saveMade(); const parent = await openHeld(path.dirname(link), lane); try { await unlink(parent.at(path.basename(link))); } finally { await parent.close(); } }
    return { ok: gone.ok, output: cap(gone.output) };
  }
  if (request.kind === 'install') {
    if (!options.installer || !options['store-dir']) throw new Error('install is not configured');
    const target = made.get(path.resolve(String(request.path))) ?? await lanePath(request.path);
    const ctx = await brokerCtx();
    const done = await runInstallSeat({ worktree: target, gitDir: ctx.gitDir, installer: path.resolve(options.installer), storeDir: path.resolve(options['store-dir']), iso, protect: [goDir] });
    return { ok: done.ok, output: cap(done.output) };
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
    if (request.mode === 'build') argv.push('--worktree', made.get(path.resolve(String(request.worktree))) ?? await lanePath(request.worktree));
    const launched = run(process.execPath, argv);
    return { ok: launched.status === 0, output: output(launched) };
  }
  if (request.kind === 'commit') {
    if (!Array.isArray(request.paths) || request.paths.length === 0) throw new Error('commit requires nonempty paths');
    if (typeof request.message !== 'string' || !request.message) throw new Error('commit requires message text');
    if (checks.length === 0) throw new Error('no checks configured for the check seat');
    const done = await commitWithReceipt(await brokerCtx(), { paths: request.paths, message: request.message, expectHead: request.expectHead ?? (git('rev-parse', `refs/heads/${branch}`).stdout || '').trim() });
    return { ok: done.ok, head: done.head, output: cap(done.output) };
  }
  if (request.kind === 'push') {
    const done = await pushWithGo(await brokerCtx());
    return { ok: done.ok, output: cap(done.output) };
  }
  throw new Error(`unknown kind: ${String(request.kind)}`);
}

async function poll() {
  const names = (await readdir(relay.at())).filter(name => /^req-(.+)\.json$/.test(name)).sort();
  for (const name of names) {
    const id = name.slice(4, -5);
    const response = relay.at(`res-${id}.json`);
    try { await readFile(response); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let answer;
    try { answer = await handle(JSON.parse(await readFile(relay.at(name), 'utf8'))); }
    catch (error) { answer = { ok: false, output: cap(`refused: ${error.message}`) }; }
    await writeFile(response, JSON.stringify(answer) + '\n', { flag: 'wx' });
  }
}
do { await poll(); if (!options.once) await new Promise(resolve => setTimeout(resolve, 5000)); } while (!options.once);
