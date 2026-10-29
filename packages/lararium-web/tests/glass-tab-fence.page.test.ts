import { expect, test } from "vitest";
import { serveFollowers } from "../src/glass/tab-bus.js";

const channel = () => `fence-${crypto.randomUUID()}`;
const open = { type: "port:open", portId: "p", wikiUri: "wiki", width: "skinny", actor: "a", maxRecordBytes: 4096, maxBatchBytes: 8192 };
/** The leader's real doors, recording which surface each placement names. */
function leaderDoors() {
  const placed: Array<{ surface: string; binding: string; type: string }> = [];
  return { placed, doors: { place(surface: string, binding: string, msg: unknown) { placed.push({ surface, binding, type: (msg as { type: string }).type }); return { ok: true as const }; }, close() {} } };
}
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 30));   // BroadcastChannel delivers on a task; the test waits for that delivery, not for a deadline

test("a forged follower frame naming the daemon surface opens no port there; the leader binds its own surface", async () => {
  const name = channel(); const leaderBus = new BroadcastChannel(name); const tab = new BroadcastChannel(name);
  const l = leaderDoors();
  const served = serveFollowers(leaderBus, l.doors, () => "lares");
  try {
    tab.postMessage({ kind: "hello", tab: "t1", nonce: "n1" });
    await settle();
    tab.postMessage({ kind: "port-up", tab: "t1", binding: "b", surface: "daemon", msg: open });
    await settle();
    expect(l.placed.map(p => p.surface)).toEqual(["lares"]);                      // the frame's own value is ignored
  } finally { served.close(); leaderBus.close(); tab.close(); }
});
test("a port-up from a tab that never said hello places nothing; CONTROL: after hello the same frame places", async () => {
  const name = channel(); const leaderBus = new BroadcastChannel(name); const tab = new BroadcastChannel(name);
  const l = leaderDoors();
  const served = serveFollowers(leaderBus, l.doors, () => "lares");
  try {
    tab.postMessage({ kind: "port-up", tab: "t2", binding: "b", surface: "lares", msg: open });
    await settle();
    expect(l.placed).toEqual([]);
    tab.postMessage({ kind: "hello", tab: "t2", nonce: "n2" }); await settle();
    tab.postMessage({ kind: "port-up", tab: "t2", binding: "b", surface: "lares", msg: open }); await settle();
    expect(l.placed).toHaveLength(1);
  } finally { served.close(); leaderBus.close(); tab.close(); }
});
test("no surface to bind (the leader shows none yet) places nothing", async () => {
  const name = channel(); const leaderBus = new BroadcastChannel(name); const tab = new BroadcastChannel(name);
  const l = leaderDoors();
  const served = serveFollowers(leaderBus, l.doors, () => null);
  try {
    tab.postMessage({ kind: "hello", tab: "t3", nonce: "n3" }); await settle();
    tab.postMessage({ kind: "port-up", tab: "t3", binding: "b", surface: "lares", msg: open }); await settle();
    expect(l.placed).toEqual([]);
  } finally { served.close(); leaderBus.close(); tab.close(); }
});
