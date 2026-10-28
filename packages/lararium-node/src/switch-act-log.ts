/**
 * switch-act-log — where a session switch's acts rest: one sealed row on this vessel, never a document.
 *
 * A switch act names a causal position and two faces, the one a session left and the one it took. A document would
 * carry that pair to whoever syncs it: the daemon's working layer is a face bag the PersonaGroup holds admin over, so
 * every device of the outgoing face would read which other face this vessel wore. The act rests instead in the
 * vessel's own custody row (`switch-acts`, sealed under the device key), which no Repo announces and no fleet syncs.
 *
 * The row keeps a ring of the newest acts: a switch reads none of them back, and an audit reads what stands.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-owner
 */
import type { SwitchIntent, SwitchOutcome } from "@lararium/mesh";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";

export const SWITCH_ACTS_FILE = "switch-acts.json";
/** How many acts the row keeps; the oldest leaves first. */
export const SWITCH_ACT_RING = 256;

export type SwitchActRecord = (SwitchIntent | SwitchOutcome) & { readonly phase: "intent" | "outcome" };

/** The one port the session seat writes a switch act through. */
export interface SwitchActLog {
  write(act: SwitchIntent | SwitchOutcome): Promise<void>;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const parse = (bytes: Uint8Array | null): SwitchActRecord[] => {
  if (bytes === null) return [];
  const read = JSON.parse(dec.decode(bytes)) as unknown;
  if (!Array.isArray(read)) throw new Error("the switch-acts row holds no list");
  return read as SwitchActRecord[];
};

/** The vessel's sealed switch-act row. A write returns once the row rests sealed. */
export const nodeSwitchActLog: SwitchActLog = {
  async write(act) {
    const record: SwitchActRecord = { ...act, phase: "outcome" in act ? "outcome" : "intent" };
    await updateCustodyRow("identity", SWITCH_ACTS_FILE, (plaintext) => {
      const acts = [...parse(plaintext), record].slice(-SWITCH_ACT_RING);
      return { plaintext: enc.encode(JSON.stringify(acts)), value: undefined };
    });
  },
};

/** The acts the row holds, oldest first. */
export async function readSwitchActs(): Promise<readonly SwitchActRecord[]> {
  return parse(await readCustodyRow("identity", SWITCH_ACTS_FILE));
}
