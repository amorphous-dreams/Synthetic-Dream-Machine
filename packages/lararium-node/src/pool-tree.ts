/**
 * pool-tree — ONE TREE PER ENTITY (operator rulings 2026-11-20: "We also need to idempotently make sure new faces or realms get
 * git trees." and "Approve the new git entity root model."). A nameless entity (a face, a realm, a bound workspace) owns ONE disk
 * root, and that root holds ONE git working tree: a face root `projections/faces/<pet name>/`, a realm root
 * `projections/realms/<realm pet name>/`, a workspace the operator binds. What rests inside a root (a realm's `wikis/<slug>/` and
 * `bags/<slug>/`, a face's `personal/<slug>/`) rides as a capability of that one tree, never a tree of its own. The pools take NO
 * remote (operator ruling), and nothing here ever rewrites a commit.
 *
 * ONE INIT, THREE SCALES. `initFacePool`, `initRealmPool` and `initWorkspacePool` make a root a pool, changing only what does not
 * already stand as the house writes it: the repository (`git init -b main`), `.git` at 0700, the house's ignore block in
 * `.git/info/exclude` (with the scale's own lines), the local author (a face: `<pet name> <folded>@face.invalid`; a realm:
 * `<pet name> <folded>@realm.invalid`; a workspace: `<slug> <slug>@realm.invalid`) with signing off, and the pre-commit hook that
 * runs the pool check. `lares surface init` runs it by hand.
 *
 * THE HOUSE FOUNDS WHAT IS MISSING (`ensurePoolTree`), idempotently, wherever it lays an entity root: the worn face's arm, a face
 * lit beside it, the mount's realm placement as it lays a wiki or bag folder, and the re-stand's heal over every face and realm
 * root on disk (`healPoolTrees`), so a root laid before this step stood takes its tree at the next boot with no hand act. A root
 * whose `.git` stands keeps its author, exclude and history as they stand (the operator's), and only a pre-commit hook the house
 * itself wrote re-reads the current one (`refreshPoolHook`: the hook answers on the host and inside the vessel's container, and
 * refuses where no check stands); a root resting inside another history (a house laid inside a checkout) founds nothing, since a
 * nested repo would split that history. A workspace takes its tree by hand alone.
 *
 * A TREE NESTED BELOW A REALM ROOT LIFTS INTO IT (`liftNestedTrees`): a `wikis/<slug>/` or `bags/<slug>/` folder holding its own
 * `.git` hands its history to the realm's one tree in one git-native act. The realm fetches the nested head, and one re-root
 * commit lays that head's tree under the folder's prefix (`git read-tree --prefix`) with the nested head as a parent, so every
 * commit stays reachable unchanged and the folder's uncommitted edits read as changes in the realm's tree; the nested git dir
 * then rests inside the realm's `.git/lifted/`, kept whole (its other refs, reflog and stash), never deleted.
 *
 * A WIKI MOVING BETWEEN REALMS (`commitRealmMove`) commits on each side: the tree it leaves takes the removal and the tree it lands
 * in takes the files, each commit's message naming both ends.
 *
 * Git always runs here with an empty global config and no system config, every `GIT_*` name stripped, so nothing written or
 * read reaches past the pool.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/face-pools
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { faceSegmentRefusal, FACES_PROJECTION_DIR, REALM_EXCLUDE_LINES, REALM_PLANES, REALMS_PROJECTION_DIR, WORKSPACE_EXCLUDE_LINES, withExcludeBlock } from "./bag-paths.js";

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
export function poolGit(cwd: string, args: readonly string[], input?: string, index?: string): { readonly code: number; readonly out: string; readonly err: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env["GIT_CONFIG_GLOBAL"] = "/dev/null";
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  // An act that builds a commit apart from the working index names its own index file (the lift, the move).
  if (index !== undefined) env["GIT_INDEX_FILE"] = index;
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
  return foldedSlug(petname, "face");
}

/** A pet name folded to an address's local part; a name with no Latin letter or digit takes `<kind>-` and eight hex of its hash. */
function foldedSlug(petname: string, kind: string): string {
  const folded = petname.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (folded !== "") return folded;
  return `${kind}-${createHash("sha256").update(petname.normalize("NFC"), "utf8").digest("hex").slice(0, 8)}`;
}

/** The domain a realm pool's author email carries: never a real address, and never a face's. */
export const REALM_EMAIL_DOMAIN = "realm.invalid";

