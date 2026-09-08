#!/usr/bin/env node
/**
 * ranks-to-scale — a SCALE is the thing; RANKS are what it carries.
 *
 * 184 carriers wrote `<<~ranks AXIS chain>>` for a sigil the grammar registered nothing for. The
 * ontology settles it: the sigil is `scale`, and the chain it carries is its ranks — the shape the
 * boot seed has always written as `<<scale levels "rank-1@0..4 -> rank-2@5..8 -> …">>`.
 *
 *     <<~ranks organ mempalace ~ FIRST -> structurepalace ~ …>>
 *     <<~ scale organ "mempalace ~ FIRST -> structurepalace ~ …">>
 *
 * THE CHAIN RIDES QUOTED. Unquoted, every `->` reads as structure and every `word:` binds a parameter
 * nobody named. A chain already carrying a `"` takes the triple-quoted form, which admits almost
 * anything — the same escape hatch TiddlyWiki's own string literal offers.
 *
 * EVERY EDIT IS PROVED: the rewritten sigil is parsed, and the axis and the chain must both come back
 * as the values the source carried. Anything else is reported and left alone.
 *
 * Usage:  node tools/ranks-to-scale.mjs [--write]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env["REPO"] ?? join(HERE, "..");
const write = process.argv.includes("--write");
const require = createRequire(import.meta.url);
const { resolveTiddlyWiki, boot } = require(join(REPO, "VSCode-TW5-Syntax/tools/tw5-oracle.js"));
const $tw = boot(resolveTiddlyWiki(), {}).$tw;

/** Every positional the parser hands back for one sigil. */
function positionals(src) {
  const walk = (ns, out = []) => {
    for (const n of ns ?? []) {
      if (n.type === "transclude" && n.attributes) out.push(n);
      walk(n.children, out);
    }
    return out;
  };
  try {
    const n = walk($tw.wiki.parseText("text/vnd.tiddlywiki", src).tree)[0];
    return Object.values(n?.attributes ?? {}).filter((a) => a.isPositional).map((a) => String(a.value));
  } catch { return []; }
}

const CALL = /<<~[ \t]*ranks[ \t]+((?:[^>]|>(?!>))*?)[ \t]*>>/g;
const files = execSync('git ls-files "bags/**/*.mem"', { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);

let moved = 0, touched = 0, triple = 0;
const refused = [];
for (const rel of files) {
  const path = join(REPO, rel);
  const text = readFileSync(path, "utf8");
  let n = 0;
  const out = text.replace(CALL, (whole, body) => {
    const sp = body.search(/\s/);
    if (sp < 0) return whole;                                   // no chain to carry
    const axis = body.slice(0, sp);
    const chain = body.slice(sp + 1).trim();
    if (!/^[\w-]+$/.test(axis) || !chain) return whole;
    // A chain already carrying a quote takes the triple form, which admits almost anything.
    const q = chain.includes('"') ? '"""' : '"';
    const edited = `<<~ scale ${axis} ${q}${chain}${q}>>`;
    const got = positionals(edited);
    if (!got.includes(axis) || !got.includes(chain)) { refused.push(`${rel}  ${whole.slice(0, 88)}`); return whole; }
    if (q === '"""') triple++;
    n++;
    return edited;
  });
  if (!n) continue;
  if (write) writeFileSync(path, out);
  moved += n; touched++;
}
console.log(`ranks-to-scale  ${write ? "moved" : "WOULD move"} ${moved} call(s) in ${touched} carrier(s)`);
console.log(`  ${triple} chain(s) took the triple-quoted form (they already carried a quote)`);
if (refused.length) {
  console.log(`\n  REFUSED — the parser did not hand back both values (${refused.length}):`);
  for (const r of refused.slice(0, 12)) console.log(`    ${r}`);
}
