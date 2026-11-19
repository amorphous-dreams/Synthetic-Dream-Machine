/**
 * watch-core — THE DRAIN, ONE SEAT (face-pools #/lanes W1, W2). Disk events carry HINTS (Confluence): the seat coalesces a
 * settle window into ONE wave, runs one wave at a time, and queues exactly one rerun for hints that land mid-wave. The
 * CLI's `lares watch` fills the wave with its INGEST settle; the vessel fills it over the WORN face's pool.
 *
 * THE VESSEL'S HOST (`armFacePoolWatch`) watches one face root, `projections/faces/<pet name>/`, and its planes alone:
 * `wiki/`, `canon/`, `stage/` (the kahua stage flows back from disk too: RULED floor 4 (b)), `margins/`, `recovery/`. It
 * lives the life of the composition that wears the face:
 *
 *   arm    OFF THE BOOT PATH: the arm hands back at once, and its work runs beside the boot. It names the wake first (every
 *          stage edit made on disk since the last sitting, each title with its pool commit or "uncommitted"), stands the
 *          watch, proves the backend with a cookie, then runs the catch-up (the `liveLay` read of the whole pool) once,
 *          so an edit made while no vessel watched reads before the watch reads live
 *   wave   each settle hands the touched files to the wave port
 *   down   lock and down: the final wave drains what stands buffered, THEN the commit seam (the pool's git commit) runs,
 *          naming the close. W5 owns the commit seams in full; this seam commits the watched planes as they stand
 *
 * DEAD INOTIFY (a WSL2 `/mnt` tree, an unsupported filesystem) echoes no cookie. The host then stands in a NAMED state,
 * `inotify-dead`, and holds no poll loop: no interval ever arms, no timer reads the disk again. The final wave at the seam
 * reads the whole pool once (the catch-up), since no event ever named what moved.
 *
 * A SHARED WIKI'S WORKBENCH TAKES THE SAME SEAT (`armWorkspaceWatch`): its one disk copy whichever face wears
 * (`<projections>/realms/<realm pet name>/wikis/<slug>`, or the workspace its share row names), watched whole and committed at each close
 * (`workspaceCommitSeam`, naming no face) where its git tree stands (`lares surface init`); with none, a plain mirror.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/project/face-pools
 */

import { watch as fsWatch, existsSync, mkdirSync, rmSync, writeFileSync, type FSWatcher, type WatchListener } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, sep } from "node:path";
import { FACE_PLANES, TEMP_LAYER_DIR, houseIgnored, siteFileToTitle } from "./bag-paths.js";

// ── the drain seat ─────────────────────────────────────────────────────────────────────────────────────────────

export interface DrainSeat {
  /** One hint: the path rides the next wave, and the settle window opens again. */
  hint(path: string): void;
  /** Carry a path to the next wave without opening a settle window (a wave that owes it another look). */
  carry(path: string): void;
  /** Drain what stands buffered now (and any wave in flight), never waiting on the settle window. */
  flush(): Promise<void>;
  /** Close the settle window; a wave in flight runs to its end. */
  close(): void;
}

/**
 * ONE WAVE AT A TIME. A hint opens a trailing settle window (`settleMs`); once the hints quiet, the buffered paths drain as one
 * wave. A settle that lands mid-wave queues exactly one rerun. A wave's fault names itself to `onFault` and the seat stands.
 */
export function drainSeat(opts: { readonly settleMs: number; readonly wave: (files: readonly string[]) => Promise<void>; readonly onFault?: (e: unknown) => void }): DrainSeat {
  const buffer = new Set<string>();
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> | null = null;
  let rerun = false;
  let closed = false;
  const kick = (): Promise<void> => {
    timer = null;
    if (running) { rerun = true; return running; }
    running = (async () => {
      try {
        do {
          rerun = false;
          const files = [...buffer];
          buffer.clear();
          try { await opts.wave(files); } catch (e) { opts.onFault?.(e); }
        } while (rerun);
      } finally { running = null; }
    })();
    return running;
  };
  return {
    hint(path) {
      buffer.add(path);
      if (closed) return;
      if (timer) clearTimeout(timer);
      // PACING: the trailing settle coalesces a burst of hints into one wave.
      timer = setTimeout(() => { void kick(); }, opts.settleMs);
    },
    carry(path) { buffer.add(path); },
    async flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (running) { if (buffer.size > 0) rerun = true; await running; }
      if (buffer.size > 0) await kick();
    },
    close() { closed = true; if (timer) { clearTimeout(timer); timer = null; } },
  };
}

