import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const read = (file) => readFileSync(resolve(file), 'utf8');
const seat = '--import=file:///app/tools/test-ward-route.mjs';

test('later witness calls use the same guard and retain existing Node options', () => {
  for (const [staged, signal] of [[true, true], [true, false], [false, true], [false, false]]) {
    const result = spawnSync('sh', ['tools/test-container-route.sh', 'sh', '-c', 'printf "%s" "$NODE_OPTIONS"'], {
      encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--trace-warnings',
        LAR_STAGE_DIR: staged ? '/state' : '', LARES_TEST_FOUNDING: signal ? '1' : '' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `--trace-warnings${staged && signal ? ` ${seat}` : ''}`);
  }
});

test('a staged mesh founding refuses without the seat; the same founding succeeds with the import', () => {
  const root = mkdtempSync(join(tmpdir(), 'mesh-founding-control-'));
  const env = { ...process.env, NODE_OPTIONS: '', LAR_ROOT: root };
  delete env.LAR_BAGS;
  try {
    cpSync(resolve('genesis'), join(root, 'genesis'), { recursive: true });
    for (const tool of ['test-scratch-marker.mjs', 'seed-test-custody.mjs']) {
      const seeded = spawnSync(process.execPath, [`tools/${tool}`, root], { env, encoding: 'utf8', timeout: 30_000 });
      assert.equal(seeded.status, 0, seeded.stderr);
    }
    const args = ['packages/lares-cli/dist/src/bin/lares.js', 'vessel', 'found', '--skip-build', '--json'];
    const refused = spawnSync(process.execPath, args, { env, encoding: 'utf8', timeout: 30_000 });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stdout + refused.stderr, /CardReadBackRefused/);
    const seated = spawnSync(process.execPath, [`--import=${pathToFileURL(resolve('tools/test-ward-route.mjs')).href}`, ...args],
      { env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(seated.status, 0, seated.stdout + seated.stderr);
    assert.ok(existsSync(join(root, 'data/lares/vessel/social-bootstrap.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('every container staged founding calls the one guarded harness route', () => {
  const helper = 'tools/test-container-route.sh';
  assert.ok(existsSync(helper), 'one shared, test-only founding route must carry the import');
  assert.equal(read(helper).split(seat).length - 1, 1);
  for (const file of ['tools/lararium-container-boot.sh', 'tools/mesh-found-lararium.sh', 'docker-compose.browser-ci.yml']) {
    const source = read(file);
    assert.match(source, /\. tools\/test-container-route\.sh/);
    const foundings = source.split('\n').filter((line) => !line.trim().startsWith('#') && line.includes('vessel found'));
    assert.ok(foundings.length > 0, file);
    for (const line of foundings) assert.match(line, /test_container_route node .*vessel found/, `${file}: ${line}`);
  }
  const mesh = read('docker-compose.mesh.yml');
  assert.match(mesh, /x-test-founding: &test-founding\n  LAR_STAGE_DIR: "\/state"\n  LARES_TEST_FOUNDING: "1"/);
  assert.equal((mesh.match(/<<: \*test-founding/g) ?? []).length, 5, 'both hearths and all three Herm foundings inherit the same test signal');
  assert.doesNotMatch(mesh, /NODE_OPTIONS:/, 'no process-wide seat in the compose');
  for (const file of ['Dockerfile', 'docker-compose.yml', 'docker-compose.surface.yml']) {
    assert.doesNotMatch(read(file), /LARES_TEST_FOUNDING|test-container-route|test-ward-route/);
  }
});

// Execute the real boot branches with a recorder in place of Node. No daemon or Docker starts.
for (const face of ['', 'keeper']) {
  for (const [staged, signal] of [[true, true], [true, false], [false, true], [false, false]]) {
    test(`boot ${face ? 'hearth' : 'Herm'}: staged=${staged}, test signal=${signal}`, () => {
      const temp = mkdtempSync(join(tmpdir(), 'container-founding-seat-'));
      try {
        const log = join(temp, 'calls.jsonl');
        writeFileSync(join(temp, 'recorder.cjs'), `
const fs = require('node:fs');
fs.appendFileSync(process.env.SEAT_CALL_LOG, JSON.stringify({ args: process.argv.slice(2), options: process.env.SEAT_NODE_OPTIONS ?? '' }) + '\\n');
if (process.argv.includes('found')) console.log('{"data":{"cards":[]}}');
`);
        writeFileSync(join(temp, 'node'), `#!/bin/sh\nSEAT_NODE_OPTIONS="$NODE_OPTIONS" NODE_OPTIONS= exec '${process.execPath}' '${join(temp, 'recorder.cjs')}' "$@"\n`, { mode: 0o755 });
        const result = spawnSync('sh', ['tools/lararium-container-boot.sh'], {
          encoding: 'utf8', timeout: 10_000,
          env: { ...process.env, PATH: `${temp}:${process.env.PATH}`, NODE_OPTIONS: '',
            LAR_ROOT: join(temp, 'root'), LAR_STAGE_DIR: staged ? temp : '',
            LARES_TEST_FOUNDING: signal ? '1' : '', LAR_STAND_FACE: face,
            LAR_STAND_KAHU: '', SEAT_CALL_LOG: log },
        });
        assert.equal(result.status, 0, result.stderr);
        const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
        const foundings = calls.filter(({ args }) => args.includes('found'));
        assert.equal(foundings.length, 1);
        assert.equal(foundings[0].options.includes(seat), staged && signal,
          'the founding import requires both a staged branch and the harness signal');
        assert.ok(calls.filter(({ args }) => !args.includes('found')).every(({ options }) => !options.includes(seat)),
          'marker, custody seeder, unlocker and daemon inherit no founding seat');
      } finally { rmSync(temp, { recursive: true, force: true }); }
    });
  }
}
