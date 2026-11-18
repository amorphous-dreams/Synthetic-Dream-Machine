/**
 * house-canon-doc — THE ONE RESOLVER for the document a house canon bag answers from, and the address a house canon
 * wiki keys on where the vessel holds no live document.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer ("One canon document")
 */

import { isHouseCanonBag } from "./kahu-canon-reach.js";

/** What answered: the Kahu realm's standing document (its url), or a registry row (whatever the door reads a row as). */
export type HouseCanonAnswer<T> = { readonly realm: string } | { readonly row: T };

/**
 * resolveHouseCanon — the one order every door reads. A house canon bag (`isHouseCanonBag`) rests in the Kahu realm: where
 * the door's `realm` reader names a standing document for it, THAT document answers and no registry row is read at all (the
 * document the keel mounts, the mirror projects, the retire and the floor cut read). A registry row answers only where the
 * realm names none (a rig, a vessel outside every realm), and for every bag that carries no house canon. `row` runs lazily,
 * so a door whose row read costs a document find pays it only when the realm stays silent. A `realm` reader that throws
 * propagates: a door that would rather read silence wraps its own reader.
 */
export async function resolveHouseCanon<T>(
  bag: string,
  door: { readonly realm?: ((bag: string) => Promise<string | null> | string | null) | undefined; readonly row: () => Promise<T | null> | T | null },
): Promise<HouseCanonAnswer<T> | null> {
  if (door.realm && isHouseCanonBag(bag)) {
    const url = await door.realm(bag);
    if (url) return { realm: url };
  }
  const row = await door.row();
  return row === null ? null : { row };
}

/** The url a url-reading door takes off `resolveHouseCanon`'s answer. */
export function houseCanonUrl(answer: HouseCanonAnswer<string> | null): string | null {
  return answer === null ? null : "realm" in answer ? answer.realm : answer.row;
}

const FLOOR_CANON_SCHEME = "floor:";

/**
 * THE FLOOR ADDRESS of a house canon bag: the name a wiki standing on that bag keys its slot bindings on (the recipe
 * fingerprint's `wikiDocId`) where the vessel holds no live document for it. It names the bag's floor snapshot, which the
 * wiki reads through `@oracle`; it names NO document, so nothing mounts from it, no catalog row carries it, and every boot
 * of every vessel derives the same name. A face's draft and personal bindings stay PersonaGroup-scoped (and vessel-scoped
 * where no face sits) by the binding's own key, never by this address.
 */
export function floorCanonAddress(bag: string): string { return `${FLOOR_CANON_SCHEME}${bag}`; }

/** Whether `address` names a floor address (no document stands behind it; an island lays no layer from it). */
export function isFloorCanonAddress(address: string): boolean { return address.startsWith(FLOOR_CANON_SCHEME); }

/**
 * THE ADDRESS A WIKI'S CANON KEYS ON, for a wiki this session has not mounted: the document `resolveHouseCanon` names; else,
 * for a house canon bag, its floor address; else null (a user wiki no row names does not stand).
 */
export async function wikiCanonAddress(bag: string, door: Parameters<typeof resolveHouseCanon<string>>[1]): Promise<string | null> {
  return houseCanonUrl(await resolveHouseCanon<string>(bag, door)) ?? (isHouseCanonBag(bag) ? floorCanonAddress(bag) : null);
}
