import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./commit-relay.mjs', import.meta.url));
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function setup() {
  const root = mkdtempSync(path.join(path.dirname(path.dirname(script)), 'relay-test-')); roots.push(root);
  const wt = path.join(root, 'wt'), lane = path.join(root, 'lane'), remote = path.join(root, 'remote.git');
  mkdirSync(wt); mkdirSync(path.join(lane, 'relay'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'relay-test'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(path.join(wt, 'a'), 'initial\n'); writeFileSync(path.join(wt, 'b'), 'initial\n');
  git('add', 'a', 'b'); git('commit', '-m', 'initial');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' }); git('remote', 'add', 'origin', remote);
  writeFileSync(path.join(lane, 'message'), 'relay test\n');
  const request = (id, data) => writeFileSync(path.join(lane, 'relay', `req-${id}.json`), typeof data === 'string' ? data : JSON.stringify(data));
  const goDir = path.join(root, 'controller'); mkdirSync(goDir); const goFile = path.join(goDir, 'push-go');
  const run = () => { const r = spawnSync(process.execPath, [script, '--lane-root', lane, '--worktree', wt, '--branch', 'relay-test', '--go-file', goFile, '--once'], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  const response = id => JSON.parse(readFileSync(path.join(lane, 'relay', `res-${id}.json`), 'utf8'));
  const go = value => writeFileSync(goFile, value);
  return { root, wt, lane, remote, git, request, run, response, go, goFile };
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
  const x = setup(); x.request('1', '{'); x.request('2', { kind: 'other' }); x.request('3', { kind: 'commit', message: '../wt/a', paths: ['a'] }); x.run();
  for (const id of ['1', '2', '3']) assert.equal(x.response(id).ok, false);
  assert.match(x.response('2').output, /unknown kind/); assert.match(x.response('3').output, /outside/);
});

test('a go file inside the lane root refuses to start, so a lead can never grant its own push', () => {
  const x = setup();
  const r = spawnSync(process.execPath, [script, '--lane-root', x.lane, '--worktree', x.wt, '--branch', 'relay-test', '--go-file', path.join(x.lane, 'relay', 'push-go'), '--once'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /go-file must sit outside the lane root/);
});
