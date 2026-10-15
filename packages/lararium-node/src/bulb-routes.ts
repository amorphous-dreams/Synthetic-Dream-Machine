/**
 * bulb-routes — the bulb read-face's paths, and the one closed door, spelled ONCE.
 *
 * `bulb-read-face` answers these and `kindle` asks for them. Spelled twice, the two move only when
 * somebody remembers both — and they never run in one process, so nothing forces the memory: a vessel and
 * a Herm built from different commits would simply miss each other, a failure that reads as a peer being
 * down rather than as a rename that half-landed.
 *
 * The CAS route rides here for the same reason: the read-face claims that prefix alongside `/bulb/`, so a
 * reader deciding what this face owns finds both in one place.
 *
 * EVERY ROUTE HERE IS ADDRESSED BY A CID THE CLIENT ALREADY NAMES. No route lists, describes or indexes
 * what the face holds, so a stranger who arrives without a CID learns nothing it did not bring.
 */

import type { ServerResponse } from "node:http";

/** The prefixes this read-face claims. A path outside them belongs to another handler. */
export const BULB_ROUTE_PREFIX = "/bulb/";
export const CAS_ROUTE_PREFIX  = "/cas/";

/** The content-addressed blob path for one cid. */
export function bulbBlobRoute(cid: string): string {
  return `${BULB_ROUTE_PREFIX}${cid}.bin`;
}

/** The blob route as the SERVER matches it — one 64-hex cid, captured. */
export const BULB_BLOB_RE = new RegExp(`^${BULB_ROUTE_PREFIX}([0-9a-f]{64})\\.bin$`);
/** The public-CAS route as the SERVER matches it — one 64-hex cid, captured, no extension. */
export const CAS_BLOB_RE  = new RegExp(`^${CAS_ROUTE_PREFIX}([0-9a-f]{64})$`);

/**
 * THE CLOSED DOOR — the one answer every unknown, refused or withheld path draws.
 *
 * The vessel dispatcher draws it for a path no face claims, and every face draws it for a path it withholds or
 * refuses, so a stranger cannot tell an unclaimed path from a CID this face withholds, a wrong method, a blob it
 * never held, or a face that answers only a proven peer (shelter-against-empire#/legibility: a surface that
 * answers a stranger distinguishably reads as an oracle). It is spelled here alone; every refusal imports it.
 * It carries no CORS grant and no text that names what answered.
 */
export const CLOSED_DOOR = {
  status:  404,
  headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  body:    "route unavailable",
} as const;

/** Answer the closed door, unless a response already began. */
export function answerClosedDoor(res: ServerResponse): void {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(CLOSED_DOOR.status, CLOSED_DOOR.headers);
  res.end(CLOSED_DOOR.body);
}