/** The author a realm's one tree commits under: the realm's pet name, its address folded as a face's is (`realm-` where no Latin
 *  letter or digit stands). */
export function realmAuthor(petName: string): { readonly name: string; readonly email: string } {
  return { name: petName.normalize("NFC"), email: `${foldedSlug(petName, "realm")}@${REALM_EMAIL_DOMAIN}` };
}

/** What one init did: each thing it changed, and each thing it found standing and left. */
export interface PoolInitResult { readonly root: string; readonly changed: readonly string[]; readonly left: readonly string[] }

/** Make `root` a face pool for `petname`, changing only what does not already stand as the house writes it. */
export function initFacePool(root: string, petname: string): PoolInitResult {
  return initPool(root, { name: petname.normalize("NFC"), email: `${faceEmailSlug(petname)}@face.invalid` }, [], "the face root");
}

/**
 * Make the realm root at `root` (`projections/realms/<pet name>/`, the one tree over every wiki and bag folder it holds) a pool under
 * the REALM's identity (`realmAuthor`), never a face's, since its history interleaves the operator's faces' commits.
 */
export function initRealmPool(root: string, petName: string): PoolInitResult {
  return initPool(root, realmAuthor(petName), REALM_EXCLUDE_LINES, "the realm root");
}

/**
 * Make a workspace the operator binds for one wiki (a share row's `workspace`) a pool under the WIKI's identity:
 * `<slug> <slug>@realm.invalid`. A workspace stands as its own entity root, so its tree roots at its own top.
 */
