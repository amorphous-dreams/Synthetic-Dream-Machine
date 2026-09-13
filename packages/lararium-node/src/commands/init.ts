/**
 * runInit — Node adapter: one-time social-plane bootstrap for a new Lararium node.
 *
 * Node-specific shores (only these belong here):
 *   - NodeFSStorageAdapter for Automerge repo
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
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  DAEMON_BAG_ID, personaMembershipEntries, personaScopedBagIds,
  PERSONA_GROUP_DOC_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
} from "@lararium/mesh";
import { daemonGenesisDir } from "../lares-config.js";
import { larDataDir, larBootstrapPath } from "../vessel-paths.js";
import { hearthDialTiddlers } from "../hearth-dial-pin.js";
import type { CarriedAdmitPayload } from "./device-admit.js";
import { listPersonaRoots } from "../node-vessel-identity.js";
import { persistIdentityAnchors, loadIdentityAnchors } from "../identity-anchors.js";
import { loadRecoveryDeviceShare } from "../recovery-share-store.js";
import { provisionRecoveryAtFounding } from "../recovery-keel.js";
import {
  generateOrLoadVesselIdentity, loadVesselSigningSeed, persistVesselCard,
  generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed,
} from "../node-vessel-identity.js";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { LarDoc } from "@lararium/mesh";
import { GENESIS_ENGINE_CID } from "../genesis-artifact.js";
import {
  foundThePlace, foundTheFace, runApplyAdmitPayload,
} from "@lararium/keyhive";
import { SOCIAL_BOOTSTRAP_PLUGIN_TITLE } from "../open-node-vessel.js";

export interface InitOptions {
  readonly storageDir?: string;
  readonly genesisDir?: string;
  readonly force?:      boolean;
  /**
   * Path to a device-admit/v1 JSON payload. When provided, skips the founding
   * ceremony and admits this vessel to the operator's existing PersonaGroup + MeshCabal.
   * Use for same-operator second vessel. A second OPERATOR joins by carriage contract-receive.
   */
  readonly admitPayloadPath?: string;
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
  personaGroupDocIdHex: string,
): PackedTiddlers {
  const face = personaScopedBagIds(personaGroupDocIdHex);
  return {
    [face.identities]: { title: face.identities, text: identitiesUrl, kind: "oracle" },
    [face.circles]:    { title: face.circles,    text: circlesUrl,    kind: "oracle" },
    [face.sessions]:   { title: face.sessions,   text: sessionsUrl,   kind: "oracle" },
    // The PersonaGroup plane and the membership that names it — written through the same pair a vessel
    // standing in a SECOND compartment would add, so founding and admission lay down one shape. The boot
    // path reads the family back by derivation; nothing here holds an order or an index.
    ...Object.fromEntries(
      personaMembershipEntries({ personaGroupId: personaGroupDocIdHex, url: personaUrl })
        .map((e) => [e.title, { title: e.title, text: e.text as string, kind: "oracle" }]),
    ),
  };
}

/** What the MOUNTED FACE adds: its register-many plane entry PLUS the singular sentinel pins the boot reads
 *  to run the ONE mounted face's Binding Gate. Only the founding face (h0) writes these. */
function faceTiddlers(
  identitiesUrl: string, circlesUrl: string, sessionsUrl: string, personaUrl: string,
  personaGroupDocIdHex: string, meshCabalDocIdHex: string,
): PackedTiddlers {
  return {
    [MESH_CABAL_DOC_ID_TIDDLER]: { title: MESH_CABAL_DOC_ID_TIDDLER, text: meshCabalDocIdHex, kind: "sentinel-id" },
    ...facePlaneTiddlers(identitiesUrl, circlesUrl, sessionsUrl, personaUrl, personaGroupDocIdHex),
    [PERSONA_GROUP_DOC_ID_TIDDLER]: { title: PERSONA_GROUP_DOC_ID_TIDDLER, text: personaGroupDocIdHex, kind: "sentinel-id" },
  };
}

/** Read the packed tiddlers back out of a bootstrap already on disk. */
function readPackedTiddlers(path: string): PackedTiddlers {
  const plugin = JSON.parse(readFileSync(path, "utf8")) as { text?: string };
  const packed = JSON.parse(plugin.text ?? '{"tiddlers":{}}') as { tiddlers?: PackedTiddlers };
  return packed.tiddlers ?? {};
}

