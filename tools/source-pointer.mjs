// source-pointer — every carrier that names the code it documents must name code that EXISTS.
//
// A meme earns its authority by pointing at the thing it describes. Two spellings carry that pointer:
// the `source-file` key in the TOML meta block, and a `<<~ pranala #source-file … to="…">>` edge. Both
// name a repo-relative path.
//
// WHEN THE CODE MOVES AND THE POINTER DOES NOT, the meme becomes unfalsifiable. A reader cannot check it
// against anything, so its claims stand unchallenged however far they have drifted — and a high-mana
// carrier's claims are exactly the ones a reader will not think to doubt. Measured 2026-09-12:
// `mesh/causal-island.mem` (mana 18) pointed at a deleted `causal-island.ts` and, unanchored, had grown a
// four-level `ABILITY_LADDER` that exists in no source file, promising a tiered gate its own sibling meme
// warns readers not to expect.
//
// A DANGLING POINTER IS THE CHEAPEST DRIFT TO CATCH — the filesystem answers it — and it is the leading
// indicator for the expensive kind. This gate is the anchor check alone: it asks whether the meme still
// points at something, never whether what it says about it is true.
//
// THE BEARING ARROW IS WHY THE PATTERN LOOKS ODD. A sigil call ends at `>>` and its body legitimately
// carries a single `>` in the `->` bearing arrow, so a `[^>]*` body pattern stops at the arrow and finds
// nothing. Measured while writing this gate: that spelling reported 0 edges over a corpus holding 27.
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readCarrier } from "./corpus-read.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A pointer names code when it reads as a repo-relative path into one of the source trees. */
const NAMES_CODE = /^(packages|tools|scripts)\//;

const META_KEY = /^source-file\s*=\s*"([^"]+)"/m;
const PRANALA  = /<<~\s*pranala\s+#source[a-z-]*\b(?:(?!>>).)*?to="([^"]+)"/gs;

const mems = execFileSync("git", ["ls-files", "-z", "*.mem"], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\0").filter(Boolean);

let pointers = 0;
const dangling = [];

for (const rel of mems) {
  const text = readCarrier(REPO, rel);
  if (text === null) continue;

  const seen = new Set();
  const meta = META_KEY.exec(text);
  if (meta) seen.add(meta[1]);
  for (const m of text.matchAll(PRANALA)) seen.add(m[1]);

  for (const target of seen) {
    if (!NAMES_CODE.test(target)) continue;   // a lar:/// address or a bags/ carrier is not this gate's question
    pointers++;
    if (!existsSync(join(REPO, target))) dangling.push([rel, target]);
  }
}

console.log(`[source-pointer] ${pointers} carrier→code pointer(s) across ${mems.length} carriers · ${dangling.length} dangling`);
if (dangling.length > 0) {
  console.log("\n  A CARRIER POINTS AT CODE THAT IS GONE — re-aim it, or retire the carrier:");
  for (const [mem, target] of dangling) console.log(`    ${mem}\n      -> ${target}`);
  process.exit(1);
}
console.log("  every carrier that names its code names code that stands");
