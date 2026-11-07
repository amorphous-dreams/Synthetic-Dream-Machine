import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
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
test('vitest refuses when the test package has no local installation', () => {
  const x = fixture();
  mkdirSync(path.join(x.wt, 'nested'));
  writeFileSync(path.join(x.wt, 'nested', 'package.json'), JSON.stringify({ name: 'nested-fixture' }));
  writeFileSync(path.join(x.wt, 'nested', 'sample.test.mjs'), '');
  const result = x.run({ kind: 'test', runner: 'vitest', files: ['nested/sample.test.mjs'] });
  assert.equal(result.ok, false); assert.match(result.output, /vitest not installed for nested-fixture/);
});
test('a post-execution refusal carries the exit code and bounded stderr tail', () => {
  const x = fixture();
  mkdirSync(path.join(x.wt, 'node_modules', 'vitest'), { recursive: true });
  writeFileSync(path.join(x.wt, 'package.json'), JSON.stringify({ name: 'broken-fixture' }));
  writeFileSync(path.join(x.wt, 'node_modules', 'vitest', 'vitest.mjs'), "process.stderr.write('x'.repeat(3000) + ' END'); process.exitCode = 7;\n");
  const result = x.run({ kind: 'test', runner: 'vitest', files: ['ok.test.mjs'] });
  assert.equal(result.ok, false); assert.equal(result.exitCode, 7);
  assert.match(result.output, /unparseable vitest output/); assert.match(result.output, /exitCode: 7; stderr tail: x+ END$/);
  assert.ok(Buffer.byteLength(result.output.split('stderr tail: ')[1]) <= 2048);
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

test('test door reports passing and failing tallies, with a passing control', () => {
  const x = fixture();
  mkdirSync(path.join(x.wt, 'tally-fixture'));
  writeFileSync(path.join(x.wt, 'tally-fixture', 'pass.test.mjs'), "import { test } from 'node:test'; test('passes', () => {});\n");
  writeFileSync(path.join(x.wt, 'tally-fixture', 'fail.test.mjs'), "import { test } from 'node:test'; import assert from 'node:assert/strict'; test('fails', () => assert.fail('planted failure'));\n");
  const files = ['tally-fixture/pass.test.mjs', 'tally-fixture/fail.test.mjs'];
  const result = x.run(request(files));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.runner, 'node'); assert.deepEqual(result.files, files);
  assert.equal(result.pass, 1); assert.equal(result.fail, 1); assert.equal(result.skip, 0);
  assert.notEqual(result.exitCode, 0);
  assert.equal(typeof result.logTail, 'string'); assert.ok(result.logTail.length <= 16384);
  const control = x.run(request([files[0]]));
  assert.equal(control.ok, true, JSON.stringify(control));
  assert.equal(control.fail, 0); assert.equal(control.exitCode, 0);
});

test('test door runs a named vitest file and reports its passing tally', () => {
  const home = os.homedir();
  const temp = mkdtempSync(path.join(home, 'test-door-vitest-'));
  const lane = mkdtempSync(path.join(home, '.lares-scratch', 'test-door-vitest-'));
  roots.push(temp, lane);
  mkdirSync(path.join(lane, 'relay'));
  const launcher = path.join(temp, 'launcher.mjs'); writeFileSync(launcher, '');
  const checks = path.join(temp, 'checks.json'); writeFileSync(checks, '[]');
  const wt = path.dirname(path.dirname(relay));
  const files = ['packages/lararium-mesh/tests/dyad-atom.test.ts'];
  writeFileSync(path.join(lane, 'relay', 'req-001.json'), JSON.stringify({ kind: 'test', runner: 'vitest', files }));
  const child = spawnSync(process.execPath, [relay, '--lane-root', lane, '--worktree', wt, '--branch', 'test-door', '--launcher', launcher, '--remote-url', path.join(temp, 'remote'), '--checks', checks, '--once'], { encoding: 'utf8', env: { ...process.env, LARES_BROKER_ROOT: path.join(temp, 'broker') } });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(readFileSync(path.join(lane, 'relay', 'res-001.json'), 'utf8'));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.runner, 'vitest'); assert.deepEqual(result.files, files);
  assert.ok(result.pass > 0); assert.equal(result.fail, 0); assert.equal(result.exitCode, 0);
});

