/**
 * keyslot — the VK rests only inside slots, LUKS-shaped: each slot an `sss{t, pins}` over human routes.
 *
 * A SLOT holds the VK wrapped under a random slot key, and the slot key split `t`-of-n across its pins (house
 * Shamir over GF(256); at t=1 every pin holds the whole slot key). A PIN wraps its share under a KEK only its human
 * route yields. Any ONE slot opens the VK, so a tree holding a passphrase slot and a paper slot opens under either,
 * and a 2-of-2 slot asks for both pins at once.
 *
 * THE PIN KINDS form a CLOSED union of the kinds this build BUILDS: `passphrase` (scrypt) and `paper` (a SLIP-39
 * sheet). A kind joins the union together with its builder; a declared kind with nothing behind it would be a
 * stub. Every built kind is a human route, so a slot that binds holds one, and the tree must keep at least one slot:
 * an unbind that would leave none refuses.
 *
 * READ-BACK BEFORE BIND. A paper pin seats only through `confirmPaperPin` (every printed sheet typed back word for
 * word) or `confirmHeldPaper` (a held sheet typed back recovers its secret). The confirmation is a runtime fact this
 * module records, so a hand-built object never seats a paper pin.
 *
 * EVERY UNBIND OFFERS THE ROTATION. A copy of the tree taken before an unbind still opens the VK through the slot it
 * removed; only a VK rotation (`sealed-writer.rotateVk`) ends that route, so the offer rides every unbind's result.
 *
 * THE KEYS. Each wrap derives its AEAD key by HKDF-SHA256 under `vk-slot-wrap`, salted by the slot's random id: a
 * pin's KEK material wraps its share, the slot key wraps the VK. The AAD binds what the bytes belong to (the slot,
 * the pin's place and kind, or the VK role), so a wrapped share moved to another pin or slot does not open.
 *
 * THE TREE AT REST is plain JSON with no version, counter or clock: slots, their pins, nonces and wrapped bytes. It
 * carries nothing secret without a route. A tree that fails to parse reads `unreadable` with the reason, named apart
 * from a credential that opens no slot (`no-slot-opens`): a torn tree never blames a passphrase.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { scrypt } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import { VK_SLOT_WRAP_INFO } from "./custody-domain-names.js";
import { splitSecret, combineSecret, type ShareBytes } from "./shamir-gf256.js";
import { generateMnemonics, combineMnemonics, readBackMismatch, Slip39Error } from "./slip39.js";
import { adoptUnwrappedVk, VK_LENGTH, type VesselKey } from "./vk.js";

/** The pin kinds this build builds. */
export type PinKind = "passphrase" | "paper";
export const PIN_KINDS: readonly PinKind[] = Object.freeze(["passphrase", "paper"]);

/** The scrypt cost a passphrase pin derives at (~0.5 s in the browser-shippable implementation). A change of cost
 *  is a change of pin kind, never a stored parameter a tree could lower. */
const SCRYPT = { N: 1 << 17, r: 8, p: 1, dkLen: 32 } as const;
const SLOT_KEY_LENGTH = 32;
const PAPER_SECRET_LENGTH = 32;
const SLOT_ID_LENGTH = 16;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;
/** A wrapped share: its x-coordinate byte, then the slot key's width. */
const SHARE_LENGTH = 1 + SLOT_KEY_LENGTH;

/** The text every unbind returns for the operator: what an unbind leaves open, and what closes it. */
export const VK_ROTATION_OFFER =
  "A copy of the slot tree taken before this unbind still opens the VK through the slot it removed. " +
  "Rotate the VK to close that route: a fresh VK re-seals every carrier and every remaining slot binds again.";

// ── the records ─────────────────────────────────────────────────────────────────────────────────────

export interface PassphrasePinRecord { readonly kind: "passphrase"; readonly salt: string; readonly nonce: string; readonly wrapped: string }
export interface PaperPinRecord { readonly kind: "paper"; readonly nonce: string; readonly wrapped: string }
export type PinRecord = PassphrasePinRecord | PaperPinRecord;

export interface SlotRecord {
  /** A random id: the HKDF salt of every wrap in the slot, and the handle `unbindSlot` takes. */
  readonly id:        string;
  readonly t:         number;
  readonly pins:      readonly PinRecord[];
  readonly nonce:     string;
  readonly wrappedVk: string;
}

export interface SlotTree { readonly slots: readonly SlotRecord[] }

// ── the paper pin's read-back ─────────────────────────────────────────────────────────────────────

/** Sheets to print for a new paper pin. The secret they encode stays inside this module until read-back. */
export interface PaperDraft { readonly sheets: readonly string[] }

declare const confirmedBrand: unique symbol;
/** A paper secret a human proved they hold, by typing its sheets back. Only this module mints one. */
export interface ConfirmedPaperPin { readonly [confirmedBrand]: true }

