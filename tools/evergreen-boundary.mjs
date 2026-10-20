// evergreen-boundary — the standing evergreen witness over `packages/*/src` and `tools/`.
//
// THE LAW IT HOLDS (lar:///ha.ka.ba/lares/docs/research/evergreen-sweep-2026, row G37). Code says what IS: a shape
// names itself by its bytes and edges, never by an authored counter; a wall clock never decides; a comment states
// the present. This reads three SEMANTIC SINKS, never bare tokens:
//   version    — an authored version field or numbered format: `schemaVersion`, a `<name>/v<N>` format or preimage
//                string, a `version`/`<word>Version` key held as a number, a `<NAME>_VERSION = <N>` constant;
//   clock      — `Date.now()` or `new Date()` flowing on its statement into an id (a template, a concat, a radix
//                string, an id/nonce/epoch name), a durable record field (a time-named key, quoted or bare, or an
//                ISO-stamped now), or a validity gate (a comparison or subtraction against the reading);
//   narration  — a comment that narrates history (used to, previously, legacy, the old, back-compat, …).
// It reads lines, not a syntax tree, so a sink split across lines escapes it; false green is the tolerable side.
//
// NAMED EXCEPTIONS. Each names its rule, its file, a substring of the line it allows (never a line number), how many
// lines it allows (`count`, one unless named) and its reason in the present tense. An exception that allows fewer
// lines than it names is STALE and fails the run, so the list never outlives the lines it names, and a new line that
// carries the same substring reads open.
//
// A COUNTED DEBT AGAINST CEILINGS THAT ONLY COME DOWN, one per rule (the `symbol-anchor` shape). A rule over its
// ceiling fails and names every open finding of that rule; a rule under it passes and asks for the ceiling to come
// down; a corpus that reads no file fails, since a zero from no reading proves nothing.
//
// Usage: node tools/evergreen-boundary.mjs [--list] [--root <dir> --ceilings version=N,clock=N,narration=N --no-exceptions]
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RULES = ["version", "clock", "narration"];
/** Today's measured open debt, per rule. RATCHET: each number may only ever come DOWN. */
export const CEILINGS = { version: 59, clock: 57, narration: 199 };
export const EXCEPTIONS = [
  { rule: "version", file: "packages/lararium-mesh/src/domains.ts", match: "const frozen =", reason: "The frozen builder preserves live signing domain bytes under the domain registry witness." },
  { rule: "version", file: "packages/lararium-browser/src/browser-vessel-identity.ts", match: "const IDB_VERSION", reason: "IndexedDB's open call takes a numeric version argument; the browser API names it." },
  { rule: "version", file: "packages/lares-cli/src/copilot-wire.ts", match: "interface HooksFile { version?: number;", reason: "The Copilot CLI's hooks file carries its own version key; the upstream tool owns that schema." },
  { rule: "version", file: "packages/lares-cli/src/copilot-wire.ts", match: "{ version: 1, hooks: {} }", reason: "A fresh Copilot hooks file opens at the version its upstream schema names." },
  { rule: "clock", file: "packages/lararium-tw5/src/wiki-draft-handlers.ts", match: "const cutoffMs =", reason: "The prune-stale report lists idle drafts for a person to read; the clock picks what the report shows, never what leaves, since nothing here prunes (operator ruling 2026-10-18)." },
  { rule: "clock", file: "packages/lararium-tw5/src/wiki-draft-handlers.ts", match: "const daysIdle =", reason: "The prune-stale report shows each draft's idle days to a person; the reading decides nothing (operator ruling 2026-10-18)." },
  { rule: "clock", file: "tools/browser-ci-join.mjs", match: "Date.now() >= deadline", reason: "The join reader bounds only its own wait for a host response." },
  { rule: "clock", file: "tools/browser-ci-smoke.mjs", match: "Date.now() < deadline", count: 4, reason: "The smoke runner's four polls each bound only its own wait on the browser it drives." },
  { rule: "clock", file: "tools/browser-ci-smoke.mjs", match: "Date.now() > graceEnd", reason: "The smoke runner bounds only its own connection status poll." },
  { rule: "clock", file: "tools/browser-weld-witness.test.mjs", match: "Date.now() < until", reason: "The test bounds only its own wait for a predicate." },
  { rule: "clock", file: "tools/browser-weld/c4-served-anchor-control.mjs", match: "Date.now() < until", reason: "The control bounds only its own wait for browser source records." },
  { rule: "clock", file: "tools/browser-weld/leaf-continuity.mjs", match: "Date.now() < until", reason: "The browser probe bounds only its own wait for a predicate." },
  { rule: "clock", file: "tools/browser-weld/weld.mjs", match: "Date.now() > stop", reason: "The browser probe bounds only its own polling interval." },
  { rule: "clock", file: "tools/e2e-shards.mjs", match: "Date.now() < deadline", reason: "The CI reader bounds only its own search for the run triggered by its push." },
  { rule: "clock", file: "tools/held-out-steps.mjs", match: "const left = deadline - Date.now()", reason: "The runner computes only its own child process timeout." },
  { rule: "clock", file: "tools/held-out-steps.test.mjs", match: "Date.now() - started <", reason: "The test measures only its own completion time." },
];
const REPO = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = /\.(?:ts|mts|cts|js|mjs|cjs|sh|py)$/;
const WITNESS_FILES = new Set([
  "tools/evergreen-boundary.mjs", "tools/evergreen-boundary-witness.sh", "tools/evergreen-boundary.test.mjs",
]); // The witness carries its own planted patterns.
const NARRATION = /\b(?:used to|previously|formerly|legacy|no longer|back-compat|backcompat|backward compat|deprecated|historically|the fix|the old|was (?:renamed|moved|replaced)|once (?:sat|lived|stood))\b/i;
const FORMAT = /(?:[a-z][\w.-]*|\})\/v(?:\d+|\$\{[^}]+\})(?![\w.])/;
const VERSION_CONST = /\b[A-Z][A-Z0-9_]*VERSION\s*=\s*(?:0x[\da-fA-F]+|\d)/;
const CLOCK = /(?:\bDate\.now\s*\(\s*\)|\bnew\s+Date\s*\()/;
const FIELD = /(?:\b[A-Za-z_$][\w$]*(?:At|Time|time|timestamp|Timestamp|ts|stamp|Stamp|date|Date)|\bts|["'][\w-]*(?:-at|-time|-ts|-stamp|-date|At|Time|timestamp|Timestamp)["'])\s*:/;
const ID_NAME = /\b(?:[A-Za-z_$][\w$]*)?(?:id|Id|ID|nonce|Nonce|epoch|Epoch)\s*=(?!=)/;

// `statement` has its string literals blanked, so a clock named inside a string reads nothing; `keyed` keeps them,
// so a quoted record key (`"requested-at":`) still names its field.
function clockSink(statement, keyed = statement) {
  if (!CLOCK.test(statement)) return false;
  if (FIELD.test(keyed) || /\bDate\.now\s*\(\s*\)\s*\.toString\s*\(\s*\d+\s*\)/.test(statement)) return true;
  if (/\bnew\s+Date\s*\(\s*\)\s*\.toISOString\s*\(/.test(statement)) return true;
  if (/\bDate\.now\s*\(\s*\)\s*(?:[<>]=?|[-])|(?:[<>]=?|[-])\s*\bDate\.now\s*\(\s*\)/.test(statement)) return true;
  if (/\bnew\s+Date\s*\([^)]*\)\s*(?:[<>]=?|[-])/.test(statement)) return true;
  if (ID_NAME.test(statement) || /[`][^`]*\$\{[^}]*\bDate\.now\s*\(/s.test(keyed)) return true;
  return false;
}

export function scanText(rel, text) {
  const findings = [];
  const seen = new Set();
  const add = (finding) => { const key = `${finding.rule}:${finding.line}`; if (!seen.has(key)) { seen.add(key); findings.push(finding); } };
  const lines = text.split(/\r?\n/);
  let block = false;
  // A statement that breaks after `=`, `:`, `(`, `??` or `||` carries its head into the next line's clock read, so
  // `const id =` over a clock on the line below still names its sink.
  let carry = { clock: "", keyed: "" };
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    let code = "", comments = "", quote = "", escaped = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i], next = raw[i + 1];
      if (block) {
        comments += c;
        if (c === "*" && next === "/") { comments += next; i++; block = false; }
      } else if (quote) {
        code += c;
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === quote) quote = "";
      } else if (c === '"' || c === "'" || c === "`") { quote = c; code += c; }
      else if ((c === "/" && next === "/") || (/\.(?:sh|py)$/.test(rel) && c === "#")) { comments += raw.slice(i); break; }
      else if (c === "/" && next === "*") { block = true; comments += "/*"; i++; }
      else code += c;
    }
    const finding = (rule) => ({ rule, file: rel, line: index + 1, text: raw.trim() });
    if (NARRATION.test(comments)) add(finding("narration"));
    if (/\.(?:sh|py)$/.test(rel)) { if (clockSink(code)) add(finding("clock")); continue; }
    const literals = code.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g) ?? [];
    const names = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "\"\"");
    if (/\bschemaVersion\b/.test(names) || /["']schemaVersion["']\s*:/.test(code) || /\[\s*["']schemaVersion["']\s*\]/.test(code) || /\b(?:version|[A-Za-z_$][\w$]*Version)\s*\??\s*:\s*(?:\d[\d_]*\b|number\b)/.test(names) || VERSION_CONST.test(names) || literals.some(literal => FORMAT.test(literal.slice(1, -1)))) add(finding("version"));
    const clockCode = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "\"\"");
    if (clockSink(`${carry.clock} ${clockCode}`, `${carry.keyed} ${code}`)) add(finding("clock"));
    carry = /(?:[=:(]|\?\?|\|\|)\s*$/.test(code) ? { clock: clockCode, keyed: code } : { clock: "", keyed: "" };
  }
  return findings.sort((a, b) => a.line - b.line || RULES.indexOf(a.rule) - RULES.indexOf(b.rule));
}

