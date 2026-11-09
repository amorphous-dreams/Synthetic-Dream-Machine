#!/usr/bin/env node
/** Residency decisions may read a mirror grant or the record's kind, never title families. */
import { readFileSync } from "node:fs";
import { PROJECTION_FILTER_TEXT } from "../packages/lararium-mesh/dist/projection-filter.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const forbiddenFilter = /bags\/|daemon|nexus-handles|swarm|dreamnet|realm-bag|ledger\/|local\.vm/i;
for (const [name, text] of Object.entries(PROJECTION_FILTER_TEXT)) {
  if (forbiddenFilter.test(text)) throw new Error(`ProjectionFilter ${name} still names residency by title`);
}
const decisionFiles = [
  ["packages/lararium-node/src/disk-projector.ts", /isControlPlaneUri|isDaemonCanonWithheld|isVolatileVmUri|isBagManifestUri|isRealmBagAnnounceUri|isNexusHandlesUri|neverProjects|NeverProjectedPathRefusal|declaresNoProjection/],
  ["packages/lararium-node/src/bag-paths.ts", /isBagManifestUri|isRealmBagAnnounceUri|isNexusHandlesUri|isControlPlaneUri|isDaemonCanonWithheld|isVolatileVmUri/],
  ["packages/lararium-mesh/src/kahua-stage.ts", /isControlPlaneUri|isDaemonCanonWithheld|isBagManifestUri|isRealmBagAnnounceUri|isNexusHandlesUri/],
  ["packages/lararium-node/src/kahua-door.ts", /isControlPlaneUri|isDaemonCanonWithheld|isBagManifestUri|isRealmBagAnnounceUri|isNexusHandlesUri/],
  ["packages/lararium-tw5/src/action-handler.ts", /projectionWithheld|isControlPlaneUri|isDaemonCanonWithheld|isBagManifestUri|isRealmBagAnnounceUri|isNexusHandlesUri|neverProjects|NeverProjectedPathRefusal/],
  ["packages/lares-cli/src/ingest-core.ts", /projectionWithheld|isControlPlaneUri|isDaemonCanonWithheld|neverProjects|NeverProjectedPathRefusal/],
  ["packages/lares-cli/src/commands/carry.ts", /isDaemonCanonWithheld|isControlPlaneUri|neverProjects|daemonCanon|daemon\/canon/],
];
for (const [path, pattern] of decisionFiles) {
  const text = read(path);
  const match = pattern.exec(text);
  if (match) throw new Error(`${path} still decides residency from title logic: ${match[0]}`);
}
console.log("placement-residency-witness: projection and ingest decisions read placement, not title patterns");
