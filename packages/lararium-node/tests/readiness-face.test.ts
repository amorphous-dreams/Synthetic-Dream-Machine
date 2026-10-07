import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("Node readiness face", () => {
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
      if (req.url === "/oracle/pointer") { res.writeHead(200); res.end("oracle-face"); return; }
      if (!res.writableEnded) { res.writeHead(404); res.end("other-face"); }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("readiness test did not bind");
    const origin = `http://127.0.0.1:${address.port}`;
    const oracle = await fetch(`${origin}/oracle/pointer`);
    expect(oracle.status).toBe(200);
    expect(await oracle.text()).toBe("oracle-face");
    const pronaos = await fetch(`${origin}/`);
    expect(pronaos.status).toBe(404);
    const arbitrary = await fetch(`${origin}/api/health/extra`);
    expect(arbitrary.status).toBe(404);
    face.dispose();
  });
});
