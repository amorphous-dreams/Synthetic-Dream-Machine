import { describe, expect, test } from "vitest";
import { makeSharedHolderCore, type HolderIsland, type HolderPort } from "../src/shared-holder-core.js";
import { HOLDER_ROUTES } from "../src/holder-routes.js";
import type { IslandToVesselMsg } from "../../lararium-mesh/src/island-protocol";

const islandKinds = [
  "event", "teardown:ack", "ea", "breath", "fault", "ready", "wiki:verb-result",
  "daemon:delegate-verb", "daemon:derive-skeleton-result", "daemon:worldline-compare-result",
  "daemon:worldline-trajectory-result", "daemon:resolve-binding-result", "daemon:evict-request",
  "daemon:residency-op", "daemon:wiki-alert", "cas:want", "dyad:ask", "doc:rest", "custody:write",
  "view:catalog", "view:content", "view:settle", "lar:frame", "lar:control-result", "lar:service",
] as const satisfies readonly IslandToVesselMsg["type"][];

function harness() {
  const islandListeners = new Set<(message: unknown) => void>();
  const islandPosts: unknown[] = [];
  const drops: Array<{ kind: string; reason: string }> = [];
  const island: HolderIsland = {
    post: (message) => islandPosts.push(message),
    listen: (listener) => { islandListeners.add(listener); return () => islandListeners.delete(listener); },
    onError: () => () => {},
    terminate: () => {},
  };
  const core = makeSharedHolderCore({
    lockName: "holder-routes-test",
    locks: { request: async (_name, _options, callback) => callback({ name: "holder-routes-test" }), query: async () => ({ held: [] }) },
    spawnIsland: () => island,
    onDrop: (kind, reason) => drops.push({ kind, reason }),
  });
  const port = () => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const received: unknown[] = [];
    const endpoint: HolderPort = {
      postMessage: (message) => received.push(message),
      addEventListener: (_type, listener) => listeners.add(listener),
      start: () => {},
    };
    return {
      endpoint,
      received,
      send: (data: unknown) => { for (const listener of listeners) listener({ data, ports: [] } as unknown as MessageEvent); },
    };
  };
  const fromIsland = (message: unknown) => { for (const listener of islandListeners) listener(message); };
  return { core, port, islandPosts, fromIsland, drops };
}

describe("shared holder routing keeps every island answer on its binding", () => {
  test("colliding tab request ids return only to each asker with its own id", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint);
    a.send({ type: "wiki:place-verb", requestId: "same", verb: "a" });
    b.send({ type: "wiki:place-verb", requestId: "same", verb: "b" });
    const sent = h.islandPosts.slice(-2) as Array<{ requestId: string }>;
    expect(sent[0].requestId).not.toBe("same"); expect(sent[1].requestId).not.toBe("same");
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[0].requestId, result: { tab: "a" } });
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[1].requestId, result: { tab: "b" } });
    expect(a.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "same", result: { tab: "a" } });
    expect(b.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "same", result: { tab: "b" } });
    expect(a.received.filter((m) => (m as { type?: string }).type === "wiki:verb-result")).toHaveLength(1);
    expect(b.received.filter((m) => (m as { type?: string }).type === "wiki:verb-result")).toHaveLength(1);
  });

  test("a camera resend leases that camera's frames to its sending port", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint);
    a.send({ type: "lar:resend", cameraId: "camera-X" });
    h.fromIsland({ type: "lar:frame", cameraId: "camera-X", mountEpoch: 1, sequence: 1, payload: "frame" });
    expect(a.received.at(-1)).toMatchObject({ type: "lar:frame", cameraId: "camera-X" });
    expect(b.received.some((m) => (m as { type?: string }).type === "lar:frame")).toBe(false);
  });

  test("manifest owns the island route and owner traffic stays on that port", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint);
    a.send({ type: "manifest", wikiUri: "wiki:a" });
    b.send({ type: "manifest", wikiUri: "wiki:b" });
    expect(h.islandPosts.filter((m) => (m as { type?: string }).type === "manifest")).toHaveLength(1);
    expect(b.received.at(-1)).toMatchObject({ kind: "holder:refused", cause: expect.stringMatching(/island-owned/) });
    h.fromIsland({ type: "breath", wikiUri: "wiki:a" });
    h.fromIsland({ type: "custody:write", requestId: "custody-1", wikiUri: "wiki:a" });
    expect(a.received.slice(-2).map((m) => (m as { type: string }).type)).toEqual(["breath", "custody:write"]);
    expect(b.received.some((m) => ["breath", "custody:write"].includes((m as { type?: string }).type ?? ""))).toBe(false);
  });

  test("unknown replies and unleased camera or owner traffic drop by kind and reason", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint);
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
    await h.core.connect(a.endpoint); await h.core.connect(b.endpoint);
    a.send({ type: "wiki:place-verb", requestId: "a-pending" });
    b.send({ type: "wiki:place-verb", requestId: "b-pending" });
    const sent = h.islandPosts.slice(-2) as Array<{ requestId: string }>;
    h.core.disconnect(a.endpoint);
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[0].requestId });
    h.fromIsland({ type: "wiki:verb-result", requestId: sent[1].requestId });
    expect(a.received.some((m) => (m as { type?: string }).type === "wiki:verb-result")).toBe(false);
    expect(b.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "b-pending" });
    expect(h.drops).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "wiki:verb-result" })]));
  });

  test("CONTROL — one port receives its one matching reply", async () => {
    const h = harness(); const a = h.port();
    await h.core.connect(a.endpoint);
    a.send({ type: "wiki:place-verb", requestId: "single" });
    const sent = h.islandPosts.at(-1) as { requestId: string };
    h.fromIsland({ type: "wiki:verb-result", requestId: sent.requestId, result: { ok: true } });
    expect(a.received.at(-1)).toEqual({ type: "wiki:verb-result", requestId: "single", result: { ok: true } });
  });

  test("every island-to-vessel kind in the protocol has one declared route", () => {
    expect(Object.keys(HOLDER_ROUTES).sort()).toEqual([...islandKinds].sort());
    for (const kind of islandKinds) expect(HOLDER_ROUTES[kind]).toMatch(/^(reply|camera|owner)$/);
  });

  test("the port that stands the island owns its boot: `ready` before any manifest reaches it alone", async () => {
    const h = harness(); const a = h.port(); const b = h.port();
    await h.core.connect(a.endpoint);
    h.fromIsland({ type: "ready" });
    await h.core.connect(b.endpoint);
    expect(a.received.some((m) => (m as { type?: string }).type === "ready")).toBe(true);
    expect(b.received.some((m) => (m as { type?: string }).type === "ready")).toBe(false);
  });
});
