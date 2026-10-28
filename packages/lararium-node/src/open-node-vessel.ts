/**
 * openNodeVessel — local-first Node.js vessel factory.
 *
 * A thin opener over the composable-keel engine. Node supplies the platform atoms (NodeFS storage,
 * sync route behind its face gates, worker_threads pool) and the capability pieces it holds (the inbound
 * gate, the corpus loader, the residual pool/repo verbs, the main-resident BagStowage mechanism).
 *
 * `prepareNodeBoot` builds those atoms + the keel + the boot closures ONCE, and BOTH entry-points
 * run it: the doors differ only in which #has-cap-stack they compose over the one preparation.
 *   - openNodeVessel → composeLararium — a hearth: the base course plus the caps a FACE lifts.
 *   - openNodeHerm   → composeHerm     — a crossroads: the base course plus the caps an HTTP floor
 *     serves. No wiki, no pool; the daemon stays, the immune core every vessel carries, and its
 *     registerBags omits the user-wiki bags where no wiki stands.
 * Each stack is declared at its compose site and derived by `composeVessel`; read it there.
 *
 * The node vessel holds no semantic privilege. It carries roads, docks, and sync; live VM state lives
 * in sovereign islands (daemon + wiki). FPI-5 (trim tab): all Node-specific code lives here.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { larBootstrapPath } from "./vessel-paths.js";
import { refuseLegacyPlaceBytes } from "./legacy-place-bytes.js";
import { createAfterRoll } from "./after-roll-chain.js";
import { join }                         from "path";
import type { Server }                  from "node:http";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import type { DocHandle, AutomergeUrl, DocumentId, PeerId } from "@automerge/automerge-repo";
import { Repo, interpretAsDocumentId }  from "@automerge/automerge-repo";
import { DurableNodeFSStorageAdapter } from "./durable-storage-adapter.js";
import { claimStore, type StoreClaim } from "./owned-store.js";
import { NodeWSServerAdapter }          from "@automerge/automerge-repo-network-websocket";
import type { WebSocketServer }         from "isomorphic-ws";
import type {
  LarDoc,
  LarariumVesselOptions, VesselResult, LarOpenPhase,
  VesselBootstrap, VesselCoreAssembly,
  CompositeStore, DiskMirrorGrant,
} from "@lararium/mesh";
import {
  emptyLarDoc, storedLarRecord, tiddlerText, plainRecord, plainRecordOrNull,
  LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI, CROSSROADS_DOC_URI, recipeHostFacets,
  DAEMON_BAG_ID,
  BAG_IDS, slugFromUri, verbArgsFromPayload, registerCrossroadsPointer,
  whoFaceCap, materializeSharedLarDoc, crossroadsDocUrl,
  type RealmBagRegistration, MEMORY_CUT_SHADOW_READ,
  PERSONA_GROUP_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  DEVICE_DELEGATION_SELF_TIDDLER, type DeviceDelegationTiddler,
  ENGINE_CORE_ID, BagStowage,
  deriveRegisterBags, catalogNamedBags, personaBagIdFor, personaSiblingBagIds,
  coupleMesh, crystallize, guardHitl,
  nexusIdentity, nexusScopeOrThrow, nexusIslandsBelow, nexusAidOf, foundingRoster, type NexusIdentityAt,
  climbNexusBoards, sha256HexBytesSync, RealmBoardGate,
  faceAtomKeyFromSeed, type FaceAtomKey,
  carriageFloorDutyOf, type PlaceSigner,
  genesisCasCidsFromOracle, provenVesselKeyOf,
  wikiSlugOfBag,
}                                       from "@lararium/mesh";
import { resolveNodeIslandPluginCids, nodeOfferingLookup } from "./node-plugin-resolution.js";
import { makeDurableMailbox, type DurableMailbox } from "./vessel-mailbox.js";
import { makeRealmPlane, type RealmPlanesHolder } from "./realm-plane.js";
import { noteVesselRealm, readVesselRealms } from "./edge-board.js";
import { makeEdgeShadowRing, type EdgeShadowRing } from "./edge-shadow-ring.js";
import { floorShadowRing } from "./floor-fleet-lanes.js";
import type { WikiActivationCap, PortIslandToVesselMsg } from "@lararium/mesh";
import type { PortPolicy, PortPlacement } from "@lararium/mesh/port-lease";
import type { MountManifest } from "@lararium/mesh";
import { casDirForStorage, mirrorGenesisCasFs, installCasSweep, makeRealmPaceCell, readCasPins, hermCasTransitFromEnv } from "./node-cas.js";
import { realmMaintenanceFromBoard, shareConfigOf, SessionTable, sessionBinding } from "@lararium/mesh";
import type { ShareVerdictRecord, ShareVerdictSink } from "@lararium/mesh";
import {
  ACTIVE_WIKI_URI,
  MemoryTiddlerStore,
  selectActiveWikiSlug,
  seedVesselDefaults,
  loadCatalogCorpora,
  composeVerbPlane,
  mempalaceProviderCap, formPalaceProviderCap, daemonVerbProviderCap, telemetryProviderCap,
  recallVerbCap, telemetryVerbCap, captureVerbCap, worldlineVerbCap,
  makeCatalogAccessor,
} from "@lararium/tw5";
import type {
  VesselWikiSlot, DaemonVmCore, VesselDaemonVm, VesselOrchestration,
  VerbContribution, MempalaceProvider, FormPalaceProvider, DaemonVerbProvider, TelemetryProvider, RecallClient,
} from "@lararium/tw5";
import {
  loadOrMaterializeOracle,
  readGenesisCasManifest, genesisProtectSet, genesisCasDir,
} from "./genesis-artifact.js";
import { bootFacePlanes, bootDaemonUrl }               from "./boot-face-planes.js";
import { standKahuCanon, canonHeldUntilProof, type KahuCanonDocs } from "./kahu-realm.js";
import { assemblePersonaGroupRing }       from "@lararium/keyhive";
import { daemonGenesisDir, daemonCorpusRoot } from "./lares-config.js";
import { orderHandleTurnsToStubs, type HandleTurn } from "@lararium/mempalace";
import { writebackWing, TelemetryUnavailable } from "@lararium/sensorium";
import { DeterministicFederationGate, makeCidResolver, carriageDocUrl, hostingDocUrl } from "@lararium/mesh";
import {
  standSiblingChannel, siblingRefusalLine, groupSecretSealTitle, verifyGroupSecretSeal,
  leaseEpochPrefix, readFace, proveFaceFromLog, joinFaceDocumentsOnArrival, raiseFaceFrontier, heldDocOf, personaKelChainForPrefix, personaKelBoardDocUrl,
  type SiblingNetworkAdapter, type SiblingChannelStatus,
} from "@lararium/mesh";
import { nodeHandleBookReading, runRealmBag, runRealmBags, stewardGuard } from "./realm-steward.js";
import { LarEventBusImpl, DEFAULT_RINGS } from "./lar-event-bus-impl.js";
import { setCasDoor, setRestDoor, setCustodyWriteDoor, setDyadDoor } from "./worker-handle.js";
import { writeCasEntriesFs } from "./node-cas.js";
import type { SparseFormVector, AntigenRing, FederationGate, FederationPosture, NexusMembership, PeerClass } from "@lararium/mesh";
import { selfSlotShareDecision } from "./self-slot-share.js";
import { makeAntigenRingHolder } from "./antigen-ring.js";
import { makePersonaKelRingHolder, carryPersonaKelUpTheGradient } from "./persona-kel-ring.js";
import { vesselDyads, verifiedFleetOfGroup, type LarDid } from "@lararium/mesh";
import {
  makeNexusMembership, makeRealmCharterConsult, readCarriedNexuses, liveBoardOpener,
  type NexusMembershipHolder, type SocketBinding, type CarriedNexusReading,
} from "./nexus-carriage.js";
import { readHearthDialPin } from "./hearth-dial-pin.js";
import { nodeNexusStandsAt } from "./nexus-standing.js";
import { rollQuorumLeaseOnBoard } from "./lease-rekey.js";
import { leaseCharterOf } from "./lease-charter.js";
import { selectHeldQuorumSigners } from "./held-quorum.js";
import { listSealedCids } from "./cas-reshare.js";
import { readBulbArtifact, type BulbArtifact } from "./bulb.js";
import { hermRealmShoreBooks, publicCasShore } from "./bulb-read-face.js";
import { mountFloorPorch, releasedFloorCids } from "./floor-porch.js";
import { readNexusDoc } from "./nexus-doc.js";
import { makeSealedPlaneRegistry } from "./plane-seal.js";
import { cadSealDir, registerSealedCarrier } from "./seal-carrier-federation.js";
import { makeBagTracker } from "./bag-tracker.js";
import { startCarriageRelay, type CarriageRelay } from "./carriage-relay.js";
import { openRelayGateSeed } from "./relay-gate-seed.js";
import { maybeStartNexusClientDial, type NexusClientDial } from "./nexus-client-dial.js";
import { nodeDialSocket } from "./node-dial-socket.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadFaceAnchorOfGroup, keepFaceAnchorOfGroup } from "./face-anchor-store.js";
import { raiseAnchorFromSlots } from "./lease-observation.js";
import { readFacePersonaRecords } from "./persona-act-store.js";
import { CustodyLocked } from "./custody-holder.js";
import { fleetLineageOf } from "./fleet-lineage.js";
import { hearthGatePins, hearthNameOf, dialDeadlines, chooseHearthDial, fileHearthPins, type HearthDialChoice } from "./hearth-gate-pins.js";
import { composeDialPresentation } from "./dial-presentation.js";
import { nodeSessionDoor } from "./uds-session-door.js";
import type { UdsSessionDoor } from "./uds-channel.js";
import type { GateBundlePin } from "@lararium/mesh";
import { hexToBytes as carriageHexToBytes, type MeshPalaceDoc, type FlowPullResult } from "@lararium/mesh";
import { gateReadingsFor, layStatementOn, flowFloorPinAt, vesselCarriagePull } from "./herm-carriage.js";
import { readKeptAdmitBundles } from "./admit-bundle.js";
import { readCasBlobFromFs, readVerifiedCasBlobFromFs } from "./node-cas.js";
import { makeSourceCapture, type SourceCapture } from "./capture/capture-source.js";
import { VesselIslandPool, NODE_WIKI_ACTIVATION_CAP } from "./vessel-island-pool.js";
import { runFlow } from "./flow-run.js";

/** Node advertises a few rotatable wiki pins BESIDES the daemon bag (resource-rich vessel).
 *  The user's ONE-plus rotatable pin(s) ride this budget; the surface enforces it. */
const NODE_WIKI_PIN_BUDGET = 3;
import { larSealHome, larStructurePalaceDir, larFormPalaceDir, memorySensoriumDir, meshSensoriumDir, larContentDir, sensoriumDir }  from "./vessel-paths.js";
import { makeFormPalace, type FormPalace, makeStructurePalace, type StructurePalace }  from "./sensorium.js";
import { readCoupling } from "./sensorium-coupling.js";
import { readCohere } from "./sensorium-cohere.js";
import { readJing } from "./sensorium-square.js";
import { extractSignalFromTarget } from "./sensorium-signal.js";
import {
  rosterSensoria, inspectSensorium, buildEphemeralSensorium, promoteSensorium,
  retireSensorium, unRetireSensorium, purgeSensorium, reconcileSensorium, reconcileAllSensoria,
} from "./sensorium-lifecycle-verbs.js";
import { makeRecallHolder, type RecallHolder } from "./recall-holder.js";
import { makeContentPalace, type ContentPalace } from "./sensorium.js";
import { multiGraphRecall, makeFormSearch, makeStructureSearch }  from "./sensorium-recall.js";
import { waitHandle, resolveBootDoc } from "./repo-helpers.js";
import { makeChildProcessDocLoadProbe, quarantineDoc, recoverCleanTail } from "./doc-load-probe.js";
import { listAnchoredPersonas, loadIdentityAnchors, loadVeilArchive, persistVeilArchive } from "./identity-anchors.js";
import { openOutboxKey } from "./outbox-key.js";
import { sweepFoundingSeeds } from "./face-atom-store.js";
import { readWornPersonaMount } from "./worn-mount.js";
import { openDaemonVm }                    from "./open-daemon-vm.js";
import { repoPersonaSelvesPlane }          from "./persona-selves-plane.js";
import { makeSeatSettler, type SeatDutiesAnswer } from "./seat-settle.js";
import { askIslandMemory, askSeatDuties, type IslandAsk } from "./island-verb-ask.js";
import type { BackupDoor }                from "./face-bundle-cut.js";
import { readLocalPersonaKelChain }       from "./local-persona-kel.js";
import { runEdgeSeatFacts, runEdgeSeatMarks, EdgeSeatError } from "./commands/edge-seats.js";
import type { PersonaSelvesPlane, SealedActContext } from "./sealed-acts.js";

/** The hearth dial a custody act reads: `SealedActContext.walk`, lent by the standing composition. */
export type WalkDialReading = NonNullable<SealedActContext["walk"]>;
/** The store a hosting roll lands on: `SealedActContext.hosting`, lent by the standing composition. */
export type HostingDoor = NonNullable<SealedActContext["hosting"]>;
import {
  makeResidencyStatsReactor,
  makeVesselResidency, type VesselResidency,
  replayPinsFromDaemonDoc,
} from "@lararium/tw5";   // residency stats — the lone read that stays main-resident; the shared residency/pool-wiring factory
import { loadVesselIdentity, vesselPlaceSignerDoor, loadPersonaGroupRootVerifyingKey, listPersonaRoots, sovereignStands } from "./node-vessel-identity.js";
import { socketsNoLongerHeld, ownPlacePosture, sameOperatorStands, seatedDeviceKey, type PlaceClass, type SeatedPresenter } from "./socket-sorter.js";
import { faceGateServer, gateSessionRegistry, timerGateDeadlines } from "./face-gate-server.js";
import { gateSyncServer, type GateSyncSocket }    from "./gate-sync-server.js";
import { vesselAdmitReader, vesselGate, type VesselGateDeps } from "./vessel-gates.js";
import { gateShadowRing, type FaceDeviceReading } from "./gate-shadow-ring.js";
import { faceDeviceBook }                        from "./face-device-book.js";
import { faceFleetViews, bridgeBooks }                from "./face-fleet-view.js";
import { heldRootHoldings }                      from "./face-root-holdings.js";
import { gateGrantRing }                         from "./gate-rings.js";
import { readFaceJoinRecord }                    from "./fleet-join-custody.js";
import { gateMemoryRows }                        from "./gate-memory-rows.js";
import { custodyGateDoor }                       from "./custody-seat.js";
import { vesselFloorKeyDoor, loadPlaceKelChain } from "./node-vessel-identity.js";
import { hearthFloorPins }                       from "./hearth-sovereign-pin.js";
import { hearthFloorProof }                      from "./hearth-floor-claims.js";
import { readKeptHearthFloorPins }               from "./hearth-floor-pin-store.js";
import type { FlowGateArgs, FlowReadGate }  from "./flow-read-face.js";
import {
  deriveGateBundle, sovereignGateRoot, floorGateRoot, sovereignRoute, floorRoute, storedWithdrawals, memoryBackedWithdrawals,
  SOVEREIGN_SYNC_ROUTE, FLOW_SOCKET_ROUTE,
  type GateBundle, type GateSession, type GateSessionTable,
} from "@lararium/mesh";
import { placeCarriedNexuses, unionReadings }      from "./vessel-raise.js";
import { landEveryHostingAct }                    from "./commands/host.js";
import { listWalkRecords }        from "./node-walk-store.js";
import { storeDoorReactors, awaitOnRolled }       from "./store-door-verbs.js";
import { carriedSet, readCarriedCharters }       from "./carried-set.js";
import { composeLararium, composeHerm, carriageStack, type MeshSelf } from "./node-caps.js";

/** The genesis dir when a caller sites none — resolves through the composable genesis cap
 *  (`LAR_GENESIS` → `~/.lares/config.json` → repo-relative `<corpus>/genesis`). Genesis stays
 *  checked-in-by-default, so a no-config boot lands on the repo's tracked seed exactly as before. */

function defaultGenesisDir(): string {
  return daemonGenesisDir();
}

/** FNV-1a 32-bit over a string → a STABLE non-negative index label. Deterministic per axis-id, so
 *  the SAME axis id maps to the SAME index in EVERY turn's vector — the cross-turn alignment a sparse
 *  form-vector needs. (A dense global basis index would be exact, but the stored `document` does not
 *  carry it — see parseFormVector; this keeps the axis IDENTITY instead of discarding it.) */
function axisIdToIndex(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;   // unsigned 32-bit
}

// R3/M1 — "plugins load by recipe" (node). `resolveNodeIslandPluginCids` and `nodeOfferingLookup`
// now live in `node-plugin-resolution.ts` — the ONE node resolver module BOTH node paths (the
// daemon VM and the wiki island pool, below) import, instead of each call site reproducing or
// re-deriving the combinator. See that module's docblock.

/**
 * Pull a sparse form-vector out of a form-store entry's stored `document` (the move-space position
 * the worldline-trajectory read joins). The python store keeps the dense embedding internally; the
 * JSON `document` carries the axis activation. The host fetches this node-side (the form store is a
 * node child_process the worker can't reach) and SHIPS it to the in-VM trajectory read. An absent /
 * unparseable document yields null (the worker keeps the turn's TIME slot, form null). The node-side
 * reads live here; the trajectory read itself runs in the sovereign worker.
 *
 * The stored `document` carries `axis_activation` as an axis-ID-KEYED map (`{ "voice:council": 0.9, … }`).
 * Each key IS the axis identity — it MUST determine the sparse index, else two turns whose active-axis
 * SETS differ get misaligned indices (a positional counter maps `voice:council`→0 in one turn and →1 in
 * another, silently corrupting every cross-turn comparison). We derive a stable index per axis-id so the
 * axis KEY survives. When the encoder's canonical `form_vector` rides the document (the exact indices),
 * we prefer it verbatim.
 */
export function parseFormVector(document: string): SparseFormVector | null {
  try {
    const obj = JSON.parse(document) as Record<string, unknown>;
    // Preferred: the encoder's canonical sparse vector, if the store persisted it — exact basis indices.
    const fv = obj["form_vector"];
    if (fv && typeof fv === "object") {
      const rec = fv as Record<string, unknown>;
      const idx = rec["indices"];
      const val = rec["values"];
      if (Array.isArray(idx) && Array.isArray(val) && idx.length === val.length
          && idx.every((n) => typeof n === "number") && val.every((n) => typeof n === "number")) {
        return { indices: idx as number[], values: val as number[] };
      }
    }
    const act = obj["axis_activation"];
    if (act && typeof act === "object") {
      const entries = Object.entries(act as Record<string, unknown>).filter(([, v]) => typeof v === "number");
      if (entries.length === 0) return { indices: [], values: [] };
      // Index by the axis KEY (not by position) so the identity survives + aligns across turns; sort
      // by the derived index so the pairing stays deterministic.
      const pairs = entries
        .map(([k, v]) => [axisIdToIndex(k), v as number] as const)
        .sort((a, b) => a[0] - b[0]);
      return {
        indices: pairs.map(([i]) => i),
        values: pairs.map(([, v]) => v),
      };
    }
    return { indices: [], values: [] };
  } catch {
    return null;
  }
}

/**
 * Upstream's NodeWSServerAdapter declares ready only on its FIRST client
 * connection — un-pono for a local-first vessel: readiness reads from local
 * state (the server listens), never from a peer's arrival (no global now).
 * Upstream's own CLIENT adapter force-readies on a 1s timer for the same
 * reason. Without this, a zero-client vessel parks every storage-miss
 * repo.find() at networkSubsystem.whenReady() and the island→main→island
 * doc relay deadlocks silently (no reply, not even doc-unavailable).
 */
class ListeningWSServerAdapter extends NodeWSServerAdapter {
  override isReady(): boolean { return true; }
  override whenReady(): Promise<void> { return Promise.resolve(); }
}
/** Title of the social bootstrap plugin tiddler baked by lararium:init. */
export const SOCIAL_BOOTSTRAP_PLUGIN_TITLE = "lar:///ha.ka.ba/lararium/bootstrap/social";

/** @see LarOpenPhase in @lararium/mesh */
export type NodeOpenPhase = LarOpenPhase;

/**
 * What the operator ASKS this vessel to stand as — the first argument `standAs` weighs.
 *
 * A vessel composes by what it EARNS, never by a type it declares: every one stands as a herm and lifts to a
 * hearth when a face stands. So this DECLINES the lift ("herm" — a public crossroads meant to stay faceless)
 * or leaves it open; it never selects a different kind of thing.
 *
 * The word "recipe" belongs to the pinned WIKI's composition and to nothing else.
 */
export type AskedStanding = "lararium" | "herm";

export interface NodeVesselOptions extends LarariumVesselOptions {
  portPolicy?: PortPolicy;
  onPortMessage?: (binding: string, islandKey: string, msg: PortIslandToVesselMsg) => void;
  storageDir: string;
  wss:        WebSocketServer;
  catalogUrl?: string | null;
  /** Directory holding the BAKED GENESIS SEED (island + cas). The bootstrap no longer lives here. */
  genesisDir?: string;
  /** Repo root for wiki memes scan and all mirror paths. Defaults to monorepo root. */
  rootDir?: string;
  /** HTTP server the Herm's FLOW-map read-face serves over (required for openNodeHerm). */
  httpServer?: Server;
  /** Optional sole request dispatcher for production face composition. */
  dispatcher?: HttpFaceDispatcher;
  /** This vessel's mesh standing — derived once via deriveMeshSelf. Present → it self-announces,
   *  self-peers, re-ranks by proximity + drifts r (a Lararium carries ALONGSIDE its wiki-full core; a
   *  Herm IS its carriage). Absent → a leaf that only carries what it pulls. */
  meshSelf?: MeshSelf;
  /** Carriage pull cadence (ms) — tuning, kept separate from membership. */
  pullIntervalMs?: number;
  /** STAND the herm's relay port: siblings of a PersonaGroup leave persona-KEL drops on it over plain HTTP, and every
   *  WebSocket upgrade meets silence. The port the relay BINDS (0 → an OS-assigned free port; a Pi deployment pins a
   *  stable one). ABSENT (and `LAR_HERM_RELAY_PORT` unset) → NO relay port stands (provably inert). */
  standCarriageRelayPort?: number;
  /** The peer node's `/ws` URL (Socket A, cleartext CRDT) this vessel DIALS to sync — the same-operator device
   *  breath. ABSENT → NO client adapter mounts, NO dial, zero change (provably inert). */
  joinSyncUrl?: string;
  /** The DIALED hearth's verifying-key hex, pinned out of band and NEVER trusted from the wire: the island anchor a
   *  joinee resolves its Nexus under. The dial itself reads its full gate pin
   *  from the pair index (house ruling "The admit's gate pin"), never from this key. */
  joinGatePubKey?: string;
  /** The pinned relay addresses of the HERMS this vessel's PersonaGroup siblings meet through
   *  (`ws://host:port#<gate key hex>`, two or more under distinct gate keys for tolerance) — a device of a fleet
   *  that reaches its siblings by dialing out (`docs/pono/identity-slot-policy#/the-leaf-taxonomy`). PRESENT and a
   *  face stands → the vessel stands its sibling channel (`standSiblingChannel`, the one composition the browser
   *  vessel calls too) over every one, and pulls its KEL successor drops off every one. ONE herm stands it
   *  DEGRADED: withholding cannot be tolerated through one herm, said on every dial and in `siblingChannel()`. An
   *  address that pins no gate key refuses the channel, said alike. Either way the rest of the vessel boots.
   *  ABSENT (and `LAR_SIBLING_HERMS`, a comma-separated list, unset) → no sibling channel stands. */
  siblingHerms?: readonly string[];
  /** OPTIONAL doc URL the dial-out `repo.find()`s once mounted. Absent → the document the admit named beside its pin
   *  (`fleet join answer --doc-url`, kept by the landing: hearth-dial-pin.ts); neither → the vessel syncs only docs it
   *  already knows. */
  joinDocUrl?: string;
  /**
   * The session table and binding the dial's face session opens on (`composeDialPresentation`). Absent → the vessel
   * makes the dial's own table (`@lararium/mesh/session-contract`, one per boot) and opens a "socket" binding.
   */
  dialSessions?: Pick<Parameters<typeof composeDialPresentation>[0], "table" | "binding" | "profile">;
  /** THE WIRE PROBE — an injectable sink over every share verdict this vessel answers and every sync message
   *  its Repo generates or receives. ABSENT (and `LAR_WIRE_LOG` unset) → nothing wraps the policy and nothing
   *  listens; the boot behaves exactly as it did (provably inert). A witness arms it to read WHERE a document
   *  enters or leaves a peer's sync session. */
  onShareVerdict?: ShareVerdictSink;
  /** The floor this composition stands on. Given: the composition uses its claim and never releases it, so the
   *  caller composes again on the same floor after a `teardown`. Absent: the composition stands its own floor and
   *  releases it when it tears down or refuses. */
  floor?: NodeFloor;
  /** The private rows this composition reads. `null` composes at the FLOOR: no reader runs, so no private row is
   *  read and nothing private is minted. Absent: the seated custody's rows when this process holds its vessel key,
   *  the floor otherwise. */
  sovereign?: SovereignReaders | null;
}

/**
 * THE FLOOR A COMPOSITION STANDS ON — the vessel's one claim on its store, held for the process's life.
 *
 * A composition (the Repo, the gate, the daemon island, every closure a boot builds) stands on a floor and
 * tears down off it; the floor's rendezvous name answers throughout, so a caller that reaches the vessel between
 * two compositions waits on the name instead of meeting a refused socket. The floor reads no private row.
 */
export interface NodeFloor {
  readonly storageDir: string;
  readonly storeClaim: StoreClaim & { readonly holder: "vessel" };
  /** Free the store's name. Idempotent. */
  readonly release: () => Promise<void>;
}

/**
 * THE SOVEREIGN SEAM — every private carrier row a composition reads, behind one object. A composition handed
 * `null` reads none of them: it stands at the floor, faceless and carrying, and every sovereign act waits.
 */
export interface SovereignReaders {
  readonly wornMount: (storageDir: string) => ReturnType<typeof readWornPersonaMount>;
  readonly personaRoots: () => ReturnType<typeof listPersonaRoots>;
  readonly walkRecords: () => ReturnType<typeof listWalkRecords>;
  /** One face's veil archive, or null when none stands. */
  readonly veilArchive: (personaGroup: string) => Promise<Uint8Array | null>;
  /** Seal one face's veil archive at rest. */
  readonly writeVeilArchive: (bytes: Uint8Array, personaGroup: string) => Promise<void>;
  /** The vessel's outbox key, minted into its hot row on the first ask and opened on every later one (`outbox-key`). */
  readonly outboxKey: (face: number) => Promise<Uint8Array>;
}

/** The sovereign rows, read and written through the custody seated in this process (`custody-seat`). */
export function seatedSovereignReaders(): SovereignReaders {
  return { wornMount: (dir: string) => readWornPersonaMount(dir, { refuse: "throw" }), personaRoots: listPersonaRoots, walkRecords: listWalkRecords,
    veilArchive: loadVeilArchive,
    writeVeilArchive: persistVeilArchive, outboxKey: openOutboxKey };
}

/**
 * THE LATE DIAL'S ONE FLIGHT. A board change and the after-roll hook both ask for the late dial, unserialized, and the
 * dial's choice awaits before it stands: each ask that read "no dial" would stand its own client adapter, and only the
 * last one the vessel keeps is ever stopped. One flight answers every ask while it runs; an ask once the dial stands,
 * or once the vessel stands down, stands nothing; `stand` reads `live` again after each of its awaits.
 */
export function lateDialOnce(deps: {
  /** A dial already stands. */
  readonly standing: () => boolean;
  /** The vessel stood its dial down: nothing stands after it. */
  readonly tornDown: () => boolean;
  /** Stand the dial; `live` answers false once a dial stood or the vessel stood down, and the stand then stands nothing. */
  readonly stand:    (live: () => boolean) => Promise<void>;
}): () => Promise<void> {
  let flight: Promise<void> | null = null;
  const live = (): boolean => !deps.standing() && !deps.tornDown();
  return () => {
    if (!live()) return Promise.resolve();
    if (flight !== null) return flight;
    const mine: Promise<void> = Promise.resolve().then(() => deps.stand(live)).finally(() => { if (flight === mine) flight = null; });
    flight = mine;
    return mine;
  };
}

/**
 * Stand the floor: bind the store's rendezvous name before any Repo opens (`claimStore`) and hold it. Every
 * caller that reaches the name from here on waits on this vessel; a direct act mid-flight is waited out, and
 * another vessel on this store refuses by name.
 */
export async function standNodeFloor(storageDir: string): Promise<NodeFloor> {
  const storeClaim = await claimStore(storageDir, {
    holder: "vessel", awaitDirect: true,
    onAwait: (heldBy) => console.log(`[lararium] the store waits on a direct act before this vessel opens it: ${heldBy}`),
  });
  console.log(`[lararium] this vessel holds its store at ${storeClaim.socketPath}`);
  let released: Promise<void> | null = null;
  return { storageDir, storeClaim, release: () => (released ??= storeClaim.release()) };
}

/**
 * The rest door's whole act: wait until each named document has reached `repo`, then flush them into its store.
 * It resolves only after the store holds every one durably, so an acknowledgment never runs ahead of the save.
 */
