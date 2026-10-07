import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { createReadinessState, mountReadinessFace } from "../src/readiness-face.js";
import {
  mountPronaosReadFace,
  pronaosRouteInventoryForProjection,
  type PronaosProjection,
} from "../src/pronaos-adapter.js";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function origin(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("face integration did not bind");
  return "http://127.0.0.1:" + address.port;
}

function projection(): PronaosProjection {
  const prepared = {
    index: { bytes: new Uint8Array(Buffer.from("<html>arrival</html>")), contentType: "text/html; charset=utf-8" },
    assets: new Map([["/assets/wiki.worker-test.js", { bytes: new Uint8Array(Buffer.from("worker")), contentType: "application/javascript" }]]),
    genesisSeed: { bytes: new Uint8Array(Buffer.from('{"blobs":{}}')), contentType: "application/json" },
    cas: new Map(),
  };
  return { ...prepared, routeInventory: pronaosRouteInventoryForProjection(prepared) };
}

describe("production face dispatcher integration", () => {
  test("keeps readiness, Pronaos, and Oracle ownership distinct with terminal refusals", async () => {
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    const readiness = mountReadinessFace({ httpServer: server, state: createReadinessState(), standing: "lararium", dispatcher });
    const pronaos = mountPronaosReadFace(server, projection(), dispatcher);
    const oracleUnregister = dispatcher.register({
      name: "oracle-test",
      routeKeys: ["oracle:/oracle"],
      owns: (req) => new URL(req.url ?? "/", "http://localhost").pathname.startsWith("/oracle"),
      handle: (_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ face: "oracle" })); },
    });
    const base = await origin(server);

    const health = await fetch(base + "/api/health");
    expect(health.status).toBe(503);
    expect(await health.json()).toEqual({ status: "starting" });
    const arrival = await fetch(base + "/");
    expect(arrival.status).toBe(200);
    expect(await arrival.text()).toBe("<html>arrival</html>");
    const worker = await fetch(base + "/assets/wiki.worker-test.js");
    expect(worker.status).toBe(200);
    expect(await worker.text()).toBe("worker");
    const oracle = await fetch(base + "/oracle/pointer");
    expect(oracle.status).toBe(200);
    expect(await oracle.text()).toBe(JSON.stringify({ face: "oracle" }));
    const undeclared = await fetch(base + "/undeclared");
    expect(undeclared.status).toBe(404);
    expect(undeclared.headers.get("cache-control")).toBe("no-store");
    const plainWs = await fetch(base + "/ws");
    expect(plainWs.status).toBe(404);

    oracleUnregister();
    readiness.dispose();
    pronaos.dispose();
    dispatcher.dispose();
  });
});
