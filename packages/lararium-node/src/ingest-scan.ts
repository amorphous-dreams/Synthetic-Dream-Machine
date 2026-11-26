/**
 * ingest-scan — THE DISK→RECORDS GESTURE'S PURE MACHINERY, in the node (tideline-surface #/seam point 1). The scan, the
 * candidates, the deletions, the standing helpers, the settle and the siting call stand here, behind a SUBMIT PORT
 * (`IngestSubmit`) the caller fills; the island's gate supplies the third leg:
 *
 *   scan    walk source for carriers, derive each uri by the address siting rule, NFC-assert at the shore, hash, diff the
 *           disk hash against the base's disk side
 *   submit  pack NEW+CHANGED carriers (hashes riding with the text) into one INGEST verb (`ingestWaveArgs`); the CLI submits
 *           it over the verb socket (`lares ingest`, `lares ingest --watch`, `lares vessel lay`), the vessel to its own daemon island
 *           (`islandIngestSubmit`)
 *
 * The gesture holds the disk grant and the Synced tree; the island holds neither (readiness reads local on both sides of
 * the shore). A watcher fires this gesture on a settle instead of on an operator keystroke; the vessel fires it over the
 * worn face's pool (`poolIngestPorts`), so an edit made there flows back into the house by itself, as an UNATTENDED wave.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/working-procedures
 */

import { readFileSync, readdirSync, statSync, existsSync, lstatSync } from "node:fs";
import { dirname, join, resolve, sep, extname, relative } from "node:path";
import { newChangeId } from "@lararium/mesh/residency-actions";
import { newRequestId, VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
import { carrierHash } from "@lararium/mesh/crypto";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { BAG_MANIFEST_FILE } from "@lararium/mesh/bag-manifest";
import { ridesAsPointer, mediaTypeFromExt, isOversizedBody } from "@lararium/mesh/content-handle";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type WaveLimits, type WaveWeight, takeCrest, scaleLimits, adaptDepth, addWeight, fitsWave } from "@lararium/mesh/wave-crest";
import { yieldToHost } from "@lararium/mesh/host-task";
import { INGEST_WAVE_LIMITS, INGEST_WAVE_OVER_BUDGET, RECORD_OBJECTS, ingestCarrierWeight } from "@lararium/mesh/ingest-wave-budget";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { SyncedTree, syncedTreeKey, syncedTreeDir } from "./synced-tree.js";
import { bagsFileToUri, houseIgnored, siteFileToTitle, facePlaneOf, facePlaneSiteDir, FACES_PROJECTION_DIR, FACE_PLANES, REALMS_PROJECTION_DIR, REALM_PLANES, TEMP_LAYER_DIR, type FacePlane, type FileSiting } from "./bag-paths.js";
import { larProjectionCheckpointDir } from "./vessel-paths.js";
import { KAPAE_EXT, readKapaeShadow } from "./kapae-shadow.js";
import { IslandVerbRefused } from "./island-verb-ask.js";
import { WORKSPACE_SKIP, type FacePoolPorts } from "./watch-core.js";
import type { BaseFromGit } from "./pool-head.js";

export type ScanStatus = "new" | "unchanged" | "changed" | "non-nfc" | "deleted" | "renamed";

/** A vanished carrier the Synced tree still projects — the WIRE shape: rides an INGEST wave's
 *  `deletions[]` exactly as `resolveRenames`/`submitIngest` send it. No `file` here (§2.2) — a
 *  rename-deletion's `file` would be the NEW home a renamed row's OWN uri already names, never a
 *  usable path for the VANISHED source uri this record carries, so a reader that re-stat'd it (the
 *  watcher's causal rescan) would stat the wrong file entirely. The island gate splits rename
 *  re-links from tombstones off `uri` alone. */
export interface PendingDeletion {
  readonly uri:        string;
  readonly syncedHash: string;
}

/** The WATCHER-LOCAL shape (§2.2): a `PendingDeletion` this process can re-find on disk because IT
 *  (never the island, never a whole-source rename) scanned it FROM a real path — `deletionsOf`,
 *  `pendingDeletes`, and `dueDeletions` all deal in this shape, with `file` REQUIRED and no `?? uri`
 *  fallback (L7): a `lar://` uri stat'd as a path always reads absent, so a silent fallback there
 *  would have let a `file`-less pending delete ride on the grace timer's patience alone, never the
 *  causal rescan M9 built. */
export interface ArmedDeletion extends PendingDeletion {
  readonly file: string;
}

export interface ScanRow {
  readonly file:       string;
  readonly uri:        string;
  readonly text:       string;
  readonly diskHash:   string;
  readonly syncedHash: string | null;
  /** The base's RECORDS side, where it differs from the disk side (`syncedHash`): the disk stood in a
   *  framing the records' render would normalize. Absent = one hash names both sides. */
  readonly syncedRecordsHash?: string;
  /** THE BASE CAME FROM THE POOL'S HEAD (`pool-head`, face-pools A5): no synced base stood, so HEAD's blob names both sides.
   *  The island drops such a base where the records hold nothing under the carrier (no record, no base), and an echo of it
   *  pins HEAD's records side, never the records' present render. Absent for a base the Synced tree holds. */
  readonly headBase?:   true;
  readonly status:     ScanStatus;
  /** The file's extension (".mem" / ".tid" / ".json" / ".md" …); rides the
   *  INGEST carrier so the island routes by TW5's own filetype registry. */
  readonly ext:        string;
  /** The body failed the utf8 round-trip (a raw binary shard rides base64) — the CAS stager
   *  decodes it back to raw bytes before hashing a pointer-kind carrier. */
  readonly binary?:    boolean;
  /** Raw `<file>.meta` sidecar text when one sits beside a content file — rides
   *  the carrier so the island keeps the sidecar's fields across a body edit.
   *  Absent for a self-contained filetype (`.mem`/`.tid`) or no sidecar. */
  readonly meta?:      string;
  /** R2 — set on a `renamed` row: the VANISHED source URI whose byte-identical
   *  observation this carrier re-homes. The row rides as an ADD (so the island
   *  re-links records change-id-preserving, `pairRenames`), the source rides
   *  the wave as a rename-deletion, and the CLI moves the observation post-confirm. */
  readonly renameFrom?: string;
  /** THE OVERRIDE BASE A CARRY RESTORES: the carrier identity (`carrierHash`, `sha256:…`) of the canon record a working copy forked from, as an export
   *  read it off the record's meta envelope. The island stamps it on the record a working-layer wave lands, so a bundle's
   *  override keeps its base across a re-founding. Absent for every disk scan: a base never projects. */
  readonly overrideBase?: string;
  /** The family's other bases, by fragment title (`<uri>#…`): each fragment record of a working copy forked its own, so
   *  canon may move a fragment while the root holds still. The island stamps each on the fragment it lands. */
  readonly familyBases?: Readonly<Record<string, string>>;
}

/**
 * THE BASES ONE CARRIER CARRIES, out of a by-title map (an override-bases read, a face's bases sidecar): its root's
 * (`overrideBase`) and each fragment's of its family (`familyBases`, every title `<uri>#…`). A carrier none names carries none.
 */
export function carriedBasesOf(uri: string, bases: Readonly<Record<string, string>>): { overrideBase?: string; familyBases?: Readonly<Record<string, string>> } {
  const family = Object.entries(bases).filter(([title]) => title.startsWith(`${uri}#`));
  return {
    ...(bases[uri] !== undefined ? { overrideBase: bases[uri] } : {}),
    ...(family.length > 0 ? { familyBases: Object.fromEntries(family) } : {}),
  };
}

/** A file a scan read no carrier from, and why: every file a scan lists lands as a row, a shadow, or one of these. */
export interface ScanSkip {
  readonly file: string;
  readonly why:  string;
}

/** The lines a person reads for a scan's skips: each file beside its reason, never a bare count. */
export function skipLines(skipped: readonly ScanSkip[]): string[] {
  return skipped.map((s) => `skips: ${s.file} (${s.why})`);
}

export interface ScanResult {
  readonly rows:    ScanRow[];
  /** NO SILENT SKIPS: each file the scan read no carrier from, named with why. Over a source holding no kāpae shadow,
   *  `skipped.length + rows.length` equals the files the scan was handed (a shadow speaks in `shadows` or
   *  `refusedShadows`, and a carrier its own shadow stands beside rides out under that shadow's raise). */
  readonly skipped: ScanSkip[];
  /** R2 — the rename-deletions a FULL scan discovered (each `renamed` row's gone
   *  source), threaded into the INGEST wave's `deletions[]` so the island pairs
   *  them and re-homes records. Absent on a partial (watcher) scan, which pairs
   *  its own vanished set by content (`pairedDeletions`). */
  readonly renameDeletions?: PendingDeletion[];
  /** THE KĀPAE THE SOURCE SPEAKS: each title a shadow file (`<stem>.kapae`) names, where its bytes prove a
   *  raise and agree with the title its siting derives. The wave raises a kāpae over each, and no row
   *  carries a shadowed title (remove-wins inside one export). Absent where the source holds no shadow. */
  readonly shadows?: string[];
  /** The shadow files that proved no kāpae, each with the refusal that names why. */
  readonly refusedShadows?: Array<{ readonly file: string; readonly refusal: string }>;
}

/** Open the Synced tree at the canonical projection checkpoint (larProjectionCheckpointDir() —
 *  runtime vessel state inside the hearth, not corpus). */
export function openSyncedTree(): SyncedTree {
  return new SyncedTree(syncedTreeDir(larProjectionCheckpointDir()));
}

/**
 * Read a carrier's bytes as the string form the gesture carries — utf8 for a text
 * file, base64 for a binary one (image/PDF). The detection needs no registry and no
 * extension list: bytes that survive a utf8 round-trip ARE text; bytes that do not
 * ARE binary, and ride as base64. THE BLOB LAW then reads the TYPE: a pointer-kind
 * carrier's base64 decodes back to raw bytes at the CAS stager (`stageBodyToCas`) and
 * rides a pointer; a utf8 body rides inline. A base64 body carries no SOH heading, so
 * it never routes to the memetic path.
 */
export function readCarrierText(file: string): { text: string; binary: boolean } {
  const buf  = readFileSync(file);
  const utf8 = buf.toString("utf8");
  if (Buffer.from(utf8, "utf8").equals(buf)) return { text: utf8, binary: false };
  return { text: buf.toString("base64"), binary: true };
}

/**
 * List the carriers under a source — a directory walks recursively for every
 * REAL file (a `.meta` sidecar rides with its content file, never as a carrier
 * of its own), a single file lists itself. Returns null when the source does
 * not resolve. Filetype routing is the ISLAND's job (TW5's registry); the Node
 * gesture only enumerates + carries the extension. Observations only, never a
 * work queue (Confluence: scan is truth, events are hints).
 */
export function listCarriers(source: string): string[] | null {
  const listed = listSourceFiles(source);
  return listed === null ? null : listed.filter((f) => !f.endsWith(KAPAE_EXT));
}

/** Every file a source lists: the carriers and the kāpae shadow files beside them. */
export function listSourceFiles(source: string): string[] | null {
  let st;
  try { st = statSync(source); } catch { return null; }
  if (!st.isDirectory()) return [source];
  // A bag's OWN declaration is DISK-OWNED and never becomes a record (operator ruling, 2026-08-08). Seeded,
  // it would land in the bag's document and then round-trip through the projection — after which a wiki edit
  // could re-home the bag or loosen its cap-tier. A declaration a rendered surface can move is a declaration
  // nothing holds, so the authority stays on disk where `lares bag declare` writes it. Only the holding
  // ROOT's manifest is excluded: a meme deeper in the tree may legitimately carry that name.
  const bagDeclaration = join(source, BAG_MANIFEST_FILE);
  return (readdirSync(source, { recursive: true }) as string[])
    .map((f) => join(source, f))
    .filter((f) => { try { return statSync(f).isFile(); } catch { return false; } })
    // A `.meta` sidecar carries a content file's fields — it lands WITH that
    // file at the shore, never as a standalone carrier.
    .filter((f) => !f.endsWith(".meta"))
    .filter((f) => f !== bagDeclaration)
    // THE ONE LIST THE HOUSE IGNORES (`HOUSE_IGNORED`): a workspace's tooling, the shore's renders, orphan folders, atomic temps.
    .filter((f) => houseIgnored(relative(source, f)) === null);
}

/** Derive a file's carrier-root URI for one mirror plane (bags/ canon vs
 *  wikis/ working write-layer). The watcher and CLI both feed a source; this
 *  names which address reverse-derivation a row carries. A file no rule reads answers null, or `{ why }` naming the reason
 *  the scan's skip carries (a bare null reads "no address derives"). */
export type FileToUriFn = (root: string, file: string) => string | null | { readonly why: string };

