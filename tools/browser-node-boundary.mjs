#!/usr/bin/env node
/**
 * browser-node-boundary - the browser cells run Node 26 inside the pinned Playwright image; the rest of CI runs Node 24.
 * This witness walks each browser cell's package-level dependency closure and refuses, by cell and package, any
 * `engines.node` range that excludes Node 24, and any closure member it cannot resolve. The cells derive from
 * `.github/workflows/ci.yml` (the `test-cells` matrix rows that name a `container`, and the `quick` job's steps that run
 * `tools/pw-container.sh` from a `cd packages/<dir>`); the packages each test-cell tests come from TEST_CELLS.
 * No import parsing: workspace manifests first, then `pnpm-lock.yaml` for every third-party package reached.
 * The lockfile reads through a small exact line reader (no YAML parser stands in the root node_modules). A range form the
 * evaluator cannot read refuses by name. `overlay` maps root-relative paths to replacement contents (null removes one).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_CELLS } from "./ci-cells.mjs";

const NODE24 = [24e12, 25e12];
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

// ── the tree, with the overlay laid over the disk ──
function treeOf(root, overlay) {
  const read = (path) => {
    if (path in overlay) return overlay[path] ?? undefined;
    const abs = join(root, path);
    return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
  };
  const list = (dir) => {
    const abs = join(root, dir);
    const names = new Set(existsSync(abs) ? readdirSync(abs) : []);
    for (const [path, body] of Object.entries(overlay)) {
      if (!path.startsWith(`${dir}/`)) continue;
      const head = path.slice(dir.length + 1).split("/")[0];
      if (body === null) names.delete(head);
      else names.add(head);
    }
    return [...names].sort();
  };
  return { read, list };
}

// ── the workflow: browser cells and the packages each tests ──
function jobLines(text, job) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === `  ${job}:`);
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

export function browserCells(workflowText) {
  const cells = [];
  let current = null;
  for (const line of jobLines(workflowText, "test-cells")) {
    const row = /^\s+- cell:\s*(\S+)\s*$/.exec(line);
    if (row) { current = { cell: row[1], browser: false }; cells.push(current); } else if (current && /^\s+container:/.test(line)) current.browser = true;
  }
  const named = cells.filter((c) => c.browser).map((c) => ({ cell: c.cell, dirs: TEST_CELLS.find((t) => t.cell === c.cell)?.packages.map((p) => p.dir) ?? [] }));
  const quick = jobLines(workflowText, "quick");
  const quickDirs = new Set();
  quick.forEach((line, i) => {
    if (!line.includes("pw-container.sh")) return;
    for (let j = i; j >= 0 && !/^\s{6}- /.test(quick[j]); j--) {
      const cd = /\bcd\s+(\S+)/.exec(quick[j]);
      if (cd) { quickDirs.add(cd[1]); break; }
    }
  });
  return [...named, { cell: "quick", dirs: [...quickDirs] }];
}

// ── the lockfile: exact line reader for importers / packages / snapshots ──
const unquote = (s) => s.replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
const bareVersion = (key) => { const at = key.indexOf("("); return at < 0 ? key : key.slice(0, at); };

export function readLock(text) {
  const out = { importers: new Map(), engines: new Map(), edges: new Map() };
  let section = "";
  let key = null;
  let field = "";
  let dep = null;
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) { section = line.replace(/:.*/, ""); key = null; continue; }
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();
    if (indent === 2) {
      key = unquote(body.replace(/:(\s.*)?$/, ""));
      field = "";
      if (section === "importers") out.importers.set(key, new Map());
      if (section === "snapshots") out.edges.set(key, new Map());
      continue;
    }
    if (!key) continue;
    if (section === "packages" && indent === 4) {
      const eng = /^engines:\s*\{(.*)\}\s*$/.exec(body);
      if (eng) { const n = /(?:^|,)\s*node:\s*('[^']*'|"[^"]*"|[^,]+)/.exec(eng[1]); if (n) out.engines.set(key, unquote(n[1].trim())); }
    } else if (section === "importers") {
      if (indent === 4) field = body.replace(/:.*/, "");
      else if (indent === 6 && DEP_FIELDS.includes(field)) { dep = unquote(body.replace(/:$/, "")); out.importers.get(key).set(dep, null); } else if (indent === 8 && body.startsWith("version:")) out.importers.get(key).set(dep, unquote(body.slice(8).trim()));
    } else if (section === "snapshots") {
      if (indent === 4) field = body.replace(/:.*/, "");
      else if (indent === 6 && (field === "dependencies" || field === "optionalDependencies" || field === "peerDependencies")) {
        const m = /^(\S+?):\s+(.*)$/.exec(body);
        if (m) out.edges.get(key).set(unquote(m[1]), unquote(m[2].trim()));
      }
    }
  }
  return out;
}

