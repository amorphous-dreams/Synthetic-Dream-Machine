/**
 * switch-act-log.test — the vessel's sealed switch-act row: the real sealed write and its read-back, the ring's bound,
 * and a malformed row, which never stops a later switch and reads its loss in the row.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SwitchIntent, SwitchOutcome } from "@lararium/mesh";
import { updateCustodyRow } from "../src/custody-seat.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { nodeSwitchActLog, readSwitchActs, SWITCH_ACT_RING, SWITCH_ACTS_FILE, SwitchActRowMalformed, switchActsSetAsideDir, trimSwitchActs } from "../src/switch-act-log.js";
import { CustodyRowUnavailable } from "../src/custody-holder.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const intent = (n: number): SwitchIntent => ({ actId: `act-${n}`, ownerEpoch: "owner", generation: n, outgoing: `proof-${n}`, incoming: `proof-${n + 1}` });
const outcome = (n: number): SwitchOutcome => ({ ...intent(n), outcome: "switched" });

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("switch-act-log"); });
afterEach(async () => { await c.drop(); });

describe("the switch-act row", () => {
  test("a written act rests sealed under the device key and reads back in order", async () => {
    await nodeSwitchActLog.write(intent(0));
    await nodeSwitchActLog.write(outcome(0));
    expect((await readSwitchActs()).map((a) => [a.phase, "actId" in a ? a.actId : null])).toEqual([["intent", "act-0"], ["outcome", "act-0"]]);
    const file = join(larIdentityDir(), SWITCH_ACTS_FILE);
    expect(existsSync(file)).toBe(true);
    const onDisk = readFileSync(file, "utf8");
    expect(onDisk).not.toContain("act-0");          // the row rests sealed: no act's name reads on disk
    expect(onDisk).not.toContain("proof-1");
  });

  test("the ring keeps the newest acts, and no outcome stands at its head without its intent", async () => {
    const acts = Array.from({ length: 150 }, (_, n) => [intent(n), outcome(n)]).flat().map((a) => ({ ...a, phase: "outcome" in a ? "outcome" as const : "intent" as const }));
    const kept = trimSwitchActs(acts);
    expect(kept).toHaveLength(SWITCH_ACT_RING);
    expect(kept[0]).toMatchObject({ phase: "intent", actId: "act-22" });
    expect(kept.at(-1)).toMatchObject({ phase: "outcome", actId: "act-149" });
    // An odd bound would leave an outcome first; the trim drops it with its intent gone.
    const odd = trimSwitchActs(acts, 5);
    expect(odd.map((a) => a.phase)).toEqual(["intent", "outcome", "intent", "outcome"]);
    // The sealed write holds the same bound.
    for (let n = 0; n < 130; n++) { await nodeSwitchActLog.write(intent(n)); await nodeSwitchActLog.write(outcome(n)); }
    const standing = await readSwitchActs();
    expect(standing).toHaveLength(SWITCH_ACT_RING);
    expect(standing[0]).toMatchObject({ phase: "intent", actId: "act-2" });
  });

  test("RED: a malformed row refuses its read by name, and the next write starts the ring afresh at a reset naming why", async () => {
    await updateCustodyRow("identity", SWITCH_ACTS_FILE, () => ({ plaintext: new TextEncoder().encode("{not json"), value: undefined }));
    await expect(readSwitchActs()).rejects.toBeInstanceOf(SwitchActRowMalformed);
    await nodeSwitchActLog.write(intent(7));
    expect(await readSwitchActs()).toEqual([{ phase: "reset", reason: "its bytes read no JSON" }, { ...intent(7), phase: "intent" }]);
    // CONTROL: a later switch writes on as ever.
    await nodeSwitchActLog.write(outcome(7));
    expect((await readSwitchActs()).map((a) => a.phase)).toEqual(["reset", "intent", "outcome"]);
  });

  test("RED: a list whose entries are no acts ([null], a bare number, an unknown phase) reads malformed, and the next write resets the ring", async () => {
    for (const bytes of ["[null]", "[3]", '[{"phase":"wear"}]']) {
      await updateCustodyRow("identity", SWITCH_ACTS_FILE, () => ({ plaintext: new TextEncoder().encode(bytes), value: undefined }));
      await expect(readSwitchActs()).rejects.toBeInstanceOf(SwitchActRowMalformed);
      await nodeSwitchActLog.write(intent(9));
      expect(await readSwitchActs()).toEqual([{ phase: "reset", reason: "it holds an entry that reads as no switch act" }, { ...intent(9), phase: "intent" }]);
    }
    // CONTROL: a reset row reads back as a list of acts, and the ring writes on.
    await nodeSwitchActLog.write(outcome(9));
    expect((await readSwitchActs()).map((a) => a.phase)).toEqual(["reset", "intent", "outcome"]);
  });
  test("RED: a row that does not open (torn bytes) never bricks a switch: the next write sets its bytes aside unchanged and starts a fresh ring naming why", async () => {
    await nodeSwitchActLog.write(intent(1));
    const path = join(larIdentityDir(), SWITCH_ACTS_FILE);
    const torn = Buffer.from(readFileSync(path));
    torn[torn.length - 1] ^= 0xff;                                           // a torn tail: the row no longer opens
    writeFileSync(path, torn);
    await expect(readSwitchActs()).rejects.toBeInstanceOf(CustodyRowUnavailable);
    await nodeSwitchActLog.write(intent(2));
    const [reset, ...rest] = await readSwitchActs();
    expect(reset).toMatchObject({ phase: "reset" });
    expect((reset as { reason: string }).reason).toMatch(/did not open .*switch-acts\.set-aside-1\.json/);
    expect(rest).toEqual([{ ...intent(2), phase: "intent" }]);
    // The set-aside bytes stand unchanged, outside every custody home.
    expect(readFileSync(join(switchActsSetAsideDir(), "switch-acts.set-aside-1.json")).equals(torn)).toBe(true);
    // CONTROL: the fresh ring writes on.
    await nodeSwitchActLog.write(outcome(2));
    expect((await readSwitchActs()).map((a) => a.phase)).toEqual(["reset", "intent", "outcome"]);
  });
});
