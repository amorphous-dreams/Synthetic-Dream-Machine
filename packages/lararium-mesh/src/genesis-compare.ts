/**
 * genesis-compare -- the seed (offered) beside the founding record and the floor accept, ratchet by ratchet.
 *
 * D1: the shipped seed stands as an OFFER, the stored genesis island as the house's ground (the founding record,
 * never written after founding), and the accepted floor as what the house chose. Nothing here moves any of them:
 * every function stays pure and reads only what its caller hands it, so the boot line, the charter-free status
 * read, the kūkulu and the floor shadow read (vessel-island-pool-core) all print the same per-ratchet words.
 *
 * THE FIVE RATCHETS. `engine`, `grammar`, `lararium` and `plugins` name the folded digests (on a accepted floor, grammar, lararium
 * and plugins read through its plugins offering: the floor names no grammar field) (`computeEngineCid`,
 * `computeGrammarCid`, `computeLarariumCid`, `computePluginsCid`); `floor` names the floor manifest CID. The grammar and the house
 * ride two skins with two ratchets, so a house edit moves `lararium` and leaves `grammar` standing. The founding record's folded
 * digests RECOMPUTE from its own blobs (through `regionEntriesOf`, the one mapping the mint's verify reads), never
 * from its witness tiddlers, so a record whose witness drifted from its bytes reads by its bytes. The floor has no
 * fold: it reads the record's floor witness (`GENESIS_FLOOR_TIDDLER`).
 *
 * THE READINGS. `same` where both sides name one digest, `moved` where they name two, `absent` where either side
 * names none. Absent never reads as same: a seed that carries no floor witness offers no floor.
 */

import type { LarBlobEntry } from "./base-doc.js";
import { ENGINE_CORE_ID } from "./base-doc.js";
import { GENESIS_FLOOR_TIDDLER, type FloorManifest } from "./floor-manifest.js";
import { computeEngineCid, computeGrammarCid, computeLarariumCid, computePluginsCid, regionEntriesOf, type GenesisSeed } from "./genesis-doc.js";
import { verifyFloorOfferingSet } from "./floor-offering.js";
import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "./lar-uris.js";
import type { PluginOffering } from "./plugin-offering.js";
import { isPlainMap, ownEntry, plainValue, type StoredTiddlers } from "./stored-value.js";

/** The ratchets, in the order every line names them. */
export const GENESIS_RATCHETS = ["engine", "grammar", "lararium", "plugins", "floor"] as const;
export type GenesisRatchet = typeof GENESIS_RATCHETS[number];

/** One digest per ratchet; null where the side names none. */
export type GenesisDigests = Readonly<Record<GenesisRatchet, string | null>>;

export type RatchetReading = "same" | "moved" | "absent";

/** One ratchet's reading: the founding record's digest (`record`) beside the other side's (`other`). */
export interface RatchetDifference {
  readonly ratchet: GenesisRatchet;
  readonly record: string | null;
  readonly other: string | null;
  readonly reading: RatchetReading;
}

/** A founding record as its island document holds it: the blob map and the stored tiddlers map. */
export interface StoredGenesisRecord {
  readonly blobs?: Readonly<Record<string, LarBlobEntry>> | null | undefined;
  readonly tiddlers?: Readonly<StoredTiddlers> | null | undefined;
}

/**
 * What a founding record or a seed hands in: the island doc's stored shape, or the seed's own plain shape
 * (seed.json, `GenesisSeed`). Either way the floor witness reads through the read door (`plainValue`).
 */
export type GenesisRecordLike = StoredGenesisRecord | Partial<Pick<GenesisSeed, "blobs" | "tiddlers">>;

/**
 * The accepted floor as the comparison reads it: its manifest CID, its engine fold and plugins offering address, and the
 * offering itself where its bytes read (null or absent where they did not). The floor names no grammar: the parser's and the
 * house's bytes ride the offering, so the offering decides the grammar, lararium and plugins readings.
 */
export interface FloorAcceptLike {
  readonly manifestCid: string;
  readonly manifest: Pick<FloorManifest, "engine" | "plugins">;
  readonly offering?: Pick<PluginOffering, "blobs"> | null;
}

/**
 * The digests a founding record (or a seed) carries, RECOMPUTED from its blobs: the engine from the core blob's
 * sha256, grammar and plugins from the region folds, the floor from the floor witness. A record with no blob map
 * names every folded ratchet absent; a record with no core blob names the engine absent.
 */
