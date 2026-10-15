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
import { outboxKeyPath } from "./outbox-key.js";
import { larDataDir, larIdentityDir, larSealHome } from "./vessel-paths.js";

/** The custody classes, closed. */
export const CUSTODY_CLASSES = ["floor", "floor-plain", "serving", "hot", "cold", "outbox"] as const;
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

/** Whose a carrier is: one face's own (its handle-index), or the vessel's (every face, or none). */
export type CarrierFace = number | "vessel";

/**
 * How a face's backup bundle treats a row (custody#/the-table): `whole`, the row rides as it rests; `lines`, the
 * one face's own lines ride and nothing of another face; `stays`, the row never leaves its vessel.
 */
export const BUNDLE_TREATMENTS = ["whole", "lines", "stays"] as const;
export type BundleTreatment = (typeof BUNDLE_TREATMENTS)[number];

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
   * Whose this match is. A file that names one face and holds nothing of another answers that face's
   * handle-index; every other row answers `"vessel"`. A bundle of one face's custody derives from this column.
   */
  readonly face:     (m: RegExpExecArray) => CarrierFace;
  /**
   * How a face's backup bundle treats this row. A row that names none `stays`. The bundle's cut and the restore's
   * check both derive from this column (`bundleRows`), so no hand picks the rows a bundle carries.
   */
  readonly bundle:   BundleTreatment;
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
/** A plain filename. */
const file = (name: string): RegExp => new RegExp(`^${escape(name)}$`);
/** A hosting directory: `hosting/<the 32-hex digest of a Nexus AID>/`. */
const HOSTING = "hosting/[0-9a-f]{32}/";

/**
 * A row as its line of the table spells it. The custody class decides the `bare` column at the type: a row
 * outside the vessel key states its law, and a row under it states none.
 */
type RowSpec = Omit<CarrierRow, "name" | "face" | "bundle" | "bare" | "custody" | "holds"> & Partial<Pick<CarrierRow, "name" | "face" | "bundle" | "holds">>
  & ({ readonly custody: "floor" | "floor-plain"; readonly bare: string } | { readonly custody: "serving" | "hot" | "cold" | "outbox" });

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
export const RESTORE_PENDING_FILE = ".restore-pending.json";

/** The face a per-face filename names: its first capture, a handle-index. */
const faceOf = (m: RegExpExecArray): CarrierFace => Number(m[1]);

