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
 * THE RESTART COUNT, NEVER A CLOCK. The house bounds a restart storm by a COUNT (the island pool's mount-failure count,
 * `vessel-island-pool-core`). A process forgets its memory at exit, so the count rests beside the life id, at
 * `<storageDir>/.engine-falls`, one row per fall. A fall that finds `ENGINE_RESTART_CAP` falls already resting from earlier
 * lives stays down: it flushes and names the hand act, and does not exit, so `unless-stopped` has nothing to restart (Docker
 * restarts on exit, never on an unhealthy answer). A fall whose row cannot rest (a full or refusing disk) stays down too, so
 * no count it cannot keep feeds a loop.
 *
 * THE HOLD RIDES THE COUNT. The held set derives from the resting falls (`heldInFlight`), so whatever clears the count frees
 * every hold with it: the next stand mounts each document a fall named in flight writable, and a document that brings the
 * engine down again falls once more, rises once, and stands held on that rise. The hand acts name the house's own commands
 * (`lares vessel read`, which reads the falls from the files with the engine down; `lares vessel stop`; `lares vessel stand`).
 *
 * ONLY TWO ACTS CLEAR THE COUNT: a clean stop (exit 0), and the hand's act (a signal reaching a fallen engine reads as the
 * hand having seen the named state, which grants one more rise, bounded by the count again). No run clears it by itself: a
 * trap outside the probe's guard (a peer's resync after any settle) would otherwise loop (fall, exit, boot, settle, clear,
 * fall), and Docker's backoff resets after ten seconds up, so that loop would never slow. So a vessel that ran healthy for
 * weeks stays down on its next fall and names the hand act. That fails safe, by design. While a held or degraded document
 * stands, nothing clears the count but those same two acts.
 *
 * WHAT THE BOOT DOES WITH THE DOCUMENT IN FLIGHT. Each document a resting fall named in flight (`EngineFall.inFlight`) runs
 * the REAL probe at the composition's own social mount (`fallAwareProbeDoors`). A torn one takes the existing path: the
 * clean-tail recovery, then the whole-document quarantine and the degraded stand-in. One that loads clean stands HELD: it
 * reads as the probe's `unresolved` class, so the mount takes its `pending` branch, read-only, no bytes moved and no writable
 * stand-in, and the vessel names it and the hand act that releases it (`HELD_HAND_ACT`). Under an OOM the document in flight
 * usually stands innocent, so no sound document's bytes ever move. The probe reaches the social mounts alone, so the boot
 * also holds every such document back from the engine on EVERY load path (`holdBackStorage`): the Repo's own storage
 * answers none of its chunks, and its plane stands read-only over its own id (`heldBackReason`, read by `waitHandle`).
 *
 * STAY DOWN MEANS STAY DOWN (`keepFallDown`): from the fall on, a later throw from the dead module ends nothing; only the
 * fall's own answer exits, once.
 *
 * Every fall in a suite comes injected; nothing here runs out of wasm memory.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isCondemned, type DocLoadProbe, type ProbeResult } from "@lararium/mesh/doc-load-probe-contract";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { engineFatalCauseOf, type EngineFall, type EngineWatch } from "./engine-watch.js";
