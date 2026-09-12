/**
 * key-class — EVERY KEY NAMES ITS CLASS. The one vocabulary every vessel reads (basket-one #/the-phone-seat,
 * ruled 2026-09-11: "PRF wraps beside and never mints, a synced passkey counts as a cloud, every key names its
 * class in vault status").
 *
 * THE VOCABULARY IS CLOSED. Three classes and no fourth:
 *   · `device-minted` — minted on THIS device, its private half never leaves: the vessel key (the veil ruling:
 *     the dyad veil derives per-handle from it), and the veil that derives from it.
 *   · `seed`          — the persona-root seed and what reconstructs it (a recovery share): the thing the veil
 *     ruling says a handle must NEVER derive from.
 *   · `cloud-synced`  — any key that reads IDENTICAL across devices (iCloud Keychain / Google Password Manager
 *     passkeys, a PRF output the vendor syncs). A seed-class secret wearing a device-class name cannot pass
 *     by omission once every holder declares.
 *
 * Pure and isomorphic: the node's census (fs), keyhive's veil brand and the browser's seed wrap all read this
 * one spelling. Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/the-phone-seat
 */

export const KEY_CLASSES = ["device-minted", "seed", "cloud-synced"] as const;
export type KeyClass = (typeof KEY_CLASSES)[number];

/** The guard — the only door a string passes to become a KeyClass. */
export function isKeyClass(v: unknown): v is KeyClass {
  return typeof v === "string" && (KEY_CLASSES as readonly string[]).includes(v);
}
