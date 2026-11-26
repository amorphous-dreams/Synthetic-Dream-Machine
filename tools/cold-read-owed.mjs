#!/usr/bin/env node
/**
 * cold-read-owed — WHICH PATHS OF A LANE'S MERGE OWE A COLD READ, judged from the base's own tree, never the lane's.
 *
 *   node tools/cold-read-owed.mjs <lane-ref> [--base <ref>]                    (the read, before the merge)
 *   node tools/cold-read-owed.mjs --check-merge <merge> [<head-sha>] [--base <ref>]   (the re-judging, after it, before the push)
 *
 * The familiar runs both FROM THE LANDING BENCH (a worktree standing at develop). The judge never rides the lane: this file,
 * the list and the matcher all come from the base.
 *
 * ── THE READ ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. PIN ONCE. `git rev-parse` names the base (`refs/remotes/origin/develop`), the bench's HEAD and the lane head, each one
 *      time. Every later read names those shas, so a ref or a HEAD that moves afterwards changes nothing here.
 *   2. THE BENCH STANDS AT THE BASE. A HEAD that differs from the base refuses (a lane worktree's HEAD reads as the lane, and
 *      a lane judged against itself owes nothing); `--base <ref>` names another base (any ref) on the caller's own word and skips that
 *      one check; a base other than `refs/remotes/origin/develop` still reads and prints its verdict, marks the record line
 *      `base≠origin/develop` and prints no `land:` line, so a typed base never hands the familiar a land command. A lane head equal to the base refuses too: nothing stands there to merge.
 *   3. THE JUDGE STANDS ON THE BASE. The running file's bytes equal `<base>:tools/cold-read-owed.mjs` or the read lands
 *      unread; the list (`<base>:tools/security-class-paths.json`) and the matcher
 *      (`<base>:packages/lararium-tw5/src/filters/security-class.ts`) come out of the base's git objects, so neither a dirty
 *      bench file nor anything in the lane's tree reaches the verdict.
 *   4. THE MERGE DELTA, never the two trees. `git merge-tree --write-tree <base> <lane>` (git 2.38 or later) writes the tree
 *      the merge itself would make, and `git diff-tree -r --no-renames --ignore-submodules=none --raw -z <base> <that tree>`
 *      names the paths the landing would change ON THE BASE: the class reads that set alone. A lane standing behind develop
 *      owes nothing for what develop changed since the fork (the merge keeps develop's bytes there, and those paths owed
 *      their read when they landed); a path the lane itself changed owes; a path a third branch carried into the lane by a
 *      merge owes until that branch lands on develop by its own read; a file the merge places where neither tree holds it
 *      (a directory renamed on one side carries the other side's new file along) owes too, since the delta reads the merged
 *      tree. The lane's tree never diffs against the base's directly: that two-tree read counted develop's own landings
 *      against every lane forked before them, and a judge that cries custody at a lane which never touched it trains the
 *      hand to land through the cry. Git's merge picks the ancestry (the merge base, or its recursive stand-in for several);
 *      the judge picks none. A merge-tree that conflicts answers unread: the familiar resolves by hand, and the re-judging
 *      below reads what the hand made, by the same rule (first parent against the merge's own tree).
 *   5. THE MATCHER RUNS IN A CHILD NODE, its source written from the base's object to a temp dir (Node strips the types). No
 *      daemon and no wiki door stand on this path. The ask always carries the SENTINEL (the list's own path, which the list
 *      always owes); an answer lacking it reads unread.
 * It prints, and exits 0 either way:
 *   COLD READ OWED: <paths>            or            cold read: none owed
 *   cold-read: owed|none · head <sha> · base <sha> · list <sha256> · paths <n> · record-hash <sha256>
 *   land: git merge --no-ff <head sha> ...        (ONLY where the read answers none owed; the pinned sha, never the branch
 *                                                  name: a branch can move after the read)
 *   read first: ... git merge --no-ff <head sha> ...   (in its place wherever the read answers owed or unread: the cold
 *                                                  read files first; no line of an owed answer starts with `land:`)
 * The record hash covers the head, the base, the list's sha256, then each owed path, NUL-joined (git refuses a NUL in a path,
 * so no two paths join into one). The familiar files its cold Opus read under that hash and the merge message carries
 * `Cold-Read: <hash>`.
 *
 * ── THE RE-JUDGING (`--check-merge <merge>`) ──────────────────────────────────────────────────────────────────────────────
 * The read judged a merge that had not happened; this judges the one that did. It refuses (unread) unless the merge holds
 * exactly two parents, its first parent equals the base (`refs/remotes/origin/develop`, still unpushed, or `--base`), and its
 * second parent stands as the head the read pinned: the `<head-sha>` argument where given, otherwise the merge message's
 * `Cold-Read: <hash>` line must equal the read's record hash recomputed over those two parents (a lane pushed after the
 * read lands another head, so another hash). It then diffs the first parent against THE MERGE'S OWN TREE, matches with
 * the first parent's list and matcher, and prints:
 *   COLD READ OWED: <paths>            or            cold read: none owed
 *   cold-read: owed|none · merge <sha> · head <sha> · base <sha> · list <sha256> · paths <n> · record-hash <sha256>
 *   cold-read: beyond the read: <paths>           (only where the merge owes a path the read never named: a hand's resolution)
 * Its record hash covers the merge sha in the head's place.
 * What each binding proves: the message's `Cold-Read:` hash proves CONSISTENCY alone (the hash the message quotes matches the
 * read recomputed over the merge's own two parents, so the lane never moved between the read and the merge); anyone can
 * recompute it, so it never proves a judge read happened. The `<head-sha>` form binds the merge to the sha the familiar's
 * own read printed, and that read, with the cold Opus read filed under its hash, carries the witness that a judge read ran.
 *
 * ANY failure to read (no lane ref, a git refusal, a bench off the base, a base holding no judge, no list, no matcher, a
 * malformed list, a matcher that will not run or answers without the sentinel, a conflict, a merge of another shape) prints
 * `COLD READ OWED: (unread: <why>)`: owed, never clean. A usage fault prints that line too and exits 2.
 * It imports node's builtins alone, so the one file carries the whole host side of the judge.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SELF = "tools/cold-read-owed.mjs";
export const LIST = "tools/security-class-paths.json";
export const MATCHER = "packages/lararium-tw5/src/filters/security-class.ts";
export const DEVELOP = "refs/remotes/origin/develop";
export const USAGE = "usage: cold-read-owed.mjs <lane-ref> [--base <ref>]  |  cold-read-owed.mjs --check-merge <merge> [<head-sha>] [--base <ref>]   (run from the landing bench, standing at develop)";
const HERE = fileURLToPath(import.meta.url);
export const ROOT = resolve(dirname(HERE), "..");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();
const lastLine = (r) => oneLine(String(r.stderr || r.error?.message || `exit ${r.status}`).trim().split("\n").at(-1));
const FULL = /^[0-9a-f]{40,64}$/;

/** A git runner bound to `root`: stdout as a Buffer, a throw naming git's own last line on any refusal (`{ raw: true }` hands
 *  back `{ status, stdout }` and throws nothing). No `GIT_*` variable of the caller's shell and no replace ref bends what an
 *  object name reads. */
