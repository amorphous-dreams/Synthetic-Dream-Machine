/**
 * vessel-port — the page's road to the vessel worker reads each vessel message onto the page callback it replaces, and
 * carries the page's acts across as typed messages (browser-vessel-lift slice 2). A fake worker stands in for the vessel.
 */
import { expect, test } from "vitest";
import { standVesselPort, VesselRefused, type VesselWorkerLike } from "../src/vessel-port.js";
import type { PageToVessel, VesselToPage } from "../src/vessel-protocol.js";

function fakeWorker() {
  const sent: Array<{ msg: PageToVessel; transfer: Transferable[] }> = [];
  const listeners: Array<(e: MessageEvent) => void> = [];
  const worker: VesselWorkerLike = {
    postMessage(msg: PageToVessel, transfer: Transferable[] = []) { sent.push({ msg, transfer }); },
    addEventListener(type: string, listener: (e: never) => void) { if (type === "message") listeners.push(listener as (e: MessageEvent) => void); },
    terminate() {},
  };
  const say = (msg: VesselToPage): void => { for (const l of listeners) l(new MessageEvent("message", { data: msg })); };
  return { worker, sent, say };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test("a vessel placement refusal reads as the binding's own refusal, and a refused open as its port gone; CONTROL: a refused write carries no port:gone", () => {
  const { worker, say } = fakeWorker();
  const got: Array<[string, unknown]> = [];
  standVesselPort(worker, { onPortMessage: (binding, _key, msg) => got.push([binding, msg]) });
  say({ t: "port:refused", binding: "b1", reason: "no-live-island", opening: true, portId: "p1" });
  expect(got).toEqual([
    ["b1", { type: "transport:refused", reason: "no-live-island", binding: "b1" }],
    ["b1", { type: "port:gone", portId: "p1", reason: "no-live-island", binding: "b1" }],
  ]);
  got.length = 0;
  say({ t: "port:refused", binding: "b1", reason: "port-unleased", opening: false });
  expect(got).toEqual([["b1", { type: "transport:refused", reason: "port-unleased", binding: "b1" }]]);
});

test("RED: an ask crosses as public words and the page posts no answer; the ceremony's port crosses transferred, and a refusal crosses by name", async () => {
  const { worker, sent, say } = fakeWorker();
  const asked: unknown[] = [];
  const settled: string[] = [];
  const port = standVesselPort(worker, { onAsk: (ask) => { asked.push(ask); }, onAskSettled: (id) => { settled.push(id); } });
  say({ t: "ask", askId: "a1", kind: "unlock", act: "boot", words: "attempt 1 of 3" });
  await tick();
  expect(asked).toEqual([{ askId: "a1", kind: "unlock", act: "boot", words: "attempt 1 of 3" }]);
  expect(sent, "the page answers nothing on the vessel's port").toEqual([]);
  const channel = new MessageChannel();
  port.ceremonyPort("a1", channel.port1);
  expect(sent).toEqual([{ msg: { t: "ceremony:port", askId: "a1", port: channel.port1 }, transfer: [channel.port1] }]);
  port.ceremonyRefused("a2", "ceremony-broker-absent");
  expect(sent.at(-1)?.msg).toEqual({ t: "ceremony:refused", askId: "a2", refusal: "ceremony-broker-absent" });
  say({ t: "ask:settled", askId: "a1" });
  expect(settled).toEqual(["a1"]);
});

test("a read resolves on its own reply, a refusal rejects with the vessel's named refusal, and a reply for no call goes nowhere", async () => {
  const { worker, sent, say } = fakeWorker();
  const port = standVesselPort(worker, {});
  const inputs = port.mirrorInputs("lares");
  const join = port.joinOffer("{}", false);
  const [read, offer] = sent.map((s) => s.msg) as [Extract<PageToVessel, { t: "read:mirror-inputs" }>, Extract<PageToVessel, { t: "join:offer" }>];
  expect(read).toMatchObject({ t: "read:mirror-inputs", surface: "lares" });
  expect(offer).toMatchObject({ t: "join:offer", text: "{}", abandonPending: false });
  say({ t: "reply", callId: "nobody", ok: true, value: 1 });
  say({ t: "reply", callId: offer.callId, ok: false, error: { name: "BrowserFleetJoinRefused", message: "pending", refusal: "join-pending" } });
  say({ t: "reply", callId: read.callId, ok: true, value: { coreCid: "c", pluginCids: [] } });
  await expect(inputs).resolves.toEqual({ coreCid: "c", pluginCids: [] });
  const refused = await join.catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(VesselRefused);
  expect((refused as VesselRefused).refusal).toBe("join-pending");
});

test("the page's acts cross as typed messages: a control event, a surface switch, a placement (answered at once) and a close", () => {
  const { worker, sent } = fakeWorker();
  const port = standVesselPort(worker, {});
  const ev = { type: "lar:control-event", eventId: "e" } as never;
  port.sendControlEvent("lares", ev);
  port.setActiveSurface("daemon");
  expect(port.ports.place("lares", "b", { type: "port:open" })).toEqual({ ok: true });
  port.ports.close("b");
  port.pageLife("hidden");
  expect(sent.map((s) => s.msg)).toEqual([
    { t: "control-event", surface: "lares", ev },
    { t: "set-surface", surface: "daemon" },
    { t: "port:place", surface: "lares", binding: "b", msg: { type: "port:open" } },
    { t: "port:close", binding: "b" },
    { t: "page:life", life: "hidden" },
  ]);
});

test("the holder's spawn transfers the built SharedWorker's port and never reads it; a page that builds none answers refused", () => {
  const built = fakeWorker();
  const channel = new MessageChannel();
  standVesselPort(built.worker, { spawnHolder: () => ({ port: channel.port1, onError() {} }) });
  built.say({ t: "spawn", spawnId: "s1", role: "holder", url: "http://h/holder.js", name: "house" });
  expect(built.sent).toHaveLength(1);
  expect(built.sent[0]!.msg).toEqual({ t: "spawned", spawnId: "s1", port: channel.port1 });
  expect(built.sent[0]!.transfer).toEqual([channel.port1]);

  const none = fakeWorker();
  standVesselPort(none.worker, { spawnHolder: () => null });
  none.say({ t: "spawn", spawnId: "s2", role: "holder", url: "http://h/holder.js", name: "house" });
  expect(none.sent.map((s) => s.msg)).toEqual([{ t: "spawned", spawnId: "s2", refused: "this page builds no SharedWorker" }]);
});

test("the crossing reads the vessel's last report, and a listener hears each new one", () => {
  const { worker, say } = fakeWorker();
  const port = standVesselPort(worker, {});
  expect(port.connectionState.getSnapshot()).toEqual({ status: "local" });
  const heard: unknown[] = [];
  port.connectionState.subscribe((s) => heard.push(s));
  say({ t: "status", status: { connection: { status: "floor", reason: "no pin" } } });
  expect(port.connectionState.getSnapshot()).toEqual({ status: "floor", reason: "no pin" });
  expect(heard).toEqual([{ status: "floor", reason: "no pin" }]);
});

test("RED: the greeting's session holds its lifetime lock before it says armed, a ping answers pong, and a refused owner crosses by name — CONTROL: no lock, no armed", async () => {
  const { worker, sent, say } = fakeWorker();
  const held: string[] = [];
  let release: (() => void) | null = null;
  const locks = { request: (name: string, callback: () => Promise<unknown>) => { held.push(name); const p = callback(); release = () => undefined; return p; } };
  const greeted: unknown[] = [];
  const ended: unknown[] = [];
  const port = standVesselPort(worker, { onGreeting: (g) => greeted.push(g), onEnded: (why, stage, refusal) => ended.push({ why, stage, refusal }) }, { locks });
  say({ t: "greeting", ownerEpoch: "e1", sessionId: "s1", lifetimeLock: "lares:vessel-session:s1" });
  await tick();
  expect(held).toEqual(["lares:vessel-session:s1"]);
  expect(sent.map((s) => s.msg)).toEqual([{ t: "session:armed", sessionId: "s1" }]);
  expect(port.greeting()).toEqual({ ownerEpoch: "e1", sessionId: "s1", lifetimeLock: "lares:vessel-session:s1" });
  expect(greeted).toHaveLength(1);
  say({ t: "ping", n: 7 });
  expect(sent.at(-1)?.msg).toEqual({ t: "pong", n: 7 });
  say({ t: "ended", why: "this vessel worker cannot own the store", stage: "open", refusal: "store-owned" });
  expect(ended).toEqual([{ why: "this vessel worker cannot own the store", stage: "open", refusal: "store-owned" }]);
  expect(release).not.toBeNull();

  const bare = fakeWorker();
  standVesselPort(bare.worker, {}, { locks: null });
  bare.say({ t: "greeting", ownerEpoch: "e1", sessionId: "s2", lifetimeLock: "lares:vessel-session:s2" });
  await tick();
  expect(bare.sent, "CONTROL: a page with no Web Locks says no armed it cannot hold").toEqual([]);
});

test("a hello names an earlier greeting only when the page hands one", () => {
  const { worker, sent } = fakeWorker();
  const port = standVesselPort(worker, {}, { locks: null });
  const boot = { idbName: "x" } as unknown as Parameters<typeof port.hello>[0];
  port.hello(boot);
  port.hello(boot, { ownerEpoch: "e0", sessionId: "s0" });
  expect((sent[0]!.msg as { resume?: unknown }).resume).toBeUndefined();
  expect((sent[1]!.msg as { resume?: unknown }).resume).toEqual({ ownerEpoch: "e0", sessionId: "s0" });
});
