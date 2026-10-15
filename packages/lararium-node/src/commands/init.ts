/**
 * runInit — Node adapter: one-time social-plane bootstrap for a new Lararium node.
 *
 * Node-specific shores (only these belong here):
 *   - the store's one holder (`repo`): the direct holder's for a founding (`ownedStore`), with no vessel
 *     standing; the standing vessel's own Repo, or the direct holder's, for a face
 *   - generateOrLoadVesselIdentity / loadVesselSigningSeed (disk keypair)
 *   - writeFileSync for the social bootstrap (<lares>/vessel — see larBootstrapPath)
 *   - the composable genesis cap (daemonGenesisDir) for default directory resolution
 *
 * All ceremony logic lives in @lararium/keyhive (foundThePlace, foundTheFace,
 * runApplyAdmitPayload) and runs identically in browser + mobile vessels.
 *
 * THE TWO HALVES: `runInit` stands the PLACE alone — a vessel that carries and serves, holding no
 * human face. `runFoundTheFace` lands the persona half whenever an operator arrives to light it.
 *
 * Re-running stays idempotent: when the social bootstrap already lives
 * on disk, the function returns early without re-seeding.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { Repo } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, personaMembershipEntries, personaScopedBagIds,
  PERSONA_GROUP_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  nexusIdentity, nexusScopeOrThrow, nexusAidOf,
} from "@lararium/mesh";
import { daemonGenesisDir } from "../lares-config.js";
import { larDataDir, larBootstrapPath, larSealHome, larIdentityDir } from "../vessel-paths.js";
import { FsCustodyIo } from "../custody-io.js";
import { assertFoundingRoute, custodyTreeStands, foundCustody } from "../custody-session.js";
import { hearthDialTiddlers, readHearthDialPin } from "../hearth-dial-pin.js";
import { hearthAid } from "../hearth-aid.js";
import { readNexusDoc, nexusCharterStands } from "../nexus-doc.js";
import { admittedJoineeIsland } from "../nexus-standing.js";
import type { CarriedAdmitPayload } from "@lararium/keyhive";
import { listPersonaRoots } from "../node-vessel-identity.js";
import { persistIdentityAnchors, loadIdentityAnchors, loadIdentityArchive, persistIdentityArchive, persistVeilArchive, loadVeilArchive } from "../identity-anchors.js";
import { custodyVeilKeys, openedCustody, seatCustody } from "../custody-seat.js";
import { makeCustodyHolder } from "../custody-holder.js";
import { loadRecoveryDeviceShare } from "../recovery-share-store.js";
import { provisionRecoveryAtFounding } from "../recovery-keel.js";
import {
  generateOrLoadVesselIdentity, loadVesselSigningSeed, persistVesselCard,
  generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed,
} from "../node-vessel-identity.js";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { LarDoc, SlotSpec } from "@lararium/mesh";
import { GENESIS_ENGINE_CID } from "../genesis-artifact.js";
import {
  foundThePlace, foundTheFace, runApplyAdmitPayload,
} from "@lararium/keyhive";
import { SOCIAL_BOOTSTRAP_PLUGIN_TITLE } from "../open-node-vessel.js";

export interface InitOptions {
  /** The direct holder's Repo (`ownedStore`) over this vessel's store — a founding runs with no vessel standing. */
  readonly repo:        Repo;
  /** The directory `repo` holds. Defaults to `larDataDir()`. */
  readonly storageDir?: string;
  readonly genesisDir?: string;
  readonly force?:      boolean;
  /** A device-admit/v1 payload the fleet-join door's landing read out of a verified answer: it skips the founding
   *  ceremony and joins this vessel, a place that stands (with `force`), to the face's PersonaGroup. A second
   *  OPERATOR joins by carriage contract-receive. */
  readonly admitPayload?: CarriedAdmitPayload;
  /**
   * The human route the founding binds. REQUIRED: a founding seals the slot tree and the custody root from birth,
   * and a vessel with no passphrase or paper route has no way back in, so a founding without one refuses by name.
   */
  readonly custody: { readonly slots: readonly SlotSpec[] };
}

export interface InitResult {
  readonly skipped:       boolean;
  readonly bootstrapPath: string;
  readonly storageDir:    string;
  readonly genesisDir:    string;
}

