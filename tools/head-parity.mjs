/**
 * head-parity — the shore's reading, measured against TiddlyWiki's OWN parse tree.
 *
 * ── WHY AN ORACLE AND NOT A DEPENDENCY ───────────────────────────────────────────────────────────
 * The shore reads a carrier's framing ends with a pattern. A pattern can be right about every carrier
 * standing today and wrong about the grammar — and that gap is exactly what this house keeps paying
 * for: nine readers agreed with each other, and none of them agreed with the parser.
 *
 * TiddlyWiki's parser is the only reading that decides. Putting it on the hot path would make every
 * gate carry a wiki boot; putting it HERE makes it the authority the pattern answers to. Regex stays
 * the fast implementation; the tree stays the truth, and drift between them fails loudly.
 *
 * ── WHAT THE TREE GIVES THAT NO PATTERN DOES ─────────────────────────────────────────────────────
 * A control sigil parses to a `transclude` node whose `$variable` names the host (`^` or `~`) and
 * whose attributes carry typed values — `to` arrives as `lar:///…` with the quote pair already gone,
 * a namespace arrives WHOLE, and a sigil standing inside a fence or a tick span produces NO node at
 * all. Masking, quoting and namespace-splitting all stop being questions.
 *
 * Exit 0 = the shore and the parser name the same address for every carrier.
 */
import { readFileSync, existsSync } from "node:fs";
import { readCarrier, vanishedNote } from "./corpus-read.mjs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env["REPO"] ?? join(HERE, "..");
const DIST = join(REPO, "packages/lararium-tw5/dist");
// THE ONE FINDER of the corpus. A hardcoded glob answers a question about PATHS; the law asks about
// DECLARATIONS, and the two disagreed on the runtime kernel face for three rulings.
const DIST_CARRIERS = join(REPO, "packages/lararium-tw5/dist/carrier-files.js");
if (!existsSync(DIST_CARRIERS)) {
  console.error(`[head-parity] no built shore at ${DIST_CARRIERS}\n  cure: pnpm --filter @lararium/tw5 build`);
  process.exit(2);
}
const { carrierFiles } = await import(DIST_CARRIERS);


// THE ABSENCE NAMES ITS CURE. A witness that skipped here would read clean over an unbuilt tree.
for (const need of ["carrier-head.js", "tw5-vm.js", "generated-tw5-version.js"]) {
  if (!existsSync(join(DIST, need))) {
    console.error(`[head-parity] no built shore at ${join(DIST, need)}\n  cure: pnpm --filter @lararium/tw5 build`);
    process.exit(2);
  }
}

const { matchCarrierHead } = await import(join(DIST, "carrier-head.js"));
const { TW5Engine } = await import(join(DIST, "tw5-vm.js"));
const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import(join(DIST, "generated-tw5-version.js"));

const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
if (!existsSync(CORE)) {
  console.error(`[head-parity] no TW5 core blob at ${CORE}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
  process.exit(2);
}

const engine = new TW5Engine();
await engine.boot(new Uint8Array(readFileSync(CORE)));
const wiki = engine.wiki ?? engine._tw?.wiki;

/** Every control-host transclude node the parser found, in reading order. */
function controlNodes(nodes, out = []) {
  for (const n of nodes ?? []) {
    if (n.type === "transclude" && n.attributes?.$variable?.value === "^") out.push(n);
    controlNodes(n.children, out);
  }
  return out;
}

/** The address the PARSER says this carrier's head names — named or positional. */
function parserHeadUri(text) {
  for (const n of controlNodes(wiki.parseText("text/vnd.tiddlywiki", text, { parseAsInline: false }).tree)) {
    const code = n.attributes?.code?.value ?? "";
    if (!/&#x00(?:01|11);/.test(code)) continue;
    // the far side is a named `to=`, or the positional token the framing ends carried before names
    const named = n.attributes?.to?.value;
    if (named) return named;
    const positional = Object.entries(n.attributes ?? {})
      .filter(([k, v]) => v?.isPositional && /^lar:\/\//.test(String(v.value)))
      .map(([, v]) => String(v.value));
    if (positional.length) return positional[0];
  }
  return null;
}

const files = carrierFiles(REPO);

const drift = [];
let agreed = 0, neither = 0;
for (const rel of files) {
  const text = readCarrier(REPO, rel);
  // The enumeration read it; a parallel commit may have removed it since. Counted, never silent.
  if (text === null) continue;
  const shore = matchCarrierHead(text)?.uri ?? null;
  const parser = parserHeadUri(text);
  if (shore === parser) { shore === null ? neither++ : agreed++; continue; }
  drift.push({ rel, shore, parser });
}

console.log(`[head-parity] ${files.length} carriers · ${agreed} agree · ${neither} name no head · ${drift.length} DRIFT${vanishedNote()}`);
if (drift.length) {
  console.log("\n  the shore and TiddlyWiki's parser disagree — the parser decides:");
  for (const d of drift.slice(0, 40)) {
    console.log(`    ${d.rel}\n      shore  ${d.shore ?? "(none)"}\n      parser ${d.parser ?? "(none)"}`);
  }
  if (drift.length > 40) console.log(`    …and ${drift.length - 40} more`);
} else {
  console.log("  the pattern reads what the parser reads, on every carrier that stands");
}
process.exit(drift.length ? 1 : 0);