/** The mirror directories a vessel reads — `LAR_BAGS` / `LAR_WIKIS` (cli `larBagsDir()` / `larWikisDir()`),
 *  which may sit outside `LAR_ROOT`, and the house's projections root (`<root>/projections`), whose `bags/` and
 *  `wikis/` read the same way. */
export interface MirrorDirs { readonly bags: string; readonly wikis: string; readonly projections?: string }

/**
 * Pick the address reverse-derivation by which mirror plane the source sits in.
 * Under the wikis dir → the working write-layer ingest-back derivation
 * (the editing plane); else the bags dir canon derivation. Designation of the
 * target bag stays the caller's (`--to`); the plane only drives the URI.
 * `dirs` defaults to `<root>/bags` and `<root>/wikis`; the returned function derives against `dirs`
 * and ignores the root its caller hands it.
 *
 * A REALM ROOT (`<projections>/realms/<realm pet name>/`) reads as its `wikis` and `bags` planes, one folder per slug each.
 *
 * A FACE ROOT (`<projections>/faces/<pet name>/`) reads as its own planes: the root holds the `wiki`, `canon` and `stage`
 * folders (the stage sited by title), and its `personal` plane holds one folder per wiki slug. A face's `recovery`
 * and `temp` hold drafts and temp files that place back as files, never through a layer, so they read as no plane. Every plane
 * reads through the projector's siting run backward (`siteMirrorFile`), so a plain-title file derives its title as a loci
 * carrier derives its address; `tree` lends rule 0, the base at the path.
 */
export function fileToUriForSource(
  root: string, source: string,
  dirs: MirrorDirs = { bags: join(root, "bags"), wikis: join(root, "wikis") },
  tree?: SyncedTree,
): FileToUriFn {
  const abs = resolve(source);
  const under = (dir: string): boolean => { const r = resolve(dir); return abs === r || abs.startsWith(r + sep); };
  const faces = dirs.projections === undefined ? null : resolve(dirs.projections, FACES_PROJECTION_DIR);
  if (faces !== null && under(faces)) {
    return (_root, file) => {
      const abs = resolve(file);
      const [face = "", ...rest] = abs.startsWith(faces + sep) ? abs.slice(faces.length + 1).split(sep) : [];
      if (face === "" || rest.length === 0) return { why: `stands outside any face's planes under ${faces}` };
      return titleOf(siteFaceFile(join(faces, face), file, tree));
    };
  }
  // A REALM ROOT (`<projections>/realms/<realm pet name>/`) reads as its two planes: `wikis` (one workbench folder per slug) and
  // `bags` (one canon folder per slug), each by the projector's siting run backward over that plane.
  const realms = dirs.projections === undefined ? null : resolve(dirs.projections, REALMS_PROJECTION_DIR);
  if (realms !== null && under(realms)) {
    return (_root, file) => {
      const abs = resolve(file);
      const [realm = "", plane = ""] = abs.startsWith(realms + sep) ? abs.slice(realms.length + 1).split(sep) : [];
      if (realm === "" || (plane !== REALM_PLANES.wikis && plane !== REALM_PLANES.bags)) return { why: `stands outside any realm's wikis or bags under ${realms}` };
      return titleOf(siteMirrorFile(join(realms, realm, plane), file, tree, false));
    };
  }
  const projected = dirs.projections === undefined ? null
    : under(join(dirs.projections, "bags")) ? join(dirs.projections, "bags")
    : null;
  const dir = projected ?? (under(dirs.wikis) ? dirs.wikis : dirs.bags);
  return (_root, file) => titleOf(siteMirrorFile(dir, file, tree, false));
}

/**
 * THE TITLE A FACE ROOT'S FILE READS BACK UNDER, by the plane its path rests under (`facePlaneOf`): the personal plane (one
 * folder per wiki slug), the kahua stage (`bags/kahua/`) sited by title, the daemon wiki (`wikis/daemon/`) and its canon
 * (`bags/daemon/`) by the projector's siting run backward over their shelf (`facePlaneSiteDir`); `recovery` and `temp` place
 * back as files, never through a layer, and a path under no plane reads none. `tree` lends rule 0, the base at the path.
 */
export function siteFaceFile(root: string, file: string, tree?: SyncedTree): FileSiting {
  const plane = facePlaneOf(relative(root, file));
  if (plane === null) return { why: `stands under no plane of the face root ${root}` };
  if (plane === "personal") return siteMirrorFile(facePlaneSiteDir(root, plane), file, tree, true);
  if (plane === "recovery" || plane === "temp") return { why: `a face's ${FACE_PLANES[plane]} folder places back as files, never through a layer` };
  if (plane === "stage") return siteFileToTitle({ planeDir: facePlaneSiteDir(root, plane), titlePaths: true, ...(tree !== undefined ? { uriAt: (path: string) => tree.uriAt(path) } : {}) }, file);
  return siteMirrorFile(facePlaneSiteDir(root, plane), file, tree, false);
}

/** A siting as a `FileToUriFn` answers it: the title, or the `{ why }` the scan's skip carries. */
export const titleOf = (sited: FileSiting): string | { readonly why: string } => ("why" in sited ? { why: sited.why } : sited.title);

/**
 * THE TITLE A MIRROR FILE READS BACK UNDER, or why it reads none: the projector's siting run backward (`siteFileToTitle`) over
 * one plane, the synced base at the file's path first where a tree stands. A PERSONAL LAYER'S VIEW STATE (a `$:/` title: the
 * story list, a fold state) reads back only where a base stands at its path: one the house never agreed there stays with the
 * face that set it, as an export never carries one.
 */
export function siteMirrorFile(planeDir: string, file: string, tree: SyncedTree | undefined, personal: boolean): FileSiting {
  const sited = siteFileToTitle({ planeDir, ...(tree !== undefined ? { uriAt: (path: string) => tree.uriAt(path) } : {}) }, file);
  if (personal && "title" in sited && sited.by !== "base" && sited.title.startsWith("$:/")) {
    return { why: `${sited.title} names a personal layer's view state, which stays with the face that set it` };
  }
  return sited;
}

/**
 * The two-leg diff over an explicit carrier list: derive uri, NFC-assert, hash,
 * compare against the Synced tree. The watcher feeds the buffered changed paths
 * here; the CLI feeds the whole walked source. `fileToUri` names the mirror
 * plane (default bags/ canon; wikis/ for working ingest-back).
 */
export function scanFiles(
  root:  string,
  files: readonly string[],
  toBag: string,
  tree:  SyncedTree,
  fileToUri: FileToUriFn = bagsFileToUri,
  /** HEAD's words for a file with no synced base (`poolHeads`): absent, no git history stands in for a base. */
  heads?: BaseFromGit,
): ScanResult {
  const rows: ScanRow[] = [];
  const skipped: ScanSkip[] = [];
  const shadows = new Set<string>();
  const refusedShadows: Array<{ file: string; refusal: string }> = [];
  for (const file of files) {
    const sited = fileToUri(root, file);
    if (sited === null || typeof sited !== "string") { skipped.push({ file, why: sited?.why ?? "no address derives from its path" }); continue; }
    const uri = sited;
    const ext = extname(file);
    // A KĀPAE SHADOW speaks an exclusion: it names a title and carries no record of its own.
    if (ext === KAPAE_EXT) {
      let text: string;
      try { text = readFileSync(file, "utf8"); } catch { skipped.push({ file, why: "a kāpae shadow gone from disk speaks nothing" }); continue; }
      const read = readKapaeShadow(text);
      if ("refusal" in read) { refusedShadows.push({ file, refusal: read.refusal }); continue; }
      if (read.title !== uri) { refusedShadows.push({ file, refusal: "kapae-shadow-title-disagrees-with-siting" }); continue; }
      shadows.add(uri);
      continue;
    }
    let text: string;
    let binary: boolean;
    try { ({ text, binary } = readCarrierText(file)); } catch {
      // A path gone from disk where a base stands AT THAT PATH = a vanished carrier (the watcher feeds
      // vanished paths; it tombstones none and hands each to the vessel's shore, where it stands pending
      // until a person answers). A gone path that holds no base skips: no agreement ever stood there.
      const goneSynced = tree.baseAt(syncedTreeKey(toBag, uri), file)?.disk ?? null;
      if (goneSynced !== null) rows.push({ file, uri, text: "", diskHash: "", syncedHash: goneSynced, status: "deleted", ext });
      else skipped.push({ file, why: "gone from disk, and no base ever stood at its path" });
      continue;
    }
    // The NFC shore assertion (spec: memetic-wikitext-framing #carrier-bytes) — foreign
    // TEXT bytes first walk in HERE; non-NFC refuses loudly, never enters. A binary
    // carrier rides base64 (pure ASCII), so the NFC law does not touch it.
    if (!binary && text !== text.normalize("NFC")) {
      rows.push({ file, uri, text, diskHash: "", syncedHash: null, status: "non-nfc", ext });
      continue;
    }
    // Pair a `.meta` sidecar sitting beside a content file — its fields ride WITH
    // the carrier, AND fold into the observation hash: `.meta` holds LIVE metadata
    // for the entity, so an edit to it alone must read as CHANGED (a body-only
    // hash let a field-only edit slip past the echo gate).
    let meta: string | undefined;
    try {
      const metaPath = file + ".meta";
      if (existsSync(metaPath)) meta = readFileSync(metaPath, "utf8");
    } catch { /* no readable sidecar — a self-contained filetype needs none */ }
    const diskHash   = carrierHash(text, meta);
    // THE BASE HOLDS TWO SIDES. The scan reads the disk side: a file whose bytes stand where the last
    // agreement left them reads `unchanged`, whatever framing they wear. The records side rides the
    // wave so the island's gate can tell "the records moved" from "the disk stands in another framing".
    // A BASE STANDS AT ONE PATH: an agreement the carrier reached at another path names no base for this file.
    const base       = tree.baseAt(syncedTreeKey(toBag, uri), file);
    // Both sides ride tagged (`carrierHash` emits `sha256:…`; the tree stores the same
    // tagged form); `digestsEqual` compares them as `(algo, hex)`.
    const status: ScanStatus =
      base === null ? "new" : digestsEqual(diskHash, base.disk) ? "unchanged" : "changed";
    // NO SYNCED BASE: the pool's HEAD stands in where it holds the file (a re-found cleared the tree, the pool kept its
    // history). The row still reads `new` and rides the wave, so the island weighs it against the records and drops the
    // HEAD base where they hold nothing.
    const head = base === null && !binary && heads !== undefined ? headBaseOf(uri, heads(file)) : null;
    const sides = base ?? head;
    const syncedHash = sides?.disk ?? null;
    const syncedRecordsHash = sides !== null && !digestsEqual(sides.disk, sides.records) ? sides.records : undefined;
    rows.push({ file, uri, text, diskHash, syncedHash, ...(syncedRecordsHash !== undefined ? { syncedRecordsHash } : {}), ...(head !== null ? { headBase: true as const } : {}), status, ext, binary, ...(meta !== undefined ? { meta } : {}) });
  }
  // REMOVE-WINS INSIDE ONE EXPORT: a carrier standing beside the shadow of its own title carries nothing.
  // `familiesOf` leans on this strip: see its note.
  const kept = shadows.size > 0 ? rows.filter((row) => !shadows.has(row.uri)) : rows;
  return {
    rows: kept, skipped,
    ...(shadows.size > 0 ? { shadows: [...shadows].sort() } : {}),
    ...(refusedShadows.length > 0 ? { refusedShadows } : {}),
  };
}

/** The base HEAD's words name: their bytes on the disk side, their render through the pure door on the records side. */
function headBaseOf(uri: string, head: { readonly body: string; readonly meta?: string } | null): { disk: string; records: string } | null {
  if (head === null) return null;
  const disk = carrierHash(head.body, head.meta);
  return { disk, records: recordsSideOf(uri, head.body, head.meta, false) ?? disk };
}

/**
 * Record a landed carrier's synced observation. The gesture records what it landed;
 * the projector records what it projects; both write the same key and the same hash
 * where they agree. A bag no mounted wiki mirrors never projects, and a pack file
 * never projects back, so without the gesture's record the next scan reads every
 * landed carrier `new` and a vanished file never reads as a deletion.
 *
 * Records a BASE for each result that decided `ingest` or `noop` (a noop says the
 * records already say what the disk says): the candidate's disk hash on the disk
 * side, and on the records side the hash the island answered for the render its
 * records hold (`canonicalHash`). A row that names no render (an echo noop, a
 * pointer) keeps the records side a standing base already holds for these same
 * bytes, else the disk hash names both sides. Never records `conflict`, `refuse`,
 * or a result naming no candidate. Before recording, the file is hashed as it
 * stands NOW: where the disk moved since the scan, the projector wrote it and owns
 * that observation, so nothing records. A path where a pin waits on its seal records nothing either (`pendingAt`).
 * Returns the count recorded.
 */
