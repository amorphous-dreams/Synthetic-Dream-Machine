import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = dirname(fileURLToPath(import.meta.url));
const CEILING = Number(/const CEILING = (\d+);/.exec(readFileSync(join(tools, 'symbol-anchor.mjs'), 'utf8'))[1]);
// One more named symbol than the ceiling, so the verdict turns on whether each one counts as defined.
const SYMS = Array.from({ length: CEILING + 1 }, (_, i) => `ghostSymbol${i}`);

// The anchor reads the tracked tree of the repo its own file sits in, so a scratch git repo holds the carriers and
// sources each case lays down.
function run({ carriers = SYMS, files = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'symbol-anchor-'));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  mkdirSync(join(root, 'tools'));
  for (const f of ['symbol-anchor.mjs', 'corpus-read.mjs', 'stamp-build.mjs', 'code_scan.py'])
    copyFileSync(join(tools, f), join(root, 'tools', f));
  carriers.forEach((sym, i) => put(`bags/x/carrier-${i}.mem`, `source-symbol = "${sym}"\n`));
  for (const [rel, text] of Object.entries(files)) put(rel, text);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return spawnSync('node', [join(root, 'tools', 'symbol-anchor.mjs')], { cwd: root, encoding: 'utf8' });
}

test('control: every named symbol declared in code reads under the ceiling', () => {
  const r = run({ files: {
    'packages/p/src/a.ts': SYMS.map((s, i) => (i % 2 ? `export function ${s}() {}\n` : `export const ${s} = 1;\n`)).join(''),
  } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`${SYMS.length} named symbol\\(s\\) · 0 absent`));
});

test('control: a python declaration counts', () => {
  const r = run({ files: {
    'packages/p/holder.py': SYMS.map((s, i) => (i % 2 ? `def ${s}():\n    pass\n` : `class ${s}:\n    pass\n`)).join(''),
  } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, / 0 absent/);
});

test('a name kept alive only by comments, strings and .tid prose reads absent', () => {
  const r = run({ files: {
    'packages/p/src/a.ts': SYMS.map(s => `// ${s} retired with the old door\nconst note = "${s}";\n`).join(''),
    'packages/p/holder.py': SYMS.map(s => `# ${s} once lived here\nlabel = "${s}"\n`).join(''),
    'packages/p/doc.tid': `title: doc\n\n${SYMS.join(' ')}\n`,
  } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`${SYMS.length} absent`));
  assert.match(r.stdout, /THE DEBT GREW/);
});

test('a carrier census that checks nothing refuses', () => {
  const r = run({ carriers: [] });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /NO SOURCE SYMBOLS CHECKED/);
});
