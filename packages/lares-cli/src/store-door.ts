/**
 * store-door — ONE door for a command that touches the vessel's store.
 *
 * A standing vessel HOLDS its store: the Repo its peers sync, the records its own clients write. A command that
 * opened the store beside it would change bytes the running replica never sees, or race a write the vessel is
 * making. So a command routes its verb THROUGH the vessel whenever one stands, over the owner-only local socket,
 * and the vessel runs it against what it holds; with no vessel standing, the command runs the same door itself
 * and owns the store for that moment. One holder at a time, either way.
 *
 * The verb's answer comes back as the door's own payload. A door that REFUSES answers `{ refused }`, which the
 * caller names exactly as it names a refusal on the direct path.
 */

import { wardTicketFor } from "./ward-door.js";
import { ControlHomeUnavailable, newRequestId, VESSEL_LOCKED, type Credential, type SessionReceipt } from "@lararium/mesh";
import { storeDoorDirect, storeVerbFace, storeVerbGatesFirst, StoreHeld, STORE_DOOR_FACE_VERBS, type StoreDoorVerb } from "@lararium/node";
import { openLocalSession, SessionRefused } from "./session-connector.js";
import { sealedAct } from "./sealed-act-door.js";
import { vesselStanding, type VesselStanding } from "./custody-door.js";
import { vesselDid, larSealHome, larDataDir } from "./env.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DaemonUnreachable, refusalCode, refusalHint, verbFailure } from "./verb-call.js";
import { udsAlive, udsSocketPresent, udsSocketPath, whoHolds, invokeLocal, UdsUnreachable, LocalWaitExpired, type WhoHoldsAnswer } from "./local-connector.js";
import { waitForResourceBudgeted, SlowBootTimeout, type BootPhase } from "./port-control.js";
import { BOOT_MILESTONES, bootStage } from "./stand-socket-wait.js";
import { summaryOutput } from "./verb-result.js";
import type { SubmitResult } from "./verb-result.js";

/**
 * Run `verb` over the local socket exactly as `verb-call.ts`'s `runVerb` does (same presence check, same
 * `UdsUnreachable` → `DaemonUnreachable` mapping), but passing `signal` straight through to `invokeLocal` so
 * THIS door's own budgeted wait can abort the socket at its own decision (H1), rather than let the verb's
 * flat `timeoutMs` hold it open for the rest of a budget nobody is still waiting on.
 */
async function invokeAbortable(
  verb: string, args: Record<string, unknown>, requestedBy: string,
  opts: { readonly timeoutMs?: number; readonly signal: AbortSignal; readonly requestId: string },
): Promise<SubmitResult> {
  if (!udsSocketPresent()) throw new DaemonUnreachable(udsSocketPath());
  // UNTIMED HERE: the door's own wait reads the holder, and the vessel's answer (or a person's interrupt) ends it.
  try { return await invokeLocal(verb, args, requestedBy, { ...opts, untimed: true }); }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath());
    throw e;
  }
}

/**
 * Run face row `verb` inside the standing vessel on a session of face `face` (`h<N>`): the session opens, the one act
 * rides it (`session:act`), and the session closes. The row's answer returns on that socket alone, so no outcome body
 * rests in the daemon document beside the face (K20). The door's own abort closes the session at once, as it ends the
 * maintenance frame's socket. A session the vessel refuses (a locked face, a face it does not hold, a moved anchor)
 * answers by the vessel's own name, and a row the vessel could not run throws `RoutedVerbRefused` with its words and
 * the refusal's own name. The act carries no flat timer of its own: the door's budgeted wait bounds it, and the vessel
 * bounds its clearance (`LocalWaitExpired` serves the maintenance frame alone).
 * THE DOOR OWNS THE ACT'S REQUEST ID: it mints one per act and the act rides it, so a socket that goes once the act was
 * sent throws {@link SessionActAnswerLost} naming that id and the face, and {@link sessionActReceipt} reads the outcome
 * under it. A socket that went before the session opened sent nothing, and reads `DaemonUnreachable`.
 */
