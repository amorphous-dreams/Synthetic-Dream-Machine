/**
 * dyad — one face atom's relationship with its PersonaGroup, made first-class.
 *
 * A dyad names neither a place nor a person: it names ONE HUMAN'S RELATIONSHIP WITH ONE DEVICE, and that device
 * meets the face through its ATOM alone. The atom is a random key that mints when the device joins the group, rests
 * in that face's own custody on that vessel, and derives from no device seed. The place key stands in no face
 * relation, so the dyad has ONE end: the atom's DID. The vessel's own list of its atoms is a local custody row and
 * rides no wire or board.
 *
 * THE ATOM STAYS LOCAL. Every atom reads UNIQUE at the infra layer: it never spans devices, so no infra-layer key
 * ever links one human's places, or one device's faces, to each other. Nothing at this layer can be correlated
 * into a person, which is exactly the property the layer exists to hold.
 *
 * WHY THE RELATIONSHIP RATHER THAN EITHER PARTY. Bind identity to a vessel and a human loses themselves when
 * a device dies. Bind it to the atom's relation and a lost device dies alone: the person re-admits and a fresh
 * atom mints.
 *
 * THE DEEPER READING (operator ruling, 2026-07-26): IDENTITY ALWAYS NAMES A RELATIONSHIP, NEVER A THING.
 * That holds outside this codebase too — every pet-name a human uses names a relation they stand in, and the
 * "thing" underneath reads as an inference nobody ever verifies. So the dyad does not JOIN two identities;
 * the dyad ENACTS the identity-relationship (as all identity functions as relationship-functor), and the atom
 * names its end.
 *
 * ── THE PERSONA BRIDGES LOCAL INFRA TO THE SOCIAL LAYER, INTERNAL FIRST ─────────────────────────────────
 * Because infra keys correlate to nothing, SOMETHING must gather a human's places back together — and that
 * something belongs one layer up, where the human stands rather than the machine. The PersonaGroup holds its
 * OWN keys and BINDS the locally-unique dyads into one fleet. The binding runs cryptographic (the group's
 * sentinel membership in the authority graph), never a label anyone could assert.
 *
 * THREE NAMES, THREE JOBS, and none substitutes for another:
 *   · the BINDING — the PersonaGroup's keys, which make the fleet a fact rather than a claim
 *   · the INTERNAL name — one usable label over that group, private and local, for the human alone
 *   · the HANDLE — an OPTIONAL public pet-name over the same group, and the only one that ever federates
 *
 * Per `group-as-closure`, the fleet EVALUATES AS A QUERY over that binding and never instantiates: nothing
 * stores a fleet object to seize, forge, or sync. The internal name never crosses a wire, so a captured
 * vessel spills the dyads admitted TO IT and never the human's map of themselves.
 *
 * ── WHAT A DYAD ID DOES AND DOES NOT REVEAL ─────────────────────────────────────────────────────────────
 * The id content-addresses the atom's DID, so two parties knowing the key derive the identical id while the id
 * alone yields no key. Slots key by that id rather than by the atom, so a vessel's own storage never lays its
 * faces out in the open for whoever reads a key list.
 *
 * Platform-blind: rides ./crypto + ./base-doc + ./device-delegation types only. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle · lar:///ha.ka.ba/lares/api/pono/group-as-closure
 */