import type { StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo/slim";
import { shoreFlushLines, type ShoreFlushReading } from "./shore-verb.js";

/** The exit a fallen engine's vessel takes: sysexits' EX_SOFTWARE (an internal fault), apart from 0, 1, 2, 75 and 76. */
export const ENGINE_FALL_EXIT = 70;

/** How many consecutive engine falls may each raise one restart before the vessel stays down (the house's count idiom). */
export const ENGINE_RESTART_CAP = 1;

/** The hand act a vessel that stays down names. */
export const ENGINE_DOWN_HAND_ACT =
  "the vessel already rose once from an engine fall and fell again, so it stays down: health answers 503 (after a fall during boot "
  + "no verb reaches it). `lares vessel read` reads the resting falls and every held id from the files beside the store, with no "
  + "verb; `lares vessel stop` stops it by hand (the stop clears the count, and with it the hold on each document a fall named in "
  + "flight, and exits 0); preserve the hearth (copy it aside); `lares vessel read vessel` probes every document, and "
  + "`lares vessel lay --apply --yes` lays a torn one again from its disk holding; then `lares vessel stand`: the vessel may rise "
  + "once more, and each document a fall named in flight mounts writable. A hearth past repair restores from its keep onto a "
  + "brand-new house, the damaged one kept aside and never reset: walk founding runbook 11a "
  + "(lar:///ha.ka.ba/lararium/mesh/founding-runbook#/carry-across-refound) whole, its lay and census steps with it; on the new "
  + "house it opens with `LARES_HOUSE=<new root> lares found --hearth --name <pet> --chair <chair>`, binds the keep by "
  + "`lares up --workspace house-backup=<keep checkout>`, and imports each worn face by "
  + "`lares import /lar/workspaces/house-backup/house --apply`";

const FALLS_FILE = ".engine-falls";

/** One fall at rest: the life it ended, its cause, path and time, the document in flight where the watch knew it, and the
 *  process that fell (`pid`, null where unknown), so a hand act can tell a husk that still stands from a fall long past. */
export interface RestingFall {
  readonly life: string | null;
  readonly pid: number | null;
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
    && (r["inFlight"] === null || typeof r["inFlight"] === "string")
    // A row rested before falls named their pid carries no `pid` key: it reads whole, its pid null, so the hold it names
    // stands across the upgrade. A pid of any other kind reads the file torn.
    && (r["pid"] === undefined || r["pid"] === null || (typeof r["pid"] === "number" && Number.isSafeInteger(r["pid"]) && r["pid"] > 0));
};

/** The falls resting in a storage dir, oldest first; none where the file stands absent. A torn file reads as one fall of
 *  unknown cause, so a torn count never reads as a clean run. */
export function readEngineFalls(storageDir: string): RestingFall[] {
  let raw: string;
  try { raw = readFileSync(engineFallsPath(storageDir), "utf8"); } catch { return []; }
  try {
    const parsed = JSON.parse(raw) as { falls?: unknown };
    if (Array.isArray(parsed.falls) && parsed.falls.every(isRestingFall)) return parsed.falls.map((f) => ({ ...f, pid: f.pid ?? null }));
  } catch { /* torn: read below */ }
  return [{ life: null, pid: null, cause: "unknown", path: "unknown", since: "unknown", inFlight: null }];
}

/** Rest one more fall (atomic: a reader never sees a torn file), naming the process that fell. Answers every fall now resting. */
export function restEngineFall(storageDir: string, fall: EngineFall, life: string | null, pid: number = process.pid): RestingFall[] {
  const falls = [...readEngineFalls(storageDir), { life, pid, cause: fall.cause, path: fall.path, since: fall.since, inFlight: fall.inFlight }];
  // THE CAP RIDES WITH THE COUNT: a reader outside this process (the MCP seat's `step_in.py`, the shim's host read) learns
  // whether the count already keeps the vessel down from the file itself, and this constant stays its one owner.
  atomicWriteFileSync(engineFallsPath(storageDir), `${JSON.stringify({ cap: ENGINE_RESTART_CAP, falls }, null, 2)}\n`);
  return falls;
}

/** Clear the count: a clean stop, or a hand's stop of a vessel that stays down. */
export function clearEngineFalls(storageDir: string): void {
  rmSync(engineFallsPath(storageDir), { force: true });
}

/** Whether a process lives: signal 0 asks the kernel and delivers nothing; EPERM names a process that lives under another uid. */
const processLives = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; }
  catch (err) { return (err as NodeJS.ErrnoException).code === "EPERM"; }
};

/**
 * THE FALLEN HOLDER. A fall during boot closes the verb socket and frees the store's claimed name, yet the husk process
 * stays up (it serves 503 and holds the named state), so the claim alone reads the store free beside it. The newest
 * resting fall whose process still lives, other than this one, answers that husk; null where none lives. A pid the
 * kernel reused after the fall reads as living too: the refusal names the pid, so a hand can check it.
 */
