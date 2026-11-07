import { test, afterEach } from 'node:test';
import { wallTest } from './wall-test.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, chmodSync, readdirSync, linkSync, renameSync, realpathSync, statSync, truncateSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { checkBrokerRoot, ensureLaneDir, ensureStageRoot, goPathFor, laneId, checkGrantedRoots } from './broker-root.mjs';
const scratchOf = (home) => path.join(realpathSync(home), '.lares-scratch');
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHeld, openHeldSync } from './held-dir.mjs';
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
  const brokerRoot = path.join(home, '.local/state/lares-broker'); const goFile = goPathFor(brokerRoot, lane);
  const ensureGo = () => ensureLaneDir(brokerRoot, 'go', lane, { realHome: realpathSync(home), guarded: [lane, wt, scratchOf(home)] });
  const launcher = path.join(home, 'launcher.mjs'); writeFileSync(launcher, `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(path.join(root, 'argv.json'))}, JSON.stringify(process.argv.slice(2)));
console.log('SEAT-LAUNCHED 123');
`);
  const bin = path.join(root, 'bin'); mkdirSync(bin); writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\necho pnpm-ok\n', { mode: 0o755 });
  const relayEnv = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` };
  const checksFile = path.join(root, 'checks.json'); writeFileSync(checksFile, JSON.stringify([{ name: 'true', argv: ['/usr/bin/true'] }]));
  const storeDir = path.join(root, 'store'); mkdirSync(storeDir);
  const cacheDir = path.join(root, 'cache'); mkdirSync(cacheDir);
  const brokerArgs = ['--installer', path.join(bin, 'pnpm'), '--store-dir', storeDir, '--cache-dir', cacheDir, '--checks', checksFile, '--author-name', 'Relay', '--author-email', 'relay@example.invalid'];
  const run = () => { const r = spawnSync(process.execPath, [script, '--lane-root', lane, '--worktree', wt, '--branch', 'relay-test', '--launcher', launcher, ...brokerArgs, '--remote-url', remote, '--once'], { encoding: 'utf8', env: relayEnv }); assert.equal(r.status, 0, r.stderr); return r; };
  const response = id => JSON.parse(readFileSync(path.join(lane, 'relay', `res-${id}.json`), 'utf8'));
  const go = value => { ensureGo(); writeFileSync(goFile, value); };
  const goText = (branch, head, dest = remote) => `${laneId(lane)}\n${branch}\n${head}\n${dest}\n`;
  return { home, root, wt, lane, remote, git, request, run, response, go, goText, goFile, launcher, bin, relayEnv, brokerArgs };
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
  const x = setup(); x.go(x.goText('relay-test', x.git('rev-parse', 'HEAD'))); x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1'))); assert.equal(existsSync(x.goFile), false);
  assert.equal(execFileSync('git', ['--git-dir', x.remote, 'rev-parse', 'refs/heads/relay-test'], { encoding: 'utf8' }).trim(), x.git('rev-parse', 'HEAD'));
});
wallTest('requests run in id order, completing each before the next', () => {
  const x = setup(); writeFileSync(path.join(x.wt, 'a'), 'changed\n');
  x.request('02', { kind: 'push' }); x.request('01', { kind: 'commit', message: 'message', paths: ['a'] }); x.go(x.goText('relay-test', x.git('rev-parse', 'HEAD'))); x.run();
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
  x.run();
  for (const id of ['1', '2']) assert.equal(x.response(id).ok, false);
});
test('the worktree door runs no install and no submodule step', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  writeFileSync(path.join(x.bin, 'pnpm'), '#!/bin/sh\ntouch "' + path.join(x.root, 'PNPM-RAN') + '"\nexit 7\n', { mode: 0o755 });
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1'))); assert.equal(existsSync(path.join(x.root, 'PNPM-RAN')), false);
});
test('read launch omits worktree (the launcher, not the relay, refuses a missing brief)', () => {
  const x = setup(), seat = path.join(x.lane, 'seat'); mkdirSync(seat);
  const req = { kind: 'launch', seatDir: seat, model: 'gpt-6-luna', effort: 'medium', mode: 'read' };
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
  const ctx = { ...(HAVE_BWRAP ? {} : { checkRunner: standIn }), laneId: 'lane-x', laneRoot: root, gitDir: path.join(wt, '.git'), worktree: wt, iso, remoteUrl: remote, branch: 'lane', author: { name: 'Broker', email: 'broker@example.invalid' }, receipts, key, requiredChecks: ['true'], checks, bwrap: HAVE_BWRAP };
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
  writeFileSync(x.goFile, `lane-x\nlane\n${x.git('rev-parse', 'HEAD')}\n${x.remote}\n`);
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

wallTest('PROOF 3 hostile lifecycle scripts and .npmrc: the broker has no install door, the install seat refuses hostile config by name and installs with scripts off, copies from the store and never writes it', async () => {
  const x = brokerFixture();
  const src = readFileSync(new URL('./commit-relay.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /pnpm|npm_config|submodule/, 'the relay carries no install or submodule code');
  const pnpmBin = path.join(x.root, 'bin'); mkdirSync(pnpmBin);
  const log = path.join(x.root, 'pnpm.log'), store = path.join(x.root, 'store'); mkdirSync(store);
  const cache = path.join(x.root, 'cache'); mkdirSync(path.join(cache, 'metadata'), { recursive: true }); writeFileSync(path.join(cache, 'metadata', 'pkg.jsonl'), 'META');
  const probe = path.join(x.root, 'probe');
  writeFileSync(path.join(pnpmBin, 'pnpm'), `#!/bin/sh
