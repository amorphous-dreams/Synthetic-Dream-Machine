/**
 * pool-head — the words a face pool's git history holds for one file, read walled.
 *
 * THE SYNCED TREE OUTLIVES NO RE-FOUND. It rests in `hearth/checkpoints/projection`, which a re-found clears, while the face
 * pools under `projections/faces/<pet name>/` outlive it with their git history. With no base, every edited file would meet a
 * `no-base` stand-off. The pool's HEAD names the last sitting's close (`poolCommitSeam`), so where no synced base stands the
 * blob at HEAD hands both gates a base: its bytes the disk side, their canonical render the records side (`baseFromGit` in
 * the projector and the watch core's scan). The four states then resolve as any base resolves them: both at HEAD pins, the
 * records moved alone projects, the disk moved alone ingests, both moved stands off over HEAD and `lares shore take-disk`
 * merges over the same blob.
 *
 * NO RECORD, NO BASE. HEAD vouches for an agreement only where the house still holds the record. The projector reads HEAD
 * only for records it renders; the scan marks each HEAD base it hands the wave (`headBase`), and the island drops it where
 * the records hold nothing under the carrier, so such a file lands as an arrival and no echo pins a base for it.
 *
 * ONE PLACE, ONE BLOB READ. `poolPlaceOf` names a file's repository and its path inside it; `blobAt` reads one blob at one
 * revision. The shore's base read (`basePoolText`, lares-cli `shore-merge`) walks the history through the same two.
 *
 * Git runs walled (`walledGit`): no caller `GIT_*` crosses, an empty global config, no system config, as `lares surface`
 * runs it. A pool with no `.git` and a file outside every pool spawn no git at all (`poolHeads`).
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { FACES_PROJECTION_DIR } from "./bag-paths.js";
import type { GitRun } from "./watch-core.js";

/** One git run with the hook env dropped, an empty global config and no system config. */
export const walledGit: GitRun = (args, cwd) => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env["GIT_CONFIG_GLOBAL"] = "/dev/null";
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { cwd, env, encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? r.error.message : "") };
};

/** A file's repository (`top`) and its path inside it (`rel`), or why none names it. */
export type PoolPlace = { readonly top: string; readonly rel: string } | { readonly why: string };

/** Where `file` rests in its git history: the repository's top and the file's path from there. */
export function poolPlaceOf(file: string, git: GitRun = walledGit): PoolPlace {
  const dir = dirname(file);
  const top = git(["rev-parse", "--show-toplevel"], dir);
  if (top.code !== 0) return { why: `the file rests in no git history (no pool .git above ${dir}), so no base's words stand in clear` };
  const prefix = git(["rev-parse", "--show-prefix"], dir);
  if (prefix.code !== 0) return { why: `git could not name the file's place in its history (${prefix.stderr.trim() || "no answer"})` };
  return { top: top.stdout.trim(), rel: `${prefix.stdout.trim()}${basename(file)}` };
}

/** The blob at `rev:rel` in the repository at `top`, or null where that revision holds no such blob. */
export function blobAt(top: string, rev: string, rel: string, git: GitRun = walledGit): string | null {
  const blob = git(["cat-file", "blob", `${rev}:${rel}`], top);
  return blob.code === 0 ? blob.stdout : null;
}

/** The words HEAD holds for one carrier: its body, and its `.meta` sidecar where HEAD holds one. */
export interface PoolHead {
  readonly body: string;
  readonly meta?: string;
}

/** HEAD's words for `file`, or null where it rests in no history or HEAD never held it. */
export function poolHeadOf(file: string, git: GitRun = walledGit): PoolHead | null {
  const place = poolPlaceOf(file, git);
  if ("why" in place) return null;
  const body = blobAt(place.top, "HEAD", place.rel, git);
  if (body === null) return null;
  const meta = blobAt(place.top, "HEAD", `${place.rel}.meta`, git);
  return meta === null ? { body } : { body, meta };
}

/** THE PORT BOTH GATES READ: HEAD's words for a file with no synced base, or null where none stand. */
export type BaseFromGit = (file: string) => PoolHead | null;

/** HEAD's words for files inside ONE pool. A pool with no `.git`, and a file outside it, read null and spawn no git. */
export function poolHeads(pool: string, git: GitRun = walledGit): BaseFromGit {
  const root = resolve(pool);
  return (file) => {
    const at = resolve(file);
    if (!at.startsWith(root + sep) || !existsSync(join(root, ".git"))) return null;
    return poolHeadOf(at, git);
  };
}

/**
 * HEAD's words for files inside ANY face pool under the projections root (`<root>/faces/<pet name>/`). The root reads at
 * each call (a house with no root names no pool); a file outside the faces folder reads null and spawns no git.
 */
export function facePoolHeads(projectionsRoot: () => string | null, git: GitRun = walledGit): BaseFromGit {
  return (file) => {
    const root = projectionsRoot();
    if (root === null) return null;
    const faces = join(resolve(root), FACES_PROJECTION_DIR);
    const rel = relative(faces, resolve(file));
    if (rel === "" || rel.startsWith("..") || rel.split(sep).length < 2) return null;
    return poolHeads(join(faces, rel.split(sep)[0]!), git)(file);
  };
}
