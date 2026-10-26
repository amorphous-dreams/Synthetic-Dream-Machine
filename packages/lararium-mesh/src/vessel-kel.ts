/**
 * The place KEL commits its next cold key while its current online key signs floor duties.
 * A cold reveal authorizes each rotation. Event identity comes from the canonical core.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJson, canonicalJsonBytes, hex, sha256HexSync } from "./crypto.js";
import { PLACE_NEXT_KEY_DOMAIN, VESSEL_KEL_DOMAIN } from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";

export type PlaceKelEvent = PlaceInception | PlaceRotation;
export interface PlaceInception {
  readonly kind: typeof VESSEL_KEL_DOMAIN; readonly t: "icp"; readonly seq: 0;
  readonly key: string; readonly next: string; readonly sig: string;
}
export interface PlaceRotation {
  readonly kind: typeof VESSEL_KEL_DOMAIN; readonly t: "rot"; readonly aid: string;
  readonly seq: number; readonly prev: string; readonly reveal: string;
  readonly key: string; readonly next: string; readonly sig: string;
}
export type PlaceKelRefusal = "unarmed-inception" | "old-shape-inception" | "bad-signature" | "wrong-reveal" |
  "reused-commitment" | "reused-key" | "gap" | "prev-mismatch" | "aid-mismatch" |
  "seq-mismatch" | "malformed" | "fork" | "rollback" | "too-many-rows";
/** A chain that verified to its head. */
export interface PlaceKelHead {
  readonly ok: true; readonly aid: string; readonly seq: number; readonly head: PlaceKelEvent;
  readonly headDigest: string; readonly signerKey: string; readonly nextDigest: string; readonly chain: readonly PlaceKelEvent[];
}
export type PlaceKelReading =
  | PlaceKelHead
  | { readonly ok: false; readonly refusal: PlaceKelRefusal; readonly forks?: readonly PlaceRotation[];
      readonly commonAncestor?: string; readonly verified?: PlaceKelHead };
const HEX64 = /^[0-9a-f]{64}$/;
const SIG = /^[0-9a-f]{128}$/;
const own = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(",") === names;
const door = (key: string) => HEX64.test(key) && acceptEd25519Key(key).ok;
const digest = (event: PlaceKelEvent) => sha256HexSync(canonicalJson(core(event)));
const core = (event: PlaceKelEvent) => {
  if (event.t === "icp") return { kind: event.kind, t: event.t, seq: event.seq, key: event.key, next: event.next };
  return { kind: event.kind, t: event.t, aid: event.aid, seq: event.seq, prev: event.prev,
    reveal: event.reveal, key: event.key, next: event.next };
};

/** Commit a door-accepted cold verifying key under the place's next-key domain. */
export function placeNextDigest(coldVerifyingKey: string): string {
  if (typeof coldVerifyingKey !== "string" || !door(coldVerifyingKey)) throw new Error("place-kel: cold key refused");
  return sha256HexSync(canonicalJson({ kind: PLACE_NEXT_KEY_DOMAIN, key: coldVerifyingKey }));
}

export function mintPlaceInception(args: { signerSeed: Uint8Array; coldVerifyingKey: string }):
  { event: PlaceInception; bytes: Uint8Array; aid: string; digest: string } {
  if (!(args.signerSeed instanceof Uint8Array) || args.signerSeed.length !== 32) throw new Error("place-kel: signer seed needs 32 bytes");
  const key = hex(ed25519.getPublicKey(args.signerSeed));
  if (!door(key) || key === args.coldVerifyingKey) throw new Error("place-kel: signer key refused");
  const unsigned = { kind: VESSEL_KEL_DOMAIN, t: "icp" as const, seq: 0 as const, key, next: placeNextDigest(args.coldVerifyingKey) };
  const event = { ...unsigned, sig: hex(ed25519.sign(canonicalJsonBytes(unsigned), args.signerSeed)) };
  const aid = digest(event);
  return { event, bytes: canonicalJsonBytes(event), aid, digest: aid };
}

/** Extend a chain that verifies: `chain` runs from the inception to the head the cold key rotates. */
export function mintPlaceRotation(args: { chain: readonly PlaceKelEvent[]; coldSeed: Uint8Array; newSignerKey: string;
  nextColdVerifyingKey: string }): PlaceRotation {
  const prior = args.chain;
  const checked = verifyPlaceKel(prior);
  if (!checked.ok) throw new Error(`place-kel: ${checked.refusal}`);
  if (!(args.coldSeed instanceof Uint8Array) || args.coldSeed.length !== 32) throw new Error("place-kel: cold seed needs 32 bytes");
  const reveal = hex(ed25519.getPublicKey(args.coldSeed));
  if (placeNextDigest(reveal) !== checked.nextDigest) throw new Error("place-kel: wrong-reveal");
  const next = placeNextDigest(args.nextColdVerifyingKey);
  if (prior.some((e) => e.next === next)) throw new Error("place-kel: reused-commitment");
  if (!door(args.newSignerKey) || args.newSignerKey === reveal || args.newSignerKey === args.nextColdVerifyingKey ||
      prior.some((e) => e.key === args.newSignerKey || (e.t === "rot" && e.reveal === args.newSignerKey)) ||
      prior.some((e) => e.key === args.nextColdVerifyingKey || (e.t === "rot" && e.reveal === args.nextColdVerifyingKey)))
    throw new Error("place-kel: reused-key");
  const unsigned = { kind: VESSEL_KEL_DOMAIN, t: "rot" as const, aid: checked.aid, seq: checked.seq + 1,
    prev: checked.headDigest, reveal, key: args.newSignerKey, next };
  const event = { ...unsigned, sig: hex(ed25519.sign(canonicalJsonBytes(unsigned), args.coldSeed)) };
  return event;
}

