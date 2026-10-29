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
 * refuses by name (`SwitchActRowMalformed`).
 *
 * A ROW THAT DOES NOT OPEN (torn bytes, a row under another key) never bricks switching either. The custody writer keeps
 * refusing to overwrite bytes it cannot open, so this module alone sets that one row aside: it moves the bytes,
 * unchanged, to `set-aside/switch-acts.set-aside-<n>.json` beside the custody homes (outside them, so no census or
 * rotation reads them as a row, and nothing reads them as acts), and starts a fresh ring at a `reset` act naming the
 * reading and where the bytes rest. Writes take turns on the row in this process, and a writer re-reads the row before
 * it moves anything, so a fresh ring is never set aside. At most SWITCH_ACTS_SET_ASIDE_CAP rows rest set aside: past it
 * a switch refuses `switch-acts-set-aside-full` by name and nothing is deleted. This row only: custody holds no general
 * set-aside door. A LOCKED seat still
 * refuses by its own name, and the switch aborts `intent-unwritten` with that name in the vessel's log.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-owner
 */
import { SwitchActsSetAsideFull, type SwitchIntent, type SwitchOutcome } from "@lararium/mesh";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { larIdentityDir } from "./vessel-paths.js";

export const SWITCH_ACTS_FILE = "switch-acts.json";
/** How many acts the row keeps, two per switch; the oldest leaves first. */
export const SWITCH_ACT_RING = 256;
/** How many unopenable rows rest set aside at most: past it a switch refuses `switch-acts-set-aside-full`, and none is deleted. */
export const SWITCH_ACTS_SET_ASIDE_CAP = 8;

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

/** Where a row that did not open rests, kept for inspection: beside the custody homes, never inside one. */
export function switchActsSetAsideDir(): string {
  return join(dirname(larIdentityDir()), "set-aside");
}

/**
 * Move the unopenable row's bytes, unchanged, to the next free `switch-acts.set-aside-<n>.json`; answers its name. Past
 * the cap it moves nothing and refuses `SwitchActsSetAsideFull`.
 */
function setAsideRow(): string {
  const dir = switchActsSetAsideDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let n = 1;
  while (n <= SWITCH_ACTS_SET_ASIDE_CAP && existsSync(join(dir, `switch-acts.set-aside-${n}.json`))) n++;
  if (n > SWITCH_ACTS_SET_ASIDE_CAP) throw new SwitchActsSetAsideFull(SWITCH_ACTS_SET_ASIDE_CAP, dir);
  const name = `switch-acts.set-aside-${n}.json`;
  renameSync(join(larIdentityDir(), SWITCH_ACTS_FILE), join(dir, name));
  return name;
}

const writeAct = (record: SwitchActRecord, fresh?: SwitchActReset) =>
  updateCustodyRow("identity", SWITCH_ACTS_FILE, (plaintext) => {
    let standing: SwitchActRecord[];
    if (fresh !== undefined) standing = [fresh];
    else {
      try { standing = parse(plaintext); }
      catch (error) {
        if (!(error instanceof SwitchActRowMalformed)) throw error;
        standing = [{ phase: "reset", reason: error.reason }];
      }
    }
    return { plaintext: enc.encode(JSON.stringify(trimSwitchActs([...standing, record]))), value: undefined };
  });

/** Whether the row opens now: a writer before this one may have set it aside and started a fresh ring. */
async function rowOpens(): Promise<boolean> {
  try { await readCustodyRow("identity", SWITCH_ACTS_FILE); return true; }
  catch (error) { if (error instanceof CustodyRowUnavailable) return false; throw error; }
}

/** One write at a time on this row in this process: a set-aside never moves a ring a writer before it just started. */
let turn: Promise<unknown> = Promise.resolve();

/** The vessel's sealed switch-act row. A write returns once the row rests sealed. */
export const nodeSwitchActLog: SwitchActLog = {
  write(act) {
    const record: SwitchActRecord = { ...act, phase: "outcome" in act ? "outcome" : "intent" };
    const run = turn.then(async () => {
      try { await writeAct(record); }
      catch (error) {
        if (!(error instanceof CustodyRowUnavailable)) throw error;
        // RE-READ BEFORE ANY RENAME: the row moves aside only while it still does not open.
        if (await rowOpens()) { await writeAct(record); return; }
        const name = setAsideRow();
        await writeAct(record, { phase: "reset", reason: `the row did not open (${error.reading}); its bytes rest set aside as ${name}` });
      }
    });
    turn = run.catch(() => { /* the next write takes its own turn */ });
    return run;
  },
};

/** The acts the row holds, oldest first. A malformed row refuses by name. */
export async function readSwitchActs(): Promise<readonly SwitchActRecord[]> {
  return parse(await readCustodyRow("identity", SWITCH_ACTS_FILE));
}
