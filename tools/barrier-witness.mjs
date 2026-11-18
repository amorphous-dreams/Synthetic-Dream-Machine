// barrier-witness — the boundary half of the silent-zero law (lar:///ha.ka.ba/lares/api/pono/working-procedures,
// section "an absence names its far-side barrier"). An instrument that asserts ACROSS a boundary (process, thread
// or worker, storage, network) must name the causal event it waits for on the far side. An absence assertion
// (nothing happened, the state holds, a count stays zero) with no far-side barrier before it counts as no check.
//
// SCOPE: the e2e test files, `packages/*/tests/e2e/**` and `tests/e2e/**`.
//
// ABSENCE ASSERTIONS (per test body; a line reader, not a syntax tree, so false green is the tolerable side):
//   not     `expect(...).not.<matcher>`
//   holds   `toEqual` / `toStrictEqual` / `toBe` where the test's own name says the value stands unchanged
//           ("holds", "stands", "unchanged", "never", "no act", "raises no")
//   zero    `toBe(0)` / `toEqual(0)` / `toHaveLength(0)` on a subject that is not an exit code or status
//
// A BARRIER sits after the test's last act (click, fill, press, send, spawn, kill, ...) and before the assertion:
//   marker    `// barrier: <the far-side event it waits for>`   (a bare marker, or one naming nothing, reads red)
//   sentinel  an awaited call that names a sentinel, as callee or argument (a sentinel act's answer)
//   poll      an awaited `expect.poll` / `waitForFunction` that reads the SAME thing the assertion reads (shares a
//             name with its subject) or names an answer word (sentinel, ack, settled, rested, drained, quiesced,
//             disconnect). A poll on a near-shore event (a tab opened) bars nothing about a far shore's silence.
//
// NAMED ALLOWANCES carry { file, test, reason, owner }: the owner row names the lane or row whose landing kills the
// allowance. A bare allowance (no reason, no owner) reads red; one that matches no open finding is STALE and reads red.
//
// A COUNTED BACKLOG against a ceiling that only comes down (the `evergreen-boundary` shape). Over the ceiling fails and
// names every open finding; under it passes and asks for the ceiling to come down; a corpus that reads no file fails.
//
// Usage: node tools/barrier-witness.mjs [--list] [--root <dir> --ceiling N --no-allowances]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Today's measured open backlog on the span. RATCHET: it may only ever come DOWN. */
export const CEILING = 0;
export const ALLOWANCES = [];

