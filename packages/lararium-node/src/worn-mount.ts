/**
 * worn-mount (node adapter) — WHICH face a reboot mounts.
 *
 * The reading itself is PLATFORM-BLIND and lives in mesh (`persona-vault#readWornPersonaMount`), over the
 * `PersonaVault` every vessel class already implements: `wear` moves a pointer on every platform, so the
 * bug and its cure belong to neither. This file is the node shore — the fs vault — and nothing else.
 */

import { readWornPersonaMount as readWornMountFromVault, type WornPersonaMount } from "@lararium/mesh";
import { makeNodeFsPersonaVault } from "./node-vessel-identity.js";

export type { WornPersonaMount };

/** The face this vessel WEARS, when a reboot owes it a mount-switch — or `null` when it owes none. */
export async function readWornPersonaMount(_dataDir: string): Promise<WornPersonaMount | null> {
  return readWornMountFromVault(await makeNodeFsPersonaVault());
}
