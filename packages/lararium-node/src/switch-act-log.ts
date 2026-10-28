/**
 * switch-act-log — where a session switch's acts rest: one sealed row on this vessel, never a document.
 *
 * A switch act names a causal position and two faces, the one a session left and the one it took. A document would
 * carry that pair to whoever syncs it: the daemon's working layer is a face bag the PersonaGroup holds admin over, so
 * every device of the outgoing face would read which other face this vessel wore. The act rests instead in the
 * vessel's own custody row (`switch-acts`, sealed under the device key), which no Repo announces and no fleet syncs.
 *
 * THE RING. The row keeps the newest SWITCH_ACT_RING acts (two per switch, an intent and its outcome) and drops the
 * oldest first: a switch reads none of them back, and an audit reads what stands. A trim never leaves an outcome at
 * the head whose intent left, so the oldest act standing is an intent.
 *
 * A MALFORMED ROW. A row that opens and holds no list of acts, or a list with an entry that reads as no act (`[null]`), never stops a later switch: the next write sets it aside
 * and starts the ring afresh at a `reset` act naming why, so the loss reads in the row itself. A read of a malformed row
 * refuses by name (`SwitchActRowMalformed`). A row that does not OPEN (a locked seat, a row under another key) refuses
 * by the custody seat's own name, and the switch aborts `intent-unwritten` with that name in the vessel's log.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-owner
 */
import type { SwitchIntent, SwitchOutcome } from "@lararium/mesh";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";

export const SWITCH_ACTS_FILE = "switch-acts.json";
/** How many acts the row keeps, two per switch; the oldest leaves first. */
export const SWITCH_ACT_RING = 256;

/** The act that opens a ring set over a malformed row. */
export interface SwitchActReset { readonly phase: "reset"; readonly reason: string }
export type SwitchActRecord = ((SwitchIntent | SwitchOutcome) & { readonly phase: "intent" | "outcome" }) | SwitchActReset;

/** The one port the session seat writes a switch act through. */
export interface SwitchActLog {
  write(act: SwitchIntent | SwitchOutcome): Promise<void>;
}

/** The row opened and held no list of switch acts. */
export class SwitchActRowMalformed extends Error {
  override readonly name = "SwitchActRowMalformed";
  constructor(readonly reason: string) { super(`the switch-acts row is malformed: ${reason}`); }
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const parse = (bytes: Uint8Array | null): SwitchActRecord[] => {
  if (bytes === null) return [];
  let read: unknown;
  try { read = JSON.parse(dec.decode(bytes)); } catch { throw new SwitchActRowMalformed("its bytes read no JSON"); }
  if (!Array.isArray(read)) throw new SwitchActRowMalformed("it holds no list");
  const PHASES: readonly unknown[] = ["intent", "outcome", "reset"];
  if (!read.every((a: unknown) => typeof a === "object" && a !== null && PHASES.includes((a as { phase?: unknown }).phase))) {
    throw new SwitchActRowMalformed("it holds an entry that reads as no switch act");
  }
  return read as SwitchActRecord[];
};

/** Keep the newest `ring` acts, trimmed so no outcome stands at the head without its intent. */
export function trimSwitchActs(acts: readonly SwitchActRecord[], ring = SWITCH_ACT_RING): SwitchActRecord[] {
  const kept = acts.slice(-ring);
  while (kept.length > 0 && kept[0]!.phase === "outcome") kept.shift();
  return kept;
}

/** The vessel's sealed switch-act row. A write returns once the row rests sealed. */
export const nodeSwitchActLog: SwitchActLog = {
  async write(act) {
    const record: SwitchActRecord = { ...act, phase: "outcome" in act ? "outcome" : "intent" };
    await updateCustodyRow("identity", SWITCH_ACTS_FILE, (plaintext) => {
      let standing: SwitchActRecord[];
      try { standing = parse(plaintext); }
      catch (error) {
        if (!(error instanceof SwitchActRowMalformed)) throw error;
        standing = [{ phase: "reset", reason: error.reason }];
      }
      return { plaintext: enc.encode(JSON.stringify(trimSwitchActs([...standing, record]))), value: undefined };
    });
  },
};

/** The acts the row holds, oldest first. A malformed row refuses by name. */
export async function readSwitchActs(): Promise<readonly SwitchActRecord[]> {
  return parse(await readCustodyRow("identity", SWITCH_ACTS_FILE));
}
