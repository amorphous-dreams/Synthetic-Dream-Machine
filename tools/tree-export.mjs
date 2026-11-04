/**
 * tree-export — write one git tree to a directory as raw bytes (seat-harness#/the-broker).
 *
 * `git archive` and `git checkout-index` apply the repo's smudge filters and export attributes, and the filter
 * commands come from a config a lane can plant. This reads blobs with `cat-file` (no conversion) and writes them
 * itself: regular files and executables as bytes, symlinks as symlinks, gitlinks (submodules) as empty directories.
 * It runs the pinned git under a fixed environment and executes nothing the tree holds.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const GIT = "/usr/bin/git";
const CHUNK = 48 * 1024 * 1024;
const FIXED = ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-c", "core.attributesFile=/dev/null", "-c", "credential.helper="];

/** Writes `tree` of `gitDir` under `to`; returns `{ ok, output, files }`. `iso` holds the isolated HOME and TMPDIR. */
export function exportTree({ gitDir, tree, to, iso }) {
  const home = path.join(iso, "home"), tmp = path.join(iso, "tmp");
  mkdirSync(home, { recursive: true }); mkdirSync(tmp, { recursive: true }); mkdirSync(to, { recursive: true });
  const env = { PATH: "/usr/bin:/bin", HOME: home, TMPDIR: tmp, XDG_CONFIG_HOME: home, LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_ATTR_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0" };
  const git = (args, input) => spawnSync(GIT, [...FIXED, "--git-dir", gitDir, ...args], { env, input, encoding: null, maxBuffer: 256 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  const listed = git(["ls-tree", "-r", "-z", "-l", "--full-tree", tree]);
  if (listed.status !== 0) return { ok: false, output: String(listed.stderr).slice(0, 4096) };
  const entries = listed.stdout.toString("utf8").split("\0").filter(Boolean).map((rec) => {
    const tab = rec.indexOf("\t");
    const [mode, type, sha, size] = rec.slice(0, tab).split(/\s+/);
    return { mode, type, sha, size: Number(size) || 0, rel: rec.slice(tab + 1) };
  });
  const safe = (rel) => !path.isAbsolute(rel) && !rel.split("/").some((p) => p === ".." || p === "" || p === ".git");
  let files = 0, batch = [], bytes = 0;
  const flush = () => {
    if (!batch.length) return null;
    const out = git(["cat-file", "--batch"], `${batch.map((e) => e.sha).join("\n")}\n`);
    if (out.status !== 0) return String(out.stderr).slice(0, 4096);
    let at = 0;
    const buf = out.stdout;
    for (const e of batch) {
      const nl = buf.indexOf(10, at);
      const [, , size] = buf.subarray(at, nl).toString("utf8").split(" ");
      const content = buf.subarray(nl + 1, nl + 1 + Number(size));
      at = nl + 1 + Number(size) + 1;
      const dest = path.join(to, e.rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      if (e.mode === "120000") symlinkSync(content.toString("utf8"), dest);
      else { writeFileSync(dest, content); chmodSync(dest, e.mode === "100755" ? 0o755 : 0o644); }
      files++;
    }
    batch = []; bytes = 0;
    return null;
  };
  for (const e of entries) {
    if (!safe(e.rel)) return { ok: false, output: `unsafe path in tree: ${e.rel}` };
    if (e.mode === "160000") { mkdirSync(path.join(to, e.rel), { recursive: true }); continue; }
    batch.push(e); bytes += e.size;
    if (bytes >= CHUNK) { const bad = flush(); if (bad) return { ok: false, output: bad }; }
  }
  const bad = flush();
  return bad ? { ok: false, output: bad } : { ok: true, output: "", files };
}
