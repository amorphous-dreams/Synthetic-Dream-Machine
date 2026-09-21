/**
 * openNodeVessel — local-first Node.js vessel factory.
 *
 * A thin opener over the composable-keel engine. Node supplies the platform atoms (NodeFS storage,
 * WS relay + DaemonAuthGate, worker_threads pool) and the capability pieces it holds (the inbound
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
import { join }                         from "path";
import type { Server }                  from "node:http";
import type { DocHandle, AutomergeUrl, DocumentId } from "@automerge/automerge-repo";
import { Repo }                         from "@automerge/automerge-repo";
import { DurableNodeFSStorageAdapter } from "./durable-storage-adapter.js";
import { NodeWSServerAdapter }          from "@automerge/automerge-repo-network-websocket";
import type { WebSocketServer }         from "isomorphic-ws";
import type {
  LarDoc,
  LarariumVesselOptions, VesselResult, LarOpenPhase,
  VesselBootstrap, VesselCoreAssembly,
  CompositeStore, DiskMirrorGrant,
} from "@lararium/mesh";
import {
  makeDurableMailbox, verifyingKeyFromDid,
  type DurableMailbox,
  emptyLarDoc, mutableLarRecord, tiddlerText,
  LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI, CROSSROADS_DOC_URI, recipeHostFacets,
  DAEMON_BAG_ID,
  BAG_IDS, slugFromUri, verbArgsFromPayload, registerCrossroadsInOracle,
  whoFaceCap, materializeSharedLarDoc, crossroadsDocUrl,
  makeRealmPlane, type RealmPlaneHolder, type RealmBagRegistration, type CapTier, ed25519SignerFromSeed,
  PERSONA_GROUP_DOC_ID_TIDDLER, PERSONA_GROUP_AGENT_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  SIGNER_DID_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER, type DeviceDelegationTiddler,
  ENGINE_CORE_ID, BagStowage, pluginCidsFromIslandBlobs,
  deriveRegisterBags, catalogNamedBags, personaBagIdFor, personaSiblingBagIds, readPersonaPlanes, mountedPlaneBagId, personaPlanesFault, type PlaneEntry,
  coupleMesh, crystallize, guardHitl,
  nexusIdentity, nexusScopeOrThrow, nexusIslandsBelow, realmIdOfCharter, type NexusIdentityAt,
  climbNexusBoards,
}                                       from "@lararium/mesh";
import type { WikiActivationCap } from "@lararium/mesh";
import { casDirForStorage, mirrorGenesisCasFs, installCasSweep, makeRealmPaceCell, readCasPins, composeCasTransits, hermCasTransitFromEnv } from "./node-cas.js";
import { realmMaintenanceFromBoard, shareConfigOf } from "@lararium/mesh";
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
import { makeSelfSlotPersonaGroupRing } from "./self-slot-persona-ring.js";
import {
  loadOrMaterializeOracle,
  reconcileWellKnownTiddlers, mintLaresIfAbsent, mintLarariumIfAbsent,
  readGenesisCasManifest, genesisProtectSet, genesisCasDir,
} from "./genesis-artifact.js";
import { repoRoot }                       from "@lararium/mesh/node";
import { daemonGenesisDir }               from "./lares-config.js";
import { orderHandleTurnsToStubs, type HandleTurn } from "@lararium/mempalace";
import { writebackWing, TelemetryUnavailable } from "@lararium/sensorium";
import { LarEventBusImpl, DEFAULT_RINGS, DeterministicFederationGate, federationPostureFromDoc, sealLineageHead, utf8Bytes, makeCidResolver } from "@lararium/mesh";
import { setCasDoor } from "./worker-handle.js";
import { writeCasEntriesFs } from "./node-cas.js";
import type { SparseFormVector, AntigenRing, FederationGate, FederationPosture, NexusMembership, PeerClass } from "@lararium/mesh";
import { selfSlotShareDecision } from "./self-slot-share.js";
import { makeAntigenRingHolder } from "./antigen-ring.js";
import { makePersonaKelRingHolder, carryPersonaKelUpTheGradient } from "./persona-kel-ring.js";
import { vesselDyads, DYAD_VEIL_TAG_TIDDLER } from "@lararium/mesh";
import { makeNexusMembership, makeRealmCharterConsult } from "./nexus-carriage.js";
import { readHearthDialPin } from "./hearth-dial-pin.js";
import { nodeNexusStandsAt } from "./nexus-standing.js";
import { runNexusRefresh } from "./nexus-refresh.js";
import { rollLeaseEpochOnBoard } from "./lease-rekey.js";
import { listSealedCids } from "./cas-reshare.js";
import { readBulbArtifact, type BulbArtifact } from "./bulb.js";
import { hermRealmShoreBooks, publicCasShore } from "./bulb-read-face.js";
import { readNexusDoc } from "./nexus-doc.js";
import { makeSealedPlaneRegistry } from "./plane-seal.js";
import type { NexusConvergenceKeyring } from "./nexus-convergence-keyring.js";
import { standNexusKeyring } from "./nexus-convergence-secret-store.js";
import { cadSealDir, sealCarrierForFederation } from "./seal-carrier-federation.js";
import { makeBagTracker } from "./bag-tracker.js";
import { startCarriageServeLoop, type CarriageServeLoop } from "./carriage-serve-loop.js";
import { startCarriageRelay, resolveRelayGateSeed, type CarriageRelay } from "./carriage-relay.js";
import { maybeStartNexusClientDial, type NexusClientDial } from "./nexus-client-dial.js";
import { loadLeafIdentity } from "./leaf-identity.js";
import { readCasBlobFromFs } from "./node-cas.js";
import { makeSourceCapture, type SourceCapture } from "./capture-source.js";
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
import { loadIdentityArchive, loadVeilArchive } from "./identity-anchors.js";
import { readWornPersonaMount } from "./worn-mount.js";
import { archiveOpens } from "./archive-passphrase.js";
import { openDaemonVm }                    from "./open-daemon-vm.js";
import {
  makeResidencyStatsReactor,
  makeVesselResidency, type VesselResidency,
  replayPinsFromDaemonDoc,
} from "@lararium/tw5";   // residency stats — the lone read that stays main-resident; the shared residency/pool-wiring factory
import { generateOrLoadVesselIdentity, loadVesselSigningSeed, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, listPersonaRoots } from "./node-vessel-identity.js";
import { DaemonAuthGate }                           from "./daemon-auth-gate.js";
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
  storageDir: string;
  wss:        WebSocketServer;
  catalogUrl?: string | null;
  /** Directory holding the BAKED GENESIS SEED (island + cas). The bootstrap no longer lives here. */
  genesisDir?: string;
  /** Repo root for wiki memes scan and all mirror paths. Defaults to monorepo root. */
  rootDir?: string;
  /** HTTP server the Herm's FLOW-map read-face serves over (required for openNodeHerm). */
  httpServer?: Server;
  /** This vessel's mesh standing — derived once via deriveMeshSelf. Present → it self-announces,
   *  self-peers, re-ranks by proximity + drifts r (a Lararium carries ALONGSIDE its wiki-full core; a
   *  Herm IS its carriage). Absent → a leaf that only carries what it pulls. */
  meshSelf?: MeshSelf;
  /** Carriage pull cadence (ms) — tuning, kept separate from membership. */
  pullIntervalMs?: number;
  /** The CARRIAGE-relay URL (Socket B, ciphertext) the vessel dials to serve sealed cad bodies to members.
   *  ABSENT (and `LAR_CARRIAGE_RELAY` unset) → NO carriage socket opens, NO serve-loop stands (provably inert). */
  carriageRelayUrl?: string;
  /** The carriage serve-loop poll cadence (ms) — how promptly a member's want-block draws a serve turn. */
  carriagePollIntervalMs?: number;
  /** STAND a carriage relay (Socket B, ciphertext CROSSROADS) so a family's hearths dial THIS vessel to carry sealed
   *  cad bodies between each other — the Herm's Lares-Viales role (a running Herm IS a crossroads). The port the
   *  relay BINDS (0 → an OS-assigned free port; a Pi deployment pins a stable one). ABSENT (and `LAR_HERM_RELAY_PORT`
   *  unset) → NO relay socket stands, boot behaves exactly as today (provably inert). SEPARATE from `carriageRelayUrl`
   *  (that DIALS a relay as a client; this STANDS one as the crossroads). */
  standCarriageRelayPort?: number;
  /** The relay's gate seed hex (32 bytes) — a dialing hearth binds its proof-of-possession to this key's PUBLIC half.
   *  ABSENT → derived from the vessel's OWN identity seed (stable across restarts, so hearths keep dialing the same
   *  key). NEVER a fresh random per boot. Only read when `standCarriageRelayPort` (or its env) is set. */
  standCarriageRelayGateSeedHex?: string;
  /** The peer node's `/ws` URL (Socket A, cleartext CRDT) this vessel DIALS to sync — the same-operator device
   *  breath. ABSENT (and `LAR_JOIN_SYNC` unset) → NO client adapter mounts, NO dial, zero change (provably inert). */
  joinSyncUrl?: string;
  /** The DIALED peer's gate verifying-key hex — the gate-binding the outbound V3 proof commits to (out-of-band,
   *  NEVER trusted from the wire). REQUIRED alongside `joinSyncUrl`; absent → fail-closed to inert (no dial). */
  joinGatePubKey?: string;
  /** OPTIONAL island/doc URL the dial-out `repo.find()`s once mounted — consumes the device-admit payload's
   *  `islandDocUrl`. Absent → the vessel syncs only docs it already knows. */
  joinDocUrl?: string;
  /** THE WIRE PROBE — an injectable sink over every share verdict this vessel answers and every sync message
   *  its Repo generates or receives. ABSENT (and `LAR_WIRE_LOG` unset) → nothing wraps the policy and nothing
   *  listens; the boot behaves exactly as it did (provably inert). A witness arms it to read WHERE a document
   *  enters or leaves a peer's sync session. */
  onShareVerdict?: ShareVerdictSink;
}