const draftSecrets = new WeakMap<PaperDraft, Uint8Array>();
const confirmedSecrets = new WeakMap<object, Uint8Array>();

function confirmed(secret: Uint8Array): ConfirmedPaperPin {
  const token = Object.freeze({}) as ConfirmedPaperPin;
  confirmedSecrets.set(token, secret);
  return token;
}

/** Draft a paper pin: a fresh 32-byte secret on `count` sheets, any `threshold` of which recover it. */
export function draftPaperPin(args: { readonly threshold?: number; readonly count?: number; readonly rng?: RandomProvider } = {}): PaperDraft {
  const rng = args.rng ?? defaultCryptoProvider;
  const secret = rng.getRandomValues(new Uint8Array(PAPER_SECRET_LENGTH));
  const [group] = generateMnemonics({
    groupThreshold: 1, groups: [[args.threshold ?? 1, args.count ?? 1]], masterSecret: secret, rng,
  });
  const draft: PaperDraft = Object.freeze({ sheets: Object.freeze([...group!]) });
  draftSecrets.set(draft, secret);
  return draft;
}

/** Confirm a drafted paper pin: every sheet typed back, in order, word for word. Throws at the first departure. */
export function confirmPaperPin(draft: PaperDraft, readBack: readonly string[]): ConfirmedPaperPin {
  const secret = draftSecrets.get(draft);
  if (secret === undefined) throw new Error("keyslot: this draft did not come from draftPaperPin");
  if (readBack.length !== draft.sheets.length) {
    throw new Error(`keyslot: read back every sheet before the paper pin binds (${draft.sheets.length} printed, ${readBack.length} typed)`);
  }
  draft.sheets.forEach((sheet, i) => {
    const miss = readBackMismatch(sheet, readBack[i]!);
    if (miss !== null) {
      throw new Error(
        `keyslot: sheet ${i + 1}, word ${miss.position} reads "${miss.typed ?? "(missing)"}" where the sheet holds ` +
        `"${miss.expected ?? "(nothing)"}" — the paper pin binds only after every word reads back`,
      );
    }
  });
  return confirmed(secret);
}

/** Confirm a paper secret the operator already holds: the sheets typed back must recover it. */
export function confirmHeldPaper(sheets: readonly string[]): ConfirmedPaperPin {
  const secret = combineMnemonics(sheets);
  if (secret.length !== PAPER_SECRET_LENGTH) throw new Slip39Error(`a paper pin's secret rides ${PAPER_SECRET_LENGTH} bytes`);
  return confirmed(secret);
}

// ── derivations ──────────────────────────────────────────────────────────────────────────────────

const INFO = new TextEncoder().encode(VK_SLOT_WRAP_INFO);
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const wrapKey = (material: Uint8Array, slotId: Uint8Array): Uint8Array => hkdf(sha256, material, slotId, INFO, 32);
const pinAad = (slotId: Uint8Array, index: number, kind: PinKind): Uint8Array => concat(utf8("pin"), slotId, Uint8Array.of(index), utf8(kind));
const vkAad = (slotId: Uint8Array): Uint8Array => concat(utf8("vk"), slotId);

function passphraseMaterial(passphrase: string, salt: Uint8Array): Uint8Array {
  return scrypt(passphrase.normalize("NFKC"), salt, SCRYPT);
}

