/**
 * floor-announcement — the floor's signed hint to its peers, once per carried Nexus.
 *
 * Holds the operator's ruling "The floor announcement": `waking-floor-announce` signs one canonical body per
 * carried Nexus under that Nexus's floor bundle signing key: its kind, Nexus AID, floor route pin digest, floor
 * standing and the digest of the announcement it follows. It travels only inside an authenticated socket or relay
 * relation. The reader checks the already pinned floor pin, domain, Nexus, route and causal link, and treats the
 * body as a peer hint alone. And from "The admit's gate pin": an announcement never authenticates its own first pin.
 *
 * NO COUNTER ORDERS IT. The body names its shape by `kind` (`floor-announcement`), and its order rides a causal link:
 * `prior` names the digest of the announcement this floor made before for the Nexus (`floorAnnouncementDigest`), or
 * null at the first. A reader that holds an announcement takes only one that names it as `prior`.
 *
 *   · IMAGE. `gateAnnouncementImage` is the registered domain over the body's fields, each length-framed by the
 *     gate's one field encoding (`gateFields`): the kind's name, the Nexus bytes, the pin digest's bytes, the
 *     standing's name and the prior digest's bytes (none at the first). `floorAnnouncementDigest` is its sha256.
 *   · SIGN. `signFloorAnnouncement` signs under a FLOOR bundle on `FLOOR_ANNOUNCE_ROUTE` and names that bundle's
 *     own Nexus and pin digest; any other tier or route refuses by name, and a dropped bundle signs nothing.
 *   · READ. `readFloorAnnouncement` takes the floor pin the CALLER already holds (from an authenticated relation
 *     or a carried signed pin set), never one the announcement brings: an announcement whose pin digest names
 *     another pin refuses, and with no held pin nothing reads. Where the caller names the digest of the announcement
 *     it holds (`held`), the body must name it as `prior`: the held one itself refuses `announcement-held`, any other
 *     link `prior-unlinked`. Every miss refuses by name; the body read back stands frozen and shares nothing with its input.
 *
 * What the body says stays a HINT: the standing a floor names grants nothing, and a reader decides nothing on it
 * beyond whom to try first.
 *
 * Pure: no I/O, no clock, no randomness. No caller yet; it stands for the floor's announcement route
 * (`FLOOR_ANNOUNCE_ROUTE`), and the package barrel names it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/waking-floor#/the-announcement
 */
import { hex, hexToBytes, sha256HexBytesSync, utf8Bytes } from "./crypto.js";
import { WAKING_FLOOR_ANNOUNCE_DOMAIN } from "./domains.js";
import { gateBundleDigest, gateFields, readGateBundlePin, readGateSignature, type GateBundle, type GateBundlePin } from "./gate-bundle.js";

/** The body's shape name: the kind a reader tells an announcement by, never a counter. */
export const FLOOR_ANNOUNCEMENT_KIND = "floor-announcement";

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
  readonly kind:     typeof FLOOR_ANNOUNCEMENT_KIND;
  /** The Nexus's own identifier, as bare lower-case hex of its bytes (the floor pin's `nexus`). */
  readonly nexus:    string;
  /** `gateBundleDigest` of the announcing floor bundle's pin. */
  readonly floorPin: string;
  readonly standing: FloorStanding;
  /** The causal link: `floorAnnouncementDigest` of the announcement this floor made before for this Nexus, or null at the first. */
  readonly prior:    string | null;
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
  "kind-other",              // a body that names another kind than the floor announcement
  "nexus-malformed",         // a Nexus outside its one spelling
  "pin-malformed",           // a pin digest outside its one spelling
  "standing-malformed",      // a standing outside the vocabulary
  "prior-malformed",         // a prior link that is neither null nor a sha256 digest
  "nexus-other",             // the body names another Nexus than the held pin
  "pin-other",               // the body names another floor pin than the one held
  "signature-refused",       // no signature of the held pin's signing key stands over the image
  "announcement-held",       // the body is the announcement the caller already holds
  "prior-unlinked",          // the body names another prior than the announcement the caller holds
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
const BODY_KEYS = ["kind", "nexus", "floorPin", "standing", "prior"] as const;
const ANNOUNCEMENT_KEYS = ["body", "signature"] as const;

