import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openHeldSync, readHeldBoundedAsync } from './held-dir.mjs';

test('readHeldBoundedAsync reads a small regular file whole and refuses one over its limit by size', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'held-read-'));
  try {
    const held = openHeldSync(dir, dir);
    try {
      writeFileSync(join(dir, 'req-1.json'), '{"kind":"push"}');
      assert.equal(await readHeldBoundedAsync(held, 'req-1.json', { limit: 64 }), '{"kind":"push"}');
      writeFileSync(join(dir, 'req-2.json'), 'x'.repeat(65));
      await assert.rejects(readHeldBoundedAsync(held, 'req-2.json', { limit: 64 }), /over the 64-byte request limit/);
    } finally { held.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('RED (store-wall F8): a file whose stat size reads small but whose read runs long refuses at the limit; the read never runs past it', async () => {
  // A /proc file stats at size 0 yet reads its whole content: the shape of a request extended after the size check.
  const held = { at: () => '/proc/self/environ' };
  await assert.rejects(readHeldBoundedAsync(held, 'req-3.json', { limit: 8 }), /over the 8-byte request limit/);
});
