/**
 * place-floor-pin — a PLACE's floor pin, carried where a reader already holds the Nexus that carries the place, and the
 * place's own presentation at that Nexus's floor gates.
 *
 * WHY A PLACE SIGNS ITS OWN PIN. A herm stands a floor gate only at a Nexus whose quorum counted a `carry` act over the
 * herm's own vessel key (`placeCarriedNexuses`). Its floor pin derives from its floor key, which no seat holds, so no seat
 * can mint it; and an announcement never authenticates its own first pin (house ruling "The admit's gate pin"). So the
 * herm signs ONE statement per Nexus with the key the quorum's act names: `{ kind, placeKey, nexus, route, tier, digest }`
 * over the pin it stands there. A reader files that pin only when
 *
 *   1. the statement reads whole, its pin reads whole, at floor tier, at the Nexus the reader asked, on the route asked;
 *   2. the place's signature verifies under `placeKey`, over this exact image (domain-separated from every other seal);
 *   3. the reader's OWN held root of that Nexus counts a `carry` for `placeKey` (the carrier fold over its own replica).
 *
 * The quorum's act authenticates the key; the key authenticates the pin. A statement for an uncarried key, a pin of
 * another Nexus or route, or a torn signature files nothing. The statement rides the Nexus's carriage board beside the acts
 * (a sidecar keyed by the place key, which the act extractor skips), so any replica writer may carry it and none can forge
 * it (lar:///ha.ka.ba/lararium/mesh/place-floor-pin, whose status line names its standing).
 *
 * OWED (the carrier's #/owed): the statement carries no causal position, and the pair index holds no replace, so an older
 * valid statement can stand in for a newer one after a floor-key rotation until the index drops it.
 *
 * THE PLACE ARM. A place presents the quorum's counted `carry` act over its own key at the gate's Nexus, with every
 * counted act of that relation in its causal past as the lineage the gate's reader walks (`verifyPresentedCarry`). The
 * head is the counted `carry` no other counted act of this place descends from; a counted `uncarry` that descends from it
 * leaves the place with no arm to present.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/place-floor-pin
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { CARRIAGE_ENTRY_PREFIX } from "./carriage-board.js";
import { carriageEntryActCid, foldCarriageDetails, isCarriageDescendant, resolveAnchoredChain, rollAnchorCid, type CarriageAncestry, type CarriageEntry, type RollAnchor } from "./carriage-registry.js";
import { canonicalJsonBytes, hex, hexToBytes } from "./crypto.js";
import { frameFloorDuty } from "./place-signer.js";
import { PLACE_FLOOR_PIN_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { gateBundleDigest, readGateBundlePin, type GateBundlePin } from "./gate-bundle.js";
import { PLACE_LINEAGE_BOUND, type PlaceArm } from "./gate-exchange.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";
import { storedLarRecord } from "./stored-record.js";

/** The statement's domain: a place's floor pin, and nothing any other seal signs (`domains`). */
export const PLACE_FLOOR_PIN_KIND = PLACE_FLOOR_PIN_DOMAIN;
/** The board sidecar's prefix: one tiddler per place key, apart from the acts. */
export const PLACE_FLOOR_PIN_PREFIX = `${CARRIAGE_ENTRY_PREFIX}place-floor-pin/` as const;

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;

/** A place's signed floor pin at one Nexus. */
export interface PlaceFloorPinStatement {
  readonly kind:     typeof PLACE_FLOOR_PIN_KIND;
  readonly placeKey: string;
  readonly pin:      GateBundlePin;
  readonly sig:      string;
}

export const PLACE_FLOOR_PIN_REFUSALS = [
  "statement-malformed", "pin-unreadable", "pin-not-floor", "pin-other-nexus", "pin-other-route", "signature-refused", "place-uncarried",
] as const;
export type PlaceFloorPinRefusal = (typeof PLACE_FLOOR_PIN_REFUSALS)[number];

