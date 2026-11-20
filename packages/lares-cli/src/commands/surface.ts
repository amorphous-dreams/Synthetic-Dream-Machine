/**
 * `lares surface` — the face pool as a git working tree (face-pools #/shape, research/tideline-surface #/seam).
 *
 * ONE POOL PER FACE, KEYED BY PET NAME. Each face's private planes rest under `projections/faces/<pet name>/`
 * (`faceRoot`, `FACE_PLANES`), and that root holds the face's one git working tree: `.git` inside it (0700), the house's
 * one ignore list (`HOUSE_IGNORED`) in `.git/info/exclude` (the vessel's watch keeps that block current at each arm:
 * `tendPoolExclude`), a local author `<pet name> <slug>@face.invalid` with signing off, and a pre-commit hook that runs the pool check. Git always runs here with an empty global config and no system
 * config, so nothing this door writes or reads reaches past the pool.
 *
 *   - `init [--face N]`: make the worn (or named) face's root a pool; a second run changes nothing and says "already".
 *   - `check [--face N]`: the pool check over the repo standing here (or the named face's pool); exit 1 names each breach.
 *   - `open [--face N] [--launch]`: print (and run) `<editor> -n <face root> <realm pools>`; writes no workspace file. The
 *     editor reads from the house config tiddler `$:/config/lares/surface/Editor` (`<config>/surface-editor.tid`), else `code`.
 *   - `commit [--face N] [-m <seam>]`: stage only the paths whose disk bytes equal the synced base, and commit them under a
 *     `lar:` subject naming no face; a path standing off reads apart by name and stays unstaged. Never pushes.
 *   - `face [--face N]`: the face the house resolves and the pet name it wears (the host asks the vessel this alone).
 *
 * AND ONE POOL PER SHARED DOCUMENT (face-pools #/one-copy). A wiki several of the operator's own faces share (a cabal of one)
 * rests once, in its REALM's folder, named by the realm's local pet name (operator ruling 2026-11-19): the workbench mirror
 * `projections/realms/<realm pet name>/wikis/<slug>/`, or the workspace its share row names. Each wiki folder holds its OWN git
 * tree, `.git` at the folder's top, never one tree over the realm. `init --realm <realm pet name>` makes each wiki folder the
 * realm holds a pool under the wiki's identity (`<slug> <slug>@realm.invalid`), never a face's; `check` from one refuses a face root
 * inside it. A pet name binds nothing here: it is the human-scale grip on the crypto identities beneath it, so the check names no
 * pet-name row (an index file, an author, a remote); it guards crypto identity (a signing key two pools share) and structure
 * (one pool per face, no repo over the house's homes); `commit --realm <realm pet name>` stages each by
 * the synced base as the face commit does.
 *
 * A HOST VERB. The pools rest on the disk the house's projections rest on, so the door runs where that disk stands and git
 * never runs inside a container for a host pool ({@link surfaceHouse}). Where LAR_ROOT names the root (a dev or scratch
 * house, the vessel itself) every door reads it. Where none does and the operator's container house stands
 * (`~/.lares/lares-surface.env` naming LARES_HOUSE, the file the shim reads), the door reads the host's own spelling of
 * that house: projections and config under LARES_HOUSE, the Synced tree in LARES_HOUSE/hearth (its bases spelled as the
 * vessel spells them, `/lar/<class>/...`), and the face off the labels on disk (`projections/face-labels/`). It asks the
 * vessel, through the shim, only for a face no label settles (`surface face`). `check` reads the disk and local config
 * alone, so the pre-commit hook's bare `lares surface check` answers on the host with the vessel down.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/face-pools
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  faceRoot, faceSegmentRefusal, withExcludeBlock, KAPAE_EXT, REALM_EXCLUDE_LINES, FACES_PROJECTION_DIR, FACE_LABELS_DIR, FACE_PLANES, SyncedTree, type SyncedBase,
  larProjectionsHome, larConfigHome, larWorkspacesHome, syncedTreeDir, labelledRelations, readFaceLabel, REALMS_PROJECTION_DIR,
  REALM_PLANES, findRealmLabel, realmPlacement,
} from "@lararium/node";
import {
  ownPersonaPetname, carrierHash, digestsEqual, parseShareFile, SHARE_CONFIG_FILE,
  WORKSPACE_NAME_RE, type ShareEntry,
} from "@lararium/mesh";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { faceOption, FaceOptionMalformed } from "../face-option.js";
import { sealedAct } from "../sealed-act-door.js";
import { openSyncedTree, readCarrierText } from "../ingest-core.js";
import { sealedPetnameStore } from "../sealed-records.js";
import { makeFleetPetnameStore } from "../daemon-persona-store.js";
import type { ParsedArgs } from "../parse-args.js";
import { envValue, IN_CONTAINER_ENV, surfaceEnvPath } from "../surface-env.js";
import { locateShim, SHIM_ABSENT_EXIT } from "../shim-locate.js";

// ── the doors ───────────────────────────────────────────────────────────────────────────────────────────────

/** A face as this door acts on it: its persona index and the pet name its root folder carries. */
export interface SurfaceFace { readonly index: number; readonly petname: string }

/** What `lares surface` reads from the house, injectable for a scratch house. */
export interface SurfaceDoors {
  /** The face the command acts as: `--face N`, else the worn one. */
  face(args: ParsedArgs): Promise<SurfaceFace>;
  /** The house's projections home. */
  projections(): string;
  /** The house's config home. */
  config(): string;
  /** The vessel's Synced tree (the merge bases). */
  tree(): SyncedTree;
  /** Where the command runs (`check` with no `--face` reads the repo standing here). */
  cwd(): string;
  /** Run a command line on this machine (`open --launch`); answers its exit code, {@link EDITOR_ABSENT_EXIT} where no such binary stands. */
  launch(argv: readonly string[]): number;
  /** The spelling a synced base carries for a file this door reads (the vessel's own, where it spells the house apart). */
  basePath(file: string): string;
  /** The directory a workspace name binds on this machine, or null where it binds none. */
  workspace(name: string): string | null;
}

/** A directory standing at `dir`, else null. */
const dirOrNull = (dir: string): string | null => { try { return statSync(dir).isDirectory() ? dir : null; } catch { return null; } };

