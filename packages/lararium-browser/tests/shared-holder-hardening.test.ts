/**
 * The holder's houses stand on (PersonaGroup, persona root), and an island that cleared its Binding Gate proves the face.
 *
 * A tab claims a group in `session:open`, but the edge it presents carries no group. So a house keys by the pair, a
 * foreign root fills a house of its own, and a house serves a port only after its island posts `gate:clear` naming the
 * edge digest and the root the gate verified. Each case carries its control. The fake islands here drive the gate
 * verdicts; the real gate's verdicts stand in the keyhive suite (gate-clear-posts).
 */
import { describe, expect, test } from "vitest";
import { buildDeviceDelegation, deviceEdgeDigest } from "../../lararium-mesh/src/device-delegation.js";
import { makeSharedHolderCore, type HolderIsland, type HolderPort, type HolderRepo } from "../src/shared-holder-core.js";
import { holderWorkerHandle, attachSharedHolder, type SharedWorkerHost } from "../src/shared-holder.js";
import { admitPort, faceFixture, fakePort, type FaceFixture, type FakePort, type Message } from "./holder-session-fixture.js";

const key = (group: string, root: string): string => `${group}|${root}`;
/** The handshake kinds a house's claimant hears while its island proves the face; nothing else flows before the gate. */
const HANDSHAKE = new Set(["ready", "ea", "breath", "fault"]);

function harness(extra: { makeRepo?: (group: string, root: string) => Promise<HolderRepo> } = {}) {
  const islands = new Map<string, { posts: Message[]; emit: (m: Message) => void; fail: (e: Error) => void; terminated: number }>();
  const repos = new Map<string, { stops: number; peers: Array<{ port: unknown; serving: Promise<void>; servingGiven: boolean; closed: Promise<void> | undefined; served: boolean; ended: boolean }> }>();
  const waits: string[] = [];
  const spawnWaiters = new Map<string, Array<(r: NonNullable<ReturnType<typeof islands.get>>) => void>>();
  /** Resolves with a house's island once the holder stood it: the product's own event, never a clock. */
  const island = (k: string): Promise<NonNullable<ReturnType<typeof islands.get>>> =>
    islands.has(k) ? Promise.resolve(islands.get(k)!) : new Promise((resolve) => { spawnWaiters.set(k, [...(spawnWaiters.get(k) ?? []), resolve]); });
  const drops: Array<{ kind: string; reason: string }> = [];
  const options = {
    lockName: "holder-hardening-test",
    locks: { request: async (_n: string, _o: { ifAvailable: true }, cb: (lock: { name: string } | null) => unknown) => cb({ name: "holder-hardening-test" }) },
    spawnIsland: (group: string, root: string): HolderIsland => {
      const listeners = new Set<(m: unknown) => void>();
      const errors = new Set<(e: Error) => void>();
      const record = {
        posts: [] as Message[], terminated: 0,
        emit: (m: Message) => { for (const l of listeners) l(m); },
        fail: (e: Error) => { for (const l of errors) l(e); },
      };
      islands.set(key(group, root), record);
      for (const w of spawnWaiters.get(key(group, root)) ?? []) w(record);
      spawnWaiters.delete(key(group, root));
      return {
        post: (m) => { record.posts.push(m as Message); },
        listen: (l) => { listeners.add(l); return () => listeners.delete(l); },
        onError: (l) => { errors.add(l); return () => errors.delete(l); },
        terminate: () => { record.terminated++; },
      };
    },
    makeRepo: extra.makeRepo ?? (async (group: string, root: string): Promise<HolderRepo> => makeRepoRecord(group, root)),
    onWait: (_k: "seal-awaits-session", group: string) => { waits.push(group); },
    onDrop: (kind: string, reason: string) => { drops.push({ kind, reason }); },
  };
  function makeRepoRecord(group: string, root: string): HolderRepo {
    const record = { stops: 0, peers: [] as Array<{ port: unknown; serving: Promise<void>; servingGiven: boolean; closed: Promise<void> | undefined; served: boolean; ended: boolean }> };
    repos.set(key(group, root), record);
    return {
      shutdown: async () => { record.stops++; },
      attachPeer: (port: MessagePort, serving?: Promise<void>, closed?: Promise<void>) => {
        const peer = { port, serving: serving ?? Promise.resolve(), servingGiven: serving !== undefined, closed, served: false, ended: false };
        void peer.serving.then(() => { peer.served = true; });
        void closed?.then(() => { peer.ended = true; });
        record.peers.push(peer);
      },
    } as HolderRepo;
  }
  const core = makeSharedHolderCore(options as never);
  const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  return { core, islands, island, repos, waits, drops, settle, makeRepoRecord };
}

