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

export interface StopIncumbentOpts {
  readonly graceMs?: number;
  readonly pollMs?:  number;
  /**
   * REQUIRED (M3). Hears ONCE the declared grace is spent and the port is STILL held, naming who still
   * holds it. The wait continues past this — it is a report, never a decision point this door acts on.
   * Making it required turns the typecheck into the witness that every stop caller wires it: before this,
   * `rebirth.ts` called `stopIncumbent` with none at all, so a wedged daemon there hung mute while every
   * OTHER caller already named it.
   */
  readonly onPastGrace: (heldPids: readonly number[]) => void;
  /**
   * `--cut`: past grace, send the holder ONE further signal (never a ladder, never a SIGKILL) — the
   * operator's own SECOND signal, which the vessel's own shutdown reads as the event that cuts a hung
   * teardown (`main.ts` exits 75 on it). This door still never decides FOR the vessel what that signal
   * means; it only delivers the operator's own choice once, past the grace it already reported.
   */
  readonly cut?: boolean;
  /** Test seams — default to the real probe/table/signal. */
  readonly probe?:      (port: number) => Promise<boolean>;
  readonly holderPids?: (port: number) => number[];
  readonly kill?:       (pid: number, signal: NodeJS.Signals) => void;
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
    if (!(await probe(port))) return { stopped: true };
    if (!warned && performance.now() >= graceDeadline) {
      warned = true;
      const held = holderPidsOf(port);
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
