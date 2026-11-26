/**
 * canon-ear — THE VESSEL HEARS THE CANON SOURCE (operator ruling, 2026-11-26: "any change to a canon on-disk file ends up in
 * the working layer, and takes the human hand to promote").
 *
 * The canon source (`daemonBagsDir()`: `LAR_BAGS`, the config's bags, else `<corpus>/bags`) holds one folder per canon bag
 * (`projectionRoots(...).sourcedSlugs()`). A hand that edits a carrier there moves a file the house's canon records never
 * read: the projecting leg stands down over it (`records-unmoved`), and no workbench watch covers a sourced slug. The ear
 * stands the pool's seat over that source (`armCanonSourceWatch`, `watch-core.ts`) and lands each settled change in the
 * WORKING layer of the wiki that composes the bag (`wikis/<slug>/working`), in that wiki's own island, as one unattended
 * INGEST wave whose receipt names `writer: disk`. Canon takes nothing: a working record moves into canon only through a
 * promote a person's hand makes.
 *
 * THE THREE-WAY READ. The working layer's base stands AT THE CANON FILE (the working mirror `hears` that folder, so the island
 * that projects the layer verifies and pins the base itself, `pinAgreement`). A file that stands as the last landing left it
 * rides no wave; a file that moved while the working record held still lands; both moved stands off, by name, for a hand.
 * A file that stands as canon's own base names it (the last agreement between that file and the canon records) rides nothing,
 * and a base the canon agreement has since caught up with (a promote landed it) reads as spent.
 *
 * THE HOUSE'S OWN WRITE STANDS APART. On a checkout-sourced boot the projector writes canon back into this folder; the ear
 * asks the island that projects the canon bag whether the file says what its canon records say (`canonAgrees`, the shore's
 * `base` act), and a file that agrees rides nothing: an echo, never a hand's edit.
 *
 * GIT MOVES STAND ASIDE (`readCanonGit`). A checkout, rebase, pull, merge or reset rewrites files in bulk, and none of that
 * reads as a hand's edit:
 *
 *   moving      git holds the index lock, or HEAD or the index moved while the wave read: the wave waits (a paced re-read),
 *               and files a still-moving git held ride the next wave
 *   clean       the file's bytes stand as the index names them (git wrote them, or a commit took them): it stands aside
 *   under way   a merge, rebase, cherry-pick or revert stands open: every carrier stands aside until it ends
 *   unmerged    the index holds the path unmerged, or its bytes carry a conflict's marker lines: the carrier refuses by name
 *   hand        the worktree differs from the index, or git tracks no such file: a hand's edit, and it rides
 *
 * A checkout git cannot read answers why and lands nothing: the ear cannot tell a hand's edit from a source-control move.
 * A canon source no checkout holds (a scratch house's `<root>/bags`) reads every live change as a hand's.
 *
 * THE CATCH-UP reads what git names moved under each bag folder, never the whole source: an edit a hand left uncommitted
 * while the house rested lands at the arm. A file no agreement ever named (no canon base, no working base) rides no
 * catch-up; a live change to one rides.
 *
 * Host-process code by nature: it reads the filesystem and spawns git. The landing itself runs in the wiki island (INGEST).
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/ruling/2026-11-26-canon-disk-lands-working
 */

