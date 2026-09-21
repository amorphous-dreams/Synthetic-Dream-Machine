#!/usr/bin/env node
/**
 * Receipt for the built web shore. Every request is checked against source
 * bytes, so SPA fallback cannot make a missing worker/genesis/CAS route green.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function assertBytes(label, actualPath, expectedPath) {
  const actual = readFileSync(actualPath);
  const expected = readFileSync(expectedPath);
  if (!actual.equals(expected)) throw new Error(`${label}: served bytes differ from ${expectedPath}; SPA fallback or stale copy`);
}

export function assertWebArtifactReachability({ distRoot, genesisRoot }) {
  const dist = resolve(distRoot);
  const genesis = resolve(genesisRoot);
  const indexPath = join(dist, "index.html");
  if (!statSync(indexPath).isFile()) throw new Error("missing built web index.html");
  const worker = filesUnder(join(dist, "assets")).find((path) => /(?:wiki|daemon)\.worker[-.]/.test(path));
  if (!worker) throw new Error("missing Vite worker asset");
  if (readFileSync(worker).equals(readFileSync(indexPath))) throw new Error("worker asset is the SPA index fallback");
  assertBytes("genesis seed", join(dist, "genesis/seed.json"), join(genesis, "seed.json"));
  const manifestPath = join(dist, "genesis/manifest.json");
  assertBytes("genesis manifest", manifestPath, join(genesis, "manifest.json"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const blob = manifest.blobs?.[0];
  if (!blob?.cid) throw new Error("genesis manifest has no CAS blob");
  assertBytes(`CAS blob ${blob.cid}`, join(dist, `genesis/cas/${blob.cid}`), join(genesis, `cas/${blob.cid}`));
  return { worker, casCid: blob.cid };
}

if (process.argv[1]?.endsWith("web-artifact-reachability.mjs")) {
  try {
    const result = assertWebArtifactReachability({
      distRoot: process.argv[2] ?? "packages/lararium-web/dist",
      genesisRoot: process.argv[3] ?? "genesis",
    });
    console.log(`[web-artifact] green: worker=${result.worker} cas=${result.casCid}`);
  } catch (error) {
    console.error(`[web-artifact] RED\n${error.message}`);
    process.exitCode = 1;
  }
}
