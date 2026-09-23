import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildPronaosProjection } from "../src/pronaos-projection.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(): { web: string; genesis: string; cid: string } {
  const root = mkdtempSync("/tmp/lararium-pronaos-"); roots.push(root);
  const web = join(root, "web"); const genesis = join(root, "genesis");
  mkdirSync(join(web, "assets"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
  const cas = Buffer.from("public-cas"); const cid = createHash("sha256").update(cas).digest("hex");
  const regionCids = { engine: "engine-region", grammar: "grammar-region", plugins: "plugins-region" };
  writeFileSync(join(web, "index.html"), '<link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/assets/index-abc.js"></script>');
  writeFileSync(join(web, "manifest.webmanifest"), '{"name":"Lararium"}');
  writeFileSync(join(web, "assets/index-abc.js"), "index");
  writeFileSync(join(web, "assets/wiki.worker-def.js"), "worker");
  const blob = { id: "fixture", version: "1", sha256: cid, mimeType: "application/octet-stream" };
  writeFileSync(join(genesis, "seed.json"), JSON.stringify({
    format: "lararium-genesis-seed/v1", actorSeed: "fixture-actor", schemaVersion: "1", blobs: { fixture: blob },
    tiddlers: {
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": { tiddler: { cid: regionCids.engine } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-grammar": { tiddler: { cid: regionCids.grammar } },
      "lar:///ha.ka.ba/bags/oracle/genesis-cid-plugins": { tiddler: { cid: regionCids.plugins } },
    },
  }));
  writeFileSync(join(genesis, "cas", cid), cas);
  return { web, genesis, cid };
}

function artifact(f: ReturnType<typeof fixture>, routes = ["/assets/index-abc.js", "/assets/wiki.worker-def.js"]): object {
  const names = [["/", "index.html", "text/html; charset=utf-8", "no-store"], ["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json", "no-store"], ...routes.map((path) => [path, path.slice(1), "application/javascript", "immutable"])] as const;
  return { schema: "lararium-pronaos-artifact/v1", routes: names.map(([path, file, contentType, cache]) => ({ path, file, contentType, cache, sha256: createHash("sha256").update(requireRead(f.web, file)).digest("hex") })) };
}

function requireRead(root: string, file: string): Buffer {
  return readFileSync(join(root, file));
}

describe("buildPronaosProjection — explicit prepared roots", () => {
  test("reads only index, named assets/worker, seed, and seed-named CAS", () => {
    const f = fixture();
    const projection = buildPronaosProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.genesis,
      artifactRecord: artifact(f),
    });
    expect([...projection.assets.keys()]).toEqual(["/assets/index-abc.js", "/assets/wiki.worker-def.js"]);
    expect([...projection.cas.keys()]).toEqual([f.cid]);
    expect(projection.manifest).toBeDefined();
    expect(projection.routeInventory.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "web-artifact", path: "/", cache: "no-store" }),
      expect.objectContaining({ kind: "web-artifact", path: "/manifest.webmanifest", cache: "no-store" }),
      expect.objectContaining({ kind: "genesis-seed", path: "/genesis/seed.json", cache: "no-store" }),
      expect.objectContaining({ kind: "genesis-member", path: `/genesis/cas/${f.cid}`, cache: "immutable" }),
    ]));
  });

  test("rejects missing files, mismatched CAS bytes, traversal, and private routes", () => {
    const f = fixture();
    const base = { webArtifactRoot: f.web, genesisBundleRoot: f.genesis };
    expect(() => buildPronaosProjection({ ...base, artifactRecord: artifact(f, ["/assets/index-abc.js"]) })).toThrow(/worker/);
    expect(() => buildPronaosProjection({ ...base, artifactRecord: { ...artifact(f), routes: [...artifact(f).routes.filter((route) => route.path !== "/assets/wiki.worker-def.js"), { path: "/assets/missing.js", file: "assets/missing.js", contentType: "application/javascript", cache: "immutable", sha256: "a".repeat(64) }, { path: "/assets/wiki.worker-def.js", file: "assets/wiki.worker-def.js", contentType: "application/javascript", cache: "immutable", sha256: createHash("sha256").update("worker").digest("hex") }] } })).toThrow(/absent|ENOENT/);
    expect(() => buildPronaosProjection({ ...base, artifactRecord: artifact(f, ["/private/document.json", "/assets/wiki.worker-def.js"]) })).toThrow(/outside|ENOENT/);
    expect(() => buildPronaosProjection({ ...base, artifactRecord: artifact(f, ["/assets/../private.js", "/assets/wiki.worker-def.js"]) })).toThrow(/canonical|outside|ENOENT/);
    const outside = mkdtempSync("/tmp/lararium-pronaos-outside-"); roots.push(outside);
    writeFileSync(join(outside, "escape.js"), "outside");
    symlinkSync(join(outside, "escape.js"), join(f.web, "assets/escape.js"));
    expect(() => buildPronaosProjection({ ...base, artifactRecord: artifact(f, ["/assets/index-abc.js", "/assets/escape.js", "/assets/wiki.worker-def.js"]) })).toThrow(/escapes|digest/);
    writeFileSync(join(f.genesis, "cas", f.cid), "wrong-bytes");
    expect(() => buildPronaosProjection({ ...base, artifactRecord: artifact(f) })).toThrow(/CID/);
  });

  test("requires absolute separate roots and the index's referenced asset", () => {
    const f = fixture();
    expect(() => buildPronaosProjection({
      webArtifactRoot: "relative-web", genesisBundleRoot: f.genesis,
      artifactRecord: artifact(f),
    })).toThrow(/absolute/);
    expect(() => buildPronaosProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.web,
      artifactRecord: artifact(f),
    })).toThrow(/separate/);
    expect(() => buildPronaosProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.genesis,
      artifactRecord: artifact(f, ["/assets/wiki.worker-def.js"]),
    })).toThrow(/unlisted asset/);
  });

  test("refuses a linked manifest that is absent, while permitting an unlinked optional manifest", () => {
    const f = fixture();
    const record = artifact(f);
    rmSync(join(f.web, "manifest.webmanifest"));
    expect(() => buildPronaosProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.genesis,
      artifactRecord: record,
    })).toThrow(/absent.*manifest|manifest.*absent/);

    writeFileSync(join(f.web, "index.html"), '<script type="module" src="/assets/index-abc.js"></script>');
    const projection = buildPronaosProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.genesis,
      artifactRecord: { ...record, routes: record.routes.filter((route) => route.path !== "/manifest.webmanifest").map((route) => route.path === "/" ? { ...route, sha256: createHash("sha256").update(readFileSync(join(f.web, "index.html"))).digest("hex") } : route) },
    });
    expect(projection.manifest).toBeUndefined();
    expect(projection.routeInventory.routes.some((route) => route.path === "/manifest.webmanifest")).toBe(false);
  });
});
