/**
 * shore-retirement — the receipt a pending removal carries: the commit that took its file from the checkout.
 *
 * A pending removal names a file that left disk where a base stands. Where that file rested in a git checkout and a
 * commit deleted it, the shore names that commit beside the row: its short sha, its subject (trimmed), the pull request
 * whose merge brought it (`Merge pull request #N`, where the deleting commit reaches HEAD's first-parent line through
 * that merge's second parent alone), where git keeps the bytes (`<sha>^:<path>`, read with `git show`), and where the
 * commit's message says the substance went. A direct push names no PR, whatever its own subject carries.
 * A receipt, never a gate: it changes no answer and refuses nothing.
 *
 * THE SEAM: git reads where this process reads the row's path. The CLI runs where the island's paths name files it
 * can see: on the host beside the checkout, or inside the vessel (the host shim runs this CLI there by `compose exec`),
 * where the serve image carries git and `/workspace` binds the checkout. Either way the path the island names stands in
 * this process's own view of the disk, so no path maps between two views. A checkout git cannot read from here (no git
 * binary, a worktree whose link points outside the vessel's view, no `.git` above the path) answers nothing.
 *
 * A CHECKOUT THE HOUSE NAMES, AND NO OTHER. A git top-level reads only where it stands at or under a root the house
 * already names: the canon source's checkout (`LAR_BAGS`'s parent), `/workspace`, or the repo this CLI runs from. The
 * search for `.git` never climbs past that root, and a path under no such root reads nothing, silently.
 *
 * WALLED: a repository's own config still loads, so every run sets each key that can name a program to a value that
 * runs none (signature checks, gpg programs, fsmonitor, pager, hooks, external diff and textconv), drops the caller's
 * `GIT_*`, reads no global or system config, and opens `safe.directory` for that one top-level alone.
 *
 * SILENT AND BOUNDED: every run shares one monotonic deadline (a caller may hand its own, so a read before the receipt
 * spends from the same budget). Past it, or on any failure, the rows read as they did with no receipt. One history
 * walk per checkout answers every path in it.
 */

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { repoRoot } from "@lararium/mesh/node";

