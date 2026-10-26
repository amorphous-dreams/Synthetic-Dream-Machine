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
 *     `readAdmitGatePinAt(value, nexus)` is the admit path's door: the Nexus is required there.
 *   · DIGEST. `admitGatePinDigest` is the gate-bundle digest of the validated pin, nothing beside it.
 *   · FILE. `hearthPinIndex` files pins by (hearth, Nexus, route, tier) in memory. A pin moves only by a
 *     signed causal event or a verified key-history step. A SOVEREIGN pin, and a floor pin that rides no claim, moves
 *     by neither: a held key answers its first pin until the index is dropped (the sovereign pin follows the
 *     custody key by its own signed relation). A FLOOR pin that rides a floor pin claim (`fileClaim`, the place
 *     KEL's descent) moves by the claim's descent alone: a descendant claim replaces the pin, a known ancestor
 *     refuses as a rollback, and two claims at one head, or a forked KEL, surface as a fork. The index folds its
 *     evidence as a SET, so arrival order never selects a pin. There is no `replace`, by design.
 *
 * Pure: no I/O, no clock, no timer, no randomness. Called by the admit carriage (`carriage-registry`, whose
 * `AdmitCarriage` carries the whole pin), `fleet-join`, `held-nexus-root`, the carriage pull, the oracle reader and
 * the browser adapter; the package barrel names it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange
 */
import { hex, hexToBytes, utf8Bytes } from "./crypto.js";
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

/**
 * `readAdmitGatePin` with the Nexus REQUIRED: the admit path names the Nexus it stands at, and a missing, empty or
 * non-text one refuses "pin-other-nexus" rather than reading the pin of any Nexus.
 */
export function readAdmitGatePinAt(
  value: unknown,
  nexus: string,
): { readonly pin: GateBundlePin } | { readonly refusal: AdmitGatePinRefusal } {
  if (typeof nexus !== "string" || nexus.length === 0) return { refusal: "pin-other-nexus" };
  return readAdmitGatePin(value, { nexus });
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
 * the pin or null. `forHearth(hearth, nexus)` answers that pair's pins, never another pair's. The Nexus has one
 * spelling per door: `get` the pin's hex, `forHearth` the AID text; the wrong one throws TypeError.
 */
export interface HearthPinIndex {
  put(hearth: string, pin: unknown): boolean;
  get(key: DialPinKey): GateBundlePin | null;
  forHearth(hearth: string, nexus: string): readonly GateBundlePin[];
  /** File a floor pin that rides a verified floor pin claim. See `PlaceClaimFiling`. */
  fileClaim(hearth: string, pin: unknown, stand: PlaceClaimStand): PlaceClaimFiling;
  /** Note a place KEL fork a reader met: claims past the common ancestor leave the standing. Idempotent; order-free. */
  noteKelFork(fork: PlaceKelForkNote): void;
  /** The head the index holds for a claimed key, or null where the key rides no claim ("as of my last sync"). */
  standingOf(key: DialPinKey): PlaceClaimStand | null;
  /** Every fork the evidence shows, sorted: the same evidence names the same forks in any arrival order. */
  forks(): readonly PlaceClaimFork[];
  readonly size: number;
}

/**
 * Where a floor pin claim stands in its place's KEL: the place AID, the sequence and event digest of the head the claim
 * names, and the event digests from the inception to that head (`lineage[i]` is the digest at seq `i`, so the head is
 * `lineage[seq]`). The reader that verified the claim builds it from the chain it folded.
 */
export interface PlaceClaimStand {
  readonly aid:     string;
  readonly seq:     number;
  readonly head:    string;
  readonly lineage: readonly string[];
}

/** A place KEL fork a reader met: the inception AID and the digests of the trunk both branches share. */
export interface PlaceKelForkNote {
  readonly aid:   string;
  readonly trunk: readonly string[];
}

/** What the index says to a filed claim. A refusal files nothing the standing serves; a fork is evidence the index keeps. */
export type PlaceClaimFiling =
  | { readonly filed: true;  readonly moved: "first" | "replaced" | "duplicate"; readonly stand: PlaceClaimStand }
  | { readonly filed: false; readonly refusal: "rollback"; readonly held: PlaceClaimStand }
  | { readonly filed: false; readonly refusal: "fork"; readonly fork: PlaceClaimFork }
  | { readonly filed: false; readonly refusal: "pin-unreadable" | "hearth-unreadable" | "stand-malformed" | "claim-moves-no-sovereign-pin" | "set-full" };

/** A fork the evidence shows: two (or more) heads no descent orders, kept apart from any arrival order. */
export interface PlaceClaimFork {
  readonly key:     string;
  readonly aids:    readonly string[];
  readonly heads:   readonly string[];
  /** The newest head every branch descends from that the index holds a claim for, or null. */
  readonly settled: string | null;
}

// ONE SPELLING PER DOOR. `get` takes the key's Nexus as the pin carries it (hex of the AID text); `forHearth` takes
// the AID text. Each refuses the other's spelling with a TypeError, since both are strings and a miss would be silent.
const isHexText = (value: string): boolean => /^(?:[0-9a-f]{2})+$/.test(value);
const isHexOfAid = (value: string): boolean => isHexText(value) && hexToBytes(value).every((byte) => byte > 0x20 && byte < 0x7f);

const hearthReads = (hearth: unknown): hearth is string => typeof hearth === "string" && hearth.length > 0 && !/[\r\n]/.test(hearth);
// The hearth leads and holds no newline; the rest holds none either (hex, a route, a tier), so the join is one reading.
const keyText = (hearth: string, nexus: string, route: string, tier: string): string => [hearth, nexus, route, tier].join("\n");

const HEX64 = /^[0-9a-f]{64}$/;
/** The most claims one (place, Nexus, route, tier) set keeps: a lawful chain stays far below it. */
const CLAIMS_PER_SET = 256;

interface HeldClaim {
  readonly pin:    GateBundlePin;
  readonly digest: string;
  readonly stand:  PlaceClaimStand;
  readonly names:  Set<string>;
}
interface ClaimSet {
  readonly aid:    string;
  readonly nexus:  string;
  readonly route:  string;
  readonly tier:   GateTier;
  readonly claims: Map<string, HeldClaim>;
}

const standReads = (stand: unknown): stand is PlaceClaimStand => {
  if (typeof stand !== "object" || stand === null) return false;
  const { aid, seq, head, lineage } = stand as Record<string, unknown>;
  return typeof aid === "string" && HEX64.test(aid) && typeof head === "string" && HEX64.test(head) &&
    typeof seq === "number" && Number.isSafeInteger(seq) && seq >= 0 && Array.isArray(lineage) && lineage.length === seq + 1 &&
    lineage.every((d) => typeof d === "string" && HEX64.test(d)) && lineage[seq] === head;
};

/** Does `later` descend from `earlier` in one place's KEL? A claim is not its own descendant. */
const descends = (later: PlaceClaimStand, earlier: PlaceClaimStand): boolean =>
  later.aid === earlier.aid && later.seq > earlier.seq && later.lineage[earlier.seq] === earlier.head;

/** What a set of claims serves, read from the SET alone: no arrival order enters. */
function standingOfSet(set: ClaimSet, kelForks: ReadonlyMap<string, readonly string[]>): { served: HeldClaim | null; fork: PlaceClaimFork | null } {
  const trunk = kelForks.get(set.aid);
  const cands = [...set.claims.values()].filter((c) => trunk === undefined || trunk[c.stand.seq] === c.stand.head);
  const maximal = cands.filter((c) => !cands.some((o) => descends(o.stand, c.stand)));
  if (maximal.length === 1) return { served: maximal[0]!, fork: null };
  if (maximal.length === 0) return { served: null, fork: null };
  const below = cands.filter((c) => !maximal.includes(c) && maximal.every((m) => descends(m.stand, c.stand)));
  const settled = below.sort((a, b) => b.stand.seq - a.stand.seq)[0] ?? null;
  const fork: PlaceClaimFork = Object.freeze({
    key: `${set.aid}\n${set.nexus}\n${set.route}\n${set.tier}`, aids: [set.aid],
    heads: [...new Set(maximal.map((c) => c.stand.head))].sort(), settled: settled?.stand.head ?? null,
  });
  return { served: settled, fork };
}

export function hearthPinIndex(): HearthPinIndex {
  const held = new Map<string, GateBundlePin>();
  const sets = new Map<string, ClaimSet>();
  const names = new Map<string, Set<string>>();
  const kelForks = new Map<string, readonly string[]>();
  const setKeyOf = (aid: string, nexus: string, route: string, tier: string): string => [aid, nexus, route, tier].join("\n");

  /** The pin one name is served at one key: the claims' standing where the name rode a claim, else the unclaimed pin. */
  const lookup = (nameKey: string, hearth: string): { pin: GateBundlePin | null; claim: HeldClaim | null } => {
    const riding = names.get(nameKey);
    if (riding === undefined) return { pin: held.get(nameKey) ?? null, claim: null };
    const served: HeldClaim[] = [];
    for (const setKey of riding) {
      const set = sets.get(setKey);
      const { served: one } = set ? standingOfSet(set, kelForks) : { served: null };
      if (one !== null && one.names.has(hearth)) served.push(one);
    }
    return served.length === 1 ? { pin: served[0]!.pin, claim: served[0]! } : { pin: null, claim: null };
  };
  const allNameKeys = (): Set<string> => new Set([...held.keys(), ...names.keys()]);

  return Object.freeze({
    put(hearth: string, pin: unknown): boolean {
      if (!hearthReads(hearth)) return false;
      const read = readGateBundlePin(pin);
      if (!("pin" in read)) return false;
      const p = read.pin;
      const key = keyText(hearth, p.nexus, p.route, p.tier);
      // A key that rides a claim moves by the claim's descent alone: an unclaimed pin matches what is served, or files nothing.
      if (names.has(key)) { const now = lookup(key, hearth).pin; return now !== null && gateBundleDigest(now) === gateBundleDigest(p); }
      const had = held.get(key);
      if (had !== undefined) return gateBundleDigest(had) === gateBundleDigest(p);
      held.set(key, p);
      return true;
    },
    get(key: DialPinKey): GateBundlePin | null {
      if (!hearthReads(key?.hearth)) return null;
      if (typeof key.nexus !== "string" || !isHexText(key.nexus)) throw new TypeError("hearthPinIndex.get: key.nexus is the pin's hex, as dialPinKeyOf spells it; the AID text goes to forHearth");
      return lookup(keyText(key.hearth, key.nexus, key.route, key.tier), key.hearth).pin;
    },
    forHearth(hearth: string, nexus: string): readonly GateBundlePin[] {
      if (!hearthReads(hearth) || typeof nexus !== "string") return [];
      if (isHexOfAid(nexus)) throw new TypeError("hearthPinIndex.forHearth: nexus is the AID text, never the pin's hex; a hex key goes to get");
      const nexusHex = hex(utf8Bytes(nexus));
      const prefix = `${hearth}\n${nexusHex}\n`;
      return [...allNameKeys()].filter((key) => key.startsWith(prefix)).sort()
        .flatMap((key) => { const { pin } = lookup(key, hearth); return pin ? [pin] : []; });
    },
    fileClaim(hearth: string, pin: unknown, stand: PlaceClaimStand): PlaceClaimFiling {
      if (!hearthReads(hearth)) return { filed: false, refusal: "hearth-unreadable" };
      const read = readGateBundlePin(pin);
      if (!("pin" in read)) return { filed: false, refusal: "pin-unreadable" };
      const p = read.pin;
      if (p.tier !== "floor") return { filed: false, refusal: "claim-moves-no-sovereign-pin" };
      if (!standReads(stand)) return { filed: false, refusal: "stand-malformed" };
      const nameKey = keyText(hearth, p.nexus, p.route, p.tier);
      const setKey = setKeyOf(stand.aid, p.nexus, p.route, p.tier);
      let set = sets.get(setKey);
      const before = set ? standingOfSet(set, kelForks).served : null;
      const digest = gateBundleDigest(p);
      const id = `${stand.head}\n${digest}`;
      const had = set?.claims.get(id);
      // A known ancestor of a claim the evidence holds refuses as a rollback, and the index KEEPS it as ancestry evidence: the
      // set folds the same in any arrival order, so a fork still finds the ancestor both branches share.
      const newer = set ? [...set.claims.values()].filter((c) => descends(c.stand, stand)).sort((a, b) => b.stand.seq - a.stand.seq)[0] : undefined;
      if (!had && set && set.claims.size >= CLAIMS_PER_SET) return { filed: false, refusal: "set-full" };
      if (!set) { set = { aid: stand.aid, nexus: p.nexus, route: p.route, tier: p.tier, claims: new Map() }; sets.set(setKey, set); }
      const claim: HeldClaim = had ?? { pin: p, digest, stand: Object.freeze({ ...stand, lineage: Object.freeze([...stand.lineage]) }), names: new Set() };
      claim.names.add(hearth);
      set.claims.set(id, claim);
      const riding = names.get(nameKey) ?? new Set<string>();
      riding.add(setKey); names.set(nameKey, riding);
      if (newer) return { filed: false, refusal: "rollback", held: newer.stand };
      const after = standingOfSet(set, kelForks);
      if (after.fork !== null && !(after.served === claim)) return { filed: false, refusal: "fork", fork: after.fork };
      if (had && before === claim) return { filed: true, moved: "duplicate", stand: claim.stand };
      return { filed: true, moved: before === null ? "first" : "replaced", stand: claim.stand };
    },
    noteKelFork(fork: PlaceKelForkNote): void {
      if (!HEX64.test(fork?.aid) || !Array.isArray(fork.trunk) || fork.trunk.length === 0 || !fork.trunk.every((d) => typeof d === "string" && HEX64.test(d))) return;
      const had = kelForks.get(fork.aid);
      // The earliest fork governs: the shorter trunk, and for equal trunks the one that sorts first.
      if (had === undefined || fork.trunk.length < had.length || (fork.trunk.length === had.length && fork.trunk.join() < had.join())) {
        kelForks.set(fork.aid, Object.freeze([...fork.trunk]));
      }
    },
    standingOf(key: DialPinKey): PlaceClaimStand | null {
      if (!hearthReads(key?.hearth) || typeof key.nexus !== "string" || !isHexText(key.nexus)) return null;
      return lookup(keyText(key.hearth, key.nexus, key.route, key.tier), key.hearth).claim?.stand ?? null;
    },
    forks(): readonly PlaceClaimFork[] {
      const out: PlaceClaimFork[] = [];
      for (const set of sets.values()) { const { fork } = standingOfSet(set, kelForks); if (fork) out.push(fork); }
      for (const [aid, trunk] of kelForks) out.push(Object.freeze({ key: `kel\n${aid}`, aids: [aid], heads: [], settled: trunk[trunk.length - 1]! }));
      return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    },
    get size(): number {
      let n = 0;
      for (const key of allNameKeys()) { const hearth = key.slice(0, key.indexOf("\n")); if (lookup(key, hearth).pin !== null) n += 1; }
      return n;
    },
  });
}
