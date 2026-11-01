/**
 * keyslot — the tree key rests only inside slots, LUKS-shaped: each slot an `sss{t, pins}` over human routes.
 *
 * A SLOT holds the tree key wrapped under a random slot key, and the slot key split `t`-of-n across its pins (house
 * Shamir over GF(256); at t=1 every pin holds the whole slot key). A PIN wraps its share under a KEK only its human
 * route yields. Any ONE slot opens the tree key, so a tree holding a passphrase slot and a paper slot opens under either,
 * and a 2-of-2 slot asks for both pins at once.
 *
 * THE PIN KINDS form a CLOSED union of the kinds this build BUILDS: `passphrase` (scrypt), `paper` (a SLIP-39
 * sheet), and `passkey` (an authenticator PRF). A kind joins the union together with its builder; a declared kind with nothing behind it would be a
 * stub. Every built kind is a human route, so a slot that binds holds one, and the tree must keep at least one slot:
 * an unbind that would leave none refuses.
 *
 * READ-BACK BEFORE BIND. A paper pin seats only through `confirmPaperPin` (every printed sheet typed back word for
 * word) or `confirmHeldPaper` (a held sheet typed back recovers its secret). The confirmation is a runtime fact this
 * module records, so a hand-built object never seats a paper pin. A read-back refusal names the sheet and the word's
 * position and never a word: neither the printed word nor its near-miss reaches a log.
 *
 * ONE ROUTE, ONE PIN. A slot binds each human route at most once: the same passphrase (NFKC-equal spellings
 * included) or the same paper secret as two pins of one slot refuses, since a t-of-n slot whose pins share a route
 * opens under fewer routes than its threshold names.
 *
 * EVERY UNBIND OFFERS THE ROTATION. A copy of the tree taken before an unbind still opens the tree key through the slot it
 * removed; only a tree key rotation (`sealed-writer.rotateTreeKey`) ends that route, so the offer rides every unbind's result.
 *
 * THE KEYS. Each wrap derives its AEAD key by HKDF-SHA256 under `slot-wrap`, salted by the slot's random id: a
 * pin's KEK material wraps its share, the slot key wraps the tree key. The AAD binds what the bytes belong to (the slot,
 * the pin's place and kind, or the tree key role), so a wrapped share moved to another pin or slot does not open.
 *
 * THE TREE COMMITS TO ITS tree key. Every tree carries `keyCheck` (`tree-key.ts`), the keyed check of the one tree key its slots wrap.
 * A bind over a tree key the tree does not commit to refuses, and a slot whose unwrap yields a tree key the check does not name
 * opens nothing (a slot spliced in from another tree). The sealed writer proves every tree key in hand against this check.
 *
 * THE TREE AT REST is plain JSON with no version, counter or clock: the check, the slots, their pins, nonces and
 * wrapped bytes. It carries nothing secret without a route. A tree that fails to parse reads `unreadable` with the reason, named apart
 * from a credential that opens no slot (`no-slot-opens`): a torn tree never blames a passphrase.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import { SLOT_WRAP_INFO } from "./domains.js";
import { splitSecret, combineSecret, type ShareBytes } from "./shamir-gf256.js";
import { generateMnemonics, combineMnemonics, readBackMismatch, Slip39Error } from "./slip39.js";
import { adoptUnwrappedTreeKey, treeKeyAnswersCheck, treeKeyCheckOf, TREE_KEY_LENGTH, type TreeKey } from "./tree-key.js";

/** The pin kinds this build builds. */
export type PinKind = "passphrase" | "paper" | "passkey";
export const PIN_KINDS: readonly PinKind[] = Object.freeze(["passphrase", "paper", "passkey"]);

/** The scrypt cost a passphrase pin derives at (~0.5 s in the browser-shippable implementation, ~0.3 s native). A change of cost
 *  is a change of pin kind, never a stored parameter a tree could lower. */
const SCRYPT = Object.freeze({ N: 1 << 17, r: 8, p: 1, dkLen: 32 } as const);

/** The cost a KDF port receives on every derivation: always `SCRYPT`, handed over by this module. */
export type ScryptCost = typeof SCRYPT;
type Derive = (password: Uint8Array, salt: Uint8Array, cost: ScryptCost) => Promise<Uint8Array>;

