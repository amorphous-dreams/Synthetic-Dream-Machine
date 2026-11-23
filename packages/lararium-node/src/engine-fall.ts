/**
 * engine-fall — what the vessel does once its Automerge engine has fallen: flush what it can, then exit once, so the
 * supervisor raises a fresh process with a fresh engine; and what the next boot reads of that fall.
 *
 * WHY EXIT. One isolate shares one wasm engine (`engine-watch`), and nothing in-process re-instantiates it: only a fresh
 * process brings a fresh engine. So a fallen vessel finishes naming the fall (health answers 503, every verb refuses
 * `engine-terminated`, the log line), asks every island that mounts a disk shore to flush (`flushEveryShore`), and exits
 * `ENGINE_FALL_EXIT`. The compose service's `restart: unless-stopped` raises it; the pūlama still holds the key and the worn
 * face, so the new life re-wears with no re-unlock; the receipt ledger's `life` field settles each fact the fallen life left
 * `committed` as `interrupted`, since the new claim mints a new life (`vessel-life`).
 *
 * THE RESTART COUNT, NEVER A CLOCK. The house bounds a restart storm by a COUNT, cleared by a run that proved itself or by
 * a hand act (the island pool's mount-failure count, `vessel-island-pool-core`; Iris/aho's pacing resets on a standing
 * child). A process forgets its memory at exit, so the count rests beside the life id, at `<storageDir>/.engine-falls`,
 * one row per fall. A fall that finds `ENGINE_RESTART_CAP` falls already resting from earlier lives stays down: it flushes
 * and names the hand act, and does not exit, so `unless-stopped` has nothing to restart (Docker restarts on exit, never on
 * an unhealthy answer). A fall whose row cannot rest (a full or refusing disk) stays down too, so no count it cannot keep
 * feeds a loop. Three acts clear the rows: the risen vessel standing ready and staying up through its first full settle
 * (`clearOnceSettled`), so a vessel that ran healthy for weeks gets its one rise again; a clean stop; and a hand's stop of
 * a fallen vessel (a signal reaching a fallen engine reads as the hand having seen the named state, which grants one more
 * rise, bounded by the count again).
 *
 * WHAT STOPS A CRASH LOOP, NAMED. The count does: past it the vessel stays down at 503 and the container stays up. The boot
 * probe helps where it can: each document a resting fall named in flight (`EngineFall.inFlight`) reads condemned at the
 * composition's own social mount (`fallAwareProbeDoors`), so the clean-tail recovery runs, and where it cuts nothing the
 * whole-document quarantine moves the bytes aside (never a delete) and a read-only stand-in mounts degraded. THE RESIDUALS:
 * a trap whose document never reached a mount the probe guards passes it, and only the count stops a second fall of that
 * kind; and a trap that strikes after the first full settle clears the count first, so such a vessel rises once per settled
 * life, one restart each.
 *
 * Every fall in a suite comes injected; nothing here runs out of wasm memory.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type DocLoadProbe, type ProbeResult } from "@lararium/mesh";
import { atomicWriteFileSync } from "./fs-atomic.js";
import type { EngineFall, EngineWatch } from "./engine-watch.js";
import { shoreFlushLines, type ShoreFlushReading } from "./shore-verb.js";

/** The exit a fallen engine's vessel takes: sysexits' EX_SOFTWARE (an internal fault), apart from 0, 1, 2, 75 and 76. */
export const ENGINE_FALL_EXIT = 70;

/** How many consecutive engine falls may each raise one restart before the vessel stays down (the house's count idiom). */
export const ENGINE_RESTART_CAP = 1;

/** The hand act a vessel that stays down names. */
export const ENGINE_DOWN_HAND_ACT =
  "the vessel already rose once from an engine fall and fell again, so it stays down: preserve the hearth (copy it aside), "
  + "then repair or restore from a keep bundle; stopping the vessel by hand clears the count, and the next stand may rise once more";

const FALLS_FILE = ".engine-falls";

/** One fall at rest: the life it ended, its cause, path and time, and the document in flight where the watch knew it. */
export interface RestingFall {
  readonly life: string | null;
  readonly cause: string;
  readonly path: string;
  readonly since: string;
  readonly inFlight: string | null;
}

