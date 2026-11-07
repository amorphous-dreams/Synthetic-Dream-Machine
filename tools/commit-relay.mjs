#!/usr/bin/env node
import { realpath, readdir, readFile, writeFile, unlink, lstat, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirHeld, openHeld, openHeldSync } from './held-dir.mjs';
import { lstatSync } from 'node:fs';
import { open as fsOpen } from 'node:fs/promises';
import { constants as FSC } from 'node:fs';
import { brokerRootPath, ensureBrokerRoot, ensureLaneDir, ensureStageRoot, laneId } from './broker-root.mjs';
import { addWorktree, commitWithReceipt, pushWithGo, removeWorktree } from './seat-broker.mjs';
import { runInstallSeat, runTestSeat } from './seat-walls.mjs';

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
const lane = await realpath(options['lane-root']); // broker-owned
const worktree = await realpath(options.worktree); // broker-owned
const scratch = await realpath(path.join(os.homedir(), '.lares-scratch')); // broker-owned
const inside = (root, target) => target !== root && !path.relative(root, target).startsWith(`..${path.sep}`) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target));
if (!inside(scratch, worktree)) throw new Error('worktree must sit under the real home .lares-scratch');
// THE GO AND THE BROKER'S STATE LIVE UNDER THE ONE FIXED BROKER ROOT (the same root the seat dirs use), and no caller names either path:
// <root>/go/<lane>/push-go and <root>/iso/<lane>. One verifier (broker-root.mjs) checks the root before anything is created: ours, exactly
// 0700, no symlinked or group/other-writable component, nothing under ~/.lares-scratch (every lane included), no ancestor of a granted root.
const homeReal = await realpath(os.homedir()); // broker-owned
const brokerRoot = brokerRootPath(homeReal, process.env);
const rootOpts = { realHome: homeReal, guarded: [lane, worktree, scratch] };
ensureBrokerRoot(brokerRoot, rootOpts);
const goDir = ensureLaneDir(brokerRoot, 'go', lane, rootOpts);
const goFile = path.join(goDir, 'push-go');
const iso = ensureLaneDir(brokerRoot, 'iso', lane, rootOpts);
// A made worktree is a GRANTED root for its builder, so it lives under the scratch tree (house law) but in a broker-owned dir no lane grants: .broker-worktrees/<lane>.
const stageRoot = ensureStageRoot(scratch, laneId(lane));
const launcher = await realpath(options.launcher); // broker-owned
if (launcher === scratch || inside(scratch, launcher)) throw new Error('launcher must sit outside the scratch tree entirely: a lead can write anywhere a lane or worktree lives under it');
const branch = options.branch;
const git = (...argv) => spawnSync('/usr/bin/git', ['-C', worktree, ...argv], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' } });
if (branch.startsWith('-') || git('check-ref-format', `refs/heads/${branch}`).status !== 0) throw new Error('invalid branch');
const worktreeHeld = await openHeld(worktree, scratch); // the commit door reads the worktree only through this handle
// O_NONBLOCK lets a FIFO (or any special file) planted at a request name open without waiting on a writer; the kind check then
// refuses it by name before a read, so a planted pipe never stalls the one broker. A directory keeps its EISDIR for gitDirOf.
const kindOf = st => st.isFIFO() ? 'fifo' : st.isSocket() ? 'socket' : st.isCharacterDevice() ? 'character device' : st.isBlockDevice() ? 'block device' : 'special file';
async function readHeldAsync(held, name) {
  const fh = await fsOpen(held.at(name), FSC.O_RDONLY | FSC.O_NOFOLLOW | FSC.O_NONBLOCK);
  try {
    const st = await fh.stat();
    if (st.isDirectory()) throw Object.assign(new Error(`EISDIR: ${name} is a directory`), { code: 'EISDIR' });
    if (!st.isFile()) throw new Error(`${name}: not a regular file (${kindOf(st)})`);
    return await fh.readFile('utf8');
  } finally { await fh.close(); }
}
const laneHeld = openHeldSync(lane, lane);
mkdirHeld(laneHeld, 'relay');
const relayDir = laneHeld.at('relay');
// The request directory is held open by handle: a lead that swaps `relay` for a symlink afterwards redirects nothing.
const relay = await openHeld(relayDir, lane);

// THE RECEIPT KEY NEVER TOUCHES DISK: a workspace-write sandbox fences writes, not reads, so any key file the user can read a lead can read. The key and the receipts live in this process's memory alone.
const key = randomBytes(32);
const receipts = new Map();
const checks = options.checks ? JSON.parse(await readFile(options.checks, 'utf8')) : []; // broker-owned
const gitDirOf = async () => { try { const text = await readHeldAsync(worktreeHeld, '.git'); const m = /^gitdir: (.+)$/m.exec(text); return m ? path.resolve(worktree, m[1].trim()) : worktreeHeld.at('.git'); } catch (error) { if (/EISDIR|ELOOP/.test(error.message) || error.code === 'EISDIR') return path.join(worktree, '.git'); // broker-owned: the repo's own git dir
    throw error; } };
const identity = () => { const read = key => (spawnSync('/usr/bin/git', ['config', '--global', key], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: os.homedir(), GIT_CONFIG_NOSYSTEM: '1' } }).stdout || '').trim(); return { name: options['author-name'] || read('user.name') || 'Relay', email: options['author-email'] || read('user.email') || 'relay@example.invalid' }; };
const pinnedGitDir = await gitDirOf();
const brokerCtx = async () => ({ gitDir: pinnedGitDir, laneRoot: lane, laneId: laneId(lane), worktree, worktreeHeld, iso, stageRoot, branch, author: identity(), receipts, key, remoteUrl: options['remote-url'], requiredChecks: checks.map(c => c.name), checks, bwrap: true, goFile: path.join(goDir, path.basename(goFile)) });
const cap = value => new TextDecoder().decode(Buffer.from(value).subarray(0, 8192), { stream: true });
const result = run => ({ ok: run.status === 0, head: (git('rev-parse', '--short', 'HEAD').stdout || '').trim(), output: cap((run.stdout || '') + (run.stderr || '') + (run.error ? String(run.error) : '')) });

