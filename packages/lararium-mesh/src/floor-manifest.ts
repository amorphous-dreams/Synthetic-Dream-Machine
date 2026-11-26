/**
 * floor-manifest — a CID names one history-free snapshot per house-canon bag beside the engine digest and the plugins offering
 * (`lararium-floor`: `snapshots` keyed by slug; a manifest that names any other format refuses by naming the shape it
 * lacks). The floor lends every wiki a read-only oracle-floor face; edits copy into that wiki's
 * working layer. Kit: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane, first slice.
 */

import { getAllChanges, load, save } from "@automerge/automerge";
import { sha256HexBytesSync } from "./crypto.js";
import { pinnedDoc } from "./pinned-doc.js";
import { storedRecord } from "./stored-record.js";
import { plainRecord, ownEntry, hasOwnEntry, type StoredLarRecord } from "./stored-value.js";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";
import { docPrototypeKeyFault } from "./prototype-key-shore.js";
import { SYSTEM_CANON_SLUGS } from "./kahu-canon-reach.js";
import { bagUri } from "./lar-uris.js";
import { floorCarriesTier } from "./cap-tier.js";
import type { PluginOffering } from "./plugin-offering.js";

/** The floor manifest's shape name. It carries no counter: a shape reads by its fields, and its bytes name it (the CID). */
import { FLOOR_MANIFEST_FORMAT } from "./wire-names.js";
export { FLOOR_MANIFEST_FORMAT };
/** The seed witness row naming the genesis floor's manifest CID (sha256 hex) in its `cid` field, shaped as the region witnesses stand. */
export const GENESIS_FLOOR_TIDDLER = "lar:///ha.ka.ba/bags/oracle/genesis-cid-floor";
/** The snapshots every floor carries: the system canon, house canon on every vessel. */
export const FLOOR_REQUIRED_SLUGS: readonly string[] = SYSTEM_CANON_SLUGS;

// THE FLOOR CARRIES PUBLIC BAGS ALONE: the law rests beside the tier order (`cap-tier.ts`), so a pure reader reaches it too.
export { floorCarriesTier };

/** The mime the plugins offering record rides in a seed's blob rows: never `application/json`, so it never loads as a boot plugin. */
export const FLOOR_OFFERING_MIME = "application/vnd.lararium.plugin-offering+json";
/** The seed blob row id the genesis floor's plugins offering record stands under. */
export const FLOOR_OFFERING_BLOB_ID = "floor-plugin-offering";

/** Null where `offered` names exactly the {id, sha256} pairs of `mount`, else the first id that differs. Pure. */
export function floorOfferingSetDiff(
  offered: readonly { readonly id: string; readonly sha256: string }[],
  mount: readonly { readonly id: string; readonly sha256: string }[],
): string | null {
  const want = new Map(mount.map((r) => [r.id, r.sha256]));
  const have = new Map(offered.map((r) => [r.id, r.sha256]));
  for (const [id, sha] of want) if (have.get(id) !== sha) return `${id} ${have.has(id) ? "carries other bytes" : "rides the mount but not the offering"}`;
  for (const id of have.keys()) if (!want.has(id)) return `${id} rides the offering but not the mount`;
  return null;
}

/**
 * A floor manifest keys ONE snapshot per house-canon bag (`houseCanonSlugs`), encoded with its slugs sorted; `lares` and
 * `lararium` always stand in it. Beside them: `engine`, the core's folded digest, and `plugins`, the CAS address (sha256 hex)
 * of ONE signed PluginOffering record carrying every non-core blob a mount loads (`floor-offering.ts`), so a release's bytes
 * travel with it. The floor names no grammar: the parser's bytes ride in the offering, and the formal grammar rides canon.
 */
export interface FloorManifest {
  readonly format: typeof FLOOR_MANIFEST_FORMAT;
  readonly engine: string;
  readonly plugins: string;
  readonly snapshots: Readonly<Record<string, string>>;
}

const MANIFEST_KEYS = ["format", "engine", "plugins", "snapshots"] as const;
const SCALAR_KEYS = ["format", "engine", "plugins"] as const;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const HEX64 = /^[0-9a-f]{64}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

/** What a manifest naming another format lacks: the floor's own format name, over one snapshot per house-canon bag. */
function formatLack(format: unknown): string {
  return `Floor manifest names the format ${JSON.stringify(format)}, not ${JSON.stringify(FLOOR_MANIFEST_FORMAT)}: it lacks the floor shape, one snapshot per house-canon bag under \`snapshots\``;
}

