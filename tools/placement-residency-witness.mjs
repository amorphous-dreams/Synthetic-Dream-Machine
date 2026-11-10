#!/usr/bin/env node
/** Residency decisions may read a mirror grant or the record's kind, never title families. */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
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
  // The node's vessel-only class reads the held homes by name and every device-private document by bag (`vesselOnlyClass`).
  ["packages/lararium-node/src/open-node-vessel.ts", "vesselOnlyShareVerdict(vesselOnlyClass({ named: vesselOnly, held: secretHomes, device: deviceDocs"],
  ["packages/lararium-browser/src/open-browser-vessel.ts", "{ has: (id) => vesselOnly.has(id) || secretHomes.has(id) }"],
  // A6: the control document seals beside the secret home under the vessel's key; the per-face bridge is retired.
  ["packages/lararium-mesh/src/control-home.ts", "rest.enrollBeside(documentId, CONTROL_HOME_ID)"],
]) if (!read(path).includes(needle)) throw new Error(`${path} lost its secret-home seat: ${needle}`);
if (/CONTROL_HOME_ID/.test(read("packages/lararium-mesh/src/register-bags.ts"))) throw new Error("register-bags: the control home rides the per-face sealed set again (the bridge retired, A6)");
for (const path of ["packages/lararium-mesh/src/wiki-recipe.ts", "packages/lararium-node/src/bag-paths.ts", "packages/lararium-tw5/src/daemon-vm-core.ts", "packages/lararium-node/src/disk-projector.ts"]) {
  if (/SECRET_HOME_ID|bags\/secret/.test(read(path))) throw new Error(`${path} names the secret home: no recipe or mirror may`);
}
console.log("placement-residency-witness: the secret home takes every secret write, rests sealed, and no recipe, mirror or peer reaches it");

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

