import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { census } from './clock-census.mjs';

function fixture(file, source) {
  const root = mkdtempSync(join(tmpdir(), 'clock-census-'));
  try {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
    return census(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('reports a timed product-event wait at its exact line', () => {
  const file = 'packages/example/tests/ready.test.ts';
  const findings = fixture(file, "// fixture\nawait page.waitForFunction(() => window.ready, null, { timeout: 5000 });\n");
  assert.ok(findings.some(f => f.file === file && f.line === 2 && f.category === 'TEST-WAIT'));
});

test('leaves an event-only wait with timeout disabled unreported', () => {
  assert.deepEqual(fixture('packages/example/tests/control.test.ts', "await page.waitForEvent('ready', { timeout: 0 });\n"), []);
});

test('inventories clock forms and leaves disabled timeout options quiet', () => {
  const file = 'packages/example/src/clock.ts';
  const findings = fixture(file, [
    'setTimeout(expire, 20);',
    'setInterval(poll, interval);',
    'await until(ready, 100);',
    'const signal = AbortSignal.timeout(100);',
    'if (Date.now() >= deadline) expire();',
    'if (performance.now() < end) poll();',
    'request({ timeout: 300 });',
    'request({ timeout: 0 });',
  ].join('\n'));
  assert.deepEqual(findings.map(f => [f.line, f.category]), Array.from({ length: 7 }, (_, i) => [i + 1, 'PRODUCT-WAIT']));
});

test('finds runner caps and multiline waits while ignoring comments', () => {
  const findings = fixture('packages/example/tests/clock.test.ts', [
    '// setTimeout(noop, 1)',
    'const config = { testTimeout: 500, hookTimeout: 600 };',
    'test("case", async () => {}, 700);',
    'await page.waitForFunction(',
    '  () => ready, null,',
    '  { timeout: 5000 },',
    ');',
  ].join('\n'));
  assert.deepEqual(findings.map(f => [f.line, f.category]), [[2, 'HARNESS'], [3, 'HARNESS'], [4, 'TEST-WAIT']]);
});
