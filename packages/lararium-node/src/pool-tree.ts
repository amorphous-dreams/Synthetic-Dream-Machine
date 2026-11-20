/**
 * pool-tree — EVERY POOL A TREE (face-pools #/shape, operator's word 2026-11-20). Each root the house lays as a pool holds its
 * own git working tree: a face root `projections/faces/<pet name>/`, and each wiki folder a realm holds,
 * `projections/realms/<realm pet name>/wikis/<slug>/` (one tree per wiki folder, never one over the realm). The pools take NO
 * remote (operator ruling), and nothing here ever rewrites a history.
 *
 * ONE INIT, TWO SCALES. `initFacePool` and `initRealmPool` make a root a pool, changing only what does not already stand as the
 * house writes it: the repository (`git init -b main`), `.git` at 0700, the house's ignore block in `.git/info/exclude` (with a
 * realm pool's own lines), the local author (a face: `<pet name> <slug>@face.invalid`; a realm: `<slug> <slug>@realm.invalid`)
 * with signing off, and the pre-commit hook that runs the pool check. `lares surface init` runs it by hand.
 *
 * THE HOUSE FOUNDS WHAT IS MISSING (`ensurePoolTree`), idempotently, wherever it lays a pool root: the worn face's arm, a face lit
 * beside it, the mount's realm placement as it lays a wiki folder, and the re-stand's heal over every pool root on disk
 * (`healPoolTrees`), so a pool laid before this step stood takes its tree at the next boot with no hand act. A root whose
 * `.git` stands keeps its author, exclude and history as they stand (the operator's), and only a pre-commit hook the house
 * itself wrote re-reads the current one (`refreshPoolHook`: the hook answers on the host and inside the vessel's container,
 * and refuses where no check stands); a root resting inside another
 * history (a house laid inside a checkout) founds nothing, since a nested repo would split that history.
 *
 * Git always runs here with an empty global config and no system config, every `GIT_*` name stripped, so nothing written or
 * read reaches past the pool.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/face-pools
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { faceSegmentRefusal, FACES_PROJECTION_DIR, REALM_EXCLUDE_LINES, withExcludeBlock } from "./bag-paths.js";
import { realmFoldersOnDisk } from "./realm-labels.js";

/** A refusal one pool init names by code. */
export class PoolTreeRefused extends Error {
  override readonly name = "PoolTreeRefused";
  constructor(readonly code: string, readonly detail: string) { super(`${code}: ${detail}`); }
}

/**
 * Run git in `cwd` with an empty global config and no system config. Every `GIT_*` name the caller's environment carries
 * leaves first: a pre-commit hook hands its child `GIT_DIR` and `GIT_INDEX_FILE`, and an author name in the environment
 * would outrank the pool's own local config.
 */
export function poolGit(cwd: string, args: readonly string[], input?: string): { readonly code: number; readonly out: string; readonly err: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env["GIT_CONFIG_GLOBAL"] = "/dev/null";
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  const r = spawnSync("git", [...args], { cwd, env, encoding: "utf8", ...(input !== undefined ? { input } : {}) });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? (r.error?.message ?? "") };
}

/** One local config value, or null where the pool sets none. */
function localConfig(root: string, key: string): string | null {
  const r = poolGit(root, ["config", "--local", "--get", key]);
  return r.code === 0 ? r.out.trim() : null;
}

/** The marker the house's own pre-commit hook carries. */
const HOOK_MARK = "# lares surface: the roster check runs before every commit";
/** Where the vessel's image holds the CLI (`/app`, the image's WORKDIR; the host shim runs it as `node "$CLI"`). */
export const IN_IMAGE_CLI = "/app/packages/lares-cli/bin/lares.mjs";

/**
 * THE POOL-CHECK HOOK, ANSWERING ON BOTH SIDES. A pool commits on the host (`lares surface commit`, a hand) and in the vessel's
 * container (the sitting's seam), so the hook resolves the check by what stands: `lares` on PATH (the host), else the in-image
 * CLI under `node` (the container). Where neither stands it refuses in one line naming both: a skipped check would pass a
 * commit past the pool law unread.
 */
export function poolPreCommit(inImageCli: string = IN_IMAGE_CLI): string {
  return [
    "#!/bin/sh",
    `${HOOK_MARK} (\`lares surface init\` wrote this hook)`,
    "if command -v lares >/dev/null 2>&1; then exec lares surface check; fi",
    `if [ -f '${inImageCli}' ] && command -v node >/dev/null 2>&1; then exec node '${inImageCli}' surface check; fi`,
    `echo "lares surface: the pool check refuses this commit: no \\\`lares\\\` on PATH and no CLI at ${inImageCli} under node" >&2`,
    "exit 1",
    "",
  ].join("\n");
}

