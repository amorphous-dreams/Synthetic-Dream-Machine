/**
 * wire-names — the names our wire shapes answer by, and nothing else: no import, no logic, so a page on the main thread
 * reads them without loading the mesh (`@lararium/mesh/wire-names`).
 *
 * ONE OWNER PER NAME. Each producer module re-exports its name from here (the genesis seed from `genesis-doc`, the arrival
 * descriptor from the node's `pronaos-adapter`, the floor shapes from `floor-manifest`, `floor-answer`, `floor-accept` and
 * `floor-announcement`), so a rename moves the page and the producer together. Every name reads as a shape, never a
 * version: a reader refuses any other name, a counter-suffixed one among them.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */

/** The plain-data genesis seed's shape name (`genesis/seed.json`). */
export const GENESIS_SEED_FORMAT = "lararium-genesis-seed" as const;
/** The arrival descriptor's shape name (`/.well-known/lar`). */
export const ARRIVAL_FORMAT = "lar-arrival" as const;
/** The floor manifest's shape name. */
export const FLOOR_MANIFEST_FORMAT = "lararium-floor" as const;
/** The porch's floor answer (`GET /floor/<Nexus AID>`). */
export const FLOOR_ANSWER_FORMAT = "lararium-floor-answer" as const;
/** A place's accept of a Nexus's floor (`<floor-accept bag>/accept/<Nexus AID>`, in the accept home the floor key seals). */
export const FLOOR_ACCEPT_KIND = "floor-accept" as const;
/** A floor's signed announcement body. */
export const FLOOR_ANNOUNCEMENT_KIND = "floor-announcement" as const;