declare const kdfBrand: unique symbol;
/**
 * THE KDF PORT. Each passphrase derivation runs through a port the caller names, so the host's native scrypt serves
 * where the host offers one (`nativeKdf`, `@lararium/mesh/node`) and noble serves elsewhere (`nobleKdf`), to the same
 * bytes. The port carries NO cost: this module hands it `SCRYPT` on every call, and only this package mints a port,
 * so an argument can name which implementation derives and never how hard. A hand-built port refuses
 * (`kdf-port-unminted`); a port that throws or answers short refuses (`kdf-refused`), never as a wrong passphrase
 * and never by falling back to another port.
 */
export interface KdfPort { readonly [kdfBrand]: true }
const mintedPorts = new WeakMap<object, Derive>();

/** Mint a port over `derive`. Package-internal: neither public door exports it. */
export function mintKdfPort(derive: Derive): KdfPort {
  const port = Object.freeze({}) as KdfPort;
  mintedPorts.set(port, derive);
  return port;
}

/** Noble's scrypt, yielding to the event loop as it runs: the port every host holds. */
export const nobleKdf: KdfPort = mintKdfPort((password, salt, cost) => scryptAsync(password, salt, { N: cost.N, r: cost.r, p: cost.p, dkLen: cost.dkLen }));

function deriveOf(kdf: KdfPort): Derive {
  const derive = typeof kdf === "object" && kdf !== null ? mintedPorts.get(kdf) : undefined;
  if (derive === undefined) throw new Error("keyslot: kdf-port-unminted: a passphrase derives only through a port this package mints (nobleKdf, or nativeKdf from the host door)");
  return derive;
}
const SLOT_KEY_LENGTH = 32;
const PAPER_SECRET_LENGTH = 32;
const SLOT_ID_LENGTH = 16;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;
/** A wrapped share: its x-coordinate byte, then the slot key's width. */
const SHARE_LENGTH = 1 + SLOT_KEY_LENGTH;

/** The text every unbind returns for the operator: what an unbind leaves open, and what closes it. */
export const ROTATION_OFFER =
  "A copy of the slot tree taken before this unbind still opens the key through the slot it removed. " +
  "Rotate the key to close that route: a fresh key re-seals every carrier and every remaining slot binds again.";

// ── the records ─────────────────────────────────────────────────────────────────────────────────────

export interface PassphrasePinRecord { readonly kind: "passphrase"; readonly salt: string; readonly nonce: string; readonly wrapped: string }
export interface PaperPinRecord { readonly kind: "paper"; readonly nonce: string; readonly wrapped: string }
export interface PasskeyPinRecord { readonly kind: "passkey"; readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array; readonly nonce: string; readonly wrapped: string }
export type PinRecord = PassphrasePinRecord | PaperPinRecord | PasskeyPinRecord;

export interface SlotRecord {
  /** A random id: the HKDF salt of every wrap in the slot, and the handle `unbindSlot` takes. */
  readonly id:        string;
  readonly t:         number;
  readonly pins:      readonly PinRecord[];
  readonly nonce:     string;
  readonly wrappedKey: string;
}

export interface SlotTree {
  /** The keyed check of the one tree key every slot wraps (`treeKeyCheckOf`). */
  readonly keyCheck: string;
  readonly slots:   readonly SlotRecord[];
}

/** The width of a tree's tree key check, in bytes. */
const TREE_CHECK_LENGTH = 32;

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
      const how = miss.typed === null ? "is missing" : miss.expected === null ? "runs past the sheet's end" : "departs from the sheet";
      throw new Error(`keyslot: sheet ${i + 1}, word ${miss.position} ${how} — this pin binds only after every word reads back`);
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

const INFO = new TextEncoder().encode(SLOT_WRAP_INFO);
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const wrapKey = (material: Uint8Array, slotId: Uint8Array): Uint8Array => hkdf(sha256, material, slotId, INFO, 32);
const pinAad = (slotId: Uint8Array, index: number, kind: PinKind): Uint8Array => concat(utf8("pin"), slotId, Uint8Array.of(index), utf8(kind));
// The authenticator consumes prfSalt; the random slot id salts HKDF independently, while
// info binds this key to the pin's place and kind.
const passkeyKey = (output: Uint8Array, slotId: Uint8Array, index: number): Uint8Array => hkdf(sha256, output, slotId, pinAad(slotId, index, "passkey"), 32);
/** Mint the salt before the ceremony: the authenticator needs it to produce the output. */
export function mintPasskeySalt(rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  return rng.getRandomValues(new Uint8Array(32));
}
const treeKeyAad = (slotId: Uint8Array): Uint8Array => concat(utf8("treeKey"), slotId);

