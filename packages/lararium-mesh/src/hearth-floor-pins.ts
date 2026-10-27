/**
 * hearth-floor-pins — a hearth's FLOOR pin set, carried only where a signature or an authenticated relation carries it.
 *
 * House ruling "The admit's gate pin": a floor route takes its pin only through an authenticated relation or a carried signed pin
 * set. Two carriers stand:
 *
 *   · THE SOVEREIGN SESSION. Once a dial's sovereign crossing verified, the hearth sends one sealed "session" message of
 *     kind `HEARTH_FLOOR_PINS_SESSION_KIND` whose body is `{ pins }` (and, beside it, the hearth's floor pin CLAIMS and the
 *     place KEL rows they name): the floor pins it stands at the dialed Nexus. The crossing is the authenticated relation (the
 *     dialer pinned that gate's keys), so the dialer files the set in its pair index under the hearth it dialed, at floor tier,
 *     one per route (`LarWSClientAdapter`). The first claim over the crossing adopts the place AID as the anchor (an
 *     authenticated admit's anchor); every later claim must descend from it, so a rotated hearth's successor re-files live.
 *   · THE FLEET-JOIN ANSWER. The answer carries the same set inside the PersonaGroup root's signature (`fleet-join`), so a
 *     joinee holds the flow's pin before its first crossing.
 *
 * One reader serves both: each pin reads whole, stands at floor tier and at the expected Nexus, and names a route no other
 * pin in the set names. A set that fails any of these reads as none: nothing of it files.
 *
 * THE FLOOR READ RIDES THE PORCH, NOT A PIN. The floor of system canon answers by the Nexus's release (`floor-release`, served at
 * `GET /floor/<Nexus AID>`): a reader holding the Nexus AID verifies the charter's epoch lineage (the genesis epoch re-derives the
 * AID, each step verifies under the prior roster's threshold), the head release and the floor bytes itself (`floor-answer`), so a
 * card's AID anchors a full verification and no signed pointer carries a floor.
 *
 * A third carrier stands for the flow's floor pin alone, THE FLOOR CARD (below): the hearth's own banner prints it and the
 * person carries it by hand. The card carries the place's signed floor pin claim and the KEL rows that fold to the claim's head;
 * it never anchors itself. A browser that holds no relation with a hearth and carries neither a signed set nor an anchored card
 * for it reads `pin-absent` at that hearth's floor.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-floor-pins
 */
import { base64UrlDecode, base64UrlEncode, utf8Bytes } from "./crypto.js";
import { readGateBundlePin, type GateBundlePin } from "./gate-bundle.js";
import type { HearthPinIndex } from "./admit-gate-pin.js";
import { filePlaceFloorPins, readPlaceFloorPin, type ClaimFilingReport, type PlaceFloorPinReading, type PlaceFloorPinRefusal, type PlaceFloorPinStatement } from "./place-floor-pin.js";
import { decodePlaceKelEvent, type PlaceKelEvent } from "./vessel-kel.js";

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

/** The index doors a claim filing uses: a `HearthPinIndex` carries all three. */
export type ClaimDoor = Pick<HearthPinIndex, "fileClaim" | "noteKelFork" | "standingOf">;

/** The proof beside a pin set: the hearth's floor pin claims and the place KEL rows that fold to each claim's head. */
export interface HearthFloorProof {
  readonly claims: readonly PlaceFloorPinStatement[];
  readonly kel:    readonly PlaceKelEvent[];
}

/** The session body the hearth sends: `{ pins }`, and with a place KEL `{ pins, claims, kel }`. */
export function hearthFloorPinsBody(pins: readonly GateBundlePin[], proof?: HearthFloorProof):
  { readonly pins: readonly GateBundlePin[]; readonly claims?: readonly PlaceFloorPinStatement[]; readonly kel?: readonly PlaceKelEvent[] } {
  return proof ? { pins, claims: proof.claims, kel: proof.kel } : { pins };
}

/** Read a session body as a floor pin set at `nexusHex`, or null. */
export function readHearthFloorPinsBody(body: unknown, nexusHex: string): readonly GateBundlePin[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const keys = Reflect.ownKeys(body).map(String).sort().join(",");
  if (keys !== "pins" && keys !== "claims,kel,pins") return null;
  return readHearthFloorPins((body as { pins: unknown }).pins, nexusHex);
}

