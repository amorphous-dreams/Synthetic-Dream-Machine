/**
 * face-bundle — ONE FACE'S BACKUP BUNDLE as bytes: its format mark, the slot tree that wraps its key under the
 * routes a person holds, and its sealed body.
 *
 * ── THE BYTES ───────────────────────────────────────────────────────────────────────────────────
 *   format mark (8)  ‖  tree length (u32, big-endian)  ‖  slot tree (JSON)  ‖  nonce (24)  ‖  sealed body
 * The mark reads as the first eight bytes of SHA-256 over the format's own name (`FACE_BUNDLE_DOMAIN`): a
 * changed format takes a new name and so a new mark, and the mark holds no counter. The slot tree rides in the
 * shape that wraps a vessel key (`keyslot`). Everything else rests inside the sealed body.
 *
 * ── ONE FRESH KEY PER BUNDLE ────────────────────────────────────────────────────────────────────
 * `mintBundleKey` draws 32 random bytes. Two keys derive from it under two names, and neither equals it:
 *   · the BODY KEY (`FACE_BUNDLE_BODY_INFO`) seals the body under XChaCha20-Poly1305, with the format mark as
 *     associated data. A body altered by one bit, or opened under another bundle's key, opens for nobody.
 *   · the MEMORY PAIR's secret half (`FACE_BUNDLE_MEMORY_INFO`): the content-key holder seals the memory section
 *     to that pair's public half (`memory-section`), so the bundle key's holder alone opens the section.
 * Two bundles share no key, no salt, no identifier and no visible field.
 *
 * ── WHAT THE BODY NAMES ─────────────────────────────────────────────────────────────────────────
 * One face: its root, the roster line that names it, the two fixed names of its anchors, its key event log, its
 * own names, its face proof keys, its own handle-book records, the guardian set its typed first enrolment committed
 * (null where its log commits none), its address secret (the 32 bytes its working documents derive their addresses
 * from, so a restored face finds the documents it wrote elsewhere; null where a reader built the body from paper,
 * which carries none) and its memory section. `readFaceBundleBody`
 * reads SHAPE alone and refuses any key it does not name; the restore judges every relation between the parts.
 * The body names no veil key, no vessel key, no seat and no row of another face, and its shape gives none a home.
 *
 * THE RESIDUE. A holder of the file with no route reads its length, the count of slots, each slot's pin kinds
 * and each slot's threshold, and nothing more.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-bundle
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJsonBytes, defaultCryptoProvider, utf8Bytes, type RandomProvider } from "./crypto.js";
import { FACE_BUNDLE_BODY_INFO, FACE_BUNDLE_DOMAIN, FACE_BUNDLE_MEMORY_INFO } from "./domains.js";
import { bindSlot, decodeSlotTree, encodeSlotTree, openTreeKey, type Credential, type SlotSpec, type SlotTree } from "./keyslot.js";
import { memoryKeypairOf, type MemoryKeypair } from "./memory-section.js";
import { coercePersonaKelEvent } from "./persona-kel-board.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import type { GuardianRecoveryRegistration } from "./recovery-registration.js";
import type { TreeKey } from "./tree-key.js";

/** A bundle key's width, in bytes. */
export const BUNDLE_KEY_LENGTH = 32;
const MARK_LENGTH = 8;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;
/** The longest slot tree a bundle carries, in bytes: a tree of human routes fits far inside. */
export const BUNDLE_TREE_LIMIT = 1024 * 1024;

/** The format mark: the first eight bytes of SHA-256 over the format's own name. */
export function faceBundleMark(): Uint8Array {
  return sha256(utf8Bytes(FACE_BUNDLE_DOMAIN)).slice(0, MARK_LENGTH);
}

/** One fresh bundle key. A cut draws one and uses it once. */
export function mintBundleKey(rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  return rng.getRandomValues(new Uint8Array(BUNDLE_KEY_LENGTH));
}

function assertKey(bundleKey: Uint8Array): void {
  if (!(bundleKey instanceof Uint8Array) || bundleKey.length !== BUNDLE_KEY_LENGTH) throw new TypeError(`face-bundle: a bundle key rides ${BUNDLE_KEY_LENGTH} bytes`);
}
const derive = (bundleKey: Uint8Array, info: string): Uint8Array => hkdf(sha256, bundleKey, faceBundleMark(), utf8Bytes(info), 32);

