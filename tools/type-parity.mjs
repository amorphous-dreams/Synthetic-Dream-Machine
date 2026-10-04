// type-parity — every place that names the carrier's media type agrees with the one declaration.
//
// FOUR MECHANISMS DISPATCH ON THIS STRING, each a different one: the TW5 parser module exports under
// it, the deserializer module exports under it, `registerFileType` binds `.mem` to it, and a stored
// `type` field is compared against it. A fifth reads it back off disk from a carrier's own meta block.
//
// They agree only by hand, and the failure is silent in the worst way: a record whose type no reader
// admits simply stops projecting. No throw, no diagnostic, no file — the carrier is just absent from
// the next disk pass, and the diff reads as though nobody edited it.
//
// So `carrier-type.ts` holds the declaration and this witness checks that nothing spells it inline.
// A LITERAL IS THE FAULT, not a mismatch — by the time two literals disagree the damage has landed.
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const REPO = process.env["REPO"] ?? process.cwd();
// THE ONE FINDER of the corpus. A hardcoded glob answers a question about PATHS; the law asks about
// DECLARATIONS, and the two disagreed on the runtime kernel face for three rulings.
const DIST_CARRIERS = join(REPO, "packages/lararium-tw5/dist/carrier-files.js");
if (!existsSync(DIST_CARRIERS)) {
  console.error(`[type-parity] no built shore at ${DIST_CARRIERS}\n  cure: pnpm --filter @lararium/tw5 build`);
  process.exit(2);
}
const { carrierFiles } = await import(DIST_CARRIERS);

const DECL  = "packages/lararium-mesh/src/carrier-type.ts";
// THE DECLARATION'S OWN AUTHORITY moved to @lararium/memetic-frame — `write.ts` is the one hand that
// mints it (`CARRIER_DECLARATION`), and carrier-type.ts (the media-TYPE registry) no longer carries a
// copy to reconstruct one from. Reading write.ts's literal directly means this witness compares
// against the bytes the writer actually mints, not a hand-rebuilt guess at them.
const WRITE = "packages/lararium-memetic-frame/src/write.ts";

const decl = readFileSync(join(REPO, DECL), "utf8");
const canonical = /CARRIER_TYPE = "([^"]+)"/.exec(decl)?.[1];
// THE AUTHORITY'S OWN LITERAL, read verbatim — `CARRIER_DECLARATION` is a plain single-quoted string,
// never a template needing reassembly, so this witness takes it exactly rather than rebuilding it.
const write = readFileSync(join(REPO, WRITE), "utf8");
const declaration = /CARRIER_DECLARATION\s*=\s*'([^']+)'/.exec(write)?.[1] ?? null;
if (!canonical) {
  console.error("[type-parity] carrier-type.ts names no CARRIER_TYPE — the declaration moved");
  process.exit(1);
}

// THE DOCTYPE LINE GETS THE SAME GUARD, AND FOR THE SAME REASON A CARRIER TAUGHT US.
//
// Two writers once spelled that line by hand while the authority held another, and they drifted the
// moment the grammar took its `+tiddlywiki` suffix — three library indexes opened by naming the
// grammar's ADDRESS and never its name, parsed, and rendered back to something else. No module spells
// it inline anymore: `@lararium/memetic-frame` (the `CARRIER_DECLARATION` authority) carries no
// automerge/wasm weight, so every caller — including `meme-normalize`, once the one holdout that
// inlined it to dodge the mesh package's bundle cost — imports the real constant instead.

// THE EXPORT KEYS ARE THE ONE PLACE A LITERAL MUST STAND. TypeScript's `export { X as "literal" }`
// takes no expression, so the dispatch keys spell both names by necessity — and both must be there,
// because a carrier stored under either name needs a module registered for it.
const KEYED = [
  "packages/lararium-tw5/src/memetic-parser.ts",
  "packages/lararium-tw5/src/deserializer.ts",
];

const faults = [];
for (const f of KEYED) {
  const t = readFileSync(join(REPO, f), "utf8");
  if (!t.includes(`as "${canonical}"`)) faults.push([f, `registers no module under "${canonical}"`]);
}

// EVERY OTHER SITE READS THE DECLARATION. A source file spelling the type inline has forked it.
const SOURCES = execSync("git ls-files 'packages/*/src/*.ts' 'packages/*/src/**/*.ts' 'tools/*.mjs' 'scripts/*.ts'", {
  encoding: "utf8", cwd: REPO,
}).split("\n").filter(Boolean).filter((f) => f !== DECL && !KEYED.includes(f) && !f.includes(".generated."));

const inline = [];
for (const f of SOURCES) {
  const t = readFileSync(join(REPO, f), "utf8");
  for (const [i, line] of t.split("\n").entries()) {
    if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) continue;  // prose
    if (line.includes(`"${canonical}"`)) inline.push([`${f}:${i + 1}`, line.trim().slice(0, 90)]);
  }
}

// AND THE CORPUS. A carrier declares its own type in its own meta block. Reported, never failed:
// rewriting a carrier's type re-addresses it wherever a store addresses carriers by their bytes, so a
// census belongs in a reading rather than in a gate.
const carriers = carrierFiles(REPO);
let declared = 0, neither = 0;
for (const f of carriers) {
  const t = readFileSync(join(REPO, f), "utf8");
  if (t.includes(`= "${canonical}"`)) declared++;
  else neither++;
}

// Every literal DOCTYPE in a source must match the authority character for character.
const declFaults = [];
const normDecl = (s) => s.trim().replace(/\s*>>$/, ">>");
if (declaration) {
  for (const f of SOURCES) {
    if (f === DECL || f === WRITE) continue;
    const t = readFileSync(join(REPO, f), "utf8");
    // THROUGH THE CLOSING `>>`, QUOTES INCLUDED — the earlier form stopped at the first quote
    // (`[^"\`\n]*`), so it never captured the quoted grammar name or address at all. Every match then
    // read as a bare `<<!DOCTYPE`, which the "names no address" guard below (`!lit.includes("lar:///")`)
    // always skipped — the gate ran, matched, and never once fired, on a corpus that had already
    // drifted on this exact line twice.
    for (const m of t.matchAll(/<<!DOCTYPE[^`\n]*>>/g)) {
      const lit = normDecl(m[0]);
      // A CONCRETE declaration names the grammar and its address; anything else is a source
      // DESCRIBING the form rather than writing one — a grammar sketch in a comment, or a template
      // that builds the line from the constants it already reads. Neither can drift.
      if (lit.includes("${") || !lit.includes("lar:///")) continue;
      if (normDecl(declaration) !== lit) declFaults.push([f, lit.slice(0, 90)]);
    }
  }
}

console.log(`[type-parity] one spelling: "${canonical}"`);
if (declFaults.length > 0) {
  console.log(`  a source spells a DOCTYPE that differs from the one authority:`);
  for (const [where, lit] of declFaults) console.log(`    ${where}\n      ${lit}`);
}
console.log(`  corpus: ${declared} declaring it · ${neither} declaring none`);

if (inline.length > 0) {
  console.log(`  a source spells the type inline instead of reading the declaration:`);
  for (const [where, line] of inline) console.log(`    ${where}\n      ${line}`);
}
for (const [f, why] of faults) console.log(`  ${f} ${why}`);

if (inline.length + faults.length + declFaults.length === 0) {
  console.log("  one declaration, and every dispatch key registers it");
  process.exit(0);
}
console.log("  Read `carrier-type.ts`; a literal here is the fork, not the mismatch it becomes later.");
process.exit(1);