export function gitAt(root) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  env.GIT_NO_REPLACE_OBJECTS = "1";
  return (args, { raw = false } = {}) => {
    const r = spawnSync("git", ["--no-replace-objects", ...args], { cwd: root, env, maxBuffer: 1 << 28 });
    if (raw) return { status: r.status, stdout: r.stdout ?? Buffer.alloc(0), why: lastLine(r) };
    if (r.status !== 0) throw new Error(`git ${args[0]} refused: ${lastLine(r)}`);
    return r.stdout;
  };
}

/** The paths a `--raw -z` answer names (each record: `:modes shas status NUL path NUL`). */
export function parseRawZ(out) {
  const f = String(out).split("\0");
  const paths = [];
  for (let i = 0; i + 1 < f.length; i += 2) {
    if (!f[i].startsWith(":")) throw new Error("the raw diff carries a record this reader cannot place");
    paths.push(f[i + 1]);
  }
  return paths;
}

/** The record hash: SHA-256 over the head (the merge sha, for a re-judged merge), the base, the list's sha256, then each owed
 *  path, NUL-joined. */
export const recordHash = ({ head, base, listSha, paths }) => sha256([head, base, listSha, ...paths].join("\0"));

const RUNNER = 'try { const { readSecurityClass, securityClassPaths } = await import(process.argv[1]); process.stdin.setEncoding("utf8"); let b = ""; for await (const c of process.stdin) b += c; const { paths, list } = JSON.parse(b); process.stdout.write(JSON.stringify(securityClassPaths(paths, readSecurityClass(list)))); } catch (e) { process.stderr.write("\\n" + String(e && e.message ? e.message : e)); process.exitCode = 1; }';