/** The proof a session body carries beside its pins, unread (the index's reader judges each claim), or null. */
export function readHearthFloorProofBody(body: unknown): { readonly claims: readonly unknown[]; readonly kel: readonly unknown[] } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { claims, kel } = body as { claims?: unknown; kel?: unknown };
  if (!Array.isArray(claims) || !Array.isArray(kel) || claims.length > HEARTH_FLOOR_PIN_BOUND || kel.length > FLOOR_CARD_KEL_BOUND) return null;
  return { claims, kel };
}

/** The anchor a person or an authenticated relation hands a reader apart from the card: the place AID, and where it came from. */
export interface FloorAnchor {
  readonly aid: string;
  readonly via: "genesis" | "admit" | "transfer";
}

/** How the anchor of a claim set reads for one hearth: the AID the index already holds for it, else the set's own (a crossing's first claim adopts). */
function adoptedAnchor(index: ClaimDoor, hearth: string, claims: readonly unknown[]): string | null {
  let first: string | null = null;
  for (const raw of claims) {
    const c = raw as { aid?: unknown; pin?: { nexus?: unknown; route?: unknown } } | null;
    if (typeof c?.aid !== "string") continue;
    first ??= c.aid;
    const pin = readGateBundlePin(c.pin);
    if (!("pin" in pin)) continue;
    const held = index.standingOf({ hearth, nexus: pin.pin.nexus, route: pin.pin.route, tier: "floor" });
    if (held) return held.aid;
  }
  return first;
}

/**
 * File the claims a SOVEREIGN SESSION carried. The crossing is the authenticated relation, so the AID the index already holds
 * for this hearth anchors the set; where it holds none, the set's first claim adopts its AID. A claim of another AID refuses
 * `place-unanchored`; a rotated hearth's descendant claim replaces live.
 */
export function fileSessionClaims(index: ClaimDoor, hearth: string, nexusHex: string,
  proof: { readonly claims: readonly unknown[]; readonly kel: readonly unknown[] }): ClaimFilingReport {
  const aid = adoptedAnchor(index, hearth, proof.claims);
  if (aid === null) return { filed: [], refused: proof.claims.map(() => "statement-malformed" as const), held: [] };
  const filings: ClaimFilingReport[] = proof.claims.map((claim) => filePlaceFloorPins(index, [claim],
    { nexusHex, route: (claim as { pin?: { route?: string } })?.pin?.route ?? "", kelRows: proof.kel, standing: { via: "anchor", aid } }, () => hearth));
  return { filed: filings.flatMap((f) => f.filed), refused: filings.flatMap((f) => f.refused), held: filings.flatMap((f) => f.held) };
}

// ── The floor card: the flow floor pin a person carries by hand ──────────────────────────────────

/**
 * THE FLOOR CARD (carrier (c), by the person's own hand): the hearth's own banner prints the place's signed FLOOR PIN CLAIM for
 * its flow route beside the place KEL rows that fold to the claim's head, and a device's arrival URL carries the two in its
 * fragment, which never reaches a server. A card reaches the FLOOR tier on the flow route alone: it seats no face and opens no
 * sovereign gate.
 *
 * THE CARD NEVER ANCHORS ITSELF. A claim a card carries files only against an anchor conveyed apart from it: the founder's
 * own genesis, an authenticated admit, or a deliberate person-to-person transfer (`FloorAnchor`). An unanchored card, a forged
 * claim, a claim at a head the carried rows cannot fold and a claim another AID than the anchor's each refuse by name
 * (`verifyHearthFloorCard`). The key the flow's pointer signs under (the publisher) reads off the verified head's signer, so
 * a rotated place's card names the key its pointers sign under now.
 */
export interface HearthFloorCard {
  /** The place's signed claim of the flow's floor pin at the hearth's Nexus. */
  readonly claim: PlaceFloorPinStatement;
  /** The place KEL events, inception first, that fold to the claim's head. */
  readonly kel:   readonly PlaceKelEvent[];
}

/** The route a floor card names: the flow's. */
export const HEARTH_FLOOR_CARD_ROUTE = "/flow";
/** How many KEL events one card may carry, and the longest card text a reader takes. */
export const FLOOR_CARD_KEL_BOUND = 16;
const FLOOR_CARD_TEXT_BOUND = 24576;

/** A floor card's carried text: base64url of its JSON, no padding. */
export function hearthFloorCardText(card: HearthFloorCard): string {
  return base64UrlEncode(utf8Bytes(JSON.stringify({ claim: card.claim, kel: card.kel })));
}

