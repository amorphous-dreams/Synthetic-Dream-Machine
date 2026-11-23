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
 * THE RESTART COUNT, NEVER A CLOCK. The house bounds a restart storm by a consecutive COUNT, cleared by a clean run or by a
 * hand act (the island pool's mount-failure count, `vessel-island-pool-core`; Iris/aho's pacing resets on a standing
 * child). A process forgets its memory at exit, so the count rests beside the life id, at `<storageDir>/.engine-falls`,
 * one row per fall. A fall that finds `ENGINE_RESTART_CAP` falls already resting from earlier lives stays down: it flushes
 * and names the hand act, and does not exit, so `unless-stopped` has nothing to restart (Docker restarts on exit, never on
 * an unhealthy answer). A clean stop clears the rows; so does a hand's stop of a vessel that stays down (a signal reaching a
 * fallen engine reads as the hand having seen the named state).
 *
 * WHAT STOPS A CRASH LOOP, NAMED. The count does: past it the vessel stays down at 503 and the container stays up. The boot
 * probe helps where it can: each document a fall named in flight (`EngineFall.inFlight`) goes through the disposable
 * child probe before the live Repo touches it, and a condemned one moves aside into quarantine (`quarantineDoc`, never a
 * delete). THE RESIDUAL: the probe loads one document from disk in a fresh process; a trap that an inbound sync wave raised
 * in a document that loads clean from disk passes the probe, and only the count stops a second fall of that kind.
 *
 * Every fall in a suite comes injected; nothing here runs out of wasm memory.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isCondemned, isUnresolved, type ProbeResult } from "@lararium/mesh";
import { atomicWriteFileSync } from "./fs-atomic.js";
import type { EngineFall } from "./engine-watch.js";
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
  try { restEngineFall(ports.storageDir, fall, ports.life); }
  catch (err) { ports.log(`engine fall: the fall did not rest at ${engineFallsPath(ports.storageDir)} (${err instanceof Error ? err.message : String(err)}); the next boot reads no count for it`); }
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
  if (earlier.length >= ENGINE_RESTART_CAP) {
    ports.log(`engine fall: ${earlier.length} earlier fall(s) rest uncleared (the count holds ${ENGINE_RESTART_CAP}); the vessel stays down. Hand act: ${ENGINE_DOWN_HAND_ACT}`);
    return { verdict: "stays-down", hand: ENGINE_DOWN_HAND_ACT, flush };
  }
  ports.log(`engine fall: exiting ${ENGINE_FALL_EXIT} so the supervisor raises a fresh engine once; a second fall before a clean stop keeps the vessel down`);
  ports.exit(ENGINE_FALL_EXIT);
  return { verdict: "rise-once", exit: ENGINE_FALL_EXIT, flush };
}

/** What the boot's hold-back reaches: the disposable probe and the quarantine that moves a condemned document aside. */
export interface HoldBackPorts {
  readonly probe: (documentId: string) => Promise<ProbeResult>;
  readonly quarantine: (verdict: ProbeResult) => string | null;
  readonly log: (line: string) => void;
}

/** What the hold-back did with one document a fall named. */
export interface HeldBack { readonly documentId: string; readonly status: ProbeResult["status"]; readonly movedTo: string | null; readonly held: boolean }

/**
 * THE BOOT'S HOLD-BACK: each document a resting fall named in flight goes through the disposable child probe before the
 * live Repo touches it. A condemned one moves aside (never deleted) and its plane mounts degraded; one that loads clean
 * names the residual (a trap a sync wave raised passes a load probe), and the count stands guard behind it.
 */
export async function holdBackFallenDocs(falls: readonly RestingFall[], ports: HoldBackPorts): Promise<HeldBack[]> {
  const named = [...new Set(falls.map((f) => f.inFlight).filter((d): d is string => d !== null))];
  const held: HeldBack[] = [];
  for (const documentId of named) {
    let verdict: ProbeResult;
    try { verdict = await ports.probe(documentId); }
    catch (err) { verdict = { documentId, status: "unresolved", reason: err instanceof Error ? err.message : String(err) }; }
    if (isCondemned(verdict)) {
      const movedTo = ports.quarantine(verdict);
      ports.log(`engine fall: held back ${documentId}, the document in flight at the last fall (${verdict.status}: ${verdict.reason ?? "?"}) → ${movedTo ?? "already gone"}`);
      held.push({ documentId, status: verdict.status, movedTo, held: true });
    } else {
      ports.log(isUnresolved(verdict)
        ? `engine fall: the probe reached no verdict on ${documentId}, the document in flight at the last fall (${verdict.reason ?? "?"}); it loads, and the restart count stands guard`
        : `engine fall: ${documentId}, the document in flight at the last fall, loads clean in the probe; a trap its sync raised can rise again, and the restart count stands guard`);
      held.push({ documentId, status: verdict.status, movedTo: null, held: false });
    }
  }
  return held;
}
