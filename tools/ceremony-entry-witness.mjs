// ceremony-entry-witness — the ceremony document stands clean (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices,
// slice 1b). The ceremony takes the secret, so nothing but its own few modules may run beside it: no mirror, no TW5, no
// plugin code, no keyhive, no automerge, no package at all.
//
// THREE READINGS, each red by name:
//   reach    the ceremony script's import graph (the page-entry witness's walk: static and dynamic imports; type-only imports
//            and worker URLs not reached) reaches only files under `packages/lararium-web/src/ceremony/` and the protocol's
//            types (`src/ceremony-protocol.ts`). Any package, workspace or external, reads red with its chain.
//   policy   `packages/lararium-web/ceremony.html` carries its policy: `default-src 'none'`, `script-src 'self'`, no
//            `unsafe-inline` and no `unsafe-eval`; it holds no inline script, no inline handler, and loads one script, the
//            ceremony's own. The hearth's header (`CEREMONY_POLICY` in `packages/lararium-node/src/pronaos-adapter.ts`) reads
//            that same policy and `frame-ancestors 'none'`, which a meta policy cannot carry.
//   broker   `packages/lararium-web/public/ceremony-broker.js` imports nothing and handles no fetch.
//
// SILENT-ZERO GUARD: a missing entry, document or broker, an unresolved edge or an empty graph reads red (exit 2).
//
// Usage: node tools/ceremony-entry-witness.mjs [--root <repo>]
// Exit: 0 holds · 1 a reading fails · 2 the witness could not stand
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments, walk } from "./page-entry-witness.mjs";

export const CEREMONY_ENTRY = "packages/lararium-web/src/ceremony/ceremony.ts";
export const CEREMONY_DIR = "packages/lararium-web/src/ceremony/";
export const CEREMONY_PROTOCOL = "packages/lararium-web/src/ceremony-protocol.ts";
export const CEREMONY_DOCUMENT = "packages/lararium-web/ceremony.html";
export const CEREMONY_BROKER = "packages/lararium-web/public/ceremony-broker.js";
export const CEREMONY_HEADER_SOURCE = "packages/lararium-node/src/pronaos-adapter.ts";
const CEREMONY_SCRIPT_SRC = "/src/ceremony/ceremony.ts";

