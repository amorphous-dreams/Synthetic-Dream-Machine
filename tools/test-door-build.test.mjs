import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { openHeldSync } from './held-dir.mjs';
import { runTestSeat } from './seat-walls.mjs';
import { stampPackage } from './stamp-build.mjs';
const relay = fileURLToPath(new URL('./commit-relay.mjs', import.meta.url));
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
// Use the real local Vitest and TypeScript, in a disposable package inside this checkout.
function vitestFixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), 'test-door-vitest-')); roots.push(home);
  const lane = path.join(home, 'lane'); mkdirSync(path.join(lane, 'relay'), { recursive: true });
  const wt = path.dirname(path.dirname(relay));
  const pkg = mkdtempSync(path.join(wt, 'packages', 'door-fixture-')); roots.push(pkg);
  const dir = path.basename(pkg); roots.push(path.join(wt, 'node_modules/.lares-build/pkg', dir));
  mkdirSync(path.join(pkg, 'src'));
  symlinkSync('../lararium-mesh/node_modules', path.join(pkg, 'node_modules'));
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: dir, type: 'module', scripts: { build: 'tsc -p tsconfig.json' } }));
  writeFileSync(path.join(pkg, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', outDir: 'dist', rootDir: 'src', skipLibCheck: true, types: [] }, include: ['src'] }));
  writeFileSync(path.join(pkg, 'src/value.ts'), 'export const value: number = 1;');
  writeFileSync(path.join(pkg, 'vitest.config.mjs'), `export default { test: { globalSetup: ['./guard.mjs'] } };`);
  writeFileSync(path.join(pkg, 'guard.mjs'), `import { checkDistDependencies } from '../../tools/vitest-dist-guard.mjs'; export default function() { checkDistDependencies(new URL('../../', import.meta.url).pathname, ${JSON.stringify(dir)}, [], true); }`);
  for (const name of ['one', 'two']) writeFileSync(path.join(pkg, name + '.test.mjs'), `import { test, expect } from 'vitest'; import { value } from './dist/value.js'; test('${name}', () => expect(value).toBeGreaterThan(0));`);
  const run = async names => {
    const files = names.map(name => 'packages/' + dir + '/' + name + '.test.mjs');
    const worktreeHeld = openHeldSync(wt, wt), laneHeld = openHeldSync(lane, lane);
    try { return await runTestSeat({ worktreeHeld, laneHeld, runner: 'vitest', files }); }
    finally { worktreeHeld.close(); laneHeld.close(); }
  };
  const seedBuild = () => {
    mkdirSync(path.join(pkg, 'dist'), { recursive: true });
    writeFileSync(path.join(pkg, 'dist/value.js'), 'export const value = 1;');
    stampPackage(wt, dir);
  };
  return { pkg, run, seedBuild };
}
test('Vitest door selects exactly one named file; control selects both', async () => {
  const x = vitestFixture();
  // Seed a build for the pre-cure selection witness, without relying on the door's build.
  mkdirSync(path.join(x.pkg, 'dist')); writeFileSync(path.join(x.pkg, 'dist/value.js'), 'export const value = 1;');
  // This selection witness does not need the freshness guard.
  writeFileSync(path.join(x.pkg, 'guard.mjs'), 'export default function() {}');
  const one = await x.run(['one']);
  assert.equal(one.ok, true, JSON.stringify(one)); assert.equal(one.pass, 1);
  assert.match(one.logTail.replace(/\x1b\[[0-9;]*m/g, ''), /Test Files\s+1 passed/);
  const two = await x.run(['one', 'two']);
  assert.equal(two.ok, true, JSON.stringify(two)); assert.equal(two.pass, 2);
  assert.match(two.logTail.replace(/\x1b\[[0-9;]*m/g, ''), /Test Files\s+2 passed/);
});
test('Vitest door rebuilds and stamps a source edit; a type error refuses before tests', async () => {
  const x = vitestFixture();
  x.seedBuild();
  const first = await x.run(['one']);
  assert.equal(first.ok, true, JSON.stringify(first)); assert.equal(first.exitCode, 0);
  writeFileSync(path.join(x.pkg, 'src/value.ts'), 'export const value: number = 2;');
  const edited = await x.run(['one']);
  assert.equal(edited.ok, true, JSON.stringify(edited)); assert.equal(edited.exitCode, 0);
  assert.match(readFileSync(path.join(x.pkg, 'dist/value.js'), 'utf8'), /value = 2/);
  writeFileSync(path.join(x.pkg, 'src/value.ts'), 'export const value: number = "broken";');
  const broken = await x.run(['one']);
  assert.equal(broken.ok, false, JSON.stringify(broken)); assert.match(broken.output, /error TS2322/);
  assert.doesNotMatch(broken.output, /Test Files/);
});

test('RED: a leading-dash build reaches the shell; CONTROL normal build reaches tests', async () => {
  const x = vitestFixture();
  const manifest = JSON.parse(readFileSync(path.join(x.pkg, 'package.json'), 'utf8'));
  manifest.scripts.build = '--version';
  writeFileSync(path.join(x.pkg, 'package.json'), JSON.stringify(manifest));
  const dash = await x.run(['one']);
  assert.equal(dash.ok, false, JSON.stringify(dash));
  assert.match(dash.output, /Illegal option|invalid option|unrecognized option/i);
  manifest.scripts.build = 'tsc -p tsconfig.json';
  writeFileSync(path.join(x.pkg, 'package.json'), JSON.stringify(manifest));
  const normal = await x.run(['one']);
  assert.equal(normal.ok, true, JSON.stringify(normal)); assert.equal(normal.pass, 1);
});