async function passphraseMaterial(passphrase: string, salt: Uint8Array, derive: Derive): Promise<Uint8Array> {
  const password = utf8(passphrase.normalize("NFKC"));
  let out: unknown;
  try { out = await derive(password, salt, SCRYPT); }
  catch (cause) { throw new Error("keyslot: kdf-refused: the KDF port refused the derivation; nothing opened and nothing bound", { cause }); }
  finally { password.fill(0); }
  if (!(out instanceof Uint8Array) || out.length !== SCRYPT.dkLen) throw new Error(`keyslot: kdf-refused: the KDF port answered other than ${SCRYPT.dkLen} bytes`);
  return out;
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
  | { readonly kind: "paper"; readonly confirmed: ConfirmedPaperPin }
  | { readonly kind: "passkey"; readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array; readonly prfOutput: Uint8Array };

export interface SlotSpec { readonly t: number; readonly pins: readonly PinSpec[] }

/**
 * Bind one slot over `treeKey` into `tree` (`null` founds the tree, committing it to `treeKey`). Refuses a slot with no human
 * route, a route bound twice in one slot, and a `treeKey` the standing tree does not commit to.
 */
export async function bindSlot(tree: SlotTree | null, treeKey: TreeKey, spec: SlotSpec, kdf: KdfPort, rng: RandomProvider = defaultCryptoProvider): Promise<SlotTree> {
  const derive = deriveOf(kdf);
  if (tree !== null && !treeKeyAnswersCheck(treeKey, tree.keyCheck)) {
    throw new Error("keyslot: the tree key in hand is not the tree key this tree commits to; a slot binds only over the tree's own tree key");
  }
  if (spec.pins.length === 0) throw new Error("keyslot: a slot with no pin holds no human route to the tree key");
  if (!Number.isInteger(spec.t) || spec.t < 1 || spec.t > spec.pins.length) {
    throw new Error(`keyslot: a slot's threshold must be an integer in 1..${spec.pins.length} (its pin count); got ${spec.t}`);
  }
  if (spec.pins.length > 255) throw new Error("keyslot: a slot holds at most 255 pins");
  // THE PASSKEY STAYS OPTIONAL (operator, 2026-10-29): a tree never holds a passkey as its only route. The bind reads the whole
  // tree, the slots that stand and the one binding: a passkey slot beside a passphrase or paper slot binds; a tree that would
  // open by a passkey alone refuses by name. A local-first island weighs the human's easy path through a centralized
  // authenticator provider against its own sovereignty; the tension stays alive here, resolved by nobody.
  const human = (p: { kind: string }) => p.kind === "passphrase" || p.kind === "paper";
  if (spec.pins.some((p) => p.kind === "passkey") && !spec.pins.some(human) && !(tree?.slots ?? []).some((s) => s.pins.some(human))) {
    throw new Error("keyslot: passkey-alone-refused");
  }
  // Resolve every pin's KEK material BEFORE minting anything, so a refusal leaves nothing half-built.
  const materials = spec.pins.map((pin, i): PinMaterial => {
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
      case "passkey": {
        const p = pin as Extract<PinSpec, { kind: "passkey" }>;
        if (!(p.credentialId instanceof Uint8Array) || p.credentialId.length === 0 || !(p.prfSalt instanceof Uint8Array) || p.prfSalt.length !== 32 || !(p.prfOutput instanceof Uint8Array) || p.prfOutput.length !== 32) throw new Error("keyslot: invalid passkey material");
        return { kind: "passkey", credentialId: p.credentialId.slice(), prfSalt: p.prfSalt.slice(), secret: p.prfOutput };
      }
      default:
        throw new Error(`keyslot: pin ${i + 1}: kind "${String((pin as { kind: unknown }).kind)}" lies outside the built pin kinds (${PIN_KINDS.join(", ")})`);
    }
  });
  refuseRouteBoundTwice(materials);

  const slotId = rng.getRandomValues(new Uint8Array(SLOT_ID_LENGTH));
  const slotKey = rng.getRandomValues(new Uint8Array(SLOT_KEY_LENGTH));
  const shares: ShareBytes[] = spec.t === 1
    ? spec.pins.map(() => ({ x: 0, ys: slotKey }))
    : splitSecret(slotKey, spec.t, spec.pins.length, rng);

  const pins: PinRecord[] = [];
  for (const [i, m] of materials.entries()) pins.push(await (async (): Promise<PinRecord> => {
    const nonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
    const plaintext = concat(Uint8Array.of(shares[i]!.x), shares[i]!.ys);
    if (m.kind === "passphrase") {
      const salt = rng.getRandomValues(new Uint8Array(SALT_LENGTH));
      const key = wrapKey(await passphraseMaterial(m.passphrase, salt, derive), slotId);
      const wrapped = xchacha20poly1305(key, nonce, pinAad(slotId, i, "passphrase")).encrypt(plaintext);
      return { kind: "passphrase", salt: hex(salt), nonce: hex(nonce), wrapped: hex(wrapped) };
    }
    if (m.kind === "passkey") {
      const key = passkeyKey(m.secret, slotId, i);
      const wrapped = xchacha20poly1305(key, nonce, pinAad(slotId, i, "passkey")).encrypt(plaintext);
      return { kind: "passkey", credentialId: m.credentialId, prfSalt: m.prfSalt, nonce: hex(nonce), wrapped: hex(wrapped) };
    }
    const key = wrapKey(m.secret, slotId);
    const wrapped = xchacha20poly1305(key, nonce, pinAad(slotId, i, "paper")).encrypt(plaintext);
    return { kind: "paper", nonce: hex(nonce), wrapped: hex(wrapped) };
  })());

  const treeKeyNonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const wrappedKey = xchacha20poly1305(wrapKey(slotKey, slotId), treeKeyNonce, treeKeyAad(slotId)).encrypt(treeKey);
  const slot: SlotRecord = { id: hex(slotId), t: spec.t, pins, nonce: hex(treeKeyNonce), wrappedKey: hex(wrappedKey) };
  return { keyCheck: tree?.keyCheck ?? treeKeyCheckOf(treeKey), slots: [...(tree?.slots ?? []), slot] };
}

