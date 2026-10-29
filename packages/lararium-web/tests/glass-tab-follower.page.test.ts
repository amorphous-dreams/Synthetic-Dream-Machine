/**
 * The follower half of the multi-tab topology (G4): a tab that finds the leader lock held follows the leader over the bus,
 * learns the leader's lend (the surface, the actor and the engine inputs) from the ready that answers its hello, and
 * stands its own mirror from it; a hello that arrives before the leader can lend parks and is answered once it lends;
 * a widen rewrites the remembered open so a successor opens the port at the width the mirror reached; and a follower
 * whose lock request grants leads next, serves the rest through a second channel object, and its own doors re-hello
 * to it so its mirror never tears down.
 */
import { expect, test } from "vitest";
import { makeFollowerDoors, serveFollowers } from "../src/glass/tab-bus.js";
import { standTabTopology } from "../src/glass/topology.js";

const channel = () => `follower-${crypto.randomUUID()}`;
const lockName = () => `follower-lock:${crypto.randomUUID()}`;
const inputs = { coreCid: "c".repeat(64), pluginCids: ["p".repeat(64)] };
const open = { type: "port:open", portId: "p", wikiUri: "wiki", width: "skinny", actor: "a", maxRecordBytes: 4096, maxBatchBytes: 8192 };
/** The leader's real doors, recording each placement; `next(n)` resolves once n more placements have landed (the product's own event, no deadline). */
function leaderDoors() {
  const placed: Array<{ surface: string; binding: string; msg: Record<string, unknown> }> = [];
  const waiters = new Set<() => void>();
  const next = (n = 1) => { const until = placed.length + n; return new Promise<void>(resolve => { const check = () => { if (placed.length >= until) { waiters.delete(check); resolve(); } }; waiters.add(check); check(); }); };
  return { placed, next, doors: { place(surface: string, binding: string, msg: unknown) { placed.push({ surface, binding, msg: msg as Record<string, unknown> }); for (const waiter of [...waiters]) waiter(); return { ok: true as const }; }, close() {} } };
}

test("a hello before the leader lends parks and is answered once it lends; CONTROL a hello after is answered at once", async () => {
  const name = channel(); const leaderBus = new BroadcastChannel(name); const tabBus = new BroadcastChannel(name);
  const l = leaderDoors();
  let lend: { surface: string; actor: string; inputs: typeof inputs } | null = null;
  const served = serveFollowers(leaderBus, l.doors, () => lend);
  const follower = makeFollowerDoors(tabBus, "early");
  const lends: unknown[] = [];
  follower.onLend(value => lends.push(value));
  try {
    await new Promise<void>(resolve => follower.onParked(resolve));   // the leader took the hello and parked it: the product's own event, no deadline
    expect(lends).toEqual([]);                                   // nothing to lend yet: no ready went out
    lend = { surface: "wiki", actor: "did:leader", inputs };
    const answered = new Promise<unknown>(resolve => follower.onLend(resolve));
    served.lend();                                               // the leader's surface stands: the parked hello is answered
    expect(await answered).toEqual({ surface: "wiki", actor: "did:leader", inputs });
    expect(lends).toEqual([{ surface: "wiki", actor: "did:leader", inputs }]);
    expect(follower.lent()).toEqual({ surface: "wiki", actor: "did:leader", inputs });
    const lateBus = new BroadcastChannel(name);
    const late = makeFollowerDoors(lateBus, "late");            // CONTROL: a hello after the lend stands is answered at once
    expect(await new Promise<unknown>(resolve => late.onLend(resolve))).toEqual({ surface: "wiki", actor: "did:leader", inputs });
    late.dispose(); lateBus.close();
  } finally { follower.dispose(); served.close(); leaderBus.close(); tabBus.close(); }
});

test("a widen rewrites the remembered open so a successor opens the port at the width the mirror reached", async () => {
  const name = channel(); const busA = new BroadcastChannel(name); const busB = new BroadcastChannel(name); const tabBus = new BroadcastChannel(name);
  const a = leaderDoors(); const b = leaderDoors();
  const lend = { surface: "wiki", actor: "did:leader", inputs };
  const servedA = serveFollowers(busA, a.doors, () => lend);
  const follower = makeFollowerDoors(tabBus, "t");
  let servedB: ReturnType<typeof serveFollowers> | null = null;
  try {
    await new Promise<void>(resolve => follower.onReady(resolve));
    const twoPlaced = a.next(2);
    follower.place("wiki", "b", open);
    follower.place("wiki", "b", { type: "port:widen", portId: "p", width: "full" });
    await twoPlaced;
    expect(a.placed.map(p => p.msg.type)).toEqual(["port:open", "port:widen"]);
    servedA.close();
    const reopened = b.next();
    servedB = serveFollowers(busB, b.doors, () => lend);        // the successor announces itself; the follower re-hellos and re-opens
    await reopened;
    expect(b.placed.map(p => [p.msg.type, p.msg.width])).toEqual([["port:open", "full"]]);
  } finally { follower.dispose(); servedA.close(); servedB?.close(); busA.close(); busB.close(); tabBus.close(); }
});

test("a tab that finds the leader lock held follows and leads once it releases; its own doors re-hello to its own serve", async () => {
  const name = channel(); const lock = lockName();
  const lend = { surface: "wiki", actor: "did:leader", inputs };
  const first = standTabTopology({ locks: navigator.locks, lockName: lock, channel: () => new BroadcastChannel(name), tabId: "first" });
  const second = standTabTopology({ locks: navigator.locks, lockName: lock, channel: () => new BroadcastChannel(name), tabId: "second" });
  const a = leaderDoors(); const b = leaderDoors();
  try {
    await new Promise<void>(resolve => first.onLead(resolve));
    expect(first.role).toBe("leader");
    expect(second.role).toBe("follower");
    first.serve(a.doors, () => lend);
    const lent = await new Promise<unknown>(resolve => second.follower.onLend(resolve));
    expect(lent).toEqual(lend);
    const placedOnA = a.next();
    second.follower.place("wiki", "b", open);
    await placedOnA;
    expect(a.placed.map(p => [p.binding, p.msg.type])).toEqual([["tab:second:b", "port:open"]]);
    const leads = new Promise<void>(resolve => second.onLead(resolve));
    first.close();                                               // the first tab goes: its lock releases and its serve closes
    await leads;
    expect(second.role).toBe("leader");
    const placedOnB = b.next();
    second.serve(b.doors, () => lend);                           // the successor serves through a second channel object...
    await placedOnB;
    expect(b.placed.map(p => [p.binding, p.msg.type])).toEqual([["tab:second:b", "port:open"]]);   // ...and its own doors re-opened through it
  } finally { second.close(); first.close(); }
});
