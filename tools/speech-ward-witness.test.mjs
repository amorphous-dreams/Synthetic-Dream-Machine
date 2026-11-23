// speech-ward-witness self-tests: the ward's instrument reads red on a planted copula, and its pattern-integrity
// exemptions (a quoted span, a code span, a reference-table row, an identifier) read clear.
//
// The fixtures below plant the forbidden copula on purpose: each one stands as a pattern integrity (a fixture the
// instrument must catch), never a claim the house makes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wardCount, speechOfTs, speechOfPy } from './speech-ward-witness.mjs';

const tools = dirname(fileURLToPath(import.meta.url));
const COP = 'is'; // the planted token, named once

/** A scratch tree with one package whose source speaks `body`, and a baseline holding `ceilings`. */
function tree(files, ceilings = {}, rest = {}) {
  const root = mkdtempSync(join(tmpdir(), 'speech-ward-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  const baseline = join(root, 'baseline.json');
  writeFileSync(baseline, JSON.stringify({ ceilings, ...rest }));
  return { root, baseline };
}
const walk = ({ root, baseline }, ...flags) =>
  spawnSync(process.execPath, [join(tools, 'speech-ward-witness.mjs'), '--root', root, '--baseline', baseline, ...flags], { encoding: 'utf8' });

test('RED: a planted copula in a refusal reads over a zero ceiling', () => {
  const t = tree({ 'packages/p/src/a.ts': `export function f() { throw new Error("the door ${COP} shut"); }\n` });
  const r = walk(t);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /p\s+1 copula\(s\), ceiling 0: NEW DRIFT/);
  assert.match(r.stdout, /a\.ts:1/);
});

test('the same planted copula reads green at a ceiling that holds it; a ceiling above the count reads red until it lowers', () => {
  const src = { 'packages/p/src/a.ts': `throw new Error("the door ${COP} shut");\n` };
  assert.equal(walk(tree(src, { p: 1 })).status, 0);
  const t = tree(src, { p: 3 });
  const r = walk(t);
  assert.equal(r.status, 1, 'a stale ceiling never passes silently');
  assert.match(r.stdout, /p\s+1 copula\(s\), ceiling 3: STALE CEILING/);
  assert.equal(walk(t, '--write-baseline').status, 0);
  assert.equal(walk(t).status, 0, 'the lowered ceiling now holds');
  assert.equal(JSON.parse(readFileSync(t.baseline, 'utf8')).ceilings.p, 1);
});

test('the auxiliary tally holds its own ceiling, which also only falls', () => {
  const src = { 'packages/p/src/a.ts': `throw new Error("the door was closed");\n` };
  const r = walk(tree(src));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /p\s+.*1 auxiliary, ceiling 0: NEW AUXILIARY DRIFT/);
  assert.equal(walk(tree(src, {}, { auxiliary: { p: 1 } })).status, 0);
  const stale = walk(tree(src, {}, { auxiliary: { p: 2 } }));
  assert.equal(stale.status, 1);
  assert.match(stale.stdout, /1 auxiliary, ceiling 2: STALE CEILING/);
});

test('SILENT ZERO: a package that speaks nothing reads red unless the baseline names it silent', () => {
  const src = { 'packages/p/src/a.ts': `throw new Error("the door shut");\n`, 'packages/q/src/b.ts': `export const x = 1;\n`, 'packages/r/package.json': '{}' };
  const r = walk(tree(src));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /q\s+SILENT: no speech collected/);
  assert.match(r.stdout, /r\s+SILENT: no speech collected/);
  assert.equal(walk(tree(src, {}, { silent: ['q', 'r'] })).status, 0);
});