import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { BAG_MANIFEST_FILE } from "@lararium/mesh/bag-manifest";
import { wikiBagUri, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { houseIgnored } from "./bag-paths.js";
import {
  candidatesOf, openSyncedTree, ridesInline, scanFiles, settleIngest, siteMirrorFile, skipLines, titleOf,
  type BaseDoor, type BaseRoad, type IngestSubmit, type ScanRow,
} from "./ingest-scan.js";
import { walledGit } from "./pool-head.js";
import { syncedTreeKey, type SyncedTree } from "./synced-tree.js";
import type { FacePoolPorts, GitRun } from "./watch-core.js";

// ── git's reading of the checkout ──────────────────────────────────────────────────────────────────────────────

/** How one file stands in git's eyes: a hand's edit, bytes the index already names, or an unmerged path. */
export type CanonGitPath = "hand" | "clean" | "unmerged";

export type CanonGitReading =
  /** No `.git` stands at or above the folder: every change there reads as a hand's. */
  | { readonly kind: "no-checkout" }
  /** A checkout stands and git gave no reading: nothing tells a hand's edit from a source-control move. */
  | { readonly kind: "unanswered"; readonly why: string }
  /** Git moves now: the index lock stands, or HEAD or the index moved while the read ran. */
  | { readonly kind: "moving"; readonly why: string }
  | {
    readonly kind: "read";
    /** HEAD as the read found it (the commit, 12 hex; `unborn` where the branch holds none). */
    readonly head: string;
    /** The multi-step move that stands open (`a merge`, `a rebase`, …), or null. */
    readonly underWay: string | null;
    /** How a file under the folder stands. */
    readonly state: (file: string) => CanonGitPath;
    /** Every file under the folder git names as other than clean (absolute paths): what a catch-up reads. */
    readonly moved: readonly string[];
  };

/** THE PORT the ear reads git by: one folder, and the files a wave touched there (null: the whole folder, a catch-up). */
export type CanonGitRead = (dir: string, files: readonly string[] | null) => CanonGitReading;

/** The nearest directory at or above `dir` that holds a `.git` entry, or null. */
function checkoutAbove(dir: string): string | null {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return d;
    if (dirname(d) === d) return null;
  }
}

/** The index's own trailing checksum (its last 20 bytes), as hex: git rewrites it with every index it writes. */
function indexChecksum(index: string): string {
  let fd: number;
  try { fd = openSync(index, "r"); } catch { return "none"; }
  try {
    const size = fstatSync(fd).size;
    if (size < 20) return `short:${size}`;
    const tail = Buffer.alloc(20);
    readSync(fd, tail, 0, 20, size - 20);
    return tail.toString("hex");
  } catch { return "unread"; } finally { closeSync(fd); }
}

/** The multi-step moves git leaves a marker for while they stand open, each with the name a log line gives it. */
const UNDER_WAY: ReadonlyArray<readonly [string, string]> = [
  ["MERGE_HEAD", "a merge"], ["rebase-merge", "a rebase"], ["rebase-apply", "a rebase"],
  ["CHERRY_PICK_HEAD", "a cherry-pick"], ["REVERT_HEAD", "a revert"],
];

/** The index states that name an unmerged path (`git status`, the short format's XY). */
const UNMERGED = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/** How many paths one `git status` names: well inside an argument list's bound. */
const STATUS_PAGE = 200;

/**
 * READ GIT'S VIEW OF A CANON FOLDER, with no write: `--no-optional-locks` keeps the read from refreshing the index, so the
 * ear's own look never moves the thing it watches. The read names HEAD and the index's checksum before and after; a lock
 * that stands, or either one moving across the read, answers `moving`.
 */
