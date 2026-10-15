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
 *   --hearth         THE STABLE FOUNDING ACT: the place, persona zero, its one-seat PRIVATE seed charter (the seat's
 *                    own key, its cold next key printed on a card and read back), and the face that binds the
 *                    charter's Nexus AID. Needs --name '<label>' (persona zero's private label); --chair '<label>'
 *                    names the chair privately.
 *
 * TWO ROADS, ONE VERB. Bare, it founds a PLACE with no face (a herm's rite, or a vessel about to join a face by
 * `lares fleet join`); `--hearth` runs the Stable founding act. A face founds at a hearth alone: `persona new 0` on
 * a place with no seed charter refuses by name.
 */

import { OldShapeRefusal, assertNoOldCustodyShape, seatFingerprint, type SlotSpec } from "@lararium/mesh";
import {
  runInit, runFoundHearth, ownedStore, StoreHeld, CustodyFoundingRefused, FsCustodyIo, custodyTreeStands,
  CustodyLockRefused, HearthFoundingRefused, NameTooLong, vkSealedCarriers, vkSlotsPath,
} from "@lararium/node";
import { larDataDir, larGenesisDir, larIdentityDir, larSealHome } from "../env.js";
import { CredentialTtyRefusal, gatherFoundingRoute } from "../custody-prompt.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";

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
  if (err instanceof HearthFoundingRefused) {
    return { name: "HearthFoundingRefused", advice: "" };
  }
  // The card printer loads at the act, so its refusal reads by name here.
  if (err instanceof Error && err.name === "CardReadBackRefused") {
    return { name: "CardReadBackRefused", advice: "the seed charter waits on its card's read-back; nothing of the charter or the face was written." };
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
  try {
    const homes = { identity: larIdentityDir(), storage: storageDir, seal: larSealHome() };
    const io = new FsCustodyIo(homes);
    // A standing tree needs no new route and no census; otherwise the store's shape is read FIRST, the route second.
    let slots: readonly SlotSpec[] = [];
    if (!(await custodyTreeStands(io, homes))) {
      // THE STORE'S SHAPE, READ BEFORE ANY ROUTE GETS ASKED: the sealed writer's own founding check, as a read. A
      // store that holds a carrier and no tree refuses `OldShapeRefusal` here, before the operator types anything;
      // the founding itself runs the same check again under its custody claim.
      await assertNoOldCustodyShape({ io, treePath: vkSlotsPath(homes.identity), carriers: vkSealedCarriers(homes) });
      slots = await gatherRoute();
    }
    if (args.flags["hearth"] === true) return await foundHearth(args, { storageDir, genesisDir, slots });
    await ownedStore(storageDir, (repo) => runInit({
      repo, storageDir, genesisDir, custody: { slots },
      ...(args.flags["force"] ? { force: true } : {}),
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

/**
 * THE STABLE FOUNDING ACT at the terminal. The custody route was gathered above (one prompt); the act runs under the
 * store's one holder, and the card prints and reads back on this terminal before the charter moves (on a staged
 * test root the read-back stands in, and the JSON answer then carries the card's code).
 */
async function foundHearth(args: ParsedArgs, at: { storageDir: string; genesisDir: string; slots: readonly SlotSpec[] }): Promise<number> {
  const name = typeof args.options["name"] === "string" ? args.options["name"].trim() : "";
  if (name.length === 0) throw new HearthFoundingRefused("persona zero needs a private label: --name '<label>'. Nothing was written.");
  const chair = typeof args.options["chair"] === "string" ? args.options["chair"].trim() : "";
  // The card's terminal read-back rides the one cold-card printer. It loads here, at the act, so a founding's
  // module graph (which a test's setup file loads before the test's own mocks) stays as light as the bare road's.
  const { readBack } = await import("../cold-card-readback.js");
  let printed: Array<Record<string, string>> = [];
  const founded = await ownedStore(at.storageDir, (repo) => runFoundHearth({
    repo, storageDir: at.storageDir, genesisDir: at.genesisDir, custody: { slots: at.slots },
    ...(args.flags["force"] ? { force: true } : {}),
    name, ...(chair ? { chair } : {}),
    readBack: async (cards, fingerprint) => { printed = await readBack(args, cards, 1, fingerprint); },
  }));
  emit(args, {
    ok: true,
    data: {
      nexusAid: founded.nexusAid, seatKey: founded.seatKey, seatFingerprint: founded.seatKey ? seatFingerprint(founded.seatKey) : null,
      nextDigest: founded.nextDigest, charterSeated: founded.charterSeated, posture: "private", cards: printed,
      personaGroupId: founded.face.personaGroupId, faceStood: founded.face.alreadyStood,
    },
    human: () => {
      console.log(`[lares vessel found --hearth] the hearth stands: ${founded.nexusAid}`);
      console.log(`  seed charter  one seat, threshold one, PRIVATE${founded.charterSeated ? "" : " (it stood from an earlier run)"}`);
      if (founded.seatKey) console.log(`  seat          ${seatFingerprint(founded.seatKey)}  (its key rests sealed here; its next key rests on the card alone)`);
      console.log(`  persona zero  "${name}"${founded.face.alreadyStood ? " (it stood from an earlier run)" : ""}; its edge binds this hearth`);
      console.log("  stand it:     lares vessel stand");
    },
  });
  return 0;
}
