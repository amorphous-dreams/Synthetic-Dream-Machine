// doctype — every carrier opens by naming the grammar that reads it.
//
// The spec states it as a MUST and 84 carriers did not do it, which is the ordinary fate of a law with
// no instrument: true where someone remembered, false where nobody did, and nothing anywhere counting.
//
// ── WHY THE DECLARATION IS THE ONE LINE THAT MUST BE RIGHT ──────────────────────────────────────
// It is the FIRST line of every carrier — the line a stranger meets before knowing any of this, and the
// line that selects which grammar reads everything below it. A carrier without one asks its reader to
// guess; a carrier pointing at the wrong address names a grammar that does not read it, which is worse,
// because the guess would at least have been informed by the extension.
//
// One address, exactly: this grammar's spec. A DOCTYPE aimed anywhere else is not a variant, it is a
// declaration that does not hold.
import { readFileSync, existsSync } from "fs";
import { readCarrier, vanishedNote } from "./corpus-read.mjs";
import { join } from "path";

const REPO = process.env["REPO"] ?? process.cwd();
const SPEC_URI = "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext";
const ROOT = "memetic-wikitext+tiddlywiki";
// QUOTED, because a bare positional binds a PHANTOM parameter and leaves the slot EMPTY — the carrier-head
// ruling, and the cure the corpus already took when 738 carriers and their minters converted. This witness
// was the one reader left on the retired spelling, so it called 725 canonical carriers "the wrong form".
const DECLARATION = `<<!DOCTYPE "${ROOT}" "${SPEC_URI}">>`;
// THE ONE FINDER of the corpus. A hardcoded glob answers a question about PATHS; the law asks about
// DECLARATIONS, and the two disagreed on the runtime kernel face for three rulings.
const DIST_CARRIERS = join(REPO, "packages/lararium-tw5/dist/carrier-files.js");
if (!existsSync(DIST_CARRIERS)) {
  console.error(`[doctype] no built shore at ${DIST_CARRIERS}\n  cure: pnpm --filter @lararium/tw5 build`);
  process.exit(2);
}
const { carrierFiles } = await import(DIST_CARRIERS);
// A FENCED DECLARATION DECLARES NOTHING. A carrier that TEACHES the register writes both forms in a
// fence, and a reader counting lines takes the lesson for the carrier's own act — measured the moment
// the framing spec gained a worked example of the comment form and reported itself undeclared.
const { fencedSpans, inMask } = await import(
  new URL("../packages/lararium-tw5/dist/meme-ast/fence-mask.js", import.meta.url).pathname);



// ── A DECLARATION STANDS BARE, ON ITS OWN LINE ─────────────────────────────────────────────────
// A carrier answers to this grammar alone, so its declaration stands bare where the grammar reads it.
// The retired comment spelling hides the declaration from the one reader it addresses — it declares to
// nobody. The file's DECLARATION decides that, never its extension.
const COMMENTED = /^<!--\s*<<~\s*!DOCTYPE/;

const carriers = carrierFiles(REPO);

const missing = [], hidden = [], misaimed = [];
for (const f of carriers) {
  // THE DECLARATION PRECEDES ITS GRAMMAR, NEVER THE FILE. Byte zero belongs to whatever outside reader
  // requires it — YAML front-matter for a skill loader, a shebang, a BOM — and the declaration follows
  // that, binding tightly to the SOH beneath it. Demanding line 1 would refuse every carrier that also
  // serves a second reader, which is the case this grammar exists to make possible.
  const text = readCarrier(REPO, f);
  // The enumeration read it; a parallel commit may have removed it since. Counted, never silent.
  if (text === null) continue;
  const spans = fencedSpans(text);
  const lines = text.split("\n");
  // Offsets, so a line can be asked whether a fence already holds it.
  const starts = []; { let o = 0; for (const l of lines) { starts.push(o); o += l.length + 1; } }
  const live = (i) => !inMask(spans, starts[i]);
  const findLive = (p) => lines.findIndex((l, i) => live(i) && p(l.trim()));
  const at = findLive((l) => l.startsWith("<<!DOCTYPE"));
  // A CALL binds with `=`; `:` is definition-side. Reading only the colon form matched 5 stragglers and
  // missed 2961 real heads, so the "nothing stands between the declaration and the head" check below never
  // fired — a gate that reads green because it never runs. Both spellings are admitted; the colon form is
  // the retired one and still worth catching where it stands.
  const sohAt = findLive((l) => l.startsWith("<<^ code=") || l.startsWith("<<^ code:"));
  const commented = lines.some((l, i) => live(i) && COMMENTED.test(l.trim()));
  // A hidden declaration declares to nobody.
  if (commented) { hidden.push(f); continue; }
  if (at < 0) { missing.push(f); continue; }
  const first = (lines[at] ?? "").trim();
  if (first !== DECLARATION) { misaimed.push([f, first.slice(0, 100)]); continue; }
  // The pair binds: nothing but blank lines may stand between the declaration and the heading.
  if (sohAt >= 0 && lines.slice(at + 1, sohAt).some((l) => l.trim() !== "")) {
    misaimed.push([f, "content stands between the declaration and the heading — the pair binds tightly"]);
  }
}

console.log(`[doctype] ${carriers.length} carriers · ${missing.length} without · ${hidden.length} declaring to nobody · ${misaimed.length} in the wrong form${vanishedNote()}`);
for (const f of missing.slice(0, 10)) console.log(`  no declaration   ${f}`);
if (missing.length > 10) console.log(`  … and ${missing.length - 10} more`);
for (const f of hidden) console.log(`  declares to nobody   ${f}`);
for (const [f, line] of misaimed) console.log(`  ${f}\n    ${line}`);

// ── A SPECIMEN HOLDS PRE-RULING TEXT ON PURPOSE ────────────────────────────────────────────────
// Six `.mem` files carry the comment form and MUST keep it: four kumulipo corpora (placebo and
// shuffled) that a measurement depends on holding still, and two `wild-*` specimens that exist to
// feed a parser text written before the ruling. Migrating either destroys the thing it holds.
//
// They ride as a DECLARED CLASS with the reason written here, never as a count that can never reach
// zero. A witness failing every run shrinks to nothing; a witness naming what it exempts stays a
// witness. Any OTHER `.mem` or `.tid` hiding its declaration fails outright.
const SPECIMENS = [
  "packages/lararium-sensorium/scripts/fixtures/placebo-kumulipo/",
  "packages/lararium-sensorium/scripts/fixtures/shuffled-kumulipo/",
  "packages/tree-sitter-memetic-wikitext/fixtures/specimens/wild-",
];
const unowned = hidden.filter((f) => !SPECIMENS.some((p) => f.startsWith(p)));
if (unowned.length) {
  console.log(`  ${unowned.length} carrier(s) declare to nobody and name no reason:`);
  for (const f of unowned) console.log(`    ${f}`);
  process.exit(1);
}
if (hidden.length) {
  console.log(`  ${hidden.length} specimen(s) hold pre-ruling text on purpose — declared, never inferred`);
}

if (missing.length + misaimed.length === 0) {
  console.log("  every carrier opens by naming the grammar that reads it, at the one address that does");
  process.exit(0);
}
console.log(`  The declaration reads exactly:  ${DECLARATION}`);
process.exit(1);
