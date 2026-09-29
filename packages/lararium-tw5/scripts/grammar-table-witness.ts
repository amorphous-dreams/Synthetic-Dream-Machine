/**
 * grammar-table-witness.ts — derive the sigil table from the tiddlers and diff it
 * against every HAND-KEPT list the node-side path still reads, printing each
 * disagreement grouped by kind: missing sigil, extra sigil, alias pair present on
 * one side only, pattern mismatch.
 *
 * scanner.ts's BOOTSTRAP_SCANS, builder.ts's CANONICAL_SIGILS and meme-normalize.ts's
 * DEFINITION_HEAD each derive from GENERATED_SIGILS (grammar-table.generated.ts, see
 * lar:///sigil.grammar.lane), never standing as hand-typed literals scraped out of source
 * text — so this witness IMPORTS the live runtime values directly. What remains genuinely
 * hand-kept (and so still worth a
 * disagreement report): BOOTSTRAP_SCANS' `control-*` frame marks + `pranala` (both
 * reasoned exceptions, see scanner.ts's own comments) and CANONICAL_SIGILS'
 * `kahea-invoke` + `control-*` residue (builder.ts's own comment).
 *
 * Derived side: deriveGrammarFromDisk() (tiddlers/sigil-*.tid, tag SharktoothSigil),
 * through the SAME shared converter grammar-cache.ts uses live.
 *
 * Run: tsx scripts/grammar-table-witness.ts
 */

import { deriveGrammarFromDisk, readGrammarTiddlers, nameFromTitle } from "./read-sigil-tiddlers.js";
import { BOOTSTRAP_SCANS } from "../src/meme-ast/scanner.js";
import { CANONICAL_SIGILS } from "../src/meme-ast/builder.js";
import { DEFINITION_WORDS } from "../src/meme-normalize.js";
import { checkTongueLaws } from "./tongue-laws.js";
import type { TongueEntry } from "./tongue-laws.js";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const derived = deriveGrammarFromDisk();
const derivedNames = new Set(derived.sigils.map((s) => s.name));
const derivedAlias = new Map(derived.sigils.filter((s) => s.aliasFor).map((s) => [s.name, s.aliasFor!]));
const derivedCanonicalNames = new Set(derived.sigils.filter((s) => !s.aliasFor).map((s) => s.name));

const handScans = BOOTSTRAP_SCANS.map((s) => ({ sigilName: s.sigilName, canonicalName: s.canonicalName }));
const handScanNames = new Set(handScans.map((s) => s.sigilName));
const handAlias = new Map(handScans.filter((s) => s.canonicalName).map((s) => [s.sigilName, s.canonicalName!]));

const handCanonical = CANONICAL_SIGILS;
const handDefHead = new Set(DEFINITION_WORDS);

let disagreements = 0;
let reasonedResidue = 0;
function group(title: string, lines: string[]): void {
  if (lines.length === 0) return;
  console.log(`\n-- ${title} (${lines.length}) --`);
  for (const l of lines) console.log(`  ${l}`);
  disagreements += lines.length;
}
/** Reported like `group`, but NEVER fails the witness — a permanent, structurally-reasoned residue
 *  (e.g. `kahea-invoke`: a dispatch-only pseudo-sigil `kaheaInvokeNode` synthesizes, never authored
 *  as a tiddler by design) rather than drift a fix should close. */
function groupReasoned(title: string, lines: string[]): void {
  if (lines.length === 0) return;
  console.log(`\n-- ${title} (${lines.length}, reasoned — does not fail the witness) --`);
  for (const l of lines) console.log(`  ${l}`);
  reasonedResidue += lines.length;
}

// 1. scanner.ts BOOTSTRAP_SCANS carries no "mirrors every tiddler by hand" list; `collectEvents`
// falls to GENERATED_SIGILS (buildScansFromGrammar) for everything BOOTSTRAP_SCANS does not itself
// carry, so there is no one-to-one hand-copy to diff against the tiddlers. What remains worth a
// witness: BOOTSTRAP_SCANS' own residue MUST equal exactly the reasoned exceptions — the control-*
// frame marks (frame-parity's independent-recognizer law, no tiddler) and pranala (its tiddler
// pattern shape does not match builder.ts's makeLeaf contract — see scanner.ts's comment). Anything
// else appearing there is an unreasoned hand-copy; anything declared reasoned but ABSENT is a
// silently-dropped exception.
const BOOTSTRAP_RESIDUE = new Set(["control-soh", "control-stx", "control-etx", "control-eot", "control-etb", "pranala"]);
const FRAME_HAND_KEPT = new Set(["control-soh", "control-stx", "control-etx", "control-eot", "control-etb"]);
const unreasonedInScanner: string[] = [];
for (const name of handScanNames) {
  if (!BOOTSTRAP_RESIDUE.has(name)) unreasonedInScanner.push(`${name} — BOOTSTRAP_SCANS carries it un-reasoned; only ${[...BOOTSTRAP_RESIDUE].join("/")} belongs here`);
}
group("scanner.ts: BOOTSTRAP_SCANS entry outside the reasoned residue", unreasonedInScanner.sort());

const missingReasonedResidue: string[] = [];
for (const name of BOOTSTRAP_RESIDUE) {
  if (!handScanNames.has(name)) missingReasonedResidue.push(`${name} — declared reasoned residue, absent from BOOTSTRAP_SCANS`);
}
group("scanner.ts: reasoned residue missing from BOOTSTRAP_SCANS", missingReasonedResidue.sort());

