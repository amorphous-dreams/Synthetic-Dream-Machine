/**
 * The outline adapter ~ one door from source text to a file's top-level shape.
 *
 * TypeScript and JavaScript read through `typescript/unstable/sync`, the native compiler's JavaScript
 * API; this module holds the only import of it, so an API break reads red here and nowhere else.
 * Python reads through `python3 -I` and the stdlib `ast`.
 *
 * An outline answers: declarations with their 1-based inclusive line ranges and kinds, the exported
 * names, the import specifiers, the re-export specifiers, and the first sentence of the leading doc
 * comment. It never carries a body.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API } from "typescript/unstable/sync";
import { SyntaxKind } from "typescript/unstable/ast";

const DOC_CAP = 240;

/** Skip whitespace, comments and a shebang from `pos`; return the first significant offset. */
export function skipTrivia(text, pos) {
  let i = pos;
  if (i === 0 && text.startsWith("#!")) i = text.indexOf("\n") < 0 ? text.length : text.indexOf("\n");
  for (;;) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "﻿") i++;
    else if (c === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl;
    } else if (c === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close < 0 ? text.length : close + 2;
    } else return i;
  }
}

/** First sentence of a comment's prose, capped. */
export function firstSentence(prose) {
  const flat = prose.replace(/\s+/g, " ").trim();
  if (!flat || flat.startsWith("@")) return "";
  const m = /^(.*?[.!?])(?:\s|$)/.exec(flat);
  const s = (m ? m[1] : flat).trim();
  return s.length > DOC_CAP ? `${s.slice(0, DOC_CAP - 1)}…` : s;
}

