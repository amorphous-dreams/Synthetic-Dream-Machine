import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

test('RED: a storage override outside the marked root seats no test route; CONTROL: the staged root does', () => {
  const temp = mkdtempSync(join(tmpdir(), 'ward-route-boundary-'));
  try {
    const root = join(temp, 'staged');
    const cli = join(temp, 'lares-cli', 'dist', 'src', 'bin', 'lares.js');
    mkdirSync(root, { recursive: true });
    mkdirSync(dirname(cli), { recursive: true });
    writeFileSync(join(root, '.lar-test-scratch'), '');
    const nodeIndex = pathToFileURL(resolve('packages/lararium-node/dist/src/index.js')).href;
    writeFileSync(cli, `import(${JSON.stringify(nodeIndex)}).then(n => console.log(n.wardGathererSeated() ? 'seated' : 'unseated'));\n`);
    const harness = pathToFileURL(resolve('tools/test-ward-route.mjs')).href;
    const run = (...args) => {
      const result = spawnSync(process.execPath, [`--import=${harness}`, cli, 'vessel', 'found', '--root', root, ...args], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    assert.equal(run(), 'seated');
    assert.equal(run('--storage', join(temp, 'outside')), 'unseated');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
