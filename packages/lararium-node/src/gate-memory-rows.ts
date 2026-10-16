/**
 * gate-memory-rows — THE SEALED ROW DOOR a sovereign gate's withdrawal memory rests behind.
 *
 * A gate that forgets a denial admits the withdrawn vessel again, so what a gate learned of a face's
 * withdrawals outlives a restart (`@lararium/mesh` `gate-withdrawal-store`). That store reads and writes bytes
 * through `GateMemoryRows`; this module answers that door over the vessel's custody seat.
 *
 * ── ONE ROW PER FACE KEY, SEALED UNDER THE VESSEL KEY ───────────────────────────────────────────
 * A row rests at `gate-memory/<name>.bin` in the storage home, where `name` reads as the face's proof-subject
 * digest: 64 characters of bare lower-case hex, and nothing else names a row. Its plaintext holds signed,
 * publicly verifiable withdrawal events and no secret. It rests sealed all the same, so the disk of a vessel at
 * rest names no face key: neither a file's name nor its bytes say whose withdrawals a gate learned.
 *
 * ── ONLY AN UNLOCKED VESSEL'S SOVEREIGN GATE READS IT ───────────────────────────────────────────
 * Both doors ask the custody seat. A locked seat, or a home with no seat, refuses `CustodyLocked`; a row that
 * stands and does not open (torn, bare, another key's), or opens to anything but a list, refuses
 * `CustodyRowUnavailable` at the read and at the write, and its bytes never move: the gate that asked falls
 * silent, and a hand repairs or removes the row. Nothing at a row's path reads as a gate that learned nothing of
 * that face.
 *
 * ── ONE HOLDER PER WRITE, AND A WRITE ONLY ACCRETES ─────────────────────────────────────────────
 * A write reads the standing row, decides and seals under one custody hold (`updateCustodyRow`), and lands only
 * over nothing or over a row that reads whole. A row's plaintext lists events, and nothing else lands: bytes that
 * read as no list refuse, and a standing row that opens to no list refuses `malformed` and keeps its bytes. The
 * arriving list must hold every event the row holds, each compared in its canonical spelling: a write that would
 * drop one refuses (`GateMemoryRowRefused`) and the row keeps its bytes, so a writer that joined against an older
 * view never replaces what another writer learned since. The store hears the refusal, drops its view of the row
 * and verifies the row again.
 *
 * ── ONE DOOR PER HOLDER ─────────────────────────────────────────────────────────────────────────
 * `gateMemoryRows()` answers the SAME door for as long as one holder sits in this home's seat, so every gate of
 * one composition shares the store's one writer queue and its one verified view. A new holder (a restart, an
 * unlock that seats afresh) gets a new door, and with it a view that verifies every row again.
 *
 * ── NO FENCE AGAINST A ROLLBACK ─────────────────────────────────────────────────────────────────
 * Every event of an older copy of a row still verifies, and an older sealed row still opens under the same
 * vessel key, so a hand that restores one makes the gate forget what it learned since; the next honest vessel
 * of the face teaches it again. The custody seat holds no counter a restored disk could not also restore, so it
 * offers no fence here, and this door adds none.
 *
 * ── A FRESH VESSEL KNOWS NOTHING ────────────────────────────────────────────────────────────────
 * The row belongs to its vessel (the carrier table reads its face as `vessel`), so no face's backup bundle
 * carries it: a vessel that stands again from a bundle learns each withdrawal from the next honest dial.
 *
 * Called by the node vessel's sovereign gate (`open-node-vessel`). Node-main only.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-withdrawal-proof
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { GATE_MEMORY_ROW_MAX_BYTES, canonicalJson, type GateMemoryRows } from "@lararium/mesh";
import { CustodyRowUnavailable, type CustodyHolder } from "./custody-holder.js";
import { readCustodyRow, standingCustody, updateCustodyRow } from "./custody-seat.js";
import { larDataDir } from "./vessel-paths.js";

/** The directory, under the storage home, that holds every gate memory row. */
export const GATE_MEMORY_DIR = "gate-memory";
/** A row's name: a proof-subject digest, 64 characters of bare lower-case hex. */
const ROW_NAME = /^[0-9a-f]{64}$/;

/** A row this door refuses before the custody seat hears of it: a name outside the one spelling, or bytes past the bound. */
export class GateMemoryRowRefused extends Error {
  override readonly name = "GateMemoryRowRefused";
}

/** The path of the row `name`, relative to the storage home. Refuses a name outside the one spelling. */
export function gateMemoryRowFile(name: string): string {
  if (typeof name !== "string" || !ROW_NAME.test(name)) {
    throw new GateMemoryRowRefused("a gate memory row answers to a proof-subject digest (64 characters of bare lower-case hex) and to no other name");
  }
  return `${GATE_MEMORY_DIR}/${name}.bin`;
}

/** The events a row's plaintext lists, each by its canonical spelling; `null` where the bytes read as no list. */
function eventsOf(bytes: Uint8Array): Set<string> | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return Array.isArray(parsed) ? new Set(parsed.map((event) => canonicalJson(event))) : null;
  } catch { return null; }
}

function makeRows(): GateMemoryRows {
  return Object.freeze({
    async read(name: string): Promise<Uint8Array | null> {
      const file = gateMemoryRowFile(name);
      const bytes = await readCustodyRow("storage", file);
      // A row that opens to no list refuses by name, exactly as one that does not open: the gate that asked
      // falls silent, where a row read as nothing would let it treat the face as never learned.
      if (bytes !== null && eventsOf(bytes) === null) throw new CustodyRowUnavailable("storage", file, "malformed");
      return bytes;
    },
    async write(name: string, bytes: Uint8Array): Promise<void> {
      const file = gateMemoryRowFile(name);
      if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > GATE_MEMORY_ROW_MAX_BYTES) {
        throw new GateMemoryRowRefused(`a gate memory row holds between 1 and ${GATE_MEMORY_ROW_MAX_BYTES} bytes`);
      }
      const next = Uint8Array.from(bytes);
      const arriving = eventsOf(next);
      if (arriving === null) throw new GateMemoryRowRefused("a gate memory row lists events: these bytes read as no list");
      // The decision runs only over a row that reads whole or over nothing: every other reading refuses first,
      // and a locked seat refuses before the decision runs, so a refused write leaves no directory behind.
      await updateCustodyRow("storage", file, (standing) => {
        if (standing !== null) {
          const held = eventsOf(standing);
          if (held === null) throw new CustodyRowUnavailable("storage", file, "malformed");
          for (const event of held) {
            if (!arriving.has(event)) throw new GateMemoryRowRefused("a gate's memory only accretes: this write lacks an event the row holds, so the row keeps its bytes");
          }
        }
        mkdirSync(join(larDataDir(), GATE_MEMORY_DIR), { recursive: true, mode: 0o700 });
        return { plaintext: next, value: undefined };
      });
    },
  });
}

const DOORS = new WeakMap<CustodyHolder, GateMemoryRows>();

/**
 * The vessel's door for a gate's memory, over the custody seat of the home the vessel's resolvers name. One door
 * per seated holder; a home with no seat answers a door of its own that refuses every row `CustodyLocked`.
 */
export function gateMemoryRows(): GateMemoryRows {
  const holder = standingCustody();
  if (holder === null) return makeRows();
  let door = DOORS.get(holder);
  if (door === undefined) { door = makeRows(); DOORS.set(holder, door); }
  return door;
}
