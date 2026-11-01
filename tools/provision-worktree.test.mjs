import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { assertDestination, provision } from './provision-worktree.mjs';
import { stampWasm } from './stamp-build.mjs';

const noGuard = () => {};

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
      cpSync(join(source, 'packages'), join(destination, 'packages'), { recursive: true, filter: path => !path.endsWith('.wasm') && !path.endsWith('/node_modules') });
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
    provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: line => f.logs.push(line) });
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

test('copied module links target the destination, while external links stay external', () => {
  const f = fixture();
  try {
    const rootModules = join(f.source, 'node_modules');
    mkdirSync(join(rootModules, '@lararium'), { recursive: true });
    symlinkSync(join(f.source, 'packages/lararium-mesh'), join(rootModules, '@lararium/mesh'));
    symlinkSync('../@lararium/mesh', join(rootModules, '.bin/mesh'));
    const packageModules = join(f.source, 'packages/lararium-tw5/node_modules');
    mkdirSync(join(packageModules, '@lararium'), { recursive: true });
    symlinkSync(join(f.source, 'packages/lararium-mesh'), join(packageModules, '@lararium/mesh'));
    const outside = join(f.base, 'outside');
    writeFileSync(outside, 'outside');
    symlinkSync(outside, join(rootModules, 'external'));

    provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: line => f.logs.push(line) });
    for (const rel of ['node_modules/@lararium/mesh', 'node_modules/.bin/mesh', 'packages/lararium-tw5/node_modules/@lararium/mesh']) {
      const link = join(f.destination, rel);
      assert.equal(readlinkSync(link), relative(join(link, '..'), join(f.destination, 'packages/lararium-mesh')));
    }
    assert.equal(readlinkSync(join(f.destination, 'node_modules/external')), outside);
    assert.equal(f.logs.some(line => /RELINKED 3 node_modules symlinks/.test(line)), true);
  } finally { f.close(); }
});

test('a module link that names its own parent directory relinks to ".", never an empty target', () => {
  const f = fixture();
  try {
    const rootModules = join(f.source, 'node_modules');
    symlinkSync(rootModules, join(rootModules, 'node_modules'));
    provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: line => f.logs.push(line) });
    assert.equal(readlinkSync(join(f.destination, 'node_modules/node_modules')), '.');
  } finally { f.close(); }
});

test('refuses to finish when a later step leaves a link into the source', () => {
  const f = fixture();
  try {
    const run = (...args) => {
      const result = f.run(...args);
      if (args[0] === process.execPath && args[1]?.[0] === join(f.destination, 'tools/stamp-build.mjs') && args[1]?.length === 2) {
        symlinkSync(join(f.source, 'packages/lararium-mesh'), join(f.destination, 'late-source-link'));
      }
      return result;
    };
    assert.throws(() => provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: () => {} }), /destination symlink.*source tree/);
    assert.equal(existsSync(f.destination), false);
  } finally { f.close(); }
});

test('failed build stops before its stamp', () => {
  const f = fixture();
  try {
    const run = (...args) => { if (String(args[0]).endsWith('/tsc')) throw new Error('build failed'); return f.run(...args); };
    assert.throws(() => provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: () => {} }), /build failed/);
    assert.equal(f.calls.some(([, args]) => args.includes('--pkg')), false);
    assert.equal(f.calls.some(([, args]) => args.includes('remove')), true);
    assert.equal(existsSync(f.destination), false);
  } finally { f.close(); }
});

test('cleanup retries with --force when plain remove refuses over submodules, and reports both when both refuse', () => {
  const f = fixture();
  try {
    const run = (...args) => {
      if (String(args[0]).endsWith('/tsc')) throw new Error('build failed');
      if (args[0] === 'git' && args[1].includes('remove') && !args[1].includes('--force')) throw new Error('working trees containing submodules cannot be removed');
      return f.run(...args);
    };
    assert.throws(() => provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: () => {} }), /build failed/);
    assert.equal(f.calls.some(([, args]) => args.includes('--force')), true);
    assert.equal(existsSync(f.destination), false);
  } finally { f.close(); }
  const g = fixture();
  try {
    const run = (...args) => {
      if (String(args[0]).endsWith('/tsc')) throw new Error('build failed');
      if (args[0] === 'git' && args[1].includes('remove')) throw new Error('remove refused');
      return g.run(...args);
    };
    assert.throws(() => provision({ guard: noGuard, source: g.source, destination: g.destination, run, log: () => {} }), /build failed.*remove refused.*--force refused/s);
  } finally { g.close(); }
});

test('a source holding no grammar wasm builds it in the destination, and names it', () => {
  const f = fixture();
  try {
    rmSync(join(f.source, 'packages/tree-sitter-memetic-wikitext/tree-sitter-memetic_wikitext.wasm'));
    const run = (cmd, args, cwd) => {
      if (cmd === 'pnpm' && args.includes('build:wasm')) writeFileSync(join(cwd, 'tree-sitter-memetic_wikitext.wasm'), 'built');
      return f.run(cmd, args, cwd);
    };
    provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: line => f.logs.push(line) });
    assert.equal(readFileSync(join(f.destination, 'packages/tree-sitter-memetic-wikitext/tree-sitter-memetic_wikitext.wasm'), 'utf8'), 'built');
    assert.equal(f.logs.some(line => /BUILT.*wasm.*source held none/.test(line)), true);
    assert.equal(f.logs.some(line => /COPIED provenance grammar wasm/.test(line)), false);
  } finally { f.close(); }
});

