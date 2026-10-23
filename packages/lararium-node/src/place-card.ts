/**
 * place-card — the vessel's own self-certifying ContactCard, which a place-arm presentation cannot go without.
 *
 * The card is minted from THE VESSEL'S OWN SEED (`foundThePlace` at a place founding, `mintPlaceCard` here) and rests as the
 * F-class public row `vessel-card`. A joinee node founds no place, so its admit supplies the BINDING and this supplies the
 * SELF: a vessel that reaches the place arm with no card, or with a card of another seed, refuses by name.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/face-proof#/the-place-arm
 */
import { mintPlaceCard, placeCardIsOf } from "@lararium/keyhive";
import { loadVesselCard, loadVesselSigningSeed, loadVesselVerifyingKey, persistVesselCard } from "./node-vessel-identity.js";
import { loadIdentityArchive, persistIdentityArchive } from "./identity-anchors.js";

export class PlaceCardRefused extends Error {
  constructor(readonly why: "absent" | "not-own-seed", detail: string) { super(`[place-card] ${why}: ${detail}`); this.name = "PlaceCardRefused"; }
}

async function readCard(): Promise<string | null> {
  try { return await loadVesselCard(); } catch (e) { if ((e as Error).message.includes("no ContactCard")) return null; throw e; }
}

/** The place card this vessel presents: present and of its own seed, else a named refusal. */
export async function requirePlaceCardOfOwnSeed(): Promise<string> {
  const card = await readCard();
  if (card === null) throw new PlaceCardRefused("absent", "this vessel holds no place card; a joinee mints one from its own seed at its landing (`ensurePlaceCard`)");
  if (!(await placeCardIsOf(card, await loadVesselVerifyingKey()))) throw new PlaceCardRefused("not-own-seed", "the place card at rest names another key than this vessel's own");
  return card;
}

/** Mint the place card from this vessel's own seed where none rests; a card at rest of another seed refuses and is never replaced. */
export async function ensurePlaceCard(): Promise<"kept" | "minted"> {
  const card = await readCard();
  if (card !== null) {
    if (!(await placeCardIsOf(card, await loadVesselVerifyingKey()))) throw new PlaceCardRefused("not-own-seed", "the place card at rest names another key than this vessel's own");
    return "kept";
  }
  const standingArchive = await loadIdentityArchive();
  const minted = await mintPlaceCard({ vesselSeed: await loadVesselSigningSeed(), ...(standingArchive ? { archiveBytes: standingArchive } : {}) });
  await persistVesselCard(minted.contactCardJson);
  if (!standingArchive) await persistIdentityArchive(minted.archive);
  return "minted";
}
