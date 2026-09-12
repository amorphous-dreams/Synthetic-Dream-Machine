/**
 * key-class — EVERY KEY NAMES ITS CLASS (basket-one #/the-phone-seat, ruled 2026-09-11: "PRF wraps beside and
 * never mints, a synced passkey counts as a cloud, every key names its class in vault status").
 *
 * THE VOCABULARY IS CLOSED. Three classes and no fourth:
 *   · `device-minted` — minted on THIS device, its private half never leaves: the vessel key (veil ruling: the
 *     dyad veil derives per-handle from it), and the veil that derives from it.
 *   · `seed`          — the persona-root seed and what reconstructs it (a recovery share): the thing the veil
 *     ruling says a handle must NEVER derive from; layers ② and ③ only.
 *   · `cloud-synced`  — any key that reads IDENTICAL across devices (iCloud Keychain / Google Password Manager
 *     passkeys, a PRF output the vendor syncs). NONE stands today; the slot exists so a future PRF / passkey
 *     wrap MUST declare it, and a seed-class secret wearing a device-class name cannot pass by omission.
 *
 * PRF wraps the seed AT REST beside the cleartext finding (project_browser_key_custody: the raw seed sits
 * cleartext on disk; persona roots cannot go opaque); it never replaces the mint. A synced passkey = a cloud.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/the-phone-seat
 */

import { existsSync, readdirSync } from "node:fs";

export const KEY_CLASSES = ["device-minted", "seed", "cloud-synced"] as const;
export type KeyClass = (typeof KEY_CLASSES)[number];

/** The guard — the only door a string passes to become a KeyClass. */
export function isKeyClass(v: unknown): v is KeyClass {
  return typeof v === "string" && (KEY_CLASSES as readonly string[]).includes(v);
}

/** One key the vessel holds, by name and class; the file that carries it, for the operator's eye. */
export interface KeyCensusEntry {
  readonly name:  string;
  readonly class: KeyClass;
  readonly file:  string;
}

/**
 * Census the identity dir: every key-bearing file, named and classed. A card is PUBLIC and never listed.
 * An absent or unreadable dir names no keys and faults nothing — the status line still renders.
 */
export function vesselKeyCensus(identityDir: string): KeyCensusEntry[] {
  let names: string[];
  try { names = existsSync(identityDir) ? readdirSync(identityDir) : []; } catch { return []; }
  const out: KeyCensusEntry[] = [];
  for (const f of names.sort()) {
    if (/^\.vessel-key(-[^.]+)?\.json$/.test(f))                   out.push({ name: "vessel-key", class: "device-minted", file: f });
    else if (f === "veil-archive.bin")                              out.push({ name: "veil",       class: "device-minted", file: f });
    else if (f === "keyhive-archive.bin")                           out.push({ name: "keyhive-archive", class: "device-minted", file: f });
    else {
      const root = /^\.persona-group-root(?:-[^.]+?)?-h(\d+)\.json$/.exec(f);
      if (root)                                                     out.push({ name: `persona-root-h${root[1]}`, class: "seed", file: f });
      else if (/^recovery-device-share-h\d+\.bin$/.test(f))       out.push({ name: f.replace(/\.bin$/, ""), class: "seed", file: f });
      else if (f === "seal-reserve-mine-share.bin")                 out.push({ name: "seal-reserve-mine-share", class: "seed", file: f });
    }
  }
  return out;
}
