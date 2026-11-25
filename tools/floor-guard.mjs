#!/usr/bin/env node
/**
 * floor-guard — a Claude Code PreToolUse(Bash) hook: a TASKED SPIRIT never runs a build, a test or an image build; it hands
 * the command back and the familiar runs it on the floor (operator, 2026-11-25, after the second WSL VHD crash: "only
 * familiar-class spirit instances may run tests"). mandate/floor-gate-1; research/test-floor-proposal §1b.
 *
 * ── WHO IT REFUSES ──────────────────────────────────────────────────────────────────────────────
 * Claude Code's hook input carries `agent_id` ONLY when the hook fires inside a sub-agent (an Agent-tool worker); the main
 * thread never carries it, even in an `--agent` session (read off the installed harness, 2.1.332: "Use this field (not
 * agent_type) to distinguish subagent calls from main-thread calls"). So a call carrying a non-empty `agent_id` stands a
 * tasked spirit's, and a heavy verb in it refuses; a main-thread call (the familiar) passes. A seat the harness never wraps
 * (a Codex seat, a hand-typed shell, a headless `claude -p` lane) meets the TOOL WALL instead: the heavy tools refuse to run
 * outside the one floor lock (`tools/floor-lock.mjs`), so this hook stays the early, polite wall and never the only one.
 *
 * ── HOW IT READS A COMMAND ──────────────────────────────────────────────────────────────────────
 * stash-guard's quote-aware lexer: every word, `bash -c`, `eval`, `$( )`, backticks, heredocs fed to a shell. EVERY word
 * position that RUNS a program opens a check: the lead word, the program a wrapper runs (`xargs pnpm test`, `sudo docker
 * build`, `timeout 600 node --test`, `flock <file> pnpm build`) and the program `find -exec` runs; a word elsewhere
 * (`git log --grep vitest`, `cat node_modules/.bin/tsc`) names data and passes. A quoted string stays one word (`rg 'pnpm test'`, a commit message, pass). Read verbs pass: `--list`,
 * `--help`, `--version`, `--lock-path`, `provision-worktree.mjs --source-only`, `land-train.mjs` without `--local`.
 *
 * ── WHICH WAY IT FAILS ──────────────────────────────────────────────────────────────────────────
 * For a sub-agent, toward refusal: a command the lexer cannot read refuses where its raw text names a heavy program, and so
 * does a fault inside the guard. For the main thread it always passes: the familiar's floor never jams on the guard.
 * Exit 2 hands the one stderr reason (with its cure) back to the model; exit 0 lets the call run.
 */
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lex, commandsOf, Unreadable } from './stash-guard.mjs';

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
const READ_FLAGS = new Set(['--list', '--help', '-h', '--version', '-v', '-V', '--lock-path']);
/** pnpm options that take the next word as their value. */
const PNPM_VALUED = new Set(['--filter', '-F', '-C', '--dir', '--workspace-concurrency', '--reporter', '--loglevel', '--filter-prod']);
const HEAVY_SCRIPT = /^(build|test|typecheck|vitest|tsc|playwright|e2e)([:._-].*)?$/;
const HEAVY_BIN = new Set(['vitest', 'tsc', 'playwright', 'vite', 'tsx']);
const HEAVY_TOOLS_MJS = new Set(['provision-worktree.mjs', 'bench-gate.mjs', 'battery-legs.mjs', 'land-train.mjs', 'floor-run.mjs']);
const HEAVY_TOOLS_SH = new Set(['battery.sh', 'witness-all.sh', 'typecheck-witness.sh', 'typecheck-tests-witness.sh', 'tree-clean-witness.sh', 'browser-ci.sh']);
/** A raw command naming any of these, when the lexer cannot read it, refuses for a sub-agent. */
const HEAVY_RAW = /\b(pnpm|npm|npx|vitest|tsc|playwright|docker|kukulu|provision-worktree|bench-gate|battery|witness-all|floor-run|land-train)\b|node\s+--test/;

export const REASON_HEAD = 'floor-guard: refused — a tasked spirit never runs builds, tests or image builds; only the familiar holds the floor, one heavy run at a time (operator, 2026-11-25)';

const name = (w) => basename(String(w).replace(/^\\/, ''));
const rest = (cmd, k) => cmd.slice(k + 1);
const hasRead = (words) => words.some((w) => READ_FLAGS.has(w));

