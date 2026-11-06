// page-entry-witness — the page reaches no vessel module (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices,
// slice 0). The page holds the DOM, the projection sink, the mirror, the ask forms and Worker construction alone; the
// vessel (the Repo, custody, identity, the ward's rows, the seed wrap) runs on the vessel worker's own thread. This instrument walks
// the page entry's import graph and names every vessel module the page's main thread still loads.
//
// THE WALK, from `packages/lararium-web/src/main.ts`:
//   static     `import … from "x"`, `export … from "x"`, `import "x"`: reached. `import type` / `export type`: erased, NOT reached.
//   dynamic    `import("x")` with a literal specifier: reached (a main-thread load, only later). `import("x").Name` in a
//              type position erases, NOT reached.
//   worker     a specifier whose query names `worker`, `sharedworker` or `url` (`./w.ts?worker&url`): NOT reached. The page
//              only builds a Worker from the URL; the module runs on that worker's own thread.
//   workspace  a `@lararium/*` (or any workspace) package name resolves to its `src/` entry by the package's `exports`
//              (`./dist/x.js` and `./dist/src/x.js` both read `src/x.ts`).
//   external   a package outside the workspace counts as reached by name and is not walked.
//
// THE VESSEL MODULES the page must never reach (FORBIDDEN): `@automerge/automerge-repo` (the name or a subpath),
// `@lararium/keyhive` (the name, or any file of its package), and the files `browser-custody`, `browser-vessel-identity`,
// `ward-core`, `seed-wrap-prf` wherever they stand.
//
// SILENT-ZERO GUARD: a relative or workspace specifier that resolves to no file reads red by name (exit 2), since an
// unread edge could hide a reach; an entry that reads no edge at all reads red too.
//
// Usage: node tools/page-entry-witness.mjs [--root <repo>] [--entry <path from root>]
// Exit: 0 holds · 1 a vessel module reached · 2 the walk could not stand (unresolved edge, missing entry, empty graph)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_ENTRY = "packages/lararium-web/src/main.ts";
export const FORBIDDEN_PACKAGES = ["@automerge/automerge-repo", "@lararium/keyhive"];
export const FORBIDDEN_FILES = ["browser-custody", "browser-vessel-identity", "ward-core", "seed-wrap-prf"];

const CODE_EXT = [".ts", ".tsx", ".mts", ".js", ".mjs"];
const NOT_CODE = /\.(?:css|json|wasm|html|svg|png|txt|tid|mem)$/;

/** Strip comments so a commented-out import never reads as an edge. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}()])\/\/[^\n]*/g, "$1");
}

