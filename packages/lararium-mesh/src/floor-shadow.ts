/**
 * floor-shadow — the shadow read (backlog-awakens 3a): a mount still serves the founding record (the island), and beside it
 * reads the floor it stands on (the vessel's pin, or the genesis floor the founding record names), recomputes the three
 * folded digests from the founding record's own blobs, and compares them with the manifest's `engine`, `grammar` and
 * `plugins` fields. It only reads: a mismatch names each field that moved, absent or unreadable manifest bytes read
 * `unread` by name, and nothing throws. The tally counts boots so the operator can read the flip condition ("floor shadow:
 * clean across N boots", or the first mismatch named) before mounts move to reading the floor.
 *
 * The recompute folds through `genesis-doc.ts`'s own compute functions, mapping blobs as `verifyGenesisArtifact` maps them,
 * so the mint and this read fold one rule.
 */
import { ENGINE_CORE_ID, type LarBlobEntry } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";
import { sha256HexBytesSync } from "./crypto.js";
import { readFloorManifest } from "./floor-manifest.js";
import { computeEngineCid, computeGrammarCid, computePluginsCid } from "./genesis-doc.js";

export type FloorShadowField = "engine" | "grammar" | "plugins";
const FIELDS: readonly FloorShadowField[] = ["engine", "grammar", "plugins"];
const HEX64 = /^[0-9a-f]{64}$/;

/** One field the floor names differently from the founding record's fold. */
export interface FloorShadowMove { readonly field: FloorShadowField; readonly floor: string; readonly island: string }

export type FloorShadowReading =
  | { readonly verdict: "clean"; readonly manifest: string }
  | { readonly verdict: "mismatch"; readonly manifest: string; readonly moved: readonly FloorShadowMove[] }
  | { readonly verdict: "unread"; readonly manifest: string | null; readonly why: string };

/** The founding record's three folds, or null where its blobs hold no core to fold. */
export function foundingRecordFolds(islandBlobs: Readonly<Record<string, LarBlobEntry>> | undefined, coreSha256: string | null):
  Record<FloorShadowField, string> | null {
  if (!islandBlobs) return null;
  const core = coreSha256 ?? ownEntry(islandBlobs, ENGINE_CORE_ID)?.sha256 ?? null;
  if (typeof core !== "string" || core.length === 0) return null;
  const vendored = Object.values(islandBlobs).filter((b) => b && b.id !== ENGINE_CORE_ID)
    .map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, ...(b.kind ? { kind: b.kind as never } : {}) }));
  return { engine: computeEngineCid(core), grammar: computeGrammarCid(vendored), plugins: computePluginsCid(vendored) };
}

