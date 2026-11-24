/**
 * face-doors — ONE INTENT DOOR PER LIT FACE, keyed by its bare atom, on the daemon island.
 *
 * Each face that stands lit here (the mounted face, and each sibling lit beside it whose proven planes mounted) stands its own
 * door over its own plane. A face's light heeds its door (`turn`); its door answers only while it stands (`open`, the door's
 * turn); its close waits out the votum in flight and then detaches the door (`drop`), so nothing answers past its lit life.
 * No door spans two faces, and no queue does.
 *
 * WHAT A DOOR OPENED LEAVES WITH IT, and only that: each door names the documents it opened for its face (`opened`) and how they
 * leave the cache (`evict`). Its drop evicts them once the votum in flight landed and the door detached; a re-stand (a repeat
 * light of a lit face) evicts only what the new door does not hold; a stand that refuses after opening evicts what it opened,
 * except what the standing door still holds (`evictUnheld`).
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-intent-plane#/the-vow
 */

/** What the lot needs of a door: a pass on demand, and its attach (whose return detaches it). */
export interface FaceDoorHandle {
  heed(): Promise<void>;
  attach(): () => void;
}

/** The documents a door opened for its face, and how they leave the cache at its drop. */
export interface FaceDoorOwns {
  readonly opened: readonly string[];
  readonly evict: (ids: readonly string[]) => void;
}

export interface FaceDoors {
  /**
   * Stand a face's door: the lot holds the face open first, so the door's attach heeds on a standing turn. A door already
   * standing for the face drops first, evicting only what the new door does not hold.
   */
  stand(key: string, make: () => FaceDoorHandle, owns?: FaceDoorOwns): Promise<void>;
  /** Whether the face's door stands and its face has not begun to close: the door's turn reads it. */
  open(key: string): boolean;
  /** The face's lit pass: its door heeds, or the log names once that it stands no door. */
  turn(key: string): void;
  /** The face closes: its door answers nothing more, the votum in flight lands, the door detaches, and what it opened leaves. */
  drop(key: string): Promise<void>;
  /** A stand that refused after opening: evict what it opened, except what the face's standing door still holds. */
  evictUnheld(key: string, ids: readonly string[], evict: (ids: readonly string[]) => void): void;
  /** Every face whose door stands. */
  keys(): string[];
}

export function faceDoors(log: (line: string) => void): FaceDoors {
  type Held = { door: FaceDoorHandle | null; detach: (() => void) | null; closing: boolean; owns: FaceDoorOwns | null };
  const doors = new Map<string, Held>();
  const said = new Set<string>();
  const drop = async (key: string, keep: readonly string[] = []): Promise<void> => {
    const held = doors.get(key);
    said.delete(key);
    if (!held) return;
    held.closing = true;
    // A pass in flight finishes its votum and admits no next (its turn reads closed); a fresh pass answers nothing.
    try { await held.door?.heed(); } finally {
      held.detach?.();
      if (doors.get(key) === held) doors.delete(key);
      const owns = held.owns;
      held.owns = null;
      const leaving = (owns?.opened ?? []).filter((id) => !keep.includes(id));
      if (owns && leaving.length > 0) {
        try { owns.evict(leaving); } catch (error) { log(`face ${key.slice(0, 12)}…'s door evicted with a fault: ${String(error)}`); }
      }
    }
  };
  return {
    async stand(key, make, owns) {
      if (doors.has(key)) await drop(key, owns?.opened ?? []);
      const held: Held = { door: null, detach: null, closing: false, owns: owns ?? null };
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
    drop: (key) => drop(key),
    evictUnheld(key, ids, evict) {
      const kept = doors.get(key)?.owns?.opened ?? [];
      const leaving = ids.filter((id) => !kept.includes(id));
      if (leaving.length > 0) evict(leaving);
    },
    keys: () => [...doors.keys()].sort(),
  };
}
