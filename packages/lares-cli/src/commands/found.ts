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
 *   --restore FILE   (with --hearth) A RESTORE AS PERSONA ZERO: the act lands the face a backup bundle carries as
 *                    persona zero, at a fresh seed charter and a fresh chair, instead of minting a fresh root. The
 *                    bundle's own route reads on a terminal; --name may stay off (the bundle's pet-name lands).
 *
 * TWO ROADS, ONE VERB. Bare, it founds a PLACE with no face (a herm's rite, or a vessel about to join a face by
 * `lares fleet join`); `--hearth` runs the Stable founding act. A face founds at a hearth alone: `persona new 0` on
 * a place with no seed charter refuses by name.
 */

import { readFileSync } from "node:fs";
import { OccupiedStoreRefusal, assertStoreUnoccupied, openBundleKey, readFaceBundle, seatFingerprint, type Credential, type SlotSpec } from "@lararium/mesh";
import {
  runInit, runFoundHearth, ownedStore, StoreHeld, CustodyFoundingRefused, FsCustodyIo, custodyTreeStands,
  CustodyLockRefused, HearthFoundingRefused, NameTooLong, occupantCarriers, sSlotsPath,
} from "@lararium/node";
import { larDataDir, larGenesisDir, larIdentityDir, larSealHome } from "../env.js";
import { CredentialTtyRefusal, gatherCredentials, gatherFoundingRoute } from "../custody-prompt.js";
import { restoreLines, type RestoreLanded } from "../vault-restore.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { noteFoundingNodeRoute, seatNewFaceRoute } from "../face-route-prompt.js";

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

/**
 * The bundle's route, for a restore as persona zero: the passphrase or paper sheet the bundle got sealed under, read
 * on a TTY by default. A test installs its own; no flag and no env var carries it.
 */
export type BundleRoute = () => Promise<readonly Credential[]>;
let gatherBundle: BundleRoute = () => gatherCredentials("lares vessel found --hearth --restore");
export function setFoundingBundleRoute(gather: BundleRoute): void { gatherBundle = gather; }