export class FloorManifestRefusal extends Error {
  readonly code: string;
  constructor(code: string, reason: string) {
    super(reason);
    this.name = "FloorManifestRefusal";
    this.code = code;
  }
}

export class FloorWriteRefusal extends Error {
  readonly code = "floor-write" as const;
  readonly title: string;
  constructor(title: string) {
    super(`The floor takes no write for "${title}"; the edit copies up into the wiki's own working layer.`);
    this.name = "FloorWriteRefusal";
    this.title = title;
  }
}

/** The manifest's slugs, sorted: the order its bytes encode and every reader walks. */
export function floorSlugs(m: FloorManifest): string[] {
  return Object.keys(m.snapshots).sort();
}

/** Encode only the fixed fields, in their fixed order, the snapshot slugs sorted. */
export function floorManifestBytes(m: FloorManifest): Uint8Array {
  for (const key of SCALAR_KEYS) {
    const value = m?.[key];
    if (typeof value !== "string" || value.length === 0 || CONTROL.test(value)) {
      throw new FloorManifestRefusal("floor-manifest-malformed", `Invalid floor manifest field: ${key}`);
    }
  }
  if (m.format !== FLOOR_MANIFEST_FORMAT) throw new FloorManifestRefusal("floor-manifest-format", formatLack(m.format));
  if (!HEX64.test(m.plugins)) throw new FloorManifestRefusal("floor-manifest-malformed", "Invalid floor manifest field: plugins names no offering record's CAS address (sha256 hex)");
  const snaps = m.snapshots;
  if (snaps === null || typeof snaps !== "object" || Array.isArray(snaps)) {
    throw new FloorManifestRefusal("floor-manifest-malformed", "Invalid floor manifest field: snapshots");
  }
  const snapshots: Record<string, string> = {};
  for (const slug of Object.keys(snaps).sort()) {
    const cid = (snaps as Record<string, unknown>)[slug];
    if (!SLUG.test(slug) || typeof cid !== "string" || cid.length === 0 || CONTROL.test(cid)) {
      throw new FloorManifestRefusal("floor-manifest-malformed", `Invalid floor manifest snapshot: ${slug}`);
    }
    snapshots[slug] = cid;
  }
  for (const slug of FLOOR_REQUIRED_SLUGS) {
    if (!Object.hasOwn(snapshots, slug)) throw new FloorManifestRefusal("floor-manifest-malformed", `Floor manifest names no ${slug} snapshot`);
  }
  return encoder.encode(JSON.stringify({ format: m.format, engine: m.engine, plugins: m.plugins, snapshots }));
}

export function floorManifestCid(m: FloorManifest): string {
  return sha256HexBytesSync(floorManifestBytes(m));
}

export function readFloorManifest(bytes: Uint8Array):
  | { readonly manifest: FloorManifest }
  | { readonly refusal: "floor-manifest-format" | "floor-manifest-malformed"; readonly reason: string } {
  try {
    const value: unknown = JSON.parse(decoder.decode(bytes));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Manifest must hold one object");
    const raw = value as Record<string, unknown>;
    // EVERY OTHER FORMAT REFUSES BY THE SHAPE IT LACKS: a floor names its format `lararium-floor` and keys one snapshot per
    // house-canon bag, and no reader folds a manifest named or keyed any other way.
    if (raw.format !== FLOOR_MANIFEST_FORMAT && typeof raw.format === "string") {
      return { refusal: "floor-manifest-format", reason: formatLack(raw.format) };
    }
    if (Object.hasOwn(raw, "grammar")) {
      throw new Error("Manifest names a grammar field: a floor carries none, and the parser's bytes ride in the plugins offering");
    }
    if (Object.keys(raw).length !== MANIFEST_KEYS.length || MANIFEST_KEYS.some((key) => !Object.hasOwn(raw, key))) {
      throw new Error("Manifest fields differ from the fixed format");
    }
    const canonical = floorManifestBytes(raw as unknown as FloorManifest);
    if (canonical.length !== bytes.length || canonical.some((byte, i) => byte !== bytes[i])) {
      throw new Error("Manifest bytes differ from canonical encoding");
    }
    return { manifest: raw as unknown as FloorManifest };
  } catch (error) {
    return { refusal: "floor-manifest-malformed", reason: String(error) };
  }
}

export interface FloorSnapshot { readonly cid: string; readonly bytes: Uint8Array }

/** Canonicalize map insertion order at every depth before Automerge records its operations. */
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, field]) => [key, ordered(field)]));
  }
  return value;
}