function buildTable(): readonly CarrierRow[] {
  const id = (r: IdentityRowSpec): CarrierRow => row({ home: "identity", under: "", ...r });
  return Object.freeze([
    // ── floor: outside the VK ──────────────────────────────────────────────────────────────────
    id({ row: "vessel-key", match: loginKeyed("vessel-key"), custody: "floor", keyClass: "device-minted",
         writer: "node-vessel-identity (founding)",
         bare: "the floor signs with it before any person unlocks, so no vessel key may stand between a boot and it" }),
    id({ row: "vessel-kel", match: loginKeyed("vessel-kel"), custody: "floor", keyClass: null,
         writer: "node-vessel-identity (founding)",
         bare: "the vessel key's own inception names that key and carries its signature: it stands public and proves itself, and a load of the key reads it before any person unlocks" }),
    id({ row: "vk-slots", match: exact(vkSlotsPath()), custody: "floor", keyClass: null,
         writer: "vault bind",
         bare: "the slot tree wraps the vessel key under each human route, so the key it wraps cannot seal it" }),
    id({ row: "sk-slots", match: exact(skSlotsPath()), custody: "floor", keyClass: null,
         writer: "custody-session (founding)",
         bare: "the serving tree wraps the serving key under the vessel key's entry, so the key it wraps cannot seal it, and a raise reads it before any key opens" }),

    // ── floor-plain: the floor reads it, or it reads public ────────────────────────────────────
    id({ row: "vessel-card", match: loginKeyed("vessel-card"), custody: "floor-plain", keyClass: null,
         writer: "node-vessel-identity (founding)",
         bare: "a contact card holds public keys alone, and the vessel hands it to every peer it meets" }),
    row({ row: "charter", home: "seal", under: "", match: file("founding-roster.mem"), custody: "floor-plain",
          keyClass: null, writer: "nexus seal",
          bare: "the floor's gate reads the charter before any key opens, and a charter stands public and signed" }),
    row({ row: "carried-charter", home: "seal", under: "carried", match: /^carried\/[A-Za-z0-9][A-Za-z0-9._-]*\/founding-roster\.mem$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set",
          bare: "the floor's gate reads each carried charter before any key opens, and a charter stands public and signed" }),
    row({ row: "carriage-consent", home: "seal", under: "nexus", match: /^nexus\/carriage-consent\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set",
          bare: "the floor reads a kept consent to carry a Nexus before any key opens; it names a charter and holds no key" }),
    row({ row: "nexus-key-line", home: "seal", under: "nexus", match: /^nexus\/key-line\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set",
          bare: "a key hand-over names two public keys and both their signatures, and it stands public on the Nexus's carriage board" }),
    row({ row: "carriage-admit", home: "seal", under: "nexus", match: /^nexus\/carriage-admit\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "admit-bundle",
          bare: "the floor's gate reads the admit pin before any key opens; it holds a reach and a gate's public key" }),
    // The sealed store's rest (`sealed-store-fs`): lockboxes, signed records and index rows, one file per name. Each
    // name ends in a digest of its own bytes and each value reads as its shelf's kind, so a file that fails either
    // reads as a fault.
    row({ row: "sealed-rest", home: "storage", under: "sealed", match: new RegExp(`^sealed/(?:${REST_CARRIED.join("|")})/${REST_NAME}$`),
          custody: "floor-plain", keyClass: null, writer: "sealed-store-fs", holds: restFileHolds,
          bare: "a lockbox, a record and an index row hold ciphertext, opaque ids and addresses, and no secret, name or key in the clear; a blind carrier may hold every one" }),
    // The vessel's own notes for its sealed store: an opaque id under an opaque name, where the latest write replaces.
    row({ row: "sealed-own", home: "storage", under: "sealed", match: new RegExp(`^sealed/own/${REST_NAME}$`),
          custody: "floor-plain", keyClass: null, writer: "sealed-store-fs",
          bare: "a note holds opaque ids of the sealed store, a one-byte mark or nothing, under an opaque name, and no secret, name or key" }),
    // The Keyhive chunks a provider tracks per bag (`sealed-store-fs`): one ciphertext per content reference.
    row({ row: "sealed-chunk", home: "storage", under: "sealed", match: /^sealed\/keyhive-chunks\/[0-9a-f]{1,128}\/[0-9a-f]{1,128}$/,
          custody: "floor-plain", keyClass: null, writer: "sealed-store-fs",
          bare: "a chunk rests as Keyhive ciphertext under an opaque name, and a blind carrier may hold every one" }),

    // ── hot: sealed under the VK, opened at unlock ─────────────────────────────────────────────
    id({ row: "custody-root", match: exact(custodyRootPath()), custody: "hot", keyClass: "device-minted",
         writer: "custody-root (founding)" }),
    id({ row: "keyhive-archive", match: exact(archivePath()), custody: "hot", keyClass: "device-minted",
         writer: "identity-anchors" }),
    id({ row: "veil-archive", match: VEIL_ARCHIVE_FILE, custody: "hot", keyClass: "device-minted",
         writer: "identity-anchors", name: (m) => `veil-archive-h${m[1]}`, face: faceOf }),
    id({ row: "enroll-pending", match: file(".persona-enroll-pending.json"), custody: "hot", keyClass: "relation",
         writer: "node-persona-admit-store" }),
    id({ row: "grant-pending", match: file(".persona-grant-pending.json"), custody: "hot", keyClass: "relation",
         writer: "node-persona-admit-store" }),
    id({ row: "admissions", match: file(".persona-admissions.json"), custody: "hot", keyClass: "relation",
         writer: "node-persona-admit-store" }),
    id({ row: "anchors", match: /^anchors-h(\d+)\.json$/, custody: "hot", keyClass: null,
         writer: "identity-anchors", name: (m) => `anchors-h${m[1]}`, face: faceOf, bundle: "lines" }),
    id({ row: "anchor-roster", match: file("anchor-roster.json"), custody: "hot", keyClass: null,
         writer: "identity-anchors" }),
    id({ row: "persona-roster", match: loginKeyed("persona-roster"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity", bundle: "lines" }),
    id({ row: "active-persona", match: loginKeyed("active-persona"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    id({ row: "persona-petnames", match: loginKeyed("persona-petnames"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity", bundle: "lines" }),
    id({ row: "persona-declarations", match: loginKeyed("persona-declarations"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity", bundle: "lines" }),
    id({ row: "public-handles", match: loginKeyed("persona-public-handles"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    // This vessel's own face-scoped key under one face at one Nexus (`face-key-custody`, the face proof's library
    // names the row). It stays on its vessel: no bundle carries it.
    id({ row: "vessel-face-key", match: /^vessel-face-key-([0-9a-f]{32})\.bin$/, custody: "hot", keyClass: "device-minted",
         writer: "face-key-custody", name: (m) => `vessel-face-key-${m[1]}` }),
    id({ row: "handle-book", match: file(".handle-book.json"), custody: "hot", keyClass: null,
         writer: "node-circle-store", bundle: "lines" }),
    // One face's guardian set as its typed first enrolment committed it (`guardian-enrolment`): the keys a later
    // rotation reveals, and what another face's enrolment reads to refuse a shared key. That face's bundle carries
    // it whole wherever the face's log commits it, and a restore lands it beside the root.
    id({ row: "guardian-set", match: /^guardian-set-h(\d+)\.json$/, custody: "hot", keyClass: null,
         writer: "guardian-enrolment", name: (m) => `guardian-set-h${m[1]}`, face: faceOf, bundle: "whole" }),
    // One restored face's provisional mark (`face-provisional`): the head its restore read, until a party to its
    // relation agrees. It belongs to the vessel that restored the face: no bundle carries it.
    id({ row: "face-provisional", match: /^face-provisional-h(\d+)\.json$/, custody: "hot", keyClass: null,
         writer: "face-provisional", name: (m) => `face-provisional-h${m[1]}`, face: faceOf }),
    row({ row: "hosting-state", home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}state\\.json$`),
          custody: "hot", keyClass: null, writer: "hosting-store" }),
    row({ row: "hosting-spent", home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}spent-[^/]+$`),
          custody: "hot", keyClass: null, writer: "hosting-store" }),
    row({ row: "hosting-carry", home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}carry/.+$`),
          custody: "hot", keyClass: null, writer: "hosting-carry" }),
    row({ row: "walk", home: "storage", under: "walk", match: /^walk\/[^/]+\.json$/,
          custody: "hot", keyClass: null, writer: "node-walk-store" }),
    // A sovereign gate's withdrawal memory, one row per face key named by its proof-subject digest
    // (`gate-memory-rows`). It belongs to its vessel: no face's bundle carries it.
    row({ row: "gate-memory", home: "storage", under: "gate-memory", match: /^gate-memory\/[0-9a-f]{64}\.bin$/,
          custody: "hot", keyClass: null, writer: "gate-memory-rows" }),
    // The growth rite's two rows (`seal-ceremony`): the first prepares a crossing, the second commits its record.
    row({ row: "transition-pending", home: "seal", under: "", match: file("transition-pending.json"),
          custody: "hot", keyClass: null, writer: "seal-ceremony" }),
    row({ row: "transitions", home: "seal", under: "", match: file("transitions.json"),
          custody: "hot", keyClass: null, writer: "seal-ceremony" }),
    // One joint founding's record (`cofound-record`): the offer this vessel made or answered, its seat and hearth
    // cadence keys' public halves, and the image it judged. The inception door licenses a joint signature by it.
    row({ row: "cofound", home: "seal", under: "", match: /^cofound-([0-9a-f]{64})\.json$/,
          custody: "hot", keyClass: null, writer: "cofound-record" }),

    // The vessel's outbox key (`outbox-key`): minted once, at the first unlocked composition, and handed to the daemon
    // island at each unlock. It seals the outbox's parcels and nothing beside them; it stays on its vessel.
    id({ row: "outbox-key", match: exact(outboxKeyPath()), custody: "hot", keyClass: "device-minted",
         writer: "outbox-key" }),

    // ── outbox: sealed under the outbox key the VK wraps ───────────────────────────────────────
    // The parcels a vessel wrapped for a reader, until the member lane takes them: each sealed whole, its reader
    // inside the seal, under a random name (`sealed-store-rest`). They stay on their vessel.
    row({ row: "sealed-outbox", home: "storage", under: "sealed", match: new RegExp(`^sealed/outbox/${REST_NAME}$`),
          custody: "outbox", keyClass: null, writer: "sealed-store-fs", holds: restFileHolds }),

    // ── cold: sealed under the VK, opened per act ──────────────────────────────────────────────
    id({ row: "persona-root", match: /^\.persona-group-root(?:-[^./]+?)?-h(\d+)\.json$/, custody: "cold", keyClass: "seed",
         writer: "node-vessel-identity", name: (m) => `persona-root-h${m[1]}`, face: faceOf, bundle: "whole" }),
    // One face's proof key at one Nexus, held by the root-holding vessel alone (`face-key-custody`). Its file names
    // the face, so that face's bundle carries it.
    id({ row: "face-proof-key", match: /^face-proof-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/, custody: "cold", keyClass: "seed",
         writer: "face-key-custody", name: (m) => `face-proof-key-h${m[1]}-${m[2]}`, face: faceOf, bundle: "whole" }),
    // A seat's own key, minted at random and apart from every root and leaf (`seat-key-store`). Its file names the
    // face whose seat claim stood for the chair and a digest of the seat's public key. It stays on its vessel: a
    // bundle carries no key of any seat.
    id({ row: "seat-key", match: /^seat-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/, custody: "cold", keyClass: "seed",
         writer: "seat-key-store", name: (m) => `seat-key-h${m[1]}-${m[2]}`, face: faceOf }),
    // A hearth's own cadence key and its next key, minted at random on the device for one joint founding
    // (`cadence-key-store`): apart from every root, leaf, seat and serving or floor key. It stays on its vessel.
    id({ row: "cadence-key", match: /^cadence-key-([0-9a-f]{32})\.bin$/, custody: "cold", keyClass: "device-minted",
         writer: "cadence-key-store", name: (m) => `cadence-key-${m[1]}` }),
    // A restore's own commit row: everything one restore will land, sealed in ONE write before any row moves. It
    // holds a root for the length of that restore and leaves once the face stands lit; no bundle carries it.
    id({ row: "restore-pending", match: file(RESTORE_PENDING_FILE), custody: "cold", keyClass: "seed",
         writer: "face-bundle-restore" }),
    id({ row: "device-share", match: DEVICE_SHARE_FILE, custody: "cold", keyClass: "seed",
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
  return (["identity", "storage", "seal"] as const)
    .flatMap((home) => censusHome(home, homes[home], sealed))
    .map((e) => ({ name: `${e.home}/${e.file}`, path: e.path, keyClass: e.keyClass }));
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
