// floor-ledger — the host appends and asks; the queue's law stays in the wiki VM. Dark doors land in the mirror beside the lock.
// RED-FIRST: written by floor-warden#2 (mandate/floor-gate-1), run by the familiar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { append, ask, askText, doneLine, dropLine, gb, LEDGER, mirrorPath, otakiage, queueLines, takeLine, ticketId } from './floor-ledger.mjs';

const TOOL = fileURLToPath(new URL('./floor-ledger.mjs', import.meta.url));
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';
const scratchEnv = () => { const d = mkdtempSync(join(tmpdir(), 'floor-ledger-')); return { d, env: { ...process.env, LARES_BATTERY_LOCK: join(d, 'lock'), LARES_BIN: '/nonexistent/lares' } }; };

test('RED: the line builders write the grammar the VM fold reads', () => {
  assert.equal(ticketId('lane-a', SHA.toUpperCase()), 'lane-a@abcdef012');
  assert.deepEqual(queueLines({ lane: 'lane-a', branch: 'spirit/a', sha: SHA, runs: ['pnpm  --filter x\\n test', ''], why: 'proves  it' }), [
    `QUEUE lane-a@abcdef012 lane-a spirit/a ${SHA}`,
    'RUN lane-a@abcdef012 pnpm --filter x\\n test',
    'WHY lane-a@abcdef012 proves it',
  ]);
  assert.equal(takeLine('t@1234567', 'lares-alpha', 2 * 1024 ** 3), 'TAKE t@1234567 lares-alpha c-free=2.00');
  assert.equal(doneLine('t@1234567', 'GREEN', NaN, 0.5 * 1024 ** 3, 'exit 0 · pnpm build'), 'DONE t@1234567 GREEN wrote=? c-drop=0.50 · exit 0 · pnpm build');
  assert.equal(dropLine('t@1234567', 'lane  withdrawn'), 'DROP t@1234567 lane withdrawn');
  assert.equal(gb(NaN), '?');
  assert.throws(() => queueLines({ lane: 'two words', branch: 'b', sha: SHA }), /--lane/);
  assert.throws(() => queueLines({ lane: 'a', branch: 'b', sha: 'xyz' }), /--sha/);
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
