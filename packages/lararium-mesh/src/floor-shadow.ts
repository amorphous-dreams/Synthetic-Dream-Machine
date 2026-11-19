/**
 * floor-shadow — the shadow read (backlog-awakens 3a): a mount still serves the founding record (the island), and beside it
 * reads the floor it stands on (the vessel's pin, or the genesis floor the founding record names). The manifest's `engine`
 * reads beside the engine fold of the founding record's core (`foundingRecordDigests`, the one recompute the genesis
 * comparison reads); its `plugins` names an offering record, read at that address and checked against the founding record's
 * own boot set (`verifyFloorOfferingSet`: every non-core blob the mount loads, by id and bytes). The floor names no grammar:
 * the parser's bytes ride the offering. It only reads: a mismatch names each field that moved, absent or unreadable bytes read
 * `unread` by name, and nothing throws. The tally counts boots per floor (keyed by the manifest CID each boot read) so the
 * operator reads the flip condition for the floor the house stands on ("clean across N boots", or the first mismatch named),
 * with every older floor's count set aside, before mounts move to reading the floor.
 */
import type { LarBlobEntry } from "./base-doc.js";
import { sha256HexBytesSync } from "./crypto.js";
import { readFloorManifest } from "./floor-manifest.js";
import { readFloorOffering, verifyFloorOfferingSet } from "./floor-offering.js";
import { foundingRecordDigests } from "./genesis-compare.js";
import { computeEngineCid } from "./genesis-doc.js";

export type FloorShadowField = "engine" | "plugins";
const FIELDS: readonly FloorShadowField[] = ["engine", "plugins"];
const HEX64 = /^[0-9a-f]{64}$/;

/** One field the floor names differently from the founding record: for plugins, `island` names the first blob that differs. */
export interface FloorShadowMove { readonly field: FloorShadowField; readonly floor: string; readonly island: string }

export type FloorShadowReading =
  | { readonly verdict: "clean"; readonly manifest: string }
  | { readonly verdict: "mismatch"; readonly manifest: string; readonly moved: readonly FloorShadowMove[] }
  | { readonly verdict: "unread"; readonly manifest: string | null; readonly why: string };