/** The base's matcher over `paths`, in a child node: `source` lands in a private temp dir and loads from there. */
export function runMatcher(source, paths, list) {
  const dir = mkdtempSync(join(tmpdir(), "cold-read-owed-"));
  try {
    const file = join(dir, "security-class.mts");
    writeFileSync(file, source);
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", RUNNER, pathToFileURL(file).href], { encoding: "utf8", input: JSON.stringify({ paths, list }), maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`the base's matcher would not run: ${lastLine(r)}`);
    return JSON.parse(r.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const commitOf = (git, ref) => {
  const sha = String(git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])).trim();
  if (!FULL.test(sha)) throw new Error("git rev-parse answered no full sha");
  return sha;
};

/** The judge as base `sha` holds it: the running file's bytes checked against the base's, then its list and matcher, all
 *  out of git objects. Throws a why on any gap. */
function judgeOn(git, sha, self) {
  const short = sha.slice(0, 9);
  const blob = (path, absent) => { try { return git(["cat-file", "blob", `${sha}:${path}`]); } catch { throw new Error(absent); } };
  const judge = blob(SELF, `base ${short} holds no ${SELF}, so no judge from the base stands here; land the judge on develop and give this lane its cold read by hand`);
  if (!judge.equals(readFileSync(self))) throw new Error(`this judge's bytes differ from base ${short}'s ${SELF}; run it from the landing bench with a clean tree at develop (a merge that changes the judge itself owes its cold read whole)`);
  const listBytes = blob(LIST, `base ${short} holds no ${LIST}; restore the list on develop`);
  let list;
  try { list = JSON.parse(String(listBytes)); } catch { throw new Error(`base ${short}'s ${LIST} parses as no JSON; cure the list on develop`); }
  const matcher = blob(MATCHER, `base ${short} holds no matcher (${MATCHER}); land the matcher on develop and give this lane its cold read by hand`);
  return { short, list, listSha: sha256(listBytes), matcher };
}

/** The paths at which tree-ish `b` differs from tree-ish `a`: no rename folding, submodule pointers shown. */
const changedBetween = (git, a, b) => parseRawZ(git(["diff-tree", "-r", "--no-renames", "--ignore-submodules=none", "--raw", "-z", "--end-of-options", a, b]));

/** Which of `changed` the class owes, in sorted order, each once. The sentinel rides every ask. */
function owedAmong(changed, judge, match) {
  const paths = [...new Set(changed)].sort();
  const asked = [LIST, ...paths.filter((p) => p !== LIST)];
  const hit = match(judge.matcher, asked, judge.list);
  if (!Array.isArray(hit) || hit.some((p) => typeof p !== "string" || !asked.includes(p))) throw new Error("the base's matcher answered something other than a list of the asked paths");
  if (!hit.includes(LIST)) throw new Error(`the matcher's answer lacks the sentinel: base ${judge.short}'s list no longer owes its own path (${LIST}); restore that row on develop`);
  const held = new Set(hit);
  return paths.filter((p) => held.has(p));
}

const unreadWord = (e) => `(unread: ${oneLine(e instanceof Error ? e.message : e)})`;

/** The read over two pinned shas, past every place check: fills `pin.listSha`, sets `pin.landable` (the judge stood on a
 *  base the familiar lands on; `lines` still withholds the `land:` line from an owed answer), returns the owed paths. */
function readPinned(pin, { git, self, match }) {
  if (pin.base === pin.head) throw new Error(`the lane head equals the base (${pin.base.slice(0, 9)}): nothing stands there to merge; name the lane's own head, and run from the landing bench, never from the lane`);
  const judge = judgeOn(git, pin.base, self);
  pin.listSha = judge.listSha;
  pin.landable = !pin.offDevelop;
  const merged = git(["merge-tree", "--write-tree", pin.base, pin.head], { raw: true });
  const tree = String(merged.stdout).split("\n")[0].trim();
  if (merged.status !== 0 || !FULL.test(tree)) throw new Error(`merging ${pin.head.slice(0, 9)} into ${pin.base.slice(0, 9)} conflicts or refuses (git merge-tree --write-tree, exit ${merged.status}); the lane owes its cold read whole: resolve the merge by hand, then let --check-merge judge what the hand made`);
  // The merge delta: what the landing changes on the base, read from the tree the merge itself would make.
  return owedAmong(changedBetween(git, pin.base, tree), judge, match);
}

/**
 * The read itself: { owed, unread, paths, head, base, listSha, hash, landable }. `paths` holds the owed paths, sorted, or the
 * one `(unread: <why>)` word. `base` left unnamed reads `refs/remotes/origin/develop` and holds the bench's HEAD to it.
 * Nothing here throws; every refusal lands as unread, which owes.
 */
export function coldRead({ root = ROOT, lane, base, self = HERE, git = gitAt(root), match = runMatcher } = {}) {
  const pin = { head: "", base: "", listSha: "", landable: false, offDevelop: false };
  const answer = (paths, unread) => ({ owed: paths.length > 0, unread, paths, ...pin, hash: recordHash({ ...pin, paths }) });
  try {
    if (typeof lane !== "string" || lane === "") throw new Error("no lane ref named; pass the lane's branch or sha");
    if (base === undefined) {
      pin.base = commitOf(git, DEVELOP);
      const here = commitOf(git, "HEAD");
      if (here !== pin.base) throw new Error(`this bench's HEAD (${here.slice(0, 9)}) differs from ${DEVELOP} (${pin.base.slice(0, 9)}): the judge runs from the landing bench standing at develop, never from a lane; bring the bench to develop (git fetch origin develop, then git merge --ff-only origin/develop), or name the base with --base`);
    } else {
      pin.base = commitOf(git, base);
      let develop = "";
      try { develop = commitOf(git, DEVELOP); } catch { /* no origin/develop here: the typed base stands off it */ }
      pin.offDevelop = pin.base !== develop;
    }
    pin.head = commitOf(git, lane);
    return answer(readPinned(pin, { git, self, match }), false);
  } catch (e) {
    return answer([unreadWord(e)], true);
  }
}

/**
 * The re-judging of a landed merge: { owed, unread, paths, merge, head, base, listSha, hash, beyond }. `head` names the sha
 * the read pinned (absent: the merge message's `Cold-Read:` line carries the binding). Nothing here throws.
 */
export function checkMerge({ root = ROOT, merge, head, base, self = HERE, git = gitAt(root), match = runMatcher } = {}) {
  const pin = { merge: "", head: "", base: "", listSha: "" };
  const answer = (paths, unread, beyond = []) => ({ owed: paths.length > 0, unread, paths, beyond, ...pin, hash: recordHash({ head: pin.merge, base: pin.base, listSha: pin.listSha, paths }) });
  try {
    if (typeof merge !== "string" || merge === "") throw new Error("no merge commit named; pass the merge's sha, or HEAD right after the merge");
    pin.merge = commitOf(git, merge);
    const m = pin.merge.slice(0, 9);
    const accepted = commitOf(git, base === undefined ? DEVELOP : base);
    const expected = head === undefined ? undefined : commitOf(git, head);
    const [, ...parents] = String(git(["rev-list", "--parents", "-n", "1", "--end-of-options", pin.merge])).trim().split(" ");
    if (parents.length !== 2 || !parents.every((p) => FULL.test(p))) throw new Error(`${m} holds ${parents.length} parent(s), where a --no-ff landing holds two; name the merge commit itself`);
    [pin.base, pin.head] = parents;
    if (pin.base !== accepted) throw new Error(`merge ${m}'s first parent (${pin.base.slice(0, 9)}) differs from the base (${accepted.slice(0, 9)}): the landing merges INTO develop, from the landing bench, before the push; redo the merge there, or name its base with --base`);
    if (expected !== undefined && pin.head !== expected) throw new Error(`merge ${m}'s second parent (${pin.head.slice(0, 9)}) differs from the head the read pinned (${expected.slice(0, 9)}): the lane moved after the read; undo the merge (git reset --hard ${pin.base.slice(0, 9)}), read the new head, and land its pinned sha`);
    // The read, recomputed over the merge's own parents: its judge check, list and matcher serve the re-judging too.
    // `offDevelop: false` stands named: the first parent already matched the accepted base above, and `readPinned` sets
    // `landable` from it once the judge stands, which the catch below reads as "the judge stood, the merge-tree refused".
    const pre = { head: pin.head, base: pin.base, listSha: "", landable: false, offDevelop: false };
    let prePaths, preUnread = false;
    try { prePaths = readPinned(pre, { git, self, match }); } catch (e) { if (!pre.landable) throw e; prePaths = [unreadWord(e)]; preUnread = true; }
    pin.listSha = pre.listSha;
    if (expected === undefined) {
      const message = String(git(["cat-file", "commit", pin.merge]));
      const quoted = [...message.slice(message.indexOf("\n\n") + 2).matchAll(/^Cold-Read: ([0-9a-f]{64})\s*$/gm)].map((x) => x[1]);
      const want = recordHash({ ...pre, paths: prePaths });
      if (quoted.length !== 1 || quoted[0] !== want) throw new Error(`merge ${m}'s message quotes ${quoted.length === 1 ? "another read's hash" : `${quoted.length} Cold-Read lines`}, where the read of its own two parents answers ${want}: the lane moved after the read, or the message never carried the line; pass the head sha the read pinned, or undo the merge (git reset --hard ${pin.base.slice(0, 9)}) and read again`);
    }
    const judge = judgeOn(git, pin.base, self);
    const paths = owedAmong(changedBetween(git, pin.base, pin.merge), judge, match);
    return answer(paths, false, preUnread ? [] : paths.filter((p) => !prePaths.includes(p)));
  } catch (e) {
    return answer([unreadWord(e)], true);
  }
}

/** A path as the verdict line shows it: quoted wherever a control char, a comma, a quote or a leading paren could forge a line or a word. */
export const shown = (p) => (/[\u0000-\u001f\u007f,"\\]|^\(|^\s|\s$/.test(p) ? JSON.stringify(p) : p);

/** The lines the familiar reads: the verdict, the record, then (a read) the landing command where none owes, or the
 *  read-first line where one does, never both; or (a merge) the paths past the read. */
export function lines(r) {
  const verdict = r.unread ? `COLD READ OWED: ${r.paths[0]}` : r.owed ? `COLD READ OWED: ${r.paths.map(shown).join(", ")}` : "cold read: none owed";
  const out = [verdict, `cold-read: ${r.owed ? "owed" : "none"}${r.merge === undefined ? "" : ` · merge ${r.merge || "?"}`} · head ${r.head || "?"} · base ${r.base || "?"} · list ${r.listSha || "?"} · paths ${r.unread ? "unread" : r.paths.length} · record-hash ${r.hash}${r.offDevelop ? " · base≠origin/develop" : ""}`];
  const after = `the merge message carries the line "Cold-Read: ${r.hash}"; then, before the push: node ${SELF} --check-merge HEAD ${r.head}`;
  if (r.landable && !r.owed) out.push(`land: git merge --no-ff ${r.head}   (${after})`);
  else if (r.landable) out.push(`read first: file the cold read under record-hash ${r.hash}; only after it passes: git merge --no-ff ${r.head}   (${after})`);
  if (r.beyond?.length) out.push(`cold-read: beyond the read: ${r.beyond.map(shown).join(", ")}`);
  return out;
}

const asMain = () => { try { return realpathSync(process.argv[1]) === realpathSync(HERE); } catch { return false; } };
if (process.argv[1] && asMain()) {
  const args = process.argv.slice(2);
  const usage = () => { console.log("COLD READ OWED: (unread: the command line names no single read)"); console.error(USAGE); process.exit(2); };
  const take = (flag) => { const at = args.indexOf(flag); if (at < 0) return undefined; const [, v] = args.splice(at, 2); if (v === undefined || v.startsWith("--")) usage(); return v; };
  const base = take("--base");
  const merge = take("--check-merge");
  if (args.some((a) => a.startsWith("--")) || args.length > 1 || (merge === undefined && args.length !== 1)) usage();
  for (const l of lines(merge === undefined ? coldRead({ lane: args[0], base }) : checkMerge({ merge, head: args[0], base }))) console.log(l);
}
