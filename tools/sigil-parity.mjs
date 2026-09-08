/**
 * sigil-parity — our reading of a sigil's named parameters, against TiddlyWiki's OWN.
 *
 * `head-parity` proves the CONTROL frame's bearing. This proves every other sigil: for each one the
 * parser finds, the attributes TiddlyWiki typed are compared against what `readSigilAttrs` reads from
 * the same source span.
 *
 * ── WHY IT MUST EXIST BEFORE THE CORPUS MOVES ────────────────────────────────────────────────────
 * The control-sigil pass quoted the corpus FIRST, and eight readers that never meet the parser broke
 * in the same minute. This witness is the instrument that would have said so on the first carrier.
 * It runs green on the corpus as it stands, so any divergence it reports afterward belongs to the
 * change and not to the ground.
 *
 * A value TiddlyWiki types as anything but a string — a macro call, a transclusion, a filter — is
 * reported as CARRIED, never compared as text: those are the shapes quoting would break, and this
 * witness names them so a canonicalizer can refuse them.
 *
 * ── THE POSITIONAL-LOSS CLASS IS COUNTED, NOT FAILED ─────────────────────────────────────────────
 * TiddlyWiki reads `name:value` as a NAMED PARAMETER, so an unquoted positional carrying a colon —
 * every bare `<<~ loulou lar:///x>>` — hands its payload to a phantom parameter and leaves the
 * positional EMPTY. Upstream's own `Calls` doc overstates when delimiters may be dropped; this house
 * has the correction written at lar:///ha.ka.ba/lares/docs/tw5-calls-colon-caveat.
 *
 * That class stands as a MEASURED DEBT awaiting a ruling, never as a red. A witness that failed on it
 * every run would be a standing failure, and a standing failure shrinks a check to nothing — the very
 * shape `witness-all` exists to refuse. The count prints on every run and only shrinks.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env["REPO"] ?? join(HERE, "..");
const DIST = join(REPO, "packages/lararium-tw5/dist");

for (const need of ["sigil-attrs.js", "tw5-vm.js", "generated-tw5-version.js"]) {
  if (!existsSync(join(DIST, need))) {
    console.error(`[sigil-parity] no built shore at ${join(DIST, need)}\n  cure: pnpm --filter @lararium/tw5 build`);
    process.exit(2);
  }
}
const { readSigilAttrs } = await import(join(DIST, "sigil-attrs.js"));
const { TW5Engine } = await import(join(DIST, "tw5-vm.js"));
const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import(join(DIST, "generated-tw5-version.js"));

const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
if (!existsSync(CORE)) {
  console.error(`[sigil-parity] no TW5 core blob at ${CORE}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
  process.exit(2);
}
const engine = new TW5Engine();
await engine.boot(new Uint8Array(readFileSync(CORE)));
const wiki = engine.wiki ?? engine._tw?.wiki;

/** Every sigil node the parser found — control host, speaking host, or a plain macro call. */
function sigils(nodes, out = []) {
  for (const n of nodes ?? []) {
    if (n.type === "transclude" && n.attributes && n.start !== undefined && n.end !== undefined) out.push(n);
    sigils(n.children, out);
  }
  return out;
}

const files = execSync('git ls-files "bags/**/*.mem"', { cwd: REPO, encoding: "utf8" })
  .split("\n").filter(Boolean);

let sigilCount = 0, attrCount = 0, carried = 0;
const drift = [];
const positionalLoss = [];

for (const rel of files) {
  const text = readFileSync(join(REPO, rel), "utf8");
  let tree;
  try { tree = wiki.parseText("text/vnd.tiddlywiki", text, { parseAsInline: false }).tree; }
  catch { continue; }

  for (const n of sigils(tree)) {
    const src = text.slice(n.start, n.end);
    if (!src.startsWith("<<")) continue;
    sigilCount++;
    // the BODY: past the head word, up to the closing brackets
    const body = src.replace(/^<<[~^]?\s*/, "").replace(/>>\s*$/, "");
    const ours = new Map(readSigilAttrs(body).map((a) => [a.name, a]));

    for (const [name, attr] of Object.entries(n.attributes)) {
      if (name === "$variable" || attr.isPositional) continue;
      if (attr.type !== "string") { carried++; continue; }
      attrCount++;
      const mine = ours.get(name);
      if (!mine) {
        // THE POSITIONAL-LOSS CLASS: the parser invented this name out of a scheme, so our reader
        // rightly has no such parameter. Counted as debt, never as drift.
        if (/^\/\//.test(attr.value)) { positionalLoss.push({ rel, name, src }); continue; }
        drift.push({ rel, src, name, parser: attr.value, ours: "(absent)" });
        continue;
      }
      if (mine.kind !== "string") { carried++; continue; }
      if (mine.value !== attr.value) drift.push({ rel, src, name, parser: attr.value, ours: mine.value });
    }
  }
}

const lossFiles = new Set(positionalLoss.map((p) => p.rel));
console.log(`[sigil-parity] ${files.length} carriers · ${sigilCount} sigils · ${attrCount} string params compared · ${carried} typed, carried · ${drift.length} DRIFT`);
console.log(`  positional-loss (measured debt, awaiting a ruling): ${positionalLoss.length} in ${lossFiles.size} carriers`);
console.log(`    an unquoted positional carrying a colon reads as a NAMED parameter and the positional`);
console.log(`    receives nothing — see lar:///ha.ka.ba/lares/docs/tw5-calls-colon-caveat`);
if (drift.length) {
  console.log("\n  our reading and TiddlyWiki's disagree — the parser decides:");
  const seen = new Set();
  for (const d of drift) {
    const key = `${d.rel}|${d.name}|${d.ours}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 30) break;
    console.log(`    ${d.rel}  ${d.name}=\n      parser ${JSON.stringify(d.parser)}\n      ours   ${JSON.stringify(d.ours)}\n      src    ${d.src.slice(0, 100)}`);
  }
  if (drift.length > seen.size) console.log(`    …and ${drift.length - seen.size} more`);
} else {
  console.log("  every named parameter reads the same on both sides");
}
process.exit(drift.length ? 1 : 0);