/** The falls file's path in a vessel's storage dir. */
export function engineFallsPath(storageDir: string): string {
  return join(storageDir, FALLS_FILE);
}

const isRestingFall = (v: unknown): v is RestingFall => {
  const r = v as Record<string, unknown> | null;
  return r !== null && typeof r === "object" && typeof r["cause"] === "string" && typeof r["path"] === "string"
    && typeof r["since"] === "string" && (r["life"] === null || typeof r["life"] === "string")
    && (r["inFlight"] === null || typeof r["inFlight"] === "string");
};

/** The falls resting in a storage dir, oldest first; none where the file stands absent. A torn file reads as one fall of
 *  unknown cause, so a torn count never reads as a clean run. */
export function readEngineFalls(storageDir: string): RestingFall[] {
  let raw: string;
  try { raw = readFileSync(engineFallsPath(storageDir), "utf8"); } catch { return []; }
  try {
    const parsed = JSON.parse(raw) as { falls?: unknown };
    if (Array.isArray(parsed.falls) && parsed.falls.every(isRestingFall)) return parsed.falls;
  } catch { /* torn: read below */ }
  return [{ life: null, cause: "unknown", path: "unknown", since: "unknown", inFlight: null }];
}

/** Rest one more fall (atomic: a reader never sees a torn file). Answers every fall now resting. */
export function restEngineFall(storageDir: string, fall: EngineFall, life: string | null): RestingFall[] {
  const falls = [...readEngineFalls(storageDir), { life, cause: fall.cause, path: fall.path, since: fall.since, inFlight: fall.inFlight }];
  atomicWriteFileSync(engineFallsPath(storageDir), `${JSON.stringify({ falls }, null, 2)}\n`);
  return falls;
}

/** Clear the count: a clean stop, or a hand's stop of a vessel that stays down. */
export function clearEngineFalls(storageDir: string): void {
  rmSync(engineFallsPath(storageDir), { force: true });
}

/** What the vessel did with one fall. */
export type FallAnswer =
  | { readonly verdict: "rise-once"; readonly exit: typeof ENGINE_FALL_EXIT; readonly flush: ShoreFlushReading | null }
  | { readonly verdict: "stays-down"; readonly hand: string; readonly flush: ShoreFlushReading | null };

/** What answering a fall reaches: the storage dir's count, this life's id, the flush, the exit and the log. */
export interface FallPorts {
  readonly storageDir: string;
  /** The life this process holds (`readVesselLife`), or null where none reads. */
  readonly life: string | null;
  /** Ask every island that mounts a disk shore to flush; null where no composition stands to ask. */
  readonly flush: () => Promise<ShoreFlushReading | null>;
  readonly exit: (code: number) => void;
  readonly log: (line: string) => void;
}

/**
 * ANSWER ONE FALL: rest it, flush what the islands hold, then exit once, or stay down where the count already holds
 * `ENGINE_RESTART_CAP` earlier falls. A flush that throws names itself and never holds the exit back.
 */
