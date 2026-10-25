/**
 * vault-carriers — THE ONE CARRIER TABLE. Every carrier a vessel keeps at rest names its home, its custody
 * class, its secret kind and its writer in exactly one row here.
 *
 * ── SIX CUSTODY CLASSES ─────────────────────────────────────────────────────────────────────────
 *   `floor`       — outside the vessel KEK (VK): the floor key, its own log, the slot tree that wraps the VK, and
 *                   the serving tree that wraps the serving key (SK). The floor signs and unlocks before any VK
 *                   opens, so nothing here may need one.
 *   `floor-plain` — plain bytes the floor reads (the gate, the arrival page, the raise door), bytes public by
 *                   construction, or bytes sealed under a key the VK never wraps (the sealed store's rests).
 *                   Sealing them would lock the floor out of its own door, or wrap what a blind carrier holds.
 *   `serving`     — sealed under SK, which the VK's entry in the serving tree wraps (ember#/the-serving-key). It
 *                   holds the serving rows and nothing beside them; no VK rotation re-seals one. No serving row
 *                   stands yet: the rows move under SK with the ember's serving tier.
 *   `hot`         — sealed under the VK, opened once at unlock and held for the process life.
 *   `cold`        — sealed under the VK, opened for one act and then dropped.
 *   `outbox`      — sealed under the outbox key, which the VK wraps in its own hot row (`outbox-key`); an unlock hands
 *                   that key to the daemon island, which seals and opens the parcels for the life of the unlock. The
 *                   bytes frame as the outbox seal and never as the VK's, so no VK rotation re-seals one: it re-seals
 *                   the outbox key's row alone (custody#/the-table, the outbox).
 *   `face-hot`    — a D row sealed under ONE face's custody key (FCK) and resting in that face's own directory
 *                   (`faces/<fcid>/`). Opened once when its face unlocks, held while the face stays unlocked.
 *   `face-cold`   — as `face-hot`, opened for one act and then dropped.
 * A private file the floor never reads rides `hot`: sealing costs it nothing and closes the social graph
 * at rest (petnames, the handle book, the anchors).
 *
 * ── ROWS SPAN HOMES, NOT ONE DIRECTORY ──────────────────────────────────────────────────────────
 * A row names its home (`identity` · `storage` · `seal`), the subtree it lives under, and a matcher over the
 * path relative to that home. The storage directory's `hosting/`, `walk/` and `gate-memory/` subtrees and the seal home's
 * charters, consents and admits stand here beside the identity home's keys, so the census sees what a
 * stolen disk would. The census walks only the subtrees some row names: the Automerge store's own chunks
 * never enter it.
 *
 * ── ONE TABLE, EVERY READER DERIVES ─────────────────────────────────────────────────────────────
 * The custody status (`custody-session`), the VK rotation, the backup bundle's cut and the custody shape reader
 * (`custody-shape`) all read these rows. A second list of filenames anywhere else would drift from this one,
 * and the drift costs in both directions: a carrier a sweep omits stays unsealed while the sweep reports
 * success; a carrier a sweep invents gets written over by an act nobody owns.
 *
 * ── A ROW OUTSIDE THE VESSEL KEY NAMES ITS LAW ──────────────────────────────────────────────────
 * Every `floor` and `floor-plain` row states, in its `bare` column, why its bytes rest outside the VK. A serving,
 * hot, cold or outbox row states none: such a file that reads bare reads as a fault.
 *
 * ── THE CENSUS NAMES WHAT STANDS OUTSIDE THE TABLE ──────────────────────────────────────────────
 * `outsideTheTable` walks the three homes whole and names each file there that reads private and matches no row:
 * an owner-only file, a file under the VK's seal, a sidecar a writer left. `vault status` prints the list and the
 * custody census witness refuses a vessel that holds one. Its reach ends at the three homes, and its mode sign
 * reads what a writer chose: under a umask that strips group and other from every file it names files no writer
 * marked, so it errs toward naming more and never less.
 *
 * ── A FILE SPELLED LIKE A ROW ANSWERS TO THAT ROW'S LAW ─────────────────────────────────────────
 * A row never excuses the file it matched. A hot or cold file that reads anything but sealed reads as a fault; a
 * floor or floor-plain file under the VK's seal reads as a fault, since no rotation re-seals it; and a row whose
 * law reads off the bytes (`holds`) faults a file that fails it. A row with no such check (a note, a chunk, a
 * card, a charter, a consent, an admit pin) takes any bytes under its exact spelling: the census reads the
 * vessel's own writers, and catches no secret a hand plants under one of those spellings.
 *
 * ── THE DISK IS THE SOURCE ──────────────────────────────────────────────────────────────────────
 * A carrier is a FILE THAT EXISTS. No writer keeps a roster of its own carriers, and a roster read back
 * torn names nothing, so the census reads the directory. A stray file spelled like a row becomes that row;
 * that errs toward governing too much, which refuses a write, never toward governing too little, which
 * destroys a share.
 *
 * Where a writer exports its own path function, the row spells its filename through it, so a writer that
 * moves takes the row with it. Login-keyed identity filenames carry an optional `-<login>` segment.
 *
 * ── THE VK ROTATION READS THESE ROWS ────────────────────────────────────────────────────────────
 * Every `hot` and `cold` carrier standing is a VK-sealed carrier (`vkSealedCarriers`), named by its home and
 * its file, and `rotateVesselVk` hands exactly that list to the sealed writer's rotation. No caller picks the
 * carriers a rotation re-seals; the writer then checks the list against every file the homes hold, so a
 * VK-sealed file no row names refuses the rotation rather than staying behind under a retired VK.
 */

