#!/usr/bin/env node
/**
 * floor-run — the familiar's ONE way to run a heavy command on this box (mandate/floor-gate-1; research/test-floor-proposal
 * §1, §3): admitted by measured headroom, metered by the bytes C: loses, stopped past its budget, and receipted in the floor's
 * ledger when it carries a ticket. No count of runs stands: the disk's write churn (it crashed the host twice) sets the only
 * limit, and the floor reads it each time a run asks.
 *
 *   node tools/floor-run.mjs [--ticket <id>] [--holder <name>] [--budget-gb <n>] [--ref <ref>] -- <command…>
 *
 *   THE DOOR   outside the floor it re-enters itself through `tools/battery.sh` (the door serialises the admission read, never
 *              the runs), so no metered run ever runs unlocked; an unopenable door exits 64 and runs nothing. Each admitted
 *              run holds its own lock, `.floor/run-<pid>.lock`, keyed by the battery shell's pid (tools/floor-lock.mjs).
 *   THE HEADROOM  `--admit` (battery.sh calls it at the door) reads two measurements and admits once both hold: C: free, less
 *              this run's budget and every live run's unspent budget, stays at or above the disk floor; and beside another run,
 *              the load (`os.loadavg()`, one minute) stands under the cores (`os.cpus()`, times LARES_FLOOR_LOAD_PER_CORE, 1 by
 *              default), each live run counting as at least one core while the load average still trails it. A lone run
 *              admits on any reading (its own stop reads the floor). Until the readings admit it waits at the door; the pace
 *              only spaces the reads, each reading decides. The admitted run's reservation sits at `.floor/run-<pid>.json`.
 *   THE BENCH  with `--ref`, the run proves that ref in its own ephemeral worktree: `git worktree add --detach` under the floor
 *              directory, the ref's own `provision-worktree.mjs --existing` (submodules against local objects, the offline
 *              frozen install COPIED from the pnpm store, the grammar wasm, the TW5 vendor), the command run inside it, and the
 *              worktree removed after, green, red or stopped. Measured 2026-11-27 on a built bench: node_modules 1.25G, the
 *              whole tree 1.71G; so a `--ref` run's default budget reads 4G plus a 2G bench.
 *   THE DEDUPE with `--ticket`, it asks the wiki's `floor-queue[skip]` first: a ticket whose sha a GREEN verdict already
 *              covers DROPs unrun (exit 0). While the doors stand dark it says so and runs.
 *   THE METER  C: free (`statfs /mnt/c`, the VHD's own growth on the host, which `df /` never shows) at take and at done:
 *              `c-drop`. Beside other runs the drop shares their writes too. `wrote` reports the run's own filesystem output
 *              blocks (`/usr/bin/time -f %O`), a report and never a decision.
 *   THE STOP   a sampler re-reads C: and stops the run's whole process group once the drop passes the budget (4G unless
 *              `--budget-gb` names another, operator Q5; beside other runs, the sum of every live budget) or C: falls under the
 *              disk floor (`LARES_DISK_MIN_C_GB`, 35 by default, the one disk-guard reads). BYTES DECIDE; the sampler's interval
 *              only paces the reads, and the grace before a SIGKILL only paces the stop (memory: no global now, clocks pace and
 *              annotate, never decide).
 *   THE RECEIPT with `--ticket`, `TAKE` before the run and `DONE <GREEN|RED|STOPPED> wrote= c-drop= run=<pid> · <line>` after,
 *              through the doors (`tools/floor-ledger.mjs`), else the mirror under `~/.lares-scratch/.floor/`.
 *
 * Exit: the command's own code · 65 STOPPED past the budget or the floor · 64 the door refused · 2 usage.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floorDir, heldRun, HERE } from './floor-lock.mjs';
import { append, ask, doneLine, dropLine, gb, takeLine } from './floor-ledger.mjs';
import { readLimits } from './disk-guard.mjs';

const SELF = fileURLToPath(import.meta.url);
const GB = 1024 ** 3;
export const C_MOUNT = '/mnt/c';
export const DEFAULT_BUDGET_GB = 4;
/** What one ephemeral bench writes, rounded up from the 1.71G a built bench measured (node_modules 1.25G of it). */
export const BENCH_GB = 2;
export const STOPPED_EXIT = 65;
/** The sampler's pace and the stop's grace: they pace reads and the kill, never a verdict. */
const PACE_MS = 2000, GRACE_MS = 10000;
const TIME_BIN = '/usr/bin/time';
const ROOT = resolve(HERE, '..');

