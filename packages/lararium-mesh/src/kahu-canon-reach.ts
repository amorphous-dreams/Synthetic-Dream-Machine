/**
 * kahu-canon-reach — the ONE predicate that decides whether a hand may write system canon, and the helpers every
 * write door calls before it writes.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road` #/rulings, one owner per registry): only each
 * Nexus's Kahu cabal writes the `lares` and `lararium` bags live. A hand reaches system canon when
 * `kahuCabalCanonAccess` holds for the group that holds the Kahu realm: a counted seat-quorum admission AND a
 * sentinel membership, read apart. This module is that predicate's production caller. Every door that can land
 * a byte in a system bag (the shared residency reactor with every verb it carries, `meme put` and `meme delete`,
 * draft placement, a realm steward's write) calls `requireKahuReach` with the bag it resolved and the source its
 * vessel handed it. A READ and a copy OUT of canon call nothing: canon stays cheap to read and to shadow.
 *
 * FAIL CLOSED. A door handed no source refuses a system bag, and a source that finds no cabal refuses it: a
 * missing source reads as a stranger, never as a pass.
 *
 * THE GROUP SEAM. `kahuRealmGroup` is the one accessor that names the PersonaGroup holding a Nexus's Kahu realm.
 * It reads persona zero's group; the Kahu face's own group (road `P21`) swaps in at this function alone, with no data
 * move, since the realm's storage never keys on the group (`lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane`
 * #/the-seam-owed-to-wave-c).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission
 */
import { BAG_IDS } from "./lar-uris.js";
import { VerbRefusal } from "./verb-refusal.js";
import { kahuCabalCanonAccess, type KahuCabalAccess } from "./kahu-cabal-admission.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";

/** The refusal reason a door raises for a hand outside the Kahu cabal. */
export const KAHU_REACH_REASON = "kahu-reach" as const;

/** The bags the Kahu cabal alone writes: the live `lares` and `lararium` documents. */
export const SYSTEM_CANON_BAGS: readonly string[] = [BAG_IDS.lares, BAG_IDS.lararium];

const SYSTEM_SLUGS = new Set(["lares", "lararium"]);

/** Whether `bag` names a system canon bag, by its URI or its bare slug. */
export function isSystemCanonBag(bag: string): boolean {
  return SYSTEM_CANON_BAGS.includes(bag) || SYSTEM_SLUGS.has(bag);
}

/**
 * THE ONE ACCESSOR for the group that holds a Nexus's Kahu realm. A PersonaGroup id spells `0x` + 64 hex; the
 * cabal's acts key on the bare 64 hex. Persona zero's group holds the realm; the Kahu face's own group (road `P21`)
 * swaps in HERE, and no storage key moves.
 */
export function kahuRealmGroup(personaGroupId: string): string {
  const bare = personaGroupId.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(bare)) throw new Error(`kahu-realm-group: "${personaGroupId.slice(0, 18)}…" reads as no PersonaGroup id`);
  return bare;
}

/** The facts the predicate reads for one hand: its group, the Nexus and charter roster, the board's acts, the sentinel read. */
export interface KahuReachFacts {
  readonly group:          string;
  readonly nexus:          string;
  readonly roster:         KahuQuorumSeats;
  readonly acts:           Iterable<unknown>;
  readonly sentinelMember: boolean;
}

/** A vessel's source of those facts, read at ACCESS and never at boot. Null where the vessel stands in no cabal. */
export type KahuReachSource = () => Promise<KahuReachFacts | null> | KahuReachFacts | null;

/** The charter and board half of the facts: the Nexus, its seated roster and the admission acts its board carries. */
export interface KahuCabalBoard {
  readonly nexus:  string;
  readonly roster: KahuQuorumSeats;
  readonly acts:   Iterable<unknown>;
}

/** A shore's reader of the cabal board (node: the seal home's charter and the carriage board). Null where no charter stands. */
export type KahuCabalBoardReader = () => Promise<KahuCabalBoard | null> | KahuCabalBoard | null;

const STRANGER: KahuCabalAccess = { held: false, standing: "absent", reason: "absent" };

/** The hand's access to system canon: `kahuCabalCanonAccess` over the source's facts, or a stranger's refusal. */
export async function kahuReachAccess(source: KahuReachSource | undefined): Promise<KahuCabalAccess> {
  if (source === undefined) return STRANGER;
  const facts = await source();
  if (facts === null) return STRANGER;
  return kahuCabalCanonAccess(facts);
}

/** Whether the hand holds the Kahu cabal's reach into system canon. */
export async function holdsKahuReach(source: KahuReachSource | undefined): Promise<boolean> {
  return (await kahuReachAccess(source)).held;
}

/**
 * Every write door's one call. Returns at once for a bag outside system canon; for a system bag it throws a
 * `VerbRefusal` (reason `kahu-reach`) unless the hand holds the cabal's reach. `act` names the door in the refusal.
 */
export async function requireKahuReach(bag: string, source: KahuReachSource | undefined, act: string): Promise<void> {
  if (!isSystemCanonBag(bag)) return;
  const access = await kahuReachAccess(source);
  if (access.held) return;
  throw new VerbRefusal(KAHU_REACH_REASON,
    `${KAHU_REACH_REASON}: ${act} into ${bag} refused — system canon takes a hand in the Kahu cabal (${access.reason}); ` +
    "a copy OUT of canon stays open, and an edit copies up into the wiki's own working layer.");
}
