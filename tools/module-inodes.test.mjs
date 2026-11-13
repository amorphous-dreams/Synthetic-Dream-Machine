import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, linkSync, renameSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sharedModuleFiles } from './module-inodes.mjs';

test('a swapped directory never steers the inode walk outside', t => {
  const root = mkdtempSync(join(tmpdir(), 'inode-walk-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const farm = join(root, 'farm'), child = join(farm, 'child'), outside = join(root, 'outside');
  mkdirSync(child, { recursive: true }); mkdirSync(outside);
  writeFileSync(join(outside, 'file'), 'x'); linkSync(join(outside, 'file'), join(root, 'link'));
  let count = 0;
  try { count = sharedModuleFiles([{ rel: 'node_modules', dir: farm }], 5, { beforeDescend(path) {
    if (path === child) { renameSync(child, `${child}-held`); symlinkSync(outside, child); }
  }}).count; } catch (error) { assert.ok(['ELOOP', 'ENOTDIR'].includes(error.code)); }
  assert.equal(count, 0);
  assert.equal(sharedModuleFiles([{ rel: 'outside', dir: outside }]).count, 1);
});