export function foundingRecordDigests(record: GenesisRecordLike): GenesisDigests {
  const blobs = record.blobs ?? null;
  const core = blobs ? ownEntry(blobs, ENGINE_CORE_ID) : undefined;
  const entries = blobs ? regionEntriesOf(blobs) : null;
  const witness = plainValue(ownEntry<unknown>(record.tiddlers, GENESIS_FLOOR_TIDDLER));
  const fields = isPlainMap(witness) ? witness["tiddler"] : undefined;
  const floor = isPlainMap(fields) ? fields["cid"] : undefined;
  return Object.freeze({
    engine: core && typeof core.sha256 === "string" && core.sha256.length > 0 ? computeEngineCid(core.sha256) : null,
    grammar: entries ? computeGrammarCid(entries) : null,
    lararium: entries ? computeLarariumCid(entries) : null,
    plugins: entries ? computePluginsCid(entries) : null,
    floor: typeof floor === "string" && floor.length > 0 ? floor : null,
  });
}

/**
 * The digests a accepted floor names: its engine fold and the manifest CID as the floor. Grammar and plugins come from the
 * offering read against the founding record (`offeringReadings`), absent where the caller hands none: the manifest's
 * `plugins` names an offering record, never a fold, so it never stands in for one.
 */
export function floorAcceptDigests(
  manifestCid: string,
  manifest: FloorAcceptLike["manifest"],
  offered: OfferedReadings = { grammar: null, lararium: null, plugins: null },
): GenesisDigests {
  const field = (v: string): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  return Object.freeze({
    engine: field(manifest.engine), grammar: offered.grammar, lararium: offered.lararium, plugins: offered.plugins,
    floor: field(manifestCid),
  });
}

/** The offering-read ratchets: what a accepted floor's plugins offering decides beside the founding record. */
export interface OfferedReadings { readonly grammar: string | null; readonly lararium: string | null; readonly plugins: string | null }

/**
 * The grammar, lararium and plugins a accepted floor's offering reads as, beside the founding record: the record's own digest where
 * the offering carries the same bytes (the parser's for grammar, the house plugin's for lararium, the whole boot set for plugins),
 * else the offering's address (so it reads moved); absent where no offering read or the record holds no blobs.
 */
function offeringReadings(record: GenesisRecordLike, digests: GenesisDigests, pin: FloorAcceptLike): OfferedReadings {
  const blobs = record.blobs ?? null;
  if (!pin.offering || !blobs) return { grammar: null, lararium: null, plugins: null };
  const rows = Object.values(blobs).filter((b): b is LarBlobEntry => Boolean(b) && typeof b.mimeType === "string")
    .map((b) => ({ id: b.id, version: b.version ?? "", sha256: b.sha256, mimeType: b.mimeType }));
  const moved = `offering ${pin.manifest.plugins}`;
  const parser = ownEntry(blobs, LARES_MEMETIC_WIKITEXT_PLUGIN_URI);
  const offeredParser = pin.offering.blobs.find((b) => b.id === LARES_MEMETIC_WIKITEXT_PLUGIN_URI);
  const house = ownEntry(blobs, LARES_LARARIUM_PLUGIN_URI);
  const offeredHouse = pin.offering.blobs.find((b) => b.id === LARES_LARARIUM_PLUGIN_URI);
  return {
    grammar: digests.grammar === null ? null : parser && offeredParser && offeredParser.sha256 === parser.sha256 ? digests.grammar : moved,
    // Neither side carrying the house reads as the record's own fold (both name none); one side alone reads moved.
    lararium: digests.lararium === null ? null
      : (house === undefined && offeredHouse === undefined) || (house && offeredHouse && offeredHouse.sha256 === house.sha256) ? digests.lararium : moved,
    plugins: digests.plugins === null ? null : verifyFloorOfferingSet(pin.offering, rows) === null ? digests.plugins : moved,
  };
}

/** Read each ratchet of the founding record against another side. */
export function compareGenesisDigests(record: GenesisDigests, other: GenesisDigests): readonly RatchetDifference[] {
  return Object.freeze(GENESIS_RATCHETS.map((ratchet) => {
    const a = record[ratchet]; const b = other[ratchet];
    const reading: RatchetReading = a === null || b === null ? "absent" : a === b ? "same" : "moved";
    return Object.freeze({ ratchet, record: a, other: b, reading });
  }));
}

