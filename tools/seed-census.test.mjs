import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { census, ENTRIES, HANDOFFS, PUBLIC_PLACE_KEY, scanText } from './seed-census.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const door = { rule: 'allowed', file: 'packages/demo/src/door.ts', match: 'loadVesselSigningSeed', count: 1, reason: 'The fixture key-file door.' };
const call = { rule: 'allowed', file: 'packages/demo/src/call.ts', match: 'vesselSeed', count: 1, reason: 'A fixture baseline spelling, for the alias mutation guard.' };

function fixture(files, entries = [], options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'seed-census-'));
  try {
    for (const [file, body] of Object.entries(files)) {
      const path = join(root, file);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, body);
    }
    return census(root, entries, { handoffs: [], publicKeys: [], ...options });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

const clean = { 'packages/demo/src/clean.ts': 'export const clean = 1;\n' };
const planted = {
  ...clean,
  'packages/demo/src/door.ts': 'const s = await loadVesselSigningSeed();\nstartThing({ renamedParam: s });\n',
  'packages/demo/src/call.ts': 'function f(gateSeed) { return gateSeed; }\nf(vesselSeed);\n',
};

test('a clean fixture tree reads green; both renamed seed carriers read red at their lines', () => {
  const green = fixture(clean);
  assert.ok(green.files > 0);
  assert.deepEqual(green.open, []);
  assert.deepEqual(green.stale, []);
  const red = fixture(planted, [door, call]);
  assert.deepEqual(red.open.filter(f => f.kind === 'handoff').map(f => `${f.file}:${f.line}`).sort(), [
    'packages/demo/src/call.ts:1',
    'packages/demo/src/door.ts:2',
  ]);
  assert.deepEqual(red.stale, []);
});

test('the alias pass causes the renamed-consumer red', () => {
  const red = fixture(planted, [door, call]);
  const mutation = fixture(planted, [door, call], { aliases: false });
  assert.ok(red.open.length > 0);
  assert.deepEqual(mutation.open, []);
  assert.deepEqual(mutation.stale, []);
});

test('a seed argument stains a renamed parameter across source files', () => {
  const files = {
    'packages/demo/src/door.ts': 'const s = await loadVesselSigningSeed();\nstartThing({ renamedParam: s });\n',
    'packages/demo/src/receiver.ts': 'export function startThing({ renamedParam }) { return renamedParam; }\n',
  };
  const red = fixture(files, [door]);
  assert.ok(red.open.some(f => f.file === 'packages/demo/src/receiver.ts' && f.line === 1 && f.kind === 'handoff'));
  assert.deepEqual(fixture(files, [door], { aliases: false }).open, []);
});

test('a persona-root decode and its generic helper definition do not count as place seed consumers', () => {
  const files = {
    'packages/demo/src/persona-vault.ts': 'const existing = await vault.rootSlot(0).load();\nreturn signingSeedFromHex(existing.signingKey);\n',
    'packages/demo/src/vessel-identity-core.ts': 'export function signingSeedFromHex(signingKeyHex) { return hexToBytes(signingKeyHex); }\n',
  };
  assert.deepEqual(fixture(files).open, []);
  const planted = fixture({ ...files, 'packages/demo/src/consumer.ts': 'const secret = await loadVesselSigningSeed();\nuseForFace(secret);\n' }, [
    { ...door, file: 'packages/demo/src/consumer.ts' },
  ]);
  assert.ok(planted.open.some(f => f.kind === 'handoff' && f.file.endsWith('/consumer.ts')));
});

test('a place-key fallback in a face relation reads red', () => {
  const red = fixture({ 'packages/demo/src/face-relation.ts': 'const key = activeAtom?.key ?? vesselIdentity.verifyingKey;\n' });
  assert.deepEqual(red.open.map(f => `${f.file}:${f.line}:${f.kind}`).sort(), [
    'packages/demo/src/face-relation.ts:1:PUBLIC_PLACE_KEY',
    'packages/demo/src/face-relation.ts:1:face',
  ]);
});

test('counts stale, comments stay silent, and an empty source corpus fails', () => {
  assert.equal(fixture({ 'packages/demo/src/door.ts': 'loadVesselSigningSeed();\n' }, [{ ...door, count: 2 }]).stale.length, 1);
  assert.equal(fixture({ 'packages/demo/src/door.ts': 'loadVesselSigningSeed();\n' }, [{ ...door, rule: 'K15' }]).stale.length, 1);
  assert.equal(fixture({ 'packages/demo/tests/door.ts': 'loadVesselSigningSeed();\n' }).files, 0);
  assert.equal(scanText('packages/demo/src/a.ts', '// loadVesselSigningSeed();\n/* vesselSeed */\nconst a = 1;').length, 0);
});

test('a browser reach of the place seed beyond its receipted KEL consumer reads red at its line', () => {
  const file = 'packages/lararium-browser/src/browser-vessel-identity.ts';
  const body = [
    'async function loadBrowserSigningSeed(idbName) { return seedOf(idbName); }',
    'export async function foundKel(idbName) { const seed = await loadBrowserSigningSeed(idbName); return arm(seed); }',
    'export function tagDoor(idbName) { return async () => { const seed = await loadBrowserSigningSeed(idbName); return derive(seed); }; }',
    '',
  ].join('\n');
  const receipt = { rule: 'allowed', file, match: 'loadBrowserSigningSeed', count: 2, reason: 'The fixture keystore reader and its KEL consumer.' };
  const red = fixture({ [file]: body }, [receipt]);
  assert.deepEqual(red.open.map(f => `${f.file}:${f.line}:${f.kind}`), [`${file}:3:seed`]);
  // CONTROL: the same door with only its KEL consumer reads green under the same receipt.
  const green = fixture({ [file]: body.split('\n').filter((_, i) => i !== 2).join('\n') }, [receipt]);
  assert.deepEqual(green.open, []);
  assert.deepEqual(green.stale, []);
});

test('a reach named vesselFaceTagSecret reads open in any file, and no receipt allows it', () => {
  const body = 'const secret = vesselFaceTagSecret(seed);\n';
  const receipt = { rule: 'allowed', file: 'packages/demo/src/tag.ts', match: 'vesselFaceTagSecret', count: 1, reason: 'A receipt that must not take.' };
  for (const file of ['packages/demo/src/tag.ts', 'packages/lararium-browser/src/browser-vessel-identity.ts']) {
    const red = fixture({ [file]: body }, [{ ...receipt, file }]);
    assert.ok(red.open.some(f => f.file === file && f.line === 1 && f.kind === 'tag-secret'), file);
  }
  // CONTROL: a per-face tag door spelled without the name reads no finding.
  assert.deepEqual(fixture({ 'packages/demo/src/tag.ts': 'const secret = await standVesselFaceTagSecret(group);\n' }).open, []);
});

test('the real tree has no K15 exception, renamed secret handoff, or unclassified public place use', () => {
  const result = census(REPO);
  assert.ok(result.files > 0);
  assert.deepEqual(ENTRIES.filter(e => e.rule === 'K15'), []);
  assert.deepEqual(HANDOFFS, []);
  assert.ok(PUBLIC_PLACE_KEY.every(e => e.sort === 'place'));
  assert.deepEqual(result.open, []);
  assert.deepEqual(result.stale, []);
  assert.deepEqual(result.used, ENTRIES.map(e => e.count));
  assert.deepEqual(result.handoffUsed, HANDOFFS.map(e => e.count));
  assert.deepEqual(result.publicUsed, PUBLIC_PLACE_KEY.map(e => e.count));
});
