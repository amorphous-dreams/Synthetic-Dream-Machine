/**
 * gate-bundle — the keys ONE gate holds for ONE Nexus on ONE route: derived, never stored.
 *
 * A vessel that stands in two Nexuses stands two gates per route, and the two share nothing a peer can
 * compare. Each gate holds a BUNDLE: an X25519 transport key that answers the dialer's first flight, and an
 * Ed25519 signing key that signs the gate's verdict. Both derive from one root, the Nexus and the route,
 * each under its own name, so no key of one bundle stands in another and neither key of a bundle equals
 * the other.
 *
 *     seed            = the tier's child of its root: the floor key's (GATE_FLOOR_BUNDLE_INFO) for a floor
 *                       route, the sealed custody root's (GATE_BUNDLE_INFO) for a sovereign route
 *     transport secret = HKDF-SHA256(seed, info = fields(GATE_TRANSPORT_KEY_INFO, tier, nexus, route))
 *     signing seed     = HKDF-SHA256(seed, info = fields(GATE_SIGNING_KEY_INFO,   tier, nexus, route))
 *
 * TWO TIERS, TWO ROOTS. A floor route answers at a locked vessel, so its bundle derives from the floor key. A
 * sovereign route seats a face's session, so its bundle derives from the sealed custody root and stands
 * only while the vessel stands unlocked. A route carries its tier in its typed name, a pin states it and
 * the pin's digest binds it; a route asked of the other tier's root refuses by name.
 *
 * What a dialer holds is the PIN: the Nexus, the route and the two public keys. The pin's DIGEST names the
 * bundle wherever a signature binds it. The KNOCK derives from that digest, so a gate's knock, its pin, its
 * verdict and its posture all read per Nexus exactly. The handshake's PROLOGUE holds the digest too, so a
 * first flight decrypts only at the gate whose pin its dialer held.
 *
 * The invariants:
 *   · NOTHING RESTS. A bundle lives in memory from a derivation to a `drop`. No row, no file and no cache
 *     holds a bundle's key: a restart derives it again from the same three inputs.
 *   · THE ROOT STAYS WITH ITS OWNER. This module asks a `GateBundleRoot` for ONE child, under one registered
 *     name, and reads no root bytes. The custody seat's own derive door answers it.
 *   · THE NEXUS RIDES AS OPAQUE BYTES. How a Nexus names itself belongs to its charter; a bundle binds the
 *     bytes and parses nothing in them.
 *   · NO SECRET LEAVES. A bundle answers a first flight and signs an image; it hands out neither secret.
 *   · THE SIGNING KEY SIGNS A GATE'S PURPOSES ALONE. An image that leads with any other name draws no
 *     signature, and a reader holds a signature to the same list.
 *
 * The floor's announcement signs under this same signing key: its image leads with the announcement's own
 * name, which joins `GATE_SIGNING_PURPOSES` in the commit that builds the announcement
 * (lar:///ha.ka.ba/lares/api/pono/waking-floor#/the-announcement). A peer reads it under the pin it holds
 * for that Nexus, so a gate and its announcement never sign under two keys.
 *
 * Pure but for the keys it derives: no I/O, no clock, no timer, no randomness.
 * Stands specified in code until the socket cutover consumes it; out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes } from "./crypto.js";
import {
  GATE_BUNDLE_INFO, GATE_BUNDLE_PIN_DOMAIN, GATE_FLOOR_BUNDLE_INFO, GATE_HANDSHAKE_DOMAIN, GATE_SIGNING_KEY_INFO,
  GATE_TRANSPORT_KEY_INFO, GATE_VERDICT_DOMAIN,
} from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import { knockSegment } from "./gate-knock.js";
import { noiseRespond, type NoiseResponderPending } from "./noise-ik.js";

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────

export const GATE_BUNDLE_REFUSALS = [
  "root-astray",              // the root answered anything but 32 bytes, or no root this module minted
  "route-other-tier",         // a route asked of the other tier's root
  "tier-malformed",           // a pin whose tier names neither tier
  "nexus-malformed",          // no bytes, too many bytes, or (in a pin) a spelling other than bare lower-case hex
  "route-malformed",          // a route outside its one spelling
  "pin-malformed",            // a wrong shape, a missing or an extra field
  "transport-key-refused",    // not 32 bytes of bare lower-case hex, or a low-order point
  "signing-key-refused",      // a key the one Ed25519 door refuses
  "purpose-foreign",          // an image that leads with a name no gate signs under
  "bundle-dropped",
] as const;
export type GateBundleRefusalName = (typeof GATE_BUNDLE_REFUSALS)[number];

/** The refusal every door of a bundle throws. `refusal` names it; the message says nothing more. */
export class GateBundleRefused extends Error {
  override readonly name = "GateBundleRefused";
  readonly refusal: GateBundleRefusalName;
  constructor(refusal: GateBundleRefusalName) {
    super(`gate-bundle: ${refusal}`);
    this.refusal = refusal;
  }
}

