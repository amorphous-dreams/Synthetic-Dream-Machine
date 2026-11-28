#!/usr/bin/env node
// door-names — every `lares …` command the house writes names a door the CLI answers.
//
// A refusal or a hand-act line that names its cure as a command (`run \`lares vessel request <id>\``) makes a promise the
// registry has to keep, and so does a doc comment or a canon meme that teaches a door. A verb that folds or renames leaves
// its spelling standing in every line that pointed at it, and nothing fails: the operator copies the line and meets
// `unknown command`. This witness walks every place the house writes such a line and asks the registry whether it answers.
//
// COLLECTED MECHANICALLY, never listed: every backtick-quoted `lares …` span (the house spells a command that way, in a
// message, a comment, a shell script or a meme) under ROOTS, every string constant whose whole value reads as a `lares …`
// line (`HAND_ACT`, `WORKBENCH_LAY_LINE`).
//
// CHECKED AGAINST THE REGISTRY, read off the BUILT CLI (`packages/lares-cli/dist`), never a list here: the first word against
// the command rows and the host shim's verbs; each word after it against the door's own verb table (the row's `verbs`), as
// deep as the table runs (`meme offer promote`). A door with no table takes arguments; a pass-through door hands its words
// to another grammar; a row's `leads` names an argument that may stand before its verb (`sense <sensorium> <verb>`). A verb
// not yet built reads in prose without the `lares ` prefix (`a \`kairos\` verb`), so it never poses as a door.
//
// THE TABLES EXIST. Every row declares `verbs` (a table, or `null` for a door that takes arguments: the typecheck refuses a
// row that says neither). The other side reads the source: an argument door whose module compares its first positional to a
// word, or switches on it, answers a sub-verb its row hides from every law, and reads red here.
//
// THE DASH SPELLINGS BURNED. Every line takes its params as name=value (packages/lares-cli/src/parse-args.ts), and the parser
// refuses every `--name`, so a named line spelling one (`lares rite kukulu --dry-run`, `lares wiki status --json`) teaches a
// line that refuses, and reads red here. The host shim's own verbs keep their own grammar, and a token past a bare `--` rides to
// another program whole. `lares help <door> …` reads its door words as the line they name.
//
// Exit 0 = every named command answers and every argument door branches on no word. The pure readers below carry their own
// self-test (tools/door-names.test.mjs), planted reds and lawful controls on text in memory.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Where the house writes a `lares …` line an operator copies. */
export const ROOTS = [
  { dir: 'packages/lares-cli/src', ext: '.ts' },
  { dir: 'packages/lararium-node/src', ext: '.ts' },
  { dir: 'tools', ext: '.sh' },
  { dir: 'bags', ext: '.mem' },
  { dir: 'wikis', ext: '.mem' },
];