function pnpmHeavy(words) {
  let j = 0;
  while (j < words.length && words[j].startsWith('-')) { j += PNPM_VALUED.has(words[j]) ? 2 : 1; }
  const sub = words[j];
  if (sub === undefined) return words.some((w) => w === '-r' || w === '--recursive') ? 'pnpm -r' : null;
  if (READ_FLAGS.has(sub)) return null;
  if (/^(install|i|add|update|up|rebuild|dlx|ci)$/.test(sub) || HEAVY_SCRIPT.test(sub) || HEAVY_BIN.has(sub) || sub === 't') return `pnpm ${sub}`;
  if (/^(run|run-script|exec|x)$/.test(sub)) {
    let m = j + 1;
    while (m < words.length && words[m].startsWith('-')) m += PNPM_VALUED.has(words[m]) ? 2 : 1;
    const target = words[m];
    if (target !== undefined && (HEAVY_SCRIPT.test(target) || HEAVY_BIN.has(name(target)))) return `pnpm ${sub} ${target}`;
  }
  return null;
}

function npmHeavy(words) {
  const sub = words.find((w) => !w.startsWith('-'));
  if (sub === undefined) return null;
  if (/^(ci|install|i|test|t|rebuild|exec|x)$/.test(sub)) return `npm ${sub}`;
  if (/^(run|run-script)$/.test(sub)) {
    const target = words.slice(words.indexOf(sub) + 1).find((w) => !w.startsWith('-'));
    if (target !== undefined && HEAVY_SCRIPT.test(target)) return `npm run ${target}`;
  }
  return null;
}

function nodeHeavy(words) {
  for (let j = 0; j < words.length; j++) {
    const w = words[j];
    if (w === '--test' || w.startsWith('--test=')) return 'node --test';
    if (w === '-e' || w === '--eval' || w === '-p' || w === '--print') return null;
    if (w.startsWith('-')) continue;
    const script = name(w);
    if (!HEAVY_TOOLS_MJS.has(script)) return null;
    const args = words.slice(j + 1);
    if (hasRead(args)) return null;
    if (script === 'provision-worktree.mjs' && args.includes('--source-only')) return null;
    if (script === 'land-train.mjs' && !args.includes('--local')) return null;
    if (script === 'bench-gate.mjs' && args.includes('--weigh')) return null;
    return `node ${script}`;
  }
  return null;
}

function dockerHeavy(words) {
  const subs = words.filter((w) => !w.startsWith('-'));
  if (subs[0] === 'build' || subs[0] === 'buildx') return `docker ${subs[0]}`;
  if (subs[0] === 'image' && subs[1] === 'build') return 'docker image build';
  if (subs[0] === 'compose' && (subs.includes('build') || (subs.includes('up') && words.includes('--build')))) return 'docker compose build';
  return null;
}

function scriptHeavy(path, args) {
  const script = name(path);
  if (HEAVY_TOOLS_SH.has(script) && !hasRead(args)) return script;
  if (script === 'lares-container.sh' && (args[0] === 'build' || args[0] === 'rebuild')) return `lares-container.sh ${args[0]}`;
  return null;
}

function laresHeavy(words) {
  const subs = words.filter((w) => !w.startsWith('-'));
  if (subs[0] === 'rite' && subs[1] === 'kukulu') return 'lares rite kukulu';
  if (subs[0] === 'rebuild') return 'lares rebuild';
  if (subs[0] === 'found') return 'lares found';
  return null;
}

/** The heavy verb `cmd[k]` opens, or null. */
function heavyAt(cmd, k) {
  const n = name(cmd[k]);
  const after = rest(cmd, k);
  if (n === 'pnpm') return pnpmHeavy(after);
  if (n === 'npm') return npmHeavy(after);
  if (n === 'npx' || n === 'pnpx') { const bin = after.find((w) => !w.startsWith('-')); return bin && HEAVY_BIN.has(name(bin)) && !hasRead(after) ? `npx ${name(bin)}` : null; }
  if ((n === 'vitest' || n === 'playwright') && !hasRead(after)) return n;
  if (n === 'tsc' && !hasRead(after)) return 'tsc';
  if (n === 'node' || n === 'nodejs') return nodeHeavy(after);
  if (n === 'docker') return dockerHeavy(after);
  if (n === 'lares' || n === 'lares.mjs' || n === 'lares.js') return laresHeavy(after);
  if (SHELLS.has(n)) { const script = after.find((w) => !w.startsWith('-')); if (script && /\.sh$/.test(script)) return scriptHeavy(script, after.slice(after.indexOf(script) + 1)); return null; }
  // A script in command position: `tools/battery.sh …`, `./tools/witness-all.sh`.
  if (/\.sh$/.test(cmd[k])) return scriptHeavy(cmd[k], after);
  return null;
}

