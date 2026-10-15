import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertDestination, provision } from './provision-worktree.mjs';
import { stampWasm } from './stamp-build.mjs';

function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'provision-test-'));
  const source = join(base, 'source'), destination = join(base, 'target');
  const put = (path, body = 'x') => { const full = join(source, path); mkdirSync(join(full, '..'), { recursive: true }); writeFileSync(full, body); };
  put('node_modules/.bin/tsc', 'bin');
  put('node_modules/.bin/tsx', 'bin');
  put('packages/tree-sitter-memetic-wikitext/src/parser.c', 'c');
  put('packages/tree-sitter-memetic-wikitext/tree-sitter-memetic_wikitext.wasm', 'wasm');
  put('packages/lararium-web/package.json', JSON.stringify({ name: '@lararium/web', dependencies: { '@lararium/mesh': 'workspace:*' } }));
  put('packages/lararium-mesh/package.json', JSON.stringify({ name: '@lararium/mesh' }));
  put('packages/lararium-mesh/tsconfig.build.json', '{}');
  put('packages/lararium-tw5/package.json', JSON.stringify({ name: '@lararium/tw5', dependencies: { '@lararium/mesh': 'workspace:*' } }));
  put('packages/lararium-tw5/tsconfig.build.json', '{}');
  put('tools/stamp-build.mjs', '// tool');
  stampWasm(source, 'tree-sitter-memetic-wikitext');
  const calls = [], logs = [];
  const run = (cmd, args, cwd) => {
    calls.push([cmd, args, cwd]);
    if (cmd === 'git' && args.includes('config')) return 'false\n';
    if (cmd === 'git' && args.includes('worktree') && args.includes('add')) {
      mkdirSync(destination);
      cpSync(join(source, 'packages'), join(destination, 'packages'), { recursive: true, filter: path => !path.endsWith('.wasm') });
      mkdirSync(join(destination, 'tools')); writeFileSync(join(destination, 'tools/stamp-build.mjs'), '// tool');
      return '';
    }
    if (cmd === 'git' && args.includes('submodule')) {
      mkdirSync(join(destination, 'TiddlyWiki5'), { recursive: true });
      writeFileSync(join(destination, 'TiddlyWiki5/tiddlywiki.js'), 'pinned');
      mkdirSync(join(destination, 'mempalace'), { recursive: true });
      writeFileSync(join(destination, 'mempalace/pinned.txt'), 'pinned');
      return '';
    }
    if (cmd === 'git' && args.includes('remove')) { rmSync(destination, { recursive: true, force: true }); return ''; }
    if (cmd === 'git' && args.includes('rev-parse')) return 'a'.repeat(40);
    if (cmd === 'npm' && args.includes('build:tw5-vendor')) {
      mkdirSync(join(destination, 'packages/lararium-tw5/tw5-core'), { recursive: true });
      writeFileSync(join(destination, 'packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js'), 'rendered');
    }
    if (cmd === 'npm' && cwd.endsWith('lararium-web')) {
      mkdirSync(join(destination, 'packages/lararium-web/dist'), { recursive: true });
      writeFileSync(join(destination, 'packages/lararium-web/dist/index.html'), 'built');
      mkdirSync(join(destination, '.pronaos-build'), { recursive: true });
      writeFileSync(join(destination, '.pronaos-build/pronaos-artifact.json'), '{}');
    }
    return '';
  };
  return { base, source, destination, calls, logs, run, put, close: () => rmSync(base, { recursive: true, force: true }) };
}

test('refuses overlap, occupied destination and symlink escape', () => {
  const f = fixture();
  try {
    assert.throws(() => assertDestination(f.source, f.source), /overlaps/);
    mkdirSync(f.destination); writeFileSync(join(f.destination, 'occupied'), 'x');
    assert.throws(() => assertDestination(f.source, f.destination), /empty/);
    const link = join(f.base, 'link'); symlinkSync(f.source, link);
    assert.throws(() => assertDestination(f.source, join(link, 'nested')), /overlaps/);
  } finally { f.close(); }
});

