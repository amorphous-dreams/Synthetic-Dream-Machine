/**
 * hearth-floor-pins — a hearth's FLOOR pin set, carried only where a signature or an authenticated relation carries it.
 *
 * House ruling "The admit's gate pin": a floor route takes its pin only through an authenticated relation or a carried signed pin
 * set. Two carriers stand:
 *
 *   · THE SOVEREIGN SESSION. Once a dial's sovereign crossing verified, the hearth sends one sealed "session" message of
 *     kind `HEARTH_FLOOR_PINS_SESSION_KIND` whose body is `{ pins }`: the floor pins it stands at the dialed Nexus. The
 *     crossing is the authenticated relation (the dialer pinned that gate's keys), so the dialer files the set in its pair
 *     index under the hearth it dialed, at floor tier, one per route (`LarWSClientAdapter`).
 *   · THE FLEET-JOIN ANSWER. The answer carries the same set inside the PersonaGroup root's signature (`fleet-join`), so a
 *     joinee holds the oracle's pin before its first crossing.
 *
 * One reader serves both: each pin reads whole, stands at floor tier and at the expected Nexus, and names a route no other
 * pin in the set names. A set that fails any of these reads as none: nothing of it files.
 *
 * A browser that holds no relation with a hearth and carries no signed set for it reads `pin-absent` at that hearth's
 * floor, by ruling (a deliberate narrowing).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-floor-pins
 */
import { readGateBundlePin, type GateBundlePin } from "./gate-bundle.js";

/** The session message kind the hearth's floor pin set rides under. */
export const HEARTH_FLOOR_PINS_SESSION_KIND = "hearth/floor-pins";
/** How many floor pins one set may carry. */
export const HEARTH_FLOOR_PIN_BOUND = 16;

/** Read a floor pin set at `nexusHex` (the Nexus as a pin carries it), or null; null `nexusHex` checks no Nexus. */
export function readHearthFloorPins(value: unknown, nexusHex: string | null): readonly GateBundlePin[] | null {
  try {
    if (!Array.isArray(value) || value.length > HEARTH_FLOOR_PIN_BOUND) return null;
    const routes = new Set<string>();
    const pins: GateBundlePin[] = [];
    for (const raw of value) {
      const read = readGateBundlePin(raw);
      if (!("pin" in read) || read.pin.tier !== "floor" || routes.has(read.pin.route)) return null;
      if (nexusHex !== null && read.pin.nexus !== nexusHex) return null;
      routes.add(read.pin.route);
      pins.push(read.pin);
    }
    return Object.freeze(pins);
  } catch { return null; }
}

/** The session body the hearth sends: `{ pins }`. */
export function hearthFloorPinsBody(pins: readonly GateBundlePin[]): { readonly pins: readonly GateBundlePin[] } {
  return { pins };
}

/** Read a session body as a floor pin set at `nexusHex`, or null. */
export function readHearthFloorPinsBody(body: unknown, nexusHex: string): readonly GateBundlePin[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const keys = Reflect.ownKeys(body);
  if (keys.length !== 1 || keys[0] !== "pins") return null;
  return readHearthFloorPins((body as { pins: unknown }).pins, nexusHex);
}
