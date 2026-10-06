import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  composePronaosFromEnv,
  parsePronaosCompositionConfig,
} from "../src/pronaos-composition.js";

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): { web: string; genesis: string; cid: string } {
  const root = mkdtempSync("/tmp/lararium-pronaos-composition-"); roots.push(root);
  const web = join(root, "web"); const genesis = join(root, "genesis");
  mkdirSync(join(web, "assets"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
  const cas = Buffer.from("composition-cas");
  const cid = createHash("sha256").update(cas).digest("hex");
  writeFileSync(join(web, "index.html"), '<link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/assets/wiki.worker-def.js"></script>');
  writeFileSync(join(web, "manifest.webmanifest"), '{"name":"Pronaos"}');
  writeFileSync(join(web, "assets/wiki.worker-def.js"), "self.postMessage('worker')");
  const seed = {
    format: "lararium-genesis-seed/v1", actorSeed: "composition-actor", schemaVersion: "1",
    blobs: { fixture: { id: "fixture", version: "1", sha256: cid, mimeType: "application/octet-stream" } },
    tiddlers: {
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: "engine-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: "grammar-region" } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: "plugins-region" } },
    },
  };
  writeFileSync(join(genesis, "seed.json"), JSON.stringify(seed));
  writeFileSync(join(genesis, "cas", cid), cas);
  return { web, genesis, cid };
}

function envFor(f: ReturnType<typeof fixture>): Record<string, unknown> {
  const record = {
    schema: "lararium-pronaos-artifact/v1",
    routes: [
      ["/", "index.html", "text/html; charset=utf-8", "no-store"],
      ["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json", "no-store"],
      ["/assets/wiki.worker-def.js", "assets/wiki.worker-def.js", "application/javascript", "immutable"],
    ].map(([path, file, contentType, cache]) => ({ path, file, contentType, cache,
      sha256: createHash("sha256").update(readFileSync(join(f.web, file))).digest("hex") })),
  };
  return {
    LAR_PRONAOS_WEB_ROOT: f.web,
    LAR_PRONAOS_ARTIFACT_RECORD: writeRecord(record),
  };
}

function writeRecord(record: object): string {
  const path = join(roots[0]!, "artifact-record.json");
  writeFileSync(path, JSON.stringify(record));
  return path;
}

describe("Pronaos Node composition", () => {
  test("keeps no-config boot inert and rejects partial, malformed, duplicate, and non-string config", () => {
    expect(parsePronaosCompositionConfig({})).toBeNull();
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web" })).toThrow(/supplied together/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_ARTIFACT_RECORD: "/tmp/record" })).toThrow(/supplied together/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web", LAR_PRONAOS_ARTIFACT_RECORD: " " })).toThrow(/exact path/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: 42, LAR_PRONAOS_ARTIFACT_RECORD: "/tmp/record" })).toThrow(/exact path/);
  });

  test("does not mount without both explicit inputs", () => {
    const server = createServer(); servers.push(server);
    expect(composePronaosFromEnv({ httpServer: server, genesisDir: "/never-read", standing: "lararium", env: {} })).toBeNull();
  });

  test("refuses a stale artifact record before mounting", () => {
    const f = fixture();
    const server = createServer(); servers.push(server);
    const env = envFor(f);
    writeFileSync(join(f.web, "assets/wiki.worker-def.js"), "tampered");
    expect(() => composePronaosFromEnv({ httpServer: server, genesisDir: f.genesis, standing: "lararium", env })).toThrow(/artifact receipt/);
  });

  test("mounts only exact Pronaos routes and leaves the Oracle face reachable", async () => {
    const f = fixture();
    const server = createServer(); servers.push(server);
    const composition = composePronaosFromEnv({ httpServer: server, genesisDir: f.genesis, standing: "lararium", env: envFor(f) });
    expect(composition?.projection.routeInventory.routes.map((route) => route.path)).toEqual([
      "/", "/manifest.webmanifest", "/genesis/seed.json", "/assets/wiki.worker-def.js", `/genesis/cas/${f.cid}`,
    ]);
    server.on("request", (req, res) => {
      if (req.url === "/oracle/pointer") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"face":"oracle"}'); return; }
      if (!res.writableEnded) { res.writeHead(404); res.end("fallback"); }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("composition test did not bind");
    const origin = `http://127.0.0.1:${address.port}`;
    for (const [path, cache] of [
      ["/", "no-store"],
      ["/manifest.webmanifest", "no-store"],
      ["/genesis/seed.json", "no-store"],
      ["/assets/wiki.worker-def.js", "public, immutable, max-age=31536000"],
      [`/genesis/cas/${f.cid}`, "public, immutable, max-age=31536000"],
    ] as const) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("cache-control"), path).toBe(cache);
    }
    const oracle = await fetch(`${origin}/oracle/pointer`);
    expect(oracle.status).toBe(200);
    expect(await oracle.text()).toBe('{"face":"oracle"}');
    const privatePath = await fetch(`${origin}/private/document.json`);
    expect(privatePath.status).toBe(404);
    expect(await privatePath.text()).toBe("fallback");
    const wsPath = await fetch(`${origin}/ws`);
    expect(wsPath.status).toBe(404);
    composition?.dispose();
  });
  test("a herm never mounts the Pronaos: any Pronaos input refuses with the waystone message", () => {
    const f = fixture();
    const server = createServer(); servers.push(server);
    const waystone = /a waystone serves no arrival page; light a Pronaos on a lararium/;
    expect(() => composePronaosFromEnv({ httpServer: server, genesisDir: f.genesis, standing: "herm", env: envFor(f) })).toThrow(waystone);
    expect(() => composePronaosFromEnv({ httpServer: server, genesisDir: f.genesis, standing: "herm", env: { LAR_PRONAOS_WEB_ROOT: f.web } })).toThrow(waystone);
    expect(composePronaosFromEnv({ httpServer: server, genesisDir: "/never-read", standing: "herm", env: {} })).toBeNull();
    // CONTROL: the same inputs on a lararium compose the Pronaos.
    const composition = composePronaosFromEnv({ httpServer: server, genesisDir: f.genesis, standing: "lararium", env: envFor(f) });
    expect(composition).not.toBeNull();
    composition?.dispose();
  });
});
