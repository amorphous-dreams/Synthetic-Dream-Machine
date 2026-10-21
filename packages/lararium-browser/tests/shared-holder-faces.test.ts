import { describe, expect, test } from "vitest";
import { buildDeviceDelegation, type DeviceDelegationTiddler } from "../../lararium-mesh/src/device-delegation.js";
import { faceAtomKeyFromSeed, type FaceAtomKey } from "../../lararium-mesh/src/face-atom.js";
import { signHolderSessionProof } from "../../lararium-mesh/src/holder-session-proof.js";
import { makeSharedHolderCore, type HolderIsland, type HolderPort } from "../src/shared-holder-core.js";

type Envelope = { ownerEpoch: string; sessionId: string; generation: number };
type Hello = Envelope & { kind: "holder:hello"; nonce?: string };
type Message = Record<string, unknown>;
const A = "face:A";
const B = "face:B";

async function face(group: string, rootByte: number, atomByte: number) {
  const atom = faceAtomKeyFromSeed(new Uint8Array(32).fill(atomByte), group);
  const edge = await buildDeviceDelegation({
    personaRootSeed: new Uint8Array(32).fill(rootByte),
    atomSeed: new Uint8Array(32).fill(atomByte), hearthTrueName: "", boundEpoch: 1,
  });
  return { atom, edge };
}

function harness() {
  const spawned: string[] = [];
  const islands = new Map<string, {
    posts: Message[]; emit: (message: Message) => void; terminated: number;
  }>();
  const repos = new Map<string, { group: string; shutdown: () => Promise<void>; read: () => string; stops: number }>();
  const madeRepos: string[] = [];
  const waits: Array<{ kind: string; group: string; type: string }> = [];
  const spawnIsland = (personaGroup?: string, personaRoot?: string, edgeDigest?: string): HolderIsland => {
    const group = personaGroup ?? "unadmitted";
    spawned.push(group);
    const listeners = new Set<(message: unknown) => void>();
    const record = {
      posts: [] as Message[], terminated: 0,
      emit: (message: Message) => { for (const listener of listeners) listener(message); },
    };
    islands.set(group, record);
    // The island's Binding Gate clears for the edge the first session presented.
    queueMicrotask(() => record.emit({ type: "gate:clear", edgeDigest, personaRoot }));
    return {
      post: (message) => {
        const msg = message as Message;
        record.posts.push(msg);
        if (msg.type === "wiki:place-verb") record.emit({
          type: "wiki:verb-result", requestId: msg.requestId,
          result: { repo: repos.get(group)?.read() ?? "no-repo" },
        });
      },
      listen: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      onError: () => () => {},
      terminate: () => { record.terminated++; },
    };
  };
  const options = {
    lockName: "holder-faces-test",
    locks: { request: async (_name: string, _opts: { ifAvailable: true }, callback: (lock: { name: string } | null) => unknown) => callback({ name: "holder-faces-test" }) },
    spawnIsland,
    makeRepo: (group: string) => {
      madeRepos.push(group);
      const repo = { group, stops: 0, shutdown: async () => { repo.stops++; }, read: () => group };
      repos.set(group, repo);
      return repo;
    },
    onWait: (kind: "seal-awaits-session", group: string, type: string) => { waits.push({ kind, group, type }); },
    onDrop: () => {},
  };
  const core = makeSharedHolderCore(options);
  const port = () => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const received: Message[] = [];
    const waiters = new Set<(message: Message) => void>();
    const endpoint: HolderPort = {
      postMessage: (message) => { received.push(message as Message); for (const waiter of waiters) waiter(message as Message); },
      addEventListener: (_type, listener) => listeners.add(listener), start: () => {},
    };
    const hello = (): Hello => received.find((m) => m.kind === "holder:hello") as Hello;
    const envelope = (): Envelope => {
      const { ownerEpoch, sessionId, generation } = hello();
      return { ownerEpoch, sessionId, generation };
    };
    const send = (message: Message) => {
      for (const listener of listeners) listener({ data: { ...envelope(), ...message }, ports: [] } as unknown as MessageEvent);
    };
    const messages = (kind: string) => received.filter((m) => m.kind === kind || m.type === kind);
    // The holder's verdict on a session:open is the product's own event: the port waits on it, never on a clock.
    const verdict = (): Promise<Message> => new Promise((resolve) => {
      const waiter = (message: Message): void => {
        if (message.kind !== "holder:admitted" && message.kind !== "holder:refused") return;
        waiters.delete(waiter); resolve(message);
      };
      waiters.add(waiter);
    });
    return { endpoint, received, hello, envelope, send, messages, verdict };
  };
  const open = async (tab: ReturnType<typeof port>, group: string, edge: DeviceDelegationTiddler, atom: FaceAtomKey) => {
    const h = tab.hello();
    const signature = await signHolderSessionProof(atom, {
      ownerEpoch: h.ownerEpoch, sessionId: h.sessionId,
      nonce: h.nonce ?? "00", personaGroup: group,
    });
    const answered = tab.verdict();
    tab.send({ type: "session:open", personaGroup: group, edge, signature });
    await answered;
  };
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  return { core, port, open, settle, spawned, islands, repos, madeRepos, waits };
}

