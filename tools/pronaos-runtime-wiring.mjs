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
  if (!dockerfile.includes("COPY packages/lares-cli/package.json")) throw new Error("founder image does not install the Lares CLI workspace");
  if (!dockerfile.includes("RUN pnpm --filter @lares/cli build")) throw new Error("founder image does not build the Lares CLI");
  const founderStart = compose.indexOf("\n  lararium-qa-founder:");
  const qaStart = compose.indexOf("\n  lararium-qa:");
  if (founderStart < 0 || qaStart < 0 || founderStart > qaStart) throw new Error("QA has no profile-scoped founder service before the Node peer");
  const founderBlock = compose.slice(founderStart, qaStart);
  if (!founderBlock.includes("social-bootstrap.json")) throw new Error("founder service has no durable bootstrap receipt check");
  if (!founderBlock.includes("pronaos-founder-receipt.json")) throw new Error("founder service has no explicit founder receipt");
  const copy = `COPY --from=build /app/.pronaos-build/pronaos-artifact.json ./pronaos-build/pronaos-artifact.json`;
  if (!dockerfile.includes(copy)) throw new Error("serve image does not carry the Pronaos artifact receipt");
  const profiles = ["qa", "prod"];
  for (const profile of profiles) {
    const start = compose.indexOf(`\n  lararium-${profile}:`);
    const nextMarker = compose.indexOf("\n  lararium-", start + 1);
    const next = nextMarker < 0 ? compose.length : nextMarker;
    if (start < 0) throw new Error(`Compose has no bounded lararium-${profile} service block`);
    const service = compose.slice(start, next);
    if (profile === "qa" && !service.includes("condition: service_completed_successfully")) throw new Error("QA Node peer does not wait for founder completion");
    const environmentStart = service.indexOf("\n    environment:");
    const environmentEnd = service.indexOf("\n    ports:", environmentStart);
    if (environmentStart < 0 || environmentEnd < 0) throw new Error(`${profile.toUpperCase()} service has no bounded environment block`);
    const environment = service.slice(environmentStart, environmentEnd);
    if (profile === "prod" && environment.includes("LAR_DEV_REPO_ROOT")) throw new Error("PROD environment carries the QA-only dev corpus preset");
    if (!environment.includes("XDG_DATA_HOME: /app/.lararium-data") && !environment.includes("<<: *vessel-data-env")) throw new Error(`${profile.toUpperCase()} environment does not name the durable vessel data home`);
    if (!environment.includes("\n      LAR_PRONAOS_WEB_ROOT: " + WEB_ROOT)) throw new Error(`${profile.toUpperCase()} environment does not name the Web artifact root`);
    if (!environment.includes("\n      LAR_PRONAOS_ARTIFACT_RECORD: " + RECORD_PATH)) throw new Error(`${profile.toUpperCase()} environment does not name the Pronaos artifact receipt`);
    if (!environment.includes('\n      LAR_SAME_ORIGIN: "true"')) throw new Error(`${profile.toUpperCase()} environment does not declare the direct Node same-origin composition`);
  }
  return { webRoot: WEB_ROOT, artifactRecord: RECORD_PATH, profiles };
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
