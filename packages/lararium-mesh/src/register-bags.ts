/**
 * register-bags — which bags a vessel registers with its capability ring, derived from what it HOLDS.
 *
 * ── THE RULING THIS ENCODES ─────────────────────────────────────────────────────────────────────
 * An anonymous vessel~veil dyad stays private: it stands in no PersonaGroup, so it carries its own ground
 * and nothing else. A vessel that JOINS a PersonaGroup carries that group's work — private and contracted
 * alike — because a fleet that syncs a person's bags to some of their devices and not others has not
 * synced them.
 *
 * The axis is JOINED-OR-NOT, and it is worth naming what it is NOT: founded-versus-admitted. How a
 * membership arrived decides whose signature stands behind the binding; it decides nothing about which
 * bags are the person's work. A founder's own laptop carries their catalog exactly as a phone admitted
 * into the same group does — and the live openers already said so, one registering its catalog while the
 * other did not, which is the drift this module exists to end.
 *
 * ── A VESSEL HOLDS A SET OF MEMBERSHIPS, NEVER ONE ──────────────────────────────────────────────
 * A human runs SEVERAL PersonaGroups, and the same laptop and the same phone may carry more than one of
 * them — a work compartment and a play compartment across one set of devices. So the bags a vessel
 * registers are the UNION over its memberships, each contributing its own persona plane and its own catalog.
 *
 * ── PLANES REGISTER, ONE PLANE MOUNTS, EVERY PLANE ANSWERS TO ONE NAME ──────────────────────────
 * Every group's plane registers here, or that group's own devices stop reconciling. Exactly one MOUNTS
 * as a writable composite layer, because two would shadow each other — that law and its switch live in
 * `persona-planes`, and the name each plane answers to derives in `persona-scope`.
 *
 * A PLANE CARRIES ONE NAME EVERYWHERE: seeded under it, mounted under it, registered under it, named by it
 * in the `oracle` registry and in the admit payload. The capability layer hashes a bag URL to SEED the
 * Keyhive Document behind it and then looks the URL up verbatim to grant access — so two spellings of one
 * plane seed two documents that no later aliasing reconciles. Deixis resolves once, at the boot path that
 * reads a vessel's own sentinels; only absolute names reach this function (canon:
 * persona-circle#the-plane-name).
 *
 * ── WHY IT LIVES HERE AND NOT AT EACH OPENER ────────────────────────────────────────────────────
 * It rode as two hand-written lists, one per platform, and they had drifted: one carried the shared
 * substrate bag and every bag its catalog named, the other carried neither. Keyhive's bag→doc map lives in
 * process memory, so a bag absent from this set can never satisfy a cap check — an operator bag missing
 * here refuses `act LOAD` forever, silently, on the vessel least able to notice.
 *
 * Two hand-written lists of one fact drift, and the one that carries authority drifts silently. One
 * derivation, both vessels, so neither enumerates.
 */

import { type LarDoc, tiddlerText } from "./base-doc.js";
import { BAG_IDS, CATALOG_DOC_URI, DAEMON_BAG_ID, isBagId, recipeUri, wikiUri } from "./lar-uris.js";
import { isFaceScopedBag, personaScopedBagIds, personaSelvesBagIdFor } from "./persona-scope.js";
import { ownEntry, plainMeta } from "./stored-value.js";
import { houseCanonBagsSeated, isHouseCanonBag } from "./kahu-canon-reach.js";
import { DAEMON_WIKI_SLUG, daemonFaceCanonBag, wikiSlotUri } from "./wiki-recipe.js";

/**
 * The bag URIs the `catalog` registry NAMES — the PersonaGroup's own work, read from the projection.
 *
 * The catalog keys by bag URI, each entry's text carrying that bag's automerge url. `act CREATE` writes a
 * durable entry here and nothing else registers the bag with keyhive, whose bag→doc map lives in process
 * memory — so reading the catalog at boot is what lets a cap check resolve for a bag the person made
 * yesterday, across restarts, without this module ever learning its name.
 *
 * An entry whose text carries no automerge url names a bag that never minted; it is skipped rather than
 * registered as a doc that cannot resolve.
 *
 * IT ADMITS ONLY BAGS. The catalog holds other kinds keyed the same way — a wiki slot's per-device draft
 * pointer is a `wikis/slug/drafts/<did>` title whose text is an automerge url, indistinguishable from a
 * bag entry by shape alone. Registering one mints a Keyhive Document for a thing that is not a bag, and
 * nothing throws. A reader that walks a registry and takes every entry for its own kind will register
 * whatever else was written there, and something else is always written there.
 *
 * It lived at ONE opener, which is why the other could not open its own operator's bags.
 */
