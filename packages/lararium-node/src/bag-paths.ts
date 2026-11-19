/**
 * bag-paths — URI → mirror-relative-path factories.
 *
 * The named-bag layout (`bags/NAME`) makes per-scope path computation
 * derivable from the bag scope alone. No oracle tiddler `path-filter` field
 * needed. The siting factories stay pure (no I/O, no module state); the read-back (`siteFileToTitle`) reads a file's own
 * stated title, and `projectionRoots` reads the canon source once.
 */

import { resolve as resolvePath, join as joinPath, dirname, basename, extname, isAbsolute, sep } from "path";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "fs";
import { stripMemeExt, wikiSlotUri, projectionWithheld, daemonFaceCanonBag, KAHUA_BAG, CROSSROADS_DOC_URI, type ProjectionClass } from "@lararium/mesh";
import { ORPHAN_FOLDER_SUFFIX } from "@lararium/mesh/family";

export interface BagMirrorConfig {
  /** The bag whose changes this mirror reflects. */
  readonly bagId: string;
  /** Absolute filesystem path; all writes are constrained under this root. */
  readonly mirrorRoot: string;
  /** Marks a grant intended for bag-specific recovery projection. */
  readonly mirrorClass?: "recovery";
  /**
   * Widened grant (capability, rides the manifest's diskMirrors): the mirror
   * MAY place files DIRECTLY in the root-bags-dir — the nearest ancestor of
   * mirrorRoot named `bags`, the dir holding every @{bagname} subdir — one
   * level up. It MUST NEVER escape the bags dir or write inside another
   * bag's subdir; `confineMirrorWrite` enforces this structurally
   * (dirname(candidate) === bagsDir exactly). Default: own subdir only.
   */
  readonly allowBagsRootFiles?: boolean;
  /**
   * The title-path siting: a title that owns no uri-path sites at its own `/`-separated path inside the mirror (a project
   * rides as the leading segment), where TW5's flattened default would fold every `/` into `_`. A `lar:` title keeps the
   * loci law; a `$:/` system title and a `$FileSystemPaths` rule keep their own sitings.
   */
  readonly titlePaths?: boolean;
  /**
   * The wiki's USER temp layer (`wikis/{slug}/temp`), granted under the operator's consent row: a recovery-class mirror
   * whose bag also carries the house's own volatile state, so the projector bars that state by namespace
   * ({@link isTempLayerInternalTitle}) and projects only what a hand or a verb set down in the layer on purpose.
   */
  readonly tempLayer?: boolean;
}

/** The leaf a wiki's user temp layer projects under, beside its working mirror: `wikis/<wiki-folder>/temp`. */
export const TEMP_LAYER_DIR = "temp";

/**
 * Whether a title in the temp layer names the house's INTERNAL state rather than user temp content: what the projection
 * filters withhold from a temp mirror (`@lararium/mesh` `projection-filter`: the base and
 * `$:/config/lares/ProjectionFilter/temp`: TiddlyWiki's temp and state namespaces and the house's config plane). The
 * read-back reads the same line the projector writes by.
 */
export function isTempLayerInternalTitle(title: string): boolean {
  return projectionWithheld(title, ["temp"]);
}

// ── Write confinement — the sovereign-island disk ward ─────────────────────
//
// Cascade tiddlers (`$:/config/FileSystemPaths` overlays) compose through the RECIPE —
// a library bag can overlay them — so every relative path reaching the
// projector counts as UNTRUSTED input. Policy lives in the cascade; this gate
// (the mechanism) holds at the write choke-point regardless of what the
// cascade emitted.

export type ConfineResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: string };

