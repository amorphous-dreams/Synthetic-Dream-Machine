/**
 * vault-carriers — THE ONE CARRIER TABLE. Every carrier a vessel keeps at rest names its home, its custody
 * class, its secret kind and its writer in exactly one row here.
 *
 * ── FOUR CUSTODY CLASSES, NO FIFTH ──────────────────────────────────────────────────────────────
 *   `floor`       — outside the vessel KEK (VK): the floor key, its own log, and the slot tree that wraps the
 *                   VK. The floor signs and unlocks before any VK opens, so nothing here may need one.
 *   `floor-plain` — plain bytes the floor reads (the gate, the arrival page, the raise door), or bytes public
 *                   by construction. Sealing them would lock the floor out of its own door.
 *   `hot`         — sealed under the VK, opened once at unlock and held for the process life.
 *   `cold`        — sealed under the VK, opened for one act and then dropped.
 * A private file the floor never reads rides `hot`: sealing costs it nothing and closes the social graph
 * at rest (petnames, circles, the handle book, the anchors).
 *
 * ── ROWS SPAN HOMES, NOT ONE DIRECTORY ──────────────────────────────────────────────────────────
 * A row names its home (`identity` · `storage` · `seal`), the subtree it lives under, and a matcher over the
 * path relative to that home. The storage directory's `hosting/` and `walk/` subtrees and the seal home's
 * charters, consents and admits stand here beside the identity home's keys, so the census sees what a
 * stolen disk would. The census walks only the subtrees some row names: the Automerge store's own chunks
 * never enter it.
 *
 * ── ONE TABLE, EVERY READER DERIVES ─────────────────────────────────────────────────────────────
 * The key census (`key-class`), the passphrase seal lifecycle (`vaultCarriers`, read by `archive-passphrase`)
 * and the custody shape reader (`custody-shape`) all read these rows. A second list of filenames anywhere
 * else would drift from this one, and the drift costs in both directions: a carrier a sweep omits stays
 * unsealed while the sweep reports success; a carrier a sweep invents gets written over by an act nobody
 * owns.
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

import { readdirSync, type Dirent } from "node:fs";
import { basename, join } from "node:path";
import { rotateVk, type CustodyIo, type KeyClass, type SealedCarrier, type SlotSpec, type SlotTree, type VesselKey } from "@lararium/mesh";
import { custodyRootPath } from "./custody-root.js";
import { archivePath, veilArchivePath } from "./identity-anchors.js";
import { reserveMineSharePath } from "./seal-reserve-store.js";
import { deviceSharePath } from "./recovery-share-store.js";
import { larDataDir, larIdentityDir, larSealHome } from "./vessel-paths.js";

/** The custody classes, closed. */
export const CUSTODY_CLASSES = ["floor", "floor-plain", "hot", "cold"] as const;
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

/** The homes the running vessel's own resolvers name. */
export function vesselCustodyHomes(): CustodyHomes {
  return { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
}

/**
 * A passphrase seal lifecycle carrier's name. Three are singletons and one names a family: a vessel wearing
 * several personas splits each persona-root on its own, so every handle-index's device share is its own
 * carrier. The name carries the index because h0's quorum leg and h1's are different secrets.
 */
export type DeviceShareName = `device-share-h${number}`;
export type CarrierName = "archive" | "veil" | "reserve-share" | DeviceShareName;

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
  /** The passphrase seal lifecycle carrier this match is, or null when that lifecycle does not govern it. */
  readonly lifecycle: ((m: RegExpExecArray) => CarrierName | null) | null;
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
  readonly lifecycle: CarrierName | null;
}

/** The device-share filename law, read back: the family's spelling in `recovery-share-store`. */
export const DEVICE_SHARE_FILE = /^recovery-device-share-h(\d+)\.bin$/;

