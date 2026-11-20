/**
 * bundle-manifest — the house bundle a keep cuts and a restore imports: its shape, its hashes, and the one reader that proves a
 * bundle whole before any byte of it moves.
 *
 * `lares export` writes a bundle; `lares import` reads one. A bundle carries AUTHORED memory alone (the daemon mounts'
 * daemon-wiki working carriers and their kāpae shadows, their kahua stage, draft recovery files, consented temp
 * carriers, house-minted bags) and the RE-DECLARE list (each face's pet-name, declared Handle and chair label as plain
 * strings). It carries no key, no signature, no CRDT history and no face relation: a re-founding mints new keys, and the
 * import writes NEW changes under the new face's authority. Faces key by PET-NAME, and the bundle names each by a path key
 * alone (`f0`, `f1` …, in paths and on rows).
 *
 * THE ROSTER RIDES SEALED (cabal-realm.mem:189: no record crossing to another vessel ties one face to another, and a keep's
 * remote crosses). The re-declare list, the one file that names faces (pet-names, Handles, handle indexes, chair labels) and the
 * share rows (owners and seats by pet-name), rests SEALED TO THE KEEP PAIR's public half (`@lararium/mesh` keep-seat), so a cut
 * asks for no credential. The pair's secret half rides beside it in `keep-seat.json`, wrapped in a slot tree under the human's
 * own routes (a passphrase, a paper sheet): a restore opens a slot with what the human supplies, then the roster, and no key file
 * crosses by hand. The manifest's faces carry their path key alone and its rows name a face by that key. Whoever holds the bundle
 * without a route reads the content a person wrote, and no roster. {@link verifyBundle} proves the bundle whole with no route
 * (the vessel derives a keep's id from it); {@link openBundle} opens the roster with the keep secret, and the import reads that
 * opened view, where faces carry their pet-names and rows name a face by pet-name as before.
 *
 * Layout under the bundle root:
 *
 *   manifest.json                  this module's {@link BundleDiskManifest}
 *   re-declare.sealed              {@link BundleRedeclare}, sealed to the keep pair's public half
 *   keep-seat.json                 the keep pair: its public half and the slot tree its secret half opens from
 *   faces/<fk>/working/<interior>  the face's daemon-wiki working carriers and `.kapae` shadows, at their uri-path
 *   faces/<fk>/canon/<interior>    the face's daemon canon carriers (`bags/daemon-<F>`)
 *   faces/<fk>/drafts/<slug>/<path> the face's draft recovery files in each wiki (`faces/<pet name>/recovery/<slug>`)
 *   faces/<fk>/temp/<slug>/<path>  the face's consented temp carriers in each wiki (`daemon`: its daemon wiki's)
 *   faces/<fk>/personal/<slug>/<interior> the face's personal layer over a wiki (`faces/<pet name>/personal/<slug>`)
 *   faces/<fk>/kahua/<path>        the face's kahua stage carriers (the plaintext a person reads)
 *   faces/<fk>/kahua-heads.json    the stage's standing heads as the fold read them: what the import re-lifts
 *   bags/<slug>/<path>             a house-minted bag's carriers (a user wiki's own canon, `self`, among them)
 *   daemon/canon/<interior>        the daemon wiki's canon (`bags/daemon`), its authored records alone
 *   wikis/<slug>/working/<interior> another wiki's working carriers
 *
 * A KEEP leaves out what another holder already keeps: a workbench whose mirror rests inside the checkout (git holds it) travels
 * in no keep's files, and the manifest names it under `elsewhere` so the restore knows where it rests.
 *
 * Isomorphic by intent: every class names a capability (a vessel that holds a disk store, a session that wears a face),
 * never a host, so a browser vessel's OPFS projection reads into the same tree.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { canonicalJson, decodeKeepSeat, openFromKeep, sealToKeep, type KeepSeat } from "@lararium/mesh";

/** The schema a bundle names; an import refuses any other. */
export const BUNDLE_SCHEMA = "lar-house-bundle";
export const MANIFEST_FILE = "manifest.json";
/** The sealed re-declare list: the one file of a bundle that names faces, and it names them sealed to the keep pair alone. */
export const REDECLARE_FILE = "re-declare.sealed";
/** The keep pair the roster seals to: its public half and the slot tree its secret half opens from, nothing secret without a route. */
export const KEEP_SEAT_FILE = "keep-seat.json";
export const KAHUA_HEADS_FILE = "kahua-heads.json";