/** The per-ratchet words every surface prints: `engine same · grammar moved · lararium same · plugins same · floor absent`. */
export function ratchetWords(differences: readonly RatchetDifference[]): string {
  return differences.map((d) => `${d.ratchet} ${d.reading}`).join(" · ");
}

/** True when any ratchet reads other than same (moved or absent). */
export function ratchetsDiffer(differences: readonly RatchetDifference[]): boolean {
  return differences.some((d) => d.reading !== "same");
}

/**
 * THE SEED'S STANCES (the follow lei, S0; operator ruling 2026-11-25 follow-lei-lands). Each ratchet a newer seed moves reads one
 * of two stances, each with the one runnable line that acts on it:
 *
 *   · `offer` ~ a skin (grammar, lararium, plugins, and the seed's floor that names them): the vessel adopts it over a local
 *     floor (`lares vessel floor adopt`), forward only, at a boot; the founding record never moves.
 *   · `held (engine)` ~ the engine stays behind its own cadence threshold, never the kahu quorum (kahu.mem #/engine-cadence);
 *     each device takes it only by its own reboot onto it, so a re-found takes it today.
 *
 * Absent reads as moved: a seed that names no digest for a ratchet offers no proof it stands same. Pure.
 */
export type SeedStance = "offer" | "held (engine)";
export interface SeedRatchetStance { readonly ratchet: GenesisRatchet; readonly stance: SeedStance; readonly next: string }

/** The line that acts on an offered skin: the adopt's preview over the accept's base (S2); `--apply` lands it by hand. */
export const SEED_OFFER_NEXT = "lares vessel floor adopt";
/** The line that reads the held engine: the seed row of the floor status. */
export const SEED_HELD_NEXT = "lares vessel floor status --grain seed";

/** Each ratchet the seed moves, with its stance and its line; a same ratchet leaves the list. */
export function seedRatchetStances(differences: readonly RatchetDifference[]): readonly SeedRatchetStance[] {
  return Object.freeze(differences.filter((d) => d.reading !== "same").map((d) => Object.freeze(d.ratchet === "engine"
    ? { ratchet: d.ratchet, stance: "held (engine)" as const, next: SEED_HELD_NEXT }
    : { ratchet: d.ratchet, stance: "offer" as const, next: SEED_OFFER_NEXT })));
}

/** The stances in words: `offer: grammar, the seed's floor (\`<line>\`) · held (engine): …`; empty where none stands. */
export function seedStanceWords(stances: readonly SeedRatchetStance[]): string {
  const name = (r: GenesisRatchet): string => (r === "floor" ? "the seed's floor" : r);
  const offers = stances.filter((s) => s.stance === "offer");
  const held = stances.filter((s) => s.stance === "held (engine)");
  return [
    ...(offers.length > 0 ? [`offer: ${offers.map((s) => name(s.ratchet)).join(", ")} adopt over a local floor, forward only, and the founding record never moves (\`${SEED_OFFER_NEXT}\`)`] : []),
    ...(held.length > 0 ? [`held (engine): the engine stays behind its own cadence threshold, never the kahu quorum, and a re-found takes it today (\`${SEED_HELD_NEXT}\`)`] : []),
  ].join(" · ");
}

export interface SeedToFoundingRecord {
  /** The founding record's own digests, recomputed from its blobs. */
  readonly record: GenesisDigests;
  /** The seed (offered) beside the founding record; null where no seed was handed in. */
  readonly seed: readonly RatchetDifference[] | null;
  /** The floor accept beside the founding record; null where no pin was handed in. */
  readonly floorAccept: readonly RatchetDifference[] | null;
}

/**
 * The one comparison: the founding record's recomputed digests beside the offered seed's (recomputed the same
 * way from the seed's blobs) and beside the accepted floor's fields. Pure: it reads, moves nothing, lays nothing.
 */
export function compareSeedToFoundingRecord(input: {
  readonly record: GenesisRecordLike;
  readonly seed?: GenesisRecordLike | null;
  readonly floorAccept?: FloorAcceptLike | null;
}): SeedToFoundingRecord {
  const record = foundingRecordDigests(input.record);
  return Object.freeze({
    record,
    seed: input.seed ? compareGenesisDigests(record, foundingRecordDigests(input.seed)) : null,
    floorAccept: input.floorAccept
      ? compareGenesisDigests(record, floorAcceptDigests(input.floorAccept.manifestCid, input.floorAccept.manifest, offeringReadings(input.record, record, input.floorAccept)))
      : null,
  });
}
