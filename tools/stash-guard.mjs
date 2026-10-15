#!/usr/bin/env node
/**
 * stash-guard — a Claude Code PreToolUse hook that refuses any Bash call reaching `git stash`.
 *
 * ── THE FAILURE THIS CLOSES ─────────────────────────────────────────────────────────────────────
 * The stash stack lives at one `refs/stash` shared by every worktree and session over one repository,
 * so a bare `git stash` moves another hand's uncommitted work. The lane law forbids `git stash` in any
 * form, `stash list` included, and four hands still chained `git stash list` onto read commands in one
 * night. Git offers no pre-stash hook, so the guard stands in front of the shell, in the harness.
 *
 * ── HOW IT READS A COMMAND ──────────────────────────────────────────────────────────────────────
 * A quote-aware lexer turns the command into words. EVERY word that names git (any path, a leading
 * backslash, any position) opens a git invocation: global options get skipped, attached values
 * included, and the first remaining word names the subcommand. `stash`, or an alias that resolves to
 * stash (set by `-c alias.x=…` or read from git config), refuses. Reading every word rather than argv0
 * alone covers `xargs git stash`, `find -exec git stash`, `sudo`, `env`, `nice` and their kin in one
 * rule. Strings a shell runs get read as scripts in turn: `bash -c`/`sh -c`/`zsh -c`, `eval`, `$( )`,
 * backticks, and a heredoc fed to a shell. A quoted string stays one word, so `rg 'git stash'` and a
 * commit message holding the word pass.
 *
 * ── WHICH WAY IT FAILS ──────────────────────────────────────────────────────────────────────────
 * Toward refusal. A command the lexer cannot read (an unterminated quote or substitution) refuses
 * whenever its raw text names both git and stash, and a fault inside the guard does the same. An
 * unquoted `echo git stash` refuses too: the safe direction, and the cure reads as quoting it.
 *
 * The harness runs it with the hook JSON on stdin (`tool_input.command`, `cwd`); exit 2 blocks the
 * call and hands the one stderr line back to the model; exit 0 lets it run.
 */
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
/** Git global options that take their value as the NEXT word when written bare. */
const TAKES_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--exec-path', '--list-cmds']);
export const REASON = "stash-guard: refused — never `git stash` in any form, `stash list` included (lane law): the stash stack spans every worktree and session over this repository. Read the tree with git status, diff or log instead.";

class Unreadable extends Error {}

/** Quote-aware lexer: words, operators, and the scripts nested inside substitutions and heredocs. */
export function lex(src) {
  const words = []; const scripts = []; const heredocs = [];
  let i = 0; let cur = null; let pendingHeredoc = null;
  const flush = () => { if (cur !== null) { words.push(cur); cur = null; } };
  const add = (s) => { cur = (cur ?? '') + s; };
  const readUntilClose = (open, close, start) => {
    let depth = 1; let j = start;
    while (j < src.length) {
      const ch = src[j];
      if (ch === '\\') { j += 2; continue; }
      if (ch === "'" ) { const k = src.indexOf("'", j + 1); if (k < 0) throw new Unreadable(); j = k + 1; continue; }
      if (ch === open && open !== close) depth++;
      else if (ch === close) { depth--; if (depth === 0) return j; }
      j++;
    }
    throw new Unreadable();
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { if (i + 1 >= src.length) throw new Unreadable(); if (src[i + 1] !== '\n') add(src[i + 1]); i += 2; continue; }
    if (ch === "'") { const k = src.indexOf("'", i + 1); if (k < 0) throw new Unreadable(); add(src.slice(i + 1, k)); i = k + 1; continue; }
    if (ch === '"') {
      let j = i + 1; let s = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '(') { const k = readUntilClose('(', ')', j + 2); scripts.push(src.slice(j + 2, k)); s += src.slice(j, k + 1); j = k + 1; continue; }
        if (src[j] === '`') { const k = src.indexOf('`', j + 1); if (k < 0) throw new Unreadable(); scripts.push(src.slice(j + 1, k)); j = k + 1; continue; }
        s += src[j++];
      }
      if (j >= src.length) throw new Unreadable();
      add(s); i = j + 1; continue;
    }
    if (ch === '$' && src[i + 1] === '(') { const k = readUntilClose('(', ')', i + 2); scripts.push(src.slice(i + 2, k)); add(src.slice(i, k + 1)); i = k + 1; continue; }
    if ((ch === '<' || ch === '>') && src[i + 1] === '(') { const k = readUntilClose('(', ')', i + 2); scripts.push(src.slice(i + 2, k)); flush(); i = k + 1; continue; }
    if (ch === '`') { const k = src.indexOf('`', i + 1); if (k < 0) throw new Unreadable(); scripts.push(src.slice(i + 1, k)); i = k + 1; continue; }
    if (ch === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
      flush(); let j = i + 2; if (src[j] === '-') j++;
      while (src[j] === ' ' || src[j] === '\t') j++;
      let delim = ''; while (j < src.length && !/[\s;&|<>()]/.test(src[j])) delim += src[j++];
      delim = delim.replace(/['"\\]/g, '');
      if (!delim) throw new Unreadable();
      pendingHeredoc = { delim, owner: words.length }; i = j; continue;
    }
    if (ch === '\n') {
      flush(); words.push(';');
      if (pendingHeredoc) {
        const lines = src.slice(i + 1).split('\n'); const body = []; let used = i + 1; let closed = false;
        for (const line of lines) { used += line.length + 1; if (line.replace(/^\t+/, '') === pendingHeredoc.delim) { closed = true; break; } body.push(line); }
        if (!closed) throw new Unreadable();
        heredocs.push({ body: body.join('\n'), owner: pendingHeredoc.owner }); pendingHeredoc = null; i = used; continue;
      }
      i++; continue;
    }
    if (/[;&|()]/.test(ch)) { flush(); words.push(';'); i++; continue; }
    if (/\s/.test(ch)) { flush(); i++; continue; }
    add(ch); i++;
  }
  if (pendingHeredoc) throw new Unreadable();
  flush();
  return { words, scripts, heredocs };
}