export function readCanonGit(git: GitRun = walledGit): CanonGitRead {
  return (dir, files) => {
    if (checkoutAbove(dir) === null) return { kind: "no-checkout" };
    const run = (args: readonly string[]) => git(["-c", "safe.directory=*", ...args], dir);
    const unanswered = (said: string, at: string): CanonGitReading => ({
      kind: "unanswered",
      why: /ENOENT|not found|spawn/i.test(said) || said.trim() === ""
        ? `git cannot run in this runtime (${at})`
        : `git could not read the checkout above ${dir} (${said.trim().split("\n")[0]})`,
    });
    const placed = run(["rev-parse", "--show-toplevel", "--absolute-git-dir", "--show-prefix"]);
    if (placed.code !== 0) return unanswered(placed.stderr, "rev-parse");
    const [top = "", gitDir = "", prefix = ""] = placed.stdout.split("\n");
    if (top === "" || gitDir === "") return unanswered("git named no top and no git dir", "rev-parse");
    const stamp = (): { head: string; index: string; lock: boolean } => {
      let ref = "";
      try { ref = readFileSync(join(gitDir, "HEAD"), "utf8").trim(); } catch { /* an unreadable HEAD names itself below */ }
      const at = run(["rev-parse", "-q", "--verify", "HEAD"]);
      return { head: `${ref}@${at.code === 0 ? at.stdout.trim() : "unborn"}`, index: indexChecksum(join(gitDir, "index")), lock: existsSync(join(gitDir, "index.lock")) };
    };
    const before = stamp();
    if (before.lock) return { kind: "moving", why: "git holds the index lock" };
    const specs = files === null ? ["."] : files.map((f) => relative(dir, f).split(sep).join("/")).filter((r) => r !== "" && !r.startsWith("../"));
    const states = new Map<string, CanonGitPath>();
    for (let at = 0; at < Math.max(specs.length, 1) && specs.length > 0; at += STATUS_PAGE) {
      const status = run(["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", "--", ...specs.slice(at, at + STATUS_PAGE)]);
      if (status.code !== 0) return unanswered(status.stderr, "status");
      const entries = status.stdout.split("\0");
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        if (e.length < 4) continue;
        const xy = e.slice(0, 2);
        // A rename or a copy names its source in the next entry; the source names no file of its own here.
        if (xy[0] === "R" || xy[0] === "C") i++;
        states.set(e.slice(3), UNMERGED.has(xy) ? "unmerged" : xy === "??" || xy === "!!" || xy[1] !== " " ? "hand" : "clean");
      }
    }
    const after = stamp();
    if (after.lock) return { kind: "moving", why: "git took the index lock while the wave read" };
    if (after.head !== before.head) return { kind: "moving", why: "HEAD moved while the wave read" };
    if (after.index !== before.index) return { kind: "moving", why: "the index moved while the wave read" };
    const underWay = UNDER_WAY.find(([marker]) => existsSync(join(gitDir, marker)))?.[1] ?? null;
    // `git status --porcelain` names each path from the checkout's top; `--show-prefix` names this folder from there.
    const fromTop = (file: string): string => `${prefix}${relative(dir, file).split(sep).join("/")}`;
    const here = prefix === "" ? null : prefix;
    return {
      kind: "read",
      head: after.head.endsWith("@unborn") ? "unborn" : after.head.slice(after.head.lastIndexOf("@") + 1, after.head.lastIndexOf("@") + 13),
      underWay,
      // A folder git names whole (an ignored directory reads as one entry, `dir/`) answers for every file beneath it.
      state: (file) => {
        const path = fromTop(file);
        const own = states.get(path);
        if (own !== undefined) return own;
        for (const [named, state] of states) if (named.endsWith("/") && path.startsWith(named)) return state;
        return "clean";
      },
      moved: [...states].filter(([path, state]) => state !== "clean" && !path.endsWith("/")).map(([path]) => path)
        .filter((path) => here === null || path.startsWith(here))
        .map((path) => join(dir, ...path.slice(here?.length ?? 0).split("/"))).sort(),
    };
  };
}

/** Whether a carrier's text holds the three marker lines an unsettled merge leaves (`<<<<<<<`, `=======`, `>>>>>>>`). */
export function holdsConflictMarkers(text: string): boolean {
  return /^<{7}(?: |$)/m.test(text) && /^={7}$/m.test(text) && /^>{7}(?: |$)/m.test(text);
}

// ── the echo read: does the file say what canon's own records say? ─────────────────────────────────────────────

/** The carriers of one canon bag whose file agrees with the canon records, as the island that projects the bag reads them. */
export type CanonAgrees = (slug: string, bag: string, carriers: ReadonlyArray<{ readonly uri: string; readonly file: string }>) => Promise<ReadonlySet<string>>;

/**
 * ASK THE ISLAND THAT PROJECTS THE CANON BAG (the shore's `base` act, `pinAgreement`): it hashes each file itself, renders its
 * own canon records, and counts the agreements. The act answers by count, so a page that agrees whole or not at all reads at
 * once, and a mixed page halves until each carrier answers for itself. An island that mounts no shore or holds no mirror of
 * the bag passes the ask on; where none answers, no carrier reads as agreeing (no projector wrote the file, so no echo stands).
 */
export function canonAgreementAsk(roads: (slug: string, bag: string) => readonly BaseRoad[]): CanonAgrees {
  const count = (o: Record<string, unknown>, name: string): number => (typeof o[name] === "number" && Number.isSafeInteger(o[name]) && (o[name] as number) >= 0 ? (o[name] as number) : 0);
  return async (slug, bag, carriers) => {
    const asked = roads(slug, bag);
    const agreed = new Set<string>();
    const ask = async (page: ReadonlyArray<{ readonly uri: string; readonly file: string }>): Promise<void> => {
      if (page.length === 0) return;
      let agreeing = 0;
      for (const road of asked) {
        let o: Record<string, unknown>;
        try { o = ((await road({ op: "base", bag, bases: page.map(({ uri, file }) => ({ uri, file })) })) ?? {}) as Record<string, unknown>; }
        catch { continue; }
        if (o["ok"] === true) { agreeing = count(o, "recorded") + count(o, "kept") + count(o, "waiting"); break; }
        if (o["refusal"] === "no-disk-shore" || o["refusal"] === "bag-unprojected") continue;
        break;
      }
      if (agreeing >= page.length) { for (const c of page) agreed.add(c.uri); return; }
      if (agreeing === 0 || page.length === 1) return;
      const half = Math.ceil(page.length / 2);
      await ask(page.slice(0, half));
      await ask(page.slice(half));
    };
    await ask(carriers);
    return agreed;
  };
}

