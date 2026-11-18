/**
 * seed-offered — the host's seed read: the seed a genesis dir offers (its CID and digests) beside the founding record's
 * digests, ratchet by ratchet (D1).
 *
 * An image carries its genesis at `/app/genesis` (LAR_GENESIS), copied from the clean checkout it built from, so a genesis
 * dir names what an image offers. `lares vessel floor seed` prints this read (`--json` carries the line the shim hands the
 * pūlama as `image '{"digest":…,"seed":…}'`), and the kūkulu's `seedOffer` port reads through the same one
 * (`hostSeedOfferPort`). It reads and moves nothing: the founding record keeps serving, and lay moves canon, never the
 * founding record.
 *
 * The seed reads as the boot reads it (`genesis-artifact`): JSON in the genesis seed's shape, its CID the sha256 over the
 * seed.json bytes (`genesisSeedCid`), its digests recomputed from its own blobs (`foundingRecordDigests`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareGenesisDigests, foundingRecordDigests, genesisSeedCarriesAVersion, ratchetWords, ratchetsDiffer,
  GENESIS_SEED_FORMAT, type GenesisDigests, type GenesisRecordLike,
} from "@lararium/mesh";
import { genesisSeedCid } from "@lararium/node";
import type { SeedOffer } from "./rite-kukulu.js";

/** The seed a genesis dir offers: its CID and its digests per ratchet. */
export interface SeedRead {
  readonly cid: string;
  readonly digests: GenesisDigests;
}

/** The founding record as a house answers it, or why none reads here. */
export type FoundingRecordReading = { readonly record: GenesisDigests } | { readonly unread: string };

/** What `floor seed` answers. `seed` holds the one line (the pūlama frame's `seed`); `offer` pairs only where both read. */
export interface FloorSeedRead {
  readonly genesis: string;
  readonly offered: SeedRead | null;
  readonly offer: SeedOffer | null;
  readonly ratchets: string | null;
  readonly recordUnread?: string;
  readonly seed: string;
}

/** The seed at `genesisDir`, or null where no seed.json reads in the genesis seed's shape. */
export function readSeedOffered(genesisDir: string): SeedRead | null {
  let bytes: Buffer;
  try { bytes = readFileSync(join(genesisDir, "seed.json")); } catch { return null; }
  let body: unknown;
  try { body = JSON.parse(bytes.toString("utf8")); } catch { return null; }
  const seed = body as { format?: unknown } | null;
  if (seed === null || typeof seed !== "object" || seed.format !== GENESIS_SEED_FORMAT || genesisSeedCarriesAVersion(seed)) return null;
  return { cid: genesisSeedCid(new Uint8Array(bytes)), digests: foundingRecordDigests(seed as GenesisRecordLike) };
}

/** The founding record as `floor status` answers it (`output.genesis`), or the reason none reads. */
export function foundingRecordFromStatus(output: Record<string, unknown> | null, why: string): FoundingRecordReading {
  const g = output?.["genesis"] as { record?: GenesisDigests; unread?: string } | undefined;
  if (typeof g?.unread === "string") return { unread: g.unread };
  if (g?.record) return { record: g.record };
  return { unread: typeof output?.["refused"] === "string" ? output["refused"] as string : why };
}

/** The seed the genesis dir offers beside the founding record the house answers; never throws on a record that fails. */
export async function floorSeedRead(opts: { readonly genesisDir: string; readonly record: () => Promise<FoundingRecordReading> }): Promise<FloorSeedRead> {
  const offered = readSeedOffered(opts.genesisDir);
  if (offered === null) return { genesis: opts.genesisDir, offered: null, offer: null, ratchets: null, seed: `no seed reads at ${opts.genesisDir}` };
  let reading: FoundingRecordReading;
  try { reading = await opts.record(); }
  catch (e) { reading = { unread: (e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim() || "the house answered nothing" }; }
  if ("unread" in reading) {
    return { genesis: opts.genesisDir, offered, offer: null, ratchets: null, recordUnread: reading.unread, seed: `seed ${offered.cid}: the founding record unread here (${reading.unread})` };
  }
  const differences = compareGenesisDigests(reading.record, offered.digests);
  const ratchets = ratchetWords(differences);
  return {
    genesis: opts.genesisDir, offered, offer: { record: reading.record, seed: offered }, ratchets,
    seed: ratchetsDiffer(differences)
      ? `seed ${offered.cid}: a newer seed waits: ${ratchets}; the founding record keeps serving`
      : `seed ${offered.cid}: same on every ratchet as the founding record`,
  };
}

/** The kūkulu's `seedOffer` port over this read: the offer where both the seed and the founding record read, else null. */
export function hostSeedOfferPort(opts: { readonly genesisDir: string; readonly record: () => Promise<FoundingRecordReading> }): (head: string) => Promise<SeedOffer | null> {
  return async () => (await floorSeedRead(opts)).offer;
}
