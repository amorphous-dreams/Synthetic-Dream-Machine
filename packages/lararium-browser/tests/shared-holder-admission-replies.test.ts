/** The claimant carries only replies to asks its island actually made while the gate proves the face. */
import { describe, expect, test } from "vitest";
import { signHolderSessionProof } from "../../lararium-mesh/src/holder-session-proof.js";
import { makeSharedHolderCore, type HolderIsland, type HolderRepo } from "../src/shared-holder-core.js";
import { admitPort, faceFixture, fakePort, type Message } from "./holder-session-fixture.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function rig(makeRepo?: () => Promise<HolderRepo>) {
  const islands: Array<{ posts: Message[]; emit: (message: Message) => void; terminated: number }> = [];
  const spawned = deferred<(typeof islands)[number]>();
  let stopped = 0;
  const core = makeSharedHolderCore({
    lockName: "admission-replies", locks: { request: async (_name, _options, callback) => callback({ name: "admission-replies" }) },
    makeRepo: async () => makeRepo ? makeRepo() : { shutdown: async () => { stopped++; } },
    spawnIsland: (): HolderIsland => {
      const listeners = new Set<(message: unknown) => void>();
      const record = { posts: [] as Message[], terminated: 0,
        emit: (message: Message) => { for (const listen of listeners) listen(message); } };
      islands.push(record); spawned.resolve(record);
      return { post: (message) => { record.posts.push(message as Message); }, listen: (listen) => { listeners.add(listen); return () => listeners.delete(listen); },
        onError: () => () => {}, terminate: () => { record.terminated++; } };
    },
    onDrop: () => {},
  });
  const connect = async () => { const tab = fakePort(); await core.connect(tab.endpoint); return tab; };
  return { core, islands, spawned: spawned.promise, connect, get stopped() { return stopped; } };
}
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe("the claimant's admission replies", () => {
  test("a correlated cas block crosses once; unknown, duplicate and dyad answers refuse before the gate", async () => {
    const h = rig(); const face = await faceFixture("face:reply");
    const tab = await h.connect(); void admitPort(tab, face);
    const island = await h.spawned;
    island.emit({ type: "cas:want", requestId: "r1" });
    expect(tab.messages("cas:want")).toHaveLength(1);
    tab.send({ type: "cas:block", requestId: "r1", block: "good" });
    expect(island.posts.filter((m) => m.type === "cas:block" && m.requestId === "r1"), "the correlated boot reply crosses").toHaveLength(1);
    tab.send({ type: "cas:block", requestId: "r1", block: "replay" });
    tab.send({ type: "cas:block", requestId: "never-issued", block: "stray" });
    tab.send({ type: "dyad:read", requestId: "r1", standing: "clear" });
    expect(island.posts.filter((m) => m.type === "cas:block"), "each issued request accepts one answer").toHaveLength(1);
    expect(island.posts.filter((m) => m.type === "dyad:read"), "the claimant cannot answer the island's dyad").toHaveLength(0);
    expect(tab.messages("holder:refused").at(-1)).toMatchObject({ cause: "session-unadmitted" });
  });

  test("two valid opens on one port join one house while Repo creation waits", async () => {
    const held = deferred<void>(); let stops = 0;
    const h = rig(async () => { await held.promise; return { shutdown: async () => { stops++; } }; });
    const face = await faceFixture("face:one");
    const other = await faceFixture("face:two", 42, 52);
    const tab = await h.connect();
    const signature = async (which: typeof face) => {
      const hello = tab.hello();
      return signHolderSessionProof(which.atom, { ownerEpoch: hello.ownerEpoch, sessionId: hello.sessionId, nonce: hello.nonce, personaGroup: which.group });
    };
    const first = await signature(face), second = await signature(other);
    tab.send({ type: "session:open", personaGroup: face.group, edge: face.edge, signature: first });
    await tick();
    tab.send({ type: "session:open", personaGroup: other.group, edge: other.edge, signature: second });
    expect(tab.messages("holder:refused").at(-1), "the second open refuses while the first waits").toMatchObject({ cause: "session-open-malformed" });
    held.resolve();
    const island = await h.spawned;
    expect(h.islands, "one port boots one island").toHaveLength(1);
    h.core.disconnect(tab.endpoint); await tick();
    expect(island.terminated, "closing the port ends its sole house once").toBe(1);
    expect(stops).toBe(1);
  });

  test("control: one open admits after its island clears the gate", async () => {
    const h = rig(); const face = await faceFixture("face:single"); const tab = await h.connect();
    const opening = admitPort(tab, face);
    const island = await h.spawned;
    const { deviceEdgeDigest } = await import("../../lararium-mesh/src/device-delegation.js");
    island.emit({ type: "gate:clear", edgeDigest: deviceEdgeDigest(face.edge), personaRoot: face.edge.personaRootDid });
    expect(await opening).toMatchObject({ kind: "holder:admitted" });
  });
});
