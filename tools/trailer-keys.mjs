#!/usr/bin/env node
// trailer-keys — every trailer key a range's lane commits carry belongs to the closed set.
//
//   node tools/trailer-keys.mjs <from>..<to>
//
// The change record rides in lane-commit trailers (lar:///ha.ka.ba/kahua/memory/research/record-as-projection), so a
// misspelt key drops a note silently: `Braking:` renders nowhere. This check reads each non-merge commit of the range
// through git's own trailer parser (`%(trailers:only,unfold)`, never a grep: a key-shaped line mid-body is no trailer),
// matches each key case-insensitively as git does, and names any key outside the set with the nearest known key.
// Merge commits stay out: the lane commits carry the record, and tools/changelog-render.mjs owns the merge-commit rule.
//
// Exit 0 clean · 1 an unknown key · 2 usage or git refused.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The closed set, in canonical spelling: the four record keys, then the attribution keys already in honest use. */
export const KNOWN_KEYS = Object.freeze(["Breaking", "Changed", "Amends", "Co-Authored-By", "Claude-Session", "Signed-off-by"]);

const BY_LOWER = new Map(KNOWN_KEYS.map((k) => [k.toLowerCase(), k]));

/** The canonical spelling of a known key, matched case-insensitively; null for a key outside the set. */
export const canonicalKey = (key) => BY_LOWER.get(String(key).trim().toLowerCase()) ?? null;

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const here = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = here;
    }
  }
  return row[b.length];
}

/** The known key nearest a misspelling (edit distance, case-insensitive; the set's order breaks a tie). */
export function nearestKey(key) {
  const lower = String(key).toLowerCase();
  let best = KNOWN_KEYS[0];
  let bestD = Infinity;
  for (const k of KNOWN_KEYS) {
    const d = distance(lower, k.toLowerCase());
    if (d < bestD) { best = k; bestD = d; }
  }
  return best;
}

export const isRange = (arg) => typeof arg === "string" && /^[^.\s][^\s]*\.\.[^.\s][^\s]*$/.test(arg) && !arg.includes("...");

const RS = "\x1e";
const US = "\x1f";
const GS = "\x1d";

/**
 * Each commit git's log answers for `args`, with its trailers as `{ key, value }` read through git's own parser. The
 * separators ride as control bytes, so neither a colon in a value nor a newline in a body can split a record wrongly.
 */
export function commitsWithTrailers(args, { cwd } = {}) {
  const format = `%H${US}%P${US}%(trailers:only,unfold,separator=${GS},key_value_separator=${US})${US}%B${RS}`;
  const r = spawnSync("git", ["log", `--format=${format}`, ...args], { cwd, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git log ${args.join(" ")} refused: ${r.stderr.trim()}`);
  return r.stdout.split(RS).map((s) => s.replace(/^\n/, "")).filter((s) => s.length > 0).map((rec) => {
    const [sha, parents, ...rest] = rec.split(US);
    // The trailer block holds pairs joined by GS, each pair `key US value`; the body follows the block's last US.
    const trailerBlock = rest.slice(0, -1).join(US);
    const body = rest[rest.length - 1];
    const trailers = trailerBlock === "" ? [] : trailerBlock.split(GS).map((pair) => {
      const at = pair.indexOf(US);
      return { key: pair.slice(0, at).trim(), value: pair.slice(at + 1).trim() };
    });
    return { sha, parents: parents.split(" ").filter(Boolean), trailers, body };
  });
}

/** The unknown keys of a range's non-merge commits, and the case variants of known keys (named, never red). */
export function checkRange(range, { cwd } = {}) {
  const unknown = [];
  const variants = [];
  for (const c of commitsWithTrailers(["--no-merges", range], { cwd })) {
    for (const { key } of c.trailers) {
      const canon = canonicalKey(key);
      if (canon === null) unknown.push({ sha: c.sha, key, nearest: nearestKey(key) });
      else if (canon !== key) variants.push({ sha: c.sha, key, canonical: canon });
    }
  }
  return { unknown, variants };
}

function main(argv) {
  const [range, ...extra] = argv;
  if (!isRange(range) || extra.length > 0) {
    console.error("usage: node tools/trailer-keys.mjs <from>..<to>");
    return 2;
  }
  let result;
  try {
    result = checkRange(range);
  } catch (e) {
    console.error(`trailer-keys: ${e.message}`);
    return 2;
  }
  for (const v of result.variants) console.log(`trailer-keys: ${v.sha.slice(0, 9)} spells '${v.key}'; the canonical spelling reads '${v.canonical}'`);
  for (const u of result.unknown) console.error(`trailer-keys: ${u.sha.slice(0, 9)} carries the unknown trailer key '${u.key}' (nearest known key: ${u.nearest})`);
  if (result.unknown.length > 0) {
    console.error(`trailer-keys: ${result.unknown.length} unknown key(s) in ${range}; the known set reads ${KNOWN_KEYS.join(", ")}`);
    return 1;
  }
  console.log(`trailer-keys: every trailer key in ${range} names a known key`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