/** The doors over the house LAR_ROOT names: the vessel's own reading, and a dev or scratch house's. */
export const LIVE_SURFACE_DOORS: SurfaceDoors = {
  face: async (args) => {
    // THE WORN FACE: with no `--face` the door acts as the face the operator wears (the daemon mount), so several faces
    // standing open with one worn answer that one; the vessel refuses by name only when none stands worn.
    const index = faceOption(args).face ?? (await sealedAct<{ face: number }>("face.resolve", { worn: true })).face;
    const petname = await ownPersonaPetname(makeFleetPetnameStore(sealedPetnameStore()), index);
    if (petname === undefined || petname.trim() === "") throw new SurfaceRefused("surface-face-unnamed", `the face h${index} wears no pet name, so it makes no folder under faces/: name it (\`lares persona new ${index} --name <label>\`)`);
    return { index, petname };
  },
  projections: () => larProjectionsHome(),
  config: () => larConfigHome(),
  tree: () => openSyncedTree(),
  cwd: () => process.cwd(),
  launch: (argv) => {
    const r = spawnSync(argv[0]!, argv.slice(1), { stdio: "inherit" });
    return (r.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT" ? EDITOR_ABSENT_EXIT : r.status ?? 1;
  },
  basePath: (file) => resolve(file),
  workspace: (name) => dirOrNull(join(larWorkspacesHome(), name)),
};

// ── the house, where the door runs ───────────────────────────────────────────────────────────────────────

/** Where the house stands for this door: the root LAR_ROOT names, or the container house's host root. */
export type SurfaceHouse = { readonly kind: "root" } | { readonly kind: "host"; readonly house: string };

/**
 * THE HOUSE THIS DOOR READS. LAR_ROOT named (or the vessel's own marker standing): that root, as every house door reads it.
 * Neither, with LARES_HOUSE named (the environment first, else the env file the shim reads): the container house's host
 * root, an absolute path. None of those: a refusal by name.
 */
export function surfaceHouse(env: Readonly<Record<string, string | undefined>> = process.env): SurfaceHouse {
  if ((env["LAR_ROOT"] ?? "").trim() !== "" || (env[IN_CONTAINER_ENV] ?? "").trim() !== "") return { kind: "root" };
  const envFile = surfaceEnvPath(env);
  let text: string | null = null;
  try { text = envFile === null ? null : readFileSync(envFile, "utf8"); } catch { text = null; }
  const house = envValue("LARES_HOUSE", env, text);
  if (house.startsWith("/")) return { kind: "host", house: resolve(house) };
  throw new SurfaceRefused("surface-house-unnamed", `LAR_ROOT names no house root and no container house stands (${envFile ?? "~/.lares/lares-surface.env"} names no absolute LARES_HOUSE): set LAR_ROOT, or name LARES_HOUSE there`);
}

/** The classes the container house binds from LARES_HOUSE at `/lar/<class>` (`tools/lares-container.sh`). */
const BOUND_CLASSES = ["hearth", "sensoriums", "projections", "library", "config"] as const;

/** A host file under LARES_HOUSE as the vessel spells it (`/lar/<class>/...`); a file under no bound class keeps its own. */
export function vesselSpelling(house: string, file: string): string {
  const abs = resolve(file);
  for (const top of new Set([resolve(house), real(house)])) {
    for (const c of BOUND_CLASSES) {
      const dir = join(top, c);
      if (within(abs, dir)) return posix.join("/lar", c, ...relative(dir, abs).split(sep));
    }
  }
  return abs;
}

/** What the vessel answered a forwarded line: its exit code and its stdout. */
export type VesselAsk = (argv: readonly string[]) => { readonly code: number; readonly out: string };

/** Ask the vessel one line through the checkout's shim (the bridge's own door), stdout read back, stderr and stdin the terminal's. */
const SHIM_ASK: VesselAsk = (argv) => {
  const shim = locateShim();
  if (shim === null) return { code: SHIM_ABSENT_EXIT, out: "" };
  const r = spawnSync("/bin/sh", [shim, ...argv], { stdio: ["inherit", "pipe", "inherit"], encoding: "utf8" });
  return { code: r.status ?? 1, out: r.stdout ?? "" };
};

/**
 * THE FACE THE LABELS SETTLE: the one (index, pet name) the face labels under `projections` name, for `index` where the
 * command names one. None, or several (two faces, or one index under two pet names), settles nothing: null.
 */
export function labelledFace(projections: string, index?: number): SurfaceFace | null {
  const seen = new Map<string, SurfaceFace>();
  for (const relation of labelledRelations(projections)) {
    const label = readFaceLabel(relation, projections);
    if (label === null || label.petname.trim() === "" || (index !== undefined && label.handleIndex !== index)) continue;
    const petname = label.petname.normalize("NFC");
    seen.set(`${label.handleIndex}\0${petname}`, { index: label.handleIndex, petname });
  }
  return seen.size === 1 ? [...seen.values()][0]! : null;
}

/** One answer of the vessel's `surface face --json`, as it rests on stdout's last line. */
interface FaceAnswer { readonly ok?: boolean; readonly data?: { readonly face?: unknown; readonly petname?: unknown }; readonly error?: { readonly code?: unknown; readonly message?: unknown } }

/**
 * THE WORKSPACES THE HOST BINDS: each `<name>=<dir>` pair LARES_WORKSPACES names (the environment first, else the env file the
 * shim reads), the very directories the shim binds at `/lar/workspaces/<name>`. A pair naming no absolute directory reads none.
 */
export function hostWorkspaces(env: Readonly<Record<string, string | undefined>>): ReadonlyMap<string, string> {
  const envFile = surfaceEnvPath(env);
  let text: string | null = null;
  try { text = envFile === null ? null : readFileSync(envFile, "utf8"); } catch { text = null; }
  const out = new Map<string, string>();
  for (const pair of envValue("LARES_WORKSPACES", env, text).split(";")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    const name = pair.slice(0, at).trim(), dir = pair.slice(at + 1).trim();
    if (WORKSPACE_NAME_RE.test(name) && dir.startsWith("/") && !out.has(name)) out.set(name, resolve(dir));
  }
  return out;
}

/** The doors over the container house's host root: everything off this disk, the face alone from the vessel. */
export function hostSurfaceDoors(house: string, ask: VesselAsk = SHIM_ASK, env: Readonly<Record<string, string | undefined>> = process.env): SurfaceDoors {
  const projections = join(house, "projections");
  const workspaces = hostWorkspaces(env);
  return {
    face: async (args) => {
      const named = faceOption(args).face;
      const settled = labelledFace(projections, named);
      if (settled !== null) return settled;
      const line = ["surface", "face", "--json", ...(named !== undefined ? ["--face", String(named)] : [])];
      const r = ask(line);
      let answer: FaceAnswer | null = null;
      try { answer = JSON.parse(r.out.trim().split("\n").pop() ?? "") as FaceAnswer; } catch { answer = null; }
      const data = answer?.data;
      if (answer?.ok === true && typeof data?.face === "number" && typeof data.petname === "string" && data.petname.trim() !== "") {
        return { index: data.face, petname: data.petname };
      }
      if (answer?.ok === false && typeof answer.error?.code === "string") throw new SurfaceRefused(answer.error.code, String(answer.error.message ?? ""));
      throw new SurfaceRefused("surface-face-unanswered", `no face label under ${join(projections, FACE_LABELS_DIR)} settles ${named !== undefined ? `the face h${named}` : "the face"}, and the vessel answered \`lares ${line.join(" ")}\` with ${r.code}: stand the vessel (\`lares up\`), or name a labelled face (\`--face N\`)`);
    },
    projections: () => projections,
    config: () => join(house, "config"),
    tree: () => new SyncedTree(syncedTreeDir(join(house, "hearth", "checkpoints", "projection"))),
    cwd: () => process.cwd(),
    launch: LIVE_SURFACE_DOORS.launch,
    basePath: (file) => {
      for (const [name, dir] of workspaces) {
        for (const top of new Set([dir, real(dir)])) if (within(resolve(file), top)) return posix.join("/lar/workspaces", name, ...relative(top, resolve(file)).split(sep));
      }
      return vesselSpelling(house, file);
    },
    workspace: (name) => { const dir = workspaces.get(name); return dir === undefined ? null : dirOrNull(dir); },
  };
}

/** The doors for this process: the root's where LAR_ROOT names one, else the container house's host root. */
export function liveSurfaceDoors(env: Readonly<Record<string, string | undefined>> = process.env, ask: VesselAsk = SHIM_ASK): SurfaceDoors {
  let house: SurfaceHouse;
  try { house = surfaceHouse(env); } catch (err) {
    const refuse = (): never => { throw err; };
    return { face: async () => refuse(), projections: refuse, config: refuse, tree: refuse, cwd: () => process.cwd(), launch: LIVE_SURFACE_DOORS.launch, basePath: refuse, workspace: refuse };
  }
  return house.kind === "root" ? LIVE_SURFACE_DOORS : hostSurfaceDoors(house.house, ask, env);
}

/** A refusal this door names by code. */
export class SurfaceRefused extends Error {
  override readonly name = "SurfaceRefused";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

// ── git, walled ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Run git in `cwd` with an empty global config and no system config. Every `GIT_*` name the caller's environment carries
 * leaves first: a pre-commit hook hands its child `GIT_DIR` and `GIT_INDEX_FILE`, and an author name in the environment
 * would outrank the pool's own local config.
 */
export function surfaceGit(cwd: string, args: readonly string[], input?: string): { readonly code: number; readonly out: string; readonly err: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env["GIT_CONFIG_GLOBAL"] = "/dev/null";
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  const r = spawnSync("git", [...args], { cwd, env, encoding: "utf8", ...(input !== undefined ? { input } : {}) });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? (r.error?.message ?? "") };
}

/** One local config value, or null where the pool sets none. */
function localConfig(root: string, key: string): string | null {
  const r = surfaceGit(root, ["config", "--local", "--get", key]);
  return r.code === 0 ? r.out.trim() : null;
}

// ── init ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The marker the house's own pre-commit hook carries. */
const HOOK_MARK = "# lares surface: the roster check runs before every commit";
/** The pre-commit hook `init` writes. */
export const SURFACE_PRE_COMMIT = `#!/bin/sh\n${HOOK_MARK} (\`lares surface init\` wrote this hook)\nexec lares surface check\n`;

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

/** What one init did: each thing it changed, and each thing it found standing and left. */
export interface SurfaceInitResult { readonly root: string; readonly changed: readonly string[]; readonly left: readonly string[] }

/** Make `root` a face pool for `petname`, changing only what does not already stand as the house writes it. */
export function surfaceInit(root: string, petname: string): SurfaceInitResult {
  return initPool(root, { name: petname.normalize("NFC"), email: `${faceEmailSlug(petname)}@face.invalid` }, [], "the face root");
}

/** The domain a realm pool's author email carries: never a real address, and never a face's. */
export const REALM_EMAIL_DOMAIN = "realm.invalid";

/**
 * Make the realm pool at `root` (a shared wiki's workbench, standing) a pool under the REALM's identity: author
 * `<slug> <slug>@realm.invalid`, never a face's, since its history interleaves the operator's faces' commits.
 */
export function surfaceInitRealm(root: string, slug: string): SurfaceInitResult {
  return initPool(root, { name: slug, email: `${slug}@${REALM_EMAIL_DOMAIN}` }, REALM_EXCLUDE_LINES, "the realm root");
}

/** One pool's init, at either scale: the repository, its mode, the exclude block, the local author, the pool-check hook. */
function initPool(root: string, author: { readonly name: string; readonly email: string }, extraExclude: readonly string[], rootNoun: string): SurfaceInitResult {
  const changed: string[] = [], left: string[] = [];
  if (!existsSync(root)) { mkdirSync(root, { recursive: true }); changed.push(rootNoun); }
  const dotGit = join(root, ".git");
  if (!existsSync(join(dotGit, "HEAD"))) {
    const r = surfaceGit(root, ["init", "-q", "-b", "main"]);
    if (r.code !== 0) throw new SurfaceRefused("surface-git-init-failed", `git init in ${root} answered ${r.code}: ${r.err.trim()}`);
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
    const r = surfaceGit(root, ["config", "--local", key, value]);
    if (r.code !== 0) throw new SurfaceRefused("surface-git-config-failed", `git config --local ${key} in ${root} answered ${r.code}: ${r.err.trim()}`);
    changed.push(key);
  }
  const hook = join(dotGit, "hooks", "pre-commit");
  const standing = existsSync(hook) ? readFileSync(hook, "utf8") : null;
  if (standing !== null && !standing.includes(HOOK_MARK)) {
    left.push(`a pre-commit hook of another hand stands at ${hook}; add \`lares surface check\` to it by hand`);
  } else {
    if (standing !== SURFACE_PRE_COMMIT) { mkdirSync(join(dotGit, "hooks"), { recursive: true }); writeFileSync(hook, SURFACE_PRE_COMMIT); changed.push("hooks/pre-commit"); }
    if ((statSync(hook).mode & 0o111) === 0) { chmodSync(hook, 0o755); if (!changed.includes("hooks/pre-commit")) changed.push("hooks/pre-commit mode"); }
  }
  return { root, changed, left };
}

// ── check ──────────────────────────────────────────────────────────────────────────────────────────────────

/** One breach the pool check names. */
export interface SurfaceBreach { readonly code: string; readonly message: string }

const real = (p: string): string => { try { return realpathSync(p); } catch { return resolve(p); } };
/** `inner` stands at or below `outer`. */
const within = (inner: string, outer: string): boolean => { const r = relative(outer, inner); return r === "" || (!r.startsWith("..") && !r.startsWith(sep) && r !== ".."); };

/** The face roots standing in this house: each folder under `projections/faces/`. */
function houseFaceRoots(projections: string): string[] {
  const faces = join(projections, FACES_PROJECTION_DIR);
  let names: string[];
  try { names = readdirSync(faces); } catch { return []; }
  return names.filter((n) => faceSegmentRefusal(n) === null).map((n) => join(faces, n)).filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } });
}

