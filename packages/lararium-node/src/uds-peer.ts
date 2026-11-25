/**
 * uds-peer — what the UDS door can know of the process on the other end of a connection, and the one reading it binds:
 * whether an AI harness stands on that peer's own branch.
 *
 * WHAT A UNIX SOCKET TELLS. Node exposes no SO_PEERCRED and no ancillary credentials, so the door reads the kernel's own
 * socket table instead: `ss -xpH` (sock_diag) names each connected unix socket's peer inode and the processes holding
 * it. The door finds its accepted socket by inode (`/proc/self/fd/<fd>`), its peer's inode, and the peer's pids, all
 * kernel-attested: a client cannot name another process as itself. From each pid it walks the parent chain under
 * `/proc/<pid>/stat` (kernel-kept) and reads, per process, its launch environment (`/proc/<pid>/environ`, which the
 * process itself may overwrite but its children cannot) and its name (`comm`, argv). A harness stands on the branch
 * where a process carries a harness's own mark (`CLAUDECODE=1`, `CODEX_SANDBOX`, `CODEX_SANDBOX_NETWORK_DISABLED`) or
 * runs as `claude` / `codex*`.
 *
 * THE CUT. The walk stops at the first process the vessel itself descends from (or the vessel's own pid): what stands
 * above the vessel frames the whole house, so the door judges only the branch between the peer and the vessel's own
 * line. An in-process client, or a vessel spawned by the client, reads nothing; a suite run inside a harness reads as CI.
 *
 * WHAT IT CANNOT BIND. The reading adds the seat, never removes one: a line's own `seat: "ai"` mark stands regardless.
 * A hostile process under the same uid escapes it by leaving the branch (a double fork reparents it to init or a
 * subreaper; a process started outside the harness, such as a tmux server or `systemd-run --user`, asks for it), and a
 * harness launched under another name with no mark reads as no harness. A node one-liner run by `docker exec` into the container shares its pid
 * namespace: the parent pid reads 0, the walk stops and the harness mark never passes, so such a peer reads hand, not unknown;
 * where `ss` stands absent the peer reads unknown and the door keeps the line's own reading. A detected AI seat refuses; the
 * typed route and the per-face budget stay the gate. It
 * closes the casual omission (`env -u CLAUDECODE`, a script that clears its environment), not a determined one.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/uds-peer
 */
import { execFile } from "node:child_process";
import { readFileSync, readlinkSync } from "node:fs";
import type { Socket } from "node:net";

/** The marks an AI harness sets on the shells it runs, read and never minted (the CLI's `harnessSeatMarked` reads the same). */
const HARNESS_MARKS: readonly string[] = ["CLAUDECODE", "CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED"];
const WALK_LIMIT = 64;

/** The `/proc` reads one walk takes; a vector replaces them. Each answers null where the entry cannot be read. */
export interface ProcReader {
  readonly stat:    (pid: number) => string | null;
  readonly environ: (pid: number) => string | null;
  readonly cmdline: (pid: number) => string | null;
}

const readOrNull = (path: string): string | null => { try { return readFileSync(path, "utf8"); } catch { return null; } };
export const PROC: ProcReader = {
  stat:    (pid) => readOrNull(`/proc/${pid}/stat`),
  environ: (pid) => readOrNull(`/proc/${pid}/environ`),
  cmdline: (pid) => readOrNull(`/proc/${pid}/cmdline`),
};

/** `comm` and the parent pid off a `/proc/<pid>/stat` line (`comm` sits in parentheses and may hold spaces or parens). */
export function statOf(text: string): { readonly comm: string; readonly ppid: number } | null {
  const open = text.indexOf("(");
  const close = text.lastIndexOf(")");
  if (open === -1 || close < open) return null;
  const ppid = Number(text.slice(close + 2).split(" ")[1]);
  return Number.isSafeInteger(ppid) ? { comm: text.slice(open + 1, close), ppid } : null;
}

const harnessName = (name: string): boolean => {
  const base = name.slice(name.lastIndexOf("/") + 1);
  return base === "claude" || base.startsWith("codex");
};

/** True where one environment entry carries a harness's own mark (`CLAUDECODE=1`, a non-empty Codex sandbox mark). */
export function harnessMark(key: string, value: string | undefined): boolean {
  if (value === undefined) return false;
  return key === "CLAUDECODE" ? value === "1" : HARNESS_MARKS.includes(key) && value !== "";
}

/** True where one process reads as a harness: a harness mark in its launch environment, or a harness by name. */
export function harnessProcess(pid: number, read: ProcReader = PROC): boolean {
  const environ = read.environ(pid);
  if (environ !== null) {
    for (const entry of environ.split("\0")) {
      const eq = entry.indexOf("=");
      if (eq === -1) continue;
      if (harnessMark(entry.slice(0, eq), entry.slice(eq + 1))) return true;
    }
  }
  const comm = statOf(read.stat(pid) ?? "")?.comm;
  if (comm !== undefined && harnessName(comm)) return true;
  const argv = (read.cmdline(pid) ?? "").split("\0");
  return argv.slice(0, 2).some((a) => a !== "" && harnessName(a));
}