/** A row's layer: what it carries and how the import lands it. */
export type BundleLayer = "working" | "kapae" | "draft" | "temp" | "kahua-carrier" | "kahua-head" | "bag" | "daemon-canon" | "wiki-working" | "personal";
const BUNDLE_LAYERS: readonly BundleLayer[] = ["working", "kapae", "draft", "temp", "kahua-carrier", "kahua-head", "bag", "daemon-canon", "wiki-working", "personal"];

/** One file the bundle holds, with the bytes' sha-256: the tamper check reads every one. */
export interface BundleFile { readonly path: string; readonly sha256: string; readonly bytes: number }

/**
 * One logical row. `face` names a bundle face (null for a row no face wears): by its path key on disk, by its pet-name in the
 * opened view {@link openBundle} answers; `bag` names the bag the row
 * lands in; `title` names the record where the row derives one; `rowKey` names the stage revision a kahua head stood at;
 * `sha256` hashes the row's content (the file's bytes, or a kahua head's body); `path` names the file that holds it.
 */
export interface BundleRow {
  readonly face: string | null;
  readonly bag: string;
  readonly layer: BundleLayer;
  readonly title: string | null;
  readonly rowKey: string | null;
  readonly sha256: string;
  readonly path: string;
  /** A working row's override base: the carrier identity (`carrierHash`, `sha256:…`) of the canon record the copy forked from, read off the record's meta
   *  envelope at export (a base never projects to disk, so the bundle carries it beside the file). The import stamps it
   *  back, so canon's fresher-than-the-copy warning still reads after a round trip. Absent where the copy names none. */
  readonly overrideBase?: string;
  /** A working row's family bases: each fragment record of the copy (`<title>#…`) forked its own base, so canon may move a
   *  fragment while the root holds still; by fragment title, read off each record's meta envelope at export and stamped
   *  back at import. Absent where no fragment names one. */
  readonly familyBases?: Readonly<Record<string, string>>;
}

/** A bundle face as the manifest on disk names it: its path key alone. */
export interface BundleFaceKey { readonly key: string }
/** A bundle face in the opened view: its path key and the pet-name the sealed re-declare list carries for it. */
export interface BundleFace extends BundleFaceKey { readonly petname: string }

/**
 * One document a keep left to another holder, named by where it rests: a sourced wiki's workbench inside the checkout, which git
 * holds (`holder: "checkout"`, `path` relative to the checkout, never a host path). The bundle carries none of its files.
 */
export interface BundleElsewhere { readonly slug: string; readonly layer: "wiki-working"; readonly bag: string; readonly holder: "checkout"; readonly path: string }

/** What the bundle leaves behind, named: an export never drops a thing silently. */
export interface BundleOmission { readonly kind: string; readonly detail: string; readonly items?: readonly string[]; readonly count?: number }

export interface BundleManifest {
  readonly schema: typeof BUNDLE_SCHEMA;
  /** The sha-256 over the sorted file list: the same content names the same bundle, and the import journal keys by it. */
  readonly bundleId: string;
  readonly faces: readonly BundleFace[];
  readonly files: readonly BundleFile[];
  readonly rows: readonly BundleRow[];
  readonly counts: Readonly<Record<BundleLayer, number>>;
  /** The temp carriers' bytes, per temp bag. */
  readonly tempBytes: Readonly<Record<string, number>>;
  readonly omissions: readonly BundleOmission[];
  /** The acquired library's collections and each index carrier's sha-256. The originals survive in place and never travel. */
  readonly library?: ReadonlyArray<{ readonly collection: string; readonly indexSha256: string | null }>;
  /** What a KEEP left to another holder, by where it rests (absent on a plain export). */
  readonly elsewhere?: readonly BundleElsewhere[];
  /** The keep's signature over the bundle id and the sealed roster (Ed25519, hex): a restore checks it under the verify key the
   *  opened seat derives, so a roster nobody but the house sealed never restores. Outside the file list, like the manifest. */
  readonly keepSignature?: string;
}