export function cutFloorSnapshot(rows: Readonly<Record<string, LarTiddlerRecord>>): FloorSnapshot {
  const tiddlers: Record<string, StoredLarRecord> = {};
  for (const title of Object.keys(rows).sort()) {
    const row = ownEntry(rows, title);
    if (!row || row.tiddler?.title !== title) {
      throw new FloorManifestRefusal("floor-snapshot-malformed", `Snapshot title differs from row: ${title}`);
    }
    tiddlers[title] = storedRecord(ordered(row) as LarTiddlerRecord);
  }
  const bytes = save(pinnedDoc({ tiddlers }));
  return { cid: sha256HexBytesSync(bytes), bytes };
}

export function openFloorSnapshot(bytes: Uint8Array, cid: string):
  | { readonly rows: Readonly<Record<string, LarTiddlerRecord>> }
  | { readonly refusal: "floor-snapshot-cid-mismatch" | "floor-snapshot-malformed"; readonly reason: string } {
  try {
    if (!HEX64.test(cid) || sha256HexBytesSync(bytes) !== cid) {
      return { refusal: "floor-snapshot-cid-mismatch", reason: "Snapshot bytes differ from their CID" };
    }
    const doc = load<Record<string, unknown>>(bytes);
    // A prototype key refuses ahead of every by-key read (`prototype-key-shore.ts`; KEEP: a live hostile form).
    const poisoned = docPrototypeKeyFault(doc);
    if (poisoned) throw new Error(`prototype-key: ${poisoned}`);
    if (getAllChanges(doc).length !== 1 || Object.keys(doc).length !== 1 || !Object.hasOwn(doc, "tiddlers")) {
      throw new Error("Snapshot must hold one pinned change and its tiddlers map");
    }
    const raw = doc.tiddlers;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Snapshot tiddlers must hold a map");
    const rows: Record<string, LarTiddlerRecord> = {};
    for (const [title, value] of Object.entries(raw)) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`Malformed snapshot row: ${title}`);
      const fields = value as Record<string, unknown>;
      if (!Object.hasOwn(fields, "tiddler") || Object.keys(fields).some((key) => key !== "tiddler" && key !== "meta")) {
        throw new Error(`Malformed snapshot row: ${title}`);
      }
      const row = plainRecord(value as StoredLarRecord);
      if (row.tiddler.title !== title || (fields.meta !== undefined &&
        (fields.meta === null || typeof fields.meta !== "object" || Array.isArray(fields.meta)))) {
        throw new Error(`Snapshot title differs from row: ${title}`);
      }
      rows[title] = row;
    }
    // The CID binds these bytes and the load proves one pinned change over one tiddlers map, so no
    // re-cut stands here: every island pays this open at each mount.
    return { rows };
  } catch (error) {
    return { refusal: "floor-snapshot-malformed", reason: String(error) };
  }
}

/**
 * THE ROW A FLOOR CUTS FROM ONE LIVE CANON RECORD: its `tiddler` fields alone, the residency stamps (`bag`, `$origin-bag`) and
 * absent fields left out, and null for a tombstone. One form for the cut (`cutCanonFloor`) and every reader that weighs live
 * canon against a snapshot (`readFloorDrift`), so the two never disagree about what a moved row means.
 */
export function floorRowOf(title: string, record: LarTiddlerRecord | null | undefined): LarTiddlerRecord | null {
  if (!record || record.meta?.deleted === true) return null;
  const tiddler: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record.tiddler as Record<string, unknown>)) {
    if (k === "bag" || k === "$origin-bag" || v === undefined || v === null) continue;
    tiddler[k] = Array.isArray(v) ? [...v] : v;
  }
  return { tiddler: { ...tiddler, title } as LarTiddlerRecord["tiddler"] };
}

/**
 * CUT A FLOOR FROM LIVE CANON: a fresh snapshot for each slug whose rows the caller read off its canon document (a promotion's
 * writes among them), every other slug keeping the prior floor's snapshot, and the engine CIDs carried from the prior manifest.
 * A live row keeps its `tiddler` fields alone (meta, residency stamps and tombstones stay out), so one canon cuts one CID on
 * every vessel; the floor the release names is the floor a reader resolves. It writes nothing: the caller stages the blobs.
 */