function defaultDirs(): { storageDir: string; genesisDir: string } {
  return {
    storageDir: larDataDir(),        // the vessel substrate → <lares>/vessel
    // Baked seed rides the composable genesis cap (LAR_GENESIS → ~/.lares/config.json →
    // repo-relative <corpus>/genesis). Checked-in by default; a no-config boot lands on the repo seed.
    genesisDir: daemonGenesisDir(),
  };
}

type PackedTiddler  = { title: string; text: string; kind: string };
type PackedTiddlers = Record<string, PackedTiddler>;

/** Wrap a packed tiddler map as the bootstrap plugin the vessel reads at boot. */
function bootstrapPlugin(packedTiddlers: PackedTiddlers): object {
  return {
    title:         SOCIAL_BOOTSTRAP_PLUGIN_TITLE,
    "plugin-type": "plugin",
    type:          "application/json",
    tags:          "lar:///ha.ka.ba/tags/lararium-bootstrap",
    text:          JSON.stringify({ tiddlers: packedTiddlers }),
  };
}

/** What a PLACE bootstrap carries: its sovereign island, and nothing of any person. */
function placeTiddlers(daemonUrl: string): PackedTiddlers {
  return {
    [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: daemonUrl, kind: "oracle" },
  };
}

/**
 * A FACE'S REGISTER-MANY PLANE ENTRY — the four social planes, all named off the one tag this PersonaGroup's
 * doc id yields, plus the membership that names the group. This is what the boot's `readPersonaPlanes`
 * consumes to hold a compartment in the family (register-many), and it carries NO singular mount pin — so
 * one shape serves both the mounted founding face and every additional compartment a multitude holds.
 * A vessel-wide circles plane would name one shelf where a multitude needs one per face.
 */
function facePlaneTiddlers(
  identitiesUrl: string, circlesUrl: string, sessionsUrl: string, personaUrl: string,
  personaGroupId: string,
): PackedTiddlers {
  const face = personaScopedBagIds(personaGroupId);
  return {
    [face.identities]: { title: face.identities, text: identitiesUrl, kind: "oracle" },
    [face.circles]:    { title: face.circles,    text: circlesUrl,    kind: "oracle" },
    [face.sessions]:   { title: face.sessions,   text: sessionsUrl,   kind: "oracle" },
    // The PersonaGroup plane and the membership that names it — written through the same pair a vessel
    // standing in a SECOND compartment would add, so founding and admission lay down one shape. The boot
    // path reads the family back by derivation; nothing here holds an order or an index.
    ...Object.fromEntries(
      personaMembershipEntries({ personaGroupId: personaGroupId, url: personaUrl })
        .map((e) => [e.title, { title: e.title, text: e.text as string, kind: "oracle" }]),
    ),
  };
}

/** What the MOUNTED FACE adds: its register-many plane entry PLUS the singular sentinel pins the boot reads
 *  to run the ONE mounted face's Binding Gate. Only the founding face (h0) writes these. */
function faceTiddlers(
  identitiesUrl: string, circlesUrl: string, sessionsUrl: string, personaUrl: string,
  personaGroupId: string, meshCabalDocIdHex: string,
): PackedTiddlers {
  return {
    [MESH_CABAL_DOC_ID_TIDDLER]: { title: MESH_CABAL_DOC_ID_TIDDLER, text: meshCabalDocIdHex, kind: "sentinel-id" },
    ...facePlaneTiddlers(identitiesUrl, circlesUrl, sessionsUrl, personaUrl, personaGroupId),
    [PERSONA_GROUP_ID_TIDDLER]: { title: PERSONA_GROUP_ID_TIDDLER, text: personaGroupId, kind: "persona-group-id" },
  };
}

/** Read the packed tiddlers back out of a bootstrap already on disk. */
function readPackedTiddlers(path: string): PackedTiddlers {
  const plugin = JSON.parse(readFileSync(path, "utf8")) as { text?: string };
  const packed = JSON.parse(plugin.text ?? '{"tiddlers":{}}') as { tiddlers?: PackedTiddlers };
  return packed.tiddlers ?? {};
}