async function invokeInSession(
  verb: string, args: Record<string, unknown>, face: number,
  opts: { readonly signal: AbortSignal; readonly requestId: string },
): Promise<Record<string, unknown>> {
  if (!udsSocketPresent()) throw new DaemonUnreachable(udsSocketPath());
  let session: Awaited<ReturnType<typeof openLocalSession>>;
  try { session = await openLocalSession({ faceRef: `h${face}`, hand: "cli" }); }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath());
    if (e instanceof SessionRefused) throw new RoutedVerbRefused(e.message, e.refusal);
    throw e;
  }
  const abort = () => { void session.close(); };
  opts.signal.addEventListener("abort", abort, { once: true });
  const requestId = opts.requestId;
  try {
    const { answer } = await session.act(verb, args, { requestId });
    if (answer["status"] === "error") {
      const reason = typeof answer["reason"] === "string" ? answer["reason"] : undefined;
      throw new RoutedVerbRefused(typeof answer["errorMessage"] === "string" ? answer["errorMessage"] : reason ?? `${verb} failed`, reason);
    }
    const output = answer["output"];
    return output !== null && typeof output === "object" && !Array.isArray(output) ? output as Record<string, unknown> : {};
  }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new SessionActAnswerLost(verb, face, requestId);
    if (e instanceof SessionRefused) throw new RoutedVerbRefused(e.message, e.refusal);
    throw e;
  } finally {
    opts.signal.removeEventListener("abort", abort);
    await session.close().catch(() => { /* the socket already went */ });
  }
}

/**
 * A FACE ROW'S ANSWER WENT WITH ITS SOCKET: the act was sent under `requestId` on a session of face `face`, and no answer
 * came back. It may have run, so this reads outcome-unknown, never a verdict; the face's receipt under the id tells.
 */
export class SessionActAnswerLost extends Error {
  override readonly name = "SessionActAnswerLost";
  constructor(readonly verb: string, readonly face: number, readonly requestId: string) {
    super(`"${verb}" on face h${face} lost its answer with the socket; outcome unknown. Its receipt rides request ${requestId}.`);
  }
}

/**
 * RECOVER A FACE ROW'S OUTCOME BY ITS ID: open a session of face `face` and read the receipt the act under `requestId`
 * left (the vessel scopes it to the face). The answer body rode the lost socket alone, so the receipt carries the outcome
 * the vessel recorded, never the body. Throws `DaemonUnreachable` where no vessel answers.
 */
export async function sessionActReceipt(face: number, requestId: string): Promise<SessionReceipt> {
  if (!udsSocketPresent()) throw new DaemonUnreachable(udsSocketPath());
  let session: Awaited<ReturnType<typeof openLocalSession>>;
  try { session = await openLocalSession({ faceRef: `h${face}`, hand: "cli" }); }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath());
    if (e instanceof SessionRefused) throw new RoutedVerbRefused(e.message, e.refusal);
    throw e;
  }
  try { return await session.receipt(requestId); }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath());
    throw e;
  }
  finally { await session.close().catch(() => { /* the socket already went */ }); }
}

/**
 * PROVE A FACE'S SESSION OPENS on a running vessel, before an act of several steps writes its first: open a session of
 * the face, then close it, riding nothing on it. A refusal throws `RoutedVerbRefused` under the vessel's own name
 * (`storeFailure` reads it), so the act refuses with nothing written. With no vessel standing it proves nothing and
 * answers: each row then runs here, and a later step's refusal names itself.
 */
export async function proveFaceSession(face: number): Promise<void> {
  if (!(await udsAlive())) return;
  let session: Awaited<ReturnType<typeof openLocalSession>>;
  try { session = await openLocalSession({ faceRef: `h${face}`, hand: "cli" }); }
  catch (e) {
    if (e instanceof UdsUnreachable) return;
    if (e instanceof SessionRefused) throw new RoutedVerbRefused(e.message, e.refusal);
    throw e;
  }
  await session.close().catch(() => { /* the socket already went */ });
}

/** Where a routed door ran: inside the standing vessel, or in this process. */
export type StoreDoorVia = "daemon" | "direct";

/**
 * This door's own patience for a store it cannot yet reach serving verbs: the rendezvous name may stand with
 * no answer at all yet (the vessel still opening its claim), stand PARKED (claimed, but its boot has not yet
 * opened a verb channel — `owned-store.ts`'s `park`), or stand WEDGED (M4: something accepted the connection
 * and then never answered at all — frozen, not merely slow-but-live). Each phase spends its OWN budget, so a
 * slow-but-live boot earns more patience than a name nothing answers at all, a wedged holder earns its own
 * bounded patience distinct from both, and a timeout NAMES the pid still holding rather than a flat "timed
 * out after 30000ms".
 */
export const STORE_DOOR_PHASES: readonly BootPhase[] = [
  { name: "unbound", budgetMs: 10_000 },
  // PARKED spends no budget either (No Global Now): the boot still advances, and a clock never decides it failed. The figure
  // paces the "still boots" line alone; the holder gone, a boot-log fault or refusal, a stand-socket exit, the seat's serving
  // answer, or a person's interrupt ends the wait.
  { name: "parked",  budgetMs: 45_000, paced: true },
  { name: "wedged",  budgetMs: 10_000 },
  // SERVING spends no budget (No Global Now): the live seat took the act and answers for it, however long the island
  // runs ahead of it. The figure names the PACING of the progress lines alone; the vessel's answer, its named refusal,
  // or a person's interrupt ends the wait.
  { name: "serving", budgetMs: 15_000, paced: true },
];

