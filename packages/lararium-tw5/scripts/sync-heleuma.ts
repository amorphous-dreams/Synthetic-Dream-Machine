/**
 * sync-heleuma.ts — drift check, patch, and corpus-promotion scan.
 *
 * Modes (mutually exclusive flags):
 *   (none)          Dry-run: report drift/missing, write nothing.
 *   --commit        Patch #source slots in-place to match live TS source.
 *   --scan          Scan packages/ for exported symbols that lack a heleuma pair.
 *   --scan-promote  Scan packages/ for pure-data constants that should become
 *                   first-class corpus memes in lares/ (not heleuma anchors —
 *                   things that can MOVE to lares/ and be deleted from packages/).
 *
 * heleuma modes:
 *   ha — body/structure anchor: permanent compiled-in territory, no promotion path.
 *   ka — soul/fire anchor: promotion-eligible; #source + body-sha256 track readiness; keyhive proof is layer 3 (planned).
 *   ba — psyche/path anchor: quine-only; #source slot sufficient for reconstruction.
 *
 * Run:
 *   pnpm --filter @lararium/tw5 build:heleuma                  # dry-run (build gate)
 *   pnpm --filter @lararium/tw5 build:heleuma --commit         # patch #source slots
 *   pnpm --filter @lararium/tw5 build:heleuma --scan           # find heleuma candidates
 *   pnpm --filter @lararium/tw5 build:heleuma --scan-promote   # find corpus-promotion candidates
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { createHash } from "crypto";
import { resolve, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "../../..");
const laresRoot = resolve(root, "lares");
const pkgsRoot  = resolve(root, "packages");

const args          = process.argv.slice(2);
const COMMIT        = args.includes("--commit");
const SCAN          = args.includes("--scan");
const SCAN_PROMOTE  = args.includes("--scan-promote");

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const SOH_URI_RE     = /<<~[^>]*&#x0001;[^>]*\?\s*->\s*([^\s>]+)\s*>>/;
const TOML_RE        = /```toml([\s\S]*?)```/;
const SOURCE_SLOT_RE = /<<~ ahu #source >>([\s\S]*?)<<~\/ahu >>/;
const FENCE_RE       = /```[^\n]*\n([\s\S]*?)\n```/;

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
// File walkers
// ---------------------------------------------------------------------------

function walkExt(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...walkExt(full, ext));
    else if (entry.endsWith(ext)) results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Symbol extractor
// ---------------------------------------------------------------------------

function extractSymbol(srcPath: string, symbol: string): string | null {
  const src   = readFileSync(resolve(root, srcPath), "utf8");
  const lines = src.split("\n");
  const declRe = new RegExp(
    `^\\s*(export\\s+)?(const\\s+|private\\s+|public\\s+|protected\\s+|static\\s+|async\\s+|function\\s+)*${symbol}\\s*(?::[^=(]*)?\\s*(\\(|=)`
  );
  const startIdx = lines.findIndex(
    (l: string) => declRe.test(l) && !/^\s*(\/\/|\*)/.test(l)
  );
  if (startIdx === -1) return null;

  let depth = 0, started = false;
  const collected: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    for (const ch of line) {
      if (ch === "{" || ch === "[") { depth++; started = true; }
      if (ch === "}" || ch === "]") depth--;
    }
    collected.push(line);
    if (started && depth === 0) break;
  }
  return collected.join("\n");
}

// ---------------------------------------------------------------------------
// Drift check
// ---------------------------------------------------------------------------

function checkDrift(memeSlot: string, liveSource: string): string | null {
  const fenceMatch = FENCE_RE.exec(memeSlot);
  const stripped   = fenceMatch ? fenceMatch[1]!.trim() : memeSlot.trim();
  const live       = liveSource.trim();
  if (stripped === live) return null;
  return `meme has ${stripped.split("\n").length} lines, live has ${live.split("\n").length} lines`;
}

// ---------------------------------------------------------------------------
// Commit: patch #source slot and/or body-sha256 in one write
// ---------------------------------------------------------------------------

// Returns patched content, or null if the #source slot is missing/unparseable.
function applySourcePatch(content: string, liveCode: string): string | null {
  const slotM = SOURCE_SLOT_RE.exec(content);
  if (!slotM) return null;
  const fenceM = FENCE_RE.exec(slotM[1]!);
  if (!fenceM) return null;

  const fenceStart = content.indexOf(fenceM[0], slotM.index);
  const fenceEnd   = fenceStart + fenceM[0].length;
  const lang       = fenceM[0].match(/^```([^\n]*)/)![1] ?? "typescript";
  const newFence   = "```" + lang + "\n" + liveCode + "\n```";
  return content.slice(0, fenceStart) + newFence + content.slice(fenceEnd);
}

// Patches body-sha256 in the first ```toml block (the #iam block).
// Adds the field if absent; replaces it if stale.
function applyBodySha256Patch(content: string, sha256: string): string {
  const SHA_FIELD = /^body-sha256\s*=\s*"[^"]*"/m;
  if (SHA_FIELD.test(content)) {
    return content.replace(SHA_FIELD, `body-sha256 = "${sha256}"`);
  }
  // Insert before the closing ``` of the first toml fence
  return content.replace(/(```toml[\s\S]*?)(\n```)/, `$1\nbody-sha256 = "${sha256}"$2`);
}

// ---------------------------------------------------------------------------
// --scan: find candidates in packages/ lacking a heleuma pair
// ---------------------------------------------------------------------------

function runScan(): void {
  // Collect all URIs that already have a heleuma API meme
  const existingUris = new Set<string>();
  for (const mdPath of walkExt(laresRoot, ".md")) {
    const content = readFileSync(mdPath, "utf8");
    const tomlM   = TOML_RE.exec(content);
    if (!tomlM) continue;
    const toml = parseToml(tomlM[1]!);
    if (toml["heleuma"]) {
      const sf = toml["source-file"] ?? "";
      const ss = toml["source-symbol"] ?? "";
      if (sf) existingUris.add(`${sf}::${ss}`);
    }
  }

  // Patterns that suggest a function is a good heleuma candidate
  // ha: config objects, constants, JSON shapes — structural territory
  // ka: standalone exported/private functions — promotion-eligible
  // ba: imperative registrations, side-effect-only calls — path markers
  const HA_RE = /^\s*export\s+const\s+\w+\s*[=:]/;
  const KA_RE = /^\s*(export\s+)?(private\s+static\s+|public\s+static\s+)?\s*(async\s+)?function\s+\w+\s*\(|^\s*(private|public|protected)\s+(static\s+)?(async\s+)?\w+\s*\(/;

  interface Candidate { file: string; symbol: string; line: number; mode: "ha" | "ka" | "ba" }
  const candidates: Candidate[] = [];

  // Only scan src/ dirs under packages/ (skip node_modules, dist, scripts)
  for (const tsPath of walkExt(pkgsRoot, ".ts")) {
    const rel = relative(root, tsPath);
    if (rel.includes("node_modules") || rel.includes("/dist/") || rel.includes("/scripts/")) continue;

    const src   = readFileSync(tsPath, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      let mode: "ha" | "ka" | "ba" | null = null;
      let symbol = "";

      if (KA_RE.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
        const m = line.match(/(?:function\s+|static\s+(?:async\s+)?)(\w+)\s*\(/) ??
                  line.match(/(?:private|public|protected)\s+(?:static\s+)?(?:async\s+)?(\w+)\s*\(/);
        if (m) { mode = "ka"; symbol = m[1]!; }
      } else if (HA_RE.test(line)) {
        const m = line.match(/export\s+const\s+(\w+)/);
        if (m) { mode = "ha"; symbol = m[1]!; }
      }

      if (!mode || !symbol) continue;
      const key = `${rel}::${symbol}`;
      if (existingUris.has(key)) continue;
      // Skip trivial/internal names
      if (/^_|^tmp|^i$|^j$|^k$|^n$/.test(symbol)) continue;

      candidates.push({ file: rel, symbol, line: i + 1, mode });
    }
  }

  if (candidates.length === 0) {
    console.log("[heleuma/scan] No new candidates found — all exportable symbols have pairs.");
    return;
  }

  const byMode: Record<string, Candidate[]> = { ha: [], ka: [], ba: [] };
  for (const c of candidates) byMode[c.mode]!.push(c);

  console.log(`[heleuma/scan] ${candidates.length} candidate(s) without heleuma pairs:\n`);

  for (const mode of ["ha", "ka", "ba"] as const) {
    const list = byMode[mode]!;
    if (list.length === 0) continue;
    console.log(`  ${mode.toUpperCase()} (${mode === "ha" ? "structural constants" : mode === "ka" ? "promotion-eligible functions" : "path markers"}):`);
    for (const c of list.slice(0, 20)) {
      console.log(`    ${c.file}:${c.line}  ${c.symbol}`);
    }
    if (list.length > 20) console.log(`    ... and ${list.length - 20} more`);
    console.log();
  }

  console.log("[heleuma/scan] For each candidate:");
  console.log("  ha — create API meme with heleuma=\"ha\", source-file, #source slot (no ceremony fields).");
  console.log("  ka — create API meme with heleuma=\"ka\", source-file, source-symbol, #source slot.");
  console.log("  ba — create API meme with heleuma=\"ba\", #source slot sufficient for reconstruction.");
}

// ---------------------------------------------------------------------------
// --scan-promote: find pure-data constants that should become corpus memes
//
// A constant is a corpus-promotion candidate when ALL of the following hold:
//   1. It is `export const NAME = <value>` (not a function, not a class)
//   2. Its value body contains only literals: strings, numbers, booleans,
//      arrays/objects composed of the above. No function calls, no `new`,
//      no identifier references that are not other plain literals or types.
//   3. It is NOT already present in lares/ as a meme (checked by name match).
//
// Three sub-categories surface in the output:
//   vocab    — string/number tuple arrays (AS CONST tuples); become TOML arrays
//   map      — Record<string, string|number> objects; become TOML tables
//   tiddler  — objects containing a `title:` field; these ARE tiddlers already
// ---------------------------------------------------------------------------

function runScanPromote(): void {
  // Collect names already present as corpus memes in lares/.
  // Checks: uri-path basename, source-symbol, and TOML keys in any #schema slot.
  const existingNames = new Set<string>();
  const VOCAB_SLOT_RE = /<<~ ahu #schema >>([\s\S]*?)<<~\/ahu >>/g;

  for (const mdPath of walkExt(laresRoot, ".md")) {
    const content = readFileSync(mdPath, "utf8");
    const tomlM   = TOML_RE.exec(content);
    if (!tomlM) continue;
    const toml = parseToml(tomlM[1]!);
    // Match by uri-path basename and by source-symbol
    const uriBase = (toml["uri-path"] ?? "").split("/").pop() ?? "";
    if (uriBase) existingNames.add(uriBase.toLowerCase());
    const ss = toml["source-symbol"] ?? "";
    if (ss)   existingNames.add(ss.toLowerCase());

    // Also extract TOML keys from #vocab slots — these are promoted constants
    let vm: RegExpExecArray | null;
    VOCAB_SLOT_RE.lastIndex = 0;
    while ((vm = VOCAB_SLOT_RE.exec(content)) !== null) {
      const fenceM = FENCE_RE.exec(vm[1]!);
      if (!fenceM) continue;
      for (const line of fenceM[1]!.split("\n")) {
        // Top-level key lines: "key = ..." or "[section]" — extract the key name
        const keyM = line.match(/^([a-z][a-z0-9-]*)\s*=/i) ?? line.match(/^\[([a-z][a-z0-9-]*)\]/i);
        if (keyM) {
          // Normalise: kebab-case → underscore + uppercase variants
          const k = keyM[1]!;
          existingNames.add(k.toLowerCase());
          existingNames.add(k.replace(/-/g, "_").toLowerCase());
          // Also match the SCREAMING_SNAKE form used in TS (e.g. ladder-5 → LADDER_5)
          existingNames.add(k.replace(/-/g, "_").toUpperCase().toLowerCase());
        }
      }
    }
  }

  interface Promote {
    file: string; line: number; name: string;
    subtype: "vocab" | "map" | "tiddler";
    note: string;
  }
  const found: Promote[] = [];

  // Heuristic: extract the value block of `export const NAME = <block>` and
  // classify it. We collect lines until the brace/bracket depth returns to 0.
  const CONST_DECL_RE = /^\s*export\s+const\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?\s*=\s*(.*)$/;

  for (const tsPath of walkExt(pkgsRoot, ".ts")) {
    const rel = relative(root, tsPath);
    if (rel.includes("node_modules") || rel.includes("/dist/") ||
        rel.includes("/scripts/")    || rel.includes("/tests/") ||
        rel.includes(".test.")       || rel.includes(".spec.")) continue;

    const src   = readFileSync(tsPath, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const dm = CONST_DECL_RE.exec(line);
      if (!dm) continue;

      const name    = dm[1]!;
      const opener  = dm[2]!.trim();

      // Skip if already in lares
      if (existingNames.has(name.toLowerCase())) continue;
      // Skip small utility constants (≤3 chars, or single underscore prefix)
      if (name.length <= 3 || name.startsWith("_")) continue;

      // Collect the full value block (multi-line)
      let depth = 0, body = "";
      for (let j = i; j < Math.min(i + 60, lines.length); j++) {
        const l = lines[j]!;
        body += (j === i ? opener : l) + "\n";
        for (const ch of l) {
          if (ch === "[" || ch === "{" || ch === "(") depth++;
          if (ch === "]" || ch === "}" || ch === ")") depth--;
        }
        if (j === i && depth === 0 && (opener.startsWith("[") || opener.startsWith("{"))) break;
        if (j > i && depth <= 0) break;
      }

      // Reject if body contains function calls, `new`, or arrow functions
      // (these are not pure data)
      if (/\bnew\b|\b=>\b/.test(body)) continue;
      // Allow known safe calls: `as const`, `pageId(` is a template helper —
      // flag tiddler-shaped objects containing these as "review"
      const hasCalls = /\b\w+\s*\(/.test(body.replace(/pageId\(/g, ""));
      if (hasCalls) continue;

      // Classify
      let subtype: "vocab" | "map" | "tiddler" = "vocab";
      if (/\btitle\s*:/.test(body))        subtype = "tiddler";
      else if (opener.startsWith("{"))     subtype = "map";
      else if (opener.startsWith("["))     subtype = "vocab";
      else continue; // scalar constant — not interesting for corpus migration

      const note =
        subtype === "tiddler" ? "has title: field — this IS a tiddler" :
        subtype === "map"     ? "string/number Record — becomes TOML table" :
                                "string tuple — becomes TOML array";

      found.push({ file: rel, line: i + 1, name, subtype, note });
    }
  }

  if (found.length === 0) {
    console.log("[promote] No pure-data constants found without corpus memes — fully promoted.");
    return;
  }

  const byType: Record<string, Promote[]> = { tiddler: [], vocab: [], map: [] };
  for (const f of found) byType[f.subtype]!.push(f);

  console.log(`[promote] ${found.length} constant(s) that can become first-class corpus memes:\n`);

  const labels: Record<string, string> = {
    tiddler: "TIDDLER-SHAPED (move to lares/ as .md, delete from packages/)",
    vocab:   "VOCABULARY TUPLES (move to lares/ as TOML array memes)",
    map:     "LOOKUP MAPS (move to lares/ as TOML table memes)",
  };

  for (const sub of ["tiddler", "vocab", "map"] as const) {
    const list = byType[sub]!;
    if (list.length === 0) continue;
    console.log(`  ${labels[sub]}:`);
    for (const c of list) {
      console.log(`    ${c.file}:${c.line}  ${c.name}`);
      console.log(`      → ${c.note}`);
    }
    console.log();
  }

  console.log("[promote] Next step: for each item above, create a corpus meme in lares/");
  console.log("  and replace the TS import with a corpus query or remove it entirely.");
}

// ---------------------------------------------------------------------------
// Main — check/commit loop
// ---------------------------------------------------------------------------

if (SCAN_PROMOTE) {
  runScanPromote();
  process.exit(0);
}

if (SCAN) {
  runScan();
  process.exit(0);
}

if (COMMIT) {
  console.log("[heleuma] --commit: patching #source slots to match live TS source\n");
} else {
  console.log("[heleuma] dry-run (pass --commit to patch, --scan to find candidates, --scan-promote to find corpus candidates)\n");
}

let totalChecked = 0;
let totalDrift   = 0;
let totalMissing = 0;
let totalPatched = 0;

for (const mdPath of walkExt(laresRoot, ".md")) {
  const content = readFileSync(mdPath, "utf8");

  const tomlM = TOML_RE.exec(content);
  if (!tomlM) continue;
  const toml = parseToml(tomlM[1]!);

  const mode = toml["heleuma"];
  if (mode !== "ha" && mode !== "ka" && mode !== "ba") continue;

  const uriM = SOH_URI_RE.exec(content);
  const uri  = uriM?.[1] ?? mdPath;

  totalChecked++;

  // ba — quine-only: verify #source slot exists.
  // When source-symbol is declared, drift-check and hash exactly like ka.
  if (mode === "ba") {
    const slotM = SOURCE_SLOT_RE.exec(content);
    if (!slotM) {
      console.warn(`[heleuma/ba] MISSING #source slot  ${uri}`);
      totalMissing++;
      continue;
    }

    const baSrcFile = toml["source-file"];
    const baSrcSym  = toml["source-symbol"];

    if (!baSrcFile || !baSrcSym) {
      // No symbol — quine-only, no drift check needed
      console.log(`[heleuma/ba] ok   ${uri}`);
      continue;
    }

    // ba may declare multiple space-separated symbols; extract each and join
    const baSymbols = baSrcSym.trim().split(/\s+/);
    const baExtracted: string[] = [];
    for (const sym of baSymbols) {
      const extracted = extractSymbol(baSrcFile, sym);
      if (extracted) baExtracted.push(extracted.trim());
    }
    if (baExtracted.length === 0) {
      console.warn(`[heleuma/ba] SYMBOL NOT FOUND: ${baSrcSym} in ${baSrcFile}  (${uri})`);
      totalMissing++;
      continue;
    }

    const baLiveCode  = baExtracted.join("\n\n");
    const baDrift     = checkDrift(slotM[1]!, baLiveCode);
    const baLiveHash  = createHash("sha256").update(baLiveCode, "utf8").digest("hex");
    const baExistHash = toml["body-sha256"] ?? "";
    const baHashDrift = baExistHash !== baLiveHash;

    if (COMMIT && (baDrift || baHashDrift)) {
      let working: string = content;
      if (baDrift) {
        const patched = applySourcePatch(working, baLiveCode);
        if (patched) working = patched;
      }
      working = applyBodySha256Patch(working, baLiveHash);
      writeFileSync(mdPath, working, "utf8");

      const parts: string[] = [];
      if (baDrift)     parts.push(`source: ${baDrift}`);
      if (baHashDrift) parts.push(baExistHash ? "body-sha256 updated" : "body-sha256 added");
      console.log(`[heleuma/ba] patched  ${uri} (${baSrcSym}): ${parts.join("; ")}`);
      totalPatched++;
    } else if (!COMMIT && baDrift) {
      console.warn(`[heleuma/ba] DRIFT  ${uri} (${baSrcSym}): ${baDrift}`);
      console.warn(`           live: ${resolve(root, baSrcFile)}`);
      totalDrift++;
    } else {
      console.log(`[heleuma/ba] ok   ${uri} (${baSrcSym})`);
    }

    if (!COMMIT && baHashDrift) {
      console.log(`[heleuma/ba] body-sha256 ${baExistHash ? "stale" : "missing"}  ${uri}`);
    }
    continue;
  }

  // ha/ka — drift check against live source
  const srcFile = toml["source-file"];
  const srcSym  = toml["source-symbol"];

  if (!srcFile || !srcSym) {
    console.warn(`[heleuma/${mode}] MISSING source-file/source-symbol  ${uri}`);
    totalMissing++;
    continue;
  }

  const liveSource = extractSymbol(srcFile, srcSym);
  if (!liveSource) {
    console.warn(`[heleuma/${mode}] SYMBOL NOT FOUND: ${srcSym} in ${srcFile}  (${uri})`);
    totalMissing++;
    continue;
  }

  const slotM = SOURCE_SLOT_RE.exec(content);
  if (!slotM) {
    console.warn(`[heleuma/${mode}] MISSING #source slot  ${uri}`);
    if (COMMIT) {
      console.warn(`[heleuma/${mode}]   cannot patch — add <<~ ahu #source >> block first`);
    }
    totalMissing++;
    continue;
  }

  const liveCode  = liveSource.trim();
  const drift     = checkDrift(slotM[1]!, liveCode);

  // For ka memes: also track whether body-sha256 is current.
  // sha256(liveCode) is the quine integrity anchor for DreamNet cold-boot verification.
  const liveHash     = mode === "ka" ? createHash("sha256").update(liveCode, "utf8").digest("hex") : null;
  const existingHash = mode === "ka" ? (toml["body-sha256"] ?? "") : null;
  const hashDrift    = liveHash !== null && existingHash !== liveHash;

  if (COMMIT && (drift || hashDrift)) {
    let working: string = content;
    if (drift) {
      const patched = applySourcePatch(working, liveCode);
      if (patched) working = patched;
    }
    if (liveHash !== null) {
      working = applyBodySha256Patch(working, liveHash);
    }
    writeFileSync(mdPath, working, "utf8");

    const parts: string[] = [];
    if (drift)     parts.push(`source: ${drift}`);
    if (hashDrift) parts.push(existingHash ? "body-sha256 updated" : "body-sha256 added");
    console.log(`[heleuma/${mode}] patched  ${uri} (${srcSym}): ${parts.join("; ")}`);
    totalPatched++;
  } else if (!COMMIT && drift) {
    console.warn(`[heleuma/${mode}] DRIFT  ${uri} (${srcSym}): ${drift}`);
    console.warn(`           live: ${resolve(root, srcFile)}`);
    totalDrift++;
  } else {
    console.log(`[heleuma/${mode}] ok   ${uri} (${srcSym})`);
  }

  if (!COMMIT && mode === "ka" && hashDrift) {
    console.log(`[heleuma/ka] body-sha256 ${existingHash ? "stale" : "missing"}  ${uri}`);
  }
}

if (COMMIT) {
  console.log(`\n[heleuma] checked ${totalChecked} — patched ${totalPatched}, missing ${totalMissing}`);
} else {
  console.log(`\n[heleuma] checked ${totalChecked} — ${totalDrift} drift, ${totalMissing} missing`);
  if (totalDrift > 0 || totalMissing > 0) {
    console.warn("[heleuma] run with --commit to patch #source slots");
  }
}