export async function runInit(opts: InitOptions): Promise<InitResult> {
  const defaults   = defaultDirs();
  const storageDir = opts.storageDir ?? defaults.storageDir;
  const genesisDir = opts.genesisDir ?? defaults.genesisDir;
  const bootstrap  = larBootstrapPath();

  if (existsSync(bootstrap) && !opts.force) {
    console.log(`[lares vessel found] ${bootstrap} already exists — skipping.`);
    console.log("  Pass --force or delete the file to re-seed.");
    return { skipped: true, bootstrapPath: bootstrap, storageDir, genesisDir };
  }

  // THE ROUTE IS CHECKED BEFORE THE FIRST MUTATION: a founding that binds no human route writes nothing. A tree
  // already standing needs no new route (the VK and its slots stay), so only a founding of custody demands one.
  const custodyHomes = { identity: larIdentityDir(), storage: storageDir, seal: larSealHome() };
  const custodyIo = new FsCustodyIo(custodyHomes);
  const custodyStands = await custodyTreeStands(custodyIo, custodyHomes);
  if (!custodyStands) assertFoundingRoute(opts.custody?.slots ?? []);

  mkdirSync(storageDir, { recursive: true });
  mkdirSync(genesisDir, { recursive: true });

  // ── THE PRECONDITION RUNS BEFORE THE FIRST MUTATION ──────────────────────────────────────────
  // A founding binds (device × hearthTrueName), so an absent engine CID means there is nothing to bind
  // TO and no founding can complete. Checked LATER, this same refusal arrived after the vessel keypair
  // and the PersonaGroup root had already been minted — a tree carrying keys and no charter, which reads
  // like damage even though both mints load-or-create and a re-run heals them.
  //
  // A gate that fires after the act it guards teaches the operator to distrust a clean refusal.
  const hearthTrueName = GENESIS_ENGINE_CID(genesisDir);
  if (!hearthTrueName) {
    throw new Error(
      "[lares vessel found] cannot found: hearth true-name (engine CID) absent from " + genesisDir + " —\n" +
      "  the genesis seed carries it. In this repo: `pnpm --filter @lararium/node build:genesis`.\n" +
      "  Founding an ISOLATED root (LAR_ROOT)? Seed the tracked genesis into it first:\n" +
      "    (cd <repo> && git ls-files -z genesis/ | xargs -0 -I{} cp --parents \"{}\" \"$LAR_ROOT/\")",
    );
  }

  // ── CUSTODY SEALS FROM BIRTH, BEFORE THE FIRST IDENTITY FILE ─────────────────────────────────
  // The slot tree and the custody root land first, so a store that already holds a carrier refuses
  // (`OldShapeRefusal`) with the identity home untouched. A tree already standing means a re-seed over a
  // sealed custody: the VK stays, and nothing here re-mints it.
  //
  // THE FOUNDING HOLDS THE KEY IT MINTED. Every identity row this act writes rests sealed under the vessel key,
  // so the founding seats a fresh holder over the key `foundCustody` hands back and asks nobody for it. Over a
  // tree that already stands, the caller's seat opens it (a human route on a terminal); with no seat, the first
  // sealed write below refuses `CustodyLocked` and nothing private lands.
  if (custodyStands) {
    // THE KEY COMES FIRST: this act seals rows under the standing key, so it opens the seat before it mints or
    // writes anything. A vessel whose key stays shut refuses here, by name, with the identity home untouched.
    await openedCustody();
    console.log("[lares vessel found] custody already sealed (vk-slots.bin stands) — the VK and its slots stay as they are.");
    // A FRESH BOOTSTRAP NAMES NO FACE, AND `faceStands` READS ONLY THE BOOTSTRAP. So re-seeding over a vessel
    // whose persona roots stand drops it to the waking floor while every other reading still answers that the
    // face stands — `persona list` reads the ROSTER and keeps naming it. The root stays held (`persona new <i>`
    // loads it and writes the doc id back), so this says which of the two records the re-seed rewrote. The
    // roster rests sealed, so the reading waits for the key above; a custody founded in this very act holds no
    // roster yet and has nothing to say.
    const standingRoots = await listPersonaRoots();
    if (standingRoots.length > 0) {
      console.log(`[lares vessel found] ${standingRoots.length} persona root(s) stand: ${standingRoots.join(", ")}`);
      console.log("  This bootstrap names none of them, so the vessel stands FACELESS at the waking floor.");
      console.log(`  Re-light each one (the root loads, it is not re-minted):  lares persona new ${standingRoots[0]} --name '<label>'`);
    }
  } else {
    const founded = await foundCustody({ io: custodyIo, homes: custodyHomes, slots: opts.custody.slots });
    const holder = makeCustodyHolder({ io: custodyIo, homes: custodyHomes });
    await holder.adopt(founded.vk);
    founded.vk.fill(0);
    seatCustody(holder);
    console.log("[lares vessel found] custody sealed from birth: vk-slots.bin and the custody root.");
  }

  const operatorIdentity = await generateOrLoadVesselIdentity();
  console.log(`[lares vessel found] operator verifyingKey  ${operatorIdentity.verifyingKey.slice(0, 16)}…`);

  const repo = opts.repo;

  if (opts.admitPayload !== undefined) {
    // ── Vessel-admission path = the UPGRADE event (a fresh vessel joins a PersonaGroup) ──
    // The joinee's vessel key (above) is the DELEGATE; the payload carries the pinned signer +
    // the root→joinee edge (the founder's PersonaGroup root signed it). The joinee writes that
    // binding into its OWN daemon doc and boots through its Binding Gate — no Beelay, no cap events.
    const payload = opts.admitPayload;
    if (payload.kind !== "device-admit/v1") {
      throw new Error(`[lares fleet join land] unexpected payload kind: ${payload.kind}`);
    }
    // The joinee's OWN seed — the admit supplies the BINDING; the vessel supplies the SELF. The ceremony
    // mints this vessel's self-certifying ContactCard from it, and a cardless vessel cannot speak at a gate.
    const admitSeed = await loadVesselSigningSeed();
    // An archive already at rest restores into the admit's provider, so the archive written back keeps what it held.
    const standingAdmitArchive = await loadIdentityArchive();
    const { contactCardJson, archive, identitiesUrl, circlesUrl, sessionsUrl, daemonUrl, personaUrl } = await runApplyAdmitPayload({
      repo,
      vesselSeed: admitSeed,
      // The joinee's veil derives from ITS OWN sealed custody root.
      deriveVeil: custodyVeilKeys,
      ...(standingAdmitArchive ? { archiveBytes: standingAdmitArchive } : {}),
      vesselVerifyingKey: operatorIdentity.verifyingKey,
      vesselDisplayName:  operatorIdentity.displayName ?? "operator",
      payload,
      // THE ISLAND. An admit carries a SNAPSHOT of the founder's own RESOLVED NexusIdentity — `kind` +
      // `scope`, minted from the SAME `nexusIdentity` ruling the boot composes (device-admit.ts). A
      // `charter` kind re-enters as a genesis epoch (every charter holder derives the identical scope);
      // any other kind — `own`/`anchor`, and an absent kind on an older payload — resolves through the
      // anchor branch keyed on the founder's own gate key, UNCHANGED from before this carry existed. So a
      // climbed founder's device now seats where the founder itself stands, and an un-climbed founder's
      // device is byte-identical to today. Seeding one island and reading another HALTS the Binding Gate
      // fail-closed at first boot, which reads as a broken vessel.
      nexusPubkey: admittedJoineeIsland({
        hearthGatePubKey:  payload.hearthGatePubKey,
        hearthIslandKind:  payload.hearthIslandKind,
        hearthIslandScope: payload.hearthIslandScope,
        ownVesselKey:      operatorIdentity.verifyingKey,
      }),
    });

    // An admit lands a place AND a contracted face in one act — the contracting operator already signed
    // the edge, so nothing waits on a later ceremony here.
    // THE PIN NAMES THE DIAL: the hearth's sync url + gate key land beside the sentinel ids, so the boot dials
    // the hearth with no `LAR_JOIN_*` set by hand (hearth-dial-pin.ts). A payload naming no dial pins none.
    writeFileSync(bootstrap, JSON.stringify(bootstrapPlugin({
      ...placeTiddlers(daemonUrl),
      ...faceTiddlers(identitiesUrl, circlesUrl, sessionsUrl, personaUrl,
                      payload.personaGroupId, payload.meshCabalDocIdHex),
      ...hearthDialTiddlers(payload.syncUrl, payload.hearthGatePubKey, {
        kind:  payload.hearthIslandKind,
        scope: payload.hearthIslandScope,
      }),
    }), null, 2), "utf8");
    // The joinee's self-certifying ContactCard lands in its identity home exactly as a founder's does —
    // the daemon's nexus-join dial-out reads it, and a cardless vessel never speaks at a gate.
    await persistVesselCard(contactCardJson);
    // The archive behind that card rests sealed beside it: the prekey secrets the card names, and the membership
    // this vessel absorbed. A stand that restores from it presents the same card the hearth admitted.
    await persistIdentityArchive(archive);
    // A joined vessel persists the SAME anchors from the admit payload — its identity home
    // now backstops the veiled Handle exactly as the founder's does.
    await persistIdentityAnchors({
      personaGroupId:          payload.personaGroupId,
      meshCabalDocIdHex:       payload.meshCabalDocIdHex,
    });
    await repo.flush();

    console.log(`[lares fleet join land] vessel ${operatorIdentity.verifyingKey.slice(0, 16)}… admitted`);
    console.log(`  persona plane ${personaUrl}${payload.personaUrl ? " (synced from founder)" : " (fresh local — payload carried none)"}`);
    console.log(`  PersonaGroup ${payload.personaGroupId.slice(0, 20)}…`);
    console.log(`  signer pin   ${payload.signerDid.slice(0, 20)}…`);
    console.log(`  hearth-name  ${payload.hearthTrueName.slice(0, 20)}…  (binding: device × hearthTrueName)`);
    console.log("[lares fleet join land] done — joined the PersonaGroup. Start with: lares vessel stand --with-web");
    return { skipped: false, bootstrapPath: bootstrap, storageDir, genesisDir };
  }

  // ── PLACE-FOUNDING — a somewhere, standing on its own key alone ─────────────────────────────
  // Canon rules the halves apart (identity-classes#herm-establishment): a vessel "boots permissionlessly
  // on its own key… it asks no blessing to exist", and NO civic identity mints into it. So founding stands
  // the PLACE — the sovereign daemon island, the vessel's own Keyhive individual, and the blind-carriage
  // cabal seated on that individual — and stops there. The vessel now carries, serves the public shelf,
  // and holds every sovereign act closed: the waking floor, reached by founding rather than by falling.
  //
  // The FACE lands later, by an operator act: `lares persona new 0 --name '<label>'` runs `runFoundTheFace`
  // below. A hearth whose operator stands right here types two commands instead of one, and a crossroads
  // never types the second at all.
  const vesselSeed = await loadVesselSigningSeed();

  // A PLACE FOUNDED AGAIN KEEPS ITS ARCHIVE. An archive already at rest (a re-seed over a kept identity) holds the
  // prekey secrets behind the vessel's card and everything the vessel individual created; the founding provider
  // restores from it, so the archive written back below still carries all of it. A row that stands and does not
  // open refuses here, before anything lands.
  const standingArchive = await loadIdentityArchive();
  const place = await foundThePlace({ repo, vesselSeed, hearthTrueName, ...(standingArchive ? { archiveBytes: standingArchive } : {}) });

  // Cache the vessel's ContactCard for the light leaf-identity path — a CLI/agent
  // re-presents it on every peer handshake without booting keyhive (OP-AP5).
  await persistVesselCard(place.contactCardJson);
  // The vessel's own keyhive archive rests sealed from this act on: the prekey secrets behind that card.
  await persistIdentityArchive(place.archive);

  // THE FLUSH COMES FIRST, and the catalog pointer already carries the reason: a pointer written
  // after its referent is durable can be stale; one written BEFORE can be a LIE. Automerge saves ride
  // a throttle, so `foundThePlace` returning does not put the daemon doc on disk — and this bootstrap
  // is the only thing that names it. A process that stopped between the two would leave a pointer to
  // a doc no later boot can find, and the next vessel would read its own daemon as absent.
  await repo.flush();

  writeFileSync(bootstrap, JSON.stringify(
    bootstrapPlugin(placeTiddlers(place.daemonUrl)), null, 2), "utf8");
  // NO anchors land here. The veiled-Handle anchor set keys by handle-index and names a PERSONA's
  // planes — a place that holds no face holds no handle to anchor. `runFoundTheFace` writes the set.

  console.log(`[lares vessel found] ${bootstrap} written`);
  console.log(`  daemon-doc    ${place.daemonUrl}`);
  console.log(`  hearth-name   ${hearthTrueName.slice(0, 20)}…  (the place this vessel stands at)`);
  console.log("[lares vessel found] the PLACE stands — carrying, serving the public shelf, faceless.");
  console.log("  stand it:      lares vessel stand");
  console.log("  light a face:  lares persona new 0 --name '<label>'");

  return { skipped: false, bootstrapPath: bootstrap, storageDir, genesisDir };
}