// ── HOUSE-MINTED WRITERS INTO A MIRRORED DOCUMENT ─────────────────────────────────────────────────────────────────
// The crossroads bag mirrors to its canon source, so a record the house mints at runtime and writes into the crossroads
// board lands in the tracked tree. Each house-minted family rests on a board no recipe mounts: a realm announce on the
// realm-announce board, a plugin offering's announce and a floor release on the publication board, a handle card on the
// WHO board. No source writes one through a crossroads handle, no writer of an offering or a release names the crossroads
// document at all, and no reader folds one off a crossroads document.
const HOUSE_WRITERS = {
  writeRealmBagAnnounce: "a realm announce",
  writeOfferingAnnounce: "a plugin offering announce",
  writeFloorRelease:     "a floor release",
  writeHandleAnnounce:   "a handle card",
  announceToWhoFace:     "a handle card",
};
const HOUSE_READERS = ["publicRealmBooksFromDoc", "offeringAnnouncesFromDoc", "readOfferingAnnounces", "floorReleaseRowsFromBoard", "nodeOfferingLookup", "browserOfferingLookup", "ingestAnnounceDoc"];
const writerCall = new RegExp(`(\\w+)\\.change\\(\\s*\\(?\\w+\\)?\\s*=>\\s*\\{?\\s*(${Object.keys(HOUSE_WRITERS).filter((w) => w.startsWith("write")).join("|")})\\(`, "g");
const readerCall = new RegExp(`\\b(${HOUSE_READERS.join("|")})\\(\\s*(?:[\\w.]+,\\s*)?([\\w.]+)`, "g");
const sourceFiles = execSync("git ls-files 'packages/*/src/*.ts'", { cwd: new URL(".", root), encoding: "utf8" }).split("\n").filter(Boolean);
for (const path of sourceFiles) {
  const text = read(path);
  for (const m of text.matchAll(writerCall)) {
    if (/crossroads/i.test(m[1])) throw new Error(`${path} writes ${HOUSE_WRITERS[m[2]]} into the mirrored crossroads document: ${m[0]}`);
    if (/^write(OfferingAnnounce|FloorRelease)$/.test(m[2]) && /\bcrossroadsDocUrl\(|CROSSROADS_DOC_URI/.test(text)) {
      throw new Error(`${path} writes ${HOUSE_WRITERS[m[2]]} beside a crossroads handle: it rests on the publication board alone`);
    }
  }
  for (const m of text.matchAll(/announceToWhoFace\(\s*(\w+)/g)) {
    if (/crossroads/i.test(m[1])) throw new Error(`${path} writes a handle card into the mirrored crossroads document: ${m[0]}`);
  }
  for (const m of text.matchAll(readerCall)) {
    if (/crossroads/i.test(m[2])) throw new Error(`${path} folds a house-minted family off a crossroads document: ${m[0]}`);
  }
  // A dead residency field: placement decides disk, so no source stamps one.
  if (/["']disk-projection["']\s*:/.test(text)) throw new Error(`${path} stamps a disk-projection field, which no projector reads`);
}
const climb = read("packages/lararium-mesh/src/nexus-board-climb.ts");
if (!/materializeSharedLarDoc\(repo, realmAnnounceDocUrl\(nexusPubkey\)/.test(climb) || /crossroadsDocUrl/.test(climb)) {
  throw new Error("nexus-board-climb: the realm re-announce writes somewhere other than the realm-announce board");
}
for (const [path, needle] of [
  ["packages/lararium-node/src/open-node-vessel.ts", 'announceHandle:   await materializeSharedLarDoc(repo, realmAnnounceDocUrl(nexusPubkey)'],
  ["packages/lararium-node/src/open-node-vessel.ts", "announceDoc:   () => hermAnnounces.doc()"],
  ["packages/lararium-mesh/src/federation-gate.ts", "realmAnnounceDocUrl(key)"],
]) if (!read(path).includes(needle)) throw new Error(`${path} lost the realm-announce board's seat: ${needle}`);
// The publication board's seats: its two writers, every reader, and the gate that federates it.
for (const [path, needle] of [
  ["packages/lararium-node/src/commands/nexus-publish.ts", "const boardUrl = publicationDocUrl("],
  ["packages/lararium-node/src/commands/nexus-release.ts", "materializeSharedLarDoc(repo, publicationDocUrl("],
  ["packages/lararium-node/src/commands/nexus-offering-inspect.ts", "const boardUrl = publicationDocUrl("],
  ["packages/lararium-node/src/floor-porch.ts", "materializeSharedLarDoc(repo, publicationDocUrl(nexusPubkey)"],
  ["packages/lararium-node/src/open-node-vessel.ts", "publicationHandle ??= await materializeSharedLarDoc(repo, publicationDocUrl(nexusPubkey)"],
  ["packages/lararium-browser/src/open-browser-vessel.ts", "publicationHandle ??= await materializeSharedLarDoc(repo, publicationDocUrl(nexusPubkey)"],
  ["packages/lararium-mesh/src/federation-gate.ts", "publicationDocUrl(key)"],
]) if (!read(path).includes(needle)) throw new Error(`${path} lost the publication board's seat: ${needle}`);
// The browser's face verbs write handle cards onto the WHO board the who-plane reads, never onto the crossroads document.
const whoResolver = /const resolveWhoBoard = [\s\S]*?materializeSharedLarDoc\(repo, (\w+)\(/.exec(read("packages/lararium-browser/src/open-browser-vessel.ts"));
if (whoResolver?.[1] !== "whoBoardDocUrl") throw new Error(`open-browser-vessel: the face verbs write handle cards onto ${whoResolver?.[1] ?? "no board"}, not the WHO board`);
// The daemon's born-from-source seeds rest in the shadow layer: each seed module lays its records through `seedShadows`.
for (const path of ["daemon-ui-tiddlers", "promote-ui-tiddlers", "daemon-persona-tiddlers", "daemon-circle-tiddlers", "daemon-roster-tiddlers", "daemon-intent-tiddlers", "daemon-flow-tiddlers"]) {
  if (!/seedShadows\(tw5, "/.test(read(`packages/lararium-tw5/src/${path}.ts`))) throw new Error(`${path}: a daemon seed writes outside the shadow layer`);
}
console.log("placement-residency-witness: projection and ingest decisions read placement, not title patterns; every control family rests in the unmirrored control document; no house-minted announce, offering, release, handle card or seed writes into a mirrored document");