// ── the noise every watcher drops ──────────────────────────────────────────────────────────────────────────────

/**
 * Editor litter, the house's own observation state, the `.meta` sidecar (it rides with its content file) and every path the
 * house ignores (`HOUSE_IGNORED`) never open a wave. No extension gate decides a filetype here: the wave's siting does.
 */
export function isWatchNoise(rel: string): boolean {
  if (rel.endsWith(".meta")) return true;
  if (rel.includes(".lararium-projection")) return true;
  if (houseIgnored(rel) !== null) return true;
  if (rel.includes("/.git/")) return true;
  const base = rel.split(/[\\/]/).pop() ?? rel;
  if (base.startsWith(".") || base.endsWith("~") || base.endsWith(".swp") || base === "4913") return true;
  return false;
}

/** The window a live backend echoes our own cookie write within. */
export const COOKIE_WINDOW_MS = 2_000;

/**
 * THE COOKIE (Watchman's discipline): write a dotfile under `dir` and await the watcher's own event for it. A live backend
 * echoes it; a dead one (WSL2 `/mnt`, an unsupported filesystem) never does. The cookie leaves at once either way.
 */
export function cookieSelfTest(dir: string, watcher: FSWatcher, windowMs: number = COOKIE_WINDOW_MS): Promise<boolean> {
  const cookieName = `.lares-watch-cookie-${process.pid}-${Date.now()}`;
  const cookiePath = join(dir, cookieName);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (live: boolean): void => {
      if (settled) return;
      settled = true;
      watcher.off("change", onChange);
      clearTimeout(timeout);
      try { rmSync(cookiePath, { force: true }); } catch { /* best effort */ }
      resolve(live);
    };
    const onChange = (_e: string, fn: string | Buffer | null): void => { if (fn && fn.toString().includes(cookieName)) finish(true); };
    watcher.on("change", onChange);
    // LIVENESS: a dead backend never echoes the cookie; the window ends the one test, and nothing repeats it.
    const timeout = setTimeout(() => finish(false), windowMs);
    try { writeFileSync(cookiePath, "cookie"); } catch { finish(false); }
  });
}

// ── the pool's git history ─────────────────────────────────────────────────────────────────────────────────────

/** The planes of a face root the host watches, commits and reads the wake from. `temp/` places back as files, never here. */
export const WATCHED_PLANES: readonly string[] = [FACE_PLANES.wiki, FACE_PLANES.canon, FACE_PLANES.stage, FACE_PLANES.margins, FACE_PLANES.recovery];

/** The subject every sitting's close commits under: a `lar:` subject that names the close and never a face. */
export const SITTING_CLOSE_PREFIX = "lar:///pool.closes.the-sitting/";

/** What closes a sitting: a lock (the worn face set down, by `vault lock` or a wear that moves the mount), or the vessel's down. */
export type SittingClose = "lock" | "down";

export type SeamReading =
  | { readonly committed: true; readonly sha: string }
  | { readonly committed: false; readonly why: "no-pool-history" | "nothing-moved" }
  | { readonly committed: false; readonly why: "commit-refused"; readonly detail: string };

/** One git run in a pool. The hook env (`GIT_DIR`, `GIT_INDEX_FILE`, …) never crosses: a pool reads its own history alone. */
export type GitRun = (args: readonly string[], cwd: string) => { readonly code: number; readonly stdout: string; readonly stderr: string };

export const runGit: GitRun = (args, cwd) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { cwd, env, encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? r.error.message : "") };
};

const poolHistoryStands = (pool: string): boolean => existsSync(join(pool, ".git"));
const standingPlanes = (pool: string): string[] => WATCHED_PLANES.filter((p) => existsSync(join(pool, p)));

/**
 * THE COMMIT SEAM: the pool's git history takes the watched planes as they stand, under `lar:///pool.closes.the-sitting/<close>`.
 * Nothing staged commits nothing; a pool with no history (`lares surface init` founds it) commits nothing, by name. The pool's
 * own hooks run: a seam never passes `--no-verify`.
 */