// ---------------------------------------------------------------------------
// The face half — landed by an operator act, onto a place that already stands
// ---------------------------------------------------------------------------

export interface FoundFaceOptions {
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:        Repo;
  readonly genesisDir?: string;
  /** WHICH face to found. 0 (default) = the founding face — it MOUNTS: writes the singular daemon-doc pins
   *  and the sentinel bootstrap entry, EXACTLY as before. N>0 = an ADDITIONAL compartment (Path 1,
   *  persona-policy Ruling 2/2b): it mints its own PersonaGroup + MeshCabal + four planes + persona-KEL
   *  inception + veil + `anchors-hN`, and writes a register-many bootstrap PLANE ENTRY the boot's
   *  `readPersonaPlanes` consumes — but no singular mount pins, so the mounted face stands byte-unchanged. */
  readonly handleIndex?: number;
}

/** Whether a face already stands on this place — a pure read that founds nothing. */
export function faceStands(): boolean {
  const bootstrap = larBootstrapPath();
  if (!existsSync(bootstrap)) return false;
  return Boolean(readPackedTiddlers(bootstrap)[PERSONA_GROUP_ID_TIDDLER]?.text);
}

export interface FoundFaceResult {
  readonly alreadyStood:         boolean;
  readonly personaGroupId: string;
  readonly personaKelPrefix:     string;
  readonly signerDid:            string;
}

