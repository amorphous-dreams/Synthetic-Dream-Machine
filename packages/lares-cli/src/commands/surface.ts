/**
 * `lares surface` — the face pool as a git working tree (face-pools #/shape, research/tideline-surface #/seam).
 *
 * ONE POOL PER FACE, KEYED BY PET NAME. Each face's private planes rest under `projections/faces/<pet name>/`
 * (`faceRoot`, `FACE_PLANES`), and that root holds the face's one git working tree: `.git` inside it (0700), the house's
 * one ignore list (`HOUSE_IGNORED`) in `.git/info/exclude`, a local author `<pet name> <slug>@face.invalid` with signing
 * off, and a pre-commit hook that runs the roster check. Git always runs here with an empty global config and no system
 * config, so nothing this door writes or reads reaches past the pool.
 *
 *   - `init [--face N]`: make the worn (or named) face's root a pool; a second run changes nothing and says "already".
 *   - `check [--face N]`: the roster witness over the repo standing here (or the named face's pool); exit 1 names each breach.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/face-pools
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  faceRoot, faceSegmentRefusal, HOUSE_IGNORED, FACES_PROJECTION_DIR, FACE_LABELS_DIR, SyncedTree,
  larProjectionsHome, larConfigHome,
} from "@lararium/node";
import { ownPersonaPetname } from "@lararium/mesh";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { actingFace, faceOption, FaceOptionMalformed } from "../face-option.js";
import { openSyncedTree } from "../ingest-core.js";
import { sealedPetnameStore } from "../sealed-records.js";
import { makeFleetPetnameStore } from "../daemon-persona-store.js";
import type { ParsedArgs } from "../parse-args.js";

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
  /** Run a command line on this machine (`open --launch`); answers its exit code. */
  launch(argv: readonly string[]): number;
}

export const LIVE_SURFACE_DOORS: SurfaceDoors = {
  face: async (args) => {
    const index = faceOption(args).face ?? await actingFace(args);
    const petname = await ownPersonaPetname(makeFleetPetnameStore(sealedPetnameStore()), index);
    if (petname === undefined || petname.trim() === "") throw new SurfaceRefused("surface-face-unnamed", `the face h${index} wears no pet name, so it makes no folder under faces/: name it (\`lares persona new ${index} --name <label>\`)`);
    return { index, petname };
  },
  projections: () => larProjectionsHome(),
  config: () => larConfigHome(),
  tree: () => openSyncedTree(),
  cwd: () => process.cwd(),
  launch: (argv) => spawnSync(argv[0]!, argv.slice(1), { stdio: "inherit" }).status ?? 1,
};

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

/** The lines that open and close the house's block in `.git/info/exclude`; the operator's own lines rest outside it. */
const EXCLUDE_OPEN = "# >>> lares surface: the house's one ignore list (HOUSE_IGNORED); `lares surface init` keeps this block";
const EXCLUDE_CLOSE = "# <<< lares surface";

/**
 * THE EXCLUDE RULES, from `HOUSE_IGNORED` alone: each top folder but `.git` (git keeps its own), each orphan folder
 * suffix, and the atomic writer's temp (`<path>.<pid>[.<uuid>].tmp`). The patterns float (no leading `/`), since the
 * mirrors rest one folder down (`wiki/`, `canon/`, `margins/<slug>/`). The pointer carriers (`.meta`, `.kapae`, `.mem`,
 * `.tid`) never appear here: the pool commits them.
 */
export function surfaceExcludeLines(): string[] {
  return [
    ...HOUSE_IGNORED.topDirs.filter((d) => d !== ".git").map((d) => `${d}/`),
    ...HOUSE_IGNORED.dirSuffixes.map((s) => `*${s}/`),
    "*.[0-9]*.tmp",
  ];
}

/** The house's block, whole. */
function excludeBlock(): string {
  return [EXCLUDE_OPEN, ...surfaceExcludeLines(), EXCLUDE_CLOSE].join("\n") + "\n";
}

