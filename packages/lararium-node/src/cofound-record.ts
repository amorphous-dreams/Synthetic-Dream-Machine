/**
 * cofound-record — the ONE sealed row a founder's vessel keeps per joint founding it takes part in, and the
 * reading the inception door licenses a joint signature by.
 *
 * The carrier table (`vault-carriers`) names the row:
 *
 *   cofound   HOT, in the seal home, `cofound-<the offer fingerprint>.json`. It records the offer this vessel made
 *             (`offer`) or read and answered (`join`): the face whose seat stood, this vessel's seat key and hearth
 *             cadence key for the founding, the offer itself, and the inception image this vessel JUDGED: the
 *             image it composed when it joined, or the image a join it judged composes. It holds public material
 *             alone, under the vessel key, so a locked disk names no founding partner. It stays on its vessel.
 *
 * ── A JOINT SIGNATURE NEEDS A RECORDED, JUDGED OFFER ────────────────────────────────────────────
 * `recordedJointImage` answers the seat and the judged image the row holds for an offer fingerprint; the inception
 * door (`seal-ceremony` `signLicensedInception`) signs a joint founding only where that row names the signing seat
 * and holds exactly the image asked. An offer this vessel never recorded, or an image it never judged, signs nothing.
 *
 * Callers: the cofound ceremony (`cofound-ceremony`) writes the row; the inception door reads it.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus · lar:///ha.ka.ba/lararium/mesh/custody#/the-table
 */
import { readdirSync } from "node:fs";
import { canonicalJson, readCharterInceptionImage, readCofoundOffer, type CharterInceptionImage, type CofoundOffer } from "@lararium/mesh";
import { readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larSealHome } from "./vessel-paths.js";

/** The row's file, for the carrier table: `cofound-<64 lower hex offer fingerprint>.json`. */
export const COFOUND_RECORD_FILE = /^cofound-([0-9a-f]{64})\.json$/;

/** What one founding's row records. */
export interface CofoundRecord {
  /** `offer` where this vessel made the offer, `join` where it read and answered one. */
  readonly role:    "offer" | "join";
  /** The face whose seat claim stood for the chair. */
  readonly face:    number;
  /** This vessel's seat key for the founding. */
  readonly seat:    string;
  /** This vessel's hearth cadence key for the founding. */
  readonly cadence: string;
  readonly offer:   CofoundOffer;
  /** The inception image this vessel judged, or null while the offer waits for its join. */
  readonly image:   CharterInceptionImage | null;
}

const HEX64 = /^[0-9a-f]{64}$/;
const utf8 = new TextEncoder();
const utf8Read = new TextDecoder("utf-8", { fatal: true });

/** The row's file for one offer fingerprint. */
export function cofoundRecordFile(offerFingerprint: string): string {
  if (typeof offerFingerprint !== "string" || !HEX64.test(offerFingerprint)) throw new RangeError("cofound-record: an offer fingerprint reads as 64 lower hex");
  return `cofound-${offerFingerprint}.json`;
}

/** Read a row's bytes at its exact shape; null for anything else. */
export function parseCofoundRecord(bytes: Uint8Array): CofoundRecord | null {
  let v: unknown;
  try { v = JSON.parse(utf8Read.decode(bytes)); } catch { return null; }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const keys = ["role", "face", "seat", "cadence", "offer", "image"];
  if (Object.keys(r).length !== keys.length || !keys.every((k) => Object.hasOwn(r, k))) return null;
  const offer = readCofoundOffer(r["offer"]);
  const image = r["image"] === null ? null : readCharterInceptionImage(r["image"]);
  const face = r["face"];
  if ((r["role"] !== "offer" && r["role"] !== "join") || typeof face !== "number" || !Number.isSafeInteger(face) || face < 0 ||
      typeof r["seat"] !== "string" || !HEX64.test(r["seat"]) || typeof r["cadence"] !== "string" || !HEX64.test(r["cadence"]) ||
      !offer || (r["image"] !== null && image === null)) return null;
  return { role: r["role"], face, seat: r["seat"], cadence: r["cadence"], offer, image };
}

const spell = (record: CofoundRecord): Uint8Array => utf8.encode(JSON.stringify(record));

/** The row for one offer fingerprint, or null where none stands. A row that stands and reads otherwise refuses. */
export async function readCofoundRecord(offerFingerprint: string): Promise<CofoundRecord | null> {
  const file = cofoundRecordFile(offerFingerprint);
  const bytes = await readCustodyRow("seal", file);
  if (bytes === null) return null;
  const record = parseCofoundRecord(bytes);
  if (record === null) throw new Error(`cofound-record: the row ${file} stands and reads otherwise; nothing reads it as a founding`);
  return record;
}

/**
 * Read the row for one offer, decide, and seal the next one, under one custody holder. `decide` receives the row as
 * it stands (or null) and answers the next row (null writes nothing) beside its answer.
 */
export function updateCofoundRecord<T>(offerFingerprint: string,
  decide: (standing: CofoundRecord | null) => { readonly next: CofoundRecord | null; readonly value: T }): Promise<T> {
  const file = cofoundRecordFile(offerFingerprint);
  return updateCustodyRow("seal", file, (bytes) => {
    const standing = bytes === null ? null : parseCofoundRecord(bytes);
    if (bytes !== null && standing === null) throw new Error(`cofound-record: the row ${file} stands and reads otherwise; nothing lands over it`);
    const d = decide(standing);
    return { plaintext: d.next === null ? null : spell(d.next), value: d.value };
  });
}

/** Remove the row for one offer, only while it still names `seat`: a step that refused after recording takes its row back. */
export function dropCofoundRecord(offerFingerprint: string, seat: string): Promise<boolean> {
  return removeCustodyRow("seal", cofoundRecordFile(offerFingerprint), (bytes) => parseCofoundRecord(bytes)?.seat === seat);
}

/** The offer fingerprints this vessel keeps a row for. Reads names alone. */
export function cofoundRecordFingerprints(): string[] {
  let names: string[];
  try { names = readdirSync(larSealHome()); } catch { return []; }
  return names.map((n) => COFOUND_RECORD_FILE.exec(n)?.[1]).filter((fp): fp is string => fp !== undefined).sort();
}

/**
 * The seat and the judged image this vessel's row holds for a joint founding's offer, or null where no row stands or
 * the row holds no judged image yet. The inception door licenses a joint signature by this reading alone.
 */
export async function recordedJointImage(offerFingerprint: string): Promise<{ readonly seat: string; readonly image: CharterInceptionImage } | null> {
  const record = await readCofoundRecord(offerFingerprint);
  return record && record.image ? { seat: record.seat, image: record.image } : null;
}

/** Whether two inception images spell the same bytes. */
export const sameInceptionImage = (a: CharterInceptionImage, b: CharterInceptionImage): boolean => canonicalJson(a) === canonicalJson(b);
