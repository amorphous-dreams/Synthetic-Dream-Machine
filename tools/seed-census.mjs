// The place seed has key-file doors; every renamed carrier and public place-key use needs an exact receipt.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;
const TOKEN = /\b(?:loadVesselSigningSeed|placeSignerFromSeed|vesselSeed|vesselFloorKeyDoor|floorKeyDoor)\b|signingSeedFromHex\(raw\.signingKey\)/;
// Only the place key-file door decodes a place seed. PersonaVault decodes a distinct
// persona-root row through the same generic helper.
const SEED_ORIGIN = /\b(?:loadVesselSigningSeed|vesselSeed)\b|signingSeedFromHex\(raw\.signingKey\)/;
const PUBLIC_SPELLING = /\bvesselIdentity\.verifyingKey\b|\bvesselGateKey\b|\bloadVesselVerifyingKey\s*\(\s*\)|\bdaemonAuth\.placeVerifyingKey\b/;
const FACE_FALLBACK = /activeAtom\?\.key\s*\?\?\s*(?:vesselIdentity\.verifyingKey|vesselGateKey|loadVesselVerifyingKey\s*\(\s*\)|daemonAuth\.placeVerifyingKey)/;
const KEY_DOORS = new Set(['packages/lararium-node/src/node-vessel-identity.ts', 'packages/lararium-browser/src/browser-vessel-identity.ts']);