/** Read a carried floor card's SHAPE: a claim on the flow route and KEL events that decode; else null. Nothing here trusts the card. */
export function readHearthFloorCard(text: unknown): HearthFloorCard | null {
  try {
    if (typeof text !== "string" || text.length === 0 || text.length > FLOOR_CARD_TEXT_BOUND || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(text))) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("claim") || !keys.includes("kel")) return null;
    const { claim, kel } = value as { claim: unknown; kel: unknown };
    if (!Array.isArray(kel) || kel.length === 0 || kel.length > FLOOR_CARD_KEL_BOUND) return null;
    const events: PlaceKelEvent[] = [];
    for (const raw of kel) { const event = decodePlaceKelEvent(raw); if (event === null) return null; events.push(event); }
    const read = typeof claim === "object" && claim !== null ? readGateBundlePin((claim as { pin?: unknown }).pin) : null;
    if (read === null || !("pin" in read) || read.pin.tier !== "floor" || read.pin.route !== HEARTH_FLOOR_CARD_ROUTE) return null;
    return Object.freeze({ claim: claim as PlaceFloorPinStatement, kel: Object.freeze(events) });
  } catch { return null; }
}

/** A verified floor card: the claim's reading, and the key the flow's pointer signs under at the claim's head. */
export type VerifiedFloorCard =
  | { readonly card: HearthFloorCard; readonly reading: PlaceFloorPinReading; readonly publisher: string }
  | { readonly refusal: PlaceFloorPinRefusal };

/** Verify a card against an anchor conveyed apart from it. With no anchor the card refuses `place-unanchored`: it never anchors itself. */
export function verifyHearthFloorCard(card: HearthFloorCard | null, anchor: FloorAnchor | null | undefined): VerifiedFloorCard {
  if (card === null) return { refusal: "statement-malformed" };
  if (!anchor || typeof anchor.aid !== "string") return { refusal: "place-unanchored" };
  const read = readPlaceFloorPin(card.claim, { nexusHex: card.claim?.pin?.nexus, route: HEARTH_FLOOR_CARD_ROUTE, kelRows: card.kel, standing: { via: "anchor", aid: anchor.aid } });
  return "refusal" in read ? { refusal: read.refusal } : { card, reading: read, publisher: read.signerKey };
}

/** What filing a card did: the verification, and the index's word on the claim. */
export type FloorCardFiling =
  | { readonly filed: true;  readonly moved: "first" | "replaced" | "duplicate"; readonly publisher: string; readonly reading: PlaceFloorPinReading }
  | { readonly filed: false; readonly refusal: PlaceFloorPinRefusal | "rollback" | "fork" | "index-refused"; readonly held?: string };

/**
 * File a card's claim in `index` under `hearth`, against `anchor`. A card at a head older than one the index holds refuses
 * `rollback` and the index keeps serving the newer head; a fork surfaces and holds the last accepted pin.
 */
export function fileHearthFloorCard(index: HearthPinIndex, hearth: string, card: HearthFloorCard | null, anchor: FloorAnchor | null | undefined): FloorCardFiling {
  const verified = verifyHearthFloorCard(card, anchor);
  if ("refusal" in verified) {
    if (verified.refusal === "kel-forked" && card) {
      const again = readPlaceFloorPin(card.claim, { nexusHex: card.claim.pin.nexus, route: HEARTH_FLOOR_CARD_ROUTE, kelRows: card.kel, standing: { via: "anchor", aid: anchor!.aid } });
      if ("fork" in again && again.fork) index.noteKelFork(again.fork);
    }
    return { filed: false, refusal: verified.refusal };
  }
  const result = index.fileClaim(hearth, verified.reading.pin, verified.reading.stand);
  if (result.filed) return { filed: true, moved: result.moved, publisher: verified.publisher, reading: verified.reading };
  return result.refusal === "rollback"
    ? { filed: false, refusal: "rollback", held: result.held.head }
    : { filed: false, refusal: result.refusal === "fork" ? "fork" : "index-refused" };
}

/** The words an offline reader says of the head it holds: "as of my last sync". */
export function lastSyncNote(stand: { readonly aid: string; readonly seq: number; readonly head: string } | null): string {
  return stand === null
    ? "no floor pin claim held: nothing synced yet"
    : `as of my last sync: place ${stand.aid.slice(0, 12)}… at KEL seq ${String(stand.seq)} (${stand.head.slice(0, 12)}…)`;
}
