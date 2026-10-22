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
 * THE FLOOR READ RIDES THE PORCH, NOT A PIN. The floor of system canon answers by the Nexus's release (`floor-release`, served at
 * `GET /floor/<Nexus AID>`): a reader holding the Nexus AID verifies the charter's epoch lineage (the genesis epoch re-derives the
 * AID, each step verifies under the prior roster's threshold), the head release and the floor bytes itself (`floor-answer`), so a
 * card's AID anchors a full verification and no signed pointer carries a floor. The AID still rides this house's same-origin
 * trust line; the signed card (`W14`), the pin's causal position (`W15`) and the carry-floor convergence (`W16`) stay owed.
 *
 * A third carrier stands for the oracle's floor pin alone, THE FLOOR CARD (below): the hearth's own banner prints it and the
 * person carries it by hand. A browser that holds no relation with a hearth and carries neither a signed set nor a card for
 * it reads `pin-absent` at that hearth's floor.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-floor-pins
 */
import { base64UrlDecode, base64UrlEncode, utf8Bytes } from "./crypto.js";
import { acceptEd25519Key } from "./ed25519-door.js";
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

// ── The floor card: the oracle floor pin a person carries by hand ──────────────────────────────────

/**
 * THE FLOOR CARD (carrier (c), by the person's own hand): the hearth's own banner prints its oracle floor pin beside the
 * key its oracle snapshot is signed under, and a device's arrival URL carries the two in its fragment, which never
 * reaches a server. The first arrival trusts the lararium's own origin (`pronaos#/the-first-arrival`); a card carried
 * off the hearth's own console rides that same trust, as a fleet-join offer does. A card reaches the FLOOR tier on the
 * oracle route alone: it seats no face and opens no sovereign gate, and a Nexus that answers no stranger meets a
 * faceless reader with silence all the same.
 */
export interface HearthFloorCard {
  /** The oracle's floor pin at the hearth's Nexus. */
  readonly pin:       GateBundlePin;
  /** The Ed25519 key the oracle's pointer is signed under: the publisher, never the gate. */
  readonly publisher: string;
}

/** The route a floor card names: the oracle's. */
export const HEARTH_FLOOR_CARD_ROUTE = "/oracle";

/** A floor card's carried text: base64url of its JSON, no padding. */
export function hearthFloorCardText(card: HearthFloorCard): string {
  return base64UrlEncode(utf8Bytes(JSON.stringify({ pin: card.pin, publisher: card.publisher })));
}

/** Read a carried floor card: a whole floor pin on the oracle route, and a publisher key the one door accepts; else null. */
export function readHearthFloorCard(text: unknown): HearthFloorCard | null {
  try {
    if (typeof text !== "string" || text.length === 0 || text.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(text))) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("pin") || !keys.includes("publisher")) return null;
    const { pin, publisher } = value as { pin: unknown; publisher: unknown };
    const read = readGateBundlePin(pin);
    if (!("pin" in read) || read.pin.tier !== "floor" || read.pin.route !== HEARTH_FLOOR_CARD_ROUTE) return null;
    if (typeof publisher !== "string" || !/^[0-9a-f]{64}$/.test(publisher) || !acceptEd25519Key(publisher).ok) return null;
    return Object.freeze({ pin: read.pin, publisher });
  } catch { return null; }
}