import { DEVICE_EDGE_DOMAIN, DYAD_ID_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { sha256HexSync, canonicalJson, hex } from "./crypto.js";
import {
  signDelegationEdge, verifyDelegationEdge, DELEGATION_DOMAIN, type DelegationEdge,
} from "./delegation-edge.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";
import type { LarDid } from "./lar-did.js";
import { storedLarRecord } from "./stored-record.js";

/** The domain a dyad id hashes under — so an id never collides with another content-address in the tree. */
export { DYAD_ID_DOMAIN } from "./domains.js";
/** The tiddler-key prefix a vessel's dyad slots ride under — N slots, never one `self`. */
export const DYAD_SLOT_PREFIX = "lar:///ha.ka.ba/dreamnet/dyad/" as const;

/** One atom's device end names the relationship. */
export interface DyadRef {
  readonly deviceDid: LarDid;
}

/**
 * A dyad as a vessel holds it: the relationship, plus the signed edge that establishes it.
 *
 * The edge remains the AUTHORITY — this record adds a name and a slot, never a second source of truth. A
 * reader that trusts the record without verifying the edge trusts a label; the edge stays the thing signed.
 */
export interface DyadRecord {
  readonly kind:      typeof DYAD_ID_DOMAIN;
  readonly dyadId:    string;
  readonly ref:       DyadRef;
  /** The two-signature delegation to this atom. */
  readonly edge:      DeviceDelegationTiddler;
  /**
   * The PRESENTED delegation edge binding this relationship into a fleet, or null while it stands unbound.
   *
   * A bare group-id string would read as a POINTER a reader resolves against whatever replica state it
   * happens to hold — the confused deputy in its textbook form, since the designation names a target while
   * ambient state supplies the authority. This carries its own authority instead: the group root SIGNED this
   * exact relationship at a named epochCid, so a verifier needs the edge and the root DID and nothing else.
   */
  readonly binding: DelegationEdge | null;
}

/**
 * The subject a dyad-binding covers — the atom DID, so an edge cannot lift off one dyad
 * and land on another. Named once so the mint and the verify can never disagree about what got signed.
 */
export function dyadBindingSubject(ref: DyadRef): Record<string, string> {
  return { deviceDid: normalizeDid(ref.deviceDid) };
}

/** Mint the edge gathering a relationship into a fleet — run where the group ROOT lives. */
export function signDyadBinding(
  ref: DyadRef, groupRootDid: LarDid, epochCid: string,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<DelegationEdge> {
  return signDelegationEdge(DELEGATION_DOMAIN.dyadBinding, dyadBindingSubject(ref), groupRootDid, epochCid, sign);
}

/**
 * Sign a dyad binding with the group root's raw seed — the ceremony's one-call form, kept HERE so a
 * ceremony site needs no crypto dependency of its own (mesh already carries the curve).
 */
export function signDyadBindingWithSeed(
  ref: DyadRef, groupRootDid: LarDid, epochCid: string, rootSeed: Uint8Array,
): Promise<DelegationEdge> {
  return signDyadBinding(ref, groupRootDid, epochCid, async (bytes) => {
    const sig = await ed25519.signAsync(bytes, rootSeed);
    return hex(sig);
  });
}

/** Lowercase a DID once, so two spellings of one key never derive two ids. */
function normalizeDid(did: LarDid): string {
  return did.trim().toLowerCase();
}

/**
 * The content-address of one atom relation, derived without a stored mapping.
 */
export function dyadId(ref: DyadRef): string {
  return sha256HexSync(canonicalJson({
    kind:      DYAD_ID_DOMAIN,
    deviceDid: normalizeDid(ref.deviceDid),
  }));
}

/**
 * The id a dyad's MARKER rides under on the fleet's edge board (kapae#/four-edges) — the same relationship,
 * named by the fleet root and the atom key each peer can verify.
 */
export function deviceEdgeId(fleetRootDid: LarDid | string, deviceDid: LarDid | string): string {
  const bare = (did: string) => did.trim().toLowerCase().replace(/^0x/, "").slice(-64);
  return sha256HexSync(canonicalJson({
    kind:      DEVICE_EDGE_DOMAIN,
    fleetRoot: bare(fleetRootDid),
    device:    bare(deviceDid),
  }));
}

/** Who holds every edge on one fleet's edge board: the fleet root, and no quorum (kapae#/edge-hands). */
export function fleetEdgeAuthority(fleetRootDid: LarDid | string): () => { readonly holder: string } {
  const holder = fleetRootDid.trim().toLowerCase().replace(/^0x/, "");
  return () => ({ holder });
}

/** The tiddler key one dyad rides under. Keyed by ID, so a key list never enumerates a human's faces. */
export function dyadSlotKey(id: string): string {
  return `${DYAD_SLOT_PREFIX}${id}`;
}

/**
 * Land a dyad onto a doc draft — one slot per relationship, so a vessel carrying three faces carries three
 * slots rather than overwriting one. Call INSIDE a `handle.change()` callback.
 */
export function writeDyad(draft: LarDoc, record: DyadRecord): void {
  const key = dyadSlotKey(record.dyadId);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(record) }, record.dyadId);
}

