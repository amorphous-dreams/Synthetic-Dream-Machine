/**
 * runDeviceAdmit — Node adapter: produce a device-admit/v1 payload for a new vessel, and this hearth's reading the
 * fleet-join answer signs beside it.
 *
 * Node-specific shores (only these belong here):
 *   - readFileSync for the social bootstrap (<lares>/vessel — see larBootstrapPath)
 *   - findWithProgress on the store's one holder for daemon doc access — the standing vessel's own Repo
 *     when the door runs inside it, the direct holder's (`ownedStore`) when no vessel stands
 *   - loadVesselSigningSeed (disk keypair)
 *
 * The door hands back the minted payload and the hearth's reading (its gate pin, canon and resolved island). The
 * fleet-join door's answer signs both, so the pin and the canon reach a joinee only INSIDE the root's signature.
 *
 * All ceremony logic (Keyhive hydration, Gate B/C self-check, payload construction)
 * lives in @lararium/keyhive (runDeviceAdmitCore) and runs identically in any vessel.
 *
 * Same-operator path: covers the operator's own N vessels (desktop, browser, phone).
 * A second OPERATOR joins a Nexus by carriage contract (`lares nexus accept-carriage` + `lares nexus contract`) — a different axis (ceremony.ts stubs).
 */

import { existsSync, readFileSync } from "fs";
import { isValidAutomergeUrl, type AutomergeUrl, type Repo } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, personaBagIdFor, PERSONA_KEL_PREFIX_TIDDLER,
  PERSONA_GROUP_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  personaKelBoardDocUrl, personaKelChainForPrefix, materializeSharedLarDoc,
  buildDeviceDelegationRootHalf,
  faceAtomKeyFromSeed,
  leaseEpochPrefix, effectiveLeaseEpoch,
  LARES_DOC_URI, LARARIUM_DOC_URI, tiddlerText, type LarDoc,
} from "@lararium/mesh";
import { makeCatalogAccessor } from "@lararium/tw5";
import { larBootstrapPath, larSealHome } from "../vessel-paths.js";
import { runDeviceAdmitEdge, type DeviceAdmitPayload } from "@lararium/keyhive";
import { loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { readVesselEdgeBoard } from "../edge-board.js";
import { fleetEdgeBoardDocUrl, fleetEdgeAuthority, deviceEdgeId, type CustodyRootDoor, type GateBundlePin } from "@lararium/mesh";
import { stoodSovereignPin } from "../hearth-sovereign-pin.js";
import { nodeNexusIsland, nodeNexusIslandsBelow, nodeNexusStanding } from "../nexus-standing.js";
import { carryPersonaKelUpTheGradient } from "../persona-kel-ring.js";
import { hearthAid } from "../hearth-aid.js";
import { loadIdentityAnchors } from "../identity-anchors.js";
import { loadFaceAtom } from "../face-atom-store.js";
import { wsUrlForOrigin } from "../lan-address.js";

export type { DeviceAdmitPayload } from "@lararium/keyhive";

/**
 * THE ISLAND THIS DOOR READS A PER-NEXUS BOARD AT — the founder's own, resolved exactly as its BOOT
 * resolves it.
 *
 * ══ WHY IT IS NOT THE VESSEL KEY ═════════════════════════════════════════════════════════════════
 *
 * This read was spelled `personaKelBoardDocUrl(await loadVesselVerifyingKey())`, under a comment
 * reading "its gate key IS its Nexus key." `91ce09afb` ruled that EVERY per-Nexus board keys on the
 * NEXUS, so that sentence holds at exactly ONE point on the gradient — the `own` island — and
 * nowhere above it. A founder that CLIMBED to a charter reads the PRIVATE board beneath its charter
 * island while its own boot reads the charter board.
 *
 * AND THE RESOLVED KEY ALONE DOES NOT SUFFICE — THE BOARD ITSELF MUST CARRY THE CHAIN TOO. Founding
 * seats a climbed founder's inception on the island BELOW, and this door runs against whichever holder
 * stands — the vessel that booted before the climb, or the direct holder that never boots at all.
 * So `runDeviceAdmit` carries the chain itself: right before it reads the board at `boardIsland`, it
 * calls the SAME `carryPersonaKelUpTheGradient` the boot calls, fed by `nodeNexusIslandsBelow` off
 * this identical resolution — never a second, hand-built ranking. A sound climbed founding therefore
 * admits cleanly with no daemon restart between the climb and this call. "persona-KEL chain … absent
 * from the local board" now names only an identifier no island in the gradient ever seated — a
 * genuinely torn founding — and never fires over a founding that stands sound.
 *
 * ══ THE FLEET FRAMING IS KEPT, DELIBERATELY ══════════════════════════════════════════════════════
 *
 * `c6cfe5b8d` ruled that "device-admit … admits a DEVICE to a fleet rather than a VESSEL to a
 * Nexus", and that argument stands: this door takes NO nexus-key parameter and asks its caller for
 * none. The two rulings answer different questions. The fleet framing settles the PARAMETER (nobody
 * hands this door an island); `91ce09afb` settles the BOARD (a per-Nexus board keys on the Nexus,
 * whoever reads it). So the parameter stays absent and the READ composes the shared resolver — the
 * same disk and environment facts, in the same precedence, as `open-node-vessel`.
 *
 * ONE SEAM, SO THE DRIFT CANNOT COME BACK: the resolution lives in `nexus-standing`, which the boot
 * and the founding doors read too. This function exists as a named seam so a test can measure the
 * island the DOOR resolves rather than trusting that it restated the boot's object correctly.
 */
export function admitBoardIsland(ownVesselKey: string): string {
  return nodeNexusIsland({ ownVesselKey });
}

/**
 * The relay address an admit carries when the caller names none: the vessel's DECLARED reach face
 * (`LAR_PUBLIC_URL`), turned into its relay URL by the one derivation the banner uses, so an `https` name
 * carries `wss`.
 *
 * The declaration counts only as a bare http(s) ORIGIN: a scheme, a host and an optional port. Credentials, a
 * path, a query or a fragment name something other than a reach face, and any of them leaves the address null.
 * A loopback or unspecified host never rides an admit: on the joining device `localhost` names that device, and
 * `0.0.0.0` names no device. No usable declaration leaves the address null, and the joinee dials what its
 * operator supplies.
 */
export function deviceAdmitSyncUrl(explicitSyncUrl?: string): string | null {
  if (explicitSyncUrl !== undefined) return explicitSyncUrl;
  const declared = process.env["LAR_PUBLIC_URL"]?.trim();
  if (!declared) return null;
  let url: URL;
  try { url = new URL(declared); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const loopbackOrUnspecified =
    host === "" || host === "localhost" || host.endsWith(".localhost") ||
    /^127\./.test(host) || host === "0.0.0.0" ||
    host === "::1" || host === "::" || /^::ffff:(127\.|0\.0\.0\.0$|7f[0-9a-f]{2}:)/.test(host) || host === "::ffff:0:0";
  if (loopbackOrUnspecified) return null;
  return wsUrlForOrigin(url.origin);
}

/** The catalog titles whose documents a joinee mounts as its hearth's base canon. */
const HEARTH_CANON_TITLES: readonly string[] = [LARES_DOC_URI, LARARIUM_DOC_URI];

/**
 * THE CANON DOCUMENTS THIS HEARTH NAMES TO A JOINEE — `@lares` and `@lararium`, by document url, as this
 * vessel's own catalog holds them. They ride the fleet-join answer's signed carriage, so the joinee's gate widens
 * by exactly these documents. A pointer the catalog lacks, or holds torn, goes unnamed.
 */
export async function admitCanonDocs(repo: Repo, registryUrl: string): Promise<Readonly<Record<string, string>>> {
  let registry: LarDoc | undefined;
  try { registry = (await repo.find<LarDoc>(registryUrl as AutomergeUrl)).doc(); } catch { return {}; }
  const named: Record<string, string> = {};
  for (const title of HEARTH_CANON_TITLES) {
    const url = tiddlerText(registry?.tiddlers?.[title]);
    if (url && isValidAutomergeUrl(url)) named[title] = url;
  }
  return named;
}

/** The root refuses to bind a device its own fleet board shows set aside. The reading names itself. */
export class DeviceSetAside extends Error {
  constructor(readonly verdict: string) {
    super(
      `[lares fleet join answer] REFUSED: that device stands SET ASIDE from this fleet (its edge reads ${verdict}). ` +
      "A delegation binds nothing under a standing shadow. Lift it first, by the root's own hand " +
      "(`lares edge un-kapae --device <key>`); the device then takes a fresh seat and no earlier key.",
    );
    this.name = "DeviceSetAside";
  }
}

/**
 * THE BIND SITE'S CONSULT. The root signs no delegation for a device its own fleet board shows set aside, so a
 * fresh admit and a lease roll both skip that dyad. The read runs through this vessel's ledger: a raise a hand
 * deleted from the board still refuses here. The operator's own door names the reading, and the lift stays a
 * separate, deliberate act. A vessel that holds no root key reads no fleet and binds nothing by this door anyway.
 */
export async function assertDyadBinds(repo: Repo, joineeVerifyingKey: string, face = 0): Promise<void> {
  // Each face holds its own fleet: the root that signs reads its own board, never the founding face's.
  const fleetRoot = (await loadPersonaGroupRootVerifyingKey(face))?.toLowerCase().replace(/^0x/, "");
  if (!fleetRoot) return;
  const anchors = await loadIdentityAnchors(face);
  const atomSeed = await loadFaceAtom(face);
  if (!anchors || !atomSeed) throw new Error("this face holds no atom; re-found or re-admit it");
  const ownKey = faceAtomKeyFromSeed(atomSeed, anchors.personaGroupId).key;
  const fleet = await readVesselEdgeBoard({
    repo, scope: fleetRoot, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae",
    vesselKey: ownKey, authorityFor: fleetEdgeAuthority(fleetRoot),
  });
  const dyad = fleet.readings.get(deviceEdgeId(fleetRoot, joineeVerifyingKey.trim().toLowerCase().replace(/^0x/, "")));
  if (dyad?.stands === true) throw new DeviceSetAside(dyad.verdict);
}

export interface DeviceAdmitOptions {
  readonly signedRequest?: Uint8Array;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:           Repo;
  /** This hearth's catalog, supplied by the holder of its store; absence names no canon. */
  readonly catalogUrl?:   string | undefined;
  readonly syncUrl?:       string;
  /** The joining vessel's PUBLIC Ed25519 verifying-key hex — the delegate the founder's root signs. */
  readonly joineeVerifyingKey: string;
  /** Automerge URL of this vessel's genesis island — included in payload for peer-sync delivery. */
  readonly islandDocUrl?:  string | null;
  /** This hearth's own daemon doc — the door the joinee knocks on for its seat. */
  readonly hearthDaemonUrl?: string | null;
  /**
   * The persona index whose root signs the edge (`lares fleet join --face`); the founding face where absent. The
   * founding face reads its pins off the bootstrap and the daemon doc; a face an operator added reads them off its
   * own anchors, since both pin the founding face alone.
   */
  readonly face?:          number;
  /** The custody door the hearth's gate pin derives from (`hearthSovereignPin`); absent → this home's own custody seat. */
  readonly gateDoor?:      CustodyRootDoor;
}

/** This hearth's reading at the admit: what the fleet-join answer signs beside the edge. */
export interface AdmitHearthReading {
  /** The full sovereign sync pin a joinee files for this hearth's dial, at the island the reading names. */
  readonly gatePin: GateBundlePin;
  /** The canon documents this hearth names, by url (`admitCanonDocs`). */
  readonly canon: Readonly<Record<string, string>>;
  /** The board island this hearth stands on, resolved as its boot resolves it; absent on a torn standing. */
  readonly islandKind?: "own" | "anchor" | "charter" | "explicit";
  readonly islandScope?: string;
}

/** What the door mints: the signed edge, and this hearth's reading the fleet-join answer signs beside it. */
export interface DeviceAdmitResult {
  readonly payload: DeviceAdmitPayload;
  readonly hearth: AdmitHearthReading;
}

export async function runDeviceAdmit(opts: DeviceAdmitOptions): Promise<DeviceAdmitResult> {
  const bootstrap  = larBootstrapPath();

  if (!existsSync(bootstrap)) {
    throw new Error(
      `[lares fleet join answer] ${bootstrap} not found — run \`lares vessel found\` first.\n` +
      `  expected: ${bootstrap}`,
    );
  }

  // Read the face's group id and the cabal's sentinel id from social-bootstrap.json.
  const bootstrapPlugin = JSON.parse(readFileSync(bootstrap, "utf8")) as { text?: string };
  const tiddlers = (JSON.parse(bootstrapPlugin.text ?? "{}") as {
    tiddlers?: Record<string, { text?: string }>;
  }).tiddlers ?? {};

  const face = opts.face ?? 0;
  // A face an operator added stands on its OWN anchors: the bootstrap and the daemon doc pin the founding face.
  const faceAnchors = face === 0 ? null : await loadIdentityAnchors(face);
  if (face !== 0 && faceAnchors === null) {
    throw new Error(`[lares fleet join answer] this vessel holds no face at index ${face} — found one with \`lares persona new ${face}\` first.`);
  }
  const personaGroupId = faceAnchors?.personaGroupId ?? (face === 0 ? tiddlers[PERSONA_GROUP_ID_TIDDLER]?.text ?? null : null);
  const meshCabalDocIdHex   = faceAnchors?.meshCabalDocIdHex ?? (face === 0 ? tiddlers[MESH_CABAL_DOC_ID_TIDDLER]?.text ?? null : null);
  const daemonUrl            = tiddlers[DAEMON_BAG_ID]?.text                 ?? null;
  // The founder's PersonaGroup plane — carried into the payload so the joinee SYNCS the shared veiled
  // identity (membership-sync foundation); the daemon bag stays sovereign (the joinee seeds its own). The entry
  // is keyed by the name the group's own id derives, which both devices compute alike.
  const personaUrl           = personaGroupId
    ? tiddlers[personaBagIdFor(personaGroupId)]?.text ?? null
    : null;

  if (!personaGroupId || !meshCabalDocIdHex) {
    throw new Error(
      `[lares fleet join answer] the PersonaGroup or MeshCabal id is missing from social-bootstrap.json.\n` +
      `  Run \`lares vessel found --force\` to re-establish the founding ceremony.`,
    );
  }
  // An admit payload carries the PersonaGroup plane's url, required: a joinee never mints a fresh local
  // persona doc in its place. A founding with no recorded plane re-founds rather than admits.
  if (!personaUrl) {
    throw new Error(
      `[lares fleet join answer] the PersonaGroup plane url is missing from social-bootstrap.json.\n` +
      `  Run \`lares vessel found --force\` to re-found with a recorded plane before admitting a device.`,
    );
  }
  if (!daemonUrl) {
    throw new Error(`[lares fleet join answer] daemon doc URL missing from social-bootstrap.json.`);
  }

  // Open daemon doc to read cap events and the group pin.
  const repo        = opts.repo;
  const progress    = repo.findWithProgress(daemonUrl as AutomergeUrl);
  // automerge-repo 2.6: whenReady() resolves the handle when ready, rejects on
  // unavailable; race it against a 5s timeout.
  const daemonHandle = await Promise.race([
    progress.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("[lares fleet join answer] daemon doc not ready after 5s")), 5000),
    ),
  ]);
  const daemonDoc    = daemonHandle.doc();
  const tiddlerMap  = (daemonDoc as LarDoc | undefined)?.tiddlers ?? {};

  // The bootstrap and the daemon doc each pin the founding face's group; they name one group, or the founding tore.
  // An added face's group rides its own anchors, which no daemon doc pins.
  if (face === 0 && tiddlerText(tiddlerMap[PERSONA_GROUP_ID_TIDDLER]) !== personaGroupId) {
    throw new Error(`[lares fleet join answer] the daemon doc pins no PersonaGroup, or another than social-bootstrap.json names — run \`lares vessel found --force\`.`);
  }

  // The founder's persona-KEL PREFIX (the identifier the joinee will pin) + the chain SNAPSHOT off the
  // founder's own per-Nexus KEL board, AT THE ISLAND THE FOUNDER'S BOOT RESOLVED (`admitBoardIsland` —
  // read its docblock for why the vessel key is not that island above the `own` notch). The joinee seeds
  // the snapshot into its local board so it boots to a head with no sync wait (no-global-now). Fail-closed:
  // a founding always seats an inception, so a prefix + a chain always stand — their absence names a torn
  // founding, refuse to admit.
  const personaKelPrefix = face === 0 ? tiddlerText(tiddlerMap[PERSONA_KEL_PREFIX_TIDDLER]) : faceAnchors?.personaKelPrefix;
  if (!personaKelPrefix && face !== 0) {
    throw new Error(`[lares fleet join answer] face ${face}'s anchors name no persona-KEL prefix — anchors written before that slot stood, so this face admits no device here.`);
  }
  if (!personaKelPrefix) {
    throw new Error(`[lares fleet join answer] persona-KEL prefix missing from daemon doc — run \`lares vessel found --force\`.`);
  }
  const founderVesselKey = await loadVesselVerifyingKey();
  const boardIsland      = admitBoardIsland(founderVesselKey);
  // ── CARRY ON READ — a door names its own sources rather than trusting a boot to have run ──
  // `open-node-vessel.ts` carries the pinned chain onto the resolved island right before its OWN board
  // read, at every boot. A rite since that boot may have moved the island, and a direct holder never
  // boots at all, so the ordinary walk `vessel found` → `persona new 0` → `nexus rite quorum` → `fleet join answer`
  // reaches this line with no daemon restart between the climb and the call. Composing the carry HERE,
  // fed by `nodeNexusIslandsBelow` off the identical resolution `admitBoardIsland` above already ran,
  // lets a sound climbed founding admit with no restart owed — the resolution names one ranking,
  // and both reads of it stay that one ranking.
  //
  // This mirrors the boot's own seam rather than sprinkling a carry onto the rite that moved the
  // island: a door names ITS sources at the point it reads, a booted daemon names them at
  // the point it boots, and neither enumerates the rites that can move an island. `persona-kel-climb.ts`
  // states the carry's own idempotence and gradient-only direction; this call inherits both by
  // composing the same function rather than a second implementation of it.
  await carryPersonaKelUpTheGradient({
    repo, nexusPubkey: boardIsland, prefix: personaKelPrefix,
    priorIslands: nodeNexusIslandsBelow({ ownVesselKey: founderVesselKey }),
  });
  const kelBoard   = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
  const personaKelChain = personaKelChainForPrefix(kelBoard.doc(), personaKelPrefix);
  if (!personaKelChain || personaKelChain.length === 0) {
    // The carry above already walked every island BELOW this one and found nothing to move — so this
    // names an identifier no island in the gradient ever seated (a genuinely torn founding), never a
    // sound climbed founder still waiting on a carry: the line above already ran that carry.
    throw new Error(`[lares fleet join answer] persona-KEL chain for ${personaKelPrefix.slice(0, 20)}… absent from ${boardIsland.slice(0, 18)}… and every island below it — the identifier was never seated — run \`lares vessel found --force\`.`);
  }

  await repo.flush();

  // The founder's PersonaGroup ROOT signs the joinee's edge (the upgrade event). The root seed is
  // founder-only, held in the spirits' house at `<lares>/identity`; the joinee supplies ONLY its
  // PUBLIC verifying key.
  if (!opts.joineeVerifyingKey) {
    throw new Error("[lares fleet join answer] the request names no joinee key — the joining vessel's public verifying key.");
  }
  const signerSeed     = await loadPersonaGroupRootSeed(face);
  // THE BINDING GATE READS THE DYAD'S SHADOW (kapae#/reach): no seat, no bind.
  await assertDyadBinds(repo, opts.joineeVerifyingKey, face);
  // The joinee's edge binds THIS hearth: the AID of its seed charter, the true name its own face's edge names.
  const hearthTrueName = hearthAid();
  if (!hearthTrueName) {
    throw new Error("[lares fleet join answer] no seed charter stands here, so no hearth stands to admit a device to — found the hearth with `lares vessel found --hearth`.");
  }

  // THE LEASE READ — off the SAME daemon doc already open above, the same fold `gateFaceJoin` runs
  // (leaseEpochPrefix → per-writer slot values → effectiveLeaseEpoch = max). The minted edge binds to
  // THIS PersonaGroup's current epoch, so a device admitted here reads fresh at the door until a later
  // roll leases it stale (re-admits via face-join regrant, never a silent renewal).
  const leasePrefix = leaseEpochPrefix(personaGroupId);
  const leaseSlotValues: string[] = [];
  for (const [title, entry] of Object.entries(tiddlerMap)) {
    if (!title.startsWith(leasePrefix)) continue;
    const text = tiddlerText(entry);
    if (typeof text === "string") leaseSlotValues.push(text);
  }
  const boundEpoch = effectiveLeaseEpoch(leaseSlotValues);

  if (!opts.catalogUrl) throw new Error("the face's PersonaGroup catalog is absent");
  const operationStore = await makeCatalogAccessor(repo, opts.catalogUrl).storeOf(personaBagIdFor(personaGroupId));
  if (!operationStore) throw new Error("the face's PersonaGroup plane is unresolved");
  const atomSeed = await loadFaceAtom(face);
  if (!atomSeed) throw new Error("this face holds no atom; re-found or re-admit it");
  const signedEdge = await buildDeviceDelegationRootHalf({ personaRootSeed: signerSeed,
    deviceVerifyingKey: opts.joineeVerifyingKey.toLowerCase(), hearthTrueName, boundEpoch });
  const operation = { store: operationStore, atomSeed,
    signedInput: opts.signedRequest ?? new TextEncoder().encode(JSON.stringify(signedEdge)) };
  const payload = await runDeviceAdmitEdge({
    operation,
    signerSeed,
    joineeVerifyingKey: opts.joineeVerifyingKey.toLowerCase(),
    personaKelPrefix,
    personaKelChain,
    hearthTrueName,
    personaGroupId,
    meshCabalDocIdHex,
    boundEpoch,
    syncUrl:      deviceAdmitSyncUrl(opts.syncUrl),
    islandDocUrl: opts.islandDocUrl ?? null,
    // THE DOOR. Defaults to this hearth's OWN daemon doc, read from the same bootstrap the sentinel ids come
    // from — a joinee seeds its own plane at admission, so only this url tells it where to knock.
    hearthDaemonUrl: opts.hearthDaemonUrl ?? daemonUrl,
    personaUrl,
  });

  // THE PIN NAMES THE DIAL (hearth-dial-pin.ts): the hearth's full sovereign sync pin at the Nexus its own sync gate
  // STANDS at (`stoodSovereignPin`: the primary charter's AID, the hearth's true name above), never the island standing's
  // scope, which an anchor or an explicit standing points elsewhere. The fleet-join answer signs it beside the edge, with
  // the canon this hearth names and the board island it stands on, resolved by the one canonical read
  // (`nodeNexusStanding`). The island freezes at the admit: a founder that climbs later moves no device it admitted;
  // that device joins again by a new act.
  const founderIdentity = nodeNexusStanding({ ownVesselKey: founderVesselKey });
  if (founderIdentity.kind === "torn") {
    throw new Error("[lares fleet join answer] the founder's Nexus standing reads torn — there is no Nexus to pin the hearth's gate at; resolve the charter first.");
  }
  const hearth: AdmitHearthReading = {
    gatePin: stoodSovereignPin(larSealHome(), opts.gateDoor),
    canon:   opts.catalogUrl ? await admitCanonDocs(repo, opts.catalogUrl) : {},
    islandKind: founderIdentity.kind, islandScope: founderIdentity.scope,
  };
  return { payload, hearth };
}
