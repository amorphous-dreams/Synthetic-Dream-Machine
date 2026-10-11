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

import { OldShapeRefusal, bindSlot, commitSlotTree, mintVk, type CustodyIo, type SlotSpec } from "@lararium/mesh";
import {
  runInit, ownedStore, StoreHeld, CustodyFoundingRefused, FsCustodyIo, custodyTreeStands,
  CustodyLockRefused, NameTooLong, vkSealedCarriers, vkSlotsPath, type CustodyHomes,
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

/** Thrown by the dry census's write, so a census that finds no old shape stops before any byte lands. */
class CensusClean extends Error {}

/**
 * THE STORE'S SHAPE, READ BEFORE ANY ROUTE IS ASKED. A founding over a store that holds a carrier and no tree refuses
 * `OldShapeRefusal`; asked after the route, the operator types a passphrase twice and then meets the refusal. This runs
 * the sealed writer's own founding check (`commitSlotTree` with `expected: null`) over a read-only view of the store:
 * the check throws `OldShapeRefusal` before its first write, and a store that passes reaches the view's `write`, which
 * stops the act with `CensusClean`. Nothing lands (it takes no custody claim either: the claim's lock file would land
 * in the identity home) and the check stays the writer's own; the founding itself re-runs the check under the claim.
 */
async function assertNoOldShape(io: CustodyIo, homes: CustodyHomes): Promise<void> {
  const vk = mintVk();
  const tree = bindSlot(null, vk, { t: 1, pins: [{ kind: "passphrase", passphrase: "census-only" }] });
  const readOnly: CustodyIo = {
    read: (p) => io.read(p),
    list: () => io.list(),
    exclusive: (fn) => fn(),     // a read takes no custody claim (the claim's lock file would land in the identity home)
    write: () => Promise.reject(new CensusClean()),
    rename: () => Promise.reject(new CensusClean()),
    remove: () => Promise.reject(new CensusClean()),
  };
  try {
    await commitSlotTree({ io: readOnly, path: vkSlotsPath(homes.identity), expected: null, vk, tree, carriers: vkSealedCarriers(homes) });
  } catch (err) {
    if (!(err instanceof CensusClean)) throw err;
  }
}

/** The refusals a founding names on one line each, with their advice; every other error keeps its own voice. */
function foundingRefusal(err: unknown): { name: string; advice: string } | null {
  if (err instanceof CredentialTtyRefusal) return { name: "CredentialTtyRefusal", advice: "" };
  if (err instanceof CustodyFoundingRefused) {
    return { name: "CustodyFoundingRefused", advice: "a founding seals custody from birth and binds a human route; none was gathered." };
  }
  if (err instanceof StoreHeld) {
    return { name: "StoreHeld", advice: "a founding runs with no vessel standing — stop the standing vessel, then found." };
  }
  if (err instanceof OldShapeRefusal) {
    return { name: "OldShapeRefusal", advice: "nothing was written and no route was asked. This store holds carriers from an earlier shape; found into an empty root (LAR_ROOT) or follow the fresh-start runbook." };
  }
  if (err instanceof CustodyLockRefused) {
    return { name: "CustodyLockRefused", advice: "another process holds this custody; let it finish, then found again." };
  }
  if (err instanceof NameTooLong) {
    return { name: "NameTooLong", advice: "the store path is too deep for a Unix socket name (about 108 bytes); found under a shorter LAR_ROOT." };
  }
  return null;
}

export async function cmdFound(args: ParsedArgs): Promise<number> {
  // ONLY an explicit --root sets LAR_ROOT (never a default — that would defeat the ~/.lares uplift).
  if (args.options["root"]) process.env["LAR_ROOT"] = args.options["root"];
  // storage (runtime) → <lares>/vessel (larDataDir); genesis (the baked seed) stays corpus-relative.
  const storageDir = args.options["storage"] ?? larDataDir();
  const genesisDir = args.options["genesis"] ?? larGenesisDir();   // --genesis → LAR_GENESIS → <root>/genesis
  const admitPayloadPath = args.options["admit"];
  try {
    const homes = { identity: larIdentityDir(), storage: storageDir, seal: larSealHome() };
    const io = new FsCustodyIo(homes);
    // A standing tree needs no new route and no census; otherwise the store's shape is read FIRST, the route second.
    let slots: readonly SlotSpec[] = [];
    if (!(await custodyTreeStands(io, homes))) {
      await assertNoOldShape(io, homes);
      slots = await gatherRoute();
    }
    await ownedStore(storageDir, (repo) => runInit({
      repo, storageDir, genesisDir, custody: { slots },
      ...(args.flags["force"] ? { force: true } : {}),
      ...(admitPayloadPath ? { admitPayloadPath } : {}),
    }));
  } catch (err) {
    const refusal = foundingRefusal(err);
    if (refusal === null) throw err;
    console.error(`[lares vessel found] refused: ${refusal.name}: ${(err as Error).message}`);
    if (refusal.advice) console.error(`  ${refusal.advice}`);
    return 1;
  }
  return 0;
}
