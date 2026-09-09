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
import { join } from "path";

const REPO = process.env["REPO"] ?? process.cwd();
const SPEC_URI = "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext";
const ROOT = "memetic-wikitext+tiddlywiki";
const DECLARATION = `<<!DOCTYPE ${ROOT} ${SPEC_URI}>>`;
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



// ── THE FORM FOLLOWS WHAT THE FILE'S OTHER READER CAN CARRY ────────────────────────────────────
// A `.mem` or a `.tid` answers to this grammar alone, so its declaration stands bare on its own line.
// A `.md` answers to a MARKDOWN READER TOO, and a bare `<<!DOCTYPE …>>` reaches that reader as visible
// text at the top of the page. The comment form declares to this grammar and shows nothing to the other.
//
// MEASURED, and the corpus already knew: ELEVEN of eleven `.md` carriers wear the comment form, with
// no counter-example anywhere. A law the corpus keeps perfectly and nobody had written down.
//
// So the form is not a spelling choice and not a debt — it is a FUNCTION OF THE FILE. Wearing the
// wrong one for your kind fails; wearing the right one passes, whichever it is.
const COMMENTED = /^<!--\s*<<~\s*!DOCTYPE/;
/** True where a carrier serves a second reader that would render a bare declaration. */
const showsItsSource = (f) => f.endsWith(".md");

const carriers = carrierFiles(REPO);

const missing = [], hidden = [], misaimed = [];
for (const f of carriers) {
  // THE DECLARATION PRECEDES ITS GRAMMAR, NEVER THE FILE. Byte zero belongs to whatever outside reader
  // requires it — YAML front-matter for a skill loader, a shebang, a BOM — and the declaration follows
  // that, binding tightly to the SOH beneath it. Demanding line 1 would refuse every carrier that also
  // serves a second reader, which is the case this grammar exists to make possible.
  const text = readFileSync(join(REPO, f), "utf8");
  const spans = fencedSpans(text);
  const lines = text.split("\n");
  // Offsets, so a line can be asked whether a fence already holds it.
  const starts = []; { let o = 0; for (const l of lines) { starts.push(o); o += l.length + 1; } }
  const live = (i) => !inMask(spans, starts[i]);
  const findLive = (p) => lines.findIndex((l, i) => live(i) && p(l.trim()));
  const at = findLive((l) => l.startsWith("<<!DOCTYPE"));
  const sohAt = findLive((l) => l.startsWith("<<^ code:"));
  const commented = lines.some((l, i) => live(i) && COMMENTED.test(l.trim()));
  if (showsItsSource(f)) {
    // A markdown carrier declares in the comment form, and a BARE declaration there is the fault:
    // it reaches the other reader as text.
    if (commented) { continue; }
    if (at >= 0) { misaimed.push([f, "a bare declaration renders as text to a markdown reader — use the comment form"]); continue; }
    missing.push(f); continue;
  }
  // Everything else answers to this grammar alone, so a hidden declaration declares to nobody.
  if (commented) { hidden.push(f); continue; }
  if (at < 0) { missing.push(f); continue; }
  const first = (lines[at] ?? "").trim();
  if (first !== DECLARATION) { misaimed.push([f, first.slice(0, 100)]); continue; }
  // The pair binds: nothing but blank lines may stand between the declaration and the heading.
  if (sohAt >= 0 && lines.slice(at + 1, sohAt).some((l) => l.trim() !== "")) {
    misaimed.push([f, "content stands between the declaration and the heading — the pair binds tightly"]);
  }
}

const md = carriers.filter(showsItsSource).length;
console.log(`[doctype] ${carriers.length} carriers (${md} also read as markdown) · ${missing.length} without · ${hidden.length} declaring to nobody · ${misaimed.length} in the wrong form`);
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
