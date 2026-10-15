import test from 'node:test';
import assert from 'node:assert/strict';
import { burstBisect, parseArgs } from './burst-bisect.mjs';

const S = n => n.toString(16).padStart(40, '0');
function fake({ count = 3, reds = [], unknown = [], failPush = null, failWatch = [], failDelete = false, stale = false } = {}) {
  const calls = [], events = [], shas = Array.from({ length: count }, (_, i) => S(i + 2));
  let active = 0, peak = 0;
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git') {
      if (args[0] === 'config') return 'false\n';
      if (args[0] === 'rev-parse') return args[2]?.startsWith(S(1)) ? S(1) : S(count + 1);
      if (args[0] === 'merge-base') return '';
      if (args[0] === 'rev-list' && args[1] === '--reverse') return shas.join('\n');
      if (args[0] === 'rev-list' && args[1] === '--parents') {
        const sha = args[4]; return `${sha} ${S(Number.parseInt(sha, 16) - 1)}`;
      }
      if (args[0] === 'push' && args[2] === '--delete') { events.push(`delete:${args[3]}`); if (failDelete) throw new Error('delete refused'); return ''; }
      if (args[0] === 'push') {
        active++; peak = Math.max(peak, active); events.push(`push:${args[2]}`);
        await new Promise(done => setTimeout(done, 1)); active--;
        if (args[2].includes(`-b${failPush}`)) throw new Error('push failed');
        return '';
      }
    }
    if (cmd === 'gh') {
      if (args[0] === 'api') throw new Error('HTTP 404 Not Found');
      if (args[1] === 'list') {
        const branch = args[args.indexOf('--branch') + 1], index = Number(branch.match(/-b(\d+)$/)[1]);
        const entries = [{ databaseId: index + 100, headSha: stale ? S(99) : shas[index - 1], url: `https://example.test/runs/${index}` }];
        return JSON.stringify(entries);
      }
      if (args[1] === 'watch') {
        if (reds.includes(Number(args[2]) - 100) || failWatch.includes(Number(args[2]) - 100)) throw new Error('watch failed');
        return '';
      }
      if (args[1] === 'view') {
        const index = Number(args[2]) - 100;
        if (unknown.includes(index)) throw new Error('API unread');
        if (args.includes('--log')) return reds.includes(index)
          ? 'MERGE-VERIFY: ok=false shards=5\nMERGE-VERIFY problem: set tests: red shard: shard 2 failed\n'
          : 'MERGE-VERIFY: ok=true shards=5\n';
        return JSON.stringify({ databaseId: index + 100, status: 'completed', conclusion: reds.includes(index) ? 'failure' : 'success', url: `https://example.test/runs/${index}` });
      }
    }
    throw new Error(`unexpected ${cmd} ${args.join(' ')}`);
  };
  return { run, calls, events, shas, get peak() { return peak; } };
}
const opts = f => ({ lane: 'probe', good: S(1), bad: f.shas.at(-1), repoRoot: '/fake', run: f.run, sleep: async () => {}, now: (() => { let t = 0; return () => t += 1000; })(), findBudgetMs: 2000, log: () => {} });

test('usage, lane validation and range cap refuse before push', async () => {
  assert.throws(() => parseArgs([]), /usage/);
  assert.throws(() => parseArgs(['feature/x', S(1), S(2)]), /usage/);
  assert.deepEqual(parseArgs(['--help']), { help: true });
  const f = fake({ count: 3 });
  await assert.rejects(burstBisect({ ...opts(f), max: 2 }), /cap 2/);
  assert.equal(f.calls.some(call => call.includes('push')), false);
});

test('bounded parallel pushes map each SHA to its own branch and clean all branches', async () => {
  const f = fake({ count: 4, reds: [3] });
  const result = await burstBisect({ ...opts(f), max: 2, all: true });
  assert.equal(f.peak, 2);
  assert.equal(result.firstRed.sha, f.shas[2]);
  assert.match(result.firstRed.shard, /set tests: red shard: shard 2/);
  assert.deepEqual(f.events.filter(s => s.startsWith('push:')), f.shas.map((sha, i) => `push:${sha}:refs/heads/ci/probe-b${i + 1}`));
  assert.equal(f.events.filter(s => s.startsWith('delete:')).length, 4);
  assert.equal(result.verdicts[2].url, 'https://example.test/runs/3');
});

test('unknown predecessor blocks first-red claim and stale run never counts', async () => {
  const f = fake({ unknown: [1], reds: [2] });
  const result = await burstBisect(opts(f));
  assert.equal(result.firstRed, null);
  assert.equal(result.verdicts[0].status, 'unknown');
  const stale = fake({ stale: true });
  const unread = await burstBisect(opts(stale));
  assert.ok(unread.verdicts.every(v => v.status === 'unknown'));
  assert.equal(stale.events.filter(s => s.startsWith('delete:')).length, 3);
});

test('push failure cleans every attempted branch', async () => {
  const f = fake({ failPush: 2 });
  await assert.rejects(burstBisect(opts(f)), /push failed/);
  assert.equal(f.events.filter(s => s.startsWith('delete:')).length, 3);
});

test('failed watch with a successful view never reads green', async () => {
  const f = fake({ failWatch: [1] });
  const result = await burstBisect(opts(f));
  assert.equal(result.verdicts[0].status, 'unknown');
  assert.equal(result.firstRed, null);
});

test('discovery and deletion match shard helper policy', async () => {
  const f = fake({ failDelete: true });
  const result = await burstBisect(opts(f));
  assert.ok(result.verdicts.every(v => v.status === 'green'));
  assert.equal(f.events.filter(s => s.startsWith('delete:')).length, 3);
  assert.ok(f.calls.filter(c => c[0] === 'gh' && c[1] === 'run' && c[2] === 'list').every(c => c[c.indexOf('--limit') + 1] === '10'));
});
