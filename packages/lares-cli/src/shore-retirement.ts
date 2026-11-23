/**
 * shore-retirement — the receipt a pending removal carries: the commit that took its file from the checkout.
 *
 * A pending removal names a file that left disk where a base stands. Where that file rested in a git checkout and a
 * commit deleted it, the shore names that commit beside the row: its short sha, its subject (trimmed), the pull request
 * that carried it (a subject ending `(#N)`, or the first `Merge pull request #N` on the ancestry path to HEAD), where
 * git keeps the bytes (`<sha>^:<path>`, read with `git show`), and where the commit's message says the substance went.
 * A receipt, never a gate: it changes no answer and refuses nothing.
 *
 * THE SEAM: git reads where this process reads the row's path. The CLI runs where the island's paths name files it
 * can see: on the host beside the checkout, or inside the vessel (the host shim runs this CLI there by `compose exec`),
 * where the serve image carries git and `/workspace` binds the checkout. Either way the path the island names stands in
 * this process's own view of the disk, so no path maps between two views. A checkout git cannot read from here (no git
 * binary, a worktree whose link points outside the vessel's view, no `.git` above the path) answers nothing.
 *
 * SILENT AND BOUNDED: git runs walled (no caller `GIT_*`, no global or system config, `safe.directory` opened on the
 * command line alone, as `checkoutTracking` runs it) and every run shares one deadline. Past it, or on any failure,
 * the rows read as they did with no receipt. One history walk per checkout answers every path in it.
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/** What one deleting commit names for one carrier. */
export interface Retirement {
  /** The deleting commit's short sha. */
  readonly sha: string;
  /** Its subject line, trimmed. */
  readonly subject: string;
  /** The pull request that carried it, where a subject names one. */
  readonly pr?: number;
  /** Where git keeps the carrier's last bytes: `<sha>^:<path from the checkout's top>`. */
  readonly ashes: string;
  /** Where the commit's message says the substance went, where it names a path. */
  readonly destination?: string;
}

/** What bounds and walls one receipt read: its budget (`boundMs`, or a shared monotonic `deadline`) and the roots it trusts. */
export interface ReceiptOptions { readonly boundMs?: number; readonly deadline?: number; readonly roots?: readonly string[] }

/** The whole receipt read's bound, across every git run it makes. */
export const RETIREMENT_BOUND_MS = 2000;

/** How long a subject reads before it trims. */
const SUBJECT_CHARS = 96;

/** How many paths ride one history walk's pathspec. */
const PATHS_PER_WALK = 400;

type Run = (args: readonly string[], cwd: string) => { readonly ok: boolean; readonly stdout: string };

/** A walled git run that answers within what remains of `deadline` (a process-local monotonic budget), or fails. */
function boundedGit(deadline: number): Run {
  return (args, cwd) => {
    const left = Math.floor(deadline - performance.now());
    if (left <= 0) return { ok: false, stdout: "" };
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
    env["GIT_CONFIG_GLOBAL"] = "/dev/null";
    env["GIT_CONFIG_NOSYSTEM"] = "1";
    const r = spawnSync("git", ["-c", "core.quotepath=off", "-c", "safe.directory=*", ...args], {
      cwd, env, encoding: "utf8", timeout: left, maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"],
    });
    return { ok: r.status === 0 && r.error === undefined, stdout: r.stdout ?? "" };
  };
}

const isDir = (p: string): boolean => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** The nearest directory at or above `path` that stands on disk (the file itself, and perhaps its dirs, left). */
function standingDirAbove(path: string): string | null {
  for (let d = dirname(path); ; d = dirname(d)) {
    if (isDir(d)) return d;
    if (dirname(d) === d) return null;
  }
}

/** The nearest directory at or above `dir` holding a `.git` entry. */
function hasCheckoutAbove(dir: string): boolean {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return true;
    if (dirname(d) === d) return false;
  }
}

