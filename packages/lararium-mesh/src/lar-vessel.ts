/**
 * lar-vessel — THE ONE RECORD a vessel composes for its islands, through the one composer (`composeVessel`, cap-compose).
 *
 * A vessel hands every island it constructs ONE capability record (`CapabilityRecord`). The node and the browser compose
 * it alike, as two stacks over the same composer:
 *
 *   THE FLOOR (`islandFloorStack`): the members a vessel stands with no face lifted ~ `receipt`, `cas`, `dyad` where the
 *   vessel reads a fleet board, the document store door and the sealed-rest reading. A floor carries no `custodyWrite`
 *   and no `sessionSign`, so an island's `session:sign` ask answers `signer-unavailable` by name, as a herm's does.
 *   THE LIFT (`islandLiftStack`): one face's `custodyWrite` and `sessionSign`, composed as a nested stack over the floor's
 *   record (the nesting `composeVerbPlane` already rides). Its `dispose` IS the lock: both lift members leave the record
 *   (each only while it still names the lift's own), the face's drop runs once, and the floor stands on as it stood. Each
 *   member the lift seats carries its fence: once the lift locks, a call an island held across a face switch refuses
 *   `lift-locked` and never reaches the next face's custody or signer (row B8).
 *   One lift stands per record at a time: a second lift while one stands refuses `lift-stands`.
 *
 * `larVesselOf` reads a composed floor as ONE `LarVessel`: the record its islands read, and roles as predicates over it
 * (`stands(member)`, `liftedFace()`), never a platform label. Only the lift stack seats or takes back a lift member; the
 * read face carries no setter.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slices 5a, 5b) · lar:///ha.ka.ba/lararium/api/composable-keel
 */
import type { CapModule, ComposedVessel } from "./cap-compose.js";
import type { CapabilityRecord, CustodyWriter, SessionSignDoor } from "./capability-record.js";

/** The cap-id the floor stack composes its record under. */
export const ISLAND_RECORD_CAP = "island-record";
/** The cap-id one lift composes under, nested over a floor's record. */
export const ISLAND_LIFT_CAP = "island-lift";

/** What a vessel's floor hands its record: every member a vessel stands with no face lifted. */
export type IslandFloor = Pick<CapabilityRecord, "receipt" | "cas" | "dyad" | "docStore" | "restsSealed">;

/** One face's lift: the members it seats, and the drop its lock runs once (the session's signer, the face's own hold). */
export interface IslandLift {
  /** The face this lift stands for: the record answers it from `liftedFace()` while the lift stands. */
  readonly face: string;
  readonly custodyWrite?: CustodyWriter | undefined;
  /** Absent on a lift that signs nothing (a sovereign herm carries its face's custody and signs no session). */
  readonly sessionSign?: SessionSignDoor | undefined;
  readonly drop: () => void;
}

/** The one record a vessel's islands read, with roles as predicates over it. */
export interface LarVessel {
  /** The record every island this vessel constructs reads at ask time. */
  readonly record: Readonly<CapabilityRecord>;
  /** Whether the record carries this member now. */
  stands(member: keyof CapabilityRecord): boolean;
  /** The face whose lift stands on this record now, or null at the floor. */
  liftedFace(): string | null;
}

/** The seat a lift takes on one record: held module-private, so only the lift stack seats or takes back. */
interface LiftSeat { lift: IslandLift | null }
const seats = new WeakMap<LarVessel, { record: CapabilityRecord; seat: LiftSeat }>();

const FLOOR_MEMBERS = ["receipt", "cas", "dyad", "docStore", "restsSealed"] as const;

/** Compose a vessel's floor: one cap that builds the record its islands read, carrying the floor's members alone. */
export function islandFloorStack(floor: IslandFloor): CapModule[] {
  const module: CapModule<LarVessel> = {
    id: ISLAND_RECORD_CAP,
    build: () => {
      const record: CapabilityRecord = {};
      for (const member of FLOOR_MEMBERS) {
        const value = floor[member];
        if (value !== undefined) (record as Record<string, unknown>)[member] = value;
      }
      const seat: LiftSeat = { lift: null };
      const vessel: LarVessel = {
        record,
        stands: (member) => record[member] !== undefined,
        liftedFace: () => seat.lift?.face ?? null,
      };
      seats.set(vessel, { record, seat });
      return vessel;
    },
    // The floor's own stand-down: each floor member leaves the record while it still names the floor's own.
    // A second run takes nothing.
    dispose: (vessel) => {
      const held = seats.get(vessel);
      if (!held) return;
      for (const member of FLOOR_MEMBERS) {
        if (floor[member] !== undefined && held.record[member] === floor[member]) delete held.record[member];
      }
    },
  };
  return [module as CapModule];
}

/** Read a composed floor as its one `LarVessel`. A composition that carries no island record refuses by name. */
export function larVesselOf(composed: ComposedVessel): LarVessel {
  const vessel = composed.get<LarVessel>(ISLAND_RECORD_CAP);
  if (!vessel || !seats.has(vessel)) throw new Error(`no-island-record: the composition carries no "${ISLAND_RECORD_CAP}" cap (compose it from islandFloorStack)`);
  return vessel;
}

/**
 * Compose one face's lift over a floor's record. The build seats `custodyWrite` (where the lift carries one) and
 * `sessionSign` (each where the lift carries one), refusing `lift-stands` while another lift stands on the record; the dispose (the lock) takes back only
 * what this lift seated and runs its drop once.
 */
export function islandLiftStack(vessel: LarVessel, lift: IslandLift): CapModule[] {
  const held = seats.get(vessel);
  let seated = false;
  let locked = false;
  // THE FENCE (row B8): an island's ask reads its member off the record at ask time and may hold it across an await, and a
  // face switch locks this lift and composes the next face's over the same record. So each member this lift seats refuses
  // `lift-locked` once the lift locks: a held call never enters the host (whose writer may resolve the worn face at call
  // time), and a sign that settles after the lock hands back no signature of a session the lock ended.
  const custodyWrite: CustodyWriter | undefined = lift.custodyWrite
    ? async (carrier, bytes) => {
      if (locked) throw new Error(`lift-locked: face ${lift.face}'s lift locked; its custody write lands nowhere`);
      await lift.custodyWrite!(carrier, bytes);
    }
    : undefined;
  const sessionSign: SessionSignDoor | undefined = lift.sessionSign
    ? async (ask) => {
      if (locked) return { refusal: "lift-locked" };
      const answer = await lift.sessionSign!(ask);
      return locked ? { refusal: "lift-locked" } : answer;
    }
    : undefined;
  const module: CapModule<IslandLift> = {
    id: ISLAND_LIFT_CAP,
    build: () => {
      if (!held) throw new Error("no-island-record: a lift composes only over a record islandFloorStack composed");
      const standing = held.seat.lift;
      if (standing !== null) throw new Error(`lift-stands: face ${standing.face} stands lifted on this record; lock it before ${lift.face} lifts`);
      held.seat.lift = lift;
      if (custodyWrite) held.record.custodyWrite = custodyWrite;
      if (sessionSign) held.record.sessionSign = sessionSign;
      seated = true;
      return lift;
    },
    dispose: () => {
      if (!held || !seated || locked) return;
      locked = true;
      if (custodyWrite && held.record.custodyWrite === custodyWrite) delete held.record.custodyWrite;
      if (sessionSign && held.record.sessionSign === sessionSign) delete held.record.sessionSign;
      if (held.seat.lift === lift) held.seat.lift = null;
      lift.drop();
    },
  };
  return [module as CapModule];
}