export async function poolCommitSeam(pool: string, close: SittingClose, git: GitRun = runGit): Promise<SeamReading> {
  if (!poolHistoryStands(pool)) return { committed: false, why: "no-pool-history" };
  const planes = standingPlanes(pool);
  if (planes.length === 0) return { committed: false, why: "nothing-moved" };
  const added = git(["add", "-A", "--", ...planes], pool);
  if (added.code !== 0) return { committed: false, why: "commit-refused", detail: firstLine(added.stderr) };
  if (git(["diff", "--cached", "--quiet", "--", ...planes], pool).code === 0) return { committed: false, why: "nothing-moved" };
  const subject = `${SITTING_CLOSE_PREFIX}${close} — the sitting closes at ${close}; the watched planes commit as they stand`;
  const done = git(["commit", "-q", "-m", subject, "--", ...planes], pool);
  if (done.code !== 0) return { committed: false, why: "commit-refused", detail: firstLine(done.stderr || done.stdout) };
  return { committed: true, sha: git(["rev-parse", "HEAD"], pool).stdout.trim() };
}

const firstLine = (s: string): string => s.split("\n").find((l) => l.trim() !== "")?.trim() ?? "git answered nothing";

/** One stage edit made on disk since the last sitting: its title, its path in the pool, and the commit that holds it. */
export interface StageEdit {
  readonly title: string;
  /** Posix, relative to the pool. */
  readonly file: string;
  /** The newest pool commit holding the edit, or "uncommitted". */
  readonly commit: string | "uncommitted";
}

/**
 * EVERY STAGE EDIT MADE ON DISK SINCE THE LAST SITTING. The last sitting closed at the newest commit whose subject carries
 * `SITTING_CLOSE_PREFIX`; each stage file a later commit touched names that commit (the newest), and each one the working tree
 * holds unstaged or staged names "uncommitted". With no sitting closed yet, the uncommitted edits alone read. A pool with no
 * history names none. Each title reads by the stage's own siting run backward (title paths).
 */
export function stageEditsSinceSitting(pool: string, git: GitRun = runGit): StageEdit[] {
  if (!poolHistoryStands(pool)) return [];
  const stage = FACE_PLANES.stage;
  const byFile = new Map<string, string>();
  const last = git(["log", "-n", "1", "--format=%H", "--fixed-strings", `--grep=${SITTING_CLOSE_PREFIX}`], pool);
  const since = last.code === 0 ? last.stdout.trim() : "";
  if (since !== "") {
    const log = git(["log", "--format=%x00%H", "--name-only", `${since}..HEAD`, "--", stage], pool);
    if (log.code === 0) {
      for (const block of log.stdout.split("\0").filter((b) => b.trim() !== "")) {
        const [sha = "", ...files] = block.split("\n").map((l) => l.trim()).filter((l) => l !== "");
        for (const f of files) if (!byFile.has(f)) byFile.set(f, sha);
      }
    }
  }
  const status = git(["status", "--porcelain", "-z", "-uall", "--", stage], pool);
  if (status.code === 0) {
    const entries = status.stdout.split("\0");
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (e.length < 4) continue;
      byFile.set(e.slice(3), "uncommitted");
      if (e[0] === "R" || e[0] === "C") i++;      // a rename names its source in the next entry
    }
  }
  return [...byFile].filter(([f]) => f.startsWith(`${stage}/`) && !isWatchNoise(f)).sort(([a], [b]) => a.localeCompare(b))
    .map(([file, commit]) => ({ title: stageTitle(pool, file), file, commit }));
}

function stageTitle(pool: string, file: string): string {
  const abs = join(pool, ...file.split("/"));
  try {
    const sited = siteFileToTitle({ planeDir: pool, titlePaths: true }, abs);
    if ("title" in sited) return sited.title;
  } catch { /* a removed file reads by its path */ }
  return file.slice(FACE_PLANES.stage.length + 1).replace(/\.[^./]+$/, "");
}

/** The wake's line for the stage: each edit since the last sitting, titled, with its commit (12 hex) or "uncommitted". */
export function wakeStageLine(edits: readonly StageEdit[]): string {
  if (edits.length === 0) return "wake: no stage edit made on disk since the last sitting";
  return `wake: ${edits.length} stage edit(s) made on disk since the last sitting: ${edits.map((e) => `${e.title} (${e.commit === "uncommitted" ? "uncommitted" : e.commit.slice(0, 12)})`).join(" · ")}`;
}

// ── the vessel's host over the worn face's pool ────────────────────────────────────────────────────────────────

export type WatchState = "arming" | "catching-up" | "live" | "inotify-dead" | "down";

