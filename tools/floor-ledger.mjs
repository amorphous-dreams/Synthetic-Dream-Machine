#!/usr/bin/env node
/**
 * floor-ledger — the HOST's hand on the test floor's queue (mandate/floor-gate-1). The queue's law (arrival order, dedupe by
 * ticket and by green sha, the ticket block, the byte rows) runs in the wiki VM, in the `floor-queue` filter operator
 * (`packages/lararium-tw5/src/floor-ledger.ts`); this tool only APPENDS lines and ASKS views, through the doors:
 *
 *   append  `lares put title=<ledger> append=- create=true`   (two appends at once both land)
 *   ask     `lares wiki render --recipe default --form text --text '<$text text={{{ [[<ledger>]floor-queue[<view>],[<arg>]…] }}}/>'`
 *
 * While the doors stand dark (a locked vessel, no hearth), an append lands in the flat mirror `<lock dir>/.floor/queue.log`
 * (the lock dir: `<passwd home>/.lares-scratch` by default, so `~/.lares-scratch/.floor/queue.log`), the same lines, never a
 * second store: `otakiage` folds the mirror into the ledger once the doors answer. A dark ask answers nothing, so the floor
 * runner skips the sha dedupe and says so.
 *
 *   node tools/floor-ledger.mjs enqueue --lane <pet> [--sha <sha>] [--branch <b>] [--body <n>] [--base <ref>] [--run '<command>']… [--why '<words>']
 *   node tools/floor-ledger.mjs land <ticket> <merge-sha>   the lane's branch landed on develop at that merge
 *   node tools/floor-ledger.mjs miss <ticket> <words…>      a red this ticket's green missed, seen elsewhere (another sha, develop, CI)
 *   node tools/floor-ledger.mjs drop <ticket> <reason…>
 *   node tools/floor-ledger.mjs ask <view> [<arg>]          waiting · next · skip · taken · green · red · stopped · dropped · budget · ticket · runs · sha · green-sha · miss · lane · runs-per-landing · line
 *   node tools/floor-ledger.mjs otakiage                    fold the dark-door mirror into the ledger
 *
 * THE TICKET COMPUTES (plan/the-harness-proves, phase 1). A spirit hands back a LANE and a SHA, never a file list: `enqueue`
 * asks the seam fold (`tools/floor-owes.mjs`: the sha's diff over develop, folded by the wiki's `floor-owes` filter or by
 * develop's own fold) and writes what it answers as the ticket's OWES row, beside the QUEUE and HANDBACK rows:
 *   floor ticket <pet>[#<n>] · <branch>@<sha9> · <verb> · <suites>
 * `<verb>` reads `gate` (the bench gate runs the owed set), `wide` (no fold answered, so the gate fails wide) or `refuse` (a
 * touched path stands in no seam: nothing queues, the refusal names the path and its cure, exit 1). `--lane` names the
 * SPIRIT (its pet name), never one of its bodies: the floor serves lanes, and `--body <n>` rides as a note. `--sha` reads HEAD
 * and `--branch` the checkout's branch where unnamed. A `--run` names a whole command the ticket also owes (a re-bake, a
 * build), never a list of test files: the fold names those.
 *
 * LARES_BIN names another `lares` (a path to lares.mjs/.js runs under this node). Exit: 0 landed (door or mirror) · 1 an ask
 * the doors could not answer, or an otakiage that could not land · 2 usage.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockPath } from './floor-lock.mjs';

export const LEDGER = 'lar:///ha.ka.ba/kahua/memory/state/test-floor';
const WORD = /^[A-Za-z0-9._/-]+$/;
const SHA = /^[0-9a-f]{7,40}$/i;

/** The ticket id a lane and sha mint (the VM fold reads the same shape): `<lane>@<first nine hex>`. */
export const ticketId = (lane, sha) => `${lane}@${String(sha).toLowerCase().slice(0, 9)}`;
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** Bytes as the ledger writes them: gigabytes, two places; `?` where unmeasured. */
export const gb = (bytes) => (Number.isFinite(bytes) ? (bytes / 1024 ** 3).toFixed(2) : '?');

