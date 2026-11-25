import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { census, exemptionsOf, kindOf, pointersOf, EXEMPT_CARRIER } from './source-pointer.mjs';

const TOOL = fileURLToPath(new URL('./source-pointer.mjs', import.meta.url));
const FILE = '100644', LINK = '160000';

const codeMeme = (target, edge = '') => [
  '```toml meta',
  'heleuma     = "ha"',
  `source-file = "${target}"`,
  '```',
  edge,
].join('\n');

function read(entries, carriers = {}) {
  return census(entries.map(e => Array.isArray(e) ? { path: e[0], mode: e[1] } : { path: e, mode: FILE }),
    path => carriers[path] ?? null);
}
const stateOf = (result, path) => result.rows.find(r => r.path === path)?.state;

test('a carrier names its code by the meta key and by the #source edge', () => {
  const text = codeMeme('packages/a/src/one.ts',
    '<<~ pranala slot=`#source` from=`?` to=`packages/a/src/two.ts` family=`code` role=`has`>>');
  assert.deepEqual(pointersOf(text).sort(), ['packages/a/src/one.ts', 'packages/a/src/two.ts']);
});

test('an edge whose body carries a bearing arrow still yields its target', () => {
  const text = '<<~ pranala slot=`#source-file` note=`a -> b` from=`?` to=`tools/x.mjs`>>';
  assert.deepEqual(pointersOf(text), ['tools/x.mjs']);
});

test('each tracked path reads one kind by rule', () => {
  const kinds = {
    'bags/lares/ha.ka.ba/lares/api/x.mem': 'carrier',
    'wikis/lares/ha.ka.ba/lares/docs/y.mem': 'carrier',
    'packages/lararium-tw5/tiddlers/z.tid': 'tiddler',
    'bags/sdm/ha.ka.ba/sdm/procedures/p.css.meta': 'sidecar',
    'scratch/notes/draft.mem': 'scratch',
    'packages/a/tests/fixtures/f.mem': 'fixture',
    'packages/a/tests/one.test.ts': 'test',
    'packages/a/src/one.test.ts': 'test',
    'packages/s/scripts/tests/test_probe.py': 'test',
    'tools/tree-clean-witness.sh': 'witness',
    'tools/stamp-build.mjs': 'tool',
    'packages/a/src/one.ts': 'source',
    'packages/a/scripts/build.ts': 'script',
    'docs/notes.md': 'flat-doc',
    'LICENSE': 'flat-doc',
    'genesis/cas/19c2eb91d7cda55f': 'genesis',
    'genesis/seed.json': 'genesis',
    'CLAUDE.md': 'seed-seat',
    '.claude/noosphere-boot': 'seed-seat',
    '.github/workflows/ci.yml': 'config',
    'packages/a/package.json': 'config',
    'tools/capability-inventory.json': 'registry',
    'sdm/art/cover.png': 'binary',
    'AGENTS.override.md': 'seed-seat',
    '.claude/agents/Plan.md': 'seed-seat',
    '.claude/settings.json': 'config',
    '.codex/config.toml': 'config',
    '.codex/rules/stash.rules': 'config',
    '.claude/skills/playwright-cli/SKILL.md': 'skill',
    'tests/TEST-ARCHITECTURE.md': 'flat-doc',
    '.github/ROSTER.md': 'flat-doc',
    'deploy/x/README.md': 'flat-doc',
  };
  for (const [path, kind] of Object.entries(kinds)) assert.equal(kindOf(path), kind, path);
  assert.equal(kindOf('TiddlyWiki5', { gitlink: true }), 'submodule');
  assert.equal(kindOf('bags/sdm/ha.ka.ba/sdm/procedures/p.css', { hasMeta: true }), 'bare-entry');
  assert.equal(kindOf('bags/sdm/ha.ka.ba/sdm/procedures/q.css'), 'bag-stray');
  assert.equal(kindOf('strange/thing.xyz'), 'unclassified');
});

test('a wiki resident reads wiki, a named file reads bound, the rest read unbound', () => {
  const meme = 'bags/lararium/ha.ka.ba/lararium/mesh/one.mem';
  const result = read([
    meme,
    'bags/sdm/ha.ka.ba/sdm/procedures/p.css',
    'bags/sdm/ha.ka.ba/sdm/procedures/p.css.meta',
    'packages/lararium-tw5/tiddlers/z.tid',
    'packages/a/src/one.ts',
    'packages/a/src/two.ts',
    'docs/notes.md',
    ['TiddlyWiki5', LINK],
  ], { [meme]: codeMeme('packages/a/src/one.ts') });

  assert.equal(stateOf(result, meme), 'wiki');
  assert.equal(stateOf(result, 'bags/sdm/ha.ka.ba/sdm/procedures/p.css'), 'wiki');
  assert.equal(stateOf(result, 'bags/sdm/ha.ka.ba/sdm/procedures/p.css.meta'), 'wiki');
  assert.equal(stateOf(result, 'packages/lararium-tw5/tiddlers/z.tid'), 'wiki');
  assert.equal(stateOf(result, 'packages/a/src/one.ts'), 'bound');
  assert.equal(stateOf(result, 'packages/a/src/two.ts'), 'unbound');
  assert.equal(stateOf(result, 'docs/notes.md'), 'unbound');
  assert.equal(stateOf(result, 'TiddlyWiki5'), 'unbound');
  assert.deepEqual([result.total, result.wiki, result.bound, result.unbound], [8, 4, 1, 3]);
  assert.equal(result.codeMemes, 1);
  assert.deepEqual(result.byKind.source, { wiki: 0, bound: 1, unbound: 1, exempt: 0 });
});