type PinMaterial = { readonly kind: "passphrase"; readonly passphrase: string } | { readonly kind: "paper"; readonly secret: Uint8Array } | { readonly kind: "passkey"; readonly secret: Uint8Array; readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array };

/** Refuse one human route bound as two pins of one slot: a passphrase by its NFKC form, a paper pin by its secret. */
function refuseRouteBoundTwice(materials: readonly PinMaterial[]): void {
  const seen = new Map<string, number>();
  materials.forEach((m, i) => {
    const key = m.kind === "passphrase" ? `passphrase:${m.passphrase.normalize("NFKC")}` : m.kind === "paper" ? `paper:${hex(m.secret)}` : `passkey:${hex(m.credentialId)}`;
    const first = seen.get(key);
    if (first !== undefined) {
      if (m.kind === "passkey") throw new Error("keyslot: duplicate-route");
      throw new Error(`keyslot: pins ${first + 1} and ${i + 1} bind one ${m.kind} route twice; each pin of a slot holds its own human route`);
    }
    seen.set(key, i);
  });
}

/** Remove one slot. Refuses the last slot, and returns the rotation offer with every tree it returns. */
export function unbindSlot(tree: SlotTree, slotId: string): { readonly tree: SlotTree; readonly rotationOffer: string } {
  if (!tree.slots.some((s) => s.id === slotId)) throw new Error(`keyslot: no slot ${slotId} stands in this tree`);
  if (tree.slots.length === 1) throw new Error("keyslot: unbinding the last slot would leave the tree key with no human route");
  return { tree: { keyCheck: tree.keyCheck, slots: tree.slots.filter((s) => s.id !== slotId) }, rotationOffer: ROTATION_OFFER };
}

// ── open ─────────────────────────────────────────────────────────────────────────────────────────

