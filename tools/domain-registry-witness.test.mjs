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