export async function answerEngineFall(fall: EngineFall, ports: FallPorts): Promise<FallAnswer> {
  const earlier = readEngineFalls(ports.storageDir).filter((f) => f.life === null || f.life !== ports.life);
  let rested = true;
  try { restEngineFall(ports.storageDir, fall, ports.life); }
  catch (err) {
    rested = false;
    ports.log(`engine fall: the fall did not rest at ${engineFallsPath(ports.storageDir)} (${err instanceof Error ? err.message : String(err)}); a count that cannot rest raises no restart`);
  }
  const inFlight = fall.inFlight !== null ? `; the document in flight: ${fall.inFlight}` : "; no document named in flight";
  ports.log(`engine fall: ${fall.cause} on the ${fall.path} path (${fall.detail})${inFlight}; health answers 503 and every verb refuses \`engine-terminated\``);
  let flush: ShoreFlushReading | null = null;
  try {
    flush = await ports.flush();
    if (flush === null) ports.log("engine fall: no composition stands to flush");
    else for (const line of shoreFlushLines(flush)) ports.log(`engine fall: ${line}`);
  } catch (err) {
    ports.log(`engine fall: the flush threw: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!rested || earlier.length >= ENGINE_RESTART_CAP) {
    ports.log(rested
      ? `engine fall: ${earlier.length} earlier fall(s) rest uncleared (the count holds ${ENGINE_RESTART_CAP}); the vessel stays down. Hand act: ${ENGINE_DOWN_HAND_ACT}`
      : `engine fall: the vessel stays down. Hand act: free the storage dir so the fall can rest, then ${ENGINE_DOWN_HAND_ACT}`);
    return { verdict: "stays-down", hand: ENGINE_DOWN_HAND_ACT, flush };
  }
  ports.log(`engine fall: exiting ${ENGINE_FALL_EXIT} so the supervisor raises a fresh engine once; a second fall before a clean stop keeps the vessel down`);
  ports.exit(ENGINE_FALL_EXIT);
  return { verdict: "rise-once", exit: ENGINE_FALL_EXIT, flush };
}

/** The keel's three probe doors (`VesselKeel`): the probe, the clean-tail recovery (L3) and the quarantine (L2). */
export interface ProbeDoors {
  readonly docLoadProbe: DocLoadProbe;
  readonly recoverCleanTail: (verdict: ProbeResult) => Promise<ProbeResult | null>;
  readonly quarantineDoc: (verdict: ProbeResult) => void;
}

/** Why a held-back document reads condemned. */
export const HELD_IN_FLIGHT = "held back: the document in flight at the last engine fall";

/**
 * THE KEEL'S PROBE DOORS, AWARE OF THE RESTING FALLS. Each document a resting fall named in flight reads condemned
 * (`aborted`, the trap's own class) before the child loads it, so the composition's social mount runs its own path: the
 * clean-tail recovery first, then, where that recovery cuts no torn tail (it moved nothing aside, so it held nothing back),
 * the whole-document quarantine and the read-only stand-in, degraded. Every other document reads through the doors unchanged.
 * Nothing moves before the composition stands: a store emptied ahead of it reads "fresh, not a tear" and mounts writable.
 */
export function fallAwareProbeDoors(falls: readonly RestingFall[], doors: {
  readonly probe: DocLoadProbe;
  readonly recoverCleanTail: (verdict: ProbeResult) => Promise<ProbeResult | null>;
  readonly quarantineDoc: (verdict: ProbeResult) => void;
}): ProbeDoors {
  const held = new Set(falls.map((f) => f.inFlight).filter((d): d is string => d !== null));
  return {
    docLoadProbe: {
      probe: (documentId, options) => held.has(documentId)
        ? Promise.resolve({ documentId, status: "aborted", reason: HELD_IN_FLIGHT })
        : doors.probe.probe(documentId, options),
    },
    recoverCleanTail: async (verdict) => {
      const recovered = await doors.recoverCleanTail(verdict);
      if (held.has(verdict.documentId) && recovered?.status === "ok" && (recovered.cleanTail?.movedAside.length ?? 0) === 0) return null;
      return recovered;
    },
    quarantineDoc: (verdict) => doors.quarantineDoc(verdict),
  };
}

/** What clearing the count after a settle reads: the storage dir, the engine, the ready word and the first full settle. */
export interface SettleClearPorts {
  readonly storageDir: string;
  readonly engine: Pick<EngineWatch, "fallen">;
  /** Resolves once the vessel stands ready (`markReadyOnceStanding`). */
  readonly ready: Promise<unknown>;
  /** The first full settle: true where every island drained its shore and the Repo flushed. */
  readonly settle: () => Promise<boolean>;
  readonly log: (line: string) => void;
}

/**
 * CLEAR THE COUNT ONCE THE RISEN VESSEL PROVES ITSELF: it stands ready, then stays up through its first full settle with
 * its engine standing. A settle that throws, leaves a shore unwritten, or meets a fall keeps the count. Answers whether it
 * cleared.
 */
export async function clearOnceSettled(ports: SettleClearPorts): Promise<boolean> {
  try {
    await ports.ready;
    const whole = await ports.settle();
    if (!whole || ports.engine.fallen() !== null) return false;
    clearEngineFalls(ports.storageDir);
    ports.log("engine fall: the risen vessel stands and settled whole; the restart count clears");
    return true;
  } catch (err) {
    ports.log(`engine fall: the first settle did not finish (${err instanceof Error ? err.message : String(err)}); the restart count holds`);
    return false;
  }
}
