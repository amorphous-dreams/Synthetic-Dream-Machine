import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Controller runs: this integration fixture spawns git, the relay and a walled test child.
const relay = fileURLToPath(new URL('./commit-relay.mjs', import.meta.url));
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const home = mkdtempSync(path.join(path.dirname(path.dirname(path.dirname(relay))), 'test-door-home-'));
  roots.push(home);
  const lane = path.join(home, '.lares-scratch', 'lane'), wt = path.join(lane, 'wt');
  mkdirSync(path.join(lane, 'relay'), { recursive: true }); mkdirSync(wt);
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { stdio: 'ignore' });
  git('init', '-b', 'test-door'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(path.join(wt, 'ok.test.mjs'), "import { test } from 'node:test'; test('control', () => {});\n");
  git('add', 'ok.test.mjs'); git('commit', '-m', 'initial');
  const launcher = path.join(home, 'launcher.mjs'); writeFileSync(launcher, '');
  const checks = path.join(home, 'checks.json'); writeFileSync(checks, '[]');
  const run = (request) => {
    writeFileSync(path.join(lane, 'relay', 'req-001.json'), JSON.stringify(request));
    const child = spawnSync(process.execPath, [relay, '--lane-root', lane, '--worktree', wt, '--branch', 'test-door', '--launcher', launcher, '--remote-url', path.join(home, 'remote'), '--checks', checks, '--once'], { encoding: 'utf8', env: { ...process.env, HOME: home } });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(readFileSync(path.join(lane, 'relay', 'res-001.json'), 'utf8'));
    rmSync(path.join(lane, 'relay', 'req-001.json')); rmSync(path.join(lane, 'relay', 'res-001.json'));
    return result;
  };
  return { home, wt, run };
}
const request = files => ({ kind: 'test', runner: 'node', files });
for (const [name, files, refusal] of [
  ['absolute path', ['/tmp/escape.test.mjs'], /absolute path/i],
  ['parent traversal', ['../escape.test.mjs'], /parent traversal/i],
  ['glob', ['*.test.mjs'], /glob/i],
]) {
  test(`test door refuses ${name} by name`, () => {
    const x = fixture(), result = x.run(request(files));
    assert.equal(result.ok, false); assert.match(result.output, refusal);
  });
}
test('test door refuses a symlink escaping the worktree by name', () => {
  const x = fixture(); writeFileSync(path.join(x.home, 'escape.test.mjs'), '');
  symlinkSync(path.join(x.home, 'escape.test.mjs'), path.join(x.wt, 'escape.test.mjs'));
  const result = x.run(request(['escape.test.mjs']));
  assert.equal(result.ok, false); assert.match(result.output, /symlink/i);
});
test('test door refuses an unknown runner by name', () => {
  const x = fixture(), result = x.run({ ...request(['ok.test.mjs']), runner: 'shell' });
  assert.equal(result.ok, false); assert.match(result.output, /unknown runner.*shell/i);
});
test('test door refuses an unknown field by name', () => {
  const x = fixture(), result = x.run({ ...request(['ok.test.mjs']), extra: true });
  assert.equal(result.ok, false); assert.match(result.output, /unknown field.*extra/i);
});
test('docker socket stays absent inside the test namespace; a named control runs', () => {
  const x = fixture();
  writeFileSync(path.join(x.wt, 'socket.test.mjs'), `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
test('docker socket absent', () => assert.equal(existsSync('/var/run/docker.sock'), false));
`);
  const result = x.run(request(['socket.test.mjs', 'ok.test.mjs']));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.pass, 2); assert.equal(result.fail, 0); assert.equal(result.exitCode, 0);
});