export async function restInStore(repo: Pick<Repo, "find" | "flush">, documentIds: readonly string[]): Promise<void> {
  for (const id of documentIds) await repo.find<LarDoc>(`automerge:${id}` as AutomergeUrl);
  await repo.flush(documentIds as DocumentId[]);
}

/** What a composition stood, in the order it stood it; a teardown runs the list backward. */
type Stood = Array<{ readonly what: string; readonly down: () => void | Promise<void> }>;

/** Run a composition's teardown list backward. One fault names itself and never skips the entries beneath it. */
async function standDown(stood: Stood): Promise<void> {
  for (const entry of stood.splice(0).reverse()) {
    try { await entry.down(); }
    catch (e) { console.log(`[lararium] teardown: ${entry.what} — ${e instanceof Error ? e.message : String(e)}`); }
  }
}

export interface NodeVesselResult extends VesselResult<VesselIslandPool, DaemonVmCore> {
  ports: { place(surface: string, binding: string, msg: unknown): PortPlacement; close(binding: string): void };
  /** Started event bus — ingress rings registered; tick loop running at 20 Hz (node substrate). */
  eventBus:  LarEventBusImpl;
  /** Stop the N-accumulator tick loop (call on graceful shutdown). */
  stopTick:  () => void;
  /** Tear this composition down whole: every island, timer, socket and listener it stood, then its Repo. The
   *  floor it was handed keeps standing; a floor it stood itself releases. */
  teardown: () => Promise<void>;
  /** The oracle's floor gates, one per Nexus this vessel stands in — the read face a host mounts takes them. */
  floorGates: FlowGateArgs["gates"];
  /** The sibling channel as it stands — null when no channel was configured, its refusal when it refuses to stand. */
  siblingChannel: () => SiblingChannelStatus | null;
  /** This vessel's claim on its store, taken before its Repo opened; its verb channel serves it (`startUdsChannel`). */
  storeClaim: StoreClaim & { readonly holder: "vessel" };
  /** Each carried face's own persona plane off this thread's Repo, for the custody door's `selves` acts; null where no face stands lit. */
  personaSelves: PersonaSelvesPlane | null;
  /** The hearth dial as the custody door's `walk` acts read it. */
  walkDial: WalkDialReading;
  /** This vessel's own Repo and its after-roll refold, for the custody door's `host` acts. */
  hostingDoor: HostingDoor;
  /** What this composition lends a backup bundle's cut: the worn face, its own edge's shadow, the island's memory section and the board's key history. */
  backupDoor: BackupDoor;
  /** M15: which social planes mounted live vs degraded vs PENDING (probe answered no verdict at all —
   *  distinct from a real condemn). `degraded` already logs its own line live (`quarantineDoc`
   *  above); `pending` entries carried NO log line at all until this field threaded them out here for
   *  the boot log to name (main.ts). */
  mountManifest: MountManifest;
  /** The session socket's door: each face this vessel holds opens its own session at the Nexus the vessel dials. */
  sessionDoor: UdsSessionDoor;
}

/** A composed Herm (wiki-less): the daemon immune core + a served meshpalace FLOW-map, no pool. */
export interface NodeHermResult {
  repo:             Repo;
  store:            CompositeStore;
  daemon:           DaemonVmCore;
  oracleDocUrl:     string;
  catalogHandleUrl: string;
  larariumDocUrl:   string | null;
  phase:            "live";
  /** The bound port the STOOD herm relay port listens on — `null` when no relay was configured (inert). A sibling
   *  pins `ws://<host>:<port>#<gate key>` from this. */
  carriageRelayPort:       number | null;
  /** The stood relay port's gate verifying-key hex — the fragment of a sibling's pinned relay address.
   *  `null` when no relay was configured. */
  carriageRelayGatePubKey: string | null;
  /** The oracle's floor gates, one per Nexus this vessel stands in. */
  floorGates:       FlowGateArgs["gates"];
  /** This vessel's claim on its store, taken before its Repo opened; its verb channel serves it (`startUdsChannel`). */
  storeClaim:       StoreClaim & { readonly holder: "vessel" };
  /** Each carried face's own persona plane off this thread's Repo; null where no face stands lit. */
  personaSelves:    PersonaSelvesPlane | null;
  /** The hearth dial as the custody door's `walk` acts read it. */
  walkDial:         WalkDialReading;
  /** This vessel's own Repo and its after-roll refold, for the custody door's `host` acts. */
  hostingDoor:      HostingDoor;
  /** What this composition lends a backup bundle's cut: the worn face, its own edge's shadow, the island's memory section and the board's key history. */
  backupDoor:      BackupDoor;
  /** M15: which social planes mounted live vs degraded vs PENDING — see `NodeVesselResult.mountManifest`. */
  mountManifest:    MountManifest;
  /** Tear down the read-face + the daemon island, then the composed vessel (reverse build order). */
  dispose:          () => Promise<void>;
  /** `dispose`, then everything else this composition stood, then its Repo. The floor it was handed keeps
   *  standing; a floor it stood itself releases. */
  teardown:         () => Promise<void>;
}

const blankMemeStore = (repo: Repo): (() => DocHandle<LarDoc>) =>
  () => repo.create<LarDoc>(emptyLarDoc());

/** The atoms + keel + boot closures both node cap-stacks compose over (built ONCE per boot). */
interface NodeBootPrep {
  wornFace: () => { readonly face: number; readonly personaGroup: string } | null;
  repo:             Repo;
  /** The store's claim, taken before the Repo opened and held for the vessel's life. */
  storeClaim:       StoreClaim & { readonly holder: "vessel" };
  catalogHandle:    DocHandle<LarDoc>;
  /** This vessel's own daemon doc — the plane a caller writes a verb SUMMONS onto (VesselResult carries it
   *  out, so a host surface can ask this vessel rather than only render it).
   *
   *  A THUNK, like every other late-bound member here: the bootstrap lands inside `loadGenesis`, which runs
   *  well after this prefab is built. Reading it at construction time reads `undefined` — and a FACELESS
   *  place, which stands with no bootstrap at all until a face is lit, is where that shows. */
  daemonDocUrl:     () => string;
  /** The HEARTH this vessel asks for a seat — null when it holds its own face and IS the hearth. A thunk for
   *  the same reason. */
  hearthDaemonUrl:  () => string | null;
  /** Each carried face's own persona plane off this Repo, or null where the bootstrap names no face. A thunk, as above. */
  personaSelves:    () => PersonaSelvesPlane | null;
  /** The hearth dial as a custody act reads it: the gate key it pins, and the standing walk dial's re-presentation. */
  walkDial:         WalkDialReading;
  /** The store a hosting roll lands on, and the refold a landed roll owes. */
  hostingDoor:      HostingDoor;
  /** What this composition lends a backup bundle's cut: the worn face, its own edge's shadow, the island's memory section and the board's key history. */
  backupDoor:      BackupDoor;
  sessionDoor:     UdsSessionDoor;
  /** This place's scoped five-duty signer at the standing KEL head. */
  placeSigner:    PlaceSigner;
  /** This vessel's own gate key — the node ANCHORS its confederation, so its gate key doubles as the Nexus
   *  key its admitted browser leaves resolve. Every per-Nexus board (WHO, KEL, antigen) scopes to it. */
  nexusPubkey:      string;
  /** This vessel's gate key — its own verifying key, the key every gate it stands answers under. */
  vesselGateKey:    string;
  /** The oracle's floor gates, one per Nexus this vessel stands in. */
  floorGates:       FlowGateArgs["gates"];
  /** THE GATE-NATIVE CARRIAGE PULL (the routes ruling, stable-founding-road: carriage peering flips on a proven gate-native
   *  caller): one floor dial per (peer, Nexus) at the pin this vessel's boards carried, presenting what it stands as there. */
  carriagePull:     (peer: string, publisherKey: string) => Promise<FlowPullResult<MeshPalaceDoc>>;
  residency:        BagStowage;
  /** The STOOD herm relay port — present ONLY when a relay port was configured; else null (inert). It keeps the
   *  persona-KEL drops siblings leave over plain HTTP. The two vessel entry-points fold its `close()` into their
   *  teardown so no server leaks past close. */
  carriageRelay:    CarriageRelay | null;
  /** The sibling channel as it stands — null when no channel was configured, its refusal when it refuses to stand. */
  siblingChannel:   () => SiblingChannelStatus | null;
  /** The client dial-out (Socket A) — present ONLY when a peer sync URL + gate key were configured; else null
   *  (inert). The two vessel entry-points fold its `stop()` into teardown so no client socket leaks past close. */
  nexusDial:        NexusClientDial | null;
  /** The HELD bulb (genesis seed + CAS + bootstrap, epoch-PINNED) this vessel can serve over the public floor —
   *  null when the genesis is absent. A Herm serves it by cid so a stranger kindles their OWN sovereign hearth. */
  bulb:             BulbArtifact | null;
  emit:             (p: NodeOpenPhase) => void;
  /** The full-node orchestration (keel + every VM closure) the shared cap composer walks. */
  orchestration:    VesselOrchestration<VesselIslandPool>;
  /** The daemon/verb closures the granular herm caps consume (openDaemon takes the slot OPTIONAL). */
  openDaemon:       (a: { assembly: VesselCoreAssembly; slot?: VesselWikiSlot }) => Promise<VesselDaemonVm>;
  wireVerbs:        (registry: Parameters<NonNullable<VesselOrchestration<VesselIslandPool>["wireVerbs"]>>[0], assembly: VesselCoreAssembly) => void;
  afterDaemon:      (daemon: VesselDaemonVm, assembly: VesselCoreAssembly) => void;
  /** The STANDING realm registrations this vessel's realm carries (empty while it stands in none) — the Herm's
   *  shore reads them to follow the realm's PUBLIC books, and the realm plane is the only hand that folds them. */
  realmStanding:    () => Promise<ReadonlyMap<string, RealmBagRegistration>>;
  /** Forward-ref reads — set as the closures run (the same `let vmManager!` pattern, surfaced). */
  daemonVm:         () => DaemonVmCore;
  eventBus:         () => LarEventBusImpl;
  slotActiveWikiId: () => string;
  activeWikiSource: () => "boot-arg" | "daemon-marker";
  /** Stand down everything the prep and its closures stood, then the Repo; releases a floor the prep stood itself. */
  teardown: () => Promise<void>;
}

/**
 * Build the shared node boot substrate: the platform atoms (repo + WS relay/gate, catalog, operator
 * identity, residency mechanism) + the keel + the VM-focused closures (wiki-slot, daemon,
 * verbs, pool, after-hooks). NO sequencing here — `composeLararium`/`composeHerm` wire the order.
 */
async function prepareNodeBoot(opts: NodeVesselOptions, placeClass: PlaceClass): Promise<NodeBootPrep> {
  refuseLegacyPlaceBytes();
  if (opts.floor && opts.floor.storageDir !== opts.storageDir) {
    throw new Error("[lararium] the floor handed to this composition holds another store");
  }
  const floor = opts.floor ?? await standNodeFloor(opts.storageDir);
  const ownsFloor = opts.floor === undefined;
  const stood: Stood = [];
  let down: Promise<void> | null = null;
  // A REFUSED BOOT FREES ITS STORE. Whatever stood before the refusal stands down, and a floor this composition
  // stood itself releases, so the next boot never meets a name a dead composition still holds.
  const teardown = (): Promise<void> => (down ??= (async () => {
    await standDown(stood);
    if (ownsFloor) await floor.release();
  })());
  try {
    return await prepareNodeBootOn(opts, placeClass, floor, stood, teardown);
  } catch (e) {
    await teardown();
    throw e;
  }
}

/**
 * The founding-seed sweep runs under the sovereign gate only: a composition at the floor sweeps nothing, since the sweep reads and
 * moves private rows. One door for the boot's call, so a witness drives the gate's caller without a vessel boot.
 */
export async function sweepUnderTheGate(sovereignOpen: boolean, sweep: () => Promise<void>): Promise<void> {
  if (sovereignOpen) await sweep();
}

