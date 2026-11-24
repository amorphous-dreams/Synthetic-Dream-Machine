/**
 * worldline rounds + messages — a handback closes a ROUND and the spirit stays addressable; retirement
 * takes its own act; a message joins the sender's history into the recipient, so the receive event
 * happens-after the send.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/time
 */
import { describe, expect, test } from "vitest";
import {
  worldlineCausalSeed, worldlineSpawn, worldlineTick, worldlineInject, worldlineHandback,
  worldlineResume, worldlineRetire, worldlineCompare, worldlineStampFor, worldlineFrontiersFor,
  itcCompare, delegationEdge, communicationEdge, handbackEdge, retireClose, replayWorldlineEdges,
} from "../src/index.js";

const root = "run";
const child = "run.child";

function spawned() {
  let c = worldlineCausalSeed(root);
  c = worldlineSpawn(c, root, child);
  return worldlineTick(c, child); // the child works its first round
}

describe("a handback closes a round; the spirit persists", () => {
  test("the child stays addressable after its handback, and the parent's receipt reads after the child's return", () => {
    const { causal, receipt } = worldlineHandback(spawned(), root, child);
    expect(worldlineStampFor(causal, child)).toBeDefined();
    expect(worldlineCompare(causal, child, root)).toBe("before");
    expect(receipt.parent).toBe(root);
    expect(receipt.child).toBe(child);
    expect(causal.stamps[receipt.sent]).toEqual(worldlineStampFor(causal, child));
    expect(causal.stamps[receipt.received]).toEqual(worldlineStampFor(causal, root));
  });

  test("a resumed round continues the child's own stamp: the same ownership, a later history, one frontier", () => {
    const before = spawned();
    const owned = worldlineStampFor(before, child)!.id;
    const { causal: returned } = worldlineHandback(before, root, child);
    const atReturn = worldlineStampFor(returned, child)!;
    const resumed = worldlineResume(returned, root, child);
    const now = worldlineStampFor(resumed, child)!;
    expect(now.id).toEqual(owned);
    expect(itcCompare(atReturn, now)).toBe("before");
    expect(worldlineCompare(resumed, root, child)).toBe("before");
    expect(worldlineFrontiersFor(resumed, child)).toHaveLength(1);
  });

  test("retirement takes its own act: the child leaves and its ownership returns to the parent", () => {
    const { causal } = worldlineHandback(spawned(), root, child);
    const retired = worldlineRetire(causal, root, child);
    expect(worldlineStampFor(retired, child)).toBeUndefined();
    expect(worldlineStampFor(retired, root)!.id).toBe(1);
    expect(() => worldlineResume(retired, root, child)).toThrow(/retired or never spawned/);
  });

  test("replay carries round, resume, round, then retirement from durable edges", () => {
    const opens = [
      delegationEdge(root, child, { turnKey: "s0" }),
      handbackEdge(child, root, { turnKey: "h1", parentKey: "s0" }),
      communicationEdge(root, child, { turnKey: "m1", parentKey: "h1" }),
      handbackEdge(child, root, { turnKey: "h2", parentKey: "m1" }),
    ];
    let expected = worldlineSpawn(worldlineCausalSeed(root), root, child);
    expected = worldlineHandback(expected, root, child).causal;
    expected = worldlineResume(expected, root, child);
    expected = worldlineHandback(expected, root, child).causal;
    const live = replayWorldlineEdges(root, opens);
    expect(live.skipped).toEqual([]);
    expect(live.causal).toEqual(expected);
    expect(worldlineStampFor(live.causal, child)).toBeDefined();

    const retired = replayWorldlineEdges(root, opens, [retireClose(root, child, undefined, "h2")]);
    expect(retired.skipped).toEqual([]);
    expect(retired.causal).toEqual(worldlineRetire(expected, root, child));
  });

  test("replay refuses a second spawn of a live spirit: a later round resumes, it never forks anew", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, child, { turnKey: "s0" }),
      handbackEdge(child, root, { turnKey: "h1", parentKey: "s0" }),
      delegationEdge(root, child, { turnKey: "s1", parentKey: "h1" }),
    ]);
    expect(replay.skipped.map((s) => s.reason)).toEqual(["child-already-spawned"]);
  });
});

