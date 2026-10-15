#!/usr/bin/env node
/**
 * host-ts parity gate — BOTH hosts answer to the same pinned hashes.
 *
 * Folds every frozen specimen and compares its canonical structural hash against the
 * manifest the py host bakes. A full pass witnesses cross-host parity byte-for-byte —
 * UTF-16 conversion, containment order, canonical JSON — through one sha256 per specimen.
 *
 * The ground is `fixtures/specimens/`, which moves only in a commit that also moves it. A carrier
 * holding a specimen folds as the text it holds (`held-text.mjs`), exactly as the py host reads it.
 * A hash that drifts here names a disagreement between the hosts, never a content edit.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { loadArtifact } from "./loader.mjs";
import { fold, structuralHash } from "./fold.mjs";
import { heldBytes } from "./held-text.mjs";

const PKG_DIR = path.normalize(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const SPECIMEN_DIR = path.join(PKG_DIR, "fixtures", "specimens");

const pkg = JSON.parse(await readFile(path.join(PKG_DIR, "package.json"), "utf8"));
const version = pkg.artifact.specimenManifest ?? pkg.artifact.corpusManifest;
const manifest = JSON.parse(await readFile(
  path.join(PKG_DIR, "fixtures", `specimens-${version}.json`), "utf8"));

const artifact = await loadArtifact();
const drifted = [];
const moved = [];
const missing = [];
let matched = 0;

for (const [name, want] of Object.entries(manifest.specimens)) {
  let data;
  try {
    data = await readFile(path.join(SPECIMEN_DIR, name));
  } catch {
    missing.push(name); // a specimen the manifest names must stand beside it
    continue;
  }
  const ground = heldBytes(new Uint8Array(data));
  // The byte hash first: a moved specimen names itself here, before its fold is ever suspected.
  const bytesGot = createHash("sha256").update(ground).digest("hex");
  if (want.sha256 && bytesGot !== want.sha256) {
    moved.push(`${name}  ts:${bytesGot.slice(0, 16)}  py:${want.sha256.slice(0, 16)}`);
    continue;
  }
  const got = structuralHash(fold(ground, artifact));
  if (got === want.hash) matched += 1;
  else drifted.push(`${name}  ts:${got.slice(0, 16)}  py:${want.hash.slice(0, 16)}`);
}

// A specimen the manifest never names goes unwitnessed, so the gate names it here.
const onDisk = (await readdir(SPECIMEN_DIR)).filter((f) => f.endsWith(".mem"));
const unpinned = onDisk.filter((f) => !(f in manifest.specimens));

console.log(`host-ts parity vs specimens-${version}: `
  + `${matched} match · ${drifted.length} drift · ${moved.length} bytes moved · ${missing.length} missing`);
if (moved.length) {
  console.error("BYTES MOVED — the specimen's own text no longer matches the pin, which says nothing yet about the fold. Re-bake if intended:");
  for (const line of moved) console.error(`  ${line}`);
  process.exit(1);
}
if (drifted.length) {
  console.error("DRIFT — the ts fold does not match the pinned hash. Either the hosts disagree, or a specimen moved without a re-bake:");
  for (const line of drifted) console.error(`  ${line}`);
  process.exit(1);
}
if (missing.length) {
  console.error(`the manifest names a specimen that does not stand: ${missing.join(", ")}`);
  process.exit(1);
}
if (unpinned.length) {
  console.error(`a specimen stands unpinned, so no host witnesses it: ${unpinned.join(", ")}`);
  process.exit(1);
}