// ── the ear's ports ────────────────────────────────────────────────────────────────────────────────────────────

export interface CanonEarOptions {
  /** The canon source: the folder that holds one folder per canon bag (`daemonBagsDir()`). */
  readonly canonBags: string;
  /** The bags whose folder stands there (`projectionRoots(...).sourcedSlugs()`): each lands in the working layer of the wiki of its own slug. */
  readonly slugs: readonly string[];
  /** The submit port for one slug: in the vessel, that wiki's own island (`wiki-act` carrying the INGEST). */
  readonly submit: (slug: string) => IngestSubmit;
  /** The worn face's actor: every wave lands under it, and its receipt names the disk as the writer. */
  readonly did: string;
  /** Where a slug's bases land, over the tree its wave read (`islandBaseDoor` over the wiki island's shore in the vessel);
   *  absent, that tree itself. */
  readonly base?: (slug: string) => (tree: SyncedTree) => BaseDoor;
  /** The echo read (`canonAgreementAsk` in the vessel); absent, no carrier reads as the house's own write. */
  readonly canonAgrees?: CanonAgrees;
  /** Git's reading of a canon folder; absent, `readCanonGit()`. */
  readonly git?: CanonGitRead;
  /** The Synced tree each wave reads afresh; absent, the projection checkpoint's (`openSyncedTree`). */
  readonly tree?: () => SyncedTree;
  /** PACING for a git that moves: how many re-reads a wave makes, and the pause between two. Neither decides what lands. */
  readonly rest?: { readonly reads?: number; readonly pause?: () => Promise<void> };
  readonly log?: (line: string) => void;
}

/** How many times a wave re-reads a git that moves before it hands its files to the next wave. */
export const CANON_GIT_READS = 20;
/** The pause between two reads of a git that moves. */
export const CANON_GIT_PAUSE_MS = 250;

/** How many names one log line carries before it counts the rest. */
const NAMED = 5;
const named = (names: readonly string[]): string => `${names.slice(0, NAMED).join(", ")}${names.length > NAMED ? `, … (${names.length - NAMED} more)` : ""}`;

/**
 * THE EAR'S WAVE AND CATCH-UP over the canon source. One wave at a time; each bag folder's touched carriers settle as one
 * unattended INGEST wave into `wikis/<slug>/working`, run in that wiki's island, `writer: disk`.
 */
