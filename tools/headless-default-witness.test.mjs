import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const witness = join(root, 'tools/headless-default-witness.mjs');
const run = (...args) => spawnSync(process.execPath, [witness, ...args], { encoding: 'utf8' });

function fixture(body, check) {
  const dir = mkdtempSync(join(tmpdir(), 'headless-witness-'));
  try {
    const pkg = join(dir, 'packages/planted');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'vitest.config.ts'), body);
    check(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('a headed browser default refuses and names the config', () => {
  fixture('export default { test: { browser: { enabled: true, headless: false } } };\n', (dir) => {
    const result = run('--root', dir);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /packages\/planted\/vitest\.config\.ts/);
  });
});

test('an explicitly headless browser default passes', () => {
  fixture('export default { test: { browser: { enabled: true, headless: true } } };\n', (dir) => {
    const result = run('--root', dir);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
});

test('the repository browser defaults pass', () => {
  const result = run('--root', root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
