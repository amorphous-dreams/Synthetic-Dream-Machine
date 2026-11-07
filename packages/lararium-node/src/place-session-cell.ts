/**
 * place-session-cell — the worn face's PLACE SESSION, held for one node composition.
 *
 * A session reads (face, anchor), and the anchor reads a Nexus or the place (session-contract#/the-hands). A vessel that
 * dials nothing still wears its face at its own place: while that face stands lit and proved, its place session stands
 * seated, so a change written with no call in flight books it and its save seals (sealed-store#/owed, V6).
 *
 * THE LAW (session-sign-book): a lock, a close or a switch drops a session's signer. So:
 *   · a stand that wears another face, or none, drops the session before it and closes that session's table;
 *   · the stand-down (the client dial's, which a lock's teardown runs) drops the session, closes its table and leaves no
 *     place scope, so the vessel's own chain names no place;
 *   · a mint still in flight when a newer stand or the stand-down overtook it seats nothing: its signer drops and its
 *     table closes the moment it settles.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import type { BookedSession, OwnPlace } from "@lararium/mesh";

/** The worn face a place session stands for: its PersonaGroup and its atom. */
export interface PlaceWorn { readonly group: string; readonly atomKey: string }

/** One minted place session: the session the book seats, the place its chain names, and its table's close. */
export interface PlaceSessionMinted {
  readonly session: BookedSession;
  readonly scope: OwnPlace;
  readonly close: () => void;
}

/** Mint the worn face's place session, or name why none stands. */
export type PlaceSessionMint = (worn: PlaceWorn) => Promise<PlaceSessionMinted | { readonly refusal: string }>;

export interface PlaceSessionCell {
  /** Stand the worn face's place session (null: the face left, or stands unproved). A re-stand of the same face keeps it. */
  stand(worn: PlaceWorn | null): Promise<void>;
  /** The stand-down: drop the session, close its table, and seat nothing more. */
  standDown(): void;
  session(): BookedSession | null;
  scope(): OwnPlace | null;
}

const dropOf = (m: PlaceSessionMinted): void => {
  try { (m.session.signer as { drop?: () => void }).drop?.(); } finally { m.close(); }
};

/** `moved` hears each stand that settled (the seat reseats the standing session); never after the stand-down. */
export function placeSessionCell(mint: PlaceSessionMint, moved: () => void): PlaceSessionCell {
  let held: PlaceSessionMinted | null = null;
  let worn: string | null = null;
  let stoodDown = false;
  let turn = 0;
  const release = (): void => {
    const was = held;
    held = null;
    worn = null;
    if (was !== null) dropOf(was);
  };
  return {
    async stand(next) {
      if (stoodDown) return;
      // A re-open that wears the same face keeps the session standing: the saves it booked still sign under it.
      const key = next === null ? null : `${next.group}|${next.atomKey}`;
      if (key !== null && key === worn && held !== null && !held.session.signer.dropped) return;
      release();
      const mine = ++turn;
      if (next !== null) {
        const out = await mint(next);
        // A stand-down or a newer stand overtook this mint: what it minted drops, and nothing seats.
        if (stoodDown || mine !== turn) {
          if ("session" in out) dropOf(out);
          return;
        }
        if ("session" in out) { held = out; worn = key; }
        else console.log(`[sealed-rest] the place session stands not (${out.refusal}): the face's saves wait in memory, never clear`);
      }
      moved();
    },
    standDown() {
      stoodDown = true;
      turn++;
      release();
    },
    session: () => held?.session ?? null,
    scope: () => held?.scope ?? null,
  };
}
