/**
 * stand-socket-wait — wait for a freshly spawned node's boot and verb socket on the node's own events.
 *
 * Each wait ends on a terminal event: the node attests `vessel-ready` (boot) or the socket answers a connect (socket),
 * the node attests `fatal:` (`fault`), the channel logs `uds error:` (`refused`, with its cause), or the child exits
 * (`exited`). Between those, only PROGRESS keeps a wait open, and progress means one thing: the node names a boot
 * MILESTONE (`phase → <name>`) that stands later in `BOOT_MILESTONES` than any milestone it named before. A repeated
 * milestone, an earlier one, or any other log line (a retry counter, a timestamp, a replay line) renews nothing, so a
 * node alive in a loop reaches the LIVENESS silence bound (`silent`) however much it writes. No fixed ceiling cuts a
 * node that keeps advancing.
 */

/**
 * The node's boot milestones in the order a node EMITS them (measured, not declared): the vessel phases its composers
 * log at `[lararium] phase →` / `[herm] phase →` (main.ts), then the two socket-stage markers main.ts writes as the
 * verb channel's seat stands. A hearth emits boot → repo-open → catalog-ready → island-ready → corpus-ready →
 * wiki-ready → vessel-ready → tw5-booted → live; a herm skips the wiki half (boot → repo-open → catalog-ready →
 * vessel-ready → live). `LarOpenPhase` DECLARES corpus-ready after tw5-booted; the emission places it before
 * wiki-ready (lar:///ha.ka.ba/lararium/docs/open-phases), and this order follows the emission. A skip forward still
 * advances; a phase the node never names never blocks.
 */
export const BOOT_MILESTONES = [
  "boot", "repo-open", "catalog-ready", "island-ready", "corpus-ready", "wiki-ready",
  "vessel-ready", "tw5-booted", "live", "daemon-ea", "verb-seat",
] as const;

const MILESTONE_LINE = /\bphase → ([a-z0-9-]+)\s*$/;

/** The furthest milestone a log names, as its index in `BOOT_MILESTONES` (-1 when it names none). */
export function bootStage(log: string): number {
  let stage = -1;
  for (const line of log.split("\n")) {
    const m = MILESTONE_LINE.exec(line);
    if (!m) continue;
    const at = (BOOT_MILESTONES as readonly string[]).indexOf(m[1]!);
    if (at > stage) stage = at;
  }
  return stage;
}

export interface VerbSocketWait {
  readonly alive: () => Promise<boolean>;
  readonly readAttestation: () => string;
  readonly childExited: () => boolean;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /** The LIVENESS span: this long with no new milestone, no bind and no exit reads as stalled. */
  readonly silenceMs: number;
}
export type VerbSocketOutcome = "up" | "fault" | "refused" | "exited" | "silent";

export async function awaitVerbSocket(w: VerbSocketWait): Promise<{ outcome: VerbSocketOutcome; refusal: string | null }> {
  let stage = bootStage(w.readAttestation());
  let silentSince = w.now();
  for (;;) {
    if (w.childExited()) return { outcome: "exited", refusal: null };
    if (await w.alive()) return { outcome: "up", refusal: null };
    const tail = w.readAttestation();
    if (/fatal:/.test(tail)) return { outcome: "fault", refusal: null };
    const refused = /uds error: (.+)/.exec(tail);
    if (refused) return { outcome: "refused", refusal: refused[1]!.trim() };
    const reached = bootStage(tail);
    if (reached > stage) { stage = reached; silentSince = w.now(); }
    // LIVENESS: a node that binds nothing, names no later milestone and never exits says nothing more; no event can say never.
    if (w.now() - silentSince >= w.silenceMs) return { outcome: "silent", refusal: null };
    await w.sleep(500);
  }
}

export interface BootPhaseWait {
  readonly readAttestation: () => string;
  readonly childExited: () => boolean;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /** The LIVENESS span: this long with no new milestone, no ready line, fault or exit reads as stalled. */
  readonly silenceMs: number;
}
export type BootPhaseOutcome = "ready" | "fault" | "exited" | "silent";

/** The boot phase: a spawned node's log says `vessel-ready` or `fatal:`, or the child exits; each new milestone renews the span. */
export async function awaitBootPhase(w: BootPhaseWait): Promise<BootPhaseOutcome> {
  let stage = -1;
  let silentSince = w.now();
  for (;;) {
    const tail = w.readAttestation();
    if (/fatal:/.test(tail)) return "fault";
    if (tail.includes("vessel-ready")) return "ready";
    if (w.childExited()) return "exited";
    const reached = bootStage(tail);
    if (reached > stage) { stage = reached; silentSince = w.now(); }
    // LIVENESS: a node that names no later milestone, never reports ready and never exits says nothing more; no event can say never.
    if (w.now() - silentSince >= w.silenceMs) return "silent";
    await w.sleep(200);
  }
}
