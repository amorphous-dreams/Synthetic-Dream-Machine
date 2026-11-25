#!/usr/bin/env node
/**
 * pulama-closure — one digest over the pūlama's code closure in a source tree, so a build can label what the pūlama
 * runs apart from the vessel it shares an image with (docker-compose.surface.yml runs the pūlama on the vessel's image).
 *
 *   node tools/pulama-closure.mjs <tree>          prints `sha256:<hex>` on one stdout line
 *   node tools/pulama-closure.mjs <tree> --list   prints the `<sha256>  <path>` lines the digest hashes
 *
 * The label moves when the code the pūlama RUNS moves, and only then. It reads from
 * `packages/lararium-node/src/pulama-main.ts` along the import graph, file by file:
 *   - a relative import (`./x.js` reads `./x.ts`) joins the file;
 *   - a workspace import (`@lararium/mesh`, `@lararium/mesh/node`) joins the one source file the package's `exports` map
 *     names (`./dist/x.js` reads `src/x.ts`), so a sibling module the pūlama never imports stays out. A package whose
 *     `exports` or source layout this tool cannot map, or whose reached file imports by a computed specifier, joins
 *     whole (its whole `src/` tree): the tool over-reads rather than under-reads.
 * Each source file hashes with its comments removed (a string-, template- and regex-aware scan, trailing blanks and the
 * lines a comment alone held dropped), so a comment edit keeps the label. Every other byte of code moves it.
 * Beside the files ride the reached packages' `package.json` and `tsconfig.json`, `pnpm-workspace.yaml`,
 * `tsconfig.base.json`, and the lock file narrowed to what the closure loads: the lock's header (settings, overrides),
 * the reached packages' importer blocks, and the `packages:` and `snapshots:` entries of every external dependency
 * the closure imports, followed through their own dependencies. A lock this tool cannot read that way rides whole.
 * Not hashed: the Dockerfile and the base image (the image id and the shim's own build inputs read those).
 * The digest hashes the sorted `<sha256>  <path>` lines.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const tree = process.argv[2];
if (!tree || !existsSync(tree)) { process.stderr.write("pulama-closure: name the source tree to read\n"); process.exit(2); }
const root = resolve(tree);
const ENTRY = "packages/lararium-node/src/pulama-main.ts";
if (!existsSync(join(root, ENTRY))) { process.stderr.write(`pulama-closure: no ${ENTRY} stands in ${root}\n`); process.exit(3); }

// The workspace packages by name, with their parsed manifests.
const packages = new Map();
const manifests = new Map();
for (const dir of readdirSync(join(root, "packages"))) {
  const manifest = join(root, "packages", dir, "package.json");
  if (!existsSync(manifest)) continue;
  try { const m = JSON.parse(readFileSync(manifest, "utf8")); if (typeof m.name === "string") { packages.set(m.name, join("packages", dir)); manifests.set(join("packages", dir), m); } } catch { /* a manifest that reads no name joins no closure */ }
}

// COMMENTS OUT: a scan over JS/TS source that drops `//` and block comments and keeps every other byte (strings,
// template literals with their `${}` nesting, regex literals). A `/` after an operator, opener or keyword opens a regex;
// a `/` after an identifier, number, `)` or `]` divides. A regex that finds no closing `/` on its line reads as division.
// The scan errs toward KEEPING text: only a `//` or `/*` in plain code position drops, so a misread leaves a comment in
// (the label moves on a comment edit) and never drops code that sits outside a real comment.
const REGEX_AFTER_WORD = /(?:^|[^\w$.])(?:return|typeof|case|do|else|in|of|instanceof|new|delete|void|throw|yield|await)$/;
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  const tpl = []; // brace depths of the `${` frames we stand inside
  let depth = 0;
  let inTemplate = false;
  // A comment that stood alone on its line takes the line; a trailing one takes the blanks before it.
  const dropLineIfBlank = (to) => {
    const ls = out.lastIndexOf("\n") + 1;
    if (/^[ \t]*$/.test(out.slice(ls))) {
      let j = to; while (j < n && (src[j] === " " || src[j] === "\t")) j++;
      if (j >= n || src[j] === "\n" || (src[j] === "\r" && src[j + 1] === "\n")) { out = out.slice(0, ls); return j >= n ? j : (src[j] === "\r" ? j + 2 : j + 1); }
    } else out = out.replace(/[ \t]+$/, "");
    return to;
  };
  while (i < n) {
    if (inTemplate) {
      const c = src[i];
      if (c === "\\") { out += src.slice(i, i + 2); i += 2; }
      else if (c === "`") { out += c; i++; inTemplate = false; }
      else if (c === "$" && src[i + 1] === "{") { out += "${"; i += 2; tpl.push(depth); depth = 0; inTemplate = false; }
      else { out += c; i++; }
      continue;
    }
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === "`") { out += c; i++; inTemplate = true; continue; }
    if (c === "{") { depth++; out += c; i++; continue; }
    if (c === "}") {
      if (tpl.length > 0 && depth === 0) { depth = tpl.pop(); out += c; i++; inTemplate = true; continue; }
      depth--; out += c; i++; continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      let j = i; while (j < n && src[j] !== "\n") j++;
      i = dropLineIfBlank(j); continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      const j = e === -1 ? n : e + 2;
      const next = dropLineIfBlank(j);
      if (next === j && /[\w$]$/.test(out) && /^[\w$]/.test(src.slice(j))) out += " ";
      i = next; continue;
    }
    if (c === "/") {
      const prev = out.replace(/\s+$/, "");
      const divides = /[\w$)\]]$/.test(prev) && !REGEX_AFTER_WORD.test(prev);
      if (!divides) {
        let j = i + 1, cls = false;
        while (j < n && src[j] !== "\n" && (cls || src[j] !== "/")) { if (src[j] === "\\") j++; else if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; j++; }
        if (j < n && src[j] === "/") { j++; while (j < n && /[a-z]/i.test(src[j])) j++; out += src.slice(i, j); i = j; continue; }
      }
    }
    out += c; i++;
  }
  return out;
}

