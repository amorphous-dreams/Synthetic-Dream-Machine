#!/usr/bin/env node
/** Prepare a detached checkout from inputs, then compile its generated package outputs. */
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { wasmStampBody } from './stamp-build.mjs';

export const USAGE = 'usage: provision-worktree.mjs <empty-dir>';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WASM = 'tree-sitter-memetic-wikitext';
const canNest = (a, b) => b === a || b.startsWith(a + sep);

function physicalDestination(path) {
  let parent = path;
  const tail = [];
  while (!existsSync(parent)) { tail.unshift(dirname(parent) === parent ? '' : pathPart(parent)); parent = dirname(parent); }
  return resolve(realpathSync(parent), ...tail);
}
function pathPart(path) { return path.slice(dirname(path).length + (dirname(path) === '/' ? 0 : 1)); }

export function assertDestination(source, destination) {
  const src = realpathSync(source);
  const dst = physicalDestination(resolve(destination));
  if (canNest(src, dst) || canNest(dst, src)) throw new Error('destination overlaps the source tree');
  if (existsSync(destination)) {
    if (!statSync(destination).isDirectory()) throw new Error('destination is not a directory');
    if (readdirSync(destination).length) throw new Error('destination must be empty');
  }
  return resolve(destination);
}

function defaultRun(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}: ${(result.stderr || result.stdout || result.error?.message || result.status).trim()}`);
  return result.stdout;
}
function copy(source, destination, rel, log, options = {}) {
  const from = join(source, rel), to = join(destination, rel);
  if (!existsSync(from)) throw new Error(`required input absent: ${from}`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true, dereference: false, ...options });
  log(`COPIED ${rel} from ${from}`);
}
function* linksUnder(path) {
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink()) yield child;
    else if (entry.isDirectory()) yield* linksUnder(child);
  }
}
function linkTarget(link) {
  const target = resolve(dirname(link), readlinkSync(link));
  try { return realpathSync(target); }
  catch { return target; } // A dangling link still carries a target that may name the source.
}
function sourceLinks(source, destination) {
  return [...linksUnder(destination)].filter(link => canNest(source, linkTarget(link)));
}
function assertNoSourceLinks(source, destination) {
  const leaks = sourceLinks(source, destination);
  if (leaks.length) throw new Error(`${leaks.length} destination symlink(s) still resolve into source tree: ${leaks.map(link => relative(destination, link)).join(', ')}`);
}
function relinkModules(source, destination, rel) {
  let rewritten = 0;
  for (const link of linksUnder(join(destination, rel))) {
    const target = linkTarget(link);
    if (!canNest(source, target)) continue;
    const mapped = join(destination, relative(source, target));
    rmSync(link);
    symlinkSync(relative(dirname(link), mapped) || '.', link); // a link naming its own parent maps to '.', never ''
    rewritten++;
  }
  return rewritten;
}
function packageOrder(destination) {
  const base = join(destination, 'packages');
  const packages = readdirSync(base).filter(name => existsSync(join(base, name, 'tsconfig.build.json')));
  const byName = new Map(packages.map(dir => [JSON.parse(readFileSync(join(base, dir, 'package.json'), 'utf8')).name, dir]));
  const ordered = [], visiting = new Set(), visited = new Set();
  function visit(dir) {
    if (visited.has(dir)) return;
    if (visiting.has(dir)) throw new Error(`workspace dependency cycle at ${dir}`);
    visiting.add(dir);
    const pkg = JSON.parse(readFileSync(join(base, dir, 'package.json'), 'utf8'));
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const dep = byName.get(name);
      if (dep) visit(dep);
    }
    visiting.delete(dir); visited.add(dir); ordered.push(dir);
  }
  for (const dir of packages.sort()) visit(dir);
  return ordered;
}

/** `run` receives (executable, argv, cwd); injection lets tests avoid git, npm and network. */
export function provision({ source = ROOT, destination, run = defaultRun, log = console.log }) {
  if (!destination) throw new Error(USAGE);
  source = realpathSync(source);
  destination = assertDestination(source, destination);
  const bare = () => run('git', ['-C', source, 'config', '--get', 'core.bare'], source).trim();
  if (bare() !== 'false') throw new Error('core.bare must read false before worktree add');
  run('git', ['-C', source, 'worktree', 'add', '--detach', destination, 'HEAD'], source);
  try {
  if (bare() !== 'false') throw new Error('core.bare must read false after worktree add');
  const head = run('git', ['-C', destination, 'rev-parse', 'HEAD'], destination).trim();
  log(`HEAD ${head}`);
  run('git', ['-C', destination, 'submodule', 'update', '--init', '--', 'TiddlyWiki5', 'mempalace'], destination);
  for (const name of ['TiddlyWiki5/tiddlywiki.js', 'mempalace']) {
    if (!existsSync(join(destination, name))) throw new Error(`required submodule input absent: ${name}`);
  }

  // Rebase pnpm links onto the destination before any build can read source packages or dist.
  const modulePaths = ['node_modules', 'tests/node_modules', 'TiddlyWiki5/node_modules'];
  for (const name of readdirSync(join(source, 'packages'))) {
    const rel = `packages/${name}/node_modules`;
    if (existsSync(join(source, rel))) modulePaths.push(rel);
  }
  let rewritten = 0;
  for (const rel of modulePaths) if (existsSync(join(source, rel))) {
    copy(source, destination, rel, log);
    const count = relinkModules(source, destination, rel);
    rewritten += count;
    log(`RELINKED ${count} symlinks in ${rel}`);
  }
  log(`RELINKED ${rewritten} node_modules symlinks`);
  assertNoSourceLinks(source, destination);
  if (!existsSync(join(destination, 'node_modules'))) throw new Error('required input absent: root node_modules');
  for (const bin of ['tsc', 'tsx']) {
    if (!existsSync(join(destination, `node_modules/.bin/${bin}`)) && !existsSync(join(destination, `packages/lararium-tw5/node_modules/.bin/${bin}`))) {
      throw new Error(`required local build tool absent: ${bin} (refusing an implicit install)`);
    }
  }
  rmSync(join(destination, 'node_modules/.lares-build'), { recursive: true, force: true });

  const grammar = `packages/${WASM}`;
  const wasmFiles = readdirSync(join(source, grammar)).filter(name => name.endsWith('.wasm'));
  if (wasmFiles.length !== 1) throw new Error(`expected one grammar wasm; found ${wasmFiles.length}`);
  const stamp = `node_modules/.lares-build/wasm/${WASM}`;
  const expected = wasmStampBody(source, WASM, wasmFiles[0]);
  if (!existsSync(join(source, stamp)) || readFileSync(join(source, stamp), 'utf8') !== expected) {
    throw new Error('grammar wasm provenance differs from source or stamp');
  }
  copy(source, destination, `${grammar}/${wasmFiles[0]}`, log);
  if (wasmStampBody(destination, WASM, wasmFiles[0]) !== expected) throw new Error('copied grammar wasm provenance differs from destination source');
  copy(source, destination, stamp, log);
  log(`COPIED provenance grammar wasm: ${expected.trim().replaceAll('\n', ' | ')}`);

  const tw5 = join(destination, 'packages/lararium-tw5');
  rmSync(join(tw5, 'tw5-core'), { recursive: true, force: true });
  run('npm', ['run', 'build:tw5-vendor'], tw5);
  log('BUILT packages/lararium-tw5 TW5 vendor from destination submodule');
  for (const dir of packageOrder(destination)) {
    const cwd = join(destination, 'packages', dir);
    if (dir === 'lararium-tw5') run('npm', ['run', 'build'], cwd);
    else run(join(destination, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.build.json'], cwd);
    log(`BUILT packages/${dir}${dir === 'lararium-tw5' ? ' (plugin bundle, dist-plugin and attestation)' : ''}`);
    run(process.execPath, [join(destination, 'tools/stamp-build.mjs'), destination, '--pkg', dir], destination);
    log(`STAMPED packages/${dir}`);
  }
  rmSync(join(destination, 'packages/lararium-web/dist'), { recursive: true, force: true });
  rmSync(join(destination, '.pronaos-build/pronaos-artifact.json'), { force: true });
  run('npm', ['run', 'build'], join(destination, 'packages/lararium-web'));
  for (const rel of ['packages/lararium-web/dist', '.pronaos-build/pronaos-artifact.json']) {
    if (!existsSync(join(destination, rel))) throw new Error(`web build output absent: ${rel}`);
  }
  log('BUILT packages/lararium-web dist and Pronaos record');
  run(process.execPath, [join(destination, 'tools/stamp-build.mjs'), destination], destination);
  log('STAMPED workspace');
  assertNoSourceLinks(source, destination);
  return { destination, head };
  } catch (error) {
    try { run('git', ['-C', source, 'worktree', 'remove', destination], source); }
    catch (cleanupError) { throw new Error(`${error.message}; plain git worktree remove refused: ${cleanupError.message}`, { cause: error }); }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--help') console.log(USAGE);
  else if (process.argv.length !== 3) { console.error(USAGE); process.exitCode = 1; }
  else try { provision({ destination: process.argv[2] }); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
