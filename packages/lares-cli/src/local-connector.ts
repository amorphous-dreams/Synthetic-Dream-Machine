/**
 * local-connector — the co-located fast path of the lares↔lararium binding.
 *
 * A thin Unix-domain-socket invoker: connect the rendezvous socket, write ONE
 * capability-bearing invocation line, read the outcome line, done. No Repo, no
 * leaf replica, no WS sync-on-connect — the daemon already holds the warm replica
 * and runs the verb through the same worker VerbDispatcher.
 *
 * The socket's 0600 owner-only perms gate PRESENCE (substrate); the requestedBy
 * did rides the invocation for the daemon's verify-then-delegate (authority).
 * When the socket is absent/stale the caller has no daemon to talk to — the CLI
 * carries no second transport.
 * See lar:///ha.ka.ba/lararium/api/lares-lararium-binding.
 */

import { createConnection } from "node:net";
import { existsSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";
import { newRequestId } from "@lararium/mesh/verb-tiddler";
import { larDataDir } from "./env.js";
import type { SubmitResult, SubmitOptions } from "./verb-result.js";

/** The agreed socket path — both sides derive the rendezvous from the substrate dir (`rendezvousPath`). */
export function udsSocketPath(dataDir?: string | null): string {
  // ABSENT AND UNRESOLVED ARE DIFFERENT ASKS, and only one of them may fall back. Omitting the argument
  // means "the caller's own vessel", and the ambient default is the right answer. Passing `null` means a
  // root was LOOKED FOR AND NOT FOUND — a staged root, a discovered socket directory — and falling back
  // there aims a caller at the operator's live vessel while it believes it is talking to a fixture.
  // The failure is silent and it PASSES: the real daemon answers correctly, so the vector goes green
  // having measured the wrong hearth. Refusing is the only reading that cannot be mistaken for success.
  // ⚠ AN EMPTY STRING IS AS UNRESOLVED AS A NULL, and it is WORSE than the ambient fallback: `"" ?? x`
  // is `""`, so it slips a null-only guard and hashes to a real, stable, deterministic path —
  // `/tmp/lares-<uid>/e3b0c44298fc.sock`, the digest of nothing. Every caller who lost their root
  // converges on that ONE socket, which is a rendezvous no daemon ever binds and, worse, one any
  // process on the machine could bind and be mistaken for every one of them.
  if (dataDir === null || dataDir === "") {
    throw new Error("[lares] a substrate root was required and none resolved — refusing to fall back to the ambient vessel");
  }
  // ONE DERIVATION, BOTH SIDES. The daemon binds `rendezvousPath` over its resolved substrate dir; this
  // reads the same function over the same default. A `--storage`/`LAR_STORAGE` override moves the
  // daemon's dir and not this one; `lares vessel read` prints the resolved path when the two must be compared.
  return rendezvousPath({ root: dataDir ?? larDataDir(), uid: process.getuid?.() ?? 0 });
}

/**
 * Does a socket FILE sit at the path? It reports a NAME standing, never a listener answering.
 *
 * A unix socket outlives the process that bound it: kill a daemon rudely and the inode remains, so this
 * answers `true` for a vessel that died months ago. Reach for it to decide whether a path merits a try —
 * never to decide whether anything breathes there. {@link udsAlive} answers that.
 */
export function udsSocketPresent(dataDir?: string | null): boolean {
  // The derivation's refusal is not a stat failure and must not be swallowed as one. `false` here reads
  // "no daemon there", which is an answer about a hearth — and an unresolved root names no hearth to
  // answer about. Let it out; catch only the filesystem's own noise.
  const path = udsSocketPath(dataDir);
  try { return existsSync(path); } catch { return false; }
}

/**
 * Does a daemon ANSWER at the socket? The only honest liveness read — it connects.
 *
 * ── WHAT A FILE-CHECK COST, MEASURED ────────────────────────────────────────────────────────────
 * Callers read file-existence AS liveness, so a stale socket reported a dead vessel as serving — for
 * weeks, across sessions. Worse, the standing decision consulted that same reading, so the lie
 * SUSTAINED ITSELF: the vessel stayed down precisely because the corpse of its socket kept reporting it
 * up, and nothing ever connected to find out otherwise.
 *
 * `ECONNREFUSED` MARKS exactly that corpse — a name carrying nothing behind it — and it reads here as
 * DOWN rather than as an error, because a refused connection ANSWERS.
 *
 * The address NAMES; it never stands the place (`lar:` signal law). Existence at an address never
 * implies presence at a place, and a check that fuses them reports on the filesystem while claiming to
 * report on the mesh.
 */
export async function udsAlive(dataDir?: string | null, timeoutMs = 1_500): Promise<boolean> {
  const path = udsSocketPath(dataDir);
  if (!udsSocketPresent(dataDir)) return false;   // no name — nothing to probe
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (alive: boolean): void => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch { /* already gone */ }
      resolve(alive);
    };
    const sock = createConnection(path);
    // LIVENESS: a bound but wedged socket may never connect or report an error.
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("error",   () => done(false));   // ECONNREFUSED on a stale inode → DOWN, never an error
    sock.once("timeout", () => done(false));   // bound but wedged answers as down, which serves the caller
  });
}