const clearOf = (face: FaceFixture): Message => ({ type: "gate:clear", edgeDigest: deviceEdgeDigest(face.edge), personaRoot: face.edge.personaRootDid });
const rootOf = (face: FaceFixture): string => face.edge.personaRootDid;
const connect = async (h: ReturnType<typeof harness>, tab = fakePort()): Promise<FakePort> => { await h.core.connect(tab.endpoint); return tab; };
/** Give one manifest event a transferred sync port, exactly as a browser MessagePort event does. */
const tabWithManifestPort = (syncPort: MessagePort): FakePort => {
  const tab = fakePort();
  const add = tab.endpoint.addEventListener.bind(tab.endpoint);
  tab.endpoint.addEventListener = (type, listener) => add(type, (event) => {
    const message = event.data as Message;
    listener(message?.type === "manifest" ? { data: event.data, ports: [syncPort] } as unknown as MessageEvent : event);
  });
  return tab;
};
/** The holder verifies a session:open with async crypto before it counts the admission; a turn of the event loop lets that settle. */
const waitVerified = (_tab: FakePort): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));
const kinds = (tab: FakePort): string[] => tab.received.map((m) => String(m.kind ?? m.type)).filter((k) => k !== "holder:hello");

describe("the holder keys a house by group and root and serves it after its island's gate clears", () => {
  test("H1: a tab with its own valid edge claiming B reaches nothing of B's real house; B's real device is admitted", async () => {
    const h = harness();
    const real = await faceFixture("face:B", 41, 51);
    const claimant = await faceFixture("face:B", 42, 52);
    const owner = await connect(h); const stranger = await connect(h);
    const realAdmit = admitPort(owner, real); const strangerAdmit = admitPort(stranger, claimant);
    (await h.island(key("face:B", rootOf(real)))).emit(clearOf(real));
    (await h.island(key("face:B", rootOf(claimant)))).emit(clearOf(claimant));
    await Promise.all([realAdmit, strangerAdmit]);
    expect([...h.islands.keys()].sort()).toEqual([key("face:B", rootOf(real)), key("face:B", rootOf(claimant))].sort());
    expect(owner.messages("holder:admitted")).toHaveLength(1);
    expect(stranger.messages("holder:admitted")).toHaveLength(1);
    // The real house's island answers reach the real tab alone, the claimant's house answers reach the claimant alone.
    h.islands.get(key("face:B", rootOf(real)))?.emit({ type: "event", marker: "B-real" });
    expect(owner.messages("event")).toEqual([expect.objectContaining({ marker: "B-real" })]);
    expect(stranger.messages("event")).toHaveLength(0);
    // The claimant leaving ends its own house alone.
    h.core.disconnect(stranger.endpoint); await h.settle();
    expect(h.islands.get(key("face:B", rootOf(claimant)))?.terminated).toBe(1);
    expect(h.islands.get(key("face:B", rootOf(real)))?.terminated).toBe(0);
    expect(stranger.received.some((m) => m.cause === "session-root-mismatch")).toBe(false);
  });

  test("H2: nothing flows to a port of an uncleared house; the claimant hears the island's boot handshake alone", async () => {
    const h = harness();
    const face = await faceFixture("face:A", 41, 51);
    const channel = new MessageChannel();
    const first = await connect(h, tabWithManifestPort(channel.port1)); const second = await connect(h);
    const opened = admitPort(first, face);
    const island = await h.island(key("face:A", rootOf(face)));
    first.send({ type: "manifest", wikiUri: "daemon" });
    for (const m of [{ type: "event", n: 1 }, { type: "lar:frame", cameraId: "c" }, { type: "custody:write", requestId: "w" }, { type: "view:content" }, { type: "ready" }, { type: "ea" }]) island.emit(m);
    // A second port presenting the same edge waits with the first and hears nothing at all.
    const secondOpened = admitPort(second, face); await h.settle(); for (let i = 0; i < 40 && kinds(second).length === 0; i++) await Promise.resolve();
    first.send({ type: "wiki:place-verb", requestId: "early", verb: "read" });
    expect(first.messages("holder:admitted")).toHaveLength(0);
    expect(kinds(first).filter((k) => !HANDSHAKE.has(k) && k !== "holder:refused")).toEqual([]);
    expect(first.messages("holder:refused").at(-1)).toMatchObject({ cause: "session-unadmitted" });
    expect(island.posts.filter((m) => m.type === "wiki:place-verb")).toHaveLength(0);
    expect(kinds(second)).toEqual([]);
    // The tab's Repo peer is attached, and the holder serves it nothing until the gate clears.
    const peers = h.repos.get(key("face:A", rootOf(face)))?.peers ?? [];
    expect(peers.length, "the claimant manifest attaches a real Repo peer").toBeGreaterThan(0);
    const gatedPeers = peers.filter((p) => p.servingGiven);
    expect(gatedPeers.length, "the tab-side Repo peer carries the serving promise").toBeGreaterThan(0);
    expect(gatedPeers.every((p) => p.served === false)).toBe(true);
    island.emit(clearOf(face));
    await Promise.all([opened, secondOpened]);
    expect(first.messages("holder:admitted")).toHaveLength(1);
    expect(second.messages("holder:admitted")).toHaveLength(1);
    expect(gatedPeers.every((p) => p.served === true)).toBe(true);
    channel.port2.close();
  });

  test("H2b: a gate:clear naming another edge or root admits nothing and ends the house; the named edge admits", async () => {
    const h = harness();
    const face = await faceFixture("face:A", 41, 51);
    const other = await faceFixture("face:A", 41, 53);       // same root, another device edge
    const foreign = await faceFixture("face:A", 43, 51);      // another root
    for (const wrong of [other, foreign]) {
      const tab = await connect(h);
      const opened = admitPort(tab, face);
      (await h.island(key("face:A", rootOf(face)))).emit(clearOf(wrong));
      await opened;
      expect(tab.messages("holder:admitted")).toHaveLength(0);
      expect(tab.messages("holder:refused").at(-1)).toMatchObject({ cause: "session-edge-other" });
      await h.settle();
      expect(h.islands.get(key("face:A", rootOf(face)))?.terminated).toBeGreaterThan(0);
      h.islands.delete(key("face:A", rootOf(face)));
    }
    const good = await connect(h);
    const opened = admitPort(good, face);
    (await h.island(key("face:A", rootOf(face)))).emit(clearOf(face));
    await opened;
    expect(good.messages("holder:admitted")).toHaveLength(1);
  });

  test("H2c: a later session presents the same signed edge proof", async () => {
    const h = harness();
    const face = await faceFixture("face:A", 41, 51);
    const later = { ...face, edge: await buildDeviceDelegation({ personaRootSeed: new Uint8Array(32).fill(41), atomSeed: new Uint8Array(32).fill(51), hearthTrueName: "", boundEpoch: 2 }) };
    const tweaked = { ...later, edge: { ...later.edge, boundEpoch: String(Number(later.edge.boundEpoch) + 1) } };
    const a = await connect(h); const opened = admitPort(a, face);
    (await h.island(key("face:A", rootOf(face)))).emit(clearOf(face)); await opened;
    const b = await connect(h);
    // A tweaked edge fails its own signatures, so it refuses as a bad edge; an identical edge is the control.
    const refused = await admitPort(b, later);
    expect(refused).toMatchObject({ kind: "holder:refused", cause: "session-edge-other" });
    const c = await connect(h);
    expect(await admitPort(c, { ...face, edge: { ...face.edge, extra: "outside signed fields" } } as FaceFixture)).toMatchObject({ kind: "holder:admitted" });
    const d = await connect(h);
    expect(await admitPort(d, tweaked as FaceFixture)).toMatchObject({ kind: "holder:refused", cause: "session-edge-invalid" });
  });

  test("H3: a gate:refused ends the house with its cause: ports hear a named end, the island and Repo stand down", async () => {
    const h = harness();
    const face = await faceFixture("face:A", 41, 51);
    const tab = await connect(h); void admitPort(tab, face);
    (await h.island(key("face:A", rootOf(face)))).emit({ type: "gate:refused", cause: "stale epoch: the edge is bound to epoch 1 and the frontier reads 4" });
    await h.settle();
    expect(tab.messages("holder:admitted")).toHaveLength(0);
    expect(tab.messages("holder:house-ended").at(-1)).toMatchObject({ personaGroup: "face:A", cause: expect.stringMatching(/stale epoch/) });
    expect(h.islands.get(key("face:A", rootOf(face)))?.terminated).toBe(1);
    expect(h.repos.get(key("face:A", rootOf(face)))?.stops).toBe(1);
  });

  test("H4: a port closing while its house's Repo is still being made leaves no admitted port and one shutdown", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let made!: HolderRepo; let stops = 0;
    const h = harness({ makeRepo: async () => { await gate; made = { shutdown: async () => { stops++; } }; return made; } });
    const face = await faceFixture("face:A", 41, 51);
    const gone = await connect(h); const stays = await connect(h);
    void admitPort(gone, face); const stayed = admitPort(stays, face);
    await waitVerified(gone); await waitVerified(stays);
    h.core.disconnect(gone.endpoint);
    release();
    (await h.island(key("face:A", rootOf(face)))).emit(clearOf(face)); await stayed;
    // The port that stayed is admitted into a house that stands; the one that left heard no admission.
    expect(gone.messages("holder:admitted")).toHaveLength(0);
    expect(stays.messages("holder:admitted")).toHaveLength(1);
    expect(stops).toBe(0);
    stays.send({ type: "wiki:place-verb", requestId: "r", verb: "read" });
    expect(h.islands.get(key("face:A", rootOf(face)))?.posts.some((m) => m.type === "wiki:place-verb")).toBe(true);
    expect(stays.messages("holder:refused")).toHaveLength(0);
    h.core.disconnect(stays.endpoint); await h.settle();
    expect(stops).toBe(1);
  });

  test("H4b: every port closing during the Repo's making ends the house once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let stops = 0;
    const h = harness({ makeRepo: async () => { await gate; return { shutdown: async () => { stops++; } }; } });
    const face = await faceFixture("face:A", 41, 51);
    const a = await connect(h); const b = await connect(h);
    void admitPort(a, face); void admitPort(b, face);
    await waitVerified(a); await waitVerified(b);
    h.core.disconnect(a.endpoint); h.core.disconnect(b.endpoint);
    release();
    for (let i = 0; i < 200 && stops === 0; i++) await Promise.resolve();
    expect(stops).toBe(1);
    expect(a.messages("holder:admitted")).toHaveLength(0);
    expect(b.messages("holder:admitted")).toHaveLength(0);
  });

  test("H5: an island that crashes ends its house's sessions with a named fault; another face's house stands", async () => {
    const h = harness();
    const a = await faceFixture("face:A", 41, 51); const b = await faceFixture("face:B", 42, 52);
    const ta = await connect(h); const tb = await connect(h);
    const oa = admitPort(ta, a); const ob = admitPort(tb, b);
    (await h.island(key("face:A", rootOf(a)))).emit(clearOf(a)); (await h.island(key("face:B", rootOf(b)))).emit(clearOf(b));
    await Promise.all([oa, ob]);
    h.islands.get(key("face:A", rootOf(a)))?.fail(new Error("worker died"));
    await h.settle();
    expect(ta.messages("holder:house-ended").at(-1)).toMatchObject({ personaGroup: "face:A", cause: expect.stringMatching(/island-crashed.*worker died/) });
    expect(h.islands.get(key("face:A", rootOf(a)))?.terminated).toBe(1);
    expect(h.repos.get(key("face:A", rootOf(a)))?.stops).toBe(1);
    // The surviving port of the ended house hears the lock so its tab drops its unlock.
    expect(ta.messages("holder:lock").at(-1)).toMatchObject({ personaGroup: "face:A" });
    // A later ask on the ended house's port reaches no island.
    ta.send({ type: "wiki:place-verb", requestId: "late", verb: "read" });
    expect(h.islands.get(key("face:A", rootOf(a)))?.posts.some((m) => m.type === "wiki:place-verb")).toBe(false);
    // CONTROL: B stands.
    expect(tb.messages("holder:house-ended")).toHaveLength(0);
    expect(h.islands.get(key("face:B", rootOf(b)))?.terminated).toBe(0);
  });

  test.each(["last-session", "island-crash"])("H5b: %s resolves the closed promise of each attached peer after clearance", async (ending) => {
    const h = harness();
    const face = await faceFixture("face:peer-close", 61, 71);
    const channel = new MessageChannel();
    const tab = await connect(h, tabWithManifestPort(channel.port1));
    const opened = admitPort(tab, face);
    const island = await h.island(key(face.group, rootOf(face)));
    tab.send({ type: "manifest", wikiUri: "daemon" });
    island.emit(clearOf(face));
    await opened;
    const peers = h.repos.get(key(face.group, rootOf(face)))?.peers ?? [];
    expect(peers.length, "a manifest attached the Repo peers").toBeGreaterThan(0);
    expect(peers.every((peer) => peer.closed instanceof Promise), "every peer carries its house closure").toBe(true);
    if (ending === "last-session") h.core.disconnect(tab.endpoint);
    else island.fail(new Error("worker died"));
    await h.settle();
    expect(peers.every((peer) => peer.ended), "the ended house closes each peer").toBe(true);
    channel.port2.close();
  });
});

