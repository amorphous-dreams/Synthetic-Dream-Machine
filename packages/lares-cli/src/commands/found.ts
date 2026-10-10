/**
 * `lares vessel found` — bootstrap a new Lararium node.
 *
 * Thin shim over `runInit` from @lararium/node. Idempotent; pass --force to
 * re-seed when the social bootstrap already lives on disk (<lares>/vessel — see larBootstrapPath).
 *
 * A FOUNDING RUNS WITH NO VESSEL STANDING. It holds the store for its act (`ownedStore`), so a vessel standing
 * on the same store refuses it by name, before any key mints and before any byte of the store moves.
 *
 * Flags:
 *   --force          Re-seed even when bootstrap artifact exists.
 *   --root DIR       Isolate storage + genesis under DIR (overrides LAR_ROOT env).
 *   --storage DIR    Explicit override for Automerge NodeFS storage directory.
 *   --genesis DIR    Explicit override for genesis/ directory.
 *   --admit FILE     Apply a device-admit/v1 JSON payload instead of founding a new Nexus.
 */

import { join } from "node:path";
import { runInit, ownedStore, StoreHeld } from "@lararium/node";
import { larDataDir, larRoot } from "../env.js";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdFound(args: ParsedArgs): Promise<number> {
  // ONLY an explicit --root sets LAR_ROOT (never a default — that would defeat the ~/.lares uplift).
  if (args.options["root"]) process.env["LAR_ROOT"] = args.options["root"];
  // storage (runtime) → <lares>/vessel (larDataDir); genesis (the baked seed) stays corpus-relative.
  const storageDir = args.options["storage"] ?? larDataDir();
  const genesisDir = args.options["genesis"] ?? join(larRoot(), "genesis");
  const admitPayloadPath = args.options["admit"];
  try {
    await ownedStore(storageDir, (repo) => runInit({
      repo, storageDir, genesisDir,
      ...(args.flags["force"] ? { force: true } : {}),
      ...(admitPayloadPath ? { admitPayloadPath } : {}),
    }));
  } catch (err) {
    if (!(err instanceof StoreHeld)) throw err;
    console.error(`[lares vessel found] refused: ${err.message}`);
    console.error("  a founding runs with no vessel standing — stop the standing vessel, then found.");
    return 1;
  }
  return 0;
}