export function cutCanonFloor(args: {
  readonly prior: FloorManifest;
  readonly canon: Readonly<Record<string, Readonly<Record<string, LarTiddlerRecord>>>>;
  /** Slugs the prior floor names that this cut leaves off (a bag whose declared tier rides no floor of this cut, `floorCarriesTier`). */
  readonly drop?: readonly string[];
  /** The engine digest this vessel's genesis names. A prior whose engine differs refuses `floor-engine-unoffered`: no cut offers an engine. */
  readonly genesisEngine?: string;
}): { readonly manifest: FloorManifest; readonly manifestCid: string; readonly manifestBytes: Uint8Array; readonly snapshots: Readonly<Record<string, FloorSnapshot>> } {
  if (args.genesisEngine !== undefined && args.prior.engine !== args.genesisEngine) {
    throw new FloorManifestRefusal("floor-engine-unoffered", `The prior floor names engine ${args.prior.engine}, not the ${args.genesisEngine} this genesis names; a canon cut carries the engine and never offers one`);
  }
  const snapshots: Record<string, FloorSnapshot> = {};
  const cids: Record<string, string> = { ...args.prior.snapshots };
  for (const slug of args.drop ?? []) delete cids[slug];
  for (const slug of Object.keys(args.canon).sort()) {
    if (!SLUG.test(slug)) throw new FloorManifestRefusal("floor-manifest-malformed", `Invalid floor manifest snapshot: ${slug}`);
    const rows: Record<string, LarTiddlerRecord> = {};
    for (const [title, record] of Object.entries(args.canon[slug]!)) {
      const row = floorRowOf(title, record);
      if (row) rows[title] = row;
    }
    snapshots[slug] = cutFloorSnapshot(rows);
    cids[slug] = snapshots[slug]!.cid;
  }
  const manifest: FloorManifest = { format: args.prior.format, engine: args.prior.engine, plugins: args.prior.plugins, snapshots: cids };
  const manifestBytes = floorManifestBytes(manifest);
  return { manifest, manifestCid: sha256HexBytesSync(manifestBytes), manifestBytes, snapshots };
}

/** A floor resolved whole: its manifest and each slug's snapshot rows, keyed by the manifest's slugs. */
export interface ResolvedFloor {
  readonly manifest: FloorManifest;
  readonly snapshots: Readonly<Record<string, Readonly<Record<string, LarTiddlerRecord>>>>;
}

export async function resolveFloor(manifestCid: string, resolveByCid: (cid: string) => Promise<Uint8Array | null>): Promise<
  | ResolvedFloor
  | { readonly refusal: "floor-absent" | "floor-manifest-format" | "floor-manifest-malformed" | "floor-snapshot-cid-mismatch" | "floor-snapshot-malformed"; readonly reason: string }> {
  try {
    const manifestBytes = await resolveByCid(manifestCid);
    if (!manifestBytes) return { refusal: "floor-absent", reason: `Floor manifest absent: ${manifestCid}` };
    if (!HEX64.test(manifestCid) || sha256HexBytesSync(manifestBytes) !== manifestCid) {
      return { refusal: "floor-manifest-malformed", reason: "Floor manifest bytes differ from their CID" };
    }
    const opened = readFloorManifest(manifestBytes);
    if ("refusal" in opened) return opened;
    const { manifest } = opened;
    const snapshots: Record<string, Readonly<Record<string, LarTiddlerRecord>>> = {};
    for (const slug of floorSlugs(manifest)) {
      const cid = manifest.snapshots[slug]!;
      const bytes = await resolveByCid(cid);
      if (!bytes) return { refusal: "floor-absent", reason: `Floor snapshot ${slug} absent: ${cid}` };
      const snap = openFloorSnapshot(bytes, cid);
      if ("refusal" in snap) return { refusal: snap.refusal, reason: `${slug}: ${snap.reason}` };
      snapshots[slug] = snap.rows;
    }
    return { manifest, snapshots };
  } catch (error) {
    return { refusal: "floor-absent", reason: String(error) };
  }
}

/**
 * The CIDs a floor names: the manifest's own, each snapshot's (slugs sorted) and the plugins offering record's; handed the
 * offering that record holds, each blob it carries too (sorted by id, each CID once). A caller holding no offering bytes
 * still names the record, and a reader that resolves it widens to the blobs.
 */