const files = new Set();
const bare = new Map(); // external package name -> the workspace dirs whose closure files import it
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const COMPUTED = /(?<![.\w$])(?:import|require)\s*\(\s*[^"'\s)]/;
const text = (path) => readFileSync(join(root, path), "utf8");
const walk = (dir) => readdirSync(join(root, dir)).flatMap((e) => {
  const p = join(dir, e);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
const SOURCE = /\.[cm]?[jt]sx?$/;
const owner = (path) => path.split("/").slice(0, 2).join("/");

const reachedPackages = new Set();
const wholePackages = new Set();
const seen = new Set();
const queue = [ENTRY];
const isFile = (c) => existsSync(join(root, c)) && statSync(join(root, c)).isFile();
const joinPackage = (dir) => {
  if (reachedPackages.has(dir)) return;
  reachedPackages.add(dir);
  for (const f of ["package.json", "tsconfig.json"]) if (isFile(join(dir, f))) files.add(join(dir, f));
};
const takeWhole = (dir) => {
  joinPackage(dir);
  if (wholePackages.has(dir)) return;
  wholePackages.add(dir);
  if (existsSync(join(root, dir, "src"))) for (const f of walk(join(dir, "src"))) if (SOURCE.test(f)) queue.push(f); else files.add(f);
};
// A built target (`./dist/x.js`) reads its source (`src/x.ts`).
const srcOf = (target) => {
  if (typeof target !== "string") return [];
  const rel = target.replace(/^\.\//, "").replace(/^dist\/src\//, "src/").replace(/^dist\//, "src/");
  return [rel.replace(/\.js$/, ".ts"), rel.replace(/\.mjs$/, ".mts"), rel.replace(/\.js$/, ".tsx"), rel, `${rel}.ts`];
};
const entryTarget = (node) => typeof node === "string" ? node : node && typeof node === "object" ? (entryTarget(node.import) ?? entryTarget(node.default) ?? entryTarget(node.node) ?? entryTarget(node.require)) : undefined;
const reachPackage = (spec) => {
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  const dir = packages.get(name);
  if (dir === undefined) return false;
  joinPackage(dir);
  if (wholePackages.has(dir)) return true;
  const sub = `.${spec.slice(name.length)}`;
  const m = manifests.get(dir);
  const target = m.exports !== undefined ? (typeof m.exports === "string" ? (sub === "." ? m.exports : undefined) : entryTarget(m.exports[sub])) : sub === "." ? (m.module ?? m.main) : undefined;
  const hit = srcOf(target).map((c) => join(dir, c)).find(isFile);
  if (hit === undefined) takeWhole(dir); else queue.push(hit);
  return true;
};
while (queue.length > 0) {
  const path = queue.pop();
  if (seen.has(path) || !existsSync(join(root, path))) continue;
  seen.add(path);
  files.add(path);
  const src = text(path);
  if (COMPUTED.test(stripComments(src).replace(/`(?:\\[^]|[^`\\])*`/g, "``"))) takeWhole(owner(path)); // a computed specifier reaches what no scan sees
  for (const [, spec] of src.matchAll(SPEC)) {
    if (spec.startsWith(".")) {
      const base = join(dirname(path), spec);
      const hit = [base, base.replace(/\.js$/, ".ts"), base.replace(/\.mjs$/, ".mts"), `${base}.ts`, join(base, "index.ts")].find(isFile);
      if (hit !== undefined) queue.push(hit);
    } else if (!spec.startsWith("node:") && !spec.startsWith("/")) {
      if (reachPackage(spec)) continue;
      const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (!/^(?:@[\w.-]+\/)?[\w.-]+$/.test(name)) continue; // prose after a `from` in a string names no package
      if (!bare.has(name)) bare.set(name, new Set());
      bare.get(name).add(owner(path));
    }
  }
}
joinPackage("packages/lararium-node");
for (const extra of ["pnpm-workspace.yaml", "tsconfig.base.json"]) if (isFile(extra)) files.add(extra);

// THE LOCK, NARROWED to what the closure loads. Any read that fails returns the lock whole.
function narrowLock() {
  const raw = text("pnpm-lock.yaml");
  const sections = new Map(); // top-level key -> its text
  let key = "pre"; let buf = [];
  for (const line of raw.split("\n")) {
    const m = /^([a-zA-Z]+):/.exec(line);
    if (m) { sections.set(key, buf.join("\n")); key = m[1]; buf = []; }
    buf.push(line);
  }
  sections.set(key, buf.join("\n"));
  const entries = (sec) => { // two-space-indented keys of a section -> their blocks
    const map = new Map(); let k = null; let b = [];
    for (const line of (sections.get(sec) ?? "").split("\n").slice(1)) {
      const m = /^  (\S.*?):(?: \{\})?$/.exec(line);
      if (m) { if (k !== null) map.set(k, b.join("\n")); k = m[1].replace(/^'(.*)'$/, "$1"); b = [line]; } else if (k !== null) b.push(line);
    }
    if (k !== null) map.set(k, b.join("\n"));
    return map;
  };
  const importers = entries("importers"), pkgs = entries("packages"), snaps = entries("snapshots");
  if (snaps.size === 0 || importers.size === 0) throw new Error("lock shape");
  const keep = [];
  const want = new Set(); // snapshot keys
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const dep = (block, name) => { // the `version:` the importer block names for `name`, in any dependency section
    const m = new RegExp(`^      '?${esc(name)}'?:\\n        specifier: .*\\n        version: (.+)$`, "m").exec(block);
    return m ? m[1].replace(/^'(.*)'$/, "$1") : undefined;
  };
  for (const [name, owners] of bare) {
    for (const dir of owners) {
      if (!importers.has(dir)) throw new Error(`no importer for ${dir}`);
      // The declaring package first; a name it leaves undeclared resolves wherever a reached package declares it (a
      // hoisted name), every such version riding the label.
      let vs = [dep(importers.get(dir), name)].filter((v) => v !== undefined);
      if (vs.length === 0) vs = [...reachedPackages, "."].map((d) => dep(importers.get(d) ?? "", name)).filter((v) => v !== undefined);
      // Still undeclared: a transitive name pnpm hoists. Every locked version of it rides; a name the lock holds
      // nowhere (a builtin spelled bare, prose after a `from` in a string) loads nothing from the lock.
      if (vs.length === 0) { for (const k of snaps.keys()) if (k.startsWith(`${name}@`)) { keep.push(`${dir} ${name} ${k}`); want.add(k); } continue; }
      for (const v of vs) { keep.push(`${dir} ${name} ${v}`); if (!v.startsWith("link:")) want.add(`${name}@${v}`); }
    }
  }
  const done = new Set();
  const todo = [...want];
  while (todo.length > 0) {
    const k = todo.pop();
    if (done.has(k)) continue;
    done.add(k);
    const snap = snaps.get(k);
    if (snap === undefined) throw new Error(`no snapshot ${k}`);
    keep.push(`snapshot ${k}\n${snap}`);
    const base = k.replace(/\(.*$/, ""); // `name@ver(peer)` -> `name@ver`
    const pk = pkgs.get(base);
    if (pk === undefined) throw new Error(`no package ${base}`);
    keep.push(`package ${base}\n${pk}`);
    for (const m of snap.matchAll(/^      (?:'([^']+)'|([^\s:']+)): (\S+)$/gm)) {
      const name = m[1] ?? m[2];
      const ver = m[3];
      todo.push(ver.startsWith("npm:") ? ver.slice(4) : `${name}@${ver}`);
    }
  }
  return `${sections.get("lockfileVersion")}\n${sections.get("settings") ?? ""}\n${sections.get("overrides") ?? ""}\n${keep.sort().join("\n")}\n`;
}

const digestOf = (buf) => createHash("sha256").update(buf).digest("hex");
const entriesOut = [...files].map((f) => relative(root, join(root, f)).split("\\").join("/"))
  .map((f) => [f, SOURCE.test(f) ? Buffer.from(stripComments(text(f))) : readFileSync(join(root, f))]);
if (isFile("pnpm-lock.yaml")) {
  let lock;
  try { lock = Buffer.from(narrowLock()); } catch { lock = readFileSync(join(root, "pnpm-lock.yaml")); }
  entriesOut.push(["pnpm-lock.yaml", lock]);
}
const lines = entriesOut.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([f, buf]) => `${digestOf(buf)}  ${f}`);
if (process.argv[3] === "--list") process.stdout.write(lines.join("\n") + "\n");
else process.stdout.write(`sha256:${digestOf(lines.join("\n") + "\n")}\n`);