// ── The one field encoding ──────────────────────────────────────────────────────────────────────

/**
 * Fields under one name: the name, then each field, each as a four-byte big-endian length and its bytes.
 * The name leads, so no two purposes share a first field; the lengths leave no two field lists one encoding.
 */
export function gateFields(name: string, ...fields: readonly Uint8Array[]): Uint8Array {
  const parts = [utf8Bytes(name), ...fields];
  const out = new Uint8Array(parts.reduce((size, part) => size + 4 + part.length, 0));
  const view = new DataView(out.buffer);
  let at = 0;
  for (const part of parts) {
    view.setUint32(at, part.length, false);
    out.set(part, at + 4);
    at += 4 + part.length;
  }
  return out;
}

/** The name an image leads with, or null where its first field reads as no text. */
function leadingName(image: Uint8Array): string | null {
  if (!(image instanceof Uint8Array) || image.length < 4) return null;
  const length = new DataView(image.buffer, image.byteOffset, image.byteLength).getUint32(0, false);
  if (length === 0 || 4 + length > image.length) return null;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(image.subarray(4, 4 + length)); } catch { return null; }
}

// ── The pin ─────────────────────────────────────────────────────────────────────────────────────

/** How many bytes may name a Nexus. */
export const NEXUS_AID_MAX_BYTES = 256;

/** A route in its one spelling: one or more segments, each led by a slash, no trailing slash. */
const ROUTE = /^(?:\/[A-Za-z0-9._~-]+)+$/;
const ROUTE_MAX = 256;
const HEX = /^(?:[0-9a-f]{2})+$/;
const HEX64 = /^[0-9a-f]{64}$/;

/**
 * The two tiers a gate stands in. A FLOOR gate answers at a locked vessel and derives from the floor key; a
 * SOVEREIGN gate seats a face's session and derives from the sealed custody root.
 */
export const GATE_TIERS = ["floor", "sovereign"] as const;
export type GateTier = (typeof GATE_TIERS)[number];

/** What a dialer pins for one gate: the tier, the Nexus, the route, and the two public keys. Every value a string. */
export interface GateBundlePin {
  /** The tier the gate stands in. A dialer that pinned one tier believes no gate of the other. */
  readonly tier:         GateTier;
  /** The Nexus's own identifier, as bare lower-case hex of its bytes. */
  readonly nexus:        string;
  readonly route:        string;
  /** The X25519 key that answers a first flight. */
  readonly transportKey: string;
  /** The Ed25519 key that signs the gate's verdict. */
  readonly signingKey:   string;
}

const PIN_KEYS = ["tier", "nexus", "route", "transportKey", "signingKey"] as const;

export type GateBundlePinReading = { readonly pin: GateBundlePin } | { readonly refusal: GateBundleRefusalName };

function routeReads(route: unknown): route is string {
  return typeof route === "string" && route.length <= ROUTE_MAX && ROUTE.test(route) && !route.split("/").some((segment) => segment === "." || segment === "..");
}

/** An X25519 public key a dialer may write a flight to: 32 bytes, and no low-order point. */
function transportKeyReads(key: unknown): key is string {
  if (typeof key !== "string" || !HEX64.test(key)) return false;
  try {
    // A low-order point hands every dialer the same secret: the scalar one against it reads all zero.
    const probe = new Uint8Array(32); probe[0] = 8; probe[31] = 64;
    return x25519.getSharedSecret(probe, hexToBytes(key)).some((byte) => byte !== 0);
  } catch { return false; }
}

/**
 * Read a pin: exact keys, one spelling of each value, a transport key that names a usable point, a signing
 * key the one door accepts, and two keys that differ. The pin returned stands frozen and shares nothing
 * with its input.
 */
