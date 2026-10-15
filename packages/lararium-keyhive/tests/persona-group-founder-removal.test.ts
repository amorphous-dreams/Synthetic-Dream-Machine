/**
 * A post-mutation Keyhive throw must not strand a founder's owed roll (train W, walk step two; kapae#/keys).
 *
 * Keyhive 0.3.0-alpha.1 throws on the founder's own departure while it seated others, and the seat leaves anyway
 * (`persona-group-substrate.test.ts` G8). So the key shore tells a throw AFTER the group moved from a refusal
 * BEFORE it by reading the seat again: a seat that left answers `revoked`, and the roll reaches its subscribers
 * and the ledger marks the raise; a seat that still stands lets the throw ride out, and nothing gets marked.
 */
import { describe, expect, test } from "vitest";
import type { SeatDuty, SeatRoll } from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import { keyhiveSeatShore, runSeatDuties, type SeatKeyShore } from "../src/seat-duty-executor.js";

async function stand(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
const dutyFor = (group: string, member: string): SeatDuty => ({ kind: "revoke", scope: "founder-face", edgeId: "founder-edge",
  seat: { group, member }, raiseCids: ["raise-founder"], then: "leave-out" });

describe("PersonaGroup founder removal", () => {
  test("CONTROL: an ordinary revoke delivers one roll and marks its raise", async () => {
    const rolls: SeatRoll[] = [];
    const shore: SeatKeyShore = { revokeSeat: async () => "revoked", seatAfresh: async () => "seated" };
    const result = await runSeatDuties(shore, [dutyFor("persona-group", "founder")], (roll) => { rolls.push(roll); });
    expect(rolls).toHaveLength(1);
    expect(result[0]?.marks).toEqual(["raise-founder"]);
  });

  test("FOUNDER_REMOVAL_DELIVERS_KEY_ROLL: the founder's departure throws after the group moved, and the roll still lands and marks", async () => {
    const f = await stand(0xc1), a = await stand(0xc2);
    await f.receiveContactCard(await a.contactCard());
    await a.receiveContactCard(await f.contactCard());
    const { groupId } = await f.createGroup();
    const [fid, aid] = [await f.vesselIdentifierHex(), await a.vesselIdentifierHex()];
    await f.addGroupMember(aid, groupId);
    const rolls: SeatRoll[] = [];
    const result = await runSeatDuties(keyhiveSeatShore(f), [dutyFor(groupId, fid)], (roll) => { rolls.push(roll); });
    expect(await f.groupMembers(groupId)).not.toContain(fid);              // the group moved
    expect(rolls).toEqual([expect.objectContaining({ how: "revoked", raiseCids: ["raise-founder"] })]);
    expect(result[0]).toMatchObject({ did: "revoked", marks: ["raise-founder"] });
  });

  test("CONTROL: a refusal before the group moves rides out, and nothing gets delivered or marked", async () => {
    const f = await stand(0xc3);
    const fid = await f.vesselIdentifierHex();
    const rolls: SeatRoll[] = [];
    await expect(runSeatDuties(keyhiveSeatShore(f), [dutyFor("0x" + "ab".repeat(32), fid)], (roll) => { rolls.push(roll); }))
      .rejects.toThrow(/group not found/);
    expect(rolls).toEqual([]);
  });
});