export function fallenHolder(storageDir: string, lives: (pid: number) => boolean = processLives): RestingFall | null {
  const falls = readEngineFalls(storageDir);
  for (let i = falls.length - 1; i >= 0; i--) {
    const f = falls[i]!;
    if (f.pid !== null && f.pid !== process.pid && lives(f.pid)) return f;
  }
  return null;
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
  readonly quarantineDoc: (verdict: ProbeResult, bagId: string) => void;
}

/** Why a held document stands pending. */
export const HELD_IN_FLIGHT = "held: the document in flight at the last engine fall loads clean, so it stands read-only, its bytes in place";

/** The hand act that releases a held document. */
export const HELD_HAND_ACT = "the plane reads empty, read-only, while its bytes rest in place; stop the vessel by hand with `lares vessel stop` (a clean stop (exit 0) clears the restart count and the hold; an errored or killed stop keeps both), then `lares vessel stand`: the document mounts writable";

/**
 * THE KEEL'S PROBE DOORS, AWARE OF THE RESTING FALLS. Each document a resting fall named in flight runs the REAL probe. A
 * condemned verdict passes through unchanged, so the social mount runs its own path (the clean-tail recovery, then the
 * quarantine and the degraded stand-in). Any other verdict comes back as the probe's `unresolved` class, named held, so the
 * mount takes its `pending` branch: read-only, no bytes moved, no writable stand-in. Every other document, and the recovery
 * and quarantine doors, read through unchanged. Nothing moves before the composition stands.
 */
export function fallAwareProbeDoors(falls: readonly RestingFall[], doors: {
  readonly probe: DocLoadProbe;
  readonly recoverCleanTail: (verdict: ProbeResult) => Promise<ProbeResult | null>;
  readonly quarantineDoc: (verdict: ProbeResult, bagId: string) => void;
}): ProbeDoors {
  const held = new Set(heldInFlight(falls));
  return {
    docLoadProbe: {
      probe: async (documentId, options) => {
        const verdict = await doors.probe.probe(documentId, options);
        if (!held.has(documentId) || isCondemned(verdict)) return verdict;
        return { documentId, status: "unresolved", reason: `${HELD_IN_FLIGHT}; hand act: ${HELD_HAND_ACT}` };
      },
    },
    recoverCleanTail: (verdict) => doors.recoverCleanTail(verdict),
    quarantineDoc: (verdict, bagId) => doors.quarantineDoc(verdict, bagId),
  };
}

/** The documents the resting falls name in flight: each one a boot holds where it loads clean. */
export function heldInFlight(falls: readonly RestingFall[]): string[] {
  return [...new Set(falls.map((f) => f.inFlight).filter((d): d is string => d !== null))];
}

/**
 * STAY DOWN MEANS STAY DOWN. Once the engine falls, the fall's answer alone owns the process's end: it exits
 * `ENGINE_FALL_EXIT` once, or it stays down. A dead wasm module keeps throwing after that (`Module terminated` from every
 * later call: the storage source's attach reads `getHeads`, a timer fires, a peer's sync arrives), and a throw no handler
 * catches would end the process anyway, so `unless-stopped` raises again the vessel that decided to stay down: measured on
 * a live house, a restart every few seconds. So the keeper stands on the process's own two events (`armFallKeeper`): from
 * the fall on it absorbs every uncaught throw and rejection, names each distinct one once, and holds the process up once
 * it stays down (`hold`), so health keeps answering 503 and every verb keeps refusing `engine-terminated`. A dead engine's
 * throw that reaches the keeper before anything else names the fall. Before any fall an uncaught throw ends the process
 * with 1, as Node's own default does. The process after a fall reads as a husk by design: it serves the named state and
 * runs nothing else. A fall during boot leaves a thinner husk: the boot's own fault path has closed the verb socket, so
 * health answers 503 over HTTP and no verb reaches it at all.
 *
 * THE HAND'S STOP REACHES A FALLEN VESSEL FROM THE FIRST MOMENT. The keeper arms the stop signals beside the throws, before
 * any composition stands (`armFallKeeper`): a SIGINT or SIGTERM that reaches a fallen engine reads as the hand having seen
 * the named state, so it clears the restart count and exits 0. Before a fall the signal passes to whatever answers it then.
 *
 * ONLY A DEAD ENGINE'S OWN SIGNATURES name a fall from an uncaught throw: `Module terminated` and the wasm trap. wasm-bindgen's
 * "recursive use … unsafe aliasing" reports a JS re-entrancy fault with the engine still standing, so met uncaught before
 * any fall it ends the process with 1, as any ordinary fault does.
 */
