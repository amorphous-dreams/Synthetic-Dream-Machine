#!/usr/bin/env node
/**
 * cold-read-owed — WHICH PATHS OF A LANE'S MERGE OWE A COLD READ, judged from the base's own tree, never the lane's.
 *
 *   node tools/cold-read-owed.mjs <lane-ref> [--base <ref>]
 *
 * The familiar runs it FROM THE LANDING BENCH (a worktree checked out at develop) before the `--no-ff` merge. The judge never
 * rides the lane: this file, the list and the matcher all come from the base.
 *   1. PIN ONCE. `git rev-parse` names the base (the bench's HEAD, the commit the merge lands upon; `--base` names another) and
 *      the lane head, each one time. Every later read names those two shas, so a ref or a HEAD that moves afterwards changes
 *      nothing here.
 *   2. THE JUDGE STANDS ON THE BASE. The running file's bytes equal `<base>:tools/cold-read-owed.mjs` or the read lands unread; the list
 *      (`<base>:tools/security-class-paths.json`) and the matcher (`<base>:packages/lararium-tw5/src/filters/security-class.ts`)
 *      come out of the base's git objects, so neither a dirty bench file nor anything in the lane's tree reaches the verdict.
 *   3. THE DIFF COMPARES THE TWO TREES: `git diff-tree -r --no-renames --ignore-submodules=none --raw -z <base> <lane>`, the
 *      two-dot form in plumbing. A three-way merge changes a path of the base only where the lane's tree differs from the
 *      base's there (two sides holding the same bytes merge to those bytes, whatever ancestor stands between them), so the
 *      two-tree diff names every path the merge can change. The merge-base (three-dot) form reads ancestry: under a
 *      criss-cross history git picks one merge base of several, and a lane equal to that one at a path the merge still
 *      changes slips past it. The two-tree form reads no ancestry at all (no graft, no shallow line, no merge-base choice),
 *      and it errs toward owing: a lane standing behind develop also names what develop changed since. A rename shows as
 *      its deleted and its added path; a submodule pointer shows as its own path.
 *   4. THE MATCHER RUNS IN A CHILD NODE, its source written from the base's object to a temp dir (Node strips the types). No
 *      daemon and no wiki door stand on this path. The ask always carries the SENTINEL (the list's own path, which the list
 *      always owes); an answer lacking it reads unread.
 * It prints two lines and exits 0 either way:
 *   COLD READ OWED: <paths>            or            cold read: none owed
 *   cold-read: owed|none · head <sha> · base <sha> · list <sha256> · paths <n> · record-hash <sha256>
 * The record hash covers the head, the base, the list's sha256, then each owed path, NUL-joined (git refuses a NUL in a path,
 * so no two paths join into one). The familiar files its cold Opus read under that hash and the merge message carries
 * `Cold-Read: <hash>`; anyone holding the merge commit recomputes it with `--base <merge>^1 <merge>^2`.
 * ANY failure to read (no lane ref, a git refusal, a base holding no judge, no list, no matcher, a malformed list, a matcher
 * that will not run or answers without the sentinel) prints `COLD READ OWED: (unread: <why>)`: owed, never clean. A usage
 * fault prints that line too and exits 2.
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
export const USAGE = "usage: cold-read-owed.mjs <lane-ref> [--base <ref>]   (run from the landing bench, checked out at develop)";
const HERE = fileURLToPath(import.meta.url);
export const ROOT = resolve(dirname(HERE), "..");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();

/** A git runner bound to `root`: stdout as a Buffer, a throw naming git's own last line on any refusal. No `GIT_*` variable
 *  of the caller's shell and no replace ref bends what an object name reads. */