test('a carrier outside every wiki binds nothing', () => {
  const draft = 'scratch/notes/draft.mem';
  const result = read([draft, 'packages/a/src/one.ts'], { [draft]: codeMeme('packages/a/src/one.ts') });
  assert.equal(stateOf(result, draft), 'unbound');
  assert.equal(stateOf(result, 'packages/a/src/one.ts'), 'unbound');
  assert.equal(result.codeMemes, 0);
});

test('a path no rule names lands in the unclassified list', () => {
  const result = read(['strange/thing.xyz', 'docs/notes.md']);
  assert.deepEqual(result.unclassified, ['strange/thing.xyz']);
});

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'source-pointer-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  return root;
}
const run = (root, ...args) => spawnSync(process.execPath, [TOOL, '--repo', root, ...args], { encoding: 'utf8' });

test('the witness reports the unbound count and stays green on it', () => {
  const root = tree({
    'bags/lararium/ha.ka.ba/lararium/mesh/one.mem': codeMeme('packages/a/src/one.ts'),
    'packages/a/src/one.ts': 'export const one = 1;\n',
    'packages/a/src/two.ts': 'export const two = 2;\n',
  });
  try {
    const out = run(root);
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /\[molt-census\] 3 tracked file\(s\) · 1 in a wiki · 1 bound by a carrier · 1 unbound · 0 exempt · 0 unclassified/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the witness reads red on an unclassified path and names its cure', () => {
  const root = tree({
    'bags/lararium/ha.ka.ba/lararium/mesh/one.mem': codeMeme('packages/a/src/one.ts'),
    'packages/a/src/one.ts': 'export const one = 1;\n',
    'strange/thing.xyz': 'x\n',
  });
  try {
    const out = run(root);
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(out.stdout, /UNCLASSIFIED  strange\/thing\.xyz/);
    assert.match(out.stdout, /cure: add a rule to `kindOf`/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const exemptCarrier = lines => '```census-exempt\n' + lines.join('\n') + '\n```\n';

test('the exemption list reads path and reason, and a named path reads exempt', () => {
  const list = exemptionsOf(exemptCarrier(['vendor/blob.xyz | vendored kit', '# a comment | skipped']));
  assert.deepEqual([...list], [['vendor/blob.xyz', 'vendored kit']]);
  const result = read(['vendor/blob.xyz', 'strange/thing.xyz'], {}).unclassified;
  assert.deepEqual(result, ['vendor/blob.xyz', 'strange/thing.xyz']);
  const exempted = census([{ path: 'vendor/blob.xyz', mode: FILE }, { path: 'strange/thing.xyz', mode: FILE }], () => null, list);
  assert.deepEqual(exempted.unclassified, ['strange/thing.xyz']);
  assert.equal(exempted.exempt, 1);
  assert.equal(stateOf(exempted, 'vendor/blob.xyz'), 'exempt');
});

test('the witness stays green on a listed path and reads red on a stale line', () => {
  const root = tree({
    'bags/lares/ha.ka.ba/lares/docs/pono/molt-census.mem': exemptCarrier(['vendor/blob.xyz | vendored kit']),
    'bags/lararium/ha.ka.ba/lararium/mesh/one.mem': codeMeme('packages/a/src/one.ts'),
    'packages/a/src/one.ts': 'export const one = 1;\n',
    'vendor/blob.xyz': 'x\n',
  });
  const stale = tree({
    'bags/lares/ha.ka.ba/lares/docs/pono/molt-census.mem': exemptCarrier(['vendor/gone.xyz | vendored kit']),
    'bags/lararium/ha.ka.ba/lararium/mesh/one.mem': codeMeme('packages/a/src/one.ts'),
    'packages/a/src/one.ts': 'export const one = 1;\n',
  });
  try {
    assert.equal(EXEMPT_CARRIER, 'bags/lares/ha.ka.ba/lares/docs/pono/molt-census.mem');
    const ok = run(root);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /1 exempt · 0 unclassified/);
    const bad = run(stale);
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /STALE EXEMPTION  vendor\/gone\.xyz/);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(stale, { recursive: true, force: true }); }
});

test('the census flag prints the kind table and the json flag the rows', () => {
  const root = tree({
    'bags/lararium/ha.ka.ba/lararium/mesh/one.mem': codeMeme('packages/a/src/one.ts'),
    'packages/a/src/one.ts': 'export const one = 1;\n',
    'packages/a/src/two.ts': 'export const two = 2;\n',
  });
  try {
    const table = run(root, '--census');
    assert.equal(table.status, 0, table.stdout + table.stderr);
    assert.match(table.stdout, /source\s+0\s+1\s+1\b/);
    assert.match(table.stdout, /packages\/a\/src\/two\.ts/);
    const json = JSON.parse(run(root, '--census', '--json').stdout);
    assert.deepEqual([json.total, json.wiki, json.bound, json.unbound], [3, 1, 1, 1]);
    assert.equal(json.rows.find(r => r.path === 'packages/a/src/two.ts').state, 'unbound');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a dangling pointer still reads red', () => {
  const root = tree({
    'bags/lararium/ha.ka.ba/lararium/mesh/one.mem': codeMeme('packages/a/src/gone.ts'),
    'packages/a/src/two.ts': 'export const two = 2;\n',
  });
  try {
    const out = run(root);
    assert.equal(out.status, 1);
    assert.match(out.stdout, /packages\/a\/src\/gone\.ts/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