async function prepareNodeBootOn(
  opts: NodeVesselOptions, placeClass: PlaceClass, floor: NodeFloor, stood: Stood, teardown: () => Promise<void>,
): Promise<NodeBootPrep> {
  const { wikiId, storageDir, wss, catalogUrl, onPhase, genesisDir, rootDir: rootDirOpt } = opts;
  // THE GATE: sovereign only when the node key stands held AND the worn face stands unlocked; otherwise the floor composes.
  const sovereignOpen = sovereignStands();
  await sweepUnderTheGate(sovereignOpen, sweepFoundingSeeds);
  // ONE READING OF WHAT THIS COMPOSITION MAY OPEN. Handed readers, it reads the private rows through them; handed
  // `null`, it stands at the floor and reads none. Left to itself it reads the seated custody's rows when this
  // process holds its vessel key, and stands at the floor when it holds none.
  const sovereign = opts.sovereign !== undefined ? opts.sovereign : (sovereignOpen ? seatedSovereignReaders() : null);
  // THE CORPUS ROOT every disk projection mirrors under: the one named, else `LAR_ROOT`, else the repo. A boot
  // isolated under `LAR_ROOT` projects into that root, never into the tracked tree; with neither, a fresh clone
  // boots repo-relative as it always has.
  const corpusRoot = rootDirOpt ?? daemonCorpusRoot();
  const bootstrapPath = larBootstrapPath();   // <lares>/vessel — beside the docs it addresses
  // The hearth dial an admission pinned (null on a self-founded vessel — it IS the hearth).
  const hearthPin = readHearthDialPin(bootstrapPath);
  // THE FACE THE OPERATOR WORE. `persona wear N` moves ONLY the selector pointer; the daemon doc's singular
  // mount pins were written by the FOUNDING face and never move again, so a reboot re-mounted h0 whatever
  // mask was on. A worn non-founding face carries its own mount material in its anchors — the pins below
  // default to it. Null means no switch is owed (h0, nothing worn, or anchors without the material).
  const wornMount = sovereign ? await sovereign.wornMount(storageDir) : null;
  // THE FACE THIS VESSEL WEARS, READ FROM SEALED CUSTODY ALONE: the worn mount's group, else the founding face's anchors. The mutable
  // bootstrap never names the face (it carries planes; the proof checks them against this one). A locked or faceless place names none.
  const custodyGroup: string | null = wornMount?.personaGroupId
    ?? (sovereign ? ((await loadIdentityAnchors(0).catch((e: unknown) => { if (e instanceof CustodyLocked) return null; throw e; }))?.personaGroupId ?? null) : null);
  // THE ROSTER READS WHOLE BEFORE ANYTHING STANDS ON IT. Every reading of what this vessel carries by persona (a
  // seated chair, a kept consent, the worn leaf) answers off the persona roster, and those readings answer empty
  // when they cannot read. So a sovereign composition reads the roster here, once, with no catch: a roster that
  // stands and does not open refuses this composition by row name, and the vessel stands at the floor naming it.
  if (sovereign) await sovereign.personaRoots();
  if (wornMount) {
    console.log(`[persona] worn h${wornMount.handleIndex} — the mount re-pins from its OWN anchors; the founding face's pins name h0`);
  }
  const emit = (p: NodeOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── 0. The claim — ONE STORE, ONE HOLDER, AT EVERY INSTANT ──────────────────
  // The vessel binds its store's rendezvous name BEFORE its Repo opens, the same claim a direct lares command
  // takes for its act (`claimStore`), and holds it for its whole life: through the boot every caller that reaches
  // the name waits on this vessel's verb channel, so no command opens a second Repo beside this one while it boots.
  // A direct act mid-flight is waited out; another vessel on this store refuses the boot by name.
  const storeClaim = floor.storeClaim;

  // ── 1. Repo — NodeFS storage + the sync route behind this vessel's face gates ─────
  // One sovereign gate per Nexus on the sync route (`SOVEREIGN_SYNC_ROUTE`), each on its own knock, stood once the
  // custody root answers (below). A dial its gate verified opens a sealed session; the registry hands each opened
  // session to the Repo's adapter as one socket (`gate-sync-server`), so no frame reaches the Repo before the
  // gate's verdict left.
  const storage = new DurableNodeFSStorageAdapter(storageDir);
  // THE FLOOR PIN SET (house ruling "The admit's gate pin": a floor route's full pin travels through an authenticated
  // relation): each sovereign session hears, at open, the floor pins this
  // hearth stands at the Nexus that seated it, the same pins the floor gates below derive (`hearthFloorPins`).
  const gateSync = gateSyncServer({ floorPins: async (nexus) => hearthFloorPins(nexus, await vesselFloorKeyDoor()), floorProof: hearthFloorProof });
  const syncSessions = gateSessionRegistry((channel, session) => gateSync.onOpen(channel, session));
  const gateServer = faceGateServer({
    onRefuse: (path, refusal) => console.warn(`[lar-gate] an upgrade on ${path.slice(0, 24)}… refused before any 101 (${refusal})`),
  });
  stood.push({ what: "the sync gates", down: () => { gateServer.close(); syncSessions.close(); gateSync.close(); } });
  const network  = new ListeningWSServerAdapter(gateSync.wss as unknown as typeof wss);
  const peerIdentifierMap = new Map<string, string>();
  // The self-slot CLASS map — peerId → the class the keyholder vouched at admission. Populated in the
  // SAME microtask as peerIdentifierMap so that by the time the outer admission gate sees a peer in
  // peerIdentifierMap (its admit condition), the class is already keyed — no read-before-set window for
  // an admitted same-operator peer. A WS peer absent here (or present-but-not-same-operator) reads as the
  // stricter cross-operator class at the sharePolicy (fail-closed).
  const peerClassMap = new Map<string, PeerClass>();
  // peerId → the Nexus whose gate seated the peer's session: a refold reads that Nexus's posture for it.
  const peerNexus = new Map<string, string | null>();
  // peerId → the session its gate seated, while its socket stands. `peerIdentifierMap` keys the FACE key a gate proved,
  // never a device: every consult that reads a peer's DEVICE (the edge ring's shadow, the fetch door's fleet class, the
  // PersonaGroup ring) reads it here, through the D4 device book (`seatedDeviceKey`), and an unbound face reads none.
  const peerSessions = new Map<string, GateSession>();
  // The D4 binding, set once the device book stands (below); until then every face reads unbound.
  let deviceOfPresenter: ((seat: SeatedPresenter) => FaceDeviceReading) | null = null;
  const deviceOfPeer = (peerId: string): string | null =>
    seatedDeviceKey(peerSessions.get(peerId), (x) => (deviceOfPresenter ? deviceOfPresenter(x) : { unreadable: "face-device-unbound" }));
  // Every device a gate-seated session under this proven face key was certified to (D4); an unbound face reads none.
  const seatedDevicesOfFace = (key: string): string[] => {
    const face = provenVesselKeyOf(key);
    if (face === null) return [];
    const out: string[] = [];
    for (const [pid, ident] of peerIdentifierMap) {
      if (provenVesselKeyOf(ident) !== face) continue;
      const device = deviceOfPeer(pid);
      if (device !== null) out.push(device);
    }
    return out;
  };
  // The refold's same-operator sweep, set once the gates' readers stand (below).
  let sweepSameOperator: (() => void) | null = null;
  // D3: the bootstrap's tiddlers once the boot reads them, and one scoped view per same-operator session over the
  // planes of the face its gate proved (`face-fleet-view`). The share verdict reads a same-operator peer through it.
  let faceBootTiddlers: Record<string, { text?: string }> | null = null;
  // The worn face's persona/identities/circles planes passed the face proof (set once in the daemon open): the gates, the same-operator
  // views and every other reader of the worn face's planes read nothing until it is true.
  let wornFaceProven = false;
  // The persona planes a face proof vouched for, by group: the worn face's own, and each anchored face's whose held log names its url.
  // Registration and every reader of a face's plane (the selves plane, the bag list) read THIS, never the bootstrap's list.
  const provenPlanes = new Map<string, string>();
  // The live system documents THIS vessel holds, named by the Kahu realm at boot (`standKahuCanon`): empty outside the cabal.
  let kahuCanon: KahuCanonDocs = {};
  // The worn face also reads this vessel's wikis, catalog and bags (the bridge until O1, `face-fleet-view`).
  let catalogForViews: (() => LarDoc | undefined) | null = null;
  const faceViews = faceFleetViews(() => (wornFaceProven ? faceBootTiddlers : null), () => custodyGroup,
    () => (catalogForViews ? bridgeBooks(catalogForViews()) : new Set<string>()));
  stood.push({ what: "the face views", down: () => faceViews.close() });
  // THIS HEARTH'S OWN HOSTING DOCS — one per Nexus it carries, under its own gate key. A contracted peer (a carrier
  // of that Nexus) replicates them for the cross-check every walker's fork reading rests on. Filled once the vessel
  // key and the carried set are read, below, and on every roll.
  const ownHostingDocs = new Set<DocumentId>();
  // The carriage board of this vessel's own island — on the shelf for carriers, withheld from walkers.
  let ownCarriageBoard: DocumentId | null = null;
  // THE ROOT MAP — peerId → a persona-root nym. The REALM consult reads it (`contractNymOfPeer`) and nothing
  // fills it: no root-signed edge travels on any socket, and no proof binding a leaf to a root travels on the
  // wire. The seat stands for the realm doc's write side. The membership consult never reads it.
  const peerContractNymMap = new Map<string, string>();
  // THE LEAF MAP's input — the admit each admitted socket PRESENTED at THIS gate, as it rode, under the face key the
  // gate's chain proved (no vessel key rides the gate). Keyed at the seat below and handed to the membership holder,
  // which verifies it (leaf proof · held against the carried Nexus's deny board and antigen · carried set) and
  // alone decides whether the peer stands in the leaf map. A peer that presented no admit keys `null`.
  const peerBindings = new Map<string, SocketBinding | null>();
  // Forward-declared: the holder stands once the vessel's island is known, below, and replays `peerBindings`.
  let nexusMembershipHolder: NexusMembershipHolder | null = null;
  // The dial's re-presentation check — set once the dial stands (below); a board change or a refresh calls it.
  let representIfMoved: (() => Promise<void>) | null = null;
  // THE CHARTER'S HEARTH, at the other end of a socket THIS vessel dialed. The realm's return lane reads it:
  // the operator pinned that gate key out of band and imported that hearth's charter, so the realm's own
  // registered books federate back toward it. Filled by the dial below; empty on a vessel that dials nobody.
  const charterHearthPeers = new Set<string>();
  network.on("peer-candidate", ({ peerId }: { peerId: string }) => {
    queueMicrotask(() => {
      const socket = (network.sockets as Record<string, unknown>)[peerId];
      const session = socket ? gateSync.sessionOf(socket) : null;
      if (session) {
        // The key the gate proved: the session's face key, or a faceless place's own key. No vessel key rides.
        const identHex = session.scope?.faceKey ?? session.placeKey;
        if (identHex) peerIdentifierMap.set(peerId, identHex);
        peerSessions.set(peerId, session);
        peerClassMap.set(peerId, session.class);
        peerNexus.set(peerId, session.scope?.nexus ?? session.standing?.aid ?? null);
        // D3: the view of the face this session proved, for a same-operator seat alone.
        faceViews.seat(peerId, session.class === "same-operator" ? session.face : null);
        // THE LEAF SEAT. The gate read this session's admit HELD before its verdict; the holder keeps the admit as it
        // rode, under the face key the gate's chain proved, so every later refold re-reads it. A session that rode no
        // admit seats `null`.
        const binding: SocketBinding | null = session.class === "contracted" && session.arm?.kind === "admit" && session.scope
          ? { presentedAdmit: { admit: session.arm.admit, lineage: session.arm.lineage }, faceKey: session.scope.faceKey }
          : null;
        peerBindings.set(peerId, binding);
        void nexusMembershipHolder?.present(peerId, binding);
      }
    });
  });
  // A socket that closes takes its presentation with it: the next socket from the same peer presents afresh.
  network.on("peer-disconnected", ({ peerId }: { peerId: string }) => {
    peerBindings.delete(peerId);
    peerNexus.delete(peerId);
    peerSessions.delete(peerId);
    faceViews.drop(peerId);
    void nexusMembershipHolder?.present(peerId, null);
  });
  // The #59 antigen ring — the live Kapae-immune consult. Forward-declared here (the sharePolicy closes
  // over it) and STOOD once the operator's own nym (its Nexus key) is loaded, below. A null ring denies
  // nobody (a denylist's absence = no bans), so the boot window before the ring stands is correctly inert.
  let antigenRing: AntigenRing | null = null;
  // The self-slot FEDERATION gate — the federatable-own/private-own classifier for a CROSS-OPERATOR peer.
  // Forward-declared (the sharePolicy closes over it) and STOOD once the operator's own nym is loaded,
  // below (the nexus pubkey it addresses the federatable planes from). Null keeps the pre-classification
  // boot window inert (no peer gated) — correct: no doc crosses to any WS peer until the gate arms anyway.
  let selfSlotFedGate: FederationGate | null = null;
  // The SIBLING CHANNEL and the gate its peers pass — forward-declared (the sharePolicy closes over both) and
  // stood once the worn face's KEL is walked, below. A sibling holds standing only: the gate is the PersonaGroup
  // ring's sibling path over the public boards, and null denies every doc (fail-closed).
  let siblings: SiblingNetworkAdapter | null = null;
  let siblingGate: FederationGate | null = null;
  // The REALM plane — the relation's shared CRDT (realm-bag-brief). Stood once the oracle plane loads and a
  // charter names a realm; INERT (null) on a vessel outside every relation. Its gate composes ATOP the
  // deterministic shelf: the realm doc and each steward-registered bag's doc federate to a MEMBER peer alone.
  let realmPlane: RealmPlanesHolder | null = null;
  // THE EDGE SHADOW RING (kapae#/reach) — one live reading of this vessel's fleet board and realm boards, which
  // the sorter, the share verdict, carriage serve and the realm's gates all consult. Stood beside the Repo,
  // below. The ring itself answers fail-closed until its first fold lands; null (no Repo yet) sets nobody aside,
  // and no peer holds a socket that early.
  let edgeShadows: EdgeShadowRing | null = null;
  // The nexus-doc MEMBERSHIP consult — the carry-split's member gate (a cross-operator MEMBER blind-transits a
  // sealed plane; a STRANGER reaches only the public shelf). Forward-declared (the sharePolicy closes over
  // it) and STOOD once the operator's own nym is loaded, below. Null keeps every cross-operator STRANGER
  // (public-read only) through the boot window — the fail-closed default (a node never assumes Nexus-pono).
  let nexusMembership: NexusMembership | null = null;
  // THE SEAL-PRODUCER — a LIVE sealed-plane registry, empty at boot (fail-closed: behaves EXACTLY as
  // DENY-ALL until the encrypt-on-CAS installer seals a body). `sealRegistry.seal` is the oracle the
  // sharePolicy closes over; the moment `installSealedBody(sealRegistry, …)` seals a cad body, its docId
  // registers here AS A SIDE-EFFECT and the member blind-transit lane opens for that ciphertext body. A
  // cleartext body reaches no encrypt path → never registers → a doc can never self-label sealed.
  const sealRegistry = makeSealedPlaneRegistry();
  // THE WIRE PROBE, armed by the caller or by `LAR_WIRE_LOG=1` on a STAGED vessel. It reads the verdict on both
  // hooks and every sync message the Repo moves, so a witness can quote the sequence for one (peer, document)
  // from a peer's request through the holder's next change. Unarmed it is null and wraps nothing.
  const wireProbe: ShareVerdictSink | null = opts.onShareVerdict
    ?? (process.env["LAR_WIRE_LOG"] === "1"
      ? (v: ShareVerdictRecord) => console.log(`[wire] verdict ${v.hook} peer=${v.peerId} doc=${v.documentId ?? "-"} → ${v.verdict}`)
      : null);
  const repo = new Repo({
    storage,
    network: [network],
    // Two rings: WS peers (outside) must have passed a face gate; the
    // vessel's OWN islands (MessageChannel peers — daemon + wiki workers) are
    // house members and share freely. Without the island ring, main never
    // relays daemon-island-minted docs (personal/draft bindings) to the wiki
    // island and its slot-resolve hangs at boot.
    //
    // V5 SYMMETRY: this WS ring gates at the PEER (gate-passed vs not); the browser
    // leaf gates at the DOC (a deny-by-default FederationGate, since a leaf cannot
    // run a gate). Both are the same shore at two resolutions — the V5 KeyhiveIdentitySlot
    // composes verifyCapability(docUrl, ability) as the INNER ring here (per-doc caps
    // behind the per-peer admission), matching the browser's FederationGate call site.
    //
    // ONE VERDICT, BOTH HOOKS. A bare `sharePolicy` fills automerge-repo's ANNOUNCE hook alone and leaves
    // ACCESS wide open, so a peer that REQUESTS a doc by id pulls it whatever the verdict said — and every
    // `bags/*` id derives from the shared genesis (mesh `shareConfigOf`, measured in
    // share-policy-is-access.test.ts). The verdict below is an ACCESS verdict; mesh's `shareConfigOf` seats it on both.
    shareConfig: shareConfigOf(async (peerId, documentId) => {
      // THE ADMISSION LANDS FIRST. The WS adapter emits `peer-candidate` BEFORE it keys the socket into
      // `network.sockets`, and the Repo's listener resolves this verdict synchronously inside that emit — so a
      // read of `network.sockets[peerId]` here answered `undefined` and the peer read as an in-process house
      // member, for every doc the vessel held at that instant. The identifier/class/contract-nym maps above
      // fill in a microtask queued during the same emit; yielding one microtask here lets them land before a
      // single byte is decided (measured: a stranger at the floor read a private plane).
      await new Promise<void>((settle) => queueMicrotask(settle));
      const wsSocket = (network.sockets as Record<string, unknown> | undefined)?.[peerId];
      // OUTER peer-admission gate (unchanged): a WS peer whose session no face gate opened is not in
      // `peerIdentifierMap` → deny; an in-process island peer (no WS socket) is a house member → admit.
      if (wsSocket && !peerIdentifierMap.has(peerId)) return false;
      // THE KAHU CANON WAITS FOR THE FACE PROOF: a wire peer reads none of it until the worn face has proved (`canonHeldUntilProof`).
      if (wsSocket && canonHeldUntilProof({ canon: kahuCanon, owesFaceProof: custodyGroup !== null, faceProven: wornFaceProven, documentId: documentId as string | undefined })) return false;
      // THE SELF-SLOT SPLIT — federatable-own vs private-own, keyed on the class the keyholder vouched
      // (selfSlotShareDecision holds the whole law + fail-closed default). A same-operator WS peer and
      // every in-process island peer full-sync; a cross-operator/unclassified WS peer reaches only the
      // deterministically-federatable planes; the antigen draws Mu on a Kapae'd presenter regardless.
      return selfSlotShareDecision({
        hasWsSocket:     !!wsSocket,
        // A SIBLING rides the sibling channel, proven there under the peer id its device key derives. It holds
        // standing, never the house: the sibling gate decides its every doc, and sibling-ness decides first.
        sibling:         Boolean(siblings?.provenKeyOf(peerId as PeerId)),
        siblingGate,
        peerClass:       peerClassMap.get(peerId),
        selfSlotFedGate,
        antigenRing,
        // THE CARRY-SPLIT — a cross-operator MEMBER (per the nexus-doc consult) blind-transits a PROVABLY-sealed
        // private plane (carry ciphertext, never the read-cap); a STRANGER reaches only the federatable shelf.
        // planeSeal is DENY-ALL today (the sync wire carries cleartext — no plane is provably sealed), so the
        // member lane stands ready but inert; it opens the moment a sealed plane type (cad/BeeKEM) registers.
        membership:      nexusMembership,
        // THE LIVE SEAL ORACLE — reads the current sealed set (fail-closed empty ⇒ DENY-ALL). A cad ciphertext
        // body sealed by `installSealedBody` registers its docId here; the member lane then blind-transits it
        // (carry the ciphertext, never the read-cap — the read-cap rides the private keyhive lane).
        planeSeal:       sealRegistry.seal,
        // D3: a same-operator session reads by its proven face's scoped view, never by class: the view of the
        // PersonaGroup its gate's grant ring answered (`face-fleet-view`). A session with no view reads the shelf.
        sessionFace:     faceViews.gateFor(peerId),
        // A walker never reads the carriage board's contract ledger; a carrier replicates this hearth's hosting docs.
        carriageBoard:   ownCarriageBoard,
        hostingDocs:     ownHostingDocs,
        peerId,
        documentId: documentId as DocumentId | undefined,
        // A device the fleet root set aside reads nothing on any lane, the same-operator and sibling lanes included.
        shadow:          edgeShadows,
      });
    }, wireProbe ?? undefined),
  });
  // The SECOND half of the probe — a doc enters a peer's sync session exactly when sync messages start moving
  // for that (doc, peer) pair, and leaves it when they stop. `doc-metrics` carries both directions.
  if (wireProbe) {
    repo.on("doc-metrics", (e) => {
      if (e.type === "generate-sync-message")     console.log(`[wire] out    doc=${e.documentId} peer=${String(e["forPeer"])}`);
      else if (e.type === "receive-sync-message") console.log(`[wire] in     doc=${e.documentId} peer=${String(e["fromPeer"])}`);
      else if (e.type === "doc-denied")           console.log(`[wire] denied doc=${e.documentId}`);
    });
  }
  // THE REST DOOR. An island mints a slot document its own Repo keeps no store for; this Repo saves it. The island
  // asks before it records the binding, and the answer waits until the document has reached this Repo and rests
  // in its store — so no binding names a document a hard stop could leave unsaved.
  setRestDoor((documentIds) => restInStore(repo, documentIds));
  stood.push({ what: "the rest door", down: () => setRestDoor(null) });
  // The Repo stands down after everything that writes through it: it flushes, then closes its storage and network.
  stood.push({ what: "the Repo", down: async () => { await repo.flush(); await repo.shutdown(); } });
  emit("repo-open");

  // ── 2. Catalog — local-first rendezvous anchor (catalog-url file) ───────────
  const catalogUrlFile = join(storageDir, "catalog-url");
  let resolvedCatalogUrl: string | null = catalogUrl ?? null;
  if (!resolvedCatalogUrl) {
    try { resolvedCatalogUrl = readFileSync(catalogUrlFile, "utf8").trim() || null; } catch { /* first boot */ }
  }
  // ⚠ THE POINTER MUST NEVER OUTLIVE ITS DOCUMENT. `repo.create` mints in MEMORY and the doc reaches
  // storage only when the repo flushes, while this pointer file lands synchronously. A process killed
  // between the two leaves a `catalog-url` naming a document no store holds — and the next boot reads
  // that pointer, asks for a doc nobody has, and fails TERMINAL on a vessel whose store is intact.
  // Measured exactly so: six healthy documents, and the id in the pointer among none of them.
  //
  // So the flush comes FIRST. A pointer written after its referent is durable can be stale; one written
  // before can be a lie, and a lie here reads as a corrupt vessel.
  const blankCatalog = async (): Promise<DocHandle<LarDoc>> => {
    const h = repo.create<LarDoc>(emptyLarDoc());
    h.change((doc) => {
      doc.tiddlers[CATALOG_DOC_URI] = storedLarRecord(CATALOG_DOC_URI, { text: h.url }, "lararium-seed");
    });
    await repo.flush();
    try { mkdirSync(storageDir, { recursive: true }); writeFileSync(catalogUrlFile, h.url, "utf8"); } catch { /* quota */ }
    return h;
  };
  const catalogHandle: DocHandle<LarDoc> = resolvedCatalogUrl
    ? await resolveBootDoc<LarDoc>(repo, resolvedCatalogUrl as AutomergeUrl, { tideline: "hearth-private", label: "@catalog" })
    : await blankCatalog();  // first boot (no url yet): legitimate founder-mint, not a ghost fallback
  if (resolvedCatalogUrl && resolvedCatalogUrl !== catalogUrl) {
    try { mkdirSync(storageDir, { recursive: true }); writeFileSync(catalogUrlFile, catalogHandle.url, "utf8"); } catch { /* quota */ }
  }
  emit("catalog-ready");

  // ── Operator identity (node-held) ──────────────────────────────────────────
  // Load-only: a boot mints no key. A vessel with no key file refuses here by name and points at the founding.
  const vesselIdentity = await loadVesselIdentity();
  const placeSigner    = await vesselPlaceSignerDoor();

  // ── The #59 antigen ring — STOOD now the island this vessel stands in is resolved ─────────────
  // The board keys on the ISLAND (`nexusPubkey` below), never on this vessel: the deterministic
  // antigen-board id is a pure function of it, so every member of one Nexus folds ONE board. The
  // holder resolves the always-carried antigen board, folds the quorum-signed bans against the
  // founding kahu quorum's seats read off `bags/nexus` (LAR_BAGS ?? <root>/bags), and re-folds on every board
  // change. FAILS CLOSED: an unseated charter → empty roster → nothing Kapae'd (no quorum, no bans).
  // The Nexus SEAL homes PER-OPERATOR (`<lares>/nexus`), never in the corpus bags tree: a seal sited in the
  // corpus inherits that tree's home, which on a development install sits inside the repository. The seal
  // belongs to the operators who founded it, so it survives every substrate wipe beside the sovereign root
  // and travels with neither a clone nor the runtime vessel store.
  const sealHome = larSealHome();

  // ── THE ISLAND THIS VESSEL STANDS IN — every per-Nexus board keys on THIS, never on the vessel ─────────
  // A NEXUS HOLDS NO KEY, so no vessel's key names it. Passing `vesselIdentity.verifyingKey` satisfied a fleet
  // of one and split every confederation: a keeping hearth announced a PUBLIC book onto its OWN board while its
  // always-on Herm folded the Herm's, and both read `0 PUBLIC book(s)` with no error anywhere. The ruling
  // (2026-09-13): NEXUS keys the public/crossroads plane. `nexusIdentity` (mesh, isomorphic — the browser leaf
  // composes the SAME call with an anchor and no charter) ranks the island's name: an explicit scope, then the
  // CHARTER's genesis epoch (a KERI autonomic identifier both stewards derive from public material and neither
  // owns), then the ANCHOR gate key a leaf dials, then this vessel's own key.
  //
  // THREE STATES, and the third is why this reads a PRESENCE beside the value:
  //   ① no charter and no dial → the vessel's own key, a PRIVATE NEXUS OF ONE. Coherent, and stage one of an
  //      ordinary lifecycle — standing a hearth up and connecting it to a Nexus LATER is a first-class flow.
  //   ② a readable charter/anchor → the island's own name.
  //   ③ a charter that STANDS and reads TORN → `nexusScopeOrThrow` REFUSES the boot. `readNexusDoc` answers
  //      null for BOTH "no charter stands" and "a charter stands and reads torn", and `hearths.mem` #/crossings
  //      records this tree bitten by exactly that conflation (//the torn charter//). `nexusCharterStands` reports
  //      PRESENCE alone, which is what holds ③ apart from ①. A serving vessel silently descending to its own
  //      board on a torn fence would believe it published while every peer watched it vanish.
  // The gradient ratchets on INTENT: a vessel CLIMBS it by an act and never DESCENDS it by a failure.
  //
  // ⚠ CONNECTING MOVES THE BOARD. Climbing from ① to ② re-keys every per-Nexus board: books announced on the
  // private board do not travel and peers dialling the old address read silence. FOUR of the seven boards move
  // at boot and THREE are refused:
  //   · the persona-KEL board the BINDING GATE walks CARRIES at the gate's own seam below
  //     (`carryPersonaKelUpTheGradient`) — that gate REFUSES a boot whose pinned identifier reaches no head,
  //     so a moved board took the vessel down rather than thinning it.
  //   · the ANTIGEN board CARRIES, and the CROSSROADS board RE-ANNOUNCES, at the one door `climbNexusBoards`
  //     opens beside that seam. The antigen fails OPEN when it mints blank (an empty antigen re-admits a
  //     Kapae'd presenter), so it never "degrades gracefully".
  //   · WHO and carriage stay exactly where they are — `nexus-board-climb`'s header states each reason. A
  //     realm's vouch board and edge board, and a fleet's edge board, ride no Nexus key, so no climb moves them.
  // All four acts read only the islands BELOW (`nexusIslandsBelow`) — climb-only, idempotent, reading no gate
  // one notch lower. The explicit DEPARTURE that would keep "I left" distinguishable from ③ on the wire stands
  // UNBUILT: a climb DERIVES from present state, and an absence cannot be derived, so it must be NAMED by an
  // act at the rite rather than inferred at a boot.
  // ONE statement of the inputs. The resolution reads them, and so does the CLIMB'S CARRY further down
  // (`nexusIslandsBelow`, which re-runs this same resolver with each higher term withheld). A second copy
  // of this object would drift from the first the day a term is added, and the carry would then read a
  // gradient the boot does not stand on.
  // AND THE ONE STATEMENT NOW LIVES IN ONE PLACE (`nexus-standing`), because the CLI verbs were the
  // second copy this comment warned about — they did not restate the object, they SKIPPED it and read
  // their per-Nexus boards at the vessel's own key, which is the resolved island at the `own` notch
  // and nowhere above it. The boot composes the same seam the admit and founding doors compose, so a
  // term added here reaches every reader at once.
  const nexusStandsAt: NexusIdentityAt = nodeNexusStandsAt({
    ownVesselKey:   vesselIdentity.verifyingKey,
    joinGatePubKey: opts.joinGatePubKey ?? null,
    sealHome,
    bootstrapPath,
  });
  const nexusStanding = nexusIdentity(nexusStandsAt);
  const nexusPubkey   = nexusScopeOrThrow(nexusStanding);
  console.log(`[nexus] island ${nexusPubkey.slice(0, 18)}… (${nexusStanding.kind}${nexusStanding.shared ? ", shared" : ""}) — ${nexusStanding.reading}`);

  const antigenHolder = makeAntigenRingHolder({
    repo,
    nexusPubkey,
    sealHome,
    peerIdentifierMap,
  });
  antigenRing = antigenHolder.ring;
  stood.push({ what: "the antigen ring", down: () => antigenHolder.dispose() });

  // Stand the membership consult — the carry-split's member gate — now the island is known. It reads the LEAF
  // MAP alone: a peer stands MEMBER only on an admit its socket PRESENTED, proven by the admit's own leaf over
  // this gate's nonce, held against a carried Nexus's deny board and antigen (`nexus-carriage.ts`). No board
  // admit, kahu seat or raw wire key seats anybody. FAILS CLOSED: no carried Nexus, no proof, or any verdict
  // short of `held` leaves the peer a STRANGER (public-read only). The after-roll hook refolds the HOLDER.
  // RE-VERDICT. The Repo caches its share verdict per (doc, peer) at the peer's admission; every live change to
  // what that verdict reads — the member set, the posture, the antigen, a realm registration — must ask the Repo
  // to read it again, or a member contracted AFTER its socket stood keeps drawing DENIED (measured: B's realm doc
  // arrived empty while A's board named her). `shareConfigChanged` re-evaluates every doc for every peer.
  const reverdict = (): void => { try { repo.shareConfigChanged(); } catch { /* the repo may be closing */ } };
  // THE CARRIED NEXUSES' BOARDS, read off this vessel's own live replica: every Nexus in the carried set, each
  // island resolved over its own charter home. A change on any of them — a revoke arriving by sync — refolds
  // the leaf map; the dialed island's board also re-checks what this vessel presents when it dials.
  const carriedBoards = liveBoardOpener(repo, () => {
    void nexusMembershipHolder?.refold();
    void representIfMoved?.();
  });
  stood.push({ what: "the carried boards", down: () => carriedBoards.dispose() });
  const readCarried = (): Promise<readonly CarriedNexusReading[]> =>
    readCarriedNexuses({ sealHome, ownVesselKey: vesselIdentity.verifyingKey, open: carriedBoards.open });
  // Every Nexus this vessel carries, either way it carries: a persona's consent or seated chair, or this PLACE's
  // own counted carrier seal. The sorter reads the postures of all of them.
  const readEveryCarried = async (): Promise<readonly CarriedNexusReading[]> => unionReadings(
    await readCarried(),
    await placeCarriedNexuses({ sealHome, ownVesselKey: vesselIdentity.verifyingKey, open: carriedBoards.open }),
  );
  // The Nexuses this vessel's gates stand in, as the last gate sweep read them (`standGates`, below).
  let gateReadings: readonly CarriedNexusReading[] = [];
  // The sync gates' sweep, set once they first stand (at the arm, below): every refold sweeps again.
  let resweepGates: (() => Promise<void>) | null = null;
  // The oracle faces that follow the floor gates' set (`floorGates`, below): every refold tells them, and each sweeps again.
  const floorFollowers = new Set<() => void>();
  const floorGatesMoved = (): void => { for (const follower of [...floorFollowers]) { try { follower(); } catch { /* a face's own fault */ } } };
  /** This vessel's own Nexus: the AID of the charter it keeps at its seal home, or null. */
  const ownNexusAid = (): string | null => nexusAidOf(readNexusDoc(sealHome)) ?? null;
  /**
   * The posture of ONE Nexus a gate stands in. A herm answers the knock (operator ruling): OPEN by class at every gate it
   * stands, and it stands one only where a quorum counted its carry (`gateNexuses`); this vessel's own Nexus reads its
   * charter; a carried one reads the charter this vessel holds for it; any other reads PRIVATE.
   */
  const postureOf = (nexus: string): FederationPosture => {
    const aid = nexus.trim().toLowerCase();
    if (placeClass === "herm") return ownPlacePosture(placeClass, null);
    if (ownNexusAid()?.toLowerCase() === aid) return ownPlacePosture(placeClass, readNexusDoc(sealHome));
    return gateReadings.find((r) => r.aid.toLowerCase() === aid)?.posture ?? "private";
  };
  /** A peer a contracted class holds: a leaf the membership reads held, or a PLACE whose key this board carries. */
  const contractHolds = (peerId: string): boolean => {
    const holder = nexusMembershipHolder;
    if (!holder) return false;
    if (holder.membership.holdsCarriagePeer(peerId)) return true;
    const ident = peerIdentifierMap.get(peerId);
    return ident !== undefined && holder.carriers().has(ident.slice(-64).toLowerCase());
  };
  // A REFOLD THAT DEMOTES CLOSES. When a refold reads a contracted socket's admit no longer held, or reads every
  // carried Nexus PRIVATE under a stranger's socket, that socket would be silence at the gate today — so it is
  // dropped the way the gate drops a refused one: no frame, no reason.
  const dropNoLongerHeld = (): void => {
    const holder = nexusMembershipHolder;
    if (!holder) return;
    const sockets = (network.sockets ?? {}) as Record<string, unknown>;
    const admitted = Object.entries(sockets).map(([peerId, socket]) => ({ peerId, socket, cls: peerClassMap.get(peerId) }));
    // One gate stands per Nexus, so each session answers to the posture of the Nexus whose gate seated it.
    for (const entry of admitted) {
      const nexus = peerNexus.get(entry.peerId) ?? null;
      const drop = socketsNoLongerHeld([entry], { holds: contractHolds, answersStrangers: nexus !== null && postureOf(nexus) === "open" });
      for (const socket of drop) (socket as GateSyncSocket).close();
    }
  };
  const membershipHolder: NexusMembershipHolder = makeNexusMembership({
    sealHome,
    repo,
    nexusPubkey,
    readCarried,
    onRefold:    () => {
      reverdict(); dropNoLongerHeld(); sweepSameOperator?.();
      void resweepGates?.().catch((err: unknown) => console.warn(`[lar-gate] the sync gates did not sweep: ${err instanceof Error ? err.message : String(err)}`));
      floorGatesMoved();
    },
  });
  nexusMembershipHolder = membershipHolder;
  nexusMembership = membershipHolder.membership;

  /**
   * THE ONE AFTER-WRITE HOOK — every `store-door-verbs` row that lands a board or a practice joint (a host
   * roll, a kapae/un_kapae, a contract/revoke/carry/uncarry, a posture flip, a taken admit bundle) fires this
   * when its write counts, and so does a reconnect on either socket after a partition. Every door row takes
   * the ONE held Repo, direct from `open-node-vessel.ts` or `owned-store.ts` (`direct-repo-witness.sh`), so no
   * disk-cold state waits to merge in. The hook re-folds the live holders off what the held Repo already
   * carries (a same-process write landed in it directly; a remote peer's write arrived by CRDT sync): it
   * re-folds the antigen and the membership leaf map, re-stands a realm freshly imported, re-verdicts the
   * Repo's cached share answers for every peer, and re-derives this vessel's own dial presentation.
   * `nexusAid` names the hosting doc a hosting roll just opened; every other caller passes nothing.
   *
   * H2 — AWAITED, SERIALIZED, AND TRUTHFUL (never fire-and-forget). Every caller (`store-door-verbs`'s
   * `onRolled` hook, the nexus dial-out's `onReconnect` below) awaits this call's own `Promise<boolean>`
   * rather than firing it into the void: `admit-take`'s `represented` and `seal-home-refold`'s
   * `refolded` read this SAME answer, so a fire-and-forget refold could never answer either
   * truthfully (it always finished AFTER the CLI's own answer left). A SECOND roll that lands while
   * the first still runs waits on it and then runs a full pass afterward — `after-roll-chain.ts` owns the
   * order of a pass and the queue: passes run one at a time, each holder queues at most one pass, and a
   * roll that lands before that pass starts folds into it, so a storm completes in bounded passes with no
   * overlap and no starved holder (G15). The return value answers ONE question — did the re-presentation
   * run without throwing — because that is exactly what `represented`/`refolded` claim.
   */
  // THE HOSTING DOC RE-DERIVES FROM THE SEALED STATE (set where the walkers' session verbs stand, below). While a
  // landing stays owed, every refold tries it again, so one failed landing never leaves an epoch off the doc for
  // the vessel's life.
  let landOwedHostingActs: (() => Promise<void>) | null = null;
  // The chain stands in `after-roll-chain.ts`: the pass order and the bounded, per-holder queue live there.
  const afterRollQueue = createAfterRoll({
    landOwedHostingActs: async () => { await landOwedHostingActs?.(); },
    refoldAntigen: () => antigenHolder.refold(),
    refoldMembership: () => membershipHolder.refold(),
    refreshRealmPlane: async () => { await realmPlane?.refresh(readNexusDoc(sealHome)); },
    refoldEdgeShadows: async () => { await edgeShadows?.refold(); },
    reverdict: () => reverdict(),
    representIfMoved: async () => { await representIfMoved?.(); },
    log: (line) => console.log(`[nexus] ${line}`),
  });
  const afterRoll = (nexusAid?: string): Promise<boolean> => {
    if (nexusAid) ownHostingDocs.add(interpretAsDocumentId(hostingDocUrl(nexusAid, vesselIdentity.verifyingKey)) as DocumentId);
    return afterRollQueue(nexusAid);
  };

  // Replay every socket that presented before the holder stood.
  for (const [peerId, binding] of peerBindings) void membershipHolder.present(peerId, binding);
  // The ring reads this vessel's own faces as fleet roots, the realm of its charter, and every realm its ledger
  // notes. A board that changes (a peer's act arriving by sync) refolds it, and the Repo re-reads its verdicts.
  // THE FLEET ROOTS REST SEALED. The roots this vessel serves read off the persona roster, a row under the vessel
  // key, so a composition at the floor names none of them and, below, reads EVERY device as set aside: a floor
  // serves no fleet lane, and the first unlock stands a composition that reads the roster.
  // THE FLEET THIS VESSEL'S OWN DEVICE EDGE NAMES reads off the daemon document, in the clear, so a floor names
  // it too. The ring folds that one board at every standing: the Binding Gate asks what this vessel's own seat
  // reads there (the dyad door, below), and a device its fleet root set aside binds nothing even at the floor.
  // The lanes a floor serves stay shut whatever that board reads (`floor-fleet-lanes`).
  let wornFleetRoot: string | null = null;
  /** The face this composition mounts LIT (a sovereign composition presenting that face's signed edge), by handle-index; null where none stands. */
  let litFace: number | null = null;
  let activeAtom: FaceAtomKey | null = null;
  const builtRing = makeEdgeShadowRing({
    // The ring folds once before the mounted face loads. An empty key carries no face
    // authority; the mounted atom triggers a fresh fold after custody opens.
    repo, vesselKey: () => activeAtom?.key ?? "", sealHome,
    fleetRoots: async () => {
      const roots = new Set<string>();
      if (wornFleetRoot) roots.add(wornFleetRoot);
      for (const index of sovereign ? await sovereign.personaRoots() : []) {
        const key = await loadPersonaGroupRootVerifyingKey(index);
        if (key) roots.add(key.trim().toLowerCase().replace(/^0x/, ""));
      }
      return [...roots];
    },
    // THE FLEET ROOT'S ROSTER PER EPOCH: its persona KEL, read off the anchors this vessel holds in custody and the
    // verified chain on the island's board (or an island below it, before the boot's carry has run). At the floor
    // custody is locked and no chain reads: the frontier stands unknown and widens nothing.
    lineageOfFleet: (fleetRoot) => fleetLineageOf(repo, fleetRoot, [nexusPubkey, ...nexusIslandsBelow(nexusStandsAt)]),
    charterRealm:    () => nexusAidOf(readNexusDoc(sealHome)),
    // The DEVICE behind the peer (D4), never the face key its gate proved: a device set aside draws Mu on every lane.
    vesselKeyOfPeer: deviceOfPeer,
    realmNymOfPeer:  (peerId) => peerContractNymMap.get(peerId) ?? null,
    onRefold:        () => { reverdict(); dropNoLongerHeld(); sweepSameOperator?.(); seatSettler?.onFold(); },
  });
  // THE SETTLE ON EVERY FOLD (kapae#/keys). A counted raise owes one key roll, and the fold itself sets the answer
  // off: no person types a verb and no timer runs. The settler reads the fold, hands the facts to the daemon
  // island's `seat-duties` verb (where the face's group keys live) and awaits its answer on the daemon's
  // document, then keeps the signed rolls in this vessel's own ledger. It stands with a SOVEREIGN composition
  // alone: the facts read the sealed roster, and a floor's island holds no veil. A vessel that holds no root of
  // the fleet its device edge names reads no facts for it, exactly as `lares edge settle` refuses there, and says
  // so once.
  let rootlessSaid = false;
  // THE ONE ASKER OF `seat-duties`: this main thread, signing each ask as the vessel. The fold's settle below and
  // the store door's row for `lares edge settle` share it; no other road reaches the verb with a proof.
  const askSeatDutiesAsVessel = (facts: { readonly fleetRoot: string; readonly acts: readonly unknown[]; readonly rolled: readonly string[] }): IslandAsk => {
    if (!daemonVm) throw new Error("the daemon island does not stand yet");
    const vm = daemonVm;
    return askSeatDuties({
      daemonHandle: vm.daemonHandle, placeVerb: (o) => vm.placeVerb(o), facts,
      vesselKey: activeAtom?.key ?? "", sign: (image) => {
        if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
        return activeAtom.sign(image);
      },
    });
  };
  const seatSettler = sovereign ? makeSeatSettler({
    wornFleetRoot: () => wornFleetRoot,
    fold:          () => builtRing.fold(),
    facts: async (fleetRoot) => {
      try { return (await runEdgeSeatFacts({ repo, fleetRoot })).fleets[0] ?? null; }
      catch (err) {
        if (!(err instanceof EdgeSeatError)) throw err;
        if (!rootlessSaid) { rootlessSaid = true; console.log(`[edge-seats] no settle runs here for this vessel's own fleet: ${err.message}`); }
        return null;
      }
    },
    answer: (facts) => {
      if (!daemonVm) throw new Error("the daemon island does not stand yet");
      const ask = askSeatDutiesAsVessel(facts);
      return { answer: ask.answer as Promise<unknown> as Promise<SeatDutiesAnswer>, abandon: () => ask.abandon() };
    },
    mark:       (fleetRoot, rolls) => runEdgeSeatMarks({ repo, fleetRoot, rolls }),
    // The marks moved the ledger and no board: the ring folds again so every gate reads the roll, and the Repo
    // re-reads its verdicts. This fold sets off no further settle.
    afterMarks: async () => { await builtRing.refold(); reverdict(); },
    onLog:      (line) => console.log(`[edge-seats] ${line}`),
  }) : null;
  if (seatSettler) stood.push({ what: "the seat settler", down: () => seatSettler.dispose() });
  // AT THE FLOOR EVERY FLEET LANE STAYS SHUT (`floor-fleet-lanes`): the sorter reads each device as set aside, and
  // the share verdict's own consult sets a proven sibling aside too. A peer on neither lane keeps the public shelf.
  const shadowRing: EdgeShadowRing = sovereign ? builtRing : floorShadowRing(builtRing, (peerId) => Boolean(siblings?.provenKeyOf(peerId as PeerId)));
  edgeShadows = shadowRing;
  stood.push({ what: "the edge shadow ring", down: () => shadowRing.dispose() });
  // Before custody selects a face the ring has no face ledger to read. Its null fold
  // closes every face gate; the selected atom starts the first fold below.
  // ── THE FACE GATES ─────────────────────────────────────────────────────────────────────────────
  // One gate per (Nexus, route), every one assembled from the same readers (`vessel-gates`): the held root of its
  // own Nexus, the D4 shadow ring, the PersonaGroup grant ring, the one sorter over that Nexus's posture, and the
  // withdrawal memory a sovereign gate keeps across a restart.
  // THE WORN FACE the gates' rings read: the mount's own, or the founding face the bootstrap pins.
  const wornGateFace = (): { readonly face: number; readonly personaGroup: string } | null => {
    // The sealed custody group, and only once the face proof passed: the bootstrap's group text decides nothing here.
    return wornFaceProven && custodyGroup ? { face: wornMount?.handleIndex ?? 0, personaGroup: custodyGroup } : null;
  };
  const wornFaceRecords = async () => {
    const worn = wornGateFace();
    const record = worn ? await readFaceJoinRecord(worn.personaGroup) : null;
    return record ? [record] : [];
  };
  // D4: the device a presenting face-scoped key was certified to, off this vessel's own records: its own
  // certificates, and on the root holder the issued book each fleet-join answer noted (`face-device-book`). A gate
  // sweep and every refold read it again; a presenter it does not bind reads fleet-aside.
  const deviceBook = faceDeviceBook({ records: wornFaceRecords, ownVesselKey: async () => {
    if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
    return activeAtom.key;
  } });
  deviceOfPresenter = (seat) => deviceBook.deviceOfSeat(seat);
  // THE GATE'S FACE: the face whose gate this composition stands (the mount's own, else the founding face). Its withdrawal memory
  // rests in that face's subtree under its key, and no other face's gate reads it.
  const gateFace = wornMount?.handleIndex ?? 0;
  const gateDeps: VesselGateDeps = {
    readings: readEveryCarried,
    posture:  postureOf,
    shadows:  gateShadowRing({ ring: shadowRing, deviceOf: (presenter) => deviceBook.deviceOf(presenter) }),
    grants:   gateGrantRing({
      joinRecords: wornFaceRecords,
      // The root holder answers the grant its held root would sign for each scope the face stands at here.
      rootHoldings: async () => {
        const worn = wornGateFace();
        return worn ? heldRootHoldings({ sealHome, faces: [worn] }) : [];
      },
    }),
    withdrawals: sovereign
      ? storedWithdrawals(gateMemoryRows(gateFace), { onTorn: (name) => console.warn(`[lar-gate] a gate memory row reads torn (${name.slice(0, 12)}…); a hand repairs or removes it`) })
      : memoryBackedWithdrawals(),
    deadlines: timerGateDeadlines(),
    audience:  DAEMON_BAG_ID,
    onRefuse:  (at, reason, detail) => console.warn(`[lar-gate] ${at.tier} ${at.route} at ${at.nexus.slice(0, 18)}… fell silent: ${reason}${detail ? ` (${detail})` : ""}`),
    onShut:    (arm, at) => console.warn(`[lar-gate] a walker's ${arm} arm at ${at.route} reads SHUT by name`),
  };
  // A REFOLD THAT SETS A DEVICE ASIDE, OR REVOKES AN ADMIT, CLOSES. A same-operator session stands only while its gate
  // would seat it same-operator today: its device still binds and stands, and its admit still reads held at its Nexus
  // (`sameOperatorStands`). One that no longer does is dropped silently, as the gate drops a refused socket. Sweeps run
  // one at a time; a sweep asked while one runs runs once more after it.
  let sameOperatorSweep: Promise<void> = Promise.resolve();
  sweepSameOperator = (): void => {
    sameOperatorSweep = sameOperatorSweep.then(async () => {
      const now = { deviceOf: (seat: SeatedPresenter) => deviceBook.deviceOfSeat(seat), deviceAside: (d: string) => (edgeShadows ? edgeShadows.deviceAside(d) : true), admits: (nexus: string) => vesselAdmitReader(gateDeps, nexus) };
      const gone = new Set<GateSession>();
      for (const { session } of syncSessions.live()) {
        if (session.class === "same-operator" && !(await sameOperatorStands(session, now))) gone.add(session);
      }
      if (gone.size > 0) console.log(`[lar-gate] ${syncSessions.drop((s) => gone.has(s))} same-operator session(s) closed: the device stands aside, binds no more, or the admit no longer holds`);
    }).catch((err: unknown) => console.warn(`[lar-gate] the same-operator sweep did not run: ${err instanceof Error ? err.message : String(err)}`));
  };
  /**
   * Every Nexus a gate stands in: this vessel's own, and each it carries. A HERM stands at the explicit Nexus it was
   * joined to and only there (the routes ruling, stable-founding-road: "an explicit Nexus opens the herm relay"): a Nexus
   * whose carriage board counts a `carry` for this place's own key. A charter it merely holds stands no gate.
   */
  const gateNexuses = async (): Promise<string[]> => {
    const read = await readEveryCarried();
    gateReadings = gateReadingsFor(placeClass, read);
    const own = placeClass === "herm" ? null : ownNexusAid();
    return [...new Set([...(own ? [own] : []), ...gateReadings.map((r) => r.aid)])];
  };
  /**
   * The oracle's floor gates, one per Nexus, each seating through the face's own table (`flow-read-face`). The set
   * moves as the sync gates' does: every membership refold tells each face that follows it (`floorGatesMoved`), and the
   * face asks again, so a carry taken on a running herm stands its floor gate and an uncarry stands it down.
   */
  const floorGates: FlowGateArgs["gates"] = Object.assign(async (sessions: GateSessionTable) => {
    const door = await vesselFloorKeyDoor();
    return (await gateNexuses()).map((nexus): FlowReadGate => {
      const bundle = deriveGateBundle(floorGateRoot(door), new TextEncoder().encode(nexus), floorRoute(FLOW_SOCKET_ROUTE));
      return { gate: vesselGate(gateDeps, { bundle, nexus, sessions }), pin: bundle.pin };
    });
  }, {
    onMoved: (follower: () => void) => { floorFollowers.add(follower); return () => { floorFollowers.delete(follower); }; },
  });
  // THE SYNC GATES: one sovereign gate per Nexus on the sync route, under the custody root, each on its own knock.
  // A sweep stands the gate of every Nexus newly read and stands down the gate of one no longer read.
  // THE STOOD KNOCK, SAID. Each sync gate says the path it stands on, once, as it stands: the knock a device handed
  // this hearth's pin derives, so an operator (and a witness) reads where the gate answers. At the floor the
  // composition says once that it stands none (stable-founding-road: a hearth rests at its floor until a person
  // unlocks it).
  const syncStood = new Map<string, { readonly unstand: () => void }>();
  let floorRestSaid = false;
  const standSyncGates = async (): Promise<void> => {
    if (!sovereign) {                            // the custody root answers a sovereign composition alone
      if (!floorRestSaid) {
        floorRestSaid = true;
        console.log("[lar-gate] this vessel rests at its floor: it stands no sync gate until a person unlocks it (`lares vault unlock`)");
      }
      return;
    }
    // The D4 binding reads again at every sweep: a fleet-join answer's note reaches the gates at the refold its device
    // edge sets off. A read that fails leaves the book unbound, so every presenter reads fleet-aside.
    await deviceBook.refresh().catch((err: unknown) => console.warn(`[lar-gate] the face device book did not read: ${err instanceof Error ? err.message : String(err)}`));
    const nexuses = new Set(await gateNexuses());
    for (const [nexus, held] of syncStood) if (!nexuses.has(nexus)) { held.unstand(); syncStood.delete(nexus); }
    for (const nexus of nexuses) {
      if (syncStood.has(nexus)) continue;
      const bundle: GateBundle = deriveGateBundle(sovereignGateRoot(custodyGateDoor()), new TextEncoder().encode(nexus), sovereignRoute(SOVEREIGN_SYNC_ROUTE));
      const at = gateServer.stand({ gate: vesselGate(gateDeps, { bundle, nexus, sessions: syncSessions.table }), pin: bundle.pin });
      // THE KNOCK. The dispatcher hands this path to the gate server and destroys every other upgrade before any 101.
      const unregister = opts.dispatcher?.registerUpgrade({
        name: `sync:${at.path}`, path: at.path,
        handle: (req, socket, head) => { if (!gateServer.handleUpgrade(req, socket, head)) socket.destroy(); },
      });
      console.log(`[lar-gate] the sync gate for Nexus ${nexus.slice(0, 18)}… stands on ${at.path}`);
      syncStood.set(nexus, { unstand: () => { unregister?.(); at.unstand(); bundle.drop(); } });
    }
    // The book just read again: a binding it no longer holds ends the same-operator session that stood on it.
    sweepSameOperator?.();
  };
  stood.push({ what: "the sync gates' knocks", down: () => { for (const held of syncStood.values()) held.unstand(); syncStood.clear(); } });

  // Read the bulb off the genesis dir — the ALL-PUBLIC seed + CAS a Herm serves so a stranger kindles their OWN
  // sovereign hearth (serve fire, never key). Null when the genesis is absent (nothing to hand). It pins no epoch
  // and carries no bootstrap: the charter's freshness rides the corm-lease pointer on the read-face breath.
  const bulb: BulbArtifact | null = readBulbArtifact(genesisDir ?? defaultGenesisDir());

  // The relay-side discovery index the seal producer announces a sealed cid onto (DHT-free; hint → peers → tracker).
  const casBagTracker = makeBagTracker();

  // Stand the self-slot federation gate on the SAME island scope the antigen board derives from — a gate
  // keyed elsewhere would refuse the very boards this vessel is meant to federate. Its federatable surface is a PURE function of that scope
  // (crossroads plane · WHO · kapae-antigen board — deny-by-default for every other doc), so a cross-operator
  // peer reaches exactly the always-carried public/infra planes and nothing private. No hand-maintained
  // allow-list; the private planes (catalog/personal/daemon/home/wikis) fall outside the set → DENY.
  // A realm's own vouch board and edge board cross to a peer that holds standing in that realm, and to nobody else.
  selfSlotFedGate = new RealmBoardGate(new DeterministicFederationGate(nexusPubkey), shadowRing.realmBoards, shadowRing.standsInRealm);
  ownCarriageBoard = interpretAsDocumentId(carriageDocUrl(nexusPubkey)) as DocumentId;
  for (const aid of await carriedSet(sealHome).catch(() => new Set<string>())) {
    ownHostingDocs.add(interpretAsDocumentId(hostingDocUrl(aid, vesselIdentity.verifyingKey)) as DocumentId);
  }

  // ── THE HERM RELAY PORT — INERT until a relay port rides the config ─────────────────────────────────────────
  // Siblings of a PersonaGroup pin it (`ws://<host>:<port>#<gate key>`) and leave persona-KEL drops there over plain
  // HTTP; every WebSocket upgrade meets silence, so no envelope crosses it. It reads NO plaintext and holds NO read-cap /
  // content key / roster (carry ⊥ read ⊥ contract). Its random S row stays stable across restart. It stands apart
  // from the Automerge `/ws` relay (Socket A, cleartext CRDT). ABSENT the port → this branch never runs and no port opens.
  const relayPortRaw = opts.standCarriageRelayPort ?? process.env["LAR_HERM_RELAY_PORT"];
  const relayPort = relayPortRaw !== undefined && relayPortRaw !== "" ? Number(relayPortRaw) : null;
  // The herm's sight of a sibling channel stays transient: the vessel hands the relay no frame observer, so carried
  // frames are routed and forgotten. A witness of that sight stands its own relay and passes its own observer.
  const carriageRelay: CarriageRelay | null = await (async () => {
    if (relayPort === null || Number.isNaN(relayPort)) return null;
    const gateSeed = openRelayGateSeed();
    try { return await startCarriageRelay({ gateSeed, port: relayPort, dropJournalPath: join(storageDir, "persona-kel-drops.jsonl") }); }
    finally { gateSeed.fill(0); }
  })();
  if (carriageRelay) {
    console.log(`[carriage] crossroads relay standing — dial ws://<host>:${carriageRelay.port}#${carriageRelay.gatePubKey}`);
  }
  stood.push({ what: "the carriage crossroads", down: async () => { await carriageRelay?.close(); } });

  // ── THE FETCH DOOR, vessel side — `makeCidResolver(localRead, casTransit, cacheWriteThrough)` ──────────────
  // Fetch-on-read: a read that misses the local `cid/` asks the Herm's public shore (`LAR_HERM_SHORE`), the bytes
  // verify against the cid's own class, and the verified body lands write-through in `cid/`. Every worker (the
  // daemon island, each wiki island) reaches this ONE door through `cas:want`. No shore → the door answers every
  // ask from `cid/` alone (PENDING stays PENDING; a dead upstream faults nothing).
  const cidDir = casDirForStorage(storageDir);
  const hermShore = hermCasTransitFromEnv();
  const resolveCidThroughDoor = hermShore
    ? makeCidResolver(
        (cid) => readCasBlobFromFs(cid, cidDir),
        hermShore,
        (cid, bytes) => { writeCasEntriesFs([{ cid, bytes }], cidDir); },
      )
    : async (cid: string) => readVerifiedCasBlobFromFs(cid, cidDir);
  setCasDoor(resolveCidThroughDoor);
  if (hermShore) console.log(`[carriage] fetch door open — the herm shore · cid/ ${cidDir}`);

  // ── The CLIENT dial-out (Socket A, cleartext CRDT) — INERT until a peer sync URL + gate key ride the config ──
  // When configured, the vessel mounts a `LarWSClientAdapter` carrying the operator's OWN leaf identity onto the
  // running Repo and DIALS the peer node's `/ws`, so a same-operator second device syncs the private planes both
  // ways (the peer's gate vouches it `same-operator`; `selfSlotShareDecision` opens full sync). The dial rides the
  // Automerge `/ws` relay (Socket A) — the SAME transport the server adapter answers on, SEPARATE from the herm
  // relay port. REAL crypto: the outbound proof binds to the peer's gate key (out-of-band, never the wire) and
  // carries the operator's own identity, never a forged one. ABSENT the config → no adapter, no dial, no change.
  // THE PINNED EDGE'S HEARTH IS THE DIAL'S DEFAULT. A joinee founded by an admit edge carries the hearth's sync
  // url + gate key in its bootstrap (hearth-dial-pin.ts); an explicit option outranks it, and a vessel holding no
  // pin dials nobody.
  // THE HEARTH THIS VESSEL WALKS AT names its own dial: where its relay answers, and the gate key to pin there —
  // kept on the walk record `lares walk take` wrote. It is the dial's last default — an explicit option or a
  // hearth pin each outranks it. A vessel walks at one hearth (the take refuses a second).
  // THE WALK RECORDS REST SEALED, so this read belongs to a sovereign composition alone: a floor reads no walk
  // record and so dials no walked hearth, and the first unlock stands a composition that reads them.
  const walkingAt      = (sovereign ? await sovereign.walkRecords() : []).find((w) => w.record.relay) ?? null;
  // The dial reads the pin from the pair index (`gatePins`), and a hearth is named by an option, its admit's pin or a
  // walk record. No environment names a hearth, its gate or its document.
  const gatePins       = hearthGatePins();
  // ── THE GATE-NATIVE CARRIAGE PULL ──────────────────────────────────────────────────────────────
  // Carriage peering flips on this caller (the routes ruling, stable-founding-road). Each pull dials a peer's floor gate once per
  // Nexus this vessel stands in, at the pin the pair index holds for that peer there, and nowhere else:
  //   · THE PINS a place signed for its floor gate ride each Nexus's carriage board; this vessel files one only where its own
  //     replica of that board counts the place as a carrier (`place-floor-pin`: the quorum's act authenticates the key, the
  //     key authenticates the pin). A herm signs and lays its own statement on its own replica of every board that carries it.
  //   · WHAT IT PRESENTS: a place's counted `carry` at that Nexus where its own key stands carried (a herm: the place arm,
  //     `place-floor-pin`); otherwise the worn face with the admit it took for that Nexus. Nothing composed, nothing dialed.
  const carriageSessions = opts.dialSessions ?? { table: new SessionTable(`carriage-${globalThis.crypto.randomUUID()}`), binding: sessionBinding("socket"), profile: "face" as const };
  const carriageSign = placeSigner;
  const carriagePull = vesselCarriagePull<MeshPalaceDoc>({
    placeClass,
    ownPlaceKey: vesselIdentity.verifyingKey,
    sign:        async (image) => {
      const duty = carriageFloorDutyOf(image);
      if (duty === null) throw new Error("place-signer: unframed floor duty");
      return carriageHexToBytes(await carriageSign.signFloor(duty, image));
    },
    readings:    readEveryCarried,
    ownNexus:    ownNexusAid,
    openBoard:   (url) => carriedBoards.open(url, "board:carriage-contracts"),
    ...(placeClass === "herm" ? {
      ownFloorPin: async (nexus: string) => flowFloorPinAt(nexus, await vesselFloorKeyDoor()),
      ownPlaceChain: () => loadPlaceKelChain(),
      layStatement: async (url, statement, kel) => { layStatementOn(await materializeSharedLarDoc(repo, url, "board:carriage-contracts"), statement, kel); },
    } : {
      facePresentation: async (pin) => {
        const composed = await composeDialPresentation({ sealHome, pin, personaGroup: wornGateFace()?.personaGroup ?? null, ...carriageSessions });
        return "presentation" in composed && composed.presentation ? composed.presentation : null;
      },
    }),
    pins:      gatePins,
    audience:  DAEMON_BAG_ID,
    deadlines: dialDeadlines(),
    dialSocket: nodeDialSocket,
    onLog:     (line) => console.log(`[carriage] ${line}`),
  });
  // THE DIAL'S URL AND PIN ARE ONE CHOICE (`chooseHearthDial`): an explicit option, the bootstrap's url, the one url the kept
  // admit bundles agree on (`AdmitBundle.syncUrl`), then a walk record's relay; the pin is the one held for THAT hearth. Each
  // pin files under the hearth that issued it, and a kept bundle is re-read at seeding (its opening answers its admit's
  // commitment, its pin reads at its own Nexus and is signed by its own gate key).
  const hearthDial     = chooseHearthDial({
    explicitUrl: opts.joinSyncUrl ?? null,
    hearthPin:   hearthPin ? { syncUrl: hearthPin.syncUrl, ...(hearthPin.gatePin ? { gatePin: hearthPin.gatePin } : {}) } : null,
    kept:        readKeptAdmitBundles(sealHome),
    walkRelay:   walkingAt?.record.relay ?? null,
    // THE FLOOR PINS a signed fleet-join answer carried, kept per Nexus: they file under the dialed hearth (house ruling "The admit's gate pin": a carried signed pin set).
    keptFloor:   (nexusHex) => readKeptHearthFloorPins(sealHome, Buffer.from(nexusHex, "hex").toString("utf8")),
  });
  for (const note of hearthDial.notes) console.log(`[nexus-join] ${note}`);
  for (const warning of hearthDial.warnings) console.warn(`[nexus-join] ${warning}`);
  const joinSyncUrl    = hearthDial.syncUrl;
  const joinGatePubKey = opts.joinGatePubKey ?? hearthPin?.gatePubKey ?? walkingAt?.gatePubKey   ?? null;
  // The document the dial asks for: an explicit option, else the one the admit named beside its pin (`--doc-url`).
  const joinDocUrl     = opts.joinDocUrl     ?? hearthPin?.docUrl ?? null;
  // The operator's OWN light leaf identity (cached ContactCard + bare-Ed25519 signer). A missing card (never
  // `lares vessel found`-ed) → skip the dial rather than crash the boot (fail-open to inert; a dial needs a real card).
  let nexusDial: NexusClientDial | null = null;
  /** The pin the face dial stands at; the session door binds each session to its Nexus. */
  let dialPinNow: GateBundlePin | null = null;
  // Set when the vessel stands its dial down: a late dial still in flight then stands nothing.
  let dialStoodDown = false;
  // The dial itself fires in `openDaemon`, once the daemon doc is read — the identity it presents carries this vessel's OWN
  // device-delegation edge (the one a fleet-join landing seated), so the peer's keyholder vouches it
  // `same-operator` (the FLEET class every same-operator door reads) rather than the cross-operator floor.

  // ── Main-resident residency MECHANISM (sovereign-worker: policy in the worker,
  //    mechanism here). onEvict commands the pool via the forward `vmManager` ref. ──
  let vmManager!: VesselIslandPool;        // set in makePool
  let wikiActivation!: WikiActivationCap;  // set in makePool — the activation-on-reference cap
  let mailbox!: DurableMailbox;            // set in makePool — the durable park/drain lane (node-only capability)
  let daemonVm!:   DaemonVmCore;           // set in openDaemon
  let eventBus!:  LarEventBusImpl;         // set in makePool
  // R3 — the Crossroads board this vessel materializes ONCE (openDaemon), read by every later
  // per-island plugin-offering resolution (makePool's pool, and the daemon VM's own recipe).
  let crossroadsOfferingsHandle: DocHandle<LarDoc> | undefined;
  let bootstrap!: VesselBootstrap;         // captured in loadGenesis
  let personaSelves: PersonaSelvesPlane | null = null;   // the carried faces' planes, built at the first ask
  let slotActiveWikiId = "";               // captured in wikiSlot
  let activeWikiSource: "boot-arg" | "daemon-marker" = "boot-arg";
  // The recall FORM leg holder — opened ONCE, lazily, shared by BOTH the dual recall fuse and the
  // worldline form pre-fetch (makeFormPalace ref-counts per canonical dir → one reference, never a
  // second process). Owned by the form provider impl below; closed implicitly at process exit / idle-reap.
  let recallFormPalace: FormPalace | null = null;
  // The STRUCTURE recall leg (the 3rd fusion graph) — ref-counts per canonical dir → one reference.
  let recallStructurePalace: StructurePalace | null = null;
  // SOVEREIGN recall — the house-code content leg (`search_io.py` embeds+searches · `content_io.py`
  // get/scan) over the MEMORY content plane. `lares sense recall` reads through THIS, never the guest
  // mempalace client (that stays the `lares mempalace` sidecar lane) — the sovereign/guest separation.
  // Lazy: the read holders spawn on first recall, reused after (distinct lock-prefixes from the capture
  // holder, so a concurrent re-pour never blocks a read).
  // One recall holder PER sensorium root — ADDRESSED recall up the cap ladder (each sensorium's own
  // coordinator; `memory` is the default). The same machinery serves ai-sessions, text, and encoded streams.
  const recallHolders = new Map<string, RecallHolder>();
  const recallFor = (root?: string): RecallHolder => {
    const r = root && root.length > 0 ? root : memorySensoriumDir();
    let h = recallHolders.get(r);
    if (!h) { h = makeRecallHolder(r); recallHolders.set(r, h); }
    return h;
  };
  let recallContent: ContentPalace | null = null;
  /** Every persona-KEL ring holder a daemon open stood; each listens on a board until disposed. */
  const kelHolders: Array<{ dispose(): void }> = [];
  const sovereignRecallClient: RecallClient = {
    // Combined-arms search rides the ONE Python coordinator (recall_session.py → LaresCoordinator): it
    // composes the sensorium's #has recall-surfaces (content-vector ⊕ mempalace lexical+entity), RRF-fuses,
    // and resolves verbatim — machine-code stays Python; this is a thin coordinator call. STREAM-AGNOSTIC +
    // ADDRESSED: `sensoriumRoot` picks any sensorium's holder up the ladder (ai-sessions → text → encoded).
    search: async (a) => {
      const root = typeof a["sensoriumRoot"] === "string" ? a["sensoriumRoot"] : undefined;
      // Forward the CLI args VERBATIM to the one Python coordinator. The daemon holds NO filter knowledge:
      // recall_session introspects LaresCoordinator.recall — the SINGLE source of truth for the filter set —
      // and forwards whatever it accepts, dropping the rest. So a new recall filter needs zero change here
      // (2 surfaces, 1 API — the collapse: the API signature is the capability, the surfaces just forward).
      const { sensoriumRoot: _sensoriumRoot, ...req } = a;
      return await recallFor(root).recall(req);
    },
    getImago: async (imagoId) => {
      recallContent ??= makeContentPalace(larContentDir());
      const e = await recallContent.get(imagoId);
      return e ? { imago_id: e.cid, content: e.document, ...e.metadata } : {};
    },
    listDrawers: async (a) => {
      recallContent ??= makeContentPalace(larContentDir());
      const limit = typeof a["limit"] === "number" ? a["limit"] : 50;
      const wing = typeof a["wing"] === "string" ? a["wing"] : undefined;
      const page = await recallContent.scan({ limit });
      let recs = page.records as ReadonlyArray<{ cid: string; document?: string; metadata?: Record<string, unknown> }>;
      if (wing) recs = recs.filter((r) => r.metadata?.["wing"] === wing);
      return {
        imagines: recs.map((r) => ({ imago_id: r.cid, content: r.document ?? "", wing: r.metadata?.["wing"], room: r.metadata?.["room"] })),
        total: page.total,
      };
    },
  };
  // One Python source-stream owner for the sovereign memory sensorium. It receives pointers only;
  // parsing, CID identity, embedding and land all stay on the Python side of the boundary.
  // One serialized capture holder PER sensorium root (each owns its own content-palace singleton flock).
  // `memory` is the default; a `lares sense <sensorium> …` address threads its own root here.
  const sourceCaptures = new Map<string, SourceCapture>();
  const captureFor = (root?: string): SourceCapture => {
    const r = root && root.length > 0 ? root : memorySensoriumDir();
    let sc = sourceCaptures.get(r);
    if (!sc) { sc = makeSourceCapture(r); sourceCaptures.set(r, sc); }
    return sc;
  };
  // The composed verb plane (the four provider-heavy groups, NESTED-composed). composeVerbPlane is async
  // but wireVerbs runs SYNCHRONOUSLY (daemonCap.build calls it un-awaited); the plane composes at the END
  // of openDaemon (where daemonVm is ready, awaited BEFORE wireVerbs inside daemonCap) and wireVerbs
  // applies this cached contribution synchronously.
  let pendingVerbContribution: VerbContribution | null = null;

  // The ONE residency collector + pool-wiring, composed through the SHARED factory (both vessels
  // call it). Node advertises the FULL grant (concurrent multi-wiki + rotatable pins besides
  // the daemon bag) and supplies its vessel-specific hooks: it NARRATES a cool (browser stays silent),
  // stamps the alert `kind`, and PARKS an undeliverable alert in the durable mailbox (a dropped
  // verb stays observable, never nowhere — the Akka /deadLetters lesson; browser has no mailbox,
  // so it warns + drops best-effort). getPool reads vmManager lazily (the forward-ref pattern);
  // the alert hook reads the forward-declared mailbox at delivery time (long after boot).
  // The stowage cools by the realm's rolls — the same reading the CAS sweep ticks on, held in one cell.
  const realmPaceCell = makeRealmPaceCell();
  const residencyWiring: VesselResidency = makeVesselResidency(
    () => vmManager,
    { wikiActivationCap: NODE_WIKI_ACTIVATION_CAP, wikiPinBudget: NODE_WIKI_PIN_BUDGET, clock: realmPaceCell.read },
    {
      onWikiCooled: (id) => console.log(`[residency] cooled wiki ${id} (island unmounted)`),
      onBagCooled:  (id) => console.log(`[residency] cooled bag ${id} (compact-then-drop reserved for repo#358)`),
      alertArgs:    (kind) => ({ kind: kind ?? "" }),
      onUndeliverableAlert: (wikiId, verbOpts) => { void mailbox.park(wikiId, verbOpts); },
    },
  );
  const residency = residencyWiring.residency;

  // EVERYTHING THE CLOSURES BELOW STAND, read at teardown through the same forward refs they set. Each line
  // tolerates a ref no closure reached, so a boot that refuses midway stands down exactly what stood.
  stood.push({ what: "the fetch door",        down: () => setCasDoor(null) });
  stood.push({ what: "the recall holders",    down: async () => {
    for (const h of recallHolders.values()) await h.close();
    for (const c of sourceCaptures.values()) await c.close();
    recallHolders.clear(); sourceCaptures.clear();
  } });
  stood.push({ what: "the realm plane",       down: () => { realmPlane?.dispose(); } });
  stood.push({ what: "the persona-KEL ring",  down: () => { for (const k of kelHolders.splice(0)) k.dispose(); } });
  stood.push({ what: "the sibling channel",   down: () => { siblings?.disconnect(); } });
  stood.push({ what: "the client dial",       down: () => { dialStoodDown = true; dialPinNow = null; nexusDial?.stop(); } });
  stood.push({ what: "the residency sweeper", down: () => { residency.stopSweeper(); } });
  stood.push({ what: "the event bus",         down: () => { (eventBus as LarEventBusImpl | undefined)?.stop(); } });
  stood.push({ what: "the daemon island",     down: async () => { await (daemonVm as DaemonVmCore | undefined)?.shutdown(); } });
  stood.push({ what: "the wiki islands",      down: async () => { await (vmManager as VesselIslandPool | undefined)?.disposeAll(); } });

  // Read the daemon doc (idempotent re-resolve; openDaemonVm finds the same handle).
  const readDaemonDoc = async (): Promise<DocHandle<LarDoc>> =>
    resolveBootDoc<LarDoc>(repo, bootstrap.daemonUrl as AutomergeUrl,
      // THE BOOTSTRAP NAMES THIS DOC, so an `unavailable` here waits for this vessel's own flush rather than reading as
      // a doc nobody wrote: a founding seeds it moments earlier in this same process.
      { tideline: "hearth-private", label: "@daemon", settled: () => repo.flush() });

  const keel: VesselOrchestration<VesselIslandPool>["keel"] = {
    repo,
    catalogHandle,
    waitHandle: <T>(url: AutomergeUrl, fallback: () => DocHandle<T>) => waitHandle<T>(repo, url, fallback),

    // Genesis island (required) + the social-plane bootstrap it carries.
    loadGenesis: async () => {
      // Slice 2: the oracle island is a LIVE CRDT under a DETERMINISTIC doc id — reload
      // it when persisted (operator writes intact), else MATERIALIZE it fresh from
      // the plain-data seed (seed.json). No Automerge-binary boot seed,
      // no merge-into-stale. The catalog registry's oracle pointer (written by assembleVessel)
      // serves as an advisory back-reference, not the identity mechanism.
      const islandHandle = await loadOrMaterializeOracle(repo, genesisDir);

      // The live lares and lararium documents mint at the FOUNDING, in the Kahu realm (`kahu-realm`); no genesis office
      // mints them and no catalog row names them. The keel mounts what `systemCanon` names below.

      const coreBlobEntry = (islandHandle.doc()?.blobs ?? {})[ENGINE_CORE_ID];
      if (!coreBlobEntry) {
        throw new Error(`[openNodeVessel] missing TW5 core blob metadata (${ENGINE_CORE_ID}) in LarDoc; re-run build:genesis`);
      }
      const coreHash = coreBlobEntry.sha256;
      if (!coreHash) throw new Error(`[openNodeVessel] TW5 core blob missing sha256; re-run build:genesis`);

      // Populate the fs CAS — every island worker pulls engine + plugin bytes by CID from
      // this local CID plane, off the sync port. The genesis CRDT now carries METADATA only;
      // the bytes ship as genesis/cas/<cid> files indexed by the immutable seed. Mirror exactly
      // those into the runtime CAS the workers read via resolveByCid (the nodefs face of the
      // browser vessel's OPFS fetch — isomorphic by composition).
      const manifest = readGenesisCasManifest(genesisDir);
      const runtimeCas = casDirForStorage(storageDir);
      if (manifest) {
        const casWritten = mirrorGenesisCasFs(manifest, genesisCasDir(genesisDir), runtimeCas);
        if (casWritten > 0) console.log(`[openNodeVessel] fs CAS: mirrored ${casWritten} blob(s) by CID from genesis/cas`);
      } else {
        // A persisted oracle permits restart without seed.json, but the worker may not
        // start on CRDT metadata alone. Every named member must already stand in the
        // local content-addressed store; otherwise an immutable source is owed.
        const cids = genesisCasCidsFromOracle(islandHandle.doc()!);
        const missing = cids.filter((cid) => {
          const bytes = readCasBlobFromFs(cid, runtimeCas);
          return bytes === null || sha256HexBytesSync(bytes) !== cid;
        });
        if (missing.length > 0) {
          throw new Error(
            `[openNodeVessel] persisted oracle names missing CAS member(s): ${missing.join(", ")} — ` +
            "provide the immutable genesis seed/CAS source before starting a worker",
          );
        }
      }

      // Bootstrap URLs: the vessel's own social bootstrap answers for the place and every face. The
      // oracle answers for none of them.
      // BOTH parses are guarded, and a tear reads {} — the same answer every other reader of this file
      // gives (the hearth-dial pin, the bulb, the init packer). The OUTER parse was caught and the inner
      // one was not, so a bootstrap whose outer JSON is valid while its packed `text` is truncated, absent
      // or not a string threw an uncaught SyntaxError/TypeError and killed the boot — while the pin reader
      // three hundred lines earlier answered `null` on that exact file. Two readers of one file must not
      // disagree about whether it is fatal.
      let bootstrapTiddlers: Record<string, { text?: string }> = {};
      if (existsSync(bootstrapPath)) {
        try {
          const plugin = JSON.parse(readFileSync(bootstrapPath, "utf8")) as Record<string, unknown>;
          const packed = JSON.parse(String(plugin["text"] ?? "{}")) as { tiddlers?: Record<string, { text?: string }> };
          bootstrapTiddlers = packed.tiddlers ?? {};
        } catch { /* a torn bootstrap reads as none — never a fatal boot */ }
      }
      faceBootTiddlers = bootstrapTiddlers;
      const daemonUrl = bootDaemonUrl(bootstrapTiddlers);
      // The WORN face decides which plane mounts; the Binding Gate below resolves the same face. The
      // family, the pin and every face plane read off the bootstrap alone.
      const {
        personaPlanes, personaBagId, personaUrl, identitiesUrl, circlesUrl, sessionsUrl, intentsUrl,
      } = bootFacePlanes(bootstrapTiddlers, wornMount?.personaGroupId ?? null);
      // ── THE PLACE STANDS ALONE; THE FACE RIDES OPTIONAL ────────────────────────────────────────
      // Only the daemon doc reads required — a founding stands a PLACE first (`lares vessel found`) and a FACE
      // later (`lares persona new 0`), so a vessel that carries and serves while holding no persona names
      // none of the social planes here. Absence reads as the WAKING FLOOR.
      if (!daemonUrl) {
        throw new Error(`[lararium] this vessel names no daemon doc — the place never finished founding. Run \`lares vessel found\`.`);
      }
      // A TORN face refuses outright, mirroring `bootDaemonKeyhive`: some pins standing and others absent
      // names a half-finished founding, and guessing which half to trust is the confused-deputy error.
      const faceParts = [identitiesUrl, circlesUrl, sessionsUrl, intentsUrl, personaUrl, personaBagId];
      const faceHeld  = faceParts.filter(Boolean).length;
      if (faceHeld > 0 && faceHeld < faceParts.length) {
        throw new Error(
          `[lararium] the face this vessel carries reads TORN — some social planes stand and others do not.\n` +
          `  missing: ${[!identitiesUrl && "the identities plane", !circlesUrl && "the circles plane", !sessionsUrl && "the sessions plane", !intentsUrl && "the intents plane", !personaUrl && "the PersonaGroup plane", !personaBagId && "the PersonaGroup sentinel"].filter(Boolean).join(", ")}\n` +
          `  Re-light the face (\`lares persona new 0\`) rather than booting on half of one.`,
        );
      }
      bootstrap = {
        daemonUrl, personaPlanes,
        ...(identitiesUrl ? { identitiesUrl } : {}),
        ...(circlesUrl    ? { circlesUrl }    : {}),
        ...(sessionsUrl   ? { sessionsUrl }   : {}),
        ...(intentsUrl    ? { intentsUrl }    : {}),
        ...(personaUrl    ? { personaUrl }    : {}),
        ...(personaBagId  ? { personaBagId }  : {}),
      };
      return { islandHandle, coreHash, bootstrap };
    },

    tempStore: () => new MemoryTiddlerStore(),

    // L1/L2 — the child_process load-probe + quarantine, closing over this vessel's
    // storageDir. Each social-plane doc materializes in a disposable process before the
    // live repo touches it; a condemned doc gets MOVED aside (never deleted) and its plane
    // mounts read-only, so a torn doc downgrades the vessel to degraded instead of aborting
    // the whole boot.
    docLoadProbe: makeChildProcessDocLoadProbe(storageDir),
    // L3 — clean-tail recovery, tried AHEAD of quarantine: salvage the doc's verified clean
    // record-prefix and drop only the torn tail, so a torn-tail doc promotes to a writable
    // mount (a suffix of edits lost) instead of downgrading the vessel to degraded.
    recoverCleanTail: async (verdict) => {
      const promoted = await recoverCleanTail(storageDir, verdict);
      if (promoted) {
        console.warn(
          `[lararium] PROMOTED plane — clean-tail recovered ${verdict.documentId} (${verdict.reason ?? "?"})` +
          ` → ${promoted.reason ?? "recovered"}; the torn tail sits in quarantine-torn-tail-*`,
        );
      }
      return promoted;
    },
    quarantineDoc: (verdict) => {
      const moved = quarantineDoc(storageDir, verdict);
      console.warn(
        `[lararium] DEGRADED plane — quarantined ${verdict.documentId} (${verdict.status}: ${verdict.reason ?? "?"})` +
        ` → ${moved ?? "already gone"}; the plane mounts read-only until a known-good document is restored`,
      );
    },

    // THE KAHU REALM'S LIVE CANON: the documents the cabal's registrations name, held only where the board carries a
    // counted admission for this vessel's group. A vessel outside the cabal names none and reads the floor.
    systemCanon: async () => {
      // Core assembly asks before the daemon mount loads. The sealed custody
      // selection already names the face; open that atom before any face board read.
      if (custodyGroup && !activeAtom) {
        const seed = await loadFaceAtomOfGroup(custodyGroup);
        if (!seed) throw new Error("face-not-named: system canon needs the selected face atom");
        activeAtom = faceAtomKeyFromSeed(seed, custodyGroup);
      }
      kahuCanon = await standKahuCanon({
        repo, sealHome, vesselKey: activeAtom?.key ?? "",
        personaGroupId: custodyGroup,   // sealed custody names the face; the composition tears down whole if its proof later refuses
      });
      return kahuCanon;
    },

    // Corpus capability piece — one top-level bag per catalog corpus entry (shared loader).
    loadCorpora: (composite) => loadCatalogCorpora({
      repo, catalogHandle,
      mintLocalHandle: (docUrl) => waitHandle<LarDoc>(repo, docUrl as AutomergeUrl, blankMemeStore(repo)),
      source: "lararium-seed",
    }, composite),

    ...(onPhase ? { onPhase } : {}),
  };

  // Active-wiki slot — slug from the daemon-doc marker (post-genesis).
  const wikiSlot = async (_assembly: VesselCoreAssembly): Promise<VesselWikiSlot> => {
    const sel = selectActiveWikiSlug(wikiId, (await readDaemonDoc()).doc()?.tiddlers?.[ACTIVE_WIKI_URI] ?? null);
    activeWikiSource = sel.source;
    slotActiveWikiId = sel.slug;
    // The draft DOC is no facet of the slug — the daemon's slot-doc resolver names it at mount.
    const facets = recipeHostFacets(slugFromUri(sel.slug));
    return {
      activeWikiId: sel.slug,
      wikiSlug:     facets.wikiSlug,
      wikiKey:      facets.wikiKey,
      wikiBagId:    facets.wikiBagId,
      draftBagId:   facets.draftBagId,
      workingBagId: facets.workingBagId,
    };
  };

  // Daemon VM — sovereign daemon island + the operator's authn/z home. `slot` ABSENT (herm) →
  // registerBags omits the user-wiki bags (the decouple); the daemon's OWN bag still mounts.
  const openDaemon = async ({ assembly, slot }: { assembly: VesselCoreAssembly; slot?: VesselWikiSlot }): Promise<VesselDaemonVm> => {
    catalogForViews = () => assembly.catalogHandle.doc() as LarDoc | undefined;
    const daemonDoc = (await readDaemonDoc()).doc();
    // At the FLOOR no key is held, custody refuses `CustodyLocked`, and the vessel boots faceless (no pin rests in the clear).
    let atFloor = false;
    const orFloor = async <T,>(read: () => Promise<T | null>): Promise<T | null> => {
      try { return await read(); } catch (e) { if (e instanceof CustodyLocked) { atFloor = true; return null; } throw e; }
    };
    const foundingAnchors = wornMount ? null : await orFloor(() => loadIdentityAnchors(0));
    const bootMount = wornMount ?? foundingAnchors;
    // Custody selects the worn face. The daemon document may project its pins but never selects one.
    const personaGroupId = bootMount?.personaGroupId ?? undefined;
    const meshCabalDocIdHex = bootMount?.meshCabalDocIdHex ?? undefined;
    // The cabal rides with the FACE — its members read as PersonaGroups, so a faceless place names none.
    // ── THE FACE, IF ONE STANDS ────────────────────────────────────────────────────────────────
    // The signer pin + edge carry the Binding Gate's authority. Their ABSENCE names a place at the
    // WAKING FLOOR rather than a fault: a vessel founded by `lares vessel found` and never lit by
    // `lares persona new 0` holds no persona, by design — canon has it boot permissionlessly on its
    // own key (identity-classes#herm-establishment).
    //
    // THE GATE STILL NEVER SOFTENS. Downstream, `bootDaemonKeyhive` runs the Binding Gate in FULL or
    // grants no persona caps at all, and refuses a TORN face outright. So absence buys fewer caps, never
    // a skipped check — the confused-deputy / PCD cure survives the floor intact.
    const signerDid = bootMount?.signerDid ?? undefined;
    const faceAnchor = personaGroupId ? await orFloor(() => loadFaceAnchorOfGroup(personaGroupId)) : null;
    // THE ANCHOR THIS BOOT STANDS ON: every later raise (the verified act head, a verified lease) starts from the latest one this boot
    // wrote, so a second write never builds from the copy read before the first and erases the first's pin.
    let standingAnchor = faceAnchor;
    if (personaGroupId && !faceAnchor && !atFloor) throw new Error("[openNodeVessel] Face anchor: anchor-missing; re-found the face");
    if (!personaGroupId && !atFloor && tiddlerText(daemonDoc?.tiddlers?.[PERSONA_GROUP_ID_TIDDLER])) {
      throw new Error("[openNodeVessel] Face anchor: anchor-missing; re-found the face");
    }
    // The worn handle selects the atom seed in local custody for this face's live signer and Keyhive Individual.
    const edgeRecord = daemonDoc?.tiddlers?.[DEVICE_DELEGATION_SELF_TIDDLER];
    // The switch presents the WORN face's signed edge. It changes WHICH edge is presented, never whether it
    // is checked: `bootDaemonKeyhive` runs the Binding Gate on it in full, or grants no persona caps at all.
    const deviceEdge = bootMount?.deviceEdge ?? (plainRecordOrNull(edgeRecord)?.tiddler as unknown as DeviceDelegationTiddler | undefined);
    const mountedFace = wornMount?.handleIndex ?? 0;
    const atomSeed = sovereign && deviceEdge && personaGroupId ? await loadFaceAtomOfGroup(personaGroupId) : null;
    if (sovereign && deviceEdge && !atomSeed) throw new Error("this face holds no atom; re-found or re-admit it");
    activeAtom = atomSeed && personaGroupId ? faceAtomKeyFromSeed(atomSeed, personaGroupId) : null;
    if (activeAtom && deviceEdge && activeAtom.key !== deviceEdge.deviceVerifyingKey) throw new Error("this face's atom differs from its device edge");
    // ── THE DYAD DOOR (kapae#/reach) ─────────────────────────────────────────────────────────────
    // The daemon island's gates ask what one device's edge reads on the worn fleet's board: the Binding Gate for
    // this vessel's own seat, the join gate for the device a summons names. The ring folds the fleet this edge
    // names BEFORE the island boots, so the island's first ask reads a landed fold. An ask that arrives while a
    // board's change left the reading dark waits on the next fold, never on a clock, and a fold that fails
    // answers `aside`. The door stands with this composition and drops at its teardown.
    const edgeFleetRoot = deviceEdge?.personaRootDid?.trim().toLowerCase().replace(/^0x/, "") ?? null;
    if (edgeFleetRoot) wornFleetRoot = edgeFleetRoot;
    if (activeAtom) await shadowRing.refold();
    setDyadDoor(async (fleetRoot, deviceKey) => {
      // A fold a board's move overtook publishes nothing, so the door asks again; three folds each overtaken
      // leave the reading dark, and a dark reading answers `aside`.
      for (let tries = 0; tries < 3 && !shadowRing.fold(); tries++) {
        try { await shadowRing.refold(); } catch { return "aside"; }
      }
      return shadowRing.deviceStanding(fleetRoot, deviceKey);
    });
    stood.push({ what: "the dyad door", down: () => setDyadDoor(null) });
    // ── THE RELATIONSHIPS THIS VESSEL HOLDS — read live at boot (dyad read path) ──────────────
    // `vesselDyads` reads the ceremony-minted slots, the ONLY source — a bare delegation edge
    // presents no dyad. The read only observes — but a FACE
    // standing beside ZERO slots names a doc minted before the ruling, and that drift gets SAID at
    // boot rather than discovered the day a fleet tries to gather it. Warn, never throw: the dyad
    // read carries no caps, and the cure is a re-found, not a softened gate.
    const dyads = vesselDyads(daemonDoc);
    if (deviceEdge && dyads.length === 0) {
      console.log("[dyad] a face stands and no dyad slot is minted — a pre-ruling daemon doc; re-found or admit to mint the derived veil.");
    } else if (dyads.length > 0) {
      const bound = dyads.filter((d) => d.binding !== null).length;
      // THE DYAD SCOPE READS HERE (gap 4): a binding counts as this hearth's only where it verifies under the fleet
      // root the worn edge names AND roots on the hearth that edge binds (its seed charter's AID).
      const atHearth = deviceEdge?.personaRootDid && deviceEdge.hearthTrueName
        ? (await verifiedFleetOfGroup(dyads, deviceEdge.personaRootDid as LarDid, new Set(), deviceEdge.hearthTrueName)).length
        : 0;
      console.log(`[dyad] this vessel holds ${dyads.length} relationship(s), ${bound} bound, ${atHearth} verified at this hearth.`);
    }
    // THE PERSONA-KEL PIN — the continuity anchor the Binding Gate walks. Read the pinned identifier PREFIX
    // from the daemon bag (the pin's root of trust), then read its seq-sorted key-event-log from the per-Nexus KEL
    // board — this node's OWN gate key IS its Nexus key. The read runs against the LOCAL replica "as of last
    // sync" (no-global-now); FAIL-CLOSED — a missing prefix OR a chain the local replica does not carry HALTS
    // the boot (never a global lookup, never a fall-through to the raw signer pin).
    // PINNED-BUT-UNWALKABLE ≠ UNPINNED, and the difference decides between a floor and a fault. A vessel
    // that pins NO identifier holds no face and stands at the floor. A vessel that pins one whose chain its
    // local replica cannot reach has a face it cannot prove — that HALTS, fail-closed, exactly as before
    // (never a global lookup; a not-yet-synced replica simply denies).
    const personaKelPrefix = bootMount?.personaKelPrefix ?? undefined;
    let personaKelChain: ReturnType<ReturnType<typeof makePersonaKelRingHolder>["chainForPrefix"]> = null;
    // THE PLANES A BOOT MAY REGISTER: only a plane a face proof vouched for (`provenPlanes`, declared with the boot's state above).
    let wornFaceProved = false;
    if (personaKelPrefix) {
      // ── THE CLIMB'S CARRY — run BEFORE the gate walks ────────────────────────────────────────
      // A founding seats this inception on the board keyed by the island resolved AT THAT MOMENT, which
      // for an unconnected hearth is its OWN key. Seating a charter later re-keys the board, and this
      // gate REFUSES rather than degrades — so the walk `vessel found` → use → `nexus rite quorum` →
      // restart left a vessel that never booted again, its only remedy a re-found. The carry moves the
      // pinned chain onto the island this boot resolved, reading only the islands BELOW it
      // (`nexusIslandsBelow` is empty at the bottom and empty when torn, so nothing ever descends).
      // Idempotent: a destination that already carries it writes nothing, which is every later boot.
      // The gate is untouched — the events land verbatim and the holder verifies them as it always did.
      await carryPersonaKelUpTheGradient({
        repo, nexusPubkey, prefix: personaKelPrefix,
        priorIslands: nexusIslandsBelow(nexusStandsAt),
      });
      const kelHolder = makePersonaKelRingHolder({ repo, nexusPubkey });
      kelHolders.push(kelHolder);
      await kelHolder.ready;
      personaKelChain = kelHolder.chainForPrefix(personaKelPrefix);
      if (!personaKelChain || personaKelChain.length === 0) {
        throw new Error(`[lararium] persona-KEL chain for the pinned identifier ${personaKelPrefix.slice(0, 20)}… absent from the local board replica — the Binding Gate cannot reach a head (fail-closed).`);
      }
      if (faceAnchor && activeAtom && personaGroupId) {
        // A FACED BOOT PROVES ITS FACE: a bootstrap that omits the persona plane cannot skip the proof, it refuses by name.
        if (!bootstrap.personaUrl) throw new Error("[lararium] Face proof: plane persona; the bootstrap names no persona plane for a face with a sealed anchor; re-found or re-admit the face");
        const records = await readFacePersonaRecords(repo, {
          personaUrl: bootstrap.personaUrl, group: personaGroupId, extraDocs: [daemonDoc], heldOnly: true,
        });
        const proof = proveFaceFromLog({ records, chain: personaKelChain, group: personaGroupId,
          anchor: faceAnchor, deviceKey: activeAtom.key, ...(deviceEdge ? { edge: deviceEdge } : {}),
          // The face's SHARED documents: its persona plane, its circles and its identities, each named by a signed act. Sessions
          // stay per vessel (motion, never a decision that crosses devices), so no act names them.
          planes: { persona: bootstrap.personaUrl, identities: bootstrap.identitiesUrl, circles: bootstrap.circlesUrl, intents: bootstrap.intentsUrl } });
        if (!proof.ok) throw new Error(`[lararium] Face proof: ${proof.refusal.why}${"plane" in proof.refusal ? ` ${proof.refusal.plane}` : ""}; re-found or re-admit the face`);
        wornFaceProved = true;
        wornFaceProven = true;
        provenPlanes.set(personaGroupId, bootstrap.personaUrl);
        // THE VERIFIED HEAD PINS THE ANCHOR'S LOG FRONTIER: a later boot that reads an older valid log names `frontier-falls`.
        const head = proof.projection.head;
        if (head) {
          const pinned = raiseFaceFrontier(faceAnchor, { actSeq: head.seq, actCid: head.cid });
          if (pinned !== faceAnchor) { await keepFaceAnchorOfGroup(pinned); standingAnchor = pinned; }
        }
        // THIS DEVICE'S OWN ENTRY joins the face's shared documents the moment its replica holds them (a causal read, never a timer or the next boot).
        if (bootstrap.identitiesUrl && bootstrap.circlesUrl) {
          const joining = joinFaceDocumentsOnArrival(repo, { identities: bootstrap.identitiesUrl, circles: bootstrap.circlesUrl }, activeAtom.key);
          stood.push({ what: "the face documents join", down: () => joining.stop() });
        }
      }
    }
    // ── THE REST OF THE CLIMB — the boards the KEL carry leaves behind ───────────────────────────────
    // The ANTIGEN fails OPEN when it mints blank: "an empty antigen bans nobody" means a Kapae'd presenter
    // gets RE-ADMITTED. It federates (MANDATORY tier), so an island with other members heals it by sync,
    // bounded by sync latency, and never for the vessel that climbs onto an island where it stands first. So
    // it CARRIES: its entries ARE the record, the bytes move verbatim with their own signatures, and the
    // destination's own fold judges them exactly as the board below did. The crossroads board instead
    // RE-ANNOUNCES: its rows PROJECT the realm doc's n-of-n-signed registrations and carry no signature a
    // reader could re-check, so a copy would launder a stale, lapsed or foreign-realm row.
    //
    // WHO and carriage stay where they stand, and `nexus-board-climb`'s header carries the reason for each: a
    // face DISCLOSED to strangers the operator never published to, and an allow that takes a fresh consent.
    // An edge shadow rides a realm's board or a fleet's board, never a Nexus key, so no climb moves one.
    //
    // UNCONDITIONAL, deliberately OUTSIDE the persona-KEL guard above: a faceless vessel holds an antigen
    // too. Climb-only and idempotent by the same construction as the KEL carry — every source comes from
    // `nexusIslandsBelow` (empty at the bottom, empty when torn), and every act writes only what the
    // destination LACKS, so this runs every boot with one effect.
    await climbNexusBoards({
      repo, nexusPubkey,
      priorIslands: nexusIslandsBelow(nexusStandsAt),
      realmId:      nexusAidOf(readNexusDoc(sealHome)),
    });
    // Register the per-Nexus crossroads plane into the oracle plane (isomorphic with the browser). Both shores
    // compose the SAME `nexusIdentity` ruling — this one off its charter, a leaf off the anchor gate key it
    // passes back — so a node, its browser leaves and its Herm resolve the identical crossroads doc. The daemon core
    // splices the crossroads bag into the recipe + registerBags for either vessel.
    await registerCrossroadsPointer(repo, assembly.catalogHandle, nexusPubkey);
    // ── THE REALM PLANE — the relation's shared CRDT, materialized on every member's boot ──────────────
    // The realm doc's id derives from the charter both stewards hold (its genesis epoch), so A and B compute
    // ONE address from the charter alone. A bag REGISTERS on it (`realm-bag`), and the daemon island's reach
    // (`meme get --bag <x>`) walks this plane FIRST through the pointer this stand pins on the oracle plane.
    // The wire gate widens the self-slot shelf by the member-read lane and nothing else: a stranger draws
    // the same denial as any private plane. A vessel with no primary or carried charter stands no realm.
    if (!realmPlane && nexusMembership && selfSlotFedGate) {
      realmPlane = makeRealmPlane({
        repo,
        registry:         assembly.catalogHandle,
        crossroadsHandle: await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads"),
        membership:       nexusMembership,
        base:             selfSlotFedGate,
        // THE REALM LEG: the realm's own registration answers which documents cross — the ROOT MAP (empty: no
        // root edge is proven at this seat), the charter this vessel itself holds, and the hearth it dialed that
        // charter from. A peer the realm leg does not name falls to the membership consult (the LEAF MAP).
        charter:          makeRealmCharterConsult({ sealHome, peerContractNymMap, charterHearthPeers }),
        // THE LEASE: a registration's `expiry` reads against the realm's own pace in rolls (0 = cannot judge).
        pace:             () => (realmPaceCell.read() > 0 ? realmPaceCell.read() : null),
        // THE MEMBER SHADOW: a member set aside reads none of the realm's documents, by any lane.
        memberAside:      (realmId) => shadowRing.memberAside(realmId),
        // THE STEWARD GUARD: every signer passes it before it seals. It reads the key against this vessel's own
        // material and passes a per-Nexus face key alone (`realm-steward`).
        stewardGuard:     stewardGuard(),
        // THE HANDLE BOOK: a Handle steward's seal reads against the chain this vessel's own book holds for it.
        sealReading:      nodeHandleBookReading(),
        // MANY REALMS. The planes stand each cabal realm this vessel's own ledger notes under the Nexus standing
        // here, read a peer's lineage standing in a realm off the edge shadow ring, and note a realm under that
        // Nexus the moment an act enters it. A cabal takes no key and no roster: the ledger holds this vessel's
        // own memory of where it acted, and under which Nexus.
        realms:           () => {
          if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
          return readVesselRealms(repo, activeAtom.key);
        },
        standsInRealm:    shadowRing.standsInRealm,
        noteRealm:        (realm, nexusAid) => {
          if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
          return noteVesselRealm(repo, activeAtom.key, realm, nexusAid);
        },
        // THE CARRIED CHARTERS: a hearth stands on its own seed charter, so another operator's Nexus it contracted
        // into reaches it as a carried charter, and that Nexus's realm stands as a plane of its own, under ITS AID.
        carried:          () => [...readCarriedCharters(sealHome).values()],
        // EACH PLANE'S LANES SCOPE TO ITS OWN NEXUS: the Nexus lane to a leaf that Nexus admitted, the return lane
        // to the hearth this vessel dialed (its pin's charter scope; none on a self-founded vessel).
        leafAidOf:        (peerId) => nexusMembershipHolder?.leafAidOf(peerId) ?? null,
        dialedHearth:     () => ({ pinned: hearthPin !== null,
          aid: hearthPin?.islandKind === "charter" ? hearthPin.islandScope ?? null : null }),
        // THE REFOLD REVERDICT. The fold decides which documents the realm leg opens, and it moves on a change
        // ANOTHER member writes — a co-signature completing a proposal re-seats a registration this vessel
        // itself un-seated when the proposal replaced it. The Repo caches its verdict per (doc, peer), so the
        // fold and the cache must move together or the registered book stays DENIED to the hand that keeps it.
        onRefold:         reverdict,
        onLog:            (line) => console.log(`[realm] ${line}`),
      });
      selfSlotFedGate = realmPlane.gate;
      await realmPlane.refresh(readNexusDoc(sealHome));
    }

    // ── The CLIENT dial-out fires here (config read above): present the ContactCard + the self device edge ──
    // AFTER THE BOARDS THIS VESSEL DERIVES FROM ITS OWN KEY STAND (crossroads · realm). A find that a connected
    // peer answers "unavailable" settles before the local materialize, and the island that later asks for that
    // board reads the settled verdict, never the doc — measured as a fatal `slot bags/crossroads unavailable —
    // the peer answered WITHOUT doc` on a cross-operator dial (a foreign hearth answers a stranger fast). The
    // dial follows the boards, so no peer can answer for a doc this vessel mints itself.
    // WHAT THE DIAL PRESENTS — one face per vessel per Nexus, and three shapes:
    //   · A LEAF ADMIT, for the Nexus POSITIVELY tied to the dialed gate key (`dialPresentation`: a bundle the
    //     hearth at that key wrote and this vessel took, or the hearth pin's charter island). The kept bundle
    //     presents, or the board's admit head when it descends from the kept admit; the dial carries its closed
    //     lineage and the leaf's proof over the gate's challenge — and NO root-signed edge. No tie → no admit.
    //   · THE FLEET EDGE. A self edge signed by a root this vessel does NOT hold is an ADMIT — a hearth's root
    //     licensed this device — and presents in the FLEET slot, where the peer's keyholder chains it to its
    //     pinned KEL and vouches `same-operator`. A fleet dial never looks for a leaf admit.
    //   · THE CONTACTCARD ALONE. A self-founded vessel (its self edge signed by a root it HOLDS, or no self edge)
    //     with no admit for the dialed Nexus presents its card and nothing else. Its own root-signed edge never
    //     rides any socket: the vessel key is one key across every Nexus, so a root edge to N would link the
    //     root to the leaf the same vessel presents (or will present) to N.
    // RE-PRESENTATION follows what this vessel holds, never a timer: a change on the dialed island's board, a
    // the after-roll hook, or an `admit-take` (which fires it) re-derives the presentation, and a moved
    // one re-dials through the adapter's own close-and-reconnect path.
    // THE DIAL STANDS FROM A CHOICE of url and pin (`chooseHearthDial`): at composition from what the bootstrap and the kept
    // bundles name, and LATER, when a bundle is taken into a RUNNING vessel (`afterRoll`, below), from what it names then.
    const standFaceDial = async (hd: HearthDialChoice, live: () => boolean = () => !dialStoodDown): Promise<void> => {
      try {
        // THE FACE DIAL. The dial presents the face's chain through `dialFaceGate` at the pin the pair index holds for the
        // hearth and Nexus it stands at; the pins and the presentation are composed just below, and the dial stands idle,
        // naming the missing piece, when either is absent.
        // The walker route is SHUT by name until a live grant reader opens it.
        // THE PINS. The full sovereign sync pin the admit carried rides the bootstrap beside the sync url, and each kept admit
        // bundle opens the pin its quorum signed. Each is filed in the ONE pair index under the name of the hearth that issued
        // it (the origin of ITS sync url: the admit carries no other true name for it), and the dial reads the index alone.
        // The dial's pin is the one `chooseHearthDial` chose with the url.
        const filed = fileHearthPins(gatePins, hd.filings);
        const dialPin = hd.pin;
        const dialNexus = dialPin?.nexus ?? null;
        if (filed > 0) console.log(`[nexus-join] ${filed} gate pin(s) filed (${[...new Set(hd.filings.map((f) => f.hearth))].join(", ")})`);
        // THE PRESENTATION. The face's chain and session, composed from the joined-face proof (or the founder's lazy
        // self-certificate) and the admit this vessel took for the pinned Nexus. Absent a session table, a pin or any piece
        // of the proof, the dial stands idle and the log names the piece.
        const dialSessions = opts.dialSessions ?? { table: new SessionTable(`dial-${globalThis.crypto.randomUUID()}`), binding: sessionBinding("socket"), profile: "face" };
        const composed = dialPin !== null
          ? await composeDialPresentation({ sealHome, pin: dialPin, personaGroup: personaGroupId, ...dialSessions })
          : null;
        // THE WALKER ROUTE SHIPS SHUT BY NAME (the routes ruling, stable-founding-road: "Walker arms ... ship SHUT by name"; a closed
        // route grants no silent authority): a vessel that walks at a hearth with no admit-carried pin presents no walk at the sealed gate.
        if (walkingAt && dialPin === null) console.log("[walk] walker-route-shut — the walker route ships shut by name; this walk presents nothing at the hearth's gate");
        if (composed !== null && !("presentation" in composed)) console.log(`[nexus-join] no presentation: ${composed.refusal}${composed.detail ? ` (${composed.detail})` : ""}`);
        const dialPresentationNow = composed !== null && "presentation" in composed ? composed.presentation : null;
        // The composition awaited: a dial that stood meanwhile, or a vessel that stood down, takes no second adapter.
        if (!live()) return;
        // The session door proves faces at the pin the vessel dials from here on, once its own presentation composed.
        dialPinNow = dialPin;
        nexusDial = maybeStartNexusClientDial({
          repo, syncUrl: hd.syncUrl, pins: gatePins, hearth: hearthNameOf(hd.syncUrl!), nexus: dialNexus,
          presentation: dialPresentationNow, deadlines: dialDeadlines(),
          ...(joinDocUrl ? { docUrl: joinDocUrl } : {}),
          onLog: (line) => console.log(`[nexus-join] ${line}`),
          // THE RETURN ON SOCKET A — a return re-folds the boards a partition staled.
          onReconnect: async () => { await afterRoll(); },
        });
        // A re-presentation has nothing to move while no presentation stands; the hook stays so the boards' callers keep it.
        representIfMoved = () => Promise.resolve();
        // The peer at the other end of this dial IS the hearth the charter came from — the realm's return lane.
        try { nexusDial?.adapter.on("peer-candidate", ({ peerId }: { peerId: string }) => {
          charterHearthPeers.add(peerId);
          console.log(`[realm] the charter's hearth stands at peer ${peerId} — the realm's registered books federate back to it`);
        }); }
        catch { /* an adapter without the event names no hearth — the realm leg simply never opens that lane */ }
      } catch (e) {
        console.log(`[nexus-join] dial-out skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    if (joinSyncUrl) {
      await standFaceDial(hearthDial);
    }
    else if (placeClass === "herm") {
      // A herm dials no hearth. Its standing at a Nexus is the counted `carry` that travels by hand
      // (lar:///ha.ka.ba/lararium/node/carry-bundle), and its floor gate answers at that Nexus alone
      // (lar:///ha.ka.ba/lararium/node/herm-carriage).
      console.log("[herm] a herm dials no hearth — its standing travels by hand (carry-bundle)");
    } else if (readKeptAdmitBundles(sealHome).length > 0) {
      console.log("[nexus-join] dial-idle: sync-url-absent — a kept admit bundle names no address the hearth listens at (re-take a bundle issued with --sync-url)");
    }
    // THE LATE DIAL. `admit-take` on a RUNNING vessel keeps a bundle that names a hearth, its sync url and the sovereign pin to dial,
    // and fires `afterRoll`, and the take stands that dial: the choice is made again over the bundles kept at that moment, and a dial
    // that already stands keeps what it presents (a moved board re-dials through the adapter). A herm dials no hearth, and a floor
    // composition holds no key to present with, so its attempt names `CustodyLocked` and stands nothing.
    if (placeClass !== "herm") {
      representIfMoved = lateDialOnce({ standing: () => nexusDial !== null, tornDown: () => dialStoodDown, stand: async (live) => {
        const late = chooseHearthDial({
          explicitUrl: opts.joinSyncUrl ?? null,
          hearthPin:   hearthPin ? { syncUrl: hearthPin.syncUrl, ...(hearthPin.gatePin ? { gatePin: hearthPin.gatePin } : {}) } : null,
          kept:        readKeptAdmitBundles(sealHome),
          walkRelay:   walkingAt?.record.relay ?? null,
          keptFloor:   (nexusHex) => readKeptHearthFloorPins(sealHome, Buffer.from(nexusHex, "hex").toString("utf8")),
        });
        if (late.syncUrl === null || !live()) return;
        for (const note of late.notes) console.log(`[nexus-join] ${note}`);
        await standFaceDial(late, live);
      } });
    }
    // ── THE BOOTSTRAP SEEDS; THE CATALOG PLANE REGISTERS ────────────────────────────────────────
    // A face is lit by `lares persona new 0` — a CLI act, on a vessel that is not running — so the plane it
    // stands lands in the BOOTSTRAP, which is this island's cold-start seed and reaches no registry. The
    // verbs that read a persona plane resolve it the way every user bag resolves, from the catalog registry. This boot
    // carries the seed across that gap.
    //
    // ALL FIVE OF A FACE'S PLANES, including intents: the circles, identities, sessions and intents planes carry
    // the same tag and answer the same ownership question, so one bridge serves the whole face and the five
    // cannot drift onto different registries.
    //
    // Idempotent by construction: it writes the url the seed already names, so a plane registered on an
    // earlier boot is re-written identically and a plane the operator lit an hour ago registers now.
    const registerInCatalog = (bagId: string, url: string | null | undefined): void => {
      if (!url || tiddlerText(assembly.catalogHandle.doc()?.tiddlers?.[bagId]) === url) return;
      assembly.catalogHandle.change((doc) => {
        doc.tiddlers[bagId] = storedLarRecord(bagId, { text: url, kind: "oracle" }, "vessel-boot");
      });
    };
    // EVERY PLANE FAMILY REGISTERS THROUGH A FACE PROOF: a face this boot does not wear registers its persona plane only where its
    // own sealed anchor, the verified KEL and its signed log vouch for that url (`proveFaceFromLog`, no device seat to prove);
    // a bootstrap entry no proof backs registers nothing.
    for (const plane of bootstrap.personaPlanes) {
      if (plane.personaGroupId === personaGroupId) continue;
      try {
        const other = await loadFaceAnchorOfGroup(plane.personaGroupId);
        if (!other) continue;
        const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(nexusPubkey), "board:persona-kel");
        const chain = personaKelChainForPrefix(board.doc(), other.personaKelPrefix);
        if (!chain || chain.length === 0) continue;
        const records = await readFacePersonaRecords(repo, { personaUrl: plane.url, group: plane.personaGroupId, extraDocs: [daemonDoc], heldOnly: true });
        const otherFace = faceBootTiddlers ? bootFacePlanes(faceBootTiddlers, plane.personaGroupId) : null;
        if (!otherFace?.intentsUrl) continue;
        if (proveFaceFromLog({ records, chain, group: plane.personaGroupId, anchor: other, planes: { persona: plane.url, intents: otherFace?.intentsUrl } }).ok) provenPlanes.set(plane.personaGroupId, plane.url);
      } catch (e) { if (!(e instanceof CustodyLocked)) throw e; }
    }
    for (const plane of bootstrap.personaPlanes) {
      if (provenPlanes.get(plane.personaGroupId) === plane.url) registerInCatalog(personaBagIdFor(plane.personaGroupId), plane.url);
    }
    // The worn face's siblings ride the bootstrap under their own derived names; register them beside a PROVEN worn face.
    const wornFace = wornFaceProved && bootstrap.personaBagId ? personaSiblingBagIds(bootstrap.personaBagId) : null;
    if (wornFace) {
      registerInCatalog(wornFace.circles,    bootstrap.circlesUrl);
      registerInCatalog(wornFace.identities, bootstrap.identitiesUrl);
      registerInCatalog(wornFace.sessions,   bootstrap.sessionsUrl);
      registerInCatalog(wornFace.intents,    bootstrap.intentsUrl);
    }
    // The selected face's custody standing decides whether its veil archive may leave this
    // composition and whether the island may rest a later export through the same door.
    const opens = sovereign !== null;
    // THE MOUNTED FACE'S OWN ROWS. Each face keeps its veil archive under its own PersonaGroup; the face this
    // composition mounts (the worn one, else the founding face) names which row the veil restores from and which
    // row the island's export lands in. The island receives only that face's atom and archive.
    litFace = sovereign && deviceEdge ? mountedFace : null;
    const veilArchiveBytes = sovereign && activeAtom && personaGroupId ? await sovereign.veilArchive(personaGroupId) : null;
    // THE OUTBOX KEY rides to the island the way the Archive does: opened here under the vessel key this thread holds,
    // and never at the floor, where the island's outbox holds shut (custody#/the-table, the outbox).
    // A row that stands and opens to no outbox key stops no boot: the island stands with its outbox shut, each parcel
    // verb refuses `outbox-shut`, and `lares vault status` names the row.
    const outboxKey = sovereign
      ? await sovereign.outboxKey(mountedFace).catch((err: unknown) => {
        console.log(`[outbox] the outbox key's row opens to no key (${err instanceof Error ? err.message : String(err)}) — the daemon island stands with its outbox shut`);
        return null;
      })
      : null;
    // THE CUSTODY WRITE DOOR stands with a sovereign composition and drops at its teardown: the island's archive
    // exports reach the sealed writer here, under the key this thread holds. At the floor no door stands, so an
    // island's ask answers unwritten.
    if (sovereign) {
      setCustodyWriteDoor((_carrier, bytes) => personaGroupId
        ? sovereign.writeVeilArchive(bytes, personaGroupId) : Promise.reject(new Error("face-not-named: the mounted face names no PersonaGroup")));
      stood.push({ what: "the custody write door", down: () => setCustodyWriteDoor(null) });
    }
    // THE ANCHOR THE DAEMON STANDS ON ALREADY CARRIES THE VERIFIED LEASE: this runs before `daemonAuth` snapshots `standingAnchor`, so the
    // daemon's live join and grant reads floor under the anchor this boot raised, never an older copy (read 6, opening row 2).
    // The sealed frontier rises only on a VERIFIED observation (`lease-observation`): a signed advance from a key the KEL
    // lineage seats. An unsigned slot on the mirrored daemon doc raises nothing, so a forged high slot cannot ratchet custody.
    if (faceAnchor && personaGroupId && personaKelChain) {
      const prefix = leaseEpochPrefix(personaGroupId);
      const slots = Object.entries(daemonDoc?.tiddlers ?? {}).filter(([t]) => t.startsWith(prefix)).map(([, r]) => tiddlerText(r));
      const raised = raiseAnchorFromSlots(standingAnchor!, slots, personaKelChain);
      if (raised !== standingAnchor) { await keepFaceAnchorOfGroup(raised); standingAnchor = raised; }
    }
    const faceLit = activeAtom !== null && atomSeed !== null;
    const daemonAuth = {
      placeVerifyingKey: vesselIdentity.verifyingKey,
      archiveOpens:         opens,
      ...(activeAtom && atomSeed ? { atom: { seed: Buffer.from(atomSeed).toString("hex"), key: activeAtom.key } } : {}),
      ...(veilArchiveBytes ? { veilArchiveBytes } : {}),
      // The face pins ride CONDITIONALLY — a place at the floor carries none, and writing them as
      // explicit `undefined` would read as a torn face rather than an unlit one.
      // A face rides lit only through its atom: at the floor the atom's row rests under the vessel key, so the floor
      // carries none of the four pins and boots faceless, never as a face whose edge names a key it cannot hold.
      ...(faceLit && personaGroupId ? { personaGroupId } : {}),
      ...(faceLit && standingAnchor ? { faceAnchor: standingAnchor } : {}),
      ...(meshCabalDocIdHex      ? { meshCabalDocIdHex }      : {}),
      // Derived, never enumerated — one derivation both vessels share, so the node and the browser
      // cannot drift apart on which bags a cap check can resolve. A wiki slot's bags ride only when a
      // wiki stands in the stack; a Herm carries none, blind by structure rather than by a flag.
      registerBags: deriveRegisterBags({
        // The mounted face registers its own planes on its own hive, and no hive registers a face it does not
        // wear: another compartment's planes register when it is worn, under its own atom.
        // The catalog names every face's plane documents; `deriveRegisterBags` leaves every face-scoped bag but the worn group's own four
        // out by their derived shape, so no list of the other faces (a mutable bootstrap's) decides it.
        fleets: personaGroupId && wornFaceProved ? [{
          personaGroupId,
          catalogNamed: catalogNamedBags(assembly.catalogHandle.doc()),
        }] : [],
        ...(slot ? { wikiBags: [slot.wikiBagId, slot.workingBagId, slot.draftBagId] } : {}),
        ...(kahuCanon.lares || kahuCanon.lararium ? { systemCanon: true } : {}),
      }),
      ...(faceLit && signerDid ? { signerDid } : {}),
      ...(faceLit && personaKelPrefix && personaKelChain
        ? { personaKel: { prefix: personaKelPrefix, chain: personaKelChain } }
        : {}),
      ...(faceLit && deviceEdge ? { deviceEdge } : {}),
      ...(outboxKey ? { outboxKey } : {}),
    };
    // R3 — the daemon VM resolves its plugins through the SAME selector + CAS path every wiki
    // island does (`resolveNodeIslandPluginCids`), never a vessel-wide hand-off. The
    // daemon's own one-recipe-model record names no offerings today, so this call is the floor
    // alone in practice — but it is the floor PROVEN through the selector, not assumed past it.
    crossroadsOfferingsHandle ??= await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads");
    const daemonPluginResolution = await resolveNodeIslandPluginCids({
      islandBlobs: assembly.islandHandle.doc()?.blobs,
      recipe:      { wikiSlug: "daemon" },
      lookup:      nodeOfferingLookup(crossroadsOfferingsHandle.doc()),
      readBytes:   (cid) => readCasBlobFromFs(cid, casDirForStorage(storageDir)),
    });
    if (!daemonPluginResolution.ok) {
      throw new Error(`[openNodeVessel] the daemon island's plugin resolution refused: ${daemonPluginResolution.error}`);
    }
    const pluginCids = daemonPluginResolution.pluginCids;
    daemonVm = await openDaemonVm({
      repo,
      daemonUrl: bootstrap.daemonUrl,
      // The persona plane rides only when a face stands; the daemon VM resolves nothing that is absent.
      ...(bootstrap.personaUrl   ? { personaUrl:   bootstrap.personaUrl }   : {}),
      ...(bootstrap.personaBagId ? { personaBagId: bootstrap.personaBagId } : {}),
      // A joinee at the floor holds no key to present its dial, so its persona plane (served by the hearth it dials) may
      // stand on the hearth alone; the unlocked composition dials and receives it. A founder's plane stays hearth-private.
      // An admitted device whose replica does not yet hold the plane (it syncs from the fleet) resolves it as a mesh-shared
      // document, which waits for the sync, rather than reading the hearth-private "no reachable copy" under load.
      ...((sovereign === null && joinSyncUrl) || (bootstrap.personaUrl && !heldDocOf(repo, bootstrap.personaUrl)) ? { personaLate: true } : {}),
      coreHash: assembly.coreHash,
      ...(pluginCids.length ? { pluginCids } : {}),
      grants: {
        islandUrl: assembly.islandHandle.url,
        // The daemon island's OWN bag (daemon = wikiBagUri("daemon"), one-recipe model).
        wikiUrl:   bootstrap.daemonUrl,
        // ACCESS grant, not a LOAD slot — the catalog registry is absent from expandRecipe,
        // so the kernel never layers it; the worker reaches it via the accessor.
        catalogUrl: catalogHandle.url,
      },
      daemonAuth,
      storageDir,
      // D-VR-C: the daemon bag is the one explicit worker-owned durable scope;
      // ordinary oracle/recipe documents remain parent-attached in the primary worker Repo.
      ownedDocument: true,
      rootDir: corpusRoot,
      guardCrossroadsNexusHandles: nexusStanding.kind !== "charter",
    });
    // ── THE PERSONAGROUP IDENTITY-SLOT RING (docs/pono/identity-slot-policy, arm B) ───────────────
    // A cross-operator peer holding a VERIFIED face-join grant on THIS face's plane reaches the face's own
    // planes — and nothing else. The ring WIDENS the self-slot fed gate by that ONE path (`compose` ORs it
    // atop the deterministic federatable set), so a stranger, and every private plane, read exactly as
    // before. The grant read reuses the plane the joinee's own seat act reads, bound to
    // the ONE `verifyFaceGrantRecord`. NO CLOCK RIDES IN: admission licenses off the persona-KEL HEAD alone
    // (event order), so absent a resolved KEL chain the ring stays UNWIRED — the pre-ring verdict stands
    // rather than a widening the vessel cannot walk clocklessly.
    //
    // The SAME ring decides for this face's SIBLINGS, by its own path (`composeSiblings`): a device the face's
    // PersonaGroup delegated, proven over the sibling session, reaches the face's own planes and the public
    // boards — never the @daemon, never another face's planes. Its proof source is the sibling channel's alone;
    // the grant path reads only what this vessel's inbound gate proved.
    if (personaGroupId && deviceEdge?.personaRootDid && personaKelPrefix && personaKelChain) {
      const ring = await assemblePersonaGroupRing({
        catalog: makeCatalogAccessor(repo, catalogHandle.url),
        personaGroupId,
        personaRootDid: deviceEdge.personaRootDid,
        personaKel: { prefix: personaKelPrefix, chain: personaKelChain },
        provenKeyOf: (peerId) => peerIdentifierMap.get(peerId) ?? null,
        siblingKeyOf: (peerId) => siblings?.provenKeyOf(peerId) ?? null,
        // THE DYAD'S SHADOW at the face-grant seat and the sibling lane (kapae#/reach): a device the fleet root
        // set aside holds no seat here, whatever record or session it proves. No ring yet reads as aside. The
        // grant path proves a FACE key (a face-join grant names it), so the shadow also reads the DEVICE each
        // gate-seated session under that face key was certified to (D4): an aside device's face holds no seat.
        // WIDENING WAITS ON THE FLEET'S SIGNED FRONTIER (K17): a face whose fleet board carries no qualifying frontier
        // seats and shares with nobody; a shadow still narrows at once.
        deviceAside: (key) => edgeShadows
          ? edgeShadows.widenBlocked(deviceEdge.personaRootDid) || edgeShadows.deviceAside(key) || seatedDevicesOfFace(key).some((d) => edgeShadows!.deviceAside(d))
          : true,
      });
      if (selfSlotFedGate) selfSlotFedGate = ring.compose(selfSlotFedGate);
      // The fleet's own edge board rides the sibling lane beside the public boards, so a root's raise reaches every device.
      siblingGate = ring.composeSiblings(new DeterministicFederationGate(nexusPubkey, edgeShadows?.fleetBoardUrls() ?? []));
    }

    // ── THE SIBLING CHANNEL (docs/pono/identity-slot-policy#/the-leaf-taxonomy) ─────────────────────
    // The ONE composition the browser vessel calls (`standSiblingChannel`): this face's siblings prove their
    // device edges to each other through every pinned herm against the KEL chain just walked, under the
    // PersonaGroup secret the root sealed to this device at enrolment and the lease epoch this vessel holds, and
    // sync over the session that proof binds; each herm carries sealed frames and reads none, and every pinned herm
    // carries the KEL drops this leaf pulls before it joins. A face whose enrolment delivered no secret stands no
    // channel, and says so; herms the channel cannot stand over refuse the channel alone, never the vessel. The
    // seed stays in these closures.
    const siblingHerms = opts.siblingHerms
      ?? (process.env["LAR_SIBLING_HERMS"] ?? "").split(",").map((h) => h.trim()).filter((h) => h.length > 0);
    if (siblingHerms.length > 0 && personaGroupId && personaKelPrefix && deviceEdge && siblingGate) {
      if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
      const sealRecord = tiddlerText(daemonDoc?.tiddlers?.[groupSecretSealTitle(personaGroupId)]);
      let sealRaw: unknown = null;
      try { sealRaw = sealRecord ? JSON.parse(sealRecord) : null; } catch { sealRaw = null; }
      const seal = await verifyGroupSecretSeal(sealRaw);
      if (!seal) {
        console.warn("[sibling] this face holds no PersonaGroup secret sealed to this device — its enrolment delivered none, so no sibling channel stands.");
      } else {
        const leaseSlots: Array<string | null> = [];
        const leasePrefix = leaseEpochPrefix(personaGroupId);
        for (const [title, rec] of Object.entries(daemonDoc?.tiddlers ?? {})) {
          if (title.startsWith(leasePrefix)) leaseSlots.push(tiddlerText(rec));
        }
        siblings = await standSiblingChannel({
          repo, herms: siblingHerms, nexusPubkey, personaKelPrefix,
          deviceKey: activeAtom?.key ?? "", sign: (image) => {
            if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
            return activeAtom.sign(image);
          },
          enrolment: { edge: deviceEdge, seal }, open: activeAtom.opener,
          expectedEpoch: readFace(personaKelChain ?? [], standingAnchor)?.leaseEpoch(personaGroupId, leaseSlots) ?? 0,
          onRefusal: (r) => console.warn(`[sibling] ${siblingRefusalLine(r)}`),
        });
      }
    }

    // ── NESTED verb-plane compose (composable-keel idiom) ─────────────────────────────────────────
    // The four provider-heavy verb groups (recall · lar-telemetry · capture · worldline) lift into a
    // #has-cap-stack of provider caps + verb-group caps (@lararium/tw5 verb-caps). The platform builds the
    // provider impls HERE from its node helpers + the now-live daemonVm, and composeVerbPlane wires the
    // stack (a verb cap whose mandatory provider is absent REFUSES — blind by structure). The merged
    // contribution stashes in `pendingVerbContribution`; wireVerbs applies it synchronously below.
    // Ordering: openDaemon runs (awaited) inside daemonCap.build BEFORE the un-awaited wireVerbs, and
    // daemonVm is set just above — so every injected impl is ready at this compose point.
    const mempalaceImpl: MempalaceProvider = {
      // SOVEREIGN recall + worldline: both read through house code, never the guest mempalace client —
      // the sovereign⊥guest separation is now complete on the `lares sense` surface.
      withClient: (fn) => fn(sovereignRecallClient),
      turnsForHandleStubs: async (handle, opts) => {
        // Page the content plane, keep drawers stamped with this agent-lineage handle, order by the shared
        // functor — house-code content_io alone, the guest client nowhere. The join keys (lar_agent_handle ·
        // lar_verbatim_sha) ride sovereign-captured exchange drawers; an empty plane → an empty trajectory.
        recallContent ??= makeContentPalace(larContentDir());
        const turns: HandleTurn[] = [];
        for (let offset = 0; ; ) {
          const page = await recallContent.scan({ offset, limit: 512 });
          for (const r of page.records) {
            const m = (r.metadata ?? {}) as Record<string, unknown>;
            if (m["lar_agent_handle"] !== handle) continue;
            if (opts?.wing !== undefined && m["wing"] !== opts.wing) continue;
            const sha = m["lar_verbatim_sha"];
            if (typeof sha !== "string" || !sha) continue;
            turns.push({
              drawerId: r.cid,
              verbatimSha: sha,
              ...(typeof m["lar_ffz"] === "string" ? { ffz: m["lar_ffz"] } : {}),
              ...(typeof m["chunk_index"] === "number" ? { chunkIndex: m["chunk_index"] } : {}),
              ...(typeof m["filed_at"] === "string" ? { filedAt: m["filed_at"] } : {}),
              ...(typeof m["source_file"] === "string" ? { sourceFile: m["source_file"] } : {}),
            });
          }
          if (page.next === null) break;
          offset = page.next;
        }
        return orderHandleTurnsToStubs(turns);
      },
    };
    const formImpl: FormPalaceProvider = {
      // The worldline form pre-fetch: a miss/fault → null (the worker keeps the turn's TIME slot, form
      // null). REUSES the recall form holder (one process).
      getForm: async (sha) => {
        recallFormPalace ??= makeFormPalace(larFormPalaceDir());
        try {
          const entry = await recallFormPalace.get(sha);
          return entry?.document ? parseFormVector(entry.document) : null;
        } catch {
          return null;
        }
      },
      // The dual recall fuse — the form-leg construction (markers→vector derive IN the daemon VM, the
      // content-only degradation on fault) + the RRF fuse, verbatim. The markers derive round-trips the
      // warm worker (deriveSkeleton); VM cold/unavailable → resolves null → the markers leg fuses
      // content-only (graceful, no shadow derive). A form-holder rejection collapses to [] → fuse
      // content-only. REUSES the recall form holder.
      multiRecall: (legs, args) => {
        recallFormPalace ??= makeFormPalace(larFormPalaceDir());
        recallStructurePalace ??= makeStructurePalace(larStructurePalaceDir());
        const deriveSkeleton = (q: string) => daemonVm.deriveSkeleton(q);
        const formSearchLeg = makeFormSearch({ query: args["query"] as string, formPalace: recallFormPalace, deriveSkeleton });
        // The STRUCTURE leg rides the reserved `extraGraphs` slot — the 3rd graph, fused on the shared
        // verbatim_sha like content+form (a holder fault degrades to []). The N-ary core needs no change.
        const structureLeg = makeStructureSearch(recallStructurePalace);
        return multiGraphRecall(
          {
            contentSearch: (a: Record<string, unknown>) => legs.contentSearch(a),
            formSearch: async (input: { nResults: number; where?: Record<string, unknown> }) => { try { return await formSearchLeg(input); } catch { return []; } },
            extraGraphs: [{ name: "structure", search: structureLeg }],
          } as unknown as Parameters<typeof multiGraphRecall>[0],
          args as unknown as Parameters<typeof multiGraphRecall>[1],
        ) as unknown as Promise<Record<string, unknown>>;
      },
    };
    // The ki↔R comparator body, extracted so BOTH the `mismatch` verb and the `flow` runner's mismatch
    // cap-step reuse it: run the TS-hull Gaussian-CMI coupling (coupleMesh) beside the R effective-TE
    // (couple_r serve-op) over the SAME signals and diff the directed edges. The daemon is the one seat
    // that reaches both hulls, so the diff lands here and nowhere else.
    const computeMismatch = async (rows: number[][], namesIn: string[] | undefined, root?: string): Promise<Record<string, unknown>> => {
      const width = rows[0]?.length ?? 0;
      const names: string[] = namesIn && namesIn.length === width
        ? namesIn : Array.from({ length: width }, (_, i) => `s${i}`);
      // TS side: each column is a child's univariate signal (T×1).
      const tsCoupling = coupleMesh(names.map((name, i) => ({ name, signal: rows.map((r) => [r[i]!]) })));
      // R side: the py/R serve-op (graceful skip when R absent).
      const r = await captureFor(root).coupleR({ rows, names });
      const rAvailable = r["r_available"] !== false;
      if (!rAvailable) {
        return { agree: null, rAvailable, note: "R unavailable — cannot compare (couple-r skipped)", edges: [] };
      }
      const rEdges = Array.isArray(r["edges"]) ? (r["edges"] as Array<Record<string, unknown>>) : [];
      const rHas = (from: string, to: string): boolean => rEdges.some((e) => e["from"] === from && e["to"] === to);
      const edges: Array<Record<string, unknown>> = [];
      let agree = true;
      for (let i = 0; i < names.length; i++) for (let j = 0; j < names.length; j++) {
        if (i === j) continue;
        const tsCoupled = (tsCoupling.te[i]?.[j] ?? 0) > 0;
        const rCoupled = rHas(names[i]!, names[j]!);
        const edgeAgree = tsCoupled === rCoupled;
        if (!edgeAgree) agree = false;
        if (tsCoupled || rCoupled) {
          edges.push({ from: names[i], to: names[j], ki: tsCoupled, r: rCoupled, agree: edgeAgree,
                       kiTe: tsCoupling.te[i]?.[j] ?? 0 });
        }
      }
      const disagreements = edges.filter((e) => e["agree"] === false).length;
      return {
        agree, rAvailable, edges, disagreements,
        note: agree
          ? `ki (Gaussian-CMI) and R (effective-TE) AGREE on all ${edges.length} directed edge(s) — the coupling reads honest`
          : `MISMATCH — ki and R disagree on ${disagreements} of ${edges.length} directed edge(s); the vessel's local read parts ways from the R reference`,
      } as unknown as Record<string, unknown>;
    };

    // The TS-hull coupleMesh capstone over an N-signal matrix (each column a child's univariate signal) —
    // whiten→couple→gate in one call. The `flow` couple cap-step reads it; the reading zeroes non-significant
    // edges (so a surviving `te[i][j] > 0` names a directed, significance-clean coupling).
    const coupleSignal = (rows: number[][], names: string[]): Record<string, unknown> => {
      const c = coupleMesh(names.map((name, i) => ({ name, signal: rows.map((r) => [r[i]!]) })));
      return c as unknown as Record<string, unknown>;
    };

    // The crystallize cap-step over an explicit signal: fold the matrix into occurrences — each cell a
    // (stratum=column, ordinal=row, strength=value) attestation — and read whether the pattern FIXES into
    // shared grammar (born ACROSS the columns/strata ⊕ its recurrence rhythm re-locks). A lone column never
    // crystallizes (single-stratum → zero cross-stratum drive), the honest floor.
    const crystallizeSignal = (rows: number[][], names: string[]): Record<string, unknown> => {
      type Occ = { stratum: string; ordinal: number; strength: number };
      const occ: Occ[] = [];
      for (let t = 0; t < rows.length; t++) {
        for (let i = 0; i < names.length; i++) occ.push({ stratum: names[i]!, ordinal: t, strength: rows[t]![i]! });
      }
      const verdict = crystallize<Occ>(occ, {
        stratumOf:  (o) => o.stratum,
        ordinalOf:  (o) => o.ordinal,
        strengthOf: (o) => o.strength,
      });
      return verdict as unknown as Record<string, unknown>;
    };

    // AUTO-EXTRACTION (feature-gated): when a coupling verb rides a target sensorium but no explicit signal,
    // project the target's child streams into a matrix (extractSignalFromTarget). Empty today on every real
    // sensorium (no child lands a signal.json until the re-pour) → the verb sees empty rows and answers its
    // own honest no-signal, never fabricating a matrix. An explicit signal always wins (never overridden).
    const signalOrExtract = (rows: number[][], names: string[] | undefined, root?: string): { rows: number[][]; names?: string[] } => {
      if (rows.length > 0 || !root) return { rows, ...(names ? { names } : {}) };
      const ex = extractSignalFromTarget(root);
      return { rows: ex.rows, ...(ex.names.length ? { names: ex.names } : {}) };
    };

    const daemonImpl: DaemonVerbProvider = {
      captureSource: async (input) => {
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).capture(req);
      },
      sweep: async (input) => {
        // BULK backfill through the holder that owns the store — it discovers EVERY transcript and captures
        // each on its ONE warm stream (never a second holder). The routed sweep spine.
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).sweep(req);
      },
      analyze: async (input) => {
        // DETECT-ONLY change-point arms over the poured stream, through the holder that owns the store
        // (reuses its ONE content handle; blind to any ground-truth — the wall stays uncrossed).
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).analyze(req);
      },
      coupleR: async (input) => {
        // The R effective-TE coupling reference (coupling.R RTransferEntropy::calc_ete) over the passed
        // signal matrix — the py/R twin of `ki`, computed py-side behind the causal-island boundary.
        // Stateless: it couples `rows`, not any store, so the holder is only the pipe to the py serve-op.
        // AUTO-EXTRACT when a target rides without a signal (feature-gated; empty until the re-pour lands it).
        const { sensoriumRoot, rows, names, ...req } = input;
        const src = signalOrExtract(Array.isArray(rows) ? rows : [], names, sensoriumRoot);
        return await captureFor(sensoriumRoot).coupleR({ ...req, rows: src.rows, ...(src.names ? { names: src.names } : {}) });
      },
      forecast: async (input) => {
        // The R early-warning plane (ews.R critical-slowing-down forecast) over the passed signal matrix —
        // computed py-side behind the causal-island boundary; the holder is only the pipe to the serve-op.
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).forecast(req);
      },
      mismatch: async (input) => {
        // The ki↔R comparator — the ONE place that reaches both hulls (extracted to computeMismatch so the
        // `flow` runner reuses the same diff). A disagreement means the vessel's local read and the R
        // reference part ways on whether streams couple.
        // AUTO-EXTRACT when a target rides without a signal (feature-gated; empty until the re-pour lands it).
        const rows: number[][] = Array.isArray(input.rows) ? input.rows : [];
        const names = Array.isArray(input.names) ? input.names : undefined;
        const src = signalOrExtract(rows, names, input.sensoriumRoot);
        return await computeMismatch(src.rows, src.names, input.sensoriumRoot);
      },
      flow: async (input) => {
        // THE FLOW RUNNER — look the pet-named cap-stack up (flowSeedByPetname) and run each step routed by
        // hull. The daemon is the one seat that reaches both hulls, so it wires every instrument's handle:
        // crystallize + the coupleMesh capstone (TS), phase (the py rhythm serve-op), mismatch (the ki↔R
        // comparator), and the auto-extraction projector (a target's child streams → a signal-matrix,
        // feature-gated: empty until the re-pour lands child signals).
        const root = typeof input.sensoriumRoot === "string" ? input.sensoriumRoot : undefined;
        return await runFlow(
          {
            crystallize: (rows, names) => crystallizeSignal(rows, names),
            couple:      (rows, names) => coupleSignal(rows, names),
            phase:       (rows, names, r) => captureFor(r).phase({ rows, names }),
            mismatch:    (rows, names, r) => computeMismatch(rows, names, r),
            extractSignal: (r) => { const ex = extractSignalFromTarget(r); return { rows: ex.rows, names: ex.names, note: ex.note }; },
          },
          {
            ...(typeof input.petname === "string" ? { petname: input.petname } : {}),
            ...(Array.isArray(input.rows) ? { rows: input.rows } : {}),
            ...(Array.isArray(input.names) ? { names: input.names } : {}),
            ...(Array.isArray(input.targets) ? { targets: input.targets } : {}),
            ...(root ? { sensoriumRoot: root } : {}),
          },
        );
      },
      ki: async (input) => {
        // The Ki (氣) coupling verdict computed HERE in TS — the H¹-gated fuse over the ADDRESSED sensorium's
        // coupling cap (general: any sensorium that #has coupling.children answers; memory carries none). The
        // MCP `ki` tool reaches this daemon verb (routed-only; no python standalone computes the cohomology).
        const root = input?.sensoriumRoot ?? memorySensoriumDir();
        return readCoupling(root) as unknown as Record<string, unknown>;
      },
      li: async (input) => {
        // The Li (理) gluing verdict computed HERE in TS — the Robinson li-radius + H¹-gated fuse over the
        // ADDRESSED sensorium's OWN sheaf planes (general: any sensorium with ≥2 sheaf planes answers). The
        // default single-stream cover glues a nested-cover PLUMBING witness (flagged), never a health verdict.
        const root = input?.sensoriumRoot ?? memorySensoriumDir();
        return readCohere(root) as unknown as Record<string, unknown>;
      },
      jing: async (input) => {
        // The Jing (勁) coherence verdict computed HERE in TS — the li∘ki square over the ADDRESSED
        // child-host's lobes: EXTEND them to a reconciled self (ki fuse), RESTRICT back (li), read the
        // round-trip. Bare reads the MESH (who/authority/flow — the DreamNet-serving load-bearing host).
        const root = input?.sensoriumRoot ?? meshSensoriumDir();
        return readJing(root) as unknown as Record<string, unknown>;
      },
      refreshDerived: async (input) => {
        // RE-DERIVE the whole derived layer through the holder that owns the store — one command, serialized
        // on the capture pipe (queues between passes, never races the writer). `which` narrows to one.
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).refresh(req);
      },
      readRejim: async (input) => {
        // Read the landed rejim (rhythm/geology) plane through the holder that owns the store.
        const { sensoriumRoot } = input;
        return await captureFor(sensoriumRoot).readRejim({});
      },
      status: async (input) => {
        // The taxonomy over the holder's content store — reads the ONE handle the holder owns (no second client).
        const { sensoriumRoot } = input;
        return await captureFor(sensoriumRoot).status({});
      },
      worldline: async (input) => {
        // The fork-DAG rhizome read through the holder that owns the store (fresh worldline handle per-op).
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).worldlineDag(req);
      },
      kapae: async (input) => {
        // Mute a worldline branch + cascade across the content store, through the holder — serialized with
        // capture so the mutation never races the live writer (the one-owner discipline).
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).cascadeKapae(req);
      },
      unKapae: async (input) => {
        // Restore a muted worldline branch across the content store — the reverse of kapae, through the holder.
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).cascadeUnKapae(req);
      },
      planeRecord: async (input) => {
        // The cross-plane witness through the holder that owns the store (read-only, shared plane-query impl).
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).planeRecord(req);
      },
      placeStructurepalaceKapae: (turnKey, ended) => daemonVm.placeStructurepalaceKapae(turnKey, ended),
      subagentEdges: async (input) => {
        // The subagent edge CRUNCH moved to python (beside the transcript data) — route to the holder's
        // `subagent-edges` serve-op through the SAME sensorium-addressed capture pipe the other verbs use.
        const { sensoriumRoot, ...req } = input;
        return await captureFor(sensoriumRoot).subagentEdges(req);
      },
      worldlineCompare: (input) => daemonVm.worldlineCompare(input),
      worldlineTrajectory: (input) => daemonVm.worldlineTrajectory(input),
      // ── the DURABLE sensorium-lifecycle executors ─────────────────────────────────────────────────
      // These route over manifest.json alone (no store holder, no captureFor) — the SAME pure verb
      // functions the CLI-direct door drives, now reachable over the daemon wire so the MCP surface
      // mirrors the CLI three-way. The reversibility×trust seat rides guardHitl (the mesh grid): an
      // HITL verb (promote·retire·purge) REFUSES without an operator-approval capability — the surface
      // twin of the CLI's `--approve`, so an irreversible verb crosses the SAME gate on both surfaces.
      senseRoster: async () => ({ sensoria: rosterSensoria() }),
      senseInspect: async (input) => {
        const insp = inspectSensorium(input.name);
        if (!insp) throw new Error(`no sensorium named '${input.name}'`);
        return insp as unknown as Record<string, unknown>;
      },
      senseBuild: async (input) => buildEphemeralSensorium(
        input.name, input.halfLife !== undefined ? { halfLife: input.halfLife } : {},
      ) as unknown as Record<string, unknown>,
      senseReconcile: async (input) => {
        // --all re-settles every sensorium; else one by name (the pure reducer writes only on change).
        if (input.all) return { all: reconcileAllSensoria() } as unknown as Record<string, unknown>;
        if (!input.name) throw new Error("reconcile wants a sensorium name (or all)");
        return reconcileSensorium(sensoriumDir(input.name)) as unknown as Record<string, unknown>;
      },
      sensePromote: async (input) => {
        // in-loop human graduation — one-way by intent → HITL. The gate mirrors the CLI's requireApprove.
        guardHitl("promote", input.approve);
        return promoteSensorium(
          input.name, input.storeSwap ? { storeSwapTarget: input.storeSwap } : {},
        ) as unknown as Record<string, unknown>;
      },
      senseRetire: async (input) => {
        // a JUDGED deaccession (grounds required; move-not-delete) → HITL. The gate mirrors requireApprove.
        guardHitl("retire", input.approve);
        return retireSensorium(input.name, input.grounds) as unknown as Record<string, unknown>;
      },
      senseUnRetire: async (input) => unRetireSensorium(input.name) as unknown as Record<string, unknown>,
      sensePurge: async (input) => {
        // the irreversible byte GC → HITL. purgeSensorium ITSELF guardHitls (defense-in-depth) and refuses
        // a live sensorium (only a tombstone GCs), so the approval rides through as the reclaim authority.
        return purgeSensorium(input.name, input.approve) as unknown as Record<string, unknown>;
      },
    };
    const telemetryImpl: TelemetryProvider = {
      writeback: (wing, opts) => {
        try {
          const r = writebackWing(wing, opts);
          return { wing, ...r };
        } catch (err) {
          if (err instanceof TelemetryUnavailable) throw new Error(`lar-telemetry unavailable: ${err.message}`);
          throw err;
        }
      },
    };
    pendingVerbContribution = await composeVerbPlane([
      mempalaceProviderCap(mempalaceImpl),
      formPalaceProviderCap(formImpl),
      daemonVerbProviderCap(daemonImpl),
      telemetryProviderCap(telemetryImpl),
      recallVerbCap(),
      telemetryVerbCap(),
      captureVerbCap(),
      worldlineVerbCap(),
    ]);

    return { workerEa: daemonVm.workerEa, mountMainVerbs: daemonVm.mountMainVerbs, resolveBinding: daemonVm };
  };

  // Thin main verb plane. Every daemon verb that touches the catalog / recipe /
  // residency now lives in the worker (wireWorkerVerbs) — the daemon holds ACCESS to
  // all bags there and writes-then-syncs, never reaching into a mounted wiki. Main
  // keeps only what is genuinely main-resident: sync-wiki (commands the pool's active
  // wiki island) and residency stats (a read of the main-resident manager).
  const wireVerbs: VesselOrchestration<VesselIslandPool>["wireVerbs"] = (registry, assembly) => {
    seedVesselDefaults(registry);
    registry.register("sync-wiki", async (args, ctx) => {
      // Resolver-as-activator: a reference wakes a cold grain before the verb lands
      // (the pinned home wiki is already live → a cheap no-op).
      await wikiActivation.ensureActive(slotActiveWikiId);
      return vmManager.placeWikiVerb(slotActiveWikiId, {
        verb: "sync-wiki", args: args as Record<string, unknown>, requestedBy: ctx.invocation.requestedBy,
      });
    });
    // wiki-act places slot-targeted residency verbs in the slot's wiki.
    // Promotion from a working slot stays in that slot's wiki island.
    registry.register("wiki-act", async (args, ctx) => {
      const verb = String(args["verb"]);
      const innerArgs = (args["args"] as Record<string, unknown>) ?? {};
      const destination = innerArgs["to-bag"] ?? innerArgs["bag"];
      // The daemon wiki stands on the daemon's own reach, never a wiki island, so its slots route nowhere.
      const slot = (bag: string): boolean => /^lar:\/\/\/ha\.ka\.ba\/wikis\/[^/]+\/(?:temp|draft|personal|working)$/.test(bag) && wikiSlugOfBag(bag) !== "daemon";
      const wikiVerb = verb === "LOAD" || verb === "MOVE" || verb === "COPY" || verb === "ADD";
      const destinationWiki = wikiVerb && typeof destination === "string" && slot(destination)
        ? wikiSlugOfBag(destination) : null;
      const source = innerArgs["from-bag"];
      const sourceWiki = verb === "MOVE" && typeof source === "string" && slot(source)
        ? wikiSlugOfBag(source) : null;
      const target = typeof args["wiki"] === "string" && args["wiki"]
        ? args["wiki"] : sourceWiki ?? destinationWiki ?? slotActiveWikiId;
      const activation = await wikiActivation.ensureActive(target);
      if (!activation.ok) throw new Error(`wiki-act: ${activation.cause}: ${activation.detail}`);
      return vmManager.placeWikiVerb(target, {
        verb,
        args: innerArgs,
        requestedBy: ctx.invocation.requestedBy,
      });
    });
    registry.register("residency", makeResidencyStatsReactor({ residency }));

    // THE STORE'S DOOR TABLE — `lares nexus kapae/posture/admit-take`, and every other store-touching verb run
    // here while this vessel stands, against the Repo its peers sync, so no second Repo ever writes beside this
    // one. (`lares host` and `lares walk` ride the custody door: their rows rest sealed, and their acts read the
    // store and the dial this composition lends them, so a roll still reaches its walkers with no restart.) `afterRoll`
    // (above) serves as the one after-write hook every row that lands a board or a practice joint fires; the
    // rows reach the refold, and no standalone CLI-dialed verb does.
    const doors = storeDoorReactors({
      storageDir, sealHome, repo, catalogUrl: assembly.catalogHandle.url,
      onRolled: afterRoll,
      // The key side of a removal answers a SOVEREIGN vessel alone: the facts read the sealed roster, and a
      // floor's island holds no veil.
      ...(sovereign ? { seatDuties: (facts) => askSeatDutiesAsVessel(facts).answer } : {}),
    });
    for (const [verb, reactor] of Object.entries(doors)) registry.register(verb, reactor);

    // realm-bag — REGISTER a bag this vessel's steward keeps on the realm's shared CRDT (realm-bag-brief): the
    // record `{ bagUri, docUrl, keptBy, readTier }` sealed by the key this vessel's WORN face presents to the
    // realm's Nexus, landed on the realm doc, and announced on @crossroads as `{ bagUri, keptBy }` alone. The
    // steward door holds the whole verb (`realm-steward`): it picks the signer, and it never reaches a root.
    // The verb names its realm (`args.realm`); an act in a cabal realm stands the vessel there.
    registry.register("realm-bag", (args) => runRealmBag({
      plane: realmPlane, args,
      registryDocs: () => [assembly.islandHandle.doc(), assembly.catalogHandle.doc()],
      reverdict,   // the realm gate's standing set grew — a member peer's cached verdict on that bag's doc moves
    }));
    // realm-bags — the STANDING registrations a realm carries (counted and folded; an equivocal bag never
    // lists): the realm the verb names, or the charter-derived realm with none named. Verdict-free: it reads
    // the realm doc as-of-last-sync, and a read never enters a realm.
    registry.register("realm-bags", (args) => runRealmBags({ plane: realmPlane, args }));

    // nexus-rekey — the resource's own charter quorum signs its lease advance under its verified seal
    // lineage. The vessel's atom signs nothing here; each held seat signs only through its custody door.
    registry.register("nexus-rekey", async (args) => {
      const resource = typeof args["resource"] === "string" ? (args["resource"] as string) : "";
      if (!resource) throw new Error("nexus-rekey: `resource` required (the lease resource id to roll)");
      const named = typeof args["nexus"] === "string" ? args["nexus"] as string : undefined;
      if (!activeAtom) throw new Error("face-not-named: nexus-rekey needs a selected face atom");
      const charter = await leaseCharterOf({ repo, vesselKey: activeAtom.key, sealHome, resource,
        ...(named ? { named } : {}) });
      const held = await selectHeldQuorumSigners(charter.roster, (count, threshold) =>
        new Error(`nexus-rekey: seats-not-held: ${count} of ${threshold} charter seats held`));
      const r = await rollQuorumLeaseOnBoard(await readDaemonDoc(), resource,
        { lineage: charter.lineage, signers: held.map((s) => ({ key: s.verifyingKey, sign: s.sign })) });
      return { verb: "nexus-rekey", nexus: charter.nexus, ...r };
    });

    // nexus-reshare — the immune keel's RE-SHARE tooth: the sealed bodies this hearth HOLDS (the cad ciphertext tier
    // on disk, cid-named files). The vessel holds no carriage channel to announce `cas-have` over: the herm relay
    // carries drops alone (lar:///ha.ka.ba/lararium/node/carry-bundle), so the tooth names the held set and
    // announces nothing. The PUBLIC FLOOR re-announce rides the read-face's own Ea breath (the signed monotone
    // pointer re-issues each TTL/2), so a static floor never reads stale.
    registry.register("nexus-reshare", async () => {
      const cids = listSealedCids(cadSealDir(storageDir));
      return { verb: "nexus-reshare", held: cids.length, announced: 0 };
    });

    // cas-sweep + the sweep TICK — the ONE production caller of `casSweep` (node-cas): the reference count derives
    // off this composite, the cadence off the realm's OWN pace (the mesh-cabal feed on the daemon board), never a calendar.
    // THE PROTECT SET GOVERNS A DELETION, so a torn manifest must not read as an absent one. An empty set
    // says "nothing here needs protecting" and the sweep acts on it — folding an unreadable manifest into
    // one would strip the engine and plugin blobs of their only guard and let the vessel eat its own
    // genesis. A manifest that stands and will not read withholds the sweep entirely; an ABSENT manifest
    // keeps its empty set, because a vessel holding no manifest holds no genesis blobs to lose.
    const genesisProtect = genesisProtectSet(genesisDir);
    if (genesisProtect === "unreadable") {
      console.warn("[cas-sweep] the genesis seed stands but will not derive — withholding the sweep. Nothing sweeps until it reads, so no genesis blob can age out unprotected. Repair or remove the malformed seed.");
    } else {
      // M7″: `storeClaim.bootEpoch` is REQUIRED on a vessel-held claim (never undefined, never a guessed
      // 0) — the epoch THIS vessel's own boot bumped once, at claim time (step 0, above). Epoch 0 HOLDS
      // every pin (`currentFence <= fence` for any non-negative fence), so a first boot withholds nothing
      // it should keep. Each sweep takes this boot's captured epoch, so a `--held` pin is judged against
      // the boot that stands, never a re-read of the `.boot-epoch` sidecar file.
      const bootEpoch = storeClaim.bootEpoch;
      const sweep = installCasSweep({ registry, casDir: cidDir, paceCell: realmPaceCell, references: () => assembly.composite.entries(), protect: genesisProtect, pins: () => readCasPins(cidDir), currentFence: () => bootEpoch, realmClock: async () => { const doc = (await readDaemonDoc()).doc(); const realm = tiddlerText(doc?.tiddlers?.[MESH_CABAL_DOC_ID_TIDDLER]); return realm && doc ? realmMaintenanceFromBoard(doc, realm) : null; }, log: (line) => console.log(line) });
      stood.push({ what: "the CAS sweep tick", down: () => sweep.stop() });
    }

    // cas-fetch — the fetch door's explicit READ: resolve a cid through the vessel's door (local `cid/` first,
    // then the Herm's public shore, verified, write-through). The verb IS a read, so fetch-on-read holds
    // it; it fabricates nothing — a miss everywhere answers `held:false` and the pointer stays PENDING.
    registry.register("cas-fetch", async (args) => {
      const cid = typeof args["cid"] === "string" ? (args["cid"] as string) : "";
      if (!cid) throw new Error("cas-fetch: `cid` required");
      const before = readCasBlobFromFs(cid, cidDir) !== null;
      const bytes = await resolveCidThroughDoor(cid);
      return { verb: "cas-fetch", cid, held: bytes !== null, fetched: bytes !== null && !before, bytes: bytes?.byteLength ?? 0,
               door: hermShore ? "herm-shore" : "local-only" };
    });

    // cad-seal — REGISTER a carrier body the content-key holder sealed. The holder lives in the daemon island,
    // beside this vessel's key seat (lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store): the island's
    // `sealed-seal` verb seals a body under its BAG's content key and rests the ciphertext in the `cad/` tier, so
    // no bare key crosses the island's port. This verb then takes the sealed ADDRESS and registers it: the
    // sealed set, its scope sidecar and the discovery announce. The charter names only the SCOPE the sealed block
    // registers under, which the carry lane's own gates read. FAIL-CLOSED: at the floor, with no seated charter,
    // or for an address whose bytes do not rest sealed in the tier, the act refuses by name and registers nothing.
    // A caller runs the two verbs in turn, as `lares edge settle` runs its three.
    registry.register("cad-seal", async (args) => {
      if (!sovereign) throw new Error("cad-seal: this vessel rests at the floor, so no content key opens — unlock it with `lares vault unlock` (nothing registered)");
      // The scope comes off the VERIFIED lineage (`foundingRoster`): a charter whose chain does not verify, or
      // whose head does not bind its seated keys, names no head, so no scope stands and nothing registers.
      const charter = readNexusDoc(sealHome);
      const nexusAid = nexusAidOf(charter);
      const headEpochCid = foundingRoster(charter).sealEpochCid || null;
      if (!nexusAid || !headEpochCid) throw new Error("cad-seal: no verified charter epoch stands here, so no Nexus names the sealed block's scope — seat one with `lares nexus seal seat` (nothing registered)");
      const cid = typeof args["cid"] === "string" ? (args["cid"] as string) : "";
      if (!cid) throw new Error("cad-seal: `cid` required — the `blake3:` address the island's `sealed-seal` verb answered");
      const registered = registerSealedCarrier({
        registry: sealRegistry,
        cadDir:   cadSealDir(storageDir),
        cid,
        scope:    { nexusAid, epochCid: headEpochCid },
        tracker:  casBagTracker,
        self:     vesselIdentity.verifyingKey,
      });
      // Every field may cross this boundary: the address, the docId and the scope. No key rides the answer.
      return { verb: "cad-seal", cid: registered.cid, docId: registered.docId, nexusAid: registered.nexusAid, epochCid: registered.epochCid, sealed: sealRegistry.seal.isSealedPlane(registered.docId) };
    });

    // ── The wiki-SWITCHER surface (the FACE over the activation cap) ──────────────
    // The LIVE chokepoint (distinct from boot-time `open-wiki`): a reference ACTIVATES
    // the grain (resolveWikiSpec wakes ANY registered wiki cold, single-flight). node is
    // headless — no #projection surface to flip — so a switch here is pure activation.
    registry.register("wiki-switch", async (args) => {
      // The slug rides as a structured `slug` arg — from the CLI / MCP, OR from a
      // DOM-driven verse-event whose `arg-slug` field the reaction-router lifted into
      // the args payload (#48 unified the DOM path onto the CLI's structured-args contract).
      const slug = String(args["slug"] ?? "");
      if (!slug) throw new Error("wiki-switch: `slug` required");
      const active = await wikiActivation.ensureActive(slug);
      return { verb: "wiki-switch", slug, active: active.ok, ...(!active.ok ? { cause: active.cause, detail: active.detail } : {}), held: [...wikiActivation.held()] };
    });
    // wiki-hold / wiki-release — the ROTATABLE active-wiki pin (the switcher's pin
    // control), budget-enforced by the cap (the daemon bag always + pinBudget rotatable).
    // Distinct from the recipe-bag `pin-wiki`: this pins the wiki GRAIN in the collector.
    registry.register("wiki-hold", async (args) => {
      const slug = String(args["slug"] ?? "");
      if (!slug) throw new Error("wiki-hold: `slug` required");
      const held = await wikiActivation.hold(slug);
      return { verb: "wiki-hold", slug, held, holds: [...wikiActivation.held()], budget: wikiActivation.grant.pinBudget };
    });
    registry.register("wiki-release", async (args) => {
      const slug = String(args["slug"] ?? "");
      if (!slug) throw new Error("wiki-release: `slug` required");
      wikiActivation.release(slug);
      return { verb: "wiki-release", slug, holds: [...wikiActivation.held()] };
    });
    // wiki-active — the live switcher state: which wikis run now + which are held.
    registry.register("wiki-active", async () => {
      const active = vmManager.inspect().filter((s) => s.temperature === "wela").map((s) => s.wikiId);
      return {
        verb: "wiki-active", active, held: [...wikiActivation.held()],
        activationCap: wikiActivation.grant.activationCap, pinBudget: wikiActivation.grant.pinBudget,
      };
    });

    // The four provider-heavy verb groups (recall · lar-telemetry · capture · worldline-compare/-trajectory)
    // lifted into the NESTED #has-cap-stack (verb-caps.ts) — composed at the END of openDaemon (where the
    // daemonVm + the node helpers are live) and stashed in `pendingVerbContribution`. Apply it here,
    // synchronously: a verb a missing provider would have refused never reaches this point. openDaemon runs
    // (awaited) inside daemonCap.build BEFORE this un-awaited wireVerbs, so the contribution is always ready.
    if (!pendingVerbContribution) {
      throw new Error("[openNodeVessel] verb plane not composed — wireVerbs ran before openDaemon stashed the contribution");
    }
    pendingVerbContribution(registry);
  };

  // After the daemon VM lives: residency pins + sweeper, arm the inbound gate, refresh oracles.
  const afterDaemon: VesselOrchestration<VesselIslandPool>["afterDaemon"] = (_daemon, assembly) => {
    void residency.pin(BAG_IDS.catalog,    "boot:catalog");
    void residency.pin(BAG_IDS.oracle,     "boot:oracle-island");
    void residency.pin(BAG_IDS.lararium,   "boot:lararium-corpus");
    if (assembly.laresHandle) void residency.pin(BAG_IDS.lares, "boot:lares-corpus");
    // A face's planes pin under the face's own names — the vessel pins what it actually mounted.
    const pinFace = bootstrap.personaBagId ? personaSiblingBagIds(bootstrap.personaBagId) : null;
    if (pinFace) {
      void residency.pin(pinFace.identities, "boot:identities");
      void residency.pin(pinFace.circles,    "boot:circles");
      void residency.pin(pinFace.sessions,   "boot:sessions");
      void residency.pin(pinFace.intents,    "boot:intents");
    }
    void residency.pin(DAEMON_BAG_ID,       "boot:daemon");
    // Durable pin replay — BEFORE the sweeper starts, so a replayed pin never races the first
    // idle-cool tick. Recovers whatever `lares pin` persisted under the daemon doc across a
    // restart (residency-tiers.mem#/pin-flag; see writePinTiddler/replayPinsFromDaemonDoc).
    void replayPinsFromDaemonDoc(daemonVm.daemonHandle, residency);
    residency.startSweeper();
    assembly.composite.attachResidency(residency);

    // THE SYNC GATES stand once the island answers: one sovereign gate per Nexus, under the custody root, each
    // signing its own verdict. The walkers' session verbs (the blind mint, the sealed carriage) stand nowhere: the
    // walker arms ship SHUT by name, so no session ever sorts as a walker.
    if (resweepGates === null) {
      resweepGates = standSyncGates;
      void standSyncGates().catch((err: unknown) => console.warn(`[lar-gate] the sync gates did not stand: ${err instanceof Error ? err.message : String(err)}`));
    }
    // THE HOSTING DOC RE-DERIVES FROM THE SEALED STATE. A roll commits at its state row; an act that sealed there
    // and never reached the doc lands as this sovereign composition stands, so its walkers can read the epoch.
    // A floor reads no hosting row and lands nothing.
    if (sovereign && landOwedHostingActs === null) {
      let owed = true;
      landOwedHostingActs = async (): Promise<void> => {
        if (!owed) return;
        try {
          const landed = await landEveryHostingAct({ sealHome, repo });
          owed = false;
          if (landed > 0) console.log(`[hosting] landed ${landed} hosting act(s) the sealed state held and the hosting doc lacked`);
        } catch (err) {
          console.warn(`[hosting] the sealed hosting state did not land on its doc, and stays owed to the next refold: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      // Started here and settled on its own: the landing catches its own fault and stays owed to the next refold.
      void landOwedHostingActs();
    }

    // A raise this vessel counted before it last stopped still owes its roll: once the island answers verbs, the
    // settler reads the fold that landed at boot.
    if (seatSettler) void daemonVm.workerEa.then(() => seatSettler.onFold(), () => undefined);
  };

  const subscribeWorkerEventsToDaemon = (): void => {
    eventBus.subscribe<{ wikiId: string; listenable: string; payload: Record<string, string | number | boolean> }>(
      "worker.event",
      ({ listenable, payload }) => {
        const verb    = typeof payload["verb"]    === "string" ? payload["verb"]    : undefined;
        const fromUri = typeof payload["fromUri"] === "string" ? payload["fromUri"] : undefined;
        if (!verb) return;
        daemonVm.placeVerb({
          verb,
          args:        verbArgsFromPayload(payload),   // structured args off the `verb-args` JSON (#48)
          requestedBy: typeof payload["requestedBy"] === "string" ? payload["requestedBy"] : listenable,
          listenable,
          ...(fromUri ? { fromUri } : {}),
        });
      },
    );
  };

  // Island pool (worker_threads) + the event bus + the sovereign-worker command bindings.
  const makePool: VesselOrchestration<VesselIslandPool>["makePool"] = (_daemon, assembly) => {
    // ── Durable mailbox (lane law §7) — keel mechanism (vessel-mailbox.ts,
    // substrate-agnostic); this vessel supplies only its live-delivery path. Assigned to the
    // forward-declared ref so the shared residency wiring's undeliverable-alert hook parks here.
    mailbox = makeDurableMailbox(
      assembly.composite,
      // Delivery activates on reference: a drain to a cold grain re-mounts it first
      // (on `ea` the grain is already live → a cheap no-op; this covers a drain raced
      // ahead of the breath). A grain that cannot activate rejects → stays parked.
      async (wikiId, v) => {
        const activation = await wikiActivation.ensureActive(wikiId);
        if (!activation.ok) throw new Error(`[mailbox] ${wikiId} ${activation.cause}: ${activation.detail} — kept parked`);
        return vmManager.placeWikiVerb(wikiId, v);
      },
      (line) => console.log(line),
    );
    eventBus = new LarEventBusImpl(20);
    for (const ring of DEFAULT_RINGS) eventBus.registerRing(ring);
    eventBus.start();
    subscribeWorkerEventsToDaemon();

    const workerRootDir = corpusRoot;
    const diskMirrorGrant: DiskMirrorGrant = [
      // `bags/` PROJECTS ON THE KAHU'S VESSEL ALONE: a vessel the cabal did not admit holds neither live document, so it
      // grants neither mirror and writes nothing under `bags/lares` or `bags/lararium`.
      ...(kahuCanon.lares    ? [{ bagId: LARES_DOC_URI,    mirrorRoot: join(workerRootDir, "bags/lares"),    scope: "lares" }] : []),
      ...(kahuCanon.lararium ? [{ bagId: LARARIUM_DOC_URI, mirrorRoot: join(workerRootDir, "bags/lararium"), scope: "lararium" }] : []),
      // crossroads = the PUBLIC plane's seed/canon bag — it holds the moved public-domain
      // library (raw .txt books + .mem memes with large source ahus). It projects to
      // bags/crossroads like the other seed bags. Safe to project ONLY with the skinny-handle
      // rule in place (T3): a book too big for the CRDT lands as a skinny handle, and the
      // projector writes only its handle — the body stays in the cid/ CAS, never re-overflowing.
      // THE CHARTER-ONLY MIRROR GUARD (crossroads WHO-board leak, 2026-09-20): a private-nexus-of-one
      // or a dialed anchor still mints its per-Nexus WHO-handles pointer into the crossroads doc on
      // first boot (who-face.ts), and without this flag every throwaway dev boot's pointer disk-mirrors
      // alongside the real charter-backed library. Baked from the RESOLVED kind, once, here — never
      // re-derived from the tiddler inside the projector (which crosses a worker boundary and carries
      // no kind of its own).
      { bagId: CROSSROADS_DOC_URI, mirrorRoot: join(workerRootDir, "bags/crossroads"), scope: "crossroads",
        guardNexusHandles: nexusStanding.kind !== "charter" },
      // VIRTUAL BAGS. `working` (and `self` below) name LAYER COORDINATES, never bags on disk — a write
      // layer and a per-wiki canon authority the mount expands from the slug. They carry no `@` for the
      // same reason a bag does not: the SEGMENT and the FLAGS say what a name is, so the name says only
      // which one. `resolveDiskMirrors` branches on `selfCanon`/`wikiSlot`, never on any marker in the
      // string — a marker here would decorate a decision two booleans already carry.
      //
      // working = the live write layer; projects per-wiki to wikis/{slug} (BOTH
      // the bag `wikis/{slug}/working` and the leaf fill from the slug at mount —
      // wikiSlot). The authority (the wikis base) stays static here; designation
      // rides the recipe's mirrorBags.
      { bagId: "working",        mirrorRoot: join(workerRootDir, "wikis"),          scope: "working",  wikiSlot: "working" },
      // self-canon = the per-wiki CANON authority: a minted user wiki's own
      // @{slug} bag projects to bags/{slug} (both bagId and leaf fill from the
      // slug at mount). System wikis (lares/lararium) carry literal grants
      // above, so resolveDiskMirrors skips this for them — no double-project.
      { bagId: "self",          mirrorRoot: join(workerRootDir, "bags"),           scope: "self",    perWikiSlug: true, selfCanon: true },
    ];
    // R3 — TWO WIKIS IN ONE VESSEL: each mount resolves its OWN recipe's plugin-offerings
    // through the selector + CAS (`resolveNodeIslandPluginCids`), never one vessel-wide floor.
    // The shared Crossroads board materializes once and is read fresh per mount (a
    // later-announced offering becomes selectable without a vessel restart).
    const casDir = casDirForStorage(storageDir);
    vmManager = new VesselIslandPool({
      mainRepo:    repo,
      // D4 lends the actor grant; this vessel opens a read-only port until then.
      portPolicy: opts.portPolicy ?? ((binding, islandKey) => ({ faceId: wornGateFace()?.personaGroup ?? islandKey, actor: binding, edits: false, bags: [], admin: false })),
      ...(opts.onPortMessage ? { onPortMessage: opts.onPortMessage } : {}),
      storageRoot: storageDir,
      // A co-located node wiki island resolves its keyhive grants in the SAME synchronous-WASM
      // slot-resolution the daemon island runs (and on the same machine). A one-time keyhive
      // reconverge (e.g. an OutOfOrderOperation fixed-point after a genesis rebake) blocks the
      // worker event loop, so the interval breath cannot fire and the silence window is the only
      // gate. The pool default (HANDSHAKE_TIMEOUT_MS = 10s) is tuned for the browser's lighter
      // profile and false-timed a slow-but-live node mount into a FATAL boot death. Give the node
      // pool the daemon island's generous budget — a healthy mount still settles in <1s; only a
      // slow keyhive reconverge spends it. (silence 120s / stall 360s, matching daemon-vm-core.)
      mountSilenceMs: 120_000,
      mountStallMs:   360_000,
      resolvePluginCids: (recipe) => resolveNodeIslandPluginCids({
        islandBlobs: assembly.islandHandle.doc()?.blobs,
        recipe,
        lookup:      nodeOfferingLookup(crossroadsOfferingsHandle?.doc()),
        readBytes:   (cid) => readCasBlobFromFs(cid, casDir),
      }),
      diskMirrorGrant,
      onWorkerEvent: (wikiId, msg) => {
        if (msg.type !== "event") return;   // a camera's frame or answer from an island outside any session has no ring to ride on this vessel
        eventBus.enqueueToRing("vm-ring", "worker.event", { wikiId, listenable: msg.listenable, payload: msg.payload });
      },
      onEa: (wikiId) => { void mailbox.drain(wikiId); },   // breath → parked verbs deliver
    });

    // Wire the pool through the SHARED residency factory: resolveWikiSpec (the UNKNOWN-grain
    // branch of the true multi-wiki swap) + the activation-on-reference cap (node's full grant)
    // + the sovereign-worker residency binding (daemon evict routes THROUGH the ONE collector) +
    // wiki-alert delivery (the resolver-as-activator single-flight orchestration; node's hook
    // parks an undeliverable alert durably). The pool + the mailbox drain key a slot by its BARE
    // SLUG (`slotActiveWikiId = sel.slug`; `onEa(wikiId) → mailbox.drain`), and the shared wiring
    // keys the alert on that same bare slug — never `${hostId}:${wikiSlug}`, which would fork the
    // keyspace and silently lose every alert.
    wikiActivation = residencyWiring.wireToPool({
      daemon:        daemonVm,
      pool:          vmManager,
      coreHash:      assembly.coreHash,
      islandUrl:     assembly.islandHandle.url,
      catalogHandle: assembly.catalogHandle,
    });
    return vmManager;
  };

  // After live: settle boot pinning after every island has reached live.
  const afterLive: VesselOrchestration<VesselIslandPool>["afterLive"] = ({ wikiHandle: _wikiHandle }) => {
    // Boot DEMOTED to a pin. The daemon island stays always-live on its own (never
    // pooled, never collected — the "daemon bag always there"). The home wiki (the ONE
    // rotatable user pin BESIDES the daemon bag; a resource-rich node MAY hold up to
    // pinBudget more) registers in the ONE collector as a PINNED `wiki` grain —
    // exempt from collection. Everything else activates on reference through the cap.
    // mountPrimaryWiki already mounted + spec-retained it, so onHydrate → ensureWiki
    // sees it live and no-ops (idempotent). Rotation = unpin the old, pin the new.
    if (slotActiveWikiId) void residency.pin(slotActiveWikiId, "boot:home-wiki", "wiki");
  };

  const orchestration: VesselOrchestration<VesselIslandPool> = {
    keel, wikiSlot,
    // The shared cap composer resolves the slot first → it calls openDaemon with slot PRESENT; the
    // wrapper bridges the required-slot field to the optional-slot impl the herm caps share.
    openDaemon: ({ assembly, slot }) => openDaemon({ assembly, slot }),
    wireVerbs, afterDaemon, makePool, afterLive,
  };

  return {
    repo, storeClaim, catalogHandle, placeSigner, nexusPubkey, floorGates, carriagePull, wornFace: wornGateFace,
    vesselGateKey:   vesselIdentity.verifyingKey,
    daemonDocUrl:    () => bootstrap?.daemonUrl ?? "",
    hearthDaemonUrl: () => (bootstrap as { hearthDaemonUrl?: string | null } | undefined)?.hearthDaemonUrl ?? null,
    // EVERY carried face's own plane, each reached by the group that face's sealed anchors name: a name of one
    // face lands on that face's plane and on no other's.
    personaSelves:   () => (personaSelves ??= provenPlanes.size > 0
      ? repoPersonaSelvesPlane(repo, [...provenPlanes].map(([personaGroupId, url]) => ({ personaGroupId, url })), async () => {
          const faces: { handleIndex: number; personaGroupId: string }[] = [];
          for (const handleIndex of await listAnchoredPersonas()) {
            const anchors = await loadIdentityAnchors(handleIndex);
            if (anchors) faces.push({ handleIndex, personaGroupId: anchors.personaGroupId });
          }
          return faces;
        })
      : null),
    // A thunk: the dial's gate key settles before any act runs. No walk dial re-presents in the daemon, so a taken
    // walk dials at the next stand.
    walkDial: { dialGate: () => joinGatePubKey?.toLowerCase() ?? null, represent: null },
    // A roll lands on THIS Repo, the replica this hearth's walkers sync, and the refold serves the hosting doc it opened.
    hostingDoor: { withRepo: (act) => act(repo), rolled: async (nexusAid) => { await awaitOnRolled(afterRoll(nexusAid)); } },
    // THE CUT'S FOUR READS (custody#/the-cut). Each reads live when a cut asks: the face this composition mounts
    // lit, this vessel's own edge on that face's fleet board (the reading the dyad door serves the island), the
    // island's memory section under the vessel's own signed ask, and the face's key history off the local board.
    sessionDoor: nodeSessionDoor({ pin: () => dialPinNow, sealHome, onLog: (line) => console.log(`[session] ${line}`) }),
    backupDoor: {
      wornFace: () => litFace,
      ownEdgeShadowed: async () => {
        if (!wornFleetRoot) return false;
        for (let tries = 0; tries < 3 && !shadowRing.fold(); tries++) {
          try { await shadowRing.refold(); } catch { return true; }
        }
        const standing = shadowRing.deviceStanding(wornFleetRoot, activeAtom?.key ?? "");
        return standing === "aside" || standing === "unknown";
      },
      // Null while no daemon island stands, so a cut there refuses `memory-unavailable` by name.
      get cutMemory() {
        if (!daemonVm) return null;
        const vm = daemonVm;
        return async (to: Uint8Array) => {
          // The cut read this vessel's shadow at its entry; the ask says so, and the holder reads none of its own.
          const out = await askIslandMemory({
            daemonHandle: vm.daemonHandle, placeVerb: (o) => vm.placeVerb(o), act: "cut",
            facts: { to: Buffer.from(to).toString("hex"), shadow: MEMORY_CUT_SHADOW_READ },
            vesselKey: activeAtom?.key ?? "", sign: (image) => {
              if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
              return activeAtom.sign(image);
            },
          }).answer;
          const holds = Array.isArray(out["holds"]) ? out["holds"] as Array<{ bagId: string; founding: string; keyVersion: string }> : [];
          if (typeof out["section"] !== "string") throw new Error("the island answered no memory section");
          return { section: out["section"], holds };
        };
      },
      kel: (prefix) => readLocalPersonaKelChain(repo, prefix),
      // THE IMPORT'S TWO ASKS (custody#/the-restore), each signed as the vessel: the island names a door for one
      // import, then takes the section beside its pair's secret half sealed to that door.
      get memoryDoor() {
        if (!daemonVm) return null;
        const vm = daemonVm;
        return async () => {
          const out = await askIslandMemory({
            daemonHandle: vm.daemonHandle, placeVerb: (o) => vm.placeVerb(o), act: "door", facts: {},
            vesselKey: activeAtom?.key ?? "", sign: (image) => {
              if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
              return activeAtom.sign(image);
            },
          }).answer;
          if (typeof out["door"] !== "string" || !/^[0-9a-f]{64}$/.test(out["door"])) throw new Error("the island named no door");
          return Uint8Array.from(Buffer.from(out["door"], "hex"));
        };
      },
      get importMemory() {
        if (!daemonVm) return null;
        const vm = daemonVm;
        return async (section: string, sealedSecret: string) => {
          const out = await askIslandMemory({
            daemonHandle: vm.daemonHandle, placeVerb: (o) => vm.placeVerb(o), act: "import", facts: { section, secret: sealedSecret },
            vesselKey: activeAtom?.key ?? "", sign: (image) => {
              if (!activeAtom) throw new Error("this face holds no atom; re-found or re-admit it");
              return activeAtom.sign(image);
            },
          }).answer;
          return Array.isArray(out["results"]) ? out["results"] as Array<{ bagId: string; keyVersion: string; outcome: string; cause?: string }> : [];
        };
      },
    },
    residency, carriageRelay, nexusDial, bulb, emit, orchestration,
    siblingChannel:   () => siblings?.status() ?? null,
    openDaemon, wireVerbs, afterDaemon,
    realmStanding:    async () => (realmPlane ? await realmPlane.standing() : new Map()),
    daemonVm:         () => daemonVm,
    eventBus:         () => eventBus,
    slotActiveWikiId: () => slotActiveWikiId,
    activeWikiSource: () => activeWikiSource,
    teardown,
  };
}

/**
 * Open the FULL node Lararium — composeLararium's #has-cap-stack runs the shared keel sequence
 * (substrate → wiki-slot → daemon → verbs → wiki → pool → daemon-first ea-gate → primary-wiki mount
 * → live). Behaviour stays identical to the pre-cap-stack boot; the only change is the composed wrap.
 */
export async function openNodeVessel(opts: NodeVesselOptions): Promise<NodeVesselResult> {
  const p = await prepareNodeBoot(opts, "lararium");
  // A composition that refuses past its prep stands down whole, so its store name and its listeners never outlive it.
  try {
    return await composeNodeVesselOn(opts, p);
  } catch (e) {
    await p.teardown();
    throw e;
  }
}

async function composeNodeVesselOn(opts: NodeVesselOptions, p: NodeBootPrep): Promise<NodeVesselResult> {
  // A Lararium is a hearth that is ALSO a first-class mesh-node: when self-announce params are supplied,
  // it composes the carriage (meshpalace + carriage) ALONGSIDE the wiki-full core — it carries + navigates
  // the FLOW-map for its own routing (carry-without-reserve; no second read-face, no conflict over the oracle doc).
  const carriageCaps = opts.meshSelf ? carriageStack({
    repo:        p.repo,
    self:        { ...opts.meshSelf, gatePubKey: p.vesselGateKey },
    cadenceKey: p.vesselGateKey,
    pullFlow:  p.carriagePull,
    ...(p.residency ? { residency: p.residency } : {}),
    onLog: (l) => console.log(`[lararium] ${l}`),
  }) : [];

  // ── The WHO plane at the ANCHOR — resolve this island's own board; announce NOTHING ──
  // The identity twin of the browser leaf's whoFaceCap, the SAME cap composed by the SAME contract: the node
  // anchors the confederation, so its gate key scopes the board its leaves resolve, and both vessels layer the
  // one crossroads-advertised doc. The node already REGISTERS the crossroads plane into the oracle plane for its leaves to find;
  // composing here makes it RESOLVE that board too, so a hearth RECOGNISES the peers it federates with instead
  // of carrying a WHO plane it can only advertise. Unconditional — an anchor always holds its own island key
  // (unlike a leaf, which needs a relay + gate before any board can sync).
  //
  // NO BOOT-TIME FACE: the cap takes no card and publishes nothing. Binding the vessel never announces the
  // identity; disclosure rides the component's deliberate `announce`, and the only key at boot would be this
  // vessel's substrate key — the one co-surface the two-key atom forbids on a social board.
  const crossroadsHandle = await materializeSharedLarDoc(p.repo, crossroadsDocUrl(p.nexusPubkey), "board:crossroads");
  // The role caps this hearth adds stand down with the composition: each built component is kept beside its own
  // disposer, and the teardown runs them backward before the prep stands down beneath them.
  const roleCaps: Array<() => void | Promise<void>> = [];
  const extraCaps = [
    ...carriageCaps,
    whoFaceCap({ repo: p.repo, crossroadsHandle, nexusPubkey: p.nexusPubkey, residency: p.residency }),
  ].map((cap) => ({
    ...cap,
    build: async (resolve: Parameters<typeof cap.build>[0]) => {
      const component = await cap.build(resolve);
      if (cap.dispose) roleCaps.push(() => (cap.dispose as (c: unknown) => void | Promise<void>)(component));
      return component;
    },
  }));
  const result = await composeLararium<VesselIslandPool>(p.orchestration, extraCaps);
  // THE PORCH ANSWERS FOR THE FLOOR: `/floor/<AID>` hands a stranger the release rows this board carries (each with its lineage),
  // and `/cas/<cid>` the blobs the head release names. A hearth with neither a dispatcher nor a server answers no porch.
  if (opts.httpServer || opts.dispatcher) {
    const porch = mountFloorPorch({
      ...(opts.httpServer ? { httpServer: opts.httpServer } : {}), ...(opts.dispatcher ? { dispatcher: opts.dispatcher } : {}), repo: p.repo,
      nexusPubkey: p.nexusPubkey, casDir: casDirForStorage(opts.storageDir), serveCas: true,
      onLog: (line) => console.log(`[lararium] ${line}`),
    });
    roleCaps.push(() => porch.dispose());
  }

  return {
    activeWikiId: p.slotActiveWikiId(),
    activeWikiSource: p.activeWikiSource(),
    pool: result.pool, repo: p.repo,
    ports: {
      place: (surface, binding, msg) => surface === "daemon" || !result.pool.has(surface)
        ? { ok: false, reason: "surface-unknown" } : result.pool.placePort(surface, binding, msg),
      close: (binding) => result.pool.closePortBinding(binding),
    },
    store: result.assembly.composite,
    daemon: p.daemonVm(),
    wikiDocUrl:       result.wikiHandle.url,
    catalogHandleUrl: p.catalogHandle.url,
    daemonDocUrl:     p.daemonDocUrl(),
    // A node hearth carries and serves its own face; when it was ADMITTED instead, its bootstrap names the
    // hearth it asks. Null here reads "this vessel IS the hearth", never "unknown".
    hearthDaemonUrl:  p.hearthDaemonUrl(),
    personaSelves:    p.personaSelves(),
    walkDial:         p.walkDial,
    hostingDoor:      p.hostingDoor,
    sessionDoor:     p.sessionDoor,
    backupDoor:      p.backupDoor,
    oracleDocUrl:     result.assembly.islandHandle.url,
    larariumDocUrl:   result.assembly.larariumHandle?.url ?? null,
    phase: "live",
    eventBus: p.eventBus(),
    // Graceful shutdown tears the pool down AND closes the crossroads + stops the client dial-out (Socket A), each a
    // no-op when none stood, so no timer / client socket leaks past close.
    stopTick: () => { void result.pool.disposeAll(); void p.carriageRelay?.close(); p.nexusDial?.stop(); },
    teardown: async () => {
      for (const down of roleCaps.splice(0).reverse()) {
        try { await down(); } catch (e) { console.log(`[lararium] teardown: a role cap — ${e instanceof Error ? e.message : String(e)}`); }
      }
      await p.teardown();
    },
    floorGates: p.floorGates,
    siblingChannel: p.siblingChannel,
    storeClaim: p.storeClaim,
    mountManifest: result.assembly.mountManifest,
  };
}

/**
 * Open a node Herm (Lares Viales) — composeHerm's wiki-LESS #has-cap-stack: substrate + the daemon
 * immune core + a writable meshpalace FLOW-map + the read-face that serves it. No wiki, no pool. The
 * The daemon boots WITHOUT a user wiki (its own bag = bootstrap.daemonUrl); registerBags omits the
 * absent wiki bags. Requires an HTTP server for the FLOW-map read-face.
 */
export async function openNodeHerm(opts: NodeVesselOptions): Promise<NodeHermResult> {
  if (!opts.httpServer) {
    throw new Error("[lararium] openNodeHerm requires opts.httpServer (the FLOW-map read-face serves over it)");
  }
  const p = await prepareNodeBoot(opts, "herm");
  try {
    return await composeNodeHermOn(opts as NodeVesselOptions & { httpServer: NonNullable<NodeVesselOptions["httpServer"]> }, p);
  } catch (e) {
    await p.teardown();
    throw e;
  }
}

async function composeNodeHermOn(
  opts: NodeVesselOptions & { httpServer: NonNullable<NodeVesselOptions["httpServer"]> }, p: NodeBootPrep,
): Promise<NodeHermResult> {
  // ── The WHO plane at a WAYFARER — recognition for a vessel that holds no face to lose ──
  // A Herm carries a Place DID and NO persona: there are no local human keys to steal at a crossroads. That
  // makes it the vessel with the least to risk and the most to gain from the board — it already recognises
  // BANS (the antigen ring rides its carriage), so reading the WHO plane completes the pair: it recognises
  // the presenters those bans name. The cap cannot betray the asymmetry, because it holds no card to publish.
  const hermCrossroads = await materializeSharedLarDoc(p.repo, crossroadsDocUrl(p.nexusPubkey), "board:crossroads");
  const herm = await composeHerm({
    extraCaps: [whoFaceCap({
      repo: p.repo, crossroadsHandle: hermCrossroads, nexusPubkey: p.nexusPubkey, residency: p.residency,
    })],
    keel:        p.orchestration.keel,
    openDaemon:  p.openDaemon,
    wireVerbs:   p.wireVerbs,
    afterDaemon: p.afterDaemon,
    repo:        p.repo,
    residency:   p.residency,
    httpServer:  opts.httpServer,
    ...(opts.dispatcher ? { dispatcher: opts.dispatcher } : {}),
    signer:      p.placeSigner,
    storageDir:  opts.storageDir,
    flowGates: p.floorGates,
    pullFlow:  p.carriagePull,
    ...(opts.meshSelf ? { meshSelf: { ...opts.meshSelf, gatePubKey: p.vesselGateKey } } : {}),
    ...(opts.pullIntervalMs !== undefined ? { pullIntervalMs: opts.pullIntervalMs } : {}),
    // Serve the HELD bulb by cid over the public floor (the OPEN path) — present only when the genesis stands.
    ...(p.bulb ? { bulb: p.bulb } : {}),
    // THE HERM RE-SHARE: `/cas/<cid>` serves a fleet peer's PUBLIC blob (landed write-through in its `cid/`) IFF the crossroads board — the public plane by construction — names the cid.
    publicCas: publicCasShore({
      casDir: casDirForStorage(opts.storageDir),
      references: () => Object.entries(hermCrossroads.doc()?.tiddlers ?? {}).map(([title, record]) => ({ title, bagId: CROSSROADS_DOC_URI, record: plainRecord(record) })),
      bagTier: (bagUrl) => (bagUrl === CROSSROADS_DOC_URI ? "public" : null),
      // THE REALM LANE: a Herm serves books it never authored, so its own crossroads alone withheld every
      // pointer a peer landed in a public bag. Each standing registration this realm carries names its book
      // and the tier it declared; the PUBLIC ones reach the shore, and the rest draw the same 404 as before.
      // THE ANNOUNCE ROAD rides beside it (2026-09-13): a Herm that imported a charter still folds NOTHING
      // through the registration road — the realm doc withholds its registrations from a carrier by design —
      // so the public plane it already replicates carries the address of every PUBLIC-tier book, and only
      // those, and the carrier learns which books it may carry BY HASH off the board alone.
      // THE FORK THIS ONCE NAMED STANDS RULED AND CURED. The operator ruled NEXUS-keyed boards (2026-09-13),
      // and `p.nexusPubkey` now resolves through `nexusIdentity`: a keeper and a carrier holding ONE charter
      // derive ONE island name (the charter's genesis epoch) and therefore ONE crossroads board, so the
      // announce lands where the carrier reads it. e2e ⑦ (`tests/e2e/herm-reshares-public-blob.e2e.test.ts`)
      // stands UNMEASURED against this cure. Its second half is independent and still owed:
      // the Herm holds no carriage CLIENT (it IS the relay), so nothing in the product ever makes it FETCH the
      // body, and the witness plants it by hand at ⑤b to isolate the index half from the byte half.
      releasedFloor: () => releasedFloorCids({ board: hermCrossroads.doc(), nexus: p.nexusPubkey, casDir: casDirForStorage(opts.storageDir) }),
      realmReferences: () => hermRealmShoreBooks({
        realmStanding: () => p.realmStanding(),
        findDoc:       async (docUrl) => (await p.repo.find<LarDoc>(docUrl as AutomergeUrl).catch(() => null))?.doc() ?? null,
        crossroadsDoc: () => hermCrossroads.doc(),
        onLog:         (line) => console.log(`[herm] ${line}`),
      }),
    }),
    onLog:       (line) => console.log(`[herm] ${line}`),
  });
  // A HERM CARRIES THE ANSWER AND SIGNS NOTHING: the same `/floor/<AID>` the hearth answers, from the board it replicates; its bulb
  // face already carries `/cas`, and the released-floor lane above lends it the head's blobs.
  const porch = mountFloorPorch({
    httpServer: opts.httpServer, ...(opts.dispatcher ? { dispatcher: opts.dispatcher } : {}), repo: p.repo,
    nexusPubkey: p.nexusPubkey, casDir: casDirForStorage(opts.storageDir), serveCas: false,
    onLog: (line) => console.log(`[herm] ${line}`),
  });
  p.emit("vessel-ready");
  p.emit("live");

  const dispose = async (): Promise<void> => {
    porch.dispose();
    setCasDoor(null);                // the fetch door closes with the vessel — a late worker ask reads a miss
    await p.carriageRelay?.close();  // tear the crossroads down first (a no-op when none stood) — no WS server leak
    p.nexusDial?.stop();            // stop the client dial-out (Socket A) — a no-op when none stood
    await p.daemonVm().shutdown();
    await herm.vessel.dispose();   // reverse build order → read-face disposes (clears the HTTP handler)
  };
  return {
    repo:             p.repo,
    store:            herm.assembly.composite,
    daemon:           p.daemonVm(),
    oracleDocUrl:     herm.assembly.islandHandle.url,
    catalogHandleUrl: p.catalogHandle.url,
    larariumDocUrl:   herm.assembly.larariumHandle?.url ?? null,
    phase:            "live",
    carriageRelayPort:       p.carriageRelay?.port ?? null,
    carriageRelayGatePubKey: p.carriageRelay?.gatePubKey ?? null,
    floorGates:       p.floorGates,
    storeClaim:       p.storeClaim,
    personaSelves:    p.personaSelves(),
    walkDial:         p.walkDial,
    hostingDoor:      p.hostingDoor,
    backupDoor:      p.backupDoor,
    mountManifest:    herm.assembly.mountManifest,
    dispose,
    teardown: async () => {
      try { await dispose(); } catch (e) { console.log(`[herm] teardown: ${e instanceof Error ? e.message : String(e)}`); }
      await p.teardown();
    },
  };
}
