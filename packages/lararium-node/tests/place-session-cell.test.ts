/**
 * place-session-cell — THE WORN FACE'S PLACE SESSION DROPS AT THE STAND-DOWN, AND A MINT THE STAND-DOWN OVERTOOK SEATS NOTHING.
 *
 * A session reads (face, anchor), and a vessel that dials nothing still wears its face at its own place: while that face
 * stands lit and proved, its place session stands seated (sealed-store#/owed, V6). The book's law (session-sign-book):
 * a lock, a close or a switch drops a session's signer. A lock recomposes the vessel through its teardown, and the
 * client dial's stand-down drops the place session there: its signer drops, its session table closes, and the vessel's
 * own chain names no place. A mint still in flight when the stand-down ran (it reads the place and the face's atom across
 * awaits) settles into nothing: its signer drops and its table closes, and nothing seats.
 *
 *   C0  CONTROL: a worn face's place session stands; its signer signs; the seat hears the move.
 *   C1  RED: the stand-down drops the standing signer, closes its table, and leaves no session and no place scope.
 *   C2  RED: a mint that settles after the stand-down seats nothing: its signer drops and its table closes.
 *   C3  RED: a mint a newer stand overtook seats nothing; the newer face's session stands.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import { placeSessionCell, type PlaceSessionMinted } from "../src/place-session-cell.js";

interface Minted extends PlaceSessionMinted { readonly closed: () => boolean; readonly dropped: () => boolean }

function minted(tag: string): Minted {
  let dropped = false, closed = false;
  const signer = {
    get dropped() { return dropped; },
    drop() { dropped = true; },
    certificate: { tag },
    async sign() { return dropped ? { refusal: "signer-dropped" } : { signature: `sig-${tag}` }; },
  };
  return {
    session: { signer, anchor: { kind: "place" }, subject: `subject-${tag}` },
    scope: { atomKey: `atom-${tag}`, place: "place-one" },
    close: () => { closed = true; },
    closed: () => closed, dropped: () => dropped,
  };
}
/** A mint that settles when the test says so. */
function heldMint(): { mint: () => Promise<PlaceSessionMinted>; settle: (m: Minted) => void } {
  let settle!: (m: Minted) => void;
  const pending = new Promise<Minted>((resolve) => { settle = resolve; });
  return { mint: () => pending, settle };
}
const WORN = { group: "G-A", atomKey: "atom-a" };

describe("the place session drops at the stand-down", () => {
  test("C0 CONTROL: the worn face's place session stands and signs; the seat hears it", async () => {
    const m = minted("a");
    let moved = 0;
    const cell = placeSessionCell(async () => m, () => { moved++; });
    await cell.stand(WORN);
    expect(cell.session()).toBe(m.session);
    expect(cell.scope()).toEqual(m.scope);
    expect(await cell.session()!.signer.sign("act", new Uint8Array([1]))).toEqual({ signature: "sig-a" });
    expect(moved).toBe(1);
  });

  test("C1 RED: the stand-down drops the signer, closes its table, and leaves no session and no place", async () => {
    const m = minted("a");
    const cell = placeSessionCell(async () => m, () => {});
    await cell.stand(WORN);
    cell.standDown();
    expect(m.dropped(), "the signer drops").toBe(true);
    expect(m.closed(), "its session table closes").toBe(true);
    expect(cell.session()).toBeNull();
    expect(cell.scope(), "the vessel's own chain names no place").toBeNull();
  });

  test("C2 RED: a mint that settles after the stand-down seats nothing", async () => {
    const held = heldMint();
    let moved = 0;
    const cell = placeSessionCell(held.mint, () => { moved++; });
    const standing = cell.stand(WORN);
    cell.standDown();
    const late = minted("late");
    held.settle(late);
    await standing;
    expect(cell.session(), "nothing seats").toBeNull();
    expect(cell.scope()).toBeNull();
    expect(late.dropped(), "the late signer drops").toBe(true);
    expect(late.closed(), "the late table closes").toBe(true);
    await cell.stand(WORN);
    expect(cell.session(), "a stand after the stand-down mints nothing").toBeNull();
    expect(moved, "no seat hears a move after the stand-down").toBe(0);
  });

  test("C3 RED: a mint a newer stand overtook seats nothing; the newer face's session stands", async () => {
    const first = heldMint();
    const second = minted("b");
    let calls = 0;
    const cell = placeSessionCell(() => (calls++ === 0 ? first.mint() : Promise.resolve(second)), () => {});
    const older = cell.stand(WORN);
    await cell.stand({ group: "G-B", atomKey: "atom-b" });
    const overtaken = minted("a");
    first.settle(overtaken);
    await older;
    expect(cell.session()).toBe(second.session);
    expect(overtaken.dropped()).toBe(true);
    expect(overtaken.closed()).toBe(true);
  });
});