/** THE POOL CHECK over the repo whose top stands at `top`, in a house whose homes are `projections` and `config`. */
export function surfaceCheck(top: string, projections: string, config: string): SurfaceBreach[] {
  const breaches: SurfaceBreach[] = [];
  const at = real(top);
  for (const home of [projections, config]) {
    if (within(real(home), at)) breaches.push({ code: "surface-house-root", message: `the repo at ${at} holds the house's ${home}: no repo roots at projections/ or config/ (one pool per face, under faces/<pet name>/)` });
  }
  // ONE TREE PER WIKI FOLDER: a repo at `realms/`, a realm's root or its `wikis/` would hold several wikis' histories in one.
  const realms = real(join(projections, REALMS_PROJECTION_DIR));
  const overRealm = relative(realms, at);
  if (within(at, realms) && (overRealm === "" || overRealm.split(sep).length < 3)) breaches.push({ code: "surface-realm-tree", message: `the repo at ${at} spans a realm's wikis: each wiki folder (projections/realms/<realm pet name>/wikis/<slug>/) holds its own .git, never one tree over the realm` });
  const roots = houseFaceRoots(projections).map((p) => ({ path: real(p), petname: p.slice(p.lastIndexOf(sep) + 1) }));
  for (const other of roots) {
    if (other.path !== at && within(other.path, at)) breaches.push({ code: "surface-other-face", message: `the repo at ${at} holds the face "${other.petname}"'s root ${other.path}: one pool per face` });
  }
  const signing = localConfig(at, "user.signingkey");
  for (const other of roots) {
    if (other.path === at || within(at, other.path) || within(other.path, at) || !existsSync(join(other.path, ".git"))) continue;
    const theirKey = localConfig(other.path, "user.signingkey");
    if (signing !== null && signing !== "" && theirKey === signing) breaches.push({ code: "surface-signing-key-shared", message: `the signing key also signs the face "${other.petname}"'s pool (${other.path}): each face signs with its own` });
  }
  return breaches;
}