/**
 * A CAUSE ENDED THE WAIT on a parked vessel, never a clock: the holder named at the park left the process table, the boot
 * log attested `fatal:` or a `uds error:`, or the stand socket's child exited. The act never reached the store; the cure
 * names the command that reads or restarts what stood there.
 */
export type StoreDoorEndCause = "holder-gone" | "boot-fault" | "boot-refused" | "stand-exited";
export class StoreDoorEnded extends Error {
  override readonly name = "StoreDoorEnded";
  constructor(readonly verb: string, readonly ended: StoreDoorEndCause, readonly detail: string) {
    super(`"${verb}": the vessel's boot ended before it served (${detail}); the act never reached the store.`);
  }
}
const endedCure: Record<StoreDoorEndCause, string> = {
  "holder-gone":  "the holder left; run again to stand a fresh door, or read what held the store with `lares vessel read`.",
  "boot-fault":   "the boot attested a fault; read it with `lares vessel read`, then stand the vessel again with `lares vessel stand`.",
  "boot-refused": "the boot's verb channel refused; read the cause with `lares vessel read`, then stand the vessel again with `lares vessel stand`.",
  "stand-exited": "the node that was standing exited; stand it again with `lares vessel stand`, then run again.",
};

/**
 * A PERSON ENDED THE WAIT (an interrupt), never a clock and never a verdict on the act: the vessel took it under
 * `requestId` and may still run it. The words name the id to read back.
 */
export class StoreDoorInterrupted extends Error {
  override readonly name = "StoreDoorInterrupted";
  constructor(readonly verb: string, readonly requestId: string, readonly face?: number) {
    super(`"${verb}": the wait ended at your interrupt; the vessel holds the act under request ${requestId} and may still run it. ${readBack(requestId, face)}`);
  }
}

/**
 * THE ACT LEFT THE SEAT'S HOLD, AND NO ANSWER CAME: the holder probe, asked twice under this act's request id,
 * read it gone from the asks in flight (or, for a caller with no person at the keys, could not confirm it held). Never
 * a clock's verdict: the seat's own word. The act may have run; the id reads its outcome back.
 */
export class RequestLost extends Error {
  override readonly name = "RequestLost";
  constructor(readonly verb: string, readonly requestId: string, readonly face?: number) {
    super(`"${verb}": request ${requestId} left the vessel's asks in flight and no answer reached this caller. ${readBack(requestId, face)}`);
  }
}
const readBack = (requestId: string, face?: number): string => face === undefined
  ? `Read it back: \`lares vessel request ${requestId}\`.`
  : `Read its receipt under request ${requestId} on a session of face h${face}.`;

/** The progress line a serving wait prints: the vessel serves, the act waits behind the island, and the cure. */
function servingLine(verb: string, requestId: string, met: WhoHoldsAnswer | null, interactive: boolean, face?: number): string {
  const oldest = met?.oldest;
  const ahead = oldest && oldest.requestId === undefined ? `; ${met?.inFlight ?? "some"} ask(s) in flight, the oldest a ${oldest.verb}` : oldest ? "; yours stands oldest in flight" : "";
  const exit = interactive ? " Ctrl-C ends this wait, never the act." : " This wait goes on while the vessel holds the act.";
  return `[lares] the vessel serves; your act "${verb}" (request ${requestId}) waits behind the island${ahead}.${exit} ${readBack(requestId, face)}`;
}

/** The progress line a parked wait prints: the vessel still boots, and the act stays owed. */
function parkedLine(log: string, holder: string): string {
  const at = bootStage(log);
  const stage = at >= 0 ? BOOT_MILESTONES[at]! : "unread";
  const pids = pidsNamedIn(holder);
  const named = pids.length > 0 ? ` (pid ${pids.join(", ")})` : "";
  return `[lares] the vessel still boots (stage ${stage}); the act stays owed. To look: \`lares vessel read\` names the holder${named}. To stop waiting: interrupt this act; it stays owed.`;
}

/** The ask a paced door sends the vessel: its servo's own ceiling (one hour), the most patience the vessel holds, never the 30 s a missing figure defaults to. */
const NO_SERVO_MS = 3_600_000;

/** Does `pid` still run on this host? EPERM (another user's process) reads ALIVE; only ESRCH reads gone. */
export function hostPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}

/**
 * The current boot's stretch of `<data dir>/stand.log`, bound to the held vessel by IDENTITY, never by a clock: the stand's
 * first line (`boot pid <N>`) names its own pid, and this reads only the lines from the LAST such line whose pid the held
 * vessel names (whoHolds). No file time and no boot time decides: an older stand's log, a touched file or a moved clock names
 * another pid, or none, and reads nothing. A container vessel writes no such file, and reads nothing. `readLog` is a test seam.
 */