export function floorBlobCids(manifestCid: string, m: FloorManifest, offering?: Pick<PluginOffering, "blobs">): string[] {
  const cids = [manifestCid, ...floorSlugs(m).map((slug) => m.snapshots[slug]!), m.plugins];
  const seen = new Set(cids);
  const blobs = [...(offering?.blobs ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const blob of blobs) if (!seen.has(blob.sha256)) { seen.add(blob.sha256); cids.push(blob.sha256); }
  return cids;
}

/** Each snapshot's rows in the manifest's slug order: the read-only layers the oracle floor stacks. */
export function floorRecordsInOrder(floor: ResolvedFloor): Readonly<Record<string, LarTiddlerRecord>>[] {
  return floorSlugs(floor.manifest).map((slug) => floor.snapshots[slug]!);
}

/**
 * A BAG'S OWN SNAPSHOT OFF A RESOLVED FLOOR, by bag uri (`lar:///ha.ka.ba/bags/<slug>`): the rows of the one slug the manifest
 * names, or null where the floor carries no snapshot of it. The oracle's read face stacks every snapshot into one layer; a door
 * that reads ONE house canon bag from the floor (a face that holds no read on the live document) asks here.
 */
export function floorCanonReader(floor: ResolvedFloor): (bag: string) => Readonly<Record<string, LarTiddlerRecord>> | null {
  const prefix = bagUri("");
  return (bag) => {
    const slug = bag.startsWith(prefix) ? bag.slice(prefix.length) : "";
    return slug.length > 0 && hasOwnEntry(floor.snapshots, slug) ? floor.snapshots[slug]! : null;
  };
}

export function floorReadFace(opts: {
  readonly rows: readonly Readonly<Record<string, LarTiddlerRecord>>[];
  readonly base?: LarTiddlerStore;
  /** The slot this face stands in: every change it tells carries it, as a doc slot's own replay does. */
  readonly bagId?: string;
}): LarTiddlerStore & { emitInitialReplay(): void; markSyncComplete(): void } {
  const rowFor = (title: string): LarTiddlerRecord | null => {
    for (const rows of opts.rows) if (hasOwnEntry(rows, title)) return ownEntry(rows, title) ?? null;
    return null;
  };
  const shadows = (title: string): boolean => opts.rows.some((rows) => hasOwnEntry(rows, title));
  const baseReader = opts.base as (LarTiddlerStore & { readNow?: (title: string) => { record: LarTiddlerRecord | null; heads?: readonly string[] } }) | undefined;
  const replaying = opts.base as (LarTiddlerStore & { emitInitialReplay?: () => void; markSyncComplete?: () => void }) | undefined;
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: opts.bagId ?? "oracle-floor" };
  return {
    async get(title) { return shadows(title) ? rowFor(title) : (opts.base?.get(title) ?? null); },
    ...(typeof baseReader?.readNow === "function" ? {
      readNow(title: string) { return shadows(title) ? { record: rowFor(title) } : baseReader.readNow!(title); },
    } : {}),
    async listVisible() {
      const seen = new Set<string>();
      const visible: string[] = [];
      for (const rows of opts.rows) for (const [title, record] of Object.entries(rows)) {
        if (seen.has(title)) continue;
        seen.add(title);
        if (!record.meta?.deleted) visible.push(title);
      }
      for (const title of await opts.base?.listVisible() ?? []) {
        if (seen.has(title)) continue;
        seen.add(title);
        const record = await opts.base!.get(title);
        if (record && !record.meta?.deleted) visible.push(title);
      }
      return visible;
    },
    async put(record) { throw new FloorWriteRefusal(record.tiddler.title); },
    async tombstone(title) { throw new FloorWriteRefusal(title); },
    async remove(title) { throw new FloorWriteRefusal(title); },
    subscribe(fn: (change: LarTiddlerChange) => void) {
      listeners.add(fn);
      const off = opts.base?.subscribe((change) => { if (!shadows(change.title)) fn(change); }) ?? (() => {});
      return () => { listeners.delete(fn); off(); };
    },
    // THE FLOOR REACHES THE WIKI: the recipe replays each slot to the projections it fans (the island adaptor that lands records
    // in the engine), and the face replays its pinned rows first-wins, then the live seed's replay beneath, filtered of every title
    // a floor row shadows. Without it the floor read through the composite and never landed in an engine.
    emitInitialReplay() {
      const seen = new Set<string>();
      for (const rows of opts.rows) for (const [title, record] of Object.entries(rows)) {
        if (seen.has(title)) continue;
        seen.add(title);
        if (record.meta?.deleted) continue;
        const change: LarTiddlerChange = { title, record, origin, ...(opts.bagId !== undefined ? { bag: opts.bagId } : {}) };
        for (const fn of [...listeners]) fn(change);
      }
      replaying?.emitInitialReplay?.();
    },
    markSyncComplete() { replaying?.markSyncComplete?.(); },
    async getHeads() { return null; },
  };
}
