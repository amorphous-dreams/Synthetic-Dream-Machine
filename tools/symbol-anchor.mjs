// symbol-anchor — a carrier that NAMES a symbol should name one the source still defines.
//
// `source-pointer` asks whether a meme still points at a FILE. This asks the next question down: the
// `source-symbol` key names the export a carrier stands for, and a symbol the tree no longer defines
// means the carrier describes an architecture that has been replaced.
//
// A COUNTED DEBT, NOT A FAILING GATE. A witness that fails every run is a standing failure, and a
// standing failure shrinks a check to nothing — the same reasoning `doctype` uses for retired carriers.
// The debt reads against a CEILING that only ever shrinks: a run over the ceiling fails, a run under it
// prints the new low and asks for the ceiling to come down. So the class stays visible and cannot quietly
// grow, while nobody is blocked on a canon sweep somebody else's hands are in.
//
// WHAT THE CURRENT DEBT IS. Measured 2026-09-12, after the TW5 canon sweep: 43 of 70 named symbols stand
// in no source file. The TW5 widget-class anchors that made up the bulk (`AhuWidget`, `SigilWidget`,
// `PranalaWidget` …) are gone — those carriers now name the `.tid` that declares each sigil and the
// template cascade that renders it, and the ones naming a surface nothing replaced were retired. What
// remains sits in `bags/lararium/**/docs/` and `bags/lares/**/api/`: MCP tool names, Mu/Law-of-5s table
// constants, and pono-layer types. `ABILITY_LADDER` sits here too, and its sibling appearance in
// `mesh/causal-island.mem` was measured the same day promising a four-level gate that never existed.
//
// THE MATCH IS DELIBERATELY LOOSE — a word-boundary search across every tracked source file, not a parse.
// It answers "does this name appear anywhere the code lives", so a symbol it flags is genuinely absent
// rather than merely moved. False GREEN is the tolerable direction here; a false red would spend an
// operator's attention on a name that simply lives somewhere the parser did not look.
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readCarrier } from "./corpus-read.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The debt as measured 2026-09-12. RATCHET: this number may only ever come DOWN. */
const CEILING = 43;

/** Placeholders a carrier writes where it names no single export. */
const NOT_A_SYMBOL = /^([*]|<.*>|~.*)$/;

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\0").filter(Boolean);

// The haystack: every tracked source carrier, read once.
const SOURCE = /\.(ts|mts|cts|js|mjs|cjs|tid)$/;
const IN_SOURCE_TREE = /^(packages|tools|scripts|TiddlyWiki5)\//;
let haystack = "";
for (const rel of tracked) {
  if (!IN_SOURCE_TREE.test(rel) || !SOURCE.test(rel)) continue;
  if (rel.includes("/dist/") || rel.includes("/node_modules/")) continue;
  try { haystack += readFileSync(join(REPO, rel), "utf8") + "\n"; } catch { /* unreadable — skip */ }
}

const absent = [];
let checked = 0;

for (const rel of tracked) {
  if (!rel.endsWith(".mem")) continue;
  const text = readCarrier(REPO, rel);
  if (text === null) continue;
  const decl = /^source-symbol\s*=\s*"([^"]+)"/m.exec(text);
  if (!decl) continue;
  for (const sym of decl[1].split(/\s+/)) {
    if (!sym || NOT_A_SYMBOL.test(sym)) continue;
    checked++;
    const found = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);
    if (!found) absent.push([rel, sym]);
  }
}

console.log(`[symbol-anchor] ${checked} named symbol(s) · ${absent.length} absent from every source file (ceiling ${CEILING})`);

if (absent.length > CEILING) {
  console.log("\n  THE DEBT GREW — a carrier names a symbol the source does not define:");
  for (const [mem, sym] of absent) console.log(`    ${sym}\n      <- ${mem}`);
  console.log(`\n  ${absent.length} stands over the ceiling of ${CEILING}. Re-aim the carrier, or retire it.`);
  process.exit(1);
}
if (absent.length < CEILING) {
  // A SHRINK PASSES. Failing on progress would redden the fleet for somebody else's cleanup — and a gate
  // that punishes the direction it wants teaches the tree to route around it. The nudge stands in the
  // output where the next hand will read it; only GROWTH refuses.
  console.log(`  the debt SHRANK: ${absent.length} < ${CEILING}. Lower CEILING in tools/symbol-anchor.mjs to hold the ground.`);
  process.exit(0);
}
console.log("  the debt holds at its ceiling — visible, and not growing");