/** The policy's faults in one document's text: [] holds. */
export function policyFaults(html) {
  const faults = [];
  const meta = html.match(/<meta\s+http-equiv=(["'])Content-Security-Policy\1\s+content="([^"]*)"/i);
  if (!meta) return ["no Content-Security-Policy meta stands"];
  const policy = meta[2];
  const directives = new Map(policy.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));
  const has = (k, v) => (directives.get(k) ?? []).join(" ") === v;
  if (!has("default-src", "'none'")) faults.push("default-src is not 'none'");
  if (!has("script-src", "'self'")) faults.push("script-src is not 'self' alone");
  if (/unsafe-inline|unsafe-eval|unsafe-hashes|wasm-unsafe-eval/.test(policy)) faults.push("the policy names an unsafe source");
  const body = html.replace(/<!--[\s\S]*?-->/g, "");
  const scripts = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, text] of scripts) {
    if (!/\bsrc=/.test(attrs) || text.trim() !== "") faults.push("an inline script stands");
  }
  const srcs = scripts.map(([, attrs]) => attrs.match(/\bsrc=["']([^"']+)["']/)?.[1]).filter(Boolean);
  if (srcs.length !== 1 || srcs[0] !== CEREMONY_SCRIPT_SRC) faults.push(`the document loads ${srcs.length} script(s) (${srcs.join(", ") || "none"}), not the ceremony's own alone`);
  if (/\son[a-z]+\s*=/i.test(body)) faults.push("an inline event handler stands");
  return faults;
}

/** The meta policy's own text, or null. */
export function metaPolicyOf(html) {
  return html.match(/<meta\s+http-equiv=(["'])Content-Security-Policy\1\s+content="([^"]*)"/i)?.[2] ?? null;
}

/** The hearth header's faults: it reads the meta policy and `frame-ancestors 'none'`, and nothing else. [] holds. */
export function headerFaults(html, adapterSource) {
  const meta = metaPolicyOf(html);
  const header = adapterSource.match(/export const CEREMONY_POLICY = "([^"]*)";/)?.[1];
  if (!header) return ["the hearth names no CEREMONY_POLICY header"];
  if (meta === null) return ["no meta policy to weld the header to"];
  return header === `${meta}; frame-ancestors 'none'` ? [] : [`the hearth's header (${header}) is not the meta policy and frame-ancestors 'none'`];
}

/** The broker's faults in its text: [] holds. */
export function brokerFaults(js) {
  const src = stripComments(js);
  const faults = [];
  if (/\bimport\b|\bimportScripts\s*\(/.test(src)) faults.push("the broker imports code");
  if (/["']fetch["']/.test(src)) faults.push("the broker handles fetch");
  return faults;
}

/** The ceremony graph's reaches past its own directory and the protocol: [{ name, chain }]. */
export function reachFaults(result, root) {
  const own = (file) => { const rel = relative(root, file); return rel.startsWith(CEREMONY_DIR) || rel === CEREMONY_PROTOCOL; };
  const parentOf = (n) => (n.startsWith("pkg:") ? result.externals.get(n) : result.reached.get(n));
  const chainOf = (node) => { const out = []; for (let n = node; n; n = parentOf(n)) out.unshift(n.startsWith("pkg:") ? n.slice(4) : relative(root, n)); return out.join(" -> "); };
  const hits = [];
  for (const node of result.externals.keys()) hits.push({ name: node.slice(4), chain: chainOf(node) });
  for (const file of result.reached.keys()) if (!own(file)) hits.push({ name: relative(root, file), chain: chainOf(file) });
  return hits;
}

function main(argv) {
  const i = argv.indexOf("--root");
  const root = resolve(i >= 0 ? argv[i + 1] : fileURLToPath(new URL("../", import.meta.url)));
  for (const need of [CEREMONY_ENTRY, CEREMONY_DOCUMENT, CEREMONY_BROKER, CEREMONY_HEADER_SOURCE]) {
    if (!existsSync(resolve(root, need))) { console.log(`ceremony-entry: ${need} stands nowhere under ${root} — the witness cannot stand`); return 2; }
  }
  const result = walk({ root, entry: CEREMONY_ENTRY });
  if (result.error) { console.log(`ceremony-entry: ${result.error}`); return 2; }
  if (result.edges === 0) { console.log(`ceremony-entry: ${CEREMONY_ENTRY} reads no import edge — an empty graph proves nothing`); return 2; }
  if (result.unresolved.length) {
    console.log(`ceremony-entry: ${result.unresolved.length} edge(s) resolve to no file — the walk cannot stand`);
    for (const u of result.unresolved) console.log(`  ${relative(root, u.from)}: ${u.spec}`);
    return 2;
  }
  const reach = reachFaults(result, root);
  const html = readFileSync(resolve(root, CEREMONY_DOCUMENT), "utf8");
  const policy = [...policyFaults(html), ...headerFaults(html, readFileSync(resolve(root, CEREMONY_HEADER_SOURCE), "utf8"))];
  const broker = brokerFaults(readFileSync(resolve(root, CEREMONY_BROKER), "utf8"));
  if (reach.length + policy.length + broker.length === 0) {
    console.log(`ceremony-entry: holds — the ceremony reaches ${result.reached.size} module(s) of its own, its policy stands, its broker imports nothing`);
    return 0;
  }
  console.log(`ceremony-entry: ${reach.length} reach(es), ${policy.length} policy fault(s), ${broker.length} broker fault(s)`);
  for (const h of reach) console.log(`  reach ${h.name}\n    ${h.chain}`);
  for (const f of policy) console.log(`  policy: ${f}`);
  for (const f of broker) console.log(`  broker: ${f}`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