import { closeSync, openSync, readdirSync, readSync, statSync, type Dirent } from "node:fs";
import { basename, join } from "node:path";
import {
  REST_KINDS, ROTATING_SUFFIX, SEALING_SUFFIX, VK_SEAL_MIN_LENGTH,
  readCarriedRecord, readIndexRow, readLockboxRecord, readsAsOutboxSeal, readVkCarrier, restNameHolds, rotateVk,
  type CustodyIo, type KeyClass, type SealedCarrier, type SlotSpec, type SlotTree, type VesselKey,
} from "@lararium/mesh";
import { custodyRootPath } from "./custody-root.js";
import { archivePath, VEIL_ARCHIVE_FILE } from "./identity-anchors.js";
import { FACE_ATOM_GROUP_FILE, FACE_ATOM_ASK_FILE } from "./face-atom-store.js";
import { FACES_DIR, FACE_INDEX_FILE } from "./face-index.js";
import { FACE_ANCHOR_GROUP_FILE } from "./face-anchor-store.js";
import { OUTBOX_KEY_FILE } from "./outbox-key.js";
import { larDataDir, larIdentityDir, larSealHome } from "./vessel-paths.js";

/** The custody classes, closed. */
export const CUSTODY_CLASSES = ["floor", "floor-plain", "serving", "hot", "cold", "outbox", "face-hot", "face-cold"] as const;
export type CustodyClass = (typeof CUSTODY_CLASSES)[number];

/** The homes a row may name. */
export type CustodyHome = "identity" | "storage" | "seal";

/** The three home directories one vessel's carriers rest in. */
export interface CustodyHomes {
  readonly identity: string;
  readonly storage:  string;
  readonly seal:     string;
}

/** The slot tree's path: the one file outside the VK that wraps it. */
export function vkSlotsPath(identityDir: string = larIdentityDir()): string {
  return join(identityDir, "vk-slots.bin");
}

/** The serving tree's path: the one file outside every key that wraps SK (ember#/the-serving-key). */
export function skSlotsPath(identityDir: string = larIdentityDir()): string {
  return join(identityDir, "sk-slots.bin");
}

/**
 * The suffix of the serving tree a VK rotation re-wraps: it lands beside `sk-slots.bin` before the rotation commits,
 * and the next opening of SK settles it (`openServingTree`). Its own suffix: the VK rotation's settle sweeps every
 * `.vk-rotating` file, and this one must outlive that sweep.
 */
export const SK_REWRAP_SUFFIX = ".sk-rewrap";

