// Inventory clock-bearing decisions. Categories outside the evergreen exceptions are
// review leads, not proofs of intent; the report preserves the source expression.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCEPTIONS } from './evergreen-boundary.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const extensions = /\.(?:[cm]?[jt]sx?)$/;
function walk(root, dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(root, path, files);
    else if (entry.isFile() && extensions.test(entry.name)) files.push(relative(root, path).replaceAll('\\', '/'));
  }
}
function existsDirectory(path) {
  try { return readdirSync(path, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function testFile(file) { return /(?:^|\/)tests?\//.test(file) || /(?:^|[.\/-])(?:test|spec)\.[cm]?[jt]sx?$/.test(file); }
function seeded(file, text) {
  return EXCEPTIONS.find(e => e.rule === 'clock' && e.file === file && text.includes(e.match) && /(?:bounds? only|own liveness|own child process timeout|own completion time)/i.test(e.reason));
}
export function scanText(file, source) {
  // Preserve offsets and line breaks while blanking comments and strings. Strings
  // cannot carry a clock decision, but parentheses in them must not end calls.
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
    match => match.replace(/[^\n]/g, ' '));
  const lines = source.split(/\r?\n/), found = [], seen = new Set();
  const test = testFile(file);
  function add(pos, kind, category) {
    const line = code.slice(0, pos).split('\n').length;
    const key = `${line}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    const text = lines[line - 1].trim();
    const exception = seeded(file, text);
    found.push({ file, line, category: exception ? (/runner|child process/i.test(exception.reason) ? 'HARNESS' : 'LIVENESS') : category, kind, review: !exception, text });
  }
  const defaultCategory = test ? 'TEST-WAIT' : file.startsWith('tools/') ? 'HARNESS' : 'PRODUCT-WAIT';
  function callEnd(start) {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')' && --depth === 0) return i + 1;
    }
    return code.length;
  }
  const waits = [];
  const calls = /\b(?:waitFor\w*|setTimeout|setInterval|until|AbortSignal\s*\.\s*timeout|test|it|beforeEach|afterEach|beforeAll|afterAll)\s*\(/g;
  for (const m of code.matchAll(calls)) {
    const n = m[0].replace(/\s*\($/, ''), open = m.index + m[0].lastIndexOf('('), end = callEnd(open), body = code.slice(open + 1, end - 1);
    if (/^waitFor/.test(n)) {
      waits.push([open, end]);
      if (/\btimeout\s*:\s*(?!0\s*[,}])[^,}\s]/.test(body)) add(m.index, 'timed wait', test ? 'TEST-WAIT' : 'PRODUCT-WAIT');
    } else if (/^set(?:Timeout|Interval)$/.test(n)) add(m.index, n, defaultCategory);
    else if (n === 'until' && body.includes(',')) add(m.index, 'poll', defaultCategory);
    else if (/^AbortSignal/.test(n)) add(m.index, 'abort timeout', defaultCategory);
    else if (/^(?:test|it|beforeEach|afterEach|beforeAll|afterAll)$/.test(n) && /,\s*(?:\d[\d_]*|[A-Z_][A-Z_\d]*)\s*$/.test(body)) add(m.index, 'test timeout', 'HARNESS');
  }
  for (const m of code.matchAll(/\b(testTimeout|hookTimeout|timeout)\s*:\s*([^,}\s]+)/g)) {
    if (/^0$/.test(m[2])) continue;
    if (m[1] === 'timeout' && waits.some(([a, b]) => m.index > a && m.index < b)) continue;
    add(m.index, m[1] === 'timeout' ? 'timeout option' : 'runner timeout', m[1] === 'timeout' ? defaultCategory : 'HARNESS');
  }
  let offset = 0;
  for (const line of code.split('\n')) {
    for (const statement of line.split(/[;{}]/)) {
      if (/\b(?:Date|performance)\s*\.\s*now\s*\(\s*\)/.test(statement) && /(?:<=|>=|(?<![=])<(?![=<])|(?<![=])>(?![=>])|={2,3}|!={1,2})/.test(statement)) add(offset + line.indexOf(statement) + statement.search(/\S/), 'clock comparison', defaultCategory);
    }
    offset += line.length + 1;
  }
  return found.sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind));
}
export function census(root = repo) {
  root = resolve(root);
  const files = [];
  for (const entry of existsDirectory(join(root, 'packages'))) if (entry.isDirectory()) for (const part of ['src', 'tests']) {
    const path = join(root, 'packages', entry.name, part);
    if (existsDirectory(path).length) walk(root, path, files);
  }
  const tools = join(root, 'tools');
  if (existsDirectory(tools).length) walk(root, tools, files);
  return files.sort().flatMap(file => scanText(file, readFileSync(join(root, file), 'utf8')));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--root')) throw new Error('usage: node tools/clock-census.mjs [--root DIR]');
    for (const f of census(args.length ? args[1] : repo)) console.log(`${f.file}:${f.line} ${f.category}${f.review ? ' REVIEW' : ''} ${f.kind}  ${f.text}`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
