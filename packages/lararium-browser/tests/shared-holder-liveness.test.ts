/** A tab's explicit close or released session lock ends only its own place in a face house. */
import { describe, expect, test } from "vitest";
import { deviceEdgeDigest } from "../../lararium-mesh/src/device-delegation.js";
import { makeSharedHolderCore, type HolderIsland } from "../src/shared-holder-core.js";
import { makeHolderRuntime } from "../src/shared-holder-runtime.js";
import { admitPort, faceFixture, fakePort, type Message } from "./holder-session-fixture.js";

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function islandRig() {
  const records: Array<{ emit(message: Message): void; terminated: number }> = [];
  const spawnIsland = (): HolderIsland => {
    const listeners = new Set<(message: unknown) => void>();
    const record = { emit: (message: Message) => { for (const listener of listeners) listener(message); }, terminated: 0 };
    records.push(record);
    return { post: () => {}, listen: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }, onError: () => () => {}, terminate: () => { record.terminated++; } };
  };
  return { records, spawnIsland };
}
async function admit(core: ReturnType<typeof makeSharedHolderCore>, island: ReturnType<typeof islandRig>, face: Awaited<ReturnType<typeof faceFixture>>) {
  const tab = fakePort(); await core.connect(tab.endpoint);
  const opening = admitPort(tab, face);
  await expect.poll(() => island.records.length).toBe(1);
  island.records[0]!.emit({ type: "gate:clear", edgeDigest: deviceEdgeDigest(face.edge), personaRoot: face.edge.personaRootDid });
  expect(await opening).toMatchObject({ kind: "holder:admitted" });
  return tab;
}
const holderLocks = { request: async (name: string, _opts: unknown, cb: (lock: { name: string }) => unknown) => cb({ name }) };

describe("the holder's session liveness", () => {
  test("session:close from an unadmitted port removes it without answering", async () => {
    const island = islandRig();
    const core = makeSharedHolderCore({ lockName: "liveness-unadmitted", locks: holderLocks, spawnIsland: island.spawnIsland, onDrop: () => {} });
    const tab = fakePort(); await core.connect(tab.endpoint);
    const replies = tab.received.length;
    tab.send({ type: "session:close" }); await settle();
    expect(core.tabs, "an unadmitted close releases its session").toBe(0);
    expect(tab.received, "session:close answers nothing").toHaveLength(replies);
    expect(island.records, "an unopened port boots no island").toHaveLength(0);
  });

  test("session:close from the last admitted tab ends its island and Repo once", async () => {
    const island = islandRig(); let shutdowns = 0;
    const core = makeSharedHolderCore({ lockName: "liveness-last", locks: holderLocks,
      spawnIsland: island.spawnIsland, makeRepo: () => ({ shutdown: async () => { shutdowns++; } }), onDrop: () => {} });
    const face = await faceFixture("face:liveness-last"); const tab = await admit(core, island, face);
    tab.send({ type: "session:close" }); await settle();
    expect(island.records[0]!.terminated, "the last tab's close terminates its island once").toBe(1);
    expect(shutdowns, "the last tab's close shuts its Repo once").toBe(1);
    expect(core.houses, "the last tab's close removes the house").toBe(0);
    tab.send({ type: "session:close" }); await settle();
    expect(shutdowns, "a duplicate close does not shut the Repo twice").toBe(1);
  });

  test("control: one of two tabs closes and the other keeps the house", async () => {
    const island = islandRig(); let shutdowns = 0;
    const core = makeSharedHolderCore({ lockName: "liveness-pair", locks: holderLocks,
      spawnIsland: island.spawnIsland, makeRepo: () => ({ shutdown: async () => { shutdowns++; } }), onDrop: () => {} });
    const face = await faceFixture("face:liveness-pair"); const first = await admit(core, island, face);
    const second = fakePort(); await core.connect(second.endpoint);
    expect(await admitPort(second, face)).toMatchObject({ kind: "holder:admitted" });
    first.send({ type: "session:close" }); await settle();
    expect(core.houses, "the second tab keeps the house").toBe(1);
    expect(island.records[0]!.terminated).toBe(0);
    expect(shutdowns).toBe(0);
    second.send({ type: "session:close" }); await settle();
    expect(core.houses).toBe(0);
  });

  test("the runtime watches the session Web Lock and closes when the fake host grants it", async () => {
    const island = islandRig(); let shutdowns = 0;
    const waiting = new Map<string, (lock: { name: string }) => unknown>();
    const locks = { request: async (name: string, _opts: unknown, cb: (lock: { name: string }) => unknown) => {
      if (name.startsWith("lares:holder-session:")) { waiting.set(name, cb); return; }
      return cb({ name });
    } };
    const runtime = makeHolderRuntime({ lockName: "liveness-runtime", locks, spawnIsland: island.spawnIsland,
      openRepo: () => ({ attachSide: () => {}, shutdown: async () => { shutdowns++; } }) });
    const face = await faceFixture("face:liveness-runtime");
    const tab = await admit(runtime.core, island, face);
    const sessionLock = `lares:holder-session:${tab.hello().sessionId}`;
    expect(waiting.has(sessionLock), "the runtime requests the tab's session lock once").toBe(true);
    expect(runtime.core.houses, "control: a lock that never grants leaves the session up").toBe(1);
    waiting.get(sessionLock)!({ name: sessionLock }); await settle();
    expect(island.records[0]!.terminated, "the granted lock ends the dead tab's island").toBe(1);
    expect(shutdowns).toBe(1);
    expect(runtime.core.houses).toBe(0);
  });
});