export function catalogNamedBags(doc: LarDoc | undefined | null): string[] {
  const tiddlers = doc?.tiddlers ?? {};
  return Object.keys(tiddlers).filter(
    (title) => isBagId(title) && (tiddlerText(ownEntry(tiddlers, title)) ?? "").startsWith("automerge:"),
  );
}

/**
 * THE FACE'S OWN LAYERS A CATALOG ANNOUNCES: the `personal` layer and the `draft` binding (`isFaceSlotBag`) of every wiki
 * the catalog names by its recipe row (`catalog/recipes/<slug>`, the row `wiki init` writes). The catalog a vessel reads
 * merges the WORN face's own rows over the floor's (`catalog-view`), and no other face's catalog binds there, so the
 * answer names the worn face's layers alone. The boot registers each before any slot document opens, so the holder's
 * reading founds every personal layer the resolver names afterwards.
 */
export function catalogFaceSlotBags(doc: LarDoc | undefined | null): string[] {
  const tiddlers = doc?.tiddlers ?? {};
  const prefix = recipeUri("catalog", "");
  const out: string[] = [];
  for (const title of Object.keys(tiddlers)) {
    if (!title.startsWith(prefix)) continue;
    const slug = title.slice(prefix.length);
    if (!slug || slug.includes("/") || plainMeta(ownEntry(tiddlers, title) as never, "deleted") === true) continue;
    out.push(...[wikiSlotUri(slug, "personal"), wikiSlotUri(slug, "draft")].filter(isFaceSlotBag));
  }
  return [...new Set(out)];
}

/** One PersonaGroup this vessel stands in, and the work that group brings with it. */
export interface FleetMembership {
  /** The PersonaGroup this membership names. Distinct groups contribute distinct planes. */
  readonly personaGroupId: string;
  /**
   * Every bag this group's catalog NAMES — read from the projection rather than hard-coded, so a bag the
   * person made yesterday registers today without this module learning its name.
   */
  readonly catalogNamed?: readonly string[];
}

/** What a vessel holds at the moment it registers. Every field a FACT about this vessel, never a platform. */
export interface RegisterBagsInput {
  /** Every PersonaGroup this vessel stands in. Empty reads as the anon dyad — a posture, never a gap. */
  readonly fleets: readonly FleetMembership[];
  /** The wiki slot's bag ids, when a wiki stands in the stack. A Herm carries none — blind by structure. */
  readonly wikiBags?: readonly string[];
  /** True where the Kahu cabal admitted this vessel's group and the keel mounted the live system documents: the
   *  vessel then registers every house canon bag (`houseCanonBagsSeated`). Absent = it holds no canon document. */
  readonly systemCanon?: boolean;
}

/**
 * The bags every vessel registers whatever it stands in — its own control plane, and the shared substrate.
 *
 * Every id here belongs to the VESSEL or to the mesh beneath it: its daemon, the catalog and oracle it
 * reads through, and the substrate bags a vessel needs to stand at all. NO PLANE OF A FACE sits among
 * them — not the persona plane, and not the circles, identities, sessions or intents that travel with it. Those
 * belong to a PERSONAGROUP and arrive through this vessel's memberships, so a vessel standing in no group
 * holds none of them, and a vessel standing in several holds one set per face.
 */
const OWN_GROUND = [
  DAEMON_BAG_ID, BAG_IDS.catalog, BAG_IDS.oracle,
] as const;

/**
 * The LIVE house canon (`houseCanonBagsSeated`): ground for the Kahu cabal's vessel alone. It rests in the Kahu realm
 * (`kahu-realm`), so a vessel outside the cabal holds no document of it and registers none of its bags, the canon bag of the
 * wiki it stands included (`deriveRegisterBags` leaves a house canon bag out of `wikiBags` without `systemCanon`). It remains
 * vessel-ground in KIND: the daemon's own key holds its caps, as it holds the substrate's.
 */