/** The manifest as it rests in the bundle: faces by path key alone, rows naming a face by that key. */
export type BundleDiskManifest = Omit<BundleManifest, "faces"> & { readonly faces: readonly BundleFaceKey[] };

/** One face's re-declare row: the strings the operator chose, replayed as fresh acts under the new keys. */
export interface BundleRedeclareFace {
  readonly face: string;
  /** The index the face stood at when exported; the import names a face there only when no face carries the pet-name. */
  readonly handleIndex: number;
  readonly petname: string;
  readonly handle: string | null;
  readonly seat: boolean;
  readonly chair: string | null;
}
/**
 * One shared wiki's row set, as the vessel-private share config held it: who owns the wiki's workbench and who sits there, by
 * PET-NAME. A bundle counts as the operator's own private carry; these names label one human's faces locally, so a bundle handed to
 * another party carries that map to them (cabal-realm#/the-workbench: pet names stay local, and no DreamNet-published document joins a human's faces).
 */
export interface BundleShareEntry { readonly slug: string; readonly kind: "bag" | "wiki"; readonly read: string; readonly write: string; readonly owner?: string; readonly workspace?: string; readonly note?: string }
/**
 * The re-declare list. `wikis` names every user wiki the catalog held, by slug: a wiki stands as a catalog row before it holds a
 * page, so a wiki with no workbench row (nothing under `wikis/<slug>/working`) still carries, and the import mints it.
 */
export interface BundleRedeclare { readonly schema: typeof BUNDLE_SCHEMA; readonly faces: readonly BundleRedeclareFace[]; readonly shares?: readonly BundleShareEntry[]; readonly wikis?: readonly string[] }

/** One standing head of a face's kahua stage, as the fold read it: the import re-lifts it under the new grant. */
export interface BundleKahuaHead {
  readonly title: string;
  readonly cid: string;
  readonly text: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly taint: readonly string[];
  readonly sources: ReadonlyArray<{ readonly title: string; readonly revision: string }>;
}

export const sha256Hex = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

/** The id a file list names: the sha-256 over its sorted `path sha256` lines. */
export function bundleIdOf(files: readonly BundleFile[]): string {
  return sha256Hex([...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => `${f.path} ${f.sha256}\n`).join(""));
}

/** Zeroed counts, one per layer. */
export function zeroCounts(): Record<BundleLayer, number> {
  return Object.fromEntries(BUNDLE_LAYERS.map((l) => [l, 0])) as Record<BundleLayer, number>;
}

/** Why a relative path names no safe place inside a bundle, or null: no absolute path, no `..` or `.` segment, no empty
 *  segment, no backslash or NUL, and never the bundle's own manifest. */
export function unsafeRelPath(path: string): string | null {
  if (typeof path !== "string" || path.length === 0) return "an empty path";
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return "an absolute path";
  if (/[\\\0]/.test(path)) return "a backslash or NUL in the path";
  const segments = path.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return "an empty, `.` or `..` segment";
  if (path === MANIFEST_FILE) return "the manifest's own name";
  return null;
}

/** A refusal the bundle reader raises before anything moves. */
export class BundleVerifyRefused extends Error {
  override readonly name = "BundleVerifyRefused";
}

/** Every entry under `root` as a bundle-relative posix path, refusing a link or a special file by name. */
export function walkBundle(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string, rel: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name), r = rel === "" ? name : `${rel}/${name}`;
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) throw new BundleVerifyRefused(`bundle-link: ${r} stands as a link; a bundle holds plain files alone`);
      if (st.isDirectory()) visit(abs, r);
      else if (st.isFile()) out.push(r);
      else throw new BundleVerifyRefused(`bundle-special-file: ${r} stands as neither a file nor a directory`);
    }
  };
  visit(root, "");
  return out;
}