/** The key pair a bundle's memory section seals to. The bundle key alone derives it. */
export function bundleMemoryKeypair(bundleKey: Uint8Array): MemoryKeypair {
  assertKey(bundleKey);
  const secret = derive(bundleKey, FACE_BUNDLE_MEMORY_INFO);
  try { return memoryKeypairOf(secret); } finally { secret.fill(0); }
}

/** Wrap `bundleKey` under each route of `routes`, one slot per route: any one slot opens the key. */
export function bindBundleRoutes(bundleKey: Uint8Array, routes: readonly SlotSpec[], rng: RandomProvider = defaultCryptoProvider): SlotTree {
  assertKey(bundleKey);
  if (routes.length === 0) throw new Error("face-bundle: a bundle with no route opens for nobody");
  let tree: SlotTree | null = null;
  for (const spec of routes) tree = bindSlot(tree, bundleKey as TreeKey, spec, rng);
  return tree!;
}

// ── The body ────────────────────────────────────────────────────────────────────────────────────

/** One version a memory section carries, as the cut names it: a bag, its founding and a key version id. No key. */
export interface FaceBundleHolding { readonly bagId: string; readonly founding: string; readonly keyVersion: string }

/**
 * The guardian set a face's typed first enrolment committed, as the face's own sealed record holds it: the digest
 * the event carries, the threshold, and the registrations a later rotation reveals against that digest.
 */
export interface FaceBundleGuardianSet {
  readonly guardianSetHash: string;
  readonly threshold:       number;
  readonly guardians:       readonly GuardianRecoveryRegistration[];
}

/** Everything one face's bundle carries, as the sealed body spells it. */
export interface FaceBundleBody {
  /** The face's root: the seed it signs its lineage with, and the public key that seed derives. Lower hex. */
  readonly root:       { readonly signingKey: string; readonly verifyingKey: string };
  /** The roster line that named the root on the cutting vessel. */
  readonly rosterLine: { readonly handleIndex: number; readonly verifyingKey: string };
  /** The two fixed names of the face's anchors. The veil tag, the device edge and the key group's ids stay. */
  readonly anchors:    { readonly signerDid: string; readonly personaKelPrefix: string };
  /** The face's key event log as the cutting vessel's board held it, inception first. */
  readonly kel:        readonly PersonaKelEvent[];
  /** The face's own pet-name and its declared Handle, each where one stood. */
  readonly names:      { readonly petname?: string; readonly handle?: string };
  /** Each face proof key the cutting vessel held for this face: the scope's own name and the key's 32 bytes. */
  readonly faceProofKeys: readonly { readonly scope: string; readonly secret: string }[];
  /** The handle-book records this face itself recognised, each with this face's own label. */
  readonly handleBook: { readonly records: readonly Record<string, unknown>[] };
  /** The guardian set the face's log commits by its typed first enrolment; null where the log still stands one-of-one. */
  readonly guardianSet: FaceBundleGuardianSet | null;
  /** The memory section, sealed to the pair this bundle's key derives (base64), and what it holds. */
  readonly memory:     { readonly section: string; readonly holds: readonly FaceBundleHolding[] };
  /**
   * The face's address secret, 64 lower hex: every device that wears the face derives its working addresses from it.
   * Null where the body came from paper (the root cards carry none). Absent, the body reads whole and the restore
   * refuses it `no-address-secret`: a restore never mints a fresh one.
   */
  readonly addressSecret?: string | null;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** The longest label a body carries (a pet-name or a Handle), in characters. */
const LABEL_LIMIT = 512;

function plain(v: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!keys.includes(k) && !optional.includes(k)) return null;
  for (const k of keys) if (!(k in o)) return null;
  return o;
}
const isLabel = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= LABEL_LIMIT;
const isIndex = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const GUARDIAN_SLOTS = ["mine", "guardian-a", "guardian-b"];