export function isVesselGround(bag: string): boolean {
  return (OWN_GROUND as readonly string[]).includes(bag) || isHouseCanonBag(bag);
}

/**
 * The bags this vessel registers, derived — its ground, its wiki, and the union over the groups it stands in.
 *
 * Each membership contributes THE WHOLE FACE — its persona plane and the circles, identities, sessions and intents
 * that travel with it, all five derived off the one tag that group's doc id yields, and its selves record — plus every bag that
 * group's catalog names. Order stays stable and duplicates collapse, so two vessels in the same groups
 * produce one comparable set, and two groups naming a bag in common register it once.
 */
export function deriveRegisterBags(input: RegisterBagsInput): string[] {
  // A HOUSE CANON BAG ENTERS THROUGH THE CABAL'S ADMISSION ALONE. The wiki a face stands may compose house canon (`lares`), and
  // its slot names that canon bag as the wiki's own; a vessel outside the cabal holds no document of it, so it registers the
  // wiki's slots and never the canon bag: its read cap over that bag never forms, and its reads answer from the floor.
  const wikiBags = (input.wikiBags ?? []).filter((bag) => input.systemCanon === true || !isHouseCanonBag(bag));
  const out: string[] = [...OWN_GROUND, ...(input.systemCanon === true ? houseCanonBagsSeated() : []), ...wikiBags];
  for (const fleet of input.fleets) {
    const face = personaScopedBagIds(fleet.personaGroupId);
    // The catalog names every face's planes; a group registers ITS own (above) and its selves record, and never another face's,
    // which the derived shape recognises without any list of the others.
    out.push(face.persona, face.circles, face.identities, face.sessions, face.intents, personaSelvesBagIdFor(fleet.personaGroupId),
      ...(fleet.catalogNamed ?? []).filter((bag) => !isFaceScopedBag(bag)));
  }
  return [...new Set(out)];
}

/** A wiki slot's three bags, as a vessel's mounted slot names them. */
export interface WikiSlotBags {
  readonly wikiBagId: string;
  readonly workingBagId: string;
  readonly draftBagId: string;
}

/**
 * THE DAEMON WIKI'S OWN SLOTS: its working and draft slots, the D half of the daemon bag (sealed-store#/owed, U1). The
 * working slot carries the verb outcome ledger and the receipt facts; each seals under the lit face. The daemon wiki's
 * canon bag and the daemon document (`DAEMON_BAG_ID`) stand on the floor, clear and signed, and never join this set.
 */
/** The bag the face's own catalog document answers to (`catalog-view`), sealed under the lit face. */
export const FACE_CATALOG_BAG_ID = `${CATALOG_DOC_URI}/face`;

export const DAEMON_WIKI_SLOT_BAGS: readonly string[] = [wikiSlotUri("daemon", "working"), wikiSlotUri("daemon", "draft"), wikiSlotUri("daemon", "personal")];

/**
 * The daemon canon bag a worn face stands (`daemonFaceCanonBag`), or null. The canon's document seals under the face, so it
 * stands only where {@link wornFaceWikiBags} registers and seals its bag: a face that stands lit and proved. A worn face
 * that stands unlit, and the floor, stand none.
 */
export function standingDaemonCanonBag(input: { readonly lit: boolean; readonly faceRelation: string | null }): string | null {
  return input.lit && input.faceRelation ? daemonFaceCanonBag(input.faceRelation) : null;
}

/**
 * THE LIT SET: the bags a face OWNS while it stands lit, worn or beside the worn face: the daemon wiki's device slots, its daemon
 * canon (where its relation stands known), its own catalog half, and its own selves record (`personaSelvesBagIdFor`, where its
 * group stands known). A sibling face's hive registers these and never a user wiki's bags, which belong to the worn face's mount.
 *
 * THE SELVES RECORD SEALS UNDER ITS OWN FACE'S HIVE. The vessel's bag map files a lit face's record under that face's subject
 * (`selvesRecordBagOf`), so its save books that face's own session; a hive that left the bag out read the writer
 * `writer-not-capable` and the bag `bag-unfounded`, and the save waited in memory under a face that stood lit and open.
 */