test('fresh source builds pinned TW5 and web outputs, then stamps workspace', () => {
  const f = fixture();
  try {
    provision({ source: f.source, destination: f.destination, run: f.run, log: line => f.logs.push(line) });
    assert.equal(readFileSync(join(f.destination, 'TiddlyWiki5/tiddlywiki.js'), 'utf8'), 'pinned');
    assert.equal(readFileSync(join(f.destination, 'mempalace/pinned.txt'), 'utf8'), 'pinned');
    assert.equal(readFileSync(join(f.destination, 'packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js'), 'utf8'), 'rendered');
    assert.equal(readFileSync(join(f.destination, 'packages/lararium-web/dist/index.html'), 'utf8'), 'built');
    assert.equal(existsSync(join(f.destination, '.pronaos-build/pronaos-artifact.json')), true);
    assert.equal(f.logs.some(line => /COPIED provenance grammar wasm/.test(line)), true);
    assert.equal(f.logs.some(line => /COPIED provenance packages\/lararium-web\/dist/.test(line)), false);
    assert.equal(f.logs.some(line => /COPIED.*dist-plugin/.test(line)), false);
    const builds = f.calls.filter(([cmd]) => cmd === 'npm' || cmd.endsWith('/tsc'));
    assert.deepEqual(builds.map(([, , cwd]) => cwd.slice(cwd.lastIndexOf('/') + 1)), ['lararium-tw5', 'lararium-mesh', 'lararium-tw5', 'lararium-web']);
    assert.equal(f.calls.filter(([, args]) => args.includes('--pkg')).length, 2);
    assert.deepEqual(f.calls.at(-1)[1], [join(f.destination, 'tools/stamp-build.mjs'), f.destination]);
    assert.equal(f.logs.some(line => /BUILT.*lararium-tw5.*attestation/.test(line)), true);
  } finally { f.close(); }
});

test('failed build stops before its stamp', () => {
  const f = fixture();
  try {
    const run = (...args) => { if (String(args[0]).endsWith('/tsc')) throw new Error('build failed'); return f.run(...args); };
    assert.throws(() => provision({ source: f.source, destination: f.destination, run, log: () => {} }), /build failed/);
    assert.equal(f.calls.some(([, args]) => args.includes('--pkg')), false);
    assert.equal(f.calls.some(([, args]) => args.includes('remove')), true);
    assert.equal(existsSync(f.destination), false);
  } finally { f.close(); }
});

test('a failed cleanup reports the plain remove refusal beside the build failure', () => {
  const f = fixture();
  try {
    const run = (...args) => {
      if (String(args[0]).endsWith('/tsc')) throw new Error('build failed');
      if (args[0] === 'git' && args[1].includes('remove')) throw new Error('remove refused');
      return f.run(...args);
    };
    assert.throws(() => provision({ source: f.source, destination: f.destination, run, log: () => {} }), /build failed.*remove refused/s);
    assert.equal(f.calls.some(([, args]) => args.includes('--force')), false);
  } finally { f.close(); }
});

test('older source build bytes never enter the destination', () => {
  const f = fixture();
  try {
    f.put('packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js', 'old core');
    f.put('packages/lararium-web/dist/index.html', 'old web');
    f.put('.pronaos-build/pronaos-artifact.json', 'old record');
    provision({ source: f.source, destination: f.destination, run: f.run, log: () => {} });
    assert.equal(readFileSync(join(f.destination, 'packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js'), 'utf8'), 'rendered');
    assert.equal(readFileSync(join(f.destination, 'packages/lararium-web/dist/index.html'), 'utf8'), 'built');
    assert.equal(readFileSync(join(f.destination, '.pronaos-build/pronaos-artifact.json'), 'utf8'), '{}');
  } finally { f.close(); }
});

test('web build failure removes the added worktree before a workspace stamp', () => {
  const f = fixture();
  try {
    const run = (...args) => {
      if (args[0] === 'npm' && args[2].endsWith('lararium-web')) throw new Error('web failed');
      return f.run(...args);
    };
    assert.throws(() => provision({ source: f.source, destination: f.destination, run, log: () => {} }), /web failed/);
    assert.equal(existsSync(f.destination), false);
    assert.equal(f.calls.some(([, args]) => args.length === 2 && args[0]?.endsWith('stamp-build.mjs')), false);
  } finally { f.close(); }
});

test('stale grammar provenance refuses before a copied wasm claim', () => {
  const f = fixture();
  try {
    f.put('packages/tree-sitter-memetic-wikitext/src/parser.c', 'changed');
    assert.throws(() => provision({ source: f.source, destination: f.destination, run: f.run, log: () => {} }), /provenance/);
  } finally { f.close(); }
});