/** What arming recovery at a founding hands back: whether THIS act split the root, and the two carriers
 *  that leave the device by hand. A re-light finds the share standing and carries nothing new. */
export interface RecoveryArmed {
  readonly minted:        boolean;
  readonly recordedCode:  string;
  readonly escrowCarrier: string;
}

/**
 * ARM RECOVERY AT THE FOUNDING — the device share mints in the same `persona new` act that founds the face,
 * in the operator's own process, so the two off-device shares print to the operator alone and never ride a
 * standing vessel's outcome record. Absent by choice and absent by omission read identical from outside;
 * only the mint at founding tells them apart. The root at
 * `handleIndex` splits 2-of-3 {device, recorded-code, escrow-peer} ONCE: the device share seals into the
 * identity home as a cold row under the vessel key (`recovery-share-store`), and the two off-device shares
 * return for the operator to place by hand. SHARES ARE KEYS: the recorded code and the escrow carrier together reconstruct the root.
 *
 * `handOut` receives the two off-device shares before the device share seals, so the caller shows them to the
 * person first.
 *
 * Idempotent by the carrier: a share already standing at the index is never re-split (a re-light after a
 * preserving re-pave, a re-stand, `persona new` at a standing index all read `minted: false` and carry
 * nothing). Only the device share persists here — the reserve share belongs to the seal rite.
 */