/** A parsed payload reads as a dyad only at the exact FLOOR shape, and only when its id RE-DERIVES. */
function coerceDyad(parsed: unknown): DyadRecord | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== DYAD_ID_DOMAIN) return null;
  const edge = p["edge"];
  if (typeof edge !== "object" || edge === null) return null;
  const e = edge as Record<string, unknown>;
  if (e["kind"] !== "device-delegation") return null;
  if (typeof e["personaRootDid"] !== "string" || typeof e["deviceDid"] !== "string") return null;
  const b = p["binding"];
  let binding: DelegationEdge | null = null;
  if (typeof b === "object" && b !== null) {
    const x = b as Record<string, unknown>;
    if (typeof x["signer"] === "string" && typeof x["epochCid"] === "string" && typeof x["sig"] === "string") {
      binding = { signer: x["signer"], epochCid: x["epochCid"], sig: x["sig"] };
    }
  }
  // THE SLOT'S REF IS AUTHORITATIVE FOR THE ATOM: the edge binds root→atom and names no derived face, so the
  // ref is REQUIRED, fenced to the edge's own atom. A slot without one, or whose ref rides another atom,
  // reads torn and drops. No fallback reading exists: a doc holding a bare edge re-founds rather than
  // being re-read as (atom × root).
  const refRaw = p["ref"];
  if (typeof refRaw !== "object" || refRaw === null) return null;
  const r = refRaw as Record<string, unknown>;
  if (typeof r["deviceDid"] !== "string") return null;
  const storedRef: DyadRef = { deviceDid: r["deviceDid"] };
  const et = edge as unknown as DeviceDelegationTiddler;
  if (normalizeDid(storedRef.deviceDid) !== normalizeDid(et.deviceDid)) return null;
  const record: DyadRecord = { kind: DYAD_ID_DOMAIN, dyadId: dyadId(storedRef), ref: storedRef, edge: et, binding };
  // A slot claiming an id its own ref does not produce reads as torn — drop it rather than trust the label
  // over the content. The id costs nothing to recompute, so nothing excuses trusting the stored one.
  if (typeof p["dyadId"] === "string" && p["dyadId"] !== record.dyadId) return null;
  return record;
}

/** Every well-formed dyad a doc carries. A torn or foreign tiddler drops in silence; an absent doc yields none. */
export function dyadsFromDoc(doc: LarDoc | undefined | null): DyadRecord[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const out: DyadRecord[] = [];
  for (const record of Object.values(tiddlers)) {
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    const dyad = coerceDyad(parsed);
    if (dyad !== null) out.push(dyad);
  }
  return out;
}

/**
 * THE FLEET — the closure the PersonaGroup binding names, evaluated here and never stored.
 *
 * It gathers by the GROUP, because the group's keys are what make a fleet a fact. A label gathers nothing:
 * anyone can write a label, and a fleet assembled from labels would let a forged record walk into a human's
 * own map of themselves. The binding decides membership; the internal name only makes it usable.
 *
 * An UNBOUND dyad joins no fleet — absence of a binding reads as a relationship not yet gathered, never as
 * membership in a default group.
 */
export function fleetOfGroup(dyads: readonly DyadRecord[], groupRootDid: LarDid): DyadRecord[] {
  const want = normalizeDid(groupRootDid);
  if (want.length === 0) return [];
  return dyads.filter((d) => d.binding && normalizeDid(d.binding.signer) === want);
}

/**
 * The fleet a verifier can STAND BEHIND — each candidate re-checked against the group's own membership.
 *
 * `fleetOfGroup` reads what each record CLAIMS, which suffices for a human reading their own store. This
 * checks each claim against the signature carrying it — one Ed25519 verify per dyad, against the group root
 * DID the caller already names. No roster, no replica of a membership graph, no directory, no clock.
 *
 * THE TIERING THIS MAKES POSSIBLE. A foreign peer verifies presented edges and never sees the fleet; only
 * co-members hold the wider graph. The membership-CRDT family cannot offer that split — it buys convergence
 * by replicating the op graph to everyone, handing each member the roster and the device-to-human linkage.
 *
 * Each binding reads through the house's one Ed25519 door, which never throws: a torn edge reads as refusal,
 * so nothing unreadable ever WIDENS a fleet.
 */
