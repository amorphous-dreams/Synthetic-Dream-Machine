/**
 * vessel-life — THE NAME OF ONE VESSEL LIFE: a fresh random id the vessel's store claim mints, resting at
 * `<storageDir>/.life` for that life's length, and its one reader.
 *
 * A vessel life begins when a vessel claims its store (`claimStore` with `holder: "vessel"`, `owned-store.ts`) and ends
 * when that claim releases or its holder dies. Claims run one at a time on one state (the `.holder` presence claim), so
 * the id at rest names the one life that holds the store now, or the last one that did. A direct one-shot act claims the
 * store for a moment and mints no life: it begins none.
 *
 * ONE NAME, ONE RELATION: the id names a life and orders nothing. Two lives compare equal or not; no reading says which
 * came first, and none needs to, since a life a reader recorded has ended exactly where the id at rest names another.
 * A counter would claim an ordering no two readers share (no global now), and a torn or restored counter would reuse a
 * number and revive an ended life; a random id minted at each claim never reads as an earlier life's. Every reader that
 * fences on a life (a `--held` pin, a committed receipt fact, the pūlama's drop) asks equality and nothing else, and the
 * session contract's `ownerEpoch` reads this same id.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/session-contract#/what-a-session-carries
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./fs-atomic.js";

const VESSEL_LIFE_FILE = ".life";

/** The life id's one spelling: 32 lowercase hex characters (128 random bits). */
const LIFE_SHAPE = /^[0-9a-f]{32}$/;

/** Whether a value spells a vessel life id. */
export function isVesselLife(value: unknown): value is string {
  return typeof value === "string" && LIFE_SHAPE.test(value);
}

/** The life file's path in a vessel's storage dir. */
export function vesselLifePath(storageDir: string): string {
  return join(storageDir, VESSEL_LIFE_FILE);
}

/** The life the storage dir names at rest, or null where none reads: absent, torn, or spelled any other way. A null names no
 *  life, so a reader that fences on one proves nothing from it and keeps what it holds. */
export function readVesselLife(storageDir: string): string | null {
  let raw: string;
  try { raw = readFileSync(vesselLifePath(storageDir), "utf8").trim(); } catch { return null; }
  return isVesselLife(raw) ? raw : null;
}

/** Mint a fresh life and rest it (atomic: a reader never sees a torn id). Called by a vessel's store claim alone. */
export function mintVesselLife(storageDir: string): string {
  const life = randomBytes(16).toString("hex");
  atomicWriteFileSync(vesselLifePath(storageDir), `${life}\n`);
  return life;
}