/** Read the floor `manifestCid` names beside the founding record. Never throws. */
export async function readFloorShadow(args: {
  readonly manifestCid: string | null;
  readonly readBytes:   ((cid: string) => Uint8Array | null | Promise<Uint8Array | null>) | null;
  readonly islandBlobs: Readonly<Record<string, LarBlobEntry>> | undefined;
  readonly coreSha256:  string | null;
}): Promise<FloorShadowReading> {
  const manifest = args.manifestCid;
  if (!manifest) return { verdict: "unread", manifest: null, why: "no floor named: no pin stands and the founding record names no genesis floor" };
  try {
    if (!args.islandBlobs) return { verdict: "unread", manifest, why: "the founding record holds no blobs to read" };
    const engine = args.coreSha256 ? computeEngineCid(args.coreSha256) : foundingRecordDigests({ blobs: args.islandBlobs }).engine;
    if (!engine) return { verdict: "unread", manifest, why: "the founding record holds no core blob to fold" };
    if (!args.readBytes) return { verdict: "unread", manifest, why: "this vessel binds no content reader" };
    const bytes = await args.readBytes(manifest);
    if (!bytes) return { verdict: "unread", manifest, why: "floor manifest bytes absent from this vessel's content store" };
    if (!HEX64.test(manifest) || sha256HexBytesSync(bytes) !== manifest) return { verdict: "unread", manifest, why: "floor manifest bytes differ from their CID" };
    const opened = readFloorManifest(bytes);
    if ("refusal" in opened) return { verdict: "unread", manifest, why: `${opened.refusal}: ${opened.reason}` };
    const offeringCid = opened.manifest.plugins;
    const offeringBytes = await args.readBytes(offeringCid);
    if (!offeringBytes) return { verdict: "unread", manifest, why: `the floor's plugins offering bytes absent from this vessel's content store: ${offeringCid}` };
    const offering = readFloorOffering(offeringBytes, offeringCid);
    if ("refusal" in offering) return { verdict: "unread", manifest, why: `the floor's plugins offering reads unread: ${offering.reason}` };
    const moved: FloorShadowMove[] = [];
    if (opened.manifest.engine !== engine) moved.push({ field: "engine", floor: opened.manifest.engine, island: engine });
    const differs = verifyFloorOfferingSet(offering.offering, Object.values(args.islandBlobs)
      .filter((b) => b && typeof b.mimeType === "string")
      .map((b) => ({ id: b.id, version: b.version ?? "", sha256: b.sha256, mimeType: b.mimeType })));
    if (differs !== null) moved.push({ field: "plugins", floor: offeringCid, island: differs });
    return moved.length === 0 ? { verdict: "clean", manifest } : { verdict: "mismatch", manifest, moved };
  } catch (error) {
    return { verdict: "unread", manifest, why: `the read faulted: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ── the tally ───────────────────────────────────────────────────────────────────────────────────────

/** One floor's count: boots by verdict, and the first mismatch on that floor kept by name. `floor` names the manifest CID the
 *  boots read, `""` for boots that named no floor, and null for a count stored before the tally named its floor (history). */
export interface FloorShadowCount {
  readonly floor:         string | null;
  readonly cleanBoots:    number;
  readonly mismatchBoots: number;
  readonly unreadBoots:   number;
  readonly firstMismatch: { readonly manifest: string; readonly moved: readonly FloorShadowMove[] } | null;
}

/** The count the operator reads before the flip, keyed by floor: `current` counts the floor the latest boot read; `prior`
 *  sets every other floor's count aside, never mixed into the current one. */
export interface FloorShadowTally {
  readonly current: (FloorShadowCount & { readonly floor: string }) | null;
  readonly prior:   readonly FloorShadowCount[];
}

/** Where a host keeps the tally between boots. `load` answers the stored value (any shape; it is re-read), `save` keeps one. */
export interface FloorShadowStore {
  load(): unknown | Promise<unknown>;
  save(tally: FloorShadowTally): void | Promise<void>;
}

const count = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** One floor's counts at their exact shape, `floor` aside, or null. */
function readCount(v: Record<string, unknown>): Omit<FloorShadowCount, "floor"> | null {
  if (!count(v["cleanBoots"]) || !count(v["mismatchBoots"]) || !count(v["unreadBoots"])) return null;
  const fm = v["firstMismatch"];
  let firstMismatch: FloorShadowCount["firstMismatch"] = null;
  if (fm !== null) {
    if (!isRecord(fm)) return null;
    if (typeof fm["manifest"] !== "string" || !Array.isArray(fm["moved"])) return null;
    const moved: FloorShadowMove[] = [];
    for (const row of fm["moved"] as unknown[]) {
      const r = row as Record<string, unknown> | null;
      if (!r || !FIELDS.includes(r["field"] as FloorShadowField) || typeof r["floor"] !== "string" || typeof r["island"] !== "string") return null;
      moved.push({ field: r["field"] as FloorShadowField, floor: r["floor"], island: r["island"] });
    }
    firstMismatch = { manifest: fm["manifest"], moved };
  }
  return { cleanBoots: v["cleanBoots"], mismatchBoots: v["mismatchBoots"], unreadBoots: v["unreadBoots"], firstMismatch };
}

function readFloorCount(value: unknown): FloorShadowCount | null {
  if (!isRecord(value)) return null;
  const floor = value["floor"];
  if (floor !== null && typeof floor !== "string") return null;
  const counts = readCount(value);
  return counts ? { floor, ...counts } : null;
}

/** Coerce a stored value into a tally at its exact shape, or null. A count stored before the tally named its floor reads as one
 *  prior floor's history, never as the current floor's count. */
export function readFloorShadowTally(value: unknown): FloorShadowTally | null {
  if (!isRecord(value)) return null;
  if (!("current" in value) && !("prior" in value)) {
    const unkeyed = readCount(value);
    return unkeyed ? { current: null, prior: [{ floor: null, ...unkeyed }] } : null;
  }
  let current: FloorShadowTally["current"] = null;
  if (value["current"] !== null) {
    const c = readFloorCount(value["current"]);
    if (!c || c.floor === null) return null;
    current = { ...c, floor: c.floor };
  }
  if (!Array.isArray(value["prior"])) return null;
  const prior: FloorShadowCount[] = [];
  for (const row of value["prior"] as unknown[]) {
    const p = readFloorCount(row);
    if (!p) return null;
    prior.push(p);
  }
  return { current, prior };
}

/** Fold one boot's reading into the tally, on the count of the floor that boot read. A boot on another floor sets the current
 *  count aside and picks up that floor's own count (fresh where none stands). On one floor the first mismatch stays. */
export function foldFloorShadowTally(prior: FloorShadowTally | null, reading: FloorShadowReading): FloorShadowTally {
  const floor = reading.manifest ?? "";
  const kept = prior ?? { current: null, prior: [] };
  let aside = [...kept.prior];
  let t: FloorShadowCount & { readonly floor: string };
  if (kept.current && kept.current.floor === floor) t = kept.current;
  else {
    const resumed = aside.find((p) => p.floor === floor);
    aside = aside.filter((p) => p !== resumed);
    if (kept.current) aside.push(kept.current);
    t = resumed ? { ...resumed, floor } : { floor, cleanBoots: 0, mismatchBoots: 0, unreadBoots: 0, firstMismatch: null };
  }
  const next = reading.verdict === "clean" ? { ...t, cleanBoots: t.cleanBoots + 1 }
    : reading.verdict === "unread" ? { ...t, unreadBoots: t.unreadBoots + 1 }
    : { ...t, mismatchBoots: t.mismatchBoots + 1, firstMismatch: t.firstMismatch ?? { manifest: reading.manifest, moved: reading.moved } };
  return { current: next, prior: aside };
}

const short = (cid: string): string => `${cid.slice(0, 12)}…`;

/** The one line the operator reads: the current floor's count, with any older floors named as set aside. */
export function floorShadowLine(tally: FloorShadowTally | null): string {
  if (!tally) return "floor shadow: no boot read yet";
  const older = tally.prior.length;
  const aside = older > 0 ? `; ${older} older floor${older === 1 ? "" : "s"} set aside` : "";
  const c = tally.current;
  if (!c) return `floor shadow: no boot read on the current floor yet${aside}`;
  const on = `floor shadow on floor ${c.floor ? short(c.floor) : "(none named)"}`;
  const unread = `${c.unreadBoots} unread`;
  if (c.firstMismatch) {
    const fields = c.firstMismatch.moved.map((m) => `${m.field} floor ${short(m.floor)} vs island ${m.field === "engine" ? short(m.island) : m.island}`).join(", ");
    return `${on}: first mismatch ${fields}; ${c.mismatchBoots} mismatched, ${c.cleanBoots} clean, ${unread}${aside}`;
  }
  return `${on}: clean across ${c.cleanBoots} boot${c.cleanBoots === 1 ? "" : "s"}, ${unread}${aside}`;
}

/** One reading's own line, for the boot log. */
export function floorShadowReadingLine(reading: FloorShadowReading): string {
  if (reading.verdict === "clean") return `[floor shadow] floor ${short(reading.manifest)} agrees with the founding record`;
  if (reading.verdict === "unread") return `[floor shadow] unread${reading.manifest ? ` floor ${short(reading.manifest)}` : ""}: ${reading.why}`;
  return `[floor shadow] MISMATCH on floor ${short(reading.manifest)}: ${reading.moved.map((m) => `${m.field} floor ${m.floor} vs island ${m.island}`).join("; ")} — serving stays on the founding record`;
}
