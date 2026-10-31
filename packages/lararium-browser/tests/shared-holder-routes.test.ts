import { describe, expect, test } from "vitest";
import { makeSharedHolderCore, type HolderIsland, type HolderPort } from "../src/shared-holder-core.js";
import { HOLDER_ROUTES } from "../src/holder-routes.js";
import { admitPort, faceFixture, fakePort, type FakePort } from "./holder-session-fixture.js";
import type { IslandToVesselMsg } from "../../lararium-mesh/src/island-protocol";

const islandKinds = [
  "event", "teardown:ack", "ea", "breath", "fault", "ready", "wiki:verb-result",
  "daemon:delegate-verb", "daemon:derive-skeleton-result", "daemon:worldline-compare-result",
  "daemon:worldline-trajectory-result", "daemon:resolve-binding-result", "daemon:gate-verb-result", "daemon:evict-request", "daemon:face-settled",
  "daemon:residency-op", "daemon:wiki-alert", "gate:clear", "gate:refused", "cas:want", "dyad:ask", "doc:rest", "custody:write",
  "view:catalog", "view:content", "view:settle", "lar:frame", "lar:control-result", "lar:service",
  "port:snapshot", "port:changes", "port:reset", "port:written", "port:answer", "port:presence",
] as const satisfies readonly IslandToVesselMsg["type"][];

function harness(grant = false) {
  const islandListeners = new Set<(message: unknown) => void>();
  const islandPosts: unknown[] = [];
  const drops: Array<{ kind: string; reason: string }> = [];
  const island: HolderIsland = {
    post: (message) => islandPosts.push(message),
    listen: (listener) => { islandListeners.add(listener); return () => islandListeners.delete(listener); },
    onError: () => () => {},
    terminate: () => {},
  };
  let gate: { edgeDigest: string; personaRoot: string } | null = null;
  const core = makeSharedHolderCore({
    lockName: "holder-routes-test",
    locks: { request: async (_name, _options, callback) => callback({ name: "holder-routes-test" }), query: async () => ({ held: [] }) },
    spawnIsland: (_group, personaRoot, edgeDigest) => {
      gate = { edgeDigest, personaRoot };
      // The island's Binding Gate clears for the edge the first session presented.
      queueMicrotask(() => { for (const l of islandListeners) l({ type: "gate:clear", ...gate }); });
      return island;
    },
    onDrop: (kind, reason) => drops.push({ kind, reason }),
    ...(grant ? { portPolicy: (binding: string) => ({ faceId: "face:T", actor: binding, edits: true, bags: [], admin: false }) } : {}),
  });
  const port = fakePort;
  const face = faceFixture("face:T");
  const admit = async (tab: FakePort): Promise<void> => { await admitPort(tab, await face); };
  const fromIsland = (message: unknown) => { for (const listener of islandListeners) listener(message); };
  return { core, port, admit, islandPosts, fromIsland, drops };
}