export interface NodeVesselResult extends VesselResult<VesselIslandPool, DaemonVmCore> {
  /** Started event bus — ingress rings registered; tick loop running at 20 Hz (node substrate). */
  eventBus:  LarEventBusImpl;
  /** Stop the N-accumulator tick loop (call on graceful shutdown). */
  stopTick:  () => void;
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
  /** The bound port the STOOD carriage relay (Socket B crossroads) listens on — `null` when no relay was configured
   *  (inert). The operator hands a hearth `ws://<host>:<port>` from this. */
  carriageRelayPort:       number | null;
  /** The stood carriage relay's gate verifying-key hex — the key a dialing hearth binds its proof to (out-of-band).
   *  `null` when no relay was configured. The operator hands a hearth this alongside the URL. */
  carriageRelayGatePubKey: string | null;
  /** Tear down the read-face + the daemon island, then the composed vessel (reverse build order). */
  dispose:          () => Promise<void>;
}

const blankMemeStore = (repo: Repo): (() => DocHandle<LarDoc>) =>
  () => repo.create<LarDoc>(emptyLarDoc());

/** The atoms + keel + boot closures both node cap-stacks compose over (built ONCE per boot). */
interface NodeBootPrep {
  repo:             Repo;
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
  /** This PLACE's own 32-byte signing seed — the substrate key, never the human's. The two-key atom keeps it
   *  distinct from the persona root a device-delegation edge signs under (`device-delegation.vesselSeed`). */
  vesselSeed:     Uint8Array;
  /** This vessel's own gate key — the node ANCHORS its confederation, so its gate key doubles as the Nexus
   *  key its browser leaves pass as relayGatePubKey. Every per-Nexus board (WHO, KEL, antigen) scopes to it. */
  nexusPubkey:      string;
  residency:        BagStowage;
  /** The carriage serve-loop (Socket B) — present ONLY when a carriage-relay URL was configured; else null (inert).
   *  The two vessel entry-points fold its `stop()` into their teardown so no timer / socket leaks past close. */
  carriageLoop:     CarriageServeLoop | null;
  /** The STOOD carriage relay (Socket B CROSSROADS) — present ONLY when a relay port was configured; else null
   *  (inert). A running crossroads a family's hearths dial to carry sealed cad bodies between each other. The two
   *  vessel entry-points fold its `close()` into their teardown so no WS server / peer socket leaks past close. */
  carriageRelay:    CarriageRelay | null;
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
}

/**
 * Build the shared node boot substrate: the platform atoms (repo + WS relay/gate, catalog, operator
 * identity, residency mechanism) + the keel + the VM-focused closures (wiki-slot, daemon,
 * verbs, pool, after-hooks). NO sequencing here — `composeLararium`/`composeHerm` wire the order.
 */
