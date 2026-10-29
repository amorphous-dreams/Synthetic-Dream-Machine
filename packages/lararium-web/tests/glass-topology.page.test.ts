import { describe, expect, test } from "vitest";
import { electLeader } from "../src/glass/leader.js";
import { makeFollowerDoors, serveFollowers } from "../src/glass/tab-bus.js";
import { makeGlassPortAdaptor } from "../../lararium-tw5/src/glass-port-adaptor.js";

const lockName = () => `glass-topology:${crypto.randomUUID()}`;
const channelName = () => `glass-bus:${crypto.randomUUID()}`;
const turn = () => new Promise<void>(resolve => queueMicrotask(resolve));
function leads(election: ReturnType<typeof electLeader>) {
  return new Promise<() => void>(resolve => election.onLeader(resolve));
}

function wiki() {
  const records = new Map<string, { fields: Record<string, unknown> }>();
  const listeners = new Set<(changes: Record<string, unknown>) => void>();
  return {
    getTiddler: (title: string) => records.get(title),
    addTiddler(raw: unknown) {
      const value = raw as { fields: Record<string, unknown> };
      const title = String(value.fields.title);
      records.set(title, value);
      for (const listener of listeners) listener({ [title]: {} });
    },
    deleteTiddler(title: string) { records.delete(title); for (const listener of listeners) listener({ [title]: {} }); },
    addEventListener(_type: "change", listener: (changes: Record<string, unknown>) => void) { listeners.add(listener); },
    removeEventListener(_type: "change", listener: (changes: Record<string, unknown>) => void) { listeners.delete(listener); },
  };
}
class Tiddler { constructor(readonly fields: Record<string, unknown>) {} }

function vessel() {
  const records = new Map<string, Record<string, string>>([["Seed", { text: "first" }]]);
  const applied = new Set<string>();
  const echoes: string[] = [];
  const received: string[] = [];
  const writeWaiters = new Set<() => void>();
  let reply: (binding: string, island: string, msg: unknown) => void = () => {};
  let holdWritten = false;
  const doors = {
    place(_surface: string, binding: string, raw: unknown) {
      const msg = raw as { type: string; portId: string; txId?: string; records?: Array<{ title: string; fields: Record<string, string> }> };
      if (msg.type === "port:open") queueMicrotask(() => reply(binding, "island", {
        type: "port:snapshot", portId: msg.portId, snapshotId: crypto.randomUUID(), i: 1, n: 1,
        records: [...records].map(([title, fields]) => ({ title, fields })),
      }));
      if (msg.type === "port:write" && msg.txId && msg.records) {
        received.push(msg.txId);
        for (const waiter of writeWaiters) waiter();
        writeWaiters.clear();
        if (!applied.has(msg.txId)) {
          applied.add(msg.txId);
          for (const record of msg.records) records.set(record.title, record.fields);
          echoes.push(msg.txId);
        }
        if (!holdWritten) queueMicrotask(() => reply(binding, "island", { type: "port:written", portId: msg.portId,
          txId: msg.txId, status: "applied", applied: msg.records!.map(record => record.title) }));
      }
      return { ok: true as const };
    },
    close(_binding: string) {},
  };
  return { doors, records, applied, echoes, received,
    nextWrite() { return new Promise<void>(resolve => writeWaiters.add(resolve)); },
    attach(callback: typeof reply) { reply = callback; }, hold(value: boolean) { holdWritten = value; } };
}

function follower(bus: BroadcastChannel, tab: string) {
  const doors = makeFollowerDoors(bus, tab);
  const localWiki = wiki();
  const listeners = new Set<(msg: any) => void>();
  doors.onPortMessage((_binding, msg) => { for (const listener of listeners) listener(msg); });
  let tx = 0;
  const adaptor = makeGlassPortAdaptor({ wiki: localWiki, Tiddler, portId: tab, wikiUri: "wiki", actor: tab,
    width: "full", mintTx: () => `${tab}:${++tx}`,
    transport: { send(msg) { return doors.place("surface", tab, msg); }, onMessage(listener) { listeners.add(listener); return () => listeners.delete(listener); } } });
  doors.onReady(() => adaptor.resendPending());
  return { doors, wiki: localWiki, adaptor };
}

