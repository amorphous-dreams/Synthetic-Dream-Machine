/**
 * floor-verbs — THE ACTS A PLACE ANSWERS WITH NO READABLE CONTROL DOCUMENT (a herm, a hearth before its face, a locked
 * hearth; operator rulings 2026-11-09: a locked hearth fails closed, the control document mints with the face).
 *
 * Two kinds pass the verb door's stand-in check, and only on the maintenance frame (a one-shot; a session belongs to a
 * face): the READ-ONLY QUERIES below, and every ROW OF THE PLACE the store door names (`STORE_DOOR_VERBS` less the rows
 * that act as a face): a herm taking a carry bundle, a lift's founding answering its own refusal. Each runs unledgered and
 * its answer waits in the floor store's memory alone (`floorAnswerStore`). An act that writes a control fact on the way
 * (a receipt fact, a summons, a mailbox row) refuses at that write by the stand-in's name. Every other verb refuses at the
 * door: `control-home-unnamed` on a faceless place, `vessel-locked` on a locked hearth.
 *
 * A VEIL FLOOR ANSWERS MORE (the-veil-ladder#/the-base-model, in-house ruling 7): a faceless place whose floor's rest key
 * stands (an unlocked hearth before its face) mints and composes wikis as the veil, so its door also passes the
 * wiki-minting and composing verbs. Each runs unledgered like every floor act; what it writes names itself in the floor's
 * registry and seals under the floor's key. A locked hearth and a herm pass none of them.
 */
import { STORE_DOOR_FACE_ROWS, STORE_DOOR_VERBS } from "./store-door-verbs.js";

/** The read-only queries a floor answers: each reads the catalog and the bags it registers, and writes nothing. */
export const FLOOR_QUERY_VERBS: readonly string[] = ["where", "resolve", "unbound-docs"];

/** Every verb the verb door runs while the control document stands as a stand-in. */
export const FLOOR_VERBS: ReadonlySet<string> = new Set<string>([
  ...FLOOR_QUERY_VERBS,
  ...STORE_DOOR_VERBS.filter((verb) => !STORE_DOOR_FACE_ROWS.has(verb)),
]);

/** The wiki-minting and composing verbs a veil floor answers as itself (the island's gate names the same four). */
export const VEIL_FLOOR_VERBS: readonly string[] = ["init-wiki", "prune-stale", "add-bag", "remove-bag"];

/** The verbs the verb door runs at a floor: the floor's own, and the veil's four where the floor's rest key stands. */
export function floorVerbsFor(floorKeyStands: boolean): ReadonlySet<string> {
  return floorKeyStands ? new Set<string>([...FLOOR_VERBS, ...VEIL_FLOOR_VERBS]) : FLOOR_VERBS;
}
