#!/usr/bin/env node
/**
 * Static/runtime receipt for the alpha container seam. It proves that a profile
 * names a prepared Web root and its finite receipt, then checks those inputs
 * without requiring a Docker daemon or a live carrier.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { validatePronaosArtifactRecord } from "../packages/lararium-mesh/dist/pronaos.js";

const WEB_ROOT = "/app/packages/lararium-web/dist";
const RECORD_PATH = "/app/pronaos-build/pronaos-artifact.json";

export function assertPronaosRuntimeConfiguration({ dockerfile, compose }) {
  const copy = `COPY --from=build /app/.pronaos-build/pronaos-artifact.json ./pronaos-build/pronaos-artifact.json`;
  if (!dockerfile.includes(copy)) throw new Error("serve image does not carry the Pronaos artifact receipt");
  const qaStart = compose.indexOf("\n  lararium-qa:");
  const qaEnd = compose.indexOf("\n  lararium-prod:", qaStart);
  if (qaStart < 0 || qaEnd < 0) throw new Error("Compose has no isolated lararium-qa service block");
  const qa = compose.slice(qaStart, qaEnd);
  const environmentStart = qa.indexOf("\n    environment:");
  const environmentEnd = qa.indexOf("\n    ports:", environmentStart);
  if (environmentStart < 0 || environmentEnd < 0) throw new Error("QA service has no bounded environment block");
  const environment = qa.slice(environmentStart, environmentEnd);
  if (!environment.includes("\n      LAR_PRONAOS_WEB_ROOT: " + WEB_ROOT)) throw new Error("QA environment does not name the Web artifact root");
  if (!environment.includes("\n      LAR_PRONAOS_ARTIFACT_RECORD: " + RECORD_PATH)) throw new Error("QA environment does not name the Pronaos artifact receipt");
  return { webRoot: WEB_ROOT, artifactRecord: RECORD_PATH };
}

export function assertPronaosRuntimeInputs({ webRoot, artifactRecord }) {
  if (!existsSync(webRoot) || !statSync(webRoot).isDirectory()) {
    throw new Error(`Pronaos Web root is absent: ${webRoot}`);
  }
  if (!existsSync(artifactRecord) || !statSync(artifactRecord).isFile()) {
    throw new Error(`Pronaos artifact receipt is absent: ${artifactRecord}`);
  }
  let parsed;
  try { parsed = JSON.parse(readFileSync(artifactRecord, "utf8")); }
  catch (error) { throw new Error(`Pronaos artifact receipt is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  try { validatePronaosArtifactRecord(parsed); }
  catch (error) { throw new Error("Pronaos artifact receipt fails the mesh contract: " + (error instanceof Error ? error.message : String(error))); }
  for (const entry of parsed.routes) {
    const file = resolve(webRoot, entry.file);
    if (!file.startsWith(resolve(webRoot) + "/") || !existsSync(file) || !statSync(file).isFile()) {
      throw new Error("Pronaos receipt names a file absent from its Web root: " + entry.file);
    }
    const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (sha256 !== entry.sha256) throw new Error("Pronaos receipt digest disagrees with its Web bytes: " + entry.file);
  }
  return { webRoot, artifactRecord, routes: parsed.routes.length };
}

if (process.argv[1]?.endsWith("pronaos-runtime-wiring.mjs")) {
  try {
    const result = assertPronaosRuntimeConfiguration({
      dockerfile: readFileSync("Dockerfile", "utf8"),
      compose: readFileSync("docker-compose.yml", "utf8"),
    });
    console.log(`[pronaos-runtime] configuration green: ${result.webRoot} + ${result.artifactRecord}`);
  } catch (error) {
    console.error(`[pronaos-runtime] RED\n${error.message}`);
    process.exitCode = 1;
  }
}
