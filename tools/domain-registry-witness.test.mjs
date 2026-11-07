import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('ignores source-shaped directories in ignored output while detecting real strays', () => {
  const fixture = mkdtempSync(resolve(root, 'packages/domain-witness-fixture-'));
  try {
    mkdirSync(resolve(fixture, '.vitest/attachments/failure.test.ts'), { recursive: true });
    const run = () => spawnSync('bash', ['tools/domain-registry-witness.sh'], { cwd: root, encoding: 'utf8' });
    const clean = run();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    writeFileSync(resolve(fixture, 'stray.ts'), 'const tag = "lar/unregistered";\n');
    const stray = run();
    assert.equal(stray.status, 1, stray.stdout + stray.stderr);
    assert.match(stray.stdout, /domain literal\(s\) written OUTSIDE the registry/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('refuses versioned domain literals outside the registry by name', () => {
  const fixture = mkdtempSync(resolve(root, 'packages/domain-witness-fixture-'));
  try {
    const names = ['lar-planted-versioned/v1', 'lar-holder-continuity/v1', 'lar-wax-stamp/v1', 'lar-witness/v1', 'lares/face-join-grant/v1'];
    writeFileSync(resolve(fixture, 'stray.ts'), names.map((name, i) => `const tag${i} = "${name}";`).join('\n') + '\n');
    const result = spawnSync('bash', ['tools/domain-registry-witness.sh'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    for (const name of names) {
      assert.match(result.stdout, new RegExp(`domain literal\\(s\\) written OUTSIDE the registry:[\\s\\S]*${name}`));
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
