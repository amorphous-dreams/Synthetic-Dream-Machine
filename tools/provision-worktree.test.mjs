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
  put('TiddlyWiki5/tiddlywiki.js', 'source'); put('TiddlyWiki5/.git/config', 'should not copy');
  put('packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js', 'core');
  put('packages/tree-sitter-memetic-wikitext/src/parser.c', 'c');
  put('packages/tree-sitter-memetic-wikitext/tree-sitter-memetic_wikitext.wasm', 'wasm');
  put('packages/lararium-web/dist/index.html', 'web'); put('.pronaos-build/pronaos-artifact.json', '{}');
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
    if (cmd === 'git' && args.includes('worktree')) {
      mkdirSync(destination);
      cpSync(join(source, 'packages'), join(destination, 'packages'), { recursive: true, filter: path => !path.includes('/tw5-core/') && !path.endsWith('.wasm') });
      mkdirSync(join(destination, 'tools')); writeFileSync(join(destination, 'tools/stamp-build.mjs'), '// tool');
      return '';
    }
    if (cmd === 'git' && args.includes('rev-parse')) return 'a'.repeat(40);
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

test('copies inputs, builds dependencies before plugin, stamps after each build', () => {
  const f = fixture();
  try {
    provision({ source: f.source, destination: f.destination, run: f.run, log: line => f.logs.push(line) });
    assert.equal(existsSync(join(f.destination, 'TiddlyWiki5/.git')), false);
    assert.equal(readFileSync(join(f.destination, 'packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js'), 'utf8'), 'core');
    assert.equal(f.logs.some(line => /COPIED provenance grammar wasm/.test(line)), true);
    assert.equal(f.logs.some(line => /COPIED provenance packages\/lararium-web\/dist/.test(line)), true);
    assert.equal(f.logs.some(line => /COPIED.*dist-plugin/.test(line)), false);
    const builds = f.calls.filter(([cmd]) => cmd === 'npm' || cmd.endsWith('/tsc'));
    assert.deepEqual(builds.map(([, , cwd]) => cwd.slice(cwd.lastIndexOf('/') + 1)), ['lararium-mesh', 'lararium-tw5']);
    assert.equal(f.calls.filter(([, args]) => args.includes('--pkg')).length, 2);
    assert.equal(f.logs.some(line => /BUILT.*lararium-tw5.*attestation/.test(line)), true);
  } finally { f.close(); }
});

test('failed build stops before its stamp', () => {
  const f = fixture();
  try {
    const run = (...args) => { if (String(args[0]).endsWith('/tsc')) throw new Error('build failed'); return f.run(...args); };
    assert.throws(() => provision({ source: f.source, destination: f.destination, run, log: () => {} }), /build failed/);
    assert.equal(f.calls.some(([, args]) => args.includes('--pkg')), false);
  } finally { f.close(); }
});

test('stale grammar provenance refuses before a copied wasm claim', () => {
  const f = fixture();
  try {
    f.put('packages/tree-sitter-memetic-wikitext/src/parser.c', 'changed');
    assert.throws(() => provision({ source: f.source, destination: f.destination, run: f.run, log: () => {} }), /provenance/);
  } finally { f.close(); }
});
