/**
 * Node's explicit Pronaos composition seam.
 *
 * Configuration names a prepared Web root and one finite build receipt, and may
 * name one mirror list. The helper never discovers a build directory; the
 * projection builder receives only those named paths and the already-resolved
 * genesis directory.
 *
 * The composition reads no standing and no archive. A lararium at its waking
 * floor composes the same Pronaos, and answers the same arrival descriptor, as
 * a raised hearth (waking-floor#/the-arrival-page: liveness ⊥ readiness).
 */

import type { Server } from "node:http";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { readFileSync } from "node:fs";
import {
  validatePronaosArtifactRecord,
  type PronaosArtifactRecord,
} from "@lararium/mesh";
import {
  type ArrivalMirror,
  type PronaosMount,
  mountPronaosReadFace,
} from "./pronaos-adapter.js";
import { buildPronaosProjection, type PronaosProjectionInputs } from "./pronaos-projection.js";
import { assertWaystoneCustody, type OriginStanding } from "./lan-address.js";

const WEB_ROOT = "LAR_PRONAOS_WEB_ROOT";
const ARTIFACT_RECORD = "LAR_PRONAOS_ARTIFACT_RECORD";
const MIRRORS = "LAR_PRONAOS_MIRRORS";

export interface PronaosCompositionConfig {
  readonly webArtifactRoot: string;
  readonly artifactRecordPath: string;
  /** Optional path to a JSON array of `{ cid, origin }` mirrors the descriptor lists. */
  readonly mirrorsPath?: string;
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
  const mirrorsPath = env[MIRRORS];
  if (webRoot === undefined && recordPath === undefined) {
    if (mirrorsPath !== undefined) throw new Error(`[pronaos-composition] ${MIRRORS} names mirrors of a Pronaos that ${WEB_ROOT} and ${ARTIFACT_RECORD} do not compose`);
    return null;
  }
  if (webRoot === undefined || recordPath === undefined) {
    throw new Error(`[pronaos-composition] ${WEB_ROOT} and ${ARTIFACT_RECORD} must be supplied together`);
  }
  if (typeof webRoot !== "string" || webRoot.length === 0 || webRoot.trim() !== webRoot) {
    throw new Error(`[pronaos-composition] ${WEB_ROOT} must be a non-empty exact path`);
  }
  if (typeof recordPath !== "string" || recordPath.length === 0 || recordPath.trim() !== recordPath) {
    throw new Error(`[pronaos-composition] ${ARTIFACT_RECORD} must be a non-empty exact path`);
  }
  if (mirrorsPath !== undefined && (typeof mirrorsPath !== "string" || mirrorsPath.length === 0 || mirrorsPath.trim() !== mirrorsPath)) {
    throw new Error(`[pronaos-composition] ${MIRRORS} must be a non-empty exact path`);
  }
  return {
    webArtifactRoot: webRoot, artifactRecordPath: recordPath,
    ...(mirrorsPath !== undefined ? { mirrorsPath: mirrorsPath as string } : {}),
  };
}

function readMirrors(pathname: string): readonly ArrivalMirror[] {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(pathname, "utf8")); }
  catch (error) { throw new Error(`[pronaos-composition] mirror list cannot be read: ${error instanceof Error ? error.message : String(error)}`); }
  if (!Array.isArray(parsed) || parsed.some((entry) =>
    !entry || typeof entry !== "object" || typeof (entry as ArrivalMirror).cid !== "string" || typeof (entry as ArrivalMirror).origin !== "string")) {
    throw new Error("[pronaos-composition] mirror list must be a JSON array of { cid, origin } strings");
  }
  return (parsed as ArrivalMirror[]).map(({ cid, origin }) => ({ cid, origin }));
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
 * A missing pair leaves the current Node faces untouched. Only a lararium mounts it: a herm handed any
 * `LAR_PRONAOS_*` input refuses with the waystone message, and a herm without one composes nothing.
 */
export function composePronaosFromEnv(args: {
  readonly httpServer: Server;
  readonly genesisDir: string;
  readonly standing: OriginStanding;
  readonly dispatcher?: HttpFaceDispatcher;
  readonly env?: Readonly<Record<string, unknown>>;
  /** Every origin the house answers on; the descriptor refuses a mirror standing on any of them. */
  readonly houseOrigins?: readonly string[];
}): PronaosComposition | null {
  const env = args.env ?? process.env;
  if (args.standing === "herm") {
    assertWaystoneCustody("herm", {}, Object.fromEntries(
      Object.entries(env).map(([key, value]) => [key, value === undefined ? undefined : String(value)]),
    ));
    return null;
  }
  const config = parsePronaosCompositionConfig(env);
  if (!config) return null;
  const artifactRecord = readArtifactRecord(config.artifactRecordPath);
  const inputs: PronaosProjectionInputs = {
    webArtifactRoot: config.webArtifactRoot,
    genesisBundleRoot: args.genesisDir,
    artifactRecord,
  };
  const projection = buildPronaosProjection(inputs);
  const mount = mountPronaosReadFace(args.httpServer, projection, args.dispatcher, {
    houseOrigins: args.houseOrigins ?? [],
    ...(config.mirrorsPath ? { mirrors: readMirrors(config.mirrorsPath) } : {}),
  });
  return { projection, mount, dispose: () => mount.dispose() };
}
