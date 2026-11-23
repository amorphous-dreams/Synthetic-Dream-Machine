import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { createReadinessState, mountReadinessFace, markReadyOnceStanding } from "../src/readiness-face.js";
import { createEngineWatch, ENGINE_HAND_ACT } from "../src/engine-watch.js";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("Node readiness face", () => {
  test("health counts planes that settle degraded after boot without exposing their names", async () => {
    const server = createServer(); servers.push(server);
    const state = createReadinessState();
    const entries: Array<{ bagId: string; documentId: string; status: "sealed" | "degraded" | "pending" }> = [{ bagId: "private-plane", documentId: "private-document", status: "sealed" }];
    state.notePlanes({ entries, degraded: false });
    state.markReady();
    mountReadinessFace({ httpServer: server, state, standing: "lararium" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const url = `http://127.0.0.1:${address.port}/api/health`;
    expect(await (await fetch(url)).json()).toEqual({ status: "ready" });
    entries[0]!.status = "degraded";
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", held: { pending: 0, degraded: 1 } });
  });
  test("answers 503 before setup, 200 after injected setup, and 405 for unsupported methods", async () => {
    const server = createServer(); servers.push(server);
    const state = createReadinessState();
    const face = mountReadinessFace({ httpServer: server, state, standing: "lararium" });
    server.on("request", (req, res) => { if (!res.writableEnded) { res.writeHead(404); res.end("other face"); } });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const origin = `http://127.0.0.1:${address.port}`;

    const starting = await fetch(`${origin}/api/health`);
    expect(starting.status).toBe(503);
    expect(await starting.json()).toEqual({ status: "starting" });
    const head = await fetch(`${origin}/api/health`, { method: "HEAD" });
    expect(head.status).toBe(503);
    expect(await head.text()).toBe("");
    const post = await fetch(`${origin}/api/health`, { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");

    state.markReady();
    const ready = await fetch(`${origin}/api/health`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready" });
    expect(ready.headers.get("cache-control")).toBe("no-store");
    face.dispose();
    const afterDispose = await fetch(`${origin}/api/health`);
    expect(afterDispose.status).toBe(404);
  });

  test("does not own Oracle, Pronaos, or arbitrary API paths", async () => {
    const server = createServer(); servers.push(server);
    const face = mountReadinessFace({ httpServer: server, state: createReadinessState(), standing: "lararium" });
    server.on("request", (req, res) => {
      if (req.url === "/flow/pointer") { res.writeHead(200); res.end("flow-face"); return; }
      if (!res.writableEnded) { res.writeHead(404); res.end("other-face"); }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const origin = `http://127.0.0.1:${address.port}`;
    const flow = await fetch(`${origin}/flow/pointer`);
    expect(flow.status).toBe(200);
    expect(await flow.text()).toBe("flow-face");
    const pronaos = await fetch(`${origin}/`);
    expect(pronaos.status).toBe(404);
    const arbitrary = await fetch(`${origin}/api/health/extra`);
    expect(arbitrary.status).toBe(404);
    face.dispose();
  });

  test("health reads `starting` while the verb dispatcher is held back, and `ready` once it stands", async () => {
    const server = createServer(); servers.push(server);
    const state = createReadinessState();
    mountReadinessFace({ httpServer: server, state, standing: "lararium" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const origin = `http://127.0.0.1:${address.port}`;

    // The injected gate stands for the daemon island's `ea`: the dispatcher starts before it fires.
    let release!: () => void;
    const dispatcherStands = new Promise<void>((resolve) => { release = resolve; });
    const marked = markReadyOnceStanding(state, dispatcherStands);

    await new Promise((r) => setImmediate(r));
    expect((await fetch(`${origin}/api/health`)).status).toBe(503);
    expect(state.status()).toBe("starting");

    release();
    await marked;
    expect((await fetch(`${origin}/api/health`)).status).toBe(200);
  });

  test("a dispatcher that never stands leaves health `starting` and the readiness promise rejected", async () => {
    const state = createReadinessState();
    await expect(markReadyOnceStanding(state, Promise.reject(new Error("daemon island fault")))).rejects.toThrow(/daemon island fault/);
    expect(state.status()).toBe("starting");
  });

  test("a dead engine takes health down: 503 naming the cause, its time and the last settled wave, never a restart", async () => {
    const server = createServer(); servers.push(server);
    const engine = createEngineWatch(() => new Date("2026-11-22T10:34:00.000Z"));
    const state = createReadinessState(engine);
    mountReadinessFace({ httpServer: server, state, standing: "lararium" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const origin = `http://127.0.0.1:${address.port}`;
    state.markReady();
    engine.settled(["4f2a"]);
    expect((await fetch(`${origin}/api/health`)).status).toBe(200);

    // An injected fault, the shape the incident's repo logged: no wasm instance runs out of anything here.
    engine.note(new Error("Module terminated"), "repo");
    const fallen = await fetch(`${origin}/api/health`);
    expect(fallen.status).toBe(503);
    expect(fallen.headers.get("cache-control")).toBe("no-store");
    const body = await fallen.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      status: "engine-terminated", cause: "module-terminated", path: "repo", since: "2026-11-22T10:34:00.000Z",
      lastSettled: { at: "2026-11-22T10:34:00.000Z", heads: ["4f2a"] }, hand: ENGINE_HAND_ACT,
    });
    expect(state.status()).toBe("engine-terminated");
    // A HEAD probe (the container's) reads the same verdict.
    expect((await fetch(`${origin}/api/health`, { method: "HEAD" })).status).toBe(503);
  });
  test("health carries the engine meter where one stands, beside the status and inside a fall's body", async () => {
    const server = createServer(); servers.push(server);
    const engine = createEngineWatch(() => new Date("2026-11-23T19:25:00.000Z"));
    const reading = { isolate: "main", wasm: { bytes: 65_536, pages: 1, highWaterBytes: 65_536, ceilingBytes: 2 ** 32, fraction: 2 ** -16 },
      node: { heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 4, rss: 5, maxRss: 6 }, process: null };
    const state = createReadinessState(engine, () => reading);
    mountReadinessFace({ httpServer: server, state, standing: "lararium" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const url = `http://127.0.0.1:${address.port}/api/health`;
    expect(await (await fetch(url)).json()).toEqual({ status: "starting", engine: reading });
    state.markReady();
    expect(await (await fetch(url)).json()).toEqual({ status: "ready", engine: reading });
    engine.note(new Error("Module terminated"), "repo");
    const fallen = await fetch(url);
    expect(fallen.status).toBe(503);
    expect(await fallen.json()).toMatchObject({ status: "engine-terminated", cause: "module-terminated", engine: reading });
    // A meter that throws costs health nothing: the status answers without it, over the wire and inside a fall's body.
    const brokenServer = createServer(); servers.push(brokenServer);
    const brokenEngine = createEngineWatch(() => new Date("2026-11-23T19:25:00.000Z"));
    const broken = createReadinessState(brokenEngine, () => { throw new Error("smaps unreadable"); });
    mountReadinessFace({ httpServer: brokenServer, state: broken, standing: "lararium" });
    await new Promise<void>((resolve) => brokenServer.listen(0, "127.0.0.1", resolve));
    const brokenAddress = brokenServer.address();
    if (!brokenAddress || typeof brokenAddress === "string") throw new Error("readiness test did not bind");
    const brokenUrl = `http://127.0.0.1:${brokenAddress.port}/api/health`;
    broken.markReady();
    const steady = await fetch(brokenUrl);
    expect(steady.status).toBe(200);
    expect(await steady.json()).toEqual({ status: "ready" });
    brokenEngine.note(new Error("Module terminated"), "repo");
    const fallenBroken = await fetch(brokenUrl);
    expect(fallenBroken.status).toBe(503);
    const fallenBody = await fallenBroken.json() as Record<string, unknown>;
    expect(fallenBody).toMatchObject({ status: "engine-terminated", cause: "module-terminated" });
    expect(fallenBody).not.toHaveProperty("engine");
    const shaky = createReadinessState(undefined, () => { throw new Error("smaps unreadable"); });
    shaky.markReady();
    expect(shaky.body()).toEqual({ status: "ready" });
  });
});