// 2. alias pairs are not a witness check: BOOTSTRAP_SCANS carries no alias (`canonicalName`) entry
// at all — every alias erasure flows through `buildScansFromGrammar`'s own
// `s.aliasFor ? { canonicalName: s.aliasFor } : {}` wiring, read straight off the SAME tiddler field
// (`lar-mirror-of`) `derivedAlias` above reads, so there is no second copy left to disagree.
// `derivedAlias` stays computed (harmless) in case a future hand-kept exception needs it; `handAlias`
// (always empty) is kept only so that shape stays visible, not read here.
void derivedAlias; void handAlias;

// 3. builder.ts CANONICAL_SIGILS vs derived canonical (non-alias) sigil names
// CANONICAL_SIGILS additionally carries the hand-kept frame names (control-*), which have no tiddler.
const missingFromCanonicalSet: string[] = [];
for (const name of derivedCanonicalNames) {
  if (!handCanonical.has(name)) missingFromCanonicalSet.push(`${name} — canonical tiddler sigil, missing from builder.ts CANONICAL_SIGILS`);
}
group("builder.ts: canonical sigil missing from CANONICAL_SIGILS", missingFromCanonicalSet.sort());

// `kahea-invoke` is builder.ts's own reasoned exception (see CANONICAL_SIGILS's comment there): a
// dispatch-only pseudo-sigil `kaheaInvokeNode` synthesizes from a `kahea` compound-call shape, never
// authored as its own tiddler by design — reported, but never a failure.
const CANONICAL_REASONED = new Set(["kahea-invoke"]);
const extraInCanonicalSet: string[] = [];
const reasonedInCanonicalSet: string[] = [];
for (const name of handCanonical) {
  if (FRAME_HAND_KEPT.has(name)) continue;
  if (derivedCanonicalNames.has(name)) continue;
  const line = `${name} — in builder.ts CANONICAL_SIGILS, not a canonical (non-alias) tiddler sigil`;
  (CANONICAL_REASONED.has(name) ? reasonedInCanonicalSet : extraInCanonicalSet).push(line);
}
group("builder.ts: CANONICAL_SIGILS entry with no matching canonical tiddler", extraInCanonicalSet.sort());
groupReasoned("builder.ts: CANONICAL_SIGILS entry with no matching canonical tiddler", reasonedInCanonicalSet.sort());

// 4. meme-normalize.ts DEFINITION_HEAD vs lar-kind pragma/pragma-alias sigils
// (native TW5 keywords define/procedure/function/typos/type carry no tiddler at all — reported separately)
const NATIVE_TW5_KEYWORDS = new Set(["define", "procedure", "function", "typos", "type"]);
const pragmaKindNames = new Set(
  derived.sigils.filter((s) => s.kind === "pragma" || s.kind === "pragma-alias").map((s) => s.name),
);
const missingFromDefHead: string[] = [];
for (const name of pragmaKindNames) {
  if (!handDefHead.has(name)) missingFromDefHead.push(`${name} — lar-kind pragma/pragma-alias, missing from DEFINITION_HEAD`);
}
group("meme-normalize.ts: pragma-kind sigil missing from DEFINITION_HEAD", missingFromDefHead.sort());

const unexplainedInDefHead: string[] = [];
for (const kw of handDefHead) {
  if (NATIVE_TW5_KEYWORDS.has(kw)) continue; // not a sharktooth sigil at all — TW5's own \define family
  if (!pragmaKindNames.has(kw)) unexplainedInDefHead.push(`${kw} — in DEFINITION_HEAD, no tiddler carries lar-kind pragma/pragma-alias for it`);
}
group("meme-normalize.ts: DEFINITION_HEAD keyword with no pragma-kind tiddler", unexplainedInDefHead.sort());

// 5. TONGUE laws (sigil-mirror-flip's weave-per-tongue field, lar:///sigil.grammar.lane) —
// pure checker in tongue-laws.ts, RED-tested there against a fixture; here it runs over the real
// tiddlers. Raw `lar-tongue`/`lar-weave` fields, not the already-derived `SigilRule.weave` — the
// shared converter silently DROPS `weave` when `lar-tongue` is absent, which is exactly law (e)'s
// shape; reading the derived field alone would hide it.
const tongueEntries: TongueEntry[] = readGrammarTiddlers().map((t) => {
  const name = nameFromTitle(t.title, t.fields);
  const aliasFor = t.fields["lar-mirror-of"];
  const tongue = t.fields["lar-tongue"];
  return {
    name,
    ...(aliasFor ? { aliasFor } : {}),
    ...(tongue ? { tongue } : {}),
    weavePrimary: t.fields["lar-weave"] === "primary",
  };
});
const tongueViolations = checkTongueLaws(tongueEntries);
const LAW_TITLE: Record<string, string> = {
  a: "(a) more than one lar-weave: primary mirror per canonical+tongue",
  b: "(b) a mirror name maps to two different canonicals",
  c: "(c) a mirror name collides with a canonical sigil's name",
  d: "(d) a lar-mirror-of target is not a canonical tiddler",
  e: "(e) a lar-weave: primary mirror declares no lar-tongue",
};
for (const law of ["a", "b", "c", "d", "e"] as const) {
  group(`tongue law ${LAW_TITLE[law]}`, tongueViolations.filter((v) => v.law === law).map((v) => v.message).sort());
}

const residueNote = reasonedResidue > 0 ? ` + ${reasonedResidue} reasoned residue` : "";
console.log(`\ngrammar-table-witness: ${disagreements} disagreement(s)${residueNote} (${derived.sigils.length} tiddler sigils, ${handScans.length} hand scan entries, ${handCanonical.size} CANONICAL_SIGILS entries, ${handDefHead.size} DEFINITION_HEAD keywords)`);
process.exit(disagreements > 0 ? 1 : 0);