describe("the tab's handle delivers the holder's lock and its named end", () => {
  test("H6: holder:lock reaches the tab's lock hook, and holder:house-ended reaches the daemon core as a fault", async () => {
    const face = await faceFixture("face:A", 41, 51);
    const channel = new MessageChannel();
    const hello = { kind: "holder:hello", ownerEpoch: "e1", sessionId: "s1", generation: 0, nonce: "00", islandBoots: 0, tabs: 1, lockClientId: null };
    class Greeter { readonly port = channel.port1; constructor() { channel.port2.postMessage(hello); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Greeter as unknown as SharedWorkerHost["SharedWorker"] } });
    if (attached.kind !== "attached") throw new Error("not attached");
    const locked: string[] = [];
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom }, { onLock: (g: string) => locked.push(g) } as never);
    const heard: Array<Record<string, unknown>> = [];
    handle.listen((m) => heard.push(m as Record<string, unknown>));
    const env = { ownerEpoch: "e1", sessionId: "s1", generation: 0 };
    channel.port2.postMessage({ kind: "holder:house-ended", personaGroup: "face:A", cause: "island-crashed: worker died", ...env });
    channel.port2.postMessage({ kind: "holder:lock", personaGroup: "face:A", ...env });
    await expect.poll(() => locked.length).toBe(1);
    expect(locked).toEqual(["face:A"]);
    expect(heard.some((m) => m.type === "fault" && String(m.error).includes("island-crashed"))).toBe(true);
    // CONTROL: an island message still reaches the core untouched.
    channel.port2.postMessage({ type: "breath", wikiUri: "w", ...env });
    await expect.poll(() => heard.some((m) => m.type === "breath")).toBe(true);
  });
});

