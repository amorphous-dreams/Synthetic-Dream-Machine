/**
 * roll-circle-record — what this vault contributed to a roll circle that stands open, one record per Nexus.
 *
 * A circle crosses vaults as a file anyone may edit in transit. The record is how this vault knows which chairs are
 * its own: the seat key it revealed or minted, and the digest of the successor card its person printed and read
 * back. Its signing step signs only a circle that carries exactly those chairs, so a courier who swaps a successor
 * digest moves no chair's next roll into another hand. The record also keeps the contributed seat keys from
 * retiring while the circle stands open (`seal-ceremony`'s `neededSeats`).
 *
 * Public material alone: seat keys and successor digests. It rests at `<sealHome>/roll-circle/<aid>.json`.
 */
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { larSealHome } from "./vessel-paths.js";

export interface RollCircleRecord {
  readonly aid:         string;
  /** The head the circle steps from. */
  readonly predecessor: string;
  /** The rule the circle carried when this vault contributed: a circle whose rule moved after signs nothing here. */
  readonly threshold:   number;
  /** The chairs this vault contributed: its seat keys and their successor digests. */
  readonly chairs:      ReadonlyArray<{ readonly seat: string; readonly next: string }>;
}

/** A record that stands and reads torn: it might name a chair still open, so nothing reads past it. */
export class RollCircleRecordTorn extends Error {
  override readonly name = "RollCircleRecordTorn";
}

const HEX64 = /^[0-9a-f]{64}$/;
const AID = /^nexus-[0-9a-f]{64}$/;
const dir = (): string => join(larSealHome(), "roll-circle");
const pathOf = (aid: string): string => {
  if (!AID.test(aid)) throw new Error("roll-circle-record: a Nexus names itself nexus- and 64 lower hex");
  return join(dir(), `${aid}.json`);
};

function readRecord(raw: string): RollCircleRecord | null {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  const r = v as Partial<RollCircleRecord> | null;
  if (!r || typeof r !== "object" || typeof r.aid !== "string" || !AID.test(r.aid) || typeof r.predecessor !== "string" || !Array.isArray(r.chairs)) return null;
  if (typeof r.threshold !== "number" || !Number.isInteger(r.threshold) || r.threshold < 1) return null;
  if (!r.chairs.every((c) => c && typeof c.seat === "string" && HEX64.test(c.seat) && typeof c.next === "string" && HEX64.test(c.next))) return null;
  return { aid: r.aid, predecessor: r.predecessor, threshold: r.threshold, chairs: r.chairs.map((c) => ({ seat: c.seat, next: c.next })) };
}

/** The record for one Nexus, or null. A record that reads torn throws: it might name a chair still open. */
export function readRollCircleRecord(aid: string): RollCircleRecord | null {
  const path = pathOf(aid);
  if (!existsSync(path)) return null;
  const record = readRecord(readFileSync(path, "utf8"));
  if (!record || record.aid !== aid) throw new RollCircleRecordTorn(`the roll-circle record for ${aid.slice(0, 18)}… reads torn; nothing reads past it — move it aside once no circle it names stands open`);
  return record;
}

/** Every record standing here. A torn one throws, as above. */
export function readRollCircleRecords(): RollCircleRecord[] {
  let names: string[];
  try { names = readdirSync(dir()); } catch { return []; }
  // A name that spells no Nexus is no record: a stray file never wedges the seats' retirement.
  return names.filter((n) => n.endsWith(".json") && AID.test(n.slice(0, -".json".length))).sort()
    .map((n) => readRollCircleRecord(n.slice(0, -".json".length))!).filter(Boolean);
}

/** Write the record for one Nexus whole, through a sibling temp and a rename. */
export function writeRollCircleRecord(record: RollCircleRecord): void {
  mkdirSync(dir(), { recursive: true });
  const path = pathOf(record.aid);
  atomicWriteFileSync(path, `${JSON.stringify(record, null, 2)}\n`, `${path}.writing`);
}

/** Drop the record for one Nexus once its circle files. */
export function dropRollCircleRecord(aid: string): void {
  rmSync(pathOf(aid), { force: true });
}