export async function armRecoveryAtFounding(
  storageDir: string, handleIndex: number,
  handOut?: (off: { readonly recordedCode: string; readonly escrowCarrier: string }) => void | Promise<void>,
): Promise<RecoveryArmed> {
  if (await loadRecoveryDeviceShare(handleIndex)) return { minted: false, recordedCode: "", escrowCarrier: "" };
  // THE PERSON HOLDS THE TWO OFF-DEVICE SHARES BEFORE THE DEVICE SHARE RESTS (`handOut`). A run that stops between
  // the two leaves no device share, and the same command splits afresh; no run leaves a sealed share whose two
  // partners nobody received.
  const { recordedCode, escrowCarrier } = await provisionRecoveryAtFounding(storageDir, globalThis.crypto, 1, handleIndex, handOut);
  return { minted: true, recordedCode, escrowCarrier };
}

/**
 * Land a FACE onto a standing place — the operator act that turns a carrying vessel into a hearth (h0), or
 * adds a compartment to a hearth that already holds one (N>0, the Path-1 per-persona founding).
 *
 * It refuses on a place that has not been founded (nothing to land on). Idempotence is a SAFETY property,
 * not a convenience: re-founding an index that already stands would mint a fresh PersonaGroup and orphan
 * the first, forking the very continuity the persona-KEL pin exists to hold — so each index reads as a
 * no-op once it stands (h0 by its sentinel pin, an added compartment by its `anchors-hN`).
 *
 * The founding face (h0) MOUNTS — it writes the singular daemon-doc pins + the sentinel bootstrap entry,
 * exactly as before. An added compartment mints its OWN individual (group, cabal, four planes, persona-KEL
 * inception, veil, `anchors-hN`) and writes only a register-many bootstrap PLANE ENTRY the boot consumes;
 * it writes no mount pin, so the mounted face stands byte-unchanged. Wearing it is a later act.
 */