const REPO = fileURLToPath(new URL("../", import.meta.url));
const TEST_LINE = /^\s*(?:test|it)(?:\.\w+)?\(\s*(["'`])(.*?)\1/;
const BODY_END = /^\s*(?:beforeAll|afterAll|beforeEach|afterEach|describe)\b/;
const ACT = /\.(?:click|dblclick|fill|press|type|tap|dispatchEvent|goto|reload|send|kill)\(|\bspawn(?:Sync)?\(/;
const HOLDS_NAME = /\b(?:holds?|stands?|unchanged|never|no act|raises no)\b/i;
const MARKER = /\/\/\s*barrier:(.*)$/;
const ANSWER_WORD = /sentinel|\back\b|settled|rested|drained|quiesc|disconnect/i;
const SENTINEL_CALL = /\bawait\b[^\n]*sentinel/i;
const IGNORED = new Set(["await", "expect", "length", "undefined", "null", "true", "false", "JSON", "stringify", "Array", "from", "map", "filter", "const", "return", "async", "await", "typeof", "this", "new"]);

function subjectOf(line) {
  const start = line.search(/\bexpect\(/);
  if (start < 0) return null;
  let depth = 0, i = line.indexOf("(", start);
  const from = i;
  for (; i < line.length; i++) {
    if (line[i] === "(") depth++;
    else if (line[i] === ")" && --depth === 0) break;
  }
  return { subject: line.slice(from + 1, i), rest: line.slice(i + 1) };
}
const names = (text) => new Set((text.match(/[A-Za-z_$][\w$]*/g) ?? []).filter(w => w.length >= 3 && !IGNORED.has(w)));

function markerNamesAnEvent(text) {
  const words = text.trim().replace(/[.;]+$/, "").split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.some(w => /^[A-Za-z][\w-]{3,}$/.test(w)) && !/^(?:none|todo|tbd|later|n\/a|wait|here)$/i.test(words.join(" "));
}

function statementAt(lines, i) {
  let text = lines[i];
  for (let k = i + 1; k < lines.length && k < i + 8 && !/;\s*(?:\/\/.*)?$/.test(text); k++) text += "\n" + lines[k];
  return text;
}

function absenceKind(line, testName) {
  const sub = subjectOf(line);
  if (!sub || /\bexpect\.poll\(/.test(line)) return null;
  if (/\b(?:code|status|exitCode|exit)\b/.test(sub.subject)) return null; // a process that already exited answered whole
  if (/^\s*\.not\./.test(sub.rest)) {
    // A presence check (not null, not empty) and an inequality between two computed values read a thing that stands; only a literal refusal names an absence.
    if (/^\s*\.not\.(?:toBeNull|toBeUndefined|toBeDefined|toBeTruthy|toBeFalsy)/.test(sub.rest)) return null;
    const eq = /^\s*\.not\.(?:toBe|toEqual|toStrictEqual)\(\s*(.)/.exec(sub.rest);
    if (eq && !/["'`\d\[{]/.test(eq[1])) return null;
    if (eq && /^\s*\.not\.\w+\(\s*(?:""|'')/.test(sub.rest)) return null;
    return "not";
  }
  if (/^\s*\.(?:toBe|toEqual)\(\s*0\s*\)/.test(sub.rest) || /^\s*\.toHaveLength\(\s*0\s*\)/.test(sub.rest)) {
    return "zero";
  }
  if (HOLDS_NAME.test(testName) && /^\s*\.(?:toEqual|toStrictEqual|toBe)\(\s*(?!true\b|false\b)/.test(sub.rest)) return "holds";
  return null;
}

function lastActBefore(body, lines, j) {
  let last = -1;
  for (const i of body) if (i < j && ACT.test(lines[i].replace(/\/\/.*$/, ""))) last = i;
  return last;
}

export function scanText(rel, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let t = 0; t < lines.length; t++) {
    const head = TEST_LINE.exec(lines[t]);
    if (!head) continue;
    const name = head[2];
    let end = t + 1;
    while (end < lines.length && !TEST_LINE.test(lines[end]) && !BODY_END.test(lines[end])) end++;
    const body = [];
    for (let i = t + 1; i < end; i++) body.push(i);
    const barriers = []; // { line, ok, shares }
    let lastAct = t;
    for (const i of body) {
      const raw = lines[i];
      const marker = MARKER.exec(raw);
      if (marker) {
        if (markerNamesAnEvent(marker[1])) barriers.push({ line: i, kind: "marker" });
        else findings.push({ rel, line: i + 1, test: name, rule: "bare-marker", text: raw.trim() });
        continue;
      }
      const code = raw.replace(/\/\/.*$/, "");
      if (ACT.test(code)) lastAct = i;
      if (SENTINEL_CALL.test(code)) barriers.push({ line: i, kind: "sentinel" });
      else if (/\bawait\b[^;]*\b(?:expect\.poll|waitForFunction)\(|\bawait\s+expect\.poll\(/.test(code) || /\b(?:expect\.poll|waitForFunction)\(/.test(code) && /\bawait\b/.test(code)) {
        barriers.push({ line: i, kind: "poll", read: names(statementAt(lines, i)), answer: ANSWER_WORD.test(statementAt(lines, i)) });
      }
    }
    for (const j of body) {
      const code = lines[j].replace(/\/\/.*$/, "");
      const kind = absenceKind(code, name);
      if (!kind || lastActBefore(body, lines, j) < 0) continue; // no act before it: nothing crossed a boundary yet
      const subjectNames = names(subjectOf(code).subject);
      const barred = barriers.some(b => b.line > lastAct && b.line < j && (b.kind !== "poll" || b.answer || [...subjectNames].some(n => b.read.has(n))));
      if (!barred) findings.push({ rel, line: j + 1, test: name, rule: kind, text: lines[j].trim() });
    }
  }
  return findings;
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === "dist") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(?:ts|mts|js|mjs)$/.test(e)) out.push(p);
  }
  return out;
}
function corpus(root) {
  const roots = [join(root, "tests/e2e")];
  try { for (const pkg of readdirSync(join(root, "packages"))) roots.push(join(root, "packages", pkg, "tests/e2e")); } catch { /* none */ }
  return roots.flatMap(r => walk(r)).sort();
}

export function classify(findings, allowances) {
  const used = new Set();
  const invalid = allowances.filter(a => !a.file || !a.test || !String(a.reason ?? "").trim() || !String(a.owner ?? "").trim());
  const open = [], allowed = [];
  for (const f of findings) {
    const idx = allowances.findIndex(a => !invalid.includes(a) && a.file === f.rel && f.test.includes(a.test));
    if (idx >= 0) { used.add(idx); allowed.push(f); } else open.push(f);
  }
  const stale = allowances.filter((a, i) => !invalid.includes(a) && !used.has(i));
  return { open, allowed, stale, invalid };
}

function main(argv) {
  const opt = (flag) => argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined;
  const root = resolve(opt("--root") ?? REPO);
  const ceiling = opt("--ceiling") !== undefined ? Number(opt("--ceiling")) : CEILING;
  const allowances = argv.includes("--no-allowances") ? [] : ALLOWANCES;
  const list = argv.includes("--list");
  const files = corpus(root);
  const findings = files.flatMap(f => scanText(relative(root, f), readFileSync(f, "utf8")));
  const { open, allowed, stale, invalid } = classify(findings, allowances);
  const bare = open.filter(f => f.rule === "bare-marker");
  const counted = open.filter(f => f.rule !== "bare-marker");
  console.log(`[barrier-witness] ${files.length} file(s) read · backlog ${counted.length}/${ceiling} · allowed ${allowed.length} · bare markers ${bare.length}`);
  if (!files.length) { console.error("the corpus read nothing"); return 1; }
  if (invalid.length) { for (const a of invalid) console.error(`bare allowance (needs file, test, reason and owner): ${JSON.stringify(a)}`); return 1; }
  if (stale.length) { for (const a of stale) console.error(`stale allowance: ${a.file} ${a.test} (owner ${a.owner})`); return 1; }
  const show = (fs) => { for (const f of fs) console.log(`${f.rule.padEnd(11)} ${f.rel}:${f.line}  [${f.test.slice(0, 60)}]  ${f.text}`); };
  if (bare.length) { show(bare); return 1; }
  if (list || counted.length > ceiling) show(counted);
  if (counted.length > ceiling) return 1;
  if (counted.length < ceiling) console.log(`Lower CEILING in tools/barrier-witness.mjs: ${counted.length}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
