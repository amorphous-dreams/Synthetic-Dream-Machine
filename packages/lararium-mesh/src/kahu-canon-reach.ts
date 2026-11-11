/**
 * kahu-canon-reach — the ONE house-canon set and the ONE predicate that decides whether a hand may write it, and the helpers every
 * write door calls before it writes.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road` #/rulings, one owner per registry): only each
 * Nexus's Kahu cabal writes the `lares` and `lararium` bags live, and the house canon widens that to every disk-sourced
 * holding (`houseCanonSlugs`). A hand reaches house canon when
 * `kahuCabalCanonAccess` holds for the group that holds the Kahu realm: a counted seat-quorum admission AND a
 * sentinel membership, read apart. This module is that predicate's production caller. Every door that can land
 * a byte in a house canon bag (the shared residency reactor with every verb it carries, `meme put` and `meme delete`,
 * draft placement, a realm steward's write) calls `requireKahuReach` with the bag it resolved and the source its
 * vessel handed it. A READ and a copy OUT of canon call nothing: canon stays cheap to read and to shadow.
 *
 * FAIL CLOSED. A door handed no source refuses a house canon bag, and a source that finds no cabal refuses it: a
 * missing source reads as a stranger, never as a pass.
 *
 * THE GROUP SEAM. `kahuRealmGroup` is the one accessor that names the PersonaGroup holding a Nexus's Kahu realm.
 * It reads persona zero's group; the Kahu face's own group (road `P21`) swaps in at this function alone, with no data
 * move, since the realm's storage never keys on the group (`lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane`
 * #/the-seam-owed-to-wave-c).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission
 */
import { bagUri } from "./lar-uris.js";
import { VerbRefusal } from "./verb-refusal.js";
import { kahuCabalCanonAccess, type KahuCabalAccess } from "./kahu-cabal-admission.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";

/** The refusal reason a door raises for a hand outside the Kahu cabal. */
export const KAHU_REACH_REASON = "kahu-reach" as const;

/**
 * THE HOUSE CANON — ONE SET, DERIVED. Every holding whose canon source stands on disk (the checkout's `bags/<slug>`, read
 * by the vessel at boot) rests in the Kahu realm at CONTRACT and publishes to every DreamNet user as a floor snapshot by
 * CID; the Kahu steward alone writes it live. Two names stand apart from the derivation: the system canon (`lares`,
 * `lararium`) belongs to the set on every vessel, a checkout or none, and the Nexus's public board (`crossroads`, a floor
 * row every face reads) never joins it.
 */
export const SYSTEM_CANON_SLUGS: readonly string[] = ["lares", "lararium"];
/** The holdings a checkout carries that stay the Nexus's public board, never house canon. */
export const PUBLIC_BOARD_SLUGS: readonly string[] = ["crossroads"];

/** The house canon's slugs over a vessel's disk-sourced holdings: the system canon, plus every sourced slug but the board. */
export function houseCanonSlugs(sourcedSlugs: Iterable<string> = []): string[] {
  const out = new Set(SYSTEM_CANON_SLUGS);
  for (const slug of sourcedSlugs) if (/^[a-z0-9][a-z0-9-]*$/.test(slug) && !PUBLIC_BOARD_SLUGS.includes(slug)) out.add(slug);
  return [...out].sort();
}

/** The house canon's bag URIs over a vessel's disk-sourced holdings. */
export function houseCanonBags(sourcedSlugs: Iterable<string> = []): string[] {
  return houseCanonSlugs(sourcedSlugs).map((slug) => bagUri(slug));
}

const BAG_PREFIX = bagUri("");

/**
 * THE SEATED SET. A vessel seats its house canon ONCE at boot, off its own disk-sourced holdings (`seatHouseCanon`); every
 * door that asks `isHouseCanonBag` reads the seat. A process that seats nothing (a browser vessel, which reads no checkout;
 * a unit test) holds the system canon alone, so the seat only ever WIDENS the set past `lares` and `lararium`.
 */
let SEATED: ReadonlySet<string> = new Set(houseCanonSlugs());

/** Seat this process's house canon off its disk-sourced holdings. Idempotent; returns the seated bag URIs. */
export function seatHouseCanon(sourcedSlugs: Iterable<string>): string[] {
  SEATED = new Set(houseCanonSlugs(sourcedSlugs));
  return houseCanonBagsSeated();
}

/** The seated house canon's slugs (sorted). */
export function houseCanonSlugsSeated(): string[] { return [...SEATED].sort(); }

/** The seated house canon's bag URIs (sorted by slug). */
export function houseCanonBagsSeated(): string[] { return houseCanonSlugsSeated().map((slug) => bagUri(slug)); }

/** Whether `bag` names a house canon bag, by its URI or its bare slug, against the seated set. */
export function isHouseCanonBag(bag: string): boolean {
  const slug = bag.startsWith(BAG_PREFIX) ? bag.slice(BAG_PREFIX.length) : bag;
  return SEATED.has(slug);
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

/** The hand's access to house canon: `kahuCabalCanonAccess` over the source's facts, or a stranger's refusal. */
export async function kahuReachAccess(source: KahuReachSource | undefined): Promise<KahuCabalAccess> {
  if (source === undefined) return STRANGER;
  const facts = await source();
  if (facts === null) return STRANGER;
  return kahuCabalCanonAccess(facts);
}

/** Whether the hand holds the Kahu cabal's reach into house canon. */
export async function holdsKahuReach(source: KahuReachSource | undefined): Promise<boolean> {
  return (await kahuReachAccess(source)).held;
}

/**
 * Every write door's one call. Returns at once for a bag outside house canon; for a house canon bag it throws a
 * `VerbRefusal` (reason `kahu-reach`) unless the hand holds the cabal's reach. `act` names the door in the refusal.
 */
export async function requireKahuReach(bag: string, source: KahuReachSource | undefined, act: string): Promise<void> {
  if (!isHouseCanonBag(bag)) return;
  const access = await kahuReachAccess(source);
  if (access.held) return;
  throw new VerbRefusal(KAHU_REACH_REASON,
    `${KAHU_REACH_REASON}: ${act} into ${bag} refused — house canon takes a hand in the Kahu cabal (${access.reason}); ` +
    "a copy OUT of canon stays open, and an edit copies up into the wiki's own working layer.");
}