const WRAPPERS = new Set(['sudo', 'env', 'nice', 'ionice', 'command', 'exec', 'time', 'timeout', 'nohup', 'stdbuf', 'xargs', 'flock', 'setsid', 'chrt', 'taskset', 'unbuffer']);
/** Word positions that run a program: the lead past assignments, the program a wrapper (`sudo`, `env`, `xargs`, `timeout 60`,
 *  `flock <file>`) runs, and the program `find -exec` runs. A word elsewhere (`git log --grep vitest`) names data. */
export function commandPositions(cmd) {
  const marks = new Set();
  const isValue = (w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || /^\{\}$/.test(w) || /^[0-9.]+[smhd]?$/.test(w);
  const markFrom = (i) => {
    while (i < cmd.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(cmd[i])) i++;
    if (i >= cmd.length) return;
    marks.add(i);
    const n = name(cmd[i]);
    if (!WRAPPERS.has(n)) return;
    let j = i + 1;
    while (j < cmd.length && (cmd[j].startsWith('-') || isValue(cmd[j]))) j++;
    // `flock <lockfile> <program>`: the lock file rides before the program.
    if (n === 'flock' && j < cmd.length && /[/.]/.test(cmd[j]) && j + 1 < cmd.length) j++;
    markFrom(j);
  };
  markFrom(0);
  cmd.forEach((w, i) => { if ((w === '-exec' || w === '-execdir' || w === '-ok') && i + 1 < cmd.length) markFrom(i + 1); });
  return marks;
}

/** The first heavy verb the command, read as a shell script, reaches; null where none. */
export function heavyVerb(src, depth = 0) {
  if (depth > 8) return HEAVY_RAW.test(src) ? 'unreadable' : null;
  let lexed;
  try { lexed = lex(src); } catch (e) { if (e instanceof Unreadable) return HEAVY_RAW.test(src) ? 'unreadable' : null; throw e; }
  const { words, scripts, heredocs } = lexed;
  for (const s of scripts) { const v = heavyVerb(s, depth + 1); if (v) return v; }
  for (const cmd of commandsOf(words)) {
    const positions = commandPositions(cmd);
    for (let k = 0; k < cmd.length; k++) {
      if (!positions.has(k)) continue;
      const v = heavyAt(cmd, k);
      if (v) return v;
      const n = name(cmd[k]);
      if (SHELLS.has(n)) {
        for (let m = k + 1; m < cmd.length; m++) {
          if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(cmd[m]) && m + 1 < cmd.length) { const inner = heavyVerb(cmd[m + 1], depth + 1); if (inner) return inner; break; }
          if (!cmd[m].startsWith('-')) break;
        }
      }
      if (n === 'eval') { const inner = heavyVerb(cmd.slice(k + 1).join(' '), depth + 1); if (inner) return inner; }
    }
  }
  for (const h of heredocs) {
    let start = 0;
    words.slice(0, h.owner).forEach((w, i) => { if (w === ';') start = i + 1; });
    const owner = words.slice(start, h.owner);
    if (owner.some((w) => SHELLS.has(name(w)) || w === 'eval' || w === 'source' || w === '.')) { const inner = heavyVerb(h.body, depth + 1); if (inner) return inner; }
  }
  return null;
}

/** True where the hook fired inside a sub-agent: the harness sets `agent_id` there alone. */
export const isSubAgent = (input) => typeof input?.agent_id === 'string' && input.agent_id !== '';

export function reasonFor(verb, input) {
  const cwd = input?.cwd || process.cwd();
  const command = String(input?.tool_input?.command ?? '').replace(/\s+/g, ' ').trim();
  return `${REASON_HEAD}: ${verb}.\npono: commit and push your lane, then hand back a floor ticket: FLOOR TICKET <lane> <branch> <sha> · run: ${command} · in: ${cwd}`;
}

export function decide(input) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || !isSubAgent(input)) return { refuse: false };
  const verb = heavyVerb(command);
  return verb ? { refuse: true, verb, reason: reasonFor(verb, input) } : { refuse: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    let input = null;
    try {
      input = JSON.parse(raw || '{}');
      const out = decide(input);
      if (out.refuse) { process.stderr.write(`${out.reason}\n`); process.exit(2); }
      process.exit(0);
    } catch {
      // A fault fails closed only for a sub-agent whose raw input names a heavy program; the main thread always passes.
      const sub = input ? isSubAgent(input) : /"agent_id"\s*:\s*"[^"]+"/.test(raw);
      if (sub && HEAVY_RAW.test(raw)) { process.stderr.write(`${REASON_HEAD}: unreadable.\npono: hand the command back as a floor ticket\n`); process.exit(2); }
      process.exit(0);
    }
  });
}
