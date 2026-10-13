/**
 * charter fixtures — a seated charter, built ONE way.
 *
 * A test that only NEEDS a charter (a lineage to root a roster on, a roll to carry an admit across, a
 * genesis to name a realm) builds it here. The roll law's own tests (`wax-stamp.test.ts`) build theirs by
 * hand, because the shape of an epoch IS their subject. `charter-funnel.test.ts` reads the whole workspace
 * and refuses a test that builds one outside this helper.
 *
 * Four doors, one per thing a test can hold:
 *   · `seatedCharter`: the fixture's own keys, derived from a seed. A test that needs any lawful charter.
 *   · `heldCharter`: the CALLER's keys. A test whose vessel, vault or dialer already holds the seats' keys
 *     names them, and names the keys of the next generation where it means to roll.
 *   · `namedCharter`: a doc that names a charter and verifies under no law. A test that feeds a reader the
 *     name alone.
 *   · `doc()`, on either charter: the charter doc at the head, the shape a vessel stores and carries.
 *
 * The invariants this helper holds for its callers:
 *   · ONE DOOR. No caller names how an epoch commits its successors: a caller names seats, and passes no
 *     commitment value and no reveal. A charter's `head` and `chain` carry whole epochs, and a caller reads
 *     `epochCid`, `keySetHash`, `prevEpochCid` and `roll` off one; a test that reads how an epoch commits
 *     stands outside the funnel, by name. A change to the charter's shape edits this file and no test that
 *     leans on it.
 *   · A ROLL SEATS WHAT ITS HEAD COMMITTED. A caller names seats by their keys and their threshold; the
 *     helper alone turns a named generation into whatever the head carries for it.
 *   · A FIXTURE NEVER MUTATES. `roll()` returns the grown charter and leaves its receiver as it stood.
 * And for `seatedCharter`, whose keys the helper derives:
 *   · DETERMINISTIC. A seat seed derives from (fixture seed, generation, seat index), so two calls agree
 *     on every key and every cid, and a test may name a generation's seeds before the charter exists.
 *   · EVERY GENERATION SEATS FRESH KEYS. Generation g+1 seats exactly the keys generation g committed, so a
 *     fixture lineage never re-seats a key an earlier epoch seated.
 *   · EVERY ROLL RE-ARMS. A rolled head always commits its own successors; only a genesis may stand
 *     unarmed (`armed: false`), and it refuses to roll.
 */
import * as ed from "@noble/ed25519";
import { sha256BytesSync, utf8Bytes, hex } from "../src/crypto.js";
import {
  genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, verifySealLineage,
  type SealEpoch, type SealRollSigner,
} from "../src/wax-stamp.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import { NEXUS_DOC_DOMAIN } from "../src/domains.js";
import type { NexusDoc } from "../src/nexus-seal-seed.js";

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

/** What a test may say about the charter doc it asks for; the seats, the threshold and the lineage come from the charter. */
export interface CharterDocOptions {
  /** A chair label per chair, in seat order (absent: `Seat <i>`). A label past the last seated key names an unseated chair. */
  readonly labels?: readonly string[];
  /** The dials a doc carries beside its seats. */
  readonly dials?:  Pick<NexusDoc, "federationPosture" | "joinPolicy" | "admissionDials">;
}

/** What every fixture charter reads as, whoever holds its keys. */
export interface StandingCharter {
  readonly chain:      readonly SealEpoch[];   // genesis first; one epoch longer after each roll()
  readonly head:       SealEpoch;
  readonly aid:        string;                 // the genesis cid, fixed across every roll
  readonly generation: number;                 // chain.length - 1
  readonly keys:       readonly string[];      // the head's seated verifying keys, in seat order
  readonly threshold:  number;
  readonly roster:     KahuQuorumSeats;        // the head's seats as a quorum roster rooted on the head
  /** The charter doc at the head: every chair seated, the whole lineage carried. */
  doc(options?: CharterDocOptions): NexusDoc;
}

