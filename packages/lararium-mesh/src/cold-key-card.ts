/**
 * cold-key-card — the paper a seat's COLD KEY rests on.
 *
 * A seat's cold key is its NEXT key: an Ed25519 seed the charter commits by digest and the seat reveals only
 * to roll. Stealing the key a seat signs with today therefore forges no successor. The card spells the seed
 * so a person can write it down and type it back: 64 hex of the seed, 8 hex of checksum, in groups of four.
 *
 * The invariants:
 *   · A MINT DRAWS RANDOM BYTES AND NOTHING ELSE. A cold key derives from no seed on the machine; whatever
 *     can re-derive it could roll the charter without the paper.
 *   · THE CHARTER COMMITS A DIGEST, NEVER THE KEY. `seatNextDigest` hashes the verifying key under its own
 *     domain, so a commitment reveals nothing until the roll and collides with no other digest the house mints.
 *   · EVERY CHARACTER SITS UNDER THE CHECKSUM. A slip of the pen, a dropped group, or two groups traded
 *     refuses; spacing, dashes and case never matter.
 *   · ONE REFUSAL NAME, AND NO REFUSAL CARRIES THE SECRET. Every unreadable code or seed throws
 *     `cold-key-card-unreadable` with a fixed phrase naming the class of fault and no byte of the input.
 *   · A CARD SHOWS FOUR FIELDS BESIDE ITS CODE: purpose, chair label, generation, and a short fingerprint of
 *     the charter it rolls, so a person holding several cards tells them apart. The fields are display
 *     only: none enters the code, its checksum or the digest. The printed set stays a parameter, and a
 *     named field with no value refuses rather than printing a blank.
 *
 * Pure: no I/O, no clock, no log. The module holds no key beyond the values it returns.
 */
import * as ed25519 from "@noble/ed25519";
import { canonicalJson, defaultCryptoProvider, hex, hexToBytes, sha256HexSync, type RandomProvider } from "./crypto.js";
import { COLD_KEY_CARD_DOMAIN, SEAT_NEXT_KEY_DOMAIN } from "./domains.js";
import { confirmationPhrase } from "./guardian-card.js";

export class ColdKeyCardError extends Error {}

/** A cold key in hand: its seed, its verifying key (lowercase hex), and the digest a charter commits. */
export interface ColdKey {
  readonly seed:         Uint8Array;
  readonly verifyingKey: string;
  readonly digest:       string;
}

const SEED_BYTES = 32;
const SEED_HEX = SEED_BYTES * 2;
const CHECK_HEX = 8;
const CODE_HEX = SEED_HEX + CHECK_HEX;
const GROUPS_PER_ROW = 6;

function unreadable(fault: "length" | "character" | "checksum" | "key"): ColdKeyCardError {
  return new ColdKeyCardError(`cold-key-card-unreadable: ${fault}`);
}

/**
 * The digest a charter commits for one seat's cold key: a hash of the verifying key under the seat-next
 * domain. One-way: a reader tests a REVEALED key against it and recovers no key from it. Case-blind.
 */
export function seatNextDigest(coldVerifyingKey: string): string {
  if (typeof coldVerifyingKey !== "string" || !/^[0-9a-fA-F]{64}$/.test(coldVerifyingKey)) throw unreadable("key");
  return sha256HexSync(canonicalJson({ kind: SEAT_NEXT_KEY_DOMAIN, key: coldVerifyingKey.toLowerCase() }));
}

/** The cold key a 32-byte seed holds. The returned seed is a copy the caller owns. */
export async function coldKeyFromSeed(seed: Uint8Array): Promise<ColdKey> {
  if (!(seed instanceof Uint8Array) || seed.length !== SEED_BYTES) throw unreadable("length");
  const own = new Uint8Array(seed);
  const verifyingKey = hex(await ed25519.getPublicKeyAsync(own));
  return { seed: own, verifyingKey, digest: seatNextDigest(verifyingKey) };
}

/** Mint a cold key: 32 bytes from the random source, asked once, and nothing derived from anything else. */
export async function mintColdKey(rng: RandomProvider = defaultCryptoProvider): Promise<ColdKey> {
  const drawn = new Uint8Array(SEED_BYTES);
  rng.getRandomValues(drawn);
  try { return await coldKeyFromSeed(drawn); }
  finally { drawn.fill(0); }
}