describe("glass topology on Web Locks and BroadcastChannel", () => {
  test("one leader holds the lock until release; CONTROL one successor leads", async () => {
    const name = lockName();
    const a = electLeader({ locks: navigator.locks, name });
    const releaseA = await leads(a);
    const b = electLeader({ locks: navigator.locks, name });
    const c = electLeader({ locks: navigator.locks, name });
    await turn();
    expect([a, b, c].filter(tab => tab.isLeader())).toHaveLength(1);
    const next = Promise.race([leads(b), leads(c)]);
    releaseA();
    const releaseNext = await next;
    expect([a, b, c].filter(tab => tab.isLeader())).toHaveLength(1);
    releaseNext(); b.stepDown(); c.stepDown();
  });

  test("glass-late-tab-gets-snapshot; CONTROL an early tab gets one too", async () => {
    const name = channelName();
    const leaderBus = new BroadcastChannel(name);
    const firstBus = new BroadcastChannel(name);
    const stub = vessel();
    const election = electLeader({ locks: navigator.locks, name: lockName() });
    const release = await leads(election);
    const served = serveFollowers(leaderBus, stub.doors, () => "wiki");
    stub.attach(served.onPortMessage);
    const early = follower(firstBus, "early");
    await new Promise<void>(resolve => early.doors.onReady(resolve));
    await new Promise<void>(resolve => early.adaptor.onLanded(({ title }) => { if (title === "Seed") resolve(); }));
    const wrote = stub.nextWrite();
    early.wiki.addTiddler(new Tiddler({ title: "New", text: "written" }));
    await wrote;
    const lateBus = new BroadcastChannel(name);
    const late = follower(lateBus, "late");
    await new Promise<void>(resolve => late.adaptor.onLanded(({ title }) => { if (title === "New") resolve(); }));
    expect(early.wiki.getTiddler("Seed")?.fields.text).toBe("first");
    expect(late.wiki.getTiddler("New")?.fields.text).toBe("written");
    early.adaptor.close(); late.adaptor.close(); served.close(); release(); firstBus.close(); lateBus.close(); leaderBus.close();
  });

  test("glass-leader-handoff-mid-write; CONTROL one write settles without handoff", async () => {
    const name = channelName();
    const busA = new BroadcastChannel(name), busB = new BroadcastChannel(name), busF = new BroadcastChannel(name);
    const stub = vessel();
    const lock = lockName();
    const a = electLeader({ locks: navigator.locks, name: lock });
    const releaseA = await leads(a);
    let served = serveFollowers(busA, stub.doors, () => "wiki");
    stub.attach(served.onPortMessage);
    const b = electLeader({ locks: navigator.locks, name: lock });
    const nextLeader = new Promise<void>(resolve => b.onLeader(() => {
      served = serveFollowers(busB, stub.doors, () => "wiki");
      stub.attach(served.onPortMessage);
      resolve();
    }));
    const f = follower(busF, "follower");
    await new Promise<void>(resolve => f.adaptor.onLanded(({ title }) => { if (title === "Seed") resolve(); }));
    const controlWritten = new Promise<void>(resolve => f.doors.onPortMessage((_binding, msg) => {
      if ((msg as { type?: string; txId?: string }).type === "port:written" && (msg as { txId?: string }).txId === "follower:1") resolve();
    }));
    const controlWrite = stub.nextWrite();
    f.wiki.addTiddler(new Tiddler({ title: "Control", text: "one" }));
    await controlWrite;
    await controlWritten;
    expect(stub.echoes).toHaveLength(1);
    stub.hold(true);
    const heldWrite = stub.nextWrite();
    f.wiki.addTiddler(new Tiddler({ title: "Mid", text: "write" }));
    await heldWrite;
    expect(stub.echoes).toHaveLength(2);
    served.close();
    stub.hold(false);
    releaseA();
    await nextLeader;
    const midWritten = new Promise<void>(resolve => f.doors.onPortMessage((_binding, msg) => {
      if ((msg as { type?: string; txId?: string }).type === "port:written" && (msg as { txId?: string }).txId === "follower:2") resolve();
    }));
    await midWritten;
    expect(stub.applied.size).toBe(2);
    expect(stub.echoes).toEqual(["follower:1", "follower:2"]);
    expect(stub.received.filter(tx => tx === "follower:2")).toHaveLength(2);
    f.adaptor.resendPending();
    await turn();
    expect(stub.received.filter(tx => tx === "follower:2")).toHaveLength(2);
    expect(f.wiki.getTiddler("Mid")?.fields.text).toBe("write");
    f.adaptor.close(); served.close(); b.stepDown(); busA.close(); busB.close(); busF.close();
  });
});
