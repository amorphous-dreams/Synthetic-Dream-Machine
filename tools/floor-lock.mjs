#!/usr/bin/env node
/**
 * floor-lock — THE TOOL WALL: a heavy tool runs only inside the one floor lock (mandate/floor-gate-1; research/test-floor-
 * proposal §1b.2). The lock stays the battery's: `tools/battery.sh --lock-path` names it (LARES_BATTERY_LOCK, else
 * `<passwd home>/.lares-scratch/.battery.lock`, never $HOME), one slot, first come.
 *
 *   node tools/floor-lock.mjs --held                 exit 0 where this process runs inside the held floor, 1 otherwise
 *   node tools/floor-lock.mjs --lock-path            the lock path battery.sh names
 *
 * HOW "INSIDE" READS, with no environment marker (no new env vars; a marker a child inherits would also outlive the lock):
 * the kernel's own lock table. `/proc/locks` lists every FLOCK by holder pid and inode; this process runs inside the floor
 * where a FLOCK on the lock's inode names this process or one of its ancestors (battery.sh's shell takes the lock and runs
 * the command as its child, so the holder stays alive above every heavy run). An open descriptor alone never counts: a
 * waiter holds one too, and a stranger's lock on the same inode would read as ours. A Codex seat cannot open the lock at all (it sits outside
 * the seat's write roots), so it never reads as inside.
 *
 * The wall exists against accident and habit, which caused both VHD crashes, never against a hostile process running as the
 * same user (memory: STOP OVERCONSTRAINING SPIRITS — receipts over gates); the floor ledger keeps the receipt.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FLOOR_EXIT = 64;

/** The one lock path, as battery.sh names it (so the two can never disagree). Throws where battery.sh refuses. */
export function lockPath(env = process.env) {
  const r = spawnSync('bash', [join(HERE, 'battery.sh'), '--lock-path'], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error((r.stderr || `battery.sh --lock-path exited ${r.status}`).trim());
  return r.stdout.trim();
}

/** The inodes `/proc/locks` text names a FLOCK on, each with its holder pids. */
export function flocksOf(text) {
  const out = new Map();
  for (const line of String(text).split('\n')) {
    // "1: FLOCK  ADVISORY  WRITE 1234 08:20:5678 0 EOF"  (a blocked waiter's line carries "->" and holds nothing)
    const m = /^\d+:\s+FLOCK\s+\S+\s+\S+\s+(\d+)\s+[0-9a-f]+:[0-9a-f]+:(\d+)\s/.exec(line.trim());
    if (!m) continue;
    const ino = Number(m[2]);
    if (!out.has(ino)) out.set(ino, new Set());
    out.get(ino).add(Number(m[1]));
  }
  return out;
}

/** This process and every ancestor, read off `/proc/<pid>/stat` (the field after the parenthesized name). */
export function ancestry(pid, proc = '/proc') {
  const seen = [];
  let at = pid;
  for (let i = 0; i < 256 && at > 0 && !seen.includes(at); i++) {
    seen.push(at);
    let stat;
    try { stat = readFileSync(join(proc, String(at), 'stat'), 'utf8'); } catch { break; }
    const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    if (!Number.isFinite(ppid)) break;
    at = ppid;
  }
  return seen;
}

/** True where this process (or an ancestor) holds the floor. Every reader injects, so a test reads a fixture /proc. */
export function floorHeld({ lock, pid = process.pid, proc = '/proc' } = {}) {
  let ino, real;
  try { real = realpathSync(lock); ino = statSync(real).ino; } catch { return false; }
  let table;
  try { table = flocksOf(readFileSync(join(proc, 'locks'), 'utf8')); } catch { return false; }
  const holders = table.get(ino);
  if (!holders || holders.size === 0) return false;
  return ancestry(pid, proc).some((p) => holders.has(p));
}

/** The refusal a heavy tool prints outside the floor: the cure names the floor runner around the same command. */
export function floorRefusal(tool, argv = []) {
  const line = ['node', `tools/${tool}`, ...argv].join(' ');
  return `floor: refused — ${tool} runs only on the floor, one heavy run at a time (operator, 2026-11-25; mandate/floor-gate-1).\n` +
    `pono: node tools/floor-run.mjs -- ${line}   (a tasked spirit hands that line back as a floor ticket instead)`;
}

/** The wall a heavy tool's CLI entry calls first: exits 64 with the cure where the floor stands unheld by this process. */
export function requireFloor(tool, argv = [], { env = process.env, held = floorHeld, exit = (code) => process.exit(code), say = (s) => console.error(s) } = {}) {
  let lock;
  try { lock = lockPath(env); } catch (error) { say(`floor: refused — the floor lock reads nowhere (${error.message})`); return exit(FLOOR_EXIT); }
  if (held({ lock })) return true;
  say(floorRefusal(tool, argv));
  return exit(FLOOR_EXIT);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2];
  try {
    if (arg === '--lock-path') { console.log(lockPath()); process.exit(0); }
    if (arg === '--held') process.exit(floorHeld({ lock: lockPath() }) ? 0 : 1);
    console.error('usage: floor-lock.mjs --held | --lock-path'); process.exit(2);
  } catch (error) { console.error(`floor-lock: ${error.message}`); process.exit(arg === '--held' ? 1 : 2); }
}