export function recordLandedCarriers(
  tree: SyncedTree,
  toBag: string,
  candidates: readonly ScanRow[],
  resultCarriers: ReadonlyArray<Record<string, unknown>>,
): number {
  const byUri = new Map(candidates.map((c) => [c.uri, c] as const));
  let recorded = 0;
  for (const c of resultCarriers) {
    if (c["decision"] !== "ingest" && c["decision"] !== "noop") continue;
    const cand = byUri.get(String(c["uri"]));
    if (!cand || cand.diskHash === "") continue;
    if (diskHashNow(cand.file) !== cand.diskHash) continue;
    const key = syncedTreeKey(toBag, cand.uri);
    // A PIN WAITS ON ITS SEAL THERE (the projector's, in its island, by its marker): this gesture records no base over it. The
    // projector's pin lands with the heads its records read, once they rest; a headless row here would stand in its way.
    if (tree.pendingAt(key, cand.file)) continue;
    const standing = tree.baseAt(key, cand.file);
    // AN ECHO OF HEAD'S BASE PINS HEAD'S RECORDS SIDE: the disk stands at HEAD, and the records may have moved past it, so
    // the records' present render would name an agreement no side reached. The projector then reads the records moved.
    const headEcho = cand.headBase === true && c["decision"] === "noop" && c["reason"] === "disk-matches-synced" && cand.syncedHash !== null;
    const answered = typeof c["canonicalHash"] === "string" && c["canonicalHash"] ? (c["canonicalHash"] as string) : null;
    const recordsHash = headEcho ? (cand.syncedRecordsHash ?? cand.syncedHash!)
      : answered ?? (standing !== null && digestsEqual(standing.disk, cand.diskHash) ? standing.records : cand.diskHash);
    // A BASE THAT ALREADY NAMES THIS AGREEMENT STAYS PUT. The projector may have pinned it first, with the document and
    // the heads its records side read (`SyncedBase.heads`); this gesture names neither, and a row it rewrote would drop them.
    if (!(standing !== null && digestsEqual(standing.disk, cand.diskHash) && digestsEqual(standing.records, recordsHash))) {
      tree.set(key, cand.file, cand.diskHash, recordsHash);
    }
    recorded++;
  }
  return recorded;
}

/**
 * The island's per-carrier answer, as an outcome carries it.
 *
 * AN OUTCOME KEEPS EVERY ROW ONLY UNDER ITS AUDIT CAP. Past the cap (`boundOutcomeOutput`, `@lararium/tw5`
 * `verb-vm.ts`) the durable outcome holds a count, a tally per decision, a hash, a short sample, and every
 * `refuse` and `conflict` row up to the cap (`held`, with `heldMore` counting the ones it leaves unnamed), and
 * the CLI reads that same outcome as its answer. A whole-bag seed crosses the cap, so every reader of
 * `carriers` reads through here: `rows` holds what the outcome names (all rows under the cap; past it, the held
 * rows), and `bounded` holds the count, the tally and `heldMore` where the rest stayed behind.
 */
export interface CarrierAnswer {
  readonly rows:    ReadonlyArray<Record<string, unknown>>;
  readonly bounded: { readonly count: number; readonly tallies: Readonly<Record<string, number>>; readonly heldMore: number } | null;
}

export function readCarrierAnswer(carriers: unknown): CarrierAnswer {
  if (Array.isArray(carriers)) return { rows: carriers as Array<Record<string, unknown>>, bounded: null };
  if (carriers !== null && typeof carriers === "object") {
    const o = carriers as Record<string, unknown>;
    const count = o["boundedArrayCount"];
    const tallies = o["tallies"];
    const held = o["held"];
    const heldMore = o["heldMore"];
    if (typeof count === "number" && tallies !== null && typeof tallies === "object" && !Array.isArray(tallies)
        && Array.isArray(held) && typeof heldMore === "number") {
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(tallies as Record<string, unknown>)) if (typeof v === "number") clean[k] = v;
      return { rows: held as Array<Record<string, unknown>>, bounded: { count, tallies: clean, heldMore } };
    }
  }
  return { rows: [], bounded: null };
}

/** A wave under this many carriers answers with every row whole. It never exceeds the outcome's audit cap
 *  (`AUDIT_ARRAY_CAP`, `@lararium/tw5` `verb-vm.ts`); `tests/ingest-settles-every-row.test.ts` welds the two. */
export const INGEST_PAGE = 32;

/** One refused or conflicting carrier, as a person reads it: where, what the island decided, and why. */
export interface AskingCarrier {
  readonly uri:      string;
  readonly file?:    string;
  readonly decision: string;
  readonly why:      string;
}

/** Why the island refused or stood off, in its own words: every warning it gave, else its reason, else its code. */
function whyOf(row: Record<string, unknown>): string {
  const warnings = Array.isArray(row["warnings"]) ? (row["warnings"] as unknown[]).filter((w): w is string => typeof w === "string" && w !== "") : [];
  if (warnings.length > 0) return warnings.join("; ");
  if (typeof row["reason"] === "string" && row["reason"]) return row["reason"];
  if (typeof row["code"] === "string" && row["code"]) return row["code"];
  return row["decision"] === "conflict"
    ? "the disk and the records both moved past the base this file last agreed on"
    : "the island named no reason";
}

/** What an INGEST gesture settled: every wave it sent, and every row those waves named. */
export interface IngestSettlement {
  /** The first wave: its request id names the gesture's audit record, and its error ends the gesture. */
  readonly first:    IngestSubmitResult;
  /** Every later wave the gesture sent to read a row the first answer left behind. */
  readonly pages:    readonly IngestSubmitResult[];
  /** How many carriers the gesture submitted. */
  readonly submitted: number;
  /** Every carrier address the gesture submitted, and every vanished address it sent as a deletion. */
  readonly asked:    readonly string[];
  readonly askedDeletions: readonly string[];
  /** The carriers the answer accounts for as taken: a row that says it landed, already matched, or stands
   *  `derived` (a render the renderer writes, rendered-derives.ts), a tally that proves every unnamed carrier
   *  landed, or a rename the island confirmed. */
  readonly landed:   ReadonlySet<string>;
  /** The carriers no answer accounts for: neither landed, refused, nor standing in a conflict. A wave the
   *  island answered without their rows, or a later wave that failed before reaching them. */
  readonly unanswered: readonly string[];
  /** The decision the island gave each carrier it NAMED, by uri. Past the cap a landed carrier may go unnamed. */
  readonly named:    ReadonlyMap<string, Record<string, unknown>>;
  /** Every carrier the island refused, each with its refusal. Complete: no refusal stays unnamed. */
  readonly refused:  readonly AskingCarrier[];
  /** Every carrier that stood off in a conflict, each named. Complete. */
  readonly conflicts: readonly AskingCarrier[];
  /** Every `derived` carrier whose rung warns (a hand edit to a render, a render awaiting its source), each with
   *  its warning. It fails nothing: the island landed nothing for it and the renderer owns its words. */
  readonly derived:  readonly AskingCarrier[];
  /** Carriers per decision over the whole gesture. */
  readonly tallies:  Readonly<Record<string, number>>;
  /** The first wave's deletion summary: the re-links, the absent sources, the declined addresses. */
  readonly deletions: Record<string, unknown> | undefined;
  /** How many bases the gesture pinned. */
  readonly recorded: number;
  /** Each carrier whose records the gesture moved (`ingest`), with the hash its records render as the island
   *  named it, or as the one pure door read it where the rows stayed behind the cap. The settle word asks the
   *  projection after exactly these (`settle`, `shore-verb.ts`). */
  readonly rendered: ReadonlyArray<{ readonly uri: string; readonly records: string; readonly heads?: readonly string[] }>;
  /** A later wave that ended in an error: the gesture stops there and names what stays unread. */
  readonly pageError?: { readonly message: string; readonly unread: number; readonly requestId?: string; readonly outcome?: "committed" | "unknown" };
  /** Every first-pass wave the gesture crested, in order: its request id, what it carried, and how it ended. */
  readonly waves?: ReadonlyArray<IngestWaveRecord>;
  /** What no wave reached: the carriers and deletions a stopped gesture still owes, by address. */
  readonly debt?: { readonly carriers: readonly string[]; readonly deletions: readonly string[] };
}

/** One crested wave of a paged gesture. */
export interface IngestWaveRecord {
  readonly requestId: string;
  readonly carriers: number;
  readonly deletions: number;
  readonly status: "done" | "error" | "committed" | "unknown";
}

/** How a gesture crests its first pass (`wave-crest`): the per-wave limits, the servo's target and its clock. */
export interface IngestPacing {
  readonly limits?: WaveLimits;
  readonly targetMs?: number;
  readonly now?: () => number;
  readonly yieldFn?: () => Promise<void>;
}

/** What a settled gesture says of itself: whether the run took everything it was handed, and why it did not. */
export interface IngestVerdict {
  /** True where the run refused a carrier, a later wave failed, or a carrier drew no answer. */
  readonly failed:  boolean;
  /** The sentence a person reads where the run failed; null where it took everything. */
  readonly message: string | null;
}

/**
 * A REFUSAL NEVER READS AS APPLIED. Three states fail a run: a refused carrier (each one named), a later
 * wave that failed (the count that stays unread named), and a carrier no answer accounts for. A conflict
 * gets named and leaves this verdict alone: the island surfaced it for a hand, and the run took every
 * carrier it could decide. A door that speaks for one person's one gesture reads the conflicts beside the
 * verdict and ends non-zero on its own account (`lares ingest`).
 */
export function ingestVerdict(s: IngestSettlement): IngestVerdict {
  if (s.pageError !== undefined) {
    const id = s.pageError.requestId !== undefined && s.pageError.requestId !== "" ? ` (request ${s.pageError.requestId})` : "";
    // A WAIT THAT ENDED IS NO FAILURE: the wave's own receipt names what the vessel holds, and the run owes the rest.
    if (s.pageError.outcome !== undefined) {
      return { failed: true, message: `INGEST stopped at a wave whose outcome reads ${s.pageError.outcome}${id}: read it with \`lares vessel request ${s.pageError.requestId ?? ""}\`; ${s.pageError.unread} carrier(s) stay owed past it: run the ingest again once it settles (diff-gated)` };
    }
    return { failed: true, message: `INGEST read ${s.refused.length} refusal(s) and then a later wave${id} failed (${s.pageError.message}); ${s.pageError.unread} carrier(s) stay unread: run the ingest again` };
  }
  if (s.refused.length > 0) {
    return { failed: true, message: `INGEST refused ${s.refused.length} of ${s.submitted} carrier(s): ${s.refused.map((r) => r.uri).join(", ")}` };
  }
  if (s.unanswered.length > 0) {
    return { failed: true, message: `INGEST drew no answer for ${s.unanswered.length} of ${s.submitted} carrier(s): ${s.unanswered.join(", ")}; run the ingest again` };
  }
  return { failed: false, message: null };
}

/** The re-links a wave's deletion summary names: each vanished source with the address its records moved to. */
export function renamesOf(deletions: Record<string, unknown> | undefined): Array<{ fromUri: string; toUri: string }> {
  const renames = deletions?.["renames"];
  if (!Array.isArray(renames)) return [];
  return (renames as Array<Record<string, unknown>>).map((r) => ({ fromUri: String(r["fromUri"]), toUri: String(r["toUri"]) }));
}

/** The vanished sources a wave's deletion summary names as re-linked. */
export function renamedSources(deletions: Record<string, unknown> | undefined): Set<string> {
  return new Set(renamesOf(deletions).map((r) => r.fromUri));
}

/** The vanished addresses a wave's deletion summary names `absent`: the records hold nothing under them. */
export function absentSources(deletions: Record<string, unknown> | undefined): Set<string> {
  const absent = deletions?.["absent"];
  return new Set(Array.isArray(absent) ? (absent as unknown[]).map(String) : []);
}

/**
 * What a watcher still owes across its waves: each carrier that did not land, and each vanished address
 * whose deletion did not apply, by address, with the reason in the island's or the wave's own words.
 */
export interface StandingAsks {
  readonly owed:          ReadonlyMap<string, string>;
  readonly owedDeletions: ReadonlyMap<string, string>;
}

export const NO_STANDING_ASKS: StandingAsks = { owed: new Map(), owedDeletions: new Map() };

/** True where nothing stays owed. */
export function standsClean(standing: StandingAsks): boolean {
  return standing.owed.size === 0 && standing.owedDeletions.size === 0;
}

/** A wave that never answered (a thrown fault, a wait that ended): everything it carried stays owed. */
export function standingAfterFault(
  standing: StandingAsks, wave: { readonly asked: readonly string[]; readonly askedDeletions: readonly string[] }, message: string,
): StandingAsks {
  const owed = new Map(standing.owed);
  const owedDeletions = new Map(standing.owedDeletions);
  for (const uri of wave.asked) owed.set(uri, message);
  for (const uri of wave.askedDeletions) owedDeletions.set(uri, message);
  return { owed, owedDeletions };
}

