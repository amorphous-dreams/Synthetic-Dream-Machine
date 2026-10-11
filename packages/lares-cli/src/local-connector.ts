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
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";
import { newRequestId } from "@lararium/mesh";
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
  // daemon's dir and not this one — that divergence predates the relocation and is inherited here
  // rather than widened; `lares vessel read` prints the resolved path when the two must be compared.
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
    return uniq(pids);
  } catch { return []; }
}

/**
 * Ask the socket WHO holds it, naming the answer — the CLI side of the same `{holder:"?"}` probe
 * `owned-store.ts`'s `heldAs` answers.
 *
 * TWO READINGS OF "NOTHING ANSWERED", NEVER FUSED (M4). Before this, every non-answer — an immediate
 * `ECONNREFUSED`/`ENOENT` (nobody there at all) AND a connection the OS accepted into its backlog but
 * whose process never read a byte (frozen, SIGSTOPped, wedged) — read as the SAME `null`, "no
 * discoverable holder". A live probe proved the difference matters: a SIGSTOPped holder answered
 * `null` at its timeout exactly as an unbound socket would, so a caller budgeting "unbound" patience
 * for a holder that was there the whole time spent the WRONG patience and named the wrong story.
 *   - `error` (ECONNREFUSED/ENOENT, before any `connect`) → UNBOUND: `null`, nothing to connect to.
 *   - `timeout` after a successful `connect` but before any line arrives → WEDGED: something accepted
 *     the connection and then never answered. `socketHolderPids` names it when it can.
 *   - a parsed line within the timeout → PARKED: a vessel mid-boot, claimed but not yet serving verbs,
 *     answering its own `{holder:"?"}` probe live (the ordinary slow-but-live boot).
 */
export interface WhoHoldsAnswer {
  readonly phase:   "parked" | "wedged";
  readonly holder:  string | null;
  readonly message: string;
}

export function whoHolds(dataDir?: string | null, timeoutMs = 1_500): Promise<WhoHoldsAnswer | null> {
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
    sock.setTimeout(timeoutMs);
    sock.setEncoding("utf8");
    let buf = "";
    sock.once("connect", () => { connected = true; sock.write(JSON.stringify({ holder: "?" }) + "\n"); });
    sock.on("data", (c: string) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      try {
        const line = JSON.parse(buf.slice(0, nl)) as { holder?: unknown; errorMessage?: unknown };
        const holder = typeof line.holder === "string" ? line.holder : null;
        done({ phase: "parked", holder, message: typeof line.errorMessage === "string" ? line.errorMessage : "" });
      } catch { done(null); }
    });
    sock.once("error",   () => done(null));
    sock.once("timeout", () => {
      if (!connected) { done(null); return; }                   // never even connected — genuinely unbound
      const pids = socketHolderPids(path);
      const message = pids.length > 0
        ? `a listener at ${path} accepted the connection but gave no answer within ${timeoutMs}ms — frozen or wedged, still held by pid(s) ${pids.join(", ")}`
        : `a listener at ${path} accepted the connection but gave no answer within ${timeoutMs}ms — frozen or wedged, answers to no discoverable pid`;
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
    super(`local verb "${verb}" — stopped waiting after ${timeoutMs}ms; outcome unknown. Check request ${requestId}.`);
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
  readonly state: "abandoned" | "committed" | "done" | "error" | "evicted" | "unknown" | "unanswered";
  readonly results?: Record<string, unknown>;
  readonly errorMessage?: string;
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
 * answers used to hang this call forever; past `patienceMs` this destroys the socket and resolves
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
 * Read a request id's receipt WITHOUT dispatching anything (H1). Replaces the old pattern of
 * calling `invokeLocal` a second time with the same request id as a "read-back" — that second call
 * went through the EXACT SAME dispatch path as the original, so an id this vessel had already
 * dropped as abandoned got run a second time, never a read. `queryReceipt` rides a dedicated
 * `{op:"receipt"}` line the vessel's own connection handler answers from its ledger + the durable
 * outcome doc alone.
 *
 * `patienceMs` (M13, default {@link DEFAULT_RECEIPT_PATIENCE_MS}) — see {@link readOnlyQuery}.
 */
export function queryReceipt(requestId: string, opts: { dataDir?: string | null; patienceMs?: number } = {}): Promise<ReceiptAnswer> {
  return readOnlyQuery("receipt", requestId, opts);
}

/**
 * Withdraw a request id BEFORE it is read (M8) — `{op:"cancel"}`. Marks the id abandoned on the
 * vessel's own ledger so a later line under the same id (a stray retry) refuses rather than running.
 *
 * `patienceMs` (M13) — see {@link readOnlyQuery}.
 */
export function cancelRequest(requestId: string, opts: { dataDir?: string | null; patienceMs?: number } = {}): Promise<ReceiptAnswer> {
  return readOnlyQuery("cancel", requestId, opts);
}

export async function invokeLocal(
  verb:        string,
  args:        Record<string, unknown>,
  requestedBy: string,
  opts:        SubmitOptions & { readonly dataDir?: string | null; readonly signal?: AbortSignal } = {},
): Promise<SubmitResult> {
  const socketPath = udsSocketPath(opts.dataDir);
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
    const timer = setTimeout(
      () => settle(() => reject(new LocalWaitExpired(verb, timeoutMs, requestId))),
      timeoutMs,
    );
    sock.setEncoding("utf8");
    sock.on("connect", () => {
      // THE ASK RIDES WITH THE INVOCATION. The daemon runs its own servo, and a caller that knows its
      // pass runs long — a bulk backfill over a whole corpus — can only say so if the number crosses.
      // Left off the wire, this side waited an hour while the daemon cut the same pass at two minutes.
      sock.write(JSON.stringify({ verb, args, requestedBy, timeoutMs, requestId, ...(opts.effectKey !== undefined && { effectKey: opts.effectKey }) }) + "\n");
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