export function standBootLog(holderPids: readonly number[], readLog: () => string = () => readFileSync(join(larDataDir(), "stand.log"), "utf8")): string {
  try {
    const lines = readLog().split("\n");
    let from = -1;
    lines.forEach((line, i) => {
      const m = /\bboot pid (\d+)\s*$/.exec(line);
      if (m) from = holderPids.includes(Number(m[1])) ? i : -1;
    });
    return from >= 0 ? lines.slice(from).join("\n") : "";
  } catch { return ""; }
}

/** The pid(s) named in a `heldAs`/`whoHolds` message (`"a vessel (pid 1234) holds…"`, or M4's wedged
 *  `"…still held by pid(s) 1234, 5678"`), or none. */
const pidsNamedIn = (message: string): readonly number[] => {
  const m = /pid\(?s?\)?\s+([\d, ]+)/.exec(message);
  if (!m) return [];
  return m[1]!.split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
};

/**
 * Run `verb` through the standing vessel, or `direct()` here when none stands. `daemonUp` is read once by a
 * caller routing several verbs; absent, the socket is probed.
 */
export async function throughStoreDoor(opts: {
  readonly verb:      string;
  readonly args:      Record<string, unknown>;
  readonly direct:    () => Record<string, unknown> | Promise<Record<string, unknown>>;
  readonly daemonUp?: boolean;
  /** The face the verb acts as. Named, the verb rides a session of that face; unnamed, the maintenance frame. */
  readonly face?:     number;
  /** Test seam — defaults to {@link STORE_DOOR_PHASES}. A real caller never overrides this. */
  readonly phases?:   readonly BootPhase[];
  /** Where a serving wait's progress lines go; stderr when absent. */
  readonly progress?: (line: string) => void;
  /** A person's interrupt; absent, the door listens for SIGINT while it waits. Test seam for the interrupt. */
  readonly interrupt?: AbortSignal;
  /** Does a person sit at the keys? Absent, read from stdin's TTY. Without one, the wait goes on only while the vessel
   *  confirms it holds the act. Test seam. */
  readonly interactive?: boolean;
  /** Test seam — does this pid still answer a signal-0 probe? Defaults to the process table. */
  readonly holderAlive?: (pid: number) => boolean;
  /** The vessel's boot log as it stands now (milestones, `fatal:`, `uds error:`); absent, no log reads. */
  readonly bootLog?: (holderPids: readonly number[]) => string;
  /** Has the stand socket's node exited? Absent, never. */
  readonly standExited?: () => boolean;
}): Promise<{ readonly output: Record<string, unknown>; readonly via: StoreDoorVia }> {
  if (opts.daemonUp ?? (await udsAlive())) {
    const phases = opts.phases ?? STORE_DOOR_PHASES;
    // The vessel's own servo for the maintenance frame: the budgets of the phases a clock still bounds (a paced phase
    // adds none). It rides the wire; this process sets no timer against it.
    const anyPaced = phases.some((p) => p.paced === true);
    const totalBudgetMs = phases.reduce((sum, p) => sum + (p.paced === true ? 0 : p.budgetMs), 0);
    const holderAlive = opts.holderAlive ?? hostPidAlive;
    const bootLog = opts.bootLog ?? ((pids: readonly number[]): string => standBootLog(pids));
    let holderGoneReads = 0;
    // The named pid counts only once THIS host has read it alive: a vessel in another pid namespace names a pid the host never
    // sees, and a host-side ESRCH there says nothing about the boot.
    const seenAlive = new Set<number>();
    const progress = opts.progress ?? ((line: string) => { process.stderr.write(`${line}\n`); });
    const interactive = opts.interactive ?? process.stdin.isTTY === true;
    const requestId = newRequestId();
    let settled = false;
    let lastMessage = "";
    let lastMet: WhoHoldsAnswer | null = null;
    const controller = new AbortController();
    // A PERSON ENDS THE WAIT, or the seat's own word that the act left its hold, never a clock: either aborts this
    // door's own socket and names the request id.
    let interrupted = false;
    let endWait!: (err: Error) => void;
    const interruption = new Promise<never>((_, reject) => {
      endWait = (err) => { if (interrupted) return; interrupted = true; reject(err); };
    });
    const onInterrupt = (): void => { endWait(new StoreDoorInterrupted(opts.verb, requestId, opts.face)); };
    /** Did the probe ever read the act held, and how many readings since read it gone (or, unattended, unconfirmed)? */
    let seenHeld = false;
    let goneReads = 0;
    interruption.catch(() => { /* raced below */ });
    const sigint = (): void => { onInterrupt(); };
    if (opts.interrupt) {
      if (opts.interrupt.aborted) onInterrupt(); else opts.interrupt.addEventListener("abort", onInterrupt, { once: true });
    } else process.once("SIGINT", sigint);
    const verbPromise = (opts.face !== undefined
      ? invokeInSession(opts.verb, opts.args, opts.face, { signal: controller.signal, requestId })
      : invokeAbortable(opts.verb, opts.args, await vesselDid(), { timeoutMs: anyPaced ? NO_SERVO_MS : totalBudgetMs, signal: controller.signal, requestId }).then((r) => {
        // The vessel's own name for the refusal rides out with its words: a floor, a retired bag, an abandoned id.
        if (r.status === "error") throw new RoutedVerbRefused(r.errorMessage ?? "verb failed", r.refusal?.reason);
        return summaryOutput(r) ?? {};
      }))
      .finally(() => { settled = true; });
    // RACE the actual verb against a budgeted wait that NAMES the holder — never a flat clock that hangs mute.
    // The waiter never resolves on its own (its `probe` never reads true); it only ever throws `SlowBootTimeout`
    // once a phase's own budget is spent, or stops quietly the instant `until` sees the verb has settled.
    const named = waitForResourceBudgeted("the vessel's store door", phases, {
      until: () => settled,
      probe: async () => settled,
      phase: async () => {
        const met = await whoHolds(undefined, undefined, requestId);
        lastMessage = met?.message ?? "";
        lastMet = met;
        if (met?.phase === "serving" && !settled) {
          if (met.held === true) { seenHeld = true; goneReads = 0; }
          // GONE: the seat held the act, and the act left its hold. UNCONFIRMED: a caller with no person at the keys hears a
          // seat that names no hold. Either, read twice with no answer arriving, ends the wait by the seat's own word.
          else if ((met.held === false && seenHeld) || (met.held === undefined && !interactive)) {
            goneReads += 1;
            if (goneReads >= 2) endWait(new RequestLost(opts.verb, requestId, opts.face));
          }
        }
        // PARKED: only a cause ends the wait. The holder named at the park gone (read twice), the boot log's own fault or
        // refusal, or the stand socket's exit; each names its refusal and its cure.
        if (met?.phase === "parked" && !settled) {
          const pids = pidsNamedIn(met.message);
          for (const pid of pids) if (holderAlive(pid)) seenAlive.add(pid);
          const trusted = pids.some((pid) => seenAlive.has(pid));
          holderGoneReads = trusted && !pids.some(holderAlive) ? holderGoneReads + 1 : 0;
          const log = bootLog(pids);
          const refused = /uds error: (.+)/.exec(log);
          if (/fatal:/.test(log)) endWait(new StoreDoorEnded(opts.verb, "boot-fault", "the boot log attests `fatal:`"));
          else if (refused) endWait(new StoreDoorEnded(opts.verb, "boot-refused", `the verb channel logged \`uds error: ${refused[1]!.trim()}\``));
          else if (opts.standExited?.() === true) endWait(new StoreDoorEnded(opts.verb, "stand-exited", "the stand socket's node exited"));
          else if (holderGoneReads >= 2) endWait(new StoreDoorEnded(opts.verb, "holder-gone", `pid(s) ${pids.join(", ")} no longer run`));
        }
        // A serving reading prints nothing yet: a verb that answers inside one cadence leaves no line behind.
        return met === null ? "unbound" : met.phase;
      },
      holderPids: () => pidsNamedIn(lastMessage),
      onPace: (phase) => {
        if (settled) return;
        if (phase === "serving") progress(servingLine(opts.verb, requestId, lastMet, interactive, opts.face));
        else if (phase === "parked") progress(parkedLine(bootLog(pidsNamedIn(lastMessage)), lastMessage));
      },
    }).then((): { readonly quiet: true } => ({ quiet: true }));
    let raced: { readonly quiet: true } | { readonly quiet: false; readonly v: Record<string, unknown> };
    try {
      raced = await Promise.race([verbPromise.then((v): { readonly quiet: false; readonly v: Record<string, unknown> } => ({ quiet: false, v })), named, interruption]);
    } catch (err) {
      // THIS DOOR'S OWN DECISION CLOSES THE SOCKET AT ONCE (H1). A budgeted wait that names a holder and
      // gives up must not leave the verb's own flat timer holding a channel open for the rest of ITS budget
      // while nobody is still listening on this end — the vessel sees the hang-up as an `end` right then
      // (`owned-store.ts`'s `park`, once it stops masking EOF behind a paused, unshifted socket), rather than
      // running the verb on a late thaw against a caller that already told its operator this failed.
      controller.abort();
      settled = true;   // the waiter stops polling at its next turn
      await verbPromise.catch(() => { /* the abort's own rejection is not a second fault; `err` already is one */ });
      throw err;
    } finally {
      if (opts.interrupt) opts.interrupt.removeEventListener("abort", onInterrupt);
      else process.removeListener("SIGINT", sigint);
    }
    if (raced.quiet) {
      // The waiter went quiet once the verb settled; an interrupt that lands first still ends the wait.
      try { return { output: await Promise.race([verbPromise, interruption]), via: "daemon" }; }
      catch (err) { if (interrupted) { controller.abort(); await verbPromise.catch(() => {}); } throw err; }
    }
    return { output: raced.v, via: "daemon" };
  }
  return { output: await opts.direct(), via: "direct" };
}

