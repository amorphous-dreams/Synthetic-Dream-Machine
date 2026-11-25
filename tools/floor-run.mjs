#!/usr/bin/env node
/**
 * floor-run — the familiar's ONE way to run a heavy command on this box (mandate/floor-gate-1; research/test-floor-proposal
 * §1, §3): inside the one floor lock, metered by the bytes C: loses, stopped past its budget, and receipted in the floor's
 * ledger when it carries a ticket.
 *
 *   node tools/floor-run.mjs [--ticket <id>] [--holder <name>] [--budget-gb <n>] -- <command…>
 *
 *   THE LOCK   outside the floor it re-enters itself through `tools/battery.sh` (the battery's lock, one slot, first come), so
 *              no metered run ever runs unlocked; an unopenable lock exits 64 and runs nothing.
 *   THE DEDUPE with `--ticket`, it asks the wiki's `floor-queue[skip]` first: a ticket whose sha a GREEN verdict already
 *              covers DROPs unrun (exit 0). While the doors stand dark it says so and runs.
 *   THE METER  C: free (`statfs /mnt/c`, the VHD's own growth on the host, which `df /` never shows) at take and at done:
 *              `c-drop`. With one holder at a time the drop attributes to this run, docker's writes included. `wrote` reports
 *              the run's own filesystem output blocks (`/usr/bin/time -f %O`), a report and never a decision.
 *   THE STOP   a sampler re-reads C: and stops the run's whole process group once the drop passes the budget (4G unless
 *              `--budget-gb` names another, operator Q5) or C: falls under the disk floor (`LARES_DISK_MIN_C_GB`, 35 by
 *              default, the one disk-guard reads). BYTES DECIDE; the sampler's interval only paces the reads, and the grace
 *              before a SIGKILL only paces the stop (memory: no global now, clocks pace and annotate, never decide).
 *   THE RECEIPT with `--ticket`, `TAKE` before the run and `DONE <GREEN|RED|STOPPED> wrote= c-drop= · <line>` after, through
 *              the doors (`tools/floor-ledger.mjs`), else the mirror under `~/.lares-scratch/.floor/`.
 *
 * Exit: the command's own code · 65 STOPPED past the budget or the floor · 64 the lock refused · 2 usage.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statfsSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floorHeld, lockPath, HERE } from './floor-lock.mjs';
import { append, ask, doneLine, dropLine, gb, takeLine } from './floor-ledger.mjs';
import { readLimits } from './disk-guard.mjs';

const SELF = fileURLToPath(import.meta.url);
const GB = 1024 ** 3;
export const C_MOUNT = '/mnt/c';
export const DEFAULT_BUDGET_GB = 4;
export const STOPPED_EXIT = 65;
/** The sampler's pace and the stop's grace: they pace reads and the kill, never a verdict. */
const PACE_MS = 2000, GRACE_MS = 10000;
const TIME_BIN = '/usr/bin/time';

/** C: free bytes, or null where no C: stands (a test box, CI). */
export function cFree(mount = C_MOUNT) {
  try { const s = statfsSync(mount); return s.bavail * s.bsize; } catch { return null; }
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
  const opts = { ticket: '', holder: userInfo().username, budgetGb: DEFAULT_BUDGET_GB, command: argv.slice(at + 1) };
  const head = argv.slice(0, at);
  for (let i = 0; i < head.length; i += 2) {
    const [k, v] = [head[i], head[i + 1]];
    if (v === undefined) throw new Error(`${k} wants a value`);
    if (k === '--ticket') opts.ticket = v;
    else if (k === '--holder') opts.holder = v;
    else if (k === '--budget-gb') { const n = Number(v); if (!(n > 0)) throw new Error(`--budget-gb wants a positive number; got "${v}"`); opts.budgetGb = n; }
    else throw new Error(`unknown argument ${k}`);
  }
  return opts;
}

/** Run the command in its own process group under the sampler; answers {code, stopped, wroteBytes, cDropBytes, free0}. */
export async function meteredRun(command, { budgetBytes, floorBytes, readFree = cFree, pace = PACE_MS, grace = GRACE_MS, say = (s) => console.error(s) }) {
  const free0 = readFree();
  const scratch = mkdtempSync(join(tmpdir(), 'floor-run-'));
  const timeOut = join(scratch, 'time');
  const timed = existsSync(TIME_BIN) ? [TIME_BIN, ['-f', '%O', '-o', timeOut, ...command]] : [command[0], command.slice(1)];
  const child = spawn(timed[0], timed[1], { stdio: 'inherit', detached: true });
  let stopped = null;
  const kill = (sig) => { try { process.kill(-child.pid, sig); } catch { /* the group has gone */ } };
  const forward = (sig) => () => kill(sig);
  const onInt = forward('SIGINT'), onTerm = forward('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  const sampler = setInterval(() => {
    if (stopped) return;
    const verdict = stopVerdict({ free0, freeNow: readFree(), budgetBytes, floorBytes });
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
  let opts;
  try { opts = parseArgs(raw); } catch (error) { console.error(`floor-run: ${error.message}\nusage: floor-run.mjs [--ticket <id>] [--holder <name>] [--budget-gb <n>] -- <command…>`); process.exit(2); }
  let lock;
  try { lock = lockPath(); } catch (error) { console.error(`floor-run: REFUSED, the floor lock reads nowhere (${error.message})`); process.exit(64); }
  if (!floorHeld({ lock })) {
    // Re-enter through the one lock; battery.sh passes the held run's exit code through, or refuses with 64.
    const r = spawnSync('bash', [join(HERE, 'battery.sh'), process.execPath, SELF, ...raw], { stdio: 'inherit' });
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
  if (opts.ticket) append([takeLine(opts.ticket, opts.holder, cFree())]);
  const r = await meteredRun(opts.command, { budgetBytes, floorBytes });
  const verdict = verdictOf(r);
  const why = r.stopped ? `${r.stopped}: stopped past ${r.stopped === 'budget' ? `the ${opts.budgetGb}G budget` : 'the C: floor'}` : `exit ${r.code}`;
  console.error(`floor: ${verdict} wrote=${gb(r.wroteBytes)}G c-drop=${gb(r.cDropBytes)}G · ${why} · ${line}${r.free0 === null ? ' (no C: here: unmetered)' : ''}`);
  if (opts.ticket) append([doneLine(opts.ticket, verdict, r.wroteBytes, r.cDropBytes, `${why} · ${line}`)]);
  process.exit(r.stopped ? STOPPED_EXIT : r.code);
}
