/**
 * vessel-bag-tier — the node-fs shore for the crossing gate's tier reader.
 *
 * The gate prices a transfer by DIRECTION (`crossingDirection`), and direction wants each bag's
 * publicity tier. The rule lives in mesh, the gate in tw5, the injection door in keyhive
 * (`DaemonExtra.bagTier`) — all three fs-blind. This module is the disk: it reads the `meta.mem`
 * a hearth bag declares (`readBagManifest`, fail-closed through `parseCapTier`) and answers the
 * gate's question, `bagUrl -> CapTier | null`.
 *
 * FAIL-CLOSED BY SHAPE. A URL that is not exactly `lar:///ha.ka.ba/bags/<name>`, a name carrying a
 * path separator, a bag with no hearth directory — every one answers null, and the gate reads null
 * as VEIL, the tightest tier. Growing this reader (the repository leg, a catalog source) can only
 * TIGHTEN a crossing that today reads lateral, never loosen one.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/cap-tier
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BagHomeRoots, CapTier } from "@lararium/mesh";
import { bagHomeRoots, readBagManifest } from "./bag-declare.js";

/** The exact address shape a bag manifest mints for itself (`renderBagManifest`). Nothing looser. */
const BAG_URL_PREFIX = "lar:///ha.ka.ba/bags/";

/** The bag name a bag URL carries, or null when the string is not a bag URL at all. */
export function bagNameFromBagUrl(bagUrl: string): string | null {
  if (!bagUrl.startsWith(BAG_URL_PREFIX)) return null;
  const name = bagUrl.slice(BAG_URL_PREFIX.length);
  if (!name || name.includes("/") || name.includes("\\") || name.startsWith(".")) return null;
  return name;
}

/**
 * Build the gate's tier reader over this vessel's hearth.
 *
 * Hearth-only on purpose: a repository-homed bag's manifest lives wherever the repo does, and
 * resolving that wants the registry walk — the follow-on leg. Until it lands, a repo bag answers
 * null and the gate reads it VEIL: tighter than its declaration, never looser. The manifest is
 * capability-bearing input, so every read observes the current local declaration. A wall-clock
 * cache would make a stale tier authoritative for an arbitrary interval and would reintroduce
 * precisely the implicit freshness policy this shore is meant to avoid.
 */
export function makeBagTierReader(roots: BagHomeRoots = bagHomeRoots()): (bagUrl: string) => CapTier | null {
  return (bagUrl: string): CapTier | null => readTierFromHearth(bagUrl, roots);
}

function readTierFromHearth(bagUrl: string, roots: BagHomeRoots): CapTier | null {
  const name = bagNameFromBagUrl(bagUrl);
  if (!name) return null;
  const bagDir = join(roots.hearth, name);
  if (!existsSync(bagDir)) return null;
  return readBagManifest(bagDir, name).tier;
}
