/** A post-mutation Keyhive throw must not strand a founder's owed roll. */
import { describe, expect, test } from "vitest";
import type { SeatDuty, SeatRoll } from "@lararium/mesh";
import { runSeatDuties, type SeatKeyShore } from "../src/seat-duty-executor.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
const duty: SeatDuty = { kind: "revoke", scope: "founder-face", edgeId: "founder-edge",
  seat: { group: "persona-group", member: "founder" }, raiseCids: ["raise-founder"], then: "leave-out" };

describe("PersonaGroup founder removal", () => {
  test("CONTROL: an ordinary revoke delivers one roll and marks its raise", async () => {
    const rolls: SeatRoll[] = [];
    const shore: SeatKeyShore = { revokeSeat: async () => "revoked", seatAfresh: async () => "seated" };
    const result = await runSeatDuties(shore, [duty], (roll) => { rolls.push(roll); });
    expect(rolls).toHaveLength(1);
    expect(result[0]?.marks).toEqual(["raise-founder"]);
  });

  red("FOUNDER_REMOVAL_DELIVERS_KEY_ROLL: a group mutation followed by a shore throw still delivers and marks the roll", async () => {
    let removed = false;
    const rolls: SeatRoll[] = [];
    const shore: SeatKeyShore = { revokeSeat: async () => { removed = true; throw new Error("founder self-removal after mutation"); }, seatAfresh: async () => "seated" };
    const result = await runSeatDuties(shore, [duty], (roll) => { rolls.push(roll); });
    expect(removed).toBe(true);
    expect(rolls).toHaveLength(1);
    expect(result[0]?.marks).toEqual(["raise-founder"]);
  });
});