/** Where the commit's message says the substance went: the first path a destination word leads to, in its clause. */
export function destinationIn(message: string): string | undefined {
  const lead = /\b(?:merged into|merges into|folds into|folded into|moved to|moves to|moved into|moves into|lives in|lives at|now in|into)\s+([^.;\n]{0,160})/gi;
  for (let m = lead.exec(message); m !== null; m = lead.exec(message)) {
    const clause = m[1] ?? "";
    const path = clause.split(/\s+/).map((t) => t.replace(/^[("'`[]+|[)"'`\],:]+$/g, "")).find((t) => /[\w-]\/[\w-]/.test(t) && !t.startsWith("#/"));
    if (path !== undefined) return path;
  }
  return undefined;
}

const trimSubject = (s: string): string => (s.length <= SUBJECT_CHARS ? s : `${s.slice(0, SUBJECT_CHARS - 1).trimEnd()}…`);

/** The pull request a commit rode: its own subject's `(#N)`, else the first PR merge on its ancestry path to HEAD. */
function prFor(sha: string, subject: string, top: string, git: Run): number | undefined {
  const own = /\(#(\d+)\)\s*$/.exec(subject);
  if (own) return Number(own[1]);
  const merges = git(["log", "--merges", "--ancestry-path", "--reverse", "--format=%s", `${sha}..HEAD`], top);
  if (!merges.ok) return undefined;
  for (const line of merges.stdout.split("\n")) {
    const m = /^Merge pull request #(\d+)\b/.exec(line);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/**
 * The deleting commit for each path a checkout holds, keyed by the path as given. A path no checkout holds, no deleting
 * commit names, or the bound outran, rides absent. Never throws.
 */
export function retirementsFor(paths: readonly string[], options: ReceiptOptions = {}): Map<string, Retirement> {
  const found = new Map<string, Retirement>();
  try {
    const git = boundedGit(performance.now() + (options.boundMs ?? RETIREMENT_BOUND_MS));
    // Each path's checkout: its top and the path from there (the file left disk, so read from the dir that stands).
    const byTop = new Map<string, Map<string, string>>(); // top -> rel -> path as given
    const placeOf = new Map<string, { top: string; prefix: string } | null>();
    for (const given of new Set(paths)) {
      const abs = resolve(given);
      const dir = standingDirAbove(abs);
      if (dir === null || !hasCheckoutAbove(dir)) continue;
      let place = placeOf.get(dir);
      if (place === undefined) {
        const r = git(["rev-parse", "--show-toplevel", "--show-prefix"], dir);
        const [top, prefix] = r.stdout.split("\n");
        place = r.ok && top ? { top, prefix: prefix ?? "" } : null;
        placeOf.set(dir, place);
      }
      if (place === null) continue;
      const rel = `${place.prefix}${relative(dir, abs).split(sep).join("/")}`;
      const rels = byTop.get(place.top) ?? new Map<string, string>();
      rels.set(rel, given);
      byTop.set(place.top, rels);
    }
    const prs = new Map<string, number | undefined>();
    for (const [top, rels] of byTop) {
      const all = [...rels.keys()];
      for (let i = 0; i < all.length; i += PATHS_PER_WALK) {
        const walk = git(["--literal-pathspecs", "log", "--diff-filter=D", "--name-only", "--format=%x1e%h%x1f%s%x1f%B%x1d", "--", ...all.slice(i, i + PATHS_PER_WALK)], top);
        if (!walk.ok) continue;
        for (const record of walk.stdout.split("\x1e")) {
          const [sha, subject, rest] = record.split("\x1f");
          if (!sha || subject === undefined || rest === undefined) continue;
          const [message, names] = rest.split("\x1d");
          for (const rel of (names ?? "").split("\n").map((n) => n.trim()).filter((n) => n !== "")) {
            const given = rels.get(rel);
            if (given === undefined || found.has(given)) continue; // newest first: the first deletion named holds
            if (!prs.has(sha)) prs.set(sha, prFor(sha, subject, top, git));
            const pr = prs.get(sha);
            const destination = destinationIn(message ?? "");
            found.set(given, { sha, subject: trimSubject(subject), ...(pr !== undefined ? { pr } : {}), ashes: `${sha}^:${rel}`, ...(destination !== undefined ? { destination } : {}) });
          }
        }
      }
    }
  } catch { /* a receipt never fails the answer */ }
  return found;
}

/** One path's deleting commit, or undefined. */
export async function retirementFor(path: string, options: ReceiptOptions = {}): Promise<Retirement | undefined> {
  return retirementsFor([path], options).get(path);
}

/** The receipt line a person reads beside a pending removal. */
export function retirementLine(r: Retirement): string {
  return `retired by ${r.sha} "${r.subject}"${r.pr !== undefined ? ` (PR #${r.pr})` : ""}; ashes at ${r.ashes}`;
}

/** The otakiage note a remove answer names before the burn: where the substance went. */
export function otakiageLine(r: Retirement): string {
  return r.destination !== undefined
    ? `otakiage: its substance went to ${r.destination}, as ${r.sha} names`
    : "otakiage: the retiring commit names no destination";
}

/** Rows with a `retiredBy` object where their `path` carries a receipt; every other row rides unchanged. */
export function withRetiredBy(rows: ReadonlyArray<Record<string, unknown>>, receipts: ReadonlyMap<string, Retirement>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const r = typeof row["path"] === "string" ? receipts.get(row["path"]) : undefined;
    return r === undefined ? { ...row } : { ...row, retiredBy: r };
  });
}

/** The pending rows' receipts, read once. */
export function pendingReceipts(rows: ReadonlyArray<Record<string, unknown>>, options: ReceiptOptions = {}): Map<string, Retirement> {
  const paths = rows.map((row) => row["path"]).filter((p): p is string => typeof p === "string" && p !== "");
  return paths.length === 0 ? new Map() : retirementsFor(paths, options);
}