/** Read a bundle-relative path's bytes. */
export function bundleBytes(root: string, rel: string): Buffer {
  return readFileSync(join(root, ...rel.split("/")));
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const isHex = (x: unknown): x is string => isStr(x) && /^[0-9a-f]{64}$/.test(x);

/** A whole bundle, proved with no key: every byte hashed against the manifest, every path safe, every row accounted for. */
export interface SealedBundle {
  readonly root: string;
  readonly manifest: BundleDiskManifest;
  /** Each face's kahua heads, by face key. */
  readonly heads: ReadonlyMap<string, readonly BundleKahuaHead[]>;
}
/** A whole bundle with its roster opened under the keep key: faces carry pet-names, and rows name a face by pet-name. */
export interface VerifiedBundle {
  readonly root: string;
  readonly manifest: BundleManifest;
  readonly redeclare: BundleRedeclare;
  /** Each face's kahua heads, by face key. */
  readonly heads: ReadonlyMap<string, readonly BundleKahuaHead[]>;
}

function readHeads(root: string, path: string): BundleKahuaHead[] {
  let parsed: unknown;
  try { parsed = JSON.parse(bundleBytes(root, path).toString("utf8")); } catch { throw new BundleVerifyRefused(`bundle-heads-unreadable: ${path} holds no JSON`); }
  if (!Array.isArray(parsed)) throw new BundleVerifyRefused(`bundle-heads-shape: ${path} holds no list`);
  return parsed.map((h, i) => {
    if (!isObj(h) || !isStr(h.title) || h.title === "" || !isHex(h.cid) || !isStr(h.text) || !isObj(h.fields)
      || !Object.values(h.fields).every(isStr) || !Array.isArray(h.taint) || !h.taint.every(isStr)
      || !Array.isArray(h.sources) || !h.sources.every((s) => isObj(s) && isStr(s.title) && isStr(s.revision))) {
      throw new BundleVerifyRefused(`bundle-heads-shape: ${path} row ${i} holds no kahua head`);
    }
    return h as unknown as BundleKahuaHead;
  });
}

/**
 * THE ONE BUNDLE READER. Verifies the schema, every path (safe, unique, a plain file), the file set (nothing on disk the
 * manifest leaves out, nothing it names missing), every file's sha-256, the faces' keys, every row's file and face key,
 * and every kahua head's body digest. It needs no key: the sealed re-declare list proves whole by its hash alone, and
 * {@link openBundle} opens it. Throws {@link BundleVerifyRefused} naming the first fault; reads only.
 */
export function verifyBundle(root: string): SealedBundle {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(join(root, MANIFEST_FILE), "utf8")); }
  catch { throw new BundleVerifyRefused(`bundle-manifest-unreadable: ${join(root, MANIFEST_FILE)} holds no JSON manifest`); }
  if (!isObj(raw) || raw.schema !== BUNDLE_SCHEMA) throw new BundleVerifyRefused(`bundle-schema: the manifest names no ${BUNDLE_SCHEMA} schema`);
  if (!Array.isArray(raw.files) || !Array.isArray(raw.rows) || !Array.isArray(raw.faces) || !isHex(raw.bundleId)) {
    throw new BundleVerifyRefused("bundle-manifest-shape: the manifest names no files, rows, faces or bundle id");
  }
  const files = raw.files as unknown[];
  const seen = new Set<string>();
  for (const f of files) {
    if (!isObj(f) || !isStr(f.path) || !isHex(f.sha256) || typeof f.bytes !== "number") throw new BundleVerifyRefused("bundle-manifest-shape: a file row holds no path, sha256 or size");
    const unsafe = unsafeRelPath(f.path);
    if (unsafe !== null) throw new BundleVerifyRefused(`bundle-unsafe-path: ${JSON.stringify(f.path)} names ${unsafe}`);
    if (seen.has(f.path)) throw new BundleVerifyRefused(`bundle-duplicate-path: ${f.path} stands twice in the manifest`);
    seen.add(f.path);
  }
  const onDisk = walkBundle(root).filter((p) => p !== MANIFEST_FILE);
  for (const p of onDisk) if (!seen.has(p)) throw new BundleVerifyRefused(`bundle-unlisted-file: ${p} stands in the bundle and the manifest names it nowhere`);
  const present = new Set(onDisk);
  for (const f of files as BundleFile[]) {
    if (!present.has(f.path)) throw new BundleVerifyRefused(`bundle-missing-file: the manifest names ${f.path} and the bundle holds no such file`);
    const bytes = bundleBytes(root, f.path);
    if (bytes.length !== f.bytes || sha256Hex(bytes) !== f.sha256) throw new BundleVerifyRefused(`bundle-hash-mismatch: ${f.path} holds bytes the manifest never hashed`);
  }
  if (bundleIdOf(files as BundleFile[]) !== raw.bundleId) throw new BundleVerifyRefused("bundle-id-mismatch: the bundle id names another file list");
  if (!seen.has(REDECLARE_FILE)) throw new BundleVerifyRefused(`bundle-redeclare-missing: the manifest names no ${REDECLARE_FILE}; a bundle an older keep cut carried its roster in clear and restores no more: keep again, and restore from that keep`);

  // THE FACES BY PATH KEY ALONE: a face that names anything more (a pet-name) would carry the roster in clear.
  const faceKeys = new Set<string>();
  for (const f of raw.faces as unknown[]) {
    if (!isObj(f) || !isStr(f.key) || !/^f[0-9]+$/.test(f.key) || Object.keys(f).length !== 1) throw new BundleVerifyRefused("bundle-face-shape: a face names no path key, or names more than its key");
    if (faceKeys.has(f.key)) throw new BundleVerifyRefused(`bundle-face-duplicate: the face ${f.key} stands twice`);
    faceKeys.add(f.key);
  }

  if (raw.keepSignature !== undefined && (!isStr(raw.keepSignature) || !/^[0-9a-f]{128}$/.test(raw.keepSignature))) {
    throw new BundleVerifyRefused("bundle-keep-signature-shape: the manifest's keep signature reads no 64-byte signature in hex");
  }
  if (raw.elsewhere !== undefined && (!Array.isArray(raw.elsewhere) || (raw.elsewhere as unknown[]).some((e) => !isObj(e) || !isStr(e.slug) || e.layer !== "wiki-working"
    || !isStr(e.bag) || e.holder !== "checkout" || !isStr(e.path) || unsafeRelPath(e.path) !== null || (files as BundleFile[]).some((f) => f.path.startsWith(`wikis/${String(e.slug)}/working/`))))) {
    throw new BundleVerifyRefused("bundle-elsewhere-shape: the manifest's elsewhere names a holder, a place or a slug no keep spells, or a workbench the bundle still carries");
  }
  const fileSha = new Map((files as BundleFile[]).map((f) => [f.path, f.sha256] as const));
  const heads = new Map<string, BundleKahuaHead[]>();
  for (const key of faceKeys.keys()) {
    const path = `faces/${key}/${KAHUA_HEADS_FILE}`;
    if (fileSha.has(path)) heads.set(key, readHeads(root, path));
  }
  for (const row of raw.rows as unknown[]) {
    if (!isObj(row) || !isStr(row.path) || !isHex(row.sha256) || !BUNDLE_LAYERS.includes(row.layer as BundleLayer) || !isStr(row.bag)
      || !(row.face === null || (isStr(row.face) && faceKeys.has(row.face))) || !(row.title === null || isStr(row.title)) || !(row.rowKey === null || isStr(row.rowKey))) {
      throw new BundleVerifyRefused("bundle-row-shape: a row names no layer, bag, face, path or hash the manifest holds");
    }
    if (!fileSha.has(row.path)) throw new BundleVerifyRefused(`bundle-row-file: a row names ${row.path} and the manifest lists no such file`);
    if (row.overrideBase !== undefined && (!isStr(row.overrideBase) || !/^sha256:[0-9a-f]{64}$/.test(row.overrideBase) || (row.layer !== "working" && row.layer !== "wiki-working"))) {
      throw new BundleVerifyRefused(`bundle-row-override-base: the row at ${row.path} names an override base no sha256 hash spells, or one off a working row`);
    }
    if (row.familyBases !== undefined && (!isObj(row.familyBases) || !isStr(row.title) || (row.layer !== "working" && row.layer !== "wiki-working")
      || Object.entries(row.familyBases).some(([t, b]) => !t.startsWith(`${String(row.title)}#`) || !isStr(b) || !/^sha256:[0-9a-f]{64}$/.test(b)))) {
      throw new BundleVerifyRefused(`bundle-row-family-bases: the row at ${row.path} names family bases off its own carrier's family, no sha256 hash, or off a working row`);
    }
    if (row.layer === "kahua-head") {
      const head = isStr(row.face) ? heads.get(row.face)?.find((h) => h.cid === row.rowKey && h.title === row.title) : undefined;
      if (head === undefined || sha256Hex(head.text) !== row.sha256) throw new BundleVerifyRefused(`bundle-head-mismatch: the kahua head ${String(row.title)} names a body its heads file never holds`);
    } else if (fileSha.get(row.path) !== row.sha256) {
      throw new BundleVerifyRefused(`bundle-row-hash: the row at ${row.path} names a hash its file never carried`);
    }
  }
  return { root, manifest: raw as unknown as BundleDiskManifest, heads };
}

