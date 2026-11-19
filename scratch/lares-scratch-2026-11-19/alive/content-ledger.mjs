// content-ledger: every meme and tiddler in plaintext, by title, with a body digest — read from disk alone.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
const roots = JSON.parse(process.argv[2]); const out = process.argv[3];
const SKIP = new Set([".git", "node_modules", "temp", "recovery"]);
function* walk(d) { for (const n of readdirSync(d)) { if (SKIP.has(n)) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) yield* walk(p); else if (/\.(mem|tid|meta)$/.test(n) || /\.(md|json|js|css|html|txt)$/.test(n)) yield p; } }
function titleOf(p, t) {
  if (p.endsWith(".mem")) { const m = t.match(/to=`(lar:[^`]+)`/) || t.match(/^title\s*=\s*"([^"]+)"/m); return m ? m[1] : null; }
  if (p.endsWith(".tid")) { const m = t.match(/^title:\s*(.+)$/m); return m ? m[1].trim() : null; }
  return null; }
function bodyOf(p, t) { // strip seals and volatile meta so a re-sealed carrier reads the same
  return t.replace(/<<\^ code=`&#x0003;`[^>]*>>/g, "").replace(/^(modified|created|revision|bag):.*$/gm, "").replace(/^tags\s*=.*$/gm, ""); }
const rows = {};
for (const [label, root] of Object.entries(roots)) { if (!existsSync(root)) continue;
  for (const p of walk(root)) { if (p.endsWith(".meta")) continue; let t; try { t = readFileSync(p, "utf8"); } catch { continue; }
    const title = titleOf(p, t) ?? `file:${relative(root, p)}`;
    const h = createHash("sha256").update(bodyOf(p, t)).digest("hex").slice(0, 16);
    (rows[title] ??= []).push({ src: label, path: relative(root, p), h }); } }
const summary = Object.fromEntries(Object.keys(roots).map(l => [l, Object.values(rows).flat().filter(r => r.src === l).length]));
writeFileSync(out, JSON.stringify({ summary, titles: Object.keys(rows).length, rows }, null, 1));
console.log(JSON.stringify({ summary, titles: Object.keys(rows).length }));
