/**
 * sync-heleuma.ts — drift check for heleuma anchor memes.
 *
 * Scans lares/ for memes with `heleuma = "ha"`, `"ka"`, or `"ba"` in #iam TOML.
 *
 * ha — body/structure anchor: checks #source slot vs live source-file/source-symbol.
 * ka — soul/fire anchor: same drift check; also reports if ceremony fields are absent.
 * ba — psyche/path anchor: verifies #source slot exists (no symbol extraction needed).
 *
 * Does NOT auto-patch. The human operator decides when to update the meme.
 * Run: pnpm --filter @lararium/tw5 build:heleuma
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "../../..");
const laresRoot = resolve(root, "lares");

// ---------------------------------------------------------------------------
// Regex patterns (mirrors lares-preloads.ts parser)
// ---------------------------------------------------------------------------

const SOH_URI_RE    = /<<~[^>]*&#x0001;[^>]*\?\s*->\s*([^\s>]+)\s*>>/;
const TOML_RE       = /```toml([\s\S]*?)```/;
const SOURCE_SLOT_RE = /<<~ ahu #source >>([\s\S]*?)<<~\/ahu >>/;

function parseToml(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([\w-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    out[m[1]!] = m[2]!.trim().replace(/^"|"$/g, "");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Walk lares/ recursively for .md files
// ---------------------------------------------------------------------------

function walkMd(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...walkMd(full));
    else if (entry.endsWith(".md")) results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Extract a named symbol's body from a TypeScript source file.
//
// Strategy: find the line where `symbol` appears as a method/function/const,
// then capture from that line until the matching closing brace at the same
// indent depth. Returns the raw extracted text, or null if not found.
// ---------------------------------------------------------------------------

function extractSymbol(srcPath: string, symbol: string): string | null {
  const src   = readFileSync(resolve(root, srcPath), "utf8");
  const lines = src.split("\n");

  // Match function/method declarations only (not comments or property references).
  // Handles: `export function foo(`, `private async foo(`, `export const foo =`
  const declRe = new RegExp(
    `^\\s*(export\\s+)?(private\\s+|public\\s+|protected\\s+|static\\s+|async\\s+|function\\s+)*${symbol}\\s*(\\(|=)`
  );
  const startIdx = lines.findIndex(
    (l: string) => declRe.test(l) && !/^\s*(\/\/|\*)/.test(l)
  );
  if (startIdx === -1) return null;

  // Walk forward collecting lines until brace depth returns to 0
  let depth  = 0;
  let started = false;
  const collected: string[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    for (const ch of line) {
      if (ch === "{") { depth++; started = true; }
      if (ch === "}") depth--;
    }
    collected.push(line);
    if (started && depth === 0) break;
  }

  return collected.join("\n");
}

// ---------------------------------------------------------------------------
// Compare extracted source against the #source slot in the meme.
// Returns a description of the drift, or null if clean.
// ---------------------------------------------------------------------------

function checkDrift(memeSource: string, liveSource: string): string | null {
  // Extract the first fenced code block content from the meme source slot.
  // The slot may contain prose headings — only the code fence content is compared.
  const fenceMatch = /```[^\n]*\n([\s\S]*?)\n```/.exec(memeSource);
  const stripped   = fenceMatch ? fenceMatch[1]!.trim() : memeSource.trim();
  const live       = liveSource.trim();
  if (stripped === live) return null;

  // Compute a rough diff size for the warning
  const memeLines = stripped.split("\n").length;
  const liveLines = live.split("\n").length;
  return `meme has ${memeLines} lines, live source has ${liveLines} lines`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let totalChecked = 0;
let totalDrift   = 0;
let totalMissing = 0;

for (const mdPath of walkMd(laresRoot)) {
  const content = readFileSync(mdPath, "utf8");

  const tomlM = TOML_RE.exec(content);
  if (!tomlM) continue;
  const toml = parseToml(tomlM[1]!);

  const mode = toml["heleuma"];
  if (mode !== "ha" && mode !== "ka" && mode !== "ba") continue;

  const uriM = SOH_URI_RE.exec(content);
  const uri  = uriM?.[1] ?? mdPath;

  totalChecked++;

  // ba — quine-only: just verify a #source slot exists
  if (mode === "ba") {
    const slotM = SOURCE_SLOT_RE.exec(content);
    if (!slotM) {
      console.warn(`[heleuma/ba] NO #source SLOT in ${uri} — add a <<~ ahu #source >> block`);
      totalMissing++;
    } else {
      console.log(`[heleuma/ba] ok   ${uri}`);
    }
    continue;
  }

  // ha/ka — require source-file + source-symbol for drift check
  const srcFile = toml["source-file"];
  const srcSym  = toml["source-symbol"];

  if (!srcFile || !srcSym) {
    console.warn(`[heleuma/${mode}] MISSING source-file/source-symbol in ${uri}`);
    totalMissing++;
    continue;
  }

  // Extract live source
  const liveSource = extractSymbol(srcFile, srcSym);
  if (!liveSource) {
    console.warn(`[heleuma/${mode}] SYMBOL NOT FOUND: ${srcSym} in ${srcFile} (${uri})`);
    totalMissing++;
    continue;
  }

  // Find #source slot in meme
  const slotM = SOURCE_SLOT_RE.exec(content);
  if (!slotM) {
    console.warn(`[heleuma/${mode}] NO #source SLOT in ${uri} — add a <<~ ahu #source >> block`);
    totalMissing++;
    continue;
  }

  const drift = checkDrift(slotM[1]!, liveSource);
  if (drift) {
    console.warn(`[heleuma/${mode}] DRIFT in ${uri} (${srcSym}): ${drift}`);
    console.warn(`          Live: ${resolve(root, srcFile)}`);
    totalDrift++;
  } else {
    console.log(`[heleuma/${mode}] ok   ${uri} (${srcSym})`);
  }

  // ka — note if ceremony fields are absent (not a failure, just advisory)
  if (mode === "ka" && (!toml["body-sha256"] || !toml["promoted-at"])) {
    console.log(`[heleuma/ka] ceremony pending: ${uri} (missing body-sha256 and/or promoted-at)`);
  }
}

console.log(`\n[heleuma] checked ${totalChecked} anchors — ${totalDrift} drift, ${totalMissing} missing`);

if (totalDrift > 0 || totalMissing > 0) {
  console.warn("[heleuma] Update the #source slots in the meme files to reflect the live TS source.");
  // Drift is a warning, not a build failure. Exit 0 so CI stays green but visible.
}