describe("a message carries the sender's past into the recipient", () => {
  function siblings() {
    let c = worldlineCausalSeed(root);
    c = worldlineSpawn(c, root, "run.a");
    c = worldlineSpawn(c, root, "run.b");
    c = worldlineTick(c, "run.a");
    return worldlineTick(c, "run.b");
  }

  test("the receive happens-after the send: a sibling's message orders the recipient after the sender", () => {
    const c = siblings();
    expect(worldlineCompare(c, "run.a", "run.b")).toBe("concurrent");
    const sent = worldlineInject(c, "run.a", "run.b");
    expect(worldlineCompare(sent, "run.a", "run.b")).toBe("before");
  });

  test("the message keeps each participant's ownership; a later sender event reads concurrent again", () => {
    const c = siblings();
    const ids = [worldlineStampFor(c, "run.a")!.id, worldlineStampFor(c, "run.b")!.id];
    let sent = worldlineInject(c, "run.a", "run.b");
    expect([worldlineStampFor(sent, "run.a")!.id, worldlineStampFor(sent, "run.b")!.id]).toEqual(ids);
    sent = worldlineTick(sent, "run.a");
    expect(worldlineCompare(sent, "run.a", "run.b")).toBe("concurrent");
  });

  test("a message from or to an unknown handle refuses", () => {
    const c = siblings();
    expect(() => worldlineInject(c, "ghost", "run.b")).toThrow(/unknown sender/);
    expect(() => worldlineInject(c, "run.a", "ghost")).toThrow(/unknown target/);
  });

  test("replay joins the sender's history: a message between siblings orders the recipient after the sender", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, "run.a", { turnKey: "a0" }),
      delegationEdge(root, "run.b", { turnKey: "b0", parentKey: "a0" }),
      communicationEdge(root, "run.a", { turnKey: "a1", parentKey: "b0" }),
      communicationEdge("run.a", "run.b", { turnKey: "ab", parentKey: "a1" }),
    ]);
    expect(replay.skipped).toEqual([]);
    expect(worldlineCompare(replay.causal, "run.a", "run.b")).toBe("before");
  });

  test("replay lands a message from an unrecorded sender as the recipient's receive and names it unjoined", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, "run.a", { turnKey: "a0" }),
      communicationEdge("outside", "run.a", { turnKey: "o1", parentKey: "a0" }),
    ]);
    expect(replay.skipped).toEqual([]);
    expect(replay.unjoined.map((u) => [u.subject, u.reason])).toEqual([["outside", "sender-unrecorded"]]);
    expect(worldlineStampFor(replay.causal, "outside")).toBeUndefined();
    expect(worldlineCompare(replay.causal, root, "run.a")).toBe("before");
  });
});