export type Credential =
  | { readonly kind: "passphrase"; readonly passphrase: string }
  | { readonly kind: "paper"; readonly sheets: readonly string[] }
  | { readonly kind: "passkey"; readonly credentialId: Uint8Array; readonly prfOutput: Uint8Array };

export type TreeKeyUnlock =
  | { readonly reading: "opens"; readonly treeKey: TreeKey; readonly slot: string }
  /** The credentials open no slot. `notes` names credentials that never reached a pin and NEVER quotes one: a note
   *  carries no word of a sheet and no character of a passphrase, so a caller may print or log it. (a sheet that fails its
   *  checksum, say); a passphrase that simply does not unwrap leaves no note, since the AEAD cannot say why. */
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

function tryUnwrap(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, wrapped: Uint8Array): Uint8Array | null {
  try { return xchacha20poly1305(key, nonce, aad).decrypt(wrapped); } catch { return null; }
}

/** Open one passkey share; all credential failures carry the same refusal. */
export function openPasskeyPin(slot: SlotRecord, pinIndex: number, prfOutput: Uint8Array):
  { readonly reading: "opens"; readonly share: Uint8Array } | { readonly reading: "slot-refused" } {
  try {
    const pin = slot.pins[pinIndex];
    if (pin?.kind !== "passkey" || prfOutput.length !== 32) return { reading: "slot-refused" };
    const slotId = fromHex(slot.id, SLOT_ID_LENGTH, "slot id");
    const share = tryUnwrap(passkeyKey(prfOutput, slotId, pinIndex), fromHex(pin.nonce, NONCE_LENGTH, "pin nonce"),
      pinAad(slotId, pinIndex, "passkey"), fromHex(pin.wrapped, SHARE_LENGTH + TAG_LENGTH, "wrapped share"));
    return share === null ? { reading: "slot-refused" } : { reading: "opens", share };
  } catch { return { reading: "slot-refused" }; }
}

/** Open the tree key with whatever credentials the operator presents. Any one slot whose threshold they meet opens it.
 *  A passphrase derives only when a pin tries it, so a right route costs the derivations before it and no more. */
export async function openTreeKey(tree: SlotTree, credentials: readonly Credential[], kdf: KdfPort): Promise<TreeKeyUnlock> {
  const derive = deriveOf(kdf);
  const notes: string[] = [];
  const paperSecrets: Uint8Array[] = [];
  for (const c of credentials) {
    if (c.kind !== "paper") continue;
    try { paperSecrets.push(combineMnemonics(c.sheets)); } catch { notes.push("a paper credential reads no secret: its sheets fail their own check (a mistyped word, a missing sheet, or sheets of two sets)"); }
  }
  // NFKC-equal spellings derive the same material, so each distinct route rides once.
  const passphrases = [...new Set(credentials.flatMap((c) => (c.kind === "passphrase" ? [c.passphrase.normalize("NFKC")] : [])))];

  for (const slot of tree.slots) {
    const slotId = fromHex(slot.id, SLOT_ID_LENGTH, "slot id");
    const shares: ShareBytes[] = [];
    // ONE ROUTE, ONE PIN: a passphrase that opened one pin of this slot cannot open another, so it never derives again here.
    const spent = new Set<number>();
    for (const [i, pin] of slot.pins.entries()) {
      if (shares.length >= slot.t) break;
      const nonce = fromHex(pin.nonce, NONCE_LENGTH, "pin nonce");
      const wrapped = fromHex(pin.wrapped, SHARE_LENGTH + TAG_LENGTH, "wrapped share");
      const aad = pinAad(slotId, i, pin.kind);
      if (pin.kind === "passkey") {
        for (const c of credentials) {
          if (c.kind !== "passkey" || hex(c.credentialId) !== hex(pin.credentialId) || c.prfOutput.length !== 32) continue;
          const share = tryUnwrap(passkeyKey(c.prfOutput, slotId, i), nonce, aad, wrapped);
          if (share !== null) { shares.push({ x: share[0]!, ys: share.subarray(1) }); break; }
        }
        continue;
      }
      if (pin.kind === "passphrase") {
        // THE LAZY OPEN: derive one offered passphrase at a time, only when this pin tries it, and stop at the first share.
        const salt = fromHex(pin.salt, SALT_LENGTH, "pin salt");
        for (const [j, p] of passphrases.entries()) {
          if (spent.has(j)) continue;
          const share = tryUnwrap(wrapKey(await passphraseMaterial(p, salt, derive), slotId), nonce, aad, wrapped);
          if (share !== null) { shares.push({ x: share[0]!, ys: share.subarray(1) }); spent.add(j); break; }
        }
        continue;
      }
      for (const m of paperSecrets) {
        const share = tryUnwrap(wrapKey(m, slotId), nonce, aad, wrapped);
        if (share !== null) { shares.push({ x: share[0]!, ys: share.subarray(1) }); break; }
      }
    }
    if (shares.length < slot.t) continue;
    const slotKey = slot.t === 1 ? shares[0]!.ys : combineSecret(shares.slice(0, slot.t));
    const treeKey = tryUnwrap(
      wrapKey(slotKey, slotId), fromHex(slot.nonce, NONCE_LENGTH, "slot nonce"), treeKeyAad(slotId),
      fromHex(slot.wrappedKey, TREE_KEY_LENGTH + TAG_LENGTH, "wrapped tree key"),
    );
    if (treeKey === null) continue;
    const opened = adoptUnwrappedTreeKey(treeKey);
    if (treeKeyAnswersCheck(opened, tree.keyCheck)) return { reading: "opens", treeKey: opened, slot: slot.id };
    notes.push(`slot ${slot.id} unwraps a tree key this tree does not commit to; it opens nothing`);
  }
  return { reading: "no-slot-opens", notes };
}

