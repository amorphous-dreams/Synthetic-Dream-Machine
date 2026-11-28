// floor-ledger — the host appends and asks; the queue's law stays in the wiki VM. Dark doors land in the mirror beside the lock.
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
// THE TICKET COMPUTES (plan/the-harness-proves, phase 1): enqueue takes a lane and a sha and asks the seam fold; a refused
// path queues nothing. RED-FIRST: written by hoʻāʻo#1, never run by its author.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { append, ask, askText, doneLine, dropLine, enqueue, gb, landLine, LEDGER, mirrorPath, missLine, otakiage, queueLines, takeLine, ticketId, ticketLine, ticketOf } from './floor-ledger.mjs';

const TOOL = fileURLToPath(new URL('./floor-ledger.mjs', import.meta.url));
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';
const scratchEnv = () => { const d = mkdtempSync(join(tmpdir(), 'floor-ledger-')); return { d, env: { ...process.env, LARES_BATTERY_LOCK: join(d, 'lock'), LARES_BIN: '/nonexistent/lares' } }; };

test('RED: the line builders write the grammar the VM fold reads', () => {
  assert.equal(ticketId('lane-a', SHA.toUpperCase()), 'lane-a@abcdef012');
  assert.deepEqual(queueLines({ lane: 'lane-a', branch: 'spirit/a', sha: SHA, runs: ['pnpm  --filter x\\n test', ''], why: 'proves  it' }), [
    `QUEUE lane-a@abcdef012 lane-a spirit/a ${SHA}`,
    'HANDBACK lane-a@abcdef012',
    'RUN lane-a@abcdef012 pnpm --filter x\\n test',
    'WHY lane-a@abcdef012 proves it',
  ]);
  assert.equal(takeLine('t@1234567', 'lares-alpha', 2 * 1024 ** 3), 'TAKE t@1234567 lares-alpha c-free=2.00');
  assert.equal(takeLine('t@1234567', 'lares-alpha', 2 * 1024 ** 3, 4242), 'TAKE t@1234567 lares-alpha c-free=2.00 run=4242');
  assert.match(doneLine('t@1234567', 'GREEN', 0, 0, 'exit 0', 4242), /^DONE t@1234567 GREEN wrote=0\.00 c-drop=0\.00 run=4242 · exit 0$/);
  assert.equal(doneLine('t@1234567', 'GREEN', NaN, 0.5 * 1024 ** 3, 'exit 0 · pnpm build'), 'DONE t@1234567 GREEN wrote=? c-drop=0.50 · exit 0 · pnpm build');
  assert.equal(dropLine('t@1234567', 'lane  withdrawn'), 'DROP t@1234567 lane withdrawn');
  assert.equal(gb(NaN), '?');
  assert.throws(() => queueLines({ lane: 'two words', branch: 'b', sha: SHA }), /--lane/);
  assert.throws(() => queueLines({ lane: 'a', branch: 'b', sha: 'xyz' }), /--sha/);
  assert.deepEqual(queueLines({ lane: 'hoao', branch: 'spirit/h', sha: SHA, body: '3', owes: 'gate ·  sets=none' }), [
    `QUEUE hoao@abcdef012 hoao spirit/h ${SHA}`,
    'HANDBACK hoao@abcdef012 body=3',
    'OWES hoao@abcdef012 gate · sets=none',
  ]);
  assert.throws(() => queueLines({ lane: 'hoao', branch: 'b', sha: SHA, body: 'three' }), /--body/);
  assert.equal(landLine('hoao@abcdef012', SHA.toUpperCase()), `LAND hoao@abcdef012 ${SHA}`);
  assert.throws(() => landLine('hoao@abcdef012', 'develop'), /merge's sha/);
  assert.equal(missLine('hoao@abcdef012', 'develop  read red'), 'MISS hoao@abcdef012 develop read red');
});

const OWED = {
  via: 'develop 3268bab41', why: '', touched: ['packages/lararium-node/src/shore-verb.ts', 'packages/lares-cli/src/commands/shore.ts'], refuse: [],
  sets: [{ name: 'e2e-node', why: 'trunk:island-vessel-boot' }], globs: [{ glob: 'packages/lararium-tw5/tests/wiki-shore*.test.ts', why: 'seam:disk-shore' }],
  files: [{ tier: 'vessel', path: 'tests/e2e/watcher-cut-c.test.ts', why: 'seam:disk-shore' }, { tier: 'heavy', path: 'packages/lararium-node/tests/shore-verb.test.ts', why: 'edge' }, { tier: 'heavy', path: 'packages/lares-cli/tests/shore-cmd.test.ts', why: 'edge' }, { tier: 'swift', path: 'packages/lares-cli/tests/shore-core.test.ts', why: 'edge' }],
  digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
const fakeGit = (branch = 'spirit/hoao-x') => (args) => (args.includes('--abbrev-ref') ? branch : SHA);

test('RED the ticket computes: a lane and a sha enqueue the fold\'s own answer; the spirit names no file', async () => {
  const asked = [], put = [];
  const r = await enqueue({ lane: 'hoao', sha: SHA, body: '2', why: 'the shore verb refuses a stale base' }, { owes: (o) => { asked.push(o); return OWED; }, put: (lines) => { put.push(lines); return { via: 'door' }; }, git: fakeGit() });
  assert.equal(asked.length, 1);
  assert.equal(asked[0].head, SHA);
  assert.equal(r.queued, true);
  assert.equal(r.id, 'hoao@abcdef012');
  assert.equal(r.line, 'floor ticket hoao#2 · spirit/hoao-x@abcdef012 · gate · sets=e2e-node files=4(vessel:1,heavy:2,swift:1) globs=1 touched=2 owes=0123456789ab via=develop:3268bab41');
  assert.deepEqual(put, [[
    `QUEUE hoao@abcdef012 hoao spirit/hoao-x ${SHA}`,
    'HANDBACK hoao@abcdef012 body=2',
    'OWES hoao@abcdef012 gate · sets=e2e-node files=4(vessel:1,heavy:2,swift:1) globs=1 touched=2 owes=0123456789ab via=develop:3268bab41',
    'WHY hoao@abcdef012 the shore verb refuses a stale base',
  ]]);
  assert.equal(ticketLine({ lane: 'hoao', branch: 'b', sha: SHA, verb: 'gate', suites: 'x' }), 'floor ticket hoao · b@abcdef012 · gate · x');
});

test('RED a refused path queues nothing and names its cure; a dark fold queues the wide ticket; CONTROL: an unreadable sha still queues', async () => {
  const refuse = [{ path: 'packages/lararium-node/src/stray-new-thing.ts', why: 'floor-owes: packages/lararium-node/src/stray-new-thing.ts stands in no seam; add a MOVES row to the seam table, then ask again' }];
  const put = [];
  const refused = await enqueue({ lane: 'hoao', sha: SHA }, { owes: () => ({ ...OWED, refuse, sets: [], globs: [], files: [] }), put: (l) => { put.push(l); return { via: 'door' }; }, git: fakeGit() });
  assert.equal(refused.queued, false);
  assert.deepEqual(put, [], 'a refusal appends no row');
  assert.deepEqual(refused.refused, refuse);
  assert.match(refused.line, /^floor ticket hoao · spirit\/hoao-x@abcdef012 · refuse · packages\/lararium-node\/src\/stray-new-thing\.ts$/);
  assert.deepEqual(ticketOf({ via: 'dark', why: 'develop: holds no fold', touched: [], refuse: [], sets: [], globs: [], files: [], digest: '' }).verb, 'wide');
  const wide = await enqueue({ lane: 'hoao', sha: SHA }, { owes: () => ({ via: 'dark', why: 'develop: holds no fold', touched: [], refuse: [], sets: [], globs: [], files: [], digest: '' }), put: (l) => { put.push(l); return { via: 'mirror', mirror: '/x', why: 'dark' }; }, git: fakeGit() });
  assert.equal(wide.queued, true);
  assert.match(put[0][2], /^OWES hoao@abcdef012 wide · the touched packages' heavy tier and the whole node e2e set \(no fold answered: develop: holds no fold\)$/);
  const unread = await enqueue({ lane: 'hoao', sha: SHA, branch: 'spirit/far' }, { owes: (o) => { assert.equal(o.head, SHA); return OWED; }, put: () => ({ via: 'door' }), git: () => '' });
  assert.equal(unread.queued, true);
  await assert.rejects(() => enqueue({ lane: 'hoao', sha: SHA }, { owes: () => OWED, put: () => ({ via: 'door' }), git: () => '' }), /--branch/);
  await assert.rejects(() => enqueue({ lane: 'hoao#2', sha: SHA }, { owes: () => OWED, put: () => ({ via: 'door' }), git: fakeGit() }), /--lane/);
});

test('RED the CLI refuses an unmapped path with exit 1 and its cure, and lands LAND and MISS rows in the mirror', () => {
  const { d, env } = scratchEnv();
  assert.equal(spawnSync(process.execPath, [TOOL, 'land', 'hoao@abcdef012', SHA], { encoding: 'utf8', env }).status, 0);
  assert.equal(spawnSync(process.execPath, [TOOL, 'miss', 'hoao@abcdef012', 'develop', 'read', 'red'], { encoding: 'utf8', env }).status, 0);
  assert.equal(readFileSync(join(d, '.floor', 'queue.log'), 'utf8'), `LAND hoao@abcdef012 ${SHA}\nMISS hoao@abcdef012 develop read red\n`);
  assert.equal(spawnSync(process.execPath, [TOOL, 'land', 'hoao@abcdef012', 'develop'], { encoding: 'utf8', env }).status, 2);
  assert.equal(spawnSync(process.execPath, [TOOL, 'enqueue', '--sha', SHA], { encoding: 'utf8', env }).status, 2, 'a ticket without a lane refuses');
});

test('RED: an append lands through the door when it answers, and in the mirror beside the lock when the doors stand dark', () => {
  const { d, env } = scratchEnv();
  const sent = [];
  assert.deepEqual(append(['QUEUE x@1234567 x b 1234567'], { env, door: (text) => { sent.push(text); return { ok: true }; } }), { via: 'door' });
  assert.equal(sent[0], 'QUEUE x@1234567 x b 1234567\n');
  const dark = append(['DROP x@1234567 gone'], { env, door: () => ({ ok: false, why: 'vessel-locked' }) });
  assert.equal(dark.via, 'mirror');
  assert.equal(dark.mirror, join(d, '.floor', 'queue.log'));
  assert.equal(mirrorPath(env), dark.mirror);
  assert.equal(readFileSync(dark.mirror, 'utf8'), 'DROP x@1234567 gone\n');
});

test('RED: otakiage folds the mirror through the door once, and keeps it whole while the doors stay dark', () => {
  const { env } = scratchEnv();
  append(['QUEUE x@1234567 x b 1234567', 'RUN x@1234567 pnpm build'], { env, door: () => ({ ok: false, why: 'dark' }) });
  const still = otakiage({ env, door: () => ({ ok: false, why: 'dark' }) });
  assert.equal(still.folded, 0);
  assert.equal(readFileSync(mirrorPath(env), 'utf8'), 'QUEUE x@1234567 x b 1234567\nRUN x@1234567 pnpm build\n', 'a dark fold doubles no line');
  const sent = [];
  assert.equal(otakiage({ env, door: (t) => { sent.push(t); return { ok: true }; } }).folded, 2);
  assert.equal(sent[0], 'QUEUE x@1234567 x b 1234567\nRUN x@1234567 pnpm build\n');
  assert.equal(readFileSync(mirrorPath(env), 'utf8'), '');
  assert.ok(existsSync(`${mirrorPath(env)}.folded`));
});

test('RED: ask renders the VM view through the render door; a dark door answers null', () => {
  assert.equal(askText('waiting'), `<$text text={{{ [[${LEDGER}]floor-queue[waiting]join[ ]] }}}/>`);
  assert.equal(askText('ticket', 'a@1234567'), `<$text text={{{ [[${LEDGER}]floor-queue[ticket],[a@1234567]] }}}/>`);
  assert.equal(askText('line', 'a@1234567'), `<$text text={{{ [[${LEDGER}]floor-queue[line],[a@1234567]] }}}/>`);
  assert.equal(askText('lane', 'hoao'), `<$text text={{{ [[${LEDGER}]floor-queue[lane],[hoao]join[ ]] }}}/>`);
  assert.deepEqual(ask('runs-per-landing', '', { door: () => ({ ok: true, stdout: 'hoao@ddddddddd=2/3 mean=2.00\n' }) }), ['hoao@ddddddddd=2/3', 'mean=2.00']);
  assert.deepEqual(ask('line', 'a@1234567', { door: () => ({ ok: true, stdout: 'floor ticket a · b@1234567 · gate · sets=none\n' }) }), ['floor ticket a · b@1234567 · gate · sets=none']);
  assert.deepEqual(ask('waiting', '', { door: () => ({ ok: true, stdout: 'a@1234567 b@7654321\n' }) }), ['a@1234567', 'b@7654321']);
  assert.deepEqual(ask('ticket', 'a@1234567', { door: () => ({ ok: true, stdout: 'FLOOR TICKET a b 1234567\n  run:   x\n' }) }), ['FLOOR TICKET a b 1234567\n  run:   x']);
  assert.equal(ask('next', '', { door: () => ({ ok: false, why: 'dark' }) }), null);
});

test('RED: the CLI enqueues into the mirror under dark doors, names the fold, and refuses bad usage with 2', () => {
  const { d, env } = scratchEnv();
  const r = spawnSync(process.execPath, [TOOL, 'enqueue', '--lane', 'lane-a', '--branch', 'spirit/a', '--sha', SHA, '--run', 'node tools/bench-gate.mjs'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /mirror .*otakiage/s);
  assert.match(readFileSync(join(d, '.floor', 'queue.log'), 'utf8'), /^QUEUE lane-a@abcdef012 lane-a spirit\/a abcdef/);
  assert.equal(spawnSync(process.execPath, [TOOL, 'ask', 'next'], { encoding: 'utf8', env }).status, 1);
  assert.equal(spawnSync(process.execPath, [TOOL, 'nope'], { encoding: 'utf8', env }).status, 2);
});