export function litFaceOwnBags(faceRelation: string | null | undefined, personaGroupId?: string | null): string[] {
  return [...DAEMON_WIKI_SLOT_BAGS, ...(faceRelation ? [daemonFaceCanonBag(faceRelation)] : []), FACE_CATALOG_BAG_ID,
    ...(personaGroupId ? [personaSelvesBagIdFor(personaGroupId)] : [])];
}

/**
 * The wiki bags a vessel's worn face carries: `registered`, the wiki bags the face's hive registers (`deriveRegisterBags`'s
 * `wikiBags`), and `sealed`, the bags the sealed rest seals under that face. `lit` reads true only while the face stands
 * lit and proved.
 *
 * EVERY BAG THE REST SEALS, THE FACE REGISTERS. A record a session seals there carries the face's certificate, and its
 * reader reads the writer capable only over a bag the face registers (`ownChainStanding`); a sealed bag outside the
 * register set reads `writer-not-capable`, its seal refuses, and a flush waits on it. The user wiki's slots register at
 * the floor and lit alike, as a wiki stack stands; the daemon wiki's slots register and seal under the lit face alone.
 */
export function wornFaceWikiBags(input: { readonly slot?: WikiSlotBags | undefined; readonly lit: boolean; readonly daemonCanon?: string; readonly announced?: Iterable<string> }): { readonly registered: string[]; readonly sealed: string[] } {
  const user = input.slot ? [input.slot.wikiBagId, input.slot.workingBagId, input.slot.draftBagId] : [];
  // EVERY PERSONAL LAYER AND DRAFT THE WORN FACE'S RESOLVER NAMED (`isFaceSlotBag`): the face's own layers of each wiki, the mount
  // slot's and every other wiki's alike, seal under the lit face. The island registers each on the face's hive before it
  // names it (`announceSlotDoc`), so the seal finds the writer capable.
  // THE MOUNT'S OWN PERSONAL LAYER rides with them from the boot: the slot names the wiki, so the face's `personal` layer of it
  // derives off the slot's draft, and no naming has to come first.
  const personal = input.slot ? facePersonalBeside(input.slot.draftBagId) : null;
  const named = input.lit ? [...new Set([...(personal ? [personal] : []), ...(input.announced ?? [])].filter(isFaceSlotBag))] : [];
  // The face's own catalog (U1's D half of the catalog) rides with the daemon wiki's slots: the island registers it at
  // boot, so its holder holds the catalog's key before the lift opens the sealed document. The vessel's control document
  // seals beside the secret home under the vessel's own key (`secret-home`), never under one face.
  // The worn face's daemon canon (`bags/daemon-<F>`, `daemonFaceCanonBag`) rides with them too: a face's daemon wiki content.
  const faceOwn = input.lit ? [...DAEMON_WIKI_SLOT_BAGS, ...(input.daemonCanon ? [input.daemonCanon] : []), FACE_CATALOG_BAG_ID] : [];
  return {
    registered: [...new Set([...user, ...faceOwn, ...named])],
    sealed: [...new Set([...(input.lit ? user : []), ...faceOwn, ...named])],
  };
}

/** The `personal` layer of the wiki whose `draft` binding `draftBagId` names, or null where it names no face's layer. */
function facePersonalBeside(draftBagId: string): string | null {
  const suffix = "/draft";
  return isFaceSlotBag(draftBagId) && draftBagId.endsWith(suffix) ? `${draftBagId.slice(0, -suffix.length)}/personal` : null;
}

/**
 * A FACE'S OWN LAYER OF A WIKI: `wikis/<slug>/personal` or `wikis/<slug>/draft` for any wiki but the daemon's (whose slots
 * file by their owner as device documents, `device-daemon-docs`). The face's resolver binds each to that face alone (the
 * PersonaGroup × recipe binding), so it seals under that face. A wiki's working layer stays out: it rests in the wiki's
 * realm workbench, which a realm's faces share.
 */
export function isFaceSlotBag(bagId: string): boolean {
  const prefix = wikiUri("");
  if (!bagId.startsWith(prefix)) return false;
  const rest = bagId.slice(prefix.length);
  const at = rest.lastIndexOf("/");
  if (at <= 0) return false;
  const slug = rest.slice(0, at), kind = rest.slice(at + 1);
  if (slug === DAEMON_WIKI_SLUG || (kind !== "personal" && kind !== "draft")) return false;
  return wikiSlotUri(slug, kind) === bagId;
}
