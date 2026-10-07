import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import {
  mountPronaosReadFace, pronaosRouteInventoryForProjection, arrivalDescriptorBytes,
  ARRIVAL_WELL_KNOWN_ROUTE, ARRIVAL_MEDIA_TYPE, ARRIVAL_FORMAT,
  type PronaosFile, type PronaosPreparedProjection, type PronaosProjection,
  type ArrivalOptions, type ArrivalDescriptor, type ArrivalMirror,
} from "../src/pronaos-adapter.js";
import { sha256HexBytesSync } from "@lararium/mesh";

const bytes = (text: string, contentType: string): PronaosFile => ({
  bytes: new TextEncoder().encode(text), contentType,
});

const casFile = bytes("seed-named-cas", "application/octet-stream");
const CID = sha256HexBytesSync(casFile.bytes);
const prepared: PronaosPreparedProjection = {
  index: bytes("<!doctype html><title>web</title>", "text/html; charset=utf-8"),
  assets: new Map([
    ["/assets/index-abc.js", bytes("console.log('web')", "application/javascript")],
    ["/assets/wiki.worker-def.js", bytes("self.postMessage('worker')", "application/javascript")],
  ]),
  manifest: bytes('{"name":"Lararium"}', "application/manifest+json"),
  genesisSeed: bytes('{"seed":"public"}', "application/json"),
  cas: new Map([[CID, casFile]]),
};
const projection: PronaosProjection = {
  ...prepared,
  routeInventory: pronaosRouteInventoryForProjection(prepared),
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
  const mount = mountPronaosReadFace(server, projection);
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

describe("Pronaos adapter — prepared Herm/Lararium projection", () => {
  test("serves exact index, hashed asset/worker, seed, and CAS bytes", async () => {
    const origin = await start();
    for (const [path, expected, type] of [
      ["/", "<!doctype html><title>web</title>", "text/html"],
      ["/assets/wiki.worker-def.js", "self.postMessage('worker')", "application/javascript"],
      ["/manifest.webmanifest", '{"name":"Lararium"}', "application/manifest+json"],
      ["/genesis/seed.json", '{"seed":"public"}', "application/json"],
      [`/genesis/cas/${CID}`, "seed-named-cas", "application/octet-stream"],
    ] as const) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type"), path).toContain(type);
      const cache = response.headers.get("cache-control");
      if (path === "/" || path === "/manifest.webmanifest" || path === "/genesis/seed.json") {
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
    expect(await traversal.text()).toBe("Pronaos path refused");
    const post = await fetch(`${origin}/`, { method: "POST" });
    expect(post.status).toBe(405);
    // The request listener does not claim /ws; a future upgrade handler owns it.
    const wsFace = await fetch(`${origin}/ws`);
    expect(wsFace.status).toBe(404);
  });

  test("refuses a prepared projection whose receipt no longer matches its bytes", () => {
    const bad: PronaosProjection = {
      ...projection,
      index: bytes("tampered", "text/html; charset=utf-8"),
      routeInventory: projection.routeInventory,
    };
    const candidate = createServer();
    expect(() => mountPronaosReadFace(candidate, bad)).toThrow(/does not match prepared projection bytes/);
    candidate.close();
  });
});

describe("Pronaos arrival descriptor — /.well-known/lar (pronaos#/the-first-arrival)", () => {
  const HOUSE = "http://house.lan:8080";
  const seedCid = sha256HexBytesSync(prepared.genesisSeed.bytes);

  async function startWith(arrival: ArrivalOptions): Promise<string> {
    server = createServer();
    const mount = mountPronaosReadFace(server, projection, undefined, arrival);
    dispose = mount.dispose;
    server.on("request", (_req, res) => { if (!res.writableEnded) { res.writeHead(404); res.end("fallback"); } });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    return `http://127.0.0.1:${address.port}`;
  }

  test("the descriptor answers at the well-known name and derives from the route receipt alone", async () => {
    expect(ARRIVAL_WELL_KNOWN_ROUTE).toBe("/.well-known/lar");
    const origin = await startWith({ houseOrigins: [HOUSE] });
    const response = await fetch(`${origin}${ARRIVAL_WELL_KNOWN_ROUTE}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(ARRIVAL_MEDIA_TYPE);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const descriptor = await response.json() as ArrivalDescriptor;
    expect(descriptor.format).toBe(ARRIVAL_FORMAT);
    expect(descriptor.arrival).toBe("/");
    expect(descriptor.routes).toEqual(JSON.parse(JSON.stringify(projection.routeInventory.routes)));
    expect(descriptor.routes.find((route) => route.kind === "genesis-seed")).toMatchObject({ seedCid });
    expect(descriptor.mirrors).toEqual([]);
    // CONTROL: the face claims the one well-known name it serves, never the whole RFC 8615 prefix.
    const other = await fetch(`${origin}/.well-known/other`);
    expect(other.status).toBe(404);
    expect(await other.text()).toBe("fallback");
  });

  test("CONTROL: the negotiated door onto / returns the descriptor's identical bytes; HTML stays the page", async () => {
    const origin = await startWith({ houseOrigins: [HOUSE] });
    const wellKnown = new Uint8Array(await (await fetch(`${origin}${ARRIVAL_WELL_KNOWN_ROUTE}`)).arrayBuffer());
    const negotiated = await fetch(`${origin}/`, { headers: { accept: `${ARRIVAL_MEDIA_TYPE}, text/html;q=0.5` } });
    expect(negotiated.status).toBe(200);
    expect(negotiated.headers.get("content-type")).toBe(ARRIVAL_MEDIA_TYPE);
    expect(negotiated.headers.get("vary")).toMatch(/accept/i);
    expect(Buffer.from(new Uint8Array(await negotiated.arrayBuffer())).equals(Buffer.from(wellKnown))).toBe(true);
    expect(Buffer.from(wellKnown).equals(Buffer.from(arrivalDescriptorBytes(projection, { houseOrigins: [HOUSE] })))).toBe(true);
    // CONTROL: a browser's ordinary navigation (and a wildcard) still reads the arrival page.
    for (const accept of ["text/html,application/xhtml+xml,*/*;q=0.8", "*/*"]) {
      const page = await fetch(`${origin}/`, { headers: { accept } });
      expect(page.headers.get("content-type"), accept).toContain("text/html");
      expect(page.headers.get("vary"), accept).toMatch(/accept/i);
      expect(await page.text(), accept).toBe("<!doctype html><title>web</title>");
    }
  });

  test("CONTROL: no mirror origin equals the house origin or another mirror's, and a mirror names a receipt CID", async () => {
    const assetCid = projection.routeInventory.routes.find((route) => route.kind === "web-artifact" && route.path === "/assets/wiki.worker-def.js");
    if (!assetCid || assetCid.kind !== "web-artifact") throw new Error("fixture names no worker asset");
    const mirrors = [
      { cid: CID, origin: "https://m1.mirror.example" },
      { cid: assetCid.artifactCid, origin: "https://m2.mirror.example" },
    ];
    const descriptor = JSON.parse(new TextDecoder().decode(arrivalDescriptorBytes(projection, { houseOrigins: [HOUSE], mirrors }))) as ArrivalDescriptor;
    const origins = descriptor.mirrors.map((mirror) => mirror.origin);
    expect(new Set(origins).size).toBe(origins.length);
    expect(origins).not.toContain(HOUSE);
    expect(descriptor.mirrors).toHaveLength(2);

    const refuse = (houseOrigins: readonly string[], bad: readonly ArrivalMirror[]): void => {
      expect(() => arrivalDescriptorBytes(projection, { houseOrigins, mirrors: bad })).toThrow(/\[pronaos\] mirror/);
    };
    refuse([HOUSE], [{ cid: CID, origin: HOUSE }]);                                   // the house's own origin
    refuse([HOUSE], [{ cid: CID, origin: `${HOUSE}/` }]);                             // spelled with a slash
    refuse([HOUSE], [mirrors[0]!, { cid: assetCid.artifactCid, origin: mirrors[0]!.origin }]); // two CIDs, one origin
    refuse([HOUSE], [mirrors[0]!, mirrors[0]!]);                                      // one origin twice
    refuse([HOUSE], [{ cid: "c".repeat(64), origin: "https://m3.mirror.example" }]);  // a CID no receipt names
    refuse([HOUSE], [{ cid: CID, origin: "https://m4.mirror.example/path" }]);       // not an origin
    // CONTROL: the very same mirror stands once its origin is no longer the house's.
    expect(() => arrivalDescriptorBytes(projection, { houseOrigins: ["http://other.lan"], mirrors: [{ cid: CID, origin: HOUSE }] })).not.toThrow();
  });
});