/** The leading doc of a JS/TS file: the first block comment before the first statement, else its first line comments. */
export function leadingDoc(text, firstStart) {
  const head = text.slice(0, firstStart);
  const block = /\/\*\*?([\s\S]*?)\*\//.exec(head);
  if (block) {
    const prose = block[1].split("\n").map((l) => l.replace(/^\s*\*+ ?/, "")).join("\n");
    return firstSentence(prose);
  }
  const lines = [];
  for (const l of head.split("\n")) {
    const m = /^\s*\/\/+ ?(.*)$/.exec(l);
    if (m) lines.push(m[1]);
    else if (lines.length) break;
  }
  return firstSentence(lines.join("\n"));
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineAt(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function bindingNames(name, out) {
  if (!name) return;
  if (typeof name.text === "string") out.push(name.text);
  else for (const e of name.elements ?? []) bindingNames(e.name, out);
}

const DYNAMIC_RE = /\b(?:import|require)\(\s*(["'])([^"'\n]+)\1\s*\)/g;

/** Outline one parsed TS/JS source file. */
function outlineSource(sf) {
  const text = sf.text;
  const starts = lineStarts(text);
  const decls = [];
  const exportNames = new Set();
  const imports = new Set();
  const reexports = [];
  let firstStart = text.length;
  const mods = (s) => new Set((s.modifiers ?? []).map((m) => m.kind));
  const row = (s, kind, name, m) => {
    const start = skipTrivia(text, s.pos);
    firstStart = Math.min(firstStart, start);
    const prefix = `${m.has(SyntaxKind.ExportKeyword) ? "export " : ""}${m.has(SyntaxKind.DefaultKeyword) ? "default " : ""}${m.has(SyntaxKind.AsyncKeyword) ? "async " : ""}`;
    decls.push({ kind: `${prefix}${kind}`, name, start: lineAt(starts, start), end: lineAt(starts, Math.max(start, s.end - 1)) });
    if (m.has(SyntaxKind.ExportKeyword)) exportNames.add(m.has(SyntaxKind.DefaultKeyword) ? "default" : name);
  };
  for (const s of sf.statements) {
    const k = s.kind;
    const m = mods(s);
    if (k === SyntaxKind.ImportDeclaration) {
      firstStart = Math.min(firstStart, skipTrivia(text, s.pos));
      if (s.moduleSpecifier?.text !== undefined) imports.add(s.moduleSpecifier.text);
    } else if (k === SyntaxKind.ImportEqualsDeclaration) {
      firstStart = Math.min(firstStart, skipTrivia(text, s.pos));
      const spec = s.moduleReference?.expression?.text;
      if (spec !== undefined) imports.add(spec);
    } else if (k === SyntaxKind.ExportDeclaration) {
      const start = skipTrivia(text, s.pos);
      firstStart = Math.min(firstStart, start);
      const spec = s.moduleSpecifier?.text;
      const clause = s.exportClause;
      let label;
      if (!clause) {
        label = `* from ${spec}`;
        exportNames.add("*");
      } else if (clause.elements) {
        const names = clause.elements.map((e) => e.name.text);
        for (const n of names) exportNames.add(n);
        label = `{ ${names.join(", ")} }${spec === undefined ? "" : ` from ${spec}`}`;
      } else {
        exportNames.add(clause.name.text);
        label = `* as ${clause.name.text} from ${spec}`;
      }
      if (spec !== undefined) {
        imports.add(spec);
        reexports.push(spec);
      }
      decls.push({ kind: spec === undefined ? "export" : "re-export", name: label, start: lineAt(starts, start), end: lineAt(starts, Math.max(start, s.end - 1)) });
    } else if (k === SyntaxKind.ExportAssignment) {
      const start = skipTrivia(text, s.pos);
      firstStart = Math.min(firstStart, start);
      exportNames.add("default");
      decls.push({ kind: "export default", name: "default", start: lineAt(starts, start), end: lineAt(starts, Math.max(start, s.end - 1)) });
    } else if (k === SyntaxKind.FunctionDeclaration) row(s, "function", s.name?.text ?? "default", m);
    else if (k === SyntaxKind.ClassDeclaration) row(s, "class", s.name?.text ?? "default", m);
    else if (k === SyntaxKind.InterfaceDeclaration) row(s, "interface", s.name.text, m);
    else if (k === SyntaxKind.TypeAliasDeclaration) row(s, "type", s.name.text, m);
    else if (k === SyntaxKind.EnumDeclaration) row(s, "enum", s.name.text, m);
    else if (k === SyntaxKind.ModuleDeclaration) row(s, "namespace", s.name?.text ?? "?", m);
    else if (k === SyntaxKind.VariableStatement) {
      const start = skipTrivia(text, s.pos);
      const kw = /\b(const|let|var|using)\b/.exec(text.slice(start, s.end))?.[1] ?? "var";
      const names = [];
      for (const d of s.declarationList.declarations) bindingNames(d.name, names);
      for (const n of names.length ? names : ["(pattern)"]) row(s, kw, n, m);
    } else firstStart = Math.min(firstStart, skipTrivia(text, s.pos));
  }
  for (const re of text.matchAll(DYNAMIC_RE)) imports.add(re[2]);
  return {
    decls,
    exports: [...exportNames],
    imports: [...imports],
    reexports,
    doc: leadingDoc(text, firstStart),
  };
}

const JS_EXT = /\.(?:d\.ts|tsx|ts|mjs|cjs|js)$/;

/**
 * Outline TS/JS sources. `files` carries `{ path, text }`; the result maps path to outline. The sources
 * rest in a scratch folder for the compiler to open, and the folder goes away on return.
 */
export function outlineScripts(files) {
  const out = new Map();
  if (!files.length) return out;
  const dir = mkdtempSync(join(tmpdir(), "codemap-ts-"));
  let api;
  try {
    mkdirSync(join(dir, "f"));
    const names = files.map((f, i) => `f/${i}${JS_EXT.exec(f.path)?.[0] ?? ".ts"}`);
    files.forEach((f, i) => writeFileSync(join(dir, names[i]), f.text));
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { allowJs: true, noResolve: true, noLib: true, types: [], skipLibCheck: true, target: "esnext", module: "esnext", jsx: "preserve" },
        files: names,
      }),
    );
    api = new API({ cwd: dir });
    const snap = api.updateSnapshot({ openProject: join(dir, "tsconfig.json") });
    const program = snap.getProjects()[0].program;
    files.forEach((f, i) => {
      const sf = program.getSourceFile(join(dir, names[i]));
      out.set(f.path, sf ? outlineSource(sf) : { decls: [], exports: [], imports: [], reexports: [], doc: "", unparsed: true });
    });
  } finally {
    api?.close();
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

const PY_SCRIPT = String.raw`
import ast, json, sys
stdlib = getattr(sys, "stdlib_module_names", frozenset())
def first_sentence(doc):
    flat = " ".join((doc or "").split())
    if not flat or flat.startswith("@"):
        return ""
    for i, ch in enumerate(flat):
        if ch in ".!?" and (i + 1 == len(flat) or flat[i + 1] == " "):
            return flat[: i + 1][:240]
    return flat[:240]
out = {}
for item in json.load(sys.stdin):
    try:
        tree = ast.parse(item["text"])
    except SyntaxError:
        out[item["path"]] = {"decls": [], "exports": [], "imports": [], "reexports": [], "doc": "", "unparsed": True}
        continue
    decls, exports, imports = [], [], []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start = min([node.lineno] + [d.lineno for d in node.decorator_list])
            kind = "class" if isinstance(node, ast.ClassDef) else ("async def" if isinstance(node, ast.AsyncFunctionDef) else "def")
            decls.append({"kind": kind, "name": node.name, "start": start, "end": node.end_lineno})
            if not node.name.startswith("_"):
                exports.append(node.name)
        elif isinstance(node, ast.Import):
            for a in node.names:
                imports.append({"module": a.name, "level": 0, "names": [], "stdlib": a.name.split(".")[0] in stdlib})
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            imports.append({"module": mod, "level": node.level, "names": [a.name for a in node.names], "stdlib": node.level == 0 and mod.split(".")[0] in stdlib})
    out[item["path"]] = {"decls": decls, "exports": exports, "imports": imports, "reexports": [], "doc": first_sentence(ast.get_docstring(tree))}
json.dump(out, sys.stdout)
`;

/** Outline Python sources through the stdlib `ast`; `files` carries `{ path, text }`. */
export function outlinePython(files) {
  const out = new Map();
  if (!files.length) return out;
  const raw = execFileSync("python3", ["-I", "-c", PY_SCRIPT], {
    input: JSON.stringify(files.map((f) => ({ path: f.path, text: f.text }))),
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  for (const [p, o] of Object.entries(JSON.parse(raw))) out.set(p, o);
  return out;
}
