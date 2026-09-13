#!/usr/bin/env node
/**
 * hearths-gate — refuse a commit that reaches into ANOTHER hearth's ground.
 *
 * One tree, several sessions. `bags/lares/ha.ka.ba/lares/docs/pono/hearths.mem#/holds` names, per hearth,
 * the repo-relative globs that hearth holds, keyed by the `Claude-Session:` trailer its commits carry. This
 * gate reads the ledger, reads the trailer off the commit message git is about to write, and refuses when
 * the staged paths cross into a hold the committing hearth does not own — printing the row so the hand
 * reads WHOSE ground it stands on and what that hearth owes.
 *
 * A COMMIT WITH NO TRAILER PASSES, with a note. The operator's own commits carry none, and a gate that
 * refuses the operator on their own tree reads as an outage, never a safeguard.
 *
 * A path no hold names belongs to no hearth and passes silently. A path TWO hearths claim reads as a
 * crossing already in flight, and the gate says so rather than picking a winner.
 *
 * `git commit --no-verify` remains the override; a crossing taken deliberately wants a row under
 * `#/crossings` in the same ledger, which is the ledger's own law.
 *
 *   install:  git config core.hooksPath .githooks     (`.githooks/commit-msg` runs this)
 *   witness:  tools/hearths-gate-witness.sh
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/hearths
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const LEDGER = "bags/lares/ha.ka.ba/lares/docs/pono/hearths.mem";

/** The `holds` fence, read as rows. Deliberately narrow: `[[hold]]` tables of scalar strings plus one
 *  `globs` array. A shape the fence does not carry reads as no rows, which fails OPEN with a note — a
 *  ledger this gate cannot parse must not block a tree. */
export function parseHolds(text) {
  const fence = /```toml holds\n([\s\S]*?)\n```/.exec(text);
  if (!fence) return [];
  const rows = [];
  let cur = null;
  let inGlobs = false;
  for (const raw of fence[1].split("\n")) {
    const line = raw.trim();
    if (line === "[[hold]]") { cur = { hearth: "", trailer: "", globs: [] }; rows.push(cur); inGlobs = false; continue; }
    if (!cur) continue;
    if (inGlobs) {
      if (line.startsWith("]")) { inGlobs = false; continue; }
      const g = /^"([^"]+)"/.exec(line);
      if (g) cur.globs.push(g[1]);
      continue;
    }
    const kv = /^(\w+)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, rest] = kv;
    if (key === "globs") {
      if (rest.startsWith("[") && !rest.includes("]")) { inGlobs = true; continue; }
      for (const m of rest.matchAll(/"([^"]+)"/g)) cur.globs.push(m[1]);
      continue;
    }
    const s = /^"([^"]*)"/.exec(rest);
    if (s && (key === "hearth" || key === "trailer")) cur[key] = s[1];
  }
  return rows.filter((r) => r.trailer && r.globs.length > 0);
}

/** A repo-relative glob → a regex over the whole path. `**` crosses separators, `*` never does, and a
 *  trailing bare name matches that path and everything beneath it (a submodule reads as one entry). */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { out += "[^]*"; i += 1; if (glob[i + 1] === "/") i += 1; }
      else out += "[^/]*";
      continue;
    }
    out += /[.+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${out}(?:/[^]*)?$`);
}

/** The hearths a path stands on. */
export function hearthsOf(path, rows) {
  return rows.filter((r) => r.globs.some((g) => globToRegExp(g).test(path)));
}

/** The `session_…` name a commit message's `Claude-Session:` trailer carries, or "". */
export function trailerOf(message) {
  const m = /Claude-Session:.*?(session_[A-Za-z0-9]+)/.exec(message);
  return m ? m[1] : "";
}

export function verdict({ message, paths, ledger }) {
  const rows = parseHolds(ledger);
  if (rows.length === 0) return { ok: true, note: `no \`holds\` rows parsed from ${LEDGER} — the gate stands down` };
  const trailer = trailerOf(message);
  if (!trailer) return { ok: true, note: "no `Claude-Session:` trailer — the gate passes it (an operator's own commit carries none)" };
  const mine = rows.find((r) => r.trailer === trailer);
  const crossings = [];
  for (const p of paths) {
    for (const r of hearthsOf(p, rows)) {
      if (r.trailer !== trailer) crossings.push({ path: p, row: r });
    }
  }
  if (crossings.length === 0) {
    return { ok: true, note: `${paths.length} path(s) stand on ${mine ? `\`${mine.hearth}\`` : "no other hearth's"} ground` };
  }
  return { ok: false, trailer, mine, crossings };
}

function main() {
  const msgFile = process.argv[2];
  if (!msgFile) { console.error("usage: hearths-gate.mjs <commit-message-file>"); return 2; }
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  let ledger = "";
  try { ledger = readFileSync(join(root, LEDGER), "utf8"); }
  catch { console.log(`[hearths-gate] no ledger at ${LEDGER} — the gate stands down`); return 0; }
  const message = readFileSync(msgFile, "utf8");
  const paths = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd: root, encoding: "utf8" })
    .split("\n").map((l) => l.trim()).filter(Boolean);
  if (paths.length === 0) return 0;

  const v = verdict({ message, paths, ledger });
  if (v.ok) { console.log(`[hearths-gate] ${v.note}`); return 0; }

  const byRow = new Map();
  for (const c of v.crossings) {
    const k = c.row.trailer;
    if (!byRow.has(k)) byRow.set(k, { row: c.row, paths: [] });
    byRow.get(k).paths.push(c.path);
  }
  console.error(`[hearths-gate] REFUSED — this commit (${v.trailer}) reaches into another hearth's ground:`);
  for (const { row, paths: ps } of byRow.values()) {
    console.error(`\n  ${row.hearth}  (${row.trailer})`);
    for (const p of ps) console.error(`    ${p}`);
  }
  console.error(`\n  The ledger's law: a seam crossed between hearths gets a row under \`#/crossings\` in`);
  console.error(`  ${LEDGER} BEFORE the hand starts. Write the row, or hand the`);
  console.error(`  paths back to the hearth that holds them. \`--no-verify\` overrides.`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
