// mem-merge-driver.test — the seal merge driver, proved in a scratch repository (lar:///ha.ka.ba/lares/docs/pono/working-procedures#/the-seal-merge).
//
// Each case builds its own repository under the OS temp dir: a base carrier, two branches that each edit the body
// and re-seal, and a merge. Git's own text merge conflicts on the one seal line both re-seals moved; the driver
// resolves that conflict alone and leaves every other conflict standing, markers and all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distModule } from './corpus-read.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRIVER = join(REPO, 'tools/mem-merge-driver.mjs');
const { stampCarrier, verifyBcc } = await distModule(REPO, 'packages/lararium-memetic-frame/dist/index.js', 'mem-merge-driver.test', 'pnpm --filter @lararium/memetic-frame build');

const TITLE = 'lar:///ha.ka.ba/lares/test/seal-merge';
const carrier = (lines) => stampCarrier([
  '<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>',
  '',
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${TITLE}\`>>`,
  '<<^ code=`&#x0002;`>>',
  '',
  '```toml meta',
  `title = "${TITLE}"`,
  'type  = "text/memetic-wikitext+tiddlywiki"',
  '```',
  '',
  ...lines,
  '',
  '<<^ code=`&#x0003;`>>',
  '',
  '<<^ code=`&#x0004;` to=`?`>>',
  '',
].join('\n'));

const BODY = ['! Seal merge', '', 'The first paragraph holds.', '', 'The middle paragraph holds.', '', 'The last paragraph holds.'];
const edit = (at, line) => BODY.map((l, i) => (i === at ? line : l));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: cleanEnv() });
}
function cleanEnv() {
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) delete env[k];
  return env;
}

/**
 * A scratch repository with `main` at the base carrier and two branches `a` and `b` carrying one body each. `driver`
 * names the install line's command (`installed` spells it as the documented install does: a path relative to the
 * worktree top, git running the driver there whatever directory the merge starts from).
 */
function scratch(t, a, b, { driver, at = 'c.mem', from = '' }) {
  const dir = mkdtempSync(join(tmpdir(), 'mem-merge-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, '.gitattributes'), '*.mem text eol=lf merge=mem-seal\n');
  if (driver === 'installed') {
    mkdirSync(join(dir, 'tools'));
    symlinkSync(DRIVER, join(dir, 'tools/mem-merge-driver.mjs'));
    git(dir, 'config', 'merge.mem-seal.driver', 'node tools/mem-merge-driver.mjs %O %A %B %P %L');
  } else if (driver) {
    git(dir, 'config', 'merge.mem-seal.driver', `node ${JSON.stringify(DRIVER)} %O %A %B %P %L`);
  }
  mkdirSync(dirname(join(dir, at)), { recursive: true });
  writeFileSync(join(dir, at), carrier(BODY));
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  for (const [name, body] of [['a', a], ['b', b]]) {
    git(dir, 'checkout', '-qb', name, 'main');
    writeFileSync(join(dir, at), carrier(body));
    git(dir, 'commit', '-qam', name);
  }
  git(dir, 'checkout', '-q', 'a');
  const merge = spawnSync('git', ['merge', '--no-edit', 'b'], { cwd: join(dir, from), encoding: 'utf8', env: cleanEnv() });
  return { dir, merge, text: readFileSync(join(dir, at), 'utf8') };
}

test('control: the two re-sealed carriers differ in body and seal, and each seal verifies', () => {
  const a = carrier(edit(2, 'The first paragraph turns.'));
  const b = carrier(edit(6, 'The last paragraph turns.'));
  assert.equal(verifyBcc(a), 'ok');
  assert.equal(verifyBcc(b), 'ok');
  assert.notEqual(a.match(/bcc=`([^`]*)`/)[1], b.match(/bcc=`([^`]*)`/)[1]);
});

test('git alone conflicts on the seal line when two branches edit apart and both re-seal', (t) => {
  const { merge, text } = scratch(t, edit(2, 'The first paragraph turns.'), edit(6, 'The last paragraph turns.'), { driver: false });
  assert.notEqual(merge.status, 0, 'the plain text merge stops on the seal');
  assert.match(text, /^<<<<<<< /m);
  const conflicted = text.slice(text.indexOf('<<<<<<<'), text.indexOf('>>>>>>>'));
  assert.match(conflicted, /bcc=`ni:\/\/\/sha-256;/, 'the conflict sits on the seal line');
});

test('the driver takes both bodies and re-seals when the seal alone conflicts', (t) => {
  const { dir, merge, text } = scratch(t, edit(2, 'The first paragraph turns.'), edit(6, 'The last paragraph turns.'), { driver: true });
  assert.equal(merge.status, 0, `${merge.stdout}${merge.stderr}`);
  assert.doesNotMatch(text, /^(<<<<<<<|=======|>>>>>>>) ?/m);
  assert.match(text, /The first paragraph turns\./);
  assert.match(text, /The last paragraph turns\./);
  assert.match(text, /The middle paragraph holds\./);
  assert.equal(verifyBcc(text), 'ok', 'the merged carrier carries a seal over the merged body');
  assert.equal(text, carrier([...edit(2, 'The first paragraph turns.')].map((l, i) => (i === 6 ? 'The last paragraph turns.' : l))));
  assert.equal(git(dir, 'status', '--porcelain'), '', 'the merge commits clean');
});

test('the installed spelling resolves from a subdirectory: git runs the driver at the worktree top', (t) => {
  const { merge, text } = scratch(t, edit(2, 'The first paragraph turns.'), edit(6, 'The last paragraph turns.'), { driver: 'installed', at: 'bags/deep/c.mem', from: 'bags/deep' });
  assert.equal(merge.status, 0, `${merge.stdout}${merge.stderr}`);
  assert.equal(verifyBcc(text), 'ok', merge.stdout + merge.stderr);
  assert.match(text, /The first paragraph turns\.[\s\S]*The last paragraph turns\./, merge.stdout + merge.stderr);
});

test('the driver leaves a body conflict standing with git\'s markers, and the merge stops', (t) => {
  const { merge, text } = scratch(t, edit(4, 'The middle paragraph turns one way.'), edit(4, 'The middle paragraph turns the other way.'), { driver: true });
  assert.notEqual(merge.status, 0);
  assert.match(text, /^<<<<<<< /m);
  assert.match(text, /^>>>>>>> /m);
  assert.match(text, /turns one way/);
  assert.match(text, /turns the other way/);
});

test('the driver leaves a carrier whose merged frame cannot seal as git\'s own conflict', (t) => {
  // Branch b tears the frame (drops ETX); a seal over an unbounded span cannot stand, so the conflict stays.
  const dir = mkdtempSync(join(tmpdir(), 'mem-merge-torn-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = carrier(BODY);
  const ours = carrier(edit(2, 'The first paragraph turns.'));
  const theirs = carrier(edit(6, 'The last paragraph turns.')).replace(/^<<\^ code=`&#x0003;` bcc=`[^`]*`>>\n/m, '');
  writeFileSync(join(dir, 'O'), base);
  writeFileSync(join(dir, 'A'), ours);
  writeFileSync(join(dir, 'B'), theirs);
  const r = spawnSync('node', [DRIVER, join(dir, 'O'), join(dir, 'A'), join(dir, 'B'), 'c.mem', '7'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(readFileSync(join(dir, 'A'), 'utf8'), /^<<<<<<< /m);
});
