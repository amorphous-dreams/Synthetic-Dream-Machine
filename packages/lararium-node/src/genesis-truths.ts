/**
 * genesis-truths -- both truths in one read: the founding record (the stored genesis island, never written after
 * founding) beside the seed (offered) on disk and the floor accept, ratchet by ratchet.
 *
 * D1: a seed on disk that differs from the founding record stands as an OFFER. The boot names it and serves the
 * founding record unchanged; nothing moves at boot, and lay moves canon into the bags, never the founding record.
 * The comparison itself lives in the mesh (`genesis-compare`, pure); this file reads the seed off disk and words
 * the line the boot and `lares vessel floor status` print. It moves nothing.
 *
 * IT NEVER THROWS. The boot prints this read inline, and a read-only print must never stop a boot: a null record, a blob row
 * the fold cannot read, or a seed carrying one answers an unread reading (`unread: <reason>`), which the line prints as
 * `founding record: unread here (<reason>)`.
 */

import {
  compareSeedToFoundingRecord,
  ratchetWords,
  ratchetsDiffer,
  type FloorAcceptLike,
  type GenesisDigests,
  type GenesisRecordLike,
  type RatchetDifference,
} from "@lararium/mesh/genesis-compare";
import { genesisSeedCid, parseGenesisSeed, readGenesisSeedBytes } from "./genesis-artifact.js";

export interface FoundingRecordTruths {
  /** The founding record's digests, recomputed from its own blobs. */
  readonly record: GenesisDigests;
  /** The seed (offered) on disk: its CID and its reading per ratchet, or null where no seed reads. */
  readonly seed: { readonly cid: string; readonly ratchets: readonly RatchetDifference[] } | null;
  /** The floor accept and its reading per ratchet, or null where the caller held no pin. */
  readonly floorAccept: { readonly manifestCid: string; readonly ratchets: readonly RatchetDifference[] } | null;
  /** Why the read could not fold, where it could not; absent on a clean read. */
  readonly unread?: string;
}

const NO_DIGESTS: GenesisDigests = Object.freeze({ engine: null, grammar: null, lararium: null, plugins: null, floor: null });

/** Read the seed at `genesisDir` (the genesis artifact's own default where unnamed), or null where none reads. */
function seedAt(genesisDir: string | undefined): { cid: string; body: GenesisRecordLike } | null {
  try {
    const bytes = readGenesisSeedBytes(genesisDir);
    const body = bytes ? parseGenesisSeed(bytes) : null;
    return bytes && body ? { cid: genesisSeedCid(bytes), body } : null;
  } catch { return null; }
}

/** The founding record beside the seed (offered) at `genesisDir` and, when the caller holds one, the floor accept. */
export function readFoundingRecordTruths(input: {
  readonly record: GenesisRecordLike;
  readonly genesisDir: string | undefined;
  readonly floorAccept?: FloorAcceptLike | null;
}): FoundingRecordTruths {
  try {
    if (input.record === null || typeof input.record !== "object") throw new Error("no founding record reads (the island doc stands empty)");
    const seed = seedAt(input.genesisDir);
    const read = compareSeedToFoundingRecord({ record: input.record, seed: seed?.body ?? null, floorAccept: input.floorAccept ?? null });
    return Object.freeze({
      record: read.record,
      seed: seed && read.seed ? Object.freeze({ cid: seed.cid, ratchets: read.seed }) : null,
      floorAccept: input.floorAccept && read.floorAccept ? Object.freeze({ manifestCid: input.floorAccept.manifestCid, ratchets: read.floorAccept }) : null,
    });
  } catch (e) {
    const reason = (e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim() || "the fold refused";
    return Object.freeze({ record: NO_DIGESTS, seed: null, floorAccept: null, unread: reason });
  }
}

/** A digest shortened for a line: its tail, or `absent`. */
const short = (digest: string | null): string => (digest === null ? "absent" : digest.length > 14 ? `…${digest.slice(-12)}` : digest);

/**
 * The one line: `[genesis] founding record: engine … · grammar … · lararium … · plugins … · floor …; seed (offered) <cid>: same on
 * every ratchet` or `… a newer seed waits: <ratchet words> — the founding record keeps serving; lay moves canon, never
 * the founding record`, then the floor accept, per ratchet where held, else `acceptNote` (the boot's own default: `unread here`).
 */
export function foundingRecordLine(truths: FoundingRecordTruths, opts: { readonly acceptNote?: string } = {}): string {
  if (truths.unread !== undefined) return `[genesis] founding record: unread here (${truths.unread})`;
  const r = truths.record;
  const record = `founding record: engine ${short(r.engine)} · grammar ${short(r.grammar)} · lararium ${short(r.lararium)} · plugins ${short(r.plugins)} · floor ${short(r.floor)}`;
  const seed = truths.seed === null
    ? "seed (offered): none reads"
    : ratchetsDiffer(truths.seed.ratchets)
      ? `seed (offered) ${truths.seed.cid}: a newer seed waits: ${ratchetWords(truths.seed.ratchets)} — the founding record keeps serving; lay moves canon, never the founding record`
      : `seed (offered) ${truths.seed.cid}: same on every ratchet`;
  const pin = truths.floorAccept === null
    ? `floor accept: ${opts.acceptNote ?? "unread here (lares floor status reads it)"}`
    : `floor accept ${truths.floorAccept.manifestCid}: ${ratchetWords(truths.floorAccept.ratchets)}`;
  return `[genesis] ${record}; ${seed}; ${pin}`;
}
