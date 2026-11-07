/**
 * stand-socket-wait — wait for a freshly spawned node's verb socket on the node's own events.
 *
 * The socket binds later than `vessel-ready`. The wait ends when the socket answers a connect (`up`), the node
 * attests `fatal:` (`fault`), the channel logs `uds error:` (`refused`, with its cause), or the child exits
 * (`exited`). A node that keeps writing its log is making progress, so progress renews the silence span; only
 * a node that binds nothing, writes nothing and never exits reaches the silence bound (`silent`).
 */
export interface VerbSocketWait {
  readonly alive: () => Promise<boolean>;
  readonly readAttestation: () => string;
  readonly childExited: () => boolean;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /** The LIVENESS span: log silence this long, with no bind and no exit, reads as stalled. */
  readonly silenceMs: number;
}
export type VerbSocketOutcome = "up" | "fault" | "refused" | "exited" | "silent";

export async function awaitVerbSocket(w: VerbSocketWait): Promise<{ outcome: VerbSocketOutcome; refusal: string | null }> {
  let seenLen = w.readAttestation().length;
  let silentSince = w.now();
  for (;;) {
    if (w.childExited()) return { outcome: "exited", refusal: null };
    if (await w.alive()) return { outcome: "up", refusal: null };
    const tail = w.readAttestation();
    if (/fatal:/.test(tail)) return { outcome: "fault", refusal: null };
    const refused = /uds error: (.+)/.exec(tail);
    if (refused) return { outcome: "refused", refusal: refused[1]!.trim() };
    if (tail.length > seenLen) { seenLen = tail.length; silentSince = w.now(); }
    // LIVENESS: a node that binds nothing, writes nothing and never exits says nothing more; no event can say never.
    if (w.now() - silentSince >= w.silenceMs) return { outcome: "silent", refusal: null };
    await w.sleep(500);
  }
}

export interface BootPhaseWait {
  readonly readAttestation: () => string;
  readonly childExited: () => boolean;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /** The LIVENESS span: log silence this long, with no ready line, fault or exit, reads as stalled. */
  readonly silenceMs: number;
}
export type BootPhaseOutcome = "ready" | "fault" | "exited" | "silent";

/**
 * The boot phase: a spawned node's log says `vessel-ready` or `fatal:`, or the child exits. Log growth renews the
 * silence span (a heavy corpus replay writes as it goes); no fixed ceiling bounds a boot that keeps making progress.
 */
export async function awaitBootPhase(w: BootPhaseWait): Promise<BootPhaseOutcome> {
  let seenLen = 0;
  let silentSince = w.now();
  for (;;) {
    const tail = w.readAttestation();
    if (/fatal:/.test(tail)) return "fault";
    if (tail.includes("vessel-ready")) return "ready";
    if (w.childExited()) return "exited";
    if (tail.length > seenLen) { seenLen = tail.length; silentSince = w.now(); }
    // LIVENESS: a node that writes nothing, never reports ready and never exits says nothing more; no event can say never.
    if (w.now() - silentSince >= w.silenceMs) return "silent";
    await w.sleep(200);
  }
}
