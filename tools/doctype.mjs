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
import { existsSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
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
const { carrierFiles, inSubmodule } = await import(DIST_CARRIERS);
// A FENCED DECLARATION DECLARES NOTHING. A carrier that TEACHES the register writes the declaration in
// a fence, and a reader counting lines takes the lesson for the carrier's own act.
const { fencedSpans, inMask } = await import(
  new URL("../packages/lararium-tw5/dist/meme-ast/fence-mask.js", import.meta.url).pathname);

// ── A DECLARATION STANDS BARE, ON ITS OWN LINE ─────────────────────────────────────────────────
// A carrier answers to this grammar alone, so its declaration stands bare where the grammar reads it.
// A declaration inside a comment renders as nothing and reaches no reader: it declares to nobody, and
// the file's DECLARATION decides that, never its extension.
//
// The finder counts such a file undeclared, so the carrier list can never name it. This gate asks the
// tracked tree instead — every live line that is a comment holding a DOCTYPE aimed at this grammar.
const HIDDEN = /^<!--.*\bDOCTYPE\b.*memetic-wikitext.*-->$/;

const carriers = carrierFiles(REPO);

/** The live lines of a text — those no fence or code span quotes. */
function liveLines(text) {
  const spans = fencedSpans(text);
  const lines = text.split("\n");
  const starts = []; { let o = 0; for (const l of lines) { starts.push(o); o += l.length + 1; } }
  return { lines, live: (i) => !inMask(spans, starts[i]) };
}

const hidden = [];
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\0").filter(Boolean);
for (const f of tracked) {
  if (inSubmodule(f)) continue;
  // A tracked path that refuses to read as text — a symlink to nowhere, a binary blob — holds no line.
  let text;
  try { text = readFileSync(join(REPO, f), "utf8"); } catch { continue; }
  if (!text.includes("DOCTYPE")) continue;
  const { lines, live } = liveLines(text);
  if (lines.some((l, i) => live(i) && HIDDEN.test(l.trim()))) hidden.push(f);
}

const missing = [], misaimed = [];
for (const f of carriers) {
  // THE DECLARATION PRECEDES ITS GRAMMAR, NEVER THE FILE. Byte zero belongs to whatever outside reader
  // requires it — YAML front-matter for a skill loader, a shebang, a BOM — and the declaration follows
  // that, binding tightly to the SOH beneath it. Demanding line 1 would refuse every carrier that also
  // serves a second reader, which is the case this grammar exists to make possible.
  const text = readCarrier(REPO, f);
  // The enumeration read it; a parallel commit may have removed it since. Counted, never silent.
  if (text === null) continue;
  const { lines, live } = liveLines(text);
  const findLive = (p) => lines.findIndex((l, i) => live(i) && p(l.trim()));
  const at = findLive((l) => l.startsWith("<<!DOCTYPE"));
  // A CALL binds with `=`; `:` is definition-side. Reading only the colon form matched 5 stragglers and
  // missed 2961 real heads, so the "nothing stands between the declaration and the head" check below never
  // fired — a gate that reads green because it never runs. Both spellings are admitted; the colon form is
  // the retired one and still worth catching where it stands.
  const sohAt = findLive((l) => l.startsWith("<<^ code=") || l.startsWith("<<^ code:"));
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

if (missing.length + hidden.length + misaimed.length === 0) {
  console.log("  every carrier opens by naming the grammar that reads it, at the one address that does");
  process.exit(0);
}
console.log(`  The declaration reads exactly:  ${DECLARATION}`);
process.exit(1);