/**
 * PIDs holding the rendezvous socket at `path` — the UDS twin of `port-control.ts`'s
 * `portHolderPids`. Excludes our own PID. Empty = no owner found (no `ss`/`lsof`, or the OS reports
 * none).
 *
 * M-a (gp3-episkopos, measured live): `lsof -t <path>` named NOTHING for a real, live-held
 * rendezvous name. A holder never binds the rendezvous path directly — `owned-store.ts` binds a
 * private STAGING name (`<path>.<pid>.<random>`), then `linkSync`s it onto the rendezvous name, and
 * unlinks the staging name once linked. The kernel's own record of a UNIX socket's bound name is the
 * path it was `bind()`-ed to, not any hard link created or removed afterward — `ss -xlp`/`lsof -U`
 * both confirmed live that the listener still answers to the (unlinked) STAGING path, never the
 * rendezvous name a caller resolves through. So this matches by PREFIX (`<path>.`, deterministic;
 * the pid/random suffix is not) over every UNIX listener, rather than an exact path a holder never
 * actually binds.
 */
export function socketHolderPids(path: string): number[] {
  const self = process.pid;
  const uniq = (ns: number[]): number[] => [...new Set(ns)].filter((n) => n > 0 && n !== self);
  const prefix = `${path}.`;
  try {
    // `ss -xlp`: Netid State Recv-Q Send-Q `Local Address:Port` Peer-Address:Port Process — the bound
    // name carries no internal whitespace, so a plain split finds it at a fixed column.
    const out = execFileSync("ss", ["-xlp"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids: number[] = [];
    for (const line of out.split("\n")) {
      const cols = line.trim().split(/\s+/);
      if ((cols[4] ?? "").startsWith(prefix)) {
        const m = /pid=(\d+)/.exec(line);
        if (m) pids.push(Number(m[1]));
      }
    }
    if (pids.length > 0) return uniq(pids);
  } catch { /* ss absent or refused — fall to lsof */ }
  try {
    const out = execFileSync("lsof", ["-U"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids: number[] = [];
    for (const line of out.split("\n")) {
      if (!line.includes(prefix)) continue;
      const pid = Number(line.trim().split(/\s+/)[1]);
      if (Number.isFinite(pid)) pids.push(pid);
    }
    if (pids.length > 0) return uniq(pids);
  } catch { /* lsof absent or refused — fall to the kernel's own tables */ }
  return uniq(procHolderPids(prefix));
}

/**
 * PIDs holding a LISTENING UNIX socket bound under `prefix`, read off the kernel's own tables: `/proc/net/unix` names each bound
 * path with its socket inode, and `/proc/<pid>/fd/*` links a descriptor to `socket:[inode]`. It needs neither `ss` nor
 * `lsof` (a minimal container image carries neither), and it reads only the descriptors this user may read, so a holder of
 * another user stays unnamed, as it does for `lsof`. Empty = none found, or no `/proc`.
 */
export function procHolderPids(prefix: string): number[] {
  const inodes = new Set<string>();
  try {
    for (const line of readFileSync("/proc/net/unix", "utf8").split("\n").slice(1)) {
      const cols = line.trim().split(/\s+/);
      const bound = cols[7] ?? "";
      // Flags column: __SO_ACCEPTCON (0x10000) marks a LISTENING socket, the same set `ss -xl` names.
      const listening = (Number.parseInt(cols[3] ?? "0", 16) & 0x10000) !== 0;
      if (listening && bound.startsWith(prefix)) inodes.add(cols[6] ?? "");
    }
  } catch { return []; }
  if (inodes.size === 0) return [];
  const pids: number[] = [];
  let procs: string[] = [];
  try { procs = readdirSync("/proc").filter((n) => /^\d+$/.test(n)); } catch { return []; }
  for (const pid of procs) {
    let fds: string[] = [];
    try { fds = readdirSync(`/proc/${pid}/fd`); } catch { continue; }
    for (const fd of fds) {
      let link = "";
      try { link = readlinkSync(`/proc/${pid}/fd/${fd}`); } catch { continue; }
      const m = /^socket:\[(\d+)\]$/.exec(link);
      if (m && inodes.has(m[1]!)) { pids.push(Number(pid)); break; }
    }
  }
  return pids;
}

/**
 * Ask the socket WHO holds it, naming the answer — the CLI side of the same `{holder:"?"}` probe
 * `owned-store.ts`'s `heldAs` answers.
 *
 * TWO READINGS OF "NOTHING ANSWERED", NEVER FUSED (M4). Before this, every non-answer — an immediate
 * `ECONNREFUSED`/`ENOENT` (nobody there at all) AND a connection the OS accepted into its backlog but
 * whose process never read a byte (frozen, SIGSTOPped, wedged) — read as the SAME `null`, "no
 * discoverable holder". The difference matters: a SIGSTOPped holder would answer `null` at its
 * timeout exactly as an unbound socket does, so a caller budgeting "unbound" patience for a holder
 * standing the whole time would spend the WRONG patience and name the wrong story.
 *   - `error` (ECONNREFUSED/ENOENT, before any `connect`) → UNBOUND: `null`, nothing to connect to.
 *   - `timeout` after a successful `connect` but before any line arrives → WEDGED: something accepted
 *     the connection and then never answered. `socketHolderPids` names it when it can. The reading says SILENT
 *     and no more: a vessel that runs hot and one that stands frozen both land here, and the store door tells them
 *     apart by the holder's own CPU counter (`store-door.ts`'s `readHolder`).
 *   - a parsed line within the timeout → PARKED: a vessel mid-boot, claimed but not yet serving verbs,
 *     answering its own `{holder:"?"}` probe live (the ordinary slow-but-live boot);
 *   - a line that says `serving: true` → SERVING: the live seat answered, naming its asks in flight and the
 *     oldest one. The act this caller sent waits behind the island, and the vessel's own answer ends that wait.
 */
export interface WhoHoldsAnswer {
  readonly phase:   "parked" | "serving" | "wedged";
  readonly holder:  string | null;
  readonly message: string;
  /** SERVING: the oldest ask the live seat holds in flight, where it names one (the act a caller waits behind); its
   *  request id rides only to the asker whose id it holds. */
  readonly oldest?: { readonly verb: string; readonly requestId?: string } | null;
  readonly inFlight?: number;
  /** SERVING, to a probe that named its request id: does the seat still hold that id in flight? */
  readonly held?: boolean;
}

export function whoHolds(dataDir?: string | null, timeoutMs = 1_500, requestId?: string): Promise<WhoHoldsAnswer | null> {
  const path = udsSocketPath(dataDir);
  return new Promise((resolve) => {
    let settled = false;
    let connected = false;
    const done = (v: WhoHoldsAnswer | null): void => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch { /* already gone */ }
      resolve(v);
    };
    const sock = createConnection(path);
    // LIVENESS: a holder may accept the query and remain silent.
    sock.setTimeout(timeoutMs);
    sock.setEncoding("utf8");
    let buf = "";
    sock.once("connect", () => { connected = true; sock.write(JSON.stringify({ holder: "?", ...(requestId !== undefined ? { requestId } : {}) }) + "\n"); });
    sock.on("data", (c: string) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      try {
        const line = JSON.parse(buf.slice(0, nl)) as { holder?: unknown; errorMessage?: unknown; serving?: unknown; inFlight?: unknown; oldest?: unknown; held?: unknown };
        const holder = typeof line.holder === "string" ? line.holder : null;
        const message = typeof line.errorMessage === "string" ? line.errorMessage : "";
        // THE LIVE SEAT ANSWERS `serving` (the front answers the probe itself): a vessel that serves verbs, its act in
        // flight behind whatever the island runs. Only a holder that says it serves reads so; a park still reads parked.
        if (line.serving === true) {
          const o = line.oldest as { requestId?: unknown; verb?: unknown } | null | undefined;
          const oldest = o && typeof o === "object" ? { verb: typeof o.verb === "string" ? o.verb : "?", ...(typeof o.requestId === "string" ? { requestId: o.requestId } : {}) } : null;
          done({ phase: "serving", holder, message, oldest, ...(typeof line.inFlight === "number" ? { inFlight: line.inFlight } : {}), ...(typeof line.held === "boolean" ? { held: line.held } : {}) });
          return;
        }
        done({ phase: "parked", holder, message });
      } catch { done(null); }
    });
    sock.once("error",   () => done(null));
    sock.once("timeout", () => {
      if (!connected) { done(null); return; }                   // never even connected — genuinely unbound
      const pids = socketHolderPids(path);
      const message = pids.length > 0
        ? `a listener at ${path} accepted the connection but gave no answer within ${timeoutMs}ms — silent, still held by pid(s) ${pids.join(", ")}`
        : `a listener at ${path} accepted the connection but gave no answer within ${timeoutMs}ms — silent, answers to no discoverable pid`;
      done({ phase: "wedged", holder: null, message });
    });
  });
}

/** The local socket refused (absent/stale) — `runVerb` turns this into DaemonUnreachable. */
export class UdsUnreachable extends Error {}

/**
 * This caller's own local wait ended with NO receipt read back — never a verdict on the act itself.
 *
 * A wall clock never decides whether an act ran; it only bounds how long THIS process waits to hear.
 * The vessel may have abandoned the request before dispatch, may be mid-run, or may have already
 * committed and written a receipt this caller simply has not read yet (a frozen peer, a slow flush).
 * `requestId` is the one thing this caller can trust across that wait: read it back later and the
 * vessel's own durable outcome — never this timer — tells the truth.
 */
export class LocalWaitExpired extends Error {
  constructor(verb: string, timeoutMs: number, readonly requestId: string) {
    super(`local verb "${verb}" — stopped waiting after ${timeoutMs}ms; outcome unknown. Read it back: \`lares vessel request ${requestId}\`.`);
  }
}

/**
 * This call's own caller gave up (`opts.signal` fired) — never a transport fault. `throughStoreDoor` (H1)
 * aborts at the instant ITS budgeted wait names a holder and refuses, so the still-open verb socket closes
 * right then rather than waiting out this call's own flat `timeoutMs`: a vessel parked on that socket then
 * sees the hang-up as an `end`, immediately, instead of replaying the verb on a late thaw against a caller
 * that already told its own operator "failed".
 */
export class LocalInvocationAborted extends Error {}

/**
 * What a `{op:"receipt"}` read answers — mirrors `uds-channel.ts`'s `ReceiptAnswer` (kept as an
 * independent shape here rather than sharing one import, since the two sides of a socket boundary
 * stay decoupled in this codebase — see the module doc).
 */
export interface ReceiptAnswer {
  readonly requestId: string;
  /**
   * `evicted` — the vessel's own receipt ring (D1, M1) dropped this id's full durable outcome
   * past its retention bound; its fact survives (digest, effect key, terminal) but the result
   * body is gone — `act.ts`/`receipt-cmd.ts` read this as `retention-gap`, never a bare "unknown"
   * that would invite a silent re-run.
   *
   * `unanswered` — THIS caller's own patience for the READ itself ended (M13): the socket connected
   * but no line came back within `patienceMs`, so this side destroyed the socket and gave up on
   * HEARING, never on the question. Unlike `unknown` (the vessel answered honestly that it never
   * arbitrated this id), `unanswered` means no answer arrived at all — a frozen or wedged peer. Never
   * read as a verdict on the act.
   */
  readonly state: "abandoned" | "committed" | "interrupted" | "done" | "error" | "evicted" | "unknown" | "unanswered";
  readonly results?: Record<string, unknown>;
  readonly errorMessage?: string;
  /** The vessel's own name for a refusal it answers with (a torn fact reads `receipt-fact-torn`). */
  readonly refusal?: { readonly reason: string };
  /** The chore's receipt mark the outcome rests with: the acting face, the asker's hand (`seat`, `cli`, `tab`), its session. */
  readonly chore?: { readonly acting: number; readonly asker: string; readonly session: string | null };
  /** The engine's fall (`engine-watch` on the vessel), where the receipt came from the settled ledger after the engine stopped. */
  readonly engine?: { readonly status?: string; readonly cause?: string; readonly [k: string]: unknown };
}

/** This READ's own patience ended with no line back — mirrors `LocalWaitExpired` for the dispatch
 *  path, but for a query that cannot dispatch anything by construction. */
const DEFAULT_RECEIPT_PATIENCE_MS = 2_000;

/** The wire op a read-only receipt/cancel query sends — `{op:"receipt",…}` or `{op:"cancel",…}`. */
type ReadOnlyOp = "receipt" | "cancel";

/**
 * Shared transport for the two read-only ops (H1/M8): open the socket, write ONE `{op, requestId}`
 * line, read ONE line back. Both calls answer the SAME {@link ReceiptAnswer} shape; the op name is
 * the only wire difference.
 *
 * `patienceMs` (M13) is THIS caller's own MONOTONIC (`performance.now()`-timed) liveness for the
 * READ — never a verdict on anything. A frozen/wedged vessel that accepted the connection but never
 * answers would hang this call forever; past `patienceMs` this destroys the socket and resolves
 * `{state:"unanswered"}` instead, exactly as `LocalWaitExpired` ends the dispatch path's OWN wait.
 */
function readOnlyQuery(op: ReadOnlyOp, requestId: string, opts: { dataDir?: string | null; patienceMs?: number }): Promise<ReceiptAnswer> {
  const socketPath = udsSocketPath(opts.dataDir);
  const patienceMs = opts.patienceMs ?? DEFAULT_RECEIPT_PATIENCE_MS;
  return new Promise<ReceiptAnswer>((resolve, reject) => {
    let settled = false;
    const sock = createConnection(socketPath);
    let buf = "";
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    // LIVENESS: a daemon may never answer the receipt query; close and error settle separately.
    const timer = setTimeout(() => {
      settle(() => { try { sock.destroy(); } catch { /* already gone */ } resolve({ requestId, state: "unanswered" }); });
    }, patienceMs);
    sock.setEncoding("utf8");
    sock.on("connect", () => { sock.write(JSON.stringify({ op, requestId }) + "\n"); });
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const line = buf.slice(0, nl);
      try {
        const r = JSON.parse(line) as ReceiptAnswer;
        settle(() => { sock.end(); resolve(r); });
      } catch {
        settle(() => { sock.destroy(); reject(new Error(`bad ${op}-receipt json from local channel`)); });
      }
    });
    sock.on("error", (e: NodeJS.ErrnoException) => {
      settle(() => {
        if (e.code === "ENOENT" || e.code === "ECONNREFUSED") reject(new UdsUnreachable(e.message));
        else reject(e);
      });
    });
  });
}

