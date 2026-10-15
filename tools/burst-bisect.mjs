#!/usr/bin/env node
/** Push a bounded linear commit range to isolated e2e shard branches, then clean them all. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: burst-bisect.mjs <lane> <good-sha> <bad-sha> [--max <n>] [--all]';
const exec = promisify(execFile);
const shaRe = /^[0-9a-f]{7,40}$/i;
const laneRe = /^[a-z0-9][a-z0-9-]{0,39}$/;
async function defaultRun(cmd, args, cwd) {
  const { stdout } = await exec(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}
const defaultSleep = ms => new Promise(done => setTimeout(done, ms));

export function parseArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const [lane, good, bad, ...flags] = args;
  if (!lane || !good || !bad || !laneRe.test(lane) || !shaRe.test(good) || !shaRe.test(bad)) throw new Error(USAGE);
  let max = 8, all = false;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--all') all = true;
    else if (flags[i] === '--max' && /^\d+$/.test(flags[i + 1] ?? '') && Number(flags[i + 1]) > 0) max = Number(flags[++i]);
    else throw new Error(USAGE);
  }
  return { lane, good, bad, max, all };
}
async function bounded(items, max, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(max, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; await fn(item); }
  });
  await Promise.all(workers);
}
function verdictFrom(run, view, log, watched) {
  const lines = log.split('\n').filter(line => line.includes('MERGE-VERIFY'));
  const summary = lines.find(line => /MERGE-VERIFY:\s+ok=(true|false)/.test(line));
  const ok = summary && /MERGE-VERIFY:\s+ok=true\b/.test(summary);
  const failed = summary && /MERGE-VERIFY:\s+ok=false\b/.test(summary);
  const shard = lines.find(line => /MERGE-VERIFY problem:.*(?:shard|set )/i.test(line))?.match(/MERGE-VERIFY problem:\s*(.*)/)?.[1] ?? null;
  const status = view.status === 'completed'
    ? (view.conclusion === 'success' && watched && ok ? 'green' : view.conclusion === 'failure' && failed && shard ? 'red' : 'unknown')
    : 'unknown';
  return { ...run, runId: view.databaseId ?? run.runId, url: view.url ?? null, status, shard, lines };
}

export async function burstBisect({ repoRoot = resolve('.'), lane, good, bad, max = 8, all = false, run = defaultRun, sleep = defaultSleep, now = Date.now, log = console.log, findBudgetMs = 120_000, pollMs = 3000 }) {
  if (!laneRe.test(lane ?? '') || !shaRe.test(good ?? '') || !shaRe.test(bad ?? '') || !Number.isSafeInteger(max) || max < 1) throw new Error(USAGE);
  const call = (cmd, args) => run(cmd, args, repoRoot);
  if ((await call('git', ['config', '--get', 'core.bare'])).trim() !== 'false') throw new Error('core.bare must read false');
  const goodSha = (await call('git', ['rev-parse', '--verify', `${good}^{commit}`])).trim();
  const badSha = (await call('git', ['rev-parse', '--verify', `${bad}^{commit}`])).trim();
  await call('git', ['merge-base', '--is-ancestor', goodSha, badSha]);
  const shas = (await call('git', ['rev-list', '--reverse', `${goodSha}..${badSha}`])).trim().split('\n').filter(Boolean);
  if (!shas.length) throw new Error('range has no commits');
  if (!all && shas.length > max) throw new Error(`range has ${shas.length} commits; cap ${max} (use --all)`);
  let previous = goodSha;
  for (const sha of shas) {
    const parents = (await call('git', ['rev-list', '--parents', '-n', '1', sha])).trim().split(/\s+/);
    if (parents.length !== 2 || parents[0] !== sha || parents[1] !== previous) throw new Error(`nonlinear range at ${sha}`);
    previous = sha;
  }
  const jobs = shas.map((sha, i) => ({ sha, branch: `ci/${lane}-b${i + 1}`, index: i + 1 }));
  // The REST ref read distinguishes a remote branch from stale local tracking data.
  for (const job of jobs) {
    try { await call('gh', ['api', `repos/{owner}/{repo}/git/ref/heads/${job.branch}`]); }
    catch (error) { if (/404|Not Found/i.test(String(error.message))) continue; throw error; }
    throw new Error(`remote branch already exists: ${job.branch}`);
  }
  const attempted = new Set();
  let result, mainError;
  try {
    const pushErrors = [];
    await bounded(jobs, max, async job => {
      try {
        // Track before the command: a transport error may follow a successful remote push.
        attempted.add(job.branch);
        await call('git', ['push', 'origin', `${job.sha}:refs/heads/${job.branch}`]);
        log(`PUSHED ${job.branch} ${job.sha}`);
      } catch (error) { pushErrors.push(error); }
    });
    if (pushErrors.length) throw pushErrors[0];
    const verdicts = new Array(jobs.length);
    await bounded(jobs, max, async job => {
      try {
        const deadline = now() + findBudgetMs;
        let found;
        do {
          const runs = JSON.parse(await call('gh', ['run', 'list', '--branch', job.branch, '--event', 'push', '--json', 'databaseId,headSha,url', '--limit', '10']));
          found = runs.find(item => item.headSha === job.sha);
          if (found) break;
          if (now() >= deadline) break;
          await sleep(pollMs);
        } while (true);
        if (!found) throw new Error('run not found by head SHA');
        let watched = true;
        try { await call('gh', ['run', 'watch', String(found.databaseId), '--exit-status', '--interval', '30']); }
        catch { watched = false; } // A failed watch can mean a red run or an unread run; only a successful watch proves green.
        const view = JSON.parse(await call('gh', ['run', 'view', String(found.databaseId), '--json', 'databaseId,status,conclusion,url']));
        const body = await call('gh', ['run', 'view', String(found.databaseId), '--log']);
        // A completed red watch exits nonzero by design. Completion + logs can still prove red.
        verdicts[job.index - 1] = verdictFrom({ ...job, runId: found.databaseId }, view, body, watched);
      } catch (error) {
        verdicts[job.index - 1] = { ...job, status: 'unknown', url: null, reason: String(error.message ?? error) };
      }
      const v = verdicts[job.index - 1];
      log(`${v.status.toUpperCase()} ${job.branch} ${job.sha} ${v.url ?? '(run unread)'}${v.shard ? ` ${v.shard}` : ''}${v.reason ? ` ${v.reason}` : ''}`);
    });
    const redIndex = verdicts.findIndex(v => v.status === 'red');
    const firstRed = redIndex >= 0 && verdicts.slice(0, redIndex).every(v => v.status === 'green') ? verdicts[redIndex] : null;
    if (firstRed) log(`FIRST RED ${firstRed.sha} ${firstRed.shard ?? '(shard unnamed)'} ${firstRed.url ?? ''}`);
    else log('FIRST RED UNKNOWN: no proven green prefix followed by a red verdict');
    result = { verdicts, firstRed };
  } catch (error) { mainError = error; }
  // Match e2e-shards' best-effort deletion: a missing or already removed branch cannot mask the verdict.
  for (const branch of attempted) {
    try { await call('git', ['push', 'origin', '--delete', branch]); log(`DELETED ${branch}`); }
    catch (error) { log(`DELETE REFUSED ${branch}: ${error.message}`); }
  }
  if (mainError) throw mainError;
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) console.log(USAGE);
    else {
      const outcome = await burstBisect(opts);
      if (!outcome.firstRed) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