export async function runInit(opts: InitOptions = {}): Promise<InitResult> {
  const defaults   = defaultDirs();
  const storageDir = opts.storageDir ?? defaults.storageDir;
  const genesisDir = opts.genesisDir ?? defaults.genesisDir;
  const bootstrap  = larBootstrapPath();

  if (existsSync(bootstrap) && !opts.force) {
    console.log(`[lares vessel found] ${bootstrap} already exists — skipping.`);
    console.log("  Pass --force or delete the file to re-seed.");
    return { skipped: true, bootstrapPath: bootstrap, storageDir, genesisDir };
  }

  // A FRESH BOOTSTRAP NAMES NO FACE, AND `faceStands` READS ONLY THE BOOTSTRAP. So re-seeding over a
  // vessel whose persona roots stand on disk drops it to the waking floor while every other reading still
  // answers that the face is fine — `persona list` reads the ROSTER and keeps naming it. The root is not
  // lost (`persona new <i>` loads rather than mints, and writes the doc id back), but nothing would say so
  // and the operator would meet a herm where they left a hearth.
  //
  // Two records of one fact, and only one of them gets rewritten here. This says which.
  const standingRoots = await listPersonaRoots(larDataDir()).catch(() => [] as number[]);
  if (standingRoots.length > 0) {
    console.log(`[lares vessel found] ${standingRoots.length} persona root(s) stand: ${standingRoots.join(", ")}`);
    console.log("  This bootstrap names none of them, so the vessel stands FACELESS at the waking floor.");
    console.log(`  Re-light each one (the root loads, it is not re-minted):  lares persona new ${standingRoots[0]} --name '<label>'`);
  }

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

  const operatorIdentity = await generateOrLoadVesselIdentity(storageDir);
  console.log(`[lares vessel found] operator verifyingKey  ${operatorIdentity.verifyingKey.slice(0, 16)}…`);

  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });

  if (opts.admitPayloadPath) {
    // ── Vessel-admission path = the UPGRADE event (a fresh vessel joins a PersonaGroup) ──
    // The joinee's vessel key (above) is the DELEGATE; the payload carries the pinned signer +
    // the root→joinee edge (the founder's PersonaGroup root signed it). The joinee writes that
    // binding into its OWN daemon doc and boots through its Binding Gate — no Beelay, no cap events.
    if (!existsSync(opts.admitPayloadPath)) {
      throw new Error(`[lares vessel found --admit] payload file not found: ${opts.admitPayloadPath}`);
    }
    const payload = JSON.parse(readFileSync(opts.admitPayloadPath, "utf8")) as CarriedAdmitPayload;
    if (payload.kind !== "device-admit/v1") {
      throw new Error(`[lares vessel found --admit] unexpected payload kind: ${payload.kind}`);
    }
    // The joinee's OWN seed — the admit supplies the BINDING; the vessel supplies the SELF. The ceremony
    // mints this vessel's self-certifying ContactCard from it, and a cardless vessel cannot speak at a gate.
    const admitSeed = await loadVesselSigningSeed(storageDir);
    const { contactCardJson, identitiesUrl, circlesUrl, sessionsUrl, daemonUrl, personaUrl } = await runApplyAdmitPayload({
      repo,
      vesselSeed: admitSeed,
      vesselVerifyingKey: operatorIdentity.verifyingKey,
      vesselDisplayName:  operatorIdentity.displayName ?? "operator",
      payload,
      // The joinee's own gate key IS its Nexus key — the local KEL board it seeds the founder's inception onto.
      nexusPubkey: operatorIdentity.verifyingKey,
    });

    // An admit lands a place AND a contracted face in one act — the contracting operator already signed
    // the edge, so nothing waits on a later ceremony here.
    // THE PIN NAMES THE DIAL: the hearth's sync url + gate key land beside the sentinel ids, so the boot dials
    // the hearth with no `LAR_JOIN_*` set by hand (hearth-dial-pin.ts). A payload naming no dial pins none.
    writeFileSync(bootstrap, JSON.stringify(bootstrapPlugin({
      ...placeTiddlers(daemonUrl),
      ...faceTiddlers(identitiesUrl, circlesUrl, sessionsUrl, personaUrl,
                      payload.personaGroupDocIdHex, payload.meshCabalDocIdHex),
      ...hearthDialTiddlers(payload.syncUrl, payload.hearthGatePubKey),
    }), null, 2), "utf8");
    // The joinee's self-certifying ContactCard lands in its identity home exactly as a founder's does —
    // the daemon's nexus-join dial-out reads it, and a cardless vessel never speaks at a gate.
    await persistVesselCard(storageDir, contactCardJson);
    // A joined vessel persists the SAME anchors from the admit payload — its identity home
    // now backstops the veiled Handle exactly as the founder's does.
    persistIdentityAnchors({
      personaGroupDocIdHex:    payload.personaGroupDocIdHex,
      meshCabalDocIdHex:       payload.meshCabalDocIdHex,
      personaGroupAgentIdHex:  payload.personaGroupAgentIdHex,
    });
    await repo.flush();

    console.log(`[lares vessel found --admit] vessel ${operatorIdentity.verifyingKey.slice(0, 16)}… admitted`);
    console.log(`  persona plane ${personaUrl}${payload.personaUrl ? " (synced from founder)" : " (fresh local — payload carried none)"}`);
    console.log(`  PersonaGroup ${payload.personaGroupDocIdHex.slice(0, 20)}…`);
    console.log(`  signer pin   ${payload.signerDid.slice(0, 20)}…`);
    console.log(`  hearth-name  ${payload.hearthTrueName.slice(0, 20)}…  (binding: device × hearthTrueName)`);
    console.log("[lares vessel found --admit] done — joined the PersonaGroup. Start with: lares vessel stand --with-app");
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
  const vesselSeed = await loadVesselSigningSeed(storageDir);

  const place = await foundThePlace({ repo, vesselSeed, hearthTrueName });

  // Cache the vessel's ContactCard for the light leaf-identity path — a CLI/agent
  // re-presents it on every peer handshake without booting keyhive (OP-AP5).
  await persistVesselCard(storageDir, place.contactCardJson);

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
  readonly storageDir?: string;
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
  return Boolean(readPackedTiddlers(bootstrap)[PERSONA_GROUP_DOC_ID_TIDDLER]?.text);
}

