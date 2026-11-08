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
 * THE PUBLISHED SEAL. The joinee verifies four things, all offline: the founder's edge chains to the persona
 * lineage the joinee pinned at admit (the seal), the founder's device-face dyad stands in this vessel's remove-wins
 * reading, the signature verifies under the key that edge licenses, and the record names THIS joinee and THIS group. Only then does the joinee's kit act — ingesting the cap events by its
 * own hand (`takeFaceGrant`). A record that fails any check changes NO binding and logs a refusal: a board that
 * merely NAMES a grant, and a kit that decides, is membership doctrine kept — a board that acted when read would
 * be a written command channel.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/personal-slot
 */

import {
  canonicalJsonBytes, utf8Bytes, ed25519VerifyHex, sha256HexBytesSync, formatDigest, verifyEdgeAgainstPersonaKel, FACE_GRANT_DOMAIN,
  type DeviceDelegationTiddler, type PersonaKelEvent, type EdgeStanding,
} from "@lararium/mesh";
import { standingOfReading } from "./face-seat-summons.js";

/** The title prefix under which grant records land on the PersonaGroup plane. */
export const FACE_GRANT_PREFIX = "$:/lares/face-grant/";

/**
 * The record as it lands on the plane — the grant plus the seal's two halves (edge + signature). It carries no
 * wall-clock stamp: the plane's causal history orders it, and a re-join overwrites it at its own title.
 */
export interface FaceGrantRecord {
  readonly kind: "face-join-grant/v1";
  /** The PersonaGroup (a Keyhive group's id) this seat lands in. */
  readonly groupId: string;
  /** The joinee's agent id (its card-derived identifier — ends in its vessel verifying key). */
  readonly joineeAgentIdHex: string;
  readonly founderCard: string;
  readonly capEvents: readonly string[];
  readonly reKeyed: boolean;
  /** The grant's order at its title: one more than the serial standing there when the issue was made. A fresh issue
   *  supersedes the standing grant; a replay of an older issue never rolls a later one back. */
  readonly serial: number;
  readonly reSealed: readonly { bagUrl: string; contentRefB64: string; ciphertextB64: string }[];
  /** The founder's OWN device-delegation edge — root-signed; the joinee verifies it under the root it pinned. */
  readonly founderEdge: DeviceDelegationTiddler;
  /** Hex Ed25519 signature under `founderEdge.deviceVerifyingKey` over `signedBytes(record)`. */
  readonly sig: string;
}

export type UnsignedFaceGrantRecord = Omit<FaceGrantRecord, "sig">;

/** The record's title on the plane — one per (group, joinee); a re-join overwrites its own. */
export function faceGrantTitle(groupId: string, joineeAgentIdHex: string): string {
  return `${FACE_GRANT_PREFIX}${groupId}/${joineeAgentIdHex.replace(/^0x/i, "").toLowerCase()}`;
}

/**
 * The record's content address: sha256 over the canonical JSON of the WHOLE record (signature included), in the
 * house's tagged form `sha256:<hex>`. The join outcome names the record by it, so a reader that reads the record
 * off the plane recomputes it and holds the two equal; any byte that moves moves the CID.
 */