async function prepareNodeBoot(opts: NodeVesselOptions): Promise<NodeBootPrep> {
  const { wikiId, storageDir, wss, catalogUrl, onPhase, genesisDir, rootDir: rootDirOpt } = opts;
  const bootstrapPath = larBootstrapPath();   // <lares>/vessel — beside the docs it addresses
  // The hearth dial an admission pinned (null on a self-founded vessel — it IS the hearth).
  const hearthPin = readHearthDialPin(bootstrapPath);
  // THE FACE THE OPERATOR WORE. `persona wear N` moves ONLY the selector pointer; the daemon doc's singular
  // mount pins were written by the FOUNDING face and never move again, so a reboot re-mounted h0 whatever
  // mask was on. A worn non-founding face carries its own mount material in its anchors — the pins below
  // default to it. Null means no switch is owed (h0, nothing worn, or anchors without the material).
  const wornMount = await readWornPersonaMount(storageDir);
  if (wornMount) {
    console.log(`[persona] worn h${wornMount.handleIndex} — the mount re-pins from its OWN anchors; the founding face's pins name h0`);
  }
  const emit = (p: NodeOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── 1. Repo — NodeFS storage + WebSocket relay behind the DaemonAuthGate ─────
  const storage = new DurableNodeFSStorageAdapter(storageDir);
  const authGate = new DaemonAuthGate(wss);
  const network  = new ListeningWSServerAdapter(authGate as unknown as typeof wss);
  const peerIdentifierMap = new Map<string, string>();
  // The self-slot CLASS map — peerId → the class the keyholder vouched at admission. Populated in the
  // SAME microtask as peerIdentifierMap so that by the time the outer admission gate sees a peer in
  // peerIdentifierMap (its admit condition), the class is already keyed — no read-before-set window for
  // an admitted same-operator peer. A WS peer absent here (or present-but-not-same-operator) reads as the
  // stricter cross-operator class at the sharePolicy (fail-closed).
  const peerClassMap = new Map<string, PeerClass>();
  // The CONTRACT nym map — peerId → the persona-root nym the peer's contract edge proved at the gate. Keyed in
  // the same microtask; the membership consult reads it AHEAD of the raw wire key (the vessel key names a
  // device, the nym an operator — `nexus-carriage.ts`). Absent for every peer that presented no contract edge.
  const peerContractNymMap = new Map<string, string>();
  // THE CHARTER'S HEARTH, at the other end of a socket THIS vessel dialed. The realm's return lane reads it:
  // the operator pinned that gate key out of band and imported that hearth's charter, so the realm's own
  // registered books federate back toward it. Filled by the dial below; empty on a vessel that dials nobody.
  const charterHearthPeers = new Set<string>();
  network.on("peer-candidate", ({ peerId }: { peerId: string }) => {
    queueMicrotask(() => {
      const socket = (network.sockets as Record<string, unknown>)[peerId];
      if (socket) {
        const identHex = authGate.getIdentifierForSocket(socket as Parameters<typeof authGate.getIdentifierForSocket>[0]);
        if (identHex) peerIdentifierMap.set(peerId, identHex);
        const cls = authGate.getClassForSocket(socket as Parameters<typeof authGate.getClassForSocket>[0]);
        if (cls) peerClassMap.set(peerId, cls);
        const contractNym = authGate.getContractNymForSocket(socket as Parameters<typeof authGate.getContractNymForSocket>[0]);
        if (contractNym) peerContractNymMap.set(peerId, contractNym);
      }
    });
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
  // The REALM plane — the relation's shared CRDT (realm-bag-brief). Stood once the oracle plane loads and a
  // charter names a realm; INERT (null) on a vessel outside every relation. Its gate composes ATOP the
  // deterministic shelf: the realm doc and each steward-registered bag's doc federate to a MEMBER peer alone.
  let realmPlane: RealmPlaneHolder | null = null;
  // The nexus-doc MEMBERSHIP consult — the carry-split's member gate (a cross-operator MEMBER blind-transits a
  // sealed plane; a STRANGER reaches only the public shelf). Forward-declared (the sharePolicy closes over
  // it) and STOOD once the operator's own nym is loaded, below. Null keeps every cross-operator STRANGER
  // (public-read only) through the boot window — the fail-closed default (a node never assumes Nexus-pono).
  let nexusMembership: NexusMembership | null = null;
  // The per-Nexus federation POSTURE — read as-of-last-sync off the nexus doc. Default PRIVATE
  // (fail-closed): the pre-read boot window denies every cross-Nexus foreign operator co-federation. STOOD
  // once the operator's own nym + bags dir are known, below; a live posture-flip re-reads on membership refold.
  let federationPosture: FederationPosture = "private";
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
  // THE PER-NEXUS CONVERGENCE KEYRING — the SOURCE the cad seal message-locks against (fork-② = A2, operator-
  // ruled 2026-07-21). Forward-declared null and STOOD once the operator's own nym + the charter epoch are known:
  // the private-lane admission handoff (the SAME lane the read-caps ride, below) delivers the `{epoch → secret}`
  // keyring; `makeNexusConvergenceKeyring(entries)` stands it here. A null keyring keeps the boot window — and any
  // member never handed a keyring — FAIL-CLOSED: `installSealedBody` reads `keyring.current()`, which throws on an
  // absent/empty keyring, so the body stays local/unsealed (never a plaintext body registered sealed). The
  // custody + distribution of that keyring over the private lane is the admission shore this name marks; it does
  // NOT stand a Nexus-scope CGKA group (the exporter north-star, deferred — see nexus-convergence-keyring.ts).
  // The admission-delivery wiring RIDES THE PERSISTED STORE: `openAdmitFlow` (persona-admit) opens the founder's
  // sealed keyring envelope and `installDeliveredKeyring` writes the founder's `{epoch → secret}` set into THIS
  // vessel's identity home AUTHORITATIVELY (the delivered secret supersedes a self-minted phantom). `standNexusKeyring`
  // below reads that persisted set FIRST (minting only an absent head epoch), so the delivered keyring becomes the
  // one BOTH `cad-seal` (the seal producer) and any keyring-read path resolve — every path threads this ONE variable.
  // NO-GLOBAL-NOW: an admission that lands out-of-process reaches THIS running vessel at its next stand of the store.
  let nexusConvergenceKeyring: NexusConvergenceKeyring | null = null;
  const repo = new Repo({
    storage,
    network: [network],
    // Two rings: WS peers (outside) must have passed the DaemonAuthGate; the
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
    // ONE VERDICT, BOTH HOOKS. A legacy `sharePolicy` fills automerge-repo's ANNOUNCE hook alone and leaves
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
      // OUTER peer-admission gate (unchanged): a WS peer that never passed the DaemonAuthGate is not in
      // `peerIdentifierMap` → deny; an in-process island peer (no WS socket) is a house member → admit.
      if (wsSocket && !peerIdentifierMap.has(peerId)) return false;
      // THE SELF-SLOT SPLIT — federatable-own vs private-own, keyed on the class the keyholder vouched
      // (selfSlotShareDecision holds the whole law + fail-closed default). A same-operator WS peer and
      // every in-process island peer full-sync; a cross-operator/unclassified WS peer reaches only the
      // deterministically-federatable planes; the antigen draws Mu on a Kapae'd presenter regardless.
      return selfSlotShareDecision({
        hasWsSocket:     !!wsSocket,
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
        // THE POSTURE OUTER GATE — PRIVATE (default) denies a cross-Nexus (non-member) foreign operator ALL
        // co-federation; OPEN lets a proof-carrying foreign operator reach the public shelf (never a private plane).
        federationPosture,
        peerId,
        documentId: documentId as DocumentId | undefined,
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
      doc.tiddlers[CATALOG_DOC_URI] = mutableLarRecord(CATALOG_DOC_URI, { text: h.url }, "lararium-seed");
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
  const vesselIdentity = await generateOrLoadVesselIdentity();
  const vesselSeed     = await loadVesselSigningSeed();

  // ── The #59 antigen ring — STOOD now the island this vessel stands in is resolved ─────────────
  // The board keys on the ISLAND (`nexusPubkey` below), never on this vessel: the deterministic
  // antigen-board id is a pure function of it, so every member of one Nexus folds ONE board. The
  // holder resolves the always-carried antigen board, folds the quorum-signed bans against the
  // founding-kahu roster read off `bags/nexus` (LAR_BAGS ?? <root>/bags), and re-folds on every board
  // change. FAILS CLOSED: an unseated charter → empty roster → nothing Kapae'd (no quorum, no bans).
  // The Nexus SEAL homes PER-OPERATOR (`<lares>/nexus`), never in the corpus bags tree: a seal sited in the
  // corpus inherits that tree's home, which on a development install sits inside the repository. The seal
  // belongs to the operators who founded it, so it survives every substrate wipe beside the sovereign root
  // and travels with neither a clone nor a `reset`.
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
  //   · the EDGE-KĀPAE and ANTIGEN boards CARRY, and the CROSSROADS board RE-ANNOUNCES, at the one door
  //     `climbNexusBoards` opens beside that seam. Both carried boards fail OPEN when they mint blank (an
  //     empty shadow board lowers every shadow; an empty antigen re-admits a Kapae'd presenter), which is why
  //     "degrades gracefully" holds for neither.
  //   · WHO · carriage · vouch stay exactly where they are — `nexus-board-climb`'s header states each reason.
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

  // Stand the nexus-doc membership consult now the operator's own verifying key is loaded — the carry-split's
  // member gate. It reads the SAME `bags/nexus` charter roster the antigen folds against (the seated-kahu
  // keys as the conservative provable-member floor; see nexus-membership for the surfaced carriage-contracts board
  // fork) and resolves a peerId → nym off the same proven `peerIdentifierMap`. FAILS CLOSED: an unseated
  // charter → empty member set → every cross-operator STRANGER (public-read only), never a false member.
  // Fold the members BOARD (repo + nexusPubkey) atop the kahu floor — this LIGHTS SELF-SLOT-B: a general
  // contracted operator (members{}, not a kahu) now reads MEMBER, so the carry-split's member lane names it.
  // Keep the HOLDER (not just its `.membership` consult): the `nexus-refresh` main verb calls its
  // `refoldWithBoard` to re-fold the member union against an out-of-process CLI board write.
  // RE-VERDICT. The Repo caches its share verdict per (doc, peer) at the peer's admission; every live change to
  // what that verdict reads — the member set, the posture, the antigen, a realm registration — must ask the Repo
  // to read it again, or a member contracted AFTER its socket stood keeps drawing DENIED (measured: B's realm doc
  // arrived empty while A's board named her). `shareConfigChanged` re-evaluates every doc for every peer.
  const reverdict = (): void => { try { repo.shareConfigChanged(); } catch { /* the repo may be closing */ } };
  const nexusMembershipHolder = makeNexusMembership({
    sealHome,
    peerIdentifierMap,
    peerContractNymMap,
    repo,
    nexusPubkey,
    onRefold:          reverdict,
  });
  nexusMembership = nexusMembershipHolder.membership;

  // Read the federation POSTURE off the nexus doc (as-of-last-sync). Default PRIVATE (fail-closed):
  // a cross-Nexus foreign operator co-federates ONLY when the operator flips the Nexus open. A live flip needs
  // a re-read (surfaced gap — boot-time read for alpha; the CLI `lares nexus posture` edits the doc).
  const nexusDocForBoot = readNexusDoc(sealHome);
  federationPosture = federationPostureFromDoc(nexusDocForBoot);

  // Read the HELD bulb off the genesis dir, EPOCH-PINNED to the charter chain-head — the ALL-PUBLIC cold-boot
  // snapshot a Herm serves so a stranger kindles their OWN sovereign hearth (serve fire, never key). Null when the
  // genesis is absent (nothing to hand). Read once at boot; the corm-lease pointer re-issues on the read-face breath.
  const bulb: BulbArtifact | null = readBulbArtifact(genesisDir ?? defaultGenesisDir(), nexusDocForBoot?.sealEpochCid ?? null, bootstrapPath);

  // STAND THE cad CONVERGENCE KEYRING — the cad seal's key source, minted for THIS vessel's charter-head epoch
  // (genesis = 0 when unseated) and persisted local (read-all). This fills the forward-declared shore: the vessel
  // now HOLDS a keyring, so the seal producer (`cad-seal`) can message-lock a carrier body's ciphertext. It seals
  // the vessel's OWN staged bodies for the FEDERATION plane; STAGE-2 admission delivery hands this keyring to a
  // joinee so a member reads too. FAIL-CLOSED elsewhere holds: absent this stand, `keyring.current()` throws and
  // the seal producer keeps a body cleartext-local (never plaintext sealed).
  const sealHeadEpoch = sealLineageHead(nexusDocForBoot)?.epoch ?? 0;
  nexusConvergenceKeyring = standNexusKeyring({ sealEpoch: sealHeadEpoch });
  // The relay-side discovery index the seal producer announces a sealed cid onto (DHT-free; hint → peers → tracker).
  const casBagTracker = makeBagTracker();

  // Stand the self-slot federation gate on the SAME island scope the antigen board derives from — a gate
  // keyed elsewhere would refuse the very boards this vessel is meant to federate. Its federatable surface is a PURE function of that scope
  // (crossroads plane · WHO · kapae-antigen board — deny-by-default for every other doc), so a cross-operator
  // peer reaches exactly the always-carried public/infra planes and nothing private. No hand-maintained
  // allow-list; the private planes (catalog/personal/daemon/home/wikis) fall outside the set → DENY.
  selfSlotFedGate = new DeterministicFederationGate(nexusPubkey);

  // ── The CARRIAGE serve-loop (Socket B, ciphertext) — INERT until a carriage-relay URL rides the config ──────
  // When configured, the vessel dials the carriage relay over an authenticated WS channel (proving `vesselSeed`)
  // and serves members' want-blocks for sealed cad bodies on a poll interval. The gate stays `serveCasWire`'s own
  // `carrierShareDecision` VERBATIM: a proven MEMBER over a provably-sealed plane carries the ciphertext; a
  // STRANGER / non-member / Kapae'd draws byte-identical Mu. Carry ⊥ read — the read-cap never rides this shore.
  // Socket B stays SEPARATE from the Automerge `/ws` relay (Socket A): cleartext CRDT never routes through here.
  // ABSENT the URL → this branch never runs, so no socket opens and boot behaves exactly as it did before.
  const carriageRelayUrl = opts.carriageRelayUrl ?? process.env["LAR_CARRIAGE_RELAY"] ?? null;
  // THE FLEET CLASS on Socket B (basket-one #/the-fetch-door). A peer proves its vessel key on the carriage
  // channel; it reads FLEET when the SAME key stands on Socket A as a `same-operator` peer (the keyholder vouched
  // its signed device edge at admission — `peerClassMap`), or when it names the vessel THIS one dialed under
  // its own admit (`LAR_JOIN_GATE` — the founder a joinee stood by). A CONTRACT member never reads fleet.
  const fleetJoinGate = (opts.joinGatePubKey ?? process.env["LAR_JOIN_GATE"] ?? hearthPin?.gatePubKey ?? "").toLowerCase();
  const isFleetPeer = (peerKey: string): boolean => {
    const nym = peerKey.slice(-64).toLowerCase();
    if (fleetJoinGate && nym === fleetJoinGate) return true;
    for (const [peerId, identHex] of peerIdentifierMap) {
      if (identHex.slice(-64).toLowerCase() === nym && peerClassMap.get(peerId) === "same-operator") return true;
    }
    // Refused, said aloud: a cleartext ask from a peer the gate cannot read as fleet. The peers as this vessel
    // holds them (nym tail · class) so an operator can see WHY the door stayed shut.
    const seen = [...peerIdentifierMap].map(([pid, ih]) => `${ih.slice(-64).slice(0, 8)}…/${peerClassMap.get(pid) ?? "unvouched"}`).join(" ");
    console.log(`[carriage] fetch door: ${nym.slice(0, 8)}… reads NOT fleet (socket-A peers: ${seen || "none"}; join-gate: ${fleetJoinGate.slice(0, 8) || "none"})`);
    return false;
  };
  /** The holders a fetch asks, DHT-free: the fleet peers this vessel stands with right now. */
  const fleetHolders = (): readonly string[] => {
    const out = new Set<string>();
    if (fleetJoinGate) out.add(fleetJoinGate);
    for (const [peerId, identHex] of peerIdentifierMap) {
      if (peerClassMap.get(peerId) === "same-operator") out.add(identHex.slice(-64).toLowerCase());
    }
    return [...out];
  };
  const carriageLoop: CarriageServeLoop | null = carriageRelayUrl
    ? startCarriageServeLoop({
        relayUrl:     carriageRelayUrl,
        vesselSeed: vesselSeed,
        serverAddr:   vesselIdentity.verifyingKey,
        deps: {
          cadDir:     cadSealDir(storageDir),
          cidDir:     casDirForStorage(storageDir),
          fleet:      isFleetPeer,
          seal:       sealRegistry.seal,
          membership: nexusMembership,
          antigen:    antigenRing,
          fedGate:    selfSlotFedGate,
        },
        ...(opts.carriagePollIntervalMs !== undefined ? { pollIntervalMs: opts.carriagePollIntervalMs } : {}),
        // HEAL — on a RE-connect after a drop, re-fold the antigen + members boards + posture the vessel read
        // as-of-its-last-sync (a peer's bans/admits that landed during the partition). The SAME refold the
        // `nexus-refresh` verb runs; here it fires automatically when the carriage transport re-dials.
        onReconnect:  async () => {
          await runNexusRefresh({
            storageDir, sealHome, nexusPubkey,
            antigen: antigenHolder, membership: nexusMembershipHolder,
            setPosture: (p) => { federationPosture = p; },
          });
          await realmPlane?.refresh(readNexusDoc(sealHome));
          reverdict();
        },
        onLog:        (line) => console.log(`[carriage] ${line}`),
      })
    : null;

  // ── The CARRIAGE relay (Socket B, ciphertext CROSSROADS) — INERT until a relay port rides the config ─────────
  // A running crossroads a family's HEARTHS dial (`ws://<host>:<port>`) to carry sealed cad bodies between each
  // other — the Herm's Lares-Viales role. The relay CARRIES opaque ciphertext envelopes, stamps each `from` with the
  // sender's PROVEN Ed25519 key, and holds the DHT-free bag-tracker HINT index — it reads NO plaintext, holds NO
  // read-cap / keyring / roster (carry ⊥ read ⊥ contract), so a compromised crossroads leaks nothing. Its gate seed
  // derives from the vessel's OWN identity seed (or a configured seed) — STABLE across restarts, NEVER fresh-random,
  // so hearths keep dialing the same key. This CROSSROADS (a stood WS server) SEPARATES from both the Automerge `/ws`
  // relay (Socket A, cleartext CRDT) and the client-side carriage serve-loop dial above. ABSENT the port → this
  // branch never runs, so no socket opens and boot behaves exactly as it did before (provably inert).
  const relayPortRaw = opts.standCarriageRelayPort ?? process.env["LAR_HERM_RELAY_PORT"];
  const relayPort = relayPortRaw !== undefined && relayPortRaw !== "" ? Number(relayPortRaw) : null;
  const relayGateSeed = resolveRelayGateSeed(vesselSeed, opts.standCarriageRelayGateSeedHex ?? process.env["LAR_HERM_RELAY_SEED"]);
  const carriageRelay: CarriageRelay | null = relayPort !== null && !Number.isNaN(relayPort)
    ? await startCarriageRelay({ gateSeed: relayGateSeed, port: relayPort })
    : null;
  if (carriageRelay) {
    console.log(`[carriage] crossroads relay standing — ws://<host>:${carriageRelay.port} · gate ${carriageRelay.gatePubKey}`);
  }

  // ── THE FETCH DOOR, vessel side — `makeCidResolver(localRead, casTransit, cacheWriteThrough)` ──────────────
  // Fetch-on-read is the default: a read that misses the local `cid/` asks the fleet holders over Socket B, the
  // bytes verify against the cid's own class, and the verified body lands write-through in `cid/`. Every worker
  // (the daemon island, each wiki island) reaches this ONE door through `cas:want`. No carriage channel → the
  // door answers every ask with a miss (PENDING stays PENDING; a dead upstream faults nothing).
  const cidDir = casDirForStorage(storageDir);
  const resolveCidThroughDoor = carriageLoop
    ? makeCidResolver(
        (cid) => readCasBlobFromFs(cid, cidDir),
        composeCasTransits(carriageLoop.transit(fleetHolders), hermCasTransitFromEnv()),   // the fleet first; the Herm's public shore (`LAR_HERM_SHORE`) after — a dark peer's public bytes still arrive by the crossroads
        (cid, bytes) => { writeCasEntriesFs([{ cid, bytes }], cidDir); },
      )
    : async (cid: string) => readCasBlobFromFs(cid, cidDir);
  setCasDoor(resolveCidThroughDoor);
  if (carriageLoop) console.log(`[carriage] fetch door open — fleet holders ${fleetHolders().length} · cid/ ${cidDir}`);

  // ── The CLIENT dial-out (Socket A, cleartext CRDT) — INERT until a peer sync URL + gate key ride the config ──
  // When configured, the vessel mounts a `LarWSClientAdapter` carrying the operator's OWN leaf identity onto the
  // running Repo and DIALS the peer node's `/ws`, so a same-operator second device syncs the private planes both
  // ways (the peer's gate vouches it `same-operator`; `selfSlotShareDecision` opens full sync). The dial rides the
  // Automerge `/ws` relay (Socket A) — the SAME transport the server adapter answers on, SEPARATE from the carriage
  // relay (Socket B). REAL crypto: the outbound proof binds to the peer's gate key (out-of-band, never the wire) and
  // carries the operator's own identity, never a forged one. ABSENT the config → no adapter, no dial, no change.
  /** Does THIS vessel hold the persona root that signed `edge`? True names a self-founded operator's own edge
   *  (a contract credential toward any other hearth); false names an admit edge some hearth's root issued. */
  const holdsRootOf = async (edge: DeviceDelegationTiddler): Promise<boolean> => {
    let signer: string;
    try { signer = verifyingKeyFromDid(edge.personaRootDid).toLowerCase(); } catch { return false; }
    for (const index of await listPersonaRoots()) {
      const key = await loadPersonaGroupRootVerifyingKey(index);
      if (key && key.toLowerCase() === signer) return true;
    }
    return false;
  };
  // THE PINNED EDGE'S HEARTH IS THE DIAL'S DEFAULT. A joinee founded by an admit edge carries the hearth's sync
  // url + gate key in its bootstrap (hearth-dial-pin.ts); an explicit option / `LAR_JOIN_*` still wins, and a
  // vessel holding no pin and no env dials nobody — byte-identical to before.
  const joinSyncUrl    = opts.joinSyncUrl    ?? process.env["LAR_JOIN_SYNC"] ?? hearthPin?.syncUrl    ?? null;
  const joinGatePubKey = opts.joinGatePubKey ?? process.env["LAR_JOIN_GATE"] ?? hearthPin?.gatePubKey ?? null;
  const joinDocUrl     = opts.joinDocUrl     ?? process.env["LAR_JOIN_DOC"]  ?? null;
  // The operator's OWN light leaf identity (cached ContactCard + bare-Ed25519 signer). A missing card (never
  // `lares vessel found`-ed) → skip the dial rather than crash the boot (fail-open to inert; a dial needs a real card).
  let nexusDial: NexusClientDial | null = null;
  // The dial itself fires in `openDaemon`, once the daemon doc is read — the identity it presents carries this vessel's OWN
  // device-delegation edge (the one `vessel found --admit` seated), so the peer's keyholder vouches it
  // `same-operator` (the FLEET class every same-operator door reads) rather than the cross-operator floor.

  // ── Main-resident residency MECHANISM (sovereign-worker: policy in the worker,
  //    mechanism here). onEvict commands the pool via the forward `vmManager` ref. ──
  let vmManager!: VesselIslandPool;        // set in makePool
  let wikiActivation!: WikiActivationCap;  // set in makePool — the activation-on-reference cap
  let mailbox!: DurableMailbox;            // set in makePool — the durable park/drain lane (node-only capability)
  let daemonVm!:   DaemonVmCore;           // set in openDaemon
  let eventBus!:  LarEventBusImpl;         // set in makePool
  let bootstrap!: VesselBootstrap;         // captured in loadGenesis
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

  // Read the daemon doc (idempotent re-resolve; openDaemonVm finds the same handle).
  const readDaemonDoc = async (): Promise<DocHandle<LarDoc>> =>
    resolveBootDoc<LarDoc>(repo, bootstrap.daemonUrl as AutomergeUrl,
      // THE BOOTSTRAP NAMES THIS DOC, so an absence here reads as a write still landing rather than as
      // a doc nobody wrote — a founding seeds it moments earlier in this same process.
      { tideline: "hearth-private", label: "@daemon", expectPresent: true });

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

      // lares + lararium system-bag mint — operator(admin) office, node home
      // only. Both pointers ride the oracle system plane (the island doc);
      // oracle island, lararium bag and lares bag stand as three separate docs. The corpus doc
      // starts empty; LOAD/ingest fills it.
      mintLaresIfAbsent(repo, islandHandle);
      mintLarariumIfAbsent(repo, islandHandle);

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
      if (!manifest) {
        throw new Error(
          `[openNodeVessel] genesis seed absent or malformed — re-run build:genesis`,
        );
      }
      const casWritten = mirrorGenesisCasFs(manifest, genesisCasDir(genesisDir), casDirForStorage(storageDir));
      if (casWritten > 0) console.log(`[openNodeVessel] fs CAS: mirrored ${casWritten} blob(s) by CID from genesis/cas`);

      // Bootstrap URLs: the vessel's own social bootstrap (init node — authoritative),
      // falling back to the island oracle (replica vessels).
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
      const id   = islandHandle.doc()?.tiddlers;
      const daemonUrl      = bootstrapTiddlers[DAEMON_BAG_ID]?.text       ?? tiddlerText(id?.[DAEMON_BAG_ID])       ?? null;
      // THE ONE RESOLUTION POINT on this platform. The vessel reads back the whole FAMILY of compartments
      // it carries, then resolves the gesture — "the one I stand in" — to that plane's absolute name.
      // Every reader downstream carries the name; none receives the gesture.
      const planeEntries: PlaneEntry[] = [
        ...Object.entries(bootstrapTiddlers).map(([title, t]) => ({ title, text: t?.text ?? null })),
        ...Object.entries(id ?? {}).map(([title, rec]) => ({ title, text: tiddlerText(rec) })),
      ];
      const personaPlanes  = readPersonaPlanes(planeEntries);
      // A family that could shadow itself never boots. One group entered twice derives ONE bag id and
      // would mount a second writable layer over the first — the same silent shadowing the one-face law
      // exists to prevent, arriving through a merge rather than a switch.
      const planesFault = personaPlanes.length ? personaPlanesFault(personaPlanes) : null;
      if (planesFault) throw new Error(`[lararium] the PersonaGroup planes this vessel carries do not stand: ${planesFault}`);
      // The WORN face decides which plane mounts. The bootstrap pin names the FOUNDING face, which is the
      // right answer only when no switch is owed — and both this reading and the Binding Gate's below must
      // resolve the SAME face, or the writable plane and the signing authority would belong to two people.
      const personaGroupId = wornMount?.personaGroupDocIdHex
        ?? bootstrapTiddlers[PERSONA_GROUP_DOC_ID_TIDDLER]?.text
        ?? tiddlerText(id?.[PERSONA_GROUP_DOC_ID_TIDDLER]) ?? null;
      // A vessel standing in compartments but told to wear none it carries halts here rather than
      // wearing whichever happened to load first.
      const personaBagId   = personaGroupId && personaPlanes.length
        ? mountedPlaneBagId(personaPlanes, personaGroupId)
        : null;
      const personaUrl     = personaPlanes.find((p) => p.personaGroupId === personaGroupId)?.url ?? null;
      // THE THREE PLANES THAT TRAVEL WITH THE FACE, read under the face's own names. The plane id
      // resolved just above carries the tag, so its siblings come from it — the name is the index, and
      // no second copy of the tag rides the bootstrap to drift from this one. A vessel standing in no
      // face reads none of them, which is the faceless floor answering honestly.
      const faceSiblings  = personaBagId ? personaSiblingBagIds(personaBagId) : null;
      const readPlane = (bagId: string | undefined): string | null =>
        bagId ? (bootstrapTiddlers[bagId]?.text ?? tiddlerText(id?.[bagId]) ?? null) : null;
      const identitiesUrl = readPlane(faceSiblings?.identities);
      const circlesUrl    = readPlane(faceSiblings?.circles);
      const sessionsUrl   = readPlane(faceSiblings?.sessions);
      // ── THE PLACE STANDS ALONE; THE FACE RIDES OPTIONAL ────────────────────────────────────────
      // Only the daemon doc reads required — a founding stands a PLACE first (`lares vessel found`) and a FACE
      // later (`lares persona new 0`), so a vessel that carries and serves while holding no persona names
      // none of the social planes here. Absence reads as the WAKING FLOOR.
      if (!daemonUrl) {
        throw new Error(`[lararium] this vessel names no daemon doc — the place never finished founding. Run \`lares vessel found\`.`);
      }
      // A TORN face refuses outright, mirroring `bootDaemonKeyhive`: some pins standing and others absent
      // names a half-finished founding, and guessing which half to trust is the confused-deputy error.
      const faceParts = [identitiesUrl, circlesUrl, sessionsUrl, personaUrl, personaBagId];
      const faceHeld  = faceParts.filter(Boolean).length;
      if (faceHeld > 0 && faceHeld < faceParts.length) {
        throw new Error(
          `[lararium] the face this vessel carries reads TORN — some social planes stand and others do not.\n` +
          `  missing: ${[!identitiesUrl && "the identities plane", !circlesUrl && "the circles plane", !sessionsUrl && "the sessions plane", !personaUrl && "the PersonaGroup plane", !personaBagId && "the PersonaGroup sentinel"].filter(Boolean).join(", ")}\n` +
          `  Re-light the face (\`lares persona new 0\`) rather than booting on half of one.`,
        );
      }
      bootstrap = {
        daemonUrl, personaPlanes,
        ...(identitiesUrl ? { identitiesUrl } : {}),
        ...(circlesUrl    ? { circlesUrl }    : {}),
        ...(sessionsUrl   ? { sessionsUrl }   : {}),
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
        ` → ${moved ?? "already gone"}; the plane mounts read-only until \`lares vessel rite rebirth\` rematerializes it`,
      );
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
    const daemonDoc = (await readDaemonDoc()).doc();
    // Each pin defaults to the WORN face's own anchors; absent a switch these read the daemon doc exactly
    // as before (byte-identical for a single-face vessel, which is every vessel until one wears a second).
    const personaGroupDocIdHex   = wornMount?.personaGroupDocIdHex   ?? tiddlerText(daemonDoc?.tiddlers?.[PERSONA_GROUP_DOC_ID_TIDDLER])   ?? undefined;
    const personaGroupAgentIdHex = wornMount?.personaGroupAgentIdHex ?? tiddlerText(daemonDoc?.tiddlers?.[PERSONA_GROUP_AGENT_ID_TIDDLER]) ?? undefined;
    const meshCabalDocIdHex     = wornMount?.meshCabalDocIdHex      ?? tiddlerText(daemonDoc?.tiddlers?.[MESH_CABAL_DOC_ID_TIDDLER])     ?? undefined;
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
    const signerDid  = wornMount?.signerDid ?? tiddlerText(daemonDoc?.tiddlers?.[SIGNER_DID_TIDDLER]) ?? undefined;
    // The veil rides the mount with the rest of the pins: the doc's tag is the FOUNDING face's, and a worn
    // face stands its OWN veil (fresh per founding). Reading the doc here alone put h{N}'s sentinel ops
    // under h0's veil — the one pin in this cluster that never asked what was worn.
    const dyadVeilTag = wornMount?.veilTag ?? tiddlerText(daemonDoc?.tiddlers?.[DYAD_VEIL_TAG_TIDDLER]) ?? undefined;
    const edgeRecord = daemonDoc?.tiddlers?.[DEVICE_DELEGATION_SELF_TIDDLER];
    // The switch presents the WORN face's signed edge. It changes WHICH edge is presented, never whether it
    // is checked: `bootDaemonKeyhive` runs the Binding Gate on it in full, or grants no persona caps at all.
    const deviceEdge = wornMount?.deviceEdge ?? (edgeRecord?.tiddler as unknown as DeviceDelegationTiddler | undefined);
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
      console.log(`[dyad] this vessel holds ${dyads.length} relationship(s), ${bound} bound.`);
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
    const personaKelPrefix = wornMount?.personaKelPrefix ?? tiddlerText(daemonDoc?.tiddlers?.[PERSONA_KEL_PREFIX_TIDDLER]) ?? undefined;
    let personaKelChain: ReturnType<ReturnType<typeof makePersonaKelRingHolder>["chainForPrefix"]> = null;
    if (personaKelPrefix) {
      // ── THE CLIMB'S CARRY — run BEFORE the gate walks ────────────────────────────────────────
      // A founding seats this inception on the board keyed by the island resolved AT THAT MOMENT, which
      // for an unconnected hearth is its OWN key. Seating a charter later re-keys the board, and this
      // gate REFUSES rather than degrades — so the walk `vessel found` → use → `nexus rite cabal` →
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
      await kelHolder.ready;
      personaKelChain = kelHolder.chainForPrefix(personaKelPrefix);
      if (!personaKelChain || personaKelChain.length === 0) {
        throw new Error(`[lararium] persona-KEL chain for the pinned identifier ${personaKelPrefix.slice(0, 20)}… absent from the local board replica — the Binding Gate cannot reach a head (fail-closed).`);
      }
    }
    // ── THE REST OF THE CLIMB — the six boards the KEL carry left behind ──────────────────────────
    // The docblock above reads "most of those boards DEGRADE across the move". Measured, TWO of them fail
    // OPEN instead:
    //   · EDGE-KĀPAE — an empty shadow board LOWERS EVERY SHADOW, so a relationship a hand deliberately set
    //     aside stands re-admittable on the new island. And `edgeKapaeBoardDocUrl` sits OUTSIDE
    //     `DeterministicFederationGate`'s list, so no peer's replica ever heals it. The boot must.
    //   · ANTIGEN — "an empty antigen bans nobody" means a Kapae'd presenter is RE-ADMITTED. It federates
    //     (MANDATORY tier), so an island with other members heals it by sync — bounded by sync-latency,
    //     never instantly, and never at all for the vessel that climbs onto an island where it stands first.
    // Both CARRY: their entries ARE the record, so the bytes move verbatim with their own signatures and the
    // destination's own fold judges them exactly as the board below did. The crossroads board instead
    // RE-ANNOUNCES: its rows are a PROJECTION of the realm doc's n-of-n-signed registrations and carry no
    // signature a reader could re-check, so a copy would launder a stale, lapsed or foreign-realm row.
    //
    // WHO · carriage · vouch are REFUSED, and `nexus-board-climb`'s header carries the reason for each — a
    // face DISCLOSED to strangers the operator never published to, a roster that IS a global invariant, and
    // a partial replica that would read as a whole lineage. Passing a fourth board here compiles an
    // about-set at a new address; read that header before adding one.
    //
    // UNCONDITIONAL, deliberately OUTSIDE the persona-KEL guard above: a faceless vessel holds shadows and
    // an antigen too. Climb-only and idempotent by the same construction as the KEL carry — every source
    // comes from `nexusIslandsBelow` (empty at the bottom, empty when torn), and every act writes only what
    // the destination LACKS, so this runs every boot with one effect.
    await climbNexusBoards({
      repo, nexusPubkey,
      priorIslands: nexusIslandsBelow(nexusStandsAt),
      realmId:      realmIdOfCharter(readNexusDoc(sealHome)),
    });
    // Register the per-Nexus crossroads plane into the oracle plane (isomorphic with the browser). Both shores
    // compose the SAME `nexusIdentity` ruling — this one off its charter, a leaf off the anchor gate key it
    // passes back — so a node, its browser leaves and its Herm resolve the identical crossroads doc. The daemon core
    // splices the crossroads bag into the recipe + registerBags for either vessel.
    await registerCrossroadsInOracle(repo, assembly.islandHandle, nexusPubkey);
    // ── THE REALM PLANE — the relation's shared CRDT, materialized on every member's boot ──────────────
    // The realm doc's id derives from the charter both stewards hold (its genesis epoch), so A and B compute
    // ONE address from the charter alone. A bag REGISTERS on it (`realm-bag`), and the daemon island's reach
    // (`meme get --bag <x>`) walks this plane FIRST through the pointer this stand pins on the oracle plane.
    // The wire gate widens the self-slot shelf by the member-read lane and nothing else: a stranger draws
    // the same denial as any private plane. A vessel with no charter stands no realm — the shelf stays as it was.
    if (!realmPlane && nexusMembership && selfSlotFedGate) {
      realmPlane = makeRealmPlane({
        repo,
        oracleHandle:     assembly.islandHandle,
        crossroadsHandle: await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads"),
        membership:       nexusMembership,
        base:             selfSlotFedGate,
        // THE REALM LEG: the realm's own registration answers which documents cross — the proven contract nym
        // behind a wire key, the charter this vessel itself holds, and the hearth it dialed that charter from.
        charter:          makeRealmCharterConsult({ sealHome, peerContractNymMap, charterHearthPeers }),
        // THE LEASE: a registration's `expiry` reads against the realm's own pace in rolls (0 = cannot judge).
        pace:             () => (realmPaceCell.read() > 0 ? realmPaceCell.read() : null),
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
    // WHICH SLOT THE EDGE RIDES. The self edge is one signed object read two ways. Signed by a root THIS
    // vessel does not hold, it is an ADMIT — a hearth's root licensed this device — and it presents in the
    // FLEET slot, where the peer's keyholder chains it to its pinned KEL and vouches `same-operator`. Signed by
    // a root this vessel HOLDS, it is the vessel's own founding — a fleet credential for a fleet it never dials
    // (a hearth dials none of its own leaves) — and presenting it in the fleet slot to another operator's hearth
    // draws "operator is not the pinned root" and anergizes the socket whole. That edge presents in the
    // CONTRACT slot instead: the peer admits the ContactCard at the cross-operator floor, proves the edge
    // offline, and its membership consult binds the wire key to the nym `accept-carriage` contracted under.
    if (joinSyncUrl) {
      try {
        const leafIdentity = await loadLeafIdentity();
        const selfEdge = wornMount?.deviceEdge ?? (daemonDoc?.tiddlers?.[DEVICE_DELEGATION_SELF_TIDDLER]?.tiddler as unknown as DeviceDelegationTiddler | undefined);
        const selfSigned = selfEdge ? await holdsRootOf(selfEdge) : false;
        nexusDial = maybeStartNexusClientDial({
          repo, syncUrl: joinSyncUrl, gatePubKey: joinGatePubKey,
          identity: selfEdge
            ? (selfSigned ? { ...leafIdentity, contractEdge: selfEdge } : { ...leafIdentity, edge: selfEdge })
            : leafIdentity,
          ...(joinDocUrl ? { docUrl: joinDocUrl } : {}),
          onLog: (line) => console.log(`[nexus-join] ${line}`),
          // THE RETURN ON SOCKET A — the same re-fold the carriage's own `onReconnect` runs on Socket B.
          // A partition stales the boards this verdict reads (membership · posture · realm registrations)
          // and the Repo caches its share verdict per (doc, peer) until something asks it to read anew, so
          // a peer that comes back re-attaches at the transport and draws a verdict computed before the cut.
          onReconnect: async () => {
            await runNexusRefresh({
              storageDir, sealHome, nexusPubkey,
              antigen: antigenHolder, membership: nexusMembershipHolder,
              setPosture: (p) => { federationPosture = p; },
            });
            await realmPlane?.refresh(readNexusDoc(sealHome));
            reverdict();
          },
        });
        // The peer at the other end of this dial IS the hearth the charter came from — the realm's return lane.
        try { nexusDial?.adapter.on("peer-candidate", ({ peerId }: { peerId: string }) => {
          charterHearthPeers.add(peerId);
          console.log(`[realm] the charter's hearth stands at peer ${peerId} — the realm's registered books federate back to it`);
        }); }
        catch { /* an adapter without the event names no hearth — the realm leg simply never opens that lane */ }
        console.log(`[nexus-join] presenting ${
          !selfEdge   ? "the ContactCard alone (no self edge — cross-operator floor)"
          : selfSigned ? "the contract edge (this vessel's own root signed it — cross-operator; the peer's board binds the nym)"
          :              "the device-delegation edge (fleet)"}`);
      } catch (e) {
        console.log(`[nexus-join] dial-out skipped — leaf identity unavailable (run \`lares vessel found\`): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // ── THE BOOTSTRAP SEEDS; THE CATALOG PLANE REGISTERS ────────────────────────────────────────
    // A face is lit by `lares persona new 0` — a CLI act, on a vessel that is not running — so the plane it
    // stands lands in the BOOTSTRAP, which is this island's cold-start seed and reaches no registry. The
    // verbs that read a persona plane resolve it the way every user bag resolves, from the catalog registry. This boot
    // carries the seed across that gap.
    //
    // ALL FOUR OF A FACE'S PLANES, not the persona plane alone: the circles, identities and sessions planes carry
    // the same tag and answer the same ownership question, so one bridge serves the whole face and the four
    // cannot drift onto different registries.
    //
    // Idempotent by construction: it writes the url the seed already names, so a plane registered on an
    // earlier boot is re-written identically and a plane the operator lit an hour ago registers now.
    const registerInCatalog = (bagId: string, url: string | null | undefined): void => {
      if (!url || tiddlerText(assembly.catalogHandle.doc()?.tiddlers?.[bagId]) === url) return;
      assembly.catalogHandle.change((doc) => {
        doc.tiddlers[bagId] = mutableLarRecord(bagId, { text: url, kind: "oracle" }, "vessel-boot");
      });
    };
    for (const plane of bootstrap.personaPlanes) {
      registerInCatalog(personaBagIdFor(plane.personaGroupId), plane.url);
    }
    // The worn face's siblings ride the bootstrap under their own derived names; register them beside it.
    const wornFace = bootstrap.personaBagId ? personaSiblingBagIds(bootstrap.personaBagId) : null;
    if (wornFace) {
      registerInCatalog(wornFace.circles,    bootstrap.circlesUrl);
      registerInCatalog(wornFace.identities, bootstrap.identitiesUrl);
      registerInCatalog(wornFace.sessions,   bootstrap.sessionsUrl);
    }
    // M3 — node-main reads the persisted keyhive Archive from the identity home and passes it into the
    // worker (same custody boundary the 32-byte seed already crosses). keyhive inits from it as the
    // restore FLOOR, then replays daemon cap-events on top — a torn daemon doc restores instead of orphaning.
    // THE WAKING FLOOR (#60, superseding the boot-gate throw): when the config marks sealing expected and no
    // passphrase rides the environment, the archive stays SHUT and this daemon stands WITHOUT it. Throwing
    // here would have made the floor a lie — the boot announces that it stands faceless and carrying, then
    // the same condition killed it one frame later. `daemonAuth` already treats the archive as optional, so
    // standing without it costs nothing structurally: keyhive loses its restore FLOOR and replays cap-events
    // alone, which is exactly a vessel that has lost its CAPS and kept its FLOOR.
    //
    // Reading rather than asserting is the ruling itself (canon: waking-floor). Nothing is lowered — a
    // vessel that cannot open simply never rose, and an operator supplying the key raises it.
    //
    // ONE READING, READ ONCE, CARRIED WHOLE. The same fact that decides whether this boot may READ
    // the archive decides whether it may WRITE one, so it rides into the worker on `daemonAuth`
    // rather than being re-derived there: the worker's archive-write door refuses on it (`=== true`,
    // fail-closed), which is the DOOR rather than the grant — `node-daemon-island` injects the
    // writers, and a gate there would leave every other route into the worker unchecked
    // (waking-floor #/the-breaks ①). Reading it twice would let the two readings drift apart mid-boot.
    const opens = archiveOpens();
    const archiveBytes = opens ? loadIdentityArchive() : null;
    const veilArchiveBytes = opens ? loadVeilArchive() : null;
    const daemonAuth = {
      seed:                 vesselSeed,
      vesselVerifyingKey: vesselIdentity.verifyingKey,
      archiveOpens:         opens,
      ...(dyadVeilTag ? { dyadVeilTag } : {}),
      ...(veilArchiveBytes ? { veilArchiveBytes } : {}),
      // The face pins ride CONDITIONALLY — a place at the floor carries none, and writing them as
      // explicit `undefined` would read as a torn face rather than an unlit one.
      ...(personaGroupDocIdHex   ? { personaGroupDocIdHex }   : {}),
      ...(personaGroupAgentIdHex ? { personaGroupAgentIdHex } : {}),
      ...(meshCabalDocIdHex      ? { meshCabalDocIdHex }      : {}),
      // Derived, never enumerated — one derivation both vessels share, so the node and the browser
      // cannot drift apart on which bags a cap check can resolve. A wiki slot's bags ride only when a
      // wiki stands in the stack; a Herm carries none, blind by structure rather than by a flag.
      registerBags: deriveRegisterBags({
        // EVERY compartment registers — a plane absent from the ring stops that compartment's own
        // devices reconciling. Only ONE mounts; the two verbs part company here.
        fleets: bootstrap.personaPlanes.map((p) => ({
          personaGroupId: p.personaGroupId,
          catalogNamed: p.personaGroupId === personaGroupDocIdHex ? catalogNamedBags(assembly.catalogHandle.doc()) : [],
        })),
        ...(slot ? { wikiBags: [slot.wikiBagId, slot.workingBagId, slot.draftBagId] } : {}),
      }),
      ...(signerDid ? { signerDid } : {}),
      ...(personaKelPrefix && personaKelChain
        ? { personaKel: { prefix: personaKelPrefix, chain: personaKelChain } }
        : {}),
      ...(deviceEdge ? { deviceEdge } : {}),
      ...(archiveBytes ? { archiveBytes } : {}),
    };
    // The engine's plugin-tiddler CIDs — the daemon worker pulls them by CID from the fs CAS
    // (the breath path), never CRDT-syncing the bytes over the port. Same derivation the pool
    // feeds every wiki island; mirrors the browser vessel.
    const pluginCids = pluginCidsFromIslandBlobs(assembly.islandHandle.doc()?.blobs);
    daemonVm = await openDaemonVm({
      repo,
      daemonUrl: bootstrap.daemonUrl,
      // The persona plane rides only when a face stands; the daemon VM resolves nothing that is absent.
      ...(bootstrap.personaUrl   ? { personaUrl:   bootstrap.personaUrl }   : {}),
      ...(bootstrap.personaBagId ? { personaBagId: bootstrap.personaBagId } : {}),
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
      rootDir: rootDirOpt ?? repoRoot,
      guardCrossroadsNexusHandles: nexusStanding.kind !== "charter",
    });

    // ── THE PERSONAGROUP IDENTITY-SLOT RING (docs/pono/identity-slot-policy, arm B) ───────────────
    // A cross-operator peer holding a VERIFIED face-join grant on THIS face's plane reaches the face's own
    // planes — and nothing else. The ring WIDENS the self-slot fed gate by that ONE path (`compose` ORs it
    // atop the deterministic federatable set), so a stranger, and every private plane, read exactly as
    // before. The grant read reuses the plane the joinee's own `takeFaceGrantIfPublished` reads, bound to
    // the ONE `verifyFaceGrantRecord`. NO CLOCK RIDES IN: admission licenses off the persona-KEL HEAD alone
    // (event order), so absent a resolved KEL chain the ring stays UNWIRED — the pre-ring verdict stands
    // rather than a widening the vessel cannot walk clocklessly.
    if (personaGroupDocIdHex && deviceEdge?.personaRootDid && selfSlotFedGate && personaKelPrefix && personaKelChain) {
      const base = selfSlotFedGate;
      selfSlotFedGate = (await makeSelfSlotPersonaGroupRing({
        catalog: makeCatalogAccessor(repo, catalogHandle.url),
        personaGroupDocIdHex,
        personaRootDid: deviceEdge.personaRootDid,
        personaKel: { prefix: personaKelPrefix, chain: personaKelChain },
        provenIdentifierOf: (peerId) => peerIdentifierMap.get(peerId),
      })).compose(base);
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
    // wiki-act: command a residency ACTION verb to run IN the active wiki
    // island over ITS composite (promotion executes
    // where working + canon both live — the island owns its composition; the
    // daemon commands, never reaches the per-fingerprint working binding). The
    // inner verb (MOVE/LOAD/…) routes to the island's own action reactors.
    registry.register("wiki-act", async (args, ctx) => {
      await wikiActivation.ensureActive(slotActiveWikiId);
      return vmManager.placeWikiVerb(slotActiveWikiId, {
        verb: String(args["verb"]),
        args: (args["args"] as Record<string, unknown>) ?? {},
        requestedBy: ctx.invocation.requestedBy,
      });
    });
    registry.register("residency", makeResidencyStatsReactor({ residency }));

    // nexus-refresh — the LIVE-refold of the three nexus-doc authorities the boot read once: the federation
    // POSTURE (a disk-charter re-read → reassigns the sharePolicy's live `federationPosture`), the antigen
    // Kapae'd DENY set, and the contracted MEMBER set (both re-folded off freshly-materialized boards). The
    // shore an OUT-OF-PROCESS CLI edit (`lares nexus posture` / `kapae` / `admit`, each writing its own repo)
    // needs to reach this running node — NodeFS carries no cross-process change bus, so a peer's WS-sync
    // refold never fires for a same-operator CLI write beside it. DISTINCT from the worldline `kapae`
    // branch-mute; this touches the mesh immune/federation surface, never a worldline branch.
    registry.register("nexus-refresh", async () => {
      const r = await runNexusRefresh({
        storageDir,
        sealHome,
        nexusPubkey,
        antigen:     antigenHolder,
        membership:  nexusMembershipHolder,
        // Reassign the live posture the sharePolicy closure reads each call (fail-closed PRIVATE on a torn read).
        setPosture:  (p) => { federationPosture = p; },
      });
      // A charter imported after boot names a realm this vessel never stood — stand it now (idempotent).
      await realmPlane?.refresh(readNexusDoc(sealHome));
      reverdict();
      return { verb: "nexus-refresh", ...r, realm: realmPlane?.realmId() ?? null, realmDoc: realmPlane?.realmUrl() ?? null };
    });

    // realm-bag — REGISTER a bag this vessel's steward keeps on the realm's shared CRDT (realm-bag-brief, the
    // 2026-09-11 ruling): the record `{ bagUri, docUrl, keptBy, readTier: contract }` signed by the steward's
    // persona root, landed on the realm doc, and announced on @crossroads as `{ bagUri, keptBy }` alone. The
    // bag's doc is the one this vessel's oracle registry names for the URI — the steward's OWN doc becomes
    // the ford's one book, read by every contracted member, written by the stewards.
    registry.register("realm-bag", async (args) => {
      if (!realmPlane) throw new Error("realm-bag: the realm plane never stood on this vessel (no oracle plane at boot)");
      const bagUri = typeof args["bag"] === "string" ? (args["bag"] as string).trim() : "";
      if (!bagUri) throw new Error("realm-bag: `bag` required (the bag's lar: URI, e.g. lar:///ha.ka.ba/bags/lares)");
      const handleIndex = Number.isFinite(args["index"]) ? Number(args["index"]) : 0;
      const oracleDoc = assembly.islandHandle.doc();
      const catalogDoc = assembly.catalogHandle.doc();
      // A CO-SIGN consents to the PROPOSER's bytes — the doc it names, never this vessel's own doc of that
      // name (that substitution would be the two-chests equivocation the fold refuses).
      const docUrl = tiddlerText(oracleDoc?.tiddlers?.[bagUri]) ?? tiddlerText(catalogDoc?.tiddlers?.[bagUri]) ?? "";
      if (!docUrl && args["cosign"] !== true) throw new Error(`realm-bag: "${bagUri}" names no doc on this vessel's registry planes — nothing to register`);
      const nym = await loadPersonaGroupRootVerifyingKey(handleIndex);
      if (!nym) throw new Error(`realm-bag: no persona root at index ${handleIndex} — a bag is kept by a named steward`);
      const sign = ed25519SignerFromSeed(await loadPersonaGroupRootSeed(handleIndex));
      // NAMING A SECOND STEWARD takes two hands (n-of-n): `stewards` proposes them, and the record stands
      // unregistered until each proposed hand co-signs with its own `cosign`.
      const propose = Array.isArray(args["stewards"]) ? (args["stewards"] as unknown[]).filter((v): v is string => typeof v === "string") : [];
      // The DECLARED read tier (CONTRACT by default; PUBLIC names a book the Herm carries by hash), the LEASE
      // in rolls of the realm's pace, and the CHARTER each named hand holds — a book spanning two charters is a
      // `keptBy` with two charters, never a fused realm.
      const readTier = typeof args["tier"] === "string" ? (args["tier"] as CapTier) : undefined;
      const expiry   = Number.isFinite(args["expiry"]) ? Number(args["expiry"]) : undefined;
      const charters = typeof args["charters"] === "object" && args["charters"] !== null
        ? (args["charters"] as Record<string, string>) : undefined;
      const rec = args["cosign"] === true
        ? await realmPlane.coSign({ bagUri, signer: nym.toLowerCase(), sign })
        : await realmPlane.register({
            bagUri, docUrl, signers: [{ signer: nym.toLowerCase(), sign }], propose,
            ...(readTier ? { readTier } : {}),
            ...(expiry === undefined ? {} : { expiry }),
            ...(charters ? { charters } : {}),
          });
      reverdict();   // the realm gate's standing set grew — a member peer's cached verdict on that bag's doc moves
      const counts = rec.keptBy.every((k) => rec.signatures.some((sg) => sg.signer.toLowerCase() === k.toLowerCase()));
      return { verb: "realm-bag", realm: rec.realmId, bag: rec.bagUri, doc: rec.docUrl, keptBy: rec.keptBy,
               readTier: rec.readTier, signedBy: rec.signatures.map((sg) => sg.signer), counts,
               awaiting: rec.keptBy.filter((k) => !rec.signatures.some((sg) => sg.signer.toLowerCase() === k.toLowerCase())) };
    });
    // realm-bags — the STANDING registrations this vessel's realm carries (counted and folded; an equivocal
    // bag never lists). Verdict-free: it reads the realm doc as-of-last-sync.
    registry.register("realm-bags", async () => {
      const standing = realmPlane ? await realmPlane.standing() : new Map();
      return {
        verb: "realm-bags", realm: realmPlane?.realmId() ?? null, realmDoc: realmPlane?.realmUrl() ?? null,
        bags: [...standing.values()].map((r) => ({ bag: r.bagUri, doc: r.docUrl, keptBy: r.keptBy, readTier: r.readTier })),
      };
    });

    // nexus-rekey — the immune keel's RE-KEY tooth at the Herm's OWN tier: roll a resource's LEASE EPOCH
    // forward on the live daemon board, staling every grant bound below the new epoch. It writes the
    // CALLER's OWN per-writer slot only (a MAX-REGISTER, never a bare scalar — the Automerge-LWW backward-drop
    // hazard), so two hearths rekeying the same resource concurrently both climb, never drop. This is the
    // NON-RENEWAL half of revocation (a lease stales; it never re-derives a secret) — targeted key-material
    // rotation rides keyhive CGKA, NEVER this lease. A live board write → the roll rides WS-sync to replicas.
    registry.register("nexus-rekey", async (args) => {
      const resource = typeof args["resource"] === "string" ? (args["resource"] as string) : "";
      if (!resource) throw new Error("nexus-rekey: `resource` required (the lease resource id to roll)");
      const r = rollLeaseEpochOnBoard(await readDaemonDoc(), resource, vesselIdentity.verifyingKey);
      return { verb: "nexus-rekey", ...r };
    });

    // nexus-reshare — the immune keel's RE-SHARE tooth: re-announce every sealed body this hearth HOLDS over the
    // carriage, so a relay that PRUNED this holder on a drop re-learns `cid → holder` FROM THE WIRE. The held set =
    // the cad ciphertext tier on disk (cid-named files); the announce carries a HINT (where to ask), never the
    // bytes (a member re-verifies `verifyCiphertextCid`). The PUBLIC FLOOR re-announce rides the read-face's own Ea
    // breath (the signed monotone pointer re-issues each TTL/2), so a static floor never reads stale — no extra verb.
    registry.register("nexus-reshare", async () => {
      const cids = listSealedCids(cadSealDir(storageDir));
      const announced = carriageLoop ? await carriageLoop.announce(cids) : 0;
      return { verb: "nexus-reshare", held: cids.length, announced, carriage: carriageLoop !== null };
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
      installCasSweep({ registry, casDir: cidDir, paceCell: realmPaceCell, references: () => assembly.composite.entries(), protect: genesisProtect, pins: () => readCasPins(cidDir), realmClock: async () => { const doc = (await readDaemonDoc()).doc(); const realm = tiddlerText(doc?.tiddlers?.[MESH_CABAL_DOC_ID_TIDDLER]); return realm && doc ? realmMaintenanceFromBoard(doc, realm) : null; }, log: (line) => console.log(line) });
    }

    // cas-fetch — the fetch door's explicit READ: resolve a cid through the vessel's door (local `cid/` first,
    // then the fleet holders over Socket B, verified, write-through). The verb IS a read, so fetch-on-read holds
    // it; it fabricates nothing — a miss everywhere answers `held:false` and the pointer stays PENDING.
    registry.register("cas-fetch", async (args) => {
      const cid = typeof args["cid"] === "string" ? (args["cid"] as string) : "";
      if (!cid) throw new Error("cas-fetch: `cid` required");
      const before = readCasBlobFromFs(cid, cidDir) !== null;
      const bytes = await resolveCidThroughDoor(cid);
      return { verb: "cas-fetch", cid, held: bytes !== null, fetched: bytes !== null && !before, bytes: bytes?.byteLength ?? 0,
               door: carriageLoop ? "socket-b" : "local-only", holders: fleetHolders() };
    });

    // cad-seal — the cad seal's FIRST live producer. Seal a carrier body's PLAINTEXT into the ciphertext
    // federation plane (a distinct `cad/` tier), ADDITIVELY: the cleartext-local corpus CAS the wake reads stays
    // untouched. The body arrives as a staged `cid` (resolved cleartext from the corpus CAS) or inline `text`.
    // The seal registers the ciphertext docId into the live sealRegistry → the member blind-transit lane opens
    // for exactly that body; a member reads NOTHING (carry ⊥ read — the read-cap rides the keyring, never here).
    // FAIL-CLOSED: no keyring (an empty stand) → `keyring.current()` throws → the body stays cleartext-local only.
    registry.register("cad-seal", async (args) => {
      const keyring = nexusConvergenceKeyring;
      if (!keyring) throw new Error("cad-seal: no convergence keyring on this vessel — cannot seal (the body stays cleartext-local)");
      const cid  = typeof args["cid"]  === "string" ? (args["cid"]  as string) : "";
      const text = typeof args["text"] === "string" ? (args["text"] as string) : "";
      let plaintext: Uint8Array;
      if (cid) {
        const bytes = readCasBlobFromFs(cid, casDirForStorage(storageDir));   // the SAME cleartext corpus CAS the CLI staged to
        if (!bytes) throw new Error(`cad-seal: no staged carrier body at cid ${cid} in the corpus CAS`);
        plaintext = bytes;
      } else if (text) {
        plaintext = utf8Bytes(text);
      } else {
        throw new Error("cad-seal: `cid` (a staged carrier) or `text` (an inline body) required");
      }
      const installed = sealCarrierForFederation({
        registry:  sealRegistry,
        cadDir:    cadSealDir(storageDir),
        plaintext,
        keyring,
        tracker:   casBagTracker,
        self:      vesselIdentity.verifyingKey,
      });
      // Return the PUBLIC verify-cap only (cid + docId + epoch) — the read-cap NEVER crosses this boundary.
      return { verb: "cad-seal", cid: installed.cid, docId: installed.docId, epoch: installed.epoch, sealed: sealRegistry.seal.isSealedPlane(installed.docId) };
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
      return { verb: "wiki-switch", slug, active, held: [...wikiActivation.held()] };
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
    }
    void residency.pin(DAEMON_BAG_ID,       "boot:daemon");
    // Durable pin replay — BEFORE the sweeper starts, so a replayed pin never races the first
    // idle-cool tick. Recovers whatever `lares pin` persisted under the daemon doc across a
    // restart (residency-tiers.mem#/pin-flag; see writePinTiddler/replayPinsFromDaemonDoc).
    void replayPinsFromDaemonDoc(daemonVm.daemonHandle, residency);
    residency.startSweeper();
    assembly.composite.attachResidency(residency);

    // Inbound WS gate — the daemon island's in-worker keyhive answers each peer.
    authGate.arm(daemonVm.authShore, DAEMON_BAG_ID, vesselIdentity.verifyingKey);

    // Keep oracle tiddlers current — self, ka, ba, social plane, daemon.
    reconcileWellKnownTiddlers(
      assembly.islandHandle, catalogHandle.url, assembly.laresHandle?.url,
      bootstrap.personaBagId ? personaSiblingBagIds(bootstrap.personaBagId) : null,
      bootstrap.identitiesUrl, bootstrap.circlesUrl, bootstrap.sessionsUrl,
      daemonVm.daemonHandle.url,
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
        if (!(await wikiActivation.ensureActive(wikiId))) throw new Error(`[mailbox] ${wikiId} not activatable — kept parked`);
        return vmManager.placeWikiVerb(wikiId, v);
      },
      (line) => console.log(line),
    );
    eventBus = new LarEventBusImpl(20);
    for (const ring of DEFAULT_RINGS) eventBus.registerRing(ring);
    eventBus.start();

    const workerRootDir = rootDirOpt ?? repoRoot;
    const diskMirrorGrant: DiskMirrorGrant = [
      { bagId: LARES_DOC_URI,    mirrorRoot: join(workerRootDir, "bags/lares"),    scope: "lares" },
      { bagId: LARARIUM_DOC_URI, mirrorRoot: join(workerRootDir, "bags/lararium"), scope: "lararium" },
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
    // The engine's plugin-tiddler CIDs — every wiki island pulls them by CID from the local
    // CAS, the same CID plane the daemon island reads.
    const poolPluginCids = pluginCidsFromIslandBlobs(assembly.islandHandle.doc()?.blobs);
    vmManager = new VesselIslandPool({
      mainRepo:    repo,
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
      ...(poolPluginCids.length ? { pluginCids: poolPluginCids } : {}),
      diskMirrorGrant,
      onWorkerEvent: (wikiId, msg) => {
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

  // After live: wire the cross-island verb routing (worker.event → daemon placeVerb).
  const afterLive: VesselOrchestration<VesselIslandPool>["afterLive"] = ({ wikiHandle: _wikiHandle }) => {
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
    repo, catalogHandle, vesselSeed, nexusPubkey,
    daemonDocUrl:    () => bootstrap?.daemonUrl ?? "",
    hearthDaemonUrl: () => (bootstrap as { hearthDaemonUrl?: string | null } | undefined)?.hearthDaemonUrl ?? null,
    residency, carriageLoop, carriageRelay, nexusDial, bulb, emit, orchestration,
    openDaemon, wireVerbs, afterDaemon,
    realmStanding:    async () => (realmPlane ? await realmPlane.standing() : new Map()),
    daemonVm:         () => daemonVm,
    eventBus:         () => eventBus,
    slotActiveWikiId: () => slotActiveWikiId,
    activeWikiSource: () => activeWikiSource,
  };
}

/**
 * Open the FULL node Lararium — composeLararium's #has-cap-stack runs the shared keel sequence
 * (substrate → wiki-slot → daemon → verbs → wiki → pool → daemon-first ea-gate → primary-wiki mount
 * → live). Behaviour stays identical to the pre-cap-stack boot; the only change is the composed wrap.
 */
export async function openNodeVessel(opts: NodeVesselOptions): Promise<NodeVesselResult> {
  const p = await prepareNodeBoot(opts);
  // A Lararium is a hearth that is ALSO a first-class mesh-node: when self-announce params are supplied,
  // it composes the carriage (meshpalace + carriage) ALONGSIDE the wiki-full core — it carries + navigates
  // the FLOW-map for its own routing (carry-without-reserve; no second read-face, no conflict over the oracle doc).
  const carriageCaps = opts.meshSelf ? carriageStack({
    repo:        p.repo,
    self:        opts.meshSelf,
    nodeSeedHex: Buffer.from(p.vesselSeed).toString("hex"),
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
  const extraCaps = [
    ...carriageCaps,
    whoFaceCap({ repo: p.repo, crossroadsHandle, nexusPubkey: p.nexusPubkey, residency: p.residency }),
  ];
  const result = await composeLararium<VesselIslandPool>(p.orchestration, extraCaps);

  return {
    activeWikiId: p.slotActiveWikiId(),
    activeWikiSource: p.activeWikiSource(),
    pool: result.pool, repo: p.repo,
    store: result.assembly.composite,
    daemon: p.daemonVm(),
    wikiDocUrl:       result.wikiHandle.url,
    catalogHandleUrl: p.catalogHandle.url,
    daemonDocUrl:     p.daemonDocUrl(),
    // A node hearth carries and serves its own face; when it was ADMITTED instead, its bootstrap names the
    // hearth it asks. Null here reads "this vessel IS the hearth", never "unknown".
    hearthDaemonUrl:  p.hearthDaemonUrl(),
    oracleDocUrl:     result.assembly.islandHandle.url,
    larariumDocUrl:   result.assembly.larariumHandle?.url ?? null,
    phase: "live",
    eventBus: p.eventBus(),
    // Graceful shutdown tears the pool down AND stops the carriage serve-loop (Socket B) + the client dial-out
    // (Socket A) — each a no-op when none stood — so no timer / client socket leaks past close.
    stopTick: () => { void result.pool.disposeAll(); void p.carriageRelay?.close(); void p.carriageLoop?.stop(); p.nexusDial?.stop(); },
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
  const p = await prepareNodeBoot(opts);
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
    signerSeed:  p.vesselSeed,
    storageDir:  opts.storageDir,
    ...(opts.meshSelf ? { meshSelf: opts.meshSelf } : {}),
    ...(opts.pullIntervalMs !== undefined ? { pullIntervalMs: opts.pullIntervalMs } : {}),
    // Serve the HELD bulb by cid over the public floor (the OPEN path) — present only when the genesis stands.
    ...(p.bulb ? { bulb: p.bulb } : {}),
    // THE HERM RE-SHARE: `/cas/<cid>` serves a fleet peer's PUBLIC blob (landed write-through over Socket B) IFF the crossroads board — the public plane by construction — names the cid.
    publicCas: publicCasShore({
      casDir: casDirForStorage(opts.storageDir),
      references: () => Object.entries(hermCrossroads.doc()?.tiddlers ?? {}).map(([title, record]) => ({ title, bagId: CROSSROADS_DOC_URI, record: record as { tiddler: Record<string, unknown> } })),
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
      // stands UNMEASURED against this cure — a sibling hearth held the e2e set when the cure landed, and two
      // sets never run at once over one `synced-tree.json`. Its second half is independent and still owed:
      // the Herm holds no carriage CLIENT (it IS the relay), so nothing in the product ever makes it FETCH the
      // body, and the witness plants it by hand at ⑤b to isolate the index half from the byte half.
      realmReferences: () => hermRealmShoreBooks({
        realmStanding: () => p.realmStanding(),
        findDoc:       async (docUrl) => (await p.repo.find<LarDoc>(docUrl as AutomergeUrl).catch(() => null))?.doc() ?? null,
        crossroadsDoc: () => hermCrossroads.doc(),
        onLog:         (line) => console.log(`[herm] ${line}`),
      }),
    }),
    onLog:       (line) => console.log(`[herm] ${line}`),
  });
  p.emit("vessel-ready");
  p.emit("live");

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
    dispose: async () => {
      setCasDoor(null);                // the fetch door closes with the vessel — a late worker ask reads a miss
      await p.carriageRelay?.close();  // tear the crossroads down first (a no-op when none stood) — no WS server leak
      await p.carriageLoop?.stop();   // stop Socket B serve-loop (a no-op when none stood) — no timer / socket leaks
      p.nexusDial?.stop();            // stop the client dial-out (Socket A) — a no-op when none stood
      await p.daemonVm().shutdown();
      await herm.vessel.dispose();   // reverse build order → read-face disposes (clears the HTTP handler)
    },
  };
}
