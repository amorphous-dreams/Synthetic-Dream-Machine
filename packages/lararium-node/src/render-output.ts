/** Custody of native wiki render bytes. The workbench's rendered/ top never enters an ingest wave. */
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, constants, existsSync, fstatSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readlinkSync,
  realpathSync, renameSync, rmdirSync, unlinkSync, writeSync, type Stats,
} from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { HOUSE_STATE_SIBLINGS } from "./bag-paths.js";

export interface RenderFile { readonly name: string; readonly text: string; readonly source: string }
export interface RenderManifest {
  readonly has: string;
  readonly directory: "rendered";
  readonly outcome: "written" | "partial";
  readonly files: readonly { readonly name: string; readonly bytes: number; readonly digest: string }[];
  readonly skipped: readonly string[];
  readonly receipt: string;
  readonly refusal?: string;
}
const digest = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const within = (child: string, parent: string): boolean => child === parent || child.startsWith(`${parent}${sep}`);
const fault = (name: string, detail: string): Error => new Error(`${name}: ${detail}`);
const real = (path: string): string => { try { return realpathSync(path); } catch { return resolve(path); } };

/** The names this publisher keeps for itself inside rendered/: its retry manifests and its private staging folders. */
const RESERVED_PREFIXES = [".manifest-", ".stage-"] as const;

/**
 * THE TRACKED TREE a canon source names: the source dir itself, the `wikis/` beside it (where a sourced slug's workbench rests),
 * and the git checkout that holds the source, read by structure (the nearest ancestor holding `.git`). A git tree that holds the
 * house root itself names no checkout (a house may rest inside a tracked home), so only a tree beside the house counts. Derived
 * render bytes land in none of them.
 */
export function trackedTreeRoots(canonBags: string, houseRoot: string): string[] {
  const source = real(canonBags);
  const house = real(houseRoot);
  const roots = [source, join(dirname(source), "wikis")];
  for (let walk = source; ; walk = dirname(walk)) {
    if (existsSync(join(walk, ".git"))) { if (!within(house, walk)) roots.push(walk); break; }
    if (dirname(walk) === walk) break;
  }
  return roots;
}

/**
 * DIRECTORY CUSTODY BY HANDLE. Node offers no openat, so each step resolves through Linux's per-process handle links
 * (`/proc/self/fd/<n>/<segment>`): the kernel jumps to the directory the handle holds, whatever name now stands where it stood,
 * and only the last segment reads by name, opened `O_NOFOLLOW`. A directory swapped for a symlink after a check therefore
 * redirects nothing: the next open refuses it, and a link or rename lands inside the held directory or nowhere.
 */
const HANDLE_ROOT = "/proc/self/fd";
const DIR_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const at = (fd: number, name: string): string => `${HANDLE_ROOT}/${fd}/${name}`;
const errno = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | undefined)?.code;
function openDirAt(fd: number, name: string, label: string): number {
  try { return openSync(at(fd, name), DIR_FLAGS); }
  catch (error) {
    const code = errno(error);
    if (code === "ELOOP" || code === "ENOTDIR") throw fault("render-path-symlink", label);
    throw error;
  }
}
const sameNode = (a: Stats, b: Stats): boolean => a.dev === b.dev && a.ino === b.ino;

/** Write a whole string through one handle. */
function writeAll(fd: number, text: string): void {
  const bytes = Buffer.from(text, "utf8");
  for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes, offset, bytes.length - offset);
}