describe("replay orders only what the links order", () => {
  // The live order: spawn A, spawn B; A hands back; B hands back; the run resumes A; A messages B.
  function live() {
    let c = worldlineCausalSeed(root);
    c = worldlineSpawn(c, root, "run.A");
    c = worldlineSpawn(c, root, "run.B");
    c = worldlineHandback(c, root, "run.A").causal;
    c = worldlineHandback(c, root, "run.B").causal;
    c = worldlineResume(c, root, "run.A");
    return worldlineInject(c, "run.A", "run.B");
  }

  test("an unlinked sibling message never reverses a verdict: the replay names it a gap and marks its handles uncertain", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, "run.A", { turnKey: "a0" }),
      delegationEdge(root, "run.B", { turnKey: "b0", parentKey: "a0" }),
      handbackEdge("run.A", root, { turnKey: "hA1", parentKey: "b0" }),
      handbackEdge("run.B", root, { turnKey: "hB1", parentKey: "hA1" }),
      communicationEdge(root, "run.A", { turnKey: "mA2", parentKey: "hB1" }),
      communicationEdge("run.A", "run.B", { turnKey: "xA" }),
    ]);
    expect(worldlineCompare(live(), root, "run.B")).toBe("before");
    expect(replay.skipped.map((s) => [s.turnKey, s.reason])).toEqual([["xA", "order-unlinked"]]);
    expect(replay.uncertain).toEqual(expect.arrayContaining(["run.A", "run.B"]));
  });

  test("a main chain linking every main event replays the live registry exactly", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, "run.A", { turnKey: "a0" }),
      delegationEdge(root, "run.B", { turnKey: "b0", parentKey: "a0" }),
      handbackEdge("run.A", root, { turnKey: "hA1", parentKey: "b0" }),
      handbackEdge("run.B", root, { turnKey: "hB1", parentKey: "hA1" }),
      communicationEdge(root, "run.A", { turnKey: "mA2", parentKey: "hB1" }),
      communicationEdge("run.A", "run.B", { turnKey: "xA", parentKey: "mA2" }),
    ]);
    expect(replay.skipped).toEqual([]);
    expect(replay.uncertain).toEqual([]);
    expect(replay.causal).toEqual(live());
  });

  test("two unlinked messages from one sender name a gap rather than an order taken from their content", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, "run.a", { turnKey: "a0" }),
      delegationEdge(root, "run.b", { turnKey: "b0", parentKey: "a0" }),
      communicationEdge(root, "run.a", { turnKey: "m1", parentKey: "b0" }),
      communicationEdge(root, "run.b", { turnKey: "m2", parentKey: "b0" }),
    ]);
    expect(replay.skipped.map((s) => s.reason)).toEqual(["order-unlinked"]);
    expect(replay.uncertain.length).toBeGreaterThan(0);
  });

  test("a retirement carries its turn key: an exchange linked after it finds the spirit gone", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, child, { turnKey: "s0" }),
      communicationEdge(root, child, { turnKey: "m1", parentKey: "r1" }),
    ], [retireClose(root, child, undefined, "s0", "r1")]);
    expect(replay.skipped.map((s) => [s.turnKey, s.reason])).toEqual([["m1", "target-unspawned"]]);
    expect(worldlineStampFor(replay.causal, child)).toBeUndefined();
  });

  test("a spawn from a parent the record never holds refuses, and seeds no second full-ownership root", () => {
    const replay = replayWorldlineEdges(root, [delegationEdge("elsewhere", "elsewhere.c", { turnKey: "e0" })]);
    expect(replay.skipped.map((s) => s.reason)).toEqual(["parent-unrecorded"]);
    expect(Object.keys(replay.causal.stamps)).toHaveLength(1);
  });
});

describe("replay refuses the unlinked event and scales with the feed", () => {
  test("an unlinked sibling message gives way to a linked handback, and the main chain stands whole", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, "run.A", { turnKey: "sA" }),
      delegationEdge(root, "run.B", { turnKey: "sB", parentKey: "sA" }),
      handbackEdge("run.A", root, { turnKey: "hA", parentKey: "sB" }),
      delegationEdge(root, "run.C", { turnKey: "sC", parentKey: "hA" }),
      delegationEdge(root, "run.D", { turnKey: "sD", parentKey: "sC" }),
      handbackEdge("run.D", root, { turnKey: "hD", parentKey: "sD" }),
      communicationEdge("run.A", "run.B", { turnKey: "m1" }),
    ]);
    expect(replay.skipped.map((s) => [s.turnKey, s.reason])).toEqual([["m1", "order-unlinked"]]);
    expect(worldlineStampFor(replay.causal, "run.D")).toBeDefined();
  });

  // The link checks cost each event its neighbours on a handle. ITC itself grows a parent's id and event
  // trees with every live child it holds, so a fan of thousands of never-retired spirits costs each op that
  // depth; the budget reads this session's own feed scale (about 1700 events) with room to spare.
  test("a two-thousand-event main chain over 666 live spirits replays inside two seconds", () => {
    const opens = [];
    let prev: string | undefined;
    let k = 0;
    for (let i = 0; i < 666; i++) {
      const h = `run.s${i}`;
      for (const make of [
        (p?: string) => delegationEdge(root, h, { turnKey: `k${++k}`, ...(p ? { parentKey: p } : {}) }),
        (p?: string) => handbackEdge(h, root, { turnKey: `k${++k}`, ...(p ? { parentKey: p } : {}) }),
        (p?: string) => communicationEdge(root, h, { turnKey: `k${++k}`, ...(p ? { parentKey: p } : {}) }),
      ]) { const e = make(prev); opens.push(e); prev = e.turnKey; }
    }
    const t0 = performance.now();
    const replay = replayWorldlineEdges(root, opens);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(replay.skipped).toEqual([]);
  });
});
