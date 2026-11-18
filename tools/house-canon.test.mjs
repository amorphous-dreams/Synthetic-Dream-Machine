// house-canon.test — the house canon clone (lar:///ha.ka.ba/lararium/mesh/founding-runbook#/prepare), proved against
// scratch repositories: a bare origin with `develop` and a tag, a developer's working checkout, and the clone a house
// reads. Nothing here reads the operator's home, the live checkout's remotes or a standing vessel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = join(resolve(dirname(fileURLToPath(import.meta.url))), 'house-canon.mjs');

function env(home, extra = {}) {
  const e = {
    ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...extra,
  };
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'LARES_HOUSE', 'LARES_WORKSPACE', 'LARES_CANON']) {
    if (!(k in extra)) delete e[k];
  }
  return e;
}

/** A bare origin holding `develop` (one carrier) and tag `t1`, plus a developer's working checkout of it. */
function world(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'house-canon-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, 'home');
  mkdirSync(home);
  const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: env(home), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = join(root, 'origin.git');
  g(root, 'init', '-q', '--bare', '-b', 'develop', origin);
  const dev = join(root, 'dev');
  g(root, 'clone', '-q', origin, dev);
  g(dev, 'checkout', '-q', '-b', 'develop');
  mkdirSync(join(dev, 'bags/lares'), { recursive: true });
  writeFileSync(join(dev, 'bags/lares/a.mem'), 'one\n');
  g(dev, 'add', '.');
  g(dev, 'commit', '-qm', 'one');
  g(dev, 'tag', 't1');
  g(dev, 'push', '-q', 'origin', 'develop', 't1');
  /** A new commit on origin's develop, carrying `text` in the carrier. */
  const advance = (text) => {
    g(dev, 'checkout', '-q', 'develop');
    writeFileSync(join(dev, 'bags/lares/a.mem'), `${text}\n`);
    g(dev, 'commit', '-qam', text);
    g(dev, 'push', '-q', 'origin', 'develop');
    return g(dev, 'rev-parse', 'HEAD');
  };
  const run = (args, extra = {}) => spawnSync('node', [TOOL, ...args], { cwd: dev, encoding: 'utf8', env: env(home, extra) });
  /** One verb's JSON answer: the run must pass. */
  const json = (args, extra = {}) => {
    const r = run([...args.filter((a) => a !== '--json'), '--json'], extra);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    return JSON.parse(r.stdout);
  };
  return { root, home, origin, dev, g, advance, run, json };
}

test('stand clones the origin at the pin, detached, and records the pin in the clone itself', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  const out = w.json(['stand', '--at', at, '--from', w.origin, '--pin', 'develop', '--json']);
  assert.equal(out.at, at);
  assert.equal(out.pin, 'develop');
  assert.equal(out.head, w.g(w.dev, 'rev-parse', 'develop'));
  assert.equal(w.g(at, 'config', 'lares.canonPin'), 'develop');
  assert.equal(spawnSync('git', ['-C', at, 'symbolic-ref', '-q', 'HEAD'], { env: env(w.home) }).status, 1, 'HEAD stands detached');
  assert.equal(readFileSync(join(at, 'bags/lares/a.mem'), 'utf8'), 'one\n');
  assert.match(out.next.join('\n'), new RegExp(`LARES_WORKSPACE=${at}`));
});

test('stand defaults to ~/.lares-canon on develop, from the origin the working checkout names', (t) => {
  const w = world(t);
  const out = w.json(['stand', '--json']);
  assert.equal(out.at, join(w.home, '.lares-canon'));
  assert.equal(out.pin, 'develop');
  assert.equal(w.g(out.at, 'remote', 'get-url', 'origin'), w.origin);
});

test('the D4 property: a branch switch in the working checkout leaves the house canon clone where it stands', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  w.json(['stand', '--at', at, '--from', w.origin]);
  w.g(w.dev, 'checkout', '-q', '-b', 'feature');
  writeFileSync(join(w.dev, 'bags/lares/a.mem'), 'feature\n');
  w.g(w.dev, 'commit', '-qam', 'feature');
  assert.equal(readFileSync(join(at, 'bags/lares/a.mem'), 'utf8'), 'one\n');
});

test('move fetches and checks out the pin\'s new commit, and names `lares vessel seed` as the next act', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  const before = w.json(['stand', '--at', at, '--from', w.origin]).head;
  const after = w.advance('two');
  const out = w.json(['move', '--at', at, '--json']);
  assert.equal(out.from, before);
  assert.equal(out.to, after);
  assert.deepEqual(out.changed, ['bags/lares/a.mem']);
  assert.equal(readFileSync(join(at, 'bags/lares/a.mem'), 'utf8'), 'two\n');
  assert.match(out.next.join('\n'), /lares vessel seed/);
  const again = w.json(['move', '--at', at, '--json']);
  assert.equal(again.from, again.to);
  assert.deepEqual(again.changed, []);
});