export interface FallKeeper {
  /** Null while the engine stands, `answering` while the fall's answer runs, then that answer's verdict. */
  verdict(): FallAnswer["verdict"] | "answering" | null;
  /** An uncaught throw or unhandled rejection: absorbed from the fall on, else the process ends with 1. */
  uncaught(error: unknown): void;
  /** The boot's own rejection: true where the engine has fallen, so the fall's answer owns the end, never the boot's fault path. */
  absorbs(error: unknown): boolean;
  /** A stop signal: true where the engine has fallen (the count clears and the process exits 0); false passes it on. */
  handStop(signal: string): boolean;
}

/** What the keeper reaches: the fall's ports (the life read at the fall, when the store claim has minted it) and the hold. */
export interface FallKeeperPorts extends Omit<FallPorts, "life"> {
  readonly life: () => string | null;
  /** Keep the process up once it stays down: an emptied event loop would end it too, and the supervisor would raise it. */
  readonly hold: () => void;
}

/** A throw as text, or "<unprintable>" where even printing it throws. */
const printed = (error: unknown, stack: boolean): string => {
  try { return error instanceof Error ? (stack ? (error.stack ?? error.message) : `${error.name}: ${error.message}`) : String(error); }
  catch { return "<unprintable>"; }
};
const firstLine = (error: unknown): string => printed(error, false).split("\n")[0]!;
/** The uncaught throws that name a fall: the dead engine's own two signatures, never the re-entrancy fault. */
const namesFall = (error: unknown): boolean => { const cause = engineFatalCauseOf(error); return cause === "module-terminated" || cause === "wasm-unreachable"; };

/** THE FALL'S KEEPER: answers the fall once (one exit at most, never beside an exit 1), and absorbs what the dead engine throws after it. */
export function keepFallDown(watch: EngineWatch, ports: FallKeeperPorts): FallKeeper {
  let verdict: FallAnswer["verdict"] | "answering" | null = null;
  let exited = false;
  const exitOnce = (code: number): void => { if (exited) return; exited = true; ports.exit(code); };
  const absorbed = new Set<string>();
  const absorb = (error: unknown, what: string): void => {
    const line = firstLine(error);
    if (absorbed.has(line)) return;
    absorbed.add(line);
    ports.log(`engine fall: ${what} absorbed (${line}); ${verdict === "stays-down"
      ? "the vessel stays down: health answers 503 and every verb it still serves refuses `engine-terminated`"
      : "the fall's answer alone decides the exit"}`);
  };
  watch.onFall((fall) => {
    if (verdict !== null) return;
    verdict = "answering";
    const stayDown = (): void => { verdict = "stays-down"; ports.hold(); };
    void answerEngineFall(fall, { ...ports, life: ports.life(), exit: exitOnce }).then(
      (answer) => { if (answer.verdict === "stays-down") stayDown(); else verdict = answer.verdict; },
      (err) => { ports.log(`engine fall: the answer threw (${firstLine(err)}); the vessel stays down`); stayDown(); },
    );
  });
  return {
    verdict: () => verdict,
    uncaught: (error) => {
      if (namesFall(error)) watch.note(error, "repo");
      if (watch.fallen() !== null) { absorb(error, "a throw after the fall"); return; }
      ports.log(`uncaught: ${printed(error, true)}`);
      exitOnce(1);
    },
    handStop: (signal) => {
      if (watch.fallen() === null) return false;
      try { clearEngineFalls(ports.storageDir); }
      catch (err) { ports.log(`engine fall: the count did not clear (${firstLine(err)})`); }
      ports.log(`engine fall: ${signal} reached the fallen engine: the hand's stop clears the count; exiting 0`);
      exitOnce(0);
      return true;
    },
    absorbs: (error) => {
      if (namesFall(error)) watch.note(error, "repo");
      if (watch.fallen() === null) return false;
      absorb(error, "the boot's rejection after the fall");
      return true;
    },
  };
}

