import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import {
  mountPronaosPublicArtifact,
  mountPronaosReadFace,
  pronaosRouteInventoryForProjection,
  type PronaosProjection,
} from "../src/pronaos-adapter.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import type { PublicArtifactPublication } from "@lararium/mesh";

const bytes = new TextEncoder().encode("operator-published bytes");
const cid = createHash("sha256").update(bytes).digest("hex");
const publication = (): PublicArtifactPublication => ({
  schema: "lararium-pronaos-public-artifact/v1",
  operator: { id: "house-operator", authentication: "local-operator" },
  artifactCid: cid,
  integrity: `sha256:${cid}`,
  route: { path: "/assets/published.js", contentType: "application/javascript", cache: "immutable" },
  ability: "public-artifact:deliver",
});

function projection(): PronaosProjection {
  const projection = {
    index: { bytes: new TextEncoder().encode("index"), contentType: "text/html" },
    assets: new Map([["/assets/published.js", { bytes, contentType: "application/javascript" }]]),
    genesisSeed: { bytes: new TextEncoder().encode("seed"), contentType: "application/json" },
    cas: new Map(),
  };
  return { ...projection, routeInventory: pronaosRouteInventoryForProjection(projection) };
}

let server: Server | undefined;
let dispose: (() => void) | undefined;
let disposeDispatcher: (() => void) | undefined;

afterEach(async () => {
  dispose?.(); dispose = undefined;
  disposeDispatcher?.(); disposeDispatcher = undefined;
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function start(held = bytes): Promise<string> {
  server = createServer();
  const dispatcher = mountHttpFaceDispatcher(server);
  disposeDispatcher = dispatcher.dispose;
  dispatcher.register({
    name: "oracle-test-face",
    routeKeys: ["oracle-test:/oracle/pointer"],
    owns: (req) => new URL(req.url ?? "/", "http://localhost").pathname === "/oracle/pointer",
    handle: (_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("other face"); },
  });
  // Register the public face after the neighboring face: the dispatcher must
  // still route the exact published path to it without falling through.
  dispose = mountPronaosPublicArtifact(server, publication(), held, dispatcher).dispose;
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("public artifact test did not bind");
  return `http://127.0.0.1:${address.port}`;
}

describe("Node Pronaos public-artifact carrier", () => {
  test("delivers only the exact publication route and bytes", async () => {
    const origin = await start();
    const response = await fetch(`${origin}/assets/published.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, immutable, max-age=31536000");
    expect(await response.text()).toBe("operator-published bytes");
    const head = await fetch(`${origin}/assets/published.js`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect((await fetch(`${origin}/assets/other.js`)).status).toBe(404);
    expect((await fetch(`${origin}/assets/published.js`, { method: "POST" })).status).toBe(405);
    expect(await (await fetch(`${origin}/oracle/pointer`)).text()).toBe("other face");
    dispose?.(); dispose = undefined;
    const afterDispose = await fetch(`${origin}/assets/published.js`);
    expect(afterDispose.status).toBe(404);
    expect(await afterDispose.text()).toBe("route unavailable");
  });

  test("refuses mutated carrier bytes and preserves other faces", async () => {
    const altered = bytes.slice(); altered[0] = altered[0]! ^ 1;
    const origin = await start(altered);
    const response = await fetch(`${origin}/assets/published.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Pronaos artifact unavailable");
    expect(await (await fetch(`${origin}/oracle/pointer`)).text()).toBe("other face");
  });

  test("rejects widened authority before mounting", () => {
    server = createServer();
    expect(() => mountPronaosPublicArtifact(server!, {
      ...publication(), ability: "arbitrary-cas-read" as "public-artifact:deliver",
    }, bytes)).toThrow(/only public-artifact:deliver/);
  });

  test.each([
    ["read face first", (server: Server, dispatcher: ReturnType<typeof mountHttpFaceDispatcher>) => {
      const read = mountPronaosReadFace(server, projection(), dispatcher);
      expect(() => mountPronaosPublicArtifact(server, publication(), bytes, dispatcher)).toThrow(/already owned/);
      read.dispose();
    }],
    ["public carrier first", (server: Server, dispatcher: ReturnType<typeof mountHttpFaceDispatcher>) => {
      const publicMount = mountPronaosPublicArtifact(server, publication(), bytes, dispatcher);
      expect(() => mountPronaosReadFace(server, projection(), dispatcher)).toThrow(/already owned/);
      publicMount.dispose();
    }],
  ])("refuses a Pronaos read/public overlap before either face answers (%s)", (_label, mount) => {
    server = createServer();
    const dispatcher = mountHttpFaceDispatcher(server);
    disposeDispatcher = dispatcher.dispose;
    mount(server, dispatcher);
  });
});