/** A guardian set's SHAPE: a digest, a whole threshold, and registrations of the house's card shape. Null where it reads as none. */
function readGuardianSet(v: unknown): FaceBundleGuardianSet | null {
  const set = plain(v, ["guardianSetHash", "threshold", "guardians"]);
  if (!set || typeof set["guardianSetHash"] !== "string" || !HEX64.test(set["guardianSetHash"])) return null;
  if (!Number.isSafeInteger(set["threshold"]) || (set["threshold"] as number) < 1 || !Array.isArray(set["guardians"])) return null;
  const guardians: GuardianRecoveryRegistration[] = [];
  for (const one of set["guardians"] as unknown[]) {
    const g = plain(one, ["slot", "label", "recoveryPubKey", "confirmPhrase"]);
    if (!g || typeof g["slot"] !== "string" || !GUARDIAN_SLOTS.includes(g["slot"]) || !isLabel(g["label"])) return null;
    if (typeof g["recoveryPubKey"] !== "string" || !HEX64.test(g["recoveryPubKey"]) || typeof g["confirmPhrase"] !== "string" || g["confirmPhrase"].length > LABEL_LIMIT) return null;
    guardians.push({ slot: g["slot"] as GuardianRecoveryRegistration["slot"], label: g["label"], recoveryPubKey: g["recoveryPubKey"], confirmPhrase: g["confirmPhrase"] });
  }
  if (guardians.length === 0 || (set["threshold"] as number) > guardians.length) return null;
  return { guardianSetHash: set["guardianSetHash"], threshold: set["threshold"] as number, guardians };
}

/**
 * Read a body's SHAPE off the bytes a bundle's seal opened. Null where the bytes read as no body: a key the
 * shape does not name, a field of another type, or bytes that spell the same body another way (a body rides
 * as canonical JSON, so one body has one spelling).
 */