// ── the tree at rest ─────────────────────────────────────────────────────────────────────────────

/** Encode the tree as JSON bytes. */
export function encodeSlotTree(tree: SlotTree): Uint8Array {
  return utf8(JSON.stringify({
    keyCheck: tree.keyCheck,
    slots: tree.slots.map((s) => ({
      id: s.id, t: s.t, nonce: s.nonce, wrappedKey: s.wrappedKey,
      pins: s.pins.map((p) => (p.kind === "passphrase"
        ? { kind: p.kind, salt: p.salt, nonce: p.nonce, wrapped: p.wrapped }
        : p.kind === "passkey" ? { kind: p.kind, credentialId: hex(p.credentialId), prfSalt: hex(p.prfSalt), nonce: p.nonce, wrapped: p.wrapped }
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
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as { keyCheck?: unknown; slots?: unknown };
    fromHex(raw.keyCheck as string, TREE_CHECK_LENGTH, "the tree's tree key check");
    if (!Array.isArray(raw.slots)) throw new Error("the tree names no slots");
    if (raw.slots.length === 0) throw new Error("a tree with no slot holds no human route");
    const slots = raw.slots.map((s: Record<string, unknown>, si: number): SlotRecord => {
      const where = `slot ${si + 1}`;
      fromHex(s.id as string, SLOT_ID_LENGTH, `${where} id`);
      fromHex(s.nonce as string, NONCE_LENGTH, `${where} nonce`);
      fromHex(s.wrappedKey as string, TREE_KEY_LENGTH + TAG_LENGTH, `${where} wrapped tree key`);
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
        if (p.kind === "passkey") {
          if (typeof p.credentialId !== "string" || p.credentialId.length === 0 || p.credentialId.length % 2 !== 0) throw new Error(`${pw} credential id invalid`);
          const credentialId = fromHex(p.credentialId, p.credentialId.length / 2, `${pw} credential id`);
          const prfSalt = fromHex(p.prfSalt as string, 32, `${pw} PRF salt`);
          return { kind: "passkey", credentialId, prfSalt, nonce: p.nonce as string, wrapped: p.wrapped as string };
        }
        if (p.kind === "paper") return { kind: "paper", nonce: p.nonce as string, wrapped: p.wrapped as string };
        throw new Error(`${pw}: kind "${String(p.kind)}" lies outside the built pin kinds (${PIN_KINDS.join(", ")})`);
      });
      return { id: s.id as string, t: s.t as number, pins, nonce: s.nonce as string, wrappedKey: s.wrappedKey as string };
    });
    return { reading: "readable", tree: { keyCheck: raw.keyCheck as string, slots } };
  } catch (err) {
    return { reading: "unreadable", why: (err as Error).message };
  }
}
