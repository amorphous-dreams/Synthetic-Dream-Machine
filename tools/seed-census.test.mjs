import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { census, ENTRIES, scanText } from './seed-census.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const SCRATCH = fileURLToPath(new URL('../../seats/sol-e/.tmp/', import.meta.url));
const allowed = { rule: 'allowed', file: 'packages/demo/src/door.ts', match: 'loadVesselSigningSeed', count: 1, reason: 'The fixture owns its key file door.' };

function fixture(files, entries) {
  mkdirSync(SCRATCH, { recursive: true });
  const root = mkdtempSync(join(SCRATCH, 'seed-census-'));
  try {
    for (const [file, body] of Object.entries(files)) {
      const path = join(root, file);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, body);
    }
    return census(root, entries);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('planted raw seed consumer reads red by file; lawful door reads green', () => {
  const red = fixture({ 'packages/demo/src/illicit.ts': 'loadVesselSigningSeed();\n' }, [allowed]);
  assert.deepEqual(red.open.map(f => f.file), ['packages/demo/src/illicit.ts']);
  assert.equal(red.stale.length, 1);
  const green = fixture({ 'packages/demo/src/door.ts': 'loadVesselSigningSeed();\n' }, [allowed]);
  assert.equal(green.files, 1);
  assert.equal(green.open.length, 0);
  assert.equal(green.stale.length, 0);
});

test('stale count and an empty source corpus fail', () => {
  const stale = fixture({ 'packages/demo/src/door.ts': 'loadVesselSigningSeed();\n' }, [{ ...allowed, count: 2 }]);
  assert.equal(stale.stale.length, 1);
  const empty = fixture({ 'packages/demo/tests/door.ts': 'loadVesselSigningSeed();\n' }, []);
  assert.equal(empty.files, 0);
});

test('comments carry no consumer', () => {
  assert.equal(scanText('packages/demo/src/a.ts', '// loadVesselSigningSeed();\n/* vesselSeed */\nconst a = 1;').length, 0);
});

test('the exact named entry set covers the real source corpus', () => {
  const result = census(REPO);
  assert.ok(result.files > 0);
  assert.equal(result.findings.length, 55);
  assert.deepEqual(result.open, []);
  assert.deepEqual(result.stale, []);
  assert.deepEqual(result.used, ENTRIES.map(e => e.count));
  assert.deepEqual(ENTRIES.map(e => `${e.rule}:${e.file}:${e.match}:${e.count}`).sort(), [
    'K15:packages/lararium-browser/src/browser-vessel-identity.ts:signingSeedFromHex(existing.signingKey):1',
    'K15:packages/lararium-browser/src/open-browser-vessel.ts:vesselSeed:4',
    'K15:packages/lararium-keyhive/src/ceremony-core.ts:vesselSeed:7',
    'K15:packages/lararium-node/src/carriage-relay.ts:vesselSeed:2',
    'K15:packages/lararium-node/src/commands/fleet-join.ts:vesselFloorKeyDoor:2',
    'K15:packages/lararium-node/src/commands/init.ts:foundThePlace({ repo, vesselSeed:1',
    'K15:packages/lararium-node/src/commands/init.ts:loadVesselSigningSeed:2',
    'K15:packages/lararium-node/src/commands/nexus-contract.ts:vesselFloorKeyDoor:2',
    'K15:packages/lararium-node/src/leaf-identity.ts:loadVesselSigningSeed:2',
    'K15:packages/lararium-node/src/main.ts:vesselFloorKeyDoor:2',
    'K15:packages/lararium-node/src/open-node-vessel.ts:vesselFloorKeyDoor:4',
    'K15:packages/lararium-node/src/open-node-vessel.ts:vesselSeed:6',
    'K15:packages/lararium-node/src/place-card.ts:loadVesselSigningSeed:2',
    'K15:packages/lares-cli/src/commands/meme.ts:loadVesselSigningSeed:2',
    'allowed:packages/lararium-mesh/src/gate-bundle.ts:floorKeyDoor:1',
    'allowed:packages/lararium-mesh/src/index.ts:floorKeyDoor:1',
    'allowed:packages/lararium-mesh/src/place-signer.ts:placeSignerFromSeed:1',
    'allowed:packages/lararium-node/src/commands/nexus-contract.ts:loadVesselSigningSeed:2',
    'allowed:packages/lararium-node/src/index.ts:loadVesselSigningSeed:1',
    'allowed:packages/lararium-node/src/node-vessel-identity.ts:floorKeyDoor:2',
    'allowed:packages/lararium-node/src/node-vessel-identity.ts:loadVesselSigningSeed:1',
    'allowed:packages/lararium-node/src/node-vessel-identity.ts:signingSeedFromHex(raw.signingKey):2',
    'allowed:packages/lararium-node/src/node-vessel-identity.ts:vesselFloorKeyDoor():1',
    'allowed:packages/lararium-node/src/open-node-vessel.ts:loadVesselSigningSeed:2',
    'allowed:packages/lararium-node/src/open-node-vessel.ts:placeSignerFromSeed:2',
  ].sort());
});