echo "ARGV $*" > "${log}"
echo "CWD $(pwd)" >> "${log}"
env | grep -E '^(NODE_OPTIONS|npm_config_|GIT_|HOME)=' >> "${log}"
touch "${x.wt}/.git/PWNED" 2>>"${log}" && echo GITWRITE >> "${log}"
touch "${x.goFile}" 2>>"${log}" && echo GOWRITE >> "${log}"
cat "${x.control}/secret" 2>/dev/null | grep -q CONTROLLER-SECRET && echo CTRLREAD >> "${log}"
if touch "${store}/ok" 2>/dev/null; then echo STOREWRITE >> "${log}"; else echo STOREREFUSED >> "${log}"; fi
grep -q META "${cache}/metadata/pkg.jsonl" && echo CACHEREAD >> "${log}"
if echo planted >> "${cache}/metadata/pkg.jsonl" 2>/dev/null; then echo CACHEWRITE >> "${log}"; else echo CACHEREFUSED >> "${log}"; fi
`, { mode: 0o755 });
  writeFileSync(path.join(x.wt, 'package.json'), JSON.stringify({ name: 'p', scripts: { postinstall: `touch ${probe}` } }));
  const seat = { worktree: x.wt, gitDir: x.ctx.gitDir, installer: path.join(pnpmBin, 'pnpm'), storeDir: store, cacheDir: cache, iso: x.iso, extraRw: [x.root], protect: [x.control] };
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
  assert.doesNotMatch(seen, /STOREWRITE/, 'the shared store binds read-only'); assert.match(seen, /STOREREFUSED/, 'CONTROL: the store write was attempted and refused'); assert.match(seen, /--package-import-method=copy/); assert.match(seen, /--ignore-pnpmfile/);
  assert.equal(existsSync(path.join(store, 'ok')), false, 'nothing landed in the store');
  // The metadata cache binds read-only in the same shape: the offline supply-chain check reads it, nothing inside writes it;
  // the store's index opens immutable (frozenStore), since a read-only store refuses pnpm's writable SQLite open.
  assert.match(seen, /CACHEREAD/, 'CONTROL: the metadata cache reads inside the wall'); assert.doesNotMatch(seen, /CACHEWRITE/, 'the metadata cache binds read-only'); assert.match(seen, /CACHEREFUSED/);
  assert.equal(readFileSync(path.join(cache, 'metadata', 'pkg.jsonl'), 'utf8'), 'META', 'the cache bytes stand unchanged');
  assert.match(seen, new RegExp(`--frozen-store .*--store-dir ${store} --cache-dir ${cache}`));
  const noCache = await runInstallSeat({ ...seat, cacheDir: undefined });
  assert.equal(noCache.ok, false); assert.match(noCache.output, /metadata cache dir/, 'a seat without the cache refuses by name'); assert.doesNotMatch(seen, /CTRLREAD/, 'the controller dir reads as empty'); assert.doesNotMatch(seen, /GITWRITE|GOWRITE/, 'the install wrote neither git metadata nor the controller file');
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
  const goOf = (lane, branch, head, dest = x.remote) => `${lane}\n${branch}\n${head}\n${dest}\n`;
  writeFileSync(x.goFile, 'lane\n');
  assert.match((await pushWithGo({ ...x.ctx, goFile: x.goFile })).output, /go/);
  writeFileSync(x.goFile, goOf('lane-x', 'lane', head0)); assert.equal((await pushWithGo({ ...x.ctx, goFile: x.goFile })).ok, false);
  assert.equal(existsSync(x.goFile), false, 'the go spends on the attempt');
  writeFileSync(x.goFile, goOf('lane-x', 'other', head1)); assert.equal((await pushWithGo({ ...x.ctx, goFile: x.goFile })).ok, false);
  writeFileSync(x.goFile, goOf('lane-y', 'lane', head1)); const otherLane = await pushWithGo({ ...x.ctx, goFile: x.goFile });
  assert.equal(otherLane.ok, false); assert.match(otherLane.output, /another lane/);
  writeFileSync(x.goFile, goOf('lane-x', 'lane', head1, 'git@evil.example:x/y.git')); const otherDest = await pushWithGo({ ...x.ctx, goFile: x.goFile });
  assert.equal(otherDest.ok, false); assert.match(otherDest.output, /another remote/);
  writeFileSync(x.goFile, goOf('lane-x', 'lane', head1)); assert.equal((await pushWithGo({ ...x.ctx, goFile: x.goFile })).ok, true);
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

test('P1-4 a worktree parent swapped after validation leaves nothing outside the lane: a removed parent refuses, a renamed one keeps the link in the held directory', async () => {
  const x = brokerFixture();
  const lane = path.join(x.root, 'lane'), parent = path.join(lane, 'p'), outside = path.join(x.root, 'outside');
  mkdirSync(parent, { recursive: true }); mkdirSync(outside);
  const ctx = { ...x.ctx, laneRoot: lane, beforeLink: async () => { rmSync(parent, { recursive: true }); symlinkSync(outside, parent); } };
  const r = await addWorktree(ctx, { path: path.join(parent, 'wt'), branch: 'lane-swap', base: 'HEAD' });
  assert.equal(r.ok, false, JSON.stringify(r)); assert.match(r.output, /parent|outside|changed|link/);
  assert.deepEqual(readdirSync(outside), [], 'nothing landed outside the lane');
  assert.equal(spawnSync('git', ['-C', x.wt, 'rev-parse', '--verify', 'refs/heads/lane-swap']).status, 128, 'the branch was rolled back');
  // the parent renamed away (still a live directory) and a symlink put in its place: the link is made through the HELD handle, so it stands in the held (moved) directory and nothing reaches the symlink's target
  const moved = path.join(lane, 'p-moved');
  mkdirSync(path.join(lane, 'p2'));
  const ctx3 = { ...x.ctx, laneRoot: lane, beforeLink: async () => { renameSync(path.join(lane, 'p2'), moved); symlinkSync(outside, path.join(lane, 'p2')); } };
  const r3 = await addWorktree(ctx3, { path: path.join(lane, 'p2', 'wt'), branch: 'lane-swap2', base: 'HEAD' });
  assert.equal(r3.ok, true, JSON.stringify(r3)); assert.deepEqual(readdirSync(outside), [], 'nothing landed outside'); assert.deepEqual(readdirSync(moved), ['wt'], 'the link stands in the held directory');
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

test('a FIFO planted at a request name refuses by name and never stalls the broker; CONTROL a regular request beside it answers', () => {
  const x = setup();
  x.request('1', { kind: 'push' });
  execFileSync('mkfifo', [path.join(x.lane, 'relay', 'req-2.json')]);
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv, timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.signal, null, 'the broker returned on its own, never killed by the bound');
  assert.equal(r.status, 0, r.stderr);
  const fifo = x.response('2');
  assert.equal(fifo.ok, false); assert.match(fifo.output, /req-2\.json: not a regular file \(fifo\)/);
  const control = x.response('1');
  assert.equal(control.ok, false); assert.match(control.output, /go/i, 'the regular request reached its door');
  assert.doesNotMatch(control.output, /not a regular file/);
});

test('RED: a request file over 1 MiB refuses by size before any read; CONTROL a regular request beside it answers', () => {
  const x = setup();
  x.request('1', { kind: 'push' });
  const big = path.join(x.lane, 'relay', 'req-2.json'); writeFileSync(big, ''); truncateSync(big, 2 * 1024 * 1024); // sparse: no disk spent
  x.run();
  const refused = x.response('2');
  assert.equal(refused.ok, false); assert.match(refused.output, /req-2\.json: 2097152 bytes, over the 1048576-byte request limit/);
  assert.match(x.response('1').output, /go/i, 'CONTROL: the regular request reached its door');
});

test('RED: the install door names each missing flag; CONTROL a configured relay reaches the install seat', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  const bare = x.brokerArgs.filter((arg, i, all) => !['--cache-dir', '--store-dir'].includes(arg) && !['--cache-dir', '--store-dir'].includes(all[i - 1]));
  x.request('2', { kind: 'install', path: dest });
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--launcher', x.launcher, ...bare, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.equal(r.status, 0, r.stderr);
  assert.match(x.response('2').output, /install is not configured: the relay needs --store-dir, --cache-dir/);
  x.request('3', { kind: 'install', path: dest }); x.run();
  assert.doesNotMatch(x.response('3').output, /not configured/, 'CONTROL: the configured relay reaches the seat');
});

test('P1-5 the trusted launcher must sit outside the scratch tree entirely', () => {
  const x = setup();
  const inScratch = path.join(x.lane, 'wt', 'launcher.mjs'); writeFileSync(inScratch, '// planted');
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--launcher', inScratch, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /launcher must sit outside the scratch tree/);
  const ok = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, '--once'], { encoding: 'utf8', env: x.relayEnv });
  assert.equal(ok.status, 0, ok.stderr);
});

test('a worktree the broker made is a first-class lane worktree: the install door resolves its stage, and the registry stands before the link does', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1')));
  const made = JSON.parse(readFileSync(path.join(x.home, '.local/state/lares-broker/iso', laneId(x.lane), 'made.json'), 'utf8'));
  assert.equal(Object.keys(made)[0], dest);
  x.request('2', { kind: 'install', path: dest }); x.run();
  assert.doesNotMatch(x.response('2').output, /outside lane-root/, 'the install door follows the registry to the stage');
  x.request('3', { kind: 'install', path: path.join(x.lane, 'not-made') }); x.run();
  assert.equal(x.response('3').ok, false);
});



test('P1-2 a commit message with a lone surrogate or a NUL refuses; a multibyte message under the byte cap commits', async () => {
  const x = brokerFixture(); writeFileSync(path.join(x.wt, 'a'), 'v2\n');
  for (const bad of ['bad \ud800 text', 'nul \0 text']) {
    const r = await commitWithReceipt(x.ctx, commitReq(x, { message: bad }));
    assert.equal(r.ok, false); assert.match(r.output, /well-formed/);
  }
  const r = await commitWithReceipt(x.ctx, commitReq(x, { message: 'lar:/// — café\n' }));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(x.git('log', '-1', '--format=%s'), 'lar:/// — café');
});


const relayRun = (x, env = {}, extra = []) => spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--launcher', x.launcher, ...x.brokerArgs, '--remote-url', x.remote, ...extra, '--once'], { encoding: 'utf8', env: { ...x.relayEnv, ...env } });

test('P1 the go and the broker state live under the ONE fixed broker root: a root anywhere under ~/.lares-scratch (another lane included), a symlinked component, a 0755 root and a group-writable ancestor each refuse; CONTROL passes', () => {
  const x = setup();
  const scratch = scratchOf(x.home);
  const otherLane = path.join(scratch, 'other-lane'); mkdirSync(otherLane);
  let r = relayRun(x, { LARES_BROKER_ROOT: path.join(otherLane, 'broker') });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /outside .*\.lares-scratch entirely/);
  assert.equal(existsSync(path.join(otherLane, 'broker')), false, 'nothing was created in the other lane');
  const real = path.join(x.home, 'realdir'); mkdirSync(real, { mode: 0o700 }); symlinkSync(real, path.join(x.home, 'linked'));
  r = relayRun(x, { LARES_BROKER_ROOT: path.join(x.home, 'linked', 'broker') });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /not a real directory/);
  const open = path.join(x.home, 'open'); mkdirSync(open); chmodSync(open, 0o755);
  r = relayRun(x, { LARES_BROKER_ROOT: open });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /mode 0700/);
  const wide = path.join(x.home, 'wide'); mkdirSync(wide); chmodSync(wide, 0o777); mkdirSync(path.join(wide, 'broker'), { mode: 0o700 });
  r = relayRun(x, { LARES_BROKER_ROOT: path.join(wide, 'broker') });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /group- or world-writable/);
  r = relayRun(x);
  assert.equal(r.status, 0, r.stderr);
  const root = path.join(realpathSync(x.home), '.local/state/lares-broker');
  for (const part of ['seats', 'go', 'iso']) assert.equal(statSync(path.join(root, part)).mode & 0o777, 0o700, `${part} is 0700`);
  assert.ok(existsSync(path.join(root, 'go', laneId(x.lane))) && existsSync(path.join(root, 'iso', laneId(x.lane))));
});

test('P1 no caller names the go or the state path: --go-file is an unknown option, and a bad root with a missing relay/ leaves the lane byte-identical', () => {
  const x = setup();
  let r = relayRun(x, {}, ['--go-file', '/tmp/x']);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /invalid argument: --go-file/);
  rmSync(path.join(x.lane, 'relay'), { recursive: true });
  const snap = (d) => readdirSync(d, { withFileTypes: true, recursive: true }).map((e) => `${e.parentPath ?? e.path}/${e.name}${e.isFile() ? `:${createHash('sha256').update(readFileSync(path.join(e.parentPath ?? e.path, e.name))).digest('hex')}` : ''}`).sort();
  const before = snap(x.lane);
  const otherLane = path.join(scratchOf(x.home), 'other-lane'); mkdirSync(otherLane);
  r = relayRun(x, { LARES_BROKER_ROOT: path.join(otherLane, 'broker') });
  assert.notEqual(r.status, 0);
  assert.deepEqual(snap(x.lane), before, 'the whole lane tree is byte-identical');
  assert.equal(existsSync(path.join(x.lane, 'relay')), false);
});

test('the controller go tool writes under the broker root, refuses a root under scratch, and the relay spends what it wrote', () => {
  const x = setup();
  const tool = fileURLToPath(new URL('./push-go.mjs', import.meta.url));
  const head = x.git('rev-parse', 'HEAD');
  const w = spawnSync(process.execPath, [tool, '--lane-root', x.lane, '--branch', 'relay-test', '--head', head, '--remote-url', x.remote], { encoding: 'utf8', env: x.relayEnv });
  assert.equal(w.status, 0, w.stderr);
  assert.equal(readFileSync(x.goFile, 'utf8'), x.goText('relay-test', head));
  const bad = spawnSync(process.execPath, [tool, '--lane-root', x.lane, '--branch', 'relay-test', '--head', head, '--remote-url', x.remote], { encoding: 'utf8', env: { ...x.relayEnv, LARES_BROKER_ROOT: path.join(scratchOf(x.home), 'other', 'b') } });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /push-go refused/);
  x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').ok, true, JSON.stringify(x.response('1')));
  assert.equal(existsSync(x.goFile), false, 'the go spends on the attempt');
});

test('P1 lane identity is a digest of the real path: two lanes sharing a base name get separate go and state, and neither consumes the other\'s go', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lanes-')); roots.push(dir);
  const a = path.join(dir, 'a', 'lane'), b = path.join(dir, 'b', 'lane'); mkdirSync(a, { recursive: true }); mkdirSync(b, { recursive: true });
  assert.notEqual(laneId(a), laneId(b)); assert.match(laneId(a), /^lane-[0-9a-f]{16}$/);
  assert.equal(laneId(a), laneId(a), 'stable');
  assert.notEqual(goPathFor('/r', a), goPathFor('/r', b));
  const viaLink = path.join(dir, 'link'); symlinkSync(a, viaLink);
  assert.equal(laneId(viaLink), laneId(a), 'a symlink to the lane is the same lane');
});

test('P1 a go for ANOTHER lane or another remote refuses at the relay, and the go spends: CONTROL the matching go pushes', () => {
  const x = setup(); const head = x.git('rev-parse', 'HEAD');
  x.go(x.goText('relay-test', head, 'git@evil.example:x/y.git')); x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').ok, false); assert.match(x.response('1').output, /another remote/); assert.equal(existsSync(x.goFile), false);
  x.go(`lane-0000000000000000\nrelay-test\n${head}\n${x.remote}\n`); x.request('2', { kind: 'push' }); x.run();
  assert.equal(x.response('2').ok, false); assert.match(x.response('2').output, /another lane/);
  x.go(x.goText('relay-test', head)); x.request('3', { kind: 'push' }); x.run();
  assert.equal(x.response('3').ok, true, JSON.stringify(x.response('3')));
});

test('P1 the worktree staging parent is verified like the broker root: a symlinked component, a 0755 parent and a group-writable scratch refuse; CONTROL creates it 0700', () => {
  const x = setup(); const scratch = scratchOf(x.home);
  const link = path.join(scratch, '.broker-worktrees'); const real = path.join(x.home, 'elsewhere'); mkdirSync(real, { mode: 0o700 }); symlinkSync(real, link);
  let r = relayRun(x); assert.notEqual(r.status, 0); assert.match(r.stderr, /not a real directory/);
  rmSync(link); mkdirSync(link, { mode: 0o755 }); chmodSync(link, 0o755);
  r = relayRun(x); assert.notEqual(r.status, 0); assert.match(r.stderr, /must be mode 0700/);
  rmSync(link, { recursive: true });
  r = relayRun(x); assert.equal(r.status, 0, r.stderr);
  assert.equal(statSync(link).mode & 0o777, 0o700); assert.equal(statSync(path.join(link, laneId(x.lane))).mode & 0o777, 0o700);
  assert.equal(ensureStageRoot(scratch, laneId(x.lane)), path.join(link, laneId(x.lane)));
});

test('P1 granted roots stand clear of the staging tree: the scratch dir, .broker-worktrees, its lane dir and a wt-<rand> parent refuse; the EXACT made worktree passes', () => {
  const scratch = '/h/.lares-scratch', st = `${scratch}/.broker-worktrees`;
  for (const bad of [scratch, st, `${st}/lane-abc`, `${st}/lane-abc/wt-X1`, `${st}/lane-abc/wt-X1/wt/sub`, `${st}/lane-abc/other`]) assert.throws(() => checkGrantedRoots(scratch, [bad]), /broker's worktree staging tree/, bad);
  assert.doesNotThrow(() => checkGrantedRoots(scratch, [`${st}/lane-abc/wt-X1/wt`, `${scratch}/lane/wt`]));
});

test('P1 the install wall binds the HELD worktree: a parent swapped after the hold leaves the install writing into the held directory and nothing outside; the same fd is what the wall gets', async (t) => {
  if (!HAVE_BWRAP && !process.env.CI) return t.skip('no bubblewrap on this host (local run)');
  assert.ok(HAVE_BWRAP, 'bubblewrap is required on CI');
  const x = brokerFixture();
  const lane = path.join(x.root, 'lane'), wt = path.join(lane, 'wt2'), outside = path.join(x.root, 'outside'), moved = path.join(lane, 'wt2-moved');
  mkdirSync(wt, { recursive: true }); mkdirSync(outside); writeFileSync(path.join(wt, '.npmrc'), 'registry=https://registry.npmjs.org/\n');
  const store = path.join(x.root, 'store2'); mkdirSync(store);
  const cache = path.join(x.root, 'cache2'); mkdirSync(cache);
  const installer = path.join(x.root, 'inst'); mkdirSync(installer);
  writeFileSync(path.join(installer, 'pnpm'), '#!/bin/sh\necho BOUND > "$PWD/bound-marker"\n', { mode: 0o755 });
  const held = openHeldSync(wt, lane);
  renameSync(wt, moved); symlinkSync(outside, wt); // the swap, AFTER validation and the hold
  const r = await runInstallSeat({ worktreeHeld: held, gitDir: x.ctx.gitDir, installer: path.join(installer, 'pnpm'), storeDir: store, cacheDir: cache, iso: x.iso, protect: [x.control] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(readdirSync(outside), [], 'nothing reached the swapped path target');
  assert.equal(readFileSync(path.join(moved, 'bound-marker'), 'utf8'), 'BOUND\n', 'the install ran in the held directory');
  held.close();
});

wallTest('RED: a silent installer ends on the named liveness bound and refuses; CONTROL a chatty installer completes', async () => {
  const x = brokerFixture();
  const wt = path.join(x.root, 'wt-live'); mkdirSync(wt);
  const cache = path.join(x.root, 'cache-live'), store = path.join(x.root, 'store-live'); mkdirSync(cache); mkdirSync(store);
  const bin = path.join(x.root, 'bin-live'); mkdirSync(bin);
  const seat = { worktree: wt, gitDir: x.ctx.gitDir, installer: path.join(bin, 'pnpm'), storeDir: store, cacheDir: cache, iso: x.iso, protect: [], silenceSeconds: 2 };
  writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\necho progress\n', { mode: 0o755 });
  const done = await runInstallSeat(seat);
  assert.equal(done.ok, true, JSON.stringify(done)); assert.match(done.output, /progress/);
  writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\nexec sleep 600\n', { mode: 0o755 });
  const t0 = Date.now();
  const hung = await runInstallSeat(seat);
  assert.equal(hung.ok, false); assert.match(hung.output, /refused: install liveness: silent 2s/);
  assert.ok(Date.now() - t0 < 30000, 'the bound ended the wait');
});

test('P1 a symlinked .npmrc refuses by name BEFORE any read: an outside file with a hostile key is never opened', async () => {
  const x = brokerFixture();
  const wt = path.join(x.root, 'wt3'), outside = path.join(x.root, 'outside-npmrc');
  mkdirSync(wt); writeFileSync(outside, 'script-shell=/evil\n'); symlinkSync(outside, path.join(wt, '.npmrc'));
  const r = await runInstallSeat({ worktree: wt, gitDir: x.ctx.gitDir, installer: '/opt/pnpm', storeDir: x.root, iso: x.iso, protect: [] });
  assert.equal(r.ok, false); assert.match(r.output, /\.npmrc refused.*symlink/); assert.doesNotMatch(r.output, /script-shell|evil/, 'the outside content never reached the response');
});

test('P2 the staging parent refuses a group- or world-writable scratch (and home); CONTROL a 0755 scratch passes', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'stagehome-')); roots.push(home);
  const scratch = path.join(home, '.lares-scratch'); mkdirSync(scratch, { mode: 0o755 }); chmodSync(scratch, 0o755); chmodSync(home, 0o700);
  assert.ok(ensureStageRoot(scratch, 'lane-aaaaaaaaaaaaaaaa'), 'CONTROL passes');
  chmodSync(scratch, 0o775);
  assert.throws(() => ensureStageRoot(scratch, 'lane-bbbbbbbbbbbbbbbb'), /scratch|group- or world-writable/);
  chmodSync(scratch, 0o757);
  assert.throws(() => ensureStageRoot(scratch, 'lane-cccccccccccccccc'), /world-writable/);
  chmodSync(scratch, 0o755); chmodSync(home, 0o770);
  assert.throws(() => ensureStageRoot(scratch, 'lane-dddddddddddddddd'), /group- or world-writable/, 'a writable home refuses too');
  chmodSync(home, 0o700);
  assert.doesNotThrow(() => checkBrokerRoot(path.join(home, '.local/state/lares-broker'), { realHome: home }), 'CONTROL a 0700 home passes the root verifier');
  chmodSync(home, 0o770);
  assert.throws(() => checkBrokerRoot(path.join(home, '.local/state/lares-broker'), { realHome: home }), /group- or world-writable/, 'the root verifier refuses a writable home');
  chmodSync(home, 0o700);
});

test('ACCESS WITNESS: no fs call in the four broker files names a non-held path; each goes through a held handle (.at / /proc/self/fd) or carries the broker-owned mark; a KNOWN POSITIVE reads red', () => {
  const calls = /(?<![.\w])(readFileSync|readFile|writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|mkdir|mkdtempSync|mkdtemp|renameSync|rename|unlinkSync|unlink|rmSync|rmdirSync|symlinkSync|symlink|readdirSync|readdir|statSync|stat|lstatSync|lstat|realpathSync|realpath|existsSync|openSync|open|readlinkSync|readlink|copyFileSync|copyFile|chmodSync|ftruncateSync)\(/;
  const ok = /\.at\(|\/proc\/self\/fd|\/\/ broker-owned/;
  const offenders = [];
  for (const f of ['commit-relay', 'seat-broker', 'seat-walls', 'tree-export']) {
    readFileSync(new URL(`./${f}.mjs`, import.meta.url), 'utf8').split('\n').forEach((l, i) => { const t = l.trim(); if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return; if (calls.test(l) && !ok.test(l)) offenders.push(`${f}:${i + 1} ${t.slice(0, 90)}`); });
  }
  assert.deepEqual(offenders, []);
  for (const planted of ["const x = await readFile(join(worktree, '.npmrc'), 'utf8');", "if (existsSync(npmrc)) {", "args.push('--bind', worktree, worktree); realpathSync(worktree);"]) assert.ok(calls.test(planted) && !ok.test(planted), `the scan reads a planted pathname access: ${planted}`);
  assert.ok(!calls.test("const st = await fh.stat();"), 'a method on a held fd handle is not a pathname access');
});

test('RED: a receipt planted during a request reports the clash and processes the next request', () => {
  const x = setup(), seat = path.join(x.lane, 'seat'); mkdirSync(seat);
  const planted = path.join(x.lane, 'relay', 'res-1.json');
  writeFileSync(x.launcher, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(planted)}, 'planted'); console.log('launched');`);
  x.request('1', { kind: 'launch', seatDir: seat, model: 'gpt-6.1-terra', effort: 'high', mode: 'read' });
  x.request('2', { kind: 'unknown' });
  const result = x.run();
  assert.match(result.stderr, /receipt-clash.*res-1.json/);
  assert.equal(readFileSync(planted, 'utf8'), 'planted');
  assert.match(x.response('2').output, /unknown kind/);
});
