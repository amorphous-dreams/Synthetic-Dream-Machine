import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./commit-relay.mjs', import.meta.url));
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function setup() {
  const root = mkdtempSync(path.join(path.dirname(path.dirname(path.dirname(script))), 'relay-test-')); roots.push(root);
  const lane = path.join(root, 'lane'), wt = path.join(lane, 'wt'), remote = path.join(root, 'remote.git');
  mkdirSync(path.join(lane, 'relay'), { recursive: true }); mkdirSync(wt);
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'relay-test'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(path.join(wt, 'a'), 'initial\n'); writeFileSync(path.join(wt, 'b'), 'initial\n');
  git('add', 'a', 'b'); git('commit', '-m', 'initial');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' }); git('remote', 'add', 'origin', remote);
  writeFileSync(path.join(lane, 'message'), 'relay test\n');
  const request = (id, data) => writeFileSync(path.join(lane, 'relay', `req-${id}.json`), typeof data === 'string' ? data : JSON.stringify(data));
  const goDir = path.join(root, 'controller'); mkdirSync(goDir); const goFile = path.join(goDir, 'push-go');
  const launcher = path.join(root, 'launcher.mjs'); writeFileSync(launcher, `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(path.join(root, 'argv.json'))}, JSON.stringify(process.argv.slice(2)));
console.log('SEAT-LAUNCHED 123');
`);
  const bin = path.join(root, 'bin'); mkdirSync(bin); writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\necho pnpm-ok\n', { mode: 0o755 });
  const run = () => { const r = spawnSync(process.execPath, [script, '--lane-root', lane, '--worktree', wt, '--branch', 'relay-test', '--go-file', goFile, '--launcher', launcher, '--once'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }); assert.equal(r.status, 0, r.stderr); };
  const response = id => JSON.parse(readFileSync(path.join(lane, 'relay', `res-${id}.json`), 'utf8'));
  const go = value => writeFileSync(goFile, value);
  return { root, wt, lane, remote, git, request, run, response, go, goFile, launcher, bin };
}

test('commit selects only requested paths', () => {
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
  assert.equal(x.response('1').ok, false); assert.equal(existsSync(x.goFile), true);
  assert.equal(spawnSync('git', ['--git-dir', x.remote, 'rev-parse', '--verify', 'refs/heads/relay-test']).status, 128);
});
test('push with matching go succeeds and consumes go', () => {
  const x = setup(); x.go('relay-test\n'); x.request('1', { kind: 'push' }); x.run();
  assert.equal(x.response('1').ok, true); assert.equal(existsSync(x.goFile), false);
  assert.equal(execFileSync('git', ['--git-dir', x.remote, 'rev-parse', 'refs/heads/relay-test'], { encoding: 'utf8' }).trim(), x.git('rev-parse', 'HEAD'));
});
test('requests run in id order, completing each before the next', () => {
  const x = setup(); writeFileSync(path.join(x.wt, 'a'), 'changed\n');
  x.request('02', { kind: 'push' }); x.request('01', { kind: 'commit', message: 'message', paths: ['a'] }); x.go('relay-test\n'); x.run();
  assert.equal(x.response('01').ok, true); assert.equal(x.response('02').ok, true);
  assert.equal(execFileSync('git', ['--git-dir', x.remote, 'rev-parse', 'refs/heads/relay-test'], { encoding: 'utf8' }).trim(), x.git('rev-parse', 'HEAD'));
});
test('bad JSON, unknown kinds, and outside message refuse', () => {
  const x = setup(); x.request('1', '{'); x.request('2', { kind: 'other' }); x.request('3', { kind: 'commit', message: '../remote.git', paths: ['a'] }); x.run();
  for (const id of ['1', '2', '3']) assert.equal(x.response(id).ok, false);
  assert.match(x.response('2').output, /unknown kind/); assert.match(x.response('3').output, /outside/);
});

test('a go file inside the lane root refuses to start, so a lead can never grant its own push', () => {
  const x = setup();
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', path.join(x.lane, 'relay', 'push-go'), '--launcher', x.launcher, '--once'], { encoding: 'utf8' });
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
  assert.match(x.response('3').output, /pnpm-ok/);
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
test('failed installation reports the failed step and stops', () => {
  const x = setup(), dest = path.join(x.lane, 'builder');
  writeFileSync(path.join(x.bin, 'pnpm'), '#!/bin/sh\necho install-failed\nexit 7\n', { mode: 0o755 });
  x.request('1', { kind: 'worktree', path: dest, branch: 'relay-test-build', base: 'HEAD' }); x.run();
  assert.equal(x.response('1').ok, false); assert.match(x.response('1').output, /submodule update:/);
  assert.match(x.response('1').output, /install-failed/);
});
test('read launch omits worktree and requires a brief', () => {
  const x = setup(), seat = path.join(x.lane, 'seat'); mkdirSync(seat);
  const req = { kind: 'launch', seatDir: seat, model: 'gpt-6-luna', effort: 'medium', mode: 'read' };
  x.request('1', req); x.run(); assert.equal(x.response('1').ok, false);
  writeFileSync(path.join(seat, 'brief.md'), 'brief'); x.request('2', req); x.run();
  assert.equal(x.response('2').ok, true);
  assert.deepEqual(JSON.parse(readFileSync(path.join(x.root, 'argv.json'), 'utf8')), ['--seat-dir', seat, '--model', 'gpt-6-luna', '--effort', 'medium', '--mode', 'read']);
});
