/**
 * face-grant-record — THE LATER GRANT as a RECORD on the PersonaGroup plane (basket-one #/the-later-grant, ruled
 * 2026-09-11): "the later grant lands as a record on the PersonaGroup doc and the joinee's own kit takes the seat
 * against the published seal, reading never re-cuts."
 *
 * THE SHAPE. The founder's `face-join` verb seats a joinee in the group and, instead of handing the grant back to
 * its caller alone, WRITES it as a record the joinee already syncs (the PersonaGroup plane crosses by membership).
 * The record carries the grant (`face-join-grant/v1` — the joinee's agent id, the founder's card, the cap events,
 * the re-seals), the founder's OWN device edge (root-signed, so a joinee that pinned the root at admit can verify
 * it offline), and a signature under the founder's device key over the canonical bytes of everything else.
 *
 * THE PUBLISHED SEAL. The joinee verifies three things, all offline: the founder's edge verifies under the persona
 * root the joinee pinned at admit (the seal), the signature verifies under the key that edge licenses, and the
 * record names THIS joinee and THIS group. Only then does the joinee's kit act — ingesting the cap events by its
 * own hand (`takeFaceGrant`). A record that fails any check changes NO binding and logs a refusal: a board that
 * merely NAMES a grant, and a kit that decides, is membership doctrine kept — a board that acted when read would
 * be a written command channel.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seal-and-seat-handoff#/plan-face-join
 */

import {
  canonicalJsonBytes, utf8Bytes, ed25519VerifyHex, verifyDeviceDelegation, verifyEdgeAgainstPersonaKel,
  type DeviceDelegationTiddler, type PersonaKelEvent,
} from "@lararium/mesh";

/** The signing domain — a grant record's bytes never verify as any other signed thing. */
const FACE_GRANT_DOMAIN = "lares/face-join-grant/v1";
/** The title prefix under which grant records land on the PersonaGroup plane. */
export const FACE_GRANT_PREFIX = "$:/lares/face-grant/";

/** The record as it lands on the plane — the grant plus the seal's two halves (edge + signature). */
export interface FaceGrantRecord {
  readonly kind: "face-join-grant/v1";
  /** The PersonaGroup sentinel this seat lands in. */
  readonly groupDocIdHex: string;
  /** The joinee's agent id (its card-derived identifier — ends in its vessel verifying key). */
  readonly joineeAgentIdHex: string;
  readonly founderCard: string;
  readonly capEvents: readonly string[];
  readonly reKeyed: boolean;
  readonly regranted: number;
  readonly reSealed: readonly { bagUrl: string; contentRefB64: string; ciphertextB64: string }[];
  /** The founder's OWN device-delegation edge — root-signed; the joinee verifies it under the root it pinned. */
  readonly founderEdge: DeviceDelegationTiddler;
  /** ISO-8601, caller-supplied (no ambient clock). */
  readonly issuedAt: string;
  /** Hex Ed25519 signature under `founderEdge.deviceVerifyingKey` over `signedBytes(record)`. */
  readonly sig: string;
}

export type UnsignedFaceGrantRecord = Omit<FaceGrantRecord, "sig">;

/** The record's title on the plane — one per (group, joinee); a re-join overwrites its own. */
export function faceGrantTitle(groupDocIdHex: string, joineeAgentIdHex: string): string {
  return `${FACE_GRANT_PREFIX}${groupDocIdHex}/${joineeAgentIdHex.replace(/^0x/i, "").toLowerCase()}`;
}

/** The bytes the signature covers: the domain, then the canonical JSON of the record without its `sig`. */
function signedBytes(rec: UnsignedFaceGrantRecord): Uint8Array {
  const { sig: _drop, ...body } = rec as FaceGrantRecord;
  void _drop;
  const domain = utf8Bytes(FACE_GRANT_DOMAIN);
  const json = canonicalJsonBytes(body);
  const out = new Uint8Array(domain.length + 1 + json.length);
  out.set(domain, 0); out[domain.length] = 0; out.set(json, domain.length + 1);
  return out;
}

