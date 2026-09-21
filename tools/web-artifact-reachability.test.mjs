import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertWebArtifactReachability } from "./web-artifact-reachability.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

describe("built web artifact reachability", () => {
  test("checks index, worker, genesis, and manifest-named CAS bytes", () => {
    root = mkdtempSync(join(tmpdir(), "lararium-web-artifact-"));
    const dist = join(root, "dist"); const genesis = join(root, "genesis");
    mkdirSync(join(dist, "assets"), { recursive: true });
    mkdirSync(join(dist, "genesis", "cas"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
    writeFileSync(join(dist, "index.html"), "<html>web</html>");
    writeFileSync(join(dist, "assets", "wiki.worker-abc.js"), "worker");
    writeFileSync(join(genesis, "island.genesis.json"), "{\"seed\":1}");
    writeFileSync(join(genesis, "island.manifest.json"), JSON.stringify({ blobs: [{ cid: "cid-a" }] }));
    writeFileSync(join(genesis, "cas", "cid-a"), "cas-bytes");
    for (const file of ["island.genesis.json", "island.manifest.json"]) writeFileSync(join(dist, "genesis", file), readFileSync(join(genesis, file)));
    writeFileSync(join(dist, "genesis", "cas", "cid-a"), "cas-bytes");
    expect(assertWebArtifactReachability({ distRoot: dist, genesisRoot: genesis }).casCid).toBe("cid-a");
    writeFileSync(join(dist, "genesis", "cas", "cid-a"), "<html>web</html>");
    expect(() => assertWebArtifactReachability({ distRoot: dist, genesisRoot: genesis })).toThrow(/CAS blob/);
  });
});
