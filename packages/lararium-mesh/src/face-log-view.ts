/**
 * face-log-view — A PARTY'S OWN VIEW of one face's key history: the head it holds, signed by its own key.
 *
 * A restored face stands PROVISIONAL (stable-founding-road#/rulings, "The restore's key history"): no vessel reads a
 * head it never received, so the face waits until one party to its relation shows the head it holds itself and that
 * head agrees with the one the restore read. The party signs one image: the face's fixed prefix, the head's sequence
 * and event id, the kind of party it speaks as, and its own public key. The image names no vessel and no session.
 *
 * A view proves only what its signer holds; WHO the signer stands as for the face (a guardian in the face's set, a
 * chair seated in a charter the face stands in, a sibling device of the same human) the confirming vessel judges
 * against its own rows. The residue stays stated: one agreeing party may itself sit stale, so agreement counts as
 * evidence that no fork shows to that party, never as proof that no unseen head stands.
 *
 * Pure: no I/O, no clock.
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import * as ed from "@noble/ed25519";
import { base64UrlDecode, base64UrlEncode, canonicalJsonBytes, hex } from "./crypto.js";
import { FACE_LOG_VIEW_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";

/** The kinds of party whose own view confirms a restored face. */
export const FACE_LOG_VIEW_PARTIES = ["guardian", "chair", "sibling"] as const;
export type FaceLogViewParty = (typeof FACE_LOG_VIEW_PARTIES)[number];

/** One party's signed view of one face's head. */
export interface FaceLogView {
  readonly prefix:   string;
  readonly seq:      number;
  readonly eventCid: string;
  readonly party:    FaceLogViewParty;
  /** The party's own public key, lower hex. */
  readonly key:      string;
  /** The party's signature over `faceLogViewImage`, lower hex. */
  readonly sig:      string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const LINE_PREFIX = "lar-log-view:";
/** The longest prefix or event id a view carries, in characters. */
const NAME_LIMIT = 256;

/** The exact bytes a party signs for its view of a face's head. */
export function faceLogViewImage(view: Omit<FaceLogView, "sig">): Uint8Array {
  return canonicalJsonBytes({ domain: FACE_LOG_VIEW_DOMAIN, prefix: view.prefix, seq: view.seq, eventCid: view.eventCid, party: view.party, key: view.key });
}

/** Sign a view as the party whose 32-byte seed `seed` holds. The caller owns the seed. */
export async function signFaceLogView(input: { readonly prefix: string; readonly seq: number; readonly eventCid: string; readonly party: FaceLogViewParty; readonly seed: Uint8Array }): Promise<FaceLogView> {
  const key = hex(await ed.getPublicKeyAsync(input.seed));
  const unsigned = { prefix: input.prefix, seq: input.seq, eventCid: input.eventCid, party: input.party, key };
  return { ...unsigned, sig: hex(await ed.signAsync(faceLogViewImage(unsigned), input.seed)) };
}

/** A view's SHAPE, or null where the value reads as none. Reads no signature. */
export function readFaceLogView(value: unknown): FaceLogView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ["prefix", "seq", "eventCid", "party", "key", "sig"];
  if (Object.keys(v).length !== keys.length || !keys.every((k) => k in v)) return null;
  if (typeof v["prefix"] !== "string" || v["prefix"].length === 0 || v["prefix"].length > NAME_LIMIT) return null;
  if (!Number.isSafeInteger(v["seq"]) || (v["seq"] as number) < 0) return null;
  if (typeof v["eventCid"] !== "string" || v["eventCid"].length === 0 || v["eventCid"].length > NAME_LIMIT) return null;
  if (typeof v["party"] !== "string" || !(FACE_LOG_VIEW_PARTIES as readonly string[]).includes(v["party"])) return null;
  if (typeof v["key"] !== "string" || !HEX64.test(v["key"]) || typeof v["sig"] !== "string" || !HEX128.test(v["sig"])) return null;
  return { prefix: v["prefix"], seq: v["seq"] as number, eventCid: v["eventCid"], party: v["party"] as FaceLogViewParty, key: v["key"], sig: v["sig"] };
}

/** Whether the view's signature verifies under the key it names. */
export function faceLogViewSigned(view: FaceLogView): boolean {
  try { return verifyEd25519(view.sig, faceLogViewImage(view), view.key); } catch { return false; }
}

/** One line a party hands across: `lar-log-view:` and the view's canonical JSON in base64url. */
export function faceLogViewLine(view: FaceLogView): string {
  return LINE_PREFIX + base64UrlEncode(canonicalJsonBytes(view));
}

/** Read one line back, or null where it reads as no view. */
export function readFaceLogViewLine(line: string): FaceLogView | null {
  const t = line.trim();
  if (!t.startsWith(LINE_PREFIX)) return null;
  try { return readFaceLogView(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(t.slice(LINE_PREFIX.length))))); }
  catch { return null; }
}