/** Every `lares …` command line `text` names: backtick-quoted spans, and whole-string constants. */
export function namedCommands(text) {
  const plain = text.replace(/\\`/g, '`');
  const spans = [...plain.matchAll(/`(lares [a-z][^`\n]*)`/g)].map((m) => m[1]);
  const consts = [...text.matchAll(/=\s*"(lares [a-z][^"\n]*)"\s*;/g)].map((m) => m[1]);
  // A span whose first word ends in `:` opens a message (`lares wiki: …`), never a command line.
  return [...spans, ...consts].filter((s) => !/^lares [^\s]*:/.test(s));
}

/** Every level of a door's table, keyed by its path (`meme`, `meme offer`). */
export function flatten(path, table, out = new Map()) {
  if (table === null || table === undefined) return out;
  if (Array.isArray(table)) { out.set(path, new Set(table)); return out; }
  out.set(path, new Set(Object.keys(table)));
  for (const [verb, sub] of Object.entries(table)) flatten(`${path} ${verb}`, sub, out);
  return out;
}

const isWord = (w) => w !== undefined && /^[a-z][a-z0-9_-]*$/.test(w);

/** The call door's act keywords and the keywords the bare door reads (the keyword head: packages/lares-cli/src/keywords.ts). */
export const ACT_KEYWORDS = new Set(['get', 'put', 'delete', 'rename', 'filter']);
export const BARE_KEYWORDS = new Set(['mu', 'aperture', 'face', 'mandate', 'stance', 'mode', 'mood', 'note']);

/** The first dash spelling among a line's words (a `--name` before any bare `--`), or null. */
export function burnedDash(words) {
  for (const word of words) {
    if (word === '--') return null;
    const m = /^[[(]*--([a-z][a-z0-9-]*)/.exec(word);
    if (m) return m[1];
  }
  return null;
}

/**
 * A reader of command lines over one registry: `{ rows: [{name, verbs, passes, leads}], shim: [verb…] }`. It answers why a
 * line names no door, or null where it does. Each word past the door reads against the table at its path until a word reads
 * as an argument, a flag, or a path with no table. An interpolated word (`${…}`) reads as unchecked.
 */
export function deadDoorOver({ rows, shim }) {
  const doors = new Set([...rows.map((r) => r.name), ...shim, 'help']);
  const tables = new Map();
  for (const r of rows) flatten(r.name, r.verbs, tables);
  const passes = new Set(rows.filter((r) => r.passes).map((r) => r.name));
  const leads = new Set(rows.filter((r) => r.leads).map((r) => r.name));
  const read = (line) => {
    const words = line.split(/\s+/).slice(1).map((w) => w.split('${')[0]);
    const door = words[0];
    if (door === '') return null;
    // A DASH SPELLING: any line but a shim verb's reads red on one; params ride as name=value.
    if (!shim.includes(door)) {
      const dash = burnedDash(words.slice(1));
      if (dash !== null) return `--${dash}: dash flags burned; params ride as name=value`;
    }
    // THE HELP DOOR reads the door words it names (`lares help vessel found`).
    if (door === 'help' && words.length > 1 && words[1] !== '' && !words[1].includes('=')) return /^<[^>]+>$/.test(words[1]) ? null : read(`lares ${words.slice(1).join(' ')}`);
    // A KEYWORD LINE (`lares rite=kukulu mu=_0`, `lares get=<title>`, `lares mu=*0`): each word names a keyword; the line
    // answers where some keyword names a door, an act keyword of the call door, or the bare door's own shaping
    // (packages/lares-cli/src/keywords.ts).
    if (/^[a-z][a-z0-9-]*=/.test(door)) {
      const keys = words.filter((w) => /^[a-z][a-z0-9-]*=/.test(w)).map((w) => w.slice(0, w.indexOf('=')));
      if (keys.some((k) => doors.has(k) || ACT_KEYWORDS.has(k))) return null;
      return keys.every((k) => BARE_KEYWORDS.has(k)) ? null : `no act keyword on the keyword line (keywords: ${keys.join(' ')})`;
    }
    // AN ADDRESS NAMES ITS OWN VERB: `lares lar:///<address> …` rides the call door, which takes the address and params alone
    // (packages/lares-cli/src/parse-args.ts isCallWord).
    if (door.startsWith('lar:///')) return null;
    if (!doors.has(door)) return `no door "${door}"`;
    if (passes.has(door)) return null;
    let path = door;
    const rest = words.slice(1);
    // The row's leading argument stands before the verb only where the word after it is a verb the door answers.
    if (leads.has(door) && isWord(rest[0]) && !tables.get(door)?.has(rest[0]) && tables.get(door)?.has(rest[1] ?? '')) rest.shift();
    for (const word of rest) {
      const table = tables.get(path);
      if (table === undefined || !isWord(word)) return null;
      if (!table.has(word)) return `"${path}" declares no verb "${word}"`;
      path = `${path} ${word}`;
    }
    return null;
  };
  return read;
}

/** The command module each handler comes from, read off the CLI table's own imports. */
export function handlerModules(tableSource) {
  const out = new Map();
  for (const m of tableSource.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\.\/commands\/([A-Za-z0-9_-]+)\.js"/g)) {
    for (const name of m[1].split(',').map((n) => n.trim().split(' as ').at(-1).trim()).filter(Boolean)) out.set(name, m[2]);
  }
  return out;
}

