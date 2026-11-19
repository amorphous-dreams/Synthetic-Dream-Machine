/**
 * wiki-island-reach — A WIKI ISLAND RECEIVES THE DOCUMENTS ITS OWN MOUNT NAMES.
 *
 * The vessel's in-process islands sync as house members, and each island's own store rests what it receives. A wiki island
 * renders one wiki: its slots, its canon, the libraries its recipe names and the floor beneath. So the vessel withholds from
 * it every document it files under a bag that mount does not name and that belongs to someone else's reach: another wiki's
 * slot layers (its margin, draft or working layer), the daemon document (its binding rows name every face's margins), and a
 * face's planes (its registrations, circles, sessions, intents, selves). A document the vessel files under no bag (the
 * engine, the catalog, the oracle, what a recipe resolves by address) reaches it as before.
 *
 * The pool marks each wiki island's peer with the mount it serves (`markWikiIslandPeer`); the daemon island carries no mark
 * and reaches what a house member reaches.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { DAEMON_BAG_ID, isBagId, wikiUri } from "./lar-uris.js";
import { isFaceScopedBag } from "./persona-scope.js";
import { WIKI_SLOT_KINDS, wikiSlotUri, type WikiSlotKind } from "./wiki-recipe.js";

/** The mount one wiki island serves: its slug and every bag its recipe lays (`expandRecipe`). */
export interface WikiIslandMount {
  readonly slug: string;
  readonly bags: readonly string[];
}

/** The wiki and slot kind a bag id names (`wikis/<slug>/<kind>`), or null for any other bag. */
export function wikiSlotOf(bagId: string): { readonly slug: string; readonly kind: WikiSlotKind } | null {
  const prefix = wikiUri("");
  if (!bagId.startsWith(prefix)) return null;
  const rest = bagId.slice(prefix.length);
  const at = rest.lastIndexOf("/");
  if (at <= 0) return null;
  const slug = rest.slice(0, at), kind = rest.slice(at + 1) as WikiSlotKind;
  return (WIKI_SLOT_KINDS as readonly string[]).includes(kind) && wikiSlotUri(slug, kind) === bagId ? { slug, kind } : null;
}

/** Does the vessel withhold a document it files under `bagId` (null: under no bag) from the wiki island serving `mount`? */
export function wikiIslandWithholds(mount: WikiIslandMount, bagId: string | null): boolean {
  if (bagId === null || mount.bags.includes(bagId)) return false;
  const slot = wikiSlotOf(bagId);
  if (slot !== null) return slot.slug !== mount.slug;
  return bagId === DAEMON_BAG_ID || isFaceScopedBag(bagId);
}

const documentIdOf = (url: string | null | undefined): string | null =>
  typeof url === "string" && url.startsWith("automerge:") ? url.slice("automerge:".length) : null;

/**
 * The bag the vessel files a document under, by every name it holds: the slot documents its resolvers named, each further
 * pair the vessel names (`named`: its mounted layers), and the catalog's rows. Null: the vessel files it under no bag.
 */
export function vesselDocBags(input: {
  readonly slotDocs: ReadonlyMap<string, ReadonlySet<string>>;
  readonly catalog?: () => LarDoc | undefined;
  readonly named?: () => Iterable<readonly [string, string | null]>;
}): (documentId: string) => string | null {
  return (documentId) => {
    for (const [bagId, docs] of input.slotDocs) if (docs.has(documentId)) return bagId;
    for (const [bagId, id] of input.named?.() ?? []) if (id === documentId) return bagId;
    for (const [title, row] of Object.entries(input.catalog?.()?.tiddlers ?? {})) {
      if (isBagId(title) && documentIdOf(tiddlerText(row)) === documentId) return title;
    }
    return null;
  };
}