function docOf(chain: readonly SealEpoch[], keys: readonly string[], threshold: number, options: CharterDocOptions = {}): NexusDoc {
  const chairs = Math.max(keys.length, options.labels?.length ?? 0);
  return {
    kind: NEXUS_DOC_DOMAIN, threshold,
    sealEpochCid: chain[chain.length - 1]!.epochCid, sealLineage: [...chain],
    kahu: Array.from({ length: chairs }, (_, i) => ({ displayName: options.labels?.[i] ?? `Seat ${i}`, verifyingKey: keys[i] ?? null })),
    ...options.dials,
  };
}

export interface SeatedCharter extends StandingCharter {
  readonly seeds:      readonly Uint8Array[];  // the head's seat seeds, in the order of `keys`
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
    doc: (options) => docOf(st.chain, keys, st.threshold, options),
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

// ── A charter over keys the CALLER holds ─────────────────────────────────────────────────────────

/** A set of seats a caller names by its keys: the seats of a genesis, or the generation a head commits. */
export interface HeldSeats {
  readonly keys:      readonly string[];
  readonly threshold: number;
}

export interface HeldCharter extends StandingCharter {
  /**
   * One lawful roll: seat the successors this head committed, under the hands of those successors. `then`
   * names the generation the rolled head commits; absent, the rolled head stands unarmed.
   */
  roll(hands: readonly SealRollSigner[], then?: HeldSeats): Promise<HeldCharter>;
}

const lawfulSeats = (seats: HeldSeats): boolean => lawfulShape(new Set(seats.keys.map((k) => k.toLowerCase())).size, seats.threshold);

/** The digest a head carries for the successors a caller named; none named, none committed. */
const heldCommitment = (successors: HeldSeats | undefined): string =>
  successors ? sealKeySetHash(successors.keys, successors.threshold) : "";

function standHeld(chain: readonly SealEpoch[], seats: HeldSeats, successors: HeldSeats | undefined): HeldCharter {
  const head = chain[chain.length - 1]!;
  const keys = [...seats.keys];
  return {
    chain, head, aid: chain[0]!.epochCid, generation: chain.length - 1, keys, threshold: seats.threshold,
    roster: { keys, threshold: seats.threshold, sealEpochCid: head.epochCid },
    doc: (options) => docOf(chain, keys, seats.threshold, options),
    roll: async (hands, then) => {
      if (!successors) throw refusal("rotation-unarmed");
      if (then && !lawfulSeats(then)) throw refusal("roll-malformed");
      const result = await rotateSealEpoch(head, { keys: successors.keys, threshold: successors.threshold }, heldCommitment(then), hands);
      if (!result.ok) throw refusal(result.code);
      const grown = [...chain, result.epoch];
      if (!verifySealLineage(grown)) throw refusal("roll-lineage-invalid");
      return standHeld(grown, successors, then);
    },
  };
}

/**
 * Seat a charter over keys the caller holds. `successors` names the generation the genesis commits, by its
 * keys and threshold; absent, the genesis stands unarmed and refuses to roll. `variant` yields another
 * charter over the same seats: a genesis that commits successors nobody holds, so it never rolls either.
 */
export function heldCharter(opts: HeldSeats & { readonly successors?: HeldSeats; readonly variant?: number }): HeldCharter {
  if (!lawfulSeats(opts)) throw refusal("roll-malformed");
  if (opts.successors && !lawfulSeats(opts.successors)) throw refusal("roll-malformed");
  if (opts.successors && opts.variant !== undefined) throw refusal("variant-never-rolls");
  const commitment = opts.variant === undefined
    ? heldCommitment(opts.successors)
    : hex(sha256BytesSync(utf8Bytes(`charter-fixture|variant|${opts.variant}`)));
  const genesis = genesisCharterEpoch(opts.keys, opts.threshold, commitment);
  return standHeld([genesis], { keys: opts.keys, threshold: opts.threshold }, opts.successors);
}

// ── A doc that only NAMES a charter ──────────────────────────────────────────────────────────────

/**
 * A charter doc that names `aid` and verifies under no law: no seat, no key, one epoch that carries the
 * name. For a reader that takes the name off a doc and checks nothing else.
 */
export function namedCharter(aid: string): NexusDoc {
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: 0, sealEpochCid: aid, kahu: [],
    sealLineage: [{ epochCid: aid, keySetHash: "", nextKeyCommit: "", prevEpochCid: null }],
  };
}
