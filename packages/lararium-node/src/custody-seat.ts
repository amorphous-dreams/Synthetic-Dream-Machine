/**
 * custody-seat — THE SEAT a vessel's custody holder sits in, and the row door every sealed carrier's own module
 * reads and writes through.
 *
 * ── ONE HOLDER PER IDENTITY HOME ────────────────────────────────────────────────────────────────
 * A standing vessel seats the holder its custody door unlocks and locks. A command that acts with no vessel
 * standing seats its own holder for its own act. A carrier's module (`identity-anchors` and its siblings) never
 * builds a holder and never takes a key: it names a row by home and file and asks this seat.
 *
 * A seat belongs to the identity home its holder spans, and a row resolves to the seat of the home the vessel's
 * own resolvers name at that moment (`larIdentityDir`), the same resolver the row's path comes from. So a process
 * that holds one home for its life holds one seat, and one that walks several roots in turn reaches each root's own
 * holder and never another's key.
 *
 * ── THE SEAT OPENS ONCE, WHEN A ROW FIRST NEEDS IT ──────────────────────────────────────────────
 * A seat may carry an OPENER: the act that gathers a human route and unlocks the holder. It runs at the first row
 * that needs the key and never again for that seat, so a command that touches no sealed row asks nobody anything.
 * A standing vessel seats no opener: its key arrives on the custody door alone, and a row asked for at the floor
 * refuses `CustodyLocked`.
 *
 * ── A ROW READS WHOLE OR REFUSES ────────────────────────────────────────────────────────────────
 *   `readCustodyRow`   the row's plaintext; `null` when nothing stands at its path, and for that reading alone.
 *                      Locked refuses `CustodyLocked`. A row that stands and does not open (torn, bare, an
 *                      earlier shape, another key's) refuses `CustodyRowUnavailable` naming what stands.
 *   `writeCustodyRow`  the one sealed writer, under the key the seat holds.
 *   `updateCustodyRow` a read, a decision and a write under ONE custody holder, for a row whose next bytes depend
 *                      on its standing ones. The decision receives the row's plaintext (`null` when nothing stands)
 *                      and every other reading refuses before it runs, so it decides over the row itself or not at all.
 *   `removeCustodyRow` a removal under ONE custody holder, of a row the seat's key opens; any other standing row
 *                      refuses and stays.
 *   `openColdCustodyRow` / `updateColdCustodyRow`  the same two doors for a COLD row: its plaintext lives for one
 *                      act and zero-fills when the act settles.
 *   `exclusiveCustody` one act under the custody claim while the key stands open, for a FLOOR row whose mint must
 *                      land once (the vessel key and its inception). It opens no row.
 * No reader folds a refusal to empty, so no caller mints over a row it could not read.
 *
 * Node-main only: a worker never imports this module.
 */
import { GATE_FLOOR_BUNDLE_INFO, custodyRootDoor, type CustodyRootDoor } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable, type CustodyHolder, type RowUpdate } from "./custody-holder.js";
import { CustodyRootRefused } from "./custody-root.js";
import type { CustodyHome } from "./vault-carriers.js";
import { larIdentityDir } from "./vessel-paths.js";

/** Gathers a human route and unlocks the seated holder. Throws when it cannot (no terminal, no route that opens). */
export type CustodyOpener = (holder: CustodyHolder) => Promise<void>;

interface Seat { readonly holder: CustodyHolder; readonly open: CustodyOpener | null; opening: Promise<void> | null }

const seats = new Map<string, Seat>();
let whenNeeded: { readonly make: () => CustodyHolder; readonly open: CustodyOpener | null } | null = null;

/**
 * Seat `holder` for the identity home it spans; `open` runs once, at the first row that needs the key. `null`
 * clears every seat and the when-needed maker.
 */
export function seatCustody(holder: CustodyHolder | null, open: CustodyOpener | null = null): void {
  if (holder === null) { seats.clear(); whenNeeded = null; return; }
  seats.set(holder.homes.identity, { holder, open, opening: null });
}

/** Clear `holder`'s own seat, when it still sits there. */
export function unseatCustody(holder: CustodyHolder): void {
  if (seats.get(holder.homes.identity)?.holder === holder) seats.delete(holder.homes.identity);
}

/**
 * Name the holder this process builds only when a row first needs one: `make` runs then, so it reads the homes as
 * they stand at that moment (a command names its root after it starts). `open` runs once, at that same first row.
 */
export function seatCustodyWhenNeeded(make: () => CustodyHolder, open: CustodyOpener | null = null): void {
  whenNeeded = { make, open };
}

function seatOfThisHome(): Seat | null {
  const home = larIdentityDir();
  const seat = seats.get(home);
  if (seat) return seat;
  if (!whenNeeded) return null;
  const holder = whenNeeded.make();
  const made: Seat = { holder, open: whenNeeded.open, opening: null };
  seats.set(holder.homes.identity, made);
  return holder.homes.identity === home ? made : null;
}

/** The holder seated for the identity home the vessel's resolvers name now, or null. */
export function seatedCustody(): CustodyHolder | null {
  return seatOfThisHome()?.holder ?? null;
}

/** The holder that already sits for this home, or null. Opens nothing and builds nothing. */
export function standingCustody(): CustodyHolder | null {
  return seats.get(larIdentityDir())?.holder ?? null;
}

/** Whether a holder sits for this home and holds its key right now. Opens nothing and builds nothing. */
export function custodyHeld(): boolean {
  return seats.get(larIdentityDir())?.holder.isUnlocked() === true;
}