export interface FacePoolPorts {
  /** The catch-up: the `liveLay` read of the whole pool. Runs at the arm, and as the final wave where no event could name what moved. */
  readonly catchUp: () => Promise<void>;
  /** One settled wave: the touched files (absolute), each under a watched plane. */
  readonly wave: (files: readonly string[]) => Promise<void>;
  /** The commit seam; absent, `poolCommitSeam`. */
  readonly commit?: (close: SittingClose) => Promise<SeamReading>;
}

export interface FacePoolWatchOptions {
  /** The worn face's root: `projections/faces/<pet name>/`. */
  readonly pool: string;
  readonly ports: FacePoolPorts;
  readonly settleMs?: number;
  readonly log?: (line: string) => void;
  /** The watch backend; absent, `fs.watch`. */
  readonly watch?: (dir: string, opts: { recursive: boolean }, listener: WatchListener<string>) => FSWatcher;
  /** The backend's proof; absent, `cookieSelfTest`. */
  readonly cookie?: (dir: string, watcher: FSWatcher) => Promise<boolean>;
  readonly git?: GitRun;
}

export interface FacePoolWatch {
  state(): WatchState;
  /** Settles once the arm's work ran: `live`, `inotify-dead`, or `down` where a down came first. */
  readonly armed: Promise<WatchState>;
  /** The wake's reading at the arm: every stage edit made on disk since the last sitting. */
  readonly wake: Promise<readonly StageEdit[]>;
  /** The final wave, then the commit seam. A second call answers the first's reading and runs nothing again. */
  down(close: SittingClose): Promise<SeamReading>;
}

/** The settle a pool's watch waits for before a wave. */
export const POOL_SETTLE_MS = 400;

/**
 * ARM THE WATCH over the worn face's pool. Hands back at once: nothing here blocks the composition that arms it. A fault of
 * the catch-up or a wave names itself in the log and the watch stands.
 */
export function armFacePoolWatch(o: FacePoolWatchOptions): FacePoolWatch {
  const git = o.git ?? runGit;
  return armSeat({
    root: o.pool, ports: o.ports, ...(o.settleMs !== undefined ? { settleMs: o.settleMs } : {}),
    log: o.log ?? ((line: string) => console.log(`[faces] ${line}`)),
    ...(o.watch ? { watch: o.watch } : {}), ...(o.cookie ? { cookie: o.cookie } : {}),
    accepts: (rel) => WATCHED_PLANES.includes(rel.split("/")[0] ?? "") && rel.includes("/"),
    wake: () => stageEditsSinceSitting(o.pool, git),
    commit: o.ports.commit ?? ((c: SittingClose) => poolCommitSeam(o.pool, c, git)),
    covers: WATCHED_PLANES.join(", "),
  });
}

// ── a shared wiki's workbench as a pool ────────────────────────────────────────────────────────────────────────

/**
 * A SHARED WIKI'S WORKBENCH SERVES AS A POOL (cabal-realm#/the-workbench). A wiki's workbench mirror rests in ONE folder whichever
 * face wears: `<projections>/realms/<realm pet name>/wikis/<slug>/` in the realm that holds it, or the workspace its share row names (`<root>/workspaces/<name>`, bound by
 * the host shim: `--workspace <name>=<dir>`, `LARES_WORKSPACES`). The vessel holds the face pool's seat over that folder: the whole
 * folder watched, each settle an unattended INGEST wave in the wiki's own working layer, the commit seam at each sitting's close.
 *
 * THE SEAT FOUNDS NO HISTORY. The folder's git working tree comes from `lares surface init` (its `.git` at the folder's top, the
 * house's ignore list, a local author); the seat reads that tree where it stands. Where none stands the folder serves as a plain
 * mirror: the waves still land, the seam reads `no-pool-history` by name, and a both-moved stand-off's take-disk names that no base's
 * words stand in clear. Several faces share the copy, so the seam's subject names no face.
 */

/** The top folders a workbench holds that ride no wave and no commit: an older layout's drafts, the temp layer. */
export const WORKSPACE_SKIP: readonly string[] = ["recovery", TEMP_LAYER_DIR];

/** The subject a workbench's sitting closes under: a `lar:` subject that names the close and never a face. */
export const WORKSPACE_CLOSE_PREFIX = "lar:///workspace.closes.the-sitting/";

/** The pathspecs a workbench's seam stages: the whole folder but its skipped tops. A top the tree's own excludes already ignore
 *  takes no pathspec: git refuses an `add` that names an ignored path, even to exclude it. */