/** Every import edge in one module's text: { spec, kind: "static" | "dynamic" | "type" }. */
export function scanImports(text) {
  const src = stripComments(text);
  const edges = [];
  const fromRe = /\b(import|export)\s+(type\s+)?([\w*{}\s,$]+?)\s+from\s*["']([^"'\n]+)["']/g;
  for (const m of src.matchAll(fromRe)) edges.push({ spec: m[4], kind: m[2] ? "type" : "static" });
  const exportStar = /\bexport\s+(type\s+)?\*(?:\s+as\s+\w+)?\s+from\s*["']([^"'\n]+)["']/g;
  for (const m of src.matchAll(exportStar)) {
    if (!edges.some((e) => e.spec === m[2])) edges.push({ spec: m[2], kind: m[1] ? "type" : "static" });
  }
  for (const m of src.matchAll(/\bimport\s*["']([^"'\n]+)["']/g)) edges.push({ spec: m[1], kind: "static" });
  // `import("x").Name` in a type position (an inline type import) erases like `import type`.
  for (const m of src.matchAll(/\bimport\s*\(\s*["'`]([^"'`\n$]+)["'`]\s*([,)])(\s*\.\s*[A-Z])?/g)) {
    edges.push({ spec: m[1], kind: m[2] === ")" && m[3] ? "type" : "dynamic" });
  }
  return edges;
}

/** A specifier the page only spawns from (a Worker URL), never loads onto its own thread. */
export function spawnsOnly(spec) {
  const q = spec.indexOf("?");
  if (q < 0) return false;
  return /(?:^|&)(?:worker|sharedworker|url)(?:&|$)/.test(spec.slice(q + 1));
}

/** The workspace's packages: name → { dir, exports }. */
export function workspacePackages(root) {
  const out = new Map();
  const pkgs = join(root, "packages");
  if (!existsSync(pkgs)) return out;
  for (const d of readdirSync(pkgs)) {
    const pj = join(pkgs, d, "package.json");
    if (!existsSync(pj)) continue;
    const p = JSON.parse(readFileSync(pj, "utf8"));
    if (p.name) out.set(p.name, { dir: join(pkgs, d), exports: p.exports ?? null, main: p.main ?? null });
  }
  return out;
}

function fileOf(base) {
  const tries = [base];
  const ext = extname(base);
  if (ext === ".js" || ext === ".mjs") tries.push(...CODE_EXT.map((e) => base.slice(0, -ext.length) + e));
  if (!CODE_EXT.includes(ext)) tries.push(...CODE_EXT.map((e) => base + e), ...CODE_EXT.map((e) => join(base, "index" + e)));
  for (const t of tries) if (existsSync(t) && statSync(t).isFile()) return t;
  return null;
}

function exportTarget(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") return entry.import ?? entry.default ?? entry.types ?? null;
  return null;
}

/** A workspace package specifier's source file, or null. */
function resolveWorkspace(pkg, subpath) {
  const key = subpath ? "./" + subpath : ".";
  let target = null;
  if (pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports) && Object.keys(pkg.exports).some((k) => k.startsWith("."))) {
    target = exportTarget(pkg.exports[key]);
  } else if (key === ".") {
    target = exportTarget(pkg.exports) ?? pkg.main;
  }
  const candidates = [];
  if (target) {
    const rel = target.replace(/^\.\//, "");
    candidates.push(rel.replace(/^dist\/src\//, "src/").replace(/^dist\//, "src/"), rel);
  }
  candidates.push(subpath ? "src/" + subpath : "src/index");
  for (const c of candidates) {
    const f = fileOf(join(pkg.dir, c));
    if (f) return f;
  }
  return null;
}

function packageName(spec) {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Walk the page entry's graph. Returns { reached: Map<node, parent>, externals: Map<name, parent>, spawned, unresolved }.
 * A node names a file (absolute path) or `pkg:<name>` for an external package.
 */
export function walk({ root, entry = DEFAULT_ENTRY }) {
  const start = resolve(root, entry);
  if (!existsSync(start)) return { error: `the entry ${entry} stands nowhere under ${root}` };
  const ws = workspacePackages(root);
  const reached = new Map([[start, null]]);
  const externals = new Map();
  const spawned = [];
  const unresolved = [];
  let edges = 0;
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    for (const { spec: raw, kind } of scanImports(readFileSync(file, "utf8"))) {
      if (kind === "type") continue;
      edges += 1;
      if (spawnsOnly(raw)) { spawned.push({ from: file, spec: raw }); continue; }
      const spec = raw.split("?")[0];
      if (NOT_CODE.test(spec)) continue;
      let target = null;
      if (spec.startsWith(".") || spec.startsWith("/")) {
        target = fileOf(resolve(dirname(file), spec));
        if (!target) { unresolved.push({ from: file, spec: raw }); continue; }
      } else {
        const name = packageName(spec);
        const pkg = ws.get(name);
        if (!pkg) {
          const node = `pkg:${spec}`;
          if (!externals.has(node)) externals.set(node, file);
          continue;
        }
        target = resolveWorkspace(pkg, spec.slice(name.length + 1));
        if (!target) { unresolved.push({ from: file, spec: raw }); continue; }
        const node = `pkg:${spec}`;
        if (!externals.has(node)) externals.set(node, file);
      }
      if (!reached.has(target)) { reached.set(target, file); queue.push(target); }
    }
  }
  return { start, reached, externals, spawned, unresolved, edges, ws };
}

function chainOf(result, node, root) {
  const parentOf = (n) => (n.startsWith("pkg:") ? result.externals.get(n) : result.reached.get(n));
  const out = [];
  for (let n = node; n; n = parentOf(n)) out.unshift(n.startsWith("pkg:") ? n.slice(4) : relative(root, n));
  return out.join(" -> ");
}

/** The vessel modules the walk reached: [{ name, via, chain }]. */
export function forbiddenReached(result, root) {
  const hits = [];
  const keyhiveDir = result.ws.get("@lararium/keyhive")?.dir;
  for (const name of FORBIDDEN_PACKAGES) {
    const node = [...result.externals.keys()].find((n) => n === `pkg:${name}` || n.startsWith(`pkg:${name}/`));
    if (node) { hits.push({ name, chain: chainOf(result, node, root) }); continue; }
    if (name === "@lararium/keyhive" && keyhiveDir) {
      const file = [...result.reached.keys()].find((f) => f.startsWith(keyhiveDir + "/"));
      if (file) hits.push({ name, chain: chainOf(result, file, root) });
    }
  }
  for (const name of FORBIDDEN_FILES) {
    const file = [...result.reached.keys()].find((f) => basename(f, extname(f)) === name);
    if (file) hits.push({ name, chain: chainOf(result, file, root) });
  }
  return hits;
}

function main(argv) {
  const arg = (flag, fallback) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback; };
  const root = resolve(arg("--root", fileURLToPath(new URL("../", import.meta.url))));
  const entry = arg("--entry", DEFAULT_ENTRY);
  const result = walk({ root, entry });
  if (result.error) { console.log(`page-entry: ${result.error}`); return 2; }
  if (result.edges === 0) { console.log(`page-entry: ${entry} reads no import edge — an empty graph proves nothing`); return 2; }
  if (result.unresolved.length) {
    console.log(`page-entry: ${result.unresolved.length} edge(s) resolve to no file — the walk cannot stand`);
    for (const u of result.unresolved) console.log(`  ${relative(root, u.from)}: ${u.spec}`);
    return 2;
  }
  const hits = forbiddenReached(result, root);
  const summary = `${result.reached.size} module(s) reached · ${result.spawned.length} worker spawn(s) not reached`;
  if (hits.length === 0) { console.log(`page-entry: holds — ${entry} reaches no vessel module (${summary})`); return 0; }
  console.log(`page-entry: ${entry} reaches ${hits.length} vessel module(s) (${summary})`);
  for (const h of hits) console.log(`  ${h.name}\n    ${h.chain}`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
