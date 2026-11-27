#!/usr/bin/env node
/**
 * floor-owes — the HOST's hand on the floor's ticket rule (research/corpus-seams). The rule itself (seams, guards, trunk and
 * hub escalations, the refusal of a path in no seam) runs in the wiki VM, in the `floor-owes` filter operator
 * (`packages/lararium-tw5/src/filters/floor-owes.ts`, its pure core `src/floor-owes.ts`) over the seam table (`lar:///ha.ka.ba/lararium/tw5/floor/seams`).
 * This tool reads a checkout, which stays a host-process act, and hands the fold FACTS alone: it holds no seam, no
 * threshold and no second fold.
 *
 *   node tools/floor-owes.mjs [<head-ref>] [--base <ref>]     the owed set of `<base>...<head>` (HEAD over origin/develop)
 *   node tools/floor-owes.mjs --census                        the witness: every tracked path placed, every vessel file declared
 *
 * ── THE FACTS ────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   TOUCH <path>                   `git diff --name-only --no-renames <base>...<head>`
 *   GONE <path>                    a touched path absent from the head's tree
 *   EDGE <test> <path> [secs=<n>]  a test file at the head naming a touched path at depth one: an import, a `dist/` path read
 *                                  as `src/`, an `@lararium/<pkg>/<sub>` specifier, any quoted path that resolves to it (one
 *                                  `git grep` over the head's test files); `secs` from `tools/unit-weights.json`
 *   UNREAD <what>                  a read that refused (diff, tree, edges, weights): the fold owes MORE for it, never less
 *
 * ── THE ASK ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Through the filter door first: `lares get filter='[[<seam table>]floor-owes[runs],[<facts, percent-encoded>]]'
 * all=true`. The answer's header row (`OWES facts=<n> table=<sha256> …`) must carry the count of fact lines
 * sent; a door that answers nothing, another leading row or another count reads as a dark door (a wiki holding no such
 * operator answers an empty list, never an error). THE TABLE CHECKSUM: the header's `table=` must equal the digest of
 * DEVELOP'S OWN seam table (`git show origin/develop:<the table>`); a door folding another table (a vessel standing on
 * another plugin, a working-layer override) answers `dark` outright, and the gate fails wide, never narrow. Dark doors, or facts too long for one ask: the fold's source and the seam
 * table come out of DEVELOP'S git objects (`refs/remotes/origin/develop`, never the lane's tree and never the bench's files)
 * and run in a child node, as the security-class judge runs its matcher. Where that fails too the answer reads `dark`, and
 * the bench gate fails wide (the heavy tier of every touched package plus the whole node e2e set).
 *
 * The census reads the CHECKOUT'S OWN table and fold: it judges whether this tree's map still covers this tree.
 *
 * LARES_BIN names another `lares`. Exit: 0 an owed set (or a clean census) · 1 a refusal, a dark answer or a census
 * finding · 2 usage.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gitAt } from "./cold-read-owed.mjs";
import { laresCommand } from "./floor-ledger.mjs";

const HERE = fileURLToPath(import.meta.url);
export const ROOT = resolve(dirname(HERE), "..");
export const FOLD = "packages/lararium-tw5/src/floor-owes.ts";
export const TABLE = "packages/lararium-tw5/tiddlers-lararium/floor-seams.tid";
export const SEAMS = "lar:///ha.ka.ba/lararium/tw5/floor/seams";
export const DEVELOP = "refs/remotes/origin/develop";
export const WEIGHTS = "tools/unit-weights.json";
/** One door ask rides one argv word; Linux holds a word under 128 KiB, so longer facts go to develop's fold. */
export const DOOR_ASK_BYTES = 96_000;

const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();
const whyOf = (e) => oneLine(e instanceof Error ? e.message : e);
const enc = (path) => path.replace(/[%\s]/g, (c) => encodeURIComponent(c));
const dec = (word) => { try { return decodeURIComponent(word); } catch { return word; } };

/** A `.tid` file's text field: everything past the header's blank line. */
export function tidText(bytes) {
  const s = String(bytes);
  const cut = s.search(/\r?\n\r?\n/);
  return cut < 0 ? "" : s.slice(cut).replace(/^(\r?\n){2}/, "");
}