test('CONTROL: a quoted span, a code span, a table row and an identifier count nothing', () => {
  const src = [
    `throw new Error('the seed reads "the door ${COP} shut" back');`,
    'console.error(`run \\`lares ' + COP + '\\` first`);',
    `console.log("| door | ${COP} | shut |");`,
    `refuse("the --${COP}-ready flag and is_ready field and x.${COP} hold");`,
    `const why = "the door ${COP} shut"; // code that never speaks`,
  ].join('\n');
  const r = walk(tree({ 'packages/p/src/a.ts': src }));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /p\s+ok · ⌜1⌝ quoted/);
});

test('wardCount: every conjugation counts, a contraction counts, the quote tally rides apart', () => {
  assert.deepEqual(wardCount(`it ${COP} here and they are there and it was not`), { breaches: 3, quoted: 0, aux: 0, spans: [COP, 'are', 'was'] });
  assert.equal(wardCount("it's shut and they aren't open").breaches, 2);
  assert.equal(wardCount("the hand doesn't open; it can't").breaches, 0);
  assert.deepEqual(wardCount(`the law reads “X ${COP} Y” and 'A are B'`), { breaches: 0, quoted: 2, aux: 0, spans: [] });
  // The auditor's demotion: a progressive or a passive reads as tense, tallied apart; a look-alike ending still counts.
  assert.deepEqual(wardCount(`nothing was changed and the door ${COP} closing`), { breaches: 0, quoted: 0, aux: 2, spans: [] });
  assert.equal(wardCount(`the cure ${COP} nothing`).breaches, 1);
  // The possessive contraction: `'s` before a predicate word counts; before a noun it stays possessive.
  assert.equal(wardCount("the door's shut").breaches, 1);
  assert.equal(wardCount("the door's not open, and the face's a stranger").breaches, 2);
  assert.equal(wardCount("the door's lock holds the face's name").breaches, 0);
  assert.equal(wardCount("the vessel's held key and the row's (a copy) and the vault's open circle").breaches, 0, 'attributive');
  assert.equal(wardCount("the vessel's open, and the gate's shut").breaches, 2);
  assert.deepEqual(wardCount("the door's closed"), { breaches: 0, quoted: 0, aux: 1, spans: [] });
  assert.equal(wardCount(`  | ${COP} | are |`).breaches, 0);
});

test('speechOfTs: speech positions speak, code positions stay silent', () => {
  const src = [
    `throw new VesselRefused("a ${COP} b", { cause });`,
    `const k = "c ${COP} d";`,
    'say(`e ${x ? "f ' + COP + ' g" : "h"} i`);',
    `const row = { description: "j ${COP} k", kind: "l ${COP} m" };`,
    '// "n ' + COP + ' o" in a comment',
    'const re = /"p/; console.warn("q");',
    `export const SEAL_HAND_ACT = "lares seal";`,
    `console.log(a["${'was'}"] === "x" ? "y" : "z");`,
  ].join('\n');
  const texts = speechOfTs(src).map((s) => s.text);
  assert.deepEqual(texts, [`a ${COP} b`, 'e ‹› i', `f ${COP} g`, 'h', `j ${COP} k`, 'q', 'lares seal', 'x', 'y', 'z']);
});

test('speechOfPy: an MCP tool docstring, a raise and an error field speak', { skip: spawnSync('python3', ['-V']).status !== 0 }, () => {
  const src = [
    'import x',
    '@mcp.tool(annotations=a("t"))',
    `def t():`,
    `    """the tool ${COP} quick"""`,
    `    raise ValueError(f"bad {x} ${COP} here")`,
    `def u():`,
    `    """a helper ${COP} silent"""`,
    `    return {"error": "it ${COP} gone", "kind": "z ${COP} y"}`,
  ].join('\n');
  const texts = speechOfPy(src).map((s) => s.text);
  assert.deepEqual(texts, [`the tool ${COP} quick`, `bad ‹› ${COP} here`, `it ${COP} gone`]);
});

test('a run that walked no package reads red, never clean', () => {
  const r = walk(tree({ 'README.md': 'x' }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /nothing was walked/);
});
