/**
 * bag-tier-restamp — the declare act's reach into the standing catalog.
 *
 * `lares bag declare --tier` writes a bag's `meta.mem` on disk and nothing else; the catalog row a standing vessel
 * registered for that bag keeps the `cap-tier` stamp it carried at registration. A bag re-declared public -> private
 * would then stay on the floor catalog (F, signed and public) until the next registration: a confidentiality window.
 * The declare act therefore asks the standing daemon to RE-STAMP the one row, through this reactor: it reads the bag's
 * declared tier (the fs-blind `bagTier` the daemon already holds) and rewrites the row, so the catalog view routes it
 * to its half in the same change.
 *
 * Both directions re-stamp here. Only public -> private is urgent (it leaves F); private -> public fails toward the
 * face, so it would be safe to wait for the next registration, and re-stamping at once simply costs nothing.
 * A bag with no row stands unregistered: nothing to re-stamp, and the registration stamps it when it comes.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/catalog-view
 */

import { CATALOG_ROW_TIER_FIELD, ownEntry, plainField, storedLarRecord, tiddlerText, type CapTier } from "@lararium/mesh";
import type { VerbReactor } from "./verb-dispatcher.js";
import type { CatalogAccessor } from "./catalog-accessor.js";
import { stringArg } from "./handler-args.js";

export interface RestampBagTierOptions {
  readonly catalog: CatalogAccessor;
  /** The declared tier of a bag url, or null when it declares none / stands nowhere (fs-blind inversion). */
  readonly bagTier: (bagUrl: string) => CapTier | null;
}

export function makeRestampBagTierReactor(opts: RestampBagTierOptions): VerbReactor {
  return async (args) => {
    const bagUrl = stringArg(args, "bagUrl");
    if (!bagUrl) throw new Error("args.bagUrl is required (the bag's lar: URI)");
    const handle = await opts.catalog.handle();
    const standing = ownEntry(handle.doc()?.tiddlers, bagUrl);
    const url = tiddlerText(standing);
    if (!standing || !url) return { bagUrl, status: "no-row" };
    const tier = opts.bagTier(bagUrl) === "public" ? "public" : null;
    if ((plainField(standing, CATALOG_ROW_TIER_FIELD) ?? null) === tier) return { bagUrl, status: "unchanged", tier };
    handle.change((doc) => {
      doc.tiddlers[bagUrl] = storedLarRecord(bagUrl, { text: url, kind: "oracle", ...(tier ? { [CATALOG_ROW_TIER_FIELD]: tier } : {}) }, "lares-cli:bag-declare");
    });
    return { bagUrl, status: "restamped", tier };
  };
}
