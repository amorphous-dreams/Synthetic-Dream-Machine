#!/usr/bin/env node
/**
 * floor-lock — THE TOOL WALL: a heavy tool runs only inside a held run on the floor (mandate/floor-gate-1; research/test-
 * floor-proposal §1b.2). No count of runs stands: measured headroom (C: bytes against the disk floor, the load against the
 * cores) admits each run at `tools/battery.sh`'s door, and every admitted run holds its OWN lock, `.floor/run-<pid>.lock`
 * beside the door (`battery.sh --floor-dir`), keyed by the pid of the battery shell that took it. The door stays the
 * battery's: LARES_BATTERY_LOCK, else `<passwd home>/.lares-scratch/.battery.lock`, never $HOME.
 *
 *   node tools/floor-lock.mjs --held                 exit 0 where this process runs inside a held run, 1 otherwise
 *   node tools/floor-lock.mjs --run                  prints the pid keying the run this process runs inside (exit 1 outside)
 *   node tools/floor-lock.mjs --status               one row per held run: its key, the process holding it (pid and command)
 *   node tools/floor-lock.mjs --lock-path            the door's path, as battery.sh names it
 *   node tools/floor-lock.mjs --floor-dir            the floor's directory, as battery.sh names it
 *
 * HOW "INSIDE" READS, with no environment marker (no new env vars; a marker a child inherits would also outlive the lock):
 * the kernel's own lock state, read by OPEN FILE, never by pid alone. battery.sh opens its run lock on fd 9 and runs
 * `flock -n 9`: flock(1) runs as a CHILD process that locks the shell's open file and exits, so `/proc/locks` names the
 * flock(1) pid, which no heavy run descends from (the nested-take deadlock of 2026-11-25: floor-run -> battery.sh -> floor-run
 * read unheld and waited on its own lock). So this process runs inside the floor where this process or an ancestor holds a
 * descriptor on a run lock whose open file carries the FLOCK: `/proc/<pid>/fdinfo/<fd>` lists a `lock:` line for every lock
 * that open file owns (Linux has listed them there since 4.x). A bare descriptor never counts: a waiter holds one too. The
 * holder pid in `/proc/locks` still counts where it names an ancestor. The door never counts: it holds only an admission
 * read. A Codex seat cannot open the door at all (it sits outside the seat's write roots), so it never reads as inside.
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

/** The door's path, as battery.sh names it (so the two can never disagree). Throws where battery.sh refuses. */
export function lockPath(env = process.env) {
  const r = spawnSync('bash', [join(HERE, 'battery.sh'), '--lock-path'], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error((r.stderr || `battery.sh --lock-path exited ${r.status}`).trim());
  return r.stdout.trim();
}

/** The floor's directory, where each run's lock and reservation sit, as battery.sh names it. Throws where battery.sh refuses. */
export function floorDir(env = process.env) {
  const r = spawnSync('bash', [join(HERE, 'battery.sh'), '--floor-dir'], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error((r.stderr || `battery.sh --floor-dir exited ${r.status}`).trim());
  return r.stdout.trim();
}

/** Every run lock standing in the floor directory, each with the pid that keys it. */
export function runLocks(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return []; }
  return names.map((n) => /^run-(\d+)\.lock$/.exec(n)).filter(Boolean).map((m) => ({ key: Number(m[1]), lock: join(dir, m[0]) }));
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

/** The run this process (or an ancestor) holds, `{ key, lock }`, or null outside every run. A nested take reads the
 *  ancestor's run and runs at once; each run reads by its own open file. */
export function heldRun({ dir, pid = process.pid, proc = '/proc' } = {}) {
  for (const run of runLocks(dir)) if (floorHeld({ lock: run.lock, pid, proc })) return run;
  return null;
}

/** Every held run: a process with a descriptor on a run lock whose open file owns the FLOCK. A run lock no process holds
 *  (a run still waiting at the door, or one whose shell died) lists nothing. */
export function runStatus({ dir, proc = '/proc' } = {}) {
  let pids = [];
  try { pids = readdirSync(proc).filter((n) => /^\d+$/.test(n)); } catch { /* no proc */ }
  const rows = [];
  for (const run of runLocks(dir)) {
    let real; try { real = realpathSync(run.lock); } catch { continue; }
    let holder = null;
    for (const p of pids) {
      let fds; try { fds = readdirSync(join(proc, p, 'fd')); } catch { continue; }
      for (const fd of fds) {
        let target; try { target = readlinkSync(join(proc, p, 'fd', fd)); } catch { continue; }
        if (target !== real) continue;
        let info = ''; try { info = readFileSync(join(proc, p, 'fdinfo', fd), 'utf8'); } catch { continue; }
        if (!/^lock:\s+\d+:\s+FLOCK\s/m.test(info)) continue;
        let cmd = ''; try { cmd = readFileSync(join(proc, p, 'cmdline'), 'utf8').split('\0').filter(Boolean).join(' ').slice(0, 120); } catch { /* gone */ }
        holder = { pid: Number(p), cmd };
        break;
      }
      if (holder) break;
    }
    if (holder) rows.push({ ...run, holder });
  }
  return rows.sort((a, b) => a.key - b.key);
}

/** The status rows as text: `run 123 held by pid 123 (cmd)`, one per held run, or the empty floor. */
export function statusText(rows) {
  if (!rows.length) return 'no run holds the floor';
  return rows.map((r) => `run ${r.key} held by pid ${r.holder.pid}${r.holder.cmd ? ` (${r.holder.cmd})` : ''}`).join('\n');
}

/** The refusal a heavy tool prints outside the floor: the cure names the floor runner around the same command. */
export function floorRefusal(tool, argv = []) {
  const line = ['node', `tools/${tool}`, ...argv].join(' ');
  return `floor: refused — ${tool} runs only on the floor, each run admitted by measured headroom (mandate/floor-gate-1).\n` +
    `pono: node tools/floor-run.mjs -- ${line}   (a tasked spirit hands that line back as a floor ticket instead)`;
}

/** The wall a heavy tool's CLI entry calls first: exits 64 with the cure where the floor stands unheld by this process. */
export function requireFloor(tool, argv = [], { env = process.env, held = ({ dir }) => heldRun({ dir }) !== null, exit = (code) => process.exit(code), say = (s) => console.error(s) } = {}) {
  let dir;
  try { dir = floorDir(env); } catch (error) { say(`floor: refused — the floor lock reads nowhere (${error.message})`); return exit(FLOOR_EXIT); }
  if (held({ dir })) return true;
  say(floorRefusal(tool, argv));
  return exit(FLOOR_EXIT);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2];
  try {
    if (arg === '--lock-path') { console.log(lockPath()); process.exit(0); }
    if (arg === '--floor-dir') { console.log(floorDir()); process.exit(0); }
    if (arg === '--held') process.exit(heldRun({ dir: floorDir() }) ? 0 : 1);
    if (arg === '--run') { const run = heldRun({ dir: floorDir() }); if (run) console.log(run.key); process.exit(run ? 0 : 1); }
    if (arg === '--status') { console.log(statusText(runStatus({ dir: floorDir() }))); process.exit(0); }
    console.error('usage: floor-lock.mjs --held | --run | --status | --lock-path | --floor-dir'); process.exit(2);
  } catch (error) { console.error(`floor-lock: ${error.message}`); process.exit(arg === '--held' ? 1 : 2); }
}
