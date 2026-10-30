#!/usr/bin/env node
/**
 * law-mutants — a law's strength reads as the mutants it kills. Each named mutant in a package's
 * `tests/laws/mutants.json` replaces one decision in its source; the package's law suite must read red
 * against it, and green against the source as it stands. The source restores after every mutant, and on
 * an interrupt, so no run leaves a mutant in the tree.
 *
 * Usage:  node tools/law-mutants.mjs <package-dir> <vitest-config>
 * Exit:   0 every mutant killed and the clean source green · 1 a mutant survived or the source reads red
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const pkg = resolve(process.argv[2] ?? "packages/lares-cli");
const suite = process.argv[3];
if (!suite) { console.log("law-mutants: name the package's law-suite vitest config"); process.exit(2); }
const catalog = JSON.parse(readFileSync(join(pkg, "tests/laws/mutants.json"), "utf8"));
const held = new Map();
const restore = () => { for (const [f, bytes] of held) writeFileSync(f, bytes); held.clear(); };
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restore(); process.exit(130); });

const run = (tests) => spawnSync("npx", ["vitest", "run", "-c", suite, ...tests], { cwd: pkg, encoding: "utf8" }).status;

let failed = 0;
const unnamed = catalog.mutants.filter((m) => !Array.isArray(m.tests) || m.tests.length === 0);
if (unnamed.length) { for (const m of unnamed) console.log(`  UNNAMED   ${m.law}: ${m.why} — names no law file to kill it`); process.exit(1); }
if (run([...new Set(catalog.mutants.flatMap((m) => m.tests))]) !== 0) { console.log("law-mutants: the clean source reads red; no mutant measures anything"); process.exit(1); }
for (const m of catalog.mutants) {
  const file = join(pkg, m.file);
  const bytes = readFileSync(file, "utf8");
  if (!bytes.includes(m.find)) { console.log(`  STALE     ${m.law}: ${m.why} — its find text stands nowhere in ${m.file}`); failed++; continue; }
  held.set(file, bytes);
  try {
    writeFileSync(file, bytes.replace(m.find, m.replace));
    const killed = run(m.tests) !== 0;
    console.log(`  ${killed ? "killed  " : "SURVIVED"}  ${m.law}: ${m.why}`);
    if (!killed) failed++;
  } finally { restore(); }
}
console.log(failed ? `law-mutants: ${failed} mutant(s) the laws let through` : `law-mutants: every one of ${catalog.mutants.length} mutants killed`);
process.exit(failed ? 1 : 0);
