/**
 * floor-restand — THE HOUSE RESTANDS ITSELF to mount an adopted floor, once the hand applied the adopt (its one act, its approval).
 *
 * The pūlama holds the vessel's custody outside the vessel, so a raise wakes lit with no hand: the vessel may restand when it reads
 * pono. This lane decides WHEN, by events alone (an attacker owns every clock, so no timer decides here):
 *
 *   arm     the adopt landed (`mount.restand`, `@lararium/mesh` floor-pin): the lane holds the staged floor's manifest
 *   poke    an event that may open a quiet point: the verb door turned idle (its last call settled), or the sealed rest
 *           told a document rested; each poke reads the quiet point afresh
 *   quiet   no door call in flight, no promote or kapae act standing, no save the sealed rest holds unsealed, and every
 *           shore's flush whole (a flush that leaves records unwritten waits for the hand's `lares shore`); the door reads
 *           idle again after the flush, so a call that began during it holds the restand
 *   restand the vessel's own graceful stand-down (the composition's teardown: the sealed rest stands down first, then the
 *           shore's flush, #585), then a clean exit the supervisor raises again
 *
 * The lane fires once per life, and never after the composition stands down by another road (`disarm`: a signal's stop, a
 * recomposition's teardown), so a drain that turns the door idle mid-stop never asks a second stop. A reading that names a reason logs it once per distinct reason and waits for the next event;
 * nothing retries on a clock. The boot after settles the staged floor by its par (`settleFloorAtBoot`): `settleFloorAtBootLines`
 * speaks that settle.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import { settleFloorAtBoot, type FloorBootMount, type FloorBootSettle, type FloorPinHome } from "@lararium/mesh/floor-pin";

/** The parts of the quiet point, each read fresh at every poke. */
export interface FloorQuietParts {
  /** True while no verb-door call or session act stands in flight. */
  readonly doorIdle:     () => boolean;
  /** The promote and kapae acts standing now. */
  readonly actsStanding: () => number;
  /** The saves the sealed rest holds in memory, unsealed. */
  readonly heldSaves:    () => number;
  /** Ask every shore to flush; `whole` false where a record stays unwritten. Null reads as no shore standing. */
  readonly flushShores:  () => Promise<{ readonly whole: boolean } | null>;
}

/** The quiet point's reading: null where the vessel stands quiet, else the first reason it does not, by name. Never throws. */
export async function readFloorQuiet(p: FloorQuietParts): Promise<string | null> {
  try {
    if (!p.doorIdle()) return "a door call flies";
    const acts = p.actsStanding();
    if (acts > 0) return `${acts} promote or kapae act(s) stand`;
    const held = p.heldSaves();
    if (held > 0) return `the sealed rest holds ${held} save(s) unsealed`;
    const flush = await p.flushShores();
    if (flush !== null && !flush.whole) return "the shore's flush left records unwritten (`lares shore` reads them)";
    // A call that began while the shores flushed holds the restand: the door reads idle again before anything moves.
    if (!p.doorIdle()) return "a door call flies";
    return null;
  } catch (error) {
    return `the quiet reading faulted: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export interface FloorRestandPorts {
  readonly quiet:   () => Promise<string | null>;
  /** The graceful restand: the stand-down, then the exit the supervisor raises again. Called once. */
  readonly restand: (why: string) => void;
  readonly log:     (line: string) => void;
}

export interface FloorRestandLane {
  /** The adopt landed: hold its staged manifest and read the quiet point now. */
  arm(manifest: string): void;
  /** An event that may open a quiet point: read it afresh where the lane stands armed. */
  poke(): void;
  /** The composition stands down (a signal, a recomposition): the lane lets its arm go and never fires after. */
  disarm(): void;
  /** The manifest the lane holds, and whether the restand fired. */
  standing(): { readonly armed: string | null; readonly fired: boolean };
}

export function floorRestandLane(ports: FloorRestandPorts): FloorRestandLane {
  let armed: string | null = null;
  let fired = false;
  let reading = false;
  let again = false;
  let said: string | null = null;
  const read = async (): Promise<void> => {
    reading = true;
    try {
      do {
        again = false;
        const why = await ports.quiet();
        if (armed === null || fired) return;
        if (why === null) {
          fired = true;
          const reason = `the adopted floor ${armed.slice(0, 12)}… mounts at this quiet point`;
          ports.log(`floor restand: ${reason}; the vessel stands down gracefully and its supervisor raises it again`);
          ports.restand(reason);
          return;
        }
        if (why !== said) { said = why; ports.log(`floor restand waits: ${why}`); }
      } while (again);
    } finally { reading = false; }
  };
  const poke = (): void => {
    if (armed === null || fired) return;
    if (reading) { again = true; return; }
    void read();
  };
  return {
    arm(manifest) {
      if (fired) return;
      armed = manifest;
      said = null;
      poke();
    },
    poke,
    disarm() { armed = null; fired = true; },
    standing: () => ({ armed, fired }),
  };
}

/** The boot settles a staged floor by its par and speaks it; a settle that faults names the fault and lands nothing. */
export function settleFloorAtBootLines(home: FloorPinHome, mount: FloorBootMount): { readonly settle: FloorBootSettle | null; readonly lines: readonly string[] } {
  let settle: FloorBootSettle;
  try { settle = settleFloorAtBoot(home, mount); }
  catch (error) { return { settle: null, lines: [`floor settle: unread (${error instanceof Error ? error.message : String(error)}); a staged floor waits for the hand's \`lares vessel floor adopt --commit\` or \`--revert\``] }; }
  switch (settle.act) {
    case "none": return { settle, lines: [] };
    case "committed": return { settle, lines: [`floor settle: committed local floor ${settle.receipt.floor} at par (seed ${settle.receipt.seed})`] };
    case "reverted": return { settle, lines: [`floor settle: reverted local floor ${settle.receipt.floor} to ${settle.receipt.pinned}: ${settle.cause}; the staged floor's bytes stay in the CAS for the hand to read (\`lares vessel floor status\`)`] };
    case "held": return { settle, lines: [`floor settle: held (${settle.why})`] };
  }
}
