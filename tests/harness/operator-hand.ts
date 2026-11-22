/**
 * operator-hand — the e2e harness names the hand of every CLI child it launches.
 *
 * An AI seat that launches the suite leaves its marks (`CLAUDECODE=1`, the Codex sandbox marks) on the launcher's environment,
 * and a child spawned off `process.env` inherits them: the CLI line then carries the seat's mark and the walls (`face-hand-refused`,
 * `seat-canon-reach`) refuse the operator-hand acts a test exercises. The wall works as designed; the harness names a clean hand
 * for each child instead of inheriting the launcher's. `lares-cli/tests/support/harness-mark-cleared.ts` clears the same marks
 * for the CLI package's own suites; the list is the one the walls read (`HARNESS_SEAT_MARKS`).
 *
 * A test that wants a seat names it explicitly: `operatorHandEnv(base, { CLAUDECODE: "1" })` keeps that mark on the child.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HARNESS_SEAT_MARKS } from "../../packages/lares-cli/src/local-connector.js";

/** The marks the walls read as an AI seat, by name. */
export const SEAT_MARKS: readonly string[] = HARNESS_SEAT_MARKS;

/**
 * A copy of `base` under a clean hand: every seat mark leaves it, then `extra` lays over the copy (a test naming its seat
 * passes the mark here). The launcher's own environment stays whole.
 */
export function operatorHandEnv(base: NodeJS.ProcessEnv = process.env, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const mark of SEAT_MARKS) delete env[mark];
  return { ...env, ...extra };
}

/**
 * THE CHAIN READS HAND TOO. The UDS door judges a peer by its process ancestry: it walks the CLI's parent chain up to the first
 * process on the vessel's own line, and a harness (a `claude` process, `CLAUDECODE=1` in a process's launch environment) anywhere
 * on that branch reads the call as a seat. A vessel that detached from its launcher (`lares vessel stand`) shares no line with
 * the suite, so the CLI's branch climbs through vitest to the seat that launched it, and no environment this harness hands the
 * child clears an ancestor's launch environment. So a hand-act child starts ORPHANED, in a fresh session: a wrapper shell
 * backgrounds the child and exits, the child reparents to init (or the nearest subreaper), and its branch ends there. The harness
 * reads the child's streams and exit code off a scratch directory the wrapper names.
 */
export interface OwnHandResult { readonly code: number; readonly stdout: string; readonly stderr: string }
export interface OwnHandOptions { readonly env?: NodeJS.ProcessEnv; readonly cwd?: string; readonly timeoutMs?: number; readonly seat?: Record<string, string> }

// `$0` names the scratch directory; the rest is the command. The inner shell records its own pid (the pid the `exec` keeps,
// so a timeout kills the CLI by that recorded pid alone), then becomes the child. The outer subshell writes the exit code
// last, atomically, and the wrapper returns at once: the child's parent exits and the child reparents.
const WRAPPER = `
d="$0"
( setsid -w sh -c 'echo $$ > "$0/pid"; exec "$@" > "$0/out" 2> "$0/err" < /dev/null' "$d" "$@"; echo $? > "$d/code.tmp"; mv "$d/code.tmp" "$d/code" ) > /dev/null 2>&1 &
`;

function launch(cmd: string, args: readonly string[], opts: OwnHandOptions): { readonly dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "lares-own-hand-"));
  const started = spawnSync("sh", ["-c", WRAPPER, dir, cmd, ...args], { env: operatorHandEnv(opts.env, opts.seat), cwd: opts.cwd, stdio: "ignore" });
  if (started.status !== 0) throw new Error(`own-hand wrapper exited ${started.status}`);
  return { dir };
}

function reap(dir: string, timedOut: boolean): OwnHandResult {
  const read = (name: string): string => { try { return readFileSync(join(dir, name), "utf8"); } catch { return ""; } };
  const code = timedOut ? -1 : Number(read("code").trim());
  const result = { code: Number.isFinite(code) ? code : -1, stdout: read("out"), stderr: read("err") };
  rmSync(dir, { recursive: true, force: true });
  return result;
}

function killRecorded(dir: string): void {
  try { process.kill(Number(readFileSync(join(dir, "pid"), "utf8").trim()), "SIGKILL"); } catch { /* the child already ended */ }
}

/** Run `cmd` as an orphaned child under a clean hand, and wait for it (async). */
export async function runOwnHand(cmd: string, args: readonly string[], opts: OwnHandOptions = {}): Promise<OwnHandResult> {
  const { dir } = launch(cmd, args, opts);
  const until = Date.now() + (opts.timeoutMs ?? 170_000);
  while (!existsSync(join(dir, "code")) && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
  const timedOut = !existsSync(join(dir, "code"));
  if (timedOut) killRecorded(dir);
  return reap(dir, timedOut);
}

/** Run `cmd` as an orphaned child under a clean hand, and wait for it (blocking). */
export function runOwnHandSync(cmd: string, args: readonly string[], opts: OwnHandOptions = {}): OwnHandResult {
  const { dir } = launch(cmd, args, opts);
  const until = Date.now() + (opts.timeoutMs ?? 170_000);
  while (!existsSync(join(dir, "code")) && Date.now() < until) spawnSync("sleep", ["0.025"]);
  const timedOut = !existsSync(join(dir, "code"));
  if (timedOut) killRecorded(dir);
  return reap(dir, timedOut);
}