/** The exact bytes a place signs over its floor pin: the domain, its key, and the pin's coordinates and digest. */
export function placeFloorPinImage(placeKey: string, pin: GateBundlePin): Uint8Array {
  return frameFloorDuty(PLACE_FLOOR_PIN_KIND, canonicalJsonBytes({
    kind: PLACE_FLOOR_PIN_KIND, placeKey: placeKey.toLowerCase(),
    nexus: pin.nexus, route: pin.route, tier: pin.tier, digest: gateBundleDigest(pin),
  }));
}

/** Sign a place's floor pin with the place's own signing door. */
export async function signPlaceFloorPin(args: {
  readonly placeKey: string;
  readonly pin:      GateBundlePin;
  readonly sign:     (image: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}): Promise<PlaceFloorPinStatement> {
  const placeKey = args.placeKey.toLowerCase();
  const read = readGateBundlePin(args.pin);
  if (!("pin" in read)) throw new Error("signPlaceFloorPin: the pin does not read whole");
  const sig = await args.sign(placeFloorPinImage(placeKey, read.pin));
  return Object.freeze({ kind: PLACE_FLOOR_PIN_KIND, placeKey, pin: read.pin, sig: hex(sig) });
}

/**
 * Read one statement for a reader at `nexusHex` (the Nexus as a pin carries it), on `route`, against the carrier set the
 * reader's own held root folds. Never throws.
 */
export function readPlaceFloorPin(raw: unknown, at: {
  readonly nexusHex: string;
  readonly route:    string;
  readonly carriers: ReadonlySet<string>;
}): { readonly placeKey: string; readonly pin: GateBundlePin } | { readonly refusal: PlaceFloorPinRefusal } {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { refusal: "statement-malformed" };
    const keys = Object.keys(raw).sort();
    if (keys.join(",") !== "kind,pin,placeKey,sig") return { refusal: "statement-malformed" };
    const s = raw as Record<string, unknown>;
    if (s["kind"] !== PLACE_FLOOR_PIN_KIND || typeof s["placeKey"] !== "string" || !KEY_RE.test(s["placeKey"])
      || typeof s["sig"] !== "string" || !SIG_RE.test(s["sig"])) return { refusal: "statement-malformed" };
    const read = readGateBundlePin(s["pin"]);
    if (!("pin" in read)) return { refusal: "pin-unreadable" };
    const pin = read.pin;
    if (pin.tier !== "floor") return { refusal: "pin-not-floor" };
    if (pin.nexus !== at.nexusHex) return { refusal: "pin-other-nexus" };
    if (pin.route !== at.route) return { refusal: "pin-other-route" };
    const placeKey = s["placeKey"];
    if (!verifyEd25519(hexToBytes(s["sig"]), placeFloorPinImage(placeKey, pin), placeKey)) return { refusal: "signature-refused" };
    // Last: the relation. A key the reader's own replica of the Nexus does not count as a carrier authenticates nothing.
    if (!at.carriers.has(placeKey)) return { refusal: "place-uncarried" };
    return { placeKey, pin };
  } catch { return { refusal: "statement-malformed" }; }
}

/** The board tiddler one place's statement rides under. */
export function placeFloorPinKey(placeKey: string): string {
  return `${PLACE_FLOOR_PIN_PREFIX}${placeKey.toLowerCase()}`;
}

/** Land a statement onto a carriage board draft. Call INSIDE a `handle.change()` callback. Writes no trust: the reader decides. */
export function writePlaceFloorPin(draft: LarDoc, statement: PlaceFloorPinStatement): void {
  const key = placeFloorPinKey(statement.placeKey);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(statement) }, PLACE_FLOOR_PIN_KIND);
}

/** Every statement-shaped payload a carriage board carries under the sidecar prefix, unread. */
export function placeFloorPinsFromBoard(doc: LarDoc | undefined | null): unknown[] {
  const out: unknown[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(PLACE_FLOOR_PIN_PREFIX)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try { out.push(JSON.parse(text) as unknown); } catch { /* a torn sidecar files nothing */ }
  }
  return out;
}

/**
 * File every statement that reads at `at` into a pair index, each under its place key (the name a carriage peer's dial
 * carries). Returns what filed and why each other one did not.
 */
