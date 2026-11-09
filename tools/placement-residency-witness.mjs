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

// THE SECRET HOME (placement over patterns, item A): every secret-family write lands through the secret handle, the store's
// one holder binds the sealed rest before any write, the vessel shares the home with no peer, and no recipe or mirror names it.
const ceremony = read("packages/lararium-keyhive/src/ceremony-core.ts");
for (const writer of ["writeDyad(doc", "writeGroupSecretSeal(doc"]) {
  let at = ceremony.indexOf(writer);
  while (at >= 0) {
    const opener = ceremony.lastIndexOf(".change(", at);
    const holder = ceremony.slice(Math.max(0, opener - 24), opener);
    if (!/secretHandle$/.test(holder)) throw new Error(`ceremony-core: ${writer.slice(0, -4)} lands outside the secret handle (${holder.trim()}.change)`);
    at = ceremony.indexOf(writer, at + 1);
  }
}
if (/flushCapEvents\([^,]+,\s*daemonHandle/.test(ceremony)) throw new Error("ceremony-core: cap events flush into the daemon document");
for (const [path, needle] of [
  ["packages/lararium-node/src/owned-store.ts", "bindSecretHomeRest("],
  ["packages/lararium-node/src/open-node-vessel.ts", "bindSecretHomeRest("],
  ["packages/lararium-node/src/open-node-vessel.ts", "secretHomes.has(documentId)) return !wsSocket && houseIslands.has(peerId)"],
]) if (!read(path).includes(needle)) throw new Error(`${path} lost its secret-home seat: ${needle}`);
for (const path of ["packages/lararium-mesh/src/wiki-recipe.ts", "packages/lararium-node/src/bag-paths.ts", "packages/lararium-tw5/src/daemon-vm-core.ts", "packages/lararium-node/src/disk-projector.ts"]) {
  if (/SECRET_HOME_ID|bags\/secret/.test(read(path))) throw new Error(`${path} names the secret home: no recipe or mirror may`);
}
console.log("placement-residency-witness: the secret home takes every secret write, rests sealed, and no recipe, mirror or peer reaches it");