/**
 * Read a request id's receipt WITHOUT dispatching anything (H1). A second `invokeLocal` with the
 * same request id as a "read-back" would ride the EXACT SAME dispatch path as the original, so an id
 * this vessel already dropped as abandoned would run a second time, never a read. `queryReceipt` rides a dedicated
 * `{op:"receipt"}` line the vessel's own connection handler answers from its ledger + the durable
 * outcome doc alone.
 *
 * `patienceMs` (M13, default {@link DEFAULT_RECEIPT_PATIENCE_MS}) — see {@link readOnlyQuery}.
 */
export function queryReceipt(requestId: string, opts: { dataDir?: string | null; patienceMs?: number } = {}): Promise<ReceiptAnswer> {
  return readOnlyQuery("receipt", requestId, opts);
}

/**
 * Withdraw a request id BEFORE it is read (M8) — `{op:"cancel"}`. Where no fact stands for the id, marks it
 * abandoned on the vessel's own ledger so a later line under the same id (a stray retry) refuses rather than
 * running. Answers the state that ledger holds once the cancel took its turn: `abandoned` where the withdrawal
 * stands, else the fact that already stood.
 *
 * `patienceMs` (M13) — see {@link readOnlyQuery}.
 */
export function cancelRequest(requestId: string, opts: { dataDir?: string | null; patienceMs?: number } = {}): Promise<ReceiptAnswer> {
  return readOnlyQuery("cancel", requestId, opts);
}

