import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { mountHttpFaceDispatcher, type HttpFace } from "../src/http-face-dispatcher.js";
import { CLOSED_DOOR } from "../src/bulb-routes.js";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function face(overrides: Partial<HttpFace> = {}): HttpFace {
  return {
    name: "face",
    routeKeys: ["face"],
    owns: () => true,
    handle: (_req, res) => { res.writeHead(200); res.end("owned"); },
    ...overrides,
  };
}

async function origin(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("dispatcher test did not bind");
  return "http://127.0.0.1:" + address.port;
}

describe("HTTP face dispatcher", () => {
  test("returns a prompt uniform refusal for an unclaimed request", async () => {
    const server = createServer(); servers.push(server);
    mountHttpFaceDispatcher(server);
    const response = await fetch(await origin(server) + "/unclaimed");
    expect(response.status).toBe(CLOSED_DOOR.status);
    expect(response.headers.get("cache-control")).toBe(CLOSED_DOOR.headers["cache-control"]);
    expect(response.headers.get("content-type")).toBe(CLOSED_DOOR.headers["content-type"]);
    expect(await response.text()).toBe(CLOSED_DOOR.body);
  });

  test("dispatches the first face that claims and passes through earlier faces", async () => {
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    dispatcher.register(face({ name: "pass", routeKeys: ["pass"], owns: () => false }));
    dispatcher.register(face({ name: "second", routeKeys: ["second"] }));
    const response = await fetch(await origin(server) + "/owned");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("owned");
  });

  test("does not preempt a synchronously claimed face while it answers asynchronously", async () => {
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    let release!: () => void;
    let claimed!: () => void;
    const claimedPromise = new Promise<void>((resolve) => { claimed = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    dispatcher.register(face({
      name: "slow",
      routeKeys: ["slow"],
      handle: async (_req, res) => {
        claimed();
        await held;
        res.writeHead(200); res.end("delayed");
      },
    }));
    const responsePromise = fetch(await origin(server) + "/slow");
    await claimedPromise;
    release();
    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("delayed");
  });

  test("rejects duplicate route ownership and safely unregisters a face", async () => {
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    const unregister = dispatcher.register(face({ name: "first", routeKeys: ["shared"] }));
    expect(() => dispatcher.register(face({ name: "second", routeKeys: ["shared"] }))).toThrow(/already owned/);
    unregister();
    const unregisterReplacement = dispatcher.register(face({ name: "replacement", routeKeys: ["shared"] }));
    unregisterReplacement();
    const response = await fetch(await origin(server) + "/after-unregister");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("route unavailable");
    dispatcher.dispose();
  });

  test("routes an upgrade to the one socket face that claims its path and destroys the rest", async () => {
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    const seen: string[] = [];
    const off = dispatcher.registerUpgrade({
      name: "probe", path: "/sock",
      handle: (req, socket) => { seen.push(req.url ?? ""); socket.end("HTTP/1.1 101 Switching Protocols\r\n\r\n"); },
    });
    expect(() => dispatcher.registerUpgrade({ name: "other", path: "/sock", handle: () => {} })).toThrow(/already owned/);
    const base = (await origin(server)).replace("http", "ws");
    const outcome = (path: string): Promise<string> => new Promise((resolve) => {
      const ws = new WebSocket(base + path);
      ws.onerror = () => resolve("refused");
      ws.onopen = () => resolve("opened");
    });
    await outcome("/sock");                     // the claimed path reaches its face
    expect(seen).toEqual(["/sock"]);
    expect(await outcome("/unclaimed")).toBe("refused");
    expect(seen).toEqual(["/sock"]);           // no face answered the unclaimed upgrade
    off();
    await outcome("/sock");
    expect(seen).toEqual(["/sock"]);           // an unregistered path is unclaimed again
    dispatcher.dispose();
  });
});
