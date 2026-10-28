/**
 * port-control — idempotent single-instance reconcile primitives for the dev/test
 * loop.
 *
 * Web3-pono shape: the **port is the single-instance capability** (binding it = being
 * the instance), and the **OS port-table is the live authority** for who holds it —
 * never a stale PID file (ambient mutable state = the confused-deputy trap). We read
 * the authoritative live table, signal the holder's own graceful shutdown, and poll
 * the port (not a `sleep`).
 *
 * NEVER A FORCED KILL. The store underneath a held port persists through a
 * crash-atomic adapter whose whole guarantee is "a save that dies mid-chunk leaves no
 * torn chunk" — but that guarantee covers a crash, not a SIGKILL this door chose to
 * send into a flush it decided had taken too long. A graceful SIGTERM may legitimately
 * outrun any grace window a caller declares (a durable flush, a corpus replay); forcing
 * it the instant that window closes trades a slow shutdown for one this door caused.
 * So a stop past its grace keeps waiting on the SAME signal's own effect — the holder's
 * real exit — and only NAMES who still holds the port, once, so a caller can act on a
 * slow stop without this primitive ever acting FOR it.
 */

import { createConnection } from "node:net";
import { execFileSync }     from "node:child_process";

/** True iff something accepts a TCP connection on the port (the port-free probe). */
export function probePort(port: number, host = "127.0.0.1", timeoutMs = 250): Promise<boolean> {
  return new Promise((res) => {
    const sock = createConnection({ port, host });
    const done = (open: boolean): void => { sock.removeAllListeners(); sock.destroy(); res(open); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("error",   () => done(false));
    sock.once("timeout", () => done(false));
  });
}

/**
 * PIDs holding (LISTENing on) the port, read from the OS port-table — the live
 * authority, not a file we keep. `lsof` first (mac + linux), `ss` fallback (linux),
 * `netstat -ano` on Windows (no lsof/ss there). Excludes our own PID. Empty = no
 * owner found (foreign listener / no tool / perms).
 */
export function portHolderPids(port: number): number[] {
  const self = process.pid;
  const uniq = (ns: number[]): number[] => [...new Set(ns)].filter((n) => n > 0 && n !== self);

  if (process.platform === "win32") {
    // Windows ships neither lsof nor ss; `netstat -ano` is always present and prints
    // the owning PID in the last column of each row. LISTENING rows carry 5 columns
    // (Proto, Local, Foreign, State, PID) — UDP rows lack State, so the State filter
    // excludes them. Match the port at the tail of the Local Address (IPv4 0.0.0.0:p
    // and IPv6 [::]:p both end ":p").
    try {
      const out = execFileSync("netstat", ["-ano"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const pids: number[] = [];
      for (const raw of out.split(/\r?\n/)) {
        const parts = raw.trim().split(/\s+/);
        if (parts.length < 5 || parts[0] !== "TCP" || parts[3] !== "LISTENING") continue;
        const local = parts[1];
        if (!local) continue;
        const colon = local.lastIndexOf(":");
        if (colon < 0 || Number(local.slice(colon + 1)) !== port) continue;
        pids.push(Number(parts[parts.length - 1]));
      }
      return uniq(pids);
    } catch { return []; }
  }

  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids = uniq([...out.matchAll(/(\d+)/g)].map((m) => Number(m[1])));
    if (pids.length) return pids;
  } catch { /* lsof absent or no match — try ss */ }
  try {
    const out = execFileSync("ss", ["-ltnHp", `sport = :${port}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return uniq([...out.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1])));
  } catch { return []; }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** `forced` is GONE (M3): this door never forced a stop, so the field never read true, and a reader
 *  that still branched on it was dead code pretending to be a decision. */
export interface StopResult { stopped: boolean }

/**
 * THE HOST HOLDS THE ENGINE (`LAR_ENGINE=host`, the container image's setting). Inside a container the daemon runs
 * as the container's main process, so no CLI door there stops it, signals it or spawns another: the host shim
 * stops, stands and restarts the container. Every door that would act on the daemon asks this first.
 */
export function engineHeldByHost(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env["LAR_ENGINE"] === "host";
}

/** The refusal a door raises where the host holds the engine. */
export class EngineHeldByHost extends Error {
  override readonly name = "EngineHeldByHost";
  constructor(act: string) {
    super(`${act} — the host holds the engine: use the host shim (lares-container.sh vessel stand | vessel stop | down)`);
  }
}

export interface StopIncumbentOpts {
  readonly graceMs?: number;
  readonly pollMs?:  number;
  /**
   * REQUIRED: report the holder exactly once after this door's grace while it remains held. The wait
   * continues until the holder exits; this report never changes the stop decision. Every caller supplies it.
   */
  readonly onPastGrace: (heldPids: readonly number[]) => void;
  /**
   * `--cut`: past grace, send the holder ONE further signal (never a ladder, never a SIGKILL) — the
   * operator's own SECOND signal, which the vessel's own shutdown reads as the event that cuts a hung
   * teardown (`main.ts` exits 75 on it). This door still never decides FOR the vessel what that signal
   * means; it only delivers the operator's own choice once, past the grace it already reported.
   */
  readonly cut?: boolean;
  /**
   * Reads true while the REAL HOLDER still stands — never the port alone (H5). `main.ts`'s own
   * shutdown closes the http listener (which frees this port) as its very FIRST step, well before
   * main-flush, the wiki islands, or the daemon island ever ack their own teardown — so a caller that
   * declared "stopped" the instant the port freed was reporting `stopped: true` over a vessel that kept
   * running for seconds afterward. A caller that knows the store (`commands/read.ts`'s `cmdStop`) wires
   * this to the UDS rendezvous liveness check (`udsAlive`/`whoHolds`, the vessel's own claim on its
   * store, released only with the process) so `stopped: true` prints only once that claim lets go.
   * Omitted, this door falls back to its old port-probe reading alone — but see `holderAlive`'s FLOOR
   * below, which always applies regardless.
   */
  readonly holderAlive?: (pids: readonly number[]) => Promise<boolean>;
  /** Test seams — default to the real probe/table/signal. */
  readonly probe?:      (port: number) => Promise<boolean>;
  readonly holderPids?: (port: number) => number[];
  readonly kill?:       (pid: number, signal: NodeJS.Signals) => void;
}

/** True while `pid` still answers a signal-0 probe — a process that has truly exited never does, no
 *  matter what a store's own socket or port currently reads. This is the unconditional FLOOR under
 *  `holderAlive`: the signalled pids' own liveness, so a holder-check that flakes "gone" mid-teardown
 *  (a socket briefly quiet while the process itself still runs) can never read `stopped: true` early. */
function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Free the port by reconciling to "no incumbent": no-op if already free
 * (idempotent); else read the holder from the OS table, SIGTERM it (its own
 * graceful handler), and poll until the port actually frees. PAST `graceMs` this
 * keeps waiting on the SAME SIGTERM's own effect rather than escalating — `onPastGrace`
 * names the still-live holder so a caller can decide what a slow shutdown means, but
 * this door never decides FOR it with a second signal. A held port with NO
 * discoverable owner FAILS LOUD before any signal sends — never guess (the
 * confused-deputy guard).
 */
export async function stopIncumbent(
  port: number,
  opts: StopIncumbentOpts,
): Promise<StopResult> {
  if (engineHeldByHost()) throw new EngineHeldByHost(`this door would stop the daemon on :${port}`);
  const graceMs = opts.graceMs ?? 8_000;
  const pollMs  = opts.pollMs  ?? 200;
  const probe       = opts.probe      ?? probePort;
  const holderPidsOf = opts.holderPids ?? portHolderPids;
  const kill        = opts.kill       ?? ((pid: number, signal: NodeJS.Signals) => process.kill(pid, signal));

  if (!(await probe(port))) return { stopped: false };   // already free

  const pids = holderPidsOf(port);
  if (pids.length === 0) {
    throw new Error(
      `port ${port} is in use but no owning PID found via the OS port table ` +
      `(lsof/ss on POSIX, netstat on Windows) — refusing to guess a target ` +
      `(no silent misroute). Free it manually, or install lsof/ss.`,
    );
  }
  for (const pid of pids) { try { kill(pid, "SIGTERM"); } catch { /* already gone */ } }

  // THE DAEMON'S REAL EXIT, NEVER FORCED. A delayed flush past `graceMs` keeps this pending — it does NOT
  // escalate to SIGKILL, which could tear a save the crash-atomic adapter's own guarantee never promised to
  // survive a deliberate kill. `onPastGrace` fires exactly once, as a report, and the loop keeps polling.
  // This grace is THIS DOOR'S OWN liveness patience — "how long do I keep waiting before I say something" —
  // never a safety or admission verdict, so it reads a MONOTONIC clock (`performance.now()`), never
  // `Date.now()`: an adversarial or operator set-back/set-forward of the wall clock moves neither how long
  // this door actually waited nor when it speaks.
  const graceDeadline = performance.now() + graceMs;
  let warned = false;
  for (;;) {
    // THE HOLDER, NEVER THE PORT ALONE (H5). `pids.some(pidAlive)` is the unconditional floor: while
    // any signalled pid still answers a signal-0 probe, this never reads "gone", whatever a store
    // check or the port itself says. Past that floor, `holderAlive` (when the caller wired one — the
    // vessel's own UDS claim) decides; with none wired, the port probe decides.
    const stillHeld = pids.some(pidAlive) || (opts.holderAlive ? await opts.holderAlive(pids) : await probe(port));
    if (!stillHeld) return { stopped: true };
    if (!warned && performance.now() >= graceDeadline) {
      warned = true;
      // NEVER RE-READ THE PORT PAST GRACE (H5′). `main.ts`'s own teardown closes the http listener — the
      // very thing `portHolderPids` reads the OS table FOR — as its FIRST step, well before the holder it
      // signalled has actually exited. So a past-grace `holderPidsOf(port)` read lands on an ALREADY-FREED
      // port and finds nobody, and a `--cut` built on that read signals nobody: the honest wait this door
      // owes (never escalating past the operator's own SECOND signal) silently became unreachable instead.
      // The only pids a cut can ever mean to reach are the ones THIS DOOR ITSELF SIGNALLED at the top —
      // filtered to those still answering `pidAlive` (the unconditional floor, same one `stillHeld` reads):
      // a pid that has truly exited is never worth signalling again, and never worth naming as "still held".
      const held = pids.filter(pidAlive);
      opts.onPastGrace(held);
      // `--cut`: deliver the operator's own second signal once, past the grace already reported. Never a
      // ladder past this one further SIGTERM, never a SIGKILL — the vessel's own shutdown decides what a
      // second signal means (main.ts: a hung-teardown cut, exit 75).
      if (opts.cut) { for (const pid of held) { try { kill(pid, "SIGTERM"); } catch { /* already gone */ } } }
    }
    await sleep(pollMs);
  }
}

/** One named stretch of a multi-phase boot, and the budget this door spends waiting through it. */
export interface BootPhase {
  readonly name:     string;
  readonly budgetMs: number;
}

/**
 * A declared boot budget ran out with the resource still unbound, or ran out past every named phase. Names
 * whoever still holds it (or that nobody discoverable does) — the caller's only recourse from here is its own
 * decision; this door never opens anything of its own on this refusal (never a fallback to a direct act
 * beside whatever boots the resource). `resource` names what this budget waited on (`"port 5177"`, `"the
 * vessel's store door"`) — whatever `holderPids` names holders of.
 */
export class SlowBootTimeout extends Error {
  constructor(
    readonly phase: string,
    readonly resource: string,
    readonly holderPids: readonly number[],
  ) {
    super(
      holderPids.length > 0
        ? `boot budget spent in phase "${phase}": ${resource} is still held by pid(s) ${holderPids.join(", ")} — waiting ends here, never a fallback to a direct act of this caller's own.`
        : `boot budget spent in phase "${phase}": ${resource} answers to no discoverable holder — waiting ends here, never a fallback to a direct act of this caller's own.`,
    );
  }
}

/**
 * Wait on whatever `probe`/`holderPids` read, spending a DECLARED budget PER NAMED BOOT PHASE rather than one
 * flat deadline. `phase()` reads which phase is current at each poll (a caller's own boot-log tail, e.g.
 * "starting" → "ready"), so a slow-but-live phase spends only its own allowance and a phase change resets the
 * clock to the new phase's. Exhausting the CURRENT phase's budget with `probe` still false and no phase change
 * REFUSES by naming the holder (`SlowBootTimeout`) — it never falls back to a direct act of the caller's own.
 * `until`, checked once per poll, ends the wait quietly (resolves) the instant it reads true — for a caller
 * racing this against its own settling act, so the wait itself owns no timer nobody is going to read.
 * `waitForPortBudgeted` is the TCP-port instance of this; any other resource (a UDS rendezvous, a claim) wires
 * its own `probe`/`holderPids` straight in here instead of forcing itself through a port number.
 */
export async function waitForResourceBudgeted(
  resource: string,
  phases: readonly BootPhase[],
  opts: {
    phase: () => string | Promise<string>;
    probe: () => Promise<boolean>;
    holderPids: () => readonly number[] | Promise<readonly number[]>;
    pollMs?: number;
    until?: () => boolean;
  },
): Promise<void> {
  const pollMs = opts.pollMs ?? 200;
  const budgetOf = new Map(phases.map((p) => [p.name, p.budgetMs]));

  // Per-phase patience is this caller's OWN liveness wait — never a safety verdict — so it rides a
  // monotonic clock. `performance.now()` alone: a wall-clock set-back/set-forward moves neither which
  // phase is spending its budget nor when the budget reads spent.
  let curName     = await opts.phase();
  let curDeadline = performance.now() + (budgetOf.get(curName) ?? 0);
  for (;;) {
    if (opts.until?.()) return;
    if (await opts.probe()) return;
    const name = await opts.phase();
    if (name !== curName) { curName = name; curDeadline = performance.now() + (budgetOf.get(curName) ?? 0); }
    if (performance.now() >= curDeadline) throw new SlowBootTimeout(curName, resource, await opts.holderPids());
    await sleep(pollMs);
  }
}

/**
 * Wait for `port` to accept connections, spending a DECLARED budget PER NAMED BOOT PHASE rather than one
 * flat deadline — the TCP-port instance of {@link waitForResourceBudgeted}.
 */
export async function waitForPortBudgeted(
  port: number,
  phases: readonly BootPhase[],
  opts: { phase: () => string; pollMs?: number; probe?: (port: number) => Promise<boolean>; holderPids?: (port: number) => number[] },
): Promise<void> {
  const probe       = opts.probe      ?? probePort;
  const holderPidsOf = opts.holderPids ?? portHolderPids;
  return waitForResourceBudgeted(`port ${port}`, phases, {
    phase:      opts.phase,
    ...(opts.pollMs !== undefined ? { pollMs: opts.pollMs } : {}),
    probe:      () => probe(port),
    holderPids: () => holderPidsOf(port),
  });
}