/** Sign a grant record under the founder's device key (`sign` = `ed25519SignerFromSeed(vesselSeed)`). */
export async function signFaceGrantRecord(
  rec: UnsignedFaceGrantRecord,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<FaceGrantRecord> {
  return { ...rec, sig: await sign(signedBytes(rec)) };
}

/** What the joinee verifies against — everything it holds already, nothing from the wire. */
export interface FaceGrantVerifyContext {
  /** The persona root the joinee pinned at admit — the published seal. */
  readonly personaRootDid: string;
  /**
   * The founder's persona-KEL, when the joinee holds it. Present, the founder's edge verifies against the
   * CURRENT head op-key (the seated key after a rotation) — the same walk the Binding Gate makes — and the
   * chain must incept at the pinned root, so the seal binds the chain. Absent, the edge verifies under the
   * pinned root alone.
   */
  readonly personaKel?: { readonly prefix: string; readonly chain: readonly PersonaKelEvent[] };
  /** This vessel's own raw verifying-key hex — the record must name it. */
  readonly selfVerifyingKey: string;
  /** The group this vessel's face belongs to — the record must name it. */
  readonly groupDocIdHex: string;
  readonly now: number;
}

export type FaceGrantVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Verify a grant record OFFLINE. Order: shape → ours (joinee + group) → the founder's edge under the persona-KEL
 * HEAD (or the pinned root when no chain rides) → the signature under the key that edge licenses. A record that
 * fails reads a reason and re-cuts nothing. A grant a rotated-away op-key signed refuses under the head.
 */
export async function verifyFaceGrantRecord(rec: unknown, ctx: FaceGrantVerifyContext): Promise<FaceGrantVerdict> {
  const r = rec as Partial<FaceGrantRecord> | null;
  if (!r || r.kind !== "face-join-grant/v1" || typeof r.sig !== "string" || !r.founderEdge || !Array.isArray(r.capEvents)) {
    return { ok: false, reason: "not a face-join-grant/v1 record" };
  }
  if (typeof r.groupDocIdHex !== "string" || r.groupDocIdHex.toLowerCase() !== ctx.groupDocIdHex.toLowerCase()) {
    return { ok: false, reason: "the record names another group" };
  }
  if (typeof r.joineeAgentIdHex !== "string" || !r.joineeAgentIdHex.toLowerCase().endsWith(ctx.selfVerifyingKey.toLowerCase())) {
    return { ok: false, reason: "the record names another joinee" };
  }
  if (ctx.personaKel) {
    const { prefix, chain } = ctx.personaKel;
    const genesis = chain[0];
    if (!genesis || genesis.prefix !== prefix) {
      return { ok: false, reason: "the persona-KEL in scope names a prefix other than the pinned one" };
    }
    if (genesis.opKeyDid.toLowerCase() !== ctx.personaRootDid.toLowerCase()) {
      return { ok: false, reason: "the persona-KEL incepts under a root other than the pinned one — the seal binds the chain" };
    }
    const walked = await verifyEdgeAgainstPersonaKel(r.founderEdge, chain, { now: ctx.now });
    if (!walked.ok) return { ok: false, reason: `founder edge refused under the persona-KEL head: ${walked.reason ?? "signature or window"}` };
  } else {
    const edge = await verifyDeviceDelegation(r.founderEdge, ctx.personaRootDid, { now: ctx.now });
    if (!edge.ok) return { ok: false, reason: `founder edge refused under the pinned root: ${edge.reason ?? "signature or window"}` };
  }
  const founderKey = r.founderEdge.deviceVerifyingKey;
  if (founderKey.toLowerCase() === ctx.selfVerifyingKey.toLowerCase()) {
    return { ok: false, reason: "the record's founder is this vessel — a hearth never seats itself" };
  }
  const sigOk = await ed25519VerifyHex(r.sig, signedBytes(r as FaceGrantRecord), founderKey);
  if (!sigOk) return { ok: false, reason: "the record's signature fails under the founder's licensed key" };
  return { ok: true };
}