/** C: free bytes, or null where no C: stands (a test box, CI). */
export function cFree(mount = C_MOUNT) {
  try { const s = statfsSync(mount); return s.bavail * s.bsize; } catch { return null; }
}

const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/** The runs standing beside this one: each live run's reservation under `.floor/`, this run's own (by its key) excluded. A
 *  reservation whose pid has gone reads stale (the kernel's answer, never a clock). */
export function othersOf(floorDir, key, alive = pidAlive) {
  let names = [];
  try { names = readdirSync(floorDir); } catch { return []; }
  const out = [];
  for (const n of names) {
    const m = /^run-(\d+)\.json$/.exec(n);
    if (!m || Number(m[1]) === key) continue;
    try { const r = JSON.parse(readFileSync(join(floorDir, n), 'utf8')); if (alive(r.pid)) out.push({ key: Number(m[1]), pid: r.pid, free0: r.free0, budgetBytes: r.budgetBytes }); } catch { /* unreadable: no reservation */ }
  }
  return out;
}

/** Sweep the leavings of runs whose pid has gone (a shell killed past its trap): their lock and reservation files. */
export function sweepGone(floorDir, alive = pidAlive) {
  let names = [];
  try { names = readdirSync(floorDir); } catch { return; }
  for (const n of names) {
    const m = /^run-(\d+)\.(json|lock)$/.exec(n);
    if (m && !alive(Number(m[1]))) rmSync(join(floorDir, n), { force: true });
  }
}

/** What each other run may still write: its budget less what C: has already lost since its take. */
export const remainingOf = (other, freeNow) => Math.max(0, other.budgetBytes - Math.max(0, other.free0 - freeNow));

/** The headroom verdict off two measurements: null where the run admits, else the reason it waits. A lone run always
 *  admits (its own stop reads the floor). Beside other runs, C: free less this budget and every unspent budget must hold the
 *  floor, and the load (each live run counting as at least one core, since the load average trails a fresh run) must stand
 *  under the cores. No count of runs decides: many small runs admit where the bytes and the cores hold them. */
export function headroom({ freeNow, floorBytes, budgetBytes, others, load = 0, cores = Infinity }) {
  if (!others.length) return null;
  if (freeNow !== null) {
    const after = freeNow - budgetBytes - others.reduce((n, o) => n + remainingOf(o, freeNow), 0);
    if (after < floorBytes) return `the live runs' unspent bytes plus this run's ${gb(budgetBytes)}G budget would carry C: to ${gb(after)}G, past the ${gb(floorBytes)}G floor`;
  }
  const busy = Math.max(load, others.length);
  if (busy >= cores) return `the load reads ${busy.toFixed(2)} against ${cores} cores`;
  return null;
}

/** True where the measurements admit the run. */
export const admits = (reading) => headroom(reading) === null;

/** The cores the load reads against: the box's own, times LARES_FLOOR_LOAD_PER_CORE (1 by default). */
export function coresOf(env = process.env, count = cpus().length) {
  const raw = env.LARES_FLOOR_LOAD_PER_CORE;
  const per = raw === undefined || raw === '' ? 1 : Number(raw);
  if (!Number.isFinite(per) || per < 0) throw new Error(`LARES_FLOOR_LOAD_PER_CORE must read a non-negative number; got "${raw}"`);
  return count * per;
}

/** Wait (at the door) until the measurements admit this run. The pace spaces the reads; each read decides. */
export async function awaitAdmission({ floorDir, key, floorBytes, budgetBytes, readFree = cFree, readLoad = () => loadavg()[0], cores = coresOf(), pace = PACE_MS, say = (s) => console.error(s) }) {
  let told = false;
  for (;;) {
    const why = headroom({ freeNow: readFree(), floorBytes, budgetBytes, others: othersOf(floorDir, key), load: readLoad(), cores });
    if (why === null) return;
    if (!told) { say(`floor: run ${key} waits: ${why}`); told = true; }
    await new Promise((r) => setTimeout(r, pace));
  }
}

/** Write this run's reservation, keyed by the run's own pid. Answers the release (battery.sh's exit trap removes it too). */
export function reserve(floorDir, key, record) {
  const file = join(floorDir, `run-${key}.json`);
  mkdirSync(floorDir, { recursive: true });
  writeFileSync(file, JSON.stringify(record));
  return () => rmSync(file, { force: true });
}

