/**
 * floor-drift — HOW FAR THE PINNED FLOOR TRAILS LIVE PUBLIC CANON, read and never written.
 *
 * Every recipe outside the Kahu cabal's `lares` stack reads house canon through the oracle floor alone: one history-free snapshot
 * per public canon bag, pinned at a release cut (genesis-island#/the-floor-rides-releases). Live canon moves on every lay, so a
 * carrier laid after the cut answers on the `lares` recipe and nowhere on the default one. `lay --lag` stays honest about its own
 * gap (disk against live canon) and never sees this one; this reading names it, apart, so lag keeps its meaning.
 *
 * It walks each slug the pinned manifest names, opens that snapshot, and compares it with the slug's live canon rows under the
 * cut's own row form (`floorRowOf`: residency stamps and absent fields stay out), carrier by carrier (a title's family, the
 * part before `#`), so a meme with six slots counts once:
 *   · MISSING — live canon holds the carrier and the floor holds none of its rows;
 *   · OLDER   — the floor serves the carrier with bytes live canon no longer holds (a slot moved, arrived, or left; a carrier
 *               canon retired still rides the floor and reads here too).
 * A slug with no live document on this vessel reads `unread` by name and counts nothing. NULL where the floor itself does not
 * read (the manifest or a snapshot this CAS cannot answer), or where no slug's live canon reads: never a silent zero.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/genesis-island#/the-floor-rides-releases
 */
import { floorRowOf, floorSlugs, openFloorSnapshot, readFloorManifest } from "./floor-manifest.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** One slug's drift: the carriers the floor misses and the carriers it serves with older bytes, each sorted. */
export interface FloorDriftSlug {
  readonly slug:    string;
  readonly missing: readonly string[];
  readonly older:   readonly string[];
}

/** The floor's drift behind live public canon: the carriers by name and their count. */
export interface FloorDrift {
  /** The pinned floor manifest the reading compared against. */
  readonly manifest: string;
  /** How many carriers drift (missing + older, across every slug that read). */
  readonly count:    number;
  /** Every drifting carrier, sorted. */
  readonly carriers: readonly string[];
  readonly slugs:    readonly FloorDriftSlug[];
  /** Slugs the manifest names whose live canon reads no document on this vessel: named, never counted as level. */
  readonly unread:   readonly string[];
}

export interface FloorDriftPorts {
  /** The pinned floor's manifest CID. */
  readonly manifestCid: string;
  /** One blob by CID (the manifest, each snapshot), or null where this CAS holds none. */
  readonly blob:        (cid: string) => Promise<Uint8Array | null>;
  /** One slug's live canon rows, or null where this vessel reaches no document for it. */
  readonly canonRows:   (slug: string) => Promise<Readonly<Record<string, LarTiddlerRecord>> | null>;
}

/** The carrier a title belongs to: its family, the part before the slot fragment. */
export const carrierOf = (title: string): string => {
  const at = title.indexOf("#");
  return at === -1 ? title : title.slice(0, at);
};

/** A row's tiddler fields as one canonical string: keys sorted at every depth, so field order never reads as drift. */
function canonical(value: unknown): string {
  const order = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(order);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, order((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(order(value));
}

/** Read the floor's drift behind live public canon. Null where the floor does not read, or no slug's live canon does. */
export async function readFloorDrift(ports: FloorDriftPorts): Promise<FloorDrift | null> {
  const manifestBytes = await ports.blob(ports.manifestCid);
  if (!manifestBytes) return null;
  const opened = readFloorManifest(manifestBytes);
  if ("refusal" in opened) return null;
  const slugs: FloorDriftSlug[] = [];
  const unread: string[] = [];
  for (const slug of floorSlugs(opened.manifest)) {
    const cid = opened.manifest.snapshots[slug]!;
    const bytes = await ports.blob(cid);
    const snap = bytes ? openFloorSnapshot(bytes, cid) : null;
    if (snap === null || "refusal" in snap) return null;
    const live = await ports.canonRows(slug);
    if (live === null) { unread.push(slug); continue; }
    const floorRows = new Map<string, string>();
    for (const [title, r] of Object.entries(snap.rows)) floorRows.set(title, canonical(r.tiddler));
    const liveRows = new Map<string, string>();
    for (const [title, r] of Object.entries(live)) {
      const row = floorRowOf(title, r);
      if (row) liveRows.set(title, canonical(row.tiddler));
    }
    const floorCarriers = new Set([...floorRows.keys()].map(carrierOf));
    const missing = new Set<string>();
    const older = new Set<string>();
    for (const [title, form] of liveRows) {
      const carrier = carrierOf(title);
      if (!floorCarriers.has(carrier)) missing.add(carrier);
      else if (floorRows.get(title) !== form) older.add(carrier);
    }
    for (const title of floorRows.keys()) if (!liveRows.has(title)) older.add(carrierOf(title));
    slugs.push({ slug, missing: [...missing].sort(), older: [...older].sort() });
  }
  if (slugs.length === 0) return null;
  const carriers = [...new Set(slugs.flatMap((s) => [...s.missing, ...s.older]))].sort();
  return { manifest: ports.manifestCid, count: carriers.length, carriers, slugs, unread };
}