export interface FoundFaceResult {
  readonly alreadyStood:         boolean;
  readonly personaGroupDocIdHex: string;
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
 * ARM RECOVERY AT THE FOUNDING — the device share mints where the persona root mints. Absent by choice and
 * absent by omission read identical from outside; only the mint at founding tells them apart. The root at
 * `handleIndex` splits 2-of-3 {device, recorded-code, escrow-peer} ONCE: the device share seals into the
 * identity home under the live seal policy (the same carrier set the veil rides — `archive-passphrase`
 * names it, so `vault seal`/`rotate` carry it), and the two off-device shares return for the operator to
 * place by hand. SHARES ARE KEYS: the recorded code and the escrow carrier together reconstruct the root.
 *
 * Idempotent by the carrier: a share already standing at the index is never re-split (a re-light after a
 * preserving re-pave, a re-stand, `persona new` at a standing index all read `minted: false` and carry
 * nothing). Only the device share persists here — the reserve share belongs to the seal rite.
 */
export async function armRecoveryAtFounding(storageDir: string, handleIndex: number): Promise<RecoveryArmed> {
  if (loadRecoveryDeviceShare(handleIndex)) return { minted: false, recordedCode: "", escrowCarrier: "" };
  const { recordedCode, escrowCarrier } = await provisionRecoveryAtFounding(storageDir, globalThis.crypto, 1, handleIndex);
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
export async function runFoundTheFace(opts: FoundFaceOptions = {}): Promise<FoundFaceResult> {
  const defaults    = defaultDirs();
  const storageDir  = opts.storageDir ?? defaults.storageDir;
  const genesisDir  = opts.genesisDir ?? defaults.genesisDir;
  const handleIndex = opts.handleIndex ?? 0;
  const mounts      = handleIndex === 0;
  const bootstrap   = larBootstrapPath();

  if (!existsSync(bootstrap)) {
    throw new Error("[lares persona new] no place stands here — run `lares vessel found` first.");
  }
  const packed = readPackedTiddlers(bootstrap);

  // IDEMPOTENCE, PER INDEX. The mounting face reads its sentinel pin; an added compartment reads its own
  // anchor — a fresh mint at a standing index would orphan the group already there.
  if (mounts) {
    const already = packed[PERSONA_GROUP_DOC_ID_TIDDLER]?.text;
    if (already) {
      return { alreadyStood: true, personaGroupDocIdHex: already, personaKelPrefix: "", signerDid: "" };
    }
  } else {
    const anchored = loadIdentityAnchors(handleIndex);
    if (anchored) {
      return { alreadyStood: true, personaGroupDocIdHex: anchored.personaGroupDocIdHex, personaKelPrefix: "", signerDid: "" };
    }
    // A compartment rides BESIDE the mounted face — the founding face must stand first.
    if (!packed[PERSONA_GROUP_DOC_ID_TIDDLER]?.text) {
      throw new Error("[lares persona new] no founding face stands yet — light it with `lares persona new 0 --name '<label>'` first.");
    }
  }

  const daemonUrl = packed[DAEMON_BAG_ID]?.text;
  if (!daemonUrl) {
    throw new Error("[lares persona new] the bootstrap names no daemon doc — this place did not finish founding.");
  }

  const hearthTrueName = GENESIS_ENGINE_CID(genesisDir);
  if (!hearthTrueName) {
    throw new Error(`[lares persona new] hearth true-name (engine CID) absent from ${genesisDir} — the edge binds (device × hearthTrueName) and has nothing to bind to.`);
  }

  const vesselIdentity = await generateOrLoadVesselIdentity(storageDir);
  const vesselSeed     = await loadVesselSigningSeed(storageDir);
  const repo           = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const daemonHandle   = await repo.find<LarDoc>(daemonUrl as AutomergeUrl);

  // The persona ROOT for THIS face — the human's side. It only ever SIGNS; the per-vessel key stays the
  // Individual. Each compartment carries its OWN sovereign signing key at its handle-index; the founding
  // face seats at h0.
  await generateOrLoadPersonaGroupRoot(storageDir, handleIndex);
  const signerSeed = await loadPersonaGroupRootSeed(storageDir, handleIndex);

  // The recovery leg arms with the root: the device share seals beside the veil, the two off-device
  // carriers say aloud that shares are keys and leave by the operator's hand.
  const armed = await armRecoveryAtFounding(storageDir, handleIndex);
  if (armed.minted) {
    console.log(`[lares persona new] recovery armed for h${handleIndex} — the device share sealed into the identity home.`);
    console.log("  SHARES ARE KEYS: the two carriers below, together, reconstruct this persona's root. Write the");
    console.log("  recorded code down and keep it off this device; hand the escrow carrier to ONE peer you trust.");
    console.log(`  recorded-code   ${armed.recordedCode}`);
    console.log(`  escrow-carrier  ${armed.escrowCarrier}`);
  }

  // THE VEIL SURVIVES A PRESERVING RE-PAVE. The founder-veil derives from (vesselSeed, veilTag); the tag
  // is minted per-founding and lived ONLY in the wiped daemon doc, so a re-light after `vessel clear --force`
  // (identity home kept) minted a FRESH tag and stood a DIFFERENT veil. When the identity home already
  // anchors this face, its persisted tag rides back in here and `foundTheFace` re-derives the SAME veil. A
  // genuine fresh founding (no prior anchors) carries none, and mints one — recovery never fabricates a veil.
  const priorVeilTag = loadIdentityAnchors(handleIndex)?.veilTag;

  const face = await foundTheFace({
    repo,
    daemonHandle,
    vesselSeed,
    vesselVerifyingKey: vesselIdentity.verifyingKey,
    vesselDisplayName:  vesselIdentity.displayName ?? "operator",
    binding: { mode: "self-stood", signerSeed },
    hearthTrueName,
    // This node's own gate key IS its Nexus key — the per-Nexus KEL board the inception seats onto.
    nexusPubkey: vesselIdentity.verifyingKey,
    ...(priorVeilTag ? { veilTag: priorVeilTag } : {}),
    // The founding face MOUNTS; an added compartment does not. Omit for h0 so its path is byte-unchanged.
    ...(mounts ? {} : { mount: false }),
  });

  // The mounting face writes the sentinel pins + its plane entry; an added compartment writes ONLY the
  // register-many plane entry the boot's `readPersonaPlanes` consumes, merged over the mounted face's pins.
  const faceEntry = mounts
    ? faceTiddlers(face.identitiesUrl, face.circlesUrl, face.sessionsUrl, face.personaUrl,
                   face.personaGroupDocIdHex, face.meshCabalDocIdHex)
    : facePlaneTiddlers(face.identitiesUrl, face.circlesUrl, face.sessionsUrl, face.personaUrl,
                        face.personaGroupDocIdHex);
  writeFileSync(bootstrap, JSON.stringify(bootstrapPlugin({ ...packed, ...faceEntry }), null, 2), "utf8");
  persistIdentityAnchors({
    meshCabalDocIdHex:      face.meshCabalDocIdHex,
    personaGroupDocIdHex:   face.personaGroupDocIdHex,
    personaGroupAgentIdHex: face.personaGroupAgentIdHex,
    // The veil tag backstops the founder-veil across a preserving re-pave — beside the doc-ids, out of every
    // substrate wipe, so the next re-light re-derives the SAME veil rather than minting a fresh one.
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

  return {
    alreadyStood: false,
    personaGroupDocIdHex: face.personaGroupDocIdHex,
    personaKelPrefix:     face.personaKelPrefix,
    signerDid:            face.signerDid,
  };
}