export function readFaceBundleBody(bytes: Uint8Array): FaceBundleBody | null {
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
  const top = plain(raw, ["root", "rosterLine", "anchors", "kel", "names", "faceProofKeys", "handleBook", "guardianSet", "memory"], ["addressSecret"]);
  if (!top) return null;
  const addressSecret = top["addressSecret"];
  if (addressSecret !== undefined && addressSecret !== null && (typeof addressSecret !== "string" || !HEX64.test(addressSecret))) return null;
  const root = plain(top["root"], ["signingKey", "verifyingKey"]);
  const rosterLine = plain(top["rosterLine"], ["handleIndex", "verifyingKey"]);
  const anchors = plain(top["anchors"], ["signerDid", "personaKelPrefix"]);
  const names = plain(top["names"], [], ["petname", "handle"]);
  const handleBook = plain(top["handleBook"], ["records"]);
  const memory = plain(top["memory"], ["section", "holds"]);
  if (!root || !rosterLine || !anchors || !names || !handleBook || !memory) return null;
  if (typeof root["signingKey"] !== "string" || !HEX64.test(root["signingKey"]) || typeof root["verifyingKey"] !== "string" || !HEX64.test(root["verifyingKey"])) return null;
  if (!isIndex(rosterLine["handleIndex"]) || typeof rosterLine["verifyingKey"] !== "string" || !HEX64.test(rosterLine["verifyingKey"])) return null;
  if (!isLabel(anchors["signerDid"]) || !isLabel(anchors["personaKelPrefix"])) return null;
  if ((names["petname"] !== undefined && !isLabel(names["petname"])) || (names["handle"] !== undefined && !isLabel(names["handle"]))) return null;
  if (!Array.isArray(top["kel"]) || !Array.isArray(top["faceProofKeys"]) || !Array.isArray(handleBook["records"]) || !Array.isArray(memory["holds"])) return null;
  const kel: PersonaKelEvent[] = [];
  for (const one of top["kel"] as unknown[]) {
    const event = coercePersonaKelEvent(one);
    if (event === null) return null;
    kel.push(event);
  }
  const faceProofKeys: { scope: string; secret: string }[] = [];
  const scopes = new Set<string>();
  for (const one of top["faceProofKeys"] as unknown[]) {
    const row = plain(one, ["scope", "secret"]);
    if (!row || typeof row["scope"] !== "string" || !HEX32.test(row["scope"]) || typeof row["secret"] !== "string" || !HEX64.test(row["secret"]) || scopes.has(row["scope"])) return null;
    scopes.add(row["scope"]);
    faceProofKeys.push({ scope: row["scope"], secret: row["secret"] });
  }
  const records: Record<string, unknown>[] = [];
  for (const one of handleBook["records"] as unknown[]) {
    // A record's own five parts and its one face's tag, and no part beside them. The cards inside verify afresh
    // where the record lands (`HandleBook.landFor`); this reader holds the record's outer shape closed.
    const record = plain(one, ["nym", "card", "heads", "accepted", "petname"], ["recognisedBy"]);
    if (!record || !isLabel(record["nym"]) || (record["petname"] !== null && !isLabel(record["petname"]))) return null;
    if (record["card"] !== null && (typeof record["card"] !== "object" || Array.isArray(record["card"]))) return null;
    if (!Array.isArray(record["heads"]) || !(record["heads"] as unknown[]).every((h) => typeof h === "string")) return null;
    if (!Array.isArray(record["accepted"]) || !(record["accepted"] as unknown[]).every((c) => !!c && typeof c === "object" && !Array.isArray(c))) return null;
    if (record["recognisedBy"] !== undefined) {
      const tags = record["recognisedBy"];
      if (!Array.isArray(tags) || tags.length !== 1) return null;
      const tag = plain(tags[0], ["face", "petname"]);
      if (!tag || typeof tag["face"] !== "string" || !HEX64.test(tag["face"]) || (tag["petname"] !== null && !isLabel(tag["petname"]))) return null;
    }
    records.push(record);
  }
  const guardianSet = top["guardianSet"] === null ? null : readGuardianSet(top["guardianSet"]);
  if (top["guardianSet"] !== null && guardianSet === null) return null;
  if (typeof memory["section"] !== "string" || !BASE64.test(memory["section"])) return null;
  const holds: FaceBundleHolding[] = [];
  for (const one of memory["holds"] as unknown[]) {
    const row = plain(one, ["bagId", "founding", "keyVersion"]);
    if (!row || !isLabel(row["bagId"]) || typeof row["founding"] !== "string" || !HEX64.test(row["founding"]) || typeof row["keyVersion"] !== "string" || !HEX64.test(row["keyVersion"])) return null;
    holds.push({ bagId: row["bagId"], founding: row["founding"], keyVersion: row["keyVersion"] });
  }
  const body: FaceBundleBody = {
    root: { signingKey: root["signingKey"], verifyingKey: root["verifyingKey"] },
    rosterLine: { handleIndex: rosterLine["handleIndex"], verifyingKey: rosterLine["verifyingKey"] },
    anchors: { signerDid: anchors["signerDid"], personaKelPrefix: anchors["personaKelPrefix"] },
    kel,
    names: { ...(names["petname"] !== undefined ? { petname: names["petname"] as string } : {}), ...(names["handle"] !== undefined ? { handle: names["handle"] as string } : {}) },
    faceProofKeys, handleBook: { records }, guardianSet, memory: { section: memory["section"], holds },
    ...(addressSecret !== undefined ? { addressSecret: addressSecret as string | null } : {}),
  };
  // ONE BODY, ONE SPELLING: the bytes must equal the canonical image of what they parsed to.
  const again = canonicalJsonBytes(top);
  return again.length === bytes.length && again.every((b, i) => b === bytes[i]) ? body : null;
}

/** A body's canonical bytes. The caller owns them and zero-fills them once they rest sealed. */
export function faceBundleBodyBytes(body: FaceBundleBody): Uint8Array {
  const bytes = canonicalJsonBytes(body);
  if (readFaceBundleBody(bytes) === null) { bytes.fill(0); throw new TypeError("face-bundle: the body reads as no bundle body; nothing sealed"); }
  return bytes;
}

// ── Seal, frame, read, open ─────────────────────────────────────────────────────────────────────

/** Seal a body's bytes under `bundleKey`: `nonce ‖ ciphertext`, with the format mark as associated data. */
export function sealFaceBundleBody(bodyBytes: Uint8Array, bundleKey: Uint8Array, rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  assertKey(bundleKey);
  const key = derive(bundleKey, FACE_BUNDLE_BODY_INFO);
  try {
    const nonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
    const ciphertext = xchacha20poly1305(key, nonce, faceBundleMark()).encrypt(bodyBytes);
    const out = new Uint8Array(NONCE_LENGTH + ciphertext.length);
    out.set(nonce, 0);
    out.set(ciphertext, NONCE_LENGTH);
    return out;
  } finally { key.fill(0); }
}