// ── the keep seal ────────────────────────────────────────────────────────────────────────────────────────────────

/** The re-declare list's plaintext bytes: what the seal covers, and what a house compares to tell an unmoved roster. */
export function redeclareBytes(redeclare: BundleRedeclare): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(redeclare, null, 2)}\n`);
}

/**
 * Seal the re-declare list to the keep pair's PUBLIC half: no credential at the cut, so a keep that runs where nobody stands still
 * seals. Each seal draws a fresh ephemeral and nonce; the house that wants an unmoved roster to cut the same bytes keeps its last
 * seal beside the seat and hands it back (`keep-seat.ts`, lares-cli).
 */
export function sealRedeclare(publicKey: Uint8Array, redeclare: BundleRedeclare): Buffer {
  if (publicKey.length !== 32) throw new BundleVerifyRefused("bundle-keep-seat-shape: the keep pair's public half rides no 32 bytes");
  return Buffer.from(sealToKeep(publicKey, redeclareBytes(redeclare), REDECLARE_FILE));
}

/**
 * The digest a keep cut signs over its manifest: sha-256 of the manifest's canonical JSON (sorted keys) with `keepSignature` left
 * out, so the cut signs every field the manifest holds and a restore re-derives the same bytes from the file it reads.
 */
export function keepManifestDigest(manifest: Readonly<Record<string, unknown>>): Uint8Array {
  const { keepSignature: _unsigned, ...rest } = manifest as Record<string, unknown>;
  return createHash("sha256").update(canonicalJson(rest)).digest();
}

/**
 * The keep pair a bundle carries. A bundle that carries none, or one that reads no pair, refuses `bundle-keep-seat-shape`.
 */
export function readBundleSeat(bundle: SealedBundle): KeepSeat {
  if (!bundle.manifest.files.some((f) => f.path === KEEP_SEAT_FILE)) {
    throw new BundleVerifyRefused(`bundle-keep-seat-shape: the bundle carries no ${KEEP_SEAT_FILE}, so nothing opens its roster`);
  }
  const read = decodeKeepSeat(bundleBytes(bundle.root, KEEP_SEAT_FILE).toString("utf8"));
  if (read.reading !== "readable") throw new BundleVerifyRefused(`bundle-keep-seat-shape: ${KEEP_SEAT_FILE} reads no keep pair (${read.why})`);
  return read.seat;
}

/**
 * Open a whole bundle's roster under the keep secret: the sealed re-declare list (whole by the manifest entry {@link verifyBundle}
 * hashed), its shape, and its agreement with the manifest's face keys. Answers the opened view: faces carry their pet-names and rows
 * name a face by pet-name. A secret that opens nothing refuses by name, before anything moves.
 */
export function openBundle(bundle: SealedBundle, secret: Uint8Array): VerifiedBundle {
  const opened = openFromKeep(secret, bundleBytes(bundle.root, REDECLARE_FILE), REDECLARE_FILE);
  if (opened === null) throw new BundleVerifyRefused("bundle-redeclare-sealed: the re-declare list opens under no keep secret in hand; open the keep seat the bundle carries with its passphrase or paper sheet");
  let redeclareRaw: unknown;
  try { redeclareRaw = JSON.parse(new TextDecoder().decode(opened)); } catch { throw new BundleVerifyRefused(`bundle-redeclare-unreadable: ${REDECLARE_FILE} opens to no JSON`); }
  return rosterView(bundle, redeclareRaw);
}

/**
 * The opened view of a bundle under its roster: the roster's shape, its agreement with the manifest's face keys, and the manifest
 * with faces carrying their pet-names and rows naming a face by pet-name. The cut reads its own roster through here, since it
 * sealed to a public half and holds no secret to open it again.
 */
export function rosterView(bundle: SealedBundle, redeclareRaw: unknown): VerifiedBundle {
  if (!isObj(redeclareRaw) || redeclareRaw.schema !== BUNDLE_SCHEMA || !Array.isArray(redeclareRaw.faces)) throw new BundleVerifyRefused("bundle-redeclare-shape: the re-declare list names no faces");
  const keys = new Set(bundle.manifest.faces.map((f) => f.key));
  const petOf = new Map<string, string>();
  for (const r of redeclareRaw.faces as unknown[]) {
    if (!isObj(r) || !isStr(r.face) || !keys.has(r.face) || petOf.has(r.face) || !isStr(r.petname) || r.petname.trim() === "" || !Number.isSafeInteger(r.handleIndex) || (r.handleIndex as number) < 0
      || !(r.handle === null || isStr(r.handle)) || typeof r.seat !== "boolean" || !(r.chair === null || isStr(r.chair))) {
      throw new BundleVerifyRefused("bundle-redeclare-shape: a re-declare row disagrees with the manifest's faces");
    }
    if ([...petOf.values()].includes(r.petname)) throw new BundleVerifyRefused(`bundle-face-duplicate: the face "${r.petname}" stands twice`);
    petOf.set(r.face, r.petname);
  }
  if (petOf.size !== keys.size) throw new BundleVerifyRefused("bundle-redeclare-shape: the re-declare list and the manifest name different faces");
  if (redeclareRaw.wikis !== undefined && (!Array.isArray(redeclareRaw.wikis) || (redeclareRaw.wikis as unknown[]).some((w) => !isStr(w) || !/^[a-z0-9][a-z0-9-]*$/.test(w)))) {
    throw new BundleVerifyRefused("bundle-redeclare-shape: the re-declare list's wikis name something no wiki slug spells");
  }
  const manifest: BundleManifest = {
    ...bundle.manifest,
    faces: bundle.manifest.faces.map((f) => ({ key: f.key, petname: petOf.get(f.key)! })),
    rows: bundle.manifest.rows.map((r) => (r.face === null ? r : { ...r, face: petOf.get(r.face)! })),
  };
  return { root: bundle.root, manifest, redeclare: redeclareRaw as unknown as BundleRedeclare, heads: bundle.heads };
}

/** A path under `base`, in posix form, or null where it stands outside. */
export function relUnder(base: string, abs: string): string | null {
  const b = base.endsWith(sep) ? base : base + sep;
  return abs.startsWith(b) ? abs.slice(b.length).split(sep).join(posix.sep) : null;
}