/**
 * THE HARNESS'S OWN MARK, read and never minted: true where the environment carries a mark an AI harness sets on the
 * shells it runs (Claude Code's `CLAUDECODE=1`; Codex's sandbox marks, `CODEX_SANDBOX` and `CODEX_SANDBOX_NETWORK_DISABLED`).
 * A CLI line asked from such a shell is the AI seat asking, so it carries the seat's mark (`seat: "ai"`) and meets the
 * seat's gates (`seat-canon-reach`, the lend's face wall). The operator's own terminal carries none. The mark stays a
 * designation, never a proof (`seat-hand`): it closes the honest road, not a hostile one.
 */
export function harnessSeatMarked(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env["CLAUDECODE"] === "1") return true;
  return Boolean(env["CODEX_SANDBOX"]) || Boolean(env["CODEX_SANDBOX_NETWORK_DISABLED"]);
}

/** The marks `harnessSeatMarked` reads, by name: the one list a suite clears so a run inside a harness reads as CI does. */
export const HARNESS_SEAT_MARKS: readonly string[] = ["CLAUDECODE", "CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED"];

export async function invokeLocal(
  verb:        string,
  args:        Record<string, unknown>,
  requestedBy: string,
  opts:        SubmitOptions & {
    readonly dataDir?: string | null; readonly signal?: AbortSignal; readonly env?: NodeJS.ProcessEnv;
    /** NO LOCAL TIMER: the caller's own `signal` (a person's interrupt) ends this wait, or the vessel's answer does. The
     *  `timeoutMs` still rides the wire as the vessel's own servo; this process reads no clock against it. */
    readonly untimed?: true;
  } = {},
): Promise<SubmitResult> {
  const socketPath = udsSocketPath(opts.dataDir);
  const seat = harnessSeatMarked(opts.env ?? process.env);
  const timeoutMs  = opts.timeoutMs ?? 30_000;
  // THE REQUEST ID RIDES BEFORE DISPATCH, NEVER AFTER. A caller-generated nonce (never one the vessel
  // mints on read) is the one thing that survives a lost response: this call's own local wait may end
  // with no receipt read back, but the SAME id reads the vessel's durable outcome back later — see
  // `LocalWaitExpired`. No absolute wall-clock deadline rides the wire: a vessel that parks this line
  // unread, however long it sits, never gets handed a caller's wall-clock stamp to compare its own
  // clock against (a clock EITHER side could be adversarially set). This call's own `timer` below is
  // LOCAL LIVENESS ONLY — it ends this process's own wait and closes this socket; it never tells the
  // vessel to stop, and it is never read by the vessel as a reason to drop the line.
  const requestId = opts.requestId ?? newRequestId();
  return await new Promise<SubmitResult>((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      try { sock.destroy(); } catch { /* already gone */ }
      fn();
    };
    const onAbort = (): void => settle(() => reject(new LocalInvocationAborted(`local verb "${verb}" aborted by its own caller`)));
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    // LIVENESS: a daemon may remain silent while the verb continues; reply or socket failure settles earlier.
    const timer = opts.untimed === true ? undefined : setTimeout(
      () => settle(() => reject(new LocalWaitExpired(verb, timeoutMs, requestId))),
      timeoutMs,
    );
    sock.setEncoding("utf8");
    sock.on("connect", () => {
      // THE ASK RIDES WITH THE INVOCATION. The daemon runs its own servo, and a caller that knows its
      // pass runs long — a bulk backfill over a whole corpus — can only say so if the number crosses.
      // Left off the wire, this side waited an hour while the daemon cut the same pass at two minutes.
      sock.write(JSON.stringify({ verb, args, requestedBy, timeoutMs, requestId, ...(opts.effectKey !== undefined && { effectKey: opts.effectKey }), ...(seat && { seat: "ai" }) }) + "\n");
    });
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const line = buf.slice(0, nl);
      try {
        const r = JSON.parse(line) as SubmitResult | { status: "unknown"; requestId: string };
        // M2: the VESSEL's own wait for an outcome ended — never a verdict on the act. Told back as
        // `{status:"unknown"}`, this reads exactly like this call's own `LocalWaitExpired` to every
        // caller downstream (they already special-case it): "outcome unknown", never `{status:"error"}`.
        if (r.status === "unknown") { settle(() => reject(new LocalWaitExpired(verb, timeoutMs, r.requestId))); return; }
        settle(() => resolve(r as SubmitResult));
      }
      catch { settle(() => reject(new Error("bad outcome json from local channel"))); }
    });
    sock.on("error", (e: NodeJS.ErrnoException) => {
      // ENOENT (no socket file) / ECONNREFUSED (stale) → no daemon holds the sock.
      if (e.code === "ENOENT" || e.code === "ECONNREFUSED") settle(() => reject(new UdsUnreachable(e.message)));
      else settle(() => reject(e));
    });
  });
}

