/**
 * charter fixtures — a seated charter, built ONE way.
 *
 * A test that only NEEDS a charter (a lineage to root a roster on, a roll to carry an admit across, a
 * genesis to name a realm) builds it here. The roll law's own tests (`wax-stamp.test.ts`) build theirs by
 * hand, because the shape of an epoch IS their subject.
 *
 * The invariants this helper holds for its callers:
 *   · ONE DOOR. No caller names how an epoch commits its successors: no commitment value, no reveal and no
 *     epoch field beyond `epochCid` and `keySetHash` crosses this surface. A change to the charter's shape
 *     edits this file and no test that leans on it.
 *   · DETERMINISTIC. A seat seed derives from (fixture seed, generation, seat index), so two calls agree
 *     on every key and every cid, and a test may name a generation's seeds before the charter exists.
 *   · EVERY GENERATION SEATS FRESH KEYS. Generation g+1 seats exactly the keys generation g committed, so a
 *     fixture lineage never re-seats a key an earlier epoch seated.
 *   · EVERY ROLL RE-ARMS. A rolled head always commits its own successors; only a genesis may stand
 *     unarmed (`armed: false`), and it refuses to roll.
 *   · A FIXTURE NEVER MUTATES. `roll()` returns the grown charter and leaves its receiver as it stood.
 */
import * as ed from "@noble/ed25519";
import { sha256BytesSync, utf8Bytes, hex } from "../src/crypto.js";
import {
  genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, verifySealLineage,
  type SealEpoch, type SealRollSigner,
} from "../src/wax-stamp.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";

/** A refusal that carries its code, so a test reads WHY a fixture declined. */
function refusal(code: string): Error & { readonly code: string } {
  return Object.assign(new Error(`charter-fixture: ${code}`), { code });
}

/** The seat seeds of one generation of a fixture charter: deterministic in (seed, generation, index). */
export function charterSeatSeeds(seed: number, generation: number, seats: number): readonly Uint8Array[] {
  return Array.from({ length: seats }, (_, index) =>
    sha256BytesSync(utf8Bytes(`charter-fixture|${seed}|${generation}|${index}`)));
}

const keysOf = (seeds: readonly Uint8Array[]): Promise<string[]> =>
  Promise.all(seeds.map((s) => ed.getPublicKeyAsync(s).then(hex)));

const handsOf = (seeds: readonly Uint8Array[], keys: readonly string[]): SealRollSigner[] =>
  seeds.map((s, i) => ({ signer: keys[i]!, sign: (bytes: Uint8Array) => ed.signAsync(bytes, s).then(hex) }));

export interface SeatedCharter {
  readonly chain:      readonly SealEpoch[];   // genesis first; one epoch longer after each roll()
  readonly head:       SealEpoch;
  readonly aid:        string;                 // the genesis cid, fixed across every roll
  readonly generation: number;                 // chain.length - 1
  readonly keys:       readonly string[];      // the head's seated verifying keys (lowercase hex), in seat order
  readonly threshold:  number;
  readonly seeds:      readonly Uint8Array[];  // the head's seat seeds, in the order of `keys`
  readonly roster:     KahuQuorumSeats;        // the head's seats as a quorum roster rooted on the head
  /** The hands of the head's seats: all of them, or the seats named by index. */
  signers(indices?: readonly number[]): Promise<readonly SealRollSigner[]>;
  /** One lawful roll to the next generation; `seats` and `threshold` default to the head's own. */
  roll(next?: { readonly seats?: number; readonly threshold?: number }): Promise<SeatedCharter>;
}

interface Standing {
  readonly fixtureSeed: number;
  readonly chain:       readonly SealEpoch[];
  readonly seats:       number;
  readonly threshold:   number;
  readonly armed:       boolean;
}

const lawfulShape = (seats: number, threshold: number): boolean =>
  Number.isInteger(seats) && Number.isInteger(threshold) && seats >= 1 && threshold >= 1 && threshold <= seats;

/** The digest a head carries for the generation after it: the next generation at the head's own count and threshold. */
async function successorCommitment(st: Pick<Standing, "fixtureSeed" | "seats" | "threshold">, generation: number): Promise<string> {
  return sealKeySetHash(await keysOf(charterSeatSeeds(st.fixtureSeed, generation + 1, st.seats)), st.threshold);
}

async function stand(st: Standing): Promise<SeatedCharter> {
  const generation = st.chain.length - 1;
  const head = st.chain[generation]!;
  const seeds = charterSeatSeeds(st.fixtureSeed, generation, st.seats);
  const keys = await keysOf(seeds);
  return {
    chain: st.chain, head, aid: st.chain[0]!.epochCid, generation, keys, threshold: st.threshold, seeds,
    roster: { keys, threshold: st.threshold, sealEpochCid: head.epochCid },
    signers: async (indices = seeds.map((_, i) => i)) => {
      const hands = handsOf(seeds, keys);
      return indices.map((i) => {
        const hand = hands[i];
        if (!hand) throw refusal("no-such-seat");
        return hand;
      });
    },
    roll: async (next = {}) => {
      if (!st.armed) throw refusal("rotation-unarmed");
      const seats = next.seats ?? st.seats, threshold = next.threshold ?? st.threshold;
      if (!lawfulShape(seats, threshold)) throw refusal("roll-malformed");
      // The head committed the next generation at ITS OWN count and threshold. A roll that changes either
      // reveals that committed set beside the seated one; the committed hands and every seated hand sign.
      const widest = Math.max(seats, st.seats);
      const nextSeeds = charterSeatSeeds(st.fixtureSeed, generation + 1, widest);
      const nextKeys = await keysOf(nextSeeds);
      const seated = { keys: nextKeys.slice(0, seats), threshold };
      const committed = { keys: nextKeys.slice(0, st.seats), threshold: st.threshold };
      const changed = seats !== st.seats || threshold !== st.threshold;
      const grownShape = { fixtureSeed: st.fixtureSeed, seats, threshold };
      const result = await rotateSealEpoch(
        head, changed ? { ...seated, revealed: committed } : seated,
        await successorCommitment(grownShape, generation + 1), handsOf(nextSeeds, nextKeys),
      );
      if (!result.ok) throw refusal(result.code);
      const chain = [...st.chain, result.epoch];
      if (!verifySealLineage(chain)) throw refusal("roll-lineage-invalid");
      return stand({ ...grownShape, chain, armed: true });
    },
  };
}

/**
 * Seat a fixture charter of `seats` chairs at `threshold`. `seed` (default 1) picks the key family;
 * `armed: false` leaves the genesis with no successor committed.
 */
export async function seatedCharter(opts: {
  readonly seats: number; readonly threshold: number; readonly seed?: number; readonly armed?: boolean;
}): Promise<SeatedCharter> {
  if (!lawfulShape(opts.seats, opts.threshold)) throw refusal("roll-malformed");
  const shape = { fixtureSeed: opts.seed ?? 1, seats: opts.seats, threshold: opts.threshold };
  const armed = opts.armed !== false;
  const keys = await keysOf(charterSeatSeeds(shape.fixtureSeed, 0, shape.seats));
  const genesis = genesisCharterEpoch(keys, shape.threshold, armed ? await successorCommitment(shape, 0) : "");
  return stand({ ...shape, chain: [genesis], armed });
}
