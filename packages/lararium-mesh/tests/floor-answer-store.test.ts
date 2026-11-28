/**
 * floor-answer-store — the floor's answer channel holds a verb's answer in memory alone and refuses every control fact by
 * the stand-in's name; the island's answer crosses to the vessel as one message the vessel's door reads whole.
 */
import { describe, expect, test } from "vitest";
import {
  ControlHomeUnavailable, floorAnswerStore, isIslandToVesselMsg, mkDaemonFloorAnswer, concludeVerb,
  CONTROL_HOME_UNNAMED, FLOOR_ANSWER_RING, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX,
  ANSWER_RING_BYTES, ANSWER_RING_COUNT, answerRingOf, makeAnswerRing, ridesAnswerRing, releasedBodyOf, verdictRowOf, READ_VERBS,
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

// ── the answer ring: the floor's memory generalised to every vessel (plan/outcome-ledger-diet, step 2) ──────────────
describe("the answer ring every vessel runs", () => {
  const whole = (id: string, body = "x") => concludeVerb({ requestId: id, verb: "LOAD", status: "done", cause: "t", batchMode: "best-effort",
    results: { summary: { ok: true, output: { body } } }, inputDigest: `sha256:${id}` });

  test("RED: it holds 1,024 answers or 16 MiB, whichever binds first, and the oldest leaves", () => {
    expect(ANSWER_RING_COUNT).toBe(1024);
    expect(ANSWER_RING_BYTES).toBe(16 * 1024 * 1024);
    const byCount = makeAnswerRing();
    for (let i = 0; i <= ANSWER_RING_COUNT; i++) byCount.put(whole(`c${i}`));
    expect(byCount.size).toBe(ANSWER_RING_COUNT);
    expect(byCount.get("c0"), "the oldest left by count").toBeNull();
    expect(byCount.get(`c${ANSWER_RING_COUNT}`)).not.toBeNull();
    // The byte bound binds first where answers weigh: three answers of about 1.3 KiB under a 3,500-byte bound keep two.
    const byBytes = makeAnswerRing({ bytes: 3_500 });
    for (const id of ["b0", "b1", "b2"]) byBytes.put(whole(id, "y".repeat(1_000)));
    expect(byBytes.get("b0"), "the oldest left by weight").toBeNull();
    expect(byBytes.get("b1")).not.toBeNull();
    expect(byBytes.get("b2")).not.toBeNull();
    expect(byBytes.size).toBe(2);
    expect(byBytes.bytes).toBeLessThanOrEqual(3_500);
    // A lone answer heavier than the whole bound stays for its waiter, and leaves when the next lands.
    const lone = makeAnswerRing({ bytes: 100 });
    lone.put(whole("big", "z".repeat(5_000)));
    expect(lone.get("big")).not.toBeNull();
    lone.put(whole("next"));
    expect(lone.get("big")).toBeNull();
    expect(lone.get("next")).not.toBeNull();
  });

  test("RED: a control store carries one ring; a put under one id replaces, a subscriber hears each answer, and clear lets all go as a restart does", () => {
    const control = {};
    const ring = answerRingOf(control);
    expect(answerRingOf(control), "one ring per store").toBe(ring);
    expect(answerRingOf({}), "another store, another ring").not.toBe(ring);
    const heard: string[] = [];
    const stop = ring.subscribe((id) => heard.push(id));
    ring.put(whole("a", "first"));
    ring.put(whole("a", "second"));
    expect(ring.size).toBe(1);
    expect(String(ring.get("a")?.tiddler["results"])).toContain("second");
    // A record under no outcome title never enters: the ring holds answers alone.
    ring.put({ tiddler: { title: `${RECEIPT_FACT_URI_PREFIX}a` } });
    expect(ring.size).toBe(1);
    stop();
    ring.put(whole("b"));
    expect(heard).toEqual(["a", "a"]);
    ring.clear();
    expect(ring.size).toBe(0);
    expect(ring.bytes).toBe(0);
    expect(ring.get("a")).toBeNull();
  });

  test("RED: the verdict row rests no body, and a released body names its measure and its cure", () => {
    const answer = whole("v1", "private-heron");
    const row = verdictRowOf({ ...answer, tiddler: { ...answer.tiddler, touched: "{}" } }).tiddler as Record<string, unknown>;
    for (const gone of ["results", "touched", "cause", "completed-at"]) expect(row[gone], gone).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain("private-heron");
    const released = releasedBodyOf(row);
    expect(released).toMatchObject({ released: true, sha256: row["result-sha256"], bytes: Number(row["result-bytes"]) });
    expect(released.cure).toContain("run the ingest again");
    // A row that names no measure (written before rows carried one) still answers released, with the cure.
    expect(releasedBodyOf({ status: "done" })).toMatchObject({ released: true });
    expect(releasedBodyOf({ status: "done" }).sha256).toBeUndefined();
  });

  test("RED: a READ verb with no effect key rides the ring; an effect key, or any other verb, keeps the ledger", () => {
    for (const verb of READ_VERBS) expect(ridesAnswerRing(verb), verb).toBe(true);
    expect(ridesAnswerRing("tiddler-get", "eff-1")).toBe(false);
    expect(ridesAnswerRing("tiddler-put")).toBe(false);
    expect(ridesAnswerRing("INGEST")).toBe(false);
  });

  test("the island's whole answer crosses as the floor answer's message, marked for the ring", () => {
    const msg = mkDaemonFloorAnswer({ tiddler: { title: `${OUTCOME_URI_PREFIX}a` } }, true);
    expect(msg.answer).toBe(true);
    expect(isIslandToVesselMsg(msg)).toBe(true);
    expect(isIslandToVesselMsg({ ...msg, answer: "yes" })).toBe(false);
    expect(mkDaemonFloorAnswer({ tiddler: { title: `${OUTCOME_URI_PREFIX}a` } })).not.toHaveProperty("answer");
  });
});