/** The refusals a founding names on one line each, with their advice; every other error keeps its own voice. */
function foundingRefusal(err: unknown): { name: string; advice: string } | null {
  if (err instanceof CredentialTtyRefusal) return { name: "CredentialTtyRefusal", advice: "" };
  if (err instanceof CustodyFoundingRefused) {
    return { name: "CustodyFoundingRefused", advice: "a founding seals custody from birth and binds a human route; none was gathered." };
  }
  if (err instanceof StoreHeld) {
    return { name: "StoreHeld", advice: "a founding runs with no vessel standing — stop the standing vessel, then found." };
  }
  if (err instanceof OccupiedStoreRefusal) {
    return { name: "OccupiedStoreRefusal", advice: "nothing was written and no route was asked. This store holds carriers no slot tree commits to; found into an empty root (LAR_ROOT)." };
  }
  if (err instanceof CustodyLockRefused) {
    return { name: "CustodyLockRefused", advice: "another process holds this custody; let it finish, then found again." };
  }
  if (err instanceof HearthFoundingRefused) {
    return { name: "HearthFoundingRefused", advice: err.restoreRefusal ? "a restore refuses before its commit row; one that stopped after it completes when the same founding runs again with the same bundle." : "" };
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
  seatNewFaceRoute();
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
      // store that holds a carrier and no tree refuses `OccupiedStoreRefusal` here, before the operator types anything;
      // the founding itself runs the same check again under its custody claim.
      await assertStoreUnoccupied({ io, treePath: sSlotsPath(homes.identity), carriers: occupantCarriers(homes) });
      slots = await gatherRoute();
      noteFoundingNodeRoute(slots);
    }
    if (args.flags["hearth"] === true) return await foundHearth(args, { storageDir, genesisDir, slots });
    const { readBack } = await import("../cold-card-readback.js");
    await ownedStore(storageDir, (repo) => runInit({
      repo, storageDir, genesisDir, custody: { slots },
      placeFoundingCard: { readBack: async (card, fingerprint, generation) => {
        await readBack(args, [{ chair: "place", seed: card.seed, digest: card.digest }], generation, fingerprint);
      } },
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
  const restoreFile = typeof args.options["restore"] === "string" ? args.options["restore"] : undefined;
  if (name.length === 0 && restoreFile === undefined) throw new HearthFoundingRefused("persona zero needs a private label: --name '<label>'. Nothing was written.");
  const restore = restoreFile === undefined ? undefined : await openRestoreBundle(restoreFile);
  const chair = typeof args.options["chair"] === "string" ? args.options["chair"].trim() : "";
  // The card's terminal read-back rides the one cold-card printer. It loads here, at the act, so a founding's
  // module graph (which a test's setup file loads before the test's own mocks) stays as light as the bare road's.
  const { readBack } = await import("../cold-card-readback.js");
  let printed: Array<Record<string, string>> = [];
  let founded: Awaited<ReturnType<typeof runFoundHearth>>;
  try {
    founded = await ownedStore(at.storageDir, (repo) => runFoundHearth({
      repo, storageDir: at.storageDir, genesisDir: at.genesisDir, custody: { slots: at.slots },
      ...(args.flags["force"] ? { force: true } : {}),
      name, ...(chair ? { chair } : {}), ...(restore ? { restore } : {}),
      placeFoundingCard: { readBack: async (card, fingerprint, generation) => {
        await readBack(args, [{ chair: "place", seed: card.seed, digest: card.digest }], generation, fingerprint);
      } },
      readBack: async (cards, fingerprint) => { printed = await readBack(args, cards, 1, fingerprint); },
    }));
  } finally { restore?.bundleKey.fill(0); }
  const restored: RestoreLanded | null = founded.restored === null ? null : { ok: true, kind: "restore", via: "direct", ...founded.restored };
  emit(args, {
    ok: true,
    data: {
      nexusAid: founded.nexusAid, seatKey: founded.seatKey, seatFingerprint: founded.seatKey ? seatFingerprint(founded.seatKey) : null,
      nextDigest: founded.nextDigest, charterSeated: founded.charterSeated, posture: "private", cards: printed,
      personaGroupId: founded.face.personaGroupId, faceStood: founded.face.alreadyStood,
      ...(restored ? { restored } : {}),
    },
    human: () => {
      console.log(`[lares vessel found --hearth] the hearth stands: ${founded.nexusAid}`);
      console.log(`  seed charter  one seat, threshold one, PRIVATE${founded.charterSeated ? "" : " (it stood from an earlier run)"}`);
      if (founded.seatKey) console.log(`  seat          ${seatFingerprint(founded.seatKey)}  (its key rests sealed here; its next key rests on the card alone)`);
      if (restored) {
        console.log("  persona zero  the restored face; its edge binds this hearth, and its fresh chair holds the seat");
        for (const line of restoreLines(restored)) console.log(`  ${line}`);
        return;
      }
      console.log(`  persona zero  "${name}"${founded.face.alreadyStood ? " (it stood from an earlier run)" : ""}; its edge binds this hearth`);
      console.log("  stand it:     lares vessel stand");
    },
  });
  return 0;
}

/**
 * Open the bundle a restore as persona zero names, in this process: read the file, open its slot tree under the
 * bundle's own route, and hand the body still sealed, beside the bundle key, to the founding act. Refuses by name
 * before any byte of the founding moves. The caller zero-fills the key.
 */
async function openRestoreBundle(file: string): Promise<{ readonly sealedBody: Uint8Array; readonly bundleKey: Uint8Array }> {
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(readFileSync(file)); }
  catch (err) { throw new HearthFoundingRefused(`bundle-unreadable: no bundle reads at ${file} (${(err as NodeJS.ErrnoException).code ?? "unreadable"}). Nothing was written.`); }
  const read = readFaceBundle(bytes);
  if (read.reading !== "readable") throw new HearthFoundingRefused(`bundle-malformed: ${file} reads as no backup bundle (${read.why}). Nothing was written.`);
  const opened = openBundleKey(read.tree, await gatherBundle());
  if (opened.reading !== "opens") throw new HearthFoundingRefused(`no-slot-opens: no route of the bundle opens under what was presented${opened.notes.length ? ` (${opened.notes.join("; ")})` : ""}. Nothing was written.`);
  return { sealedBody: read.sealedBody, bundleKey: opened.bundleKey };
}
