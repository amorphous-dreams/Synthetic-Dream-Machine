import { test, afterEach } from 'node:test';
import { wallTest } from './wall-test.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, chmodSync, readdirSync, linkSync, renameSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHeld } from './held-dir.mjs';
import { addWorktree, brokerEnv, commitWithReceipt, pushWithGo, readSafe, verifyReceipt } from './seat-broker.mjs';
import { runCheckSeat, runInstallSeat, signReceipt, HAVE_BWRAP } from './seat-walls.mjs';

const script = fileURLToPath(new URL('./commit-relay.mjs', import.meta.url));
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function setup() {
  const home = mkdtempSync(path.join(path.dirname(path.dirname(path.dirname(script))), 'relay-home-'));
  roots.push(home);
  const scratch = path.join(home, '.lares-scratch');
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(path.join(scratch, 'relay-test-'));
  roots.push(root);
  const lane = path.join(root, 'lane'), wt = path.join(lane, 'wt'), remote = path.join(root, 'remote.git');
  mkdirSync(path.join(lane, 'relay'), { recursive: true }); mkdirSync(wt);
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'relay-test'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(path.join(wt, 'a'), 'initial\n'); writeFileSync(path.join(wt, 'b'), 'initial\n');
  git('add', 'a', 'b'); git('commit', '-m', 'initial');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' }); git('remote', 'add', 'origin', remote);
  writeFileSync(path.join(lane, 'message'), 'relay test\n');
  const request = (id, data) => writeFileSync(path.join(lane, 'relay', `req-${id}.json`), typeof data === 'string' ? data : JSON.stringify(data));
  const goDir = path.join(home, 'controller'); mkdirSync(goDir); const goFile = path.join(goDir, 'push-go');
  const launcher = path.join(home, 'launcher.mjs'); writeFileSync(launcher, `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(path.join(root, 'argv.json'))}, JSON.stringify(process.argv.slice(2)));
console.log('SEAT-LAUNCHED 123');
`);
  const bin = path.join(root, 'bin'); mkdirSync(bin); writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\necho pnpm-ok\n', { mode: 0o755 });
  const relayEnv = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` };
  const checksFile = path.join(root, 'checks.json'); writeFileSync(checksFile, JSON.stringify([{ name: 'true', argv: ['/usr/bin/true'] }]));
  const storeDir = path.join(root, 'store'); mkdirSync(storeDir);
  const brokerArgs = ['--installer', path.join(bin, 'pnpm'), '--store-dir', storeDir, '--checks', checksFile, '--author-name', 'Relay', '--author-email', 'relay@example.invalid'];
  const run = () => { const r = spawnSync(process.execPath, [script, '--lane-root', lane, '--worktree', wt, '--branch', 'relay-test', '--go-file', goFile, '--launcher', launcher, ...brokerArgs, '--remote-url', remote, '--once'], { encoding: 'utf8', env: relayEnv }); assert.equal(r.status, 0, r.stderr); };
  const response = id => JSON.parse(readFileSync(path.join(lane, 'relay', `res-${id}.json`), 'utf8'));
  const go = value => writeFileSync(goFile, value);
  return { home, root, wt, lane, remote, git, request, run, response, go, goFile, launcher, bin, relayEnv, brokerArgs };
}

wallTest('commit selects only requested paths', () => {
  const x = setup(); writeFileSync(path.join(x.wt, 'a'), 'changed\n'); writeFileSync(path.join(x.wt, 'b'), 'dirty\n');
  x.request('1', { kind: 'commit', message: 'message', paths: ['a'] }); x.run();
  assert.equal(x.response('1').ok, true); assert.equal(x.git('show', '--format=', '--name-only', 'HEAD'), 'a');
  assert.equal(x.git('status', '--porcelain'), 'M b');
});
test('relative and absolute path escapes refuse', () => {
  const x = setup();
  x.request('1', { kind: 'commit', message: 'message', paths: ['../x'] });
  x.request('2', { kind: 'commit', message: 'message', paths: [path.join(x.wt, 'a')] }); x.run();
  assert.equal(x.response('1').ok, false); assert.equal(x.response('2').ok, false);
});
test('push without controller go refuses', () => {
  const x = setup(); x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').output, 'no push-go from the controller');
  assert.equal(spawnSync('git', ['--git-dir', x.remote, 'rev-parse', '--verify', 'refs/heads/relay-test']).status, 128);
});
test('push with a different branch go refuses', () => {
  const x = setup(); x.go('other\n'); x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').ok, false); assert.equal(existsSync(x.goFile), false, 'the go spends on the attempt');
  assert.equal(spawnSync('git', ['--git-dir', x.remote, 'rev-parse', '--verify', 'refs/heads/relay-test']).status, 128);
});
test('push with matching go succeeds and consumes go', () => {
  const x = setup(); x.go(`relay-test\n${x.git('rev-parse', 'HEAD')}\n`); x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1'))); assert.equal(existsSync(x.goFile), false);
  assert.equal(execFileSync('git', ['--git-dir', x.remote, 'rev-parse', 'refs/heads/relay-test'], { encoding: 'utf8' }).trim(), x.git('rev-parse', 'HEAD'));
});
wallTest('requests run in id order, completing each before the next', () => {
  const x = setup(); writeFileSync(path.join(x.wt, 'a'), 'changed\n');
  x.request('02', { kind: 'push' }); x.request('01', { kind: 'commit', message: 'message', paths: ['a'] }); x.go(`relay-test\n${x.git('rev-parse', 'HEAD')}\n`); x.run();
  assert.equal(x.response('01').ok, true, JSON.stringify(x.response('01')));
  assert.equal(x.response('02').ok, false); assert.match(x.response('02').output, /go head/, 'the push read the head the commit had already moved');
});
wallTest('bad JSON, unknown kinds, a message PATH field and an over-cap message refuse; inline text commits', () => {
  const x = setup(); writeFileSync(path.join(x.wt, 'a'), 'changed\n');
  x.request('1', '{'); x.request('2', { kind: 'other' }); x.request('3', { kind: 'commit', messageFile: '../remote.git', paths: ['a'] });
  x.request('4', { kind: 'commit', message: 'x'.repeat(20000), paths: ['a'] });
  x.request('5', { kind: 'commit', message: 'inline text\n', paths: ['a'] }); x.run();
  for (const id of ['1', '2', '3', '4']) assert.equal(x.response(id).ok, false);
  assert.match(x.response('2').output, /unknown kind/); assert.match(x.response('3').output, /unknown field/); assert.match(x.response('4').output, /cap/);
  assert.equal(x.response('5').ok, true, JSON.stringify(x.response('5')));
  assert.equal(x.git('log', '-1', '--format=%B'), 'inline text');
});


test('a go file inside the lane root refuses to start, so a lead can never grant its own push', () => {
  const x = setup();
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', path.join(x.lane, 'relay', 'push-go'), '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /go-file must sit outside the lane root/);
});


test('worktree validates path and branch then creates and initializes', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  x.request('1', { kind: 'worktree', path: path.join(x.root, 'escape'), branch: 'relay-test-a', base: 'HEAD' });
  x.request('2', { kind: 'worktree', path: dest, branch: 'other', base: 'HEAD' });
  x.request('3', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, false); assert.equal(x.response('2').ok, false);
  assert.equal(x.response('3').ok, true); assert.equal(existsSync(path.join(dest, 'a')), true);
});
test('worktree removal rejects dirty and own worktrees, then removes a clean registered worktree', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, true); writeFileSync(path.join(dest, 'a'), 'dirty');
  x.request('2', { kind: 'worktree-remove', path: dest }); x.request('3', { kind: 'worktree-remove', path: x.wt }); x.run();
  assert.equal(x.response('2').ok, false); assert.equal(x.response('3').ok, false);
  assert.match(x.response('3').output, /relay worktree/);
  execFileSync('git', ['-C', dest, 'restore', 'a']);
  x.request('4', { kind: 'worktree-remove', path: dest }); x.run();
  assert.equal(x.response('4').ok, true); assert.equal(existsSync(dest), false);
});
test('launch validates fields and forwards exact arguments to the launcher', () => {
  const x = setup(), seat = path.join(x.lane, 'seat'), wt = path.join(x.lane, 'builder');
  mkdirSync(seat); writeFileSync(path.join(seat, 'brief.md'), 'brief'); mkdirSync(wt);
  const valid = { kind: 'launch', seatDir: seat, model: 'gpt-6.1-terra', effort: 'high', mode: 'build', worktree: wt };
  x.request('1', { ...valid, mode: 'lead' }); x.request('2', { ...valid, model: 'other' });
  x.request('3', { ...valid, seatDir: x.root }); x.request('4', valid); x.run();
  for (const id of ['1', '2', '3']) assert.equal(x.response(id).ok, false);
  assert.equal(x.response('4').ok, true); assert.match(x.response('4').output, /SEAT-LAUNCHED 123/);
  assert.deepEqual(JSON.parse(readFileSync(path.join(x.root, 'argv.json'), 'utf8')), ['--seat-dir', seat, '--model', valid.model, '--effort', 'high', '--mode', 'build', '--worktree', wt]);
});
test('unknown fields and invalid path forms refuse', () => {
  const x = setup(), seat = path.join(x.lane, 'seat'); mkdirSync(seat); writeFileSync(path.join(seat, 'brief.md'), 'brief');
  x.request('1', { kind: 'push', extra: true });
  x.request('2', { kind: 'launch', seatDir: seat, model: 'gpt-6-luna', effort: 'low', mode: 'read', worktree: seat });
  x.request('3', { kind: 'worktree', path: 'relative', branch: 'relay-test-x', base: 'HEAD' }); x.run();
  for (const id of ['1', '2', '3']) assert.equal(x.response(id).ok, false);
});

test('symlink escapes and existing destinations refuse', () => {
  const x = setup(), link = path.join(x.lane, 'link'); symlinkSync(x.root, link);
  x.request('1', { kind: 'worktree', path: path.join(link, 'escape'), branch: 'relay-test-escape', base: 'HEAD' });
  x.request('2', { kind: 'worktree', path: x.wt, branch: 'relay-test-existing', base: 'HEAD' });
  x.request('3', { kind: 'launch', seatDir: link, model: 'gpt-6-luna', effort: 'low', mode: 'read' }); x.run();
  for (const id of ['1', '2', '3']) assert.equal(x.response(id).ok, false);
});
test('the worktree door runs no install and no submodule step', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  writeFileSync(path.join(x.bin, 'pnpm'), '#!/bin/sh\ntouch "' + path.join(x.root, 'PNPM-RAN') + '"\nexit 7\n', { mode: 0o755 });
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1'))); assert.equal(existsSync(path.join(x.root, 'PNPM-RAN')), false);
});
test('read launch omits worktree and requires a brief', () => {
  const x = setup(), seat = path.join(x.lane, 'seat'); mkdirSync(seat);
  const req = { kind: 'launch', seatDir: seat, model: 'gpt-6-luna', effort: 'medium', mode: 'read' };
  x.request('1', req); x.run(); assert.equal(x.response('1').ok, false);
  writeFileSync(path.join(seat, 'brief.md'), 'brief'); x.request('2', req); x.run();
  assert.equal(x.response('2').ok, true);
  assert.deepEqual(JSON.parse(readFileSync(path.join(x.root, 'argv.json'), 'utf8')), ['--seat-dir', seat, '--model', 'gpt-6-luna', '--effort', 'medium', '--mode', 'read']);
});


// ======================= the ratcheted broker: the five proofs (seat-harness#/owed row 5) =======================
// A fixture repo whose .git a lead could have planted anything in; the broker's library works over (gitDir, worktree).
function brokerFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'broker-'));
  roots.push(root);
  const wt = path.join(root, 'wt'), remote = path.join(root, 'remote.git'), iso = path.join(root, 'iso'), receipts = new Map(), key = randomBytes(32);
  const control = path.join(root, 'controller'), goFile = path.join(control, 'push-go');
  for (const d of [wt, iso, control]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(control, 'secret'), 'CONTROLLER-SECRET\n', { mode: 0o600 });
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'lane'); git('config', 'user.name', 'T'); git('config', 'user.email', 't@example.invalid');
  writeFileSync(path.join(wt, 'a'), 'initial\n'); writeFileSync(path.join(wt, 'b'), 'initial\n');
  git('add', 'a', 'b'); git('commit', '-m', 'initial');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' }); git('remote', 'add', 'origin', remote);
  writeFileSync(path.join(root, 'message'), 'broker test\n');
  const checks = [{ name: 'true', argv: ['/usr/bin/true'] }];
  // Where bubblewrap cannot stand (a runner that bars user namespaces) a stand-in signs the receipt the seat would; the wall proofs skip there.
  const standIn = async (c) => { c.receipts.set(c.tree, signReceipt({ key: c.key, tree: c.tree, checks: c.checks.map((k) => k.name), definitions: c.checks })); return { ok: true, output: '' }; };
  const ctx = { ...(HAVE_BWRAP ? {} : { checkRunner: standIn }), laneRoot: root, gitDir: path.join(wt, '.git'), worktree: wt, iso, remoteUrl: remote, branch: 'lane', author: { name: 'Broker', email: 'broker@example.invalid' }, receipts, key, requiredChecks: ['true'], checks, bwrap: HAVE_BWRAP };
  const marker = (n) => path.join(root, `MARK-${n}`);
  const hook = (name, body) => { const f = path.join(wt, '.git', 'hooks', name); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, `#!/bin/sh\n${body}\n`); chmodSync(f, 0o755); };
  const markers = () => readdirSync(root).filter((n) => n.startsWith('MARK-'));
  return { root, wt, remote, iso, receipts, key, control, goFile, git, ctx, marker, hook, markers, message: path.join(root, 'message') };
}
const commitReq = (x, over = {}) => ({ paths: ['a'], message: 'broker test\n', expectHead: x.git('rev-parse', 'HEAD'), ...over });

