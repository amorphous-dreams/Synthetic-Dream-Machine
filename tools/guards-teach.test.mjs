import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGate } from './pre-push-gate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (cmd, args, options = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...options });
// A refusal carries its procedure on a line of its own; a runner may print diff lines after the message.
const endsInPono = (message) => assert.match(message, /(?:^|\n)\s*pono: \S/);

test('stash refusal teaches a procedure', () => {
  const r = run(process.execPath, ['tools/stash-guard.mjs'], { input: JSON.stringify({ tool_input: { command: 'git stash' }, cwd: root }) });
  assert.equal(r.status, 2, r.stderr);
  endsInPono(r.stderr);
});

test('pre-push refusal teaches a procedure', () => {
  const lines = [];
  assert.equal(runGate([{ name: 'fixture' }], () => 1, line => lines.push(line)).code, 1);
  assert.match(lines.join('\n'), /PRE-PUSH GATE REFUSES/);
  endsInPono(lines.join('\n'));
});

test('evergreen witness refusal teaches a procedure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'guard-evergreen-'));
  try {
    mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, 'tree/tools'), { recursive: true });
    writeFileSync(join(dir, 'tree/tools/fixture.mjs'), 'const record = { schemaVersion: 1 };\n');
    writeFileSync(join(dir, 'bin/node'), `#!/bin/sh\nexec "${process.execPath}" "$@" --root "${join(dir, 'tree')}" --ceilings version=0 --no-exceptions\n`, { mode: 0o755 });
    const r = run('bash', ['tools/evergreen-boundary-witness.sh'], { env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` } });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /version\s+tools\/fixture\.mjs:1/);
    endsInPono(r.stdout + r.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('disk witness refusal teaches a procedure', () => {
  const env = { ...process.env, LARES_DISK_MIN_C_GB: '0', LARES_DISK_MIN_ROOT_GB: '999999999', LARES_DISK_MAX_WORKTREES: '100000', LARES_DISK_MAX_CODEX: '100000' };
  const r = run('bash', ['tools/disk-witness.sh'], { env });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /RED: \/ has/);
  endsInPono(r.stdout + r.stderr);
});

test('heavy roster refusal teaches a procedure', () => {
  const pkg = join(root, 'packages/lararium-node');
  const dir = mkdtempSync(join(root, 'packages/guard-roster-'));
  try {
    cpSync(join(pkg, 'tests'), join(dir, 'tests'), { recursive: true });
    for (const file of ['vitest.config.ts', 'vitest.alias.ts']) cpSync(join(pkg, file), join(dir, file));
    symlinkSync(join(pkg, 'node_modules'), join(dir, 'node_modules'), 'dir');
    writeFileSync(join(dir, 'tests/pono-fixture.test.ts'), 'createServer();\n');
    writeFileSync(join(dir, 'guard.config.mts'), 'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { include: ["tests/heavy-roster-is-complete.test.ts"] } });\n');
    const r = run(process.execPath, [resolve(pkg, 'node_modules/vitest/vitest.mjs'), 'run', '--config', join(dir, 'guard.config.mts'), '--root', dir, '--no-color'], { env: { ...process.env, FORCE_COLOR: '0' } });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const output = r.stdout + r.stderr;
    assert.match(output, /tests\/pono-fixture\.test\.ts/);
    // The refusal lists its suites, then a blank line, then its pono line: read from its start to the end of the run.
    const at = output.indexOf('These suites stand a live resource');
    assert.ok(at >= 0, output);
    endsInPono(output.slice(at));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
