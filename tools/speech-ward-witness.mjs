#!/usr/bin/env node
// speech-ward-witness — the L-Prime ward over the speech the system emits, held as a per-package ratchet.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
// The operator's ruling (2026-11-23): the L-Prime ward covers all speech the system produces; drift gets caught,
// acknowledged and fixed pono, under the Snafu law. Every seat's CLI and MCP output speaks as a Lar
// (lar:///ha.ka.ba/lares/api/voices#/seat-lares), so a refusal, a hand act, a usage line or an MCP tool description
// falls under the ward the same as a turn the node writes (lar:///ha.ka.ba/lares/api/mu/l-prime#/system-speech).
// The standing drift burns down by a ratchet, never a big-bang rewrite: each package's count stands as a CEILING that
// only lowers, so a new copula reads red, gets named in its PR, and gets cured, never silently added.
//
// ── WHAT SPEAKS (collected mechanically, never listed) ──────────────────────────────────────────
// Under packages/<pkg>/src (and scripts/ for Python), tests and fixtures excluded:
//   TS  · the string arguments of `new <Name>(…)` where the name ends Error / Refused / Refusal / Unavailable, of
//         `super(…)`, of console.log/error/warn/info and stdout/stderr.write, of the house's speech calls (refuse,
//         refused, fail, say, fault, onLog, helpLines) and of `lines/out/help/usage.push(…)`; the string values of the
//         object keys description, usage, summary, help, hint, message, cure, detail, reason, error; and every constant
//         whose name carries HAND_ACT, USAGE, HELP, REFUS, MESSAGE, HINT or CURE. A template literal speaks its text
//         with each `${…}` read as `‹›`; the strings inside a substitution speak on their own.
//   Py  · the docstring of every `@mcp.tool` function (the MCP tool description), the string arguments of `raise`
//         and `print`, and the string values of the dict keys error, message, hint, reason and cure.
// Comments never speak; a string held in code (a key, a path, a regex) never speaks.
//
// ── WHAT COUNTS (the English instrument of the transposition law) ───────────────────────────────
// Every form of the forbidden copula, contractions included (the ward's token-count, l-prime#/ward-slide). The
// pattern integrities clear the ward (noosphere-boot#/l-prime) and count nothing:
//   · a quoted span ("…", '…', “…”, ‘…’) carries its copulas under license: tallied apart as ⌜N⌝, never a breach;
//   · a code span (`…`) and an identifier (`--x-flag`, `snake_case`, `a.b`, `k=v`) hold form, not speech;
//   · a reference-table row (a line opening on `|`) holds invariant form;
//   · the namely-joint appositive (`X - Y`) carries no copula, so it never meets the count.
// A form the auditor's pre-pass demotes to likely-auxiliary (a next token ending -ing or -ed: a progressive or a
// passive, tense rather than identity) rides its own tally, shown and never ceilinged.
//
// Usage: tools/speech-ward-witness.mjs [--list] [--write-baseline] [--root <dir>] [--baseline <file>]
//   --list            print every breach line (file:line and the spans), not only the counts
//   --write-baseline  rewrite the baseline to this walk's counts (lowering only; a rise refuses)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── the count ──────────────────────────────────────────────────────────────────────────────────
// A reference table of the forms the ward gates (a pattern integrity: it names the forms, never predicates).
const FORMS = ["is", "are", "was", "were", "am", "be", "been", "being", "isn't", "aren't", "wasn't", "weren't",
  "it's", "that's", "there's", "here's", "what's", "who's", "he's", "she's", "they're", "we're", "you're", "i'm"];
const FORM_RE = new RegExp(`(?<![\\w\\-./$=:@#'’])(${FORMS.map((f) => f.replace("'", "['’]")).join("|")})(?![\\w\\-/_=(]|\\.\\w|['’]\\w)`, "gi");
const QUOTE_RE = /"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|(?<=^|[\s(\[{:,=])'[^'\n]*'(?=$|[\s.,;:!?)\]}])/g;

// The auditor's own demotion (lar:///ha.ka.ba/lares/api/mu/l-prime/SKILL#/loop): a form whose next one or two tokens
// end in -ing or -ed reads as a likely auxiliary (a progressive or a passive: tense, not identity). It rides its own
// tally, outside the ceiling. A few common words carry the ending without the participle.
const NOT_PARTICIPLE = new Set(["nothing", "something", "anything", "everything", "string", "during", "morning", "hundred", "sacred", "kindred"]);
const auxiliary = (after) => after.trim().split(/\s+/).slice(0, 2)
  .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
  .some((w) => w.length >= 5 && /(ing|ed)$/.test(w) && !NOT_PARTICIPLE.has(w));