/** Decode one exact event shape. A wire digest has no place in either shape. */
export function decodePlaceKelEvent(input: Uint8Array | unknown): PlaceKelEvent | null {
  try {
    const value: unknown = input instanceof Uint8Array ? JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input)) : input;
    if (!own(value) || value.kind !== VESSEL_KEL_DOMAIN || typeof value.sig !== "string" || !SIG.test(value.sig)) return null;
    if (value.t === "icp") {
      if (!fields(value, "key,kind,next,seq,sig,t") || value.seq !== 0 || typeof value.key !== "string" || !door(value.key) ||
          typeof value.next !== "string" || !HEX64.test(value.next)) return null;
      return value as unknown as PlaceInception;
    }
    if (value.t === "rot") {
      if (!fields(value, "aid,key,kind,next,prev,reveal,seq,sig,t") || !Number.isSafeInteger(value.seq) || (value.seq as number) < 1 ||
          typeof value.aid !== "string" || !HEX64.test(value.aid) || typeof value.prev !== "string" || !HEX64.test(value.prev) ||
          typeof value.next !== "string" || !HEX64.test(value.next) || typeof value.reveal !== "string" || !door(value.reveal) ||
          typeof value.key !== "string" || !door(value.key)) return null;
      return value as unknown as PlaceRotation;
    }
    return null;
  } catch { return null; }
}
const oldShape = (e: unknown) => own(e) && e.t === "icp" && fields(e, "k,sig,t");
const signatureOk = (e: PlaceKelEvent) => verifyEd25519(e.sig, canonicalJsonBytes(core(e)), e.t === "icp" ? e.key : e.reveal);

export function verifyPlaceKel(chain: readonly PlaceKelEvent[]): PlaceKelReading {
  if (!Array.isArray(chain) || chain.length === 0) return { ok: false, refusal: "gap" };
  if (oldShape(chain[0])) return { ok: false, refusal: "old-shape-inception" };
  if (own(chain[0]) && chain[0].t === "icp" && !Object.hasOwn(chain[0], "next")) return { ok: false, refusal: "unarmed-inception" };
  const first = decodePlaceKelEvent(chain[0]);
  if (!first || first.t !== "icp") return { ok: false, refusal: "malformed" };
  if (!signatureOk(first)) return { ok: false, refusal: "bad-signature" };
  const aid = digest(first);
  const commitments = new Set([first.next]);
  const keys = new Set([first.key]);
  for (let at = 1; at < chain.length; at++) {
    const e = decodePlaceKelEvent(chain[at]);
    if (!e || e.t !== "rot") return { ok: false, refusal: "malformed" };
    const before = chain[at - 1]!;
    if (e.aid !== aid) return { ok: false, refusal: "aid-mismatch" };
    if (e.seq !== at) return { ok: false, refusal: e.seq > at ? "gap" : "seq-mismatch" };
    if (e.prev !== digest(before)) return { ok: false, refusal: "prev-mismatch" };
    if (placeNextDigest(e.reveal) !== before.next) return { ok: false, refusal: "wrong-reveal" };
    if (!signatureOk(e)) return { ok: false, refusal: "bad-signature" };
    if (commitments.has(e.next)) return { ok: false, refusal: "reused-commitment" };
    if (keys.has(e.key) || keys.has(e.reveal) || e.key === e.reveal) return { ok: false, refusal: "reused-key" };
    commitments.add(e.next); keys.add(e.key); keys.add(e.reveal);
  }
  const head = chain[chain.length - 1]!;
  return { ok: true, aid, seq: chain.length - 1, head, headDigest: digest(head), signerKey: head.key, nextDigest: head.next, chain };
}

/** The most rows one AID's fold examines; a board holding more reads `too-many-rows`, and a lawful chain stays below it. */
export const PLACE_KEL_ROWS_PER_AID = 64;
/** The most competing successors a fork reading carries: the ones at the first fork seq, in digest order. */
export const PLACE_KEL_FORK_EVIDENCE = 8;

/** One verified step past `state`, or the refusal that names why the event does not extend it. */
function extendOne(state: { aid: string; seq: number; head: PlaceKelEvent; headDigest: string; commitments: Set<string>; keys: Set<string> },
  e: PlaceRotation): PlaceKelRefusal | null {
  if (e.aid !== state.aid) return "aid-mismatch";
  if (e.seq !== state.seq + 1) return e.seq > state.seq + 1 ? "gap" : "seq-mismatch";
  if (e.prev !== state.headDigest) return "prev-mismatch";
  if (placeNextDigest(e.reveal) !== state.head.next) return "wrong-reveal";
  if (!signatureOk(e)) return "bad-signature";
  if (state.commitments.has(e.next)) return "reused-commitment";
  if (state.keys.has(e.key) || state.keys.has(e.reveal) || e.key === e.reveal) return "reused-key";
  return null;
}

