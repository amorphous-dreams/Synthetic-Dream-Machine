/**
 * Node's explicit Pronaos composition seam.
 *
 * Configuration names a prepared Web root and one finite build receipt. The
 * helper never discovers a build directory; the projection builder receives
 * only those named paths and the already-resolved genesis directory.
 */

import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import {
  validatePronaosArtifactRecord,
  type PronaosArtifactRecord,
} from "@lararium/mesh";
import {
  type PronaosMount,
  mountPronaosReadFace,
} from "./pronaos-adapter.js";
import { buildPronaosProjection, type PronaosProjectionInputs } from "./pronaos-projection.js";

const WEB_ROOT = "LAR_PRONAOS_WEB_ROOT";
const ARTIFACT_RECORD = "LAR_PRONAOS_ARTIFACT_RECORD";

export interface PronaosCompositionConfig {
  readonly webArtifactRoot: string;
  readonly artifactRecordPath: string;
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
  const recordPath = env[ARTIFACT_RECORD];
  if (webRoot === undefined && recordPath === undefined) return null;
  if (webRoot === undefined || recordPath === undefined) {
    throw new Error(`[pronaos-composition] ${WEB_ROOT} and ${ARTIFACT_RECORD} must be supplied together`);
  }
  if (typeof webRoot !== "string" || webRoot.length === 0 || webRoot.trim() !== webRoot) {
    throw new Error(`[pronaos-composition] ${WEB_ROOT} must be a non-empty exact path`);
  }
  if (typeof recordPath !== "string" || recordPath.length === 0 || recordPath.trim() !== recordPath) {
    throw new Error(`[pronaos-composition] ${ARTIFACT_RECORD} must be a non-empty exact path`);
  }
  return { webArtifactRoot: webRoot, artifactRecordPath: recordPath };
}

function readArtifactRecord(pathname: string): PronaosArtifactRecord {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(pathname, "utf8")); }
  catch (error) { throw new Error(`[pronaos-composition] artifact record cannot be read: ${error instanceof Error ? error.message : String(error)}`); }
  validatePronaosArtifactRecord(parsed as PronaosArtifactRecord);
  return parsed as PronaosArtifactRecord;
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
  const artifactRecord = readArtifactRecord(config.artifactRecordPath);
  const inputs: PronaosProjectionInputs = {
    webArtifactRoot: config.webArtifactRoot,
    genesisBundleRoot: args.genesisDir,
    artifactRecord,
  };
  const projection = buildPronaosProjection(inputs);
  const mount = mountPronaosReadFace(args.httpServer, projection);
  return { projection, mount, dispose: () => mount.dispose() };
}
