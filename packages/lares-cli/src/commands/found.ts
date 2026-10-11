/**
 * `lares vessel found` — bootstrap a new Lararium node.
 *
 * Thin shim over `runInit` from @lararium/node. Idempotent; pass --force to
 * re-seed when the social bootstrap already lives on disk (<lares>/vessel — see larBootstrapPath).
 *
 * A FOUNDING RUNS WITH NO VESSEL STANDING. It holds the store for its act (`ownedStore`), so a vessel standing
 * on the same store refuses it by name, before any key mints and before any byte of the store moves.
 *
 * The human route is read on a TTY (passphrase and/or paper pin); with no TTY the founding refuses by name.
 *
 * Flags:
 *   --force          Re-seed even when bootstrap artifact exists.
 *   --root DIR       (or --root=DIR) Isolate storage + genesis under DIR (overrides LAR_ROOT env).
 *   --storage DIR    Explicit override for Automerge NodeFS storage directory.
 *   --genesis DIR    Explicit override for genesis/ directory (else LAR_GENESIS, else <root>/genesis).
 *   --admit FILE     Apply a device-admit/v1 JSON payload instead of founding a new Nexus.
 */

import type { SlotSpec } from "@lararium/mesh";
import {
  runInit, ownedStore, StoreHeld, CustodyFoundingRefused, FsCustodyIo, custodyTreeStands,
} from "@lararium/node";
import { larDataDir, larGenesisDir, larIdentityDir, larSealHome } from "../env.js";
import { CredentialTtyRefusal, gatherFoundingRoute } from "../custody-prompt.js";
import type { ParsedArgs } from "../parse-args.js";

/**
 * The founding route: the human route (a passphrase or paper pin) the custody binds at birth.
 *
 * A founding seals custody from birth, so `runInit` REQUIRES a route. This is the one seam that gathers it: by
 * default a TTY prompt (`gatherFoundingRoute`), which refuses by name with no TTY and names the container recipe.
 * A test installs its own (`tests/support/found-route.ts`); no flag and no env var carries a credential. The seam is
 * asked ONLY when no slot tree stands: a standing custody needs no new route.
 */
export type FoundingRoute = () => Promise<readonly SlotSpec[]>;
let gatherRoute: FoundingRoute = gatherFoundingRoute;
export function setFoundingRoute(gather: FoundingRoute): void { gatherRoute = gather; }

export async function cmdFound(args: ParsedArgs): Promise<number> {
  // ONLY an explicit --root sets LAR_ROOT (never a default — that would defeat the ~/.lares uplift).
  if (args.options["root"]) process.env["LAR_ROOT"] = args.options["root"];
  // storage (runtime) → <lares>/vessel (larDataDir); genesis (the baked seed) stays corpus-relative.
  const storageDir = args.options["storage"] ?? larDataDir();
  const genesisDir = args.options["genesis"] ?? larGenesisDir();   // --genesis → LAR_GENESIS → <root>/genesis
  const admitPayloadPath = args.options["admit"];
  try {
    const homes = { identity: larIdentityDir(), storage: storageDir, seal: larSealHome() };
    const slots = (await custodyTreeStands(new FsCustodyIo(homes), homes)) ? [] : await gatherRoute();
    await ownedStore(storageDir, (repo) => runInit({
      repo, storageDir, genesisDir, custody: { slots },
      ...(args.flags["force"] ? { force: true } : {}),
      ...(admitPayloadPath ? { admitPayloadPath } : {}),
    }));
  } catch (err) {
    if (err instanceof CredentialTtyRefusal) {
      console.error(`[lares vessel found] refused: CredentialTtyRefusal: ${err.message}`);
      return 1;
    }
    if (err instanceof CustodyFoundingRefused) {
      console.error(`[lares vessel found] refused: ${err.message}`);
      console.error("  a founding seals custody from birth and binds a human route; none was gathered.");
      return 1;
    }
    if (!(err instanceof StoreHeld)) throw err;
    console.error(`[lares vessel found] refused: ${err.message}`);
    console.error("  a founding runs with no vessel standing — stop the standing vessel, then found.");
    return 1;
  }
  return 0;
}
