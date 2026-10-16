/**
 * floor-announcement — the floor's signed hint to its peers, once per carried Nexus.
 *
 * Holds the operator's ruling "The floor announcement": `waking-floor-announce` signs one canonical body per
 * carried Nexus under that Nexus's floor bundle signing key: version, Nexus AID, floor route pin digest, floor
 * standing and causal position. It travels only inside an authenticated socket or relay relation. The reader
 * checks the already pinned floor pin, domain, Nexus, route and causal order, and treats the body as a peer hint
 * alone. And from "The admit's gate pin": an announcement never authenticates its own first pin.
 *
 *   · IMAGE. `gateAnnouncementImage` is the registered domain over the body's fields, each length-framed by the
 *     gate's one field encoding (`gateFields`): the version byte, the Nexus bytes, the pin digest's bytes, the
 *     standing's name and the position as eight big-endian bytes.
 *   · SIGN. `signFloorAnnouncement` signs under a FLOOR bundle on `FLOOR_ANNOUNCE_ROUTE` and names that bundle's
 *     own Nexus and pin digest; any other tier or route refuses by name, and a dropped bundle signs nothing.
 *   · READ. `readFloorAnnouncement` takes the floor pin the CALLER already holds (from an authenticated relation
 *     or a carried signed pin set), never one the announcement brings: an announcement whose pin digest names
 *     another pin refuses, and with no held pin nothing reads. A position at or below the one the caller holds
 *     refuses stale. Every miss refuses by name; the body read back stands frozen and shares nothing with its input.
 *
 * What the body says stays a HINT: the standing a floor names grants nothing, and a reader decides nothing on it
 * beyond whom to try first.
 *
 * Pure: no I/O, no clock, no randomness. No caller yet; it stands for the floor's announcement route
 * (`FLOOR_ANNOUNCE_ROUTE`), and the package barrel names it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/waking-floor#/the-announcement
 */
import { hex, hexToBytes, utf8Bytes } from "./crypto.js";
import { WAKING_FLOOR_ANNOUNCE_DOMAIN } from "./domains.js";
import { gateBundleDigest, gateFields, readGateBundlePin, readGateSignature, type GateBundle, type GateBundlePin } from "./gate-bundle.js";

/** The one body version this reader knows. A new body mints a new version and a reader that knows it. */
export const FLOOR_ANNOUNCEMENT_VERSION = 1;

/** The floor route an announcement's bundle answers on: its signing key derives over this route. */
export const FLOOR_ANNOUNCE_ROUTE = "/announce";

/**
 * What a floor says of itself: RESTING (at the floor, holding no vessel key) or RAISED (unlocked above it). A
 * boolean's worth, never a cap stack (waking-floor#/prior-art): the floor holds the resting state, the raise
 * carries the risk.
 */
export const FLOOR_STANDINGS = ["resting", "raised"] as const;
export type FloorStanding = (typeof FLOOR_STANDINGS)[number];

/** The canonical body. `nexus` and `floorPin` spell as the pin spells them: bare lower-case hex. */
export interface FloorAnnouncementBody {
  readonly version:  typeof FLOOR_ANNOUNCEMENT_VERSION;
  /** The Nexus's own identifier, as bare lower-case hex of its bytes (the floor pin's `nexus`). */
  readonly nexus:    string;
  /** `gateBundleDigest` of the announcing floor bundle's pin. */
  readonly floorPin: string;
  readonly standing: FloorStanding;
  /** The floor's own causal position for this Nexus: a whole number from 0 that only grows. */
  readonly position: number;
}

/** A signed announcement: the body and the floor signing key's 64-byte signature over its image, as hex. */
export interface FloorAnnouncement {
  readonly body:      FloorAnnouncementBody;
  readonly signature: string;
}

export const FLOOR_ANNOUNCEMENT_REFUSALS = [
  "pin-unread",              // the caller holds no floor pin that reads: nothing authenticates a first pin here
  "pin-other-tier",          // the held pin, or the signing bundle, stands in the sovereign tier
  "pin-other-route",         // the held pin, or the signing bundle, answers on another route than the announcement's
  "announcement-malformed",  // a wrong shape: a missing or an extra field, in the announcement or its body
  "version-unknown",         // a body version this reader does not know
  "nexus-malformed",         // a Nexus outside its one spelling
  "pin-malformed",           // a pin digest outside its one spelling
  "standing-malformed",      // a standing outside the vocabulary
  "position-malformed",      // a position that is not a whole number from 0
  "nexus-other",             // the body names another Nexus than the held pin
  "pin-other",               // the body names another floor pin than the one held
  "signature-refused",       // no signature of the held pin's signing key stands over the image
  "position-stale",          // the body's position stands at or below the one the caller holds
] as const;
export type FloorAnnouncementRefusal = (typeof FLOOR_ANNOUNCEMENT_REFUSALS)[number];