/** The ward's read of one spoken text: breaches (identity/predication the text asserts), the quote tally, and the
 *  likely-auxiliary tally. */
export function wardCount(text) {
  let breaches = 0, quoted = 0, aux = 0;
  const spans = [];
  for (const line of text.split("\n")) {
    if (/^\s*\|/.test(line)) continue; // a reference-table row
    let rest = line.replace(/`[^`]*`/g, " ‹code› ");
    rest = rest.replace(QUOTE_RE, (q) => { quoted += (q.match(FORM_RE) ?? []).length; return " ‹quote› "; });
    for (const m of rest.matchAll(FORM_RE)) {
      if (auxiliary(rest.slice(m.index + m[0].length))) { aux++; continue; }
      breaches++; spans.push(m[1]);
    }
  }
  return { breaches, quoted, aux, spans };
}

// ── the TS collector (a small lexer: strings, templates, comments, regex literals, punctuation) ──
function lex(src) {
  const toks = [];
  let i = 0, line = 1;
  const prevSig = () => toks[toks.length - 1];
  const regexOk = () => {
    const p = prevSig();
    if (!p) return true;
    if (p.k === "p") return /^[(,=:\[!&|?{};+\-*%<>~^]$/.test(p.v);
    return p.k === "w" && /^(return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/.test(p.v);
  };
  function template() { // at the opening backtick; returns a str token, pushing substitution tokens after it
    const start = line; let text = ""; const subs = [];
    i++;
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") { text += src[i + 1] === "`" ? "`" : src[i + 1] === "n" ? "\n" : src[i + 1]; i += 2; continue; }
      if (src[i] === "$" && src[i + 1] === "{") {
        i += 2; text += "‹›";
        const save = toks.length; let depth = 1;
        while (i < src.length) {
          const t = next();
          if (!t) break;
          if (t.k === "p" && t.v === "{") depth++;
          else if (t.k === "p" && t.v === "}" && --depth === 0) break;
        }
        const inner = toks.splice(save);
        if (inner.at(-1)?.k === "p" && inner.at(-1)?.v === "}") inner.pop();
        subs.push(...inner);
        continue;
      }
      if (src[i] === "\n") line++;
      text += src[i++];
    }
    i++;
    return { tok: { k: "s", v: text, line: start }, subs };
  }
  function next() {
    while (i < src.length) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? src.length : e + 2; line += (src.slice(i, end).match(/\n/g) ?? []).length; i = end; continue; }
      if (c === "/" && regexOk()) {
        i++; let cls = false;
        while (i < src.length && src[i] !== "\n") {
          if (src[i] === "\\") { i += 2; continue; }
          if (src[i] === "[") cls = true; else if (src[i] === "]") cls = false; else if (src[i] === "/" && !cls) break;
          i++;
        }
        i++; while (/[a-z]/i.test(src[i] ?? "")) i++;
        const t = { k: "r", v: "", line }; toks.push(t); return t;
      }
      if (c === '"' || c === "'") {
        const start = line; let text = ""; i++;
        while (i < src.length && src[i] !== c && src[i] !== "\n") {
          if (src[i] === "\\") { const n = src[i + 1]; text += n === "n" ? "\n" : n === "u" ? "\\u" : n; i += 2; continue; }
          text += src[i++];
        }
        i++;
        const t = { k: "s", v: text, line: start }; toks.push(t); return t;
      }
      if (c === "`") {
        const { tok, subs } = template();
        toks.push(tok, ...subs.map((s) => ({ ...s, sub: true })));
        return tok;
      }
      if (/[A-Za-z_$]/.test(c)) { let w = ""; while (/[\w$]/.test(src[i] ?? "")) w += src[i++]; const t = { k: "w", v: w, line }; toks.push(t); return t; }
      if (/[0-9]/.test(c)) { while (/[\w.]/.test(src[i] ?? "")) i++; const t = { k: "n", v: "0", line }; toks.push(t); return t; }
      const t = { k: "p", v: c, line }; i++; toks.push(t); return t;
    }
    return null;
  }
  while (next());
  return toks;
}

const SPEECH_CALLS = new Set(["refuse", "refused", "fail", "say", "fault", "onLog", "helpLines", "super"]);
const CONSOLE = new Set(["log", "error", "warn", "info"]);
const PUSHERS = new Set(["lines", "out", "help", "usage"]);
const SPEECH_KEYS = new Set(["description", "usage", "summary", "help", "hint", "message", "cure", "detail", "reason", "error"]);
const SPEECH_CONST = /HAND_ACT|USAGE|HELP|REFUS|MESSAGE|HINT|CURE/;
const SPEECH_NEW = /(Error|Refused|Refusal|Unavailable)$/;