// Exact source-line receipts. The K15 rule grants no exception.
export const ENTRIES = [
  { rule: 'allowed', file: 'packages/lararium-browser/src/browser-vessel-identity.ts', match: 'signingSeedFromHex(existing.signingKey)', count: 1, reason: 'Browser place KEL key-file door.' },
  { rule: 'allowed', file: 'packages/lararium-mesh/src/gate-bundle.ts', match: 'floorKeyDoor', count: 1, reason: 'The mesh floor derivation adapter.' },
  { rule: 'allowed', file: 'packages/lararium-mesh/src/index.ts', match: 'floorKeyDoor', count: 1, reason: 'The mesh barrel exposes the floor adapter.' },
  { rule: 'allowed', file: 'packages/lararium-mesh/src/place-signer.ts', match: 'placeSignerFromSeed', count: 1, reason: 'The scoped five-duty place signer.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/index.ts', match: 'vesselFloorKeyDoor', count: 1, reason: 'The node barrel exposes the scoped floor door.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/main.ts', match: 'vesselFloorKeyDoor', count: 2, reason: 'The main floor pin uses the scoped floor door.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/commands/fleet-join.ts', match: 'vesselFloorKeyDoor', count: 2, reason: 'Fleet join carries the place floor pin.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/commands/nexus-contract.ts', match: 'vesselFloorKeyDoor', count: 2, reason: 'Nexus carriage names the floor pin door.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'vesselFloorKeyDoor', count: 1, reason: 'The key-file module defines the scoped floor door.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'floorKeyDoor', count: 2, reason: 'The key-file module imports and calls the floor adapter.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'loadVesselSigningSeed', count: 2, reason: 'The private key-file reader feeds the place signer.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'placeSignerFromSeed', count: 2, reason: 'The key-file door constructs the scoped signer.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'signingSeedFromHex(raw.signingKey)', count: 2, reason: 'The key-file door decodes its standing secret.' },
  { rule: 'allowed', file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'vesselFloorKeyDoor', count: 4, reason: 'Boot calls the scoped floor door for floor duties.' },
];

// No secret seed crosses a renamed production parameter or property after retirement.
export const HANDOFFS = [];
// Each public key use has a place sort. Counts cover code lines, excluding comments.
export const PUBLIC_PLACE_KEY = [
  { file: 'packages/lararium-browser/src/open-browser-vessel.ts', match: 'vesselIdentity.verifyingKey', count: 3, sort: 'place', reason: 'Browser place founding and daemon place check.' },
  { file: 'packages/lararium-browser/src/open-browser-vessel.ts', match: 'vesselVerifyingKey', count: 4, sort: 'place', reason: 'The browser carries its public place name into nexus placement, cadence, and presence.' },
  { file: 'packages/lararium-keyhive/src/operator-daemon-behavior.ts', match: 'daemonAuth.placeVerifyingKey', count: 5, sort: 'place', reason: 'Daemon boot place check (the mounted face's and each joined face's), face-owner mount comparison, the faceless floor\'s document label (public place key), and the floor label a lit face lifts.' },
  { file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'vesselIdentity.verifyingKey', count: 9, sort: 'place', reason: 'Hosting names, carried nexus placement, floor carrier, and daemon place check.' },
  { file: 'packages/lararium-node/src/open-node-vessel.ts', match: 'vesselGateKey', count: 4, sort: 'place', reason: 'Public mesh gate and cadence pin.' },
  { file: 'packages/lararium-node/src/commands/init.ts', match: 'vesselIdentity.verifyingKey', count: 2, sort: 'place', reason: 'Founding passes the public place check and carried placement.' },
  { file: 'packages/lararium-node/src/commands/host.ts', match: 'loadVesselVerifyingKey()', count: 3, sort: 'place', reason: 'Hosting names and gate public key.' },
  { file: 'packages/lararium-node/src/commands/nexus-contract.ts', match: 'loadVesselVerifyingKey()', count: 4, sort: 'place', reason: 'Nexus placement and floor carrier public key.' },
  { file: 'packages/lararium-node/src/node-vessel-identity.ts', match: 'loadVesselVerifyingKey()', count: 2, sort: 'place', reason: 'The public key-file reader and its own proof.' },
  { file: 'packages/lararium-node/src/main.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The main process names its public gate.' },
  { file: 'packages/lararium-node/src/realm-steward.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Realm steward reads local place identity.' },
  { file: 'packages/lararium-node/src/store-door-verbs.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Carried bundle names its owning place.' },
  { file: 'packages/lararium-node/src/commands/nexus-release.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Nexus release names the carrying place.' },
  { file: 'packages/lararium-node/src/commands/nexus-kapae.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Nexus standing uses the place key.' },
  { file: 'packages/lararium-node/src/commands/device-admit.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Device admit excludes the public place key from face identities.' },
  { file: 'packages/lararium-node/src/local-persona-kel.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The public place key names the local board.' },
  { file: 'packages/lararium-node/src/commands/fleet-join.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Fleet join excludes the place key from face identities.' },
  { file: 'packages/lararium-node/src/commands/nexus-publish.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The nexus publishing carrier names its place.' },
  { file: 'packages/lararium-node/src/commands/raise-sign.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The island placement reads the public place key.' },
  { file: 'packages/lararium-node/src/commands/nexus-cabal.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The cabal board names its carrying place.' },
  { file: 'packages/lararium-node/src/commands/nexus-offering-inspect.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'Offering inspection names the carrying place.' },
  { file: 'packages/lararium-node/src/fleet-lineage.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The lineage board names the carrying place.' },
  { file: 'packages/lararium-node/src/nexus-key-reissue.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'The island placement reads the public place key.' },
  { file: 'packages/lararium-node/src/commands/handle.ts', match: 'loadVesselVerifyingKey()', count: 2, sort: 'place', reason: 'Handle commands name the local place board.' },
  { file: 'packages/lares-cli/src/env.ts', match: 'loadVesselVerifyingKey()', count: 1, sort: 'place', reason: 'CLI environment prints the public place address.' },
];

function codeLines(text) {
  let block = false;
  return text.split(/\r?\n/).map((raw) => {
    let code = '';
    let quote = '';
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i], next = raw[i + 1];
      if (block) { if (c === '*' && next === '/') { block = false; i++; } continue; }
      if (quote) { code += c; if (c === '\\') { code += next ?? ''; i++; } else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; code += c; continue; }
      if (c === '/' && next === '*') { block = true; i++; continue; }
      if (c === '/' && next === '/') break;
      code += c;
    }
    return code.trim();
  });
}

export function scanText(file, source, { aliases = true } = {}) {
  const lines = codeLines(source);
  const findings = [];
  const seen = new Set();
  const publicAliases = new Set();
  const add = (line, kind, name = '') => {
    const key = `${line}:${kind}`;
    if (!seen.has(key)) { seen.add(key); findings.push({ file, line, text: lines[line - 1], kind, name }); }
  };
  lines.forEach((code, i) => {
    if (TOKEN.test(code) || (file.endsWith('/browser-vessel-identity.ts') && /signingSeedFromHex\(existing\.signingKey\)/.test(code))) add(i + 1, 'seed');
    if (PUBLIC_SPELLING.test(code)) add(i + 1, 'PUBLIC_PLACE_KEY');
    if (FACE_FALLBACK.test(code)) add(i + 1, 'face');
    const alias = code.match(/\b(?:const|let)\s+(vesselVerifyingKey)\s*=\s*(?:await\s+)?(?:vesselIdentity\.verifyingKey|vesselGateKey|loadVesselVerifyingKey\s*\(\s*\)|daemonAuth\.placeVerifyingKey)/);
    if (alias) publicAliases.add(alias[1]);
    if (publicAliases.size && !PUBLIC_SPELLING.test(code) && [...publicAliases].some(name => new RegExp(`\\b${name}\\b`).test(code))) add(i + 1, 'PUBLIC_PLACE_KEY');
    if (publicAliases.size && /activeAtom\?\.key\s*\?\?/.test(code) && [...publicAliases].some(name => new RegExp(`\\b${name}\\b`).test(code))) add(i + 1, 'face');
  });
  if (!aliases || KEY_DOORS.has(file)) return findings;
  const carrier = new Set();
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i];
    const sourceSeed = SEED_ORIGIN.test(code) || [...carrier].some((name) => new RegExp(`\\b${name}\\b`).test(code));
    if (!sourceSeed) continue;
    const assigned = code.match(/\b(?:const|let|var)\s+(\w+)\s*=|\b(\w+)\s*=\s*(?:await\s+)?(?:Buffer\.from|new Uint8Array|Uint8Array\.from|hkdf\w*|createHmac)/);
    if (assigned) carrier.add(assigned[1] ?? assigned[2]);
    if (!TOKEN.test(code) && /\b(?:const|let|var)\b|\b\w+\s*\(|\b\w+\s*:\s*\w+|\.update\s*\(|\.toString\s*\(/.test(code)) {
      add(i + 1, 'handoff', [...carrier].find((name) => new RegExp(`\\b${name}\\b`).test(code)) ?? 'seed');
    }
  }
  // A call carrying the source seed also marks its callee's renamed parameters, in this file.
  for (const [i, code] of lines.entries()) {
    if (!SEED_ORIGIN.test(code) && ![...carrier].some((name) => new RegExp(`\\b${name}\\b`).test(code))) continue;
    const call = code.match(/\b(\w+)\s*\(([^)]*)\)/);
    if (!call || /^(?:loadVesselSigningSeed|signingSeedFromHex)$/.test(call[1])) continue;
    const signature = lines.findIndex((line) => new RegExp(`\\bfunction\\s+${call[1]}\\s*\\(`).test(line));
    if (signature >= 0 && signature !== i) add(signature + 1, 'handoff', call[1]);
  }
  return findings.sort((a, b) => a.line - b.line);
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
      if (/^packages\/[^/]+\/src\//.test(rel) && SOURCE.test(rel)) files.push(rel);
    }
  }
  return files;
}

