/**
 * serving-key — the SERVING KEY (SK) and the serving tree that wraps it (lar:///ha.ka.ba/lararium/mesh/ember#/the-serving-key).
 *
 * SK seals the serving tier alone: the rows a serving gate and blind carriage read and write for parties already
 * standing. It mints once, at the founding, as 32 random bytes: no key derives it, and it derives from no other key.
 *
 * ── THE SERVING TREE ────────────────────────────────────────────────────────────────────────────
 * SK rests in the serving tree (`sk-slots`), bare by law beside the VK's slot tree: the key it wraps cannot seal it.
 * The tree holds ONE VK entry: SK wrapped under a key the VK derives under `sk-vk-wrap`, its own registered domain.
 * A human unlock opens the VK, then SK through this entry, so the entry stands as the serving tree's human route.
 * A tree with no VK entry reads `unreadable`: an ember never stands as the only way to SK.
 *
 * ── THE TREE COMMITS TO ITS SK ──────────────────────────────────────────────────────────────────
 * The tree carries `skCheck`, a keyed digest of the one SK it wraps, under `sk-check`. The entry's AAD binds that
 * check, and an opening checks the unwrapped SK against it, so an entry spliced in from another tree opens nothing.
 *
 * ── AT REST ─────────────────────────────────────────────────────────────────────────────────────
 * Plain JSON with no version, counter or clock: the check and the VK entry's nonce and wrapped bytes. A tree that
 * names any other field reads `unreadable`: the ember slots and the `sk-rotation-owed` mark join this shape together
 * with the builders that write them (ember#/owed); until then the tree holds exactly the VK entry.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import { SK_CHECK_INFO, SK_VK_WRAP_INFO } from "./domains.js";
import { VK_LENGTH, type VesselKey } from "./vk.js";

declare const servingKeyBrand: unique symbol;
/** The serving key: 32 bytes, minted at the founding or opened through the serving tree, never built from other bytes. */
export type ServingKey = Uint8Array & { readonly [servingKeyBrand]: true };

export const SK_LENGTH = 32;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;
const CHECK_LENGTH = 32;

/** The serving tree's one human route: SK wrapped under a key the VK derives. */
export interface ServingVkEntry { readonly nonce: string; readonly wrapped: string }