export async function runFoundTheFace(opts: FoundFaceOptions): Promise<FoundFaceResult> {
  const defaults    = defaultDirs();
  const genesisDir  = opts.genesisDir ?? defaults.genesisDir;
  const handleIndex = opts.handleIndex ?? 0;
  const mounts      = handleIndex === 0;
  const bootstrap   = larBootstrapPath();

  if (!existsSync(bootstrap)) {
    throw new Error("[lares persona new] no place stands here — run `lares vessel found` first.");
  }
  const packed = readPackedTiddlers(bootstrap);

  // THE KEY COMES FIRST. This act mints a root and seals rows under the vessel key, so it reads its own anchors
  // row before it mints anything: a vessel holding no key refuses here, by name, with nothing landed.
  const priorAnchors = await loadIdentityAnchors(handleIndex);

  // IDEMPOTENCE, PER INDEX. The mounting face reads its sentinel pin; an added compartment reads its own
  // anchor — a fresh mint at a standing index would orphan the group already there.
  if (mounts) {
    const already = packed[PERSONA_GROUP_ID_TIDDLER]?.text;
    if (already) {
      return { alreadyStood: true, personaGroupId: already, personaKelPrefix: "", signerDid: "" };
    }
  } else {
    // A COMPARTMENT STANDS WHEN ITS PLANE ENTRY STANDS. The bootstrap entry lands last (below), so anchors with no
    // entry mark a founding that stopped midway: the act runs again and completes, re-deriving the same veil.
    if (priorAnchors && packed[personaScopedBagIds(priorAnchors.personaGroupId).identities]?.text) {
      return { alreadyStood: true, personaGroupId: priorAnchors.personaGroupId, personaKelPrefix: "", signerDid: "" };
    }
    // A compartment rides BESIDE the mounted face — the founding face must stand first.
    if (!packed[PERSONA_GROUP_ID_TIDDLER]?.text) {
      throw new Error("[lares persona new] no founding face stands yet — light it with `lares persona new 0 --name '<label>'` first.");
    }
  }

  const daemonUrl = packed[DAEMON_BAG_ID]?.text;
  if (!daemonUrl) {
    throw new Error("[lares persona new] the bootstrap names no daemon doc — this place did not finish founding.");
  }

  // THE HEARTH'S TRUE NAME IS ITS SEED CHARTER'S AID. A face binds (device × the hearth's own first Nexus), so an
  // edge minted at one of a human's hearths names that hearth and no other: the engine CID every hearth shares
  // would let it pass at all of them. A place with no seed charter holds no hearth for a face to bind to; the
  // Stable founding act (`lares vessel found --hearth`) seats the charter before it founds persona zero.
  if (!GENESIS_ENGINE_CID(genesisDir)) {
    throw new Error(`[lares persona new] the engine CID stands absent from ${genesisDir} — this place did not finish founding.`);
  }
  const hearthTrueName = hearthAid();
  if (!hearthTrueName) {
    throw new Error("[lares persona new] no seed charter stands here, so no hearth stands for a face to bind to — found the hearth with `lares vessel found --hearth --name '<label>'`.");
  }

  const vesselIdentity = await generateOrLoadVesselIdentity();
  const vesselSeed     = await loadVesselSigningSeed();
  const repo           = opts.repo;
  const daemonHandle   = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);

  // The persona ROOT for THIS face — the human's side. It only ever SIGNS; the per-vessel key stays the
  // Individual. Each compartment carries its OWN sovereign signing key at its handle-index; the founding
  // face seats at h0.
  await generateOrLoadPersonaGroupRoot(handleIndex);
  const signerSeed = await loadPersonaGroupRootSeed(handleIndex);

  // The founder-veil derives from (the sealed custody root, veilTag). Identity anchors carry the tag, so founding
  // the same identity against a fresh store derives the same veil, and that veil restores from its own archive. A
  // founding with no identity anchors carries no tag and mints one — recovery never fabricates a veil.
  const priorVeilTag = priorAnchors?.veilTag;
  const priorVeilArchive = priorVeilTag ? await loadVeilArchive(handleIndex) : null;

  const face = await foundTheFace({
    repo,
    daemonHandle,
    vesselSeed,
    vesselVerifyingKey: vesselIdentity.verifyingKey,
    vesselDisplayName:  vesselIdentity.displayName ?? "operator",
    binding: { mode: "self-stood", signerSeed },
    hearthTrueName,
    // THE ISLAND, resolved by the SAME mesh ruling the boot composes — the charter this vessel holds, then
    // the hearth it dials, then its own key as a private nexus of one. A face seated on one board while the
    // boot walks another cannot reach a head, and the Binding Gate HALTS.
    //
    // KIND-AWARE: this vessel may hold no charter of its own (it was ADMITTED, not founded on one) while
    // its hearth dial pin still carries a `charter` snapshot from admit time (hearth-dial-pin.ts). That
    // snapshot substitutes for `genesisEpochCid` ONLY when this vessel's own charter read is silent — an
    // `own`/`anchor` pin changes nothing here, since its scope already IS the gate key `anchorGateKey`
    // below carries.
    nexusPubkey: (() => {
      const hearthPin = readHearthDialPin(larBootstrapPath());
      return nexusScopeOrThrow(nexusIdentity({
        genesisEpochCid: nexusAidOf(readNexusDoc(larSealHome()))
                            ?? (hearthPin?.islandKind === "charter" ? hearthPin.islandScope ?? null : null),
        charterStands:   nexusCharterStands(larSealHome()),
        anchorGateKey:   hearthPin?.gatePubKey ?? null,
        ownVesselKey:    vesselIdentity.verifyingKey,
      }));
    })(),
    ...(priorVeilTag ? { veilTag: priorVeilTag } : {}),
    ...(priorVeilArchive ? { veilArchiveBytes: priorVeilArchive } : {}),
    // The veil derives from this vessel's sealed custody root, never the floor key.
    deriveVeil: custodyVeilKeys,
    // The founding face MOUNTS; an added compartment does not. Omit for h0 so its path is byte-unchanged.
    ...(mounts ? {} : { mount: false }),
  });

  // The mounting face writes the sentinel pins + its plane entry; an added compartment writes ONLY the
  // register-many plane entry the boot's `readPersonaPlanes` consumes, merged over the mounted face's pins.
  const faceEntry = mounts
    ? faceTiddlers(face.identitiesUrl, face.circlesUrl, face.sessionsUrl, face.personaUrl,
                   face.personaGroupId, face.meshCabalDocIdHex)
    : facePlaneTiddlers(face.identitiesUrl, face.circlesUrl, face.sessionsUrl, face.personaUrl,
                        face.personaGroupId);
  // THREE WRITES, ONE COMMIT POINT. The veil's archive rests first, under this face's own row; the anchors and
  // their roster line follow; the bootstrap entry lands LAST and commits the face. Every "already stood" reading
  // above reads that entry, so a founding that stops anywhere before it runs again whole. An entry never stands
  // over a missing archive or missing anchors.
  //
  // WHAT AN UNCOMMITTED FOUNDING LEFT BELONGS TO NO FACE. The run that completes mints its own PersonaGroup and
  // MeshCabal and writes this face's archive, anchors and (for the mounting face) pins over whatever the stopped
  // run left; the stopped run's group stays in the store named by nothing, since only the entry written here makes
  // a group a face. Where the stopped run reached its anchors, the tag they carry re-derives the same veil and that
  // veil restores from its own archive; where it stopped sooner, a fresh tag derives a fresh veil and its archive
  // replaces the row.
  await persistVeilArchive(face.veilArchive, handleIndex);
  await persistIdentityAnchors({
    meshCabalDocIdHex:      face.meshCabalDocIdHex,
    personaGroupId:   face.personaGroupId,
    // The persisted veil tag and doc ids let the same identity re-derive its founder-veil on a fresh store.
    veilTag:                face.veilTag,
    // THE WEAR-REBOOT MOUNT MATERIAL. A non-active persona (mount:false) pins NONE of these into the daemon
    // doc, so a reboot could never mount-switch to it. Persisted here — all PUBLIC (a signer DID, a KEL
    // prefix, a signed grant record; no secret) — a reboot re-pins its mount from its own anchors, and the
    // boot re-verifies the edge's signature (the gate is a signature, never a list).
    signerDid:              face.signerDid,
    personaKelPrefix:       face.personaKelPrefix,
    deviceEdge:             face.founderEdge,
  }, handleIndex);
  await repo.flush();
  writeFileSync(bootstrap, JSON.stringify(bootstrapPlugin({ ...packed, ...faceEntry }), null, 2), "utf8");

  return {
    alreadyStood: false,
    personaGroupId: face.personaGroupId,
    personaKelPrefix:     face.personaKelPrefix,
    signerDid:            face.signerDid,
  };
}
