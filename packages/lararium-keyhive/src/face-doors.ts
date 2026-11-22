/**
 * face-doors — ONE INTENT DOOR PER LIT FACE, keyed by its bare atom, on the daemon island.
 *
 * Each face that stands lit here (the mounted face, and each sibling lit beside it whose proven planes mounted) stands its own
 * door over its own plane. A face's light heeds its door (`turn`); its door answers only while it stands (`open`, the door's
 * turn); its close waits out the votum in flight and then detaches the door (`drop`), so nothing answers past its lit life.
 * No door spans two faces, and no queue does.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-intent-plane#/the-vow
 */

/** What the lot needs of a door: a pass on demand, and its attach (whose return detaches it). */
export interface FaceDoorHandle {
  heed(): Promise<void>;
  attach(): () => void;
}

export interface FaceDoors {
  /**
   * Stand a face's door: the lot holds the face open first, so the door's attach heeds on a standing turn. A door already
   * standing for the face drops first. `release` runs once at the face's drop, after the votum in flight landed and the door
   * detached: it evicts what the door opened for this face.
   */
  stand(key: string, make: () => FaceDoorHandle, release?: () => void): Promise<void>;
  /** Whether the face's door stands and its face has not begun to close: the door's turn reads it. */
  open(key: string): boolean;
  /** The face's lit turn: its door heeds, or the log names once that it stands no door. */
  turn(key: string): void;
  /** The face closes: its door answers nothing more, the votum in flight lands, and the door detaches. */
  drop(key: string): Promise<void>;
  /** Every face whose door stands. */
  keys(): string[];
}

export function faceDoors(log: (line: string) => void): FaceDoors {
  type Held = { door: FaceDoorHandle | null; detach: (() => void) | null; closing: boolean; release: (() => void) | null };
  const doors = new Map<string, Held>();
  const said = new Set<string>();
  const drop = async (key: string): Promise<void> => {
    const held = doors.get(key);
    said.delete(key);
    if (!held) return;
    held.closing = true;
    // A pass in flight finishes its votum and admits no next (its turn reads closed); a fresh pass answers nothing.
    try { await held.door?.heed(); } finally {
      held.detach?.();
      if (doors.get(key) === held) doors.delete(key);
      const release = held.release;
      held.release = null;
      try { release?.(); } catch (error) { log(`face ${key.slice(0, 12)}…'s door released with a fault: ${String(error)}`); }
    }
  };
  return {
    async stand(key, make, release) {
      if (doors.has(key)) await drop(key);
      const held: Held = { door: null, detach: null, closing: false, release: release ?? null };
      doors.set(key, held);
      held.door = make();
      held.detach = held.door.attach();
    },
    open: (key) => { const held = doors.get(key); return held !== undefined && !held.closing; },
    turn(key) {
      const held = doors.get(key);
      if (held && !held.closing) { void held.door?.heed(); return; }
      if (said.has(key)) return;
      said.add(key);
      log(`face ${key.slice(0, 12)}… lit; it stands no intent door (no proven plane pair mounted for it)`);
    },
    drop,
    keys: () => [...doors.keys()].sort(),
  };
}
