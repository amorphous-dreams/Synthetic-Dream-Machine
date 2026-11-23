import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = dirname(fileURLToPath(import.meta.url));

// A stand-in built CLI: `help` lists the top verbs, `help --json` lists the doors with each row's own verb table
// (or crashes, on JSON_CRASH). VERBS_JSON swaps the tables, so a case can plant a door the rows no longer answer.
const TABLES = { nexus: ["admit"], seal: { open: ["now"] }, ghost: null };
const BIN = `const a = process.argv.slice(2);
const tables = process.env.VERBS_JSON ? JSON.parse(process.env.VERBS_JSON) : ${JSON.stringify(TABLES)};
const verbs = Object.keys(tables);
if (a[0] === "help" && a[1] === "--json") {
  if (process.env.JSON_CRASH) { console.error("TypeError: cannot read entries"); process.exit(1); }
  console.log(JSON.stringify({ ok: true, data: { entries: verbs.map(name => ({ name, verbs: tables[name] })) } }));
} else if (a[0] === "help") {
  console.log("lares\\n\\nVessel:\\n" + verbs.map(v => "    " + v + "          does a thing").join("\\n"));
} else process.exit(2);
`;
const BRIDGE = `const SHIM_VERB_HELP: Readonly<Record<string, { readonly usage: string }>> = {
  up:    { usage: "lares up" },
};
`;
const SHIM = `#!/usr/bin/env bash
case "$verb" in
  up)
    echo standing
    ;;
  vault)
    route_cli "$verb" "$@"
    ;;
esac
`;
const SOURCE = 'export function sealKeySetHash(keys: string[]): string { return keys.join(""); }\n';
// The witness refuses when any rite it reads stands absent, so the fixture stands every rite the witness's own
// RITES list names: the founding runbook carries the planted commands, each other rite a quiet page.
const FOUNDING = 'bags/lararium/ha.ka.ba/lararium/mesh/founding-runbook.mem';
const RITE_PATHS = [...(readFileSync(join(tools, 'rite-commands-witness.sh'), 'utf8')
  .match(/^RITES = \[\n([\s\S]*?)^\]/m)?.[1] ?? '').matchAll(/pathlib\.Path\("([^"]+)"\)/g)].map(m => m[1]);
assert.ok(RITE_PATHS.includes(FOUNDING), `the witness's RITES list names the founding runbook: ${RITE_PATHS}`);
const RITE = '# rite\n\n```sh\nlares nexus admit\nlares seal\n```\n\nThe chain reads `sealKeySetHash`.\n';

// The witness `cd`s to its own parent's parent, so a copy under a scratch root reads that root's rites and modules.
function run({ rite = RITE, tables = TABLES, source = SOURCE, env = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rite-commands-'));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  mkdirSync(join(root, 'tools'));
  for (const f of ['rite-commands-witness.sh', 'code_scan.py'])
    if (existsSync(join(tools, f))) copyFileSync(join(tools, f), join(root, 'tools', f));
  for (const rel of RITE_PATHS) put(rel, rel === FOUNDING ? rite : '# a rite that instructs nothing\n');
  put('packages/lares-cli/dist/src/bin/lares.js', BIN);
  put('packages/lares-cli/src/host-bridge.ts', BRIDGE);
  put('packages/lares-cli/src/seal.ts', source);
  put('tools/lares-container.sh', SHIM);
  mkdirSync(join(root, 'mempalace', 'mempalace'), { recursive: true });
  mkdirSync(join(root, 'mempalace', 'tests'), { recursive: true });
  return spawnSync('bash', [join(root, 'tools', 'rite-commands-witness.sh')], {
    encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', JSON_CRASH: '', VERBS_JSON: JSON.stringify(tables), ...env },
  });
}

test('control: every instructed command answers and every cited symbol stands', () => {
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /2 commands instructed, 1 sub-doors checked, 1 symbols cited/);
});

test('a sub-door its door\'s table no longer names fails by that table', () => {
  const r = run({ tables: { ...TABLES, nexus: ["seal"] } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /'nexus admit' — `admit` names no verb in the `nexus` table/);
});

test('a door with no table reads its next word as an argument, never a sub-door', () => {
  const r = run({ rite: RITE.replace('lares seal\n', 'lares seal\nlares ghost walk\n') });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /3 commands instructed, 1 sub-doors checked/);
});

test('a tree table reads three words deep: a live third word answers, and a dead one fails at its path', () => {
  const live = run({ rite: RITE.replace('lares seal\n', 'lares seal open now\n') });
  assert.equal(live.status, 0, live.stdout + live.stderr);
  assert.match(live.stdout, /2 commands instructed, 3 sub-doors checked/);
  const dead = run({ rite: RITE.replace('lares seal\n', 'lares seal open later\n') });
  assert.equal(dead.status, 1, dead.stdout + dead.stderr);
  assert.match(dead.stdout, /'seal open later' — `later` names no verb in the `seal open` table/);
});

test('a census whose rows carry no verb table refuses rather than checking no sub-door', () => {
  const r = run({ tables: { nexus: null, seal: null, ghost: null } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /carries NO verb table/);
});

test('a cited symbol that only prefixes a longer name reads as a ghost', () => {
  const r = run({ rite: RITE.replace('`sealKeySetHash`', '`sealKeySet`') });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /`sealKeySet` — cited by the rite, defined nowhere in source/);
});

test('rites that instruct no command refuse: an empty census checks nothing', () => {
  const r = run({ rite: '# rite\n\nNothing to run here; the chain reads `sealKeySetHash`.\n' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /instruct NO command/);
});

test('a door census that crashes refuses rather than reading zero doors', () => {
  const r = run({ env: { JSON_CRASH: '1' } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /`help --json` did not answer/);
});