const TEST_SPECS = ["*.test.ts", "*.test.tsx", "*.test.mts", "*.test.cts", "*.test.js", "*.test.jsx", "*.test.mjs", "*.test.cjs"];
const PATHISH = "(\\.\\.?/|@lararium/|@lares/|packages/|tools/|tests/)";
const LITERAL = /(['"`])((?:\.\.?\/|@lararium\/|@lares\/|packages\/|tools\/|tests\/)[^'"`\n]*)\1/g;
const CODE_EXT = /\.(?:d\.ts|[cm]?[jt]sx?)$/;

/** The repo path a quoted word in test file `from` names, or null where it leaves the tree. */
export function resolveLiteral(from, literal) {
  const word = literal.replace(/[?#].*$/, "");
  let p;
  if (word.startsWith("./") || word.startsWith("../")) p = posix.normalize(posix.join(posix.dirname(from), word));
  else if (word.startsWith("@lararium/")) { const [, pkg, ...sub] = word.split("/"); p = `packages/lararium-${pkg}/src/${sub.length ? sub.join("/") : "index"}`; }
  else if (word.startsWith("@lares/")) { const [, pkg, ...sub] = word.split("/"); p = pkg === "harness" ? `tests/${sub.join("/") || "harness"}` : `packages/lares-${pkg}/src/${sub.length ? sub.join("/") : "index"}`; }
  else p = posix.normalize(word);
  if (p.startsWith("../") || p === "..") return null;
  return p.replace(/\/+$/, "").replace(/\/dist\/src\//, "/src/").replace(/\/dist\//, "/src/");
}

/** The words a touched path answers to: itself, itself without a code extension, and its directory where it stands as an index. */
export function keysOf(path) {
  const keys = [path];
  if (CODE_EXT.test(path)) {
    const bare = path.replace(CODE_EXT, "");
    keys.push(bare);
    if (bare.endsWith("/index")) keys.push(bare.slice(0, -"/index".length));
  }
  return keys;
}

/** The depth-one edges a `git grep -z` answer holds: [test, touched] pairs, each once, sorted. `prefix` names the tree-ish the grep read. */
export function edgesOf(grepOut, touched, prefix = "") {
  const byKey = new Map();
  for (const t of touched) for (const k of keysOf(t)) (byKey.get(k) ?? byKey.set(k, new Set()).get(k)).add(t);
  const seen = new Set();
  const edges = [];
  for (const record of String(grepOut).split("\n")) {
    const nul = record.indexOf("\0");
    if (nul < 0) continue;
    let test = record.slice(0, nul);
    if (prefix && test.startsWith(`${prefix}:`)) test = test.slice(prefix.length + 1);
    for (const m of record.slice(nul + 1).matchAll(LITERAL)) {
      const p = resolveLiteral(test, m[2]);
      if (p === null) continue;
      for (const k of [p, p.replace(CODE_EXT, "")]) {
        for (const t of byKey.get(k) ?? []) {
          if (t === test || seen.has(`${test}\0${t}`)) continue;
          seen.add(`${test}\0${t}`);
          edges.push([test, t]);
        }
      }
    }
  }
  return edges.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
}

/** A test file's measured seconds off the weights table (`{ <package dir>: { <file under it>: seconds } }`), or undefined. */
export function secsOf(weights, test) {
  let best;
  for (const dir of Object.keys(weights ?? {})) {
    if (dir.startsWith("_") || !test.startsWith(`${dir}/`)) continue;
    if (best === undefined || dir.length > best.length) best = dir;
  }
  const secs = best === undefined ? undefined : weights[best]?.[test.slice(best.length + 1)];
  return Number.isFinite(secs) ? secs : undefined;
}

/**
 * THE FACTS of `<base>...<head>` as the fold's lines. Every read that refuses lands as an UNREAD line; nothing here throws.
 * `paths` names the touched paths outright (a replay of a landed merge), in the diff's place.
 */
export function gatherFacts({ root = ROOT, base = DEVELOP, head = "HEAD", git = gitAt(root), paths, weights } = {}) {
  const lines = [];
  const unread = (what) => { lines.push(`UNREAD ${what}`); };
  let touched = [];
  let headSha = "";
  try { headSha = String(git(["rev-parse", "--verify", "--end-of-options", `${head}^{commit}`])).trim(); } catch { unread("head"); }
  if (paths) touched = [...new Set(paths)].sort();
  else if (headSha) {
    try {
      const baseSha = String(git(["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`])).trim();
      touched = [...new Set(String(git(["diff", "--name-only", "--no-renames", "-z", `${baseSha}...${headSha}`])).split("\0").filter(Boolean))].sort();
    } catch { unread("diff"); }
  }
  for (const p of touched) lines.push(`TOUCH ${enc(p)}`);
  if (!headSha) return { lines, touched, head: headSha };

  try {
    const tree = new Set(String(git(["ls-tree", "-r", "--name-only", "-z", headSha])).split("\0").filter(Boolean));
    for (const p of touched) if (!tree.has(p)) lines.push(`GONE ${enc(p)}`);
  } catch { unread("tree"); }

  let table = weights;
  if (table === undefined) {
    try { table = JSON.parse(readFileSync(join(root, WEIGHTS), "utf8")); } catch { table = {}; unread("weights"); }
  }
  if (touched.length > 0) {
    const grep = git(["grep", "-z", "-I", "-E", "-e", `['"\`]${PATHISH}`, headSha, "--", ...TEST_SPECS], { raw: true });
    // `git grep` exits 1 where no line matches: a tree with no test naming any path, which reads as zero edges.
    if (grep.status !== 0 && grep.status !== 1) unread("edges");
    else {
      for (const [test, path] of edgesOf(grep.stdout, touched, headSha)) {
        const secs = secsOf(table, test);
        lines.push(`EDGE ${enc(test)} ${enc(path)}${secs === undefined ? "" : ` secs=${secs}`}`);
      }
    }
  }
  return { lines, touched, head: headSha };
}

const RUNNER = 'try { const { floorOwesRows } = await import(process.argv[1]); process.stdin.setEncoding("utf8"); let b = ""; for await (const c of process.stdin) b += c; const { text, view } = JSON.parse(b); process.stdout.write(JSON.stringify(floorOwesRows(text, view))); } catch (e) { process.stderr.write("\\n" + String(e && e.message ? e.message : e)); process.exitCode = 1; }';

/** The fold over `text`, in a child node: `source` (the pure core's TypeScript, importing nothing) lands in a private temp dir and loads from there. */
export function runFold(source, text, view = "runs") {
  const dir = mkdtempSync(join(tmpdir(), "floor-owes-"));
  try {
    const file = join(dir, "floor-owes.mts");
    writeFileSync(file, source);
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", RUNNER, pathToFileURL(file).href], { encoding: "utf8", input: JSON.stringify({ text, view }), maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`the fold would not run: ${oneLine(String(r.stderr || r.error?.message || `exit ${r.status}`).trim().split("\n").at(-1))}`);
    const rows = JSON.parse(r.stdout);
    if (!Array.isArray(rows) || rows.some((row) => typeof row !== "string")) throw new Error("the fold answered something other than rows");
    return rows;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** The fold and seam table as commit `ref` holds them, out of git objects. Throws a why on any gap. */
export function judgeOn(git, ref = DEVELOP) {
  const sha = String(git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])).trim();
  const short = sha.slice(0, 9);
  const blob = (path) => { try { return git(["cat-file", "blob", `${sha}:${path}`]); } catch { throw new Error(`${ref} (${short}) holds no ${path}; land the floor-owes fold on develop first`); } };
  return { short, fold: blob(FOLD), table: tidText(blob(TABLE)) };
}

/** The fold and seam table as the CHECKOUT's own files hold them: the census reads these, and the fold's own tests; a ticket never does. */
export function checkoutJudge(root = ROOT) {
  return { short: "checkout", fold: readFileSync(join(root, FOLD)), table: tidText(readFileSync(join(root, TABLE))) };
}

/** The digest a seam table names itself by, as the fold computes it: SHA-256 over its non-blank lines, trimmed, newline-joined. */
export function tableDigest(table) {
  return createHash("sha256").update(String(table).split("\n").map((l) => l.trim()).filter(Boolean).join("\n")).digest("hex");
}

/** The filter one door ask runs. */
export const askFilter = (view, facts) => `[[${SEAMS}]floor-owes[${view}],[${encodeURIComponent(facts)}]]`;

function filterDoor(filter, { env = process.env } = {}) {
  const [cmd, lead] = laresCommand(env);
  const r = spawnSync(cmd, [...lead, "get", `filter=${filter}`, "all=true"], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"], timeout: 120_000, maxBuffer: 1 << 28 });
  return { ok: r.status === 0 && !r.error, stdout: r.stdout ?? "", why: oneLine((r.error?.message || r.stderr || `exit ${r.status}`).trim().split("\n")[0]) };
}

/** Ask the VM one view through the filter door: { rows } where it answered, { rows: null, why } where it stands dark. */
export function askDoor(view, facts, { env = process.env, door = (filter) => filterDoor(filter, { env }) } = {}) {
  const filter = askFilter(view, facts);
  if (Buffer.byteLength(filter) > DOOR_ASK_BYTES) return { rows: null, why: `the facts run ${Buffer.byteLength(filter)} bytes, past one door ask (${DOOR_ASK_BYTES})` };
  const r = door(filter);
  if (!r.ok) return { rows: null, why: r.why || "the filter door refused" };
  try {
    const titles = JSON.parse(r.stdout)?.data?.titles;
    if (!Array.isArray(titles) || titles.some((t) => typeof t !== "string")) return { rows: null, why: "the filter door answered no title list" };
    return { rows: titles };
  } catch { return { rows: null, why: "the filter door answered no JSON" }; }
}

/** True where `rows` lead with the fold's header and, for an owed set, the header counts exactly the fact lines sent. */
export function headerHolds(rows, sent, word = "OWES") {
  const head = String(rows?.[0] ?? "").split(/\s+/);
  if (head[0] !== word) return false;
  return word === "OWES" ? head.includes(`facts=${sent}`) : head.some((w) => w.startsWith("files="));
}

/** The table digest an answer's header carries (`table=<sha256>`), or the empty string. */
export const tableOf = (rows) => String(rows?.[0] ?? "").split(/\s+/).find((w) => w.startsWith("table="))?.slice("table=".length) ?? "";

/** The rows as the gate reads them: refusals, sets, globs and files, each with its why. */
export function parseRows(rows) {
  const out = { refuse: [], sets: [], globs: [], files: [] };
  for (const row of rows.slice(1)) {
    const dot = row.indexOf(" · ");
    const [verb, ...words] = (dot < 0 ? row : row.slice(0, dot)).split(/\s+/);
    const why = dot < 0 ? "" : row.slice(dot + 3);
    if (verb === "REFUSE" && words[0]) out.refuse.push({ path: dec(words[0]), why });
    else if (verb === "SET" && words[0]) out.sets.push({ name: words[0], why });
    else if (verb === "GLOB" && words[0]) out.globs.push({ glob: dec(words[0]), why });
    else if (verb === "FILE" && words[1]) out.files.push({ tier: words[0], path: dec(words[1]), why });
    else throw new Error(`the fold answered a row this host reads as nothing: "${row.slice(0, 80)}"`);
  }
  return out;
}

/** The receipt: SHA-256 over the sorted owed set (refusals, sets, globs, files by path; tiers and reasons aside). */
export function owedDigest({ refuse, sets, globs, files }) {
  const words = [...refuse.map((r) => `REFUSE ${r.path}`), ...sets.map((s) => `SET ${s.name}`), ...globs.map((g) => `GLOB ${g.glob}`), ...files.map((f) => `FILE ${f.path}`)].sort();
  return createHash("sha256").update(words.join("\0")).digest("hex");
}

/**
 * THE OWED SET of `<base>...<head>`: { via, why, touched, refuse, sets, globs, files, digest }. `via` reads `door`,
 * `develop <sha>` or `dark` (nothing could answer: the lists stand empty and the gate fails wide). Nothing here throws.
 */
export function owes({ root = ROOT, base = DEVELOP, head = "HEAD", git = gitAt(root), env = process.env, door, fold = runFold, judge = judgeOn, paths, weights } = {}) {
  const facts = gatherFacts({ root, base, head, git, paths, weights });
  const text = facts.lines.join("\n");
  const sent = new Set(facts.lines).size;
  const answer = (via, rows, why = "") => { const parsed = parseRows(rows); return { via, why, touched: facts.touched, ...parsed, digest: owedDigest(parsed) }; };
  const dark = (why) => ({ via: "dark", why, touched: facts.touched, refuse: [], sets: [], globs: [], files: [], digest: "" });
  // DEVELOP'S TREE DECIDES: its fold and its table stand first, and its table's digest holds every answer, the door's included.
  let j, want;
  try { j = judge(git, base); want = tableDigest(j.table); } catch (e) { return dark(`develop: ${whyOf(e)}`); }
  const asked = askDoor("runs", text, { env, ...(door ? { door } : {}) });
  let doorWhy = asked.why ?? "";
  if (asked.rows) {
    if (headerHolds(asked.rows, sent)) {
      if (tableOf(asked.rows) !== want) return dark(`door: the wiki folds the seam table ${tableOf(asked.rows).slice(0, 12) || "(unnamed)"}, where develop ${j.short} holds ${want.slice(0, 12)}; bring the vessel onto develop's plugin (or drop the working-layer override of ${SEAMS}), then ask again`);
      try { return answer("door", asked.rows); } catch (e) { doorWhy = whyOf(e); }
    } else doorWhy = `the door's answer leads with "${String(asked.rows[0] ?? "").slice(0, 60)}", where \`OWES facts=${sent}\` leads the fold's own`;
  }
  try {
    const rows = fold(j.fold, `${j.table}\n${text}`, "runs");
    if (!headerHolds(rows, sent) || tableOf(rows) !== want) throw new Error(`develop's fold leads with "${String(rows[0] ?? "").slice(0, 60)}", where \`OWES facts=${sent} table=${want.slice(0, 12)}…\` leads this host's read`);
    return answer(`develop ${j.short}`, rows, doorWhy);
  } catch (e) {
    return dark(`${doorWhy ? `door: ${doorWhy}; ` : ""}develop: ${whyOf(e)}`);
  }
}

/** The lines a familiar reads for one owed set. */
export function lines(r) {
  const out = [`floor-owes: via ${r.via}${r.why ? ` (${r.why})` : ""} · touched ${r.touched.length}`];
  for (const x of r.refuse) out.push(`REFUSE ${x.path} · ${x.why}`);
  for (const s of r.sets) out.push(`SET ${s.name} · ${s.why}`);
  for (const g of r.globs) out.push(`GLOB ${g.glob} · ${g.why}`);
  for (const f of r.files) out.push(`FILE ${f.tier} ${f.path} · ${f.why}`);
  out.push(r.via === "dark" ? "owes=dark (the gate fails wide: the touched packages' heavy tier and the whole node e2e set)" : `owes=${r.digest}`);
  return out;
}

/**
 * THE CENSUS over a checkout, by its own table and fold: { clean, rows, why }. Every tracked path rides as a TOUCH; the fold
 * answers the paths no row places (UNMAPPED), the vessel-tier files no seam declares (UNDECLARED) and the guards naming
 * nothing (DEAD). A census that cannot run reads unclean.
 */
export function census({ root = ROOT, git = gitAt(root), fold = runFold } = {}) {
  try {
    const tree = String(git(["ls-files", "-z"])).split("\0").filter(Boolean);
    const own = checkoutJudge(root);
    const rows = fold(own.fold, `${own.table}\n${tree.map((p) => `TOUCH ${enc(p)}`).join("\n")}`, "census");
    if (!headerHolds(rows, 0, "CENSUS")) throw new Error(`the fold leads with "${String(rows[0] ?? "").slice(0, 60)}", where a CENSUS header leads this host's read`);
    return { clean: rows.length === 1, rows, why: "" };
  } catch (e) { return { clean: false, rows: [], why: whyOf(e) }; }
}

const asMain = () => { try { return realpathSync(process.argv[1]) === realpathSync(HERE); } catch { return false; } };
if (process.argv[1] && asMain()) {
  const args = process.argv.slice(2);
  const usage = () => { console.error("usage: floor-owes.mjs [<head-ref>] [--base <ref>]  |  floor-owes.mjs --census"); process.exit(2); };
  if (args.includes("--census")) {
    if (args.length !== 1) usage();
    const c = census();
    if (c.why) { console.error(`floor-owes: the census could not run: ${c.why}`); process.exit(1); }
    for (const row of c.rows) console.log(row);
    if (c.clean) { console.log("floor-owes: every tracked path stands placed, every vessel file declared"); process.exit(0); }
    console.error("floor-owes: cure each row in packages/lararium-tw5/tiddlers-lararium/floor-seams.tid: an UNMAPPED path takes a MOVES row (or FREE, or CONFIG), an UNDECLARED file a GUARDS row on the seam it walks, a DEAD row leaves or names a file the tree holds; then: node tools/floor-owes.mjs --census");
    process.exit(1);
  }
  const at = args.indexOf("--base");
  const base = at < 0 ? undefined : args.splice(at, 2)[1];
  if ((at >= 0 && !base) || args.some((a) => a.startsWith("--")) || args.length > 1) usage();
  const r = owes({ head: args[0] ?? "HEAD", ...(base ? { base } : {}) });
  for (const l of lines(r)) console.log(l);
  process.exit(r.via === "dark" || r.refuse.length > 0 ? 1 : 0);
}