/** The exclude file with the house's block written in place (or appended), the operator's own lines kept. */
function withExcludeBlock(text: string): string {
  const start = text.indexOf(EXCLUDE_OPEN);
  const end = start === -1 ? -1 : text.indexOf(EXCLUDE_CLOSE, start);
  if (start !== -1 && end !== -1) {
    const after = text.slice(end + EXCLUDE_CLOSE.length).replace(/^\n/, "");
    return text.slice(0, start) + excludeBlock() + after;
  }
  return (text === "" || text.endsWith("\n") ? text : `${text}\n`) + excludeBlock();
}

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
  const changed: string[] = [], left: string[] = [];
  if (!existsSync(root)) { mkdirSync(root, { recursive: true }); changed.push("the face root"); }
  const dotGit = join(root, ".git");
  if (!existsSync(join(dotGit, "HEAD"))) {
    const r = surfaceGit(root, ["init", "-q", "-b", "main"]);
    if (r.code !== 0) throw new SurfaceRefused("surface-git-init-failed", `git init in ${root} answered ${r.code}: ${r.err.trim()}`);
    changed.push("git repository");
  }
  if ((statSync(dotGit).mode & 0o777) !== 0o700) { chmodSync(dotGit, 0o700); changed.push(".git mode 0700"); }
  const exclude = join(dotGit, "info", "exclude");
  const was = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
  const now = withExcludeBlock(was);
  if (now !== was) { mkdirSync(join(dotGit, "info"), { recursive: true }); writeFileSync(exclude, now); changed.push("info/exclude"); }
  const want: ReadonlyArray<readonly [string, string]> = [
    ["user.name", petname.normalize("NFC")],
    ["user.email", `${faceEmailSlug(petname)}@face.invalid`],
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

/** Index files that link faces: none ever rests at a pool's top. */
export const POOL_INDEX_FILES: readonly string[] = [FACE_LABELS_DIR, "kahua-index.toml", "share.tid", "kahua-pending.json"];

/** One breach the roster check names. */
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

/** THE ROSTER CHECK over the repo whose top stands at `top`, in a house whose homes are `projections` and `config`. */
export function surfaceCheck(top: string, projections: string, config: string): SurfaceBreach[] {
  const breaches: SurfaceBreach[] = [];
  const at = real(top);
  for (const home of [projections, config]) {
    if (within(real(home), at)) breaches.push({ code: "surface-house-root", message: `the repo at ${at} holds the house's ${home}: no repo roots at projections/ or config/ (one pool per face, under faces/<pet name>/)` });
  }
  for (const name of POOL_INDEX_FILES) {
    if (existsSync(join(at, name))) breaches.push({ code: "surface-index-file", message: `${join(at, name)} links faces, and no index file rests in a face pool: move it out of ${at}` });
  }
  const roots = houseFaceRoots(projections).map((p) => ({ path: real(p), petname: p.slice(p.lastIndexOf(sep) + 1) }));
  for (const other of roots) {
    if (other.path !== at && within(other.path, at)) breaches.push({ code: "surface-other-face", message: `the repo at ${at} holds the face "${other.petname}"'s root ${other.path}: one pool per face` });
  }
  const email = localConfig(at, "user.email")?.toLowerCase() ?? null;
  const signing = localConfig(at, "user.signingkey");
  for (const other of roots) {
    if (other.path === at || within(at, other.path) || within(other.path, at) || !existsSync(join(other.path, ".git"))) continue;
    const theirs = localConfig(other.path, "user.email")?.toLowerCase() ?? null;
    if (email !== null && email !== "" && theirs === email) breaches.push({ code: "surface-author-shared", message: `the author email ${email} also signs the face "${other.petname}"'s pool (${other.path}): each face commits under its own` });
    const theirKey = localConfig(other.path, "user.signingkey");
    if (signing !== null && signing !== "" && theirKey === signing) breaches.push({ code: "surface-signing-key-shared", message: `the signing key also signs the face "${other.petname}"'s pool (${other.path}): each face signs with its own` });
  }
  return breaches;
}

// ── the command ────────────────────────────────────────────────────────────────────────────────────────────

const SUB_DOORS = ["init", "check"] as const;

async function cmdInit(args: ParsedArgs, doors: SurfaceDoors): Promise<number> {
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
  const top = await checkTop(args, doors);
  if (!existsSync(join(top, ".git"))) throw new SurfaceRefused("surface-no-repo", `no git repository stands at ${top}`);
  const breaches = surfaceCheck(top, doors.projections(), doors.config());
  if (breaches.length === 0) {
    emit(args, { ok: true, data: { top, breaches: [] }, human: () => console.log(`lares surface check: ${top} holds one face's planes alone`) });
    return 0;
  }
  emit(args, {
    ok: false,
    error: { code: "surface-check-breach", message: breaches.map((b) => b.message).join("; ") },
    data: { top, breaches },
    human: () => { console.error(`lares surface check: ${breaches.length} breach(es) in ${top}`); for (const b of breaches) console.error(`  ${b.code}: ${b.message}`); },
  });
  return 1;
}

export async function cmdSurface(args: ParsedArgs, doors: SurfaceDoors = LIVE_SURFACE_DOORS): Promise<number> {
  const verb = args.positional[0];
  if (verb === undefined || !(SUB_DOORS as readonly string[]).includes(verb)) {
    return refuseUsage(args, "surface", helpLines("surface"), verb === undefined ? "name a sub-verb" : `unknown sub-verb "${verb}"`);
  }
  try {
    switch (verb) {
      case "init": return await cmdInit(args, doors);
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