test('PROOF 1 planted hooks and a credential helper never run: commit and push leave every marker absent; KNOWN POSITIVE the plain git commit fires them', async () => {
  const x = brokerFixture();
  for (const h of ['pre-commit', 'commit-msg', 'post-commit', 'pre-push', 'reference-transaction']) x.hook(h, `touch '${x.marker(h)}'`);
  x.git('config', 'credential.helper', `!touch '${x.marker('cred')}'`);
  // known positive on a throwaway clone: the plain porcelain DOES fire the planted hooks
  const plain = path.join(x.root, 'plain'); execFileSync('git', ['clone', '-q', x.wt, plain]);
  for (const h of ['pre-commit', 'commit-msg']) { const f = path.join(plain, '.git', 'hooks', h); writeFileSync(f, `#!/bin/sh\ntouch '${x.marker('plain-' + h)}'\n`); chmodSync(f, 0o755); }
  writeFileSync(path.join(plain, 'a'), 'x\n'); execFileSync('git', ['-C', plain, '-c', 'user.name=T', '-c', 'user.email=t@e.invalid', 'commit', '-qam', 'plain']);
  assert.ok(x.markers().includes('MARK-plain-pre-commit'), 'the control hook fires under porcelain');
  writeFileSync(path.join(x.wt, 'a'), 'changed\n');
  const before = x.git('rev-parse', 'HEAD');
  const r = await commitWithReceipt(x.ctx, commitReq(x));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.notEqual(x.git('rev-parse', 'HEAD'), before);
  assert.equal(x.git('rev-parse', 'HEAD~1'), before);
  assert.equal(x.git('show', 'HEAD:a'), 'changed');
  x.git('config', 'remote.origin.pushurl', `ext::sh -c "touch '${x.marker('ext')}'"`);
  x.git('config', `url.${path.join(x.root, 'elsewhere.git')}.insteadOf`, x.remote);
  execFileSync('git', ['init', '--bare', '-q', path.join(x.root, 'elsewhere.git')]);
  writeFileSync(x.goFile, `lane\n${x.git('rev-parse', 'HEAD')}\n`);
  const p = await pushWithGo({ ...x.ctx, goFile: x.goFile });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(execFileSync('git', ['--git-dir', x.remote, 'rev-parse', 'refs/heads/lane'], { encoding: 'utf8' }).trim(), x.git('rev-parse', 'HEAD'));
  assert.equal(spawnSync('git', ['--git-dir', path.join(x.root, 'elsewhere.git'), 'rev-parse', '--verify', 'refs/heads/lane']).status, 128, 'a lane insteadOf never redirected the push');
  assert.deepEqual(x.markers().filter((m) => !m.startsWith('MARK-plain')), [], 'no planted hook, helper or ext push url ran');
});

