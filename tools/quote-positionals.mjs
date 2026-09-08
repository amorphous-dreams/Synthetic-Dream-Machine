#!/usr/bin/env node
/**
 * quote-positionals — wrap a POSITIONAL argument whose value carries a colon, and prove each edit.
 *
 * ── WHAT IT REPAIRS ──────────────────────────────────────────────────────────────────────────────
 * `param-name ":" value` is TiddlyWiki call syntax, and a URI scheme spells with exactly the
 * characters a parameter name admits. So an unquoted `lar:///x` standing in a positional slot binds a
 * phantom parameter named `lar` and THE POSITIONAL RECEIVES NOTHING — silently, with no error and no
 * missing output a reader would notice. `\widget ~loulou(p1:"" p2:"")` then takes p1's default.
 *
 * Upstream's `Calls` overstates when delimiters may be dropped; the correction stands at
 * lar:///ha.ka.ba/lares/docs/tw5-calls-colon-caveat.
 *
 * ── EVERY EDIT IS PROVED, NOT ASSUMED ────────────────────────────────────────────────────────────
 * For each sigil it would change, the parser reads the sigil BEFORE and AFTER. The edit stands only
 * when the value that was a phantom NAMED parameter arrives as a POSITIONAL carrying exactly the
 * original text, and no other named parameter moves. Anything else is reported and left alone.
 *
 * ── AND A FENCE IS NOT A SIGIL ───────────────────────────────────────────────────────────────────
 * A carrier that SHOWS the grammar writes sigils inside fences and tick spans. Those open nothing, so
 * by default the mask keeps them whole.
 *
 * ── `--teaching` REACHES INSIDE THE FENCE, AND VERIFIES DIFFERENTLY ─────────────────────────────
 * A fenced example still TEACHES, and a spec teaching a form that loses its positional teaches a
 * reader to write a carrier the wiki will mis-read. So this mode edits inside fences — and cannot
 * verify the way the default does, because a fenced sigil yields no parse node at all.
 *
 * It verifies the claim the example actually makes: the edited text, READ AS A SIGIL RATHER THAN AS
 * A QUOTATION, hands its positional back. An example only earns the change if the form it now shows
 * would work.
 *
 * ── AND A RECORD IS NOT A LESSON ────────────────────────────────────────────────────────────────
 * `lares-history` archives prior worldlines, and `tw5-calls-colon-caveat` DEMONSTRATES the hazard by
 * writing it out — moving either would edit the record, or delete the very thing the caveat exists to
 * show. Both stay, declared.
 *
 * Usage:  node tools/quote-positionals.mjs [--write] [--teaching] [<path.mem> | <dir>] …
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env["REPO"] ?? join(HERE, "..");
const DIST = join(REPO, "packages/lararium-tw5/dist");
const argv = process.argv.slice(2);
const write = argv.includes("--write");
const teaching = argv.includes("--teaching");
/** DECLARED EXEMPTIONS — a record, and a carrier whose lesson IS the broken form. */
const EXEMPT = [
  "bags/lares-history/",
  "bags/lares/ha.ka.ba/lares/docs/tw5-calls-colon-caveat.mem",
];
const given = argv.filter((a) => !a.startsWith("--"));

for (const need of ["sigil-attrs.js", "meme-ast/fence-mask.js", "tw5-vm.js", "generated-tw5-version.js"]) {
  if (!existsSync(join(DIST, need))) {
    console.error(`[quote-positionals] no built shore at ${join(DIST, need)}\n  cure: pnpm --filter @lararium/tw5 build`);
    process.exit(2);
  }
}
const { schemeShapedPositionals } = await import(join(DIST, "sigil-attrs.js"));
const { fencedSpans, inMask } = await import(join(DIST, "meme-ast/fence-mask.js"));
const { TW5Engine } = await import(join(DIST, "tw5-vm.js"));
const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import(join(DIST, "generated-tw5-version.js"));

const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
if (!existsSync(CORE)) {
  console.error(`[quote-positionals] no TW5 core blob at ${CORE}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
  process.exit(2);
}
const engine = new TW5Engine();
await engine.boot(new Uint8Array(readFileSync(CORE)));
const wiki = engine.wiki ?? engine._tw?.wiki;

function firstSigilNode(src) {
  const walk = (ns) => {
    for (const n of ns ?? []) {
      if (n.type === "transclude" && n.attributes) return n;
      const found = walk(n.children);
      if (found) return found;
    }
    return null;
  };
  try { return walk(wiki.parseText("text/vnd.tiddlywiki", src, { parseAsInline: false }).tree); }
  catch { return null; }
}

/** Does the parser hand this value back as a POSITIONAL in the edited form? */
function positionalArrives(after, value) {
  const n = firstSigilNode(after);
  if (!n) return false;
  return Object.values(n.attributes).some((a) => a.isPositional && a.value === value);
}

const files = given.length
  ? execSync(`git ls-files ${given.map((g) => `"${g}"`).join(" ")}`, { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean)
  : execSync('git ls-files "bags/**/*.mem"', { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);

const SIGIL = /<<(?:~[ \t]*)?[A-Za-z][\w-]*(?:[^>]|>(?!>))*>>/g;
let touched = 0, quoted = 0, fenced = 0;
const refused = [];

for (const rel of files) {
  if (EXEMPT.some((e) => rel.startsWith(e) || rel === e)) continue;
  const path = join(REPO, rel);
  const text = readFileSync(path, "utf8");
  const spans = fencedSpans(text);
  let out = "", cursor = 0, n = 0;
  SIGIL.lastIndex = 0;
  let m;
  while ((m = SIGIL.exec(text)) !== null) {
    if (inMask(spans, m.index) && !teaching) { fenced++; continue; }
    const src = m[0];
    const body = src.replace(/^<<~?[ \t]*/, "").replace(/>>$/, "");
    const hazards = schemeShapedPositionals(body);
    if (hazards.length === 0) continue;

    let edited = src;
    let ok = true;
    for (const h of hazards) {
      // Replace the WORD, bounded, so a value standing inside a longer run never gets half-quoted.
      const re = new RegExp(`(^|\\s)${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|>>)`);
      if (!re.test(edited)) { ok = false; break; }
      edited = edited.replace(re, `$1"${h}"`);
    }
    // A FENCED example is verified as the sigil it teaches, not as the quotation it sits in.
    if (!ok || !hazards.every((h) => positionalArrives(edited, h))) {
      refused.push(`${rel}  ${src.slice(0, 92)}`);
      continue;
    }
    out += text.slice(cursor, m.index) + edited;
    cursor = m.index + src.length;
    n += hazards.length;
  }
  if (n === 0) continue;
  out += text.slice(cursor);
  if (write) writeFileSync(path, out);
  touched++; quoted += n;
}

console.log(`quote-positionals  ${write ? "quoted" : "WOULD quote"} ${quoted} positional(s) in ${touched} carrier(s)`);
console.log(`  ${fenced} sigil(s) inside a fence or tick, left whole`);
if (refused.length) {
  console.log(`\n  REFUSED — the parser did not hand the value back as a positional (${refused.length}):`);
  for (const r of refused.slice(0, 20)) console.log(`    ${r}`);
  if (refused.length > 20) console.log(`    …and ${refused.length - 20} more`);
}