describe("a tab boots its island through the gate that waits for the boot", () => {
  test("H7: the manifest crosses before admission, the island clears on it, and a verb the tab queued then flows", async () => {
    const face = await faceFixture("face:A", 41, 51);
    const posts: Message[] = [];
    let spawned = 0;
    const core = makeSharedHolderCore({
      lockName: "holder-boot-test",
      locks: { request: async (_n, _o, cb) => cb({ name: "holder-boot-test" }) },
      spawnIsland: (_group, personaRoot, edgeDigest): HolderIsland => {
        spawned++;
        const listeners = new Set<(m: unknown) => void>();
        // The island announces ready, then proves the face only once the tab's manifest reaches it.
        queueMicrotask(() => { for (const l of listeners) l({ type: "ready" }); });
        return {
          post: (m) => {
            posts.push(m as Message);
            const type = (m as Message).type;
            if (type === "manifest") for (const l of listeners) l({ type: "gate:clear", edgeDigest, personaRoot });
            if (type === "wiki:place-verb") for (const l of listeners) l({ type: "wiki:verb-result", requestId: (m as Message).requestId, result: { ok: true } });
          },
          listen: (l) => { listeners.add(l); return () => listeners.delete(l); },
          onError: () => () => {}, terminate: () => {},
        };
      },
    });
    class Pair { readonly port: MessagePort; constructor() { const c = new MessageChannel(); this.port = c.port1; void core.connect(c.port2 as unknown as HolderPort); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Pair as unknown as SharedWorkerHost["SharedWorker"] } });
    if (attached.kind !== "attached") throw new Error("not attached");
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom });
    const heard: Array<Record<string, unknown>> = [];
    handle.listen((m) => heard.push(m as Record<string, unknown>));
    // The daemon core waits for `ready` and then posts its manifest; a verb posted early waits for the admission.
    handle.post({ type: "wiki:place-verb", requestId: "early", verb: "read" });
    await expect.poll(() => heard.some((m) => m.type === "ready")).toBe(true);
    handle.post({ type: "manifest", wikiUri: "daemon" });
    await expect.poll(() => heard.some((m) => m.type === "wiki:verb-result")).toBe(true);
    expect(posts.map((m) => m.type)).toEqual(["manifest", "wiki:place-verb"]);
    expect(spawned).toBe(1);
  });
});

