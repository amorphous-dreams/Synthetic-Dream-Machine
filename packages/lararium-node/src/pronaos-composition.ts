/**
 * Node's explicit Pronaos composition seam.
 *
 * Configuration names a prepared Web root and a finite JSON route list. The
 * helper never discovers a build directory; the projection builder receives
 * only those named paths and the already-resolved genesis directory.
 */

import type { Server } from "node:http";
import {
  type PronaosMount,
  mountPronaosReadFace,
} from "./pronaos-adapter.js";
import { buildPronaosProjection, type PronaosProjectionInputs } from "./pronaos-projection.js";

const WEB_ROOT = "LAR_PRONAOS_WEB_ROOT";
const ASSET_ROUTES = "LAR_PRONAOS_ASSET_ROUTES_JSON";

export interface PronaosCompositionConfig {
  readonly webArtifactRoot: string;
  readonly webAssetRoutes: readonly string[];
}

export interface PronaosComposition {
  readonly projection: ReturnType<typeof buildPronaosProjection>;
  readonly mount: PronaosMount;
  dispose(): void;
}

/** Parse only the two explicit environment inputs; no filesystem work occurs here. */
export function parsePronaosCompositionConfig(
  env: Readonly<Record<string, unknown>>,
): PronaosCompositionConfig | null {
  const webRoot = env[WEB_ROOT];
  const routesJson = env[ASSET_ROUTES];
  if (webRoot === undefined && routesJson === undefined) return null;
  if (webRoot === undefined || routesJson === undefined) {
    throw new Error(`[pronaos-composition] ${WEB_ROOT} and ${ASSET_ROUTES} must be supplied together`);
  }
  if (typeof webRoot !== "string" || webRoot.length === 0 || webRoot.trim() !== webRoot) {
    throw new Error(`[pronaos-composition] ${WEB_ROOT} must be a non-empty exact path`);
  }
  if (typeof routesJson !== "string" || routesJson.length === 0) {
    throw new Error(`[pronaos-composition] ${ASSET_ROUTES} must contain a JSON list`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(routesJson); }
  catch { throw new Error(`[pronaos-composition] ${ASSET_ROUTES} is not valid JSON`); }
  if (!Array.isArray(parsed) || parsed.some((route) => typeof route !== "string" || route.length === 0 || route.trim() !== route)) {
    throw new Error(`[pronaos-composition] ${ASSET_ROUTES} must be a list of exact strings`);
  }
  const routes = parsed as string[];
  if (routes.length === 0) {
    throw new Error(`[pronaos-composition] ${ASSET_ROUTES} must name at least one asset route`);
  }
  if (new Set(routes).size !== routes.length) {
    throw new Error(`[pronaos-composition] ${ASSET_ROUTES} contains duplicate routes`);
  }
  return { webArtifactRoot: webRoot, webAssetRoutes: routes };
}

/**
 * Compose the prepared Pronaos onto an existing Node HTTP server.
 * A missing pair leaves the current Node faces untouched.
 */
export function composePronaosFromEnv(args: {
  readonly httpServer: Server;
  readonly genesisDir: string;
  readonly env?: Readonly<Record<string, unknown>>;
}): PronaosComposition | null {
  const config = parsePronaosCompositionConfig(args.env ?? process.env);
  if (!config) return null;
  const inputs: PronaosProjectionInputs = {
    webArtifactRoot: config.webArtifactRoot,
    genesisBundleRoot: args.genesisDir,
    webAssetRoutes: config.webAssetRoutes,
  };
  const projection = buildPronaosProjection(inputs);
  const mount = mountPronaosReadFace(args.httpServer, projection);
  return { projection, mount, dispose: () => mount.dispose() };
}
