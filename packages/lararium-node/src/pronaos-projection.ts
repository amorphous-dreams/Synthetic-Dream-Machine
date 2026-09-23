/**
 * Build the Pronaos projection from two explicitly named artifact
 * roots. This is a preparation step only; mounting remains the caller's
 * separate composition act.
 *
 * The web root contributes only index.html and the explicitly supplied Vite
 * asset routes. The genesis root contributes seed.json and the seed-derived
 * CAS files. No directory scan can widen this projection.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import {
  genesisCasManifestFromSeed,
  validatePronaosArtifactRecord,
  type PronaosArtifactRecord,
  type GenesisSeed,
} from "@lararium/mesh";
import {
  pronaosRouteInventoryForProjection,
  type PronaosFile,
  type PronaosProjection,
} from "./pronaos-adapter.js";

const WORKER_ASSET = /(?:^|\/)(?:daemon|wiki|shared-holder)\.worker[-.][A-Za-z0-9._-]+$/;
const CID = /^[0-9a-f]{64}$/;

function fail(message: string): never {
  throw new Error(`[pronaos-projection] ${message}`);
}

function rootOf(label: string, value: string): string {
  if (!isAbsolute(value)) fail(`${label} must be an absolute path`);
  if (!existsSync(value) || !statSync(value).isDirectory()) fail(`${label} is not a directory: ${value}`);
  return realpathSync(value);
}

function exactFile(root: string, relativePath: string, label: string): Uint8Array {
  const target = join(root, relativePath);
  const targetReal = existsSync(target) ? realpathSync(target) : "";
  const within = targetReal === root || targetReal.startsWith(`${root}${sep}`);
  if (!targetReal || !within || !statSync(targetReal).isFile()) fail(`${label} is absent or escapes its declared root`);
  return new Uint8Array(readFileSync(targetReal));
}

function file(bytes: Uint8Array, contentType: string): PronaosFile {
  return { bytes, contentType };
}

function jsonObject(bytes: Uint8Array, label: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { fail(`${label} is not valid JSON`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(`${label} must be a JSON object`);
  return parsed as Record<string, unknown>;
}

function seedCids(seedBytes: Uint8Array): readonly string[] {
  const seed = jsonObject(seedBytes, "seed.json");
  let manifest;
  try {
    manifest = genesisCasManifestFromSeed(seed as unknown as GenesisSeed);
  } catch (error) {
    fail(`genesis seed derivation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const cids = manifest.blobs.map((entry: { readonly cid: string }) => {
    const cid = entry.cid;
    if (!CID.test(cid)) fail(`seed names a noncanonical CID: ${String(cid)}`);
    return cid;
  });
  if (new Set(cids).size !== cids.length) fail("seed-derived inventory names a duplicate CID");
  return cids;
}

/**
 * Read the exact prepared Pronaos. This function intentionally returns
 * bytes and route names only; it does not install an HTTP listener.
 */
export interface PronaosProjectionInputs {
  /** Absolute root of the prepared @lararium/web artifact. */
  readonly webArtifactRoot: string;
  /** Absolute root of the prepared seed/CAS bundle. */
  readonly genesisBundleRoot: string;
  /** Exact Vite artifact receipt produced by the Web build. */
  readonly artifactRecord: PronaosArtifactRecord;
}

export function buildPronaosProjection(
  inputs: PronaosProjectionInputs,
): PronaosProjection {
  const webRoot = rootOf("webArtifactRoot", inputs.webArtifactRoot);
  const genesisRoot = rootOf("genesisBundleRoot", inputs.genesisBundleRoot);
  if (webRoot === genesisRoot) fail("webArtifactRoot and genesisBundleRoot must remain explicit separate inputs");
  validatePronaosArtifactRecord(inputs.artifactRecord);
  const entries = new Map(inputs.artifactRecord.routes.map((entry) => [entry.path, entry]));
  const root = entries.get("/");
  if (!root) fail("artifact record must name /");
  const indexBytes = exactFile(webRoot, root.file, "web index");
  if (createHash("sha256").update(indexBytes).digest("hex") !== root.sha256) fail("web index does not match artifact receipt");
  const indexText = new TextDecoder().decode(indexBytes);
  const manifestEntry = entries.get("/manifest.webmanifest");
  const manifestBytes = manifestEntry ? exactFile(webRoot, manifestEntry.file, "manifest.webmanifest") : undefined;
  if (manifestEntry && createHash("sha256").update(manifestBytes!).digest("hex") !== manifestEntry.sha256) fail("manifest does not match artifact receipt");
  if (/href=["']\/manifest\.webmanifest["']/.test(indexText) && !manifestBytes) {
    fail("index.html references an absent manifest.webmanifest");
  }
  for (const referenced of indexText.matchAll(/\/assets\/([A-Za-z0-9._-]+)/g)) {
    const route = `/assets/${referenced[1]}`;
    if (!entries.has(route)) fail(`index.html references an unlisted asset: ${route}`);
  }

  const assets = new Map<string, PronaosFile>();
  for (const entry of inputs.artifactRecord.routes) {
    if (!entry.path.startsWith("/assets/")) continue;
    const bytes = exactFile(webRoot, entry.file, `asset ${entry.path}`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== entry.sha256) fail(`asset ${entry.path} does not match artifact receipt`);
    assets.set(entry.path, file(bytes, entry.contentType));
  }
  if (![...assets.keys()].some((route) => WORKER_ASSET.test(route))) fail("artifact record must name a prepared worker asset");

  const seedBytes = exactFile(genesisRoot, "seed.json", "seed.json");
  const cids = seedCids(seedBytes);
  const cas = new Map<string, PronaosFile>();
  for (const cid of cids) {
    const bytes = exactFile(genesisRoot, `cas/${cid}`, `CAS ${cid}`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== cid) fail(`CAS bytes do not match seed-derived inventory CID ${cid}`);
    cas.set(cid, file(bytes, "application/octet-stream"));
  }

  const prepared = {
    index: file(indexBytes, "text/html; charset=utf-8"),
    assets,
    ...(manifestBytes ? { manifest: file(manifestBytes, "application/manifest+json") } : {}),
    genesisSeed: file(seedBytes, "application/json"),
    cas,
  };
  return { ...prepared, routeInventory: pronaosRouteInventoryForProjection(prepared) };
}