const workspacePaths = (dir: string, git: GitRun): string[] =>
  [".", ...WORKSPACE_SKIP.filter((d) => git(["check-ignore", "-q", "--no-index", `${d}/x`], dir).code !== 0).map((d) => `:(exclude)${d}`)];

/**
 * THE WORKBENCH'S COMMIT SEAM: the folder's own git history (its `.git` at the top) takes the folder as it stands (but its skipped
 * tops), under `lar:///workspace.closes.the-sitting/<close>`, authored by the tree's local author. Nothing staged commits nothing.
 * A folder with no history at its own top commits nothing, by name: no tree stands there yet, or the folder rests inside another
 * history (a workspace bound in the checkout), which the vessel never commits into. The tree's own hooks run: never `--no-verify`.
 */
export async function workspaceCommitSeam(dir: string, close: SittingClose, git: GitRun = runGit): Promise<SeamReading> {
  if (!poolHistoryStands(dir)) return { committed: false, why: "no-pool-history" };
  const paths = workspacePaths(dir, git);
  const added = git(["add", "-A", "--", ...paths], dir);
  if (added.code !== 0) return { committed: false, why: "commit-refused", detail: firstLine(added.stderr) };
  if (git(["diff", "--cached", "--quiet", "--", ...paths], dir).code === 0) return { committed: false, why: "nothing-moved" };
  const subject = `${WORKSPACE_CLOSE_PREFIX}${close} — the sitting closes at ${close}; the workbench commits as it stands`;
  const done = git(["commit", "-q", "-m", subject, "--", ...paths], dir);
  if (done.code !== 0) return { committed: false, why: "commit-refused", detail: firstLine(done.stderr || done.stdout) };
  return { committed: true, sha: git(["rev-parse", "HEAD"], dir).stdout.trim() };
}

export interface WorkspaceWatchOptions {
  /** The workbench folder: `<projections>/realms/<realm pet name>/wikis/<slug>`, or `<root>/workspaces/<name>` where a share row names one. */
  readonly workspace: string;
  /** How the log names the folder: the workspace's name, or the wiki's slug for a default workbench. */
  readonly name: string;
  readonly ports: FacePoolPorts;
  readonly settleMs?: number;
  readonly log?: (line: string) => void;
  readonly watch?: FacePoolWatchOptions["watch"];
  readonly cookie?: FacePoolWatchOptions["cookie"];
  readonly git?: GitRun;
}

/**
 * ARM THE WATCH over a shared wiki's workbench folder, the same seat a face pool takes. Hands back at once; off the boot path it
 * reads whether the folder's tree stands (naming a plain mirror where none does), then the watch, the cookie and the catch-up.
 * Every file of the folder wakes a wave but the house's ignore list, its skipped tops and editor litter. The down runs the final
 * wave, then the workbench's commit seam. The wake names nothing: a workbench holds no stage.
 */
export function armWorkspaceWatch(o: WorkspaceWatchOptions): FacePoolWatch {
  const git = o.git ?? runGit;
  const log = o.log ?? ((line: string) => console.log(`[workspaces] ${line}`));
  return armSeat({
    root: o.workspace, ports: o.ports, ...(o.settleMs !== undefined ? { settleMs: o.settleMs } : {}), log,
    ...(o.watch ? { watch: o.watch } : {}), ...(o.cookie ? { cookie: o.cookie } : {}),
    accepts: (rel) => !(rel.includes("/") && WORKSPACE_SKIP.includes(rel.split("/")[0] ?? "")),
    prepare: () => {
      if (!poolHistoryStands(o.workspace)) log(`${o.name}: no git tree stands at ${o.workspace} (\`lares surface init\` founds one); it serves as a plain mirror, and its seam commits nothing`);
    },
    commit: o.ports.commit ?? ((c: SittingClose) => workspaceCommitSeam(o.workspace, c, git)),
    covers: `the workbench ${o.name}`,
  });
}

// ── the one seat both hosts take ───────────────────────────────────────────────────────────────────────────────

interface SeatOptions {
  readonly root: string;
  readonly ports: FacePoolPorts;
  readonly settleMs?: number;
  readonly log: (line: string) => void;
  readonly watch?: FacePoolWatchOptions["watch"];
  readonly cookie?: FacePoolWatchOptions["cookie"];
  /** Whether a path (posix, relative to the root, already past the house's noise) opens a wave. */
  readonly accepts: (rel: string) => boolean;
  /** The first step off the boot path, before the wake (a workspace stands its tree here). */
  readonly prepare?: () => void;
  /** The wake's read: every stage edit made on disk since the last sitting. Absent: the wake names nothing and logs nothing. */
  readonly wake?: () => readonly StageEdit[];
  readonly commit: (close: SittingClose) => Promise<SeamReading>;
  /** What the live line names the watch stands over. */
  readonly covers: string;
}

