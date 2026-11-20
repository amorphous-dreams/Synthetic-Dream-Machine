#!/usr/bin/env node
// test-reads-source — gate A of the test-bloat gate (lar:///ha.ka.ba/kahua/memory/wave/test-bloat-gate).
//
// DETECTION. A test file READS SOURCE when a text read (`readFileSync`, `readFile(`, `read_text(`, a bare `open(`) takes
// an argument that names production text: its call window (the next 240 characters), or the one `const NAME = …;` an
// identifier argument points at, holds a `src` path segment (`"src"` as a join argument, `../src/`, `/src/x.ts`) or a
// canon path (`bags/…`, `wikis/…`, `ha.ka.ba/….mem`). A `?raw` import of a `/src/` file counts too. A bare fixture name
// such as `npc.mem` never counts.
// Import lines, `from "…"`, `import("…")`, `require("…")` and `vi.mock("…")` never count: loading a module exercises
// it, and only the text read asserts on its letters. A tree a test writes (`mkdirSync(join(repo, "packages", "a", "src"))`
// or a fixture path string) never counts, since no read argument names it.
//
// EXEMPTION. Workflow, CI-config, script and Dockerfile text under `tools/` and `.github/` is the artifact those laws
// test, so reads of `.yml`, `.yaml`, `.json`, `.sh`, `Dockerfile` and `.github/` files carry no reference above and
// never flag. The exemption lives in the reference rule itself (only `src` paths and `.mem` canon count), not in a
// path list.
//
// RATCHET. `tools/test-reads-source-allowlist.json` lists the test files that read source today. A reader outside it
// fails; a listed file that stopped reading (or vanished) fails until its row leaves the list. The list only shrinks.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_FILE = /(?:^|\/)tests?\/.*\.(?:[cm]?[jt]sx?|py)$|\.test\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$/;
const READ_CALL = /\b(?:readFileSync|readFile|read_text)\s*\(|(?<![.\w])open\s*\(/g;
const REFERENCE = /["'`]src["'`]|["'`]\.{1,2}\/src\/|\/src\/[\w./-]+\.(?:[cm]?[jt]sx?|py)\b|(?:bags|wikis)\/[\w./-]*\.mem\b|ha\.ka\.ba\/[\w./-]*\.mem\b/;
const LOADS = /\bfrom\s*["'`][^"'`\n]*["'`]|\bimport\s*\(\s*["'`][^"'`\n]*["'`]\s*\)|\bimport\s+["'`][^"'`\n]*["'`]|\brequire\s*\(\s*["'`][^"'`\n]*["'`]\s*\)|\bvi\.(?:mock|doMock|importActual)\s*\(\s*["'`][^"'`\n]*["'`]/g;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.claude', 'scratch']);

export const isTestFile = (path) => TEST_FILE.test(path);

/** The reason `text` (a test file's body) reads source, or null. */
export function readsSource(text) {
  if (/["'`][^"'`\n]*\/src\/[^"'`\n]*\?raw["'`]/.test(text)) return '?raw import of src';
  const reads = [...text.matchAll(READ_CALL)];
  if (!reads.length) return null;
  for (const m of reads) {
    const at = m.index + m[0].length;
    const window = text.slice(at, at + 240).replace(LOADS, '""');
    let seen = window;
    const id = /^\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(window);
    if (id) seen += '\n' + (new RegExp(`\\b(?:const|let|var)\\s+${id[1].replace(/\$/g, '\\$')}\\s*=([^;]*;)`).exec(text)?.[1] ?? '');
    const hit = REFERENCE.exec(seen);
    if (hit) return hit[0].replace(/["'`]/g, '');
  }
  return null;
}

function listFiles(root) {
  try {
    return execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch { /* a fixture root with no git: walk it */ }
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p); else out.push(relative(root, p));
    }
  })(root);
  return out;
}

/** Every test file under `root` that reads source: sorted [{path, why}]. */
export function scan(root) {
  const found = [];
  for (const path of listFiles(root).filter(isTestFile)) {
    let text;
    try { text = readFileSync(join(root, path), 'utf8'); } catch { continue; }
    const why = readsSource(text);
    if (why) found.push({ path, why });
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** The ratchet: {fresh: readers outside the allowlist, stale: listed files that no longer read}. */
export function ratchet(found, allow) {
  const reading = new Set(found.map((f) => f.path));
  const listed = new Set(allow);
  return { fresh: found.filter((f) => !listed.has(f.path)), stale: [...listed].filter((p) => !reading.has(p)).sort() };
}

function main() {
  const args = process.argv.slice(2);
  const here = fileURLToPath(new URL('../', import.meta.url));
  let root = here, allowPath = join(here, 'tools/test-reads-source-allowlist.json'), print = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') root = resolve(args[++i]);
    else if (args[i] === '--allowlist') allowPath = resolve(args[++i]);
    else if (args[i] === '--print') print = true;
    else { console.error('usage: test-reads-source.mjs [--root dir] [--allowlist file] [--print]'); process.exit(2); }
  }
  const found = scan(root);
  if (print) { console.log(JSON.stringify(found.map((f) => f.path), null, 2)); return; }
  const allow = JSON.parse(readFileSync(allowPath, 'utf8'));
  const { fresh, stale } = ratchet(found, allow);
  console.log(`[test-reads-source] ${found.length} test file(s) read source, ${allow.length} allowlisted`);
  for (const f of fresh) console.error(`new-reader  ${f.path}  (reads ${f.why})`);
  for (const p of stale) console.error(`stale-allow ${p}  (no longer reads source: remove it from the allowlist)`);
  if (fresh.length || stale.length) {
    console.error('pono: exercise behaviour instead of reading source text; when a burn or conversion ends a read, drop the row from tools/test-reads-source-allowlist.json (the list only shrinks)');
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