export { SlowBootTimeout };

/** A door's refusal, when the calling command names no refusal class of its own. */
export class StoreDoorRefusal extends Error {}

/**
 * THE VESSEL STANDS LOCKED: its custody door answered, and no vessel key is held. A store row sent to it would park
 * behind the recomposition an unlock starts and wait out the door's whole budget with no word. The door refuses by name
 * before it parks.
 */
export class VesselLocked extends Error {
  constructor() { super("the vessel stands locked: `lares vault unlock`"); }
}

/** An unlock (or a lock) still recomposes: the vessel holds its key and has no verb channel yet. Measured: a row sent in this window parks for the whole recomposition. */
export class VesselComposing extends Error {
  constructor() { super("the vessel is recomposing after an unlock: run it again when `lares vault status` reads ready"); }
}

/** The custody door accepted the connection and gave no answer: a holder nobody can name. A row sent to it parks, so it refuses instead. */
export class VesselSilent extends Error {
  constructor() { super("the vessel's custody door gave no answer: `lares vessel read` names what holds the store"); }
}

/** The refusal a custody reading earns for a row that needs the key, or null when the vessel stands ready (or none stands). */
export function standingRefusal(standing: VesselStanding): Error | null {
  if (standing.reading === "silent") return new VesselSilent();
  if (standing.reading !== "vessel") return null;
  if (standing.composing) return new VesselComposing();
  return standing.unlocked ? null : new VesselLocked();
}