export function filePlaceFloorPins(
  index: { put(hearth: string, pin: unknown): boolean },
  statements: readonly unknown[],
  at: { readonly nexusHex: string; readonly route: string; readonly carriers: ReadonlySet<string> },
): { readonly filed: readonly string[]; readonly refused: readonly PlaceFloorPinRefusal[] } {
  const filed: string[] = [];
  const refused: PlaceFloorPinRefusal[] = [];
  for (const raw of statements) {
    const read = readPlaceFloorPin(raw, at);
    if ("refusal" in read) { refused.push(read.refusal); continue; }
    if (index.put(read.placeKey, read.pin)) filed.push(read.placeKey);
  }
  return { filed, refused };
}

/**
 * The place arm `placeKey` presents at a Nexus whose held root reads `roster` over `entries` (its carriage board): the
 * counted head `carry` and its counted causal past, or null where none stands, an `uncarry` closes it, or the past runs
 * past the lineage bound.
 */
export async function placeArmFor(entries: readonly CarriageEntry[], roster: KahuQuorumSeats, placeKey: string, ancestry?: CarriageAncestry): Promise<PlaceArm | null> {
  const nym = placeKey.toLowerCase();
  const counted: CarriageEntry[] = [];
  const folded = await foldCarriageDetails(entries, roster, ancestry);
  for (const [i, entry] of entries.entries()) {
    if (typeof entry?.nym !== "string" || entry.nym.toLowerCase() !== nym) continue;
    if (entry.action !== "carry" && entry.action !== "uncarry") continue;
    if (folded.entries[i]?.counted) counted.push(entry);
  }
  const byCid = new Map<string, CarriageEntry>(counted.map((e) => [carriageEntryActCid(e), e]));
  const carries = [...byCid].filter(([, e]) => e.action === "carry");
  // The head: a counted carry no other counted act of this place descends from.
  const heads = carries.filter(([cid]) => ![...byCid.keys()].some((other) => other !== cid && isCarriageDescendant(other, cid, byCid)));
  if (heads.length === 0) return null;
  const [, contract] = heads.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))[0]!;
  const lineage: CarriageEntry[] = [];
  const todo = [...contract.parents];
  const seen = new Set<string>();
  while (todo.length) {
    const cid = todo.pop()!;
    if (seen.has(cid)) continue;
    seen.add(cid);
    const node = byCid.get(cid);
    if (!node) return null;                     // a parent this replica cannot count: the gate would refuse the chain
    lineage.push(node);
    todo.push(...node.parents);
  }
  const seals = ancestry?.sealLineage ?? [];
  const anchors: RollAnchor[] = [];
  const earliest = [contract, ...lineage].reduce((at, act) => Math.min(at, seals.findIndex((e) => e.epochCid === act.sealEpochCid)), seals.length - 1);
  if (earliest >= 0 && earliest < seals.length - 1) {
    const from = earliest;
    if (from < 0) return null;
    const graph = new Map<string, { readonly parents: readonly string[] }>(
      [...counted.map((entry) => [carriageEntryActCid(entry), entry] as const),
        ...(ancestry?.anchors ?? []).map((anchor) => [rollAnchorCid(anchor), anchor] as const)]);
    let previous: RollAnchor | null = null;
    for (let i = from + 1; i < seals.length; i++) {
      const candidates = (ancestry?.anchors ?? []).filter((a) => a.sealEpochCid === seals[i]!.epochCid &&
        (previous === null || a.parents.includes(rollAnchorCid(previous))) &&
        (seals.findIndex((e) => e.epochCid === contract.sealEpochCid) >= i ||
          isCarriageDescendant(rollAnchorCid(a), carriageEntryActCid(contract), graph)));
      const selected = candidates.sort((a, b) => rollAnchorCid(a).localeCompare(rollAnchorCid(b)))[0];
      if (!selected) return null;
      anchors.push(selected);
      previous = selected;
    }
    const resolved = await resolveAnchoredChain(seals[from]!.epochCid, roster, seals, anchors);
    if (typeof resolved === "string" || "rejected" in resolved) return null;
  }
  if (lineage.length + anchors.length > PLACE_LINEAGE_BOUND) return null;
  return { kind: "place", contract, lineage: [...lineage, ...anchors], sealLineage: seals };
}
