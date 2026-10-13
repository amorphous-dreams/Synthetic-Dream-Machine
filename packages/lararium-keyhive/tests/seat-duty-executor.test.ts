import { describe, test, expect } from "vitest";
import type { SeatDuty, SeatRoll, SeatRollSink } from "@lararium/mesh";
import { runSeatDuties, subscribeSeatRolls, announceSeatRoll, type SeatKeyShore } from "../src/seat-duty-executor.js";

const seat = { group: "group", member: "member" };
const row = (patch: Partial<Extract<SeatDuty, { kind: "revoke" }>> = {}): SeatDuty => ({ kind: "revoke", scope: "scope", edgeId: "edge", seat, raiseCids: ["raise"], then: "leave-out", ...patch });
function shore(revoke: "revoked" | "gone" | "no-authority" = "revoked", fresh: "seated" | "unknown-party" = "seated", calls: string[] = []) {
  const value: SeatKeyShore = {
    async revokeSeat() { calls.push("revoke"); return revoke; },
    async seatAfresh() { calls.push("seatAfresh"); return fresh; },
  };
  return { calls, value };
}
const sinkOf = (calls: string[], reject = false): SeatRollSink => async () => { calls.push("sink"); if (reject) throw new Error("sink refused"); };

describe("runSeatDuties carries each owed act", () => {
  test("a revoke rolls its raises through the sink", async () => {
    const s = shore(), calls: string[] = [];
    const out = await runSeatDuties(s.value, [row()], sinkOf(calls));
    expect(s.calls).toEqual(["revoke"]); expect(calls).toEqual(["sink"]); expect(out[0]?.marks).toEqual(["raise"]);
  });
  test("a fresh seat follows the delivered roll", async () => {
    const calls: string[] = [], s = shore("revoked", "seated", calls);
    await runSeatDuties(s.value, [row({ then: "seat-afresh" })], sinkOf(calls));
    expect(calls).toEqual(["revoke", "sink", "seatAfresh"]);
  });
  test("a rejected roll leaves its raise unmarked and skips a fresh seat", async () => {
    const s = shore(), calls: string[] = [];
    const out = await runSeatDuties(s.value, [row({ then: "seat-afresh" })], sinkOf(calls, true));
    expect(out[0]?.did).toBe("undelivered"); expect(out[0]?.marks).toEqual([]); expect(s.calls).toEqual(["revoke"]);
    const control = await runSeatDuties(s.value, [row()], sinkOf([])); expect(control[0]?.marks).toEqual(["raise"]);
  });
  test("a seat without revoke authority keeps its seat", async () => {
    const s = shore("no-authority"), out = await runSeatDuties(s.value, [row({ then: "seat-afresh" })], () => {});
    expect(out[0]?.did).toBe("no-authority"); expect(out[0]?.marks).toEqual(["raise"]); expect(s.calls).toEqual(["revoke"]);
  });
  test("a revoke without raises calls no sink", async () => {
    const s = shore(), calls: string[] = [];
    await runSeatDuties(s.value, [row({ raiseCids: [] })], sinkOf(calls)); expect(calls).toEqual([]);
  });
  test("a settled raise rolls as gone", async () => {
    const rolls: SeatRoll[] = [];
    const duty: SeatDuty = { kind: "settled", scope: "scope", edgeId: "edge", raiseCids: ["raise"] };
    const out = await runSeatDuties(shore().value, [duty], (roll) => { rolls.push(roll); });
    expect(rolls[0]?.how).toBe("gone"); expect(out[0]?.did).toBe("settled"); expect(out[0]?.marks).toEqual(["raise"]);
  });
  test("a forked row performs no key act", async () => {
    const s = shore(), out = await runSeatDuties(s.value, [{ kind: "forked", scope: "scope" }], () => { throw new Error("called"); });
    expect(s.calls).toEqual([]); expect(out[0]?.did).toBe("forked");
  });
  test("a fresh seat reports when the shore cannot name its member", async () => {
    const s = shore("revoked", "unknown-party"), duty: SeatDuty = { kind: "seat-afresh", scope: "scope", edgeId: "edge", seat };
    const out = await runSeatDuties(s.value, [duty], () => {}); expect(out[0]?.did).toBe("unseated");
    const control = await runSeatDuties(shore().value, [duty], () => {}); expect(control[0]?.did).toBe("seated");
  });
  test("seat roll subscribers receive, unsubscribe, and can reject", async () => {
    const roll: SeatRoll = { kind: "seat-roll", scope: "scope", edgeId: "edge", raiseCids: ["raise"], how: "gone" };
    const seen: SeatRoll[] = [], off = subscribeSeatRolls((r) => { seen.push(r); });
    await announceSeatRoll(roll); off(); await announceSeatRoll(roll); expect(seen).toEqual([roll]);
    const fail = subscribeSeatRolls(async () => { throw new Error("subscriber refused"); });
    await expect(announceSeatRoll(roll)).rejects.toThrow("subscriber refused"); fail();
  });
});