// ── the realm pool ─────────────────────────────────────────────────────────────────────────────────────────

/** The share rows the house's config holds (`config/share.tid`); none where no file stands or it reads malformed. */
export function houseShareRows(config: string): ShareEntry[] {
  try { return parseShareFile(readFileSync(join(config, SHARE_CONFIG_FILE), "utf8")); } catch { return []; }
}

/** One wiki pool a realm holds: the wiki's slug and the folder its tree roots at. */
export interface RealmPool { readonly slug: string; readonly root: string }

/**
 * THE WIKI POOLS A NAMED REALM HOLDS: for each wiki its label names, the workspace its share row names (where that workspace binds
 * here), else its workbench folder `<projections>/realms/<realm pet name>/wikis/<slug>` (where it stands, `realmPlacement`). A
 * pet name no label carries refuses by name; a row naming a workspace that binds nowhere refuses by name.
 */
export function realmPoolsOf(doors: SurfaceDoors, petName: string): { readonly petName: string; readonly pools: readonly RealmPool[] } {
  const projections = doors.projections();
  const label = findRealmLabel(projections, petName);
  if (label === null) throw new SurfaceRefused("surface-realm-unnamed", `no realm on this house wears the pet name ${JSON.stringify(petName)}: \`lares realm list\` names them`);
  const rows = houseShareRows(doors.config());
  const at = realmPlacement(projections);
  const pools = label.realms.map(({ slug }) => {
    const name = rows.find((r) => r.kind === "wiki" && r.slug === slug)?.workspace?.trim();
    if (name) {
      const dir = doors.workspace(name);
      if (dir === null) throw new SurfaceRefused("surface-realm-workspace-unbound", `the share row for "${slug}" names the workspace "${name}", and it binds no directory here: bind it (\`--workspace ${name}=<dir>\` at \`up\`, or LARES_WORKSPACES)`);
      return { slug, root: dir };
    }
    return { slug, root: join(at.wikisBase(slug) ?? join(projections, REALMS_PROJECTION_DIR, label.petName, REALM_PLANES.wikis), slug) };
  });
  return { petName: label.petName, pools };
}

/** The wiki a repo top stands as: the slug whose pool roots exactly there (a realm's wiki folder, or a share row's workspace),
 *  else null (a face pool, or no pool). */
export function realmAt(top: string, doors: SurfaceDoors): string | null {
  const at = real(top);
  const realms = real(join(doors.projections(), REALMS_PROJECTION_DIR));
  const parts = relative(realms, at).split(sep);
  if (within(at, realms) && parts.length === 3 && parts[1] === REALM_PLANES.wikis) return parts[2]!;
  for (const row of houseShareRows(doors.config())) {
    const name = row.workspace?.trim();
    if (row.kind !== "wiki" || !name) continue;
    let dir: string | null = null;
    try { dir = doors.workspace(name); } catch { dir = null; }
    if (dir !== null && real(dir) === at) return row.slug;
  }
  return null;
}

/** What the realm check found: each breach, and each warning it names without refusing. */
export interface RealmCheck { readonly breaches: readonly SurfaceBreach[]; readonly warnings: readonly string[] }

/**
 * THE REALM CHECK over the realm pool for `slug` whose top stands at `top`. Beside the pool check's house-wide rows (no repo at
 * projections/ or config/, no house face root inside, no repo spanning a realm's wikis), it refuses a `faces/` folder at
 * the pool's top: a face root rests in its own pool, never inside a realm's. A pet name binds nothing: an author naming a face, an
 * index file and a remote on a cabal of one's realm all pass, since a realm pool commits unsigned under the wiki's identity and
 * carries no crypto identity a remote could join.
 */
export function surfaceCheckRealm(top: string, slug: string, projections: string, config: string): RealmCheck {
  const at = real(top);
  const breaches: SurfaceBreach[] = surfaceCheck(top, projections, config).filter((b) => b.code !== "surface-signing-key-shared");
  if (existsSync(join(at, FACES_PROJECTION_DIR))) breaches.push({ code: "surface-realm-face-root", message: `${join(at, FACES_PROJECTION_DIR)} stands inside the realm pool "${slug}": a face root rests in its own pool (projections/faces/<pet name>/), never in a realm's` });
  return { breaches, warnings: [] };
}