// ── engines.node evaluation over integer-encoded versions ──
class Unevaluable extends Error {}
const enc = (M, m, p) => M * 1e12 + m * 1e6 + p;
function parts(token) {
  const m = /^[vV]?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(token);
  if (!m) throw new Unevaluable(token);
  const nums = [];
  for (const g of [m[1], m[2], m[3]]) { if (g === undefined || /[xX*]/.test(g)) break; nums.push(Number(g)); }
  if (m[1] !== undefined && /[xX*]/.test(m[1]) && nums.length) throw new Unevaluable(token);
  return nums;
}
const floor = (n) => enc(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0);
const ceil = (n) => (n.length === 0 ? Infinity : n.length === 1 ? enc(n[0] + 1, 0, 0) : n.length === 2 ? enc(n[0], n[1] + 1, 0) : enc(n[0], n[1], n[2] + 1));

function comparator(token) {
  const m = /^(>=|<=|>|<|=|\^|~)?(.+)$/.exec(token);
  const op = m[1] ?? "";
  const n = parts(m[2]);
  if (op === "" || op === "=") return [floor(n), ceil(n)];
  if (op === ">=") return [floor(n), Infinity];
  if (op === ">") return [ceil(n), Infinity];
  if (op === "<") return [0, floor(n)];
  if (op === "<=") return [0, ceil(n)];
  if (op === "~") return [floor(n), n.length === 0 ? Infinity : n.length === 1 ? ceil(n) : enc(n[0], n[1] + 1, 0)];
  if (n.length === 0) return [0, Infinity];
  if (n[0] > 0 || n.length === 1) return [floor(n), enc(n[0] + 1, 0, 0)];
  if (n[1] > 0 || n.length === 2) return [floor(n), enc(0, n[1] + 1, 0)];
  return [floor(n), enc(0, 0, n[2] + 1)];
}

/** Does any version of Node 24 satisfy `range`? Throws Unevaluable on a form it cannot read. */
export function admitsNode24(range) {
  const text = String(range).trim();
  if (/\s-\s/.test(text) || /[-+]\w*\d[-.]\w*(?:alpha|beta|rc|pre)|[a-zA-Z]{2,}/.test(text.replace(/[xX]/g, ""))) throw new Unevaluable(text);
  for (const set of text.split("||")) {
    const tokens = set.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1").split(/\s+/).filter(Boolean);
    let [lo, hi] = NODE24;
    for (const t of tokens.length ? tokens : ["*"]) {
      const [a, b] = comparator(t);
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
    }
    if (lo < hi) return true;
  }
  return false;
}

// ── the closure walk ──
function workspaceMembers(tree) {
  const members = new Map();
  const patterns = [...(tree.read("pnpm-workspace.yaml") ?? "").matchAll(/^\s+-\s+['"]?([^'"\s#]+)['"]?/gm)].map((m) => m[1]);
  for (const pattern of patterns) {
    const dirs = pattern.endsWith("/*") ? tree.list(pattern.slice(0, -2)).map((d) => `${pattern.slice(0, -2)}/${d}`) : [pattern];
    for (const dir of dirs) {
      const raw = tree.read(`${dir}/package.json`);
      if (raw === undefined) continue;
      const manifest = JSON.parse(raw);
      if (manifest.name) members.set(manifest.name, { dir, manifest });
    }
  }
  return members;
}

