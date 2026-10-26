/** A charter's raising hand follows its verified seal epochs, with each epoch's own seated quorum. */
import { makeHandLineage, currentRoster, type HandLineage } from "./hand-lineage.js";
import { epochSeats, type SealEpoch } from "./wax-stamp.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";

export interface CharterHand {
  readonly lineage: HandLineage;
  readonly roster: KahuQuorumSeats;
}

/** Read the whole seal chain before any of its keys can raise a lease or frontier. */
export function charterHandLineage(chain: readonly SealEpoch[]): CharterHand | null {
  if (chain.length === 0) return null;
  const epochs = chain.map((epoch, i) => {
    const seats = epochSeats(epoch);
    return seats && { epoch: i, signers: seats.keys, threshold: seats.threshold };
  });
  if (epochs.some((epoch) => epoch === null)) return null;
  const lineage = makeHandLineage(epochs as { epoch: number; signers: readonly string[]; threshold: number }[], chain);
  if (!lineage) return null;
  return { lineage, roster: charterRosterOf(lineage, chain[chain.length - 1]!.epochCid) };
}

/** Pair the current verified hand with the head seal epoch's content id. */
export function charterRosterOf(lineage: HandLineage, sealEpochCid: string): KahuQuorumSeats {
  const head = currentRoster(lineage);
  return { keys: head.signers, threshold: head.threshold, sealEpochCid };
}