// A path a lead names is checked LEXICALLY against the lane here and acquired only through the lane root held open by handle: the
// walk below lstat's every component through that handle, and the final directory opens once (O_NOFOLLOW, verified under the lane).
function laneRel(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('path must be absolute');
  const target = path.resolve(value);
  if (!inside(lane, target)) throw new Error('path outside lane-root');
  return { target, rel: path.relative(lane, target) };
}
function openLaneDir(value) {
  const { rel } = laneRel(value);
  const parts = rel.split(path.sep);
  for (let i = 1; i <= parts.length; i++) {
    const st = lstatSync(laneHeld.at(parts.slice(0, i).join('/')));
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`${parts.slice(0, i).join('/')} is not a real directory inside the lane`);
  }
  return openHeldSync(laneHeld.at(rel), lane);
}
const run = (command, argv) => spawnSync(command, argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const output = r => cap((r.stdout || '') + (r.stderr || '') + (r.error ? String(r.error) : ''));

// Worktrees the broker made stand in the lane as symlinks to a staging dir that never moves; this maps each lane link to its stage.
const madeFile = path.join(iso, 'made.json');
const made = new Map();
try { for (const [k, v] of Object.entries(JSON.parse(await readFile(madeFile, 'utf8')))) made.set(k, v); } catch (error) { if (error.code !== 'ENOENT') throw error; } // broker-owned
const saveMade = async () => { await mkdir(iso, { recursive: true }); await writeFile(madeFile, JSON.stringify(Object.fromEntries(made))); }; // broker-owned
async function handle(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be an object');
  const schemas = { test: ['kind', 'runner', 'files'], commit: ['kind', 'paths', 'message', 'expectHead'], push: ['kind'], install: ['kind', 'path'], worktree: ['kind', 'path', 'branch', 'base'], 'worktree-remove': ['kind', 'path'], launch: ['kind', 'seatDir', 'model', 'effort', 'mode', 'worktree'] };
  if (Object.hasOwn(schemas, request.kind)) { const unknown = Object.keys(request).find(key => !schemas[request.kind].includes(key)); if (unknown) throw new Error(`unknown field ${unknown}`); }
  if (request.kind === 'test') {
    const held = openHeldSync(worktree, scratch); // broker-owned: the controller configured worktree
    try { return await runTestSeat({ worktreeHeld: held, laneHeld, runner: request.runner, files: request.files }); } finally { held.close(); }
  }
  if (request.kind === 'worktree') {
    const { target } = laneRel(request.path);
    if (typeof request.branch !== 'string' || !request.branch.startsWith(`${branch}-`) || git('check-ref-format', `refs/heads/${request.branch}`).status !== 0) throw new Error('invalid worktree branch');
    if (typeof request.base !== 'string' || !request.base || request.base.startsWith('-')) throw new Error('invalid base');
    const built = await addWorktree({ ...(await brokerCtx()), onStaged: async (stage) => { made.set(target, stage); await saveMade(); } }, { path: target, branch: request.branch, base: request.base });
    if (!built.ok && made.delete(target)) await saveMade();
    return { ok: built.ok, output: cap(built.output) };
  }
  if (request.kind === 'worktree-remove') {
    const link = path.resolve(String(request.path));
    const stage = made.get(link);
    if (link === worktree) throw new Error('cannot remove relay worktree');
    if (!stage) throw new Error('not a worktree the broker made');
    const target = stage;
    const gone = await removeWorktree(await brokerCtx(), { path: target });
    if (gone.ok && stage) { (await import('node:fs')).rmSync(path.dirname(stage), { recursive: true, force: true }); made.delete(link); await saveMade(); const parent = await openHeld(path.dirname(link), lane); try { await unlink(parent.at(path.basename(link))); } finally { await parent.close(); } }
    return { ok: gone.ok, output: cap(gone.output) };
  }
  if (request.kind === 'install') {
    if (!options.installer || !options['store-dir']) throw new Error('install is not configured');
    const stage = made.get(path.resolve(String(request.path)));
    const held = stage ? openHeldSync(stage, stageRoot) : openLaneDir(request.path); // the worktree opens ONCE here; the wall binds this fd, never a pathname
    const ctx = await brokerCtx();
    let done;
    try { done = await runInstallSeat({ worktreeHeld: held, gitDir: ctx.gitDir, installer: path.resolve(options.installer), storeDir: path.resolve(options['store-dir']), iso, protect: [goDir] }); } finally { held.close(); }
    return { ok: done.ok, output: cap(done.output) };
  }
  if (request.kind === 'launch') {
    if (!['gpt-6.1-terra', 'gpt-6-luna'].includes(request.model)) throw new Error('invalid model');
    if (!['low', 'medium', 'high'].includes(request.effort)) throw new Error('invalid effort');
    if (!['build', 'read', 'research'].includes(request.mode)) throw new Error('invalid mode');
    if (request.mode !== 'build' && Object.hasOwn(request, 'worktree')) throw new Error('worktree only allowed for build');
    const seat = laneRel(request.seatDir).target; // the launcher opens it by handle and refuses a missing brief
    const argv = [launcher, '--seat-dir', seat, '--model', request.model, '--effort', request.effort, '--mode', request.mode];
    if (request.mode === 'build') argv.push('--worktree', made.get(path.resolve(String(request.worktree))) ?? laneRel(request.worktree).target);
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
    try { await lstat(relay.at(`res-${id}.json`)); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let answer;
    try { answer = await handle(JSON.parse(await readHeldAsync(relay, name))); }
    catch (error) { answer = { ok: false, output: cap(`refused: ${error.message}`) }; }
    try { await writeFile(relay.at(`res-${id}.json`), JSON.stringify(answer) + '\n', { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // A lane can plant an answer while the act runs. Preserve it and keep the relay alive.
      console.error(`refused: receipt-clash res-${id}.json; request handled, existing file preserved`);
    }
  }
}
do { await poll(); if (!options.once) await new Promise(resolve => setTimeout(resolve, 5000)); } while (!options.once);
