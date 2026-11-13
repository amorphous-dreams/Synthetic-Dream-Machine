/**
 * serving-key — the SERVING KEY (SK) (lar:///ha.ka.ba/lararium/mesh/ember#/the-serving-key).
 *
 * SK seals the serving tier alone: the rows a serving gate and blind carriage read and write for parties already
 * standing. It mints once, at the founding, as 32 random bytes: no key derives it, and it derives from no other key.
 *
 * ── THE SERVING TREE STANDS ON ITS OWN ──────────────────────────────────────────────────────────
 * SK rests in the serving tree (`sk-slots`), an ordinary slot tree (`keyslot`) whose slots wrap SK under their own human
 * routes, bare by law beside the node tree. No other key wraps SK: the node's S key opens the gate root and the place archive
 * and nothing of the serving tier, so the ember law can lift a resting hearth to SERVING from a second device without the route
 * the S key needs. The founding binds SK's slots over the same typed route as the node tree's, with a wrapped key, a salt and
 * slot ids of their own, so one credential may open both and neither tree holds the other's key.
 */
import { defaultCryptoProvider, type RandomProvider } from "./crypto.js";

declare const servingKeyBrand: unique symbol;
/** The serving key: 32 bytes, minted at the founding or opened through the serving tree, never built from other bytes. */
export type ServingKey = Uint8Array & { readonly [servingKeyBrand]: true };

export const SK_LENGTH = 32;

/** Mint a fresh SK from the founding's own random source. */
export function mintServingKey(rng: RandomProvider = defaultCryptoProvider): ServingKey {
  return rng.getRandomValues(new Uint8Array(SK_LENGTH)) as ServingKey;
}