/** `--admit <floor-dir> <key> <budget-gb>`: battery.sh's door read. Sweeps gone runs, waits for headroom, reserves. */
export async function admitAt(argv, { say = (s) => console.error(s), env = process.env, ...readers } = {}) {
  const [dir, rawKey, rawBudget] = argv;
  const key = Number(rawKey), budgetGb = Number(rawBudget);
  if (!dir || !(Number.isInteger(key) && key > 0) || !(budgetGb > 0)) throw new Error('--admit wants <floor-dir> <pid> <budget-gb>');
  const budgetBytes = budgetGb * GB;
  const floorBytes = readLimits(env).minC * GB;
  sweepGone(dir);
  await awaitAdmission({ floorDir: dir, key, floorBytes, budgetBytes, cores: coresOf(env), say, ...readers });
  reserve(dir, key, { pid: key, free0: (readers.readFree ?? cFree)(), budgetBytes });
}

/** The command a `--ref` run meters: its own worktree added at the ref, provisioned by the ref's own tool, the command run inside. */
export function benchCommand(root, bench, ref, command) {
  return ['bash', '-c', 'set -e; git -C "$0" worktree add --detach "$1" "$2"; node "$1/tools/provision-worktree.mjs" --existing "$1"; cd "$1"; exec "${@:3}"', root, bench, ref, ...command];
}

/** Remove an ephemeral bench, whatever its run read. */
export function removeBench(root, bench) {
  spawnSync('git', ['-C', root, 'worktree', 'remove', '--force', bench], { stdio: 'ignore' });
  rmSync(bench, { recursive: true, force: true });
  spawnSync('git', ['-C', root, 'worktree', 'prune'], { stdio: 'ignore' });
}

/** The stop verdict off two C: readings: `budget` past the budget, `floor` under the floor, null to run on. Bytes alone. */
export function stopVerdict({ free0, freeNow, budgetBytes, floorBytes }) {
  if (free0 === null || freeNow === null) return null;
  if (freeNow < floorBytes) return 'floor';
  if (free0 - freeNow > budgetBytes) return 'budget';
  return null;
}

export function parseArgs(argv) {
  const at = argv.indexOf('--');
  if (at < 0 || at === argv.length - 1) throw new Error('name the command after --');
  const opts = { ticket: '', holder: userInfo().username, budgetGb: 0, ref: '', command: argv.slice(at + 1) };
  const head = argv.slice(0, at);
  for (let i = 0; i < head.length; i += 2) {
    const [k, v] = [head[i], head[i + 1]];
    if (v === undefined) throw new Error(`${k} wants a value`);
    if (k === '--ticket') opts.ticket = v;
    else if (k === '--holder') opts.holder = v;
    else if (k === '--ref') opts.ref = v;
    else if (k === '--budget-gb') { const n = Number(v); if (!(n > 0)) throw new Error(`--budget-gb wants a positive number; got "${v}"`); opts.budgetGb = n; }
    else throw new Error(`unknown argument ${k}`);
  }
  if (!opts.budgetGb) opts.budgetGb = DEFAULT_BUDGET_GB + (opts.ref ? BENCH_GB : 0);
  return opts;
}