/**
 * Fold one settled wave into what stays owed, BY ADDRESS. A debt clears only where a wave proves that very
 * carrier landed, or that very deletion applied: a later wave over other files clears nothing.
 *
 *   · a carrier the wave refused, or that drew no answer, stands owed with the reason;
 *   · a carrier the answer accounts for as taken (a row that landed, matched or stands `derived`, a proving tally,
 *     a confirmed rename) leaves the set;
 *   · a wave the island answered with an error leaves everything it carried owed, its deletions too;
 *   · a vanished address the summary names settled (a rename's source, or one whose records hold
 *     nothing) leaves the set; one the island declined stays owed, and the vessel's shore hears of it.
 *
 * A conflict stays out: the island surfaced it for a hand, and the wave took every carrier it could decide.
 * A long-lived watcher reads this at its stop and ends non-zero where anything stays owed.
 */
export function standingAfterWave(standing: StandingAsks, s: IngestSettlement): StandingAsks {
  if (s.first.status === "error") return standingAfterFault(standing, s, s.first.errorMessage ?? "the daemon refused and named no reason");
  const owed = new Map(standing.owed);
  const owedDeletions = new Map(standing.owedDeletions);
  for (const uri of s.landed) owed.delete(uri);
  for (const r of s.refused) owed.set(r.uri, r.why);
  const unread = s.pageError !== undefined ? `a later wave failed (${s.pageError.message})` : "the island answered the wave without this carrier's row";
  for (const uri of s.unanswered) owed.set(uri, unread);
  // The vanished addresses the summary names settled. A summary that names none leaves each one owed.
  const applied = new Set<string>([...renamedSources(s.deletions), ...absentSources(s.deletions)]);
  for (const uri of applied) owedDeletions.delete(uri);
  for (const uri of s.askedDeletions) if (!applied.has(uri)) owedDeletions.set(uri, "the island re-linked no record for it; it stands pending at the vessel's shore");
  return { owed, owedDeletions };
}

/**
 * The records side the gesture can read for itself: a framed meme with no sidecar renders through the one
 * pure door the projector reads (`canonicalizeCarrierText`), so both pin the same hash. A carrier beside a
 * sidecar, a native filetype, a binary body and a carrier the door cannot read whole all answer null: the
 * island's own row names their render.
 */
function ownRecordsSide(c: ScanRow): string | null {
  return recordsSideOf(c.uri, c.text, c.meta, c.binary === true);
}

function recordsSideOf(uri: string, text: string, meta: string | undefined, binary: boolean): string | null {
  if (meta !== undefined || binary) return null;
  let canonical: string | null;
  try { canonical = canonicalizeCarrierText(uri, text); } catch { canonical = null; }
  return canonical === null ? null : carrierHash(canonical);
}

/**
 * THE FIRST PASS CRESTS AS A NALU (lar:///ha.ka.ba/lares/api/pono/nalu#/the-wave-shape, `wave-crest`).
 *
 * One INGEST of 194 lares carriers took the daemon's shared Automerge engine down on 2026-11-22: the engine holds every
 * object a wave writes at once, and upstream bounds no sync batch. So the gesture hands the daemon bounded waves:
 *
 *   · FAMILIES: a renamed carrier rides with the deletion of the file it left (the island pairs a rename inside one wave);
 *     each kāpae and each deletion no carrier pairs stands as a family of its own, so a mass delete or a mass set-aside
 *     crests across waves too. The kāpae queue first, so a handful of them still ride the first wave.
 *   · THE CREST: whole families off the head of the queue while the wave still fits every limit of the per-document wave
 *     budget (`INGEST_WAVE_LIMITS`: carriers, encoded bytes, estimated objects); a family heavier than the limits rides alone.
 *   · BACKPRESSURE: a wave the daemon refuses `ingest-wave-over-budget` returns to the head of the queue and crests again at
 *     half the depth; a lone family the daemon still refuses stops the gesture by name.
 *   · THE SERVO: each wave's duration steps the next depth (`adaptDepth`, the accumulate family's shrink): a wave slower
 *     than `INGEST_WAVE_TARGET_MS` shrinks the next, a fast one grows it back up to the budget.
 *   · THE BREATH: the gesture yields to the host between waves.
 *
 * Each wave settles whole (`settleWave`: its own audit-cap re-asks, its own pins), so a reader never meets half a wave.
 * A wave that fails, or whose wait ended, stops the gesture: the settlement names every wave it sent (`waves`, each with its
 * request id and how it ended), the stop (`pageError`, with the wave's id and a read-back's `committed`/`unknown`), and what
 * no wave reached (`debt`). A later run passes the diff gate: what landed reads unchanged and rides no wave again.
 *
 * A gesture that fits one wave rides one wave, exactly as before.
 */
export async function settleIngest(
  opts: SubmitIngestOpts,
  tree: SyncedTree,
  submit: IngestSubmit,
  pacing: IngestPacing = {},
): Promise<IngestSettlement> {
  const limits = pacing.limits ?? INGEST_WAVE_LIMITS;
  const families = familiesOf(opts);
  const whole = families.reduce<WaveWeight>((w, f) => addWeight(w, familyWeight(f)), { count: 0 });
  if (families.length <= 1 || fitsWave(whole, limits)) {
    const s = await settleWave(opts, tree, submit);
    return { ...s, waves: [{ requestId: s.first.requestId, carriers: opts.candidates.length, deletions: opts.deletions?.length ?? 0, status: s.first.status }] };
  }

  const now = pacing.now ?? (() => performance.now());
  const targetMs = pacing.targetMs ?? INGEST_WAVE_TARGET_MS;
  const yieldFn = pacing.yieldFn ?? yieldToHost;
  const queue = [...families];
  const settled: IngestSettlement[] = [];
  const waves: IngestWaveRecord[] = [];
  let depth = limits.count;
  let pageError: IngestSettlement["pageError"];
  let firstError: IngestSettlement | undefined;
  let owed: IngestFamily[] = [];
  while (queue.length > 0) {
    const crest = takeCrest(queue, familyWeight, scaleLimits(limits, depth / limits.count));
    const page = pageOpts(opts, crest, waves.length);
    const carriers = page.candidates.length;
    const deletions = page.deletions?.length ?? 0;
    const t0 = now();
    let s: IngestSettlement;
    try {
      s = await settleWave(page, tree, submit);
    } catch (err) {
      // The first wave's own fault reads as it always did; a later one stops the gesture and names what it knows.
      if (settled.length === 0) throw err;
      const told = err as { requestId?: unknown; receiptState?: unknown };
      const requestId = typeof told.requestId === "string" ? told.requestId : undefined;
      const outcome = told.receiptState === "committed" ? "committed" as const : "unknown" as const;
      waves.push({ requestId: requestId ?? "", carriers, deletions, status: outcome });
      owed = [...crest, ...queue];
      pageError = { message: err instanceof Error ? err.message : String(err), unread: carriersOf(owed), ...(requestId !== undefined ? { requestId } : {}), outcome };
      break;
    }
    if (s.first.status === "error") {
      // BACKPRESSURE: the daemon's own budget answered; the same families crest again at half the depth.
      if (s.first.refusal?.reason === INGEST_WAVE_OVER_BUDGET && crest.length > 1) {
        queue.unshift(...crest);
        depth = Math.max(1, Math.floor(Math.min(depth, crest.length) / 2));
        continue;
      }
      waves.push({ requestId: s.first.requestId, carriers, deletions, status: "error" });
      owed = [...crest, ...queue];
      if (settled.length === 0) firstError = s;
      else pageError = { message: s.first.errorMessage ?? "the daemon refused and named no reason", unread: carriersOf(owed), requestId: s.first.requestId };
      break;
    }
    settled.push(s);
    waves.push({ requestId: s.first.requestId, carriers, deletions, status: "done" });
    depth = adaptDepth(depth, now() - t0, targetMs, 0.25, limits.count);
    if (queue.length > 0) await yieldFn();
  }
  const debt = owed.length > 0
    ? { carriers: owed.flatMap((f) => f.candidates.map((c) => c.uri)), deletions: owed.flatMap((f) => f.deletions.map((d) => d.uri)) }
    : undefined;
  const asked = opts.candidates.map((c) => c.uri);
  const askedDeletions = (opts.deletions ?? []).map((d) => d.uri);
  if (firstError !== undefined) {
    return { ...firstError, submitted: asked.length, asked, askedDeletions, unanswered: asked, waves, ...(debt ? { debt } : {}) };
  }
  return mergeSettlements(settled, opts, waves, pageError, debt);
}

/** How long one INGEST wave may run before the servo shrinks the next: a wave that fits the budget lands in seconds on a
 *  warm vessel, and twenty seconds leaves room for a cold one while still catching a wave that drags the engine. */
export const INGEST_WAVE_TARGET_MS = 20_000;

/**
 * THE CALLER'S WAIT FOR ONE WAVE, scaled by what it sends and capped. The floor and the per-carrier step keep the prior
 * budget (10 s + 400 ms per carrier); each MiB adds 4 s, since encoding and applying a large body costs past its count; the
 * estimated operation adds 10 ms; the cap bounds how long a caller waits before it reads the wave's receipt instead.
 */
export const INGEST_WAIT_FLOOR_MS = 10_000;
export const INGEST_WAIT_PER_CARRIER_MS = 400;
export const INGEST_WAIT_PER_MIB_MS = 4_000;
export const INGEST_WAIT_CAP_MS = 300_000;
export function ingestWaitBudgetMs(w: { readonly carriers: number; readonly bytes: number; readonly ops?: number }): number {
  const budget = INGEST_WAIT_FLOOR_MS + w.carriers * INGEST_WAIT_PER_CARRIER_MS + Math.ceil((w.bytes / (1024 * 1024)) * INGEST_WAIT_PER_MIB_MS) + (w.ops ?? 0) * 10;
  return Math.min(INGEST_WAIT_CAP_MS, Math.max(INGEST_WAIT_FLOOR_MS, budget));
}

/** One grain of the first pass: a carrier with the deletion its rename pairs, a loose deletion, or one kāpae. */
interface IngestFamily {
  readonly candidates: readonly ScanRow[];
  readonly deletions: readonly PendingDeletion[];
  readonly kapae: readonly string[];
}

/**
 * Each kāpae a family (first), each carrier a family with the deletion its rename pairs, each loose deletion a family.
 *
 * TWO ROADS NAME A RENAME, AND THE CREST KEEPS BOTH. The whole-source scan marks the arrival (`renameFrom`, `resolveRenames`);
 * the watchers pair by content and leave the arrival unmarked (`pairedDeletions`). So a deletion no `renameFrom` claims pairs
 * with the arrival whose disk hash equals its synced hash, under `pairedDeletions`' own rule: the content stands unique among
 * the vanished, one candidate holds it, and that candidate arrived. The island pairs a rename inside one wave only
 * (`pairRenames`), so a pair the crest split would decline the vanish and land a fresh carrier.
 *
 * A KĀPAE AND ITS CARRIER NEVER RIDE APART. The island executor's kāpae remove-wins check reads only the wave it runs, and
 * the families split across waves here, so a kāpae and a carrier for one title in different waves would both land. The
 * check holds because the scan already strips every carrier that stands beside its own shadow (`scanFiles`, REMOVE-WINS
 * INSIDE ONE EXPORT): no candidate reaches this split under a title a kāpae in the same submit names. A scan change that
 * kept such a carrier would break the executor's check unseen; `scan-strips-shadowed-carrier.test.ts` pins the strip.
 */
function familiesOf(opts: SubmitIngestOpts): IngestFamily[] {
  const deletions = opts.deletions ?? [];
  const byUri = new Map(deletions.map((d) => [d.uri, d] as const));
  const claimed = new Set<string>();
  const marked = new Map<ScanRow, PendingDeletion[]>();
  for (const c of opts.candidates) {
    const d = c.renameFrom === undefined ? undefined : byUri.get(c.renameFrom);
    if (d !== undefined && !claimed.has(d.uri)) { claimed.add(d.uri); marked.set(c, [d]); }
  }
  // The content road: `pairedDeletions`' uniqueness over what no mark claimed.
  const gone = new Map<string, number>();
  for (const d of deletions) if (!claimed.has(d.uri)) gone.set(d.syncedHash, (gone.get(d.syncedHash) ?? 0) + 1);
  const holding = new Map<string, ScanRow[]>();
  for (const c of opts.candidates) holding.set(c.diskHash, [...(holding.get(c.diskHash) ?? []), c]);
  for (const d of deletions) {
    if (claimed.has(d.uri) || gone.get(d.syncedHash) !== 1) continue;
    const holders = holding.get(d.syncedHash) ?? [];
    const arrival = holders.length === 1 ? holders[0]! : undefined;
    if (arrival === undefined || (arrival.status !== "new" && arrival.status !== "renamed") || marked.has(arrival)) continue;
    claimed.add(d.uri);
    marked.set(arrival, [d]);
  }
  const families: IngestFamily[] = (opts.kapae ?? []).map((k) => ({ candidates: [], deletions: [], kapae: [k] }));
  for (const c of opts.candidates) families.push({ candidates: [c], deletions: marked.get(c) ?? [], kapae: [] });
  for (const d of deletions) if (!claimed.has(d.uri)) families.push({ candidates: [], deletions: [d], kapae: [] });
  return families;
}

