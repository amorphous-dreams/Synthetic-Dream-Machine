import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { mountPronaosPublicArtifact } from "../src/pronaos-adapter.js";
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

let server: Server | undefined;
let dispose: (() => void) | undefined;

afterEach(async () => {
  dispose?.(); dispose = undefined;
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function start(held = bytes): Promise<string> {
  server = createServer();
  dispose = mountPronaosPublicArtifact(server, publication(), held).dispose;
  server.on("request", (_req, res) => { if (!res.writableEnded) { res.writeHead(404); res.end("other face"); } });
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
    expect((await fetch(`${origin}/assets/other.js`)).status).toBe(404);
    expect((await fetch(`${origin}/assets/published.js`, { method: "POST" })).status).toBe(405);
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
});
