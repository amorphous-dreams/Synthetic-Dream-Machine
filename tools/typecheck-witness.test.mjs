import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const witness = join(dirname(fileURLToPath(import.meta.url)), 'typecheck-witness.sh');

// The witness `cd`s to its own parent's parent, so a copy under a scratch root reads that root's packages. A stand-in
// `npx` on PATH plays the compiler: it prints FAKE_TSC_OUT and exits FAKE_TSC_STATUS, whatever the arguments.
function house({ project = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'typecheck-witness-'));
  mkdirSync(join(root, 'tools'));
  copyFileSync(witness, join(root, 'tools', 'typecheck-witness.sh'));
  if (project) {
    mkdirSync(join(root, 'packages', 'p'), { recursive: true });
    writeFileSync(join(root, 'packages', 'p', 'tsconfig.json'), '{}\n');
  }
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'npx'), '#!/usr/bin/env bash\nprintf "%s" "$FAKE_TSC_OUT"\nexit "$FAKE_TSC_STATUS"\n');
  chmodSync(join(bin, 'npx'), 0o755);
  return { root, bin };
}

const run = (out, status, opts) => {
  const { root, bin } = house(opts);
  return spawnSync('bash', [join(root, 'tools', 'typecheck-witness.sh')], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_TSC_OUT: out, FAKE_TSC_STATUS: String(status) },
  });
};

const ROOTDIR = "src/a.ts(1,1): error TS6059: File '/x/b.ts' is not under 'rootDir' '/x/src'. 'rootDir' is expected to contain all source files.\n"
  + '  The file is in the program because:\n    Imported via "../b.js" from file \'/x/src/a.ts\'\n';

test('a compiler that crashes with no diagnostic reads RED, never clean', () => {
  const r = run("Error: Cannot find module 'typescript'\n    at Module._resolveFilename\n", 1);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /compiler failed \(exit 1\)/);
  assert.match(r.stdout, /Cannot find module 'typescript'/);
});

test('a crash beside TS6059 diagnostics reads RED', () => {
  const r = run(ROOTDIR + 'RangeError: Maximum call stack size exceeded\n', 1);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /compiler failed \(exit 1\)/);
});

test('a nonzero exit printing nothing reads RED', () => {
  const r = run('', 134);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /compiler failed \(exit 134\)/);
});

test('control: a nonzero exit carrying TS6059 alone, continuation lines and all, reads clean', () => {
  const r = run(ROOTDIR + ROOTDIR, 2);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /every package clean \(1 project\(s\) walked\)/);
});

test('control: a clean compile reads clean', () => {
  const r = run('', 0);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /p\s+ok/);
});

test('a real diagnostic reads RED with its count', () => {
  const r = run(ROOTDIR + "src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\n", 2);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /p\s+1 error\(s\)/);
});

test('no project at all reads RED: a run that checked nothing finds nothing clean', () => {
  const r = run('', 0, { project: false });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /NO TYPECHECKABLE PROJECT FOUND/);
});