/** A family's weight as the daemon will read it (`ingest-wave-budget`): every row counts, each deletion and kāpae one record. */
function familyWeight(f: IngestFamily): WaveWeight {
  let w: WaveWeight = { count: f.deletions.length + f.kapae.length };
  for (const c of f.candidates) {
    w = addWeight(w, ingestCarrierWeight({ uri: c.uri, file: c.file, diskHash: c.diskHash, syncedHash: c.syncedHash, ext: c.ext, text: c.text, ...(c.meta !== undefined ? { meta: c.meta } : {}) }));
  }
  for (const d of f.deletions) w = addWeight(w, { count: 0, bytes: JSON.stringify(d).length, ops: RECORD_OBJECTS });
  for (const k of f.kapae) w = addWeight(w, { count: 0, bytes: JSON.stringify(k).length, ops: RECORD_OBJECTS });
  return w;
}

const carriersOf = (families: readonly IngestFamily[]): number => families.reduce((n, f) => n + f.candidates.length, 0);

/** One crest's own opts: its carriers, deletions and kāpae; each later wave its own change id. */
function pageOpts(opts: SubmitIngestOpts, crest: readonly IngestFamily[], sent: number): SubmitIngestOpts {
  const { deletions: _d, kapae: _k, changeId, ...rest } = opts;
  const deletions = crest.flatMap((f) => f.deletions);
  const kapae = crest.flatMap((f) => f.kapae);
  // THE EFFECT INDEX KEYS ON THE CHANGE ID: a later wave under the first wave's id would read as that wave's effect.
  const pageChangeId = changeId === undefined ? undefined : sent === 0 ? changeId : `${changeId}.p${sent + 1}`;
  return {
    ...rest,
    candidates: crest.flatMap((f) => f.candidates),
    ...(deletions.length > 0 ? { deletions } : {}),
    ...(kapae.length > 0 ? { kapae } : {}),
    ...(pageChangeId !== undefined ? { changeId: pageChangeId } : {}),
  };
}

/** The settlements of every crest that landed, read as one gesture's. */
function mergeSettlements(
  all: readonly IngestSettlement[], opts: SubmitIngestOpts, waves: readonly IngestWaveRecord[],
  pageError: IngestSettlement["pageError"], debt: IngestSettlement["debt"],
): IngestSettlement {
  const asked = opts.candidates.map((c) => c.uri);
  const askedDeletions = (opts.deletions ?? []).map((d) => d.uri);
  const landed = new Set<string>();
  const named = new Map<string, Record<string, unknown>>();
  const tallies: Record<string, number> = {};
  const renames: unknown[] = [];
  const absent: unknown[] = [];
  let deletions: Record<string, unknown> | undefined;
  for (const s of all) {
    for (const uri of s.landed) landed.add(uri);
    for (const [uri, row] of s.named) named.set(uri, row);
    for (const [k, v] of Object.entries(s.tallies)) tallies[k] = (tallies[k] ?? 0) + v;
    if (s.deletions !== undefined) {
      deletions = { ...s.deletions, ...(deletions ?? {}) };
      if (Array.isArray(s.deletions["renames"])) renames.push(...(s.deletions["renames"] as unknown[]));
      if (Array.isArray(s.deletions["absent"])) absent.push(...(s.deletions["absent"] as unknown[]));
    }
  }
  if (deletions !== undefined) deletions = { ...deletions, renames, absent };
  const refused = all.flatMap((s) => s.refused);
  const conflicts = all.flatMap((s) => s.conflicts);
  const asking = new Set([...refused, ...conflicts].map((r) => r.uri));
  return {
    first: all[0]!.first,
    pages: all.flatMap((s, i) => (i === 0 ? [...s.pages] : [s.first, ...s.pages])),
    submitted: asked.length, asked, askedDeletions, landed,
    unanswered: asked.filter((uri) => !landed.has(uri) && !asking.has(uri)),
    named, refused, conflicts, derived: all.flatMap((s) => s.derived), tallies, deletions,
    recorded: all.reduce((n, s) => n + s.recorded, 0),
    rendered: all.flatMap((s) => s.rendered),
    waves,
    ...(pageError !== undefined ? { pageError } : {}),
    ...(debt !== undefined ? { debt } : {}),
  };
}

/**
 * THE WHOLE GESTURE: submit, read every row a person or the base needs, pin what landed.
 *
 * One wave carries every candidate. Under the audit cap its outcome names every row and the gesture ends
 * there. Past the cap the outcome holds a tally and the rows that ask for a hand, and two readings may stay
 * behind:
 *
 *   · A REFUSAL THE SUMMARY LEFT UNNAMED (`heldMore` above zero). The gesture asks again for every carrier
 *     the summary did not name, in waves under the cap, so each answers with its row whole.
 *   · A LANDED CARRIER'S RENDER. A base holds two sides, and the records side comes from the island's row.
 *     Where the rows stayed behind the gesture reads that side through the pure door for a framed meme with
 *     no sidecar, and asks again, in waves under the cap, for each carrier the door cannot read.
 *
 * A carrier asked again reads against the records the first wave left: a landed one answers `noop` and its
 * render, a refused one answers its refusal again. Nothing lands twice. Deletions ride the first wave alone.
 */
async function settleWave(
  opts: SubmitIngestOpts,
  tree: SyncedTree,
  submit: IngestSubmit,
): Promise<IngestSettlement> {
  const first = await submit(opts);
  const asked = opts.candidates.map((c) => c.uri);
  const askedDeletions = (opts.deletions ?? []).map((d) => d.uri);
  if (first.status === "error") {
    return {
      first, pages: [], submitted: asked.length, asked, askedDeletions, landed: new Set(), unanswered: asked,
      named: new Map(), refused: [], conflicts: [], derived: [], tallies: {}, deletions: undefined, recorded: 0, rendered: [],
    };
  }

  const summary = summaryOf(first) ?? {};
  const waveHeads = headsNamed((summary as { heads?: unknown }).heads);
  const deletions = (summary as { deletions?: Record<string, unknown> }).deletions;
  const answer = readCarrierAnswer((summary as { carriers?: unknown }).carriers);
  const byUri = new Map(opts.candidates.map((c) => [c.uri, c] as const));
  const named = new Map<string, Record<string, unknown>>();
  for (const row of answer.rows) named.set(String(row["uri"]), row);
  const pages: IngestSubmitResult[] = [];
  let recorded = 0;
  /** The records sides the pure door read for landed carriers no row named. */
  const ownRendered: Array<{ uri: string; records: string; heads?: readonly string[] }> = [];
  /** The wave heads each later page's summary named, by carrier: a row that names none rides its page's. */
  const pageHeads = new Map<string, readonly string[]>();
  /** The carriers a later wave asked again: the first wave may have landed them, so their `noop` names a render. */
  const askedAgain = new Set<string>();
  let pageError: IngestSettlement["pageError"];
  /** Carriers a tally proves landed though no row names them. */
  const provenLanded = new Set<string>();
  // A carrier the island re-homed from a vanished source rides the deletion summary and pins there
  // (`applyConfirmedRenames`).
  const rehomed = new Set<string>(renamesOf(deletions).map((r) => r.toUri));

  if (!answer.bounded) {
    recorded += recordLandedCarriers(tree, opts.toBag, opts.candidates, answer.rows);
  } else {
    // Who stays unread. Each unnamed carrier landed only where the answer PROVES it: no refusal stays
    // unnamed, and the tally's landed count equals the unnamed carriers. Where the tally proves less (a row
    // this reader cannot place, a row short), every unnamed carrier gets asked again and its own row decides.
    const unnamed = opts.candidates.filter((c) => !named.has(c.uri) && !rehomed.has(c.uri));
    const { tallies: told, heldMore } = answer.bounded;
    const proven = heldMore === 0 && (told["ingest"] ?? 0) + (told["noop"] ?? 0) === unnamed.length;
    const askAgain: ScanRow[] = [];
    if (!proven) {
      askAgain.push(...unnamed);
    } else {
      for (const c of unnamed) provenLanded.add(c.uri);
      const own: Array<Record<string, unknown>> = [];
      for (const c of unnamed) {
        const records = ownRecordsSide(c);
        if (records === null) askAgain.push(c);
        else { own.push({ uri: c.uri, decision: "ingest", canonicalHash: records }); ownRendered.push({ uri: c.uri, records, ...(waveHeads !== undefined ? { heads: waveHeads } : {}) }); }
      }
      recorded += recordLandedCarriers(tree, opts.toBag, opts.candidates, own);
    }
    for (let at = 0; at < askAgain.length && pageError === undefined; at += INGEST_PAGE) {
      const page = askAgain.slice(at, at + INGEST_PAGE);
      for (const c of page) askedAgain.add(c.uri);
      const { deletions: _first, changeId: _id, ...rest } = opts;
      const result = await submit({ ...rest, candidates: page });
      pages.push(result);
      if (result.status === "error") {
        pageError = { message: result.errorMessage ?? "the daemon refused and named no reason", unread: askAgain.length - at };
        break;
      }
      const pageOut = summaryOf(result) as { carriers?: unknown; heads?: unknown } | undefined;
      const rows = readCarrierAnswer(pageOut?.carriers).rows;
      const heads = headsNamed(pageOut?.heads);
      for (const row of rows) { named.set(String(row["uri"]), row); if (heads !== undefined) pageHeads.set(String(row["uri"]), heads); }
      recorded += recordLandedCarriers(tree, opts.toBag, page, rows);
    }
  }

  const asking = (decision: string): AskingCarrier[] => [...named.values()]
    .filter((row) => row["decision"] === decision)
    .map((row) => {
      const uri = String(row["uri"] ?? "(carrier)");
      const file = byUri.get(uri)?.file;
      return { uri, ...(file !== undefined ? { file } : {}), decision, why: whyOf(row) };
    });
  const refused = asking("refuse");
  const conflicts = asking("conflict");
  const derived = asking("derived").filter((row) => Array.isArray(named.get(row.uri)?.["warnings"]));
  // The tally over the whole gesture: the rows where every carrier got named, else the first wave's own
  // count with the asking decisions corrected to what the later waves named.
  const tallies: Record<string, number> = {};
  if (!answer.bounded) {
    for (const row of answer.rows) { const d = String(row["decision"]); tallies[d] = (tallies[d] ?? 0) + 1; }
  } else {
    Object.assign(tallies, answer.bounded.tallies);
    if (pageError === undefined) {
      if (refused.length > 0) tallies["refuse"] = refused.length; else delete tallies["refuse"];
      if (conflicts.length > 0) tallies["conflict"] = conflicts.length; else delete tallies["conflict"];
    }
  }
  // What the answer accounts for. A row that says a carrier landed, a tally that proves it, a rename the
  // island confirmed; a refusal and a conflict each named. Every other carrier drew no answer.
  const landed = new Set<string>([...provenLanded, ...rehomed].filter((uri) => byUri.has(uri)));
  for (const [uri, row] of named) {
    const decision = String(row["decision"]);
    if (decision === "ingest" || decision === "noop" || decision === "derived" || decision === "rename-target" || decision === "rename") landed.add(uri);
    else landed.delete(uri);
  }
  const askingUris = new Set([...refused, ...conflicts].map((r) => r.uri));
  const unanswered = asked.filter((uri) => !landed.has(uri) && !askingUris.has(uri));
  const rendered: Array<{ uri: string; records: string; heads?: readonly string[] }> = [...ownRendered];
  for (const [uri, row] of named) {
    const records = row["canonicalHash"];
    // A later wave reads against the records the first wave left: a carrier the first wave landed answers
    // `noop` there, and its records moved all the same.
    const moved = row["decision"] === "ingest" || (row["decision"] === "noop" && askedAgain.has(uri));
    // The row names the causal heads that carried the carrier's records when the island's store keeps history:
    // the settle word follows them through the view and ends on the far side's close (G36).
    // A row behind the audit cap names none of its own: it rides its page's wave heads, else the first wave's.
    const rowHeads = headsNamed(row["heads"]) ?? pageHeads.get(uri) ?? waveHeads;
    if (moved && byUri.has(uri) && typeof records === "string" && records !== "") rendered.push({ uri, records, ...(rowHeads !== undefined ? { heads: rowHeads } : {}) });
  }
  return {
    first, pages, submitted: asked.length, asked, askedDeletions, landed, unanswered,
    named, refused, conflicts, derived, tallies, deletions, recorded, rendered,
    ...(pageError !== undefined ? { pageError } : {}),
  };
}