// ── open ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * THE REALM POOLS A FACE BELONGS TO, as its own root reads them: each wiki slug it keeps a personal layer or a recovery folder for
 * (`personal/<slug>/`, `recovery/<slug>/`), mapped to that wiki's workbench folder in the realm that holds it
 * (`projections/realms/<realm pet name>/wikis/<slug>/`) where it stands. A slug whose workbench stands nowhere names no root.
 */
export function realmPools(projections: string, root: string): string[] {
  const slugs = new Set<string>();
  for (const plane of [FACE_PLANES.personal, FACE_PLANES.recovery]) {
    let names: string[] = [];
    try { names = readdirSync(join(root, plane)); } catch { /* no such plane yet */ }
    for (const n of names) { try { if (statSync(join(root, plane, n)).isDirectory()) slugs.add(n); } catch { /* left since the listing */ } }
  }
  const at = realmPlacement(projections);
  return [...slugs].sort().map((s) => { const base = at.wikisBase(s); return base === null ? null : join(base, s); })
    .filter((p): p is string => { try { return p !== null && statSync(p).isDirectory(); } catch { return false; } });
}

/**
 * THE EDITOR `surface open` RUNS, a house setting the operator keeps: the config tiddler `$:/config/lares/surface/Editor`, whose
 * text names the command (`code-insiders`, or several words, as `flatpak run com.visualstudio.code`). It rests in the house's
 * config home beside the share rows (`<config>/surface-editor.tid`, a .tid a person edits by hand), which the host reads with the
 * vessel down and a re-founding keeps. A file that holds no such tiddler, or names no command, reads the default `code`.
 */
export const SURFACE_EDITOR_TITLE = "$:/config/lares/surface/Editor";
export const SURFACE_EDITOR_FILE = "surface-editor.tid";
export const SURFACE_EDITOR_DEFAULT = "code";
/** The exit a launch answers where this machine holds no binary by the editor's name (the shell's own "command not found"). */
export const EDITOR_ABSENT_EXIT = 127;

/** The editor command's words, off the house config tiddler, else the default. */
export function surfaceEditor(config: string): string[] {
  let text: string;
  try { text = readFileSync(join(config, SURFACE_EDITOR_FILE), "utf8"); } catch { return [SURFACE_EDITOR_DEFAULT]; }
  const at = text.replace(/\r\n/g, "\n").indexOf("\n\n");
  const head = at < 0 ? text : text.slice(0, at), body = at < 0 ? "" : text.slice(at + 2);
  const title = /^title:\s*(.*)$/m.exec(head)?.[1]?.trim();
  const words = (body.split("\n").find((l) => l.trim() !== "") ?? "").trim().split(/\s+/).filter((w) => w !== "");
  return title === SURFACE_EDITOR_TITLE && words.length > 0 ? words : [SURFACE_EDITOR_DEFAULT];
}

/** The one window line: the editor's words and `-n` over the face's root, then its realm pools. */
export function surfaceOpenArgv(root: string, pools: readonly string[], editor: readonly string[] = [SURFACE_EDITOR_DEFAULT]): string[] {
  return [...editor, "-n", root, ...pools];
}

