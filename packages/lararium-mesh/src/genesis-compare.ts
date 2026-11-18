/**
 * genesis-compare -- the seed (offered) beside the founding record and the floor pin, ratchet by ratchet.
 *
 * D1: the shipped seed stands as an OFFER, the stored genesis island as the house's ground (the founding record,
 * never written after founding), and the pinned floor as what the house chose. Nothing here moves any of them:
 * every function stays pure and reads only what its caller hands it, so the boot line, the charter-free status
 * read, the kūkulu and the floor shadow read (vessel-island-pool-core) all print the same per-ratchet words.
 *
 * THE FOUR RATCHETS. `engine`, `grammar` and `plugins` name the folded digests (`computeEngineCid`,
 * `computeGrammarCid`, `computePluginsCid`); `floor` names the floor manifest CID. The founding record's folded
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
import { computeEngineCid, computeGrammarCid, computePluginsCid, regionEntriesOf } from "./genesis-doc.js";
import { ownEntry, plainField, type StoredLarRecord } from "./stored-value.js";

/** The ratchets, in the order every line names them. */
export const GENESIS_RATCHETS = ["engine", "grammar", "plugins", "floor"] as const;
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

/** What a founding record or a seed hands in: a blob map and a tiddlers map, stored (an island doc) or plain (seed.json). */
export interface GenesisRecordLike {
  readonly blobs?: Readonly<Record<string, LarBlobEntry>> | null | undefined;
  readonly tiddlers?: Readonly<Record<string, unknown>> | null | undefined;
}

/** The pinned floor as the comparison reads it: its manifest CID and its three folded fields. */
export interface FloorPinLike {
  readonly manifestCid: string;
  readonly manifest: Pick<FloorManifest, "engine" | "grammar" | "plugins">;
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
  const floor = plainField(ownEntry(record.tiddlers as Record<string, StoredLarRecord> | null | undefined, GENESIS_FLOOR_TIDDLER), "cid");
  return Object.freeze({
    engine: core && typeof core.sha256 === "string" && core.sha256.length > 0 ? computeEngineCid(core.sha256) : null,
    grammar: entries ? computeGrammarCid(entries) : null,
    plugins: entries ? computePluginsCid(entries) : null,
    floor: typeof floor === "string" && floor.length > 0 ? floor : null,
  });
}

/** The digests a pinned floor names: its manifest's three folded fields and the manifest CID as the floor. */
export function floorPinDigests(manifestCid: string, manifest: FloorPinLike["manifest"]): GenesisDigests {
  const field = (v: string): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  return Object.freeze({
    engine: field(manifest.engine), grammar: field(manifest.grammar), plugins: field(manifest.plugins),
    floor: field(manifestCid),
  });
}

/** Read each ratchet of the founding record against another side. */
export function compareGenesisDigests(record: GenesisDigests, other: GenesisDigests): readonly RatchetDifference[] {
  return Object.freeze(GENESIS_RATCHETS.map((ratchet) => {
    const a = record[ratchet]; const b = other[ratchet];
    const reading: RatchetReading = a === null || b === null ? "absent" : a === b ? "same" : "moved";
    return Object.freeze({ ratchet, record: a, other: b, reading });
  }));
}

/** The per-ratchet words every surface prints: `engine same · grammar moved · plugins same · floor absent`. */
export function ratchetWords(differences: readonly RatchetDifference[]): string {
  return differences.map((d) => `${d.ratchet} ${d.reading}`).join(" · ");
}

/** True when any ratchet reads other than same (moved or absent). */
export function ratchetsDiffer(differences: readonly RatchetDifference[]): boolean {
  return differences.some((d) => d.reading !== "same");
}

export interface SeedToFoundingRecord {
  /** The founding record's own digests, recomputed from its blobs. */
  readonly record: GenesisDigests;
  /** The seed (offered) beside the founding record; null where no seed was handed in. */
  readonly seed: readonly RatchetDifference[] | null;
  /** The floor pin beside the founding record; null where no pin was handed in. */
  readonly floorPin: readonly RatchetDifference[] | null;
}

/**
 * The one comparison: the founding record's recomputed digests beside the offered seed's (recomputed the same
 * way from the seed's blobs) and beside the pinned floor's fields. Pure: it reads, moves nothing, lays nothing.
 */
export function compareSeedToFoundingRecord(input: {
  readonly record: GenesisRecordLike;
  readonly seed?: GenesisRecordLike | null;
  readonly floorPin?: FloorPinLike | null;
}): SeedToFoundingRecord {
  const record = foundingRecordDigests(input.record);
  return Object.freeze({
    record,
    seed: input.seed ? compareGenesisDigests(record, foundingRecordDigests(input.seed)) : null,
    floorPin: input.floorPin ? compareGenesisDigests(record, floorPinDigests(input.floorPin.manifestCid, input.floorPin.manifest)) : null,
  });
}