/** The heads a row or a summary names: a whole list of head hashes, or none. */
function headsNamed(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.length > 0 && value.every((h) => typeof h === "string" && h !== "") ? (value as string[]) : undefined;
}

/** The observation hash of a carrier file as it stands now (body plus `.meta` pairing), or null where unreadable. */
function diskHashNow(file: string): string | null {
  try {
    const { text } = readCarrierText(file);
    const metaPath = file + ".meta";
    const meta = existsSync(metaPath) ? readFileSync(metaPath, "utf8") : undefined;
    return carrierHash(text, meta);
  } catch { return null; }
}

/** The rows an INGEST submission carries — NEW, CHANGED, and RENAMED. A `renamed`
 *  row rides as an ADD so the island pairs it with its gone source and
 *  re-links the records (change-id preserved); it returns `rename-target`, never a
 *  fresh re-land. */
export function candidatesOf(rows: readonly ScanRow[]): ScanRow[] {
  return rows.filter((r) => r.status === "new" || r.status === "changed" || r.status === "renamed");
}

/**
 * R2 — move the Synced observation for each rename the island CONFIRMED. Reads the
 * authoritative `deletions.renames` the island returned (never the CLI's own guess),
 * so a pair the island declined moves nothing. For each `fromUri → toUri`
 * it drops the source's base AT THE PATH THE FILE LEFT and records the moved carrier's hash at the
 * new location — so the NEXT scan reads the moved carrier `unchanged` and never
 * re-lands it. A base the source holds at another path (a holding copy that still stands) stays with
 * its file. Returns the count moved.
 */
export function applyConfirmedRenames(
  tree: SyncedTree,
  toBag: string,
  candidates: readonly ScanRow[],
  deletionSummary: Record<string, unknown> | undefined,
): number {
  const byUri = new Map(candidates.map((c) => [c.uri, c] as const));
  let moved = 0;
  for (const { fromUri, toUri } of renamesOf(deletionSummary)) {
    const arrived = byUri.get(toUri);
    if (arrived === undefined) continue;   // a rename we did not submit — leave it be
    const diskHash = arrived.diskHash;
    // The records re-homed whole, so the base's records side travels with them where the moved file
    // holds the bytes the source's base named.
    const held = tree.bases(syncedTreeKey(toBag, fromUri)).filter((b) => digestsEqual(b.disk, diskHash));
    const source = held[0];
    // A BASE LEAVES WITH ITS OWN FILE: the source gives up each base of these bytes whose file stands no more.
    for (const b of held) if (!existsSync(b.path)) tree.deleteAt(syncedTreeKey(toBag, fromUri), b.path);
    tree.set(syncedTreeKey(toBag, toUri), arrived.file, diskHash, source !== undefined ? source.records : diskHash);
    moved++;
  }
  return moved;
}

/** The vanished carriers in a scan — DELETED rows, as the watcher's ARMED set (§2.2): each one DID
 *  scan from a real on-disk `file`, so it carries the shape that can honestly re-stat itself later. */
export function deletionsOf(rows: readonly ScanRow[]): ArmedDeletion[] {
  return rows
    .filter((r) => r.status === "deleted" && r.syncedHash !== null)
    .map((r) => ({ uri: r.uri, syncedHash: r.syncedHash as string, file: r.file }));
}

export interface SubmitIngestOpts {
  readonly source:    string;
  readonly toBag:     string;
  readonly candidates: readonly ScanRow[];
  readonly did:       string;
  /** Omit for a fresh change-id; pass one to thread a known id. */
  readonly changeId?: string;
  /** Vanished carriers riding the same wave: the sources of renames the gesture paired by content, one
   *  vanished file to one arrived file. No gesture sends a deletion it did not pair. */
  readonly deletions?: readonly PendingDeletion[];
  /** The titles the source's kāpae shadow files name: the island raises a kāpae over each in `toBag`. */
  readonly kapae?: readonly string[];
  /**
   * Run the INGEST IN the active wiki island over ITS composite — the path
   * for `working` (the per-fingerprint write layer the daemon never reaches).
   * The daemon commands via `wiki-act` wrapping the INGEST; the default path
   * executes daemon-side (canon bags).
   */
  readonly inWiki?: boolean;
  /** With `inWiki`, the wiki the INGEST runs in by name (the `wiki-act` road's own `wiki`), never the active one. */
  readonly wiki?: string;
  /**
   * NO PERSON STANDS BEHIND THIS WAVE. The watcher sets it on every wave it settles by itself; `lares
   * ingest` and every other gesture a person names leave it absent. The island's gate then never adopts
   * a file that holds no base over records that say something else: it answers `conflict`, `no-base`.
   */
  readonly unattended?: boolean;
  /** THE FACE-NAMED WAVE (the lit set): the handle index of the open face whose own layer takes this wave. The island lands it
   *  only where its device table names that face as the target document's owner; it never falls back to the daemon mount. */
  readonly face?: number;
}

// ── the submit port ────────────────────────────────────────────────────────────────────────────────────────────

/** One wave's answer, as the settle reads it: the verb's outcome, its summary under `VERB_RESULT_KEY`. The CLI's verb socket
 *  answers this shape (`SubmitResult`), and so does the vessel's island submit. */
export interface IngestSubmitResult {
  readonly status:        "done" | "error";
  readonly results?:      Record<string, { readonly ok: boolean; readonly output?: Record<string, unknown>; readonly error?: string }>;
  readonly errorMessage?: string;
  readonly requestId:     string;
  readonly refusal?:      { readonly reason: string };
  readonly effectOf?:     string;
}

/** THE SUBMIT PORT: one INGEST wave out, its outcome back. The settle calls it once per wave it sends. */
export type IngestSubmit = (o: SubmitIngestOpts) => Promise<IngestSubmitResult>;

/** The summary a wave's outcome carries. */
function summaryOf(result: IngestSubmitResult): Record<string, unknown> | undefined {
  return result.results?.[VERB_RESULT_KEY]?.output;
}

/** The one override. A utf8 body reaches the cid/ tier only when the operator marks `_lar_cas = "yes"`
 *  in a `.meta` sidecar (`_lar_cas: yes`, TW5 field form) OR a per-ahu `toml meta`
 *  (`_lar_cas = "yes"`). The flag reads off text the gesture already holds — never a CAS
 *  resolve. Matches either `:` or `=`, with or without quotes. */
const CAS_FLAG_RE = /(?:^|\n)\s*_lar_cas\s*[:=]\s*"?yes"?/i;

/** Does a carrier opt IN to CAS externalization? Reads the `.meta` sidecar and the body meta
 *  (both in hand at scan time — a flag read is never a body resolve). */
export function carrierCasFlagged(text: string, meta?: string): boolean {
  return CAS_FLAG_RE.test(meta ?? "") || CAS_FLAG_RE.test(text);
}

/** The `type:` a `.meta` sidecar declares — the declaration the kind decision reads FIRST (a
 *  `.svg` declared `text/xml` inlines; a `.bin` declared `image/png` rides a pointer). Undefined
 *  when the sidecar is absent or names no type. */
export function declaredType(meta?: string): string | undefined {
  const m = /(?:^|\n)type\s*:\s*(\S+)/.exec(meta ?? "");
  return m?.[1];
}

/** A carrier body's disposition under THE BLOB LAW (the CLI's `stageBodyToCas` decides it and writes the CAS blob). */
export interface StagedCarrier {
  /** Content-address (hex sha256 of the staged bytes) — the CAS key + the verb handle. Valid only when `staged`. */
  readonly cid:    string;
  /** The staged bytes' length — the RAW byte length for a pointer-kind binary. */
  readonly size:   number;
  /** The daemon writes a POINTER: the kind rides as one, or the flag fired. */
  readonly skinny: boolean;
  /** A CAS blob was written — the verb rides `textCid`, not the inline body. */
  readonly staged: boolean;
}

/** How a wave stages each carrier's body. */
export type CarrierStage = (row: ScanRow) => StagedCarrier;

/** Every body rides inline. A caller that holds no CAS stager sends only the carriers `ridesInline` admits. */
export const inlineStage: CarrierStage = (row) => ({ cid: "", size: Buffer.byteLength(row.text, "utf8"), skinny: false, staged: false });

/** Whether a carrier rides INLINE under the blob law: no pointer kind, no `_lar_cas` flag, no body past the wall. */
export function ridesInline(row: ScanRow): boolean {
  if (carrierCasFlagged(row.text, row.meta)) return false;
  if (ridesAsPointer(declaredType(row.meta) ?? mediaTypeFromExt(row.ext, row.binary ?? false))) return false;
  return !isOversizedBody(Buffer.byteLength(row.text, "utf8"));
}

/**
 * THE INGEST VERB'S ARGS for one wave — hashes travel WITH the content; the island runs the full Confluence gate and answers
 * per-carrier decisions. THE BLOB LAW rides `stage`: a pointer-kind or flagged body staged to the CAS rides a skinny
 * `textCid`, a utf8 body under the wall rides INLINE `text`, an oversized un-flagged body stages for transport but rides no
 * `skinny`, so the island faults it (a verb rides a reference, never a body).
 */
export function ingestWaveArgs(opts: SubmitIngestOpts, stage: CarrierStage = inlineStage): Record<string, unknown> {
  const deletions = opts.deletions ?? [];
  return {
    "source-uri": resolve(opts.source),
    "to-bag":     opts.toBag,
    "change-id":  opts.changeId ?? newChangeId(),
    carriers: opts.candidates.map((r) => {
      const staged = stage(r);
      return {
        uri: r.uri, file: r.file, size: staged.size, diskHash: r.diskHash, syncedHash: r.syncedHash,
        ...(r.syncedRecordsHash !== undefined ? { syncedRecordsHash: r.syncedRecordsHash } : {}), ...(r.headBase === true ? { headBase: true } : {}), ext: r.ext,
        ...(staged.staged ? { textCid: staged.cid } : { text: r.text }),
        ...(staged.skinny ? { skinny: true } : {}),
        ...(r.meta !== undefined ? { meta: r.meta } : {}),
        ...(r.overrideBase !== undefined ? { overrideBase: r.overrideBase } : {}),
        ...(r.familyBases !== undefined ? { familyBases: r.familyBases } : {}),
      };
    }),
    ...(deletions.length > 0 ? { deletions: deletions.map((d) => ({ uri: d.uri, syncedHash: d.syncedHash })) } : {}),
    ...(opts.kapae !== undefined && opts.kapae.length > 0 ? { kapae: [...opts.kapae] } : {}),
    ...(opts.unattended === true ? { unattended: true } : {}),
    ...(opts.face !== undefined ? { face: opts.face } : {}),
  };
}

/** The verb and args one wave sends: INGEST daemon-side, or `wiki-act` wrapping it where the wave runs IN a wiki's island. */
export function ingestWaveVerb(opts: SubmitIngestOpts, stage: CarrierStage = inlineStage): { readonly verb: string; readonly args: Record<string, unknown> } {
  const actionArgs = ingestWaveArgs(opts, stage);
  return opts.inWiki
    ? { verb: "wiki-act", args: { verb: "INGEST", args: actionArgs, ...(opts.wiki !== undefined ? { wiki: opts.wiki } : {}) } }
    : { verb: "INGEST", args: actionArgs };
}

/** The vessel's own road to its daemon island: one verb placed, its output awaited (`askIslandVerb`), a refusal thrown. */
export type IslandVerbAsk = (verb: string, args: Record<string, unknown>, requestId: string) => Promise<Record<string, unknown>>;

/**
 * THE VESSEL'S SUBMIT PORT: each wave rides the daemon island's INGEST verb on the vessel's own channel, and its answer reads
 * as the settle's result: a done outcome carries the verb's summary, a refusal (or an ask its composition abandoned) reads as
 * an error in the island's own words.
 */
export function islandIngestSubmit(ask: IslandVerbAsk, stage: CarrierStage = inlineStage): IngestSubmit {
  return async (opts) => {
    const { verb, args } = ingestWaveVerb(opts, stage);
    const requestId = newRequestId();
    try {
      const output = await ask(verb, args, requestId);
      return { status: "done", requestId, results: { [VERB_RESULT_KEY]: { ok: true, output } } };
    } catch (e) {
      const reason = e instanceof IslandVerbRefused ? e.reason : null;
      return { status: "error", requestId, errorMessage: e instanceof Error ? e.message : String(e), ...(reason !== null ? { refusal: { reason } } : {}) };
    }
  };
}

