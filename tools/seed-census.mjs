// seed-census — name every source line that carries the vessel's online signer seed.
// node-vessel-identity.loadVesselSigningSeed opens the key; place-signer.placeSignerFromSeed signs floor duties.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const SELF = new Set(['tools/seed-census.mjs', 'tools/seed-census.test.mjs', 'tools/seed-census-witness.sh']);
const SOURCE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;
const TOKEN = /\b(?:loadVesselSigningSeed|placeSignerFromSeed|vesselSeed|vesselFloorKeyDoor|floor[K]eyDoor)\b|signingSeedFromHex\(raw\.signingKey\)/;

// Each entry covers exactly `count` lines. K15 retires the owed entries as its callers move to duty adapters.
export const ENTRIES = [
  { rule: 'K15', file: 'packages/lararium-browser/src/browser-vessel-identity.ts', match: 'signingSeedFromHex(existing.signingKey)', count: 1, reason: 'K15 moves browser device seed extraction away from the vessel key.' },
  { rule: 'K15', file: 'packages/lararium-browser/src/open-browser-vessel.ts', match: 'vesselSeed', count: 4, reason: 'K15 moves browser founding and device work away from the vessel seed.' },
  { rule: 'K15', file: 'packages/lararium-keyhive/src/ceremony-core.ts', match: 'vesselSeed', count: 7, reason: 'K15 retires the vessel-wide Keyhive Individual and its place card mint.' },
  { rule: 'allowed', file: 'packages/lararium-mesh/src/gate-bundle.ts', match: 'oorKeyDoor', count: 1, reason: 'gate-bundle.floorKeyDoor declares the floor derivation adapter.' },
  { rule: 'allowed', file: 'packages/lararium-mesh/src/index.ts', match: 'oorKeyDoor', count: 1, reason: 'The mesh barrel exports the floor derivation adapter.' },
  { rule: 'allowed', file: 'packages/lararium-mesh/src/place-signer.ts', match: 'placeSignerFromSeed', count: 1, reason: 'place-signer.placeSignerFromSeed holds the five framed floor duties.' },
  { rule: 'K15', file: 'packages/lararium-node/src/carriage-relay.ts', match: 'vesselSeed', count: 2, reason: 'K15 moves the relay gate derivation off the vessel seed.' },
  { rule: 'K15', file: 'packages/lararium-node/src/commands/fleet-join.ts', match: 'vesselFloorKeyDoor', count: 2, reason: 'K15 moves the fleet join floor pin child derivation.' },
  { rule: 'K15', file: 'packages/lararium-node/src/commands/init.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'K15 moves the founding Keyhive Individual away from the vessel seed.' },
  { rule: 'K15', file: 'packages/lararium-node/src/commands/init.ts', match: 'foundThePlace({ repo, vesselSeed', count: 1, reason: 'K15 moves place founding away from the vessel-wide Individual.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/commands/nexus-contract.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'nexus-contract.runNexusCarryFor signs carriage carrier and place floor pin.' },
  { rule: 'K15', file: 'packages/lararium-node/src/commands/nexus-contract.ts', match: 'vesselFloorKeyDoor', count: 2, reason: 'K15 moves the floor pin child derivation.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/index.ts', match: 'loadVesselSigningSeed', count: 1, reason: 'The node barrel exports the key file door for named callers.' },
  { rule: 'K15', file: 'packages/lararium-node/src/leaf-identity.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'K15 moves leaf device identity off the vessel seed.' },
  { rule: 'K15', file: 'packages/lararium-node/src/main.ts', match: 'vesselFloorKeyDoor', count: 2, reason: 'K15 moves the main floor gate child derivation.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'oorKeyDoor', count: 2, reason: 'node-vessel-identity.vesselFloorKeyDoor owns the floor key file door.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'vesselFloorKeyDoor()', count: 1, reason: 'node-vessel-identity.vesselFloorKeyDoor names its floor key door.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'loadVesselSigningSeed', count: 1, reason: 'node-vessel-identity.loadVesselSigningSeed reads the standing key file.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'signingSeedFromHex(raw.signingKey)', count: 2, reason: 'The key file door decodes the standing vessel seed and its floor child.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'placeSignerFromSeed', count: 2, reason: 'open-node-vessel signs carriage floor duties with the place signer.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'open-node-vessel opens the key file for named floor duties.' },
  { rule: 'K15', file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'vesselFloorKeyDoor', count: 4, reason: 'K15 moves the floor gate child derivations.' },
  { rule: 'K15', file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'vesselSeed', count: 6, reason: 'K15 moves relay, daemon auth, internal asks, device and face work off the vessel seed.' },
  { rule: 'K15', file: 'packages/lararium-node/src/place-card.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'K15 moves place card minting off the vessel-wide Keyhive Individual.' },
  { rule: 'K15', file: 'packages/lares-cli/src/commands/meme.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'K15 moves the CLI meme signer off the vessel seed.' },
];

export function scanText(file, text) {
  const found = [];
  let block = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    let code = '';
    for (let i = 0; i < raw.length; i++) {
      if (block) { if (raw[i] === '*' && raw[i + 1] === '/') { block = false; i++; } continue; }
      if (raw[i] === '/' && raw[i + 1] === '*') { block = true; i++; continue; }
      if (raw[i] === '/' && raw[i + 1] === '/') break;
      code += raw[i];
    }
    if (TOKEN.test(code) || (file === 'packages/lararium-browser/src/browser-vessel-identity.ts' && /signingSeedFromHex\(existing\.signingKey\)/.test(code))) {
      found.push({ file, line: index + 1, text: code.trim() });
    }
  });
  return found;
}

function walk(root, dir = join(root, 'packages')) {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name === 'dist') continue;
      files.push(...walk(root, path));
    } else if (item.isFile()) {
      const rel = relative(root, path).replaceAll('\\', '/');
      if (/^packages\/[^/]+\/src\//.test(rel) && SOURCE.test(rel) && !SELF.has(rel)) files.push(rel);
    }
  }
  return files;
}

export function census(root, entries = ENTRIES) {
  const files = walk(root);
  const findings = files.flatMap(file => scanText(file, readFileSync(join(root, file), 'utf8')));
  const used = entries.map(() => 0), open = [];
  for (const finding of findings) {
    const index = entries.findIndex((entry, i) => entry.file === finding.file && finding.text.includes(entry.match)
      && entry.reason?.trim() && used[i] < entry.count);
    if (index < 0) open.push(finding);
    else used[index]++;
  }
  const stale = entries.filter((entry, i) => used[i] !== entry.count || !entry.match || !entry.reason?.trim() || !['allowed', 'K15'].includes(entry.rule));
  return { files: files.length, findings, open, stale, used };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let root = REPO;
  if (args[0] === '--root' && args[1]) { root = resolve(args[1]); args.splice(0, 2); }
  if (args.length && args[0] !== '--list') throw new Error(`unknown argument: ${args.join(' ')}`);
  const result = census(root);
  if (args[0] === '--list') for (const f of result.findings) console.log(`${f.file}:${f.line}: ${f.text}`);
  for (const f of result.open) console.error(`OPEN ${f.file}:${f.line}: ${f.text}`);
  for (const e of result.stale) console.error(`STALE ${e.rule} ${e.file} ${e.match} (${e.count})`);
  const green = result.files > 0 && result.open.length === 0 && result.stale.length === 0;
  console.log(`seed-census ${green ? 'GREEN' : 'RED'}: ${result.files} files, ${result.findings.length} consumers, ${result.open.length} open, ${result.stale.length} stale`);
  if (!green) process.exitCode = 1;
}
