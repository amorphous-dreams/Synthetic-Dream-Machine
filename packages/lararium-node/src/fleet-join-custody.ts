/**
 * fleet-join-custody — THE FLEET-JOIN DOOR'S THREE ROWS on a node vessel.
 *
 *   face-address-secret  HOT. One face's address secret: 32 random bytes minted ONCE per face on the
 *                        root-holding vessel, sealed on each of that face's vessels, and carried to a joining
 *                        vessel by the fleet-join door alone. Its file names a digest of the face's PersonaGroup,
 *                        so the root holder and every joined vessel spell one row alike, and a listing names no
 *                        face. Neither a per-Nexus key's re-issue nor a vessel key touches it; only a deliberate
 *                        rotation act moves it (stable-founding-road#/rulings, the working address).
 *   fleet-join-pending   HOT. The joining vessel's half-done join: the request it sent and the X25519 secret the
 *                        answer seals to. One join stands pending at a time; the landing removes it.
 *   face-join-record     HOT. What a joined vessel keeps of its answer, one row per face: the PersonaGroup, its
 *                        root key, the certificates over this vessel's face-scoped keys and the root's grants. A
 *                        session's face reads them (`session-face`); the grants form the face's private record.
 *                        On the ROOT HOLDER the same row also keeps THE ISSUED BOOK (`issued`): for each
 *                        certificate a fleet-join answer issued, the scope, the certified face-scoped key and the
 *                        device it was issued to. The device comes off the answer the root signed, never off the
 *                        certificate (whose fields name no device): the request's `vesselKey`, which the answer
 *                        binds beside its certificates and which the device edge names as its delegate. A gate
 *                        maps a presenting face-scoped key to its device through it (D4, `face-device-book`).
 *
 * ── A STORE NEVER LANDS OVER ANOTHER SECRET ─────────────────────────────────────────────────────
 * Each write reads, decides and writes under one custody holder: nothing standing takes the bytes, the same bytes
 * again change nothing, and other standing bytes refuse with their bytes untouched. At the floor every door refuses
 * `CustodyLocked`.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { sha256HexBytesSync } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** A face's address secret's file, for the carrier table: `face-address-secret-<32 hex>.bin`. */
export const FACE_ADDRESS_SECRET_FILE = /^face-address-secret-([0-9a-f]{32})\.bin$/;
/** The joining vessel's pending join, for the carrier table. */
export const FLEET_JOIN_PENDING_FILE = "fleet-join-pending.json";
/** A joined face's record, for the carrier table: `face-join-record-<32 hex>.json`. */
export const FACE_JOIN_RECORD_FILE = /^face-join-record-([0-9a-f]{32})\.json$/;

const utf8 = new TextEncoder();
const PERSONA_GROUP = /^(?:0x)?(?:[0-9a-f]{2}){4,64}$/;
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

function faceRowName(row: string, personaGroup: string): string {
  if (!PERSONA_GROUP.test(personaGroup)) throw new RangeError("fleet-join-custody: a PersonaGroup id reads as lower-case hex");
  return sha256HexBytesSync(utf8.encode(`${row}\n${personaGroup}`)).slice(0, 32);
}

/** The row a face's address secret rests in, named by a digest of its PersonaGroup. */
export function faceAddressSecretFile(personaGroup: string): string {
  return `face-address-secret-${faceRowName("face-address-secret", personaGroup)}.bin`;
}

/** The row a joined face's record rests in, named by a digest of its PersonaGroup. */
export function faceJoinRecordFile(personaGroup: string): string {
  return `face-join-record-${faceRowName("face-join-record", personaGroup)}.json`;
}

/** The face's address secret this vessel holds (32 bytes, the caller's to zero-fill), or null. A read never mints. */
export async function readFaceAddressSecret(personaGroup: string): Promise<Uint8Array | null> {
  const file = faceAddressSecretFile(personaGroup);
  const bytes = await readCustodyRow("identity", file);
  if (bytes === null) return null;
  if (bytes.length !== 32) { bytes.fill(0); throw new CustodyRowUnavailable("identity", file, "malformed"); }
  return bytes;
}

/** The face's address secret, minted at random where none stands, under one custody holder. The root holder's act
 *  alone mints one: a joined vessel lands the bytes its answer carried (`landFaceAddressSecret`). */