/** True for the rows that need the vessel key: a caller probes the custody door ONCE and hands the reading down. */
export const needsKey = (verb: StoreDoorVerb): boolean => KEY_VERBS.has(verb);

/** A verb routed through the standing vessel ended in an error. `reason` holds the vessel's own name for it, where it gave one. */
export class RoutedVerbRefused extends Error {
  constructor(message: string, readonly reason?: string) { super(message); }
}

/** The name each row refusal left the door under, kept beside the error a command catches. */
const REFUSAL_NAMES = new WeakMap<Error, string>();

/**
 * NAME A FAILURE THAT CAME THROUGH THE STORE DOOR, by the fault's own type and never by its words. Every command
 * that catches around a store verb reads its JSON `error.code` here, so no store refusal reaches a script as a
 * bare `refused` or `error`:
 *
 *   a row's refusal                 → the name its row answered (`nexus-kapae-refused`, `cabal-join-refused`, …)
 *   the vessel refused by name      → that name's code (`waking-floor`, `bag-retired`, `request-abandoned`, …)
 *   the control document unread     → `vessel-locked` (the key did not open) or `control-home-unnamed` (no face)
 *   another holder holds the store  → `store-held`
 *   the door's wait named a holder  → `store-door-timeout`
 *   this process stopped listening  → `outcome-unknown`, with the request id and its cure
 *   no vessel answered              → `daemon-unreachable`
 *
 * Anything else keeps `fallback`: the word the command already gave a fault it could not name.
 */