test('C1 package directory symlink outside the worktree refuses without disclosing its target', () => {
  const x = fixture(), secret = 'PLANTED-PRIVATE-PACKAGE-CONTENT';
  const outside = path.join(x.home, 'outside'); mkdirSync(outside);
  writeFileSync(path.join(outside, 'package.json'), secret);
  writeFileSync(path.join(outside, 'sample.test.mjs'), '');
  symlinkSync(outside, path.join(x.wt, 'external'));
  const result = x.run({ kind: 'test', runner: 'vitest', files: ['external/sample.test.mjs'] });
  assert.equal(result.ok, false); assert.match(result.output, /symlink/i);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('C1 package.json leaf symlink refuses without disclosing its target', () => {
  const x = fixture(), secret = 'PLANTED-PRIVATE-PACKAGE-CONTENT';
  const outside = path.join(x.home, 'outside-package'); writeFileSync(outside, secret);
  mkdirSync(path.join(x.wt, 'nested'));
  writeFileSync(path.join(x.wt, 'nested', 'sample.test.mjs'), '');
  symlinkSync(outside, path.join(x.wt, 'nested', 'package.json'));
  const result = x.run({ kind: 'test', runner: 'vitest', files: ['nested/sample.test.mjs'] });
  assert.equal(result.ok, false); assert.match(result.output, /symlink|package\.json unreadable/i);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('C1 malformed package.json refuses by name without echoing its contents', () => {
  const x = fixture(), secret = 'PLANTED-PRIVATE-PACKAGE-CONTENT';
  writeFileSync(path.join(x.wt, 'package.json'), secret);
  const result = x.run({ kind: 'test', runner: 'vitest', files: ['ok.test.mjs'] });
  assert.equal(result.ok, false); assert.match(result.output, /package\.json unreadable/i);
  assert.ok(!JSON.stringify(result).includes(secret.slice(0, 10)));
});

test('C2 silent hanging test receives a liveness refusal', () => {
  const x = fixture();
  // The fallback ends the pre-cure run, so controller proof cannot wedge the relay forever.
  writeFileSync(path.join(x.wt, 'hang.test.mjs'), "import { test } from 'node:test'; test('hang', async () => { await new Promise(resolve => setTimeout(resolve, 90000)); });\n");
  const result = x.run(request(['hang.test.mjs']));
  assert.equal(result.ok, false); assert.match(result.output, /liveness: silent \d+s/i);
});

test('C3 test code cannot write into /work/.git', () => {
  const x = fixture();
  writeFileSync(path.join(x.wt, 'git-write.test.mjs'), "import { test } from 'node:test'; import { writeFileSync } from 'node:fs'; test('write git', () => writeFileSync('/work/.git/planted', 'changed'));\n");
  const result = x.run(request(['git-write.test.mjs']));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.fail, 1); assert.notEqual(result.exitCode, 0);
  assert.match(result.logTail, /EACCES|EROFS|permission denied|read-only file system/i);
});

test('C4 empty node test file refuses because no tests ran', () => {
  const x = fixture(); writeFileSync(path.join(x.wt, 'empty.test.mjs'), '');
  const result = x.run(request(['empty.test.mjs']));
  assert.equal(result.ok, false); assert.match(result.output, /no tests ran/i);
});

test('C4 vitest report with zero total tests refuses by name', () => {
  const x = fixture();
  mkdirSync(path.join(x.wt, 'node_modules', 'vitest'), { recursive: true });
  writeFileSync(path.join(x.wt, 'package.json'), JSON.stringify({ name: 'empty-fixture' }));
  writeFileSync(path.join(x.wt, 'empty.test.mjs'), '');
  writeFileSync(path.join(x.wt, 'node_modules', 'vitest', 'vitest.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync('/scratch/vitest.json', JSON.stringify({ numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0 }));\n");
  const result = x.run({ kind: 'test', runner: 'vitest', files: ['empty.test.mjs'] });
  assert.equal(result.ok, false); assert.match(result.output, /no tests ran/i);
});