export async function mintFaceAddressSecret(personaGroup: string): Promise<Uint8Array> {
  const file = faceAddressSecretFile(personaGroup);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  return updateCustodyRow("identity", file, (bytes) => {
    if (bytes !== null) {
      if (bytes.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
      return { plaintext: null, value: Uint8Array.from(bytes) };
    }
    const fresh = new Uint8Array(randomBytes(32));
    return { plaintext: Uint8Array.from(fresh), value: fresh };
  });
}

/** Land the address secret a fleet-join answer carried. The same bytes again change nothing; others refuse. */
export async function landFaceAddressSecret(personaGroup: string, secret: Uint8Array): Promise<void> {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new RangeError("fleet-join-custody: an address secret holds exactly 32 bytes");
  const file = faceAddressSecretFile(personaGroup);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: Uint8Array.from(secret), value: undefined };
    if (!sameBytes(bytes, secret)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** What a joining vessel keeps between its request and the answer. */
export interface PendingFleetJoin {
  /** The request as sent: the answer binds to its nonce, its vessel key and its seal key. */
  readonly request:    unknown;
  /** The offer it answered, so the landing names the face it joins. */
  readonly offer:      unknown;
  /** The X25519 secret the answer seals the address secret to, 64 hex. */
  readonly sealSecret: string;
}

/** Keep a pending join. A different join already pending refuses: one join at a time. */
export async function keepPendingFleetJoin(pending: PendingFleetJoin): Promise<void> {
  const bytes = utf8.encode(JSON.stringify(pending));
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", FLEET_JOIN_PENDING_FILE, (standing) => {
    if (standing === null) return { plaintext: bytes, value: undefined };
    if (!sameBytes(standing, bytes)) throw new CustodyRowUnavailable("identity", FLEET_JOIN_PENDING_FILE, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** The pending join this vessel keeps, or null. */
export async function readPendingFleetJoin(): Promise<PendingFleetJoin | null> {
  const bytes = await readCustodyRow("identity", FLEET_JOIN_PENDING_FILE);
  if (bytes === null) return null;
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof v !== "object" || v === null) throw new Error("malformed");
    const r = v as Record<string, unknown>;
    if (typeof r["sealSecret"] !== "string" || !/^[0-9a-f]{64}$/.test(r["sealSecret"])) throw new Error("malformed");
    return { request: r["request"], offer: r["offer"], sealSecret: r["sealSecret"] };
  } catch { throw new CustodyRowUnavailable("identity", FLEET_JOIN_PENDING_FILE, "malformed"); }
  finally { bytes.fill(0); }
}

/** Remove the pending join whose request carries `nonce`; answers whether one stood. Another pending join stays. */
export async function clearPendingFleetJoin(nonce: string): Promise<boolean> {
  return removeCustodyRow("identity", FLEET_JOIN_PENDING_FILE, (bytes) => {
    try {
      const r = JSON.parse(new TextDecoder().decode(bytes)) as { request?: { nonce?: unknown } };
      return r.request?.nonce === nonce;
    } catch { return false; }
  });
}

/** One certificate the root holder issued: the scope, the certified face-scoped key, and the device it went to. */
export interface IssuedFaceKey {
  readonly nexus:         string;
  readonly faceKey:       string;
  readonly vesselFaceKey: string;
  /** The joined vessel's own verifying key, as the signed answer named it. */
  readonly device:        string;
}

/** What a joined vessel keeps of one face's answer. Public keys and signatures alone: no secret rides it. */
export interface FaceJoinRecord {
  readonly personaGroup: string;
  readonly rootKey:      string;
  readonly certificates: readonly unknown[];
  readonly grants:       readonly unknown[];
  /** The root holder's issued book; empty on a vessel that issued nothing. A write that omits it keeps it. */
  readonly issued?:      readonly IssuedFaceKey[];
}

const HEX64 = /^[0-9a-f]{64}$/;
function readIssued(v: unknown): IssuedFaceKey[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error("malformed");
  return v.map((e: unknown) => {
    const r = e as Record<string, unknown> | null;
    if (r === null || typeof r !== "object") throw new Error("malformed");
    const { nexus, faceKey, vesselFaceKey, device } = r;
    if (typeof nexus !== "string" || nexus.length === 0 || typeof faceKey !== "string" || typeof vesselFaceKey !== "string" || typeof device !== "string") throw new Error("malformed");
    if (!HEX64.test(faceKey) || !HEX64.test(vesselFaceKey) || !HEX64.test(device)) throw new Error("malformed");
    return { nexus, faceKey, vesselFaceKey, device };
  });
}

function recordBytes(record: FaceJoinRecord, issued: readonly IssuedFaceKey[]): Uint8Array {
  return utf8.encode(JSON.stringify({
    personaGroup: record.personaGroup, rootKey: record.rootKey, certificates: record.certificates, grants: record.grants,
    ...(issued.length > 0 ? { issued } : {}),
  }));
}

/** Keep a joined face's record. The same record again changes nothing; a later join of the same face replaces it,
 *  since each landing verified its answer whole. The issued book stands unless the write names its own. */
export async function keepFaceJoinRecord(record: FaceJoinRecord): Promise<void> {
  const file = faceJoinRecordFile(record.personaGroup);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", file, (standing) => {
    let issued: readonly IssuedFaceKey[] = record.issued ?? [];
    if (standing !== null) {
      let root: unknown, kept: unknown;
      try { ({ rootKey: root, issued: kept } = JSON.parse(new TextDecoder().decode(standing)) as { rootKey?: unknown; issued?: unknown }); } catch { root = undefined; }
      if (root !== record.rootKey) throw new CustodyRowUnavailable("identity", file, "names-another-key");
      if (record.issued === undefined) {
        try { issued = readIssued(kept); } catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
      }
      const bytes = recordBytes(record, issued);
      if (sameBytes(standing, bytes)) return { plaintext: null, value: undefined };
      return { plaintext: bytes, value: undefined };
    }
    return { plaintext: recordBytes(record, issued), value: undefined };
  });
}