export function queueLines({ lane, branch, sha, runs = [], why = '', body = '', owes = '' }) {
  if (!WORD.test(lane ?? '')) throw new Error(`--lane wants one word ([A-Za-z0-9._/-]); got "${lane ?? ''}"`);
  if (!WORD.test(branch ?? '')) throw new Error(`--branch wants one word; got "${branch ?? ''}"`);
  if (!SHA.test(sha ?? '')) throw new Error(`--sha wants 7 to 40 hex; got "${sha ?? ''}"`);
  if (String(body ?? '') !== '' && !/^[0-9]+$/.test(String(body))) throw new Error(`--body wants a whole number (the lane's body); got "${body}"`);
  const id = ticketId(lane, sha);
  return [
    `QUEUE ${id} ${lane} ${branch} ${sha.toLowerCase()}`,
    `HANDBACK ${id}${String(body ?? '') !== '' ? ` body=${body}` : ''}`,
    ...runs.map(oneLine).filter(Boolean).map((r) => `RUN ${id} ${r}`),
    ...(oneLine(owes) ? [`OWES ${id} ${oneLine(owes)}`] : []),
    ...(oneLine(why) ? [`WHY ${id} ${oneLine(why)}`] : []),
  ];
}

/**
 * THE COMPUTED TICKET off one owed set (as `tools/floor-owes.mjs` `owes()` answers it): { verb, suites, refused }. The
 * suites word counts what the gate will run past its fixed floor; the digest names the exact set (`owes=`, the gate's own
 * verdict line carries the same word).
 */
export function ticketOf(owed) {
  if ((owed.refuse ?? []).length > 0) return { verb: 'refuse', suites: owed.refuse.map((r) => r.path).join(' '), refused: owed.refuse };
  if (owed.via === 'dark') return { verb: 'wide', suites: `the touched packages' heavy tier and the whole node e2e set (no fold answered: ${oneLine(owed.why) || 'unread'})`, refused: [] };
  const tiers = {};
  for (const f of owed.files) tiers[f.tier] = (tiers[f.tier] ?? 0) + 1;
  const byTier = ['vessel', 'heavy', 'swift', 'tool', 'dark'].filter((t) => tiers[t]).map((t) => `${t}:${tiers[t]}`).join(',');
  const sets = owed.sets.map((s) => s.name).join(',');
  return { verb: 'gate', suites: `sets=${sets || 'none'} files=${owed.files.length}${byTier ? `(${byTier})` : ''} globs=${owed.globs.length} touched=${owed.touched.length} owes=${owed.digest.slice(0, 12)} via=${owed.via.replace(/\s+/g, ':')}`, refused: [] };
}

/** The one line a hand-back carries (the VM's `line` view renders the same words off the ledger). */
export const ticketLine = ({ lane, body = '', branch, sha, verb, suites }) => `floor ticket ${lane}${String(body ?? '') !== '' ? `#${body}` : ''} · ${branch}@${String(sha).toLowerCase().slice(0, 9)} · ${verb} · ${suites}`;

/**
 * ENQUEUE BY LANE AND SHA: ask the fold, then append the ticket. Answers { queued, id, line, lines, landed, refused }; a
 * refusal (a touched path in no seam) queues nothing. `owes` and `append` ride in for a test; `git` answers a ref's sha
 * and the checkout's branch.
 */
export async function enqueue({ lane, sha, branch, body = '', base, runs = [], why = '' }, { env = process.env, owes, put = append, git = gitWord } = {}) {
  if (!WORD.test(lane ?? '')) throw new Error(`--lane wants one word ([A-Za-z0-9._/-]), the spirit's pet name; got "${lane ?? ''}"`);
  // A sha this checkout cannot read still queues: the fold reads its facts as UNREAD and owes MORE for it, never less.
  const head = git(['rev-parse', '--verify', '--end-of-options', `${sha || 'HEAD'}^{commit}`]) || (SHA.test(sha ?? '') ? sha.toLowerCase() : '');
  if (!SHA.test(head)) throw new Error(`--sha wants 7 to 40 hex or a ref this checkout holds; got "${sha ?? 'HEAD'}"`);
  const named = branch || git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!WORD.test(named) || named === 'HEAD') throw new Error('--branch wants the lane\'s branch (this checkout stands on none)');
  const fold = owes ?? (await import('./floor-owes.mjs')).owes;
  const owed = fold({ head, ...(base ? { base } : {}), env });
  const t = ticketOf(owed);
  const line = ticketLine({ lane, body, branch: named, sha: head, verb: t.verb, suites: t.suites });
  const id = ticketId(lane, head);
  if (t.verb === 'refuse') return { queued: false, id, line, lines: [], landed: null, refused: t.refused };
  const lines = queueLines({ lane, branch: named, sha: head, runs, why, body, owes: `${t.verb} · ${t.suites}` });
  return { queued: true, id, line, lines, landed: put(lines, { env }), refused: [] };
}