/** What one deleting commit names for one carrier. */
export interface Retirement {
  /** The deleting commit's short sha. */
  readonly sha: string;
  /** Its subject line, trimmed. */
  readonly subject: string;
  /** The pull request whose merge brought it to HEAD's first-parent line, where one did. */
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

/** Every config key that can name a program a read runs, set to run none; command-line `-c` outranks the repo's own. */
const WALLED_KEYS = [
  "log.showSignature=false", "gpg.program=/bin/false", "gpg.ssh.program=/bin/false", "gpg.x509.program=/bin/false",
  "core.fsmonitor=false", "core.pager=cat", "core.hooksPath=/dev/null", "diff.external=", "core.quotepath=off",
];

/** A walled git run in the one top-level `top`, answering within what remains of `deadline` (monotonic), or failing. */
function boundedGit(deadline: number, top: string): Run {
  return (args, cwd) => {
    const left = Math.floor(deadline - performance.now());
    if (left <= 0) return { ok: false, stdout: "" };
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
    env["GIT_CONFIG_GLOBAL"] = "/dev/null";
    env["GIT_CONFIG_NOSYSTEM"] = "1";
    const walls = [...WALLED_KEYS, `safe.directory=${top}`].flatMap((kv) => ["-c", kv]);
    const r = spawnSync("git", ["--no-pager", ...walls, ...args], {
      cwd, env, encoding: "utf8", timeout: left, maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"],
    });
    return { ok: r.status === 0 && r.error === undefined, stdout: r.stdout ?? "" };
  };
}

/** The roots the house already names: the canon source's checkout, `/workspace`, and the repo this CLI runs from. */
export function houseRoots(): string[] {
  const bags = process.env["LAR_BAGS"];
  return [...(bags ? [dirname(resolve(bags))] : []), "/workspace", repoRoot];
}

const real = (p: string): string | null => { try { return realpathSync(p); } catch { return null; } };

/** Whether `at` rests at or beneath `root`. */
const under = (root: string, at: string): boolean => {
  const rel = relative(root, at);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

const isDir = (p: string): boolean => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** The nearest directory at or above `path` that stands on disk (the file itself, and perhaps its dirs, left). */
function standingDirAbove(path: string): string | null {
  for (let d = dirname(path); ; d = dirname(d)) {
    if (isDir(d)) return d;
    if (dirname(d) === d) return null;
  }
}

/** The nearest directory at or above `dir`, and never above a trusted root that holds it, carrying a `.git` entry. */
function trustedTopAbove(dir: string, roots: readonly string[]): string | null {
  const root = roots.filter((r) => under(r, dir)).sort((a, b) => a.length - b.length)[0]; // the outermost root that holds it bounds the climb
  if (root === undefined) return null;
  for (let d = dir; under(root, d); d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return d;
    if (d === root || dirname(d) === d) return null;
  }
  return null;
}

/** Where the commit's message says the substance went: the first path a destination word leads to, in its clause. */
export function destinationIn(message: string): string | undefined {
  // The clause runs to sentence punctuation that a space or the end follows, so a dot inside a path stays in it.
  const lead = /\b(?:merged into|merges into|folds into|folded into|moved to|moves to|moved into|moves into|lives in|lives at|now in|into)\s+((?:[^.;!?\n]|[.;!?](?=\S)){0,160})/gi;
  for (let m = lead.exec(message); m !== null; m = lead.exec(message)) {
    const clause = m[1] ?? "";
    const path = clause.split(/\s+/).map((t) => t.replace(/^[("'`[]+|[)"'`\],:.]+$/g, "")).find((t) => /[\w-]\/[\w-]/.test(t) && !t.startsWith("#/"));
    if (path !== undefined) return path;
  }
  return undefined;
}

const trimSubject = (s: string): string => (s.length <= SUBJECT_CHARS ? s : `${s.slice(0, SUBJECT_CHARS - 1).trimEnd()}…`);

/**
 * The pull request whose merge brought `sha` in: a `Merge pull request #N` commit between `sha` and HEAD whose second
 * parent descends from `sha` (or names it) and whose first parent does not. The earliest such merge names the PR; a
 * direct push, which every later merge's first parent already holds, names none. One walk reads every commit on the
 * ancestry path with its parents, so the descent checks read that set, never another git run.
 */
function prFor(sha: string, top: string, git: Run): number | undefined {
  const walk = git(["log", "--ancestry-path", "--topo-order", "--reverse", "--format=%H%x1f%P%x1f%s", `${sha}..HEAD`], top);
  if (!walk.ok) return undefined;
  const rows = walk.stdout.split("\n").filter((l) => l !== "").map((l) => l.split("\x1f"));
  const descends = new Set<string>([sha, ...rows.map(([h]) => h ?? "")]);
  for (const [, parents, subject] of rows) {
    const [first, second] = (parents ?? "").split(" ");
    const m = /^Merge pull request #(\d+)\b/.exec(subject ?? "");
    if (m && first !== undefined && second !== undefined && descends.has(second) && !descends.has(first)) return Number(m[1]);
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
    const deadline = options.deadline ?? performance.now() + (options.boundMs ?? RETIREMENT_BOUND_MS);
    if (deadline - performance.now() <= 0) return found;
    const roots = [...new Set((options.roots ?? houseRoots()).map(real).filter((r): r is string => r !== null))];
    // Each path's checkout: its trusted top and the path from there (the file left disk, so read from the dir that stands).
    const byTop = new Map<string, Map<string, string>>(); // top -> rel -> path as given
    for (const given of new Set(paths)) {
      const standing = standingDirAbove(resolve(given));
      const dir = standing === null ? null : real(standing);
      if (standing === null || dir === null) continue;
      const top = trustedTopAbove(dir, roots);
      if (top === null) continue;
      const rel = relative(top, join(dir, relative(standing, resolve(given)))).split(sep).join("/");
      const rels = byTop.get(top) ?? new Map<string, string>();
      rels.set(rel, given);
      byTop.set(top, rels);
    }
    const prs = new Map<string, number | undefined>();
    for (const [top, rels] of byTop) {
      const git = boundedGit(deadline, top);
      const all = [...rels.keys()];
      for (let i = 0; i < all.length; i += PATHS_PER_WALK) {
        const walk = git(["--literal-pathspecs", "log", "--no-show-signature", "--no-ext-diff", "--no-textconv", "--diff-filter=D", "--name-only", "--format=%x1e%H%x1f%h%x1f%s%x1f%B%x1d", "--", ...all.slice(i, i + PATHS_PER_WALK)], top);
        if (!walk.ok) continue;
        for (const record of walk.stdout.split("\x1e")) {
          const [full, sha, subject, rest] = record.split("\x1f");
          if (!full || !sha || subject === undefined || rest === undefined) continue;
          const [message, names] = rest.split("\x1d");
          for (const rel of (names ?? "").split("\n").map((n) => n.trim()).filter((n) => n !== "")) {
            const given = rels.get(rel);
            if (given === undefined || found.has(given)) continue; // newest first: the first deletion named holds
            if (!prs.has(sha)) prs.set(sha, prFor(full, top, git));
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