// ── a watcher's vanished set ───────────────────────────────────────────────────────────────────────────────────

/**
 * Which vanished addresses ride THIS wave as a rename's source: PAIRED BY CONTENT, and by nothing else.
 * A vanished address pairs where exactly one vanished address holds its base hash, exactly one of the
 * wave's candidates holds that same hash, and that candidate ARRIVED (a file at an address that held no
 * base: `new`). A standing carrier a hand edited into the vanished one's bytes names no move, so it pairs
 * with nothing. Every other vanished address rides nowhere: no span of waiting turns a vanish into a
 * deletion.
 */
export function pairedDeletions(
  vanished:   ReadonlyMap<string, { readonly syncedHash: string; readonly file: string }>,
  candidates: ReadonlyArray<{ readonly diskHash: string; readonly status: string }>,
): ArmedDeletion[] {
  const gone = new Map<string, number>();
  for (const v of vanished.values()) gone.set(v.syncedHash, (gone.get(v.syncedHash) ?? 0) + 1);
  // Every candidate counts toward ambiguity (the island's delete gate reads them all); only an arrival pairs.
  const holding = new Map<string, { count: number; arrived: boolean }>();
  for (const c of candidates) {
    const h = holding.get(c.diskHash) ?? { count: 0, arrived: false };
    holding.set(c.diskHash, { count: h.count + 1, arrived: h.arrived || c.status === "new" });
  }
  const ride: ArmedDeletion[] = [];
  for (const [uri, v] of vanished) {
    const pair = holding.get(v.syncedHash);
    if (gone.get(v.syncedHash) === 1 && pair !== undefined && pair.count === 1 && pair.arrived) ride.push({ uri, syncedHash: v.syncedHash, file: v.file });
  }
  return ride;
}

// ── the lay: one mirror folder into its layer ──────────────────────────────────────────────────────────────────

/** One mirror folder laid into the one layer it mirrors. */
export interface MirrorWave {
  /** The folder the wave reads. */
  readonly source: string;
  /** The plane dir the uri derives against (`<projections>/realms/<realm pet name>/wikis` or `/bags`): the first segment under it
   *  names the holding slot and never enters the name. */
  readonly uriDir: string;
  readonly toBag: string;
  /** The wiki the INGEST runs in (a wiki's working layer other than the daemon's); absent: daemon-side. */
  readonly wiki?: string;
  /** Top-level dirs under the folder that carry no layer of their own (`recovery`, `temp`). */
  readonly skipTop: readonly string[];
  /** THE BASES A WORKING WAVE RESTORES (title -> the carrier identity of the canon record its copy forked from), read off each owning face's
   *  bases sidecar: the island stamps each on the record it lands (a carrier's root and each fragment of its family,
   *  `carriedBasesOf`), so a fork keeps its base across a re-founding. */
  readonly bases?: Readonly<Record<string, string>>;
  /** THE FACE-NAMED WAVE (the lit set): the open face, other than the mount, whose own layer takes this wave. The island
   *  lands it only where that face owns the document, never on the daemon mount. Absent: the daemon mount's layer. */
  readonly face?: number;
}

/** What a wave planned and landed. A preview plans alone. */
export interface MirrorLaid {
  /** The carriers the scan read new or moved against the synced base. */
  readonly planned: readonly string[];
  /** The titles the folder's kāpae shadows name. */
  readonly kapae: readonly string[];
  readonly landed: readonly string[];
  /** The kāpae the wave newly raised (one already standing reads nothing). */
  readonly kapaeRaised: readonly string[];
  readonly conflicts: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly refused: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly unanswered: readonly string[];
  /** NO SILENT SKIPS: each file the scan read no carrier from, with why (`ScanResult.skipped`). */
  readonly skipped: readonly ScanSkip[];
}

/** The two ports a live lay reaches the vessel by: the vessel's DID and the INGEST submit. */
export interface LayPorts {
  readonly did: () => Promise<string>;
  readonly submit: IngestSubmit;
}

/** A wave the island refused whole: one refused row per candidate and per kāpae title, each with the island's words. */
export function foldWaveRefusal(why: string, candidates: ReadonlyArray<{ readonly uri: string }>, kapae: readonly string[]): {
  readonly refused: Array<{ uri: string; why: string }>; readonly kapaeRefused: Array<{ uri: string; why: string }>;
} {
  return { refused: candidates.map((c) => ({ uri: c.uri, why })), kapaeRefused: kapae.map((t) => ({ uri: t, why })) };
}

const isStray = (rel: string): boolean => rel.includes(".lar-tmp-");

/** Every plain file under `dir` (posix rel paths, sorted), the top dirs `skipTop` names and every path `HOUSE_IGNORED` names left
 *  out; an absent dir reads empty. */
export function mirrorFiles(dir: string, skipTop: readonly string[] = []): string[] {
  const out: string[] = [];
  const visit = (abs: string, rel: string): void => {
    let names: string[];
    try { names = readdirSync(abs).sort(); } catch { return; }
    for (const name of names) {
      const a = join(abs, name), r = rel === "" ? name : `${rel}/${name}`;
      if (rel === "" && skipTop.includes(name)) continue;
      const st = lstatSync(a);
      if (st.isDirectory()) visit(a, r);
      else if (st.isFile() && !isStray(r) && houseIgnored(r) === null) out.push(r);
    }
  };
  visit(dir, "");
  return out;
}

/**
 * THE TITLE A WAVE'S FILE READS BACK UNDER, or why it reads none: the projector's siting run backward (`siteFileToTitle`) over
 * the wave's plane, the vessel's synced base first. A plain-title working tiddler (`My Notes.tid`, `Time_ dusk.tid` stating
 * `Time: dusk`) reads home under its own title, so a re-found's lay lands it beside the loci carriers instead of dropping it.
 * A personal layer's view state reads back only where a base stands at its path (`siteMirrorFile`).
 */
export function siteWaveFile(wave: Pick<MirrorWave, "uriDir" | "toBag">, file: string, tree: SyncedTree): FileSiting {
  return siteMirrorFile(wave.uriDir, file, tree, wave.toBag.endsWith("/personal"));
}

/**
 * Lay one folder through INGEST's three-way gate against the vessel's synced base: a carrier whose disk equals its base
 * takes no wave (the second lay lands nothing), a moved one lands, and one whose records moved too stands off. The wave
 * rides unattended, so a file that holds no base over records that say something else stands off rather than adopting.
 */
export async function liveLay(wave: MirrorWave, apply: boolean, ports: LayPorts): Promise<MirrorLaid> {
  const tree = openSyncedTree();
  const abs = mirrorFiles(wave.source, wave.skipTop).filter((r) => !r.endsWith(".meta")).map((r) => join(wave.source, ...r.split("/")));
  const scan = scanFiles(wave.source, abs, wave.toBag, tree, (_r, f) => { const s = siteWaveFile(wave, f, tree); return "why" in s ? s : s.title; });
  const bases = wave.bases ?? {};
  const candidates = candidatesOf(scan.rows).map((r) => ({ ...r, ...carriedBasesOf(r.uri, bases) }));
  const kapae = scan.shadows ?? [];
  const refused = [
    ...scan.rows.filter((r) => r.status === "non-nfc").map((r) => ({ uri: r.uri, why: "non-NFC bytes" })),
    ...(scan.refusedShadows ?? []).map((r) => ({ uri: r.file, why: r.refusal })),
  ];
  const read: MirrorLaid = { planned: candidates.map((c) => c.uri), kapae, landed: [], kapaeRaised: [], conflicts: [], refused, unanswered: [], skipped: scan.skipped };
  if (!apply || (candidates.length === 0 && kapae.length === 0)) return read;
  const settled = await settleIngest({
    source: wave.source, toBag: wave.toBag, candidates, did: await ports.did(), unattended: true,
    ...(wave.face !== undefined ? { face: wave.face } : {}),
    ...(wave.wiki !== undefined ? { inWiki: true, wiki: wave.wiki } : {}), ...(kapae.length > 0 ? { kapae } : {}),
  }, tree, ports.submit);
  if (settled.first.status === "error") {
    const folded = foldWaveRefusal(settled.first.errorMessage ?? "INGEST refused", candidates, kapae);
    return { ...read, refused: [...refused, ...folded.refused, ...folded.kapaeRefused] };
  }
  const k = (summaryOf(settled.first) as { kapae?: { raised?: unknown; refused?: unknown } } | undefined)?.kapae;
  return {
    ...read,
    landed: [...settled.landed],
    kapaeRaised: Array.isArray(k?.raised) ? k.raised.map(String) : [],
    conflicts: settled.conflicts.map((c) => ({ uri: c.uri, why: c.why })),
    refused: [...refused, ...settled.refused.map((c) => ({ uri: c.uri, why: c.why })),
      ...(Array.isArray(k?.refused) ? (k.refused as Array<Record<string, unknown>>).map((r) => ({ uri: String(r["uri"]), why: String(r["code"]) })) : [])],
    unanswered: [...settled.unanswered],
  };
}

// ── the vessel's ports over the worn face's pool ───────────────────────────────────────────────────────────────

/** The face planes whose waves land through a daemon layer, each in the bag the daemon island grants its mirror. */
export type PoolPlaneBags = { readonly wiki?: string; readonly canon?: string; readonly stage?: string };

export interface PoolIngestOptions {
  /** The worn face's root: `projections/faces/<pet name>/`. */
  readonly pool: string;
  /** The bag each plane's wave lands in, as the daemon island's mirrors grant it (`daemonDiskMirrors`): the working layer
   *  under `wikis/daemon/`, the face's daemon canon under `bags/daemon/`, the kahua stage under `bags/kahua/` (`FACE_PLANES`). A
   *  plane this map leaves out rides no wave. */
  readonly bags: PoolPlaneBags;
  /** The submit port (`islandIngestSubmit` in the vessel). */
  readonly submit: IngestSubmit;
  /** The disk shore's look (`shore` op `sense`): a stand-off, a vanish, a personal-layer file, a pointer body and a refused wave go there. */
  readonly sense: (uris?: readonly string[]) => Promise<unknown>;
  readonly did: string;
  /** The Synced tree each wave reads afresh; absent, the projection checkpoint's (`openSyncedTree`). */
  readonly tree?: () => SyncedTree;
  /** HEAD's words for a pool file with no synced base (`poolHeads(pool)` in the vessel): absent, no history stands in. */
  readonly heads?: BaseFromGit;
  readonly log?: (line: string) => void;
}

const POOL_WAVE_PLANES = ["wiki", "canon", "stage"] as const satisfies readonly FacePlane[];
type PoolWavePlane = typeof POOL_WAVE_PLANES[number];

/**
 * THE VESSEL'S WAVE OVER THE WORN FACE'S POOL: each settle's touched files land as UNATTENDED INGEST waves, one per granted
 * plane, through the submit port, so an edit made in the pool flows back into the house by itself. The island's gate decides
 * each carrier: a moved file lands and pins its base; a file that holds no base over records that say something else, and one
 * whose records moved too, stand off, and those go to the disk shore's look (`sense`), where the keyed alert rises and a person
 * settles each (`lares shore`; W4 merges a both-moved stand-off per slot). A vanished file tombstones nothing: it stays in the
 * vanished set (a later arrival of its bytes re-links it, paired by content), and the shore's whole look sees it pending. A
 * personal-layer file (a wiki island's overlay), a recovery draft, a plane no mirror grants and a body that rides a pointer (the vessel
 * stages no CAS blob) take the shore's look too.
 *
 * The catch-up reads every file of each granted plane through the same wave (the `liveLay` read of the whole pool), then asks
 * the shore's whole look. Waves and catch-ups run one at a time.
 */
/** One folder a pool's wave lands from: the bag it lands in, how a file there reads its title, and the wiki the wave runs in. */
interface WaveFolder {
  readonly dir: string;
  readonly bag: string;
  readonly site: (file: string, tree: SyncedTree) => FileSiting;
  /** The wiki whose island takes the wave (`wiki-act`); absent: the daemon island. */
  readonly wiki?: string;
  /** How the log names the folder. */
  readonly label: string;
}

/** What one folder's wave owes the shore, and whether a carrier newly vanished. */
type FolderWaveReading = { readonly sense: string[]; readonly vanishedNow: boolean };

/**
 * ONE FOLDER'S UNATTENDED WAVE (a face pool's plane, a workspace): the touched files and every vanished one re-statted, scanned
 * against the synced base, the clean carriers landed through the submit port, each stand-off, refusal, pointer body and vanish
 * owed to the shore. A vanished file tombstones nothing: it waits in `gone` until its bytes arrive elsewhere (paired by content).
 */