describe("the holder admits face sessions and houses each group", () => {
  test("R3a: a stranger's verb refuses; an admitted tab receives its result", async () => {
    const h = harness(); const tab = h.port(); await h.core.connect(tab.endpoint);
    tab.send({ type: "wiki:place-verb", requestId: "stranger", verb: "read" });
    expect([...h.islands.values()].flatMap((island) => island.posts)).toHaveLength(0);
    expect(tab.messages("holder:refused").at(-1)).toMatchObject({ cause: "session-unadmitted" });
    expect(tab.hello().nonce).toMatch(/^(?:[0-9a-f]{2})+$/);
    const a = await face(A, 41, 51);
    await h.open(tab, A, a.edge, a.atom);
    expect(tab.messages("holder:admitted").at(-1)).toMatchObject({ personaGroup: A, ...tab.envelope() });
    tab.send({ type: "wiki:place-verb", requestId: "admitted", verb: "read" });
    expect(h.islands.get(A)?.posts.at(-1)).toMatchObject({ type: "wiki:place-verb", verb: "read" });
    expect(tab.messages("wiki:verb-result").at(-1)).toMatchObject({ requestId: "admitted", result: { repo: A } });
  });

  test("R3b: a forged root half refuses while the whole edge admits", async () => {
    const h = harness(); const a = await face(A, 41, 51); const other = await face(A, 42, 51);
    const forged = h.port(); await h.core.connect(forged.endpoint);
    await h.open(forged, A, { ...a.edge, signature: other.edge.signature }, a.atom);
    expect(forged.messages("holder:refused").at(-1)).toMatchObject({ cause: "session-edge-invalid" });
    const valid = h.port(); await h.core.connect(valid.endpoint); await h.open(valid, A, a.edge, a.atom);
    expect(valid.messages("holder:admitted").at(-1)).toMatchObject({ personaGroup: A });
  });

  test("R3c: another atom's proof refuses while the edge's atom admits", async () => {
    const h = harness(); const a = await face(A, 41, 51); const wrong = await face(A, 41, 52);
    const forged = h.port(); await h.core.connect(forged.endpoint);
    await h.open(forged, A, a.edge, wrong.atom);
    expect(forged.messages("holder:refused").at(-1)).toMatchObject({ cause: "session-proof-invalid" });
    const valid = h.port(); await h.core.connect(valid.endpoint); await h.open(valid, A, a.edge, a.atom);
    expect(valid.messages("holder:admitted").at(-1)).toMatchObject({ personaGroup: A });
  });

  test("R3d: a claim under another root fills a house of its own; no pin blocks the real root", async () => {
    const h = harness(); const a = await face(A, 41, 51); const otherRoot = await face(A, 42, 52); const b = await face(B, 42, 53);
    const first = h.port(); await h.core.connect(first.endpoint); await h.open(first, A, a.edge, a.atom);
    const foreign = h.port(); await h.core.connect(foreign.endpoint); await h.open(foreign, A, otherRoot.edge, otherRoot.atom);
    expect(foreign.messages("holder:refused")).toHaveLength(0);
    expect(foreign.messages("holder:admitted").at(-1)).toMatchObject({ personaGroup: A });
    expect(h.spawned).toHaveLength(2);
    const sameRoot = h.port(); await h.core.connect(sameRoot.endpoint); await h.open(sameRoot, A, a.edge, a.atom);
    expect(sameRoot.messages("holder:admitted").at(-1)).toMatchObject({ personaGroup: A });
    const otherGroup = h.port(); await h.core.connect(otherGroup.endpoint); await h.open(otherGroup, B, b.edge, b.atom);
    expect(otherGroup.messages("holder:admitted").at(-1)).toMatchObject({ personaGroup: B });
  });

  test("R4a: each face boots one island and hears only its own island", async () => {
    const h = harness(); const a = await face(A, 41, 51); const b = await face(B, 42, 52);
    const a1 = h.port(); const a2 = h.port(); const b1 = h.port();
    for (const tab of [a1, a2, b1]) await h.core.connect(tab.endpoint);
    await h.open(a1, A, a.edge, a.atom); await h.open(a2, A, a.edge, a.atom); await h.open(b1, B, b.edge, b.atom);
    expect(h.spawned).toEqual([A, B]);
    h.islands.get(A)?.emit({ type: "event", marker: "from-A" });
    h.islands.get(B)?.emit({ type: "event", marker: "from-B" });
    expect(a1.messages("event")).toEqual([expect.objectContaining({ marker: "from-A" })]);
    expect(a2.messages("event")).toHaveLength(0);
    expect(b1.messages("event")).toEqual([expect.objectContaining({ marker: "from-B" })]);
  });

  test("R4b: a sealing ask reaches only a ready tab of its own face and waits for one", async () => {
    const h = harness(); const a = await face(A, 41, 51); const b = await face(B, 42, 52);
    const a1 = h.port(); const a2 = h.port(); const b1 = h.port();
    for (const tab of [a1, a2, b1]) await h.core.connect(tab.endpoint);
    await h.open(a1, A, a.edge, a.atom); await h.open(a2, A, a.edge, a.atom); await h.open(b1, B, b.edge, b.atom);
    // A tab announces it can seal once its own face custody stands open; the holder holds no key and asks no clock.
    a1.send({ type: "session:sealer", ready: true }); b1.send({ type: "session:sealer", ready: true });
    h.islands.get(A)?.emit({ type: "custody:write", requestId: "seal-1" });
    expect(a1.messages("custody:write")).toEqual([expect.objectContaining({ requestId: "seal-1" })]);
    expect(a2.messages("custody:write")).toHaveLength(0);
    expect(b1.messages("custody:write")).toHaveLength(0);
    // A's only ready tab locks: the ask waits by name, and B's ready tab never receives it.
    a1.send({ type: "session:sealer", ready: false });
    h.islands.get(A)?.emit({ type: "custody:write", requestId: "seal-2" });
    expect(h.waits).toContainEqual({ kind: "seal-awaits-session", group: A, type: "custody:write" });
    expect(a1.messages("custody:write")).toHaveLength(1);
    expect(a2.messages("custody:write")).toHaveLength(0);
    expect(b1.messages("custody:write")).toHaveLength(0);
    // Another A tab unlocks: the waiting ask lands there and nowhere else.
    a2.send({ type: "session:sealer", ready: true });
    expect(a2.messages("custody:write")).toEqual([expect.objectContaining({ requestId: "seal-2" })]);
    expect(b1.messages("custody:write")).toHaveLength(0);
  });

  test("R4c: each house makes a Repo and A reads through A's island", async () => {
    const h = harness(); const a = await face(A, 41, 51); const b = await face(B, 42, 52);
    const a1 = h.port(); const b1 = h.port(); await h.core.connect(a1.endpoint); await h.core.connect(b1.endpoint);
    await h.open(a1, A, a.edge, a.atom); await h.open(b1, B, b.edge, b.atom);
    expect(h.madeRepos).toEqual([A, B]);
    expect(h.repos.get(A)?.group).toBe(A); expect(h.repos.get(B)?.group).toBe(B);
    a1.send({ type: "wiki:place-verb", requestId: "read-A", verb: "read" });
    expect(a1.messages("wiki:verb-result").at(-1)).toMatchObject({ requestId: "read-A", result: { repo: A } });
    expect(b1.messages("wiki:verb-result")).toHaveLength(0);
  });

  test("R5: the last session ends its house once and leaves B standing", async () => {
    const h = harness(); const a = await face(A, 41, 51); const b = await face(B, 42, 52);
    const a1 = h.port(); const a2 = h.port(); const b1 = h.port();
    for (const tab of [a1, a2, b1]) await h.core.connect(tab.endpoint);
    await h.open(a1, A, a.edge, a.atom); await h.open(a2, A, a.edge, a.atom); await h.open(b1, B, b.edge, b.atom);
    expect(h.core.houses).toBe(2);
    h.core.disconnect(a1.endpoint); await h.settle();
    expect(h.islands.get(A)?.terminated).toBe(0); expect(h.repos.get(A)?.stops).toBe(0);
    expect(h.core.houses).toBe(2);
    h.core.disconnect(a2.endpoint); await h.settle();
    expect(h.islands.get(A)?.terminated).toBe(1);
    expect(h.repos.get(A)?.stops).toBe(1);
    expect(h.core.houses).toBe(1);
    expect(h.islands.get(B)?.terminated).toBe(0); expect(h.repos.get(B)?.stops).toBe(0);
  });
});
