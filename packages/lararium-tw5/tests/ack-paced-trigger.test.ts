/** The ack-paced trigger: one write in flight, its durable ack is the drain's clock; lifecycle only requests. */
import { describe, expect, test } from "vitest";
import { AckPacedTrigger } from "../src/ack-paced-trigger.js";
import { HandGate } from "../src/hand-gate.js";

function rig() {
  const gate = new HandGate();
  const state = new Map<string, string>();
  const writes: Array<{ title: string; text: string }> = [];
  const acks: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
  let failNext = false;
  const mark = (title: string, text: string): void => {
    state.set(title, text);
    void gate.mark(title, async () => { writes.push({ title, text: state.get(title)! }); }).catch(() => {});
  };
  const trigger = new AckPacedTrigger({
    pending: () => gate.titles(),
    ack: () => new Promise<void>((resolve, reject) => {
      if (failNext) { failNext = false; reject(new Error("no ack")); return; }
      acks.push({ resolve, reject });
    }),
  });
  trigger.attach((titles) => gate.fire(titles));
  return { gate, trigger, mark, writes, acks, failOnce: () => { failNext = true; } };
}
const turns = async (n = 8): Promise<void> => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe("AckPacedTrigger", () => {
  test("(a) N rapid marks while one write is in flight produce exactly ONE follow-up write carrying the latest state", async () => {
    const r = rig();
    r.mark("d", "k0"); r.trigger.request(); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "k0" }]);
    for (let i = 1; i <= 12; i++) { r.mark("d", `k${i}`); r.trigger.request(); }
    await turns();
    expect(r.writes, "nothing new is written while the first write awaits its ack").toHaveLength(1);
    r.acks.shift()!.resolve(); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "k0" }, { title: "d", text: "k12" }]);
    r.acks.shift()!.resolve(); await turns();
    expect(r.trigger.flight(), "at rest after the last ack").toBeNull();
    expect(r.writes).toHaveLength(2);
  });
  test("(b) a stalled ack holds the obligation and nothing is written in parallel", async () => {
    const r = rig();
    r.mark("a", "1"); r.trigger.request(); await turns();
    r.mark("b", "2"); r.trigger.request(); await turns(20);
    expect(r.writes.map((w) => w.title)).toEqual(["a"]);
    expect(r.trigger.flight()).not.toBeNull();
    expect(r.gate.has("b"), "b stays owed").toBe(true);
  });
  test("(c) a failed ack keeps the obligation and the next request retries the latest generation", async () => {
    const r = rig();
    r.failOnce();
    r.mark("d", "one"); r.trigger.request(); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "one" }]);
    r.mark("d", "two"); r.trigger.request(); await turns();
    expect(r.writes.at(-1)).toEqual({ title: "d", text: "two" });
  });
  test("(d) the gate's own completion alone never counts as acked: a write whose ack never comes leaves the flight standing", async () => {
    const r = rig();
    r.mark("d", "x"); r.trigger.request(); await turns(30);
    expect(r.writes).toHaveLength(1);
    expect(r.trigger.flight(), "written but not acked: still in flight").not.toBeNull();
  });
  test("(e) a lifecycle request with nothing in flight starts exactly one write, and one with nothing owed starts none", async () => {
    const r = rig();
    r.trigger.request(); await turns();
    expect(r.writes).toEqual([]);
    r.mark("d", "held"); r.trigger.request(); r.trigger.request(); r.trigger.request(); await turns();
    expect(r.writes).toHaveLength(1);
  });
  test("CONTROL: no timer drives it: with nothing requested nothing is ever written", async () => {
    const r = rig();
    r.mark("d", "x"); await turns(50);
    expect(r.writes).toEqual([]);
  });
});
