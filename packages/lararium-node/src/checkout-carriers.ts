/**
 * checkout-carriers — the files a canon-sourced tree holds that git has never tracked, read walled.
 *
 * A MIRROR ROOT INSIDE A CHECKOUT writes into a tree git keeps (`wikis/<slug>`, `bags/<slug>` where the canon source or a
 * workspace names the checkout). A file the projector writes there rests nowhere else until a person commits it: a
 * re-found that takes its record, and an unlink that follows, leave no copy. So an untracked file there reads as an owed
 * commit: the census names it by path (`lares vessel census`), and the projector never unlinks it (`untrackedAt` in the
 * projector), whatever the records say.
 *
 * THE HOUSE'S OWN POOLS STAND APART. A face pool under the projections root keeps its own git history, and the house
 * commits it at each sitting's close (`poolCommitSeam`): a file there that waits for that commit names no owed commit a
 * person carries. A path under the projections root, and a path with no `.git` above it, read null and spawn no git.
 *
 * AN IGNORED FILE OWES NOTHING. The read names what `git status` names untracked (`--others --exclude-standard`): a path
 * the checkout's ignore rules hold out stays out on purpose.
 *
 * A CHECKOUT GIT CANNOT READ ANSWERS WHY, never "clean": no git binary in this runtime, a worktree whose link points
 * outside this runtime's view, a repository git refuses. The census names it unanswered and the projector keeps the file.
 *
 * Git runs walled (`walledGit`), with `safe.directory` opened on the command line alone: a checkout mounted under another
 * owner reads as it stands.
 */

import { existsSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { walledGit } from "./pool-head.js";
import type { GitRun } from "./watch-core.js";

/** What one read answers: null where no checkout holds the path, the untracked files (absolute), or why git could not say. */
export type UntrackedReading = null | { readonly untracked: readonly string[] } | { readonly why: string };

/** THE PORT the projector and the census read: the untracked files at `at` (a file, or a directory read whole). */
export type CarrierTracking = (at: string) => UntrackedReading;

/** The nearest directory at or above `dir` that holds a `.git` entry (a directory, or a worktree's link file), or null. */
function checkoutAbove(dir: string): string | null {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return d;
    if (dirname(d) === d) return null;
  }
}

const isDir = (p: string): boolean => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** Whether `at` rests at or beneath `root`. */
const under = (root: string, at: string): boolean => {
  const rel = relative(resolve(root), resolve(at));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/**
 * The untracked files at `at`, for any checkout outside the projections root. The root reads at each call (a house with
 * none names no pool to spare). `at` may name a path with no file on disk: the read then answers for its directory.
 */
export function checkoutTracking(projectionsRoot: () => string | null, git: GitRun = walledGit): CarrierTracking {
  return (at) => {
    const target = resolve(at);
    const pools = projectionsRoot();
    if (pools !== null && under(pools, target)) return null;
    const cwd = isDir(target) ? target : dirname(target);
    if (!existsSync(cwd) || checkoutAbove(cwd) === null) return null;
    const spec = cwd === target ? "." : basename(target);
    const r = git(["-c", "safe.directory=*", "ls-files", "-z", "--others", "--exclude-standard", "--", spec], cwd);
    if (r.code !== 0) {
      const said = r.stderr.trim().split("\n")[0] ?? "";
      return { why: /ENOENT|not found|spawn/i.test(said) || said === ""
        ? `git cannot run in this runtime, so nothing proves the files under ${cwd} stand committed`
        : `git could not read the checkout above ${cwd} (${said})` };
    }
    return { untracked: r.stdout.split("\0").filter((p) => p !== "").map((p) => join(cwd, p)).sort() };
  };
}