/** A host error carries absolute paths; the answer names its code alone. */
function refusalOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = errno(error);
  return code ? `render-io-fault: ${code}` : message.replace(/\/[^\s'"]+/g, "<path>");
}

/** Check every path and budget before the first output byte, then publish each file by handle-held link or rename. */
export function publishWikiRender(opts: {
  readonly workbench: string;
  readonly hearth: string;
  /** Roots the publisher never writes under: the canon source's tracked tree (`trackedTreeRoots`). */
  readonly tracked: readonly string[];
  readonly files: readonly RenderFile[];
  readonly skipped: readonly string[];
  readonly overwrite?: boolean;
  /** Test seam that interrupts one publication after all preflight checks. */
  readonly beforeWrite?: (name: string) => void;
}): RenderManifest {
  if (!existsSync(HANDLE_ROOT)) throw fault("render-custody-unavailable", "this host offers no per-process directory handles");
  let workbenchFd: number;
  try { workbenchFd = openSync(realpathSync(opts.workbench), DIR_FLAGS); }
  catch { throw fault("render-workbench-unbound", "the selected wiki holds no bound disk workbench"); }
  const held: number[] = [workbenchFd];
  try {
    // The bound root reads from the handle held, so the containment checks read the folder every later write descends from.
    const workbench = readlinkSync(`${HANDLE_ROOT}/${workbenchFd}`);
    const hearth = real(opts.hearth);
    const house = dirname(hearth);
    if ([hearth, ...HOUSE_STATE_SIBLINGS.map((d) => real(join(house, d)))].some((closed) => within(workbench, closed) || within(closed, workbench)))
      throw fault("render-workbench-in-hearth", "the workbench resolves inside the house's state (hearth, config, sensoriums)");
    if (opts.tracked.map(real).some((root) => within(workbench, root) || within(root, workbench)))
      throw fault("render-output-tracked-tree", "the workbench resolves inside a canon source's tracked tree; derived bytes never land there");
    if (opts.files.length > 128) throw fault("render-count-budget", "the selection exceeds 128 files");
    const root = join(workbench, "rendered");
    if (existsSync(root) && (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink())) throw fault("render-path-symlink", "rendered/ must hold a real directory");
    const rows: Array<{ name: string; bytes: number; digest: string; path: string; text: string; exists: boolean }> = [];
    const names = new Set<string>();
    let total = 0;
    for (const file of opts.files) {
      const name = file.name;
      if (!name || isAbsolute(name) || /^[A-Za-z]:/.test(name) || name.includes("\\") || name.includes("\0")
        || name.split("/").some((part) => !part || part === "." || part === ".." || Buffer.byteLength(part, "utf8") > 255 || RESERVED_PREFIXES.some((p) => part.startsWith(p))))
        throw fault("render-path-refused", JSON.stringify(name));
      if (names.has(name.toLowerCase())) throw fault("render-name-duplicate", JSON.stringify(name));
      names.add(name.toLowerCase());
      const path = resolve(root, name);
      if (!within(path, root)) throw fault("render-path-refused", JSON.stringify(name));
      // The preflight reads by name to refuse early; custody at write time rides the held handles below.
      let walk = workbench;
      for (const part of ["rendered", ...name.split("/")]) {
        walk = join(walk, part);
        const stat = lstatSync(walk, { throwIfNoEntry: false });
        if (!stat) continue;
        if (stat.isSymbolicLink()) throw fault("render-path-symlink", JSON.stringify(name));
        if (walk !== path && !stat.isDirectory()) throw fault("render-path-refused", JSON.stringify(name));
        if (walk === path && !stat.isFile()) throw fault("render-path-refused", JSON.stringify(name));
      }
      const bytes = Buffer.byteLength(file.text, "utf8");
      total += bytes;
      if (total > 4_194_304) throw fault("render-byte-budget", "the selection exceeds four MiB");
      rows.push({ name, bytes, digest: `sha256-${digest(file.text)}`, path, text: file.text, exists: existsSync(path) });
    }
    const receipt = digest(JSON.stringify({ rows: rows.map(({ name, digest }) => [name, digest]), skipped: opts.skipped, overwrite: opts.overwrite === true }));
    const manifestName = `.manifest-${receipt}.json`;
    const prepared = JSON.stringify(rows.map(({ name, bytes, digest }) => ({ name, bytes, digest })));

    // rendered/ opens once, by name under the held workbench, refusing a symlink; every later step descends from this handle.
    const openRoot = (): number | null => {
      try { return openDirAt(workbenchFd, "rendered", "rendered/"); }
      catch (error) { if (errno(error) === "ENOENT") return null; throw error; }
    };
    /** Read a regular file by name inside a held directory, never through a symlink; null when none stands. */
    const readAt = (dirFd: number, name: string, label: string): string | null => {
      let fd: number;
      try { fd = openSync(at(dirFd, name), constants.O_RDONLY | constants.O_NOFOLLOW); }
      catch (error) {
        const code = errno(error);
        if (code === "ENOENT") return null;
        if (code === "ELOOP") throw fault("render-path-symlink", label);
        throw error;
      }
      try {
        if (!fstatSync(fd).isFile()) throw fault("render-path-refused", label);
        return readFileSync(fd, "utf8");
      } finally { closeSync(fd); }
    };

    const standing = openRoot();
    if (standing !== null) {
      held.push(standing);
      const text = readAt(standing, manifestName, "the retry manifest moved");
      if (text !== null) {
        const prior = JSON.parse(text) as RenderManifest;
        if (prior.receipt !== receipt || prior.outcome !== "written" || !Array.isArray(prior.files) || JSON.stringify(prior.files) !== prepared)
          throw fault("render-retry-manifest-invalid", "the standing manifest does not match the prepared bytes");
        return prior;
      }
    }
    for (const row of rows) {
      if (row.exists && !opts.overwrite && digest(readFileSync(row.path, "utf8")) !== row.digest.slice(7))
        throw fault("render-overwrite-refused", JSON.stringify(row.name));
    }
    const emitted: Array<{ name: string; bytes: number; digest: string }> = [];
    const answer = (outcome: "written" | "partial", refusal?: string): RenderManifest => ({
      has: `<<~ has name=\`wiki-render-out\` params=\`directory/rendered outcome/${outcome} files/${emitted.length} skipped/${opts.skipped.length} receipt/${receipt}\`>>`,
      directory: "rendered", outcome, files: emitted, skipped: [...opts.skipped], receipt, ...(refusal ? { refusal } : {}),
    });
    let rootFd: number | null = standing;
    let stageFd: number | null = null;
    let stageName: string | null = null;
    try {
      if (rootFd === null) {
        try { mkdirSync(at(workbenchFd, "rendered"), { mode: 0o755 }); } catch (error) { if (errno(error) !== "EEXIST") throw error; }
        rootFd = openDirAt(workbenchFd, "rendered", "rendered/");
        held.push(rootFd);
      }
      const rootStat = fstatSync(rootFd);
      // THE PRIVATE STAGE: one 0700 folder per publication inside rendered/, where each temp opens exclusive and unfollowed.
      stageName = mkdtempSync(at(rootFd, ".stage-")).split("/").pop()!;
      stageFd = openDirAt(rootFd, stageName, "the staging folder moved");
      held.push(stageFd);
      const stageStat = fstatSync(stageFd);
      if ((stageStat.mode & 0o077) !== 0 || stageStat.dev !== rootStat.dev) throw fault("render-path-symlink", "the staging folder moved");
      const dirs = new Map<string, number>([["", rootFd]]);
      /** The held handle of an output folder: each segment is made in its held parent and opened unfollowed. */
      const dirOf = (segments: readonly string[], label: string): number => {
        let key = "", fd = rootFd!;
        for (const segment of segments) {
          key = key ? `${key}/${segment}` : segment;
          const known = dirs.get(key);
          if (known !== undefined) { fd = known; continue; }
          try { mkdirSync(at(fd, segment), { mode: 0o755 }); } catch (error) { if (errno(error) !== "EEXIST") throw error; }
          const next = openDirAt(fd, segment, label);
          held.push(next);
          if (fstatSync(next).dev !== rootStat.dev) throw fault("render-path-symlink", label);
          dirs.set(key, next);
          fd = next;
        }
        return fd;
      };
      for (const row of rows) {
        const segments = row.name.split("/");
        const leaf = segments.pop()!;
        const label = JSON.stringify(row.name);
        if (row.exists && !opts.overwrite) {
          const parent = dirOf(segments, label);
          const standingText = readAt(parent, leaf, label);
          if (standingText === null || digest(standingText) !== row.digest.slice(7)) throw fault("render-overwrite-refused", label);
          emitted.push({ name: row.name, bytes: row.bytes, digest: row.digest }); continue;
        }
        opts.beforeWrite?.(row.name);
        const parent = dirOf(segments, label);
        const temp = `${randomUUID()}.tmp`;
        const tempFd = openSync(at(stageFd, temp), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        let tempStat: Stats;
        try {
          writeAll(tempFd, row.text);
          tempStat = fstatSync(tempFd);
        } finally { closeSync(tempFd); }
        try {
          // A no-overwrite grant also holds if another writer creates the name after preflight: link refuses a standing name.
          if (opts.overwrite) renameSync(at(stageFd, temp), at(parent, leaf));
          else linkSync(at(stageFd, temp), at(parent, leaf));
        } finally { try { unlinkSync(at(stageFd, temp)); } catch { /* the rename took it */ } }
        // THE LANDED CHECK: the name inside the held parent answers the very file staged, and that parent still stands, by name and
        // by node, inside rendered/; on any mismatch the staged file leaves and the publication refuses.
        const landed = lstatSync(at(parent, leaf), { throwIfNoEntry: false });
        const parentByName = lstatSync(join(root, ...segments), { throwIfNoEntry: false });
        const parentStat = fstatSync(parent);
        const parentHome = readlinkSync(`${HANDLE_ROOT}/${parent}`);
        if (!landed || !sameNode(landed, tempStat) || !parentByName || parentByName.isSymbolicLink() || !sameNode(parentByName, parentStat) || !within(parentHome, root)) {
          if (landed && sameNode(landed, tempStat)) unlinkSync(at(parent, leaf));
          throw fault("render-path-symlink", label);
        }
        emitted.push({ name: row.name, bytes: row.bytes, digest: row.digest });
      }
      const complete = answer("written");
      const manifestFd = openSync(at(rootFd, manifestName), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
      try { writeAll(manifestFd, JSON.stringify(complete)); } finally { closeSync(manifestFd); }
      return complete;
    } catch (error) { return answer("partial", refusalOf(error)); }
    finally {
      if (rootFd !== null && stageName !== null) { try { rmdirSync(at(rootFd, stageName)); } catch { /* a stage that kept a temp stays for the next look */ } }
    }
  } finally {
    for (const fd of held.reverse()) { try { closeSync(fd); } catch { /* already closed */ } }
  }
}