export function storeFailure(err: unknown, fallback = "error"): { readonly code: string; readonly message: string; readonly hint?: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof Error) {
    const named = REFUSAL_NAMES.get(err);
    if (named !== undefined) return { code: named, message };
  }
  if (err instanceof RoutedVerbRefused) {
    if (err.reason === undefined) return { code: fallback, message };
    const code = refusalCode(err.reason);
    const hint = refusalHint(code, undefined);
    return { code: code === "verb-error" ? err.reason : code, message, ...(hint !== undefined ? { hint } : {}) };
  }
  if (err instanceof VesselComposing) return { code: "vessel-composing", message, hint: "an unlock still recomposes the vessel; run again when `lares vault status` reads ready." };
  if (err instanceof VesselSilent) return { code: "vessel-silent", message, hint: "something holds the store and answers nothing; `lares vessel read` names the holder." };
  if (err instanceof VesselLocked) return { code: VESSEL_LOCKED, message, hint: "open the vessel key with `lares vault unlock`, then run again." };
  // THE DIRECT HOLDER'S REFUSED UNLOCK, by name: a row that needs the control document and could not open the vessel's key.
  if (err instanceof ControlHomeUnavailable) {
    return { code: err.refusal, message, ...(err.refusal === VESSEL_LOCKED ? { hint: "open the vessel key with `lares vault unlock`, then run again." } : err.refusal === "control-home-unnamed" ? { hint: "this place holds no face; light one with `lares persona new 0 --name '<label>'`." } : {}) };
  }
  if (err instanceof StoreHeld) return { code: "store-held", message, hint: "another holder holds this store: a standing vessel, or a command mid-act. Run again once it has gone." };
  if (err instanceof SlowBootTimeout) return { code: "store-door-timeout", message, hint: "the vessel's store door gave no answer inside its budget. `lares vessel read` names what holds it." };
  if (err instanceof StoreDoorEnded) return { code: "store-door-ended", message, hint: endedCure[err.ended] };
  if (err instanceof RequestLost) {
    return { code: "request-lost", message, hint: err.face === undefined
      ? `the act may have run; read it back with \`lares vessel request ${err.requestId}\` before running it again.`
      : `the act may have run; read its receipt under request ${err.requestId} on a session of face h${err.face} before running it again.` };
  }
  if (err instanceof StoreDoorInterrupted) {
    return { code: "outcome-unknown", message, hint: err.face === undefined
      ? `the act may still run; read it back with \`lares vessel request ${err.requestId}\` before running it again.`
      : `the act may still run; read its receipt under request ${err.requestId} on a session of face h${err.face} before running it again.` };
  }
  if (err instanceof SessionActAnswerLost) {
    return { code: "outcome-unknown", message, hint: `the act may have run; read its receipt under request ${err.requestId} on a session of face h${err.face} before running it again.` };
  }
  if (err instanceof LocalWaitExpired || err instanceof DaemonUnreachable) {
    const f = verbFailure(err);
    return { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) };
  }
  return { code: fallback, message };
}

/** The rows a locked vessel cannot run: each face row, and `persona-new`, which founds a face. */
const KEY_VERBS: ReadonlySet<StoreDoorVerb> = new Set<StoreDoorVerb>([...STORE_DOOR_FACE_VERBS, "persona-new"]);

/**
 * THE ROWS WHOSE SESSION ONLY SEATS THE ACT: the kūkulu's begin and offer gather every lent face (one lei, one vouch apiece), so
 * naming no face they ride the face the operator WEARS (`face.resolve` worn, the mounted face), never a refusal for several open.
 */
const WORN_SESSION_VERBS: ReadonlySet<StoreDoorVerb> = new Set<StoreDoorVerb>(["rite-begin", "rite-offer", "rite-land", "rite-abandon"]);

/**
 * Whether a row naming no face rides the worn face's session: the kūkulu's begin and offer, and its standing read
 * (`rite-receipts` with `rite: kukulu`), each gathering every lent face, so several faces open (the house lights h0, h1 and h2)
 * never refuse it; and a landing or an abandon that names no face (the hand line a read with no raw debt names). A plain receipts read
 * still resolves its one face.
 */
export const storeVerbRidesWorn = (verb: StoreDoorVerb, args: Readonly<Record<string, unknown>>): boolean =>
  WORN_SESSION_VERBS.has(verb) || (verb === "rite-receipts" && args["rite"] === "kukulu");

/**
 * Run one row of the store's door table: through the standing vessel when one stands, or here, holding the
 * store for the moment of the act (`storeDoorDirect`). A row's `{ refused }` answer throws as `Refusal`, so the
 * command names it exactly as it names a refusal on either path; the answer comes back as the row's own result,
 * with the door's `verb` echo set aside.
 *
 * EVERY ROW THAT ACTS AS A FACE RIDES A SESSION of that face on a running vessel (`STORE_DOOR_FACE_VERBS`): the face
 * the row names (`face`, else `handleIndex`), else the one face the vessel resolves (`face.resolve`). A row of the
 * place rides the maintenance frame, and with no vessel standing every row runs here.
 */