/** The pre-commit hook a pool's init writes. */
export const POOL_PRE_COMMIT = poolPreCommit();

/**
 * Re-read the house's hook in a standing pool: a hook the house wrote (its marker) that differs from `POOL_PRE_COMMIT` takes the
 * current one; a hook of another hand, and a pool with none, stay as they stand. Answers whether it rewrote.
 */
export function refreshPoolHook(root: string): boolean {
  const hook = join(root, ".git", "hooks", "pre-commit");
  let standing: string;
  try { standing = readFileSync(hook, "utf8"); } catch { return false; }
  if (!standing.includes(HOOK_MARK) || standing === POOL_PRE_COMMIT) return false;
  writeFileSync(hook, POOL_PRE_COMMIT);
  if ((statSync(hook).mode & 0o111) === 0) chmodSync(hook, 0o755);
  return true;
}

/**
 * THE AUTHOR EMAIL'S LOCAL PART: the pet name folded to lower-case Latin letters and digits, runs of anything else to one
 * `-`. A name with no Latin letter or digit left takes `face-` and the first eight hex of its NFC bytes' sha256, so two
 * such names never fold to one address. Never a real address: the domain reads `face.invalid`.
 */
export function faceEmailSlug(petname: string): string {
  const folded = petname.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (folded !== "") return folded;
  return `face-${createHash("sha256").update(petname.normalize("NFC"), "utf8").digest("hex").slice(0, 8)}`;
}

/** The domain a realm pool's author email carries: never a real address, and never a face's. */
export const REALM_EMAIL_DOMAIN = "realm.invalid";

/** What one init did: each thing it changed, and each thing it found standing and left. */
export interface PoolInitResult { readonly root: string; readonly changed: readonly string[]; readonly left: readonly string[] }

/** Make `root` a face pool for `petname`, changing only what does not already stand as the house writes it. */
export function initFacePool(root: string, petname: string): PoolInitResult {
  return initPool(root, { name: petname.normalize("NFC"), email: `${faceEmailSlug(petname)}@face.invalid` }, [], "the face root");
}

/**
 * Make the realm pool at `root` (a shared wiki's workbench) a pool under the WIKI's identity: author `<slug> <slug>@realm.invalid`,
 * never a face's, since its history interleaves the operator's faces' commits.
 */
export function initRealmPool(root: string, slug: string): PoolInitResult {
  return initPool(root, { name: slug, email: `${slug}@${REALM_EMAIL_DOMAIN}` }, REALM_EXCLUDE_LINES, "the realm root");
}

/** One pool's init, at either scale: the repository, its mode, the exclude block, the local author, the pool-check hook. */
function initPool(root: string, author: { readonly name: string; readonly email: string }, extraExclude: readonly string[], rootNoun: string): PoolInitResult {
  const changed: string[] = [], left: string[] = [];
  if (!existsSync(root)) { mkdirSync(root, { recursive: true }); changed.push(rootNoun); }
  const dotGit = join(root, ".git");
  if (!existsSync(join(dotGit, "HEAD"))) {
    const r = poolGit(root, ["init", "-q", "-b", "main"]);
    if (r.code !== 0) throw new PoolTreeRefused("surface-git-init-failed", `git init in ${root} answered ${r.code}: ${r.err.trim()}`);
    changed.push("git repository");
  }
  if ((statSync(dotGit).mode & 0o777) !== 0o700) { chmodSync(dotGit, 0o700); changed.push(".git mode 0700"); }
  const exclude = join(dotGit, "info", "exclude");
  const was = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
  const now = withExcludeBlock(was, extraExclude);
  if (now !== was) { mkdirSync(join(dotGit, "info"), { recursive: true }); writeFileSync(exclude, now); changed.push("info/exclude"); }
  const want: ReadonlyArray<readonly [string, string]> = [
    ["user.name", author.name],
    ["user.email", author.email],
    ["commit.gpgsign", "false"],
  ];
  for (const [key, value] of want) {
    if (localConfig(root, key) === value) continue;
    const r = poolGit(root, ["config", "--local", key, value]);
    if (r.code !== 0) throw new PoolTreeRefused("surface-git-config-failed", `git config --local ${key} in ${root} answered ${r.code}: ${r.err.trim()}`);
    changed.push(key);
  }
  const hook = join(dotGit, "hooks", "pre-commit");
  const standing = existsSync(hook) ? readFileSync(hook, "utf8") : null;
  if (standing !== null && !standing.includes(HOOK_MARK)) {
    left.push(`a pre-commit hook of another hand stands at ${hook}; add \`lares surface check\` to it by hand`);
  } else {
    if (standing !== POOL_PRE_COMMIT) { mkdirSync(join(dotGit, "hooks"), { recursive: true }); writeFileSync(hook, POOL_PRE_COMMIT); changed.push("hooks/pre-commit"); }
    if ((statSync(hook).mode & 0o111) === 0) { chmodSync(hook, 0o755); if (!changed.includes("hooks/pre-commit")) changed.push("hooks/pre-commit mode"); }
  }
  return { root, changed, left };
}

