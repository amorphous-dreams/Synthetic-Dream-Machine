/**
 * artifact-pin — the artifact record names the toolchain the package installs.
 *
 * `package.json#artifact` records the CLI that generates `src/parser.c` and builds the wasm, and
 * the runtime that loads it. Those two fields travel into every release bundle's `artifact.json`.
 * This test reads the record against the pins the package installs (`devDependencies` for the CLI,
 * `dependencies` for the runtime) and against the installed CLI's own manifest, so a bump that
 * moves one side and not the other reads red.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PKG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(PKG_DIR, "package.json"), "utf8"));

/** Every place where the artifact record and the package's own pins disagree, as readable lines. */
export function pinDrift(manifest) {
  const artifact = manifest.artifact ?? {};
  const drift = [];
  const cliPin = manifest.devDependencies?.["tree-sitter-cli"];
  const runtimePin = manifest.dependencies?.["web-tree-sitter"];
  if (artifact.treeSitterCli !== cliPin) {
    drift.push(`artifact.treeSitterCli ${artifact.treeSitterCli} ≠ devDependencies tree-sitter-cli ${cliPin}`);
  }
  if (artifact.webTreeSitter !== runtimePin) {
    drift.push(`artifact.webTreeSitter ${artifact.webTreeSitter} ≠ dependencies web-tree-sitter ${runtimePin}`);
  }
  return drift;
}

test("the artifact record names the CLI and runtime the package pins", () => {
  assert.deepEqual(pinDrift(pkg), []);
});

test("the installed CLI is the one the artifact record names", () => {
  const require = createRequire(path.join(PKG_DIR, "package.json"));
  const installed = JSON.parse(readFileSync(require.resolve("tree-sitter-cli/package.json"), "utf8"));
  assert.equal(installed.version, pkg.artifact.treeSitterCli);
});

test("CONTROL: a record that names another CLI or runtime reads as drift", () => {
  const cliMoved = { ...pkg, artifact: { ...pkg.artifact, treeSitterCli: "0.0.0-other" } };
  assert.equal(pinDrift(cliMoved).length, 1);
  assert.match(pinDrift(cliMoved)[0], /treeSitterCli/);
  const runtimeMoved = { ...pkg, dependencies: { ...pkg.dependencies, "web-tree-sitter": "0.0.0-other" } };
  assert.equal(pinDrift(runtimeMoved).length, 1);
  assert.match(pinDrift(runtimeMoved)[0], /webTreeSitter/);
});