/** Read the floor `manifestCid` names beside the founding record's folds. Never throws. */
export async function readFloorShadow(args: {
  readonly manifestCid: string | null;
  readonly readBytes:   ((cid: string) => Uint8Array | null | Promise<Uint8Array | null>) | null;
  readonly islandBlobs: Readonly<Record<string, LarBlobEntry>> | undefined;
  readonly coreSha256:  string | null;
}): Promise<FloorShadowReading> {
  const manifest = args.manifestCid;
  if (!manifest) return { verdict: "unread", manifest: null, why: "no floor named: no pin stands and the founding record names no genesis floor" };
  try {
    const folds = foundingRecordFolds(args.islandBlobs, args.coreSha256);
    if (!folds) return { verdict: "unread", manifest, why: "the founding record holds no core blob to fold" };
    if (!args.readBytes) return { verdict: "unread", manifest, why: "this vessel binds no content reader" };
    const bytes = await args.readBytes(manifest);
    if (!bytes) return { verdict: "unread", manifest, why: "floor manifest bytes absent from this vessel's content store" };
    if (!HEX64.test(manifest) || sha256HexBytesSync(bytes) !== manifest) return { verdict: "unread", manifest, why: "floor manifest bytes differ from their CID" };
    const opened = readFloorManifest(bytes);
    if ("refusal" in opened) return { verdict: "unread", manifest, why: `${opened.refusal}: ${opened.reason}` };
    const moved = (["engine", "plugins"] as const).filter((f) => opened.manifest[f] !== folds[f]).map((f) => ({ field: f, floor: opened.manifest[f], island: folds[f] }));
    return moved.length === 0 ? { verdict: "clean", manifest } : { verdict: "mismatch", manifest, moved };
  } catch (error) {
    return { verdict: "unread", manifest, why: `the read faulted: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ── the tally ───────────────────────────────────────────────────────────────────────────────────────

/** The count the operator reads before the flip: boots by verdict, and the first mismatch kept by name. */
export interface FloorShadowTally {
  readonly cleanBoots:    number;
  readonly mismatchBoots: number;
  readonly unreadBoots:   number;
  readonly firstMismatch: { readonly manifest: string; readonly moved: readonly FloorShadowMove[] } | null;
}

/** Where a host keeps the tally between boots. `load` answers the stored value (any shape; it is re-read), `save` keeps one. */
export interface FloorShadowStore {
  load(): unknown | Promise<unknown>;
  save(tally: FloorShadowTally): void | Promise<void>;
}

const count = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Coerce a stored value into a tally at its exact shape, or null. */
export function readFloorShadowTally(value: unknown): FloorShadowTally | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!count(v["cleanBoots"]) || !count(v["mismatchBoots"]) || !count(v["unreadBoots"])) return null;
  const fm = v["firstMismatch"];
  let firstMismatch: FloorShadowTally["firstMismatch"] = null;
  if (fm !== null) {
    if (fm === undefined || typeof fm !== "object" || Array.isArray(fm)) return null;
    const m = fm as Record<string, unknown>;
    if (typeof m["manifest"] !== "string" || !Array.isArray(m["moved"])) return null;
    const moved: FloorShadowMove[] = [];
    for (const row of m["moved"] as unknown[]) {
      const r = row as Record<string, unknown> | null;
      if (!r || !FIELDS.includes(r["field"] as FloorShadowField) || typeof r["floor"] !== "string" || typeof r["island"] !== "string") return null;
      moved.push({ field: r["field"] as FloorShadowField, floor: r["floor"], island: r["island"] });
    }
    firstMismatch = { manifest: m["manifest"], moved };
  }
  return { cleanBoots: v["cleanBoots"], mismatchBoots: v["mismatchBoots"], unreadBoots: v["unreadBoots"], firstMismatch };
}

/** Fold one boot's reading into the tally. The first mismatch stays; later ones count. */
export function foldFloorShadowTally(prior: FloorShadowTally | null, reading: FloorShadowReading): FloorShadowTally {
  const t = prior ?? { cleanBoots: 0, mismatchBoots: 0, unreadBoots: 0, firstMismatch: null };
  if (reading.verdict === "clean") return { ...t, cleanBoots: t.cleanBoots + 1 };
  if (reading.verdict === "unread") return { ...t, unreadBoots: t.unreadBoots + 1 };
  return { ...t, mismatchBoots: t.mismatchBoots + 1, firstMismatch: t.firstMismatch ?? { manifest: reading.manifest, moved: reading.moved } };
}

const short = (cid: string): string => `${cid.slice(0, 12)}…`;

/** The one line the operator reads. */
export function floorShadowLine(tally: FloorShadowTally | null): string {
  if (!tally) return "floor shadow: no boot read yet";
  const unread = tally.unreadBoots > 0 ? ` (${tally.unreadBoots} boot${tally.unreadBoots === 1 ? "" : "s"} unread)` : "";
  if (tally.firstMismatch) {
    const fields = tally.firstMismatch.moved.map((m) => `${m.field} floor ${short(m.floor)} vs island ${short(m.island)}`).join(", ");
    return `floor shadow: first mismatch on floor ${short(tally.firstMismatch.manifest)}: ${fields}; ${tally.mismatchBoots} mismatched, ${tally.cleanBoots} clean${unread}`;
  }
  return `floor shadow: clean across ${tally.cleanBoots} boot${tally.cleanBoots === 1 ? "" : "s"}${unread}`;
}

/** One reading's own line, for the boot log. */
export function floorShadowReadingLine(reading: FloorShadowReading): string {
  if (reading.verdict === "clean") return `[floor shadow] floor ${short(reading.manifest)} agrees with the founding record`;
  if (reading.verdict === "unread") return `[floor shadow] unread${reading.manifest ? ` floor ${short(reading.manifest)}` : ""}: ${reading.why}`;
  return `[floor shadow] MISMATCH on floor ${short(reading.manifest)}: ${reading.moved.map((m) => `${m.field} floor ${m.floor} vs island ${m.island}`).join("; ")} — serving stays on the founding record`;
}