export function canonEarPorts(o: CanonEarOptions): Pick<FacePoolPorts, "catchUp" | "wave"> {
  const log = o.log ?? (() => {});
  const git = o.git ?? readCanonGit();
  const reads = o.rest?.reads ?? CANON_GIT_READS;
  const pause = o.rest?.pause ?? ((): Promise<void> => new Promise((r) => { setTimeout(r, CANON_GIT_PAUSE_MS); }));
  const root = resolve(o.canonBags);
  /** The files a still-moving git held back: each rides the next wave. */
  const held = new Set<string>();
  /** The bag folders the ear already named as outside any checkout. */
  const plain = new Set<string>();
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => { const next = chain.then(work, work); chain = next.catch(() => {}); return next; };

  /** A file's bag folder and its carrier's content file (a `.meta` names the file it rides with), or null outside every bag. */
  const placeOf = (file: string): { readonly slug: string; readonly content: string } | null => {
    const rel = relative(root, resolve(file)).split(sep);
    const slug = rel[0] ?? "";
    if (rel.length < 2 || !o.slugs.includes(slug)) return null;
    const content = file.endsWith(".meta") ? file.slice(0, -".meta".length) : file;
    // A bag's own declaration stays on disk and never becomes a record (`listSourceFiles`).
    if (resolve(content) === join(root, slug, BAG_MANIFEST_FILE)) return null;
    if (houseIgnored(relative(join(root, slug), content).split(sep).join("/")) !== null) return null;
    return { slug, content };
  };

  /** Git's reading of one folder once it rests: a git that moves gets read again, paced, a bounded number of times. */
  const restingGit = async (dir: string, files: readonly string[] | null): Promise<CanonGitReading> => {
    let reading = git(dir, files);
    for (let read = 1; reading.kind === "moving" && read < reads; read++) { await pause(); reading = git(dir, files); }
    return reading;
  };

  const slugWave = async (slug: string, touched: readonly string[] | null): Promise<void> => {
    const dir = join(root, slug);
    const label = `bags/${slug}/`;
    const working = wikiSlotUri(slug, "working");
    const canonBag = wikiBagUri(slug);
    const reading = await restingGit(dir, touched);
    if (reading.kind === "unanswered") {
      log(`${label}: ${reading.why}, so nothing tells a hand's edit from a source-control move and nothing lands. \`lares ingest --source <file> --to ${working} --in-wiki --apply\` lands a carrier by name`);
      return;
    }
    if (reading.kind === "moving") {
      for (const f of touched ?? []) held.add(f);
      log(`${label}: stands aside while git moves (${reading.why}); nothing lands, and ${touched === null ? "the next change under it asks again" : `${touched.length} file(s) ride the next wave`}`);
      return;
    }
    let files: readonly string[];
    if (touched !== null) files = touched;
    else if (reading.kind === "no-checkout") {
      if (!plain.has(slug)) { plain.add(slug); log(`${label}: no checkout holds it, so the ear hears each live change there and reads none made while the house rested; \`lares ingest --source ${dir} --to ${working} --in-wiki\` previews what moved`); }
      return;
    } else files = [...new Set(reading.moved.map((f) => placeOf(f)).filter((p): p is NonNullable<typeof p> => p !== null && p.slug === slug).map((p) => p.content))];
    if (files.length === 0) return;

    const tree = o.tree?.() ?? openSyncedTree();
    const scan = scanFiles(dir, files, working, tree, (_r, file) => titleOf(siteMirrorFile(root, file, tree, false)));
    for (const line of skipLines(scan.skipped.filter((s) => existsSync(s.file)))) log(line);
    const short = (file: string): string => relative(root, file).split(sep).join("/");
    const aside: string[] = [];
    const open: string[] = [];
    const unagreed: string[] = [];
    let ride: ScanRow[] = [];
    for (const row of scan.rows) {
      if (row.status === "unchanged") continue;
      if (row.status === "deleted") { log(`${short(row.file)} left the disk: nothing lands for it, and ${working} keeps what it holds`); continue; }
      if (row.status === "non-nfc") { log(`refuses: ${short(row.file)} holds text outside NFC; nothing lands`); continue; }
      const canonBase = tree.baseAt(syncedTreeKey(canonBag, row.uri), row.file);
      // THE FILE STANDS AS CANON'S OWN AGREEMENT NAMES IT, and the working layer took nothing from it since: nothing moved.
      if (row.syncedHash === null && canonBase !== null && digestsEqual(canonBase.disk, row.diskHash)) continue;
      const state = reading.kind === "read" ? reading.state(row.file) : "hand";
      if (state === "unmerged" || holdsConflictMarkers(row.text)) {
        log(`refuses: ${short(row.file)} (conflict-markers-stand: ${state === "unmerged" ? "git holds the path unmerged" : "its bytes carry a conflict's marker lines"}, so no settled words stand to land; settle the merge, then the next change to the file lands)`);
        continue;
      }
      if (state === "clean") { aside.push(short(row.file)); continue; }
      if (reading.kind === "read" && reading.underWay !== null) { open.push(short(row.file)); continue; }
      // NO AGREEMENT EVER NAMED THE FILE: a catch-up rides none (a house that never read its canon source would land it whole).
      if (touched === null && row.syncedHash === null && canonBase === null) { unagreed.push(short(row.file)); continue; }
      // A BASE CANON HAS CAUGHT UP WITH READS AS SPENT: a promote landed those words, so the working layer owes them nothing.
      if (row.syncedHash !== null && canonBase !== null && digestsEqual(canonBase.disk, row.syncedHash)) {
        const { syncedRecordsHash: _records, ...rest } = row;
        ride.push({ ...rest, syncedHash: null, status: "new" });
        continue;
      }
      ride.push(row);
    }
    const head = reading.kind === "read" ? reading.head : "";
    if (aside.length > 0) log(`stands aside: ${aside.length} canon carrier(s) under ${label} stand as git's index names them (HEAD ${head}), a source-control move and never a hand's edit; nothing lands in ${working}: ${named(aside)}`);
    if (open.length > 0) log(`stands aside: ${reading.kind === "read" ? reading.underWay : "a move"} stands open in the checkout, so ${open.length} canon carrier(s) under ${label} wait for it to end; nothing lands: ${named(open)}`);
    if (unagreed.length > 0) log(`${unagreed.length} canon carrier(s) under ${label} hold no agreement with the house yet, so the catch-up lands none; a live change to one lands: ${named(unagreed)}`);
    ride = candidatesOf(ride);
    for (const row of ride) if (!ridesInline(row)) log(`${short(row.file)} rides a pointer to its bytes, which the ear's wave stages none of; \`lares ingest --source ${row.file} --to ${working} --in-wiki --apply\` lands it by name`);
    ride = ride.filter(ridesInline);
    if (ride.length > 0 && o.canonAgrees) {
      // THE HOUSE'S OWN WRITE: a file that says what the canon records say came from the projecting leg (or equals it), and rides nothing.
      const echo = await o.canonAgrees(slug, canonBag, ride.map((r) => ({ uri: r.uri, file: r.file })));
      ride = ride.filter((r) => !echo.has(r.uri));
    }
    if (ride.length === 0) return;
    const settled = await settleIngest(
      { source: dir, toBag: working, candidates: ride, did: o.did, unattended: true, writer: "disk", inWiki: true, wiki: slug },
      tree, o.submit(slug), {}, o.base?.(slug)(tree),
    );
    if (settled.first.status === "error") {
      log(`a wave over ${label} refused (${settled.first.errorMessage ?? "the island named no reason"}): nothing landed for ${named(ride.map((r) => short(r.file)))}; the next change to a file asks again`);
      return;
    }
    const bases = settled.bases;
    if (bases !== undefined && bases.waiting > 0) log(`${bases.waiting} base(s) from ${label} wait on the island's pending pin until its heads rest; \`lares shore flush\` names each pin that waits`);
    if (bases !== undefined && bases.unread + bases.differs + bases.owed > 0) log(`${bases.unread + bases.differs + bases.owed} base(s) from ${label} pinned nothing (${bases.why ?? "the island read a file and records that differ, or no file"}); the next wave over those files weighs each again`);
    for (const c of settled.conflicts) log(`stands off: ${c.uri} (${c.why}): the canon file and ${working} both moved, and a hand picks; \`lares ingest --source ${ride.find((r) => r.uri === c.uri)?.file ?? dir} --to ${working} --in-wiki --apply\` lands the file's words`);
    for (const r of settled.refused) log(`refuses: ${r.uri} (${r.why})`);
    for (const uri of settled.unanswered) log(`unanswered: ${uri}; the next change to its file asks again`);
    if (settled.pageError !== undefined) log(`a later wave failed (${settled.pageError.message}); ${settled.pageError.unread} carrier(s) stay unread until the next change`);
    const landed = [...settled.landed];
    if (landed.length > 0) log(`lands ${landed.length} canon carrier(s) from ${label} into ${working} (writer: disk); canon stands unmoved until a hand promotes (\`lares meme offer promote\`): ${named(landed)}`);
  };

  const waveOver = async (files: readonly string[], whole: boolean): Promise<void> => {
    if (whole) { for (const slug of o.slugs) await slugWave(slug, null); return; }
    const bySlug = new Map<string, Set<string>>();
    const carried = [...held];
    held.clear();
    for (const file of [...carried, ...files]) {
      const place = placeOf(file);
      if (place === null) continue;
      const list = bySlug.get(place.slug) ?? new Set<string>();
      list.add(place.content);
      bySlug.set(place.slug, list);
    }
    for (const [slug, list] of bySlug) await slugWave(slug, [...list]);
  };

  return {
    catchUp: () => serial(() => waveOver([], true)),
    wave: (files) => serial(() => waveOver(files, false)),
  };
}