describe("a half-started house yields to the dedicated-worker floor", () => {
  test("a throwing nested island launch closes its house and Repo and refuses by holder-unavailable", async () => {
    const face = await faceFixture("face:failed-spawn", 91, 92);
    let stops = 0;
    const core = makeSharedHolderCore({
      lockName: "holder-failed-spawn",
      locks: { request: async (_n, _o, cb) => cb({ name: "holder-failed-spawn" }) },
      makeRepo: async () => ({ shutdown: async () => { stops++; } }) as HolderRepo,
      spawnIsland: (): HolderIsland => { throw new Error("constructor refused"); },
    });
    const tab = fakePort(); await core.connect(tab.endpoint);
    const verdict = await admitPort(tab, face);
    expect(verdict, "the failed island names the floor cause").toMatchObject({ kind: "holder:refused", cause: expect.stringMatching(/^holder-unavailable: the island could not start \(constructor refused\)/) });
    await expect.poll(() => core.houses).toBe(0);
    expect(stops, "the half-started house shuts its Repo once").toBe(1);
  });

  test("a late holder-unavailable refusal reattaches earlier listeners and replays held posts to the floor", async () => {
    const face = await faceFixture("face:floor", 93, 94);
    const channel = new MessageChannel();
    const hello = { kind: "holder:hello", ownerEpoch: "floor-epoch", sessionId: "floor-session", generation: 0, nonce: "00", islandBoots: 0, tabs: 1, lockClientId: null };
    class Greeter { readonly port = channel.port1; constructor() { channel.port2.postMessage(hello); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Greeter as unknown as SharedWorkerHost["SharedWorker"] } });
    expect(attached.kind).toBe("attached");
    if (attached.kind !== "attached") return;
    const posts: Message[] = [];
    const listeners = new Set<(m: unknown) => void>();
    let floors = 0, terminated = 0;
    const floor = () => { floors++; return {
      post: (m: unknown) => { posts.push(m as Message); },
      listen: (cb: (m: unknown) => void) => { listeners.add(cb); return () => listeners.delete(cb); },
      onError: () => () => {}, terminate: () => { terminated++; },
    }; };
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom }, { floor } as never);
    const heard: Message[] = [];
    handle.listen((m) => heard.push(m as Message));
    handle.post({ type: "wiki:place-verb", requestId: "held", verb: "read" });
    channel.port2.postMessage({ ...hello, kind: "holder:refused", cause: "holder-unavailable: the island could not start (constructor refused)" });
    await expect.poll(() => floors).toBe(1);
    expect(posts.some((m) => m.requestId === "held"), "held asks replay into the floor").toBe(true);
    handle.post({ type: "wiki:place-verb", requestId: "later", verb: "read" });
    expect(posts.some((m) => m.requestId === "later"), "later asks use the floor").toBe(true);
    for (const cb of listeners) cb({ type: "breath", wikiUri: "floor" });
    expect(heard).toContainEqual({ type: "breath", wikiUri: "floor" });
    handle.terminate();
    expect(terminated).toBe(1);
    channel.port2.close();
  });

  test("a late refusal re-posts a manifest with a fresh sync port before replaying asks", async () => {
    const face = await faceFixture("face:manifest-floor", 97, 98);
    const channel = new MessageChannel();
    const hello = { kind: "holder:hello", ownerEpoch: "manifest-epoch", sessionId: "manifest-session", generation: 0, nonce: "00", islandBoots: 0, tabs: 1, lockClientId: null };
    class Greeter { readonly port = channel.port1; constructor() { channel.port2.postMessage(hello); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Greeter as unknown as SharedWorkerHost["SharedWorker"] } });
    expect(attached.kind).toBe("attached");
    if (attached.kind !== "attached") return;
    const firstSync = new MessageChannel();
    const freshSync = new MessageChannel();
    const floorPosts: Array<{ msg: Message; transfer: readonly Transferable[] }> = [];
    const premature: Message[] = [];
    const floorListeners = new Set<(m: unknown) => void>();
    let ready = false;
    let rePosts = 0, floors = 0;
    let floorStood!: () => void;
    const stood = new Promise<void>((resolve) => { floorStood = resolve; });
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom }, {
      floor: () => { floors++; floorStood(); return {
        // The browser worker has no inbound listener until it announces ready. Earlier posts vanish.
        post: (msg: unknown, transfer?: readonly Transferable[]) => {
          if (ready) floorPosts.push({ msg: msg as Message, transfer: transfer ?? [] });
          else premature.push(msg as Message);
        },
        listen: (cb: (m: unknown) => void) => { floorListeners.add(cb); return () => floorListeners.delete(cb); },
        onError: () => () => {}, terminate: () => {},
      }; },
      // The pool owns the synced Repo and can mint the replacement manifest and transfer port.
      rePost: () => { rePosts++; return { msg: { type: "manifest", wikiUri: "daemon" }, transfer: [freshSync.port1] }; },
    } as never);
    handle.post({ type: "manifest", wikiUri: "daemon" }, [firstSync.port1]);
    handle.post({ type: "wiki:place-verb", requestId: "held", verb: "read" });
    channel.port2.postMessage({ ...hello, kind: "holder:refused", cause: "holder-unavailable: nested island launch failed" });
    try {
      await stood;
      expect(floors).toBe(1);
      expect(floorPosts, "the worker drops everything posted before ready").toEqual([]);
      ready = true;
      for (const cb of floorListeners) cb({ type: "ready" });
      for (let i = 0; i < 12; i++) await Promise.resolve();
      expect(premature, "the replay waits for the worker's registered inbound listener").toEqual([]);
      expect(rePosts, "the pool supplies one fresh manifest after the transferred one has left").toBe(1);
      expect(floorPosts.map(({ msg }) => msg.type), "the floor boots before held asks replay").toEqual(["manifest", "wiki:place-verb"]);
      expect(floorPosts[0]!.transfer[0], "the floor receives the newly minted sync port").toBe(freshSync.port1);
      expect(floorPosts[0]!.transfer[0]).not.toBe(firstSync.port1);
    } finally {
      firstSync.port2.close(); freshSync.port1.close(); freshSync.port2.close(); channel.port2.close(); handle.terminate();
    }
  });

  test("a floor that errors before ready refuses every held ask by request name and receives none", async () => {
    const face = await faceFixture("face:failed-floor", 101, 102);
    const channel = new MessageChannel();
    const hello = { kind: "holder:hello", ownerEpoch: "failed-epoch", sessionId: "failed-session", generation: 0, nonce: "00", islandBoots: 0, tabs: 1, lockClientId: null };
    class Greeter { readonly port = channel.port1; constructor() { channel.port2.postMessage(hello); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Greeter as unknown as SharedWorkerHost["SharedWorker"] } });
    expect(attached.kind).toBe("attached");
    if (attached.kind !== "attached") return;
    const floorPosts: unknown[] = [];
    const floorListeners = new Set<(m: unknown) => void>();
    const floorErrors = new Set<(e: Error) => void>();
    const heard: Message[] = [];
    let floorStood!: () => void;
    const stood = new Promise<void>((resolve) => { floorStood = resolve; });
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom }, {
      floor: () => { floorStood(); return {
        post: (msg: unknown) => { floorPosts.push(msg); },
        listen: (cb: (m: unknown) => void) => { floorListeners.add(cb); return () => floorListeners.delete(cb); },
        onError: (cb: (e: Error) => void) => { floorErrors.add(cb); return () => floorErrors.delete(cb); },
        terminate: () => {},
      }; },
      rePost: () => ({ msg: { type: "manifest" }, transfer: [] }),
    } as never);
    handle.listen((m) => heard.push(m as Message));
    handle.post({ type: "manifest" });
    handle.post({ type: "wiki:place-verb", requestId: "ask-1" });
    handle.post({ type: "wiki:place-verb", requestId: "ask-2" });
    channel.port2.postMessage({ ...hello, kind: "holder:refused", cause: "holder-unavailable: launch failed" });
    try {
      await stood;
      for (const cb of floorErrors) cb(new Error("worker exited"));
      for (const cb of floorListeners) cb({ type: "ready" });
      expect(floorPosts).toEqual([]);
      expect(heard.filter((m) => m.type === "wiki:verb-result").map((m) => [m.requestId, m.error]))
        .toEqual([["ask-1", expect.stringContaining("worker exited")], ["ask-2", expect.stringContaining("worker exited")]]);
    } finally { channel.port2.close(); handle.terminate(); }
  });

  test("CONTROL: refusal before a manifest still lets the floor receive its first manifest", async () => {
    const face = await faceFixture("face:early-floor", 99, 100);
    const channel = new MessageChannel();
    const hello = { kind: "holder:hello", ownerEpoch: "early-epoch", sessionId: "early-session", generation: 0, nonce: "00", islandBoots: 0, tabs: 1, lockClientId: null };
    class Greeter { readonly port = channel.port1; constructor() { channel.port2.postMessage(hello); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Greeter as unknown as SharedWorkerHost["SharedWorker"] } });
    expect(attached.kind).toBe("attached");
    if (attached.kind !== "attached") return;
    const posts: Message[] = [];
    let floors = 0;
    let floorStood!: () => void;
    const stood = new Promise<void>((resolve) => { floorStood = resolve; });
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom }, {
      floor: () => { floors++; floorStood(); return { post: (msg: unknown) => { posts.push(msg as Message); }, listen: () => () => {}, onError: () => () => {}, terminate: () => {} }; },
    } as never);
    channel.port2.postMessage({ ...hello, kind: "holder:refused", cause: "holder-unavailable: early refusal" });
    await stood;
    expect(floors).toBe(1);
    expect(posts, "no manifest crossed before the refusal").toEqual([]);
    handle.post({ type: "manifest", wikiUri: "daemon" });
    expect(posts.map((msg) => msg.type), "the first floor manifest boots normally").toEqual(["manifest"]);
    channel.port2.close(); handle.terminate();
  });

  test("CONTROL: a normal island admission never invokes the floor hook", async () => {
    const face = await faceFixture("face:normal", 95, 96);
    const core = makeSharedHolderCore({
      lockName: "holder-normal",
      locks: { request: async (_n, _o, cb) => cb({ name: "holder-normal" }) },
      spawnIsland: (_g, root, digest): HolderIsland => {
        const listeners = new Set<(m: unknown) => void>();
        return { post: (m) => { if ((m as Message).type === "manifest") for (const l of listeners) l({ type: "gate:clear", edgeDigest: digest, personaRoot: root }); },
          listen: (l) => { listeners.add(l); return () => listeners.delete(l); }, onError: () => () => {}, terminate: () => {} };
      },
    });
    class Pair { readonly port: MessagePort; constructor() { const c = new MessageChannel(); this.port = c.port1; void core.connect(c.port2 as unknown as HolderPort); } }
    const attached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/h.js"), host: { SharedWorker: Pair as unknown as SharedWorkerHost["SharedWorker"] } });
    expect(attached.kind).toBe("attached");
    if (attached.kind !== "attached") return;
    let floors = 0;
    const handle = holderWorkerHandle(attached.port, { personaGroup: face.group, edge: face.edge, atom: face.atom }, { floor: () => { floors++; throw new Error("unexpected floor"); } } as never);
    await expect.poll(() => core.houses).toBe(1);
    await expect.poll(() => core.islandBoots).toBe(1);
    handle.post({ type: "manifest", wikiUri: "daemon" });
    expect(floors).toBe(0);
    handle.terminate();
  });
});