/**
 * THE ROOT HOLDER notes the certificates one answer issued to `device`, before the answer leaves. A row that stands
 * keeps its certificates and grants; a face with no row yet stands one with none. An entry for the same scope and
 * face-scoped key is replaced, so a re-answered request notes once. A row under another root key refuses.
 */
export async function noteIssuedFaceKeys(args: {
  readonly personaGroup: string;
  readonly rootKey:      string;
  readonly device:       string;
  readonly certificates: ReadonlyArray<{ readonly scope: { readonly faceKey: string; readonly nexus: string }; readonly vesselFaceKey: string }>;
}): Promise<void> {
  const device = args.device.toLowerCase();
  const fresh: IssuedFaceKey[] = args.certificates.map((c) => ({
    nexus: c.scope.nexus, faceKey: c.scope.faceKey.toLowerCase(), vesselFaceKey: c.vesselFaceKey.toLowerCase(), device,
  }));
  readIssued(fresh);                                         // a malformed entry never lands
  const file = faceJoinRecordFile(args.personaGroup);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", file, (standing) => {
    let base: FaceJoinRecord = { personaGroup: args.personaGroup, rootKey: args.rootKey, certificates: [], grants: [] };
    let issued: IssuedFaceKey[] = [];
    if (standing !== null) {
      let r: Record<string, unknown>;
      try { r = JSON.parse(new TextDecoder().decode(standing)) as Record<string, unknown>; } catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
      if (r["rootKey"] !== args.rootKey) throw new CustodyRowUnavailable("identity", file, "names-another-key");
      if (!Array.isArray(r["certificates"]) || !Array.isArray(r["grants"])) throw new CustodyRowUnavailable("identity", file, "malformed");
      base = { personaGroup: args.personaGroup, rootKey: args.rootKey, certificates: r["certificates"], grants: r["grants"] };
      try { issued = readIssued(r["issued"]); } catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
    }
    const replaced = (e: IssuedFaceKey): boolean => fresh.some((f) => f.nexus === e.nexus && f.faceKey === e.faceKey && f.vesselFaceKey === e.vesselFaceKey);
    const bytes = recordBytes(base, [...issued.filter((e) => !replaced(e)), ...fresh]);
    if (standing !== null && sameBytes(standing, bytes)) return { plaintext: null, value: undefined };
    return { plaintext: bytes, value: undefined };
  });
}

/** A joined face's record, or null. The caller re-reads every certificate and grant through its own readers. */
export async function readFaceJoinRecord(personaGroup: string): Promise<FaceJoinRecord | null> {
  const file = faceJoinRecordFile(personaGroup);
  const bytes = await readCustodyRow("identity", file);
  if (bytes === null) return null;
  try {
    const r = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (r["personaGroup"] !== personaGroup || typeof r["rootKey"] !== "string" || !Array.isArray(r["certificates"]) || !Array.isArray(r["grants"])) throw new Error("malformed");
    return { personaGroup, rootKey: r["rootKey"], certificates: r["certificates"], grants: r["grants"], issued: readIssued(r["issued"]) };
  } catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
}
