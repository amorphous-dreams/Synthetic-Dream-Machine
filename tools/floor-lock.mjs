#!/usr/bin/env node
/**
 * floor-lock — THE TOOL WALL: a heavy tool runs only inside a held floor slot (mandate/floor-gate-1; research/test-floor-
 * proposal §1b.2). The floor stands TWO slots (operator, 2026-11-25: a second heavy run flies at once, the C: byte floor
 * shared, a third waits). The locks stay the battery's: `tools/battery.sh --lock-paths` names them, slot 1 at
 * LARES_BATTERY_LOCK (else `<passwd home>/.lares-scratch/.battery.lock`, never $HOME), slot 2 beside it with `-2` before
 * the `.lock` suffix (`.battery-2.lock`); a run takes the first free slot.
 *
 *   node tools/floor-lock.mjs --held                 exit 0 where this process runs inside a held slot, 1 otherwise
 *   node tools/floor-lock.mjs --slot                 prints the slot number this process runs inside (exit 1 outside)
 *   node tools/floor-lock.mjs --status               one row per slot: which run holds it (pid and command), or free
 *   node tools/floor-lock.mjs --lock-path            slot 1's lock path, as battery.sh names it
 *   node tools/floor-lock.mjs --lock-paths           every slot's lock path, one per line, in slot order
 *
 * HOW "INSIDE" READS, with no environment marker (no new env vars; a marker a child inherits would also outlive the lock):
 * the kernel's own lock state, read by OPEN FILE, never by pid alone. battery.sh opens the lock on fd 9 and runs `flock 9`:
 * flock(1) runs as a CHILD process that locks the shell's open file and exits, so `/proc/locks` names the flock(1) pid, which
 * no heavy run descends from (the nested-take deadlock of 2026-11-25: floor-run -> battery.sh -> floor-run read unheld and
 * waited on its own lock). So this process runs inside the floor where this process or an ancestor holds a descriptor on
 * the lock file whose open file carries the FLOCK: `/proc/<pid>/fdinfo/<fd>` lists a `lock:` line for every lock that open
 * file owns (Linux has listed them there since 4.x). A bare descriptor never counts: a waiter holds one too. The holder pid in `/proc/locks` still counts where it names an
 * ancestor. A Codex seat cannot open the lock at all (it sits outside the seat's write roots), so it never reads as inside.
 *
 * The wall exists against accident and habit, which caused both VHD crashes, never against a hostile process running as the
 * same user (memory: STOP OVERCONSTRAINING SPIRITS — receipts over gates); the floor ledger keeps the receipt.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FLOOR_EXIT = 64;
export const SLOTS = 2;

/** The one lock path, as battery.sh names it (so the two can never disagree). Throws where battery.sh refuses. */
export function lockPath(env = process.env) {
  const r = spawnSync('bash', [join(HERE, 'battery.sh'), '--lock-path'], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error((r.stderr || `battery.sh --lock-path exited ${r.status}`).trim());
  return r.stdout.trim();
}

/** Every slot's lock path, in slot order, as battery.sh names them. Throws where battery.sh refuses. */
export function lockPaths(env = process.env) {
  const r = spawnSync('bash', [join(HERE, 'battery.sh'), '--lock-paths'], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error((r.stderr || `battery.sh --lock-paths exited ${r.status}`).trim());
  return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
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
  // /proc/locks may name no holder at all (WSL lists a flock(1) lock with pid 0, or not under this inode), so an
  // empty table never decides: the open-file witness below reads the hold either way.
  const holders = table.get(ino) ?? new Set();
  const line = ancestry(pid, proc);
  if (line.some((p) => holders.has(p))) return true;
  // By open file: an ancestor's descriptor on the lock file, its fdinfo naming the FLOCK that open file owns.
  for (const p of line) {
    let fds;
    try { fds = readdirSync(join(proc, String(p), 'fd')); } catch { continue; }
    for (const fd of fds) {
      let target;
      try { target = readlinkSync(join(proc, String(p), 'fd', fd)); } catch { continue; }
      if (target !== real) continue;
      let info = '';
      try { info = readFileSync(join(proc, String(p), 'fdinfo', fd), 'utf8'); } catch { continue; }
      if (/^lock:\s+\d+:\s+FLOCK\s/m.test(info)) return true;
    }
  }
  return false;
}

/** The 1-based slot this process (or an ancestor) holds across the slot locks, 0 outside every slot. A nested take reads the
 *  ancestor's slot and runs at once; each slot reads by its own open file. */
export function heldSlot({ locks, pid = process.pid, proc = '/proc' } = {}) {
  for (let i = 0; i < (locks ?? []).length; i++) if (floorHeld({ lock: locks[i], pid, proc })) return i + 1;
  return 0;
}

/** Which run holds each slot: every process with a descriptor on a slot lock whose open file owns the FLOCK, or free. */
export function slotStatus({ locks, proc = '/proc' } = {}) {
  let pids = [];
  try { pids = readdirSync(proc).filter((n) => /^\d+$/.test(n)); } catch { /* no proc */ }
  return (locks ?? []).map((lock, i) => {
    let real; try { real = realpathSync(lock); } catch { return { slot: i + 1, lock, holder: null }; }
    for (const p of pids) {
      let fds; try { fds = readdirSync(join(proc, p, 'fd')); } catch { continue; }
      for (const fd of fds) {
        let target; try { target = readlinkSync(join(proc, p, 'fd', fd)); } catch { continue; }
        if (target !== real) continue;
        let info = ''; try { info = readFileSync(join(proc, p, 'fdinfo', fd), 'utf8'); } catch { continue; }
        if (!/^lock:\s+\d+:\s+FLOCK\s/m.test(info)) continue;
        let cmd = ''; try { cmd = readFileSync(join(proc, p, 'cmdline'), 'utf8').split('\0').filter(Boolean).join(' ').slice(0, 120); } catch { /* gone */ }
        return { slot: i + 1, lock, holder: { pid: Number(p), cmd } };
      }
    }
    return { slot: i + 1, lock, holder: null };
  });
}

/** The status rows as text: `slot 1 held by pid 123 (cmd)` or `slot 2 free`. */
export function statusText(rows) {
  return rows.map((r) => (r.holder ? `slot ${r.slot} held by pid ${r.holder.pid}${r.holder.cmd ? ` (${r.holder.cmd})` : ''}` : `slot ${r.slot} free`)).join('\n');
}

/** The refusal a heavy tool prints outside the floor: the cure names the floor runner around the same command. */
export function floorRefusal(tool, argv = []) {
  const line = ['node', `tools/${tool}`, ...argv].join(' ');
  return `floor: refused — ${tool} runs only on the floor, two heavy runs at a time (operator, 2026-11-25; mandate/floor-gate-1).\n` +
    `pono: node tools/floor-run.mjs -- ${line}   (a tasked spirit hands that line back as a floor ticket instead)`;
}

/** The wall a heavy tool's CLI entry calls first: exits 64 with the cure where the floor stands unheld by this process. */
export function requireFloor(tool, argv = [], { env = process.env, held = ({ locks }) => heldSlot({ locks }) > 0, exit = (code) => process.exit(code), say = (s) => console.error(s) } = {}) {
  let locks;
  try { locks = lockPaths(env); } catch (error) { say(`floor: refused — the floor lock reads nowhere (${error.message})`); return exit(FLOOR_EXIT); }
  if (held({ lock: locks[0], locks })) return true;
  say(floorRefusal(tool, argv));
  return exit(FLOOR_EXIT);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2];
  try {
    if (arg === '--lock-path') { console.log(lockPath()); process.exit(0); }
    if (arg === '--lock-paths') { console.log(lockPaths().join('\n')); process.exit(0); }
    if (arg === '--held') process.exit(heldSlot({ locks: lockPaths() }) > 0 ? 0 : 1);
    if (arg === '--slot') { const n = heldSlot({ locks: lockPaths() }); if (n > 0) console.log(n); process.exit(n > 0 ? 0 : 1); }
    if (arg === '--status') { console.log(statusText(slotStatus({ locks: lockPaths() }))); process.exit(0); }
    console.error('usage: floor-lock.mjs --held | --slot | --status | --lock-path | --lock-paths'); process.exit(2);
  } catch (error) { console.error(`floor-lock: ${error.message}`); process.exit(arg === '--held' ? 1 : 2); }
}
