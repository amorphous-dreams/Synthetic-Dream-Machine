// source-pointer — every carrier that names the code it documents must name code that EXISTS.
//
// A meme earns its authority by pointing at the thing it describes. Two spellings carry that pointer:
// the `source-file` key in the TOML meta block, and a `<<~ pranala #source-file … to="…">>` edge. Both
// name a repo-relative path.
//
// WHEN THE CODE MOVES AND THE POINTER DOES NOT, the meme becomes unfalsifiable. A reader cannot check it
// against anything, so its claims stand unchallenged however far they have drifted — and a high-rated
// carrier's claims are exactly the ones a reader will not think to doubt. Measured once:
// `mesh/causal-island.mem` (rated high) pointed at a deleted `causal-island.ts` and, unanchored, had grown a
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
//
// THE MOLT CENSUS RIDES THE SAME WALK. The pointers this gate reads already say which files a wiki names,
// so one more pass over the tracked index gives every path a KIND (by rule, from its path alone) and a
// STATE: `wiki` (a carrier, a tiddler, or a bare entry with its sidecar, standing in a wiki home or
// shipping as a plugin tiddler), `bound` (a file outside the wiki that a wiki carrier names by
// `source-file` or a `#source` edge), or `unbound`. The census REPORTS unbound and refuses on an UNCLASSIFIED path or a stale exemption: an unbound file
// breaks nothing today, and the count only helps while it stays honest; the one exemption list rides `docs/pono/molt-census.mem`. `--census` prints the kind table
// and every unbound path; `--json` beside it prints the rows. A path no rule names reads `unclassified` and turns the witness red.
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readCarrier, vanishedNote } from "./corpus-read.mjs";

/** A pointer names code when it reads as a repo-relative path into one of the source trees. */
const NAMES_CODE = /^(packages|tools|scripts)\//;

const META_KEY = /^source-file\s*=\s*"([^"]+)"/m;
// The pair and the slot name themselves (the kupono cut): ``<<~ pranala slot=`#source` from=`?` to=`packages/…`>>``,
// either order, the target captured by its name.
const PRANALA  = /<<~\s*pranala(?=(?:(?!>>).)*?\sslot=`#source[a-z-]*`)(?:(?!>>).)*?\sto=`([^`]+)`/gs;

/** Every target a carrier's text names as its source: the meta key and each `#source` edge, once each. */
export function pointersOf(text) {
  const seen = new Set();
  const meta = META_KEY.exec(text);
  if (meta) seen.add(meta[1]);
  for (const m of text.matchAll(PRANALA)) seen.add(m[1]);
  return [...seen];
}

// ---------------------------------------------------------------------------
// The molt census: kind by rule, state by standing.
// ---------------------------------------------------------------------------

/** A wiki home in the tracked tree: a canon bag or a wiki's own mirror. */
const WIKI_HOME = /^(bags|wikis)\//;
/** The seats that boot the house before any wiki stands. */
const SEED_SEAT = /^(?:CLAUDE|AGENTS(?:\.override)?)\.md$|^\.claude\/(?:noosphere-boot|agents\/(?:Explore|Plan)\.md)$/;
/** A host skill vendored into the checkout, and the host's own config beside the seat. */
const SKILL     = /^\.claude\/skills\//;
const HOST_CONFIG = /^\.(?:claude|codex)\//;
const FIXTURE   = /(?:^|\/)(?:fixtures?|goldens?|specimens|__snapshots__|testdata)\//;
const TEST      = /(?:^|\/)(?:tests?|e2e)\/|(?:^|[.\/_-])(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:test_[^/]+|[^/]+_test|conftest)\.py$/;
const CONFIG    = /^(?:\.github|\.vscode|\.githooks|\.playwright|deploy)\/|(?:^|\/)(?:package\.json|pnpm-lock\.yaml|tsconfig[^/]*\.json|\.mcp\.json|\.git[a-z]+|\.npmrc|\.nvmrc|\.dockerignore|\.editorconfig|Dockerfile[^/]*|Makefile|setup\.cfg|requirements[^/]*\.txt|[^/]+\.config\.[cm]?[jt]s)$|\.(?:ya?ml|toml|webmanifest|ini|cfg|conf)$/;
const CODE      = /\.(?:[cm]?[jt]sx?|py|rs|c|h|R|scm|css|html)$/;
const SCRIPT    = /\.(?:sh|ps1)$/;
const BINARY    = /\.(?:png|jpe?g|gif|webp|ico|svg|pdf|tgz|gz|zip|wasm|woff2?|ttf)$/;
const REGISTRY  = /\.(?:jsonl?|csv|tsv)$/;
const DATA      = /\.(?:txt|log|snap|patch|rules|done|lock|info)$|(?:^|\/)(?:SHA256SUMS|WASM_SHA256)$/;