export function deviceShareName(handleIndex: number): DeviceShareName {
  return `device-share-h${handleIndex}`;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A filename the writer's own path function spells. */
const exact = (path: string): RegExp => new RegExp(`^${escape(basename(path))}$`);
/** A login-keyed identity filename: `.<stem>.json` or `.<stem>-<login>.json`. */
const loginKeyed = (stem: string): RegExp => new RegExp(`^\\.${escape(stem)}(?:-[^./]+)?\\.json$`);
/** A plain filename. */
const file = (name: string): RegExp => new RegExp(`^${escape(name)}$`);
/** A hosting directory: `hosting/<the 32-hex digest of a Nexus AID>/`. */
const HOSTING = "hosting/[0-9a-f]{32}/";

type RowSpec = Omit<CarrierRow, "name" | "lifecycle"> & Partial<Pick<CarrierRow, "name" | "lifecycle">>;

function row(spec: RowSpec): CarrierRow {
  return Object.freeze({ name: () => spec.row, lifecycle: null, ...spec });
}

function buildTable(): readonly CarrierRow[] {
  const id = (r: Omit<RowSpec, "home" | "under">): CarrierRow => row({ home: "identity", under: "", ...r });
  return Object.freeze([
    // ── floor: outside the VK ──────────────────────────────────────────────────────────────────
    id({ row: "vessel-key", match: loginKeyed("vessel-key"), custody: "floor", keyClass: "device-minted",
         writer: "node-vessel-identity (founding)" }),
    id({ row: "vessel-kel", match: loginKeyed("vessel-kel"), custody: "floor", keyClass: null,
         writer: "node-vessel-identity (founding)" }),
    id({ row: "vk-slots", match: exact(vkSlotsPath()), custody: "floor", keyClass: null,
         writer: "vault bind" }),

    // ── floor-plain: the floor reads it, or it reads public ────────────────────────────────────
    id({ row: "vessel-card", match: loginKeyed("vessel-card"), custody: "floor-plain", keyClass: null,
         writer: "node-vessel-identity (founding)" }),
    row({ row: "charter", home: "seal", under: "", match: file("founding-roster.mem"), custody: "floor-plain",
          keyClass: null, writer: "nexus seal" }),
    row({ row: "carried-charter", home: "seal", under: "carried", match: /^carried\/[A-Za-z0-9][A-Za-z0-9._-]*\/founding-roster\.mem$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set" }),
    row({ row: "carriage-consent", home: "seal", under: "nexus", match: /^nexus\/carriage-consent\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "carried-set" }),
    row({ row: "carriage-admit", home: "seal", under: "nexus", match: /^nexus\/carriage-admit\/[^/]+\.json$/,
          custody: "floor-plain", keyClass: null, writer: "admit-bundle" }),

    // ── hot: sealed under the VK, opened at unlock ─────────────────────────────────────────────
    id({ row: "custody-root", match: exact(custodyRootPath()), custody: "hot", keyClass: "device-minted",
         writer: "custody-root (founding)" }),
    id({ row: "keyhive-archive", match: exact(archivePath()), custody: "hot", keyClass: "device-minted",
         writer: "identity-anchors", lifecycle: () => "archive" }),
    id({ row: "veil-archive", match: exact(veilArchivePath()), custody: "hot", keyClass: "device-minted",
         writer: "identity-anchors", name: () => "veil", lifecycle: () => "veil" }),
    id({ row: "keyring", match: file(".nexus-convergence-secrets.json"), custody: "hot", keyClass: null,
         writer: "nexus-convergence-secret-store" }),
    id({ row: "enroll-pending", match: file(".persona-enroll-pending.json"), custody: "hot", keyClass: null,
         writer: "node-persona-admit-store" }),
    id({ row: "grant-pending", match: file(".persona-grant-pending.json"), custody: "hot", keyClass: null,
         writer: "node-persona-admit-store" }),
    id({ row: "admissions", match: file(".persona-admissions.json"), custody: "hot", keyClass: null,
         writer: "node-persona-admit-store" }),
    id({ row: "anchors", match: /^anchors-h\d+\.json$/, custody: "hot", keyClass: null,
         writer: "identity-anchors" }),
    id({ row: "anchor-roster", match: file("anchor-roster.json"), custody: "hot", keyClass: null,
         writer: "identity-anchors" }),
    id({ row: "persona-roster", match: loginKeyed("persona-roster"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    id({ row: "active-persona", match: loginKeyed("active-persona"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    id({ row: "persona-petnames", match: loginKeyed("persona-petnames"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    id({ row: "persona-declarations", match: loginKeyed("persona-declarations"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    id({ row: "public-handles", match: loginKeyed("persona-public-handles"), custody: "hot", keyClass: null,
         writer: "node-vessel-identity" }),
    id({ row: "circles", match: file(".circles-follow.json"), custody: "hot", keyClass: null,
         writer: "node-circle-store" }),
    id({ row: "handle-book", match: file(".handle-book.json"), custody: "hot", keyClass: null,
         writer: "node-circle-store" }),
    id({ row: "reserve-state", match: file("seal-reserve-state.json"), custody: "hot", keyClass: null,
         writer: "seal-reserve-store" }),
    id({ row: "seal-day", match: file(".archive-seal-day.json"), custody: "hot", keyClass: null,
         writer: "vault seal (the seal-day stamp)" }),
    row({ row: "hosting-state", home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}state\\.json$`),
          custody: "hot", keyClass: null, writer: "hosting-store" }),
    row({ row: "hosting-spent", home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}spent-[^/]+$`),
          custody: "hot", keyClass: null, writer: "hosting-store" }),
    row({ row: "hosting-carry", home: "storage", under: "hosting", match: new RegExp(`^${HOSTING}carry/.+$`),
          custody: "hot", keyClass: null, writer: "hosting-carry" }),
    row({ row: "walk", home: "storage", under: "walk", match: /^walk\/[^/]+\.json$/,
          custody: "hot", keyClass: null, writer: "node-walk-store" }),
    row({ row: "transition-pending", home: "seal", under: "", match: file("transition-pending.json"),
          custody: "hot", keyClass: null, writer: "nexus seal" }),
    row({ row: "transitions", home: "seal", under: "", match: file("transitions.json"),
          custody: "hot", keyClass: null, writer: "nexus seal" }),

    // ── cold: sealed under the VK, opened per act ──────────────────────────────────────────────
    id({ row: "vessel-next", match: loginKeyed("vessel-next"), custody: "cold", keyClass: "device-minted",
         writer: "node-vessel-identity (founding)" }),
    id({ row: "persona-root", match: /^\.persona-group-root(?:-[^./]+?)?-h(\d+)\.json$/, custody: "cold", keyClass: "seed",
         writer: "node-vessel-identity", name: (m) => `persona-root-h${m[1]}` }),
    id({ row: "device-share", match: DEVICE_SHARE_FILE, custody: "cold", keyClass: "seed",
         writer: "recovery-share-store", name: (m) => `recovery-device-share-h${m[1]}`,
         lifecycle: (m) => (Number.isSafeInteger(Number(m[1])) ? deviceShareName(Number(m[1])) : null) }),
    id({ row: "reserve-share", match: exact(reserveMineSharePath()), custody: "cold", keyClass: "seed",
         writer: "seal-reserve-store", name: () => "seal-reserve-mine-share", lifecycle: () => "reserve-share" }),
  ]);
}

let table: readonly CarrierRow[] | null = null;

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

/** The census of one home: every file a row names, first matching row wins (the table stays disjoint). */
function censusHome(home: CustodyHome, dir: string): CarrierEntry[] {
  const rows = carrierTable().filter((r) => r.home === home);
  const out: CarrierEntry[] = [];
  for (const under of [...new Set(rows.map((r) => r.under))]) {
    const scoped = rows.filter((r) => r.under === under);
    for (const rel of listFiles(dir, under, under !== "")) {
      for (const r of scoped) {
        const m = r.match.exec(rel);
        if (!m) continue;
        const lifecycle = r.lifecycle ? r.lifecycle(m) : null;
        out.push({
          row: r.row, name: r.name(m), home, file: rel, path: join(dir, ...rel.split("/")),
          custody: r.custody, keyClass: r.keyClass, lifecycle,
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

/** The identity home's carriers alone — the key census and the seal lifecycle ask this home only. */
export function identityCarrierCensus(identityDir: string): CarrierEntry[] {
  return censusHome("identity", identityDir);
}

// ── the VK-sealed carriers, derived from the rows ────────────────────────────────────────────────

/** Every hot and cold carrier standing in `homes`, as the sealed writer names it: `<home>/<file>`. */
export function vkSealedCarriers(homes: CustodyHomes): SealedCarrier[] {
  return carrierCensus(homes)
    .filter((e) => e.custody === "hot" || e.custody === "cold")
    .map((e) => ({ name: `${e.home}/${e.file}`, path: e.path }));
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

// ── the passphrase seal lifecycle, derived from the rows ─────────────────────────────────────────

export interface VaultCarrier {
  readonly name: CarrierName;
  readonly path: string;
}

/**
 * Every file in `identityDir` the passphrase seal lifecycle governs, mapped to the carrier it is. The key
 * census and `vaultCarriers` both read this, so neither can name a carrier the other misses.
 */
export function vaultCarrierMap(identityDir: string): ReadonlyMap<string, CarrierName> {
  const out = new Map<string, CarrierName>();
  for (const e of censusHome("identity", identityDir)) {
    if (e.lifecycle) out.set(e.file, e.lifecycle);
  }
  return out;
}

/** Just the governed filenames in `identityDir`. */
export function vaultCarrierFiles(identityDir: string): ReadonlySet<string> {
  return new Set(vaultCarrierMap(identityDir).keys());
}

/** Every device-share carrier standing on disk, ascending by handle-index. */
export function deviceShareCarriers(): readonly VaultCarrier[] {
  const indices: number[] = [];
  for (const f of vaultCarrierMap(larIdentityDir()).keys()) {
    const m = DEVICE_SHARE_FILE.exec(f);
    if (m && Number.isSafeInteger(Number(m[1]))) indices.push(Number(m[1]));
  }
  return indices.sort((a, b) => a - b)
    .map((index) => ({ name: deviceShareName(index), path: deviceSharePath(index) }));
}

/** The passphrase-sealed carriers, in a FIXED order (the rename sequence the ratify flow commits in). */
export function vaultCarriers(): readonly VaultCarrier[] {
  return [
    { name: "archive",       path: archivePath() },
    { name: "veil",          path: veilArchivePath() },
    ...deviceShareCarriers(),
    { name: "reserve-share", path: reserveMineSharePath() },
  ];
}
