import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertWebArtifactReachability } from "./web-artifact-reachability.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

describe("built web artifact reachability", () => {
  test("checks index, worker, genesis seed, and seed-named CAS bytes", () => {
    root = mkdtempSync(join(tmpdir(), "lararium-web-artifact-"));
    const dist = join(root, "dist"); const genesis = join(root, "genesis");
    mkdirSync(join(dist, "assets"), { recursive: true });
    mkdirSync(join(dist, "genesis", "cas"), { recursive: true }); mkdirSync(join(genesis, "cas"), { recursive: true });
    writeFileSync(join(dist, "index.html"), "<html>web</html>");
    writeFileSync(join(dist, "assets", "wiki.worker-abc.js"), "worker");
    writeFileSync(join(genesis, "seed.json"), JSON.stringify({ blobs: { core: { sha256: "cid-a" } } }));
    writeFileSync(join(genesis, "cas", "cid-a"), "cas-bytes");
    writeFileSync(join(dist, "genesis", "seed.json"), readFileSync(join(genesis, "seed.json")));
    writeFileSync(join(dist, "genesis", "cas", "cid-a"), "cas-bytes");
    expect(assertWebArtifactReachability({ distRoot: dist, genesisRoot: genesis }).casCids).toEqual(["cid-a"]);
    writeFileSync(join(dist, "genesis", "cas", "cid-a"), "<html>web</html>");
    expect(() => assertWebArtifactReachability({ distRoot: dist, genesisRoot: genesis })).toThrow(/CAS blob/);
  });
});
