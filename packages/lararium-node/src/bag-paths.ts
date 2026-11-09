/**
 * bag-paths — URI → mirror-relative-path factories.
 *
 * The named-bag layout (`bags/NAME`) makes per-scope path computation
 * derivable from the bag scope alone. No oracle tiddler `path-filter` field
 * needed. Factories are pure functions; no I/O, no module state.
 */

import { resolve as resolvePath, join as joinPath, dirname, basename, isAbsolute, sep } from "path";
import { readdirSync } from "fs";
import { stripMemeExt, wikiSlotUri, isBagManifestUri, isVolatileVmUri, isDaemonCanonWithheld, KAHUA_BAG, CROSSROADS_DOC_URI, DAEMON_BAG_ID } from "@lararium/mesh";

export interface BagMirrorConfig {
  /** The bag whose changes this mirror reflects. */
  readonly bagId: string;
  /** Absolute filesystem path; all writes are constrained under this root. */
  readonly mirrorRoot: string;
  /** Marks a grant intended for bag-specific recovery projection, or (`observe`) a one-way render no ingest reads. */
  readonly mirrorClass?: "recovery" | "observe";
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
   * The charter-only mirror guard (crossroads WHO-board leak, 2026-09-20): when true, a per-Nexus
   * WHO-face pointer (`isNexusHandlesUri`) never projects through THIS mirror. Baked in at grant
   * construction time from the RESOLVED `nexusIdentity().kind` — never re-derived from the tiddler
   * itself, which carries no kind. A private-nexus-of-one (`own`) or a dialed anchor (`anchor`)
   * mints this pointer into the crossroads doc on first boot (who-face.ts `resolveCatalogRow`), and
   * without this guard every such boot's throwaway pointer disk-mirrors alongside the REAL
   * charter-backed crossroads library content. Curated library carriers are untouched — the guard
   * matches ONLY the handles-pointer shape, never the whole bag.
   */
  readonly guardNexusHandles?: boolean;
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

/** The house's own config plane: the per-wiki pointers the island seeds into the temp layer at every mount. */
const HOUSE_CONFIG_PLANE = "lar:///ha.ka.ba/lararium/config/";

/**
 * Whether a title in the temp layer names the house's INTERNAL volatile state rather than user temp content. The line
 * runs by namespace alone: the volatile VM plane (`lararium.local.vm`), TiddlyWiki's whole system namespace (`$:/`,
 * whose state, status, boot and history planes the bag-paths cascade routes to temp), and the house's config plane
 * (the pointers each mount seeds). Every other title in the layer counts as user temp content.
 */
export function isTempLayerInternalTitle(title: string): boolean {
  return isVolatileVmUri(title) || title.startsWith("$:/") || title.startsWith(HOUSE_CONFIG_PLANE);
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
  // A bag's MANIFEST sites nowhere here: its file is `meta.mem` at the bag root, owned by the
  // declare verb. Sited by uri-path it would land as `bags/<bag>/ha.ka.ba/bags/<bag>.mem`.
  if (isBagManifestUri(uri)) return null;
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
  bagId: string, scope: string, mirrorRoot: string, guardNexusHandles?: boolean, titlePaths?: boolean, mirrorClass?: "recovery" | "observe",
  tempLayer?: boolean,
): BagMirrorConfig {
  void scope;
  return { bagId, mirrorRoot, ...(guardNexusHandles ? { guardNexusHandles } : {}), ...(titlePaths ? { titlePaths } : {}), ...(mirrorClass ? { mirrorClass } : {}), ...(tempLayer ? { tempLayer } : {}) };
}

/**
 * THE ONE ROOT every private layer projects under (the daemon wiki's working top, the kahua stage): the house's
 * projections root (`<root>/projections`, `larProjectionsHome`). A face rides the FOLDER'S NAME inside it
 * (`daemonFaceFolder`, `kahuaFaceFolder`), never a parent directory.
 */
export function privateProjectionRoot(projectionRoot: string): string {
  return projectionRoot;
}

const KAHUA_FACE_RELATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Name the private folders from F in the verified founding record. */
export function kahuaFaceFolder(faceRelation: string): string {
  if (!KAHUA_FACE_RELATION.test(faceRelation)) throw new Error(`kahua face folder: invalid relation ${JSON.stringify(faceRelation)}`);
  return `kahua-${faceRelation}`;
}
export function isKahuaFaceFolder(name: string): boolean {
  return name.startsWith("kahua-") && KAHUA_FACE_RELATION.test(name.slice(6));
}
/** Name the daemon wiki's working folder from the same F: the daemon wiki binds to the worn face, so its folder
 *  carries the face relation, validated as the kahua folder's is. */
export function daemonFaceFolder(faceRelation: string): string {
  if (!KAHUA_FACE_RELATION.test(faceRelation)) throw new Error(`daemon face folder: invalid relation ${JSON.stringify(faceRelation)}`);
  return `daemon-${faceRelation}`;
}
export function isDaemonFaceFolder(name: string): boolean {
  return name.startsWith("daemon-") && KAHUA_FACE_RELATION.test(name.slice(7));
}

/**
 * THE OBSERVE PLANE: `<projections>/observe/` holds one-way, read-only renders of control-plane bags (the daemon bag
 * at `observe/daemon/`). Nothing there ingests back: it carries no agreement record and no take-disk door, and the
 * ingest path refuses any file under it by name ({@link isObserveProjectionPath}).
 */
export const OBSERVE_DIR = "observe";
/** The observe-only mirror dir of the daemon bag: `<projections>/observe/daemon`. */
export function daemonObserveRoot(projectionRoot: string): string {
  return joinPath(projectionRoot, OBSERVE_DIR, "daemon");
}
/** Whether `path` sits at or under `<projectionRoot>/observe` — a subtree no ingest reads. */
export function isObserveProjectionPath(projectionRoot: string, path: string): boolean {
  const observe = resolvePath(projectionRoot, OBSERVE_DIR);
  const abs = resolvePath(path);
  return abs === observe || abs.startsWith(observe + sep);
}

/**
 * The daemon wiki's disk mirror: its working layer, bound to the worn face, writes flat files to
 * `<projections>/wikis/daemon-<F>/`, as every wiki writes its working layer. The layer keeps its bag
 * (`wikis/daemon/working`); only the folder takes the face relation F. The daemon island mounts outside the pool, so this
 * mints the grant once, by name.
 *
 * THE RULED LAYOUT: the working top projects to `<projections>/wikis/daemon-<F>`, the lift-only fleet bag `bags/kahua`
 * to `<projections>/bags/kahua-<F>` (`kahuaStageMirror`), and the daemon bag (`bags/daemon`) projects its non-control
 * records as the daemon wiki's canon to `<projections>/bags/daemon` (`daemonCanonMirror`); its control records stay
 * CRDT-only and read one-way under `observe/daemon` (`daemonObserveRoot`), never ingested back.
 */
export function daemonWorkingMirror(projectionRoot: string, faceRelation: string): BagMirrorConfig {
  return { bagId: wikiSlotUri("daemon", "working"), mirrorRoot: joinPath(privateProjectionRoot(projectionRoot), "wikis", daemonFaceFolder(faceRelation)) };
}

/**
 * The kahua stage's disk mirror: the face's `bags/kahua` projects under the projections root alone
 * (`<projections>/bags/kahua-<F>/`), its items sited by title with a project as the leading path segment. The stage
 * never projects beside a canon source.
 */
export function kahuaStageMirror(projectionRoot: string, faceRelation: string): BagMirrorConfig {
  return { bagId: KAHUA_BAG, mirrorRoot: joinPath(privateProjectionRoot(projectionRoot), "bags", kahuaFaceFolder(faceRelation)), titlePaths: true };
}

/**
 * The daemon wiki's USER temp layer mirror: `wikis/daemon/temp` projects beside its working top, under
 * `<projections>/wikis/daemon-<F>/temp`, as a recovery-class mirror the projector reads off the layer's own store.
 */
export function daemonTempMirror(projectionRoot: string, faceRelation: string): BagMirrorConfig {
  return {
    bagId: wikiSlotUri("daemon", "temp"),
    mirrorRoot: joinPath(privateProjectionRoot(projectionRoot), "wikis", daemonFaceFolder(faceRelation), TEMP_LAYER_DIR),
    mirrorClass: "recovery",
    tempLayer: true,
  };
}

/**
 * The daemon wiki's CANON mirror: the bag `bags/daemon` projects as a two-way canon mirror to `<projections>/bags/daemon/`,
 * under the projections root alone (never beside a canon source), with its Confluence agreement, take-disk door and kāpae
 * like every other canon mirror. A meme promoted into the daemon wiki's canon (a memory, a thought, a stage note) lands
 * there and survives a re-founding. What else shares the bag never lands: the projector bars every title
 * `isDaemonCanonWithheld` names from any mirror of this bag (the control plane, `bags/daemon/**` with the cap family and
 * `$:/lares/swarm/**`, which keeps its one-way observe render alone; and the house's identity records). This stands until
 * the control records leave the bag for a face-bound canon.
 */
export function daemonCanonMirror(projectionRoot: string): BagMirrorConfig {
  return { bagId: DAEMON_BAG_ID, mirrorRoot: joinPath(privateProjectionRoot(projectionRoot), "bags", "daemon") };
}

/** The daemon bag's withheld titles (`@lararium/mesh`), re-read here beside the mirror they bound. */
export { isDaemonCanonWithheld };

/** A daemon VM disk mirror: the grant plus the scope its island names it by. */
export type DaemonDiskMirror = BagMirrorConfig & { readonly scope: string };

/**
 * THE DAEMON VM'S DISK MIRRORS, the one list its island receives: the daemon wiki's canon (`<projections>/bags/daemon`,
 * non-control records alone), the worn face's working top (`<projections>/wikis/daemon-<F>`), its kahua stage
 * (`<projections>/bags/kahua-<F>`, items sited by title), and the public crossroads bag, split by origin back to its canon
 * source where one stands. The daemon bag's observe-only render rides its own one-way writer (`daemon-observe.ts`).
 *
 * `faceRelation` names the face the composition wears (from the verified founding record). With no face worn (`null`) the list holds no private
 * kahua mirror at all, and never an untagged `kahua` folder; a later composition wearing a face mirrors under its tag.
 *
 * The crossroads WHO-handles guard stays ON unless the caller names a proven charter (`false`).
 */
export function daemonDiskMirrors(opts: {
  readonly projectionRoot: string;
  readonly canonBags: string;
  readonly faceRelation: string | null;
  readonly guardCrossroadsNexusHandles?: boolean;
  /** The `projection.observeDaemon` toggle: true adds the daemon bag's observe-only render under `observe/daemon`. */
  readonly observeDaemon?: boolean;
  /** True where the daemon recipe designates its temp layer AND the operator's consent row names the `daemon` slug:
   *  the list then carries the temp layer's mirror (`daemonTempMirror`). */
  readonly temp?: boolean;
}): readonly DaemonDiskMirror[] {
  const { projectionRoot, canonBags, faceRelation, guardCrossroadsNexusHandles = true, observeDaemon = false, temp = false } = opts;
  return [
    ...(observeDaemon ? [{ bagId: DAEMON_BAG_ID, mirrorRoot: daemonObserveRoot(projectionRoot), scope: "daemon-observe", mirrorClass: "observe" as const }] : []),
    { ...daemonCanonMirror(projectionRoot), scope: "daemon-canon" },
    ...(faceRelation === null ? [] : [
      { ...daemonWorkingMirror(projectionRoot, faceRelation), scope: "daemon" },
      { ...kahuaStageMirror(projectionRoot, faceRelation), scope: "kahua" },
      ...(temp ? [{ ...daemonTempMirror(projectionRoot, faceRelation), scope: "daemon-temp" }] : []),
    ]),
    { bagId: CROSSROADS_DOC_URI, mirrorRoot: projectionRoots({ projectionRoot, canonBags }).bagRoot("crossroads"), scope: "crossroads",
      guardNexusHandles: guardCrossroadsNexusHandles },
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
 * source holds. The daemon wiki (each device's own private working wiki) and the kahua plane; each face's folders
 * (`daemon-<F>`, `kahua-<F>`) join them by shape (`isPrivateProjectionSlug`).
 */
export const PRIVATE_PROJECTION_SLUGS: ReadonlySet<string> = new Set(["daemon", "kahua"]);

/** Whether a slug names a private plane: a named one, or some face's daemon or kahua folder. */
export function isPrivateProjectionSlug(slug: string): boolean {
  return PRIVATE_PROJECTION_SLUGS.has(slug) || isKahuaFaceFolder(slug) || isDaemonFaceFolder(slug);
}

/** Where a house's disk mirrors root, split by ORIGIN. */
export interface ProjectionRoots {
  /** The slugs whose bag source dir stands under the canon source (sorted), the private planes excepted. */
  sourcedSlugs(): readonly string[];
  /** The mirror dir of bag `slug`: `<canon>/<slug>` for a sourced bag, else `<projections>/bags/<slug>`. */
  bagRoot(slug: string): string;
  /** The wikis base the wiki `slug` projects under: `<canon parent>/wikis` for a sourced slug, else `<projections>/wikis`. */
  wikisRootFor(slug: string): string;
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
 * clears). Membership reads the source tree once, here: no bag is listed.
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
    wikisRootFor: (slug) => sourced.has(slug) ? canonWikis : joinPath(opts.projectionRoot, "wikis"),
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
