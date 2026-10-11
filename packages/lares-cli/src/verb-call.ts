/**
 * verb-call — the one entry point every CLI command uses to run a verb against the
 * daemon. One transport: the pono sock.
 *
 * The CLI and the daemon share a machine, so they share a socket. A verb-summons
 * rides one capability-bearing line into the rendezvous socket; the outcome line
 * rides back. The socket's 0600 owner-only perms gate PRESENCE; the requestedBy
 * did rides the invocation for the daemon's verify-then-delegate (authority); the
 * daemon's warm replica records the durable CRDT outcome (record). Transport,
 * authority, and record stay decoupled — see
 * lar:///ha.ka.ba/lararium/api/lares-lararium-binding.
 *
 * No leaf Repo, no WS sync-on-connect, no in-memory replica. A CLI process that
 * stood its own Automerge replica to reach a daemon holding the canonical one paid
 * a sync handshake to learn what sat one socket away. The daemon owns the replica;
 * the CLI stays a thin mouth. A genuine remote peer speaks WS to the daemon's own
 * relay — never through this surface.
 */

import { invokeLocal, udsSocketPresent, udsSocketPath, UdsUnreachable, LocalWaitExpired } from "./local-connector.js";
import type { SubmitResult, SubmitOptions } from "./verb-result.js";

export interface RunVerbOptions extends SubmitOptions {
  readonly dataDir?: string;
}

/** No daemon holds the socket — the operator must `lares vessel stand --foreground`. */
export class DaemonUnreachable extends Error {
  constructor(socketPath: string) {
    super(`no lares daemon at ${socketPath} — start one with \`lares vessel stand --foreground\``);
    this.name = "DaemonUnreachable";
  }
}

/**
 * A `runVerb` catch, told apart by FAULT TYPE, never by sniffing the error's message (M3).
 *
 *   outcome-unknown   — this process's own local wait ended with no receipt read back
 *                        (`LocalWaitExpired`, including the vessel's own `{status:"unknown"}`
 *                        wait-expiry folded into it by `invokeLocal`). The socket connected and
 *                        the daemon took the verb; it may have already committed. NEVER told as
 *                        "start the daemon" (nothing is absent) or as a plain verb failure
 *                        (nothing is known to have faulted).
 *   daemon-unreachable — no daemon answered at all (`DaemonUnreachable` / a stale-socket refusal).
 *   verb-error         — anything else — a genuine thrown fault from the transport itself (a verb's
 *                        OWN failure rides back as a resolved `SubmitResult`, not a throw, so this
 *                        branch is reserved for transport-level faults a caller did not already
 *                        handle via `result.status === "error"`).
 *
 * Before this, EVERY `runVerb` catch other than `act.ts`'s folded all three into
 * `daemon-unreachable` — a caller told to "start the daemon" when the daemon stood the whole time
 * and simply took longer to answer than this process waited.
 */
export interface VerbFailure {
  readonly code:    "outcome-unknown" | "daemon-unreachable" | "verb-error";
  readonly message: string;
  readonly requestId?: string;
  readonly hint?: string;
}

export function verbFailure(err: unknown): VerbFailure {
  if (err instanceof LocalWaitExpired) {
    return {
      code: "outcome-unknown", message: err.message, requestId: err.requestId,
      hint: `the daemon took this request but this process stopped waiting to hear back; it may have already committed. Check request ${err.requestId}, or re-run.`,
    };
  }
  if (err instanceof DaemonUnreachable) {
    return { code: "daemon-unreachable", message: err.message, hint: "Start the daemon with `lares vessel stand --foreground` and try again." };
  }
  return { code: "verb-error", message: err instanceof Error ? err.message : String(err) };
}

export async function runVerb(
  verb:        string,
  args:        Record<string, unknown>,
  requestedBy: string,
  opts:        RunVerbOptions = {},
): Promise<SubmitResult> {
  if (!udsSocketPresent(opts.dataDir)) throw new DaemonUnreachable(udsSocketPath(opts.dataDir));
  try {
    return await invokeLocal(verb, args, requestedBy, opts);
  } catch (e) {
    // A real verb error surfaces as itself; only an absent/stale socket becomes
    // the "start the daemon" counsel.
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath(opts.dataDir));
    throw e;
  }
}