export async function storeVerb(
  verb: StoreDoorVerb,
  args: Record<string, unknown>,
  Refusal: new (message: string) => Error = StoreDoorRefusal,
  /** The custody reading a caller already took this command: the door probes ONCE per command. */
  standing?: VesselStanding,
  /** The route this same act already gathered, handed to a ward act so nothing asks again (`./keep-at-unlock.ts`). */
  wardRoute?: readonly Credential[],
): Promise<{ readonly output: Record<string, unknown>; readonly via: StoreDoorVia }> {
  const daemonUp = await udsAlive();
  // A LOCKED, COMPOSING OR SILENT VESSEL REFUSES BY NAME BEFORE THE DOOR PARKS, for the rows that act as a face or found one: the key
  // guards every such row. A row of the place (a herm taking a carry bundle) runs at the floor with no key, so it keeps its way.
  if (daemonUp && KEY_VERBS.has(verb)) {
    const refusal = standingRefusal(standing ?? await vesselStanding());
    if (refusal !== null) throw refusal;
  }
  // THE FACE RESOLVES ONCE, here: the session opens on it and the row carries it, so the row never resolves again.
  const named = STORE_DOOR_FACE_VERBS.has(verb) ? storeVerbFace(args) : undefined;
  const face = daemonUp && STORE_DOOR_FACE_VERBS.has(verb)
    ? named ?? (await sealedAct<{ face: number }>("face.resolve", storeVerbRidesWorn(verb, args) ? { worn: true } : {})).face
    : undefined;
  // A WARD ACT names a one-use ref for the route a person typed at this terminal, bound to the act as the row will read it (the
  // face included); the route itself rides no verb argument. An act a co-sign gate holds runs first with no route: the route gets
  // asked only where the row's signer names `ward-needs-fresh-unlock`, and the row runs once more under its ticket.
  const sent = face !== undefined && named === undefined ? { ...args, face } : args;
  const gatesFirst = storeVerbGatesFirst(verb);
  const run = (ward: Record<string, unknown>) => throughStoreDoor({ verb, args: { ...sent, ...ward }, daemonUp, ...(face !== undefined ? { face } : {}),
    direct: () => storeDoorDirect(verb, { ...args, ...ward }, { sealHome: larSealHome() }) });
  // A gated row names its want of a route either way it refuses: as a row's `refused` answer, or as the routed verb's error (a
  // panel-owned row, the kāpae lower, answers through the panel's handler, whose refusal rides the session's error).
  const needsRoute = (text: unknown): boolean => typeof text === "string" && /^ward-needs-fresh-unlock\b/.test(text);
  let r: Awaited<ReturnType<typeof run>> | null = null;
  if (!gatesFirst) r = await run(await wardTicketFor(verb, sent, daemonUp, wardRoute));
  else {
    try { r = await run({}); }
    catch (e) { if (!(e instanceof RoutedVerbRefused) || !needsRoute(e.message)) throw e; }
    if (r === null || needsRoute(r.output["refused"])) r = await run(await wardTicketFor(verb, sent, daemonUp, wardRoute));
  }
  if (typeof r.output["refused"] === "string") {
    const refusal = new Refusal(r.output["refused"]);
    if (typeof r.output["refusal"] === "string") REFUSAL_NAMES.set(refusal, r.output["refusal"]);
    throw refusal;
  }
  const { verb: _echo, ...output } = r.output;
  return { output, via: r.via };
}

/**
 * What a `pokeSealHomeRefold` call reports, one word per outcome:
 *   `"done"`    — the hook claimed this write's refold landed;
 *   `"pending"` — a vessel stood and the row ran, and the refold still runs past its own budget
 *                 (`store-door-verbs.ts`'s `awaitOnRolled`);
 *   `"failed"`  — a vessel stood and its refold ran without landing, or the poke itself drew no answer. The write
 *                 already landed beside the seal home; the vessel's live readings may stand stale until its next
 *                 refold or boot;
 *   `"none"`    — nothing to refold: no vessel stands, or the row ran where no live reading stands.
 * The caller carries the word into its JSON.
 */
export type SealHomeRefold = "done" | "pending" | "failed" | "none";

/**
 * Poke a STANDING vessel to refold right after a write that landed beside the seal home rather than through
 * this door (`accept-carriage`'s consent, `carry-for`'s carrier seal, a carried `seal import`'s grown set) —
 * H2. Those writes touch no Repo, so they earn no door row of their own; but a standing vessel's live
 * readings (`readCarried`, the board/antigen folds its dial presents against) refold only on the SAME hook
 * every door-row write already fires, so this names the one no-op row that fires it. With no vessel standing
 * there is nothing to refold — the next boot reads the fresh bytes on its own, so this is skipped entirely
 * rather than opening a direct `ownedStore` act for nothing.
 */
export async function pokeSealHomeRefold(): Promise<SealHomeRefold> {
  if (!(await udsAlive())) return "none";
  try {
    const r = await storeVerb("seal-home-refold", {});
    const refolded = r.output["refolded"];
    if (refolded === true) return "done";
    if (refolded === "pending") return "pending";
    // The row tried the vessel's hook and the hook claimed nothing: the refold ran and did not land.
    return r.output["attempted"] === true ? "failed" : "none";
  } catch { return "failed"; }             // the write itself already landed; nothing says the refold ran
}
