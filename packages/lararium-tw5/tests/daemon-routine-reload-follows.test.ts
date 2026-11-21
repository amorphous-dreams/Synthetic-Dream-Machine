/**
 * A routine reload that arrives after a restart already PASSED prepare is not served by it: the running restart opened earlier inputs.
 * It follows (one more reload, no fail-closed). Commit A's reload in flight + drop A's reload = the final island loads the ledger as it
 * stands at the last reload. CONTROL: a routine request during prepare joins it; an emergency still upgrades or follows.
 */
import { describe, expect, test } from "vitest";
import { holdDaemonVm, KAPAE_EMERGENCY_REASON, PROMOTE_RESTART_REASON } from "../src/daemon-vm-holder.js";

const core = (): never => ({ shutdown: async () => {}, close() {} }) as never;

describe("routine reload follows a restart past prepare", () => {
  test("RED: the drop's reload after the commit's reload opened A leaves a final island loading []", async () => {
    let ledger = ["A"]; const opens: string[][] = [];
    let started!: () => void; const reopenStarted = new Promise<void>((r) => { started = r; });
    let release!: () => void; const hold = new Promise<void>((r) => { release = r; });
    const holder = holdDaemonVm({ vm: core(), prepare: async () => ({}), emergency: (r) => r === KAPAE_EMERGENCY_REASON, follows: (r) => r === PROMOTE_RESTART_REASON,
      reopen: async () => { opens.push([...ledger]); if (opens.length === 1) { started(); await hold; } return core(); } });
    const first = holder.restart(PROMOTE_RESTART_REASON);
    await reopenStarted;
    ledger = [];
    const second = holder.restart(PROMOTE_RESTART_REASON);
    release(); await first; await second;
    expect(opens, "two opens: the second read the dropped ledger").toEqual([["A"], []]);
  });

  test("CONTROL: a routine request during prepare joins that restart (one open)", async () => {
    let opens = 0; let release!: () => void; const hold = new Promise<void>((r) => { release = r; });
    const holder = holdDaemonVm({ vm: core(), prepare: async () => { await hold; return {}; }, emergency: () => false, reopen: async () => { opens++; return core(); } });
    const a = holder.restart(PROMOTE_RESTART_REASON); const b = holder.restart(PROMOTE_RESTART_REASON);
    release(); await a; await b;
    expect(opens).toBe(1);
  });

  test("an emergency arriving while a routine follow-up waits upgrades it; the follow-up does not fail closed for a routine request", async () => {
    const reasons: string[] = []; let started!: () => void; const reopenStarted = new Promise<void>((r) => { started = r; });
    let release!: () => void; const hold = new Promise<void>((r) => { release = r; });
    const holder = holdDaemonVm({ vm: core(), prepare: async (reason: string) => { reasons.push(reason); return {}; }, emergency: (r) => r === KAPAE_EMERGENCY_REASON, follows: (r) => r === PROMOTE_RESTART_REASON,
      reopen: async () => { if (reasons.length === 1) { started(); await hold; } return core(); } });
    const first = holder.restart(PROMOTE_RESTART_REASON);
    await reopenStarted;
    const routine = holder.restart(PROMOTE_RESTART_REASON);
    const emergency = holder.restart(KAPAE_EMERGENCY_REASON);
    release(); await first; await routine; await emergency;
    expect(reasons).toEqual([PROMOTE_RESTART_REASON, KAPAE_EMERGENCY_REASON]);
  });
});
