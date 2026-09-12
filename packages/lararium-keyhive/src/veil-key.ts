/**
 * veil-key — THE VEIL DERIVES FROM A DEVICE-MINTED KEY AND NOTHING ELSE (the veil ruling, 2026-09-05).
 *
 * The dyad veil derives per-handle from the DEVICE-MINTED vessel key — never the persona-root seed (layers ②
 * and ③ only), never a cloud-synced key (a passkey the vendor syncs reads identical on every device: a seed
 * wearing a device name; `packages/lararium-node/src/key-class.ts` names the closed vocabulary). The mesh
 * `deriveDyadVeil` takes raw bytes and cannot tell the three apart. This door can.
 *
 * ── THE BRAND ────────────────────────────────────────────────────────────────────────────────────
 * `DeviceMintedKey` carries a type-level brand no literal can spell, so a raw `Uint8Array` or a `ClassedKey`
 * of another class refuses at compile time. The brand also stands at RUNTIME: every key the ONE door
 * (`mintDeviceMintedKey`) mints enters a module-private WeakSet, and the derivation refuses a key it never
 * minted with a NAMED error — a caller that forges `{ class: "device-minted", seed }` never passes.
 *
 * The door mints where the vessel key stands: the ceremony core (whose `vesselSeed` input IS the per-vessel
 * device seed by contract) and the browser vessel-identity store. A persona root never reaches it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/pattern-integrity-rhymes
 */

import { deriveDyadVeil } from "@lararium/mesh";

/** The closed key-class vocabulary — mirrors `key-class.ts` (node) without importing a node package. */
import type { KeyClass } from "@lararium/mesh";
/** The one vocabulary (mesh `key-class`); keyhive keeps its local name for the brand below. */
export type KeyClassName = KeyClass;

/** A key that names its class. Only the `device-minted` member gains the veil brand. */
export interface ClassedKey<C extends KeyClassName = KeyClassName> {
  readonly class: C;
  /** The 32-byte Ed25519 seed. */
  readonly seed:  Uint8Array;
}

declare const DEVICE_MINTED_BRAND: unique symbol;

/** The one key class the veil derives from — minted through `mintDeviceMintedKey` and nowhere else. */
export type DeviceMintedKey = ClassedKey<"device-minted"> & { readonly [DEVICE_MINTED_BRAND]: true };

const minted = new WeakSet<object>();

/** The refusal the derivation throws for any key the door never minted. */
export class VeilKeyClassRefused extends Error {
  override readonly name = "VeilKeyClassRefused";
  constructor(detail: string) {
    super(`[veil-key] the veil derives from a device-minted vessel key only — ${detail}`);
  }
}

/**
 * The ONE door: brand a per-vessel device seed as `DeviceMintedKey`. Call it where the vessel key mints or
 * loads from the vessel's own store — never on a persona root, never on a PRF output.
 */
export function mintDeviceMintedKey(seed: Uint8Array): DeviceMintedKey {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) {
    throw new VeilKeyClassRefused(`a device key is a 32-byte Ed25519 seed (got ${seed instanceof Uint8Array ? seed.length : typeof seed})`);
  }
  const key = Object.freeze({ class: "device-minted" as const, seed }) as DeviceMintedKey;
  minted.add(key);
  return key;
}

/** True only for a key the door minted — the runtime half of the brand. */
export function isDeviceMintedKey(v: unknown): v is DeviceMintedKey {
  return typeof v === "object" && v !== null && minted.has(v);
}

/**
 * Derive the dyad veil for `groupTag` from a device-minted key. Refuses, named, any key the door never
 * minted; otherwise byte-identical to the mesh `deriveDyadVeil(key.seed, groupTag)`.
 */
export async function deriveVeilFromDeviceKey(
  key: DeviceMintedKey,
  groupTag: string,
): Promise<{ signingKey: string; verifyingKey: string }> {
  if (!isDeviceMintedKey(key)) {
    const cls = typeof key === "object" && key !== null && "class" in key ? String((key as { class: unknown }).class) : "unclassed bytes";
    throw new VeilKeyClassRefused(`refused a key of class "${cls}" that never passed the mint door`);
  }
  return deriveDyadVeil(key.seed, groupTag);
}