/** A signing refused by name. */
export class FloorAnnouncementRefused extends Error {
  override readonly name = "FloorAnnouncementRefused";
  readonly refusal: FloorAnnouncementRefusal;
  constructor(refusal: FloorAnnouncementRefusal) {
    super(`floor-announcement: ${refusal}`);
    this.refusal = refusal;
  }
}

const HEX = /^(?:[0-9a-f]{2})+$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const NEXUS_HEX_MAX = 512;
const BODY_KEYS = ["version", "nexus", "floorPin", "standing", "position"] as const;
const ANNOUNCEMENT_KEYS = ["body", "signature"] as const;

const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const standingReads = (v: unknown): v is FloorStanding => typeof v === "string" && (FLOOR_STANDINGS as readonly string[]).includes(v);
const positionReads = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/** The image a floor signs: the registered domain over the body's fields, in the gate's one field encoding. */
export function gateAnnouncementImage(body: FloorAnnouncementBody): Uint8Array {
  const position = new Uint8Array(8);
  new DataView(position.buffer).setBigUint64(0, BigInt(body.position), false);
  return gateFields(
    WAKING_FLOOR_ANNOUNCE_DOMAIN, Uint8Array.of(body.version), hexToBytes(body.nexus), hexToBytes(body.floorPin),
    utf8Bytes(body.standing), position,
  );
}

/** Where a floor pin stands for an announcement: the floor tier, on the announcement's route. */
function floorPinMiss(pin: GateBundlePin): FloorAnnouncementRefusal | null {
  if (pin.tier !== "floor") return "pin-other-tier";
  if (pin.route !== FLOOR_ANNOUNCE_ROUTE) return "pin-other-route";
  return null;
}

/** Sign one announcement under a floor bundle on the announcement route, naming that bundle's own Nexus and pin. */
export async function signFloorAnnouncement(
  bundle: GateBundle,
  says: { readonly standing: FloorStanding; readonly position: number },
): Promise<FloorAnnouncement> {
  const miss = floorPinMiss(bundle.pin);
  if (miss !== null) throw new FloorAnnouncementRefused(miss);
  if (!standingReads(says.standing)) throw new FloorAnnouncementRefused("standing-malformed");
  if (!positionReads(says.position)) throw new FloorAnnouncementRefused("position-malformed");
  const body: FloorAnnouncementBody = Object.freeze({
    version: FLOOR_ANNOUNCEMENT_VERSION, nexus: bundle.pin.nexus, floorPin: gateBundleDigest(bundle.pin),
    standing: says.standing, position: says.position,
  });
  const signature = hex(await bundle.sign(gateAnnouncementImage(body)));
  return Object.freeze({ body, signature });
}

/**
 * Read an announcement against the floor pin the caller already holds, and past the position it holds where it
 * names one (`after`, a whole number from 0). The pin an announcement names never stands in for the held one.
 */
export function readFloorAnnouncement(
  value: unknown,
  expect: { readonly pin: GateBundlePin; readonly after?: number },
): { readonly announcement: FloorAnnouncementBody } | { readonly refusal: FloorAnnouncementRefusal } {
  if (expect?.after !== undefined && !positionReads(expect.after)) throw new RangeError("floor-announcement: `after` names a whole number from 0");
  const held = readGateBundlePin(typeof expect === "object" && expect !== null ? expect.pin : undefined);
  if (!("pin" in held)) return { refusal: "pin-unread" };
  const pin = held.pin;
  const miss = floorPinMiss(pin);
  if (miss !== null) return { refusal: miss };
  try {
    if (!exactKeys(value, ANNOUNCEMENT_KEYS) || !exactKeys(value.body, BODY_KEYS)) return { refusal: "announcement-malformed" };
    const { version, nexus, floorPin, standing, position } = value.body;
    const signature = value.signature;
    if (version !== FLOOR_ANNOUNCEMENT_VERSION) return { refusal: "version-unknown" };
    if (typeof nexus !== "string" || !HEX.test(nexus) || nexus.length > NEXUS_HEX_MAX) return { refusal: "nexus-malformed" };
    if (typeof floorPin !== "string" || !HEX64.test(floorPin)) return { refusal: "pin-malformed" };
    if (!standingReads(standing)) return { refusal: "standing-malformed" };
    if (!positionReads(position)) return { refusal: "position-malformed" };
    if (nexus !== pin.nexus) return { refusal: "nexus-other" };
    if (floorPin !== gateBundleDigest(pin)) return { refusal: "pin-other" };
    const body: FloorAnnouncementBody = Object.freeze({ version: FLOOR_ANNOUNCEMENT_VERSION, nexus, floorPin, standing, position });
    if (typeof signature !== "string" || !HEX128.test(signature) || !readGateSignature(pin, gateAnnouncementImage(body), signature)) {
      return { refusal: "signature-refused" };
    }
    if (expect.after !== undefined && position <= expect.after) return { refusal: "position-stale" };
    return { announcement: body };
  } catch { return { refusal: "announcement-malformed" }; }
}