export function faceGrantRecordCid(rec: FaceGrantRecord): string {
  return formatDigest("sha256", sha256HexBytesSync(canonicalJsonBytes(rec)));
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

/** Sign a grant record under the founder's face atom. */
export async function signFaceGrantRecord(
  rec: UnsignedFaceGrantRecord,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<FaceGrantRecord> {
  return { ...rec, sig: await sign(signedBytes(rec)) };
}

/** The founder's persona lineage, pinned by the face's anchor: the chain must incept at the pinned root under its prefix. */
export interface FounderLineage { readonly prefix: string; readonly chain: readonly PersonaKelEvent[] }

/** What the joinee verifies against — everything it holds already, nothing from the wire. */
export interface FaceGrantVerifyContext {
  /** The persona root the joinee pinned at admit — the published seal. */
  readonly personaRootDid: string;
  /**
   * The founder's persona-KEL as this vessel holds it. The founder's edge verifies against the CURRENT head op-key
   * (the seated key after a rotation), and the chain must incept at the pinned root under its prefix. Absent, the
   * grant refuses by name: a root signature alone carries no standing.
   */
  readonly personaKel?: FounderLineage;
  /**
   * This vessel's remove-wins reading of the FOUNDER's device-face dyad (kapae#/reach), never the joinee's. Absent or
   * `unknown`, the grant refuses by name and stays pending; `aside` refuses as a final judgment.
   */
  readonly dyad?: (deviceVerifyingKey: string) => EdgeStanding;
  /** This vessel's own raw verifying-key hex — the record must name it. */
  readonly selfVerifyingKey: string;
  /** The group this vessel's face belongs to — the record must name it. */
  readonly groupId: string;
}

/** A grant record's verdict. `unreadable` names persona-KEL events the walk set aside — they move nothing, and the
 *  verdict says so on either side. `pending` marks a refusal for proof this vessel does not yet hold: it judges
 *  nothing final, and a later arrival of that proof may take the record. */
export type FaceGrantVerdict = { ok: true; unreadable?: string } | { ok: false; reason: string; unreadable?: string; pending?: true };

export type FounderAuthorityVerdict = { ok: true; unreadable?: string } | { ok: false; reason: string; unreadable?: string; pending?: true };

/**
 * THE FOUNDER STANDS, OR NOTHING GRANTS (stable-founding-road#/rulings, the face lease's end state). The founder's
 * authority reads off two proofs this vessel holds and nothing else: its edge chains to the anchor-pinned persona
 * lineage (inception at the pinned root, the edge under the verified head, no fork), and its device-face dyad reads a
 * standing the house's readers name lawful (`standingOfReading`: clear, owing or returned). Absent, unknown and forked
 * proof refuse by name; a set-aside founder refuses outright. No lease epoch rides this decision.
 */
export async function verifyFounderAuthority(
  founderEdge: DeviceDelegationTiddler,
  proof: { readonly personaRootDid: string; readonly personaKel?: FounderLineage | undefined; readonly dyad?: ((deviceVerifyingKey: string) => EdgeStanding) | undefined },
): Promise<FounderAuthorityVerdict> {
  if (!proof.personaKel) return { ok: false, reason: "founder persona-KEL proof unavailable", pending: true };
  if (typeof founderEdge?.deviceVerifyingKey !== "string") return { ok: false, reason: "founder edge names no device verifying key" };
  const { prefix, chain } = proof.personaKel;
  const genesis = chain[0];
  if (!genesis || genesis.prefix !== prefix || chain.some((e) => e.prefix !== prefix)) {
    return { ok: false, reason: "the persona-KEL in scope names a prefix other than the pinned one" };
  }
  if (genesis.opKeyDid.toLowerCase() !== proof.personaRootDid.toLowerCase()) {
    return { ok: false, reason: "the persona-KEL incepts under a root other than the pinned one — the seal binds the chain" };
  }
  const walked = await verifyEdgeAgainstPersonaKel(founderEdge, chain);
  const said = walked.unreadable ? { unreadable: walked.unreadable } : {};
  if (walked.fork) return { ok: false, reason: `founder lineage forked: ${walked.fork}`, ...said };
  if (!walked.ok) return { ok: false, reason: `founder edge refused under the persona-KEL head: ${walked.reason ?? "signature"}`, ...said };
  if (!proof.dyad) return { ok: false, reason: "founder dyad standing proof unavailable", pending: true, ...said };
  const standing = standingOfReading(proof.dyad(founderEdge.deviceVerifyingKey));
  if (standing === "aside") return { ok: false, reason: "founder device set aside", ...said };
  if (standing === "unknown") return { ok: false, reason: "founder dyad standing unknown: no qualifying signed edge frontier", pending: true, ...said };
  return { ok: true, ...said };
}

/**
 * Verify a grant record OFFLINE. Order: shape → ours (joinee + group) → the founder's authority (its edge under the
 * anchor-pinned persona-KEL head, then dyad standing) → the signature under the key that edge licenses. A record that
 * fails reads a reason and re-cuts nothing. A grant a rotated-away op-key signed refuses under the head.
 */
export async function verifyFaceGrantRecord(rec: unknown, ctx: FaceGrantVerifyContext): Promise<FaceGrantVerdict> {
  const r = rec as Partial<FaceGrantRecord> | null;
  if (!r || r.kind !== "face-join-grant/v1" || typeof r.sig !== "string" || !r.founderEdge || !Array.isArray(r.capEvents) || !Number.isSafeInteger(r.serial) || (r.serial as number) < 1) {
    return { ok: false, reason: "not a face-join-grant/v1 record" };
  }
  if (typeof r.groupId !== "string" || r.groupId.toLowerCase() !== ctx.groupId.toLowerCase()) {
    return { ok: false, reason: "the record names another group" };
  }
  if (typeof r.joineeAgentIdHex !== "string" || !r.joineeAgentIdHex.toLowerCase().endsWith(ctx.selfVerifyingKey.toLowerCase())) {
    return { ok: false, reason: "the record names another joinee" };
  }
  const authority = await verifyFounderAuthority(r.founderEdge, ctx);
  if (!authority.ok) return authority;
  const said = (): { unreadable?: string } => (authority.unreadable ? { unreadable: authority.unreadable } : {});
  const founderKey = r.founderEdge.deviceVerifyingKey;
  if (founderKey.toLowerCase() === ctx.selfVerifyingKey.toLowerCase()) {
    return { ok: false, reason: "the record's founder is this vessel — a hearth never seats itself", ...said() };
  }
  const sigOk = await ed25519VerifyHex(r.sig, signedBytes(r as FaceGrantRecord), founderKey);
  if (!sigOk) return { ok: false, reason: "the record's signature fails under the founder's licensed key", ...said() };
  return { ok: true, ...said() };
}
