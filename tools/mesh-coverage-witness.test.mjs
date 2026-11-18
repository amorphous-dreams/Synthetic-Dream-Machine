import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = dirname(fileURLToPath(import.meta.url));

const PHASE = 'export type NexusPhaseName = "seed" | "standing";\n';
const REALM = 'export type RealmStandingName = "held" | "lapsed";\n';
const POSTURE = 'export type FederationPosture = "private" | "open";\n';
const cells = postures => postures.flatMap(p => ['seed', 'standing'].flatMap(ph => ['held', 'lapsed'].map(r => `${p}/${ph}/${r}`)));
const scenarios = list => list.map((c, i) => `# COVERS: ${c}\nrun_cell_${i}() { :; }\n`).join('\n');

// The witness `cd`s to its own parent's parent, so a copy under a scratch root reads that root's unions and scenarios.
function run({ phase = PHASE, realm = REALM, posture = POSTURE, scen = scenarios(cells(['private', 'open'])) } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mesh-coverage-'));
  mkdirSync(join(root, 'tools'));
  for (const f of ['mesh-coverage-witness.sh', 'code_scan.py'])
    if (existsSync(join(tools, f))) copyFileSync(join(tools, f), join(root, 'tools', f));
  const mesh = join(root, 'packages', 'lararium-mesh', 'src');
  const cli = join(root, 'packages', 'lares-cli', 'src');
  mkdirSync(mesh, { recursive: true });
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, 'nexus-phase.ts'), phase);
  writeFileSync(join(mesh, 'realm-standing.ts'), realm);
  writeFileSync(join(mesh, 'cap-tier.ts'), '// isomorphic to FederationPosture\n');
  if (posture !== null) writeFileSync(join(mesh, 'federation-gate.ts'), posture);
  writeFileSync(join(root, 'tools', 'mesh-scenarios.sh'), scen);
  return spawnSync('bash', [join(root, 'tools', 'mesh-coverage-witness.sh')], { encoding: 'utf8' });
}

test('control: unions read from code, every cell claimed, reads green', () => {
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /8 cell\(s\) · 8 claimed/);
});

test('a union in a comment never stands in for the declared one', () => {
  const r = run({ posture: '/* was: export type FederationPosture = "private" | "open"; */\n'
    + 'export type FederationPosture = "private" | "open" | "sealed";\n' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /posture \['private', 'open', 'sealed'\]/);
  assert.match(r.stdout, /NO SCENARIO WALKS THESE:[\s\S]*sealed\/seed\/held/);
});

test('a union inside a string literal never stands in for the declared one', () => {
  const r = run({ realm: 'const doc = "export type RealmStandingName = \\"held\\" | \\"lapsed\\";";\n'
    + 'export type RealmStandingName = "held" | "lapsed" | "struck";\n' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /realm \['held', 'lapsed', 'struck'\]/);
});

test('an axis that declares no values refuses, even with no scenario to contradict it', () => {
  const r = run({ posture: 'export type FederationPosture = string;\n', scen: '' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /declares no values — the matrix is underivable/);
});

test('a missing union source refuses by name rather than inventing an axis', () => {
  const r = run({ posture: null });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /no state union source at packages\/lararium-mesh\/src\/federation-gate\.ts/);
});