function fromHex(s: string, bytes: number, what: string): Uint8Array {
  if (typeof s !== "string" || !/^[0-9a-f]*$/.test(s) || s.length !== bytes * 2) throw new Error(`${what} is not ${bytes} bytes of lowercase hex`);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// ── bind / unbind ────────────────────────────────────────────────────────────────────────────────

export type PinSpec =
  | { readonly kind: "passphrase"; readonly passphrase: string }
  | { readonly kind: "paper"; readonly confirmed: ConfirmedPaperPin };

export interface SlotSpec { readonly t: number; readonly pins: readonly PinSpec[] }

/** Bind one slot over `vk` into `tree` (`null` founds the tree). Refuses a slot with no human route. */
export function bindSlot(tree: SlotTree | null, vk: VesselKey, spec: SlotSpec, rng: RandomProvider = defaultCryptoProvider): SlotTree {
  if (spec.pins.length === 0) throw new Error("keyslot: a slot with no pin holds no human route to the VK");
  if (!Number.isInteger(spec.t) || spec.t < 1 || spec.t > spec.pins.length) {
    throw new Error(`keyslot: a slot's threshold must be an integer in 1..${spec.pins.length} (its pin count); got ${spec.t}`);
  }
  if (spec.pins.length > 255) throw new Error("keyslot: a slot holds at most 255 pins");
  // Resolve every pin's KEK material BEFORE minting anything, so a refusal leaves nothing half-built.
  const materials = spec.pins.map((pin, i) => {
    switch ((pin as { kind: unknown }).kind) {
      case "passphrase": {
        const p = pin as Extract<PinSpec, { kind: "passphrase" }>;
        if (typeof p.passphrase !== "string" || p.passphrase.length === 0) throw new Error(`keyslot: pin ${i + 1}: an empty passphrase is no route`);
        return { kind: "passphrase" as const, passphrase: p.passphrase };
      }
      case "paper": {
        const secret = confirmedSecrets.get((pin as { confirmed: object }).confirmed);
        if (secret === undefined) throw new Error(`keyslot: pin ${i + 1}: a paper pin binds only after its sheet reads back (confirmPaperPin or confirmHeldPaper)`);
        return { kind: "paper" as const, secret };
      }
      default:
        throw new Error(`keyslot: pin ${i + 1}: kind "${String((pin as { kind: unknown }).kind)}" lies outside the built pin kinds (${PIN_KINDS.join(", ")})`);
    }
  });

  const slotId = rng.getRandomValues(new Uint8Array(SLOT_ID_LENGTH));
  const slotKey = rng.getRandomValues(new Uint8Array(SLOT_KEY_LENGTH));
  const shares: ShareBytes[] = spec.t === 1
    ? spec.pins.map(() => ({ x: 0, ys: slotKey }))
    : splitSecret(slotKey, spec.t, spec.pins.length, rng);

  const pins: PinRecord[] = materials.map((m, i) => {
    const nonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
    const plaintext = concat(Uint8Array.of(shares[i]!.x), shares[i]!.ys);
    if (m.kind === "passphrase") {
      const salt = rng.getRandomValues(new Uint8Array(SALT_LENGTH));
      const key = wrapKey(passphraseMaterial(m.passphrase, salt), slotId);
      const wrapped = xchacha20poly1305(key, nonce, pinAad(slotId, i, "passphrase")).encrypt(plaintext);
      return { kind: "passphrase", salt: hex(salt), nonce: hex(nonce), wrapped: hex(wrapped) };
    }
    const key = wrapKey(m.secret, slotId);
    const wrapped = xchacha20poly1305(key, nonce, pinAad(slotId, i, "paper")).encrypt(plaintext);
    return { kind: "paper", nonce: hex(nonce), wrapped: hex(wrapped) };
  });

  const vkNonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const wrappedVk = xchacha20poly1305(wrapKey(slotKey, slotId), vkNonce, vkAad(slotId)).encrypt(vk);
  const slot: SlotRecord = { id: hex(slotId), t: spec.t, pins, nonce: hex(vkNonce), wrappedVk: hex(wrappedVk) };
  return { slots: [...(tree?.slots ?? []), slot] };
}

/** Remove one slot. Refuses the last slot, and returns the rotation offer with every tree it returns. */
export function unbindSlot(tree: SlotTree, slotId: string): { readonly tree: SlotTree; readonly rotationOffer: string } {
  if (!tree.slots.some((s) => s.id === slotId)) throw new Error(`keyslot: no slot ${slotId} stands in this tree`);
  if (tree.slots.length === 1) throw new Error("keyslot: unbinding the last slot would leave the VK with no human route");
  return { tree: { slots: tree.slots.filter((s) => s.id !== slotId) }, rotationOffer: VK_ROTATION_OFFER };
}

// ── open ─────────────────────────────────────────────────────────────────────────────────────────

export type Credential =
  | { readonly kind: "passphrase"; readonly passphrase: string }
  | { readonly kind: "paper"; readonly sheets: readonly string[] };

export type VkUnlock =
  | { readonly reading: "opens"; readonly vk: VesselKey; readonly slot: string }
  /** The credentials open no slot. `notes` names credentials that never reached a pin (a sheet that fails its
   *  checksum, say); a passphrase that simply does not unwrap leaves no note, since the AEAD cannot say why. */
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

function tryUnwrap(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, wrapped: Uint8Array): Uint8Array | null {
  try { return xchacha20poly1305(key, nonce, aad).decrypt(wrapped); } catch { return null; }
}

/** Open the VK with whatever credentials the operator presents. Any one slot whose threshold they meet opens it. */
export function openVk(tree: SlotTree, credentials: readonly Credential[]): VkUnlock {
  const notes: string[] = [];
  const paperSecrets: Uint8Array[] = [];
  for (const c of credentials) {
    if (c.kind !== "paper") continue;
    try { paperSecrets.push(combineMnemonics(c.sheets)); } catch (err) { notes.push(`a paper credential reads no secret: ${(err as Error).message}`); }
  }
  const passphrases = credentials.flatMap((c) => (c.kind === "passphrase" ? [c.passphrase] : []));

  for (const slot of tree.slots) {
    const slotId = fromHex(slot.id, SLOT_ID_LENGTH, "slot id");
    const shares: ShareBytes[] = [];
    slot.pins.forEach((pin, i) => {
      if (shares.length >= slot.t) return;
      const nonce = fromHex(pin.nonce, NONCE_LENGTH, "pin nonce");
      const wrapped = fromHex(pin.wrapped, SHARE_LENGTH + TAG_LENGTH, "wrapped share");
      const aad = pinAad(slotId, i, pin.kind);
      const materials: Uint8Array[] = pin.kind === "passphrase"
        ? passphrases.map((p) => passphraseMaterial(p, fromHex(pin.salt, SALT_LENGTH, "pin salt")))
        : paperSecrets;
      for (const m of materials) {
        const share = tryUnwrap(wrapKey(m, slotId), nonce, aad, wrapped);
        if (share !== null) { shares.push({ x: share[0]!, ys: share.subarray(1) }); return; }
      }
    });
    if (shares.length < slot.t) continue;
    const slotKey = slot.t === 1 ? shares[0]!.ys : combineSecret(shares.slice(0, slot.t));
    const vk = tryUnwrap(
      wrapKey(slotKey, slotId), fromHex(slot.nonce, NONCE_LENGTH, "slot nonce"), vkAad(slotId),
      fromHex(slot.wrappedVk, VK_LENGTH + TAG_LENGTH, "wrapped VK"),
    );
    if (vk !== null) return { reading: "opens", vk: adoptUnwrappedVk(vk), slot: slot.id };
  }
  return { reading: "no-slot-opens", notes };
}

// ── the tree at rest ─────────────────────────────────────────────────────────────────────────────

/** Encode the tree as JSON bytes. */
export function encodeSlotTree(tree: SlotTree): Uint8Array {
  return utf8(JSON.stringify({
    slots: tree.slots.map((s) => ({
      id: s.id, t: s.t, nonce: s.nonce, wrappedVk: s.wrappedVk,
      pins: s.pins.map((p) => (p.kind === "passphrase"
        ? { kind: p.kind, salt: p.salt, nonce: p.nonce, wrapped: p.wrapped }
        : { kind: p.kind, nonce: p.nonce, wrapped: p.wrapped })),
    })),
  }));
}

export type SlotTreeReading =
  | { readonly reading: "absent" }
  | { readonly reading: "readable"; readonly tree: SlotTree }
  | { readonly reading: "unreadable"; readonly why: string };

/** Decode a tree from what stands at rest. Every shape fault reads `unreadable` with its reason. */
export function decodeSlotTree(bytes: Uint8Array | null): SlotTreeReading {
  if (bytes === null) return { reading: "absent" };
  try {
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as { slots?: unknown };
    if (!Array.isArray(raw.slots)) throw new Error("the tree names no slots");
    if (raw.slots.length === 0) throw new Error("a tree with no slot holds no human route");
    const slots = raw.slots.map((s: Record<string, unknown>, si: number): SlotRecord => {
      const where = `slot ${si + 1}`;
      fromHex(s.id as string, SLOT_ID_LENGTH, `${where} id`);
      fromHex(s.nonce as string, NONCE_LENGTH, `${where} nonce`);
      fromHex(s.wrappedVk as string, VK_LENGTH + TAG_LENGTH, `${where} wrapped VK`);
      if (!Array.isArray(s.pins) || s.pins.length === 0) throw new Error(`${where} holds no pin`);
      if (!Number.isInteger(s.t) || (s.t as number) < 1 || (s.t as number) > s.pins.length) throw new Error(`${where} threshold lies outside 1..${s.pins.length}`);
      const pins = (s.pins as Record<string, unknown>[]).map((p, pi): PinRecord => {
        const pw = `${where} pin ${pi + 1}`;
        fromHex(p.nonce as string, NONCE_LENGTH, `${pw} nonce`);
        fromHex(p.wrapped as string, SHARE_LENGTH + TAG_LENGTH, `${pw} wrapped share`);
        if (p.kind === "passphrase") {
          fromHex(p.salt as string, SALT_LENGTH, `${pw} salt`);
          return { kind: "passphrase", salt: p.salt as string, nonce: p.nonce as string, wrapped: p.wrapped as string };
        }
        if (p.kind === "paper") return { kind: "paper", nonce: p.nonce as string, wrapped: p.wrapped as string };
        throw new Error(`${pw}: kind "${String(p.kind)}" lies outside the built pin kinds (${PIN_KINDS.join(", ")})`);
      });
      return { id: s.id as string, t: s.t as number, pins, nonce: s.nonce as string, wrappedVk: s.wrappedVk as string };
    });
    return { reading: "readable", tree: { slots } };
  } catch (err) {
    return { reading: "unreadable", why: (err as Error).message };
  }
}