test('a reference clone that refuses retries plain and names the network dial; no reference names it too', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.source, '.git/modules/TiddlyWiki5/objects'), { recursive: true });
    const run = (cmd, args, cwd) => { if (cmd === 'git' && args.includes('--reference')) throw new Error('fatal: reference repository bad'); return f.run(cmd, args, cwd); };
    provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: line => f.logs.push(line) });
    assert.equal(f.logs.some(line => /SUBMODULE TiddlyWiki5: reference clone refused.*dials the network/.test(line)), true);
    assert.equal(f.logs.some(line => /SUBMODULE mempalace: no local module objects.*dials the network/.test(line)), true);
  } finally { f.close(); }
});

test('older source build bytes never enter the destination', () => {
  const f = fixture();
  try {
    f.put('packages/lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js', 'old core');
    f.put('packages/lararium-web/dist/index.html', 'old web');
    f.put('.pronaos-build/pronaos-artifact.json', 'old record');
    provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: () => {} });
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
    assert.throws(() => provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: () => {} }), /web failed/);
    assert.equal(existsSync(f.destination), false);
    assert.equal(f.calls.some(([, args]) => args.length === 2 && args[0]?.endsWith('stamp-build.mjs')), false);
  } finally { f.close(); }
});

test('stale grammar provenance refuses before a copied wasm claim', () => {
  const f = fixture();
  try {
    f.put('packages/tree-sitter-memetic-wikitext/src/parser.c', 'changed');
    assert.throws(() => provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: () => {} }), /provenance/);
  } finally { f.close(); }
});

test('the disk guard runs before git worktree add, and a refusal stops the add', () => {
  const f = fixture();
  try {
    const order = [];
    const run = (cmd, args, cwd) => { if (cmd === 'git' && args.includes('add')) order.push('add'); return f.run(cmd, args, cwd); };
    assert.throws(() => provision({ guard: () => { order.push('guard'); throw new Error('disk-guard refuses: C: has 59.0G available, under the 60G floor'); }, source: f.source, destination: f.destination, run, log: () => {} }), /disk-guard refuses.*C:/);
    assert.deepEqual(order, ['guard']);
    assert.equal(existsSync(f.destination), false);
    provision({ guard: () => { order.push('guard'); }, source: f.source, destination: f.destination, run, log: () => {} });
    assert.deepEqual(order, ['guard', 'guard', 'add']);
  } finally { f.close(); }
});

test('a pnpm offline frozen install fills node_modules, and the source node_modules never copies', () => {
  const f = fixture();
  try {
    f.put('node_modules/source-only-marker', 'marker');
    const run = (cmd, args, cwd) => {
      if (cmd === 'pnpm') {
        for (const bin of ['tsc', 'tsx']) { mkdirSync(join(f.destination, 'node_modules/.bin'), { recursive: true }); writeFileSync(join(f.destination, 'node_modules/.bin', bin), 'bin'); }
      }
      return f.run(cmd, args, cwd);
    };
    provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: line => f.logs.push(line) });
    const install = f.calls.filter(([cmd]) => cmd === 'pnpm');
    assert.deepEqual(install.map(([, args, cwd]) => [args, cwd]), [[['install', '--offline', '--frozen-lockfile'], f.destination]]);
    assert.equal(existsSync(join(f.destination, 'node_modules/source-only-marker')), false);
    assert.equal(f.logs.some(line => /INSTALLED node_modules/.test(line)), true);
  } finally { f.close(); }
});

test('when pnpm cannot install offline, node_modules hardlinks from the source and links still relink', () => {
  const f = fixture();
  try {
    f.put('node_modules/real-file.js', 'shared');
    const rootModules = join(f.source, 'node_modules');
    symlinkSync(join(f.source, 'packages/lararium-mesh'), join(rootModules, 'mesh-link'));
    const run = (cmd, args, cwd) => { if (cmd === 'pnpm') throw new Error('ERR_PNPM_NO_OFFLINE_TARBALL'); return f.run(cmd, args, cwd); };
    provision({ guard: noGuard, source: f.source, destination: f.destination, run, log: line => f.logs.push(line) });
    assert.equal(statSync(join(f.destination, 'node_modules/real-file.js')).ino, statSync(join(rootModules, 'real-file.js')).ino);
    assert.equal(readlinkSync(join(f.destination, 'node_modules/mesh-link')), relative(join(f.destination, 'node_modules'), join(f.destination, 'packages/lararium-mesh')));
    assert.equal(f.logs.some(line => /pnpm offline install refused.*ERR_PNPM_NO_OFFLINE_TARBALL/.test(line)), true);
  } finally { f.close(); }
});

test('submodules clone against the main checkout objects only where its module directory stands', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.source, '.git/modules/TiddlyWiki5/objects'), { recursive: true });
    provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: () => {} });
    const updates = f.calls.filter(([cmd, args]) => cmd === 'git' && args.includes('submodule')).map(([, args]) => args.slice(args.indexOf('submodule')));
    assert.deepEqual(updates, [
      ['submodule', 'update', '--init', '--reference', join(f.source, '.git/modules/TiddlyWiki5'), '--', 'TiddlyWiki5'],
      ['submodule', 'update', '--init', '--', 'mempalace'],
    ]);
  } finally { f.close(); }
});

test('a submodule whose objects live in its own .git directory serves as the reference', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.source, 'mempalace/.git/objects'), { recursive: true });
    provision({ guard: noGuard, source: f.source, destination: f.destination, run: f.run, log: () => {} });
    const updates = f.calls.filter(([cmd, args]) => cmd === 'git' && args.includes('submodule')).map(([, args]) => args.slice(args.indexOf('submodule')));
    assert.deepEqual(updates[1], ['submodule', 'update', '--init', '--reference', join(f.source, 'mempalace/.git'), '--', 'mempalace']);
  } finally { f.close(); }
});
