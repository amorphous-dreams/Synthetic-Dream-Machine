/**
 * floor-answer-store — the floor's answer channel holds a verb's answer in memory alone and refuses every control fact by
 * the stand-in's name; the island's answer crosses to the vessel as one message the vessel's door reads whole.
 */
import { describe, expect, test } from "vitest";
import {
  ControlHomeUnavailable, floorAnswerStore, isIslandToVesselMsg, mkDaemonFloorAnswer, concludeVerb,
  CONTROL_HOME_UNNAMED, FLOOR_ANSWER_RING, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX,
} from "../src/index.js";

const refusal = () => new ControlHomeUnavailable("no face here", CONTROL_HOME_UNNAMED);
const outcome = (id: string) => concludeVerb({ requestId: id, verb: "where", status: "done", cause: "t", batchMode: "best-effort", results: {} });

describe("the floor's answer store", () => {
  test("an outcome rests in memory and reads back; a receipt fact, a summons and a listing refuse by name", async () => {
    const heard: string[] = [];
    const store = floorAnswerStore(refusal(), (record) => heard.push(String(record.tiddler.title)));
    const seen: string[] = [];
    store.subscribe((change) => seen.push(change.title));
    await store.put(outcome("a"), { kind: "lares-verb", requestId: "a" });
    expect((await store.get(`${OUTCOME_URI_PREFIX}a`))?.tiddler["status"]).toBe("done");
    expect(heard).toEqual([`${OUTCOME_URI_PREFIX}a`]);
    expect(seen).toContain(`${OUTCOME_URI_PREFIX}a`);
    await expect(store.put({ tiddler: { title: `${RECEIPT_FACT_URI_PREFIX}a` } }, { kind: "lares-verb", requestId: "a" })).rejects.toMatchObject({ refusal: CONTROL_HOME_UNNAMED });
    await expect(store.put({ tiddler: { title: `${SUMMONS_URI_PREFIX}a` } }, { kind: "lares-verb", requestId: "a" })).rejects.toMatchObject({ refusal: CONTROL_HOME_UNNAMED });
    await expect(store.get(`${RECEIPT_FACT_URI_PREFIX}a`)).rejects.toMatchObject({ refusal: CONTROL_HOME_UNNAMED });
    await expect(store.listVisible()).rejects.toMatchObject({ refusal: CONTROL_HOME_UNNAMED });
  });

  test("the oldest answer leaves once the ring fills", async () => {
    const store = floorAnswerStore(refusal());
    for (let i = 0; i <= FLOOR_ANSWER_RING; i++) await store.put(outcome(`r${i}`), { kind: "lares-verb", requestId: `r${i}` });
    expect(await store.get(`${OUTCOME_URI_PREFIX}r0`)).toBeNull();
    expect(await store.get(`${OUTCOME_URI_PREFIX}r${FLOOR_ANSWER_RING}`)).not.toBeNull();
  });

  test("the island's floor answer reads whole at the vessel's door; a malformed one vanishes", () => {
    expect(isIslandToVesselMsg(mkDaemonFloorAnswer({ tiddler: { title: `${OUTCOME_URI_PREFIX}a` } }))).toBe(true);
    expect(isIslandToVesselMsg({ type: "daemon:floor-answer" })).toBe(false);
    expect(isIslandToVesselMsg({ type: "daemon:floor-answer", record: { tiddler: {} } })).toBe(false);
  });
});