/** Nearest ancestor of `root` whose basename reads `bags`, or null. */
function findBagsDir(root: string): string | null {
  let dir = root;
  for (;;) {
    if (basename(dir) === "bags") return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Confine a mirror write. Allowed:
 *   - any path resolving UNDER mirrorRoot (the bag's own subdir), or
 *   - with `allowBagsRootFiles`: a file DIRECTLY in the root-bags-dir
 *     (never inside another bag's subdir, never above bags, never deeper).
 * Everything else refuses with a reason the projector surfaces loudly.
 */
export function confineMirrorWrite(
  mirrorRoot: string,
  relPath: string,
  allowBagsRootFiles = false,
): ConfineResult {
  if (isAbsolute(relPath)) return { ok: false, reason: `absolute path refused: ${relPath}` };
  const root      = resolvePath(mirrorRoot);
  const candidate = resolvePath(joinPath(root, relPath));
  if (candidate === root) return { ok: false, reason: "write to mirror root itself refused" };
  if (candidate.startsWith(root + "/")) return { ok: true, path: candidate };
  if (allowBagsRootFiles) {
    const bagsDir = findBagsDir(root);
    if (!bagsDir) return { ok: false, reason: `mirror root carries no bags ancestor; widened grant inert (${root})` };
    if (dirname(candidate) === bagsDir) return { ok: true, path: candidate };
    return { ok: false, reason: `widened grant covers files DIRECTLY in ${bagsDir} only — refused: ${candidate}` };
  }
  return { ok: false, reason: `escapes mirror root ${root}: ${candidate}` };
}

function splitHash(s: string): [string, string | null] {
  const i = s.indexOf("#");
  return i >= 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, null];
}

/**
 * The siting function (lar-uri #five-planes) — the ONE URI → disk-path map: every
 * carrier lives at its FULL uri-path inside its holding bag's mirror (directory =
 * residency, interior path = the name, whole). This returns the path up to (but
 * NOT including) the filetype extension — the render shore owns the extension
 * (`.mem` for memetic, TW5's chosen extension for a native filetype), so both
 * filetypes site at the SAME `<uri-path>` and only the extension differs.
 *
 *   lar:///ha.ka.ba/lares/api/pono/meme → ha.ka.ba/lares/api/pono/meme
 *
 * Carrier-whole at rest (disk-projection#granularity): a fragment record
 * (`…#slot`) never owns a disk file — its carrier root does; a fragment URI (and
 * an unstable root) resolves to null (address siting rule).
 */
export function carrierBaseRelPath(uri: string): string | null {
  if (!uri.startsWith("lar:///")) return null;
  const bare = uri.slice("lar:///".length);
  if (!/^\w+\.\w+\.\w+\//.test(bare)) return null;
  const [pathPart, frag] = splitHash(bare);
  if (frag || !pathPart) return null;                    // a fragment never owns a file
  return stripMemeExt(pathPart);
}

/**
 * Construct a BagMirrorConfig for a named bag. `scope` rides as grant
 * metadata only — the siting function (`carrierBaseRelPath`) carries every
 * stable name whole; the mirrorRoot = the bag's residency dir.
 */
export function namedBagMirror(
  bagId: string, scope: string, mirrorRoot: string, titlePaths?: boolean, mirrorClass?: "recovery",
  tempLayer?: boolean,
): BagMirrorConfig {
  void scope;
  return { bagId, mirrorRoot, ...(titlePaths ? { titlePaths } : {}), ...(mirrorClass ? { mirrorClass } : {}), ...(tempLayer ? { tempLayer } : {}) };
}

/**
 * THE FACE ROOT (operator ruling 2026-11-18, "one pool per face keyed by pet name"): every private plane a face holds rests in ONE
 * working tree under the house's projections root, named by the face's PET NAME, never by its relation. A relation id changes at
 * every re-found, so a relation-keyed folder orphans; the pet name carries across, and `projections/` outlives the hearth:
 *
 *   <projections>/faces/<pet name>/
 *     wiki/              the face's daemon working layer
 *     canon/             the face's daemon canon (`bags/daemon-<F>`: the BAG keeps its relation, the folder never does)
 *     stage/             the kahua memory stage
 *     personal/<slug>/    the face's personal layer over a shared wiki (its overlay layer, never a copy of the workbench)
 *     recovery/<slug>/   the face's unsaved drafts in a shared wiki
 *     temp/<slug>/       a shared wiki's consented temp layer, beside recovery
 *
 * A face root holds ONLY the face's private planes: a shared wiki's workbench and every domain bag rest in their realm pool
 * (`realms/<realm pet name>/wikis/<slug>/` and `/bags/<slug>/`, or the workspace a share row names), one disk copy whichever
 * face wears. No index file that links faces
 * (`face-labels/`, `kahua-index.toml`, `share.tid`, `kahua-pending.json`) ever rests under `faces/`.
 */
export const FACES_PROJECTION_DIR = "faces";
/** The planes inside a face root. */
export const FACE_PLANES = { wiki: "wiki", canon: "canon", stage: "stage", personal: "personal", recovery: "recovery", temp: TEMP_LAYER_DIR } as const;

/** Why a pet name makes no face segment, by name. */
export type FaceSegmentCode =
  | "face-segment-empty" | "face-segment-separator" | "face-segment-colon" | "face-segment-nul" | "face-segment-leading-dot" | "face-segment-collision";

/** A pet name the face-segment rule refuses, by name. */
export class FaceSegmentRefused extends Error {
  override readonly name = "FaceSegmentRefused";
  constructor(readonly code: FaceSegmentCode, message: string) { super(`${code}: ${message}`); }
}

/** The fold two segments collide under: NFC, then lower case. */
const segmentFold = (segment: string): string => segment.normalize("NFC").toLowerCase();

/**
 * THE PET-NAME SEGMENT RULE: why a pet name makes no face folder, or null where it makes one. It refuses `/`, `\`, `:`, NUL, a
 * leading dot (so `.` and `..` too), an empty name, and a name that collides case-insensitively with another face's segment
 * (`others`: the segments of the OTHER faces; the same segment collides too, since no two faces share a root).
 */
export function faceSegmentRefusal(petname: string | null | undefined, others: readonly string[] = []): { readonly code: FaceSegmentCode; readonly why: string } | null {
  if (typeof petname !== "string" || petname.length === 0) return { code: "face-segment-empty", why: "a face with no pet name makes no folder: name it (`lares persona new <N> --name <label>`)" };
  const name = petname.normalize("NFC");
  const shown = JSON.stringify(name);
  if (/[/\\]/.test(name)) return { code: "face-segment-separator", why: `the pet name ${shown} holds a path separator, so it names no single folder` };
  if (name.includes(":")) return { code: "face-segment-colon", why: `the pet name ${shown} holds a colon, which no portable folder name carries` };
  if (name.includes("\0")) return { code: "face-segment-nul", why: `the pet name ${shown} holds a NUL byte` };
  if (name.startsWith(".")) return { code: "face-segment-leading-dot", why: `the pet name ${shown} leads with a dot, so its folder would hide itself or name a parent` };
  const twin = others.find((o) => segmentFold(o) === segmentFold(name));
  if (twin !== undefined) return { code: "face-segment-collision", why: `the pet name ${shown} meets another face's folder ${JSON.stringify(twin)} (folders compare without case), and no two faces share a root: rename one` };
  return null;
}

/** The face folder a pet name makes: the name as written (spaces and Unicode kept), NFC. Throws {@link FaceSegmentRefused}. */
export function faceSegment(petname: string, others: readonly string[] = []): string {
  const refused = faceSegmentRefusal(petname, others);
  if (refused !== null) throw new FaceSegmentRefused(refused.code, refused.why);
  return petname.normalize("NFC");
}

/** A face as its private mirrors name it: its relation (the BAG identities it holds) and its segment (the FOLDER it rests in). */
export interface FaceSite { readonly relation: string; readonly segment: string }

/** `<projections>/faces/<segment>`: the one root of a face's private planes. */
export function faceRoot(projectionRoot: string, segment: string): string {
  return joinPath(projectionRoot, FACES_PROJECTION_DIR, faceSegment(segment));
}

/**
 * THE REALM ROOT (operator ruling 2026-11-19, "The filepath for realms should include their 'pet-name' to match faces"): a realm
 * holds its shared wikis' workbenches and its domain bags in one folder under the projections root, named by the PET NAME the
 * operator gives the realm (a local label, `realm-labels.ts`), never by a realm id:
 *
 *   <projections>/realms/<realm pet name>/
 *     wikis/<slug>/      each wiki's one workbench (its own git tree: `lares surface init --realm <pet name>`)
 *     bags/<slug>/       each domain bag's canon mirror
 *
 * The realm pet name follows the face segment rule (`realmPetNameRefusal`), so it names exactly one folder. No index file that
 * links realms or faces (`realm-labels/`, `face-labels/`) ever rests under `realms/`.
 */
export const REALMS_PROJECTION_DIR = "realms";
/** The planes inside a realm root. */
export const REALM_PLANES = { wikis: "wikis", bags: "bags" } as const;

/** `<projections>/realms/<pet name>`: the one root of a realm's wikis and bags. Throws {@link FaceSegmentRefused} on a pet name
 *  that names no single folder. */
export function realmRoot(projectionRoot: string, petName: string): string {
  return joinPath(projectionRoot, REALMS_PROJECTION_DIR, faceSegment(petName));
}

/** `<projections>/faces/<segment>/personal`: the plane a face's personal layers rest under, one folder per wiki slug. */
export function facePersonalRoot(projectionRoot: string, segment: string): string {
  return joinPath(faceRoot(projectionRoot, segment), FACE_PLANES.personal);
}

/**
 * The daemon wiki's disk mirror: its working layer, bound to the daemon mount, writes files to `<projections>/faces/<pet name>/wiki/`.
 * The daemon document and the control document have no mirror: every control family rests in the control document
 * (`control-home`), so placement keeps it off these mirrors.
 */
export function daemonWorkingMirror(projectionRoot: string, face: FaceSite): BagMirrorConfig {
  return { bagId: wikiSlotUri("daemon", "working"), mirrorRoot: joinPath(faceRoot(projectionRoot, face.segment), FACE_PLANES.wiki) };
}

/**
 * The kahua stage's disk mirror: the face's `bags/kahua` projects to `<projections>/faces/<pet name>/stage/`, its items sited by
 * title with a project as the leading path segment. The stage never projects beside a canon source.
 */
export function kahuaStageMirror(projectionRoot: string, face: FaceSite): BagMirrorConfig {
  return { bagId: KAHUA_BAG, mirrorRoot: joinPath(faceRoot(projectionRoot, face.segment), FACE_PLANES.stage), titlePaths: true };
}

/**
 * The daemon wiki's USER temp layer mirror: `wikis/daemon/temp` projects beside its working top, under
 * `<projections>/faces/<pet name>/wiki/temp`, as a recovery-class mirror the projector reads off the layer's own store.
 */
export function daemonTempMirror(projectionRoot: string, face: FaceSite): BagMirrorConfig {
  return {
    bagId: wikiSlotUri("daemon", "temp"),
    mirrorRoot: joinPath(faceRoot(projectionRoot, face.segment), FACE_PLANES.wiki, TEMP_LAYER_DIR),
    mirrorClass: "recovery",
    tempLayer: true,
  };
}

/**
 * The face's daemon canon mirror: `bags/daemon-<F>` projects as a two-way canon mirror to `<projections>/faces/<pet name>/canon/`,
 * under the projections root alone (never beside a canon source), with its Confluence agreement, take-disk door and kāpae
 * like every other canon mirror. A meme promoted into the daemon wiki's canon lands there and survives a re-founding.
 */
export function daemonCanonMirror(projectionRoot: string, face: FaceSite): BagMirrorConfig {
  return { bagId: daemonFaceCanonBag(face.relation), mirrorRoot: joinPath(faceRoot(projectionRoot, face.segment), FACE_PLANES.canon) };
}

/** A daemon VM disk mirror: the grant plus the scope its island names it by. */
export type DaemonDiskMirror = BagMirrorConfig & { readonly scope: string };

/**
 * THE DAEMON VM'S DISK MIRRORS, the one list its island receives: the daemon mount's working top (`faces/<pet name>/wiki`), its
 * daemon canon (`faces/<pet name>/canon`, where the face's catalog names one), its kahua stage (`faces/<pet name>/stage`, items
 * sited by title), and the public crossroads bag, split by origin back to its canon source where one stands. The daemon
 * document and the control document have no mirror.
 *
 * `face` names the face the composition wears: its relation from the verified founding record, its segment from its pet name.
 * With no face worn (`null`) the list holds no private mirror at all; a later composition wearing a face mirrors under its root.
 */
export function daemonDiskMirrors(opts: {
  readonly projectionRoot: string;
  readonly canonBags: string;
  readonly face: FaceSite | null;
  /** True where the daemon recipe mounts the face's daemon canon (`canonBag`): the list then carries its mirror. */
  readonly canon?: boolean;
  /** True where the daemon recipe designates its temp layer AND the operator's consent row names the `daemon` slug:
   *  the list then carries the temp layer's mirror (`daemonTempMirror`). */
  readonly temp?: boolean;
}): readonly DaemonDiskMirror[] {
  const { projectionRoot, canonBags, face, canon = false, temp = false } = opts;
  return [
    ...(face === null ? [] : [
      { ...daemonWorkingMirror(projectionRoot, face), scope: "daemon" },
      ...(canon ? [{ ...daemonCanonMirror(projectionRoot, face), scope: "daemon-canon" }] : []),
      { ...kahuaStageMirror(projectionRoot, face), scope: "kahua" },
      ...(temp ? [{ ...daemonTempMirror(projectionRoot, face), scope: "daemon-temp" }] : []),
    ]),
    { bagId: CROSSROADS_DOC_URI, mirrorRoot: projectionRoots({ projectionRoot, canonBags }).bagRoot("crossroads"), scope: "crossroads" },
  ];
}

/** The mirror-relative base a title sites at by its own path, or null for a title that owns none by this rule. */
export function titleRelPath(title: string): string | null {
  if (title.startsWith("lar:") || title.startsWith("$:/") || title.length === 0) return null;
  const segments = title.split("/");
  if (segments.some((seg) => seg.length === 0 || seg === "." || seg === ".." || /[\\\0]/.test(seg))) return null;
  return segments.join("/");
}

/**
 * THE PRIVATE PLANES: the layers a house mints for itself and never writes beside a canon source, whatever dirs that
 * source holds: the daemon wiki (each device's own private working wiki) and the kahua plane, each face's resting under
 * its face root (`faces/<pet name>/`). A wiki's workbench names no face: one folder answers it.
 */
export const PRIVATE_PROJECTION_SLUGS: ReadonlySet<string> = new Set(["daemon", "kahua"]);

/** Whether a slug names a private plane. */
export function isPrivateProjectionSlug(slug: string): boolean {
  return PRIVATE_PROJECTION_SLUGS.has(slug);
}

/** Where a house's disk mirrors root, split by ORIGIN. */
export interface ProjectionRoots {
  /** The slugs whose bag source dir stands under the canon source (sorted), the private planes excepted. */
  sourcedSlugs(): readonly string[];
  /** The mirror dir of bag `slug`: `<canon>/<slug>` for a sourced bag, else `<projections>/bags/<slug>`. */
  bagRoot(slug: string): string;
  /** The canon-side bases a per-wiki grant carries by slug (`DiskMirrorGrant` `sourcedRoots`). */
  sourcedRoots(kind: "bags" | "wikis"): Readonly<Record<string, string>>;
}

/**
 * THE MIRROR ROOT SPLITS BY ORIGIN (operator ruling, 2026-11-01: "Are those things that start in bags? then they should
 * 'end up back in bags/'. Only live edits end up in the wiki layers ... The dirs in the workspace right now (and the wikis
 * they shall compose) DO need to get written back to the main repo checkout, for source control").
 *
 * A bag whose source dir stands under the canon source (`canonBags`, the vessel's `LAR_BAGS`) projects back there, and the
 * wiki it composes projects to `wikis/` beside that source. Every other bag and wiki (house-minted, a person's own) and every
 * private plane projects under the house's projections root (`<root>/projections`, outside the hearth a re-founding
 * clears): a shared wiki and its canon bag in the realm that holds them (`realms/<pet name>/`, `realm-labels.ts`), a face's
 * private planes in its face root. Membership reads the source tree once, here: no bag is listed.
 */
export function projectionRoots(opts: { readonly projectionRoot: string; readonly canonBags: string }): ProjectionRoots {
  let held: string[] = [];
  try {
    held = readdirSync(opts.canonBags, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !isPrivateProjectionSlug(e.name))
      .map((e) => e.name).sort();
  } catch { /* an absent canon source sources nothing */ }
  const sourced = new Set(held);
  const canonWikis = joinPath(dirname(resolvePath(opts.canonBags)), "wikis");
  return {
    sourcedSlugs: () => held,
    bagRoot: (slug) => sourced.has(slug) ? joinPath(opts.canonBags, slug) : joinPath(opts.projectionRoot, "bags", slug),
    sourcedRoots: (kind) => Object.fromEntries(held.map((slug) => [slug, kind === "bags" ? resolvePath(opts.canonBags) : canonWikis])),
  };
}

// ── Loci reverse-derivation (the ingest gesture's scan leg) ─────────────────

/**
 * One mirror plane's reverse-derivation — the address siting rule run backward under the
 * full-path-inside-bag ruling, shared by every disk mirror:
 *   `<root>/<rootDirName>/<holding-dir>/<full-uri-path>.mem` ⇄ `lar:///<full-uri-path>`
 * The first segment under the plane dir names the HOLDING SLOT (a residency
 * bag under bags/, a wiki slug under wikis/) and never enters the name; the
 * interior IS the name, whole. Returns null outside the plane dir, for a `.meta`
 * sidecar (it rides with its content file, never a carrier root of its own), or
 * when the interior carries no w.w.w root — the gesture reports those as
 * skipped, never guesses.
 *
 * The mirror directory is given itself (`LAR_BAGS` / `LAR_WIKIS` may sit outside the vessel
 * root), so `<root>/bags` is only the default a caller derives, never a law this function holds.
 *
 * Any registered TW5 filetype extension strips the same way `.mem` does: the
 * name is the interior MINUS its trailing filetype extension, so a `.tid`,
 * `.json`, `.md`, or content-type carrier derives its lar: URI exactly as a
 * `.mem` carrier does (filetype-agnostic mirror, one address siting rule).
 */
export function mirrorDirFileToUri(mirrorDir: string, filePath: string): string | null {
  const mirrorRoot = resolvePath(mirrorDir);
  const abs = resolvePath(filePath);
  if (!abs.startsWith(mirrorRoot + sep)) return null;
  const rel = abs.slice(mirrorRoot.length + 1).split(sep);
  if (rel.length < 2) return null;                       // needs holding dir + interior
  const interior = rel.slice(1).join("/");
  if (interior.endsWith(".meta")) return null;           // sidecar, not a carrier root
  // Strip the trailing filetype extension from the last path segment only (the
  // w.w.w root's own dots live in the FIRST segment and never match here).
  const namePath = interior.replace(/\.[^/.]+$/, "");
  if (namePath === interior) return null;                // no extension → not a projected carrier file
  if (!/^\w+\.\w+\.\w+\//.test(namePath)) return null;   // loci: stable names carry a w.w.w root
  return `lar:///${namePath}`;
}

/**
 * Derive the carrier-root lar: URI a bags/ file projects — the canon plane:
 *   `bags/<residency-dir>/<full-uri-path>.mem` ⇄ `lar:///<full-uri-path>`
 * The first segment under bags/ names the HOLDING BAG (residency plane).
 */
export function bagsFileToUri(instanceRoot: string, filePath: string): string | null {
  return mirrorDirFileToUri(joinPath(instanceRoot, "bags"), filePath);
}

/**
 * Derive the carrier-root lar: URI a wikis/ file projects — the per-wiki working
 * write-layer's disk surface run backward (the ingest-BACK leg). The working
 * layer (`wikis/{slug}/working`) projects per-wiki to
 * `wikis/{slug}/<full-uri-path>.mem`; the first segment under wikis/ names the
 * WIKI SLUG (the write-layer instance), never the carrier name. The derived
 * records home to the working layer (the editing plane), not the named bag —
 * the ingest caller carries that designation in `--to`. Symmetric with the
 * disk-projector's working projection: strip wikis/ + the @{slug} leaf, read
 * the interior whole.
 */
export function wikisFileToUri(instanceRoot: string, filePath: string): string | null {
  return mirrorDirFileToUri(joinPath(instanceRoot, "wikis"), filePath);
}

// ── What the house ignores inside a mirror ──────────────────────────────────

/**
 * THE ONE LIST THE HOUSE IGNORES inside every mirror folder: what no scan reads back, no watcher wakes on, no export carries,
 * no import restores and no adoption copies. Paths read posix, relative to the mirror's holding folder (the wave's source):
 *
 *   - `topDirs`: a workspace's own tooling at the top (`.git`, `.vscode`), the shore's render of a stand-off (`.shore`, for
 *     `lares shore diff`), and the `temp` layer, which mirrors its own bag beside a working folder;
 *   - `dirSuffixes`: an orphan slot's folder (`<root-stem>.orphans/`): the projector writes it beside its root, and the
 *     family's root carries those slots home;
 *   - `tempFile`: the atomic writer's temp (`fs-atomic.ts`: `<path>.<pid>.<uuid>.tmp`, or `<path>.<pid>.tmp` for a sync write).
 */
export const HOUSE_IGNORED = {
  topDirs: [".git", ".vscode", ".shore", TEMP_LAYER_DIR] as readonly string[],
  dirSuffixes: [ORPHAN_FOLDER_SUFFIX] as readonly string[],
  tempFile: /\.\d+(?:\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\.tmp$/,
} as const;

/** Why the house ignores the file at `rel` (posix, relative to its mirror's holding folder), or null where it reads. */
export function houseIgnored(rel: string): string | null {
  const segments = rel.split(/[\\/]/).filter((s) => s !== "" && s !== ".");
  if (segments.length === 0) return null;
  if (segments.length > 1 && HOUSE_IGNORED.topDirs.includes(segments[0]!)) return `${segments[0]}/ holds no record of this house's (HOUSE_IGNORED)`;
  if (segments.slice(0, -1).some((d) => HOUSE_IGNORED.dirSuffixes.some((x) => d.endsWith(x)))) return "an orphan slot's folder: its family's root carries it (HOUSE_IGNORED)";
  if (HOUSE_IGNORED.tempFile.test(segments[segments.length - 1]!)) return "an atomic writer's temp (HOUSE_IGNORED)";
  return null;
}

// ── Siting run backward (the mirror lay's and the watcher's read) ──────────

/** One mirror plane a file reads back against. */
export interface SiteMirror {
  /** The plane dir whose first segment names the holding slot (`<projections>/realms/<realm pet name>/wikis`, a face root `<projections>/faces/<pet name>`
   *  over its `wiki`, `canon` and `stage`, or its `personal`): that segment never enters a title. */
  readonly planeDir: string;
  /** The holding mirror sites a foreign title at its own `/` path (`BagMirrorConfig.titlePaths`, the kahua stage). */
  readonly titlePaths?: boolean;
  /** Rule 0: the carrier a synced base names at this exact path (`SyncedTree.uriAt`), where the caller holds a tree. */
  readonly uriAt?: (path: string) => string | null;
  /** The projection classes the mirror reads under (a temp mirror: `["temp"]`); the base filter always reads. */
  readonly classes?: readonly ProjectionClass[];
}

/** A file's title, with the rule that read it, or why no rule reads it. */
export type FileSiting =
  | { readonly title: string; readonly by: "base" | "loci" | "title-path" | "in-band" | "filename" }
  | { readonly why: string };

/** The `title` a TiddlyWiki field block (a `.tid` header, a `.meta` sidecar) states, read up to its first blank line. */
function fieldBlockTitle(text: string): string | undefined {
  for (const line of text.split("\n")) {
    if (line.trim() === "") break;
    const m = /^([^:\s]+)\s*:\s*(.*)$/.exec(line);
    if (!m) break;
    if (m[1] === "title") return m[2]!.trim();
  }
  return undefined;
}

/** The `title` a `.mem` carrier's toml meta fence states (a basic string, escapes read as JSON reads them). */
function memTitle(text: string): string | undefined {
  const fence = /^```toml meta[ \t]*\r?\n([\s\S]*?)^```/m.exec(text);
  const line = fence ? /^title\s*=\s*("(?:[^"\\\r\n]|\\.)*")\s*$/m.exec(fence[1]!) : null;
  if (!line) return undefined;
  try { const t: unknown = JSON.parse(line[1]!); return typeof t === "string" ? t : undefined; } catch { return undefined; }
}

/** The title a file states of itself: a content file's `.meta` sidecar first, else its own `.tid` header, `.json` record or
 *  `.mem` meta fence. Undefined where it states none or would not read. */
function inBandTitle(file: string, ext: string): string | undefined {
  try {
    if (existsSync(`${file}.meta`)) return fieldBlockTitle(readFileSync(`${file}.meta`, "utf8"));
    if (ext === ".tid") return fieldBlockTitle(readFileSync(file, "utf8"));
    if (ext === ".mem") return memTitle(readFileSync(file, "utf8"));
    if (ext === ".json") {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
      const t = ((Array.isArray(parsed) ? parsed[0] : parsed) as { title?: unknown } | null | undefined)?.title;
      return typeof t === "string" ? t : undefined;
    }
  } catch { /* a file that will not read states nothing */ }
  return undefined;
}

/**
 * TiddlyWiki's filename decode, the last resort: the flatten turned `$:/` into `$__` and every other `/ \ < > ~ : " | ? * ^`
 * into `_`. A system title (`$__…`) reads its `_` back as `/`, the separator its namespace runs on; any other name keeps its
 * `_` as it stands. A colliding title's `_1` stays in the name.
 */
function filenameTitle(namePath: string): string {
  return namePath.startsWith("$__") ? `$:/${namePath.slice(3).replace(/_/g, "/")}` : namePath;
}

/**
 * THE PROJECTOR'S SITING RUN BACKWARD: the title a mirror file reads back under, or why it reads none. The precedence inverts
 * the projector's (`disk-projector.ts` flush: a FileSystemPaths rule, the loci law, the title-path siting, TW5's flatten):
 *
 *   (0) a synced base standing at this exact path names its carrier (`uriAt`): whatever rule or uniquifier sited it
 *   (1) the loci rule (`mirrorDirFileToUri`)
 *   (2) on a title-path mirror, the path inside the holding folder minus its extension
 *   (3) the title the file states of itself (`.meta` sidecar, `.tid` header, `.json` record, `.mem` toml `title`)
 *   (4) TiddlyWiki's filename decode, last: the flatten loses `/` and `:` alike (both become `_`)
 *
 * A `lar:` title the file states off its own loci path refuses by name (the loci law sites it elsewhere, and a stray copy never
 * re-addresses itself), and so does a title the projection filter keeps off disk, the bag's own declaration (`meta.mem` at a
 * holding folder's root: disk-owned, never a record), a file outside any holding folder, and a file with no filetype extension.
 */
export function siteFileToTitle(mirror: SiteMirror, file: string): FileSiting {
  const plane = resolvePath(mirror.planeDir);
  const abs = resolvePath(file);
  if (!abs.startsWith(plane + sep)) return { why: `stands outside the mirror plane ${plane}` };
  const rel = abs.slice(plane.length + 1).split(sep);
  if (rel.length < 2) return { why: `stands outside any holding folder of ${plane}` };
  const interior = rel.slice(1).join("/");
  if (interior.endsWith(".meta")) return { why: "a .meta sidecar rides with its content file" };
  if (interior === "meta.mem") return { why: "the bag's own declaration stays disk-owned and never reads back as a record" };
  const ext = extname(interior);
  if (ext === "") return { why: "carries no filetype extension, so no siting reads it" };
  const withheld = (title: string): FileSiting | null => projectionWithheld(title, mirror.classes ?? [])
    ? { why: `${title} stays off disk by the projection filter, so its file reads back as nothing` } : null;
  const sited = (title: string, by: Extract<FileSiting, { title: string }>["by"]): FileSiting => withheld(title) ?? { title, by };

  const based = mirror.uriAt?.(abs) ?? null;
  if (based !== null) return sited(based, "base");
  const loci = mirrorDirFileToUri(plane, abs);
  if (loci !== null) return sited(loci, "loci");
  const stated = inBandTitle(abs, ext);
  if (stated !== undefined && stated.startsWith("lar:")) {
    const home = carrierBaseRelPath(stated);
    return { why: `states the title ${stated}, which the loci law sites ${home === null ? "at no file" : `at ${home}${ext}`}, not here` };
  }
  const namePath = interior.slice(0, interior.length - ext.length);
  if (mirror.titlePaths) {
    const path = titleRelPath(namePath);
    if (path !== null) return sited(path, "title-path");
  }
  if (stated !== undefined && stated !== "") return sited(stated, "in-band");
  return sited(filenameTitle(namePath), "filename");
}

// ── Workspaces (cabal-realm#/the-workbench) ─────────────────────────────────

/** Whether `child` resolves at or beneath `parent` (both already absolute and real). */
function within(child: string, parent: string): boolean {
  const p = parent.endsWith(sep) ? parent : parent + sep;
  return child === parent || child.startsWith(p);
}

/** One wiki row's workspace as the vessel reads it: the slug, and the workspace name the row names. */
export interface WorkspaceEntry { readonly slug: string; readonly kind: "bag" | "wiki"; readonly workspace?: string }

/**
 * THE WORKSPACE ROOTS a shared wiki's workbench mirror may rest in: each `kind: "wiki"` share row naming a workspace maps its
 * slug to `<root>/workspaces/<name>` (the host shim binds `/lar/workspaces/<name>`), where that directory stands. The operator
 * names each workspace, and one resting inside the repository checkout binds: the checkout counts as the cabal's working
 * surface (founding road rank 4j). A workspace that resolves inside the hearth refuses by name, and so does a slug whose source
 * stands in the canon source: its one workbench folder already rests beside that source, in the working surface, so a second
 * workspace would split one workbench across two folders. A
 * workspace with no directory standing (no bind) waits by name, and its workbench lays in the realm that holds the slug.
 */
export function workspaceRootsOf(opts: {
  readonly rows: readonly WorkspaceEntry[];
  readonly workspacesHome: string;
  readonly hearth: string;
  readonly sourcedSlugs: readonly string[];
}): { readonly roots: Readonly<Record<string, string>>; readonly names: Readonly<Record<string, string>>; readonly refused: readonly string[]; readonly unbound: readonly string[] } {
  const roots: Record<string, string> = {}, names: Record<string, string> = {};
  const refused: string[] = [], unbound: string[] = [];
  const real = (p: string): string | null => { try { return realpathSync(p); } catch { return null; } };
  const hearth = real(opts.hearth) ?? resolvePath(opts.hearth);
  for (const row of opts.rows) {
    const name = row.workspace?.trim();
    if (row.kind !== "wiki" || !name) continue;
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name) || name === "." || name === "..") { refused.push(`${row.slug}: workspace "${name}" names no workspace`); continue; }
    if (opts.sourcedSlugs.includes(row.slug)) { refused.push(`${row.slug}: workbench-checkout-sourced (its one workbench folder rests beside its canon source, in the working surface)`); continue; }
    const dir = real(joinPath(opts.workspacesHome, name));
    if (dir === null) { unbound.push(`${row.slug}: workspace "${name}" stands unbound (no ${joinPath(opts.workspacesHome, name)})`); continue; }
    if (within(dir, hearth)) { refused.push(`${row.slug}: workspace "${name}" resolves inside the hearth (${dir})`); continue; }
    roots[row.slug] = dir;
    names[row.slug] = name;
  }
  return { roots, names, refused, unbound };
}

/** One shared wiki's workbench folder the vessel watches as a pool: the slug, the folder, and the name the log gives it. */
export interface WorkbenchFolder { readonly slug: string; readonly dir: string; readonly name: string }

/**
 * THE WORKBENCH FOLDERS a vessel watches as pools: each workspace a share row binds (`workspaceRootsOf`), then each wiki a named
 * realm holds, at `<projections>/realms/<realm pet name>/wikis/<slug>/` (`realms`: the realm labels' placement,
 * `realmPlacement(...).realms()`), that no workspace takes. ONE FOLDER PER WORKBENCH, so a bound slug's realm folder takes no
 * second seat. Every realm carries a pet name (its default, the slug, minted on first read), so no wiki waits for one, and no
 * plain `wikis/` folder takes a seat. The daemon wiki's working layer rests in the face's own pool (`faces/<pet name>/wiki`), and a SOURCED
 * slug's workbench rests beside its canon source in the checkout, which the checkout's own history keeps and the vessel never
 * commits into, so none of those takes one either. A slug whose folder stands nowhere on disk yet takes none: the next sitting's
 * arm reads it.
 */
export function workbenchFolders(opts: {
  readonly projectionRoot: string;
  readonly workspaces: { readonly roots: Readonly<Record<string, string>>; readonly names: Readonly<Record<string, string>> };
  readonly sourcedSlugs: readonly string[];
  readonly realms: ReadonlyArray<{ readonly petName: string; readonly wikis: ReadonlyArray<{ readonly slug: string; readonly dir: string }> }>;
}): WorkbenchFolder[] {
  const out: WorkbenchFolder[] = Object.entries(opts.workspaces.roots).map(([slug, dir]) => ({ slug, dir, name: opts.workspaces.names[slug] ?? slug }));
  const placed = opts.realms.flatMap((r) => r.wikis).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const { slug, dir } of placed) {
    if (isPrivateProjectionSlug(slug) || Object.hasOwn(opts.workspaces.roots, slug) || opts.sourcedSlugs.includes(slug) || out.some((f) => f.slug === slug)) continue;
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    out.push({ slug, dir, name: slug });
  }
  return out;
}