async function folderWave(
  folder: WaveFolder, gone: Map<string, { syncedHash: string; file: string }>, touched: readonly string[],
  o: { readonly submit: IngestSubmit; readonly did: string; readonly tree?: () => SyncedTree; readonly heads?: BaseFromGit; readonly log: (line: string) => void },
): Promise<FolderWaveReading> {
  const log = o.log;
  // Every wave re-stats each vanished file too: a lost event never leaves a returned file reading as gone.
  const files = new Set(touched);
  for (const v of gone.values()) files.add(v.file);
  const tree = o.tree?.() ?? openSyncedTree();
  const scan = scanFiles(folder.dir, [...files], folder.bag, tree, (_r, file) => titleOf(folder.site(file, tree)), o.heads);
  for (const line of skipLines(scan.skipped)) log(line);
  const sense: string[] = [];
  let vanishedNow = false;
  for (const r of scan.rows) if (r.status === "non-nfc") log(`refuses: ${r.file} holds text outside NFC; nothing lands`);
  for (const r of scan.rows) if (r.status !== "deleted" && gone.delete(r.uri)) sense.push(r.uri);
  for (const d of deletionsOf(scan.rows)) if (!gone.has(d.uri)) { gone.set(d.uri, { syncedHash: d.syncedHash, file: d.file }); vanishedNow = true; }
  const all = candidatesOf(scan.rows);
  const candidates = all.filter(ridesInline);
  for (const c of all) if (!ridesInline(c)) { log(`${c.file} rides a pointer to its bytes, which the vessel's wave stages none of: the shore weighs it`); sense.push(c.uri); }
  const ride = pairedDeletions(gone, candidates);
  if (candidates.length === 0 && ride.length === 0) return { sense, vanishedNow };
  const settled = await settleIngest({
    source: folder.dir, toBag: folder.bag, candidates, did: o.did, deletions: ride, unattended: true,
    ...(folder.wiki !== undefined ? { inWiki: true, wiki: folder.wiki } : {}),
  }, tree, o.submit);
  if (settled.first.status === "error") {
    log(`a wave over ${folder.label} refused (${settled.first.errorMessage ?? "the island named no reason"}): the shore weighs its ${candidates.length} carrier(s)`);
    sense.push(...candidates.map((c) => c.uri));
    return { sense, vanishedNow };
  }
  const relinked = renamedSources(settled.deletions);
  const absent = absentSources(settled.deletions);
  for (const d of ride) {
    if (relinked.has(d.uri)) gone.delete(d.uri);
    else if (absent.has(d.uri)) { gone.delete(d.uri); sense.push(d.uri); }
    else sense.push(d.uri);
  }
  applyConfirmedRenames(tree, folder.bag, candidates, settled.deletions);
  // A CARRIER THAT STOOD OFF GOES TO THE SHORE: the gate landed nothing for it, and the projector raises its keyed alert.
  for (const c of settled.conflicts) { sense.push(c.uri); log(`stands off: ${c.uri} (${c.why}); \`lares shore\` names it with its key`); }
  for (const r of settled.refused) log(`refuses: ${r.uri} (${r.why})`);
  for (const r of settled.derived) log(`derived: ${r.uri} (${r.why})`);
  for (const uri of settled.unanswered) { sense.push(uri); log(`unanswered: ${uri}; the shore weighs it`); }
  if (settled.pageError !== undefined) log(`a later wave failed (${settled.pageError.message}); ${settled.pageError.unread} carrier(s) stay unread until the next settle`);
  const landed = [...settled.landed];
  if (landed.length > 0) log(`lands ${landed.length} carrier(s) from ${folder.label} into ${folder.bag}: ${landed.join(", ")}`);
  return { sense, vanishedNow };
}

/** One wave or catch-up at a time over one pool. */
function serialChain(): <T>(work: () => Promise<T>) => Promise<T> {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => { const next = chain.then(work, work); chain = next.catch(() => {}); return next; };
}

export function poolIngestPorts(o: PoolIngestOptions): Pick<FacePoolPorts, "catchUp" | "wave"> {
  const log = o.log ?? (() => {});
  const vanished = new Map<PoolWavePlane, Map<string, { syncedHash: string; file: string }>>(POOL_WAVE_PLANES.map((p) => [p, new Map()]));
  const serial = serialChain();

  /** One plane's wave: what it owes the shore, and whether a carrier newly vanished. */
  const planeWave = (plane: PoolWavePlane, bag: string, touched: readonly string[]): Promise<FolderWaveReading> => folderWave(
    { dir: join(o.pool, FACE_PLANES[plane]), bag, site: (file, tree) => siteFaceFile(o.pool, file, tree), label: `${FACE_PLANES[plane]}/` },
    vanished.get(plane)!, touched, { submit: o.submit, did: o.did, ...(o.tree ? { tree: o.tree } : {}), ...(o.heads ? { heads: o.heads } : {}), log },
  );

  const waveOver = async (files: readonly string[], whole: boolean): Promise<void> => {
    const byPlane = new Map<PoolWavePlane, string[]>();
    const shoreTitles = new Set<string>();
    let look = whole;
    for (const file of files) {
      const rel = relative(o.pool, file).split(sep);
      const plane = facePlaneOf(rel.join("/"));
      const wave = plane !== null && (POOL_WAVE_PLANES as readonly FacePlane[]).includes(plane) ? plane as PoolWavePlane : null;
      const bag = wave !== null ? o.bags[wave] : undefined;
      if (wave !== null && bag !== undefined) { const list = byPlane.get(wave) ?? []; list.push(file); byPlane.set(wave, list); continue; }
      // No daemon layer takes this plane: the shore's look, as a title, or whole where the file left (it states no title).
      if (!existsSync(file)) { look = true; continue; }
      // A draft or temp file reads with its slug as part of its name, as it always read (the face root its plane dir).
      const sited: FileSiting = plane === null ? { why: "it rests under no plane of the face root" }
        : siteFileToTitle({ planeDir: plane === "recovery" || plane === "temp" ? o.pool : facePlaneSiteDir(o.pool, plane), ...(plane === "stage" ? { titlePaths: true } : {}) }, file);
      if ("title" in sited) shoreTitles.add(sited.title);
      else log(`a wave reads no carrier from ${rel.join("/")}: ${sited.why}`);
    }
    // A plane with a vanished carrier re-stats it at each wave, touched or not.
    for (const plane of POOL_WAVE_PLANES) if (o.bags[plane] !== undefined && vanished.get(plane)!.size > 0 && !byPlane.has(plane)) byPlane.set(plane, []);
    for (const [plane, list] of byPlane) {
      const r = await planeWave(plane, o.bags[plane]!, list);
      for (const uri of r.sense) shoreTitles.add(uri);
      if (r.vanishedNow) look = true;
    }
    if (look) await o.sense();
    else if (shoreTitles.size > 0) await o.sense([...shoreTitles]);
  };

  return {
    catchUp: () => serial(() => {
      const files: string[] = [];
      for (const plane of POOL_WAVE_PLANES) {
        if (o.bags[plane] === undefined) continue;
        const dir = join(o.pool, FACE_PLANES[plane]);
        for (const rel of mirrorFiles(dir, plane === "wiki" ? [TEMP_LAYER_DIR] : [])) if (!rel.endsWith(".meta")) files.push(join(dir, ...rel.split("/")));
      }
      return waveOver(files, true);
    }),
    wave: (files) => serial(() => waveOver(files, false)),
  };
}

// ── the vessel's ports over a named workspace ──────────────────────────────────────────────────────────────────

export interface WorkspaceIngestOptions {
  /** The workspace folder (`<root>/workspaces/<name>`): the shared wiki's workbench mirror rests at its top. */
  readonly workspace: string;
  /** The wiki whose workbench the workspace holds: its waves land in `wikis/<slug>/working`, run in that wiki's island. */
  readonly slug: string;
  /** The submit port: in the vessel, the wiki's own island (`wiki-act` carrying the INGEST). */
  readonly submit: IngestSubmit;
  /** A5: where the synced tree holds no base (after a re-found), the base read from the workspace's git HEAD (`poolHeads`). */
  readonly heads?: BaseFromGit;
  /** The wiki island's disk shore look (`shore` op `sense`): a stand-off, a vanish, a pointer body and a refused wave go there. */
  readonly sense: (uris?: readonly string[]) => Promise<unknown>;
  /** The worn face's actor: every wave lands under it, whichever face last wrote the shared copy. */
  readonly did: string;
  readonly tree?: () => SyncedTree;
  readonly log?: (line: string) => void;
}

/**
 * DOES THE FOLDER STAND AS THE LAST SYNC LEFT IT? The catch-up's question, answered from what the house already holds of the
 * mirror (the Synced tree's rows, and its `kapae/` shadow rows) and the files on disk, so no island wakes to ask it. A file
 * the tree holds no base for, or holds another hash for, is an add or an edit; a base whose file stands no more, or a shadow
 * row whose file stands no more or reads other bytes, is a removal or an edit. Any of these is a diff; none is no diff.
 * `skip` names the folder's own tooling, which no wave carries (`recovery/`, `temp/`).
 */
function folderDiffers(
  folder: WaveFolder, files: readonly string[], tree: SyncedTree, skip: (file: string) => boolean, heads: BaseFromGit | undefined,
): boolean {
  const root = resolve(folder.dir) + sep;
  const inside = (path: string): boolean => path.startsWith(root) && !skip(path);
  const scan = scanFiles(folder.dir, files, folder.bag, tree, (_r, file) => titleOf(folder.site(file, tree)), heads);
  if (scan.rows.some((r) => r.status !== "unchanged") || (scan.refusedShadows?.length ?? 0) > 0) return true;
  const shadowTree = tree.shadows();
  for (const file of files) {
    if (extname(file) !== KAPAE_EXT) continue;
    const title = titleOf(folder.site(file, tree));
    let text: string;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    if (typeof title !== "string" || shadowTree.baseAt(syncedTreeKey(folder.bag, title), file)?.disk !== carrierHash(text)) return true;
  }
  for (const row of tree.rows()) if (row.bagId === folder.bag && inside(row.base.path) && !existsSync(row.base.path)) return true;
  for (const row of shadowTree.rows()) if (row.bagId === folder.bag && inside(row.base.path) && !existsSync(row.base.path)) return true;
  return false;
}

/**
 * THE VESSEL'S WAVE OVER A NAMED WORKSPACE: a shared wiki's workbench mirror, one disk copy whichever face wears. Each settle's
 * touched files land as ONE unattended INGEST wave in the wiki's working layer (`wikis/<slug>/working`), run in that wiki's own
 * island (`inWiki`), under the worn face's actor; the island's gate decides each carrier as it does over a face pool's plane, and
 * a stand-off goes to that wiki's shore, where `lares shore take-disk` merges it per slot against the workspace's own git base.
 * A file reads its title by the projector's siting run backward over the workspace's parent (the workspace stands as the
 * holding folder, as `wikis/<slug>` does). The workspace's `recovery/` and `temp/` ride no wave.
 */
export function workspaceIngestPorts(o: WorkspaceIngestOptions): Pick<FacePoolPorts, "catchUp" | "wave"> {
  const log = o.log ?? (() => {});
  const gone = new Map<string, { syncedHash: string; file: string }>();
  const serial = serialChain();
  const folder: WaveFolder = {
    dir: o.workspace, bag: wikiSlotUri(o.slug, "working"), wiki: o.slug,
    site: (file, tree) => siteMirrorFile(dirname(o.workspace), file, tree, false), label: `the workspace of ${o.slug}`,
  };
  const skipped = (file: string): boolean => {
    const rel = relative(o.workspace, file).split(sep);
    return rel.length > 1 && WORKSPACE_SKIP.includes(rel[0]!);
  };
  const waveOver = async (files: readonly string[], whole: boolean): Promise<void> => {
    const touched = files.filter((f) => !skipped(f));
    if (touched.length === 0 && gone.size === 0 && !whole) return;
    // THE CATCH-UP WAKES ON A DIFF: a folder that stands as the last sync left it asks nothing of its wiki, so a cold wiki
    // stays cold (`wsSense` and the wave's submit both activate it).
    if (whole && gone.size === 0 && !folderDiffers(folder, touched, (o.tree?.() ?? openSyncedTree()), skipped, o.heads)) return;
    const r = await folderWave(folder, gone, touched, { submit: o.submit, did: o.did, ...(o.tree ? { tree: o.tree } : {}), ...(o.heads ? { heads: o.heads } : {}), log });
    if (whole || r.vanishedNow) await o.sense();
    else if (r.sense.length > 0) await o.sense([...new Set(r.sense)]);
  };
  return {
    catchUp: () => serial(() => waveOver(mirrorFiles(o.workspace, WORKSPACE_SKIP).filter((rel) => !rel.endsWith(".meta")).map((rel) => join(o.workspace, ...rel.split("/"))), true)),
    wave: (files) => serial(() => waveOver(files, false)),
  };
}
