#!/usr/bin/env node
/**
 * pulama-closure — one digest over the pūlama's code closure in a source tree, so a build can label what the pūlama
 * runs apart from the vessel it shares an image with (docker-compose.surface.yml runs the pūlama on the vessel's image).
 *
 *   node tools/pulama-closure.mjs <tree>          prints `sha256:<hex>` on one stdout line
 *   node tools/pulama-closure.mjs <tree> --list   prints the `<sha256>  <path>` lines the digest hashes
 *
 * The closure reads from `packages/lararium-node/src/pulama-main.ts`: every relative import it reaches inside that
 * package (`./x.js` reads `./x.ts`), and, for each workspace package any file of the closure imports by name
 * (`@lararium/mesh`, `@lararium/mesh/node`), that package's whole `src/` tree and `package.json`, followed the same way
 * through the workspace packages those import. The lock file, the reached packages' `package.json` and the TypeScript
 * configs ride beside them. It over-reads rather than under-reads: a closure that moves asks a re-light, and a
 * vessel-only change keeps the standing pūlama. The digest hashes the sorted `<sha256>  <path>` lines.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const tree = process.argv[2];
if (!tree || !existsSync(tree)) { process.stderr.write("pulama-closure: name the source tree to read\n"); process.exit(2); }
const root = resolve(tree);
const ENTRY = "packages/lararium-node/src/pulama-main.ts";
if (!existsSync(join(root, ENTRY))) { process.stderr.write(`pulama-closure: no ${ENTRY} stands in ${root}\n`); process.exit(3); }

// The workspace packages by name.
const packages = new Map();
for (const dir of readdirSync(join(root, "packages"))) {
  const manifest = join(root, "packages", dir, "package.json");
  if (!existsSync(manifest)) continue;
  try { const name = JSON.parse(readFileSync(manifest, "utf8")).name; if (typeof name === "string") packages.set(name, join("packages", dir)); } catch { /* a manifest that reads no name joins no closure */ }
}

const files = new Set();
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const specs = (path) => [...readFileSync(join(root, path), "utf8").matchAll(SPEC)].map((m) => m[1]);
const walk = (dir) => readdirSync(join(root, dir)).flatMap((e) => {
  const p = join(dir, e);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

const reachedPackages = new Set();
const seen = new Set();
const queue = [ENTRY];
const reachPackage = (spec) => {
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  const dir = packages.get(name);
  if (dir === undefined || reachedPackages.has(dir)) return;
  reachedPackages.add(dir);
  files.add(join(dir, "package.json"));
  if (existsSync(join(root, dir, "src"))) for (const f of walk(join(dir, "src"))) { files.add(f); if (/\.[cm]?[jt]sx?$/.test(f)) queue.push(f); }
};
while (queue.length > 0) {
  const path = queue.pop();
  if (seen.has(path) || !existsSync(join(root, path))) continue;
  seen.add(path);
  files.add(path);
  for (const spec of specs(path)) {
    if (spec.startsWith(".")) {
      const base = join(dirname(path), spec);
      const hit = [base, base.replace(/\.js$/, ".ts"), base.replace(/\.mjs$/, ".mts"), `${base}.ts`, join(base, "index.ts")].find((c) => existsSync(join(root, c)) && statSync(join(root, c)).isFile());
      if (hit !== undefined) queue.push(hit);
    } else if (!spec.startsWith("node:")) reachPackage(spec);
  }
}
for (const extra of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", "packages/lararium-node/package.json", "packages/lararium-node/tsconfig.json"]) if (existsSync(join(root, extra))) files.add(extra);

const lines = [...files].map((f) => relative(root, join(root, f)).split("\\").join("/")).sort()
  .map((f) => `${createHash("sha256").update(readFileSync(join(root, f))).digest("hex")}  ${f}`);
if (process.argv[3] === "--list") process.stdout.write(lines.join("\n") + "\n");
else process.stdout.write(`sha256:${createHash("sha256").update(lines.join("\n") + "\n").digest("hex")}\n`);