function commandsOf(words) {
  const out = []; let cmd = [];
  for (const w of words) { if (w === ';') { if (cmd.length) out.push(cmd); cmd = []; } else cmd.push(w); }
  if (cmd.length) out.push(cmd);
  return out;
}

const isGit = (w) => basename(w.replace(/^\\/, '')) === 'git';

/** The git invocation starting at `words[at]`: its alias assignments and the word that names the subcommand. */
function gitSubcommand(words, at) {
  const aliases = new Map(); let j = at + 1;
  while (j < words.length && words[j].startsWith('-') && words[j] !== '-') {
    const w = words[j];
    if (w === '-c' && j + 1 < words.length) { const m = /^alias\.([^=]+)=(.*)$/s.exec(words[j + 1]); if (m) aliases.set(m[1], m[2]); j += 2; continue; }
    if (w.startsWith('-c') && w.length > 2) { const m = /^alias\.([^=]+)=(.*)$/s.exec(w.slice(2)); if (m) aliases.set(m[1], m[2]); j += 1; continue; }
    if (TAKES_VALUE.has(w)) { j += 2; continue; }
    j += 1;
  }
  return { sub: words[j], aliases };
}

const namesStash = (s) => /(^|[\s;&|!])stash(\s|$)/.test(` ${s}`) || /^!?.*\bgit\b.*\bstash\b/s.test(s);

/** True where the command, read as a shell script, reaches `git stash`. */
export function reachesStash(src, configAliases = new Map(), depth = 0) {
  if (depth > 8) return /\bgit\b/.test(src) && /\bstash\b/.test(src);
  let lexed;
  try { lexed = lex(src); } catch (e) { if (e instanceof Unreadable) return /\bgit\b/.test(src) && /\bstash\b/.test(src); throw e; }
  const { words, scripts, heredocs } = lexed;
  for (const s of scripts) if (reachesStash(s, configAliases, depth + 1)) return true;
  for (const cmd of commandsOf(words)) {
    // An environment override that carries a stash alias into a git run.
    if (cmd.some((w) => /^GIT_CONFIG_(VALUE|PARAMETERS)/.test(w) && /\bstash\b/.test(w))) return true;
    for (let k = 0; k < cmd.length; k++) {
      const w = cmd[k]; const name = basename(w.replace(/^\\/, ''));
      if (isGit(w)) {
        const { sub, aliases } = gitSubcommand(cmd, k);
        if (sub === 'stash') return true;
        const alias = sub !== undefined ? (aliases.get(sub) ?? configAliases.get(sub)) : undefined;
        if (alias !== undefined && namesStash(alias)) return true;
      }
      if (SHELLS.has(name)) {
        for (let m = k + 1; m < cmd.length; m++) {
          if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(cmd[m]) && m + 1 < cmd.length) { if (reachesStash(cmd[m + 1], configAliases, depth + 1)) return true; break; }
          if (!cmd[m].startsWith('-')) break;
        }
      }
      if (name === 'eval' && reachesStash(cmd.slice(k + 1).join(' '), configAliases, depth + 1)) return true;
    }
  }
  // A heredoc fed to a shell runs as a script; one fed to anything else stays data.
  for (const h of heredocs) {
    let start = 0;
    words.slice(0, h.owner).forEach((w, n) => { if (w === ';') start = n + 1; });
    const owner = words.slice(start, h.owner);
    if (owner.some((w) => SHELLS.has(basename(w)) || w === 'eval' || w === 'source' || w === '.')) {
      if (reachesStash(h.body, configAliases, depth + 1)) return true;
    }
  }
  return false;
}

/** The repository's own aliases, read once; a read that fails leaves none. */
export function readConfigAliases(cwd) {
  const out = new Map();
  try {
    const text = execFileSync('git', ['config', '--get-regexp', '^alias\\.'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of text.split('\n')) { const m = /^alias\.(\S+)\s+(.*)$/.exec(line); if (m) out.set(m[1], m[2]); }
  } catch { /* no aliases, or no repository here */ }
  return out;
}

export function decide(input, aliases) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string') return { refuse: false };
  return { refuse: reachesStash(command, aliases ?? readConfigAliases(input.cwd || process.cwd())) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    try {
      const { refuse } = decide(JSON.parse(raw || '{}'));
      if (refuse) { process.stderr.write(`${REASON}\n`); process.exit(2); }
      process.exit(0);
    } catch {
      // A fault in the guard fails closed where the raw input names both git and stash.
      if (/\bgit\b/.test(raw) && /\bstash\b/.test(raw)) { process.stderr.write(`${REASON}\n`); process.exit(2); }
      process.exit(0);
    }
  });
}