/** The flag a caller declares its own wait by (`--ask-budget-ms=<N>`), in whole milliseconds counted from this process's start. */
export const ASK_BUDGET_FLAG = "--ask-budget-ms";
/** The code a process leaves by when its caller's budget ran out: the `outcome-unknown` family's own (`render.ts`). */
export const ASK_BUDGET_EXIT = 6;

/** The budget a flag's value declares, or null where it names none (absent, or anything but a positive whole number). */
export function askBudgetMs(raw: string | undefined): number | null {
  return raw !== undefined && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
}

/**
 * A CALLER GONE LEAVES NO ASK WAITING. A caller that waits a bounded while (a hook under its harness's bound) declares
 * that budget on the call itself (`--ask-budget-ms=<N>`, which the entry takes off the argv), and this process leaves when
 * it runs out: every socket it holds closes with it, so the vessel reads the hang-up the moment it reaches the line and never runs an ask nobody waits on (a read drops with
 * no work; an act not yet admitted rests `abandoned`). The caller's own signal may arrive late or never (a host shim
 * relays it through a second exec, and a kill of the shim strands the relay); the budget needs no relay.
 *
 * THE BUDGET BOUNDS THIS PROCESS'S OWN WAIT AND DECIDES NOTHING ELSE. It counts on this process's monotonic clock from
 * its own start (`performance.now()`), never a wall clock, and no reading of it crosses the socket: the vessel learns
 * only that its caller left. An act the vessel already admitted lands all the same, and its receipt reads it back.
 *
 * Answers the disarm (the verb finished first), or null where the call declares no budget.
 */
export function armAskBudget(
  budgetMs: number | null,
  deps: { readonly sinceStartMs?: () => number; readonly leave?: (code: number) => void; readonly say?: (line: string) => void } = {},
): (() => void) | null {
  if (budgetMs === null) return null;
  const sinceStartMs = deps.sinceStartMs ?? (() => performance.now());
  const leave = deps.leave ?? ((code: number) => { process.exit(code); });
  const say = deps.say ?? ((line: string) => { console.error(line); });
  // LIVENESS: this process's own wait, on its caller's word; the verb's answer disarms it.
  const timer = setTimeout(() => {
    say(`lares: the caller's budget (${ASK_BUDGET_FLAG}=${budgetMs}) ran out before the vessel answered, so this process leaves and its ask closes with it: a read the vessel had not reached never runs. Read again with a longer budget or none; an act already admitted lands all the same (\`lares vessel request <id>\` reads it).`);
    leave(ASK_BUDGET_EXIT);
  }, Math.max(0, budgetMs - sinceStartMs()));
  // The budget never holds a finished process open.
  timer.unref();
  return () => { clearTimeout(timer); };
}