export function census(root, entries = ENTRIES, { aliases = true, handoffs = HANDOFFS, publicKeys = PUBLIC_PLACE_KEY } = {}) {
  const files = walk(root);
  const sources = new Map(files.map(file => [file, readFileSync(join(root, file), 'utf8')]));
  const findings = files.flatMap(file => scanText(file, sources.get(file), { aliases }));
  if (aliases) {
    // A seeded call also stains a renamed callee parameter in another source file.
    for (const source of [...findings]) {
      if (source.kind !== 'handoff') continue;
      const callee = source.text.match(/\b(\w+)\s*\(/)?.[1];
      if (!callee || /^(?:Buffer|Uint8Array|createHmac|hkdf\w*)$/.test(callee)) continue;
      for (const [file, body] of sources) {
        if (file === source.file) continue;
        const lines = codeLines(body);
        lines.forEach((code, i) => {
          if (!new RegExp(`\\b(?:function\\s+${callee}\\s*\\(|(?:const|let)\\s+${callee}\\s*=\\s*\\(?)`).test(code)) return;
          if (!findings.some(f => f.file === file && f.line === i + 1 && f.kind === 'handoff')) findings.push({ file, line: i + 1, text: code, kind: 'handoff', name: callee });
        });
      }
    }
  }
  const lists = { seed: entries, handoff: handoffs, PUBLIC_PLACE_KEY: publicKeys };
  const used = { seed: entries.map(() => 0), handoff: handoffs.map(() => 0), PUBLIC_PLACE_KEY: publicKeys.map(() => 0) };
  const open = [];
  for (const finding of findings) {
    if (finding.kind === 'face') { open.push(finding); continue; }
    const rows = lists[finding.kind];
    const count = used[finding.kind];
    const index = rows.findIndex((row, i) => row.file === finding.file && finding.text.includes(row.match ?? row.name)
      && row.reason?.trim() && count[i] < row.count);
    if (index < 0) open.push(finding);
    else count[index]++;
  }
  const stale = Object.entries(lists).flatMap(([kind, rows]) => rows.filter((row, i) =>
    used[kind][i] !== row.count || !row.reason?.trim() || (kind === 'seed' && row.rule !== 'allowed') || (kind === 'PUBLIC_PLACE_KEY' && row.sort !== 'place')));
  return { files: files.length, findings, open, stale, used: used.seed, handoffUsed: used.handoff, publicUsed: used.PUBLIC_PLACE_KEY };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let root = REPO;
  if (args[0] === '--root' && args[1]) { root = resolve(args[1]); args.splice(0, 2); }
  if (args.length && args[0] !== '--list') throw new Error(`unknown argument: ${args.join(' ')}`);
  const result = census(root);
  if (args[0] === '--list') for (const f of result.findings) console.log(`${f.kind} ${f.file}:${f.line}: ${f.text}`);
  for (const f of result.open) console.error(`OPEN ${f.kind} ${f.file}:${f.line}: ${f.text}`);
  for (const e of result.stale) console.error(`${e.rule && e.rule !== 'allowed' ? 'STALE-RULE' : 'STALE'} ${e.rule ?? e.sort ?? 'HANDOFF'} ${e.file} ${e.match ?? e.name} (${e.count})`);
  const green = result.files > 0 && result.open.length === 0 && result.stale.length === 0;
  console.log(`seed-census ${green ? 'GREEN' : 'RED'}: ${result.files} files, ${result.findings.length} consumers, ${result.open.length} open, ${result.stale.length} stale`);
  if (!green) process.exitCode = 1;
}
