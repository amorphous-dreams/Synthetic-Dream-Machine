/**
 * genesis-truths -- both truths in one read: the founding record (the stored genesis island, never written after
 * founding) beside the seed (offered) on disk and the floor pin, ratchet by ratchet.
 *
 * D1: a seed on disk that differs from the founding record stands as an OFFER. The boot names it and serves the
 * founding record unchanged; nothing moves at boot, and lay moves canon into the bags, never the founding record.
 * The comparison itself lives in the mesh (`genesis-compare`, pure); this file reads the seed off disk and words
 * the line the boot and `lares floor status` print. It moves nothing.
 */

import {
  compareSeedToFoundingRecord, ratchetWords, ratchetsDiffer,
  type FloorPinLike, type GenesisDigests, type GenesisRecordLike, type RatchetDifference,
} from "@lararium/mesh";
import { genesisSeedCid, parseGenesisSeed, readGenesisSeedBytes } from "./genesis-artifact.js";

export interface FoundingRecordTruths {
  /** The founding record's digests, recomputed from its own blobs. */
  readonly record: GenesisDigests;
  /** The seed (offered) on disk: its CID and its reading per ratchet, or null where no seed reads. */
  readonly seed: { readonly cid: string; readonly ratchets: readonly RatchetDifference[] } | null;
  /** The floor pin and its reading per ratchet, or null where the caller held no pin. */
  readonly floorPin: { readonly manifestCid: string; readonly ratchets: readonly RatchetDifference[] } | null;
}

/** Read the seed at `genesisDir` (the genesis artifact's own default where unnamed), or null where none reads. */
function seedAt(genesisDir: string | undefined): { cid: string; body: GenesisRecordLike } | null {
  const bytes = readGenesisSeedBytes(genesisDir);
  const body = bytes ? parseGenesisSeed(bytes) : null;
  return bytes && body ? { cid: genesisSeedCid(bytes), body } : null;
}

/** The founding record beside the seed (offered) at `genesisDir` and, when the caller holds one, the floor pin. */
export function readFoundingRecordTruths(input: {
  readonly record: GenesisRecordLike;
  readonly genesisDir: string | undefined;
  readonly floorPin?: FloorPinLike | null;
}): FoundingRecordTruths {
  const seed = seedAt(input.genesisDir);
  const read = compareSeedToFoundingRecord({ record: input.record, seed: seed?.body ?? null, floorPin: input.floorPin ?? null });
  return Object.freeze({
    record: read.record,
    seed: seed && read.seed ? Object.freeze({ cid: seed.cid, ratchets: read.seed }) : null,
    floorPin: input.floorPin && read.floorPin ? Object.freeze({ manifestCid: input.floorPin.manifestCid, ratchets: read.floorPin }) : null,
  });
}

/** A digest shortened for a line: its tail, or `absent`. */
const short = (digest: string | null): string => (digest === null ? "absent" : digest.length > 14 ? `…${digest.slice(-12)}` : digest);

/**
 * The one line: `[genesis] founding record: engine … · grammar … · plugins … · floor …; seed (offered) <cid>: same on
 * every ratchet` or `… a newer seed waits: <ratchet words> — the founding record keeps serving; lay moves canon, never
 * the founding record`, then the floor pin, per ratchet where held, else `unread here`.
 */
export function foundingRecordLine(truths: FoundingRecordTruths): string {
  const r = truths.record;
  const record = `founding record: engine ${short(r.engine)} · grammar ${short(r.grammar)} · plugins ${short(r.plugins)} · floor ${short(r.floor)}`;
  const seed = truths.seed === null
    ? "seed (offered): none reads"
    : ratchetsDiffer(truths.seed.ratchets)
      ? `seed (offered) ${truths.seed.cid}: a newer seed waits: ${ratchetWords(truths.seed.ratchets)} — the founding record keeps serving; lay moves canon, never the founding record`
      : `seed (offered) ${truths.seed.cid}: same on every ratchet`;
  const pin = truths.floorPin === null
    ? "floor pin: unread here (lares floor status reads it)"
    : `floor pin ${truths.floorPin.manifestCid}: ${ratchetWords(truths.floorPin.ratchets)}`;
  return `[genesis] ${record}; ${seed}; ${pin}`;
}
