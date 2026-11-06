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
 *   (each only while it still names the lift's own), the face's drop runs once, and the floor stands on as it stood.
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
  readonly sessionSign: SessionSignDoor;
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
 * `sessionSign`, refusing `lift-stands` while another lift stands on the record; the dispose (the lock) takes back only
 * what this lift seated and runs its drop once.
 */
export function islandLiftStack(vessel: LarVessel, lift: IslandLift): CapModule[] {
  const held = seats.get(vessel);
  let seated = false;
  let locked = false;
  const module: CapModule<IslandLift> = {
    id: ISLAND_LIFT_CAP,
    build: () => {
      if (!held) throw new Error("no-island-record: a lift composes only over a record islandFloorStack composed");
      const standing = held.seat.lift;
      if (standing !== null) throw new Error(`lift-stands: face ${standing.face} stands lifted on this record; lock it before ${lift.face} lifts`);
      held.seat.lift = lift;
      if (lift.custodyWrite) held.record.custodyWrite = lift.custodyWrite;
      held.record.sessionSign = lift.sessionSign;
      seated = true;
      return lift;
    },
    dispose: () => {
      if (!held || !seated || locked) return;
      locked = true;
      if (lift.custodyWrite && held.record.custodyWrite === lift.custodyWrite) delete held.record.custodyWrite;
      if (held.record.sessionSign === lift.sessionSign) delete held.record.sessionSign;
      if (held.seat.lift === lift) held.seat.lift = null;
      lift.drop();
    },
  };
  return [module as CapModule];
}