export function readGateBundlePin(value: unknown): GateBundlePinReading {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { refusal: "pin-malformed" };
    if (Reflect.ownKeys(value).length !== PIN_KEYS.length || !PIN_KEYS.every((key) => Object.hasOwn(value, key))) return { refusal: "pin-malformed" };
    const { tier, nexus, route, transportKey, signingKey } = value as Record<string, unknown>;
    if (tier !== "floor" && tier !== "sovereign") return { refusal: "tier-malformed" };
    if (typeof nexus !== "string" || !HEX.test(nexus) || nexus.length > NEXUS_AID_MAX_BYTES * 2) return { refusal: "nexus-malformed" };
    if (!routeReads(route)) return { refusal: "route-malformed" };
    if (!transportKeyReads(transportKey)) return { refusal: "transport-key-refused" };
    if (typeof signingKey !== "string" || !HEX64.test(signingKey) || !acceptEd25519Key(signingKey).ok) return { refusal: "signing-key-refused" };
    if (signingKey === transportKey) return { refusal: "pin-malformed" };
    return { pin: Object.freeze({ tier, nexus, route, transportKey, signingKey }) };
  } catch { return { refusal: "pin-malformed" }; }
}

/** The digest that names a bundle wherever a signature or a handshake binds it. Bare lower-case hex. */
export function gateBundleDigest(pin: GateBundlePin): string {
  return hex(sha256(gateFields(GATE_BUNDLE_PIN_DOMAIN, utf8Bytes(pin.tier), hexToBytes(pin.nexus), utf8Bytes(pin.route), hexToBytes(pin.transportKey), hexToBytes(pin.signingKey))));
}

/** The knock a gate answers on: the house's one knock derivation, over the bundle's digest and its route. */
export function gateKnock(pin: GateBundlePin): string {
  return knockSegment(gateBundleDigest(pin), pin.route);
}

/** The prologue both ends of the handshake hold: the bundle's digest under the handshake's own name. */
export function gatePrologue(pin: GateBundlePin): Uint8Array {
  return gateFields(GATE_HANDSHAKE_DOMAIN, hexToBytes(gateBundleDigest(pin)));
}

// ── What the signing key signs ──────────────────────────────────────────────────────────────────

/** The names a gate's signing key signs under. An image leads with one of them, or draws no signature. */
export const GATE_SIGNING_PURPOSES: readonly string[] = Object.freeze([GATE_VERDICT_DOMAIN]);

function gateSigns(image: unknown): image is Uint8Array {
  if (!(image instanceof Uint8Array)) return false;
  const name = leadingName(image);
  return name !== null && GATE_SIGNING_PURPOSES.includes(name);
}

/** Does `signature` stand over `image` under the pinned signing key, for a purpose a gate signs under? */
export function readGateSignature(pin: GateBundlePin, image: Uint8Array, signature: Uint8Array | string): boolean {
  return gateSigns(image) && verifyEd25519(signature, image, pin.signingKey);
}

// ── The bundle ──────────────────────────────────────────────────────────────────────────────────

/**
 * A derive door: one child of one root, under one registered name. The custody seat's holder answers the
 * sovereign tier's (`derive(domain)`, and a locked seat throws its own refusal); the floor key's own door
 * answers the floor tier's. A door answers a FRESH buffer each time, which its caller owns: the bundle
 * overwrites the child it received.
 */
export interface GateRootDoor {
  derive(domain: string): Uint8Array;
}

/**
 * The root one tier's bundles derive from. Only `floorGateRoot` and `sovereignGateRoot` mint one, and each
 * asks its door for its own tier's child and no other: a floor root never asks the custody root's child.
 */
export interface GateBundleRoot<T extends GateTier = GateTier> {
  readonly tier: T;
  /** The tier's child, fresh. */
  child(): Uint8Array;
}

const ROOTS = new WeakSet<GateBundleRoot>();
function rootOver<T extends GateTier>(tier: T, door: GateRootDoor, domain: string): GateBundleRoot<T> {
  const root: GateBundleRoot<T> = Object.freeze({ tier, child: () => door.derive(domain) });
  ROOTS.add(root);
  return root;
}
/** The floor tier's root, over the floor key's derive door. It stands while the vessel rests locked. */
export const floorGateRoot = (floorKeyDoor: GateRootDoor): GateBundleRoot<"floor"> => rootOver("floor", floorKeyDoor, GATE_FLOOR_BUNDLE_INFO);
/** The sovereign tier's root, over the custody seat's derive door. A locked seat answers nothing. */
export const sovereignGateRoot = (custodyDoor: GateRootDoor): GateBundleRoot<"sovereign"> => rootOver("sovereign", custodyDoor, GATE_BUNDLE_INFO);

/**
 * A route by its typed name: the path a gate answers on, and the tier that path belongs to. Only
 * `floorRoute` and `sovereignRoute` mint one, so a route carries its tier from the line that names it.
 */
export interface GateRoute<T extends GateTier = GateTier> {
  readonly tier: T;
  readonly path: string;
}