export async function verifiedFleetOfGroup(
  dyads: readonly DyadRecord[],
  groupRootDid: LarDid,
  shadowed: ReadonlySet<string> = new Set(),
  /**
   * The hearth the reader stands at: its seed charter's Nexus AID, the scope a dyad binding roots on. A binding that
   * roots on any other scope was gathered at another hearth, and reads unverified here however well it signs.
   */
  scope?: string,
): Promise<DyadRecord[]> {
  // A SHADOWED relationship stands aside before any signature runs. The edge it presents may verify
  // perfectly — a valid edge set aside stays set aside, which is the whole difference between a kāpae and
  // an expiry. Checking here rather than after keeps a raised marker unconditional. The set holds the ids
  // the fleet's edge board reads (`deviceEdgeId`): the fleet root and the device key.
  const want = scope?.trim().toLowerCase();
  const claimed = fleetOfGroup(dyads, groupRootDid)
    .filter((d) => !shadowed.has(deviceEdgeId(groupRootDid, d.ref.deviceDid)))
    .filter((d) => want === undefined || d.binding!.epochCid.trim().toLowerCase() === want);
  const verdicts = await Promise.all(claimed.map((d) =>
    verifyDelegationEdge(DELEGATION_DOMAIN.dyadBinding, dyadBindingSubject(d.ref), d.binding)));
  return claimed.filter((_, i) => verdicts[i] === true);
}

export function fleetSpan(fleet: readonly DyadRecord[]): number {
  return new Set(fleet.map((d) => normalizeDid(d.ref.deviceDid))).size;
}

// ── The fleet LABEL store — what `fleetUnderPetname` reads ────────────────────────────────────────────────
//
// THE NAME SITS ON THE GROUP, NEVER ON THE BINDING. The PersonaGroup's keys decide WHICH dyads belong; this
// store only makes that fleet addressable to the human who holds it ("my work fleet"). Renaming moves a label
// and never a membership — which is the whole reason the two stay apart. Its sibling
// `OwnPersonaPetnameStore` labels a veil on one vessel; this labels a fleet across them.
//
// PRIVATE AND LOCAL, like its sibling. The label carries no authority, never federates, and never crosses a
// wire — it holds the human's own map of themselves, which a captured vessel must not spill.

/** How a runtime persists the human's PRIVATE fleet names — a `{personaGroupId -> petname}` map. */
export interface FleetPetnameStore {
  get(personaGroupId: string): Promise<string | undefined>;
  set(personaGroupId: string, petname: string): Promise<void>;
  clear(personaGroupId: string): Promise<void>;
  /** Every named fleet — `[personaGroupId, petname]` pairs. */
  entries(): Promise<ReadonlyArray<readonly [string, string]>>;
}

/** Name a fleet. A blank label REFUSES rather than silently erasing one; naming never alters membership. */
export async function nameFleet(store: FleetPetnameStore, personaGroupId: string, petname: string): Promise<void> {
  const trimmed = petname.trim();
  if (trimmed.length === 0) {
    throw new Error("nameFleet: a blank label names no fleet — use `unnameFleet` to drop one.");
  }
  await store.set(personaGroupId, trimmed);
}

/** Drop a fleet's private name. The fleet SURVIVES, unnamed — the binding decides membership, not the label. */
export async function unnameFleet(store: FleetPetnameStore, personaGroupId: string): Promise<void> {
  await store.clear(personaGroupId);
}

/**
 * Snapshot the names once, so rendering a set of fleets stays synchronous and side-effect-free rather than a
 * lookup that could fail halfway through and leave half of them nameless.
 */
export async function fleetPetnameResolver(store: FleetPetnameStore): Promise<(personaGroupId: string) => string | undefined> {
  const map = new Map(await store.entries());
  return (id: string) => map.get(id);
}

/**
 * vesselDyads — every relationship a vessel holds: its ceremony-minted dyad slots, de-duplicated by
 * `dyadId` (the content-address of its atom DID — one relationship reached twice stays one record).
 *
 * PLATFORM-BLIND ON PURPOSE: node and browser vessels read their relationships through THIS one door,
 * and every future vessel class (a phone, a Mudlet, an Unreal client) inherits the same observation —
 * the slot is the only source, a bare delegation edge presents no dyad, and a face standing beside
 * zero slots is a drift the boot says aloud (each vessel's own boot does the saying).
 */
export function vesselDyads(doc: LarDoc | undefined | null): DyadRecord[] {
  const seen = new Map<string, DyadRecord>(dyadsFromDoc(doc).map((d) => [d.dyadId, d]));
  return [...seen.values()];
}

// ── The dyad VEIL — derived off the DEVICE tree ─────────────────────────────────────────────────
//
// "The deck stays one deck; the face it wears differs per handle" (persona-circle#the-vault). The