/** A word as a POSIX shell reads it back unchanged. */
const shellWord = (w: string): string => /^[A-Za-z0-9_./:=@%+-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`;

// ── commit ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A path the commit left unstaged, and why. */
export interface SurfaceApart { readonly path: string; readonly why: string }

/** What one commit did. */
export interface SurfaceCommitResult {
  /** The paths it staged and committed (posix, relative to the pool). */
  readonly staged: readonly string[];
  /** The carrier URIs whose bytes it kept. */
  readonly carriers: readonly string[];
  /** The titles whose kāpae shadow it kept: the house's own write of each, carried as set aside, never as a live page. */
  readonly kapae: readonly string[];
  /** The content paths it kept as removals (the house holds no base there). */
  readonly removed: readonly string[];
  /** The paths standing off the house, each named. */
  readonly apart: readonly SurfaceApart[];
  /** The commit it made, or null where nothing agreed. */
  readonly commit: string | null;
  readonly subject: string | null;
}

/** The changed paths `git status` reads in the pool, posix and relative (a rename yields both its paths). */
function changedPaths(root: string): string[] {
  const r = surfaceGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (r.code !== 0) throw new SurfaceRefused("surface-git-status-failed", `git status in ${root} answered ${r.code}: ${r.err.trim()}`);
  const tokens = r.out.split("\0");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.length < 4) continue;
    out.push(t.slice(3));
    if (t[0] === "R" || t[0] === "C") { const from = tokens[++i]; if (from) out.push(from); }
  }
  return [...new Set(out)];
}

/** Whether the house agrees with the file at `file`: the URI (a carrier's, or the title a shadow sets aside) where it does,
 *  else why not. `lone` marks a carrier the house wrote as its `.meta` alone (a pointer whose body the tier lacked). */
type Agreement = { readonly ok: true; readonly uri: string | null; readonly lone?: true } | { readonly ok: false; readonly why: string };

/** The rows a commit weighs, each list keyed by the path its agreement stands at. */
type BasesAt = ReadonlyMap<string, ReadonlyArray<{ readonly uri: string; readonly base: SyncedBase }>>;

/**
 * THE AGREEMENT TEST, as the ingest gesture's scan reads a file: the carrier's bytes (utf8 text, or base64 for a binary
 * one) with its `.meta` sidecar folded in, hashed whole, against the disk side of each base standing at that very path.
 * A file gone from disk agrees only where no base stands there (the house already removed it); where one stands, the
 * shore holds it pending, unless the base names the sidecar alone (an empty body beside the `.meta`, as the projector
 * writes a pointer whose bytes the tier lacks) and the sidecar still holds those bytes.
 */
function agreementAt(file: string, bases: BasesAt, spell: (file: string) => string): Agreement {
  const standing = bases.get(spell(file)) ?? []; // the one spelling a base carries (`syncedPath`: absolute, normalized, symlinks unread)
  let meta: string | undefined;
  try { if (existsSync(`${file}.meta`)) meta = readFileSync(`${file}.meta`, "utf8"); } catch { /* no readable sidecar */ }
  if (!existsSync(file)) {
    if (standing.length === 0) return { ok: true, uri: null };
    const lone = meta === undefined ? undefined : standing.find((s) => digestsEqual(carrierHash("", meta), s.base.disk));
    return lone !== undefined
      ? { ok: true, uri: lone.uri, lone: true }
      : { ok: false, why: "vanished where a base stands: the shore holds it pending (`lares shore`)" };
  }
  if (standing.length === 0) return { ok: false, why: "no base: the house holds no agreement at this path" };
  let text: string;
  try { ({ text } = readCarrierText(file)); } catch { return { ok: false, why: "unreadable on disk" }; }
  const disk = carrierHash(text, meta);
  const agreed = standing.find((s) => digestsEqual(disk, s.base.disk));
  return agreed !== undefined
    ? { ok: true, uri: agreed.uri }
    : { ok: false, why: "stands off its base: the disk moved since the house agreed (`lares shore`)" };
}

/**
 * THE SHADOW TEST (`SyncedTree.shadows`): a kāpae shadow agrees where its bytes equal the house's own last write of it.
 * A shadow gone from disk agrees only where the house's memory of it left too (the house lowered it); a shadow the house
 * holds no memory of, and one whose bytes moved since, each stand off by name, as a live page does.
 */
function shadowAgreementAt(file: string, shadows: BasesAt, spell: (file: string) => string): Agreement {
  const standing = shadows.get(spell(file)) ?? [];
  if (!existsSync(file)) {
    return standing.length === 0
      ? { ok: true, uri: null }
      : { ok: false, why: "a kāpae shadow vanished where the house still holds its write: no hand of the house removed it" };
  }
  if (standing.length === 0) return { ok: false, why: "a kāpae shadow the house holds no write of" };
  let text: string;
  try { text = readFileSync(file, "utf8"); } catch { return { ok: false, why: "unreadable on disk" }; }
  const agreed = standing.find((s) => digestsEqual(carrierHash(text), s.base.disk));
  return agreed !== undefined
    ? { ok: true, uri: agreed.uri }
    : { ok: false, why: "a kāpae shadow stands off the house's write of it: the bytes moved by hand" };
}

/** Fold tree rows into lists keyed by the path each agreement stands at. */
function basesByPath(rows: ReadonlyArray<{ readonly uri: string; readonly base: SyncedBase }>): BasesAt {
  const bases = new Map<string, Array<{ uri: string; base: SyncedBase }>>();
  for (const row of rows) {
    const list = bases.get(row.base.path) ?? [];
    list.push({ uri: row.uri, base: row.base });
    bases.set(row.base.path, list);
  }
  return bases;
}

/** A seam names one slug. */
const SEAM = /^[a-z0-9][a-z0-9-]*$/;
/** The seam a commit by hand names where none is given. */
export const HAND_SEAM = "by-hand";

/**
 * KEEP THE SITTING: stage only the pool paths the house already agrees with, and commit them under
 * `lar:///surface.keeps.the-sitting/<seam> — N carriers`, the carrier URIs in the body, the author from the pool's local
 * config. `spell` names a file as the bases spell it (the vessel's `/lar/...` where the door runs on the host). A `.meta` sidecar rides with its carrier.
 * A kāpae shadow (`.kapae`) stages where its bytes equal the house's own last write of it (`SyncedTree.shadows`), and its
 * removal where the house's memory of it left, so the pool's history carries each kāpae as set aside. A path the operator staged by hand that stands off stays staged and
 * out of this commit (the commit names its paths). Never pushes.
 */
export function surfaceCommit(root: string, tree: SyncedTree, seam: string = HAND_SEAM, spell: (file: string) => string = resolve): SurfaceCommitResult {
  if (!SEAM.test(seam)) throw new SurfaceRefused("surface-seam-malformed", `a seam names one slug (a-z, 0-9, -), never ${JSON.stringify(seam)}`);
  if (!existsSync(join(root, ".git"))) throw new SurfaceRefused("surface-no-pool", `no pool stands at ${root}: run \`lares surface init\` (\`--realm <realm pet name>\` for a realm's wikis)`);
  const bases = basesByPath(tree.rows()), shadows = basesByPath(tree.shadows().rows());
  const staged: string[] = [], apart: SurfaceApart[] = [], removed: string[] = [];
  const carriers = new Set<string>(), kapae = new Set<string>();
  const fileOf = (rel: string): string => join(root, ...rel.split("/"));
  for (const rel of changedPaths(root).sort()) {
    if (rel.endsWith(KAPAE_EXT)) {
      const agreement = shadowAgreementAt(fileOf(rel), shadows, spell);
      if (!agreement.ok) { apart.push({ path: rel, why: agreement.why }); continue; }
      staged.push(rel);
      if (agreement.uri !== null) kapae.add(agreement.uri); else removed.push(rel);
      continue;
    }
    const content = rel.endsWith(".meta") ? rel.slice(0, -".meta".length) : rel;
    const agreement = agreementAt(fileOf(content), bases, spell);
    if (!agreement.ok) { apart.push({ path: rel, why: agreement.why }); continue; }
    // A sidecar the house wrote alone vouches for itself, never for a body a hand removed beside it.
    if (agreement.ok && agreement.lone === true && content === rel) { apart.push({ path: rel, why: "vanished where a base stands: the shore holds it pending (`lares shore`)" }); continue; }
    staged.push(rel);
    if (agreement.uri !== null) carriers.add(agreement.uri);
    else if (content === rel) removed.push(rel);
  }
  if (staged.length === 0) return { staged, carriers: [], kapae: [], removed, apart, commit: null, subject: null };
  const add = surfaceGit(root, ["--literal-pathspecs", "add", "-A", "--", ...staged]);
  if (add.code !== 0) throw new SurfaceRefused("surface-git-add-failed", `git add in ${root} answered ${add.code}: ${add.err.trim()}`);
  const kept = [...carriers].sort(), shadowed = [...kapae].sort();
  const subject = `lar:///surface.keeps.the-sitting/${seam} — ${kept.length + shadowed.length + removed.length} carriers`;
  const message = [subject, "", ...kept, ...shadowed.map((t) => `Kapae: ${t}`), ...removed.map((r) => `Removed: ${r}`), ""].join("\n");
  const commit = surfaceGit(root, ["--literal-pathspecs", "commit", "-q", "-F", "-", "--", ...staged], message);
  if (commit.code !== 0) throw new SurfaceRefused("surface-commit-refused", `git commit in ${root} answered ${commit.code}${commit.err.trim() ? `: ${commit.err.trim()}` : ""} (the pre-commit roster check runs first: \`lares surface check\`)`);
  const head = surfaceGit(root, ["rev-parse", "HEAD"]).out.trim();
  return { staged, carriers: kept, kapae: shadowed, removed, apart, commit: head, subject };
}

// ── the command ────────────────────────────────────────────────────────────────────────────────────────────

const SUB_DOORS = ["init", "check", "open", "commit", "face"] as const;

/** The face the house resolves and the pet name it wears: the one line the host asks the vessel. */
async function cmdFace(args: ParsedArgs, doors: SurfaceDoors): Promise<number> {
  const face = await doors.face(args);
  emit(args, { ok: true, data: { face: face.index, petname: face.petname }, human: () => console.log(`h${face.index} ${face.petname}`) });
  return 0;
}

async function cmdOpen(args: ParsedArgs, doors: SurfaceDoors): Promise<number> {
  const face = await doors.face(args);
  const projections = doors.projections();
  const root = faceRoot(projections, face.petname);
  if (!existsSync(root)) throw new SurfaceRefused("surface-no-pool", `the face "${face.petname}" holds no root at ${root} yet: run \`lares surface init\``);
  const editor = surfaceEditor(doors.config());
  const argv = surfaceOpenArgv(root, realmPools(projections, root), editor);
  const line = argv.map(shellWord).join(" ");
  const launch = args.flags["launch"] === true;
  const code = launch ? doors.launch(argv) : 0;
  const settingAt = join(doors.config(), SURFACE_EDITOR_FILE);
  const error = code === 0 ? null : code === EDITOR_ABSENT_EXIT
    ? { code: "surface-editor-absent", message: `this machine holds no \`${editor[0]}\` to run: name the editor in the house config tiddler ${SURFACE_EDITOR_TITLE} (${settingAt}: a \`title: ${SURFACE_EDITOR_TITLE}\` line, a blank line, then the command, as \`code-insiders\`)` }
    : { code: "surface-launch-failed", message: `${line} answered ${code}` };
  emit(args, {
    ok: code === 0,
    data: { face: face.index, argv, editor, launched: launch, ...(launch ? { exit: code } : {}) },
    ...(error === null ? {} : { error }),
    human: () => { console.log(line); if (error !== null) console.error(`lares surface open: ${error.message}`); },
  });
  return code === 0 ? 0 : 1;
}

/** The seam a commit names (`-m <seam>` or `--message <seam>`, else the hand's), or why the words name none. */
function seamOf(args: ParsedArgs): { readonly seam: string } | { readonly stray: string } {
  const words = args.positional.slice(1);
  const at = words.indexOf("-m");
  const named = at !== -1 ? words[at + 1] : args.options["message"];
  const rest = at === -1 ? words : [...words.slice(0, at), ...words.slice(at + 2)];
  if (rest.length > 0) return { stray: `unknown word "${rest[0]}"` };
  if (at !== -1 && named === undefined) return { stray: "-m names the seam: give it one, as `-m sitting-close`" };
  const seam = named ?? HAND_SEAM;
  return SEAM.test(seam) ? { seam } : { stray: `-m names the seam, one slug (a-z, 0-9, -), never ${JSON.stringify(seam)}` };
}

/** The realm `--realm <realm pet name>` names (null where absent), or why the line names none it can act on (`words`: a word past the verb strays). */
function realmOption(args: ParsedArgs, words = false): { readonly realm: string | null } | { readonly stray: string } {
  if (words && args.positional.length > 1) return { stray: `unknown word "${args.positional[1]}"` };
  const named = args.options["realm"];
  if (named === undefined) return { realm: null };
  if (typeof named !== "string" || faceSegmentRefusal(named) !== null) return { stray: `--realm names a realm's pet name (one folder: no '/', '\\', ':' or leading dot), never ${JSON.stringify(named)}` };
  if (args.options["face"] !== undefined) return { stray: "--realm and --face name two pools: a realm pool belongs to no face, so name one" };
  return { realm: named };
}

async function cmdCommit(args: ParsedArgs, doors: SurfaceDoors): Promise<number> {
  const read = seamOf(args);
  if ("stray" in read) return refuseUsage(args, "surface commit", helpLines("surface commit"), read.stray);
  const { seam } = read;
  const named = realmOption(args);
  if ("stray" in named) return refuseUsage(args, "surface commit", helpLines("surface commit"), named.stray);
  // A realm commits EACH of its wiki pools standing on disk, one commit per wiki tree; a standing folder with no tree refuses.
  const roots = named.realm !== null
    ? realmPoolsOf(doors, named.realm).pools.filter((p) => dirOrNull(p.root) !== null).map((p) => p.root)
    : [faceRoot(doors.projections(), (await doors.face(args)).petname)];
  for (const root of roots) if (!existsSync(join(root, ".git"))) throw new SurfaceRefused("surface-no-pool", `no pool stands at ${root}: run \`lares surface init\` (\`--realm <realm pet name>\` for a realm's wikis)`);
  const results = roots.map((root) => ({ root, ...surfaceCommit(root, doors.tree(), seam, (file) => doors.basePath(file)) }));
  emit(args, {
    ok: true,
    data: named.realm !== null ? { realm: named.realm, pools: results } : { ...results[0]! },
    human: () => {
      for (const result of results) {
        if (result.commit === null) console.log(`lares surface commit: nothing the house agrees with stands changed in ${result.root}`);
        else { console.log(`lares surface commit: ${result.subject}`); console.log(`  ${result.commit.slice(0, 12)}  ${result.staged.length} path(s)  ${result.root}`); }
        for (const a of result.apart) console.log(`  apart ${a.path}: ${a.why}`);
      }
    },
  });
  return 0;
}

/**
 * INIT A REALM: each wiki folder the realm holds becomes its own pool (`.git` at the folder's top, never one tree over the realm),
 * under the wiki's identity, never a face's. A wiki whose folder stands nowhere yet is named and left: the house lays it at the
 * wiki's next mount. A realm whose wikis all stand nowhere refuses by name.
 */
async function cmdInitRealm(args: ParsedArgs, doors: SurfaceDoors, petName: string): Promise<number> {
  const { petName: realm, pools } = realmPoolsOf(doors, petName);
  const projections = doors.projections();
  const standing = pools.filter((p) => dirOrNull(p.root) !== null);
  const unlaid = pools.filter((p) => dirOrNull(p.root) === null);
  if (standing.length === 0) throw new SurfaceRefused("surface-realm-unlaid", `no wiki folder of the realm "${realm}" stands yet${pools.length === 0 ? " (it holds no wiki: `lares realm move <slug> --to " + realm + "`)" : ` (${unlaid.map((p) => p.root).join(", ")})`}: the house lays each at the wiki's next mount`);
  for (const { root } of standing) {
    for (const face of houseFaceRoots(projections)) {
      if (within(real(root), real(face))) throw new SurfaceRefused("surface-realm-in-face", `${root} rests inside the face root ${face}: a realm pool belongs to no face`);
    }
    for (const home of [projections, doors.config()]) {
      if (within(real(home), real(root))) throw new SurfaceRefused("surface-house-root", `${root} holds the house's ${home}: no repo roots at projections/ or config/`);
    }
  }
  const results = standing.map(({ slug, root }) => ({ slug, ...surfaceInitRealm(root, slug) }));
  emit(args, {
    ok: true,
    data: { realm, pools: results.map((r) => ({ slug: r.slug, root: r.root, changed: r.changed, left: r.left, already: r.changed.length === 0 })), unlaid: unlaid.map((p) => p.slug), already: results.every((r) => r.changed.length === 0) },
    human: () => {
      for (const r of results) {
        console.log(r.changed.length === 0 ? `lares surface init: already a realm pool at ${r.root}` : `lares surface init: ${r.root} (the wiki "${r.slug}" of the realm "${realm}")`);
        for (const c of r.changed) console.log(`  set  ${c}`);
        for (const l of r.left) console.log(`  left ${l}`);
      }
      for (const p of unlaid) console.log(`  unlaid ${p.slug}: no folder stands at ${p.root} yet (the house lays it at the wiki's next mount)`);
    },
  });
  return 0;
}

async function cmdInit(args: ParsedArgs, doors: SurfaceDoors): Promise<number> {
  const named = realmOption(args, true);
  if ("stray" in named) return refuseUsage(args, "surface init", helpLines("surface init"), named.stray);
  if (named.realm !== null) return cmdInitRealm(args, doors, named.realm);
  const face = await doors.face(args);
  const root = faceRoot(doors.projections(), face.petname);
  const result = surfaceInit(root, face.petname);
  emit(args, {
    ok: true,
    data: { face: face.index, root, changed: result.changed, left: result.left, already: result.changed.length === 0 },
    human: () => {
      console.log(result.changed.length === 0 ? `lares surface init: already a face pool at ${root}` : `lares surface init: ${root}`);
      for (const c of result.changed) console.log(`  set  ${c}`);
      for (const l of result.left) console.log(`  left ${l}`);
    },
  });
  return 0;
}

/** The repo top a check reads: the named face's pool, else the repo standing at the command's working directory. */
async function checkTop(args: ParsedArgs, doors: SurfaceDoors): Promise<string> {
  if (args.options["face"] !== undefined) return faceRoot(doors.projections(), (await doors.face(args)).petname);
  const r = surfaceGit(doors.cwd(), ["rev-parse", "--show-toplevel"]);
  if (r.code !== 0) throw new SurfaceRefused("surface-no-repo", `no git repository stands at ${doors.cwd()}`);
  return r.out.trim();
}

async function cmdCheck(args: ParsedArgs, doors: SurfaceDoors): Promise<number> {
  const named = realmOption(args, true);
  if ("stray" in named) return refuseUsage(args, "surface check", helpLines("surface check"), named.stray);
  if (named.realm !== null) return cmdCheckRealm(args, doors, named.realm);
  const top = await checkTop(args, doors);
  if (!existsSync(join(top, ".git"))) throw new SurfaceRefused("surface-no-repo", `no git repository stands at ${top}`);
  const realm = args.options["face"] !== undefined ? null : realmAt(top, doors);
  const { breaches, warnings } = realm !== null
    ? surfaceCheckRealm(top, realm, doors.projections(), doors.config())
    : { breaches: surfaceCheck(top, doors.projections(), doors.config()), warnings: [] as string[] };
  const scope = realm !== null ? { realm } : {};
  if (breaches.length === 0) {
    emit(args, {
      ok: true, data: { top, ...scope, breaches: [], warnings },
      human: () => {
        console.log(realm !== null ? `lares surface check: ${top} holds the realm "${realm}" alone, under its own identity` : `lares surface check: ${top} holds one face's planes alone`);
        for (const w of warnings) console.warn(`  warn ${w}`);
      },
    });
    return 0;
  }
  emit(args, {
    ok: false,
    error: { code: "surface-check-breach", message: breaches.map((b) => b.message).join("; ") },
    data: { top, ...scope, breaches, warnings },
    human: () => {
      console.error(`lares surface check: ${breaches.length} breach(es) in ${top}`);
      for (const b of breaches) console.error(`  ${b.code}: ${b.message}`);
      for (const w of warnings) console.warn(`  warn ${w}`);
    },
  });
  return 1;
}

/** CHECK A REALM: the realm check over each of its wiki pools standing on disk; exit 1 names each breach with its pool. */
async function cmdCheckRealm(args: ParsedArgs, doors: SurfaceDoors, petName: string): Promise<number> {
  const { petName: realm, pools } = realmPoolsOf(doors, petName);
  const standing = pools.filter((p) => existsSync(join(p.root, ".git")));
  if (standing.length === 0) throw new SurfaceRefused("surface-no-pool", `no wiki pool of the realm "${realm}" stands yet: run \`lares surface init --realm ${realm}\``);
  const read = standing.map((p) => ({ ...p, ...surfaceCheckRealm(p.root, p.slug, doors.projections(), doors.config()) }));
  const breaches = read.flatMap((r) => r.breaches.map((b) => ({ ...b, pool: r.root })));
  const warnings = read.flatMap((r) => r.warnings);
  emit(args, {
    ok: breaches.length === 0,
    ...(breaches.length === 0 ? {} : { error: { code: "surface-check-breach", message: breaches.map((b) => b.message).join("; ") } }),
    data: { realm, pools: read.map((r) => r.root), breaches, warnings },
    human: () => {
      if (breaches.length === 0) console.log(`lares surface check: the realm "${realm}" holds ${read.length} wiki pool(s), each under its own identity`);
      else { console.error(`lares surface check: ${breaches.length} breach(es) in the realm "${realm}"`); for (const b of breaches) console.error(`  ${b.code}: ${b.message}`); }
      for (const w of warnings) console.warn(`  warn ${w}`);
    },
  });
  return breaches.length === 0 ? 0 : 1;
}

export async function cmdSurface(args: ParsedArgs, doors: SurfaceDoors = liveSurfaceDoors()): Promise<number> {
  const verb = args.positional[0];
  if (verb === undefined || !(SUB_DOORS as readonly string[]).includes(verb)) {
    return refuseUsage(args, "surface", helpLines("surface"), verb === undefined ? "name a sub-verb" : `unknown sub-verb "${verb}"`);
  }
  try {
    switch (verb) {
      case "init": return await cmdInit(args, doors);
      case "open": return await cmdOpen(args, doors);
      case "commit": return await cmdCommit(args, doors);
      case "face": return await cmdFace(args, doors);
      default: return await cmdCheck(args, doors);
    }
  } catch (err) {
    if (err instanceof FaceOptionMalformed) return refuseUsage(args, `surface ${verb}`, helpLines(`surface ${verb}`), err.message);
    if (err instanceof SurfaceRefused) {
      emit(args, { ok: false, error: { code: err.code, message: err.message }, human: () => console.error(`lares surface ${verb}: ${err.message}`) });
      return 1;
    }
    throw err;
  }
}