/** Run the command in its own process group under the sampler; answers {code, stopped, wroteBytes, cDropBytes, free0}. */
export async function meteredRun(command, { cwd, budgetBytes, floorBytes, extraBudget = () => 0, readFree = cFree, pace = PACE_MS, grace = GRACE_MS, say = (s) => console.error(s) }) {
  const free0 = readFree();
  const scratch = mkdtempSync(join(tmpdir(), 'floor-run-'));
  const timeOut = join(scratch, 'time');
  const timed = existsSync(TIME_BIN) ? [TIME_BIN, ['-f', '%O', '-o', timeOut, ...command]] : [command[0], command.slice(1)];
  const child = spawn(timed[0], timed[1], { stdio: 'inherit', detached: true, ...(cwd ? { cwd } : {}) });
  let stopped = null;
  const kill = (sig) => { try { process.kill(-child.pid, sig); } catch { /* the group has gone */ } };
  const forward = (sig) => () => kill(sig);
  const onInt = forward('SIGINT'), onTerm = forward('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  const sampler = setInterval(() => {
    if (stopped) return;
    const verdict = stopVerdict({ free0, freeNow: readFree(), budgetBytes: budgetBytes + extraBudget(), floorBytes });
    if (!verdict) return;
    stopped = verdict;
    say(`floor: STOPPING the run: ${verdict === 'budget' ? `C: dropped past the ${gb(budgetBytes)}G budget` : `C: fell under the ${gb(floorBytes)}G floor`}`);
    kill('SIGTERM');
    setTimeout(() => kill('SIGKILL'), grace).unref();
  }, pace);
  const code = await new Promise((res) => { child.on('exit', (c, sig) => res(c ?? (sig ? 128 : 1))); child.on('error', () => res(127)); });
  clearInterval(sampler);
  process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
  const freeEnd = readFree();
  let wroteBytes = NaN;
  try { const blocks = Number(readFileSync(timeOut, 'utf8').trim().split('\n').pop()); if (Number.isFinite(blocks)) wroteBytes = blocks * 512; } catch { /* no time report */ }
  rmSync(scratch, { recursive: true, force: true });
  return { code, stopped, wroteBytes, cDropBytes: free0 === null || freeEnd === null ? NaN : free0 - freeEnd, free0 };
}

export function verdictOf({ code, stopped }) {
  return stopped ? 'STOPPED' : code === 0 ? 'GREEN' : 'RED';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const raw = process.argv.slice(2);
  if (raw[0] === '--admit') {
    try { await admitAt(raw.slice(1)); process.exit(0); } catch (error) { console.error(`floor-run: ${error.message}`); process.exit(2); }
  }
  let opts;
  try { opts = parseArgs(raw); } catch (error) { console.error(`floor-run: ${error.message}\nusage: floor-run.mjs [--ticket <id>] [--holder <name>] [--budget-gb <n>] [--ref <ref>] -- <command…>`); process.exit(2); }
  let dir;
  try { dir = floorDir(); } catch (error) { console.error(`floor-run: REFUSED, the floor lock reads nowhere (${error.message})`); process.exit(64); }
  const run = heldRun({ dir });
  if (!run) {
    // Re-enter through the door; battery.sh admits by headroom and passes the held run's exit code through, or refuses with 64.
    const r = spawnSync('bash', [join(HERE, 'battery.sh'), '--budget-gb', String(opts.budgetGb), process.execPath, SELF, ...raw], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  const line = opts.command.join(' ');
  if (opts.ticket) {
    const skip = ask('skip');
    if (skip === null) console.error('floor-run: the doors stand dark; the sha dedupe skipped, the receipt lands in the mirror');
    else if (skip.includes(opts.ticket)) {
      append([dropLine(opts.ticket, 'a GREEN verdict already covers this sha')]);
      console.log(`floor-run: ${opts.ticket} DROPPED unrun: a GREEN verdict already covers its sha`);
      process.exit(0);
    }
  }
  const budgetBytes = opts.budgetGb * GB;
  const floorBytes = readLimits().minC * GB;
  const bench = opts.ref ? join(dir, `bench-${run.key}-${process.pid}`) : '';
  const command = opts.ref ? benchCommand(ROOT, bench, opts.ref, opts.command) : opts.command;
  if (opts.ticket) append([takeLine(opts.ticket, opts.holder, cFree(), run.key)]);
  let r;
  try {
    r = await meteredRun(command, { budgetBytes, floorBytes, extraBudget: () => othersOf(dir, run.key).reduce((n, o) => n + o.budgetBytes, 0) });
  } finally { if (bench) removeBench(ROOT, bench); }
  const verdict = verdictOf(r);
  const why = r.stopped ? `${r.stopped}: stopped past ${r.stopped === 'budget' ? `the ${opts.budgetGb}G budget` : 'the C: floor'}` : `exit ${r.code}`;
  const at = opts.ref ? ` · bench at ${opts.ref}` : '';
  console.error(`floor: ${verdict} run=${run.key} wrote=${gb(r.wroteBytes)}G c-drop=${gb(r.cDropBytes)}G · ${why} · ${line}${at}${r.free0 === null ? ' (no C: here: unmetered)' : ''}`);
  if (opts.ticket) append([doneLine(opts.ticket, verdict, r.wroteBytes, r.cDropBytes, `${why} · ${line}${at}`, run.key)]);
  process.exit(r.stopped ? STOPPED_EXIT : r.code);
}
