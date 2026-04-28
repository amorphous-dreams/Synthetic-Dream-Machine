#!/usr/bin/env node
/**
 * build-tw-browser-filter.mjs
 *
 * Generates a self-contained browser-compatible TW5 filter engine bundle.
 *
 * HOW IT WORKS
 * ────────────
 * 1. Boot TW5 in Node (full standard boot)
 * 2. Extract every module TW5 registered that the filter engine needs:
 *      $:/core/modules/wiki.js      – Wiki class with filterTiddlers()
 *      $:/core/modules/filters.js   – filter parser + compiler
 *      $:/core/modules/filters/*    – individual operators (86+)
 *      $:/core/modules/utils.js     – $tw.utils utilities
 * 3. Serialize them into a single self-contained IIFE / ESM export
 * 4. The output file can be imported in browser Vite builds without
 *    any Node.js APIs (no fs, no path, no process.argv)
 *
 * OUTPUT
 * ──────
 * packages/lararium-core/src/generated/tw-filter-engine.browser.js
 *
 * DETERMINISTIC SYNC PROCESS
 * ───────────────────────────
 * When TW5 ships updates:
 *   1. pnpm update tiddlywiki --filter @lararium/core
 *   2. node scripts/build-tw-browser-filter.mjs
 *   3. Run tests — any operator behavior changes surface as failures
 *   4. Commit the regenerated bundle + updated devDependency
 *
 * USAGE
 *   node scripts/build-tw-browser-filter.mjs
 *   # or via package.json script:
 *   pnpm tw:build-browser
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Boot TW5
// ---------------------------------------------------------------------------

const corePkgPath = join(__dirname, '..', 'packages', 'lararium-core');
const coreRequire  = createRequire(join(corePkgPath, 'package.json'));

const tw = coreRequire('tiddlywiki');
const $tw = tw.TiddlyWiki();
$tw.boot.argv = [];

await new Promise((resolve) => $tw.boot.boot(resolve));

// ---------------------------------------------------------------------------
// Identify modules needed for the filter engine
// ---------------------------------------------------------------------------

const MODULE_PATTERNS = [
  // Core filter engine
  '$:/core/modules/wiki.js',
  '$:/core/modules/filters.js',
  // All filter operators and run prefixes
  (t) => t.startsWith('$:/core/modules/filters/'),
  (t) => t.startsWith('$:/core/modules/filterrunprefixes/'),
  // Utilities (filter operators depend heavily on $tw.utils)
  '$:/core/modules/utils.js',
  (t) => t.startsWith('$:/core/modules/utils/'),
  // Tiddler class (wiki methods construct Tiddler objects)
  '$:/core/modules/tiddler.js',
];

function isNeeded(title) {
  return MODULE_PATTERNS.some((p) =>
    typeof p === 'string' ? p === title : p(title)
  );
}

const allTitles = Object.keys($tw.modules.titles);
const neededTitles = allTitles.filter(isNeeded);

console.log(`Extracting ${neededTitles.length} modules from tiddlywiki@${$tw.packageInfo.version}...`);

// ---------------------------------------------------------------------------
// Serialize module definitions
// ---------------------------------------------------------------------------

function serializeDefinition(title, moduleType, definition) {
  if (typeof definition === 'function') {
    return `  $tw.modules.define(${JSON.stringify(title)}, ${JSON.stringify(moduleType)}, ${definition.toString()});`;
  }
  // String source (some modules are stored as source text)
  return `  $tw.modules.define(${JSON.stringify(title)}, ${JSON.stringify(moduleType)}, function(module, exports, require) {\n${definition}\n});`;
}

const moduleLines = [];
for (const title of neededTitles) {
  const mod = $tw.modules.titles[title];
  if (!mod) continue;
  try {
    moduleLines.push(serializeDefinition(title, mod.moduleType ?? 'library', mod.definition));
  } catch (e) {
    console.warn(`  Skipping ${title}: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Capture $tw.utils from the booted instance (already executed)
// ---------------------------------------------------------------------------

// We need the bootprefix content for browser-side $tw namespace setup.
// Rather than re-reading the file, we serialize the key $tw.utils methods
// that filter operators actually call. These are safe pure-JS functions.
const bootprefixPath = coreRequire.resolve('tiddlywiki/boot/bootprefix.js');
const bootprefixSrc  = (await import('fs')).readFileSync(bootprefixPath, 'utf8');

// ---------------------------------------------------------------------------
// Emit the browser bundle
// ---------------------------------------------------------------------------

const VERSION_COMMENT = `// AUTO-GENERATED from tiddlywiki@${$tw.packageInfo.version}
// Regenerate: node scripts/build-tw-browser-filter.mjs
// DO NOT EDIT — changes will be overwritten on next regeneration.
// Source: ${neededTitles.length} modules extracted from TW5 core`;

const BUNDLE = `${VERSION_COMMENT}

// ─── TW5 bootprefix (browser-compatible $tw namespace setup) ───────────────
${bootprefixSrc}

// ─── Register filter engine modules ─────────────────────────────────────────
(function registerModules($tw) {
${moduleLines.join('\n')}

  // Execute all registered modules so they attach to $tw
  for (var title in $tw.modules.titles) {
    if ($tw.modules.titles.hasOwnProperty(title)) {
      try { $tw.modules.execute(title); } catch(e) { /* skip modules with missing deps */ }
    }
  }
})(globalThis.$tw || (globalThis.$tw = {}));

// ─── Browser filter wiki factory ────────────────────────────────────────────
/**
 * Create a minimal TW5 wiki instance for browser-side filtering.
 *
 * @param {Array<{title: string, fields: Record<string, string|string[]>}>} tiddlers
 * @returns {{ filterTiddlers: (expr: string) => string[] }}
 */
export function createBrowserFilterWiki(tiddlers) {
  var $tw = globalThis.$tw;
  var wiki = new $tw.Wiki();
  for (var i = 0; i < tiddlers.length; i++) {
    wiki.addTiddler(new $tw.Tiddler(tiddlers[i].fields));
  }
  return {
    filterTiddlers: function(expr) { return wiki.filterTiddlers(expr); }
  };
}

export { $tw as twInstance };
`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outDir  = join(corePkgPath, 'src', 'generated');
const outFile = join(outDir, 'tw-filter-engine.browser.js');

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, BUNDLE, 'utf8');

const sizeKB = Math.round(BUNDLE.length / 1024);
console.log(`Written ${outFile} (${sizeKB} KB)`);
console.log(`Modules included: ${neededTitles.length}`);
console.log(`  - ${neededTitles.filter(t => t.startsWith('$:/core/modules/filters/')).length} filter operators`);
console.log(`  - ${neededTitles.filter(t => t.startsWith('$:/core/modules/filterrunprefixes/')).length} run prefixes`);
console.log(`  - ${neededTitles.filter(t => t.startsWith('$:/core/modules/utils')).length} utility modules`);
console.log('\nDone. Add src/generated/tw-filter-engine.browser.js to .gitignore or commit it.');