test('move --pin re-pins the clone to a tag, and the pin stays recorded', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  w.json(['stand', '--at', at, '--from', w.origin]);
  w.advance('two');
  w.json(['move', '--at', at]);
  const out = w.json(['move', '--at', at, '--pin', 't1', '--json']);
  assert.equal(out.to, w.g(w.dev, 'rev-parse', 't1^{commit}'));
  assert.equal(w.g(at, 'config', 'lares.canonPin'), 't1');
  assert.equal(readFileSync(join(at, 'bags/lares/a.mem'), 'utf8'), 'one\n');
});

test('move refuses a clone holding the house\'s unsaved write-back, names each path, and moves nothing', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  const before = w.json(['stand', '--at', at, '--from', w.origin]).head;
  w.advance('two');
  writeFileSync(join(at, 'bags/lares/a.mem'), 'written back\n');
  mkdirSync(join(at, 'wikis'));
  writeFileSync(join(at, 'wikis/new.tid'), 'new\n');
  const r = w.run(['move', '--at', at]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /bags\/lares\/a\.mem/);
  assert.match(r.stderr, /wikis\/new\.tid/);
  assert.equal(w.g(at, 'rev-parse', 'HEAD'), before);
  assert.equal(readFileSync(join(at, 'bags/lares/a.mem'), 'utf8'), 'written back\n');
});

test('move refuses a working checkout: a tree with no recorded pin reads as no house canon clone', (t) => {
  const w = world(t);
  const r = w.run(['move', '--at', w.dev]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no house canon clone/);
});

test('move refuses a pin the origin does not carry, and the clone stays at its commit', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  const before = w.json(['stand', '--at', at, '--from', w.origin]).head;
  const r = w.run(['move', '--at', at, '--pin', 'no-such-branch']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no-such-branch/);
  assert.equal(w.g(at, 'rev-parse', 'HEAD'), before);
  assert.equal(w.g(at, 'config', 'lares.canonPin'), 'develop');
});

test('stand refuses a place that already holds files, one inside the working checkout, and one inside LARES_HOUSE', (t) => {
  const w = world(t);
  const full = join(w.root, 'full');
  mkdirSync(full);
  writeFileSync(join(full, 'x'), 'x');
  const a = w.run(['stand', '--at', full, '--from', w.origin]);
  assert.equal(a.status, 1);
  assert.match(a.stderr, /already holds/);
  const b = w.run(['stand', '--at', join(w.dev, 'canon'), '--from', w.origin]);
  assert.equal(b.status, 1);
  assert.match(b.stderr, /inside the working checkout/);
  const house = join(w.root, 'house');
  const c = w.run(['stand', '--at', join(house, 'canon'), '--from', w.origin], { LARES_HOUSE: house });
  assert.equal(c.status, 1);
  assert.match(c.stderr, /inside LARES_HOUSE/);
  assert.equal(existsSync(join(house, 'canon')), false);
});

test('read names the pin, the commit, the write-back and whether the surface env names this clone', (t) => {
  const w = world(t);
  const at = join(w.root, 'canon');
  w.json(['stand', '--at', at, '--from', w.origin]);
  let out = w.json(['read', '--at', at, '--json']);
  assert.equal(out.pin, 'develop');
  assert.deepEqual(out.dirty, []);
  assert.equal(out.workspace.names, 'other');
  mkdirSync(join(w.home, '.lares'));
  writeFileSync(join(w.home, '.lares/lares-surface.env'), `LARES_HOUSE=/somewhere\nLARES_WORKSPACE=${at}\n`);
  out = w.json(['read', '--at', at, '--json']);
  assert.equal(out.workspace.names, 'clone');
  writeFileSync(join(w.home, '.lares/lares-surface.env'), `LARES_WORKSPACE=${w.dev}\n`);
  out = w.json(['read', '--at', at, '--json']);
  assert.equal(out.workspace.names, 'working-checkout', 'a surface env naming a checkout with no pin reads as the dev install');
  writeFileSync(join(at, 'bags/lares/a.mem'), 'written back\n');
  assert.deepEqual(w.json(['read', '--at', at, '--json']).dirty, ['bags/lares/a.mem']);
});

test('usage: an unknown verb exits 2 and names the three verbs', (t) => {
  const w = world(t);
  const r = w.run(['pull']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /stand.*move.*read/s);
});
