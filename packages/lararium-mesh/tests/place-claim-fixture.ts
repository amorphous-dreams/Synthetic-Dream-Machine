/**
 * place-claim-fixture — a synthetic place with a pre-rotated KEL and the floor pin claims it signs, for the floor pin claim
 * tests. Every KEL here goes through the real mesh grammar (`mintPlaceInception`, `mintPlaceRotation`); only the seeds are fixed.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import * as nobleEd from "@noble/ed25519";
import { utf8Bytes, hex } from "../src/crypto.js";
import { deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, type GateBundlePin } from "../src/gate-bundle.js";
import { signPlaceFloorPin, type PlaceFloorPinStatement } from "../src/place-floor-pin.js";
import {
  mintPlaceInception, mintPlaceRotation, placeKelEventDigest, verifyPlaceKel, type PlaceKelEvent, type PlaceKelHead,
} from "../src/vessel-kel.js";

export const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
export const keyOf = (n: number): string => hex(ed25519.getPublicKey(seedOf(n)));

/** A place: its KEL events (inception first) and the seeds its signers and cold keys came from. */
export interface TestPlace {
  readonly tag:     number;
  readonly chain:   readonly PlaceKelEvent[];
  /** The seed of the online signer at the head. */
  readonly signer:  Uint8Array;
  /** The seed of the cold key the head commits. */
  readonly cold:    Uint8Array;
  readonly aid:     string;
}

const signerSeed = (tag: number, i: number): number => tag * 20 + 2 * i + 1;
const coldSeed = (tag: number, i: number): number => tag * 20 + 2 * i + 2;

/** Found a place: an armed inception with signer 0 and cold key 0. `tag` keeps places apart (1 to 9). */
export function foundPlace(tag: number, signer: Uint8Array = seedOf(signerSeed(tag, 0))): TestPlace {
  const start = mintPlaceInception({ signerSeed: signer, coldVerifyingKey: keyOf(coldSeed(tag, 0)) });
  return { tag, chain: [start.event], signer, cold: seedOf(coldSeed(tag, 0)), aid: start.aid };
}

/** Rotate a place: the cold key it committed reveals, a fresh signer seats, a fresh cold key commits. */
export function rotatePlace(place: TestPlace, branch = 0): TestPlace {
  const i = place.chain.length;
  const event = mintPlaceRotation({
    chain: place.chain, coldSeed: place.cold,
    newSignerKey: keyOf(signerSeed(place.tag, i) + branch * 100), nextColdVerifyingKey: keyOf(coldSeed(place.tag, i) + branch * 100),
  });
  return { ...place, chain: [...place.chain, event], signer: seedOf(signerSeed(place.tag, i) + branch * 100), cold: seedOf(coldSeed(place.tag, i) + branch * 100) };
}

export const headOf = (place: TestPlace): PlaceKelHead => {
  const read = verifyPlaceKel(place.chain);
  if (!read.ok) throw new Error(`fixture chain refuses: ${read.refusal}`);
  return read;
};
export const digests = (place: TestPlace): string[] => place.chain.map(placeKelEventDigest);
/** The KEL rows a reader holds for a place: its events, in no promised order. */
export const rowsOf = (...places: TestPlace[]): unknown[] => places.flatMap((p) => p.chain.map((e) => JSON.parse(JSON.stringify(e)) as unknown));

/** A place's floor pin for `route` at `nexus`, derived from a floor key door filled with `fill`. */
export function floorPinFor(nexus: string, route: string, fill: number): GateBundlePin {
  const b = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(fill) })), utf8Bytes(nexus), floorRoute(route));
  try { return b.pin; } finally { b.drop(); }
}

/** The claim a place signs over `pin` at its head (or at the head of `at`, a place whose chain it extends). */
export async function claimAt(place: TestPlace, pin: GateBundlePin, signWith: Uint8Array = place.signer): Promise<PlaceFloorPinStatement> {
  return signPlaceFloorPin({ at: headOf(place), pin, sign: (image) => nobleEd.signAsync(image, signWith) });
}

/** A claim signed by `signWith` over the head of `place`, with no check that the signer holds the head (a forger's door). */
export async function forgedClaim(place: TestPlace, pin: GateBundlePin, signWith: Uint8Array): Promise<PlaceFloorPinStatement> {
  const honest = await claimAt(place, pin);
  const { placeFloorPinImage } = await import("../src/place-floor-pin.js");
  const sig = hex(await nobleEd.signAsync(placeFloorPinImage({ aid: honest.aid, seq: honest.seq, head: honest.head }, pin), signWith));
  return { ...honest, sig };
}

// ── THE STORM EVIDENCE ───────────────────────────────────────────────────────────────────────────
// One set of facts both legs of the storm witness read (node: carried standing off a board; browser: anchored standing off cards):
// a place that rotates through `stages` heads, and a claim of a different floor pin at each head.

/** A mulberry32 stream: the same seed shuffles the same way on every platform. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
export function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return out;
}

export interface StormStage { readonly place: TestPlace; readonly pin: GateBundlePin; readonly claim: PlaceFloorPinStatement; readonly signerKey: string }
/** `stages` heads of one place, each claiming its own pin of `nexus`'s flow route. */
export async function stormStages(nexus: string, stages: number, tag = 7): Promise<StormStage[]> {
  const out: StormStage[] = [];
  let place = foundPlace(tag);
  for (let i = 0; i < stages; i++) {
    if (i > 0) place = rotatePlace(place);
    const pin = floorPinFor(nexus, "/flow", 30 + i);
    out.push({ place, pin, claim: await claimAt(place, pin), signerKey: headOf(place).signerKey });
  }
  return out;
}