// ── the house founds what is missing ───────────────────────────────────────────────────────────────────────────

/** Whose pool a root holds: a face (by its pet name) or a realm's wiki (by its slug). */
export type PoolOwner = { readonly face: string } | { readonly realm: string };

/** What one ensure read: a tree founded now, one already standing (left as it stands, but for a house hook that differs from
 *  `POOL_PRE_COMMIT`, which it rewrote: `hook: "refreshed"`), or a root inside another history. */
export interface PoolTreeEnsured {
  readonly root: string;
  readonly reading: "founded" | "standing" | "inside-another-tree";
  readonly hook?: "refreshed";
}

/** The nearest folder at or above `p` that stands on disk. */
function nearestStanding(p: string): string {
  let at = p;
  while (!existsSync(at)) { const up = dirname(at); if (up === at) break; at = up; }
  return at;
}

/**
 * ENSURE THE POOL AT `root` IS A GIT TREE. A `.git` standing there leaves the pool as it stands (no config, exclude or history
 * touched), but a pre-commit hook the HOUSE wrote and differs from `POOL_PRE_COMMIT` takes it (`refreshPoolHook`), so every
 * house-hooked pool commits on the host and inside the container alike; a hook of another hand stays. A root inside another work tree founds
 * nothing; else the root takes its owner's init, laid where missing.
 */
export function ensurePoolTree(root: string, owner: PoolOwner): PoolTreeEnsured {
  if (existsSync(join(root, ".git"))) return refreshPoolHook(root) ? { root, reading: "standing", hook: "refreshed" } : { root, reading: "standing" };
  const above = poolGit(nearestStanding(root), ["rev-parse", "--is-inside-work-tree"]);
  if (above.code === 0 && above.out.trim() === "true") return { root, reading: "inside-another-tree" };
  if ("face" in owner) initFacePool(root, owner.face); else initRealmPool(root, owner.realm);
  return { root, reading: "founded" };
}

/** The log's line for one ensure: silent where the tree already stood. */
export function poolTreeLine(e: PoolTreeEnsured): string | null {
  if (e.reading === "founded") return `the house founds a git tree at ${e.root} (no remote)`;
  if (e.hook === "refreshed") return `the pool at ${e.root} re-reads the house's pre-commit hook (it answers on the host and in the container)`;
  if (e.reading === "inside-another-tree") return `${e.root} rests inside another git history, so the house founds no tree there`;
  return null;
}

/**
 * THE RE-STAND'S HEAL: each face root under `<projections>/faces/` (its folder named by its pet name) and each wiki folder
 * standing under a realm (`<projections>/realms/<realm pet name>/wikis/<slug>/`) takes its tree where none stands. A fault on
 * one pool names itself and the heal walks on.
 */
export function healPoolTrees(projections: string, log: (line: string) => void): PoolTreeEnsured[] {
  const out: PoolTreeEnsured[] = [];
  const tend = (root: string, owner: PoolOwner): void => {
    try {
      const e = ensurePoolTree(root, owner);
      out.push(e);
      const line = poolTreeLine(e);
      if (line !== null) log(line);
    } catch (err) { log(`the pool at ${root} took no tree: ${err instanceof Error ? err.message : String(err)}`); }
  };
  const faces = join(projections, FACES_PROJECTION_DIR);
  let names: string[] = [];
  try { names = readdirSync(faces); } catch { /* no face root stands */ }
  for (const n of names.sort()) {
    if (faceSegmentRefusal(n) !== null) continue;
    const root = join(faces, n);
    try { if (!statSync(root).isDirectory()) continue; } catch { continue; }
    tend(root, { face: n.normalize("NFC") });
  }
  for (const f of realmFoldersOnDisk(projections)) if (f.plane === "wikis") tend(join(f.base, f.slug), { realm: f.slug });
  return out;
}