/** Open a sealed body under `bundleKey`. Null where the tag fails: altered bytes, or another bundle's key. */
export function openFaceBundleBody(sealed: Uint8Array, bundleKey: Uint8Array): Uint8Array | null {
  assertKey(bundleKey);
  if (!(sealed instanceof Uint8Array) || sealed.length < NONCE_LENGTH + TAG_LENGTH) return null;
  const key = derive(bundleKey, FACE_BUNDLE_BODY_INFO);
  try { return xchacha20poly1305(key, sealed.subarray(0, NONCE_LENGTH), faceBundleMark()).decrypt(sealed.subarray(NONCE_LENGTH)); }
  catch { return null; }
  finally { key.fill(0); }
}

/** Frame a bundle: the mark, the slot tree and the sealed body. */
export function encodeFaceBundle(tree: SlotTree, sealedBody: Uint8Array): Uint8Array {
  const treeBytes = encodeSlotTree(tree);
  if (treeBytes.length > BUNDLE_TREE_LIMIT) throw new Error("face-bundle: the slot tree outgrows a bundle's frame");
  const out = new Uint8Array(MARK_LENGTH + 4 + treeBytes.length + sealedBody.length);
  out.set(faceBundleMark(), 0);
  new DataView(out.buffer).setUint32(MARK_LENGTH, treeBytes.length, false);
  out.set(treeBytes, MARK_LENGTH + 4);
  out.set(sealedBody, MARK_LENGTH + 4 + treeBytes.length);
  return out;
}

export type FaceBundleReading =
  | { readonly reading: "readable"; readonly tree: SlotTree; readonly sealedBody: Uint8Array }
  /** The file carries no format mark, or no slot tree that reads whole. */
  | { readonly reading: "bundle-malformed"; readonly why: string };

/** Read a bundle's frame. Opens nothing. */
export function readFaceBundle(bytes: Uint8Array): FaceBundleReading {
  const malformed = (why: string): FaceBundleReading => ({ reading: "bundle-malformed", why });
  if (!(bytes instanceof Uint8Array) || bytes.length < MARK_LENGTH + 4) return malformed("the file ends before a bundle's frame");
  const mark = faceBundleMark();
  if (!mark.every((b, i) => bytes[i] === b)) return malformed("the file carries no bundle format mark");
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(MARK_LENGTH, false);
  const from = MARK_LENGTH + 4;
  if (size === 0 || size > BUNDLE_TREE_LIMIT || from + size + NONCE_LENGTH + TAG_LENGTH > bytes.length) return malformed("the slot tree's length runs past the file");
  const tree = decodeSlotTree(bytes.slice(from, from + size));
  if (tree.reading !== "readable") return malformed(`the slot tree reads unreadable${tree.reading === "unreadable" ? `: ${tree.why}` : ""}`);
  return { reading: "readable", tree: tree.tree, sealedBody: bytes.slice(from + size) };
}

export type BundleKeyOpening =
  | { readonly reading: "opens"; readonly bundleKey: Uint8Array; readonly slot: string }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

/** Open a bundle's key with the routes a person presents. The caller owns the key and zero-fills it. */
export function openBundleKey(tree: SlotTree, credentials: readonly Credential[]): BundleKeyOpening {
  const opened = openTreeKey(tree, credentials);
  return opened.reading === "opens" ? { reading: "opens", bundleKey: opened.treeKey, slot: opened.slot } : opened;
}

/** What a holder of the file reads with no route: the residue, and nothing of the face. */
export function faceBundleResidue(bytes: Uint8Array): { readonly length: number; readonly slots: readonly { readonly t: number; readonly pins: readonly string[] }[] } | null {
  const read = readFaceBundle(bytes);
  if (read.reading !== "readable") return null;
  return { length: bytes.length, slots: read.tree.slots.map((s) => ({ t: s.t, pins: s.pins.map((p) => p.kind) })) };
}