/** This home's holder, holding its key: the opener runs when the holder stands locked and the seat carries one. */
export async function openedCustody(): Promise<CustodyHolder> {
  const seat = seatOfThisHome();
  if (!seat) throw new CustodyLocked();
  if (!seat.holder.isUnlocked() && seat.open) {
    const open = seat.open;
    await (seat.opening ??= open(seat.holder).finally(() => { seat.opening = null; }));
  }
  if (!seat.holder.isUnlocked()) throw new CustodyLocked();
  return seat.holder;
}

/** One sealed row's plaintext, or `null` when nothing stands there. Every other reading refuses by name. */
export async function readCustodyRow(home: CustodyHome, file: string): Promise<Uint8Array | null> {
  const r = await (await openedCustody()).readRow(home, file);
  if (r.reading === "opens") return r.plaintext;
  if (r.reading === "absent") return null;
  if (r.reading === "locked") throw new CustodyLocked();
  throw new CustodyRowUnavailable(home, file, r.why);
}

/** Seal `plaintext` as one row, through the one sealed writer, under the key the seat holds. */
export async function writeCustodyRow(home: CustodyHome, file: string, plaintext: Uint8Array): Promise<void> {
  await (await openedCustody()).writeRow(home, file, plaintext);
}

/**
 * Read one sealed row, decide, and write it, as one custody holder. `decide` receives the row's plaintext, or `null`
 * when nothing stands there, and answers its next plaintext (`null` writes nothing) beside the caller's answer.
 */
export async function updateCustodyRow<T>(
  home: CustodyHome, file: string, decide: (plaintext: Uint8Array | null) => RowUpdate<T>,
): Promise<T> {
  return (await openedCustody()).updateRow(home, file, (r) => {
    if (r.reading === "opens") return decide(r.plaintext);
    if (r.reading === "absent") return decide(null);
    if (r.reading === "locked") throw new CustodyLocked();
    throw new CustodyRowUnavailable(home, file, r.why);
  });
}

/**
 * Remove one sealed row, as one custody holder; answers whether a row stood. Locked refuses `CustodyLocked`; a row
 * that stands and does not open under the seat's key refuses `CustodyRowUnavailable` and stays, so a removal never
 * destroys bytes this vessel's key did not seal. `when`, where given, reads the standing plaintext under the same
 * hold: a row it declines stays, and the removal answers false.
 */
export async function removeCustodyRow(home: CustodyHome, file: string, when?: (plaintext: Uint8Array) => boolean): Promise<boolean> {
  return (await openedCustody()).removeRow(home, file, when);
}

/**
 * Remove one COLD row, as one custody holder; answers whether a row stood. Locked refuses `CustodyLocked`; a row
 * that stands and does not open under the seat's key refuses `CustodyRowUnavailable` and stays. `when`, where
 * given, reads the standing plaintext under the same hold: a row it declines stays, and the removal answers false.
 */
export async function removeColdCustodyRow(home: CustodyHome, file: string, when?: (plaintext: Uint8Array) => boolean): Promise<boolean> {
  return (await openedCustody()).removeColdRow(home, file, when);
}

/**
 * Open one COLD row for one act. `act` receives the row's plaintext, which zero-fills when the act settles, so the
 * act copies out what it keeps. A row with nothing at its path refuses `CustodyRowUnavailable` reading `absent`,
 * as every reading but a whole one does: a cold row holds a secret some act already counted on.
 */
export async function openColdCustodyRow<T>(
  home: CustodyHome, file: string, act: (plaintext: Uint8Array) => Promise<T> | T,
): Promise<T> {
  return (await openedCustody()).openColdRow(home, file, act);
}

/**
 * Read one COLD row, decide, and write it, as one custody holder. `decide` receives the row's plaintext, or `null`
 * when nothing stands there, and answers its next plaintext (`null` writes nothing) beside the caller's answer.
 * The plaintext handed in zero-fills once `decide` returns. A row that stands and does not open refuses by name
 * before `decide` runs, so a mint never lands over a secret it could not read.
 */
export async function updateColdCustodyRow<T>(
  home: CustodyHome, file: string, decide: (plaintext: Uint8Array | null) => RowUpdate<T>,
): Promise<T> {
  return (await openedCustody()).updateColdRow(home, file, (r) => {
    if (r.reading === "opens") return decide(r.plaintext);
    if (r.reading === "absent") return decide(null);
    if (r.reading === "locked") throw new CustodyLocked();
    throw new CustodyRowUnavailable(home, file, r.why);
  });
}

/**
 * Run `act` as ONE custody holder, while this home's holder holds its key: no sealed write in any process lands
 * while it runs. For a floor row whose mint must land once (the vessel key and its inception). Locked refuses
 * `CustodyLocked` before `act` runs, and `act` touches no sealed row.
 */
export async function exclusiveCustody<T>(act: () => Promise<T>): Promise<T> {
  return (await openedCustody()).exclusive(act);
}


/**
 * THE CUSTODY ROOT'S DERIVE DOOR for a sovereign gate's bundle: one child of the sealed custody root this home's
 * seat holds, under one registered domain. It answers only while the seat holds its key: a locked seat, or a
 * home with no seat, throws `CustodyLocked`, and it opens nothing (no opener runs for a derivation). It refuses
 * the floor bundle's name, so no "floor" child ever derives from the sealed root, and it carries a type the floor
 * tier's root refuses (`vesselFloorKeyDoor` mints the other).
 */
export function custodyGateDoor(): CustodyRootDoor {
  return custodyRootDoor({
    derive(domain: string): Uint8Array {
      if (domain === GATE_FLOOR_BUNDLE_INFO) {
        throw new CustodyRootRefused("refused the floor gate bundle's name: that child derives from the floor key alone");
      }
      const holder = seats.get(larIdentityDir())?.holder;
      if (!holder) throw new CustodyLocked();
      return holder.derive(domain);
    },
  });
}
