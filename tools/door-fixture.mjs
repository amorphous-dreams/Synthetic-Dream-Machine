// Test support for the test door's self-tests: a scratch worktree that carries its own copy of the real Vitest and TypeScript.
// A door self-test builds and tests a disposable package inside it, so no self-test ever builds into the shared checkout:
// a door build rewrites a package's dist in place (tsc truncates, then writes, each file on its own inode), and a sibling
// test process importing that dist mid-emit reads an empty module ("does not provide an export named ..."). Nothing here
// writes the checkout: it reads the toolchain's pnpm closure and copies it, so the scratch tree shares no inode with it.
import { cpSync, mkdirSync, readdirSync, lstatSync, readlinkSync, realpathSync, symlinkSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const checkout = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The `.pnpm` entries a set of packages reaches, walked through each entry's sibling links; derived, never a hand list. */
function pnpmClosure(pnpmDir, starts) {
  const seen = new Set();
  const entryOf = real => { const rel = path.relative(pnpmDir, real).split(path.sep)[0]; return rel.startsWith('..') ? null : rel; };
  const visit = entry => {
    if (entry === null || seen.has(entry)) return;
    seen.add(entry);
    const modules = path.join(pnpmDir, entry, 'node_modules');
    for (const name of readdirSync(modules)) {
      for (const sub of name.startsWith('@') ? readdirSync(path.join(modules, name)).map(s => `${name}/${s}`) : [name]) {
        const link = path.join(modules, sub);
        if (lstatSync(link).isSymbolicLink()) visit(entryOf(path.resolve(path.dirname(link), readlinkSync(link))));
      }
    }
  };
  for (const start of starts) visit(entryOf(realpathSync(start)));
  return [...seen];
}

/**
 * Stand a scratch worktree at `wt` (created): a git repo, the door's wall-side tools (stamp-build and the dist guard), and a
 * root node_modules holding copied Vitest and TypeScript (`.bin/tsc` on the wall's PATH). Returns `pkg(name, files)`, which
 * writes `packages/<name>` with its node_modules linked to the root farm (relative, so it resolves inside the wall's /work).
 */
export function scratchDoorTree(wt) {
  const pnpmDir = path.join(checkout, 'node_modules', '.pnpm');
  const vitest = path.join(checkout, 'packages', 'lararium-mesh', 'node_modules', 'vitest');
  const typescript = path.join(checkout, 'node_modules', 'typescript');
  mkdirSync(path.join(wt, 'node_modules', '.pnpm'), { recursive: true });
  mkdirSync(path.join(wt, 'node_modules', '.bin'));
  for (const entry of pnpmClosure(pnpmDir, [vitest, typescript])) {
    cpSync(path.join(pnpmDir, entry), path.join(wt, 'node_modules', '.pnpm', entry), { recursive: true, verbatimSymlinks: true });
  }
  for (const [name, real] of [['vitest', vitest], ['typescript', typescript]]) {
    symlinkSync(path.relative(path.join(wt, 'node_modules'), path.join(wt, 'node_modules', '.pnpm', path.relative(pnpmDir, realpathSync(real)))), path.join(wt, 'node_modules', name));
  }
  symlinkSync('../typescript/bin/tsc', path.join(wt, 'node_modules', '.bin', 'tsc'));
  mkdirSync(path.join(wt, 'tools'));
  for (const tool of ['stamp-build.mjs', 'vitest-dist-guard.mjs', 'corpus-read.mjs']) copyFileSync(path.join(checkout, 'tools', tool), path.join(wt, 'tools', tool));
  writeFileSync(path.join(wt, 'package.json'), JSON.stringify({ name: 'door-scratch', private: true }));
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { stdio: 'ignore' });
  git('init', '-q', '-b', 'test-door'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('commit', '-q', '--allow-empty', '-m', 'initial');
  const pkg = (name, files) => {
    const dir = path.join(wt, 'packages', name);
    mkdirSync(dir, { recursive: true });
    symlinkSync('../../node_modules', path.join(dir, 'node_modules'));
    for (const [file, body] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); writeFileSync(path.join(dir, file), body); }
    return dir;
  };
  return { wt, pkg };
}

/** file -> `ino:mtimeNs` for every file under the checkout's packages/<dir>/dist and its node_modules/.lares-build stamps: a
 *  self-test that rebuilds or restamps one moves its entries. */
export function checkoutDistSnapshot() {
  const out = {};
  const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else { const st = lstatSync(f, { bigint: true }); out[f] = `${st.ino}:${st.mtimeNs}`; } } };
  for (const name of readdirSync(path.join(checkout, 'packages'))) {
    try { walk(path.join(checkout, 'packages', name, 'dist')); } catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
  }
  try { walk(path.join(checkout, 'node_modules', '.lares-build')); } catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
  return out;
}