const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const standingReads = (v: unknown): v is FloorStanding => typeof v === "string" && (FLOOR_STANDINGS as readonly string[]).includes(v);
const priorReads = (v: unknown): v is string | null => v === null || (typeof v === "string" && HEX64.test(v));

/** The image a floor signs: the registered domain over the body's fields, in the gate's one field encoding. */
export function gateAnnouncementImage(body: FloorAnnouncementBody): Uint8Array {
  return gateFields(
    WAKING_FLOOR_ANNOUNCE_DOMAIN, utf8Bytes(body.kind), hexToBytes(body.nexus), hexToBytes(body.floorPin),
    utf8Bytes(body.standing), body.prior === null ? new Uint8Array(0) : hexToBytes(body.prior),
  );
}

/** The digest an announcement answers to: sha256 of its image, the link the next announcement names as `prior`. */
export function floorAnnouncementDigest(body: FloorAnnouncementBody): string {
  return sha256HexBytesSync(gateAnnouncementImage(body));
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
  says: { readonly standing: FloorStanding; readonly prior: string | null },
): Promise<FloorAnnouncement> {
  const miss = floorPinMiss(bundle.pin);
  if (miss !== null) throw new FloorAnnouncementRefused(miss);
  if (!standingReads(says.standing)) throw new FloorAnnouncementRefused("standing-malformed");
  if (!priorReads(says.prior)) throw new FloorAnnouncementRefused("prior-malformed");
  const body: FloorAnnouncementBody = Object.freeze({
    kind: FLOOR_ANNOUNCEMENT_KIND, nexus: bundle.pin.nexus, floorPin: gateBundleDigest(bundle.pin),
    standing: says.standing, prior: says.prior,
  });
  const signature = hex(await bundle.sign(gateAnnouncementImage(body)));
  return Object.freeze({ body, signature });
}

/**
 * Read an announcement against the floor pin the caller already holds, and, where it names one, as the successor of
 * the announcement it holds (`held`, that announcement's digest). The pin an announcement names never stands in for the
 * held one.
 */
export function readFloorAnnouncement(
  value: unknown,
  expect: { readonly pin: GateBundlePin; readonly held?: string },
): { readonly announcement: FloorAnnouncementBody } | { readonly refusal: FloorAnnouncementRefusal } {
  if (expect?.held !== undefined && !(typeof expect.held === "string" && HEX64.test(expect.held))) throw new RangeError("floor-announcement: `held` names an announcement digest");
  const held = readGateBundlePin(typeof expect === "object" && expect !== null ? expect.pin : undefined);
  if (!("pin" in held)) return { refusal: "pin-unread" };
  const pin = held.pin;
  const miss = floorPinMiss(pin);
  if (miss !== null) return { refusal: miss };
  try {
    if (!exactKeys(value, ANNOUNCEMENT_KEYS) || !exactKeys(value.body, BODY_KEYS)) return { refusal: "announcement-malformed" };
    const { kind, nexus, floorPin, standing, prior } = value.body;
    const signature = value.signature;
    if (kind !== FLOOR_ANNOUNCEMENT_KIND) return { refusal: "kind-other" };
    if (typeof nexus !== "string" || !HEX.test(nexus) || nexus.length > NEXUS_HEX_MAX) return { refusal: "nexus-malformed" };
    if (typeof floorPin !== "string" || !HEX64.test(floorPin)) return { refusal: "pin-malformed" };
    if (!standingReads(standing)) return { refusal: "standing-malformed" };
    if (!priorReads(prior)) return { refusal: "prior-malformed" };
    if (nexus !== pin.nexus) return { refusal: "nexus-other" };
    if (floorPin !== gateBundleDigest(pin)) return { refusal: "pin-other" };
    const body: FloorAnnouncementBody = Object.freeze({ kind: FLOOR_ANNOUNCEMENT_KIND, nexus, floorPin, standing, prior });
    if (typeof signature !== "string" || !HEX128.test(signature) || !readGateSignature(pin, gateAnnouncementImage(body), signature)) {
      return { refusal: "signature-refused" };
    }
    if (expect.held !== undefined) {
      if (floorAnnouncementDigest(body) === expect.held) return { refusal: "announcement-held" };
      if (prior !== expect.held) return { refusal: "prior-unlinked" };
    }
    return { announcement: body };
  } catch { return { refusal: "announcement-malformed" }; }
}
