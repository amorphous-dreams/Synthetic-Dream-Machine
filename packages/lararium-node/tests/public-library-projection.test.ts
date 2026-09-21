import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildPublicLibraryProjection } from "../src/public-library-projection.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(): { web: string; genesis: string; cid: string } {
  const root = mkdtempSync("/tmp/lararium-public-library-"); roots.push(root);
  const web = join(root, "web"); const genesis = join(root, "genesis");
  mkdirSync(join(web, "assets"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
  const cas = Buffer.from("public-cas"); const cid = createHash("sha256").update(cas).digest("hex");
  const regionCids = { engine: "engine-region", grammar: "grammar-region", plugins: "plugins-region" };
  writeFileSync(join(web, "index.html"), '<script type="module" src="/assets/index-abc.js"></script>');
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

describe("buildPublicLibraryProjection — explicit prepared roots", () => {
  test("reads only index, named assets/worker, seed, and seed-named CAS", () => {
    const f = fixture();
    const projection = buildPublicLibraryProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.genesis,
      assetRoutes: ["/assets/index-abc.js", "/assets/wiki.worker-def.js"],
    });
    expect([...projection.assets.keys()]).toEqual(["/assets/index-abc.js", "/assets/wiki.worker-def.js"]);
    expect([...projection.cas.keys()]).toEqual([f.cid]);
  });

  test("rejects missing files, mismatched CAS bytes, stale names, traversal, and private routes", () => {
    const f = fixture();
    const base = { webArtifactRoot: f.web, genesisBundleRoot: f.genesis };
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/index-abc.js"] })).toThrow(/worker/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/index-abc.js", "/assets/missing.js", "/assets/wiki.worker-def.js"] })).toThrow(/absent/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/private/document.json", "/assets/wiki.worker-def.js"] })).toThrow(/noncanonical/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/../private.js", "/assets/wiki.worker-def.js"] })).toThrow(/noncanonical/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/..", "/assets/wiki.worker-def.js"] })).toThrow(/noncanonical/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/foo%2Fbar.js", "/assets/wiki.worker-def.js"] })).toThrow(/noncanonical/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/foo/bar.js", "/assets/wiki.worker-def.js"] })).toThrow(/noncanonical/);
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/island.bin", "/assets/wiki.worker-def.js"] })).toThrow(/stale/);
    const outside = mkdtempSync("/tmp/lararium-public-library-outside-"); roots.push(outside);
    writeFileSync(join(outside, "escape.js"), "outside");
    symlinkSync(join(outside, "escape.js"), join(f.web, "assets/escape.js"));
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/index-abc.js", "/assets/escape.js", "/assets/wiki.worker-def.js"] })).toThrow(/escapes/);
    writeFileSync(join(f.genesis, "cas", f.cid), "wrong-bytes");
    expect(() => buildPublicLibraryProjection({ ...base, assetRoutes: ["/assets/index-abc.js", "/assets/wiki.worker-def.js"] })).toThrow(/CID/);
  });

  test("requires absolute separate roots and the index's referenced asset", () => {
    const f = fixture();
    expect(() => buildPublicLibraryProjection({
      webArtifactRoot: "relative-web", genesisBundleRoot: f.genesis,
      assetRoutes: ["/assets/index-abc.js", "/assets/wiki.worker-def.js"],
    })).toThrow(/absolute/);
    expect(() => buildPublicLibraryProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.web,
      assetRoutes: ["/assets/index-abc.js", "/assets/wiki.worker-def.js"],
    })).toThrow(/separate/);
    expect(() => buildPublicLibraryProjection({
      webArtifactRoot: f.web, genesisBundleRoot: f.genesis,
      assetRoutes: ["/assets/wiki.worker-def.js"],
    })).toThrow(/unlisted asset/);
  });
});