test('PROOF 2 a .gitattributes filter and a submodule run nothing: commit hashes raw bytes, the worktree door checks out no filter and no submodule', async () => {
  const x = brokerFixture();
  x.git('config', 'filter.evil.clean', `sh -c "touch '${x.marker('clean')}'; cat"`);
  x.git('config', 'filter.evil.smudge', `sh -c "touch '${x.marker('smudge')}'; tr a-z A-Z"`);
  writeFileSync(path.join(x.wt, '.gitattributes'), 'a filter=evil\n');
  // a submodule whose own checkout would fire a hook
  const sub = path.join(x.root, 'subsrc'); mkdirSync(sub); execFileSync('git', ['-C', sub, 'init', '-q', '-b', 'main']);
  writeFileSync(path.join(sub, 'f'), 'f\n'); execFileSync('git', ['-C', sub, '-c', 'user.name=T', '-c', 'user.email=t@e.invalid', 'add', 'f']); execFileSync('git', ['-C', sub, '-c', 'user.name=T', '-c', 'user.email=t@e.invalid', 'commit', '-qm', 'f']);
  const subSha = execFileSync('git', ['-C', sub, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(path.join(sub, '.git', 'hooks', 'post-checkout'), `#!/bin/sh\ntouch '${x.marker('sub')}'\n`, { mode: 0o755 });
  writeFileSync(path.join(x.wt, '.gitmodules'), `[submodule "sub"]\n\tpath = sub\n\turl = ${sub}\n`);
  x.git('update-index', '--add', '--cacheinfo', `160000,${subSha},sub`);
  x.git('-c', 'filter.evil.clean=cat', 'add', '.gitattributes', '.gitmodules'); x.git('commit', '-m', 'attrs and submodule');
  // KNOWN POSITIVE: the porcelain add fires the clean filter
  writeFileSync(path.join(x.wt, 'a'), 'raw bytes\n'); x.git('add', 'a');
  assert.ok(x.markers().includes('MARK-clean'), 'control: git add runs the clean filter'); x.git('reset', '-q'); writeFileSync(path.join(x.wt, 'a'), 'raw bytes\n'); for (const m of x.markers()) rmSync(path.join(x.root, m));
  const r = await commitWithReceipt(x.ctx, commitReq(x)); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(x.git('show', 'HEAD:a'), 'raw bytes', 'the blob holds the raw bytes, no clean filter');
  assert.deepEqual(x.markers(), [], 'the commit ran no filter');
  const dest = path.join(x.root, 'newwt');
  const w = await addWorktree(x.ctx, { path: dest, branch: 'lane-build', base: 'HEAD' });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(readFileSync(path.join(dest, 'a'), 'utf8'), 'raw bytes\n', 'no smudge filter ran');
  assert.deepEqual(readdirSync(path.join(dest, 'sub')), [], 'the submodule path stays an empty directory');
  assert.equal(spawnSync('git', ['-C', dest, 'config', '--get', 'submodule.sub.url'], { encoding: 'utf8' }).stdout.trim(), '', 'no submodule init');
  assert.deepEqual(x.markers(), [], 'no filter, no submodule hook');
  const g = await commitWithReceipt(x.ctx, commitReq(x, { paths: ['sub'] }));
  assert.equal(g.ok, false); assert.match(g.output, /gitlink|submodule/);
});

wallTest('PROOF 3 hostile lifecycle scripts and .npmrc: the broker has no install door, the install seat refuses hostile config by name and installs with scripts off, and it writes only its store', async () => {
  const x = brokerFixture();
  const src = readFileSync(new URL('./commit-relay.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /pnpm|npm_config|submodule/, 'the relay carries no install or submodule code');
  const pnpmBin = path.join(x.root, 'bin'); mkdirSync(pnpmBin);
  const log = path.join(x.root, 'pnpm.log'), store = path.join(x.root, 'store'); mkdirSync(store);
  const probe = path.join(x.root, 'probe');
  writeFileSync(path.join(pnpmBin, 'pnpm'), `#!/bin/sh
echo "ARGV $*" > "${log}"
echo "CWD $(pwd)" >> "${log}"
env | grep -E '^(NODE_OPTIONS|npm_config_|GIT_|HOME)=' >> "${log}"
touch "${x.wt}/.git/PWNED" 2>>"${log}" && echo GITWRITE >> "${log}"
touch "${x.goFile}" 2>>"${log}" && echo GOWRITE >> "${log}"
cat "${x.control}/secret" 2>/dev/null | grep -q CONTROLLER-SECRET && echo CTRLREAD >> "${log}"
touch "${store}/ok" && echo STOREWRITE >> "${log}"
`, { mode: 0o755 });
  writeFileSync(path.join(x.wt, 'package.json'), JSON.stringify({ name: 'p', scripts: { postinstall: `touch ${probe}` } }));
  const seat = { worktree: x.wt, gitDir: x.ctx.gitDir, installer: path.join(pnpmBin, 'pnpm'), storeDir: store, iso: x.iso, extraRw: [x.root], protect: [x.control] };
  for (const key of ['script-shell', 'node-options', 'prefix', '//registry.evil/:_authToken', 'hooks-path']) {
    writeFileSync(path.join(x.wt, '.npmrc'), `${key}=evil\n`);
    const refused = await runInstallSeat(seat);
    assert.equal(refused.ok, false); assert.match(refused.output, new RegExp(key.replace(/[/.]/g, '\\$&')), `names ${key}`);
  }
  writeFileSync(path.join(x.wt, '.npmrc'), 'registry=https://registry.npmjs.org/\n');
  const poisoned = { NODE_OPTIONS: '--require /nonexistent', npm_config_script_shell: '/evil', GIT_DIR: '/evil' };
  const ok = await runInstallSeat({ ...seat, env: poisoned });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const seen = readFileSync(log, 'utf8');
  assert.match(seen, /ARGV .*--ignore-scripts/); assert.match(seen, /--offline/); assert.match(seen, /--frozen-lockfile/);
  assert.doesNotMatch(seen, /NODE_OPTIONS|npm_config_script|GIT_DIR/, 'the poisoned environment never reaches the install');
  assert.match(seen, /STOREWRITE/); assert.match(seen, /--ignore-pnpmfile/); assert.doesNotMatch(seen, /CTRLREAD/, 'the controller dir reads as empty'); assert.doesNotMatch(seen, /GITWRITE|GOWRITE/, 'the install wrote neither git metadata nor the controller file');
  assert.equal(existsSync(path.join(x.wt, '.git', 'PWNED')), false); assert.equal(existsSync(probe), false);
});

test('PROOF 4 a poisoned PATH, HOME, GIT_*, NODE_OPTIONS and a symlink race: the broker env holds only its pinned values, a commit under poison runs no planted tool, and a path swapped to a symlink never reads outside the worktree', async () => {
  const env = brokerEnv('/iso');
  for (const k of Object.keys(env)) assert.ok(['PATH', 'HOME', 'TMPDIR', 'XDG_CONFIG_HOME', 'LC_ALL', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_TERMINAL_PROMPT', 'GIT_ATTR_NOSYSTEM', 'GIT_OPTIONAL_LOCKS', 'GIT_ATTR_SOURCE'].includes(k), `unexpected broker env key ${k}`);
  assert.equal(env.HOME, '/iso/home'); assert.ok(!env.PATH.includes('/home')); assert.equal(env.NODE_OPTIONS, undefined);
  const x = brokerFixture();
  const evilBin = path.join(x.root, 'evilbin'); mkdirSync(evilBin);
  for (const t of ['git', 'sh', 'ssh', 'tar']) { writeFileSync(path.join(evilBin, t), `#!/bin/sh\ntouch '${x.marker('path-' + t)}'\nexit 9\n`, { mode: 0o755 }); }
  const evilHome = path.join(x.root, 'evilhome'); mkdirSync(evilHome);
  const evilHooks = path.join(x.root, 'evilhooks'); mkdirSync(evilHooks);
  writeFileSync(path.join(evilHooks, 'pre-commit'), `#!/bin/sh\ntouch '${x.marker('hooks')}'\n`, { mode: 0o755 });
  writeFileSync(path.join(evilHome, '.gitconfig'), `[core]\n\thooksPath = ${evilHooks}\n[credential]\n\thelper = !touch '${x.marker('homecred')}'\n`);
  const poison = { ...process.env, PATH: `${evilBin}:${process.env.PATH}`, HOME: evilHome, XDG_CONFIG_HOME: evilHome, GIT_DIR: '/nonexistent-evil', GIT_WORK_TREE: '/nonexistent-evil', GIT_INDEX_FILE: path.join(x.root, 'evil-index'), GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: evilHooks, GIT_EXEC_PATH: evilBin, GIT_SSH_COMMAND: `touch '${x.marker('ssh')}'`, NODE_OPTIONS: '--max-old-space-size=64' };
  writeFileSync(path.join(x.wt, 'a'), 'poisoned run\n');
  const driver = `import { commitWithReceipt } from ${JSON.stringify(new URL('./seat-broker.mjs', import.meta.url).href)};
const [ctx0, req, fake] = JSON.parse(process.argv[1]);
import { signReceipt } from ${JSON.stringify(new URL('./seat-walls.mjs', import.meta.url).href)};
import { mkdirSync, writeFileSync } from 'node:fs'; import path from 'node:path';
const ctx = { ...ctx0, key: Buffer.from(ctx0.keyHex, 'hex'), receipts: new Map(), ...(fake ? { checkRunner: async (c) => { c.receipts.set(c.tree, signReceipt({ key: c.key, tree: c.tree, checks: c.checks.map((k) => k.name), definitions: c.checks })); return { ok: true, output: '' }; } } : {}) };
const r = await commitWithReceipt(ctx, req); console.log(JSON.stringify(r)); process.exit(r.ok ? 0 : 1);`;
  const ran = spawnSync(process.execPath, ['--input-type=module', '-e', driver, JSON.stringify([{ ...x.ctx, keyHex: x.key.toString('hex') }, commitReq(x), !HAVE_BWRAP])], { encoding: 'utf8', env: poison });
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  assert.equal(x.git('show', 'HEAD:a'), 'poisoned run');
  assert.deepEqual(x.markers(), [], 'no planted tool, hook, helper or ssh command ran');
  // the symlink race: a swapper flips `a` between a regular file and a symlink to an outside secret
  const secret = path.join(x.root, 'secret'); writeFileSync(secret, 'TOP-SECRET\n');
  const inTree = 'in-tree content\n'; writeFileSync(path.join(x.wt, 'a'), inTree);
  await assert.rejects(readSafe(x.wt, '../secret'), /outside|invalid/);
  symlinkSync(x.root, path.join(x.wt, 'linkdir')); await assert.rejects(readSafe(x.wt, 'linkdir/secret'), /symlink|outside/);
  linkSync(path.join(x.control, 'secret'), path.join(x.wt, 'hard')); await assert.rejects(readSafe(x.wt, 'hard'), /hardlink/);
  const swapper = spawn_swapper(path.join(x.wt, 'a'), secret, inTree);
  let leaked = 0, good = 0;
  try { for (let i = 0; i < 400; i++) { try { const r = await readSafe(x.wt, 'a'); if (r.content.toString().includes('TOP-SECRET')) leaked++; else good++; } catch { /* a refusal is the right answer mid-swap */ } } }
  finally { swapper.kill(); }
  assert.equal(leaked, 0, 'a swapped path never reads outside the worktree');
  mkdirSync(path.join(x.wt, 'd')); writeFileSync(path.join(x.wt, 'd', 'f'), inTree); mkdirSync(path.join(x.root, 'outdir')); writeFileSync(path.join(x.root, 'outdir', 'f'), 'TOP-SECRET\n');
  const dirSwap = spawnAsync(process.execPath, ['-e', `const fs=require('fs');const [d,o]=process.argv.slice(1);const k=d+'.real';fs.renameSync(d,k);setInterval(()=>{try{fs.renameSync(d,k)}catch{};try{fs.symlinkSync(o,d)}catch{};try{fs.unlinkSync(d)}catch{};try{fs.renameSync(k,d)}catch{}},0);`, path.join(x.wt, 'd'), path.join(x.root, 'outdir')], { stdio: 'ignore' });
  let dirLeaked = 0;
  try { for (let i = 0; i < 400; i++) { try { const r = await readSafe(x.wt, 'd/f'); if (r.content.toString().includes('TOP-SECRET')) dirLeaked++; } catch { /* refusal mid-swap */ } } } finally { dirSwap.kill(); }
  assert.equal(dirLeaked, 0, 'a swapped directory never reads outside the worktree');
  assert.ok(good > 0, 'the control: reads of the real file still succeed between swaps');
});
function spawn_swapper(file, secret, inTree) {
  const code = `const fs=require('fs');const [f,s,t]=process.argv.slice(1);setInterval(()=>{try{fs.unlinkSync(f)}catch{};try{fs.symlinkSync(s,f)}catch{};try{fs.unlinkSync(f)}catch{};try{fs.writeFileSync(f,t)}catch{}},0);`;
  return spawnAsync(process.execPath, ['-e', code, file, secret, inTree], { stdio: 'ignore' });
}
import { spawn as spawnAsync } from 'node:child_process';

wallTest('PROOF 5 malicious build, test and editor config run only inside the check seat wall: no go write, no ref write, no credential read, no loopback; forged receipts refuse', async () => {
  const x = brokerFixture();
  const server = createServer((sock) => { hits.push(1); sock.destroy(); }); const hits = [];
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  const cred = path.join(x.root, 'home-creds'); writeFileSync(cred, 'SECRET-TOKEN\n');
  const refBefore = x.git('rev-parse', 'HEAD');
  writeFileSync(path.join(x.wt, '.vscode.json'), '{"tasks":"touch /tmp/should-not-matter"}');
  const attack = `out=/work/scratch/out; : > $out
touch '${x.goFile}' 2>/dev/null && echo GOWRITE >> $out
git --git-dir='${x.ctx.gitDir}' update-ref refs/heads/lane ${'0'.repeat(40)} 2>/dev/null && echo REFWRITE >> $out
cat '${cred}' 2>/dev/null >> $out
(exec 3<>/dev/tcp/127.0.0.1/${port}) 2>/dev/null && echo LOOPBACK >> $out
touch /work/scratch/inside-ok && echo WORKWRITE >> $out
exit 0`;
  const defs = [{ name: 'true', argv: ['/usr/bin/sh', '-c', attack] }];
  const r = await runCheckSeat({ ...x.ctx, tree: x.git('rev-parse', 'HEAD^{tree}'), checks: defs, keepWork: true });
  server.close();
  assert.equal(r.ok, true, JSON.stringify(r));
  const out = readFileSync(path.join(r.work, 'scratch', 'out'), 'utf8');
  assert.match(out, /WORKWRITE/, 'the seat writes inside its own work dir'); assert.doesNotMatch(out, /GOWRITE|REFWRITE|LOOPBACK|SECRET-TOKEN/);
  assert.equal(hits.length, 0, 'the loopback listener saw no connection');
  assert.equal(x.git('rev-parse', 'HEAD'), refBefore); assert.equal(existsSync(x.goFile), false);
  // receipts: the seat signed this tree and check set in memory; wrong-tree, short-check, another definition, a stale key and a planted receipt all refuse
  const tree = x.git('rev-parse', 'HEAD^{tree}');
  const v = (over) => verifyReceipt({ key: x.key, receipts: x.receipts, tree, requiredChecks: ['true'], definitions: defs, ...over });
  assert.equal(v({}).ok, true);
  assert.equal(v({ definitions: [{ name: 'true', argv: ['/usr/bin/true'] }] }).ok, false, 'a receipt earned under another check definition refuses');
  assert.equal(v({ requiredChecks: ['true', 'lint'] }).ok, false);
  assert.equal(v({ tree: 'f'.repeat(40) }).ok, false);
  assert.equal(v({ key: randomBytes(32) }).ok, false, 'a receipt checked under a stale or guessed key refuses');
  x.receipts.set('e'.repeat(40), { tree: 'e'.repeat(40), checks: ['true'], mac: 'deadbeef' });
  assert.equal(v({ tree: 'e'.repeat(40) }).ok, false, 'a planted receipt without the key refuses');
  const scratchSeen = readFileSync(path.join(r.work, 'scratch', 'out'), 'utf8');
  assert.match(scratchSeen, /WORKWRITE/);
});

test('the commit door binds an expected old head, a clean receipt, and refuses a failing check; the push go binds branch AND head', async () => {
  const x = brokerFixture();
  writeFileSync(path.join(x.wt, 'a'), 'v2\n');
  const stale = await commitWithReceipt(x.ctx, commitReq(x, { expectHead: 'a'.repeat(40) }));
  assert.equal(stale.ok, false); assert.match(stale.output, /expected old head/);
  const failing = await commitWithReceipt({ ...x.ctx, checks: [{ name: 'true', argv: ['/usr/bin/false'] }], ...(HAVE_BWRAP ? {} : { checkRunner: async () => ({ ok: false, output: 'check true failed' }) }) }, commitReq(x));
  assert.equal(failing.ok, false); assert.match(failing.output, /check/);
  const head0 = x.git('rev-parse', 'HEAD');
  assert.equal((await commitWithReceipt(x.ctx, commitReq(x))).ok, true);
  const head1 = x.git('rev-parse', 'HEAD'); assert.notEqual(head0, head1);
  writeFileSync(x.goFile, 'lane\n');
  assert.match((await pushWithGo({ ...x.ctx, goFile: x.goFile })).output, /go/);
  writeFileSync(x.goFile, `lane\n${head0}\n`); assert.equal((await pushWithGo({ ...x.ctx, goFile: x.goFile })).ok, false);
  assert.equal(existsSync(x.goFile), false, 'the go spends on the attempt');
  writeFileSync(x.goFile, `other\n${head1}\n`); assert.equal((await pushWithGo({ ...x.ctx, goFile: x.goFile })).ok, false);
  writeFileSync(x.goFile, `lane\n${head1}\n`); assert.equal((await pushWithGo({ ...x.ctx, goFile: x.goFile })).ok, true);
});

// ======================= the Terra HOLD cures =======================
wallTest('P0-2 the receipt key never touches disk: a relay run leaves no key or receipt file anywhere, and the relay takes no key option', () => {
  const x = setup(); writeFileSync(path.join(x.wt, 'a'), 'changed\n');
  x.request('1', { kind: 'commit', message: 'message', paths: ['a'] }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1')));
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '.git' ? [] : e.isDirectory() ? [path.join(d, e.name), ...walk(path.join(d, e.name))] : [path.join(d, e.name)]));
  const files = walk(x.root).concat(walk(x.home));
  assert.deepEqual(files.filter((f) => /key|receipt|\.mac$/i.test(path.basename(f))), [], 'no key or receipt file stands under any path');
  const src = readFileSync(new URL('./commit-relay.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /check-key|receipts-dir|keyFile/);
  assert.match(src, /randomBytes\(32\)/);
});

test('P0-2 a receipt forged from a guessed or stale key refuses', () => {
  const key = randomBytes(32), receipts = new Map();
  const defs = [{ name: 'true', argv: ['/usr/bin/true'] }], tree = 'a'.repeat(40);
  receipts.set(tree, signReceipt({ key: randomBytes(32), tree, checks: ['true'], definitions: defs }));
  assert.equal(verifyReceipt({ key, receipts, tree, requiredChecks: ['true'], definitions: defs }).ok, false, 'signed under another key');
  receipts.set(tree, signReceipt({ key: Buffer.from('guess'.repeat(8)), tree, checks: ['true'], definitions: defs }));
  assert.equal(verifyReceipt({ key, receipts, tree, requiredChecks: ['true'], definitions: defs }).ok, false, 'signed under a guessed key');
  receipts.set(tree, signReceipt({ key, tree, checks: ['true'], definitions: defs }));
  assert.equal(verifyReceipt({ key, receipts, tree, requiredChecks: ['true'], definitions: defs }).ok, true, 'CONTROL the right key verifies');
  assert.throws(() => signReceipt({ key: Buffer.from('short'), tree, checks: ['true'] }), /32 bytes/);
});

wallTest('P1-3 the checked tree is bound read-only: a check that mutates it yields no receipt, and a mutation it swallows still leaves the export unchanged', async () => {
  const x = brokerFixture();
  const tree = x.git('rev-parse', 'HEAD^{tree}');
  const loud = await runCheckSeat({ ...x.ctx, tree, checks: [{ name: 'mutate', argv: ['/usr/bin/sh', '-c', 'echo evil >> /work/tree/a'] }, { name: 'later', argv: ['/usr/bin/true'] }], keepWork: true });
  assert.equal(loud.ok, false); assert.equal(x.receipts.size, 0, 'no receipt');
  const quiet = await runCheckSeat({ ...x.ctx, tree, checks: [{ name: 'swallow', argv: ['/usr/bin/sh', '-c', 'echo evil >> /work/tree/a; echo evil > /work/tree/new; true'] }], keepWork: true });
  assert.equal(quiet.ok, true);
  assert.equal(readFileSync(path.join(quiet.work, 'tree', 'a'), 'utf8'), 'initial\n', 'the export stands as the tree holds it');
  assert.equal(existsSync(path.join(quiet.work, 'tree', 'new')), false);
});

test('P1-4 a worktree parent swapped after validation refuses and leaves nothing outside the lane', async () => {
  const x = brokerFixture();
  const lane = path.join(x.root, 'lane'), parent = path.join(lane, 'p'), outside = path.join(x.root, 'outside');
  mkdirSync(parent, { recursive: true }); mkdirSync(outside);
  const ctx = { ...x.ctx, laneRoot: lane, beforeLink: async () => { rmSync(parent, { recursive: true }); symlinkSync(outside, parent); } };
  const r = await addWorktree(ctx, { path: path.join(parent, 'wt'), branch: 'lane-swap', base: 'HEAD' });
  assert.equal(r.ok, false, JSON.stringify(r)); assert.match(r.output, /parent|outside|changed|link/);
  assert.deepEqual(readdirSync(outside), [], 'nothing landed outside the lane');
  assert.equal(spawnSync('git', ['-C', x.wt, 'rev-parse', '--verify', 'refs/heads/lane-swap']).status, 128, 'the branch was rolled back');
  // the parent renamed away (still a live directory) and a symlink put in its place: the held handle keeps the link inside the lane, the check refuses, the rollback unlinks through the handle
  const moved = path.join(lane, 'p-moved');
  mkdirSync(path.join(lane, 'p2'));
  const ctx3 = { ...x.ctx, laneRoot: lane, beforeLink: async () => { renameSync(path.join(lane, 'p2'), moved); symlinkSync(outside, path.join(lane, 'p2')); } };
  const r3 = await addWorktree(ctx3, { path: path.join(lane, 'p2', 'wt'), branch: 'lane-swap2', base: 'HEAD' });
  assert.equal(r3.ok, false, JSON.stringify(r3)); assert.deepEqual(readdirSync(outside), [], 'nothing landed outside'); assert.deepEqual(readdirSync(moved), [], 'the held directory holds no leftover link');
  // CONTROL: an unswapped parent lands the worktree inside the lane
  const good = await addWorktree({ ...x.ctx, laneRoot: lane }, { path: path.join(lane, 'good'), branch: 'lane-good', base: 'HEAD' });
  assert.equal(good.ok, true, JSON.stringify(good)); assert.equal(readFileSync(path.join(lane, 'good', 'a'), 'utf8'), 'initial\n');
});

test('P2-6 a missing wall refuses by name: the check and the install each say what they declined to run', async () => {
  const x = brokerFixture();
  const c = await runCheckSeat({ ...x.ctx, bwrap: false, tree: x.git('rev-parse', 'HEAD^{tree}'), checks: [{ name: 'lint', argv: ['/usr/bin/true'] }, { name: 'unit', argv: ['/usr/bin/true'] }] });
  assert.equal(c.ok, false); assert.match(c.output, /no wall available/); assert.match(c.output, /lint, unit/);
  const i = await runInstallSeat({ worktree: x.wt, gitDir: x.ctx.gitDir, installer: '/opt/pnpm', storeDir: x.root, iso: x.iso, bwrap: false });
  assert.equal(i.ok, false); assert.match(i.output, /no wall available/); assert.match(i.output, /\/opt\/pnpm/);
});

test('P1-1 the relay request directory is held by handle: swapping `relay` for a symlink after the hold redirects nothing', async () => {
  const x = brokerFixture();
  const lane = path.join(x.root, 'lane'), relay = path.join(lane, 'relay'), outside = path.join(x.root, 'outside');
  mkdirSync(relay, { recursive: true }); mkdirSync(outside);
  const held = await openHeld(relay, lane);
  writeFileSync(held.at('req-1.json'), '{}');
  renameSync(relay, path.join(lane, 'relay-moved')); symlinkSync(outside, relay);
  writeFileSync(held.at('res-1.json'), 'answer');
  assert.deepEqual(readdirSync(outside), [], 'nothing landed outside the lane');
  assert.deepEqual(readdirSync(path.join(lane, 'relay-moved')).sort(), ['req-1.json', 'res-1.json']);
  await held.close();
  // CONTROL: a pathname-based write after the swap WOULD have landed outside
  writeFileSync(path.join(relay, 'res-2.json'), 'x');
  assert.deepEqual(readdirSync(outside), ['res-2.json']);
  await assert.rejects(openHeld(relay, lane), /not a real directory/, 'a symlinked relay dir refuses to open');
  const elsewhere = path.join(x.root, 'elsewhere'); mkdirSync(elsewhere);
  await assert.rejects(openHeld(elsewhere, lane), /outside/, 'a directory outside the root refuses');
});

test('P1-5 the trusted launcher must sit outside the scratch tree entirely', () => {
  const x = setup();
  const inScratch = path.join(x.lane, 'wt', 'launcher.mjs'); writeFileSync(inScratch, '// planted');
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', x.goFile, '--launcher', inScratch, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /launcher must sit outside the scratch tree/);
  const ok = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', x.goFile, '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.equal(ok.status, 0, ok.stderr);
});

test('a worktree the broker made is a first-class lane worktree: the install door resolves its stage, and the registry stands before the link does', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1')));
  const made = JSON.parse(readFileSync(path.join(x.home, 'controller', 'broker-iso', 'made.json'), 'utf8'));
  assert.equal(Object.keys(made)[0], dest);
  x.request('2', { kind: 'install', path: dest }); x.run();
  assert.doesNotMatch(x.response('2').output, /outside lane-root/, 'the install door follows the registry to the stage');
  x.request('3', { kind: 'install', path: path.join(x.lane, 'not-made') }); x.run();
  assert.equal(x.response('3').ok, false);
});

test('P1-1 the broker state dir is checked by real path: a lane named broker-iso under the go dir refuses, and so does a state dir inside the scratch lane tree', () => {
  const x = setup();
  const ctl = path.join(x.root, 'ctl'), lane2 = path.join(ctl, 'broker-iso'), wt2 = path.join(lane2, 'wt');
  mkdirSync(wt2, { recursive: true }); execFileSync('git', ['-C', wt2, 'init', '-q', '-b', 'relay-test']);
  const r = spawnSync(process.execPath, [script, '--lane-root', lane2, '--worktree', wt2, '--branch', 'relay-test', '--go-file', path.join(ctl, 'push-go'), '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /broker state must sit outside the lane root/);
  const inTree = path.join(x.root, 'controller'); mkdirSync(inTree);
  const r2 = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', path.join(inTree, 'push-go'), '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r2.status, 0); assert.match(r2.stderr, /scratch lane tree/);
  const ok = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', x.goFile, '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.equal(ok.status, 0, ok.stderr);
});

test('P1-1 a broker-iso that is a symlink into the lane refuses BEFORE anything is created inside the lane', () => {
  const x = setup();
  const ctl = path.join(home_of(x), 'ctl2'); mkdirSync(ctl);
  mkdirSync(path.join(x.lane, 'inside'));
  symlinkSync(path.join(x.lane, 'inside'), path.join(ctl, 'broker-iso'));
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', path.join(ctl, 'push-go'), '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /broker state must sit outside/);
  assert.deepEqual(readdirSync(path.join(x.lane, 'inside')), [], 'nothing was created inside the lane');
});
const home_of = (x) => x.home;

test('P1-2 a commit message with a lone surrogate or a NUL refuses; a multibyte message under the byte cap commits', async () => {
  const x = brokerFixture(); writeFileSync(path.join(x.wt, 'a'), 'v2\n');
  for (const bad of ['bad \ud800 text', 'nul \0 text']) {
    const r = await commitWithReceipt(x.ctx, commitReq(x, { message: bad }));
    assert.equal(r.ok, false); assert.match(r.output, /well-formed/);
  }
  const r = await commitWithReceipt(x.ctx, commitReq(x, { message: 'lar:/// — café\n' }));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(x.git('log', '-1', '--format=%s'), 'lar:/// — café');
});

test('P2-3 a bad broker-iso with a missing relay/ leaves the lane byte-identical: the placement check runs before ANY create', () => {
  const x = setup();
  rmSync(path.join(x.lane, 'relay'), { recursive: true });
  const ctl = path.join(x.home, 'ctl3'); mkdirSync(ctl);
  mkdirSync(path.join(x.lane, 'inside'));
  symlinkSync(path.join(x.lane, 'inside'), path.join(ctl, 'broker-iso'));
  const snap = (d) => readdirSync(d, { withFileTypes: true, recursive: true }).map((e) => `${e.parentPath ?? e.path}/${e.name}${e.isFile() ? `:${createHash('sha256').update(readFileSync(path.join(e.parentPath ?? e.path, e.name))).digest('hex')}` : ''}`).sort();
  const before = snap(x.lane);
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', path.join(ctl, 'push-go'), '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /broker state must sit outside/);
  assert.deepEqual(snap(x.lane), before, 'the whole lane tree is byte-identical');
  assert.equal(existsSync(path.join(x.lane, 'relay')), false, 'no relay/ was made');
});
