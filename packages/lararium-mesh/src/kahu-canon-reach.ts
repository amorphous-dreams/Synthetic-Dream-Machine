/**
 * kahu-canon-reach — the ONE house-canon set and the ONE predicate that decides whether a hand may write it, and the helpers every
 * write door calls before it writes.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road` #/rulings, one owner per registry): only each
 * Nexus's Kahu cabal writes the `lares` and `lararium` bags live, and the house canon widens that to every disk-sourced
 * holding (`houseCanonSlugs`). A hand reaches house canon when
 * `kahuCabalCanonAccess` holds for the group that holds the Kahu realm: a counted seat-quorum admission AND a
 * sentinel membership, read apart. This module is that predicate's production caller. Every door that can land
 * a byte in a house canon bag (the shared residency reactor with every verb it carries, `lares put` and `lares delete` on a bag,
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
import { namesTw5Docs } from "./tw5-docs-name.js";
import { kahuCabalCanonAccess, type KahuCabalAccess } from "./kahu-cabal-admission.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";
import type { Hand } from "./session-contract.js";

/** The refusal reason a door raises for a hand outside the Kahu cabal. */
export const KAHU_REACH_REASON = "kahu-reach" as const;

/**
 * The refusal reason a door raises for the AI seat on a house canon bag (reach-mu T4-2). Every seat call acts as the daemon
 * mount, and the mount holds the Kahu chair, so the Kahu predicate alone would let a seat-asked write land in canon; the
 * seat's own road runs through a wiki's working layer and an offer the steward promotes.
 */
export const SEAT_CANON_REACH_REASON = "seat-canon-reach" as const;

/**
 * THE HOUSE CANON — ONE SET, DERIVED. Every holding whose canon source stands on disk (the checkout's `bags/<slug>`, read
 * by the vessel at boot) rests in the Kahu realm at CONTRACT, and the Kahu steward alone writes it live. A holding whose own
 * `meta.mem` declares `cap-tier = "public"` also publishes to every DreamNet user as a floor snapshot by CID
 * (`floorCarriesTier`); one declared tighter (a referee's `contract` bag) stays house canon and keys no snapshot. Two names stand apart from the derivation: the system canon (`lares`,
 * `lararium`) belongs to the set on every vessel, a checkout or none, and the Nexus's public board (`crossroads`, a floor
 * row every face reads) never joins it.
 */
export const SYSTEM_CANON_SLUGS: readonly string[] = ["lares", "lararium"];
/** The holdings a checkout carries that stay the Nexus's public board, never house canon. */
export const PUBLIC_BOARD_SLUGS: readonly string[] = ["crossroads"];

/** The house canon's slugs over a vessel's disk-sourced holdings: the system canon, plus every sourced slug but the board. */
export function houseCanonSlugs(sourcedSlugs: Iterable<string> = []): string[] {
  const out = new Set(SYSTEM_CANON_SLUGS);
  for (const slug of sourcedSlugs) if (/^[a-z0-9][a-z0-9-]*$/.test(slug) && !PUBLIC_BOARD_SLUGS.includes(slug) && !namesTw5Docs(slug)) out.add(slug);
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
 * The seat's half of the gate, for a door that clears house canon elsewhere (the routed verb's gate): throws a `VerbRefusal`
 * (reason `seat-canon-reach`) where the asker reads `seat` and `bag` stands in house canon; returns otherwise. The refusal
 * names the seat's own road (a copy-up through the wiki, then an offer), never a vault unlock.
 */
export function refuseSeatCanonReach(bag: string, act: string, asker: Hand | undefined): void {
  if (asker !== "seat" || !isHouseCanonBag(bag)) return;
  // The seat offers and never promotes: a promotion's cure names the operator's own hand, every other act's the offer road.
  const cure = act === "offer promote"
    ? "the AI seat offers and never promotes; the promotion rides the operator's own hand: `lares meme offer promote <cid>` from the operator's own terminal."
    : "write the wiki's working layer instead (`recipe=<slug>`, a copy-up), then offer the record toward the canon bag (`act(address="lar:///realm.offer.signs", args={...})` on the seat), and the steward promotes it.";
  throw new VerbRefusal(SEAT_CANON_REACH_REASON,
    `${SEAT_CANON_REACH_REASON}: ${act} into ${bag} refused — the AI seat never writes house canon live, whatever face it acts as; ${cure}`);
}

/**
 * Every write door's one call. Returns at once for a bag outside house canon; for a house canon bag it throws a
 * `VerbRefusal` (reason `seat-canon-reach`) for an AI seat asker, before any Kahu read, and otherwise (reason `kahu-reach`)
 * unless the hand holds the cabal's reach. `act` names the door in the refusal; `asker` names the asker's hand as the
 * vessel's door read it (`VerbContext.asker`), absent where no door read one (the tab's record port, the steward's promote).
 */
export async function requireKahuReach(bag: string, source: KahuReachSource | undefined, act: string, asker?: Hand): Promise<void> {
  if (!isHouseCanonBag(bag)) return;
  refuseSeatCanonReach(bag, act, asker);
  const access = await kahuReachAccess(source);
  if (access.held) return;
  throw new VerbRefusal(KAHU_REACH_REASON,
    `${KAHU_REACH_REASON}: ${act} into ${bag} refused — house canon takes a hand in the Kahu cabal (${access.reason}); ` +
    "the steward's face holds that chair, so wear the steward's face: `lares vault unlock --face <n>`, the face the Kahu cabal admitted; " +
    "a copy OUT of canon stays open, and an edit copies up into the wiki's own working layer.");
}