const checksumOf = (seedHex: string): string =>
  sha256HexSync(canonicalJson({ kind: COLD_KEY_CARD_DOMAIN, seed: seedHex })).slice(0, CHECK_HEX);

/** Spell a seed as its card code: 64 hex, 8 hex of checksum, lowercase, 18 groups of four joined by `-`. */
export function coldKeyCode(seed: Uint8Array): string {
  if (!(seed instanceof Uint8Array) || seed.length !== SEED_BYTES) throw unreadable("length");
  const seedHex = hex(seed);
  return `${seedHex}${checksumOf(seedHex)}`.match(/.{4}/g)!.join("-");
}

/** Read a typed code back to its seed. Whitespace, dashes and case never matter; every fault refuses. */
export function coldKeySeedFromCode(code: string): Uint8Array {
  if (typeof code !== "string") throw unreadable("character");
  const raw = code.replace(/[\s-]/g, "").toLowerCase();
  if (raw.length !== CODE_HEX) throw unreadable("length");
  if (!/^[0-9a-f]+$/.test(raw)) throw unreadable("character");
  const seedHex = raw.slice(0, SEED_HEX);
  if (raw.slice(SEED_HEX) !== checksumOf(seedHex)) throw unreadable("checksum");
  return hexToBytes(seedHex);
}

/**
 * The short phrase two people read to each other to confirm one card. It reads the code's canonical
 * spelling, so every way of typing one code yields one phrase, and an unreadable code yields none.
 */
export function coldKeyConfirm(code: string): string {
  const seed = coldKeySeedFromCode(code);
  try { return confirmationPhrase(coldKeyCode(seed), COLD_KEY_CARD_DOMAIN); }
  finally { seed.fill(0); }
}

/** What a card may show beside its code. Display only: no field enters the code, its checksum or the digest. */
export interface ColdKeyCardFields {
  readonly purpose:             string;   // what the key rolls, in the caller's words
  readonly chairLabel:          string;   // the chair's local label
  readonly generation:          number;   // the chain depth this card opens
  readonly charterFingerprint?: string;   // a short fingerprint of the charter the card rolls
}
export type ColdKeyCardField = keyof ColdKeyCardFields;

/** The fields a card shows when the caller names none: all four. */
export const COLD_KEY_CARD_DEFAULT_FIELDS: readonly ColdKeyCardField[] =
  Object.freeze(["purpose", "chairLabel", "generation", "charterFingerprint"] as const);

const FIELD_LABEL: Readonly<Record<ColdKeyCardField, string>> = Object.freeze({
  purpose: "purpose", chairLabel: "chair", generation: "generation", charterFingerprint: "charter",
});

/**
 * The lines of one card: each field the caller NAMED, in the order named, then the code in rows of six
 * groups, then the confirm phrase. A named field with no value refuses; a field left unnamed never prints.
 * With no fields named, the card shows all four, so a caller holding no charter fingerprint names the three it holds.
 */
export function coldKeyCardLines(
  seed:   Uint8Array,
  fields: ColdKeyCardFields,
  print:  readonly ColdKeyCardField[] = COLD_KEY_CARD_DEFAULT_FIELDS,
): readonly string[] {
  const groups = coldKeyCode(seed).split("-");
  const lines: string[] = [];
  for (const field of print) {
    if (!Object.hasOwn(FIELD_LABEL, field)) throw new ColdKeyCardError("cold-key-card-field-unknown");
    const value = fields[field];
    if (value === undefined || value === "") throw new ColdKeyCardError(`cold-key-card-field-absent: ${field}`);
    if (field === "generation" && !(Number.isSafeInteger(value) && (value as number) >= 0)) {
      throw new ColdKeyCardError("cold-key-card-field-invalid: generation");
    }
    lines.push(`${FIELD_LABEL[field]}: ${String(value)}`);
  }
  for (let i = 0; i < groups.length; i += GROUPS_PER_ROW) lines.push(groups.slice(i, i + GROUPS_PER_ROW).join("-"));
  lines.push(`confirm: ${coldKeyConfirm(groups.join("-"))}`);
  return lines;
}
