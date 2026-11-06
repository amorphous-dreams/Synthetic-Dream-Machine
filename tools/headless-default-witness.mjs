#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--root')) {
  console.error('usage: headless-default-witness.mjs [--root directory]');
  process.exit(2);
}
const root = args.length ? resolve(args[1]) : fileURLToPath(new URL('../', import.meta.url));
const packages = join(root, 'packages');
let failures = 0;

// Tokenize comments and strings as single units so their braces and property names
// cannot masquerade as configuration. Only literal defaults can satisfy the witness.
const tokensOf = source => source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g)
  ?.filter(token => !token.startsWith('//') && !token.startsWith('/*')) ?? [];

function check(source) {
  const tokens = tokensOf(source);
  const errors = [];
  for (let i = 0; i < tokens.length - 2; i++) {
    if (!['browser', "'browser'", '"browser"'].includes(tokens[i]) || tokens[i + 1] !== ':' || tokens[i + 2] !== '{') continue;
    const properties = new Map();
    let depth = 1;
    for (let j = i + 3; j < tokens.length && depth; j++) {
      const token = tokens[j];
      if (depth === 1 && ['enabled', 'headless', "'enabled'", "'headless'", '"enabled"', '"headless"'].includes(token) && tokens[j + 1] === ':') {
        const value = [',', '}'].includes(tokens[j + 3]) ? tokens[j + 2] : '<nonliteral>';
        properties.set(token.replace(/^['"]|['"]$/g, ''), value);
      }
      if (['{', '[', '('].includes(token)) depth++;
      else if (['}', ']', ')'].includes(token)) depth--;
    }
    if (properties.has('enabled') && properties.get('enabled') !== 'false' &&
        (properties.get('enabled') !== 'true' || properties.get('headless') !== 'true')) {
      errors.push('enabled browser must declare headless: true');
    }
  }
  return errors;
}

for (const pkg of readdirSync(packages, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const dir = join(packages, pkg.name);
  for (const file of readdirSync(dir)) {
    if (!/^vitest.*\.config\.[^.]+$/.test(file)) continue;
    const path = join(dir, file);
    for (const error of check(readFileSync(path, 'utf8'))) {
      console.error(`${relative(root, path)}: ${error}`);
      failures++;
    }
  }
}
if (failures) {
  console.error('pono: Set headless: true for each enabled browser; use --browser.headless=false for a headed run.');
  process.exitCode = 1;
}
