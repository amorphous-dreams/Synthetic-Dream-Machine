// stamp-build's writer never follows a planted link: test-door code may write node_modules/.lares-build, so an unwalled
// build or CLI gate writing a stamp there must leave a link's target alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageStampPath, sourceDigest, stampPackage, writeStamp } from './stamp-build.mjs';

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'stamp-build-'));
  const repo = join(root, 'repo'), outside = join(root, 'outside');
  mkdirSync(join(repo, 'packages', 'a', 'src'), { recursive: true }); mkdirSync(outside);
  writeFileSync(join(repo, 'packages', 'a', 'package.json'), '{"name":"a"}');
  writeFileSync(join(repo, 'packages', 'a', 'src', 'x.ts'), 'export const x = 1;\n');
  writeFileSync(join(outside, 'target'), 'precious\n');
  return { root, repo, outside };
}

test('CONTROL: a stamp lands as a regular file holding the digest', (t) => {
  const x = scratch(); t.after(() => rmSync(x.root, { recursive: true, force: true }));
  const digest = stampPackage(x.repo, 'a');
  assert.equal(digest, sourceDigest(join(x.repo, 'packages', 'a')));
  assert.equal(readFileSync(packageStampPath(x.repo, 'a'), 'utf8'), digest);
  assert.ok(lstatSync(packageStampPath(x.repo, 'a')).isFile());
  assert.deepEqual(readdirSync(join(x.repo, 'node_modules', '.lares-build', 'pkg')), ['a'], 'no temp file stays behind');
});

test('RED: a symlink planted at the stamp name stays untouched; its target keeps its bytes and the stamp replaces the link', (t) => {
  const x = scratch(); t.after(() => rmSync(x.root, { recursive: true, force: true }));
  mkdirSync(join(x.repo, 'node_modules', '.lares-build', 'pkg'), { recursive: true });
  symlinkSync(join(x.outside, 'target'), packageStampPath(x.repo, 'a'));
  const digest = stampPackage(x.repo, 'a');
  assert.equal(readFileSync(join(x.outside, 'target'), 'utf8'), 'precious\n', 'the link target keeps its bytes');
  assert.ok(lstatSync(packageStampPath(x.repo, 'a')).isFile()); assert.equal(readFileSync(packageStampPath(x.repo, 'a'), 'utf8'), digest);
});

test('RED: a symlinked dir on the stamp path refuses by name and writes nothing through it', (t) => {
  const x = scratch(); t.after(() => rmSync(x.root, { recursive: true, force: true }));
  mkdirSync(join(x.repo, 'node_modules', '.lares-build'), { recursive: true });
  symlinkSync(x.outside, join(x.repo, 'node_modules', '.lares-build', 'pkg'));
  assert.throws(() => stampPackage(x.repo, 'a'), /stamp path .*\/pkg is not a real directory/);
  assert.deepEqual(readdirSync(x.outside), ['target']);
  assert.throws(() => writeStamp(x.repo, join(x.root, 'elsewhere', 'stamp'), 'x'), /a stamp lives under/);
});
