/**
 * bulb-routes — the bulb read-face's paths, spelled ONCE.
 *
 * `bulb-read-face` answers these and `kindle` asks for them. Spelled twice, the two move only when
 * somebody remembers both — and they never run in one process, so nothing forces the memory: a vessel and
 * a Herm built from different commits would simply 404 at each other, a failure that reads as a peer being
 * down rather than as a rename that half-landed.
 *
 * The CAS route rides here for the same reason: the read-face claims that prefix alongside `/bulb/`, so a
 * reader deciding what this face owns finds both in one place.
 */

/** The prefixes this read-face claims. A path outside them belongs to another handler. */
export const BULB_ROUTE_PREFIX = "/bulb/";
export const CAS_ROUTE_PREFIX  = "/cas/";

export const BULB_MANIFEST_ROUTE = `${BULB_ROUTE_PREFIX}manifest`;
export const BULB_POINTER_ROUTE  = `${BULB_ROUTE_PREFIX}pointer`;

/** The content-addressed blob path for one cid. */
export function bulbBlobRoute(cid: string): string {
  return `${BULB_ROUTE_PREFIX}${cid}.bin`;
}

/** The blob route as the SERVER matches it — one 64-hex cid, captured. */
export const BULB_BLOB_RE = new RegExp(`^${BULB_ROUTE_PREFIX}([0-9a-f]{64})\\.bin$`);
/** The public-CAS route as the SERVER matches it — one 64-hex cid, captured, no extension. */
export const CAS_BLOB_RE  = new RegExp(`^${CAS_ROUTE_PREFIX}([0-9a-f]{64})$`);
