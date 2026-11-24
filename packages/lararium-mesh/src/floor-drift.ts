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
 *   · OLDER   — live canon holds other bytes for the carrier than the floor serves (a slot moved, arrived, or left; a carrier
 *               canon retired still rides the floor and reads here too).
 * Both sides pass through the cut's one row form, the floor's rows as well as live canon's: a genesis floor rests the carrier's
 * deserialized fields as the bake read them, live canon rests what INGEST landed, and neither residency stamps nor absent fields
 * read as drift.
 * A slug with no live document on this vessel reads `unread` by name and counts nothing. NULL where the floor itself does not
 * read (the manifest or a snapshot this CAS cannot answer), or where no slug's live canon reads: never a silent zero. The
 * reading (`readFloorDriftReading`) names WHY it reads null, so no caller guesses a cause.
 *
 * WHAT IT CANNOT SEE: it walks the slugs the pinned manifest names. A public canon bag declared after the cut, which the floor
 * keys no snapshot for, stays invisible here: its carriers ride no floor, so they neither miss nor age against it. A canon cut
 * (`cutReleaseFloor`) walks the prior floor's slugs alone, so such a bag joins the floor only at a release bake that re-keys the
 * slugs (`cutGenesisFloor`).
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

/** The drift, or null with the reason it does not read. */
export type FloorDriftReading =
  | { readonly drift: FloorDrift; readonly why?: undefined }
  | { readonly drift: null; readonly why: string };

/** The row form both sides compare under: the cut's (`floorRowOf`), as one canonical string. */
const rowForm = (title: string, record: LarTiddlerRecord): string | null => {
  const row = floorRowOf(title, record);
  return row ? canonical(row.tiddler) : null;
};

/** Read the floor's drift behind live public canon, naming why where it does not read. */
export async function readFloorDriftReading(ports: FloorDriftPorts): Promise<FloorDriftReading> {
  const manifestBytes = await ports.blob(ports.manifestCid);
  if (!manifestBytes) return { drift: null, why: `the floor manifest ${ports.manifestCid} does not read from this vessel's CAS` };
  const opened = readFloorManifest(manifestBytes);
  if ("refusal" in opened) return { drift: null, why: `the floor manifest ${ports.manifestCid} reads ${opened.refusal}` };
  const slugs: FloorDriftSlug[] = [];
  const unread: string[] = [];
  for (const slug of floorSlugs(opened.manifest)) {
    const cid = opened.manifest.snapshots[slug]!;
    const bytes = await ports.blob(cid);
    if (!bytes) return { drift: null, why: `the floor's ${slug} snapshot ${cid} does not read from this vessel's CAS` };
    const snap = openFloorSnapshot(bytes, cid);
    if ("refusal" in snap) return { drift: null, why: `the floor's ${slug} snapshot reads ${snap.refusal}` };
    const live = await ports.canonRows(slug);
    if (live === null) { unread.push(slug); continue; }
    const floorRows = new Map<string, string>();
    for (const [title, r] of Object.entries(snap.rows)) { const form = rowForm(title, r); if (form !== null) floorRows.set(title, form); }
    const liveRows = new Map<string, string>();
    for (const [title, r] of Object.entries(live)) { const form = rowForm(title, r); if (form !== null) liveRows.set(title, form); }
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
  if (slugs.length === 0) return { drift: null, why: `no live canon document reads here for any slug the floor names (${unread.join(", ")})` };
  const carriers = [...new Set(slugs.flatMap((s) => [...s.missing, ...s.older]))].sort();
  return { drift: { manifest: ports.manifestCid, count: carriers.length, carriers, slugs, unread } };
}

/** Read the floor's drift behind live public canon. Null where the floor does not read, or no slug's live canon does. */
export async function readFloorDrift(ports: FloorDriftPorts): Promise<FloorDrift | null> {
  return (await readFloorDriftReading(ports)).drift;
}