/** Every spoken text in a TS source: [{ line, text }], in source order. */
export function speechOfTs(src) {
  const toks = lex(src);
  const out = [];
  const taken = new Set();
  const take = (from, stop) => { // collect string tokens from index `from` until `stop` says the expression ended
    let depth = 0;
    for (let j = from; j < toks.length; j++) {
      const t = toks[j];
      if (t.k === "p" && /[([{]/.test(t.v)) depth++;
      if (t.k === "p" && /[)\]}]/.test(t.v)) { depth--; if (depth < 0) return; }
      if (stop(t, depth)) return;
      // An element-access key (`a["k"]`) names a field, never speech.
      const keyed = toks[j - 1]?.v === "[" && toks[j + 1]?.v === "]";
      if (t.k === "s" && !keyed && !taken.has(t)) { taken.add(t); out.push({ line: t.line, text: t.v }); }
    }
  };
  const args = (open) => take(open + 1, () => false);
  const value = (from) => take(from, (t, d) => d === 0 && t.k === "p" && /[,;]/.test(t.v));
  for (let j = 0; j < toks.length; j++) {
    const t = toks[j], n = toks[j + 1], p = toks[j - 1];
    if (t.k !== "w") continue;
    const opens = n?.k === "p" && n.v === "(";
    const member = p?.k === "p" && p.v === ".";
    const recv = member ? toks[j - 2] : undefined;
    if (opens && toks[j - 1]?.v === "new" && SPEECH_NEW.test(t.v)) { args(j + 1); continue; }
    if (opens && member && recv?.v === "console" && CONSOLE.has(t.v)) { args(j + 1); continue; }
    if (opens && member && t.v === "write" && (recv?.v === "stdout" || recv?.v === "stderr")) { args(j + 1); continue; }
    if (opens && member && t.v === "push" && PUSHERS.has(recv?.v)) { args(j + 1); continue; }
    if (opens && SPEECH_CALLS.has(t.v)) { args(j + 1); continue; }
    if (n?.k === "p" && n.v === ":" && SPEECH_KEYS.has(t.v) && p?.k === "p" && /[{,]/.test(p.v)) { value(j + 2); continue; }
    if (n?.k === "p" && n.v === "=" && toks[j + 2]?.v !== "=" && SPEECH_CONST.test(t.v) && /^(const|let)$/.test(p?.v ?? "")) { value(j + 2); continue; }
    if (n?.k === "p" && n.v === ":" && SPEECH_CONST.test(t.v) && /^(const|let)$/.test(p?.v ?? "")) {
      // `const X: T = "…"` — skip the type to the `=`
      let k = j + 2; while (k < toks.length && !(toks[k].k === "p" && /[=;]/.test(toks[k].v))) k++;
      if (toks[k]?.v === "=") value(k + 1);
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

// ── the Python collector (the standard `ast`, through python3) ──────────────────────────────────
const PY = String.raw`
import ast, json, sys
src = sys.stdin.read()
out = []
def text(n):
    if isinstance(n, ast.Constant) and isinstance(n.value, str): return n.value
    if isinstance(n, ast.JoinedStr):
        return "".join(v.value if isinstance(v, ast.Constant) else "‹›" for v in n.values)
    return None
def speak(n):
    stack = [n]
    while stack:
        s = stack.pop(0)
        t = text(s)
        if t is not None:
            out.append({"line": s.lineno, "text": t}); continue
        stack.extend(ast.iter_child_nodes(s))
KEYS = {"error", "message", "hint", "reason", "cure"}
for node in ast.walk(ast.parse(src)):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        if any("mcp.tool" in ast.unparse(d) for d in node.decorator_list):
            doc = ast.get_docstring(node, clean=False)
            if doc: out.append({"line": node.body[0].lineno, "text": doc})
    elif isinstance(node, ast.Raise) and node.exc is not None:
        if isinstance(node.exc, ast.Call):
            for a in node.exc.args: speak(a)
    elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
        for a in node.args: speak(a)
    elif isinstance(node, ast.Dict):
        for k, v in zip(node.keys, node.values):
            if isinstance(k, ast.Constant) and k.value in KEYS and v is not None: speak(v)
out.sort(key=lambda o: o["line"])
print(json.dumps(out))
`;

/** Every spoken text in a Python source: [{ line, text }], in source order. */
export function speechOfPy(src) {
  const r = spawnSync("python3", ["-c", PY], { input: src, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`speech-ward-witness: python3 could not read a source (${r.stderr.trim().split("\n").pop()})`);
  return JSON.parse(r.stdout);
}

// ── the walk ───────────────────────────────────────────────────────────────────────────────────
const SKIP_DIR = /^(node_modules|dist|tests?|__tests__|fixtures|__pycache__|\..*)$/;
function sources(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return SKIP_DIR.test(n) ? [] : sources(p);
    if (/\.(test|spec)\.|\.d\.ts$|^test_|^conftest\.py$/.test(n)) return [];
    return /\.tsx?$|\.py$/.test(n) ? [p] : [];
  });
}

/** The walk: per package, its breaches (each with file, line, spans) and its quote tally. */
export function walkTree(root) {
  const pkgs = {};
  const dir = join(root, "packages");
  if (!existsSync(dir)) return pkgs;
  for (const pkg of readdirSync(dir).sort()) {
    const base = join(dir, pkg);
    if (!statSync(base).isDirectory()) continue;
    const files = [...sources(join(base, "src")), ...sources(join(base, "scripts")).filter((f) => f.endsWith(".py"))];
    if (files.length === 0) continue;
    const row = { breaches: 0, quoted: 0, aux: 0, lines: [] };
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const spoken = file.endsWith(".py") ? speechOfPy(src) : speechOfTs(src);
      for (const s of spoken) {
        const w = wardCount(s.text);
        row.quoted += w.quoted; row.aux += w.aux;
        if (w.breaches > 0) { row.breaches += w.breaches; row.lines.push({ at: `${relative(root, file)}:${s.line}`, spans: w.spans, text: s.text }); }
      }
    }
    pkgs[pkg] = row;
  }
  return pkgs;
}

function main(argv) {
  let list = false, write = false, root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), baseline = null;
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === "--list") list = true;
    else if (a === "--write-baseline") write = true;
    else if (a === "--root") root = resolve(argv[++k]);
    else if (a === "--baseline") baseline = resolve(argv[++k]);
    else { console.error(`speech-ward-witness: unknown argument ${a}`); return 2; }
  }
  baseline ??= join(root, "tools/speech-ward-baseline.json");
  let ceilings = {};
  try { ceilings = JSON.parse(readFileSync(baseline, "utf8")).ceilings ?? {}; } catch { /* absent: every ceiling reads zero */ }
  const pkgs = walkTree(root);
  const names = Object.keys(pkgs);
  if (names.length === 0) {
    console.log("speech-ward-witness: no package source under packages/*/src — nothing was walked, so nothing reads clean.");
    return 1;
  }
  let status = 0;
  for (const name of names) {
    const { breaches, quoted, aux, lines } = pkgs[name];
    const ceiling = Number.isSafeInteger(ceilings[name]) ? ceilings[name] : 0;
    const tally = (quoted > 0 ? ` · ⌜${quoted}⌝ quoted` : "") + (aux > 0 ? ` · ${aux} auxiliary` : "");
    if (breaches > ceiling) { console.log(`  ${name.padEnd(26)} ${breaches} copula(s), ceiling ${ceiling}: NEW DRIFT${tally}`); status = 1; }
    else if (breaches < ceiling) console.log(`  ${name.padEnd(26)} ${breaches} copula(s), ceiling ${ceiling}: lower the ceiling (--write-baseline)${tally}`);
    else if (breaches === 0) console.log(`  ${name.padEnd(26)} ok${tally}`);
    else console.log(`  ${name.padEnd(26)} ${breaches} copula(s), at its ceiling${tally}`);
    if (list || (breaches > ceiling && breaches - ceiling <= 40)) {
      for (const l of lines) console.log(`      ${l.at}  [${l.spans.join(" ")}]  ${l.text.split("\n")[0].slice(0, 140)}`);
    }
  }
  if (write) {
    if (status !== 0 && existsSync(baseline)) { console.log("speech-ward-witness: a ceiling would rise; the baseline only lowers. Cure the new drift first."); return 1; }
    const out = { "//": "Per-package ceilings of copulas in the speech the system emits (tools/speech-ward-witness.mjs; lar:///ha.ka.ba/lares/api/mu/l-prime#/system-speech). A ceiling only lowers; the end state reads every ceiling 0.", ceilings: {} };
    for (const name of names) if (pkgs[name].breaches > 0) out.ceilings[name] = pkgs[name].breaches;
    writeFileSync(baseline, JSON.stringify(out, null, 2) + "\n");
    console.log(`speech-ward-witness: baseline written (${relative(root, baseline)})`);
    status = 0;
  }
  if (status === 0) console.log(`speech-ward-witness: no package rose above its ceiling (${names.length} package(s) walked)`);
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
