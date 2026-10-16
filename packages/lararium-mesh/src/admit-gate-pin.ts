/**
 * admit-gate-pin — the pin an admit carries, and the index a dial files it in.
 *
 * Holds the PIN SHAPE seam of the operator's ruling "The admit's gate pin": the admit carriage and the
 * fleet-join answer sign a validated full `GateBundlePin` for the hearth's sovereign sync route at the named
 * Nexus, read by `readGateBundlePin`, and the admit's digest derives from that object. Dials index by
 * (hearth, Nexus, route, tier). Floor routes receive their own full pins through an authenticated relation or
 * a carried signed pin set; an announcement never authenticates its own first pin.
 *
 *   · READ. `readAdmitGatePin` reads the gate-bundle pin, then holds it to the sovereign tier, the sovereign
 *     sync route and, where asked, the Nexus the admit names. Each miss refuses by name.
 *   · DIGEST. `admitGatePinDigest` is the gate-bundle digest of the validated pin, nothing beside it.
 *   · FILE. `hearthPinIndex` files pins by (hearth, Nexus, route, tier) in memory. A pin moves only by a
 *     signed causal event; the index holds no such door, so a held key answers its first pin until the
 *     index is dropped. There is no `replace`, by design.
 *
 * Pure: no I/O, no clock, no timer, no randomness. Stands specified in code until the cutover swaps it into
 * `AdmitCarriage` (today one HEX64 string); out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange
 */
import { hex, utf8Bytes } from "./crypto.js";
import { GATE_BUNDLE_REFUSALS, gateBundleDigest, readGateBundlePin, type GateBundlePin, type GateTier } from "./gate-bundle.js";

/** The route a hearth's sovereign sync gate answers on. */
export const SOVEREIGN_SYNC_ROUTE = "/ws";

export const ADMIT_GATE_PIN_REFUSALS = [
  ...GATE_BUNDLE_REFUSALS,
  "pin-other-tier",   // a pin of any tier but the sovereign
  "pin-other-route",  // a sovereign pin on any route but the sync route
  "pin-other-nexus",  // a pin whose Nexus differs from the Nexus the admit names
] as const;
export type AdmitGatePinRefusal = (typeof ADMIT_GATE_PIN_REFUSALS)[number];

/**
 * Read the pin an admit carries: `readGateBundlePin`, then tier "sovereign", route `SOVEREIGN_SYNC_ROUTE`
 * and, where `nexus` (the Nexus AID as text) is given, pin.nexus === hex(utf8Bytes(nexus)).
 */
export function readAdmitGatePin(
  value: unknown,
  expect?: { readonly nexus?: string },
): { readonly pin: GateBundlePin } | { readonly refusal: AdmitGatePinRefusal } {
  const read = readGateBundlePin(value);
  if (!("pin" in read)) return read;
  const { pin } = read;
  if (pin.tier !== "sovereign") return { refusal: "pin-other-tier" };
  if (pin.route !== SOVEREIGN_SYNC_ROUTE) return { refusal: "pin-other-route" };
  if (expect?.nexus !== undefined && pin.nexus !== hex(utf8Bytes(expect.nexus))) return { refusal: "pin-other-nexus" };
  return { pin };
}

/** The digest an admit names for its pin: `gateBundleDigest` of the validated pin. */
export function admitGatePinDigest(pin: GateBundlePin): string {
  return gateBundleDigest(pin);
}

/** Where a dial files a pin: (hearth, Nexus, route, tier). `hearth` names the hearth by its true name (an opaque non-empty string without newlines). */
export interface DialPinKey {
  readonly hearth: string;
  readonly nexus:  string;
  readonly route:  string;
  readonly tier:   GateTier;
}

export function dialPinKeyOf(hearth: string, pin: GateBundlePin): DialPinKey {
  return Object.freeze({ hearth, nexus: pin.nexus, route: pin.route, tier: pin.tier });
}

/**
 * The pair index: pins filed by (hearth, Nexus, route, tier). Pure, in memory. `put` refuses (returns false,
 * stores nothing) a pin whose read fails, a different pin under a key already held (a pin moves only by a
 * signed causal event; the index holds no such door), or an empty or newline-bearing hearth. `get` answers
 * the pin or null. `forHearth(hearth, nexus)` answers that pair's pins, never another pair's.
 */
export interface HearthPinIndex {
  put(hearth: string, pin: unknown): boolean;
  get(key: DialPinKey): GateBundlePin | null;
  forHearth(hearth: string, nexus: string): readonly GateBundlePin[];
  readonly size: number;
}

const hearthReads = (hearth: unknown): hearth is string => typeof hearth === "string" && hearth.length > 0 && !/[\r\n]/.test(hearth);
// The hearth leads and holds no newline; the rest holds none either (hex, a route, a tier), so the join is one reading.
const keyText = (hearth: string, nexus: string, route: string, tier: string): string => [hearth, nexus, route, tier].join("\n");

export function hearthPinIndex(): HearthPinIndex {
  const held = new Map<string, GateBundlePin>();
  return Object.freeze({
    put(hearth: string, pin: unknown): boolean {
      if (!hearthReads(hearth)) return false;
      const read = readGateBundlePin(pin);
      if (!("pin" in read)) return false;
      const p = read.pin;
      const key = keyText(hearth, p.nexus, p.route, p.tier);
      const had = held.get(key);
      if (had !== undefined) return gateBundleDigest(had) === gateBundleDigest(p);
      held.set(key, p);
      return true;
    },
    get(key: DialPinKey): GateBundlePin | null {
      if (!hearthReads(key?.hearth)) return null;
      return held.get(keyText(key.hearth, key.nexus, key.route, key.tier)) ?? null;
    },
    forHearth(hearth: string, nexus: string): readonly GateBundlePin[] {
      if (!hearthReads(hearth) || typeof nexus !== "string") return [];
      const nexusHex = hex(utf8Bytes(nexus));
      const prefix = `${hearth}\n${nexusHex}\n`;
      return [...held].filter(([key]) => key.startsWith(prefix)).map(([, pin]) => pin);
    },
    get size(): number { return held.size; },
  });
}
