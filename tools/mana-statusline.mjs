#!/usr/bin/env node
/**
 * Statusline tee for the mana ledger. Claude Code pipes its statusline JSON
 * to this script on stdin; for a subscriber the JSON carries
 * rate_limits.{five_hour,seven_day}.{used_percentage,resets_at}. The script
 * appends one line to <log> when a percent changes (counts and times only,
 * nothing else from the input) and prints a short status line.
 *
 *   statusLine: { "type": "command", "command": "node <checkout>/tools/mana-statusline.mjs <log>" }
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pick = w => w && typeof w.used_percentage === 'number'
  ? { used_percentage: w.used_percentage, resets_at: w.resets_at } : undefined;

/** The reading this input carries, or null when the input names no plan limit. */
export function reading(input, now = new Date()) {
  const rl = input?.rate_limits;
  const seven_day = pick(rl?.seven_day), five_hour = pick(rl?.five_hour);
  if (!seven_day && !five_hour) return null;
  return { t: now.toISOString(), ...(seven_day && { seven_day }), ...(five_hour && { five_hour }) };
}

const same = (a, b) => JSON.stringify([a?.seven_day, a?.five_hour]) === JSON.stringify([b?.seven_day, b?.five_hour]);

export function lastLine(text) {
  const lines = text.trimEnd().split('\n');
  try { return JSON.parse(lines.at(-1)); } catch { return null; }
}

export function status(r) {
  if (!r) return '';
  const p = w => `${Math.round(w.used_percentage)}%`;
  return [r.seven_day && `7d:${p(r.seven_day)}`, r.five_hour && `5h:${p(r.five_hour)}`].filter(Boolean).join(' ');
}

export function tee(stdin, log, now = new Date()) {
  let input; try { input = JSON.parse(stdin); } catch { return ''; }
  const r = reading(input, now);
  if (r && log) {
    const prev = existsSync(log) ? lastLine(readFileSync(log, 'utf8')) : null;
    if (!same(prev, r)) appendFileSync(log, JSON.stringify(r) + '\n');
  }
  return status(r);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => { buf += c; });
  process.stdin.on('end', () => {
    try { process.stdout.write(tee(buf, process.argv[2])); } catch { /* a statusline never breaks the session */ }
  });
}