function judge(range, label, cell, diagnostics) {
  if (range === undefined) return;
  try {
    if (!admitsNode24(range)) diagnostics.push(`cell ${cell}: ${label} engines.node "${range}" excludes Node 24`);
  } catch (error) {
    diagnostics.push(`cell ${cell}: ${label} engines.node "${range}" has a form the witness cannot evaluate (${error.message})`);
  }
}

function walkCell({ cell, dirs }, members, lock, diagnostics) {
  const byDir = new Map([...members].map(([name, m]) => [m.dir, name]));
  const seen = new Set();
  const queue = [];
  for (const dir of dirs) {
    const name = byDir.get(dir);
    if (name) queue.push({ workspace: name });
    else diagnostics.push(`cell ${cell}: tested package at ${dir} resolves to no workspace member`);
  }
  const visit = (item) => {
    const id = item.workspace ? `ws:${item.workspace}` : `lock:${item.key}`;
    if (seen.has(id)) return;
    seen.add(id);
    queue.push(item);
  };
  const first = queue.splice(0);
  first.forEach(visit);
  while (queue.length) {
    const item = queue.shift();
    if (item.workspace) {
      const { dir, manifest } = members.get(item.workspace);
      judge(manifest.engines?.node, item.workspace, cell, diagnostics);
      for (const field of [...DEP_FIELDS, "peerDependencies"]) {
        for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
          if (members.has(dep)) { visit({ workspace: dep }); continue; }
          if (String(spec).startsWith("workspace:")) { diagnostics.push(`cell ${cell}: ${dep} (from ${item.workspace}) resolves to no workspace member`); continue; }
          const version = lock.importers.get(dir)?.get(dep);
          // a peer the importer never resolves rides the consumer's own edge, which the walk reaches from there
          if (!version && field === "peerDependencies") continue;
          if (!version) { diagnostics.push(`cell ${cell}: ${dep} (from ${item.workspace}) has no importer entry in pnpm-lock.yaml`); continue; }
          visit({ key: version.startsWith("npm:") ? version.slice(4) : `${dep}@${version}`, name: dep, from: item.workspace });
        }
      }
    } else {
      const bare = bareVersion(item.key);
      if (!lock.edges.has(item.key) && !lock.engines.has(bare)) { diagnostics.push(`cell ${cell}: ${item.name} (${item.key}) is absent from pnpm-lock.yaml`); continue; }
      judge(lock.engines.get(bare), bare, cell, diagnostics);
      for (const [dep, value] of lock.edges.get(item.key) ?? []) visit({ key: value.startsWith("npm:") ? value.slice(4) : `${dep}@${value}`, name: dep, from: item.key });
    }
  }
  return seen.size;
}

/** Walk every browser cell; resolves to the diagnostics, empty when the boundary holds. */
export async function browserNodeBoundary({ root, overlay = {} }) {
  return (await closureReport({ root, overlay })).diagnostics;
}

export async function closureReport({ root, overlay = {} }) {
  const tree = treeOf(root, overlay);
  const cells = browserCells(tree.read(".github/workflows/ci.yml") ?? "");
  const members = workspaceMembers(tree);
  const lock = readLock(tree.read("pnpm-lock.yaml") ?? "");
  const diagnostics = [];
  const sizes = {};
  for (const cell of cells) {
    if (!cell.dirs.length) diagnostics.push(`cell ${cell.cell}: the workflow names no tested package`);
    sizes[cell.cell] = walkCell(cell, members, lock, diagnostics) ?? 0;
  }
  return { cells: cells.map((c) => c.cell), sizes, diagnostics: [...new Set(diagnostics)] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = await closureReport({ root: fileURLToPath(new URL("..", import.meta.url)) });
  console.log(JSON.stringify({ cells: report.cells, sizes: report.sizes }));
  for (const d of report.diagnostics) console.error(`browser-node-boundary: ${d}`);
  process.exit(report.diagnostics.length ? 1 : 0);
}