/** The words a module branches on at its first positional: compared to a variable bound from it, switched on, or matched. */
export function branchWords(src) {
  const bound = [
    ...[...src.matchAll(/\b(?:const|let)\s+([A-Za-z_]\w*)\s*=\s*args\.positional\[0\]/g)].map((m) => m[1]),
    ...[...src.matchAll(/\b(?:const|let)\s+\[\s*([A-Za-z_]\w*)[^\]]*\]\s*=\s*args\.positional\b/g)].map((m) => m[1]),
  ];
  const subjects = ['args\\.positional\\[0\\]', ...bound];
  const words = new Set();
  for (const s of subjects) {
    // A `typeof x === "string"` reads the value's type, never a word the door answers.
    for (const m of src.matchAll(new RegExp(`(?<!typeof\\s+)\\b${s}\\s*[=!]==?\\s*"([a-z][a-z0-9-]*)"`, 'g'))) words.add(m[1]);
    for (const sw of src.matchAll(new RegExp(`switch\\s*\\(\\s*${s}\\s*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'g'))) {
      for (const c of sw[1].matchAll(/case\s+"([a-z][a-z0-9-]*)"\s*:/g)) words.add(c[1]);
    }
  }
  return [...words].sort();
}

function sources(dir, ext) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n === 'dist') return [];
    return statSync(p).isDirectory() ? sources(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

async function main() {
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const dist = (rel) => pathToFileURL(join(repo, 'packages/lares-cli/dist/src', rel)).href;
  let cli, bridge;
  try { cli = await import(dist('bin/lares.js')); bridge = await import(dist('host-bridge.js')); }
  catch (err) {
    console.log(`[door-names] the built CLI did not load (${err?.code ?? err?.message}) — run \`pnpm -r build\`; the registry is underivable.`);
    return 1;
  }
  const rows = cli.COMMANDS.map((c) => ({ name: c.name, verbs: c.verbs, passes: c.passesThrough !== undefined, leads: c.leads }));
  const deadDoor = deadDoorOver({ rows, shim: [...bridge.SHIM_VERBS] });

  // THE REGISTRY READS LIVE: a control that flips means the reader, not the house, moved.
  const controls = [
    ['lares vessel request <id>', true], ['lares meme offer promote <cid>', true], ['lares sense memory pour all=true', true],
    ['lares sense memory pour --all', false], ['lares vessel request <id> --json', false], ['lares up --capture <dir>', true],
    ['lares help vessel request', true], ['lares help vessel zz-no-such-name', false], ['lares act lar:///carriage.bag.moves', false],
    ['lares vessel zz-no-such-name', false], ['lares zz-no-such-name', false], ['lares meme offer zz-no-such-name', false],
  ];
  const flipped = controls.filter(([line, live]) => (deadDoor(line) === null) !== live);

  const named = ROOTS.flatMap(({ dir, ext }) => sources(join(repo, dir), ext))
    .flatMap((file) => namedCommands(readFileSync(file, 'utf8')).map((line) => ({ file: relative(repo, file), line })));
  const silent = ROOTS.filter(({ dir }) => !named.some((n) => n.file.startsWith(`${dir}/`))).map(({ dir }) => dir);
  const dead = named.map((n) => ({ ...n, why: deadDoor(n.line) })).filter((n) => n.why !== null);

  const modules = handlerModules(readFileSync(join(repo, 'packages/lares-cli/src/bin/lares.ts'), 'utf8'));
  const argumentDoors = cli.COMMANDS.filter((c) => c.verbs === null);
  const unmapped = argumentDoors.filter((c) => !modules.has(c.handler.name)).map((c) => c.name);
  const hidden = argumentDoors.filter((c) => modules.has(c.handler.name)).flatMap((c) => {
    const words = branchWords(readFileSync(join(repo, 'packages/lares-cli/src/commands', `${modules.get(c.handler.name)}.ts`), 'utf8'));
    return words.length > 0 ? [{ door: c.name, words }] : [];
  });

  console.log(`[door-names] ${named.length} named command(s) across ${ROOTS.length} roots · ${rows.length} doors · ${argumentDoors.length} argument door(s)`);
  let red = false;
  const fail = (msg) => { red = true; console.log(`  ${msg}`); };
  if (named.length < 600) fail(`the walk found only ${named.length} named command(s): a near-silent walk proves nothing`);
  for (const dir of silent) fail(`${dir} contributed no named command: a silent root proves nothing`);
  for (const [line, live] of flipped) fail(`CONTROL flipped: \`${line}\` should read ${live ? 'live' : 'dead'}`);
  for (const d of dead) fail(`dead   ${d.file}  \`${d.line}\` — ${d.why}`);
  for (const name of unmapped) fail(`argument door \`${name}\`: its handler's module does not resolve from the CLI table's imports`);
  for (const h of hidden) fail(`argument door \`${h.door}\` branches on ${h.words.map((w) => `"${w}"`).join(', ')}: declare its verbs on the row`);
  if (red) {
    console.log('  pono: name the live door, or write a verb not yet built without the `lares ` prefix; a hidden sub-verb takes a table on its row.');
    return 1;
  }
  console.log('  every named command answers, and every argument door branches on no word');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = await main();
