import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  return {
    LAR_PRONAOS_WEB_ROOT: f.web,
    LAR_PRONAOS_ASSET_ROUTES_JSON: JSON.stringify(["/assets/wiki.worker-def.js"]),
  };
}

describe("Pronaos Node composition", () => {
  test("keeps no-config boot inert and rejects partial, malformed, duplicate, and non-string config", () => {
    expect(parsePronaosCompositionConfig({})).toBeNull();
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web" })).toThrow(/supplied together/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_ASSET_ROUTES_JSON: "[]" })).toThrow(/supplied together/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web", LAR_PRONAOS_ASSET_ROUTES_JSON: "{" })).toThrow(/valid JSON/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web", LAR_PRONAOS_ASSET_ROUTES_JSON: "[]" })).toThrow(/at least one asset route/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web", LAR_PRONAOS_ASSET_ROUTES_JSON: "[1]" })).toThrow(/exact strings/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: "/tmp/web", LAR_PRONAOS_ASSET_ROUTES_JSON: JSON.stringify(["/assets/a.js", "/assets/a.js"]) })).toThrow(/duplicate/);
    expect(() => parsePronaosCompositionConfig({ LAR_PRONAOS_WEB_ROOT: 42, LAR_PRONAOS_ASSET_ROUTES_JSON: "[]" })).toThrow(/exact path/);
  });

  test("does not mount without both explicit inputs", () => {
    const server = createServer(); servers.push(server);
    expect(composePronaosFromEnv({ httpServer: server, genesisDir: "/never-read", env: {} })).toBeNull();
  });

  test("mounts only exact Pronaos routes and leaves the Oracle face reachable", async () => {
    const f = fixture();
    const server = createServer(); servers.push(server);
    const composition = composePronaosFromEnv({ httpServer: server, genesisDir: f.genesis, env: envFor(f) });
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
});
