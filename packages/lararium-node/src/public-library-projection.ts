/**
 * Build the public-library projection from two explicitly named artifact
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
  type GenesisSeed,
} from "@lararium/mesh";
import type { PublicLibraryFile, PublicLibraryProjection } from "./public-library-adapter.js";

export interface PublicLibraryProjectionInputs {
  /** Absolute root of the prepared @lararium/web artifact. */
  readonly webArtifactRoot: string;
  /** Absolute root of the prepared seed/CAS bundle. */
  readonly genesisBundleRoot: string;
  /** Exact Vite `/assets/...` routes selected by the prepared artifact record. */
  readonly assetRoutes: readonly string[];
}

const ASSET_ROUTE = /^\/assets\/(?!\.{1,2}$)([A-Za-z0-9._-]+)$/;
const WORKER_ASSET = /(?:^|\/)(?:daemon|wiki|shared-holder)\.worker[-.][A-Za-z0-9._-]+$/;
const CID = /^[0-9a-f]{64}$/;

function fail(message: string): never {
  throw new Error(`[public-library-projection] ${message}`);
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

function file(bytes: Uint8Array, contentType: string): PublicLibraryFile {
  return { bytes, contentType };
}

function assetType(route: string): string {
  if (route.endsWith(".js")) return "application/javascript";
  if (route.endsWith(".css")) return "text/css";
  if (route.endsWith(".wasm")) return "application/wasm";
  return "application/octet-stream";
}

function routeFile(root: string, route: string): Uint8Array {
  if (!ASSET_ROUTE.test(route)) fail(`noncanonical asset route: ${route}`);
  return exactFile(root, route.slice(1), `asset ${route}`);
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
 * Read the exact prepared public library. This function intentionally returns
 * bytes and route names only; it does not install an HTTP listener.
 */
export function buildPublicLibraryProjection(
  inputs: PublicLibraryProjectionInputs,
): PublicLibraryProjection {
  const webRoot = rootOf("webArtifactRoot", inputs.webArtifactRoot);
  const genesisRoot = rootOf("genesisBundleRoot", inputs.genesisBundleRoot);
  if (webRoot === genesisRoot) fail("webArtifactRoot and genesisBundleRoot must remain explicit separate inputs");
  if (inputs.assetRoutes.length === 0) fail("assetRoutes must name the prepared web assets");
  const routes = [...new Set(inputs.assetRoutes)];
  if (routes.length !== inputs.assetRoutes.length) fail("assetRoutes contains a duplicate route");
  for (const route of routes) {
    if (!ASSET_ROUTE.test(route)) fail(`noncanonical asset route: ${route}`);
  }
  if (!routes.some((route) => WORKER_ASSET.test(route))) fail("assetRoutes must name a prepared worker asset");

  const indexBytes = exactFile(webRoot, "index.html", "web index");
  const indexText = new TextDecoder().decode(indexBytes);
  for (const referenced of indexText.matchAll(/\/assets\/([A-Za-z0-9._-]+)/g)) {
    const route = `/assets/${referenced[1]}`;
    if (!routes.includes(route)) fail(`index.html references an unlisted asset: ${route}`);
  }

  const assets = new Map<string, PublicLibraryFile>();
  for (const route of routes) assets.set(route, file(routeFile(webRoot, route), assetType(route)));

  const seedBytes = exactFile(genesisRoot, "seed.json", "seed.json");
  const cids = seedCids(seedBytes);
  const cas = new Map<string, PublicLibraryFile>();
  for (const cid of cids) {
    const bytes = exactFile(genesisRoot, `cas/${cid}`, `CAS ${cid}`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== cid) fail(`CAS bytes do not match seed-derived inventory CID ${cid}`);
    cas.set(cid, file(bytes, "application/octet-stream"));
  }

  return {
    index: file(indexBytes, "text/html; charset=utf-8"),
    assets,
    genesisSeed: file(seedBytes, "application/json"),
    cas,
  };
}