export function gitAt(root) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  env.GIT_NO_REPLACE_OBJECTS = "1";
  return (args) => {
    const r = spawnSync("git", ["--no-replace-objects", ...args], { cwd: root, env, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`git ${args[0]} refused: ${oneLine(String(r.stderr || r.error?.message || `exit ${r.status}`).trim().split("\n").at(-1))}`);
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

/** The record hash: SHA-256 over the head, the base, the list's sha256, then each owed path, NUL-joined. */
export const recordHash = ({ head, base, listSha, paths }) => sha256([head, base, listSha, ...paths].join("\0"));

const RUNNER = 'try { const { readSecurityClass, securityClassPaths } = await import(process.argv[1]); process.stdin.setEncoding("utf8"); let b = ""; for await (const c of process.stdin) b += c; const { paths, list } = JSON.parse(b); process.stdout.write(JSON.stringify(securityClassPaths(paths, readSecurityClass(list)))); } catch (e) { process.stderr.write("\\n" + String(e && e.message ? e.message : e)); process.exitCode = 1; }';

/** The base's matcher over `paths`, in a child node: `source` lands in a private temp dir and loads from there. */
export function runMatcher(source, paths, list) {
  const dir = mkdtempSync(join(tmpdir(), "cold-read-owed-"));
  try {
    const file = join(dir, "security-class.mts");
    writeFileSync(file, source);
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", RUNNER, pathToFileURL(file).href], { encoding: "utf8", input: JSON.stringify({ paths, list }), maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`the base's matcher would not run: ${oneLine(String(r.stderr || r.error?.message || `exit ${r.status}`).trim().split("\n").at(-1))}`);
    return JSON.parse(r.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/**
 * The read itself: { owed, unread, paths, head, base, listSha, hash }. `paths` holds the owed paths in the diff's order, or
 * the one `(unread: <why>)` word. Nothing here throws; every refusal lands as unread, which owes.
 */
export function coldRead({ root = ROOT, lane, base = "HEAD", self = HERE, git = gitAt(root), match = runMatcher } = {}) {
  const pin = { head: "", base: "", listSha: "" };
  const answer = (paths, unread) => ({ owed: paths.length > 0, unread, paths, ...pin, hash: recordHash({ ...pin, paths }) });
  try {
    if (typeof lane !== "string" || lane === "") throw new Error("no lane ref named; pass the lane's branch or sha");
    const commit = (ref) => String(git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])).trim();
    pin.base = commit(base);
    pin.head = commit(lane);
    if (!/^[0-9a-f]{40,64}$/.test(pin.base) || !/^[0-9a-f]{40,64}$/.test(pin.head)) throw new Error("git rev-parse answered no full sha");
    const blob = (path, absent) => { try { return git(["cat-file", "blob", `${pin.base}:${path}`]); } catch { throw new Error(absent); } };
    const short = pin.base.slice(0, 9);
    const judge = blob(SELF, `base ${short} holds no ${SELF}, so no judge from the base stands here; land the judge on develop and give this lane its cold read by hand`);
    if (!judge.equals(readFileSync(self))) throw new Error(`this judge's bytes differ from base ${short}'s ${SELF}; run it from the landing bench with a clean tree at develop`);
    const listBytes = blob(LIST, `base ${short} holds no ${LIST}; restore the list on develop`);
    pin.listSha = sha256(listBytes);
    let list;
    try { list = JSON.parse(String(listBytes)); } catch { throw new Error(`base ${short}'s ${LIST} parses as no JSON; cure the list on develop`); }
    const matcher = blob(MATCHER, `base ${short} holds no matcher (${MATCHER}); land the matcher on develop and give this lane its cold read by hand`);
    const changed = parseRawZ(git(["diff-tree", "-r", "--no-renames", "--ignore-submodules=none", "--raw", "-z", "--end-of-options", pin.base, pin.head]));
    const asked = [LIST, ...changed.filter((p) => p !== LIST)];
    const hit = match(matcher, asked, list);
    if (!Array.isArray(hit) || hit.some((p) => typeof p !== "string" || !asked.includes(p))) throw new Error("the base's matcher answered something other than a list of the asked paths");
    if (!hit.includes(LIST)) throw new Error(`the matcher's answer lacks the sentinel: base ${short}'s list no longer owes its own path (${LIST}); restore that row on develop`);
    const held = new Set(hit);
    return answer(changed.filter((p, i) => held.has(p) && changed.indexOf(p) === i), false);
  } catch (e) {
    return answer([`(unread: ${oneLine(e instanceof Error ? e.message : e)})`], true);
  }
}

/** A path as the verdict line shows it: quoted wherever a control char, a comma, a quote or a leading paren could forge a line or a word. */
export const shown = (p) => (/[\u0000-\u001f\u007f,"\\]|^\(|^\s|\s$/.test(p) ? JSON.stringify(p) : p);

/** The two lines the familiar reads. */
export function lines(r) {
  const verdict = r.unread ? `COLD READ OWED: ${r.paths[0]}` : r.owed ? `COLD READ OWED: ${r.paths.map(shown).join(", ")}` : "cold read: none owed";
  return [verdict, `cold-read: ${r.owed ? "owed" : "none"} · head ${r.head || "?"} · base ${r.base || "?"} · list ${r.listSha || "?"} · paths ${r.unread ? "unread" : r.paths.length} · record-hash ${r.hash}`];
}

const asMain = () => { try { return realpathSync(process.argv[1]) === realpathSync(HERE); } catch { return false; } };
if (process.argv[1] && asMain()) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--base");
  const base = at >= 0 ? args[at + 1] : "HEAD";
  const rest = at >= 0 ? [...args.slice(0, at), ...args.slice(at + 2)] : args;
  if (rest.length !== 1 || rest[0].startsWith("--") || !base) {
    console.log("COLD READ OWED: (unread: no single lane ref named)");
    console.error(USAGE);
    process.exit(2);
  }
  for (const l of lines(coldRead({ lane: rest[0], base }))) console.log(l);
}