function armSeat(o: SeatOptions): FacePoolWatch {
  const log = o.log;
  let state: WatchState = "arming";
  let watcher: FSWatcher | null = null;
  let downing: Promise<SeamReading> | null = null;
  const fault = (what: string) => (e: unknown): void => log(`${what} faulted: ${e instanceof Error ? e.message : String(e)}`);
  const seat = drainSeat({ settleMs: o.settleMs ?? POOL_SETTLE_MS, wave: (files) => o.ports.wave(files), onFault: fault("a wave") });

  const onEvent: WatchListener<string> = (_event, filename) => {
    if (!filename || state === "down") return;
    const rel = filename.toString().split(sep).join("/");
    if (isWatchNoise(rel) || !o.accepts(rel)) return;
    seat.hint(isAbsolute(rel) ? rel : join(o.root, ...rel.split("/")));
  };

  let wakeDone: (edits: readonly StageEdit[]) => void = () => {};
  const wake = new Promise<readonly StageEdit[]>((r) => { wakeDone = r; });

  const armed = (async (): Promise<WatchState> => {
    // Off the boot path: the arm's caller already holds its handle when this first step runs.
    await Promise.resolve();
    if (o.prepare) { try { o.prepare(); } catch (e) { fault("the stand of the tree")(e); } }
    let edits: readonly StageEdit[] = [];
    if (o.wake) {
      try { edits = o.wake(); } catch (e) { fault("the wake's stage read")(e); }
      log(wakeStageLine(edits));
    }
    wakeDone(edits);
    // `state` moves under a down that lands mid-arm: each step reads it afresh.
    const now = (): WatchState => state;
    if (now() === "down") return now();
    let live = false;
    try {
      mkdirSync(o.root, { recursive: true });
      watcher = (o.watch ?? ((d, w, l) => fsWatch(d, w, l)))(o.root, { recursive: true }, onEvent);
      watcher.on("error", (e) => { if (now() !== "down") { state = "inotify-dead"; log(`inotify-dead: the watch over ${o.root} failed (${e.message}); no poll stands, and the seam reads the whole pool once`); } });
      live = await (o.cookie ?? cookieSelfTest)(o.root, watcher);
    } catch (e) {
      log(`the watch over ${o.root} would not stand (${e instanceof Error ? e.message : String(e)})`);
    }
    if (now() === "down") return now();
    if (!live) {
      watcher?.close();
      watcher = null;
      state = "inotify-dead";
      log(`inotify-dead: no event echoed under ${o.root} (WSL2 /mnt emits none: keep the house on ext4); no poll stands, and the seam reads the whole pool once`);
    } else state = "catching-up";
    try { await o.ports.catchUp(); } catch (e) { fault("the wear's catch-up")(e); }
    if (now() === "catching-up") { state = "live"; log(`the watch stands over ${o.root} (${o.covers})`); }
    return now();
  })();

  return {
    state: () => state,
    armed,
    wake,
    down(close) {
      return (downing ??= (async (): Promise<SeamReading> => {
        const stood = await armed.catch(() => "inotify-dead" as const);
        state = "down";
        watcher?.close();
        watcher = null;
        seat.close();
        // THE FINAL WAVE: what stands buffered drains; where no event could name what moved, the whole pool reads once.
        if (stood === "inotify-dead") { try { await o.ports.catchUp(); } catch (e) { fault("the final catch-up")(e); } }
        else await seat.flush();
        const reading = await o.commit(close).catch((e: unknown): SeamReading =>
          ({ committed: false, why: "commit-refused", detail: e instanceof Error ? e.message : String(e) }));
        log(reading.committed ? `the sitting closes at ${close}: the pool commits ${reading.sha.slice(0, 12)}`
          : reading.why === "commit-refused" ? `the sitting closes at ${close}: the pool's commit refused (${reading.detail})`
          : `the sitting closes at ${close}: the pool commits nothing (${reading.why})`);
        return reading;
      })());
    },
  };
}

// The vessel's ports over the worn face's pool stand beside the ingest machinery (`poolIngestPorts`, `ingest-scan`): each wave
// lands as an unattended INGEST wave, and a stand-off, a vanish and a margin go to the disk shore's look.