export interface ServingTree {
  /** The keyed check of the one SK this tree wraps (`skCheckOf`). */
  readonly skCheck: string;
  readonly vkEntry: ServingVkEntry;
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function fromHex(s: unknown, bytes: number, what: string): Uint8Array {
  if (typeof s !== "string" || !/^[0-9a-f]*$/.test(s) || s.length !== bytes * 2) throw new Error(`${what} is not ${bytes} bytes of lowercase hex`);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Mint a fresh SK from the founding's own random source. */
export function mintServingKey(rng: RandomProvider = defaultCryptoProvider): ServingKey {
  return rng.getRandomValues(new Uint8Array(SK_LENGTH)) as ServingKey;
}

/** The check a serving tree carries for `sk`: 32 bytes of HKDF-SHA256 under `sk-check`, as lowercase hex. */
export function skCheckOf(sk: ServingKey): string {
  return hex(hkdf(sha256, sk, new Uint8Array(0), utf8(SK_CHECK_INFO), CHECK_LENGTH));
}

function answersCheck(sk: Uint8Array, check: string): boolean {
  const mine = skCheckOf(sk as ServingKey);
  if (check.length !== mine.length) return false;
  let d = 0;
  for (let i = 0; i < mine.length; i++) d |= mine.charCodeAt(i) ^ check.charCodeAt(i);
  return d === 0;
}

const entryKey = (vk: VesselKey): Uint8Array => {
  if (vk.length !== VK_LENGTH) throw new Error(`serving-key: a VK rides ${VK_LENGTH} bytes`);
  return hkdf(sha256, vk, new Uint8Array(0), utf8(SK_VK_WRAP_INFO), 32);
};
const entryAad = (skCheck: string): Uint8Array => concat(utf8("sk-vk-entry"), fromHex(skCheck, CHECK_LENGTH, "the tree's SK check"));

/** Found the serving tree: `sk` wrapped under `vk`'s entry, the tree committed to `sk`. */
export function foundServingTree(sk: ServingKey, vk: VesselKey, rng: RandomProvider = defaultCryptoProvider): ServingTree {
  if (sk.length !== SK_LENGTH) throw new Error(`serving-key: an SK rides ${SK_LENGTH} bytes`);
  const skCheck = skCheckOf(sk);
  const nonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const wrapped = xchacha20poly1305(entryKey(vk), nonce, entryAad(skCheck)).encrypt(sk);
  return { skCheck, vkEntry: { nonce: hex(nonce), wrapped: hex(wrapped) } };
}

export type ServingKeyOpening =
  | { readonly reading: "opens"; readonly sk: ServingKey }
  /** The VK in hand does not open the entry: another vessel's VK, or a tree of another vessel. */
  | { readonly reading: "vk-entry-refuses" }
  /** The entry opened to bytes the tree's check does not name: an entry spliced in from another tree. */
  | { readonly reading: "check-fails" };

/** Open SK through the tree's VK entry. Never throws on a key that does not open it. */
export function openServingKey(tree: ServingTree, vk: VesselKey): ServingKeyOpening {
  let opened: Uint8Array;
  try {
    opened = xchacha20poly1305(entryKey(vk), fromHex(tree.vkEntry.nonce, NONCE_LENGTH, "the VK entry's nonce"), entryAad(tree.skCheck))
      .decrypt(fromHex(tree.vkEntry.wrapped, SK_LENGTH + TAG_LENGTH, "the VK entry's wrapped SK"));
  } catch {
    return { reading: "vk-entry-refuses" };
  }
  if (!answersCheck(opened, tree.skCheck)) {
    opened.fill(0);
    return { reading: "check-fails" };
  }
  return { reading: "opens", sk: opened as ServingKey };
}

/** Encode the serving tree as JSON bytes. */
export function encodeServingTree(tree: ServingTree): Uint8Array {
  return utf8(JSON.stringify({ skCheck: tree.skCheck, vkEntry: { nonce: tree.vkEntry.nonce, wrapped: tree.vkEntry.wrapped } }));
}

export type ServingTreeReading =
  | { readonly reading: "absent" }
  | { readonly reading: "readable"; readonly tree: ServingTree }
  | { readonly reading: "unreadable"; readonly why: string };

/** Decode a serving tree from what stands at rest. Every shape fault reads `unreadable` with its reason. */
export function decodeServingTree(bytes: Uint8Array | null): ServingTreeReading {
  if (bytes === null) return { reading: "absent" };
  try {
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("the serving tree reads no object");
    for (const k of Object.keys(raw)) {
      if (k !== "skCheck" && k !== "vkEntry") throw new Error(`the serving tree names a field this build writes nothing into ("${k}")`);
    }
    fromHex(raw.skCheck, CHECK_LENGTH, "the tree's SK check");
    const entry = raw.vkEntry as Record<string, unknown> | undefined;
    if (entry === undefined || entry === null || typeof entry !== "object") {
      throw new Error("the serving tree holds no VK entry, so no human route reaches its SK");
    }
    for (const k of Object.keys(entry)) {
      if (k !== "nonce" && k !== "wrapped") throw new Error(`the VK entry names a field this build writes nothing into ("${k}")`);
    }
    fromHex(entry.nonce, NONCE_LENGTH, "the VK entry's nonce");
    fromHex(entry.wrapped, SK_LENGTH + TAG_LENGTH, "the VK entry's wrapped SK");
    return {
      reading: "readable",
      tree: { skCheck: raw.skCheck as string, vkEntry: { nonce: entry.nonce as string, wrapped: entry.wrapped as string } },
    };
  } catch (err) {
    return { reading: "unreadable", why: (err as Error).message };
  }
}
