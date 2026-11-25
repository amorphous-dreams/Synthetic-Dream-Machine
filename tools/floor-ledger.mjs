#!/usr/bin/env node
/**
 * floor-ledger — the HOST's hand on the test floor's queue (mandate/floor-gate-1). The queue's law (arrival order, dedupe by
 * ticket and by green sha, the ticket block, the byte rows) runs in the wiki VM, in the `floor-queue` filter operator
 * (`packages/lararium-tw5/src/floor-ledger.ts`); this tool only APPENDS lines and ASKS views, through the doors:
 *
 *   append  `lares tiddler put <ledger> --recipe default --append - --create`   (two appends at once both land)
 *   ask     `lares wiki render --recipe default --form text --text '<$text text={{{ [[<ledger>]floor-queue[<view>],[<arg>]…] }}}/>'`
 *
 * While the doors stand dark (a locked vessel, no hearth), an append lands in the flat mirror `<lock dir>/.floor/queue.log`
 * (the lock dir: `<passwd home>/.lares-scratch` by default, so `~/.lares-scratch/.floor/queue.log`), the same lines, never a
 * second store: `otakiage` folds the mirror into the ledger once the doors answer. A dark ask answers nothing, so the floor
 * runner skips the sha dedupe and says so.
 *
 *   node tools/floor-ledger.mjs enqueue --lane <l> --branch <b> --sha <sha> [--run '<command>']… [--why '<words>']
 *   node tools/floor-ledger.mjs drop <ticket> <reason…>
 *   node tools/floor-ledger.mjs ask <view> [<arg>]          waiting · next · skip · taken · green · red · stopped · dropped · budget · ticket · runs · sha · green-sha
 *   node tools/floor-ledger.mjs otakiage                    fold the dark-door mirror into the ledger
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

export function queueLines({ lane, branch, sha, runs = [], why = '' }) {
  if (!WORD.test(lane ?? '')) throw new Error(`--lane wants one word ([A-Za-z0-9._/-]); got "${lane ?? ''}"`);
  if (!WORD.test(branch ?? '')) throw new Error(`--branch wants one word; got "${branch ?? ''}"`);
  if (!SHA.test(sha ?? '')) throw new Error(`--sha wants 7 to 40 hex; got "${sha ?? ''}"`);
  const id = ticketId(lane, sha);
  return [`QUEUE ${id} ${lane} ${branch} ${sha.toLowerCase()}`, ...runs.map(oneLine).filter(Boolean).map((r) => `RUN ${id} ${r}`), ...(oneLine(why) ? [`WHY ${id} ${oneLine(why)}`] : [])];
}
export const takeLine = (id, holder, cFreeBytes) => `TAKE ${id} ${holder || 'familiar'} c-free=${gb(cFreeBytes)}`;
export const doneLine = (id, verdict, wroteBytes, cDropBytes, verdictLine = '') => `DONE ${id} ${verdict} wrote=${gb(wroteBytes)} c-drop=${gb(cDropBytes)} · ${oneLine(verdictLine)}`.trimEnd();
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
export function append(lines, { env = process.env, door = (text) => lares(['tiddler', 'put', LEDGER, '--recipe', 'default', '--append', '-', '--create'], { env, input: text }) } = {}) {
  const text = `${lines.join('\n')}\n`;
  const r = door(text);
  if (r.ok) return { via: 'door' };
  const mirror = mirrorPath(env);
  mkdirSync(dirname(mirror), { recursive: true });
  appendFileSync(mirror, text);
  return { via: 'mirror', mirror, why: r.why };
}

/** The wikitext the render door runs for one view: list views join on a space (ticket ids hold none); `ticket` rides whole. */
export function askText(view, arg = '') {
  const second = arg ? `,[${arg}]` : '';
  const join = view === 'ticket' ? '' : 'join[ ]';
  return `<$text text={{{ [[${LEDGER}]floor-queue[${view}]${second}${join}] }}}/>`;
}

/** Ask the VM one view; null where the doors stand dark. */
export function ask(view, arg = '', { env = process.env, door = (text) => lares(['wiki', 'render', '--recipe', 'default', '--form', 'text', '--text', text], { env }) } = {}) {
  const r = door(askText(view, arg));
  if (!r.ok) return null;
  const out = r.stdout.trim();
  return view === 'ticket' ? (out ? [out] : []) : out.split(/\s+/).filter(Boolean);
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
  const usage = 'usage: floor-ledger.mjs enqueue --lane <l> --branch <b> --sha <sha> [--run <cmd>]… [--why <w>] | drop <ticket> <reason…> | ask <view> [<arg>] | otakiage';
  const say = (r) => console.log(r.via === 'door' ? `floor-ledger: landed in ${LEDGER}` : `floor-ledger: the doors stand dark (${r.why}); landed in the mirror ${r.mirror}; fold it later: node tools/floor-ledger.mjs otakiage`);
  try {
    if (verb === 'enqueue') {
      const o = { runs: [] };
      for (let i = 0; i < argv.length; i += 2) {
        const [k, v] = [argv[i], argv[i + 1]];
        if (v === undefined) throw new Error(`${k} wants a value`);
        if (k === '--lane') o.lane = v; else if (k === '--branch') o.branch = v; else if (k === '--sha') o.sha = v;
        else if (k === '--run') o.runs.push(v); else if (k === '--why') o.why = v;
        else throw new Error(`unknown argument ${k}`);
      }
      const lines = queueLines(o);
      say(append(lines));
      console.log(`floor-ledger: queued ${ticketId(o.lane, o.sha)}`);
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
  } catch (error) { console.error(`floor-ledger: ${error.message}`); process.exit(2); }
}
