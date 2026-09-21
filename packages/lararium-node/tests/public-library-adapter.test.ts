import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import {
  mountPublicLibraryReadFace, type PublicLibraryFile, type PublicLibraryProjection,
} from "../src/public-library-adapter.js";

const bytes = (text: string, contentType: string): PublicLibraryFile => ({
  bytes: new TextEncoder().encode(text), contentType,
});

const CID = "a".repeat(64);
const projection: PublicLibraryProjection = {
  index: bytes("<!doctype html><title>web</title>", "text/html; charset=utf-8"),
  assets: new Map([
    ["/assets/index-abc.js", bytes("console.log('web')", "application/javascript")],
    ["/assets/wiki.worker-def.js", bytes("self.postMessage('worker')", "application/javascript")],
  ]),
  genesisSeed: bytes('{"seed":"public"}', "application/json"),
  genesisManifest: bytes(JSON.stringify({ blobs: [{ cid: CID }] }), "application/json"),
  cas: new Map([[CID, bytes("manifest-named-cas", "application/octet-stream")]]),
};

let server: Server | undefined;
let dispose: (() => void) | undefined;

afterEach(async () => {
  dispose?.(); dispose = undefined;
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function start(): Promise<string> {
  server = createServer();
  const mount = mountPublicLibraryReadFace(server, projection);
  dispose = mount.dispose;
  // A real Node vessel has other listeners for /oracle and /bulb. This test
  // fallback stands in for their absent faces and proves unowned paths are
  // not accidentally answered by the library adapter.
  server.on("request", (req, res) => {
    if (req.url === "/oracle/pointer") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"face":"oracle"}');
      return;
    }
    if (!res.writableEnded) { res.writeHead(404); res.end(); }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  return `http://127.0.0.1:${address.port}`;
}

describe("public-library adapter — prepared Herm/Lararium projection", () => {
  test("serves exact index, hashed asset/worker, seed, manifest, and CAS bytes", async () => {
    const origin = await start();
    for (const [path, expected, type] of [
      ["/", "<!doctype html><title>web</title>", "text/html"],
      ["/assets/wiki.worker-def.js", "self.postMessage('worker')", "application/javascript"],
      ["/genesis/seed.json", '{"seed":"public"}', "application/json"],
      ["/genesis/manifest.json", JSON.stringify({ blobs: [{ cid: CID }] }), "application/json"],
      [`/genesis/cas/${CID}`, "manifest-named-cas", "application/octet-stream"],
    ] as const) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type"), path).toContain(type);
      const cache = response.headers.get("cache-control");
      if (path === "/" || path === "/genesis/seed.json" || path === "/genesis/manifest.json") {
        expect(cache, path).toBe("no-store");
      } else {
        expect(cache, path).toContain("public");
        expect(cache, path).toContain("immutable");
      }
      expect(await response.text(), path).toBe(expected);
    }
  });

  test("refuses missing immutable members without SPA fallback", async () => {
    const origin = await start();
    for (const path of [
      "/assets/missing-worker.js", `/genesis/cas/${"b".repeat(64)}`,
      "/genesis/missing.json", "/private/document.json", "/oracle/pointer.html",
    ]) {
      const response = await fetch(`${origin}${path}`);
      // Unowned routes are left for other faces; this bare server has no other face and closes them.
      expect(response.status, path).toBe(404);
      expect(await response.text(), path).not.toContain("<!doctype html>");
    }
    const oracle = await fetch(`${origin}/oracle/pointer`);
    expect(oracle.status).toBe(200);
    expect(await oracle.text()).toBe('{"face":"oracle"}');
  });

  test("refuses traversal and mutation while leaving the /ws upgrade namespace alone", async () => {
    const origin = await start();
    // Double-encoding keeps the traversal spelling on the wire; fetch's URL
    // normalizer otherwise collapses the first encoded dot before Node sees it.
    const traversal = await fetch(`${origin}/assets/%252e%252e/private.json`);
    expect(traversal.status).toBe(404);
    expect(await traversal.text()).toBe("public library path refused");
    const post = await fetch(`${origin}/`, { method: "POST" });
    expect(post.status).toBe(405);
    // The request listener does not claim /ws; a future upgrade handler owns it.
    const wsFace = await fetch(`${origin}/ws`);
    expect(wsFace.status).toBe(404);
  });
});