/** The vessel's own line: its pid and every ancestor, read fresh (a parent that died leaves the chain at its reaper). */
export function lineOf(pid: number, read: ProcReader = PROC): Set<number> {
  const line = new Set<number>();
  for (let at = pid, n = 0; at > 0 && n < WALK_LIMIT && !line.has(at); n += 1) {
    line.add(at);
    const s = statOf(read.stat(at) ?? "");
    if (s === null) break;
    at = s.ppid;
  }
  return line;
}

/**
 * True where a harness stands on a peer's own branch: from the peer up its parent chain, stopping at the first process
 * on the vessel's own line (`self` and its ancestors) or at an unreadable entry.
 */
export function harnessOnBranch(peer: number, self: number, read: ProcReader = PROC): boolean {
  return branchKind(peer, self, read) === "ai";
}

/**
 * How a branch reads, every link of it: `ai` where a harness stands on it; `hand` where the walk reached init (a parent pid of
 * 0), the vessel's own line, or a loop, having read every link; `unknown` where a link's `stat` cannot be read (or the walk ran
 * out of links), since whatever stands above that link reads nothing, and an unread link never reads as a person.
 */
export function branchKind(peer: number, self: number, read: ProcReader = PROC): PeerKind {
  const line = lineOf(self, read);
  const seen = new Set<number>();
  let at = peer;
  for (let n = 0; at > 0 && !line.has(at) && !seen.has(at); n += 1) {
    if (n >= WALK_LIMIT) return "unknown";
    seen.add(at);
    if (harnessProcess(at, read)) return "ai";
    const s = statOf(read.stat(at) ?? "");
    if (s === null) return "unknown";
    at = s.ppid;
  }
  return "hand";
}

/** The inode of the unix socket behind a node socket, off `/proc/self/fd`, or null where none reads. */
function inodeOf(sock: Socket): string | null {
  const fd = (sock as unknown as { _handle?: { fd?: unknown } })._handle?.fd;
  if (typeof fd !== "number" || fd < 0) return null;
  try { return /^socket:\[(\d+)\]$/.exec(readlinkSync(`/proc/self/fd/${fd}`))?.[1] ?? null; }
  catch { return null; }
}

/** The pids holding the peer of the socket whose inode is `own`, read off `ss -xpH` output, or null where none reads. */
export function peerPidsIn(table: string, own: string): number[] | null {
  const rows = table.split("\n").map((line) => line.trim().split(/\s+/));
  // A row: Netid State Recv-Q Send-Q Local-Address Local-Port Peer-Address Peer-Port [users:(...)].
  const ownRow = rows.find((t) => t[5] === own);
  const peer = ownRow?.[7];
  if (peer === undefined || peer === "0") return null;
  const peerRow = rows.find((t) => t[5] === peer);
  if (peerRow === undefined) return null;
  const pids = [...peerRow.slice(8).join(" ").matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
  return pids.length > 0 ? pids : null;
}

/** The peer's pids, kernel-attested through `ss` (sock_diag), or null where the socket table or the peer cannot be read. */
export async function peerPidsOf(sock: Socket): Promise<number[] | null> {
  if (process.platform !== "linux") return null;
  const own = inodeOf(sock);
  if (own === null) return null;
  const table = await new Promise<string | null>((resolve) => {
    execFile("ss", ["-xpH"], { encoding: "utf8", timeout: 2_000, maxBuffer: 16 * 1024 * 1024 }, (err, out) => resolve(err ? null : out));
  });
  return table === null ? null : peerPidsIn(table, own);
}

/** How a peer reads: an AI seat, a person's hand (its processes read, no harness on their branch), or unknown (unread). */
export type PeerKind = "ai" | "hand" | "unknown";

/** The peer's kind, read at the door: `unknown` where the socket table or the peer cannot be read, never a guess. */
export async function peerKindOf(sock: Socket): Promise<PeerKind> {
  const pids = await peerPidsOf(sock).catch(() => null);
  if (pids === null) return "unknown";
  return kindOfPids(pids);
}

/** The peer's processes, read as one: any branch with a harness reads `ai`, else any unread branch reads `unknown`, else `hand`. */
function kindOfPids(pids: readonly number[], read: ProcReader = PROC): PeerKind {
  const kinds = pids.filter((pid) => pid !== process.pid).map((pid) => branchKind(pid, process.pid, read));
  if (kinds.includes("ai")) return "ai";
  return kinds.includes("unknown") ? "unknown" : "hand";
}

/**
 * THE PEER'S SEAT, read at the door: `"ai"` where a harness stands on the branch of any process holding the peer's end,
 * else null (no harness, or the peer reads unknown: the door then keeps the line's own reading).
 */
export async function peerSeatOf(sock: Socket): Promise<"ai" | null> {
  const pids = await peerPidsOf(sock).catch(() => null);
  if (pids === null) return null;
  return pids.some((pid) => pid !== process.pid && harnessOnBranch(pid, process.pid)) ? "ai" : null;
}
