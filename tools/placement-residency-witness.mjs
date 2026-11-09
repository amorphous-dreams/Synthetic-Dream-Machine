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

// ── THE CONTROL HOME: no control-shaped record can reach a mirror by placement ─────────────────────────────────────
// Every control family titles under the control home and rests in the control document, which no recipe composes and no
// mirror names; the daemon wiki's mirrors (working top, face canon, kahua stage) name neither it nor the daemon document.
const mesh = await import("../packages/lararium-mesh/dist/index.js");
const { daemonDiskMirrors } = await import("../packages/lararium-node/dist/src/bag-paths.js");
const families = {
  summons: mesh.SUMMONS_URI_PREFIX, outcomes: mesh.OUTCOME_URI_PREFIX, effects: mesh.EFFECT_URI_PREFIX,
  receipts: mesh.RECEIPT_FACT_URI_PREFIX, "ward audits": mesh.WARD_AUDIT_URI_PREFIX, mailbox: mesh.MAILBOX_URI_PREFIX,
  "lease epochs": mesh.leaseEpochPrefix("witness"),
};
for (const [family, prefix] of Object.entries(families)) {
  if (typeof prefix !== "string" || !prefix.startsWith(`${mesh.CONTROL_HOME_ID}/`)) throw new Error(`control family ${family} titles outside the control home: ${prefix}`);
}
const PRIVATE_HOMES = new Set([mesh.CONTROL_HOME_ID, mesh.SECRET_HOME_ID, mesh.DAEMON_BAG_ID]);
const F = "123e4567-e89b-42d3-a456-426614174000";
const daemonRecipe = mesh.kahuaRecipe({ wikiSlug: "daemon", canonBag: mesh.daemonFaceCanonBag(F) });
for (const slot of mesh.expandRecipe(daemonRecipe)) {
  if (slot === mesh.CONTROL_HOME_ID || slot === mesh.SECRET_HOME_ID) throw new Error(`the daemon recipe composes a private home: ${slot}`);
}
for (const faceRelation of [F, null]) {
  for (const mirror of daemonDiskMirrors({ projectionRoot: "/witness", canonBags: "/witness-absent", faceRelation, canon: faceRelation !== null, temp: true })) {
    if (PRIVATE_HOMES.has(mirror.bagId)) throw new Error(`a daemon mirror names a private home by placement: ${mirror.bagId} -> ${mirror.mirrorRoot}`);
  }
}
// Each control writer names the control store, never a wiki layer or the daemon document.
const controlWriters = [
  ["packages/lararium-tw5/src/verb-vm.ts", /control\.put\(outcome/, /daemon\.put\(/],
  ["packages/lararium-tw5/src/worker-data-verbs.ts", /await control\.put\(/, /composite\.put\(\s*\{ tiddler: \{ title: auditTitle/],
  ["packages/lararium-tw5/src/verb-summons.ts", /opts\.control\.tombstoneInBag/, /opts\.daemon\./],
  ["packages/lararium-node/src/vessel-mailbox.ts", /\{ bag: CONTROL_HOME_ID \}/, /DAEMON_BAG_ID/],
  ["packages/lararium-node/src/uds-channel.ts", /storeForBag\(CONTROL_HOME_ID\)/, /wikiSlotUri\("daemon", "working"\)/],
  ["packages/lararium-node/src/swarm-wiki.ts", /export function controlSwarmWiki/, /daemonSwarmWiki/],
  ["packages/lararium-keyhive/src/lease-frontier.ts", /storeForBag\(CONTROL_HOME_ID\)/, /DAEMON_BAG_ID/],
];
for (const [path, must, mustNot] of controlWriters) {
  const text = read(path);
  if (!must.test(text)) throw new Error(`${path} no longer writes its control family through the control store (${must})`);
  const stray = mustNot.exec(text);
  if (stray) throw new Error(`${path} writes a control family where a mirror may read it: ${stray[0]}`);
}
console.log("placement-residency-witness: projection and ingest decisions read placement, not title patterns; every control family rests in the unmirrored control document");