/**
 * Read unordered board rows from the pinned inception, in work bounded by `PLACE_KEL_ROWS_PER_AID`. A row of another AID or a
 * row that does not decode strictly drops before any digest or signature. The signed rows that remain sort by seq and cap at the
 * ceiling, and they index by predecessor, so each step meets only the candidates for the head it stands on; a chain longer
 * than the ceiling reads `too-many-rows`. A fork carries at most `PLACE_KEL_FORK_EVIDENCE` competing successors from its first seq.
 */
export function foldPlaceKel(events: readonly unknown[], pinned: { aid: string; inceptionDigest?: string }): PlaceKelReading {
  const seen = new Map<string, PlaceKelEvent>();
  for (const raw of events) {
    const e = decodePlaceKelEvent(raw);
    if (!e) continue;
    if (e.t === "rot" && e.aid !== pinned.aid) continue;
    seen.set(canonicalJson(e), e);
  }
  let first: PlaceInception | null = null;
  const byPrev = new Map<string, PlaceRotation[]>();
  const rotations: PlaceRotation[] = [];
  // SIGNATURES FIRST, in work linear in the input: a row that fails its own signature drops here, before any digest walk, and
  // the signed rows that remain sort by seq and cap at the ceiling, so the walk below never meets more than the ceiling.
  for (const e of seen.values()) {
    if (e.t === "icp") { if (first === null && digest(e) === pinned.aid && signatureOk(e)) first = e; continue; }
    if (signatureOk(e)) rotations.push(e);
  }
  rotations.sort((x, y) => x.seq - y.seq || (x.sig < y.sig ? -1 : x.sig > y.sig ? 1 : 0));
  rotations.length = Math.min(rotations.length, PLACE_KEL_ROWS_PER_AID + 1);
  for (const e of rotations) {
    const list = byPrev.get(e.prev) ?? [];
    list.push(e); byPrev.set(e.prev, list);
  }
  if (!first) return { ok: false, refusal: "gap" };
  if (pinned.inceptionDigest && pinned.inceptionDigest !== digest(first)) return { ok: false, refusal: "aid-mismatch" };
  const chain: PlaceKelEvent[] = [first];
  const state = { aid: pinned.aid, seq: 0, head: first as PlaceKelEvent, headDigest: pinned.aid, commitments: new Set([first.next]), keys: new Set([first.key]) };
  for (;;) {
    if (state.seq >= PLACE_KEL_ROWS_PER_AID) return { ok: false, refusal: "too-many-rows" };
    const candidates = byPrev.get(state.headDigest) ?? [];
    const valid = candidates.filter((e) => extendOne(state, e) === null);
    if (valid.length > 1) {
      const forks = valid.sort((x, y) => (digest(x) < digest(y) ? -1 : 1)).slice(0, PLACE_KEL_FORK_EVIDENCE);
      return { ok: false, refusal: "fork", forks, commonAncestor: state.headDigest };
    }
    if (valid.length === 0) break;
    const e = valid[0]!;
    chain.push(e); state.commitments.add(e.next); state.keys.add(e.key); state.keys.add(e.reveal);
    state.seq = e.seq; state.head = e; state.headDigest = digest(e);
  }
  const read: PlaceKelHead = { ok: true, aid: pinned.aid, seq: state.seq, head: state.head, headDigest: state.headDigest,
    signerKey: state.head.key, nextDigest: state.head.next, chain };
  // A signed row past the verified head with no link to it leaves the verified prefix standing: the refusal names the gap and
  // hands back what verified, so a reader keeps its head "as of my last sync".
  const beyond = rotations.some((e) => e.seq > state.seq);
  return beyond ? { ok: false, refusal: "gap", verified: read } : read;
}

export function acceptPlaceHead(previouslyAccepted: { aid: string; seq: number; headDigest: string } | null,
  folded: PlaceKelReading): PlaceKelReading {
  if (!folded.ok) return folded;
  if (!previouslyAccepted) return folded;
  if (folded.aid !== previouslyAccepted.aid || folded.seq < previouslyAccepted.seq ||
      !folded.chain[previouslyAccepted.seq] || digest(folded.chain[previouslyAccepted.seq]!) !== previouslyAccepted.headDigest)
    return { ok: false, refusal: "rollback" };
  return folded;
}
export function placeSignerKeyAt(head: PlaceKelEvent | PlaceKelReading): string {
  if ("ok" in head) { if (!head.ok) throw new Error(`place-kel: ${head.refusal}`); return head.signerKey; }
  const event = decodePlaceKelEvent(head);
  if (!event) throw new Error("place-kel: malformed");
  return event.key;
}

/** The digest an event answers to: the stable AID for an inception, the predecessor link for a rotation. */
export const placeKelEventDigest = digest;