/**
 * The kind a tracked path reads, from the path alone. First rule wins; `gitlink` marks a submodule
 * pointer and `hasMeta` a file whose `.meta` sidecar stands beside it.
 */
export function kindOf(path, { gitlink = false, hasMeta = false } = {}) {
  if (gitlink) return "submodule";
  if (path.startsWith("scratch/")) return "scratch";
  if (WIKI_HOME.test(path)) {
    if (path.endsWith(".mem")) return "carrier";
    if (path.endsWith(".tid")) return "tiddler";
    if (path.endsWith(".meta")) return "sidecar";
    return hasMeta ? "bare-entry" : "bag-stray";
  }
  if (SEED_SEAT.test(path)) return "seed-seat";
  if (path.startsWith("genesis/")) return "genesis";
  if (SKILL.test(path)) return "skill";
  if (HOST_CONFIG.test(path)) return "config";
  if (path.endsWith(".md")) return "flat-doc";   // a `.md` under tests/, .github/ or deploy/ reads a doc, never test or config
  if (FIXTURE.test(path)) return "fixture";
  if (path.endsWith(".tid")) return "tiddler";
  if (TEST.test(path)) return "test";
  if (CONFIG.test(path)) return "config";
  if (path.startsWith("tools/")) {
    if (path.includes("witness")) return "witness";
    return REGISTRY.test(path) ? "registry" : "tool";
  }
  if (SCRIPT.test(path) || (/(?:^|\/)scripts\//.test(path) && CODE.test(path))) return "script";
  if (CODE.test(path)) return "source";
  if (path.endsWith(".mem")) return "carrier-adrift";
  if (path.endsWith(".md") || /(?:^|\/)(?:LICENSE|NOTICE|COPYING)[^/]*$/.test(path)) return "flat-doc";
  if (BINARY.test(path)) return "binary";
  if (REGISTRY.test(path)) return "registry";
  if (DATA.test(path)) return "data";
  return "unclassified";
}

/** The kinds that already stand as something in a wiki. */
const WIKI_KINDS = new Set(["carrier", "tiddler", "sidecar", "bare-entry"]);

/** The one carrier that names the exemptions: path, reason and bound law, one line each in its `census-exempt` fence. */
export const EXEMPT_CARRIER = "bags/lares/ha.ka.ba/lares/docs/pono/molt-census.mem";
const EXEMPT_FENCE = /```census-exempt[^\n]*\n([\s\S]*?)```/g;

/** The exempt paths a carrier names: `path | reason` per line inside each `census-exempt` fence, mapped to the reason. */
export function exemptionsOf(text) {
  const out = new Map();
  if (text === null || text === undefined) return out;
  for (const m of text.matchAll(EXEMPT_FENCE)) {
    for (const line of m[1].split("\n")) {
      const at = line.indexOf(" | ");
      if (at < 0 || line.trimStart().startsWith("#")) continue;
      out.set(line.slice(0, at).trim(), line.slice(at + 3).trim());
    }
  }
  return out;
}

/**
 * Read every tracked entry (`{ path, mode }`) into a kind and a state. `textOf(path)` answers a carrier's
 * text or `null`; only a carrier standing in a wiki home binds a file.
 */
export function census(entries, textOf, exempt = new Map()) {
  const paths = new Set(entries.map(e => e.path));
  const named = new Set();
  let codeMemes = 0;
  for (const { path } of entries) {
    if (!WIKI_HOME.test(path) || !path.endsWith(".mem")) continue;
    const text = textOf(path);
    if (text === null) continue;
    const targets = pointersOf(text).filter(t => paths.has(t));
    if (targets.length > 0) codeMemes++;
    for (const t of targets) named.add(t);
  }
  const rows = [], byKind = {}, unclassified = [];
  const tally = { wiki: 0, bound: 0, unbound: 0, exempt: 0 };
  for (const { path, mode } of entries) {
    const kind = exempt.has(path) ? "exempt" : kindOf(path, { gitlink: mode === "160000", hasMeta: paths.has(`${path}.meta`) });
    const state = kind === "exempt" ? "exempt" : WIKI_KINDS.has(kind) ? "wiki" : named.has(path) ? "bound" : "unbound";
    rows.push({ path, kind, state });
    (byKind[kind] ??= { wiki: 0, bound: 0, unbound: 0, exempt: 0 })[state]++;
    tally[state]++;
    if (kind === "unclassified") unclassified.push(path);
  }
  const stale = [...exempt.keys()].filter(path => !paths.has(path));
  return { total: rows.length, ...tally, codeMemes, byKind, unclassified, stale, rows };
}

/** The tracked index as `{ path, mode }` rows; the mode tells a gitlink from a file. */
function trackedEntries(repo) {
  return execFileSync("git", ["ls-files", "-s", "-z"], { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0").filter(Boolean).map(line => {
      const tab = line.indexOf("\t");
      return { path: line.slice(tab + 1), mode: line.slice(0, 6) };
    });
}

/** The census turns red on an unclassified path or an exemption naming a path that left the tree; unbound only reports. */
const redCensus = result => result.unclassified.length > 0 || result.stale.length > 0;

function printCensus(result, table) {
  console.log(`[molt-census] ${result.total} tracked file(s) · ${result.wiki} in a wiki · ${result.bound} bound by a carrier · ${result.unbound} unbound · ${result.exempt} exempt · ${result.unclassified.length} unclassified · ${result.codeMemes} carrier(s) binding a file${vanishedNote()}`);
  if (!table) {
    console.log("  unbound reports; an unclassified path or a stale exemption reads red; `node tools/source-pointer.mjs --census` prints the kind table and every unbound path");
    return;
  }
  const kinds = Object.keys(result.byKind).sort((a, b) => result.byKind[b].unbound - result.byKind[a].unbound || a.localeCompare(b));
  const width = Math.max(4, ...kinds.map(k => k.length));
  const cell = (n, w) => String(n).padStart(w);
  console.log(`\n  ${"kind".padEnd(width)}  ${cell("wiki", 6)}  ${cell("bound", 6)}  ${cell("unbound", 7)}`);
  for (const k of kinds) {
    const c = result.byKind[k];
    console.log(`  ${k.padEnd(width)}  ${cell(c.wiki, 6)}  ${cell(c.bound, 6)}  ${cell(c.unbound, 7)}`);
  }
  console.log("\n  unbound, by kind:");
  for (const k of kinds) for (const r of result.rows) if (r.kind === k && r.state === "unbound") console.log(`    ${k}  ${r.path}`);
  console.log("");
}

function main(args) {
  const at = args.indexOf("--repo");
  const REPO = at >= 0 ? resolve(args[at + 1]) : join(dirname(fileURLToPath(import.meta.url)), "..");
  const table = args.includes("--census"), json = args.includes("--json");

  const mems = execFileSync("git", ["ls-files", "-z", "*.mem"], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0").filter(Boolean);

  let pointers = 0;
  const dangling = [];
  const texts = new Map();

  for (const rel of mems) {
    const text = readCarrier(REPO, rel);
    texts.set(rel, text);
    if (text === null) continue;
    for (const target of pointersOf(text)) {
      if (!NAMES_CODE.test(target)) continue;   // a lar:/// address or a bags/ carrier is not this gate's question
      pointers++;
      if (!existsSync(join(REPO, target))) dangling.push([rel, target]);
    }
  }

  const result = census(trackedEntries(REPO), path => texts.get(path) ?? null, exemptionsOf(texts.get(EXEMPT_CARRIER)));
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.total === 0 || redCensus(result) ? 1 : 0;
  }

  console.log(`[source-pointer] ${pointers} carrier→code pointer(s) across ${mems.length} carriers · ${dangling.length} dangling`);
  if (mems.length === 0 || pointers === 0) {
    console.log("  NO CARRIER CODE POINTERS FOUND — the pointer census checked nothing");
    return 1;
  }
  printCensus(result, table);
  if (dangling.length > 0) {
    console.log("\n  A CARRIER POINTS AT CODE THAT IS GONE — re-aim it, or retire the carrier:");
    for (const [mem, target] of dangling) console.log(`    ${mem}\n      -> ${target}`);
    return 1;
  }
  if (redCensus(result)) {
    for (const path of result.unclassified) console.log(`  UNCLASSIFIED  ${path}\n    cure: add a rule to \`kindOf\` in tools/source-pointer.mjs, name the path in ${EXEMPT_CARRIER}, or move the file`);
    for (const path of result.stale) console.log(`  STALE EXEMPTION  ${path}\n    cure: drop the line from ${EXEMPT_CARRIER}; the path no longer stands in the tree`);
    return 1;
  }
  console.log("  every carrier that names its code names code that stands");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
