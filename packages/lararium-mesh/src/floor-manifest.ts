/**
 * floor-manifest — a CID names history-free system snapshots beside the engine CIDs.
 * The floor lends every wiki a read-only oracle-floor face; edits copy into that wiki's
 * working layer. Kit: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane, first slice.
 */

import { getAllChanges, load, save } from "@automerge/automerge";
import { sha256HexBytesSync } from "./crypto.js";
import { pinnedDoc } from "./pinned-doc.js";
import { storedRecord } from "./stored-record.js";
import { plainRecord, type StoredLarRecord } from "./stored-value.js";
import type { LarTiddlerChange, LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";

export const FLOOR_MANIFEST_FORMAT = "lararium-floor/v1";
/** The seed witness row naming the genesis floor's manifest CID (sha256 hex) in its `cid` field, shaped as the region witnesses stand. */
export const GENESIS_FLOOR_TIDDLER = "lar:///ha.ka.ba/bags/oracle/genesis-cid-floor";

export interface FloorManifest {
  readonly format: typeof FLOOR_MANIFEST_FORMAT;
  readonly engine: string;
  readonly grammar: string;
  readonly plugins: string;
  readonly lares: string;
  readonly lararium: string;
}

const MANIFEST_KEYS = ["format", "engine", "grammar", "plugins", "lares", "lararium"] as const;
const HEX64 = /^[0-9a-f]{64}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

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

/** Encode only the fixed fields, in their fixed order. */
export function floorManifestBytes(m: FloorManifest): Uint8Array {
  for (const key of MANIFEST_KEYS) {
    const value = m?.[key];
    if (typeof value !== "string" || value.length === 0 || CONTROL.test(value)) {
      throw new FloorManifestRefusal("floor-manifest-malformed", `Invalid floor manifest field: ${key}`);
    }
  }
  return encoder.encode(JSON.stringify({
    format: m.format, engine: m.engine, grammar: m.grammar,
    plugins: m.plugins, lares: m.lares, lararium: m.lararium,
  }));
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
    if (raw.format !== FLOOR_MANIFEST_FORMAT && typeof raw.format === "string") {
      return { refusal: "floor-manifest-format", reason: `Unknown floor manifest format: ${raw.format}` };
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
    const row = rows[title];
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

export async function resolveFloor(manifestCid: string, resolveByCid: (cid: string) => Promise<Uint8Array | null>): Promise<
  | { readonly manifest: FloorManifest; readonly lares: Readonly<Record<string, LarTiddlerRecord>>; readonly lararium: Readonly<Record<string, LarTiddlerRecord>> }
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
    const laresBytes = await resolveByCid(manifest.lares);
    if (!laresBytes) return { refusal: "floor-absent", reason: `Lares snapshot absent: ${manifest.lares}` };
    const lares = openFloorSnapshot(laresBytes, manifest.lares);
    if ("refusal" in lares) return lares;
    const larariumBytes = await resolveByCid(manifest.lararium);
    if (!larariumBytes) return { refusal: "floor-absent", reason: `Lararium snapshot absent: ${manifest.lararium}` };
    const lararium = openFloorSnapshot(larariumBytes, manifest.lararium);
    if ("refusal" in lararium) return lararium;
    return { manifest, lares: lares.rows, lararium: lararium.rows };
  } catch (error) {
    return { refusal: "floor-absent", reason: String(error) };
  }
}

export function floorReadFace(opts: {
  readonly rows: readonly Readonly<Record<string, LarTiddlerRecord>>[];
  readonly base?: LarTiddlerStore;
}): LarTiddlerStore {
  const rowFor = (title: string): LarTiddlerRecord | null => {
    for (const rows of opts.rows) if (Object.hasOwn(rows, title)) return rows[title] ?? null;
    return null;
  };
  const shadows = (title: string): boolean => opts.rows.some((rows) => Object.hasOwn(rows, title));
  const baseReader = opts.base as (LarTiddlerStore & { readNow?: (title: string) => { record: LarTiddlerRecord | null; heads?: readonly string[] } }) | undefined;
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
      return opts.base?.subscribe((change) => { if (!shadows(change.title)) fn(change); }) ?? (() => {});
    },
    async getHeads() { return null; },
  };
}
