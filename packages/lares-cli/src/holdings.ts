/**
 * holdings — the disk holdings a seed feeds and where their canon stands, read apart from any command so a door that
 * names holdings (seed, shore, import) reads them without reaching another command's handler.
 */

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { bagUri } from "@lararium/mesh";
import { daemonBagsDir, projectionRoots } from "@lararium/node";
import { larProjectionsDirOrNone } from "./env.js";

/**
 * The holdings map — every dir under the BAGS DIR, discovered, never hardcoded.
 *
 * THE BAGS DIR SITES ON ITS OWN CAP (`larBagsDir`: `LAR_BAGS`, else `<corpus>/bags`), the same cap the daemon's
 * projection and the `ingest` and `act` gestures read. A vessel whose state and corpus rest on two mounts (the
 * container: `LAR_ROOT=/state`, `LAR_BAGS=/workspace/bags`) holds its bags apart from its root, so a seed that
 * joined `bags` onto the root read an empty map there and planted nothing.
 */
export function discoverHoldings(bagsDir: string): Array<{ holding: string; source: string; toBag: string }> {
  let names: string[] = [];
  try {
    // EVERY DIRECTORY UNDER bags/ IS A HOLDING. The kind-plane segment above already says these are bags,
    // so the entity name carries no marker of its own — and a filter demanding one matches nothing, returns
    // an empty roster, and seeds silently with a clean exit.
    names = readdirSync(bagsDir).filter((n) => !n.startsWith(".") && statSync(join(bagsDir, n)).isDirectory());
  } catch { return []; }
  return names.sort().map((holding) => ({
    holding,
    source: join(bagsDir, holding),
    // The disk dir `elyncia` names bag `bags/elyncia` — mint through bagUri so the seed
    // targets the bag the daemon registers.
    toBag: bagUri(holding),
  }));
}

/**
 * WHETHER A HOLDING'S CANON STANDS ON DISK, read from the bag's resolution: its source dir stands under the canon
 * source the daemon resolves, and the projection split by origin counts it sourced (a private plane never does).
 */
export function canonIsDisk(h: { holding: string; source: string }, canonBags: string = daemonBagsDir()): boolean {
  const roots = projectionRoots({ projectionRoot: larProjectionsDirOrNone() ?? canonBags, canonBags });
  return roots.sourcedSlugs().includes(h.holding) && resolve(h.source) === resolve(roots.bagRoot(h.holding));
}