function gitWord(args) {
  const r = spawnSync('git', args, { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

export function landLine(id, merge) {
  if (!SHA.test(merge ?? '')) throw new Error(`land wants the merge's sha, 7 to 40 hex; got "${merge ?? ''}"`);
  return `LAND ${id} ${merge.toLowerCase()}`;
}
export const missLine = (id, words) => `MISS ${id} ${oneLine(words)}`;
const runKey = (run) => (Number.isInteger(run) && run > 0 ? ` run=${run}` : '');
export const takeLine = (id, holder, cFreeBytes, run) => `TAKE ${id} ${holder || 'familiar'} c-free=${gb(cFreeBytes)}${runKey(run)}`;
export const doneLine = (id, verdict, wroteBytes, cDropBytes, verdictLine = '', run) => `DONE ${id} ${verdict} wrote=${gb(wroteBytes)} c-drop=${gb(cDropBytes)}${runKey(run)} · ${oneLine(verdictLine)}`.trimEnd();
export const dropLine = (id, reason) => `DROP ${id} ${oneLine(reason)}`;

/** The `lares` command and its leading args. */
export function laresCommand(env = process.env) {
  const bin = env.LARES_BIN || 'lares';
  return /\.(m?js)$/.test(bin) ? [process.execPath, [bin]] : [bin, []];
}
function lares(args, { env = process.env, input } = {}) {
  const [cmd, lead] = laresCommand(env);
  const r = spawnSync(cmd, [...lead, ...args], { encoding: 'utf8', env, input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
  return { ok: r.status === 0 && !r.error, stdout: r.stdout ?? '', why: (r.error?.message || r.stderr || `exit ${r.status}`).trim().split('\n')[0] };
}

/** The dark-door mirror beside the floor lock. */
export function mirrorPath(env = process.env) {
  return join(dirname(lockPath(env)), '.floor', 'queue.log');
}

/** Append lines through the door; while it stands dark, to the mirror. Answers where they landed. */
export function append(lines, { env = process.env, door = (text) => lares(['put', `title=${LEDGER}`, 'append=-', 'create=true'], { env, input: text }) } = {}) {
  const text = `${lines.join('\n')}\n`;
  const r = door(text);
  if (r.ok) return { via: 'door' };
  const mirror = mirrorPath(env);
  mkdirSync(dirname(mirror), { recursive: true });
  appendFileSync(mirror, text);
  return { via: 'mirror', mirror, why: r.why };
}

/** Views whose one row holds whitespace and rides whole. */
const WHOLE_VIEWS = ['ticket', 'line'];

/** The wikitext the render door runs for one view: list views join on a space (ticket ids hold none); `ticket` rides whole. */
export function askText(view, arg = '') {
  const second = arg ? `,[${arg}]` : '';
  const join = WHOLE_VIEWS.includes(view) ? '' : 'join[ ]';
  return `<$text text={{{ [[${LEDGER}]floor-queue[${view}]${second}${join}] }}}/>`;
}

/** Ask the VM one view; null where the doors stand dark. */
export function ask(view, arg = '', { env = process.env, door = (text) => lares(['wiki', 'render', '--recipe', 'default', '--form', 'text', '--text', text], { env }) } = {}) {
  const r = door(askText(view, arg));
  if (!r.ok) return null;
  const out = r.stdout.trim();
  return WHOLE_VIEWS.includes(view) ? (out ? [out] : []) : out.split(/\s+/).filter(Boolean);
}

/** Fold the mirror into the ledger: its lines land through the door, then the mirror moves to `queue.log.folded`. */
export function otakiage({ env = process.env, door } = {}) {
  const mirror = mirrorPath(env);
  if (!existsSync(mirror)) return { folded: 0 };
  const lines = readFileSync(mirror, 'utf8').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { folded: 0 };
  const r = append(lines, { env, ...(door ? { door } : {}) });
  if (r.via !== 'door') {
    // The append fell to the mirror again: take back the copy it just wrote, so the mirror holds each line once.
    writeFileSync(mirror, `${lines.join('\n')}\n`);
    return { folded: 0, why: r.why };
  }
  appendFileSync(`${mirror}.folded`, `${lines.join('\n')}\n`);
  writeFileSync(mirror, '');
  return { folded: lines.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [verb, ...argv] = process.argv.slice(2);
  const usage = 'usage: floor-ledger.mjs enqueue --lane <pet> [--sha <sha>] [--branch <b>] [--body <n>] [--base <ref>] [--run <cmd>]… [--why <w>] | land <ticket> <merge-sha> | miss <ticket> <words…> | drop <ticket> <reason…> | ask <view> [<arg>] | otakiage';
  const say = (r) => console.log(r.via === 'door' ? `floor-ledger: landed in ${LEDGER}` : `floor-ledger: the doors stand dark (${r.why}); landed in the mirror ${r.mirror}; fold it later: node tools/floor-ledger.mjs otakiage`);
  // NO TOP-LEVEL AWAIT: floor-owes.mjs imports this module, so a main that awaited its dynamic import would wait on its own
  // evaluation and never settle. The verbs run in a function the module calls once its own evaluation completes.
  const cli = async () => {
    if (verb === 'enqueue') {
      const o = { runs: [] };
      for (let i = 0; i < argv.length; i += 2) {
        const [k, v] = [argv[i], argv[i + 1]];
        if (v === undefined) throw new Error(`${k} wants a value`);
        if (k === '--lane') o.lane = v; else if (k === '--branch') o.branch = v; else if (k === '--sha') o.sha = v;
        else if (k === '--body') o.body = v; else if (k === '--base') o.base = v;
        else if (k === '--run') o.runs.push(v); else if (k === '--why') o.why = v;
        else throw new Error(`unknown argument ${k}`);
      }
      const r = await enqueue(o);
      console.log(r.line);
      if (!r.queued) {
        for (const x of r.refused) console.error(`REFUSE ${x.path} · ${x.why}`);
        console.error('floor-ledger: nothing queued. pono: seat each refused path in packages/lararium-tw5/tiddlers-lararium/floor-seams.tid (a MOVES row on the seam it moves, or FREE, or CONFIG), land that row on develop (develop\'s own table judges every lane), then enqueue again');
        process.exit(1);
      }
      say(r.landed);
      console.log(`floor-ledger: queued ${r.id}`);
    } else if (verb === 'land' && argv.length === 2) {
      say(append([landLine(argv[0], argv[1])]));
    } else if (verb === 'miss' && argv.length >= 2) {
      say(append([missLine(argv[0], argv.slice(1).join(' '))]));
    } else if (verb === 'drop' && argv.length >= 2) {
      say(append([dropLine(argv[0], argv.slice(1).join(' '))]));
    } else if (verb === 'ask' && argv.length >= 1) {
      const out = ask(argv[0], argv[1] ?? '');
      if (out === null) { console.error('floor-ledger: the doors stand dark; no view answers (read the mirror by hand, or unlock the vessel)'); process.exit(1); }
      for (const row of out) console.log(row);
    } else if (verb === 'otakiage') {
      const r = otakiage();
      if (r.why) { console.error(`floor-ledger: the doors stand dark (${r.why}); the mirror stays`); process.exit(1); }
      console.log(`floor-ledger: folded ${r.folded} line(s) into ${LEDGER}`);
    } else { console.error(usage); process.exit(2); }
  };
  cli().catch((error) => { console.error(`floor-ledger: ${error.message}`); process.exit(2); });
}