/** The homes the running vessel's own resolvers name. */
export function vesselCustodyHomes(): CustodyHomes {
  return { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
}

/** Whose a carrier is: a handle index, a group digest, or the vessel. */
export type CarrierFace = number | "vessel" | `group:${string}` | `fcid:${string}`;

/** How a face row names the face it belongs to, read off the row's own file name: by group digest, founding-ask digest or ordinal. */
export type FaceSelector = { readonly group: string } | { readonly ask: string } | { readonly ordinal: number } | null;

/** The part of a face row the holder resolves a logical `(home, file)` by: the file's own spelling inside the face's directory. */
export interface FaceRowAddress {
  /** Matched against the file name inside `faces/<fcid>/` (what callers pass as `file`). */
  readonly inner:  RegExp;
  /** Which face the matched file names; `null` marks a row only the holder addresses, by the directory it already stands in. */
  readonly select: (m: RegExpExecArray) => FaceSelector;
}

/**
 * How a face's backup bundle treats a row (custody#/the-table): `whole`, the row rides as it rests; `lines`, the
 * one face's own lines ride and nothing of another face; `stays`, the row never leaves its vessel.
 */
export const BUNDLE_TREATMENTS = ["whole", "lines", "stays"] as const;
export type BundleTreatment = (typeof BUNDLE_TREATMENTS)[number];

/** The K15 custody classes a row sorts into: D dissolves into per-face rows sealed under that face's FCK, F is public by design, S is a named node-only secret. */
export const CUSTODY_PARTS = ["D", "F", "S"] as const;
export type CustodyPart = (typeof CUSTODY_PARTS)[number];

/**
 * Where a row goes under K15 (`docs/pono/k15-custody-step-zero`). `classes` holds the row's one class or the parts of
 * its named split, in the spec's order. `lead` marks a target whose payload, selector or owner the spec has not
 * proved, so no bytes move for it. `joint` names the spec's open joint the row waits on, else null. The column
 * moves no bytes and no reader consults it.
 */
export interface CustodyTarget {
  readonly classes: readonly CustodyPart[];
  readonly lead:    boolean;
  readonly joint:   string | null;
}

const LEAD = true;
const tgt = (classes: readonly CustodyPart[], lead = false, joint: string | null = null): CustodyTarget =>
  Object.freeze({ classes: Object.freeze([...classes]), lead, joint });

/** One row of the table. */
export interface CarrierRow {
  /** The row's own name; unique across the table. */
  readonly row:      string;
  readonly home:     CustodyHome;
  /** The subtree under the home this row lives in; `""` names the home's top level, read flat. */
  readonly under:    string;
  /** Matched against the path relative to the home, with `/` separators. */
  readonly match:    RegExp;
  readonly custody:  CustodyClass;
  /** The secret kind, when the row carries a key; null when it carries none. */
  readonly keyClass: KeyClass | null;
  /** The act or module that writes this carrier. */
  readonly writer:   string;
  /** The census entry's name for one match. */
  readonly name:     (m: RegExpExecArray) => string;
  /**
   * Why this row rests outside every key, by law: one sentence on every `floor` and `floor-plain` row, and null on
   * every `serving`, `hot` and `cold` row. A reader prints it beside a row that reads bare.
   */
  readonly bare:     string | null;
  /**
   * Whether a file this row matched holds the row's law, where the row can read it off the bytes (a name that
   * commits to them, a value that reads as its kind); null where it cannot. A file that fails it took a row's
   * spelling and none of its law, and reads as a fault.
   */
  readonly holds:    ((file: string, bytes: Uint8Array) => boolean) | null;
  /**
   * Whose this match is. A file that names one face answers its handle index or group digest;
   * every other row answers `"vessel"`. A bundle of one face's custody derives from this column.
   */
  readonly face:     (m: RegExpExecArray) => CarrierFace;
  /** Present on a `face-hot` or `face-cold` row: how a logical file name resolves to its face's directory. */
  readonly faceRow?: FaceRowAddress;
  /**
   * How a face's backup bundle treats this row. A row that names none `stays`. The bundle's cut and the restore's
   * check both derive from this column (`bundleRows`), so no hand picks the rows a bundle carries.
   */
  readonly bundle:   BundleTreatment;
  /** The K15 target class of this row. Required: a new row cannot land without one. */
  readonly target:   CustodyTarget;
}

/** One carrier standing on disk, named by the row it matched. */
export interface CarrierEntry {
  readonly row:       string;
  readonly name:      string;
  readonly home:      CustodyHome;
  /** The path relative to its home, `/`-separated. */
  readonly file:      string;
  readonly path:      string;
  readonly custody:   CustodyClass;
  readonly keyClass:  KeyClass | null;
  /** The row's law for resting outside the vessel key; null on a hot or cold row. */
  readonly bare:      string | null;
  /** The row's own check that a file holds the bytes its name commits to; null where the row names none. */
  readonly holds:     ((file: string, bytes: Uint8Array) => boolean) | null;
  readonly face:      CarrierFace;
}

/** The device-share filename law, read back: the family's spelling in `recovery-share-store` (`deviceShareFile`). */
export const DEVICE_SHARE_FILE = /^recovery-device-share-h(\d+)\.bin$/;

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A filename the writer's own path function spells. */
const exact = (path: string): RegExp => new RegExp(`^${escape(basename(path))}$`);
/** A login-keyed identity filename: `.<stem>.json` or `.<stem>-<login>.json`. */
const loginKeyed = (stem: string): RegExp => new RegExp(`^\\.${escape(stem)}(?:-[^./]+)?\\.json$`);
/** A face's own login-keyed row: `.<stem>[-login]-h<N>.json`, the handle index in the first capture. */
const faceLoginKeyed = (stem: string): RegExp => new RegExp(`^\\.${escape(stem)}(?:-[^./]+?)?-h(0|[1-9]\\d*)\\.json$`);
/** A plain filename. */
const file = (name: string): RegExp => new RegExp(`^${escape(name)}$`);
/** A hosting directory: `hosting/<the 32-hex digest of a Nexus AID>/`. */
const HOSTING = "hosting/[0-9a-f]{32}/";

/**
 * A row as its line of the table spells it. The custody class decides the `bare` column at the type: a row
 * outside the vessel key states its law, and a row under it states none.
 */
type RowSpec = Omit<CarrierRow, "name" | "face" | "bundle" | "bare" | "custody" | "holds" | "faceRow"> & Partial<Pick<CarrierRow, "name" | "face" | "bundle" | "holds" | "faceRow">>
  & ({ readonly custody: "floor" | "floor-plain"; readonly bare: string } | { readonly custody: "serving" | "hot" | "cold" | "outbox" | "face-hot" | "face-cold" });

/** A row of the identity home's top level: the same line with its home and subtree left to the helper. */
type IdentityRowSpec = RowSpec extends infer R ? (R extends unknown ? Omit<R, "home" | "under"> : never) : never;

function row(spec: RowSpec): CarrierRow {
  return Object.freeze({ name: () => spec.row, face: () => "vessel" as const, bundle: "stays" as const, bare: null, holds: null, ...spec });
}

/** The rest kinds a carrier may hold: every kind but the vessel's own notes and its outbox (`sealed-store-rest`). */
const REST_CARRIED = REST_KINDS.filter((kind) => kind !== "own" && kind !== "outbox");
/** A rest name as its own rule spells it (`isRestName`): lower-case letters, digits, dots and dashes, no leading dot. */
const REST_NAME = "[0-9a-z][0-9a-z.-]{0,254}";
/**
 * A rest file holds its row's law: the digest at the end of its name commits to its bytes, and the bytes read whole
 * as the kind its shelf names (a lockbox, a record of that kind, an index row, an outbox seal). Bytes of any other
 * shape under a rest's spelling, a clear key or a clear parcel named by its own digest among them, fail it.
 */
const restFileHolds = (file: string, bytes: Uint8Array): boolean => {
  const [, kind, name] = file.split("/");
  if (kind === undefined || name === undefined || !restNameHolds(name, bytes)) return false;
  if (kind === "lockbox") return readLockboxRecord(bytes) !== null;
  if (kind === "index") return readIndexRow(bytes) !== null;
  if (kind === "outbox") return readsAsOutboxSeal(bytes);
  return readCarriedRecord(bytes)?.kind === kind;
};

/** The restore's commit row: what one restore still owes this vessel (`face-bundle-restore`). */
/** A restore's commit row rests in its TARGET face, named by the handle index it lands at. */
export const RESTORE_PENDING_FILE = /^\.restore-pending-h(0|[1-9]\d*)\.json$/;
export const restorePendingFile = (target: number): string => `.restore-pending-h${target}.json`;

/** The face a per-face filename names: its first capture, a handle-index. */
const faceOf = (m: RegExpExecArray): CarrierFace => Number(m[1]);

/**
 * A D row: sealed under its face's custody key and resting in `faces/<fcid>/<file>`. `inner` spells the file as callers name it;
 * the row's census match spells the whole path under the identity home. `select` names the face the file belongs to.
 */
function faceRowOf(spec: {
  readonly row: string; readonly inner: RegExp; readonly select: FaceRowAddress["select"]; readonly custody: "face-hot" | "face-cold";
  readonly keyClass: KeyClass | null; readonly writer: string; readonly target: CustodyTarget; readonly bundle?: BundleTreatment;
  readonly name: (m: RegExpExecArray) => string; readonly face?: (m: RegExpExecArray) => CarrierFace;
}): CarrierRow {
  const body = spec.inner.source.replace(/^\^/, "").replace(/\$$/, "");
  const match = new RegExp(`^${FACES_DIR}/([0-9a-f]{32})/(${body})$`);
  /** The census match, re-read as the inner file's own match: the captures after the directory and the file. */
  const innerOf = (m: RegExpExecArray): RegExpExecArray => {
    const view = [m[2]!, ...m.slice(3)] as unknown as RegExpExecArray;
    view.index = 0; view.input = m[2]!;
    return view;
  };
  return row({
    row: spec.row, home: "identity", under: FACES_DIR, match, custody: spec.custody, keyClass: spec.keyClass, writer: spec.writer, target: spec.target,
    name: (m) => spec.name(innerOf(m)), face: (m) => (spec.face ? spec.face(innerOf(m)) : (`fcid:${m[1]}` as const)),
    faceRow: { inner: new RegExp(`^(?:${body})$`), select: spec.select },
    ...(spec.bundle ? { bundle: spec.bundle } : {}),
  });
}

function buildTable(): readonly CarrierRow[] {
  const id = (r: IdentityRowSpec): CarrierRow => row({ home: "identity", under: "", ...r });
  return Object.freeze([
    // ── floor: outside the VK ──────────────────────────────────────────────────────────────────
    id({ row: "vessel-key", target: tgt(["S"], LEAD, "place-signer"), match: loginKeyed("vessel-key"), custody: "floor", keyClass: "device-minted",
         writer: "node-vessel-identity (founding)",
         bare: "the floor signs with it before any person unlocks, so no vessel key may stand between a boot and it" }),
    id({ row: "vessel-kel", target: tgt(["F"]), match: loginKeyed("vessel-kel"), custody: "floor", keyClass: null,
         writer: "node-vessel-identity (founding)",
         bare: "the vessel key's own inception names that key and carries its signature: it stands public and proves itself, and a load of the key reads it before any person unlocks" }),
    id({ row: "vk-slots", target: tgt(["D", "S"], LEAD, "place-signer"), match: exact(vkSlotsPath()), custody: "floor", keyClass: null,
         writer: "vault bind",
         bare: "the slot tree wraps the vessel key under each human route, so the key it wraps cannot seal it" }),
    id({ row: "sk-slots", target: tgt(["S"], LEAD), match: exact(skSlotsPath()), custody: "floor", keyClass: null,
         writer: "custody-session (founding)",
         bare: "the serving tree wraps the serving key under the vessel key's entry, so the key it wraps cannot seal it, and a raise reads it before any key opens" }),

    row({ row: "fk-slots", target: tgt(["D"]), home: "identity", under: FACES_DIR, match: new RegExp(`^${FACES_DIR}/[0-9a-f]{32}/fk-slots\\.bin$`),
          custody: "floor", keyClass: null, writer: "face-custody (founding)",
          bare: "a face's slot tree wraps the face custody key under each human route of that face, so the key it wraps cannot seal it" }),

    // ── floor-plain: the floor reads it, or it reads public ────────────────────────────────────
    id({ row: "face-index", target: tgt(["F"]), match: file(FACE_INDEX_FILE), custody: "floor-plain", keyClass: null,
         writer: "face-index",
         bare: "the node names the faces it can unlock before any face opens; the index holds the count of faces, each group's digest, each founding ask's digest and each random directory name, and no other byte" }),
    id({ row: "vessel-card", target: tgt(["F"]), match: loginKeyed("vessel-card"), custody: "floor-plain", keyClass: null,
         writer: "node-vessel-identity (founding)",
         bare: "a contact card holds public keys alone, and the vessel hands it to every peer it meets" }),
    row({ row: "charter", target: tgt(["F"]), home: "seal", under: "", match: file("founding-roster.mem"), custody: "floor-plain",
          keyClass: null, writer: "nexus seal",
          bare: "the floor's gate reads the charter before any key opens, and a charter stands public and signed" }),
    row({ row: "carried-charter", target: tgt(["F"]), home: "seal", under: "carried", match: /^carried\/[A-Za-z0-9][A-Za-z0-9._-]*\/founding-roster\.mem$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set",
          bare: "the floor's gate reads each carried charter before any key opens, and a charter stands public and signed" }),
    row({ row: "carriage-consent", target: tgt(["F"]), home: "seal", under: "nexus", match: /^nexus\/carriage-consent\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set",
          bare: "the floor reads a kept consent to carry a Nexus before any key opens; it names a charter and holds no key" }),
    row({ row: "nexus-key-line", target: tgt(["F"]), home: "seal", under: "nexus", match: /^nexus\/key-line\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set",
          bare: "a key hand-over names two public keys and both their signatures, and it stands public on the Nexus's carriage board" }),
    row({ row: "carriage-admit", target: tgt(["F"]), home: "seal", under: "nexus", match: /^nexus\/carriage-admit\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "admit-bundle",
          bare: "the floor's gate reads the admit pin before any key opens; it holds a reach and a gate's public key" }),
    // The sealed store's rest (`sealed-store-fs`): lockboxes, signed records and index rows, one file per name. Each
    // name ends in a digest of its own bytes and each value reads as its shelf's kind, so a file that fails either
    // reads as a fault.
    row({ row: "sealed-rest", target: tgt(["F"]), home: "storage", under: "sealed", match: new RegExp(`^sealed/(?:${REST_CARRIED.join("|")})/${REST_NAME}$`),
          custody: "floor-plain", keyClass: null, writer: "sealed-store-fs", holds: restFileHolds,
          bare: "a lockbox, a record and an index row hold ciphertext, opaque ids and addresses, and no secret, name or key in the clear; a blind carrier may hold every one" }),
    // The vessel's own notes for its sealed store: an opaque id under an opaque name, where the latest write replaces.
    row({ row: "sealed-own", target: tgt(["F"], LEAD), home: "storage", under: "sealed", match: new RegExp(`^sealed/own/${REST_NAME}$`),
          custody: "floor-plain", keyClass: null, writer: "sealed-store-fs",
          bare: "a note holds opaque ids of the sealed store, a one-byte mark or nothing, under an opaque name, and no secret, name or key" }),
    // The Keyhive chunks a provider tracks per bag (`sealed-store-fs`): one ciphertext per content reference.
    row({ row: "sealed-chunk", target: tgt(["F"]), home: "storage", under: "sealed", match: /^sealed\/keyhive-chunks\/[0-9a-f]{1,128}\/[0-9a-f]{1,128}$/,
          custody: "floor-plain", keyClass: null, writer: "sealed-store-fs",
          bare: "a chunk rests as Keyhive ciphertext under an opaque name, and a blind carrier may hold every one" }),

    // ── hot: sealed under the VK, opened at unlock ─────────────────────────────────────────────
    id({ row: "custody-root", target: tgt(["D"], LEAD), match: exact(custodyRootPath()), custody: "hot", keyClass: "device-minted",
         writer: "custody-root (founding)" }),
    id({ row: "keyhive-archive", target: tgt(["D"], LEAD, "archive-row-selector"), match: exact(archivePath()), custody: "hot", keyClass: "device-minted",
         writer: "identity-anchors" }),
    faceRowOf({ row: "veil-archive", target: tgt(["D"], LEAD, "archive-row-selector"), inner: VEIL_ARCHIVE_FILE, select: (m) => ({ group: m[1]! }), custody: "face-hot", keyClass: "device-minted",
         writer: "identity-anchors", name: (m) => `veil-archive-g${m[1]}`, face: (m) => `group:${m[1]}` }),
    // A group digest owns this local atom row; bundles leave its seed on this vessel.
    faceRowOf({ row: "face-atom", target: tgt(["D"]), inner: FACE_ATOM_GROUP_FILE, select: (m) => ({ group: m[1]! }), custody: "face-hot", keyClass: "device-minted",
         writer: "face-atom-store", name: (m) => `face-atom-g${m[1]}`, face: (m) => `group:${m[1]}`, bundle: "stays" }),
    faceRowOf({ row: "face-anchor", target: tgt(["D"]), inner: FACE_ANCHOR_GROUP_FILE, select: (m) => ({ group: m[1]! }), custody: "face-hot", keyClass: "device-minted",
         writer: "face-anchor-store", name: (m) => `face-anchor-g${m[1]}`, face: (m) => `group:${m[1]}`, bundle: "stays" }),
    // A founding ask holds a seed until its group row keeps it.
    faceRowOf({ row: "face-atom-ask", target: tgt(["D"]), inner: FACE_ATOM_ASK_FILE, select: (m) => ({ ask: m[1]! }), custody: "face-hot", keyClass: "device-minted",
         writer: "face-atom-store", name: (m) => `face-atom-ask-${m[1]}`, bundle: "stays" }),
    // The face's own custody label: its fcid and the digest of its PersonaGroup. The holder reads it to check the floor index it unlocked by.
    faceRowOf({ row: "face-owner", target: tgt(["D"]), inner: /face-owner\.bin/, select: () => null, custody: "face-hot", keyClass: null,
         writer: "custody-holder", name: () => "face-owner" }),
    // These reserved rows have no writer; a vessel holding one still recognises its carrier at unlock.
    id({ row: "enroll-pending", target: tgt(["D"], LEAD), match: file(".persona-enroll-pending.json"), custody: "hot", keyClass: "relation",
         writer: "none (reserved carrier)" }),
    id({ row: "grant-pending", target: tgt(["D"], LEAD), match: file(".persona-grant-pending.json"), custody: "hot", keyClass: "relation",
         writer: "none (reserved carrier)" }),
    id({ row: "admissions", target: tgt(["D"], LEAD), match: file(".persona-admissions.json"), custody: "hot", keyClass: "relation",
         writer: "none (reserved carrier)" }),
    faceRowOf({ row: "anchors", target: tgt(["D"]), inner: /^anchors-h(\d+)\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "identity-anchors", name: (m) => `anchors-h${m[1]}`, face: faceOf, bundle: "lines" }),
    // The roster of a vessel's roots, its pet-names, declarations and published records: one row per face, in that face's own
    // directory, named by the handle index. No shared roster names the faces: the floor index does, by ordinal alone.
    faceRowOf({ row: "persona-roster", target: tgt(["D"]), inner: faceLoginKeyed("persona-roster"), select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "node-vessel-identity", name: (m) => `persona-roster-h${m[1]}`, face: faceOf, bundle: "lines" }),
    faceRowOf({ row: "persona-petnames", target: tgt(["D"]), inner: faceLoginKeyed("persona-petnames"), select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "node-vessel-identity", name: (m) => `persona-petnames-h${m[1]}`, face: faceOf, bundle: "lines" }),
    faceRowOf({ row: "persona-declarations", target: tgt(["D"]), inner: faceLoginKeyed("persona-declarations"), select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "node-vessel-identity", name: (m) => `persona-declarations-h${m[1]}`, face: faceOf, bundle: "lines" }),
    faceRowOf({ row: "public-handles", target: tgt(["D"]), inner: faceLoginKeyed("persona-public-handles"), select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "node-vessel-identity", name: (m) => `persona-public-handles-h${m[1]}`, face: faceOf }),
    // This vessel's own face-scoped key under one face at one Nexus (`face-key-custody`, the face proof's library
    // names the row). It stays on its vessel: no bundle carries it.
    faceRowOf({ row: "vessel-face-key", target: tgt(["D"]), inner: /^vessel-face-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: "device-minted",
         writer: "face-key-custody", name: (m) => `vessel-face-key-h${m[1]}-${m[2]}`, face: faceOf }),
    // One face's address secret (`fleet-join-custody`): minted once on the root holder, carried to each joined
    // vessel by the fleet-join door alone. Its file names a digest of the face's PersonaGroup. No rotation
    // regenerates it, and no bundle body carries it: it stays on its vessels.
    faceRowOf({ row: "face-address-secret", target: tgt(["D"]), inner: /^face-address-secret-g([0-9a-f]{64})\.bin$/, select: (m) => ({ group: m[1]! }), custody: "face-hot", keyClass: "relation",
         writer: "fleet-join-custody", name: (m) => `face-address-secret-g${m[1]}`, face: (m) => `group:${m[1]}` }),
    // A joining vessel's half-done fleet join (`fleet-join-custody`): its request and the X25519 secret its
    // answer seals to. The landing removes it.
    faceRowOf({ row: "fleet-join-pending", target: tgt(["D"]), inner: /^fleet-join-pending-g([0-9a-f]{64})\.json$/, select: (m) => ({ group: m[1]! }), custody: "face-hot", keyClass: "relation",
         writer: "fleet-join-custody", name: (m) => `fleet-join-pending-g${m[1]}`, face: (m) => `group:${m[1]}` }),
    // A joined face's record (`fleet-join-custody`): its root key, the certificates over this vessel's face-scoped
    // keys and the root's grants, as the fleet-join answer carried them. It stays on its vessel.
    faceRowOf({ row: "face-join-record", target: tgt(["D"]), inner: /^face-join-record-g([0-9a-f]{64})\.json$/, select: (m) => ({ group: m[1]! }), custody: "face-hot", keyClass: "relation",
         writer: "fleet-join-custody", name: (m) => `face-join-record-g${m[1]}`, face: (m) => `group:${m[1]}` }),
    // One face's recognition book, in that face's own row: the nyms it recognised and the private labels it keeps for them.
    faceRowOf({ row: "handle-book", target: tgt(["D"]), inner: /^\.handle-book-h(0|[1-9]\d*)\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "node-circle-store", name: (m) => `handle-book-h${m[1]}`, face: faceOf, bundle: "whole" }),
    // One face's guardian set as its typed first enrolment committed it (`guardian-enrolment`): the keys a later
    // rotation reveals, and what another face's enrolment reads to refuse a shared key. That face's bundle carries
    // it whole wherever the face's log commits it, and a restore lands it beside the root.
    faceRowOf({ row: "guardian-set", target: tgt(["D"]), inner: /^guardian-set-h(\d+)\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "guardian-enrolment", name: (m) => `guardian-set-h${m[1]}`, face: faceOf, bundle: "whole" }),
    // One restored face's provisional mark (`face-provisional`): the head its restore read, until a party to its
    // relation agrees. It belongs to the vessel that restored the face: no bundle carries it.
    faceRowOf({ row: "face-provisional", target: tgt(["D"]), inner: /^face-provisional-h(\d+)\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "face-provisional", name: (m) => `face-provisional-h${m[1]}`, face: faceOf }),
    row({ row: "hosting-state", target: tgt(["D", "F"], LEAD), home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}state\\.json$`),
          custody: "hot", keyClass: null, writer: "hosting-store" }),
    row({ row: "hosting-spent", target: tgt(["D", "F"], LEAD), home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}spent-[^/]+$`),
          custody: "hot", keyClass: null, writer: "hosting-store" }),
    row({ row: "hosting-carry", target: tgt(["D", "F"], LEAD), home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}carry/.+$`),
          custody: "hot", keyClass: null, writer: "hosting-carry" }),
    faceRowOf({ row: "walk", target: tgt(["D"]), inner: /^walk-h(0|[1-9]\d*)-([0-9a-f]{32})\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "node-walk-store", name: (m) => `walk-h${m[1]}-${m[2]}`, face: faceOf }),
    // A sovereign gate's withdrawal memory, one row per face key named by its proof-subject digest
    // (`gate-memory-rows`). It belongs to its vessel: no face's bundle carries it.
    // A gate's withdrawal memory rests in the face whose gate learned it: the file name's handle index only spells the face, the face's own directory is the location.
    faceRowOf({ row: "gate-memory", target: tgt(["D"]), inner: /^gate-memory-h(0|[1-9]\d*)-([0-9a-f]{64})\.bin$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "gate-memory-rows", name: (m) => `gate-memory-h${m[1]}-${m[2]}`, face: faceOf }),
    // The growth rite's two rows (`seal-ceremony`): the first prepares a crossing, the second commits its record.
    row({ row: "transition-pending", target: tgt(["F"]), home: "seal", under: "", match: file("transition-pending.json"),
          custody: "floor-plain", keyClass: null, writer: "seal-ceremony",
          bare: "a crossing in progress carries public key-sets, signatures and witnesses and no secret: any holder of the charter verifies it, and no seat key or card rests in it" }),
    row({ row: "transitions", target: tgt(["F"]), home: "seal", under: "", match: file("transitions.json"),
          custody: "floor-plain", keyClass: null, writer: "seal-ceremony",
          bare: "sealed crossing records carry public key-sets, signatures and witnesses and no secret: each record verifies from the charter alone" }),
    // One joint founding's record (`cofound-record`): the offer this vessel made or answered, its seat and hearth
    // cadence keys' public halves, and the image it judged. The inception door licenses a joint signature by it.
    faceRowOf({ row: "cofound", target: tgt(["D"]), inner: /^cofound-h(0|[1-9]\d*)-([0-9a-f]{64})\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: null,
         writer: "cofound-record", name: (m) => `cofound-h${m[1]}-${m[2]}`, face: faceOf }),

    // The vessel's outbox key (`outbox-key`): minted once, at the first unlocked composition, and handed to the daemon
    // island at each unlock. It seals the outbox's parcels and nothing beside them; it stays on its vessel.
    faceRowOf({ row: "outbox-key", target: tgt(["D"]), inner: OUTBOX_KEY_FILE, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-hot", keyClass: "device-minted",
         writer: "outbox-key", name: (m) => `outbox-key-h${m[1]}`, face: faceOf }),

    // ── outbox: sealed under the outbox key the VK wraps ───────────────────────────────────────
    // The parcels a vessel wrapped for a reader, until the member lane takes them: each sealed whole, its reader
    // inside the seal, under a random name (`sealed-store-rest`). They stay on their vessel.
    row({ row: "sealed-outbox", target: tgt(["D"]), home: "storage", under: "sealed", match: new RegExp(`^sealed/outbox/${REST_NAME}$`),
          custody: "outbox", keyClass: null, writer: "sealed-store-fs", holds: restFileHolds }),

    // ── cold: sealed under the VK, opened per act ──────────────────────────────────────────────
    faceRowOf({ row: "persona-root", target: tgt(["D"]), inner: /^\.persona-group-root(?:-[^./]+?)?-h(\d+)\.json$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-cold", keyClass: "seed",
         writer: "node-vessel-identity", name: (m) => `persona-root-h${m[1]}`, face: faceOf, bundle: "whole" }),
    // One face's proof key at one Nexus, held by the root-holding vessel alone (`face-key-custody`). Its file names
    // the face, so that face's bundle carries it.
    faceRowOf({ row: "face-proof-key", target: tgt(["D"]), inner: /^face-proof-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-cold", keyClass: "seed",
         writer: "face-key-custody", name: (m) => `face-proof-key-h${m[1]}-${m[2]}`, face: faceOf, bundle: "whole" }),
    // A seat's own key, minted at random and apart from every root and leaf (`seat-key-store`). Its file names the
    // face whose seat claim stood for the chair and a digest of the seat's public key. It stays on its vessel: a
    // bundle carries no key of any seat.
    faceRowOf({ row: "seat-key", target: tgt(["D"]), inner: /^seat-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-cold", keyClass: "seed",
         writer: "seat-key-store", name: (m) => `seat-key-h${m[1]}-${m[2]}`, face: faceOf }),
    // A hearth's own cadence key and its next key, minted at random on the device for one joint founding
    // (`cadence-key-store`): apart from every root, leaf, seat and serving or floor key. It stays on its vessel.
    faceRowOf({ row: "cadence-key", target: tgt(["D"]), inner: /^cadence-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-cold", keyClass: "device-minted",
         writer: "cadence-key-store", name: (m) => `cadence-key-h${m[1]}-${m[2]}`, face: faceOf }),
    // A restore's own commit row: everything one restore will land, sealed in ONE write before any row moves. It
    // holds a root for the length of that restore and leaves once the face stands lit; no bundle carries it.
    faceRowOf({ row: "restore-pending", target: tgt(["D"]), inner: RESTORE_PENDING_FILE, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-cold", keyClass: "seed", name: (m) => `restore-pending-h${m[1]}`,
         writer: "face-bundle-restore" }),
    faceRowOf({ row: "device-share", target: tgt(["D"]), inner: DEVICE_SHARE_FILE, select: (m) => ({ ordinal: Number(m[1]) }), custody: "face-cold", keyClass: "seed",
         writer: "recovery-share-store", name: (m) => `recovery-device-share-h${m[1]}`, face: faceOf }),
  ]);
}

let table: readonly CarrierRow[] | null = null;

/** The rows a face's backup bundle carries, each beside its treatment: every row the column names anything but `stays`. */
export function bundleRows(): ReadonlyArray<{ readonly row: string; readonly bundle: Exclude<BundleTreatment, "stays"> }> {
  return carrierTable().flatMap((r) => (r.bundle === "stays" ? [] : [{ row: r.row, bundle: r.bundle }]));
}

/** The one carrier table. */
export function carrierTable(): readonly CarrierRow[] {
  return (table ??= buildTable());
}

/** Every file under `dir`, as `/`-separated paths relative to `base`; flat when `deep` is false. */
function listFiles(base: string, under: string, deep: boolean): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    let entries: Dirent[];
    try { entries = readdirSync(join(base, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isFile()) out.push(child);
      else if (deep && e.isDirectory()) walk(child);
    }
  };
  walk(under);
  return out;
}

/** The census of one home over `table`'s rows: every file a row names, first matching row wins (the table stays disjoint). */
function censusHome(home: CustodyHome, dir: string, table: readonly CarrierRow[] = carrierTable()): CarrierEntry[] {
  const rows = table.filter((r) => r.home === home);
  const out: CarrierEntry[] = [];
  for (const under of [...new Set(rows.map((r) => r.under))]) {
    const scoped = rows.filter((r) => r.under === under);
    for (const rel of listFiles(dir, under, under !== "")) {
      for (const r of scoped) {
        const m = r.match.exec(rel);
        if (!m) continue;
        out.push({
          row: r.row, name: r.name(m), home, file: rel, path: join(dir, ...rel.split("/")),
          custody: r.custody, keyClass: r.keyClass, bare: r.bare, holds: r.holds, face: r.face(m),
        });
        break;
      }
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * Census every carrier standing in `homes`, named by its row. An absent or unreadable home names nothing
 * and faults nothing: no home yet means no carrier stands. The census only reads.
 */
export function carrierCensus(homes: CustodyHomes): CarrierEntry[] {
  return [
    ...censusHome("identity", homes.identity),
    ...censusHome("storage", homes.storage),
    ...censusHome("seal", homes.seal),
  ];
}

// ── the VK-sealed carriers, derived from the rows ────────────────────────────────────────────────

/**
 * Every hot and cold carrier standing in `homes`, as the sealed writer names it: `<home>/<file>`. Each carries its
 * row's key class, so a refusal over a `relation` carrier says no rotation regenerates it.
 */
export function vkSealedCarriers(homes: CustodyHomes): SealedCarrier[] {
  // The hot and cold rows alone get walked: a rotation and an unlock never list a subtree only a plain row names.
  const sealed = carrierTable().filter((r) => r.custody === "hot" || r.custody === "cold");
  return [
    ...(["identity", "storage", "seal"] as const)
      .flatMap((home) => censusHome(home, homes[home], sealed))
      .map((e) => ({ name: `${e.home}/${e.file}`, path: e.path, keyClass: e.keyClass })),
    ...flatFaceRowCarriers(homes.identity).map((e) => ({ name: `identity/${e.file}`, path: e.path, keyClass: e.keyClass })),
  ];
}

/**
 * A face row's file standing FLAT in the identity home: the spelling an earlier shape wrote. This build writes a face row only inside
 * its face's directory, so a flat one is a carrier the build does not write: the shape reader and the founding census name it.
 */
export function flatFaceRowCarriers(identityDir: string): Array<{ readonly row: string; readonly file: string; readonly path: string; readonly keyClass: KeyClass | null }> {
  let names: string[];
  try { names = readdirSync(identityDir); } catch { return []; }
  const out: Array<{ row: string; file: string; path: string; keyClass: KeyClass | null }> = [];
  // The shared files an earlier shape kept for ALL faces at once (one roster, one map per family): no face owns them now.
  const earlier: ReadonlyArray<readonly [string, RegExp]> = [
    ["anchor-roster", /^anchor-roster\.json$/], ["outbox-key", /^outbox-key\.bin$/], ["cadence-key", /^cadence-key-[0-9a-f]{32}\.bin$/],
    ["vessel-face-key", /^vessel-face-key-[0-9a-f]{32}\.bin$/], ["face-address-secret", /^face-address-secret-[0-9a-f]{32}\.bin$/],
    ["fleet-join-pending", /^fleet-join-pending-[0-9a-f]{32}\.json$/], ["face-join-record", /^face-join-record-[0-9a-f]{32}\.json$/], ["active-persona", /^\.active-persona(?:-[^./]+)?\.json$/], ["handle-book", /^\.handle-book\.json$/], ["persona-roster", /^\.persona-roster(?:-[^./]+)?\.json$/],
    ["persona-petnames", /^\.persona-petnames(?:-[^./]+)?\.json$/], ["persona-declarations", /^\.persona-declarations(?:-[^./]+)?\.json$/],
    ["public-handles", /^\.persona-public-handles(?:-[^./]+)?\.json$/],
  ];
  for (const file of names) {
    const row = carrierTable().find((r) => r.faceRow !== undefined && r.faceRow.inner.test(file));
    if (row) { out.push({ row: row.row, file, path: join(identityDir, file), keyClass: row.keyClass }); continue; }
    const old = earlier.find(([, rx]) => rx.test(file));
    if (old) out.push({ row: old[0], file, path: join(identityDir, file), keyClass: null });
  }
  return out;
}

/**
 * Rotate the vessel's VK over every VK-sealed carrier the table names in `homes`, binding `slots` over the new
 * VK at the identity home's slot tree. The sealed writer proves `oldVk` against the standing tree and refuses a
 * VK-sealed file the census omits, before any write.
 */
export async function rotateVesselVk(args: {
  readonly io:     CustodyIo;
  readonly homes:  CustodyHomes;
  readonly oldVk:  VesselKey;
  readonly newVk:  VesselKey;
  readonly slots:  readonly SlotSpec[];
}): Promise<SlotTree> {
  return rotateVk({
    io: args.io, treePath: vkSlotsPath(args.homes.identity), carriers: vkSealedCarriers(args.homes),
    oldVk: args.oldVk, newVk: args.newVk, slots: args.slots,
  });
}

// ── what stands outside the table ────────────────────────────────────────────────────────────────

/** Why a file outside the table reads private. */
export type OutsideWhy = "sidecar" | "vk-seal" | "owner-only";

/** One file that reads private and matches no row. */
export interface OutsideFile {
  readonly home: CustodyHome;
  /** The path relative to its home, `/`-separated. */
  readonly file: string;
  readonly path: string;
  readonly why:  OutsideWhy;
}

/** A name a writer gives a file it has not landed yet: the sealed writer's two sidecars, the serving tree's re-wrap, a port's or a rest's temporary file. */
const SIDECAR_NAME = new RegExp(`(?:${escape(SEALING_SUFFIX)}|${escape(ROTATING_SUFFIX)}|${escape(SK_REWRAP_SUFFIX)}|\\.io-tmp)$|(?:^|/)TMP-[0-9a-f]+$`);

/** The first bytes of a file, enough to read a VK frame's magic and its least length; nothing on any fault. */
function headOf(path: string): Uint8Array {
  let fd: number;
  try { fd = openSync(path, "r"); } catch { return new Uint8Array(0); }
  try {
    const buf = Buffer.alloc(VK_SEAL_MIN_LENGTH);
    return new Uint8Array(buf.subarray(0, readSync(fd, buf, 0, buf.length, 0)));
  } catch { return new Uint8Array(0); }
  finally { closeSync(fd); }
}

/**
 * Every file in `homes` that reads private and that no row of the table names. It walks each home WHOLE, the
 * subtrees no row names among them, and reads three signs: a writer's unlanded name (`sidecar`), the vessel
 * key's seal in the first bytes (`vk-seal`), and a mode that admits the owner alone (`owner-only`). A file a row
 * names never lists, whatever its bytes: the row's own reading answers for it. It only reads; an absent home
 * names nothing.
 */
export function outsideTheTable(homes: CustodyHomes): OutsideFile[] {
  const named = new Set(carrierCensus(homes).map((e) => e.path));
  const out: OutsideFile[] = [];
  const seen = new Set<string>();
  for (const home of ["identity", "storage", "seal"] as const) {
    const dir = homes[home];
    if (seen.has(dir)) continue;
    seen.add(dir);
    for (const rel of listFiles(dir, "", true)) {
      const path = join(dir, ...rel.split("/"));
      if (named.has(path)) continue;
      let why: OutsideWhy | null = null;
      if (SIDECAR_NAME.test(rel)) why = "sidecar";
      else {
        const reading = readVkCarrier(headOf(path));
        if (reading === "sealed" || reading === "torn") why = "vk-seal";
        else {
          try { if ((statSync(path).mode & 0o077) === 0) why = "owner-only"; } catch { /* a file that left mid-walk names nothing */ }
        }
      }
      if (why) out.push({ home, file: rel, path, why });
    }
  }
  return out;
}