export function initWorkspacePool(root: string, slug: string): PoolInitResult {
  return initPool(root, { name: slug, email: `${slug}@${REALM_EMAIL_DOMAIN}` }, WORKSPACE_EXCLUDE_LINES, "the workspace");
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

/** Whose root a pool holds: a face or a realm, each by its pet name. */
export type PoolOwner = { readonly face: string } | { readonly realm: string };

/** One tree the lift handed to a realm's: where it stood, its head (null where it held no commit), the re-root commit (null where
 *  the realm already held that head, or none stood), and where its git dir now rests. */
export interface LiftedTree { readonly from: string; readonly head: string | null; readonly commit: string | null; readonly keptAt: string }

/** What one ensure read: a tree founded now, one already standing (left as it stands, but for a house hook that differs from
 *  `POOL_PRE_COMMIT`, which it rewrote: `hook: "refreshed"`), or a root inside another history; and each nested tree it lifted. */
export interface PoolTreeEnsured {
  readonly root: string;
  readonly reading: "founded" | "standing" | "inside-another-tree";
  readonly hook?: "refreshed";
  readonly lifted?: readonly LiftedTree[];
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
  const lift = (): { lifted?: readonly LiftedTree[] } => {
    if (!("realm" in owner)) return {};
    const lifted = liftNestedTrees(root, owner.realm);
    return lifted.length > 0 ? { lifted } : {};
  };
  if (existsSync(join(root, ".git"))) {
    const hook = refreshPoolHook(root);
    return { root, reading: "standing", ...(hook ? { hook: "refreshed" as const } : {}), ...lift() };
  }
  const above = poolGit(nearestStanding(root), ["rev-parse", "--is-inside-work-tree"]);
  if (above.code === 0 && above.out.trim() === "true") return { root, reading: "inside-another-tree" };
  if ("face" in owner) initFacePool(root, owner.face); else initRealmPool(root, owner.realm);
  return { root, reading: "founded", ...lift() };
}

/** The log's line for one ensure: silent where the tree already stood and nothing lifted. */
export function poolTreeLine(e: PoolTreeEnsured): string | null {
  const parts: string[] = [];
  if (e.reading === "founded") parts.push(`the house founds a git tree at ${e.root} (no remote)`);
  if (e.hook === "refreshed") parts.push(`the pool at ${e.root} re-reads the house's pre-commit hook (it answers on the host and in the container)`);
  if (e.reading === "inside-another-tree") parts.push(`${e.root} rests inside another git history, so the house founds no tree there`);
  for (const l of e.lifted ?? []) {
    parts.push(l.head === null
      ? `the realm root ${e.root} lifts the tree at ${l.from}, which held no commit; its git dir rests at ${l.keptAt}`
      : `the realm root ${e.root} lifts the tree at ${l.from} into its one tree (head ${l.head.slice(0, 12)} kept${l.commit !== null ? `, re-rooted by ${l.commit.slice(0, 12)}` : ""}); its git dir rests at ${l.keptAt}`);
  }
  return parts.length === 0 ? null : parts.join("; ");
}

// ── one tree per entity: the lift and the move ────────────────────────────────────────────────────────────────

/** The commit `rev` names in the tree at `root`, or null (an unborn branch, no such rev). */
function revOf(root: string, rev: string): string | null {
  const r = poolGit(root, ["rev-parse", "--verify", "-q", `${rev}^{commit}`]);
  return r.code === 0 ? r.out.trim() : null;
}

/** One git step of a house act; a refusal names the act, the step and git's answer. */
function step(root: string, code: string, args: readonly string[], input?: string, index?: string): string {
  const r = poolGit(root, args, input, index);
  if (r.code !== 0) throw new PoolTreeRefused(code, `git ${args.join(" ")} in ${root} answered ${r.code}: ${r.err.trim()}`);
  return r.out.trim();
}

/**
 * ONE HOUSE COMMIT, built apart from the working index: `fill` lays the new tree into a scratch index seeded from HEAD (or empty on
 * an unborn branch), the commit takes HEAD and `parents` as its parents, and HEAD moves only where it still names what the act
 * read. The working index then takes the same paths under `prefix` (`sync`), so a hand's other staged paths stay as they stand.
 * No hook runs: the act moves the tree's shape, never a carrier's words. Answers the commit, or null where the tree reads unchanged.
 */
function houseCommit(root: string, o: { readonly code: string; readonly parents: readonly string[]; readonly message: string; readonly fill: (index: string) => void; readonly sync: () => void }): string | null {
  const head = revOf(root, "HEAD");
  const index = join(root, ".git", `lares-act-${process.pid}.index`);
  try {
    step(root, o.code, head !== null ? ["read-tree", head] : ["read-tree", "--empty"], undefined, index);
    o.fill(index);
    const tree = step(root, o.code, ["write-tree"], undefined, index);
    if (head !== null && o.parents.length === 0 && step(root, o.code, ["rev-parse", `${head}^{tree}`]) === tree) return null;
    const parents = [...(head !== null ? [head] : []), ...o.parents].flatMap((p) => ["-p", p]);
    const commit = step(root, o.code, ["commit-tree", tree, ...parents, "-F", "-"], o.message);
    step(root, o.code, ["update-ref", "-m", o.message.split("\n")[0]!, "HEAD", commit, head ?? ""]);
    o.sync();
    return commit;
  } finally { rmSync(index, { force: true }); }
}

/** Where a lifted git dir rests inside the realm's own `.git`: `lifted/<slug>.git` (a bag folder's `lifted/bags-<slug>.git`). */
function keptAtFor(root: string, plane: string, slug: string): string {
  const base = join(root, ".git", "lifted", plane === REALM_PLANES.wikis ? slug : `${plane}-${slug}`);
  let at = `${base}.git`;
  for (let n = 2; existsSync(at); n++) at = `${base}-${n}.git`;
  return at;
}

/**
 * LIFT EACH TREE NESTED BELOW A REALM ROOT into the realm's one tree (the realm's tree must stand). For each `wikis/<slug>/` and
 * `bags/<slug>/` folder holding its own `.git`: the realm fetches the nested head, one re-root commit lays that head's tree under
 * `<plane>/<slug>/` with the realm's head (where one stands) and the nested head as parents, the working index takes those paths,
 * and the nested git dir moves whole into `.git/lifted/`. A nested head the realm already holds takes no second commit (a lift a
 * fault cut short finishes), and a nested tree that held no commit moves aside with nothing to lift. Idempotent: a realm with no
 * nested tree lifts nothing.
 */
export function liftNestedTrees(root: string, petName: string): LiftedTree[] {
  const out: LiftedTree[] = [];
  if (!existsSync(join(root, ".git"))) return out;
  for (const plane of [REALM_PLANES.wikis, REALM_PLANES.bags]) {
    let slugs: string[] = [];
    try { slugs = readdirSync(join(root, plane), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort(); } catch { /* no such plane */ }
    for (const slug of slugs) {
      const from = join(root, plane, slug);
      if (!existsSync(join(from, ".git"))) continue;
      const prefix = `${plane}/${slug}`;
      const head = revOf(from, "HEAD");
      let commit: string | null = null;
      if (head !== null) {
        step(root, "pool-lift-fetch-failed", ["fetch", "-q", "--no-tags", "--no-write-fetch-head", from, head]);
        const realmHead = revOf(root, "HEAD");
        const held = realmHead !== null && poolGit(root, ["merge-base", "--is-ancestor", head, realmHead]).code === 0;
        if (!held) {
          const message = [
            `lar:///realm.lifts.a-tree/${slug} — the tree ${prefix}/ held lands in the realm "${petName.normalize("NFC")}"'s one tree, its history kept below`,
            "",
            `Lifted-From: ${prefix}/ (head ${head})`,
            `Kept-At: .git/lifted/ (the folder's whole git dir)`,
            "",
          ].join("\n");
          const relay = (index?: string): void => {
            step(root, "pool-lift-index-failed", ["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--", prefix], undefined, index);
            step(root, "pool-lift-index-failed", ["read-tree", `--prefix=${prefix}/`, head], undefined, index);
          };
          commit = houseCommit(root, { code: "pool-lift-commit-failed", parents: [head], message, fill: (index) => relay(index), sync: () => relay() });
        }
      }
      const keptAt = keptAtFor(root, plane, slug);
      mkdirSync(join(root, ".git", "lifted"), { recursive: true });
      renameSync(join(from, ".git"), keptAt);
      out.push({ from, head, commit, keptAt });
    }
  }
  return out;
}

/**
 * THE MOVE'S COMMIT on one side: the realm tree at `root` takes `<plane>/<slug>/` as it now stands on disk (gone, on the side the
 * wiki leaves; laid, on the side it lands in) under one message naming both ends. A side whose tree does not stand commits nothing;
 * a folder landing with its own `.git` lifts instead (`liftNestedTrees`). Answers the commit, or null.
 */
export function commitRealmMove(root: string, plane: string, slug: string, ends: { readonly from: string; readonly to: string; readonly fromRealm: string; readonly toRealm: string }): string | null {
  if (!existsSync(join(root, ".git"))) return null;
  const prefix = `${plane}/${slug}`;
  if (existsSync(join(root, prefix, ".git"))) return liftNestedTrees(root, ends.toRealm)[0]?.commit ?? null;
  const message = [
    `lar:///wiki.moves.between-realms/${slug} — ${prefix}/ leaves the realm "${ends.fromRealm}" and lands in the realm "${ends.toRealm}"`,
    "",
    `From: ${ends.from}`,
    `To: ${ends.to}`,
    "",
  ].join("\n");
  const relay = (index?: string): void => {
    step(root, "pool-move-index-failed", ["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--", prefix], undefined, index);
    if (existsSync(join(root, prefix))) step(root, "pool-move-index-failed", ["add", "-A", "--", prefix], undefined, index);
  };
  return houseCommit(root, { code: "pool-move-commit-failed", parents: [], message, fill: (index) => relay(index), sync: () => relay() });
}

/** A realm root renamed whole (`lares realm rename`): where its tree still commits under the former pet name's house author, it
 *  takes the new one; an author of another hand stays. */
export function retagRealmAuthor(root: string, fromPet: string, toPet: string): boolean {
  if (!existsSync(join(root, ".git"))) return false;
  const was = realmAuthor(fromPet), now = realmAuthor(toPet);
  if (localConfig(root, "user.email") !== was.email || localConfig(root, "user.name") !== was.name) return false;
  step(root, "surface-git-config-failed", ["config", "--local", "user.name", now.name]);
  step(root, "surface-git-config-failed", ["config", "--local", "user.email", now.email]);
  return true;
}

/**
 * THE RE-STAND'S HEAL: each face root under `<projections>/faces/` and each realm root under `<projections>/realms/` (each folder
 * named by its pet name) takes its tree where none stands, and a realm root lifts each tree nested below it. A fault on one root
 * names itself and the heal walks on.
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
  for (const [dir, owner] of [[FACES_PROJECTION_DIR, (n: string): PoolOwner => ({ face: n })], [REALMS_PROJECTION_DIR, (n: string): PoolOwner => ({ realm: n })]] as const) {
    const at = join(projections, dir);
    let names: string[] = [];
    try { names = readdirSync(at); } catch { /* no such root stands */ }
    for (const n of names.sort()) {
      if (faceSegmentRefusal(n) !== null) continue;
      const root = join(at, n);
      try { if (!statSync(root).isDirectory()) continue; } catch { continue; }
      tend(root, owner(n.normalize("NFC")));
    }
  }
  return out;
}