describe("shared holder routing keeps every island answer on its binding", () => {
  test("hello gives each port a distinct session in one owner epoch", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    const hello = (port: typeof a) => port.received.find((m) => (m as { kind?: string }).kind === "holder:hello") as { ownerEpoch?: string; sessionId?: string; generation?: number };
    expect(hello(a)).toMatchObject({ generation: 0 });
    expect(hello(b)).toMatchObject({ generation: 0 });
    expect(hello(a).ownerEpoch).toEqual(expect.any(String));
    expect(hello(a).ownerEpoch).toBe(hello(b).ownerEpoch);
    expect(hello(a).sessionId).toEqual(expect.any(String));
    expect(hello(b).sessionId).toEqual(expect.any(String));
    expect(hello(a).sessionId).not.toBe(hello(b).sessionId);
  });

  test("the core mints once per epoch and once per port without reading the wall clock", async () => {
    let minted = 0;
    const island: HolderIsland = { post() {}, listen() { return () => {}; }, onError() { return () => {}; }, terminate() {} };
    const core = makeSharedHolderCore({
      lockName: "mint-witness",
      locks: { request: async (_name, _options, callback) => callback({ name: "mint-witness" }) },
      spawnIsland: () => island,
      mint: () => `mint-${++minted}`,
    });
    const makePort = () => {
      const received: unknown[] = [];
      const port: HolderPort = { postMessage: (message) => received.push(message), addEventListener() {}, start() {} };
      return { port, received };
    };
    const a = makePort(); const b = makePort();
    await core.connect(a.port); await core.connect(b.port);
    expect(minted).toBe(3);
    expect(a.received.at(-1)).toMatchObject({ ownerEpoch: "mint-1", sessionId: "mint-2" });
    expect(b.received.at(-1)).toMatchObject({ ownerEpoch: "mint-1", sessionId: "mint-3" });
    expect(makeSharedHolderCore.toString()).not.toMatch(/Date\.now|new Date/);
  });

  test("the holder refuses stale epochs, unknown sessions, other ports and stale generations", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    const hello = (port: typeof a) => port.received.find((m) => (m as { kind?: string }).kind === "holder:hello") as { ownerEpoch: string; sessionId: string; generation: number };
    const base = { type: "wiki:place-verb", requestId: "refused" };
    a.send({ ...base, ownerEpoch: "stale-epoch" });
    a.send({ ...base, sessionId: "unknown-session" });
    a.send({ ...base, sessionId: hello(b).sessionId });
    a.send({ ...base, generation: hello(a).generation + 1 });
    a.sendRaw(base);
    expect(h.islandPosts).toHaveLength(0);
    expect(a.received.filter((m) => (m as { kind?: string }).kind === "holder:refused").map((m) => (m as { cause: string }).cause))
      .toEqual(["stale-owner-epoch", "unknown-session", "unbound-session", "stale-generation", "malformed-message"]);
    expect(b.received.filter((m) => (m as { kind?: string }).kind === "holder:refused")).toHaveLength(0);
  });

  test("a restarted core has a fresh epoch and refuses the old tab envelope", async () => {
    const first = harness(); const a = first.port(); await first.core.connect(a.endpoint);
    const old = a.received.find((m) => (m as { kind?: string }).kind === "holder:hello") as { ownerEpoch: string; sessionId: string; generation: number };
    const restarted = harness(); const b = restarted.port(); await restarted.core.connect(b.endpoint);
    const fresh = b.received.find((m) => (m as { kind?: string }).kind === "holder:hello") as { ownerEpoch: string; sessionId: string; generation: number };
    expect(fresh.ownerEpoch).not.toBe(old.ownerEpoch);
    // The tab that spoke to the first holder reaches the restarted one still carrying the old envelope.
    b.sendRaw({ type: "wiki:place-verb", requestId: "old", ownerEpoch: old.ownerEpoch, sessionId: old.sessionId, generation: old.generation });
    expect(restarted.islandPosts).toHaveLength(0);
    expect(b.received.at(-1)).toMatchObject({ kind: "holder:refused", cause: "stale-owner-epoch" });
    expect(first.islandPosts).toHaveLength(0);
  });

  test("island sees a stripped request and its answer returns with the asker's envelope", async () => {
    const h = harness(); const a = h.port(); await h.core.connect(a.endpoint); await h.admit(a);
    a.send({ type: "wiki:place-verb", requestId: "single" });
    const sent = h.islandPosts.at(-1) as Record<string, unknown>;
    for (const field of ["ownerEpoch", "sessionId", "generation"]) expect(sent).not.toHaveProperty(field);
    h.fromIsland({ type: "wiki:verb-result", requestId: sent.requestId, result: { ok: true } });
    expect(a.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "single", result: { ok: true }, ...a.envelope() });
  });

  test("colliding tab request ids return only to each asker with its own id", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send({ type: "wiki:place-verb", requestId: "same", verb: "a" });
    b.send({ type: "wiki:place-verb", requestId: "same", verb: "b" });
    const sent = h.islandPosts.slice(-2) as Array<{ requestId: string }>;
    expect(sent[0].requestId).not.toBe("same"); expect(sent[1].requestId).not.toBe("same");
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[0].requestId, result: { tab: "a" } });
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[1].requestId, result: { tab: "b" } });
    expect(a.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "same", result: { tab: "a" }, ...a.envelope() });
    expect(b.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "same", result: { tab: "b" }, ...b.envelope() });
    expect(a.received.filter((m) => (m as { type?: string }).type === "wiki:verb-result")).toHaveLength(1);
    expect(b.received.filter((m) => (m as { type?: string }).type === "wiki:verb-result")).toHaveLength(1);
  });

  test("a camera resend leases that camera's frames to its sending port", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send({ type: "lar:resend", cameraId: "camera-X" });
    h.fromIsland({ type: "lar:frame", cameraId: "camera-X", mountEpoch: 1, sequence: 1, payload: "frame" });
    expect(a.received.at(-1)).toMatchObject({ type: "lar:frame", cameraId: "camera-X" });
    expect(b.received.some((m) => (m as { type?: string }).type === "lar:frame")).toBe(false);
  });

  test("manifest owns the island route and owner traffic stays on that port", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send({ type: "manifest", wikiUri: "wiki:a" });
    b.send({ type: "manifest", wikiUri: "wiki:b" });
    expect(h.islandPosts.filter((m) => (m as { type?: string }).type === "manifest")).toHaveLength(1);
    expect(b.received.at(-1)).toMatchObject({ kind: "holder:refused", cause: expect.stringMatching(/island-owned/) });
    a.send({ type: "session:sealer", ready: true });
    h.fromIsland({ type: "breath", wikiUri: "wiki:a" });
    h.fromIsland({ type: "custody:write", requestId: "custody-1", wikiUri: "wiki:a" });
    expect(a.received.slice(-2).map((m) => (m as { type: string }).type)).toEqual(["breath", "custody:write"]);
    expect(b.received.some((m) => ["breath", "custody:write"].includes((m as { type?: string }).type ?? ""))).toBe(false);
  });

  test("unknown replies and unleased camera or owner traffic drop by kind and reason", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    h.core.disconnect(a.endpoint);   // the owner ends: owner traffic has no destination until a new owner stands
    h.fromIsland({ type: "wiki:verb-result", requestId: "never-issued" });
    h.fromIsland({ type: "lar:frame", cameraId: "unleased", mountEpoch: 1, sequence: 1, payload: "frame" });
    h.fromIsland({ type: "breath", wikiUri: "ownerless" });
    for (const port of [a, b]) expect(port.received.filter((m) => ["wiki:verb-result", "lar:frame", "breath"].includes((m as { type?: string }).type ?? ""))).toHaveLength(0);
    expect(h.drops).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "wiki:verb-result" }),
      expect.objectContaining({ kind: "lar:frame" }),
      expect.objectContaining({ kind: "breath" }),
    ]));
  });

  test("disconnect drops only that port's pending replies and leaves another request routable", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send({ type: "wiki:place-verb", requestId: "a-pending" });
    b.send({ type: "wiki:place-verb", requestId: "b-pending" });
    const sent = h.islandPosts.slice(-2) as Array<{ requestId: string }>;
    h.core.disconnect(a.endpoint);
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[0].requestId });
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[1].requestId });
    expect(a.received.some((m) => (m as { type?: string }).type === "wiki:verb-result")).toBe(false);
    expect(b.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "b-pending", ...b.envelope() });
    expect(h.drops).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "wiki:verb-result" })]));
  });

  test("CONTROL — one port receives its one matching reply", async () => {
    const h = harness(); const a = h.port();
    await h.core.connect(a.endpoint); await h.admit(a);
    a.send({ type: "wiki:place-verb", requestId: "single" });
    const sent = h.islandPosts.at(-1) as { requestId: string };
    h.fromIsland({ type: "wiki:verb-result", requestId: sent.requestId, result: { ok: true } });
    expect(a.received.at(-1)).toMatchObject({ type: "wiki:verb-result", requestId: "single", result: { ok: true } });
  });

  test("K20 (Sol's batch-head read): an admitted tab's face-row clearance gets its one reply on its own binding", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send({ type: "daemon:gate-verb-request", requestId: "gate-1", verb: "cabal-face", args: {}, requestedBy: "0xatom" });
    const sent = h.islandPosts.at(-1) as { type: string; requestId: string };
    expect(sent.type).toBe("daemon:gate-verb-request");
    expect(sent.requestId).not.toBe("gate-1");                                 // the holder's own correlation
    h.fromIsland({ type: "daemon:gate-verb-result", requestId: sent.requestId });
    expect(a.received.at(-1)).toMatchObject({ type: "daemon:gate-verb-result", requestId: "gate-1" });
    expect(b.received.some((m) => (m as { type?: string }).type === "daemon:gate-verb-result")).toBe(false);
  });

  test("every island-to-vessel kind in the protocol has one declared route", () => {
    expect(Object.keys(HOLDER_ROUTES).sort()).toEqual([...islandKinds].sort());
    for (const kind of islandKinds) expect(HOLDER_ROUTES[kind]).toMatch(/^(reply|camera|owner|port)$/);
  });

  test("a record-port message drops by name while the holder keeps no port lease, and reaches no binding", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    h.fromIsland({ type: "port:changes", portId: "p1", cursor: "n.x.1", entries: [] });
    for (const port of [a, b]) expect(port.received.some((m) => (m as { type?: string }).type === "port:changes")).toBe(false);
    expect(h.drops).toEqual(expect.arrayContaining([{ kind: "port:changes", reason: "no-port-lease" }]));
  });


  const open = { type: "port:open", portId: "p1", wikiUri: "wiki", width: "full", actor: "page", maxRecordBytes: 1000, maxBatchBytes: 10000 };

  test("no policy refuses a port open and leaves the island untouched", async () => {
    const h = harness(); const a = h.port(); await h.core.connect(a.endpoint); await h.admit(a);
    a.send(open);
    expect(a.received.at(-1)).toMatchObject({ kind: "holder:refused", cause: "port-not-granted" });
    expect(h.islandPosts).toHaveLength(0);
  });

  test("second tab cannot act under another port lease; owner close still places", async () => {
    const h = harness(true); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send(open);
    const before = h.islandPosts.length;
    b.send({ type: "port:close", portId: "p1" });
    b.send(open);
    expect(h.islandPosts).toHaveLength(before);
    expect(b.received.filter((m) => (m as { kind?: string }).kind === "holder:refused"))
      .toEqual([expect.objectContaining({ cause: "port-owned" }), expect.objectContaining({ cause: "port-owned" })]);
    a.send({ type: "port:close", portId: "p1" });
    expect(h.islandPosts.at(-1)).toMatchObject({ type: "port:close", portId: "p1" });
  });

  test("a tab cannot forge a vessel lease; the holder posts its own before open", async () => {
    const h = harness(true); const a = h.port(); await h.core.connect(a.endpoint); await h.admit(a);
    a.send({ type: "port:lease", portId: "p1", grant: {} });
    expect(a.received.at(-1)).toMatchObject({ kind: "holder:refused", cause: "port-kind-refused" });
    expect(h.islandPosts).toHaveLength(0);
    a.send(open);
    expect(h.islandPosts.map((msg) => (msg as { type: string }).type)).toEqual(["port:lease", "port:open"]);
  });

  test("snapshot and changes reach only the tab holding their lease", async () => {
    const h = harness(true); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send(open);
    h.fromIsland({ type: "port:snapshot", portId: "p1", cursor: "n.x.0", records: [] });
    h.fromIsland({ type: "port:changes", portId: "p1", cursor: "n.x.1", entries: [] });
    expect(a.received.filter((m) => ["port:snapshot", "port:changes"].includes((m as { type?: string }).type ?? "")))
      .toEqual([expect.objectContaining({ type: "port:snapshot", ...a.envelope() }), expect.objectContaining({ type: "port:changes", ...a.envelope() })]);
    expect(b.received.some((m) => ["port:snapshot", "port:changes"].includes((m as { type?: string }).type ?? ""))).toBe(false);
  });

  test("disconnect posts gone for a tab's lease and frees its reply route", async () => {
    const h = harness(true); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint); await h.admit(a); await h.admit(b);
    a.send(open);
    h.core.disconnect(a.endpoint);
    expect(h.islandPosts.at(-1)).toMatchObject({ type: "port:gone", portId: "p1" });
    h.fromIsland({ type: "port:changes", portId: "p1", cursor: "n.x.1", entries: [] });
    expect(h.drops).toContainEqual({ kind: "port:changes", reason: "no-port-lease" });
    b.send(open);
    expect(h.islandPosts.at(-1)).toMatchObject({ type: "port:open", portId: "p1" });
  });

  test("the port that stands the island owns its boot: `ready` before any manifest reaches it alone", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.admit(a);
    h.fromIsland({ type: "ready" });
    await h.core.connect(b.endpoint); await h.admit(b);
    expect(a.received.some((m) => (m as { type?: string }).type === "ready")).toBe(true);
    expect(b.received.some((m) => (m as { type?: string }).type === "ready")).toBe(false);
  });
});