/** Arm the keeper on the process's own events (one listener each): the uncaught throw, the unhandled rejection, and the two
 *  stop signals, which pass to `otherwise` where no fall stands. */
export function armFallKeeper(
  keeper: FallKeeper,
  proc: { on(event: string, listener: (...args: unknown[]) => void): unknown },
  otherwise: (signal: "SIGINT" | "SIGTERM") => void,
): void {
  proc.on("uncaughtException", (error) => keeper.uncaught(error));
  proc.on("unhandledRejection", (error) => keeper.uncaught(error));
  for (const signal of ["SIGINT", "SIGTERM"] as const) proc.on(signal, () => { if (!keeper.handStop(signal)) otherwise(signal); });
}

/** Why a held-back document stands read-only. */
export const HELD_BACK = "held: a resting engine fall names this document in flight, so the Repo's storage hands the engine none of its chunks; its plane stands read-only and empty, its bytes in place";

/**
 * THE TRAP-NAMED DOCUMENT HOLDS ON EVERY LOAD PATH. The probe's hold (`fallAwareProbeDoors`) reaches the social planes only;
 * a catalog bag's document loads through the Repo's storage source, from whichever caller asks (a corpus, a wiki island's
 * sync request, the residency wiring). So the boot wraps the Repo's innermost storage: for each document a resting fall
 * names in flight, a load answers nothing and a range lists none of its chunks, so the Repo reads it unavailable and never
 * hands its bytes to the engine; a save or removal of it lands nothing, so its bytes rest exactly as they lay. Every other
 * key reads through unchanged. The hand's clear of the count (a clean stop, or a stop of a fallen vessel) releases it at
 * the next boot. With no fall resting, the inner adapter stands unwrapped.
 */
export function holdBackStorage<S extends StorageAdapterInterface>(inner: S, held: readonly string[], log: (line: string) => void): StorageAdapterInterface {
  if (held.length === 0) return inner;
  const holds = new Set(held);
  const named = new Set<string>();
  const isHeld = (key: StorageKey): boolean => {
    const documentId = key[0];
    if (documentId === undefined || !holds.has(documentId)) return false;
    if (!named.has(documentId)) {
      named.add(documentId);
      log(`engine fall: ${documentId} held back from the engine (${HELD_BACK}); hand act: ${HELD_HAND_ACT}`);
    }
    return true;
  };
  return {
    load: async (key) => (isHeld(key) ? undefined : inner.load(key)),
    loadRange: async (prefix) => {
      if (isHeld(prefix)) return [];
      return (await inner.loadRange(prefix)).filter((chunk) => !isHeld(chunk.key));
    },
    save: async (key, data) => { if (!isHeld(key)) await inner.save(key, data); },
    remove: async (key) => { if (!isHeld(key)) await inner.remove(key); },
    removeRange: async (prefix) => { if (!isHeld(prefix)) await inner.removeRange(prefix); },
    ...(inner.close ? { close: () => inner.close!() } : {}),
  };
}

/** The seated door's answer for a held-back document (`SealedRestDoor.heldBack`): why it stands read-only, or null. */
export function heldBackReason(held: readonly string[]): (documentId: string) => string | null {
  const holds = new Set(held);
  return (documentId) => (holds.has(documentId) ? `${HELD_BACK}; hand act: ${HELD_HAND_ACT}` : null);
}