// Each exception allows exactly `count` findings (one unless it says more), so a new line that happens to carry the
// same substring reads open; an exception that allows fewer than it names is stale, like one that allows none.
export function classify(findings, exceptions) {
  const open = [], excepted = [], stale = [];
  const used = exceptions.map(() => 0);
  for (const finding of findings) {
    const i = exceptions.findIndex((e, n) => e.rule === finding.rule && e.file === finding.file && e.match && finding.text.includes(e.match)
      && e.reason?.trim() && used[n] < (e.count ?? 1));
    if (i >= 0) { used[i]++; excepted.push(finding); } else open.push(finding);
  }
  exceptions.forEach((e, n) => { if (used[n] !== (e.count ?? 1) || !e.reason?.trim() || !e.match) stale.push(e); });
  return { open, excepted, stale };
}
function eligible(rel) {
  return SOURCE.test(rel) && !/(?:^|\/)(?:dist|node_modules)\//.test(rel) && !WITNESS_FILES.has(rel) && (/^packages\/[^/]+\/src\//.test(rel) || /^tools\//.test(rel));
}
function walkFiles(root, dir = root) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules" || entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(root, path));
    else if (entry.isFile()) out.push(relative(root, path).replaceAll("\\", "/"));
  }
  return out;
}
function corpus(root, fixture) {
  return (fixture ? walkFiles(root) : execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean)).filter(eligible).sort();
}
function main(args) {
  let root = REPO, fixture = false, ceilings = CEILINGS, exceptions = EXCEPTIONS, list = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") { root = resolve(args[++i]); fixture = true; }
    else if (args[i] === "--ceilings") { ceilings = Object.fromEntries(args[++i].split(",").map(part => part.split("=").map((v, n) => n ? Number(v) : v))); }
    else if (args[i] === "--no-exceptions") exceptions = [];
    else if (args[i] === "--list") list = true;
    else throw new Error(`unknown argument: ${args[i]}`);
  }
  const files = corpus(root, fixture);
  const findings = files.flatMap(rel => scanText(rel, readFileSync(join(root, rel), "utf8")));
  const { open, excepted, stale } = classify(findings, exceptions);
  const count = (items, rule) => items.filter(f => f.rule === rule).length;
  console.log(`[evergreen-boundary] ${files.length} file(s) read · ${RULES.map(rule => `${rule} ${count(open, rule)}/${ceilings[rule]} · ${rule}-excepted ${count(excepted, rule)}`).join(" · ")}`);
  if (!files.length) { console.error("the corpus read nothing"); return 1; }
  if (stale.length) { for (const e of stale) console.error(`stale or invalid exception: ${e.rule} ${e.file} ${e.match}`); return 1; }
  const over = RULES.filter(rule => count(open, rule) > ceilings[rule]);
  if (list || over.length) for (const f of open) if (list || over.includes(f.rule)) console.log(`${f.rule.padEnd(9)} ${f.file}:${f.line}  ${f.text}`);
  if (over.length) return 1;
  const under = RULES.filter(rule => count(open, rule) < ceilings[rule]);
  if (under.length) console.log(`Lower CEILINGS in tools/evergreen-boundary.mjs: ${under.join(", ")}`);
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