const ROUTES = new WeakSet<GateRoute>();
function routeOf<T extends GateTier>(tier: T, path: string): GateRoute<T> {
  if (!routeReads(path)) throw new GateBundleRefused("route-malformed");
  const route: GateRoute<T> = Object.freeze({ tier, path });
  ROUTES.add(route);
  return route;
}
/** A route a locked vessel answers: the public shelf, the oracle's read face, the announcement, a blind relay. */
export const floorRoute = (path: string): GateRoute<"floor"> => routeOf("floor", path);
/** A route that seats a face's session or serves a lane this vessel can open. */
export const sovereignRoute = (path: string): GateRoute<"sovereign"> => routeOf("sovereign", path);

/** One gate's keys for one Nexus on one route. It holds its secrets alone and hands out neither. */
export interface GateBundle {
  readonly pin:    GateBundlePin;
  readonly digest: string;
  readonly knock:  string;
  /** Read a dialer's first flight under this bundle's transport key and prologue. The reading stands
   *  provisional, as every first flight does (`noise-ik`). A flight written to any other pin throws. */
  respond(message1: Uint8Array): NoiseResponderPending;
  /** Sign an image that leads with one of `GATE_SIGNING_PURPOSES`. The 64 signature bytes. */
  sign(image: Uint8Array): Promise<Uint8Array>;
  /** Overwrite both secrets. A dropped bundle answers no flight and signs nothing. */
  drop(): void;
  readonly dropped: boolean;
}

/**
 * Derive the bundle one gate holds: `root` one tier's root, `nexusAid` the Nexus's own identifier as opaque
 * bytes, `route` a route of the SAME tier. The types refuse a route of the other tier, and so does the
 * function, by name: a sovereign route asked of the floor root derives nothing.
 */
export function deriveGateBundle<T extends GateTier>(root: GateBundleRoot<T>, nexusAid: Uint8Array, route: GateRoute<NoInfer<T>>): GateBundle {
  if (!ROOTS.has(root)) throw new GateBundleRefused("root-astray");
  if (!ROUTES.has(route)) throw new GateBundleRefused("route-malformed");
  if (route.tier !== root.tier) throw new GateBundleRefused("route-other-tier");
  if (!(nexusAid instanceof Uint8Array) || nexusAid.length === 0 || nexusAid.length > NEXUS_AID_MAX_BYTES) throw new GateBundleRefused("nexus-malformed");
  const aid = Uint8Array.from(nexusAid);
  const tier = utf8Bytes(root.tier);
  // The door answers a child the caller owns: this function overwrites it once both keys derive.
  const seed = root.child();
  if (!(seed instanceof Uint8Array) || seed.length !== 32) {
    if (seed instanceof Uint8Array) seed.fill(0);
    throw new GateBundleRefused("root-astray");
  }
  let transportSecret: Uint8Array, signingSeed: Uint8Array;
  try {
    transportSecret = hkdf(sha256, seed, new Uint8Array(0), gateFields(GATE_TRANSPORT_KEY_INFO, tier, aid, utf8Bytes(route.path)), 32);
    signingSeed = hkdf(sha256, seed, new Uint8Array(0), gateFields(GATE_SIGNING_KEY_INFO, tier, aid, utf8Bytes(route.path)), 32);
  } finally {
    seed.fill(0);
  }
  const transportPublic = x25519.getPublicKey(transportSecret);
  const read = readGateBundlePin({
    tier: root.tier, nexus: hex(aid), route: route.path, transportKey: hex(transportPublic), signingKey: hex(ed25519.getPublicKey(signingSeed)),
  });
  if (!("pin" in read)) { transportSecret.fill(0); signingSeed.fill(0); throw new GateBundleRefused(read.refusal); }
  const pin = read.pin;
  const prologue = gatePrologue(pin);
  // A bundle stands dropped exactly when both secrets read all zero: the flag and the erasure never part.
  const isDropped = (): boolean => transportSecret.every((byte) => byte === 0) && signingSeed.every((byte) => byte === 0);
  return Object.freeze({
    pin,
    digest: gateBundleDigest(pin),
    knock: gateKnock(pin),
    respond(message1: Uint8Array): NoiseResponderPending {
      if (isDropped()) throw new GateBundleRefused("bundle-dropped");
      return noiseRespond({ prologue, s: { secretKey: transportSecret, publicKey: transportPublic }, message1 });
    },
    async sign(image: Uint8Array): Promise<Uint8Array> {
      if (isDropped()) throw new GateBundleRefused("bundle-dropped");
      if (!gateSigns(image)) throw new GateBundleRefused("purpose-foreign");
      return ed25519.sign(Uint8Array.from(image), signingSeed);
    },
    drop(): void {
      transportSecret.fill(0);
      signingSeed.fill(0);
    },
    get dropped(): boolean { return isDropped(); },
  });
}
