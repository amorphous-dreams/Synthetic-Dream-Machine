/**
 * openBrowserVessel — local-first browser vessel factory.
 *
 * A thin RECIPE over the composable vessel keel — the BROWSER
 * carries the SAME capabilities as node; only the SUBSTRATE differs. The browser must NOT
 * drift thin via easy-path shortcuts (coreless boot, no residency manager, no corpus, a
 * LarVessel wrapper) — it holds the full keel. Genuine browser
 * substrate (the ONLY divergence): IndexedDB storage, WebCrypto keys, founding-via-ceremony
 * (vs node's lares-init), Web Worker spawn, NO WS-server inbound gate (a browser cannot
 * listen on a socket), genesis-via-bytes/IDB/OPFS/peer. Capabilities held in common: the
 * BagStowage mechanism, corpus loading, the verb plane, presence.
 *
 * Genesis REQUIRED (no coreless boot). The not-yet-held axis sits at anon↔keeper
 * (PersonaGroup/admin), not genesis — see project-sovereign-worker-model.
 */

import { Repo }                              from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter }           from "@automerge/automerge-repo-storage-indexeddb";
import type { DocHandle, AutomergeUrl, PeerId } from "@automerge/automerge-repo";
import {
  emptyLarDoc, storedLarRecord, storedRecord,
  CATALOG_DOC_URI, DAEMON_BAG_ID,
  ENGINE_CORE_ID,
  resolveRecipePluginCids, offeringAnnouncesFromDoc, type OfferingLookup,
  personaMultitudeView, renameOwnPersona,
  DeterministicFederationGate, federationShareDecision, shareConfigOf, type FederationGate,
  GatedSyncLeg, oneWayDocumentsGate,
  LarWSClientAdapter, type LeafIdentity,
  standSiblingChannel, siblingRefusalLine, groupSecretSealTitle, verifyGroupSecretSeal,
  leaseEpochPrefix, effectiveLeaseEpoch, tiddlerText, type SiblingNetworkAdapter, type SiblingShare, type SiblingChannelStatus,
  pullAndVerifyOracle, type OraclePullResult,
  BAG_IDS, slugFromUri, verbArgsFromPayload, bagStackFromRec, recipeHostFacets, type WikiActivationCap,
  carriageStack, deriveMeshLeaf, type MeshPeer,
  materializeGenesisIsland, genesisCasManifestFromSeed, genesisCasCidsFromOracle, sha256HexBytesSync,
  whoFaceCap, materializeSharedLarDoc, crossroadsDocUrl, registerCrossroadsPointer,
  personaKelBoardDocUrl, personaKelChainForPrefix, PERSONA_KEL_PREFIX_TIDDLER,
  deriveRegisterBags, catalogNamedBags, personaBagIdFor, personaSiblingBagIds,
  handleClaimFrom, HANDLE_CLAIM_SURFACES,
  nexusIdentity, nexusScopeOrThrow, nexusIslandsBelow, admittedJoineeIsland, type NexusIdentityAt,
  climbNexusBoards, carryPersonaKelUpTheGradient,
  readLedgeredEdgeBoard, fleetEdgeBoardDocUrl, fleetEdgeAuthority, deviceEdgeId, raisesSeenThrough, type EdgeReading,
  type CapModule,
  type LarDoc, type LarariumVesselOptions, type VesselResult, type HearthPinIndex,
  type VesselBootstrap, type VesselCoreAssembly, type GateBundlePin, type DeviceDelegationTiddler,
  type GenesisSeed, type IslandMsg_Manifest,
  takeInvite, popInvite, hex,
  type WalkRecord, type CarryOutcome,
  readHearthFloorCard,
}                                            from "@lararium/mesh";
import { browserGatePins, type BrowserFacePresentation, dialDeadlines, fileFloorCardPin, fileOwnHearthPins, hearthNameOf, oracleNexusFor } from "./browser-gate-pins.js";
import { composeBrowserFacePresentation, facelessFloorPresentation } from "./browser-face-presentation.js";
import { admittedCanonDocs, hearthCanonDocIds, hearthCrossingOf, seatHearthCanon, type HearthCanonDocs } from "./hearth-canon.js";
import { makeSurfaceReturnLeg, type ReturnLegVerdict } from "./surface-return-leg.js";
import { readLarControlResult, readLarFrame, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame } from "@lararium/mesh";
import { createBrowserConnectionState, crossingStandingOf, observeRelayConnection } from "./browser-connection-state.js";
import type { BrowserConnectionState } from "./browser-connection-state.js";
import { browserWalkStore, requireAdmittedFaceIsland } from "./browser-walk.js";
import {
  MemoryTiddlerStore,
  selectActiveWikiSlug,
  loadCatalogCorpora, seedVesselDefaults,
  makeResidencyStatsReactor,
  makeVesselResidency, type VesselResidency,
  replayPinsFromDaemonDoc,
  COHERENCE_FRAME,
  SENSORIUM_FRAME,
  createWikiSenseSupervisor, registerWikiSenseVerbs,
  makeCatalogAccessor, effectiveRecipe,
}                                            from "@lararium/tw5";
import type { WikiSenseSupervisor }          from "@lararium/tw5";
import type { CoherenceStatus } from "@lararium/tw5";
import type { CoherenceFrameWithRev } from "./wiki-coherence-frame.js";
import { composeBrowser }                    from "./browser-caps.js";
import type { VesselWikiSlot, DaemonVmCore } from "@lararium/tw5";
import { runFoundingCeremony, runApplyAdmitPayload, foundThePlace, assemblePersonaGroupRing, archiveIsOf } from "@lararium/keyhive";
import { faceAtomKeyFromSeed } from "@lararium/mesh";
import { keepBrowserFaceAtomSeed, requireBrowserFaceAtomSeed, standBrowserFaceAtomSeed } from "./browser-face-atom.js";
import {
  loadBrowserKeyhiveArchive, loadBrowserVeilArchive, requireBrowserKeyhiveArchive, saveBrowserKeyhiveArchive, saveBrowserVeilArchive,
} from "./browser-keyhive-archive.js";
import { vesselDyads, verifiedFleetOfGroup, type LarDid } from "@lararium/mesh";
import type { CarriedAdmitPayload } from "@lararium/keyhive";
import type { LarOpenPhase }                 from "@lararium/mesh";
import { readWornPersonaMount }              from "@lararium/mesh";
import {
  generateOrLoadBrowserVesselIdentity, loadBrowserSigningSeed,
  generateOrLoadBrowserPersonaRoot, loadBrowserPersonaRootSeed, wearBrowserPersona,
  listBrowserPersonaRoots, loadBrowserActivePersona,
  makeBrowserIdbPersonaVault, makeBrowserPersonaPetnameStore,
  openVesselIdb, idbGet, idbPut,
}                                            from "./browser-vessel-identity.js";
import type { BrowserVesselIdentity }        from "./browser-vessel-identity.js";
import { personaPanelStateArgs }             from "./persona-panel-state.js";
import { BrowserVesselIslandPool }           from "./browser-vessel-island-pool.js";
import { publishHandleBrowser }              from "./browser-handle-publish.js";
import { burnFaceBrowser, attestFaceBrowser } from "./browser-handle-verbs.js";

/** Browser advertises the MINIMAL grant (constrained vessel): a small live-wiki set
 *  (the daemon bag always + a couple more on reference) and ONE rotatable pin besides the daemon bag.
 *  The resolver honors this smaller grant — the same cap, a lower point on the spectrum. */
const BROWSER_WIKI_ACTIVATION_CAP = 2;
const BROWSER_WIKI_PIN_BUDGET     = 1;

/** The founding persona's handle-index. A fresh browser founds its FIRST persona here (never the self-
 *  signed floor); the multitude adds h1, h2, … each with its own root (a stage-4+ UX). Kept explicit so
 *  the founding + the worker-reach selector name the SAME index. */
const FOUNDING_PERSONA_INDEX = 0;
import {
  fetchGenesisCasToOpfs,
  readCasBlobFromOpfs,
}                                            from "./browser-genesis.js";
import {
  openBrowserDaemonVm,
}                                            from "./open-browser-daemon-vm.js";
import type { WikiRecipe }                   from "@lararium/mesh";

import { waitHandle } from "@lararium/mesh";
import { holdVesselLock, ambientLocks, type LockHost } from "./vessel-lock.js";
import { BrowserCustodyRefused, CLEAR_CUSTODY_CLEARS, readBrowserCustody, onBrowserCustodyLock, lockBrowserCustody } from "./browser-custody.js";
import { clearCustodyVerb, standBrowserCustody, type CustodyAsk, type CustodyAnswer } from "./browser-boot-custody.js";
import { guardedBoot, type BootHold } from "./guarded-boot.js";
import { attachSharedHolder, holderWorkerHandle } from "./shared-holder.js";
import { browserSpawnWorker } from "./worker-handle.js";
// ── Bootstrap artifact (IDB-persisted) ──────────────────────────────────────────

const BOOTSTRAP_KEY  = "social-bootstrap";


interface BrowserBootstrap extends VesselBootstrap {
  personaGroupId:   string;
  meshCabalDocIdHex:     string;
  /** The signer DID — provenance only (the founding op-key = the persona-KEL inception op-key). */
  signerDid:             string;
  /** The persona-KEL identifier PREFIX (AID) the Binding Gate PINS — stable across every op-key rotation.
   *  The gate walks the per-Nexus KEL board to this prefix's current head and verifies the edge against it. */
  personaKelPrefix:      string;
  /** This vessel's self-signed device-delegation edge — the public binding the Binding Gate verifies. */
  deviceEdge:            DeviceDelegationTiddler;
  /** Cached self-certifying ContactCard JSON (founding) — the leaf identity a sealed crossing presents. */
  contactCard?:          string;
  /** The HEARTH's daemon url — the door this vessel knocks on for its seat. Null/absent when it founded
   *  its own face; such a vessel IS the hearth. Persisted at admission, re-read on every later boot. */
  hearthDaemonUrl?:      string | null;
  /** The gate key of the HEARTH that admitted this vessel, as its admit named it. Null/absent when the vessel
   *  founded its own face. A crossing pinned to this key reaches the vessel's own hearth (`hearth-canon`). */
  hearthGatePubKey?:     string | null;
  /** The hearth's FULL sovereign sync pin its admit carried (the pin whose `signingKey` is `hearthGatePubKey`): what the relay dial files in the pair index and knocks with. */
  hearthGatePin?:        GateBundlePin | null;
  /** The hearth's FLOOR pins at that pin's Nexus, which the root-signed fleet-join answer carried (house ruling "Floor
   *  pins", carrier (b)): the oracle read at the vessel's own hearth files them beside the sovereign pin. */
  hearthFloorPins?:      readonly GateBundlePin[] | null;
  /** The canon documents that hearth's admit named (canon title → document url). A crossing to the vessel's
   *  own hearth federates exactly these, and the vessel's oracle replica points at them. */
  hearthCanonDocs?:      HearthCanonDocs;
}

// The oracle doc needs no IDB rendezvous key: it lives under the DETERMINISTIC
// doc id (oracleGenesisDocUrl), so a reboot RELOADS it by find-first from IndexedDB and
// a peer SYNCS the same address — no stored island-doc-url, mirroring the node path.
interface BootKeyReads {
  bootstrap:       BrowserBootstrap | undefined;
  catalogUrl:      string | undefined;
}

async function readBootKeys(idbName: string): Promise<BootKeyReads> {
  const idb = await openVesselIdb(idbName);
  try {
    const [bootstrap, catalogUrl] = await Promise.all([
      idbGet<BrowserBootstrap>(idb, "bootstrap", BOOTSTRAP_KEY),
      idbGet<string>(idb, "keystore", "catalog-url"),
    ]);
    return { bootstrap, catalogUrl };
  } finally {
    idb.close();
  }
}

interface BootKeyWrites { bootstrap?: BrowserBootstrap; catalogUrl?: string }

async function writeBootKeys(idbName: string, writes: BootKeyWrites): Promise<void> {
  if (!writes.bootstrap && !writes.catalogUrl) return;
  const idb = await openVesselIdb(idbName);
  try {
    await Promise.all([
      ...(writes.bootstrap  ? [idbPut(idb, "bootstrap", BOOTSTRAP_KEY,  writes.bootstrap)]  : []),
      ...(writes.catalogUrl ? [idbPut(idb, "keystore",  "catalog-url",  writes.catalogUrl)] : []),
    ]);
  } finally {
    idb.close();
  }
}

// ── Options / Result ────────────────────────────────────────────────────────────

export interface BrowserVesselOptions extends LarariumVesselOptions {
  idbName?:        string;
  /** The Web Locks host the one-holder-per-store law rides; the platform's own when omitted (the test door). */
  locks?:          LockHost | null;
  displayName?:    string;
  /**
   * The PLAIN-DATA genesis seed (seed.json) — the oracle doc's initial state the
   * boot MATERIALIZES fresh under the deterministic doc id (the node-parity materialize-fresh
   * path). REQUIRED on first boot; a reboot
   * reloads the persisted oracle doc by find-first, a peer syncs it — neither needs the seed.
   */
  genesisSeed?:    GenesisSeed;
  /** Base URL the genesis static host serves (seed + cas/ live under it). */
  genesisCasBaseUrl?:   string;
  /** Relay gate URL (ws://host:port/ws) to dial for the node↔browser spore crossing. When set (and
   *  a founding card is cached), the vessel composes the gate-dial transport (LarWSClientAdapter) and
   *  adds it to the Repo — the browser's outbound crossing. */
  relayUrl?:       string;
  /**
   * The sealed relay dial's three inputs, handed in by a rig: the pair index holding the full gate pin, the hex Nexus the
   * pin is filed under, and the face this page presents at the gate. Absent → the vessel's own index (filed from the
   * fleet join its face carries, and a floor card), the Nexus that join's pin names, and the presentation the joined face
   * composes (`browser-face-presentation`); a device with no face joined presents at no sovereign gate.
   */
  relayDial?: { readonly pins: HearthPinIndex; readonly nexus?: string; readonly presentation: BrowserFacePresentation };
  /**
   * The hearth's oracle floor card the arrival URL carried (`#floor=`, `hearthFloorCardText`): the oracle's floor pin and
   * the key its snapshot is signed under, carried by the person's own hand off the hearth's banner. A device standing at
   * the floor reads the oracle under it, faceless; the card seats no face and opens no sovereign gate. A torn card files
   * nothing and says so.
   */
  floorCard?: string;
  /**
   * The pinned relay addresses of the HERMS this vessel's PersonaGroup siblings meet through
   * (`ws://host:port#<gate key hex>`, two or more under distinct gate keys for tolerance) — leaf kind 3, a fleet in which no
   * vessel listens (`docs/pono/identity-slot-policy#/the-leaf-taxonomy`). PRESENT and a face stands → the vessel
   * stands its sibling channel (`standSiblingChannel`, the one composition the node vessel calls too): siblings
   * prove their device edges to each other through every herm and sync over the session the proof binds, and
   * every herm carries the KEL successor drops the leaf catches up from. ONE herm stands it DEGRADED: withholding
   * cannot be tolerated through one herm, said on every dial and in `siblingChannel()`. An address that pins no gate
   * key refuses the channel, said alike. Either way the rest of the vessel boots. ABSENT → no sibling channel stands.
   */
  siblingHerms?: readonly string[];
  /**
   * A `device-admit/v1` payload — this vessel JOINS an existing PersonaGroup instead of FOUNDING its
   * own. The founder's root signed it, so it is self-verifying and CARRIAGE-AGNOSTIC: it may arrive by
   * QR, by paste, by a URL fragment (which never reaches a server), by a file on a stick. It is DATA,
   * never a fetch — a vessel that had to ASK a server for its own admission would be a client
   * petitioning an authority, and it would need that authority REACHABLE at the moment of asking, which
   * is a global now this house does not have.
   *
   * Absent, the vessel founds its own group (an anon at the floor) — which is a correct outcome, not a
   * failure. Present, `runApplyAdmitPayload` seeds this vessel's OWN sovereign social docs and adopts
   * the founder's persona doc (membership crosses; the daemon bag stays sovereign-per-vessel).
   */
  admit?:           CarriedAdmitPayload;
  /**
   * A carried hosting invite (`lar-invite:…`, membership-doctrine #/the-invite) — a bearer token minted by the
   * hearth whose gate key it names, CARRIED and never fetched (paste, QR, URL fragment). It is written to this
   * vessel's own IndexedDB BEFORE any dial and redeemed at that hearth's OWN gate, which burns it; the grant
   * the hearth pushes back is kept, and the invite settles once a dial presenting that grant stands. Later
   * boots present the grant. An invite for another gate, or a torn string, is no invite. ABSENT, a vessel
   * holding a grant for the dialed hearth walks on it; holding none, it crosses only as its own credentials
   * stand there (a fleet edge), and otherwise meets silence and stays at its own floor.
   */
  walkInvite?:      string;
  /** URL of the compiled browser daemon island Worker script. */
  daemonWorkerUrl?: URL;
  /**
   * URL of the compiled shared-holder SharedWorker script (shared-holder.worker.ts). PRESENT and the engine offers
   * `SharedWorker` → the daemon island stands ONCE per origin inside the holder and this tab ATTACHES over a
   * MessagePort; the holder holds the Web Lock, so a second tab attaches rather than refusing. ABSENT, or an
   * engine without SharedWorker → the floor: the dedicated-worker path exactly as before.
   */
  sharedHolderUrl?: URL;
  /** How long a failed boot waits on each thing it stood to come down before it reads as one that will not (default 5000). */
  teardownBudgetMs?: number;
  /**
   * This tab's custody door to the person (operator ruling 2026-10-18: each tab asks for its own unlock). A verb that
   * mints a face secret asks here for the first slot (`persona-mint`); `custody-clear` asks here for the route that
   * opens the slot it clears. Absent, both verbs refuse by name: no credential rides a verb's arguments or a tiddler.
   */
  askCustody?: (question: CustodyAsk | { readonly kind: "clear" }) => Promise<CustodyAnswer>;
  /** URL of the compiled browser wiki Worker script. */
  workerScriptUrl?: URL;
  /** Camera sink: a keyed `lar:frame` from the gated surface, named by its transport id. */
  onFrame?:         (frame: ProjectionSurfaceFrame) => void;
  /** Answer rail: a `lar:control-result`; the page correlates it by event id. */
  onControlResult?: (surface: string, result: LarMsg_ControlResult) => void;
  /** Coherence-nalu sink: a `coherence:frame` (the wiki's own consistency-radius read as an indicator
   *  frame) from the hot wiki island. The web surface applies it to a DOM coherence indicator via
   *  The web surface's DOM sink may render it over the tiddler-view. */
  onCoherence?:    (frame: CoherenceFrameWithRev) => void;
  /**
   * Mesh-LEAF standing — the browser carries-in the FLOW-map as a LEAF: it navigates
   * the mesh (pulls peers' public meshpalace docs + re-ranks by l-space proximity) WITHOUT serving or
   * dialing. A browser holds no listening socket, so a leaf advertises NO endpoint and seeds no
   * self-dial (`deriveMeshLeaf` → no endpoint; `meshSelfSeed` → []). The mirror of the node's `meshSelf`,
   * the leaf tier. ABSENT → the browser composes NO carriage (exactly today's behavior). PRESENT → it
   * carries-in via the read-face fetch (isomorphic global `fetch`; the peers' read-faces serve CORS `*`).
   */
  meshLeaf?: {
    /** A stable self-identifier (the vessel's origin / relay URL) hashed to the leaf's chart coord +
     *  bearing — content-blind, names where this leaf sits on the routing chart. */
    coordSeed: string;
    /** Bootstrap peers the leaf carries-in from — each read-face base URL (`https://…`) with the gate key it
     *  pins there; the carriage UNIONs these with the dials it discovers off the carried FLOW-map. */
    peers:     readonly MeshPeer[];
    /** Optional radial standing override (default 1 — a rim leaf). */
    radius?:   number;
    /** Max peer read-faces pulled per carriage cycle (default 16). */
    maxFanout?: number;
  };
}

/** The surface id the daemon owns in the uniform pin-selector — distinct from any pool wiki slug. Pass it to
 *  `setActiveSurface` to summon the daemon; pass a wiki slug to surface that wiki. It's all the same VM. */
// THE SENTINEL IS THE SLUG — one string, no decoding at any boundary, so no call site can decode it
// wrongly. A sentinel that differs from the slug buys a translation everywhere the two must meet.
export const DAEMON_SURFACE_ID = "daemon";

/** A keyed `lar:frame` plus the SURFACE (transport id) whose island emitted it. */
export type ProjectionSurfaceFrame = LarMsg_Frame & { readonly surface: string };

/** The ONE shared VesselResult (no vessel-by-type) + browser's one substrate extra. */
export interface BrowserVesselResult extends VesselResult<BrowserVesselIslandPool, DaemonVmCore> {
  /** The public identity receipt composed by this vessel. Private signing material never leaves the vessel. */
  identity: BrowserVesselIdentity;
  /**
   * Has this vessel crossed? True once the hearth it dials answered with a verdict signed by the pinned gate key
   * (a fleet device, a contracted member, or a walker); false while it has not — never pinned, unanswered, or
   * met with silence. Either way the vessel booted: standing at its own floor is a correct outcome.
   */
  crossed: () => boolean;
  /** Reactive crossing snapshot for the served page; peer identity carries the pinned gate key. */
  connectionState: BrowserConnectionState;
  /** The sibling channel as it stands — null when no channel was configured, its refusal when it refuses to stand. */
  siblingChannel: () => SiblingChannelStatus | null;
  /**
   * Hand out one invite from this walker's wallet at the hearth it dials — the oldest unspent token, removed
   * before it returns, as the one `lar-invite:` string to carry. Null when the wallet holds none (or this vessel
   * walks nowhere). Nothing records whom it went to.
   */
  handOutInvite: () => Promise<string | null>;
  /**
   * Hand the hearth this walker dials one document to CARRY, sealed under the walker's own carry secret: the
   * hearth holds ciphertext it cannot open, and the receipt stays on this device. Carriage is a convenience the
   * hearth may reclaim under its own pressure (with notice first) — this vessel's own PersonaGroup holds the
   * durable copy. Null when this vessel walks nowhere or the hearth answers nothing in `withinMs`.
   */
  carryAtHearth: (plaintext: Uint8Array, withinMs: number) => Promise<CarryOutcome>;
  /** Fetch a carried document back by its cid and open it; null when the hearth answers nothing in `withinMs`. */
  fetchFromHearth: (cid: string, withinMs: number) => Promise<Uint8Array | null>;
  /** Read a peer's oracle read-face at `baseUrl`, proving this vessel's own key at the peer's gate first (peers
   *  prove first; a stranger reads nothing). The signing seed never leaves the vessel. */
  readOracle: <T = unknown>(baseUrl: string, gatePubKey: string) => Promise<OraclePullResult<T>>;
  /** Relay a `lar:control-event` to the surface that PAINTED its target, whatever surface stands active. */
  sendControlEvent: (surface: string, ev: LarMsg_ControlEvent) => ReturnLegVerdict;
  /** Ask a surface's island to paint whole under a fresh mount epoch (`lar:resend`). */
  resend: (surface: string) => ReturnLegVerdict;
  /** The uniform pin-selector: flip which VM owns the singleton #projection sink. DAEMON_SURFACE_ID summons the
   *  daemon; a wiki slug surfaces that wiki. LIVE (synchronous gate flip); the durable bags/daemon/active-wiki
   *  marker persists fire-and-forget, consulted only at next cold boot ("live process state is the boundary"). */
  setActiveSurface: (surfaceId: string) => void;
}

/**
 * Load a PREVIOUSLY-FOUNDED catalog doc by its persisted url — and never re-found it SILENTLY. A stored
 * catalogUrl means this vessel already founded + persisted a catalog; a find() rejection here means the
 * LOCAL copy is gone (IndexedDB quota eviction under storage pressure, or corruption). Re-founding a
 * BLANK catalog in that case is data-amnesia — every registered wiki/recipe vanishes from local view
 * with no trace. So we surface the loss LOUD (never a bare `catch`→blank) before recovering with a fresh
 * blank catalog, so the vessel still boots but the operator SEES the amnesia. (First boot — no stored
 * url — never reaches here; that founding is legitimate.)
 */
export async function loadFoundedCatalogOrWarn<T>(
  repo: Repo,
  url: string,
  refound: () => DocHandle<T>,
  onLoud: (msg: string) => void = (m) => console.error(m),
): Promise<DocHandle<T>> {
  try {
    return await repo.find<T>(url as AutomergeUrl);
  } catch (err) {
    onLoud(
      `[lararium-browser] DATA-AMNESIA: the persisted catalog doc (${url}) FAILED to load — its local ` +
      `copy is gone (IndexedDB quota eviction or corruption). Founding a BLANK catalog so the vessel ` +
      `boots; previously-registered wikis/recipes are ABSENT locally until a peer re-sync restores ` +
      `them. This is NOT a silent discard — repair or re-admit before relying on local catalog state: ${String(err)}`,
    );
    return refound();
  }
}

/**
 * A browser wiki-alert had no live target and no durable mailbox — surface the drop LOUD. The browser
 * holds no park (unlike node), so an un-deliverable operator alert would otherwise vanish invisibly.
 * The console is the browser's observability floor: a warn keeps the drop legible.
 */
export function warnDroppedBrowserAlert(
  wikiSlug: string,
  message: string,
  cause: string | undefined,
  reason: string,
  onWarn: (msg: string) => void = (m) => console.warn(m),
): void {
  onWarn(
    `[lararium-browser] wiki-alert DROPPED (${reason}) for "${wikiSlug}" — no durable browser mailbox: ` +
    `${message}${cause ? ` (cause: ${cause})` : ""}`,
  );
}

/**
 * R4 — "plugins load by recipe" (browser). Resolves ONE island's final manifest `pluginCids`:
 * the fixed boot-set floor (grammar + boot shadows, read off the island/oracle doc's own blobs)
 * UNION this wiki's own recipe's verified, byte-checked offering selection. The browser's exact
 * mirror of node's `resolveNodeIslandPluginCids` — same selector, same CAS-bytes codes — over the
 * ONE substrate divergence: the byte check reads OPFS (`readCasBlobFromOpfs`, inherently async),
 * so this resolver verifies through `verifyCasBytesAsync` rather than node's sync form.
 *
 * Fail-closed throughout, in order: an offering this lookup cannot find, a lying lookup, a
 * boot-set-collision or cross-offering duplicate claim, or any `verifyPluginOffering` code
 * (`selectPluginBlobs`) refuses first; only THEN does a selected CID's bytes get checked against
 * the local OPFS CAS — missing or corrupt bytes refuse by name, never silently as an empty or
 * trimmed set. The daemon VM and the island pool both resolve THROUGH this function (M6).
 */
export async function resolveBrowserIslandPluginCids(opts: {
  readonly islandBlobs: Record<string, { readonly id?: string; readonly sha256?: string; readonly mimeType?: string }> | undefined;
  readonly recipe: WikiRecipe;
  readonly lookup: OfferingLookup;
}): Promise<{ readonly ok: true; readonly pluginCids: readonly string[] } | { readonly ok: false; readonly error: string }> {
  // The selection itself stands in mesh (`resolveRecipePluginCids`), the one function the node door and the
  // surface mount's resolver read too; this door hands it the browser's own inputs: the island document's
  // blobs, the Crossroads lookup and the origin's OPFS content store.
  return resolveRecipePluginCids(opts.recipe, { islandBlobs: opts.islandBlobs, lookup: opts.lookup, readBytes: readCasBlobFromOpfs });
}

/** Build the browser Crossroads board's offering lookup (R4): a verified selection re-verifies
 *  every offering it resolves (`selectPluginBlobs` → `verifyPluginOffering`), so this lookup
 *  stays a shape-only projection (`offeringAnnouncesFromDoc`) — never a second, redundant certify
 *  pass. The exact mirror of node's `nodeOfferingLookup`. */
export function browserOfferingLookup(crossroadsDoc: LarDoc | undefined | null): OfferingLookup {
  const byOfferingCid = new Map(offeringAnnouncesFromDoc(crossroadsDoc).map((a) => [a.offeringCid, a.offering]));
  return (cid) => byOfferingCid.get(cid);
}

export async function openBrowserVessel(opts: BrowserVesselOptions): Promise<BrowserVesselResult> {
  // THE LOCK LIVES AS LONG AS THE BOOT STANDS: a boot that throws takes down what it stood (the Repo, the relay adapter, the
  // shared-holder port, the daemon worker) and THEN gives the lock back, so a refused boot (`sealed-locked` and the rest)
  // can retry in the same page over one copy of the store. A boot that cannot take its things down keeps the lock and
  // refuses by name (`BootTeardownRefusal`). A booted vessel keeps both.
  const held: BootHold = { lock: null, stood: [] };
  return guardedBoot(held, () => bootUnderLock(opts, held), opts.teardownBudgetMs);
}

async function bootUnderLock(opts: BrowserVesselOptions, held: BootHold): Promise<BrowserVesselResult> {
  const {
    wikiId,
    idbName = "lares:vessel", displayName, onPhase,
    genesisSeed,
    genesisCasBaseUrl,
    daemonWorkerUrl, sharedHolderUrl, workerScriptUrl, onFrame, onControlResult, onCoherence, relayUrl, relayDial, floorCard,
    meshLeaf, admit, walkInvite, siblingHerms,
  } = opts;
  const emit = (p: LarOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── One holder per store — the single-owner law across tabs ─────────────────
  // A second tab on this origin would stand a second repo and a second keyhive provider over ONE
  // IndexedDB store and ONE OPFS CAS. The Web Lock refuses that open LOUD, naming the holder; it stays
  // held for this page's life and the browser lets go when the page does. An engine without Web Locks
  // refuses the open by name (`holdVesselLock`): one holder per store cannot be proven there. `steal` never passes.
  //
  // THE HOUSE BEHIND THE LOCK (opt-in): with a shared holder configured and `SharedWorker` on the engine, the
  // holder owns the one daemon island and the lock; this tab attaches. The one refusal that opens is a lock
  // held by THAT holder — any other client still refuses loud.
  const holder = (sharedHolderUrl && daemonWorkerUrl)
    ? await attachSharedHolder({ holderUrl: sharedHolderUrl })
    : null;
  if (holder?.kind === "floor") console.log(`[vessel] shared holder floor: ${holder.why}`);
  const lockHold = await holdVesselLock(idbName, opts.locks === undefined ? ambientLocks() : opts.locks, { attachToHolder: holder?.kind === "attached" ? holder.hello.lockClientId : null });
  held.lock = lockHold;
  if (holder?.kind === "attached") held.stood.push({ what: "shared holder port", down: () => holder.port.close() });
  if (lockHold.attached) console.log(`[vessel] attached to the shared holder (${lockHold.holder}); island boots ${holder?.kind === "attached" ? holder.hello.islandBoots : "?"}, tabs ${holder?.kind === "attached" ? holder.hello.tabs : "?"}`);

  // A SEALED KEYSTORE THIS TAB HOLDS NO UNLOCK FOR REFUSES BEFORE ANYTHING STANDS BESIDE THE LOCK: no Repo opens over
  // a store whose boot cannot read its own device seed, so the refusal gives the lock back with nothing to take
  // down (each tab unlocks for itself, operator ruling 2026-10-18; `standBrowserCustody` asks before this boot).
  const custodyAtBoot = await readBrowserCustody(idbName);
  if (custodyAtBoot.reading === "sealed" && !custodyAtBoot.unlocked) throw new BrowserCustodyRefused("sealed-locked", idbName, "vessel-key");

  // ── Repo — IndexedDB-backed (substrate) ────────────────────────────────────
  // The federation ring split. This vessel's own islands (daemon + wiki workers) sync over
  // MessageChannel and are house members — they share freely. The spore crossing (below) may add
  // a WS *relay* adapter reaching the wider Nexus; a relay peer must NOT be volunteered every
  // sovereign doc. `relayPeers` tags exactly the peers that arrive via the relay adapter (the
  // adapter-scoped peer-candidate is unambiguous — no socket-map inference), and `fedGate`
  // (a DENY-BY-DEFAULT FederationGate) is armed ONLY for a cross-operator crossing. Absent a
  // gate the relay is the operator's OWN node (same-operator leaf, own DID) → full device sync.
  const relayPeers = new Set<string>();
  let   fedGate: FederationGate | null = null;
  // THE SIBLINGS — peers this face's sibling channel PROVED (below, once the KEL is walked). A sibling holds
  // standing, never the house: it never shares freely, and only `siblingGate` (the ring's sibling path over the
  // public boards) decides what reaches it. Null denies every doc.
  let   siblings: SiblingNetworkAdapter | null = null;
  let   siblingGate: FederationGate | null = null;
  // ONE SOCKET, ONE RING. The PersonaGroup identity ring composes ONTO `fedGate` itself (the assembly
  // below, once the daemon island boots), so the share verdict reads one gate and the ring has no second
  // socket to stand empty in.
  // The fleet's shadows as this leaf last read them. Null until the first read lands: a sibling then reads as
  // aside (fail closed), and no sibling channel stands that early.
  let fleetShadows: { readonly root: string; readonly readings: ReadonlyMap<string, EdgeReading>; readonly rolled: ReadonlySet<string> } | null = null;
  let fleetBoardFollowed = false;
  // The leaf's fleet reading guards sibling sync. The daemon island reads its own board for gate asks.
  const bareKey = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");
  // The reading goes dark when the board moves until the new fold lands.
  let fleetRead: Promise<void> | null = null;
  let fleetMoves = 0;
  const siblingAside = (peerId: string): boolean => {
    const key = siblings?.provenKeyOf(peerId as PeerId);
    if (!key) return false;                       // no sibling behind this id: the sibling lane never reads it
    if (!fleetShadows) return true;
    return fleetShadows.readings.get(deviceEdgeId(fleetShadows.root, key))?.stands === true;
  };
  const repo = new Repo({
    storage:     new IndexedDBStorageAdapter(`${idbName}:repo`),
    // The verdict seats on announce AND access (the announce-only lie the node measured in
    // share-policy-is-access.test.ts); `browserShareConfig` composes it through mesh's one law.
    // The gate rides by READER: it arms at the spore crossing below, after this Repo stands.
    shareConfig: browserShareConfig(relayPeers, () => fedGate, {
      isSibling: (peerId) => Boolean(siblings?.provenKeyOf(peerId as PeerId)),
      gate: () => siblingGate,
      // THE DYAD'S SHADOW (kapae#/reach): a sibling whose device the fleet root set aside reaches nothing.
      aside: (peerId) => siblingAside(peerId),
    }),
  });
  held.stood.push({ what: "repo", down: () => repo.shutdown() });
  emit("repo-open");

  // ── Keypair (WebCrypto substrate) + founding (the personaGroup capability) ───
  const vesselIdentity = await generateOrLoadBrowserVesselIdentity(idbName, displayName);
  const vesselSeed     = await loadBrowserSigningSeed(idbName);
  const vesselVerifyingKey      = vesselIdentity.verifyingKey;

  // ── THE ISLAND THIS LEAF STANDS IN — the SAME mesh ruling the node composes ──────────────────────────
  // Isomorphic by intent (`nexusIdentity`, @lararium/mesh): one ruling, every vessel class. A leaf supplies an
  // ANCHOR and never a charter — structurally, not by choice: seating a charter reaches a SEAL HOME on disk and
  // a leaf keeps none — so the anchor term decides here and the ordering never gets to argue. The three states
  // read the same as they do on a node: an anchor dialled → the hearth's island; NO anchor → this vessel's own
  // key as a PRIVATE NEXUS OF ONE (coherent — stage one of a lifecycle, since crossing later is a first-class
  // flow); an anchor key that reads as no key → TORN, and the resolver refuses rather than quietly composing a
  // private board under the name of the crossroads.
  //
  // ⚠ CONNECTING MOVES THE BOARD, and this leaf BRICKED on it. `nexusScopeMoved` names the shape: climbing
  // re-keys every per-Nexus board and nothing carries across on its own. The gate below
  // ("a chain the replica does not carry HALTS the boot") REFUSES rather than degrades, so the ordinary
  // leaf walk — found offline at a private nexus of one, then configure the hearth the page dials, then
  // reload — left a vessel that never opened again. The leaf is the WORSE half of the pair the node
  // measured: a node operator holds `--force` and a re-found, while a leaf's anchor key arrives from the
  // page's own configuration, so no knob exists for the operator to turn.
  //
  // ONE statement of the inputs, for the reason the node boot records: the resolution reads them and so do
  // both CARRIES below, and a second copy of this object would drift from the first the day a term is
  // added — the carries would then read a gradient the boot does not stand on.
  //
  // A LEAF PASSES THREE TERMS AND NO MORE. It supplies `explicitScope` off the Nexus it WALKS in — a carried
  // invite, or a grant it already holds for the hearth it dials — the only shore that does, which makes this the
  // only boot whose gradient runs three rungs deep (own → anchor → explicit). It passes NO `genesisEpochCid`
  // and NO `charterStands`: seating a charter reaches a SEAL HOME on disk and a leaf keeps none, so those terms
  // are structurally absent rather than merely unset.
  //
  // THE WALK, read before the island resolves. A carried invite names the hearth that minted it, and is written
  // DURABLY to this vessel's own store before any dial; with no invite, no walk stands.
  const gatePins = relayDial?.pins ?? browserGatePins();
  const walkStore = browserWalkStore(idbName);
  const walked = relayUrl && walkInvite ? await takeInvite(walkStore, walkInvite) : null;
  if (relayUrl && walkInvite && walked === null) console.warn("[lararium-browser] the carried invite does not read — no walk stands");
  const walk: WalkRecord | null = walked?.record ?? null;
  // A leaf names no anchor: a joined face's island rides its admit, and a device at the floor stands on its own key.
  const nexusStandsAt: NexusIdentityAt = {
    explicitScope: walk?.nexusAid ?? null,
    anchorGateKey: null,
    ownVesselKey:  vesselVerifyingKey,
  };
  // AN ADMIT CARRIES THE FOUNDER'S RESOLVED ISLAND — a SNAPSHOT (`hearthIslandKind`/`hearthIslandScope`) of what
  // the founder itself stood on at mint time. A CLIMBED founder's admitted leaf reads the island its founder stands
  // on, never `kind: "anchor"` off a raw gate key: the node's own admit door reads the same ruling
  // (`admittedJoineeIsland`, `@lararium/mesh`), which is PURE and platform-blind, so this leaf composes the SAME
  // ruling the node's `init.ts` does, not a second reading of it.
  let nexusPubkey: string;
  if (admit) {
    // The node must carry the island relation it resolved at admission. Without both fields this
    // browser would silently derive its own island and mount a private recipe plane under a face
    // that the hearth believes joined its shared one.
    requireAdmittedFaceIsland(admit);
    nexusPubkey = admittedJoineeIsland({
      hearthGatePubKey:  admit.hearthGatePubKey,
      hearthIslandKind:  admit.hearthIslandKind,
      hearthIslandScope: admit.hearthIslandScope,
      ownVesselKey:      vesselVerifyingKey,
    });
    console.log(`[lararium-browser] island ${nexusPubkey.slice(0, 18)}… (admitted — the founder's resolved `
      + `island at mint time, kind=${admit.hearthIslandKind})`);
  } else {
    const nexusStanding = nexusIdentity(nexusStandsAt);
    nexusPubkey = nexusScopeOrThrow(nexusStanding);
    console.log(`[lararium-browser] island ${nexusPubkey.slice(0, 18)}… (${nexusStanding.kind}${nexusStanding.shared ? ", shared" : ""}) — ${nexusStanding.reading}`);
  }

  // ── THE CLIMB, at the leaf — the boards a moved island would otherwise leave behind ──────────────────
  // `climbNexusBoards` lives in `@lararium/mesh` so both shores share it: a browser leaf climbing from its own
  // island to the anchor it dials composes the identical call. The ANTIGEN fails OPEN when it mints blank —
  // "an empty antigen bans nobody" means a Kapae'd presenter gets RE-ADMITTED — so the boot carries it.
  // An edge shadow rides no Nexus key (a realm's board, a fleet's board), so a climb re-keys none of them.
  //
  // THE CROSSROADS RE-ANNOUNCE STANDS INERT HERE, and that reads as the leaf's shape rather than a gap:
  // `nexusAidOf(readNexusDoc(sealHome))` has no analogue, because a leaf keeps no seal home and so
  // holds no charter, and a realm exists only where a charter does. `reAnnounceRealmBooksAtIsland` answers
  // "a vessel outside every realm announces nothing — it registers nothing either", so `null` states the
  // fact. Borrowing some other id would announce ANOTHER realm's books onto this island, which is exactly
  // the foreign-realm laundering the re-announce exists to refuse.
  //
  // WHO and carriage stay exactly where they are — `nexus-board-climb`'s header carries each reason,
  // and the first is sharpest AT A LEAF: a leaf's own island IS a private nexus of one, so re-landing a card
  // announced there would DISCLOSE a face to strangers the operator never published to. Passing a fourth
  // board here compiles an about-set at a new address; read that header before adding one.
  //
  // UNCONDITIONAL and at the boot's own depth, deliberately outside every face guard: a faceless leaf holds
  // shadows and an antigen too. It also runs ahead of any network adapter, so nothing leaves this vessel.
  // Climb-only and idempotent by construction — every source comes from `nexusIslandsBelow` (empty at the
  // bottom, empty when torn), and every act writes only what the destination LACKS.
  await climbNexusBoards({
    repo, nexusPubkey,
    priorIslands: nexusIslandsBelow(nexusStandsAt),
    realmId:      null,   // a leaf keeps no seal home → no charter → no realm to re-announce
  });

  const bootKeys = await readBootKeys(idbName);
  const bootKeyWrites: BootKeyWrites = {};
  let bootstrap = bootKeys.bootstrap;
  // AN ADMIT SUPERSEDES AN ANON BOOTSTRAP. A vessel MUST boot anon first — it needs a key before anyone
  // can admit that key — so the admit ALWAYS arrives at a vessel that already founded its own group. The
  // anon founding is not a competing state; it is the FLOOR the admit lifts the vessel from. Gating the
  // admit behind `!bootstrap` therefore ignores every admit that will ever arrive.
  // A FOUNDED VESSEL STANDS ONLY OVER ITS ARCHIVE. A bootstrap with no Archive beside it names a vessel whose
  // individual could seal nothing into what it created; the boot refuses by row name before anything composes.
  // An admit replaces the bootstrap and writes the row itself, so it passes.
  if (bootstrap && !admit) await requireBrowserKeyhiveArchive(idbName);
  if (admit) {
    // JOIN. The founder's root already signed this vessel's edge, so the ceremony here ADOPTS a binding
    // rather than minting one: `runApplyAdmitPayload` seeds this vessel's OWN sovereign social docs and
    // takes the founder's persona doc (membership crosses; the daemon bag stays sovereign-per-vessel), then writes
    // the oracle tiddlers and cap events the boot gates read.
    //
    // The payload arrived as DATA — carried, never fetched — so this path runs with no network, no clock
    // and no server, which is also what makes it a pure function of its bytes and therefore testable.
    // It fails closed on a missing binding field: a half-bound daemon doc is the confused-deputy hole.
    const keptArchive = await loadBrowserKeyhiveArchive(idbName);
    // THE JOINEE'S ATOM: the random seed this browser holds for the face it joins (minted here, or the one a fleet-join
    // request already sealed in the face's own row). The edge the root signed delegates to its key, and the atom
    // countersigns its own half; this browser's device seed signs none of it.
    const atomSeed = await standBrowserFaceAtomSeed(idbName, admit.personaGroupId);
    let a: Awaited<ReturnType<typeof runApplyAdmitPayload>>;
    let placeArchive: Uint8Array;
    try {
      // The veil-archive row rests by handle index and the atom by PersonaGroup, so the row at h0 may hold another face's
      // Archive (a browser that founded solo as A, now admitted into B). B's hive restores only from an Archive that
      // belongs to B's atom; any other offers it nothing.
      const rowAtomArchive = await loadBrowserVeilArchive(idbName, FOUNDING_PERSONA_INDEX);
      const keptAtomArchive = rowAtomArchive && await archiveIsOf(atomSeed, rowAtomArchive) ? rowAtomArchive : undefined;
      const place = await foundThePlace({
        repo, vesselSeed, hearthTrueName: admit.hearthTrueName,
        // AN ADMIT OVER A KEPT ARCHIVE RESTORES FROM IT. The vessel founded on its own before any admit could reach it, so
        // an Archive already rests here; the individual stands again from it.
        ...(keptArchive ? { archiveBytes: keptArchive } : {}),
      });
      placeArchive = place.archive;
      a = await runApplyAdmitPayload({
        repo,
        daemonHandle:       place.daemonHandle,
        atomSeed,
        vesselDisplayName:  displayName ?? "Browser Operator",
        payload:              admit,
        // The ISLAND this leaf crosses into keys the KEL board — an admitted leaf seeds its inception onto the
        // board its HEARTH stands, never onto one only it resolves (a leaf alone on a board reads as agreement).
        nexusPubkey,
        ...(keptAtomArchive ? { archiveBytes: keptAtomArchive } : {}),
      });
    } finally { atomSeed.fill(0); }
    // The Archives rest before the bootstrap that names this admit: a boot that finds the bootstrap finds them. The
    // place's rests in the vessel row and the atom's in the face's veil row.
    await saveBrowserKeyhiveArchive(idbName, placeArchive);
    await saveBrowserVeilArchive(idbName, FOUNDING_PERSONA_INDEX, a.archive);
    bootstrap = {
      identitiesUrl: a.identitiesUrl, circlesUrl: a.circlesUrl, sessionsUrl: a.sessionsUrl,
      daemonUrl: a.daemonUrl, personaUrl: a.personaUrl, personaBagId: a.personaBagId,
      // The compartments this vessel carries. An admitted browser joins one today; the shape takes the
      // family so a second admission adds an entry rather than re-typing the boot path.
      personaPlanes: [{ personaGroupId: admit.personaGroupId, url: a.personaUrl }],
      personaGroupId: admit.personaGroupId,
      meshCabalDocIdHex: admit.meshCabalDocIdHex,
      // The PINNED identifier and the SIGNED edge ride from the payload, never from this vessel: an admitted
      // leaf presents a binding it could not have written for itself, and that is the whole difference
      // between joining a group and declaring one. The gate walks the KEL prefix to the current head.
      signerDid: admit.signerDid, personaKelPrefix: admit.personaKelPrefix, deviceEdge: a.deviceEdge,
      contactCard: a.contactCardJson,
      hearthDaemonUrl: a.hearthDaemonUrl,
      hearthGatePubKey: admit.hearthGatePubKey ?? null,
      hearthGatePin: admit.hearthGatePin ?? null,
      hearthFloorPins: admit.hearthFloorPins ?? null,
      hearthCanonDocs: admittedCanonDocs(admit.hearthCanonDocs, nexusPubkey),
    };
    bootKeyWrites.bootstrap = bootstrap;
  } else if (!bootstrap) {
    // FOUND. No admit — the vessel raises its own PersonaGroup and founds its FIRST persona (never the
    // self-signed floor). The two-key atom: the DEVICE key (vesselSeed) inits keyhive as the Individual;
    // a DISTINCT PersonaGroup ROOT signs the device-delegation edge. Mint that root founder-side (root-on-
    // founder), load its seed as the signer, and WEAR it — mirroring node's `lares vessel found` (init.ts: mint
    // generateOrLoadPersonaGroupRoot → loadPersonaGroupRootSeed → runFoundingCeremony{signerSeed}).
    // A ROOT MINTS ONLY OVER A SLOT: a keystore with no slot asks this tab's person to bind one first, and a boot
    // with no custody door refuses `no-custody-slot` at the mint, by name (#/rulings: a browser leaf holds a
    // passphrase or paper slot before it holds a persona root).
    if (opts.askCustody) {
      const custody = await standBrowserCustody({ idbName, ask: opts.askCustody, secretMintDue: true });
      if (custody.reading !== "bound" && custody.reading !== "opens" && custody.reading !== "held") {
        throw new BrowserCustodyRefused("no-custody-slot", idbName, `persona-root-h${String(FOUNDING_PERSONA_INDEX)}`, `the founding asked for a first slot and read ${custody.reading}`);
      }
    }
    await generateOrLoadBrowserPersonaRoot(idbName, FOUNDING_PERSONA_INDEX);
    const signerSeed = await loadBrowserPersonaRootSeed(idbName, FOUNDING_PERSONA_INDEX);
    await wearBrowserPersona(idbName, FOUNDING_PERSONA_INDEX);   // the selector points at the founded root
    const f = await runFoundingCeremony({
      repo, vesselSeed,
      vesselVerifyingKey: vesselIdentity.verifyingKey,
      vesselDisplayName:  displayName ?? "Browser Operator",
      // The persona-root SIGNS (signerDid == the root DID, DISTINCT from deviceDid). The self-signed anon
      // (signerSeed == vesselSeed) survives ONLY as an explicit named floor tier, never the default.
      binding: { mode: "self-stood", signerSeed },
      hearthTrueName: "",          // hearth-agnostic: an anon is not yet bound to a place; it binds on upgrade
      // The island this leaf stands in keys the KEL board. A FOUNDING leaf dials no anchor, so this resolves to
      // its own key — a private nexus of one, the same value by a different derivation.
      nexusPubkey,
    });
    // THE FACE'S ATOM RESTS BEFORE ITS BOOTSTRAP: the founding minted a random seed, and the face's own custody row keeps it.
    try { await keepBrowserFaceAtomSeed(idbName, f.personaGroupId, f.atomSeed); } finally { f.atomSeed.fill(0); }
    // THE FOUNDING'S ARCHIVES REST BEFORE ITS BOOTSTRAP. The ceremony's providers left with the act; the key
    // agreement state of what they created lives in these bytes alone. Veil first, then the vessel's own, then
    // (later, with the boot keys) the bootstrap that commits the founding: a founding that stops before its
    // bootstrap runs again whole and replaces both rows.
    await saveBrowserVeilArchive(idbName, FOUNDING_PERSONA_INDEX, f.veilArchive);
    await saveBrowserKeyhiveArchive(idbName, f.archive);
    bootstrap = {
      identitiesUrl: f.identitiesUrl, circlesUrl: f.circlesUrl, sessionsUrl: f.sessionsUrl, daemonUrl: f.daemonUrl, personaUrl: f.personaUrl, personaBagId: f.personaBagId,
      personaPlanes: [{ personaGroupId: f.personaGroupId, url: f.personaUrl }],
      personaGroupId: f.personaGroupId, meshCabalDocIdHex: f.meshCabalDocIdHex,
      signerDid: f.signerDid, personaKelPrefix: f.personaKelPrefix, deviceEdge: f.founderEdge,
      contactCard: f.contactCardJson,
      hearthDaemonUrl: null,   // a vessel that founded its own face IS the hearth
    };
    bootKeyWrites.bootstrap = bootstrap;
  }
  const social = bootstrap;   // narrowed (defined past this point)
  // A pin chooses which gate to knock; the local contact card supplies peer proof. Name the missing
  // proof here instead of leaving the page pinned while no adapter can stand.
  // THE PINS THE ADMIT CARRIED are filed in the ONE pair index under the hearth's name (the origin of the relay url: the
  // admit carries no other true name for it): the sovereign pin, and the floor pins at its Nexus the signed answer carried
  // (house ruling "The admit's gate pin", carrier (b)), so the oracle read at this hearth holds its pin before any crossing. The
  // verified sovereign crossing files the same set again (carrier (a)). A pin the index refuses files nothing.
  fileOwnHearthPins(gatePins, relayUrl, social);
  // THE FLOOR CARD the arrival URL carried files the oracle's floor pin beside them, at the floor tier alone: a device
  // with no face joined reads what the floor offers under it, and a pin the signed set already holds stays as it stood.
  const carriedCard = floorCard === undefined ? null : readHearthFloorCard(floorCard);
  if (floorCard !== undefined && carriedCard === null) console.warn("[lararium-browser] the floor card this URL carries does not read: no floor pin files from it");
  else if (carriedCard !== null && !fileFloorCardPin(gatePins, relayUrl, carriedCard) && relayUrl) {
    console.warn("[lararium-browser] the floor card names another oracle floor pin than the one this face's fleet join carried: the signed one stands");
  }
  // THE SOVEREIGN PIN this hearth's dial knocks with: the full pin filed for the relay's hearth at the Nexus the joined
  // face's fleet join names. Its signing key names the gate a verified crossing proves.
  const sovereignNexus = relayDial?.nexus ?? social.hearthGatePin?.nexus ?? (walk ? hex(new TextEncoder().encode(walk.nexusAid)) : null);
  const relayHeld = relayUrl && sovereignNexus !== null
    ? gatePins.get({ hearth: hearthNameOf(relayUrl), nexus: sovereignNexus, route: "/ws", tier: "sovereign" })
    : null;
  // THE FACE THIS SESSION WEARS. A device stands at the floor until a person joins a face to it (operator ruling,
  // 2026-10-16); the face its boot stands on carries a fleet join where a hearth admitted it, and that face composes its
  // presentation from what the join left in this browser's custody, under its own face-scoped key. A refusal names itself.
  const faceJoined = relayDial !== undefined || Boolean(social.hearthGatePin);
  const composed = relayDial !== undefined
    ? { presentation: relayDial.presentation }
    : relayHeld !== null && social.personaGroupId
      ? await composeBrowserFacePresentation({ idbName, pin: relayHeld, personaGroup: social.personaGroupId })
      : null;
  const facePresentation: BrowserFacePresentation | null = composed !== null && "presentation" in composed ? composed.presentation : null;
  const presentationRefusal = composed !== null && "refusal" in composed ? `${composed.refusal}${composed.detail ? `: ${composed.detail}` : ""}` : null;
  const connectionState = createBrowserConnectionState(crossingStandingOf({
    relayUrl, faceJoined, pinnedGateKey: relayHeld?.signingKey ?? null, presentationRefusal, hasContactCard: Boolean(social.contactCard),
  }));
  // THE OWN-HEARTH CROSSING: the pinned gate names the hearth whose admit this vessel carries. Such a leaf
  // takes that hearth's base canon (`hearth-canon`); every other crossing reads the public boards alone.
  // The gate this crossing pins: the sovereign pin's signing key, the key a verified crossing proves.
  const pinnedGateKey = relayHeld?.signingKey ?? null;
  // A crossing pinned to a gate by the sovereign pin: its boards and WHO plane stand.
  const relayGated = pinnedGateKey !== null;
  const crossing = hearthCrossingOf({
    pinnedGatePubKey: pinnedGateKey,
    hearthGatePubKey: social.hearthGatePubKey,
    holdsDeviceEdge:  Boolean(social.deviceEdge),
    hearthCanonDocs:  social.hearthCanonDocs,
    nexusPubkey,
  });
  const { ownHearth } = crossing;
  // The canon documents the admit named. The own-hearth gate opens exactly these, and this vessel's own oracle
  // replica points at them; the oracle plane itself stays behind the gate.
  const { hearthCanon } = crossing;
  // The oracle doc as this boot holds it: the recipe reader reads a system wiki's default recipe off it. Null
  // until genesis loads.
  let oracleAtBoot: DocHandle<LarDoc> | null = null;
  // THE PROOF THIS VESSEL CARRIES TO A PEER'S ORACLE. Peers prove first: an oracle map crosses only a socket
  // whose dialer passed the peer's gate, so the carriage and the page's reader prove this vessel's own key and
  // founding card there. The seed stays inside this closure. No card cached → nothing to prove with.
  // The proof a browser carries is its FACE's: the atom signs it, and the card is the atom's. The device seed signs none.
  const oracleAtomSeed = social.contactCard ? await requireBrowserFaceAtomSeed(idbName, social.personaGroupId) : null;
  const oracleAtom = oracleAtomSeed ? faceAtomKeyFromSeed(oracleAtomSeed, social.personaGroupId) : null;
  oracleAtomSeed?.fill(0);
  const oracleProof: LeafIdentity | undefined = social.contactCard && oracleAtom
    ? { arm: "face", contactCard: social.contactCard, peerPubKey: oracleAtom.key, sign: oracleAtom.sign }
    : undefined;

  // ── THE RELATIONSHIPS THIS VESSEL HOLDS — read live at boot (dyad read path) ────────────────
  // The SAME observation node's `openDaemon` makes, through the same platform-blind door
  // (`vesselDyads`, mesh): the ceremony-minted slots are the only source, and a face standing
  // beside zero slots is a doc minted before the ruling — said aloud here, warned never thrown.
  // Every vessel class inherits this read verbatim; the pattern integrity is the ONE door.
  // The daemon doc AS THIS BOOT READS IT, kept for the sibling channel's enrolment seal and lease epoch below.
  let bootDaemonDoc: LarDoc | undefined;
  try {
    const dhandle = await repo.find<LarDoc>(social.daemonUrl as never);
    bootDaemonDoc = dhandle.doc();
    const dyads = vesselDyads(dhandle.doc());
    if (social.deviceEdge && dyads.length === 0) {
      console.log("[dyad] a face stands and no dyad slot is minted — a pre-ruling daemon doc; re-found or admit to mint the derived veil.");
    } else if (dyads.length > 0) {
      const boundCount = dyads.filter((d) => d.binding !== null).length;
      // THE DYAD SCOPE READS HERE: a binding counts as this hearth's only where it verifies under the fleet root the
      // leaf's edge names AND roots on the hearth that edge binds.
      const edge = social.deviceEdge;
      const atHearth = edge?.personaRootDid && edge.hearthTrueName
        ? (await verifiedFleetOfGroup(dyads, edge.personaRootDid as LarDid, new Set(), edge.hearthTrueName)).length
        : 0;
      console.log(`[dyad] this vessel holds ${dyads.length} relationship(s), ${boundCount} bound, ${atHearth} verified at this hearth.`);
    }
  } catch { /* the observation never blocks a boot — a torn read stays a torn read */ }

  // ── The spore crossing — the outbound leaf transport (opt-in via relayUrl) ─────────────────
  // When a relay URL is given AND a founding card is cached, compose the platform-blind
  // LarWSClientAdapter and add it to the Repo: the browser dials the node's gate, runs the gate's
  // Noise exchange on the socket, and — on a passing verdict — syncs shared docs (the second spore).
  // FLOW ⊥ AUTHORITY: this is pure authority+sync; the nalu servo / ea-backpressure is not composed here.
  // THE SEALED CROSSING. The dial knocks only under the full sovereign pin the joined face's fleet join carried (filed
  // above for the relay's hearth), presents that face under its own face-scoped key, and reads the gate's verdict under
  // the pin's signing key. A device with no face joined dials no sovereign gate: it stands at the floor and reads what
  // the floor offers (`readOracle`). A hearth resting at its floor stands no sovereign gate, so its dial meets silence
  // and re-dials until a person unlocks it.
  let relayAdapter: LarWSClientAdapter | null = null;
  // THE WALKER ROUTE IS SHUT BY NAME (`walker-route-shut`): the sealed adapter presents a face, not a walk, so the walk
  // is neither presented nor kept here, and `carryAtHearth` / `fetchFromHearth` answer null. The record the walk
  // store holds is read and never spent.
  if (relayUrl && faceJoined && (relayHeld === null || facePresentation === null || !social.contactCard)) {
    const why = relayHeld === null ? "no sovereign gate pin is held for this hearth (pin-absent)"
      : !social.contactCard ? "no social contact card is available for the pinned relay crossing"
      : `the joined face presents nothing here (${presentationRefusal ?? "presentation-absent"})`;
    console.warn(`[lararium-browser] the relay dial is idle: ${why}`);
  }
  if (relayUrl && social.contactCard && relayHeld !== null && facePresentation !== null && sovereignNexus !== null) {
    const adapter = new LarWSClientAdapter({
      url: relayUrl, pins: gatePins, hearth: hearthNameOf(relayUrl), nexus: sovereignNexus,
      presentation: facePresentation, audience: DAEMON_BAG_ID, deadlines: dialDeadlines(),
    });
    observeRelayConnection(connectionState, adapter);
    relayAdapter = adapter;
    held.stood.push({ what: "relay adapter", down: () => adapter.disconnect() });
    // Tag the relay ring: every peer reached through this adapter enters `relayPeers`, so the
    // sharePolicy gates them while the in-process island peers keep sharing freely. Listeners
    // attach BEFORE addNetworkAdapter so a peer is classified before any doc is announced to it.
    adapter.on("peer-candidate",    ({ peerId }: { peerId: PeerId }) => { relayPeers.add(peerId); });
    adapter.on("peer-disconnected", ({ peerId }: { peerId: PeerId }) => { relayPeers.delete(peerId); });
    // Arm the deny-by-default gate for the pinned crossing: the Nexus's deterministic crossroads doc and WHO board are
    // the public surface, widened at the face's own hearth by exactly the canon its admit names (`hearthCrossingOf`).
    fedGate = crossing.gate;
    // CANON CROSSES HEARTH TO LEAF ALONE. The gate above decides which documents this leaf FETCHES from its
    // hearth; it says nothing about which way a change travels. The leg reads every sync message this Repo
    // sends toward the hearth and keeps back any that carries a change to a canon document the admit named.
    const canonIds = hearthCanonDocIds(hearthCanon);
    repo.networkSubsystem.addNetworkAdapter(
      canonIds.size > 0 ? new GatedSyncLeg(adapter, oneWayDocumentsGate({ receiveOnly: canonIds })) : adapter,
    );
  }

  // ── Catalog ────────────────────────────────────────────────────────────────
  const blankCatalog = (): DocHandle<LarDoc> => {
    const h = repo.create<LarDoc>(emptyLarDoc());
    h.change((doc) => { doc.tiddlers[CATALOG_DOC_URI] = storedLarRecord(CATALOG_DOC_URI, { text: h.url }, "browser-boot"); });
    return h;
  };
  let catalogHandle: DocHandle<LarDoc>;
  if (bootKeys.catalogUrl) {
    // A catalog was previously founded + persisted — a load failure is DATA-AMNESIA, surfaced LOUD
    // (never a silent blank re-founding). See loadFoundedCatalogOrWarn.
    catalogHandle = await loadFoundedCatalogOrWarn<LarDoc>(repo, bootKeys.catalogUrl, blankCatalog);
  } else {
    catalogHandle = blankCatalog();
    bootKeyWrites.catalogUrl = catalogHandle.url;
  }
  emit("catalog-ready");

  // The uniform pin-selector's ONE live pointer (BA·HA braid): which VM surface owns the singleton #projection
  // sink right now. Defaults to the pinned wiki at boot; setActiveSurface flips it live (a pure gate flip, no
  // reboot). Pin ⊥ active — the frame gate admits only this surface's frames, keyed on the transport id.
  let activeSurfaceId = "";

  // ── Residency MECHANISM (parity with node — a tab has finite memory too) ────
  let vmManager!: BrowserVesselIslandPool;   // set in makePool
  let wikiActivation!: WikiActivationCap;     // set in makePool — activation-on-reference cap (minimal grant)
  let daemon!:     DaemonVmCore;      // set in openDaemon
  let wikiSense!:  WikiSenseSupervisor;   // set in wireVerbs (post-daemon)
  let slotActiveWikiId = "";
  // R4 — the Crossroads board this vessel materializes ONCE, read by every later per-island
  // plugin-offering resolution (the daemon VM's own recipe, and the pool's resolver). Mirrors
  // node's `crossroadsOfferingsHandle`.
  let crossroadsOfferingsHandle: DocHandle<LarDoc> | undefined;

  // Push the live switcher state INTO the daemon widget (main → local, reactive — never
  // a poll): the switcher-state worker verb writes $:/temp/lares/switcher (volatile, local)
  // so the daemon's projected list re-renders. Called on every activation change and on
  // summon. Fire-and-forget — a lost push self-heals on the next change or summon.
  const pushSwitcherState = (): void => {
    if (!daemon || !vmManager || !wikiActivation) return;
    const active = vmManager.inspect().filter((s) => s.temperature === "wela").map((s) => s.wikiId);
    // The recipe surface edits the vessel's HOME wiki (always present) — read its bag-stack through the ONE
    // recipe reader (the vessel's own composition in the catalog shadows a system wiki's default in the
    // oracle), so the widget paints the stack the mount and the live watch stand on.
    const recipeSlug = slotActiveWikiId ? slugFromUri(slotActiveWikiId) : "";
    let recipe: string[] = [];
    if (recipeSlug) {
      const rec = effectiveRecipe(recipeSlug, (plane, title) =>
        (plane === "oracle" ? oracleAtBoot : catalogHandle)?.doc()?.tiddlers?.[title])?.record;
      if (rec) recipe = bagStackFromRec(rec);
    }
    // Add-candidates: the daemon-resolvable system library bags not already in this
    // recipe. The projection round-trip relays CLICKS only (never text input), so
    // recipe-add rides click-to-add candidates rather than a typed URI.
    const inRecipe = new Set(recipe);
    const availableBags = [BAG_IDS.lares, BAG_IDS.lararium, BAG_IDS.crossroads]
      .filter((b) => !inRecipe.has(b));
    void daemon.placeVerb({
      verb: "switcher-state",
      args: {
        active:        active.join(" "),
        held:          [...wikiActivation.held()].join(" "),
        surface:       activeSurfaceId,
        recipeSlug,
        recipe:        recipe.join(" "),
        availableBags: availableBags.slice(0, 8).join(" "),
      },
      requestedBy: "switcher",
    });
  };
  // Push the live PERSONA multitude INTO the daemon persona surface (main → local, reactive):
  // main HOLDS the IDB persona vault, so it reads the multitude-view here + writes it through the
  // `persona-state` worker verb onto the volatile $:/temp/lares/personas. PRIVATE-all: the view is
  // built with NO public-handle view, so every persona reads private-only — no glamour federates
  // off this push. Fired after a mint/wear + on daemon summon. Fire-and-forget (a lost push self-
  // heals on the next mint/wear or summon), mirroring pushSwitcherState.
  const pushPersonaState = async (): Promise<void> => {
    if (!daemon) return;
    const vault    = await makeBrowserIdbPersonaVault(idbName);
    const petnames = await makeBrowserPersonaPetnameStore(idbName);
    const view     = await personaMultitudeView(vault, petnames);   // no publicView → private-only
    const active   = await loadBrowserActivePersona(idbName);
    const custody  = await readBrowserCustody(idbName);
    void daemon.placeVerb({
      verb:        "persona-state",
      args:        { ...personaPanelStateArgs(view, active), custody: custody.reading, custodyClears: CLEAR_CUSTODY_CLEARS },
      requestedBy: "persona",
    });
  };
  // The default circle the daemon follow panel paints — the primary system circle seedCirclesDoc plants.
  const CIRCLE_PANEL_DEFAULT = "following";
  // RENDER the daemon follow surface FROM the sovereign circles doc (the follow-graph's SOURCE OF TRUTH). The
  // daemon WORKER holds the circles doc by access, so `circle-list` reads the membership there and writes the volatile
  // $:/temp/lares/circles itself — main only TRIGGERS. The circles doc is PRIVATE + fleet-synced same-operator (a follow
  // shows on ALL the operator's own devices) and NEVER federates. Petname/glamour ride blank until the handle-
  // book co-moves onto the circles doc (the open fork). Fired on a follow/unfollow + daemon summon; fire-and-forget.
  const pushCircleState = (circleId = CIRCLE_PANEL_DEFAULT): void => {
    if (!daemon) return;
    void daemon.placeVerb({ verb: "circle-list", args: { circle: circleId }, requestedBy: "circle" });
  };
  // The ONE residency collector + pool-wiring, composed through the SHARED factory (both vessels
  // call it). Browser advertises the MINIMAL grant (a small live-wiki set + one rotatable pin
  // besides the daemon bag) and supplies its vessel-specific hooks: it stays SILENT on a cool (node
  // narrates the cool) and holds NO durable mailbox, so an undeliverable alert WARNS + drops
  // best-effort (node parks it durably). getPool reads vmManager lazily (the forward-ref pattern).
  const residencyWiring: VesselResidency = makeVesselResidency(
    () => vmManager,
    { wikiActivationCap: BROWSER_WIKI_ACTIVATION_CAP, wikiPinBudget: BROWSER_WIKI_PIN_BUDGET },
    {
      onUndeliverableAlert: (wikiId, verbOpts, reason) =>
        warnDroppedBrowserAlert(
          wikiId,
          String(verbOpts.args["message"] ?? ""),
          (verbOpts.args["cause"] as string) || undefined,
          reason,
        ),
    },
  );
  const residency = residencyWiring.residency;

  // ── The mesh carriage as a LEAF ───────────────────────────────
  // PRESENT → derive the leaf standing and compose the carriage ALONGSIDE the wiki core: meshpalace
  // (a writable meshpalace FLOW-map, seeded with NO self-dial — `meshSelfSeed([leaf])` is [] for a
  // leaf) + carriage (pulls peers' public read-faces, re-ranks by l-space proximity). A LEAF has no
  // endpoint → it carries-in but is NOT dial-able (a browser holds no listening socket). ABSENT → [],
  // the browser composes no carriage (today's behavior, unchanged). The mirror of openNodeVessel.
  const meshExtraCaps = meshLeaf ? (() => {
    const leaf = deriveMeshLeaf(
      meshLeaf.coordSeed, meshLeaf.peers,
      ...(meshLeaf.radius !== undefined ? [{ radius: meshLeaf.radius }] : []),
    );
    // The SAME pair a node hearth and a Herm compose — a leaf differs only in the standing it hands in.
    // `deriveMeshLeaf` yields a self with NO endpoint, so the stack seeds no dial and announces nothing:
    // this vessel carries-in and is never dial-able (the endpoint-absent leaf↔full tier).
    return [...carriageStack({
      repo, residency, self: leaf,
      nodeSeedHex: vesselVerifyingKey,   // the per-vessel cadence seed (browser-safe hex string, no Buffer)
      ...(oracleProof ? { identity: oracleProof } : {}),
      onLog: (l) => console.log(`[lararium-browser] ${l}`),
    })];
  })() : [];

  // ── The WHO plane as a LEAF — RESOLVE the per-Nexus crossroads board; announce NOTHING ──
  // Networked only: the board needs the relay to sync, and the island key (`nexusPubkey`) scopes the
  // causal island so a human's two vessels resolve the SAME board. Boot composes whoFaceCap with NO card: it
  // resolves the island's WHO board through the deterministic crossroads address and layers it writable so
  // the relay syncs, giving this vessel RECOGNITION (it reads every peer's card) while publishing none of its
  // own. The identity sibling of the carriage leaf above (WHO ⊥ WHERE, the two-key atom). No relay/gate → [].
  //
  // NO BOOT-TIME FACE, by construction rather than by gate. Canon never collapses binding-the-vessels into
  // announcing-the-identity, so publishing rides a deliberate holder act through the component's `announce` —
  // the ONLY thing that ever federates stays a glamour the human consciously posts, never a boot side-effect.
  // (A boot-minted card also had to name SOME key, and the only key at hand is this vessel's own — publishing
  // it would put the substrate key on the social board, the one co-surface the two-key atom forbids.)
  const whoExtraCaps: CapModule[] = relayGated ? await (async () => {
    const crossroadsHandle = await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads");
    return [whoFaceCap({ repo, crossroadsHandle, nexusPubkey, residency })];
  })() : [];

  const result = await composeBrowser<BrowserVesselIslandPool>({
    keel: {
      repo,
      catalogHandle,
      waitHandle: <T>(url: AutomergeUrl, fallback: () => DocHandle<T>) => waitHandle<T>(repo, url, fallback),

      // Genesis is required only for a first materialization or a source-backed byte fetch. The oracle island is a LIVE
      // CRDT under the DETERMINISTIC doc id (oracleGenesisDocUrl): materializeGenesisIsland
      // does find-FIRST (a prior boot persisted it to IndexedDB → reload intact; a peer
      // synced it → adopt) ELSE materializes it fresh from the plain-data seed and imports
      // it under that id. No binary import, no merge-into-stale reconcile. One
      // call, isomorphic with the node loadOrMaterializeOracle.
      loadGenesis: async () => {
        await writeBootKeys(idbName, bootKeyWrites);
        const islandHandle = await materializeGenesisIsland(repo, genesisSeed, "browser-genesis");
        oracleAtBoot = islandHandle;
        if (ownHearth) {
          // The admit names the canon this leaf opens. Seated on this vessel's own catalog, the keel and
          // every island mount the hearth's documents through the reading every vessel shares.
          seatHearthCanon(catalogHandle, hearthCanon);
          const named = Object.keys(hearthCanon);
          console.log(named.length > 0
            ? `[lararium-browser] hearth canon named by the admit — this leaf mounts ${named.join(", ")}`
            : "[lararium-browser] the admit names no hearth canon — this leaf mounts a wiki document of its own; take a fresh admit from the hearth to open its wiki");
        }
        const coreHash = islandHandle.doc()?.blobs?.[ENGINE_CORE_ID]?.sha256 ?? null;
        if (!coreHash) throw new Error("[openBrowserVessel] genesis island missing ENGINE_CORE_ID blob metadata");
        // Populate the OPFS CAS — the worker pulls engine + plugin bytes by CID from here
        // (the breath path), never CRDT-syncing the bytes over the port. The genesis CRDT now
        // carries METADATA only; the bytes ship as genesis/cas/<cid> files. Fetch them over HTTP
        // by the seed-derived inventory (the browser face of the node mirrorGenesisCasFs). Once in OPFS they
        // persist (write-once-read-many), so later/replica boots need no separate inventory file.
        const casManifest = genesisSeed ? genesisCasManifestFromSeed(genesisSeed) : undefined;
        const casCids = casManifest
          ? casManifest.blobs.map(({ cid }) => cid)
          : genesisCasCidsFromOracle(islandHandle.doc()!);
        // The seed is the immutable authorization for a remote CAS fetch. A persisted
        // mutable Oracle may name continuity members for a local restart, but it may
        // never widen the remote byte request.
        if (genesisCasBaseUrl && casManifest) await fetchGenesisCasToOpfs(casManifest, genesisCasBaseUrl);
        const missing = (await Promise.all(casCids.map(async (cid) => {
          const bytes = await readCasBlobFromOpfs(cid);
          return bytes && sha256HexBytesSync(bytes) === cid ? null : cid;
        }))).filter((cid): cid is string => cid !== null);
        if (missing.length > 0) {
          throw new Error(
            `[openBrowserVessel] genesis CAS member(s) unavailable: ${missing.join(", ")} — ` +
            "provide the immutable genesis seed/CAS source before starting a worker",
          );
        }
        return { islandHandle, coreHash, bootstrap: social };
      },

      tempStore: () => new MemoryTiddlerStore(),

      // Corpus capability (parity — browser syncs corpus bags too; shared loader).
      loadCorpora: (composite) => loadCatalogCorpora({
        repo, catalogHandle,
        mintLocalHandle: (docUrl) => waitHandle<LarDoc>(repo, docUrl, () => repo.create<LarDoc>(emptyLarDoc())),
        source: "browser-boot",
      }, composite),

      ...(onPhase ? { onPhase } : {}),
    },

    wikiSlot: (_assembly: VesselCoreAssembly): VesselWikiSlot => {
      const sel = selectActiveWikiSlug(wikiId, undefined);
      slotActiveWikiId = sel.slug;
      activeSurfaceId  = sel.slug;   // the pinned wiki owns #projection at boot; summon flips it live
      const facets = recipeHostFacets(slugFromUri(sel.slug));
      return {
        activeWikiId: sel.slug, wikiSlug: facets.wikiSlug,
        wikiKey: facets.wikiKey, wikiBagId: facets.wikiBagId,
        draftBagId: facets.draftBagId, workingBagId: facets.workingBagId,
      };
    },

    openDaemon: async ({ assembly, slot }) => {
      if (!daemonWorkerUrl) throw new Error("[openBrowserVessel] daemonWorkerUrl REQUIRED (genesis present → sovereign daemon island)");
      // Register the per-Nexus crossroads (public oracle plane) in this vessel's catalog so the daemon recipe resolves
      // it. Isomorphic: node + browser share registerCrossroadsPointer, and the daemon core splices
      // the crossroads bag into the recipe + registerBags for either vessel — only the nexus key differs (here the
      // relay's gate key, so a human's two vessels register the SAME crossroads doc).
      if (relayGated) await registerCrossroadsPointer(repo, assembly.catalogHandle, nexusPubkey);
      // THE CATALOG PLANE REGISTERS, as the node's boot registers it: a face's four planes ride the bootstrap, and every verb
      // and gate that reads a persona plane (the face bag ledger, the join's crash-replay record, the grant record) resolves
      // it from the catalog registry. Idempotent: the url the seed already names re-writes identically.
      const registerInCatalog = (bagId: string, url: string | null | undefined): void => {
        if (!url || tiddlerText(assembly.catalogHandle.doc()?.tiddlers?.[bagId]) === url) return;
        assembly.catalogHandle.change((doc) => { doc.tiddlers[bagId] = storedLarRecord(bagId, { text: url, kind: "oracle" }, "vessel-boot"); });
      };
      for (const plane of social.personaPlanes) registerInCatalog(personaBagIdFor(plane.personaGroupId), plane.url);
      const wornSiblings = social.personaBagId ? personaSiblingBagIds(social.personaBagId) : null;
      if (wornSiblings) {
        const wornFace = wornSiblings;
        registerInCatalog(wornFace.circles, social.circlesUrl);
        registerInCatalog(wornFace.identities, social.identitiesUrl);
        registerInCatalog(wornFace.sessions, social.sessionsUrl);
      }
      // The worker boots on the WORN persona's binding. The two-key atom: `seed` is the DEVICE key —
      // it inits keyhive as the Individual, and NEVER derives the persona-root — while `signerDid` +
      // `deviceEdge` carry the WORN PersonaGroup root's founder-signed binding (the Binding Gate pins
      // that root). The selector chooses WHICH root, and `readWornPersonaMount` is what reads it —
      // over the PersonaVault both vessel classes implement, so the node and browser boots cannot drift
      // on the answer (a founder's worn/founding root, or a joinee's admitted anchor index — the
      // anchor/edge path, never a held root the joinee lacks).
      //
      // THE FACE THE OPERATOR WORE. Wearing moves ONLY the selector; the bootstrap's social record was
      // written by the FOUNDING face and never moves again — so this worker booted on the founding face's
      // binding whatever mask was on, while the line it logged claimed the opposite. The switched face's
      // mount material lives in its OWN anchors, and the READING is mesh's, shared with the node vessel
      // over the `PersonaVault` both implement, so the two classes cannot drift on it again.
      const wornMount = await readWornPersonaMount(
        await makeBrowserIdbPersonaVault(idbName),
        (why) => console.warn(`[lararium-browser] ${why}`),
      );
      if (wornMount) {
        console.log(`[lararium-browser] worn h${wornMount.handleIndex} — the binding re-pins from its OWN anchors`);
      }
      // STILL A FORK, narrowed: the five MOUNT pins switch, and the per-persona SOCIAL PLANE does not. The
      // browser bootstrap holds ONE founding's social docs (the plane urls, the contact card), so a second
      // persona whose own PersonaGroup + daemon docs feed the worker still means founding those per persona
      // and keying the bootstrap by index. Those are per-founding social documents, correctly NOT part of a
      // mount — folding them in is the whole-social-plane fork, and it stays the operator's call.
      // THE WORN FACE'S ATOM: the random seed in this face's own custody row. A face whose row is absent refuses by
      // name, and an atom the device edge does not name refuses too: this browser never signs a face act with
      // another key.
      const wornGroup = wornMount?.personaGroupId ?? social.personaGroupId;
      const wornEdge = wornMount?.deviceEdge ?? social.deviceEdge;
      const wornAtomSeed = await requireBrowserFaceAtomSeed(idbName, wornGroup);
      const wornAtom = faceAtomKeyFromSeed(wornAtomSeed, wornGroup);
      if (wornEdge && wornAtom.key !== wornEdge.deviceVerifyingKey) {
        wornAtomSeed.fill(0);
        throw new Error("this face's atom differs from its device edge; re-found or re-admit it");
      }
      const wornAtomArchive = await loadBrowserVeilArchive(idbName, wornMount?.handleIndex ?? FOUNDING_PERSONA_INDEX);
      const personaKelPrefix = wornMount?.personaKelPrefix ?? social.personaKelPrefix;
      // THE PERSONA-KEL PIN — the continuity anchor the Binding Gate walks. Read the pinned identifier's
      // seq-sorted key-event-log from the per-Nexus KEL board of the ISLAND this vessel stands in,
      // against the LOCAL replica "as of last sync" (no-global-now). FAIL-CLOSED: a chain the replica does not
      // carry HALTS the boot (never a global lookup, never a fall-through to the raw signer pin).
      //
      // ── THE CLIMB'S CARRY — run BEFORE the gate walks, which is the whole cure ──────────────────
      // A founding leaf seats this inception on the board keyed by the island resolved AT THAT MOMENT,
      // and for a leaf that dials no anchor that island is its OWN key (the founding call above says so
      // in as many words). Configuring the hearth this page dials re-keys the board, and this gate
      // REFUSES rather than degrades — so the leaf walk found-offline → configure-the-anchor → reload
      // left a vessel that never booted again, and unlike the node's operator this one holds no remedy
      // at all. The carry moves the pinned chain onto the island this boot resolved, reading only the
      // islands BELOW it (`nexusIslandsBelow` is empty at the bottom and empty when torn, so nothing
      // ever descends). Idempotent: a destination that already carries it writes nothing, which is
      // every later boot. The gate is untouched — the events land verbatim, their own cids and their own
      // rotation signatures, and the same verifier judges them exactly as on the board they came off.
      await carryPersonaKelUpTheGradient({
        repo, nexusPubkey, prefix: personaKelPrefix,
        priorIslands: nexusIslandsBelow(nexusStandsAt),
      });
      const kelBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(nexusPubkey), "board:persona-kel");
      const personaKelChain = personaKelChainForPrefix(kelBoard.doc(), personaKelPrefix);
      if (!personaKelChain || personaKelChain.length === 0) {
        throw new Error(`[lararium-browser] persona-KEL chain for ${personaKelPrefix.slice(0, 20)}… absent from the local board — the Binding Gate cannot reach a head (fail-closed).`);
      }
      const standingArchive = await requireBrowserKeyhiveArchive(idbName);
      const daemonAuth = {
        seed: vesselSeed, vesselVerifyingKey: vesselIdentity.verifyingKey,
        // THE VESSEL'S OWN ARCHIVE, as its founding or its admit left it in the keystore. The island's keyhive
        // restores from it and then replays the cap events, so this individual still seals into every
        // document it created.
        archiveBytes: standingArchive,
        // A BROWSER VESSEL HOLDS NO SEALED IDENTITY HOME, so the archive-write door's reading is
        // vacuously open here: no seal stands that could hold it shut.
        // It stays INERT regardless: this entry injects no `persistArchive`/`persistVeilArchive`, so
        // the door has no writer to call and the island's per-boot export never lands; the keystore keeps
        // the Archive each founding act handed out. The field rides
        // REQUIRED so a populator that answers nothing fails at the compiler rather than at review.
        archiveOpens: true,
        // THE ATOM rides to the island as the face's own Individual: hex seed and its key. The island holds it for
        // the boot and the seed leaves this closure with the manifest.
        atom: { seed: hex(wornAtomSeed), key: wornAtom.key },
        ...(wornAtomArchive ? { veilArchiveBytes: wornAtomArchive } : {}),
        personaGroupId: wornMount?.personaGroupId   ?? social.personaGroupId,
        meshCabalDocIdHex: wornMount?.meshCabalDocIdHex      ?? social.meshCabalDocIdHex,
        // Derived, never enumerated — the same derivation the node vessel runs, so neither can drift on
        // which bags a cap check can resolve. This vessel had been carrying neither the shared substrate
        // bag nor any bag its own catalog named, which no test could see and no throw announced.
        registerBags: deriveRegisterBags({
          // EVERY compartment registers; exactly one mounts. The two verbs part company here.
          fleets: social.personaPlanes.map((pl) => ({
            personaGroupId: pl.personaGroupId,
            catalogNamed: pl.personaGroupId === (wornMount?.personaGroupId ?? social.personaGroupId) ? catalogNamedBags(catalogHandle.doc()) : [],
          })),
          wikiBags: [slot.wikiBagId, slot.workingBagId, slot.draftBagId],
        }),
        // The WORN persona-root's binding (founder-signed): the gate pins personaKel.prefix and walks the KEL
        // to the current head; deviceEdge is the signed device→hearth edge. From the single bootstrap.
        signerDid: wornMount?.signerDid ?? social.signerDid,
        personaKel: { prefix: personaKelPrefix, chain: personaKelChain },
        deviceEdge: wornMount?.deviceEdge ?? social.deviceEdge,
      };
      wornAtomSeed.fill(0);   // the manifest carries the seed's hex; the byte copy leaves this closure
      // R4 — the daemon VM resolves its plugins through the SAME selector + OPFS CAS path every
      // wiki island does (`resolveBrowserIslandPluginCids`), never a vessel-wide hand-
      // off. The daemon's own one-recipe-model record names no offerings today, so this call is
      // the floor alone in practice — but it is the floor PROVEN through the selector, not
      // assumed past it.
      crossroadsOfferingsHandle ??= await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads");
      const daemonPluginResolution = await resolveBrowserIslandPluginCids({
        islandBlobs: assembly.islandHandle.doc()?.blobs,
        recipe:      { wikiSlug: "daemon" },
        lookup:      browserOfferingLookup(crossroadsOfferingsHandle.doc()),
      });
      if (!daemonPluginResolution.ok) {
        throw new Error(`[openBrowserVessel] the daemon island's plugin resolution refused: ${daemonPluginResolution.error}`);
      }
      const pluginCids = daemonPluginResolution.pluginCids;
      // The leaf reads its fleet board for sibling sync; the island reads its own copy for binding.
      const fleetRootOfFace = daemonAuth.deviceEdge?.personaRootDid;
      if (fleetRootOfFace) {
        const scope = bareKey(fleetRootOfFace);
        const readFleet = async (): Promise<void> => {
          const startedAt = fleetMoves;
          const read = await readLedgeredEdgeBoard({
            repo, scope, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(fleetRootOfFace), label: "board:edge-kapae",
            vesselKey: wornAtom.key, authorityFor: fleetEdgeAuthority(fleetRootOfFace),
          });
          if (!fleetBoardFollowed) {
            fleetBoardFollowed = true;
            read.handle.on("change", () => {
              fleetShadows = null;
              fleetMoves += 1;
              fleetRead = readFleet();
              void fleetRead.then(() => { try { repo.shareConfigChanged(); } catch { /* the repo may be closing */ } }, () => undefined);
            });
          }
          if (startedAt !== fleetMoves) return;                  // overtaken: the read the move set off lands instead
          fleetShadows = { root: fleetRootOfFace, readings: read.readings, rolled: raisesSeenThrough(read.ledger.doc(), scope) };
        };
        fleetRead = readFleet();
        await fleetRead;
      }
      let replayManifest: (() => { msg: IslandMsg_Manifest; transfer: MessagePort[] }) | null = null;
      daemon = await openBrowserDaemonVm({
        repo, daemonUrl: social.daemonUrl, coreHash: assembly.coreHash, ownedDocument: true,
        // The persona plane rides only when a face stands. A browser vessel normally holds one — it IS
        // a person's face — so absence here names an unfinished founding rather than a crossroads, and
        // the VM stands faceless instead of resolving a document nobody founded.
        ...(social.personaUrl ? { personaUrl: social.personaUrl } : {}),
        ...(social.personaBagId ? { personaBagId: social.personaBagId } : {}),
        ...(pluginCids.length ? { pluginCids } : {}),
        workerScriptUrl: daemonWorkerUrl,
        // The holder path: the island already stands once per origin; this tab's handle IS its port.
        spawnWorker: (url) => {
          // The holder admits a FACE: this tab presents its edge and signs the holder's challenge with its atom,
          // and the holder stands the face's own house. A vessel with no face edge stands its own island.
          const faceSession = holder?.kind === "attached" && wornEdge
            ? { personaGroup: wornGroup, edge: wornEdge, atom: wornAtom } : null;
          const handle = holder?.kind === "attached" && faceSession ? holderWorkerHandle(holder.port, faceSession, {
            onLock: () => lockBrowserCustody(idbName), floor: () => browserSpawnWorker(url),
            rePost: () => { if (!replayManifest) throw new Error("[shared-holder] replacement manifest unavailable"); return replayManifest(); },
          }) : browserSpawnWorker(url);
          if (faceSession) {
            // This tab seals under its own key: it announces it can while its custody stands open, and again when it locks.
            handle.post({ type: "session:sealer", ready: true });
            held.stood.push({ what: "sealer announcement", down: onBrowserCustodyLock(idbName, () => handle.post({ type: "session:sealer", ready: false })) });
          }
          return handle;
        },
        onManifestReplay: (factory) => { replayManifest = factory; },
        recipe: { wikiSlug: "daemon" } satisfies WikiRecipe,
        grants: {
          islandUrl: assembly.islandHandle.url,
          // The daemon island's OWN bag (daemon = wikiBagUri("daemon"), one-recipe model).
          wikiUrl:   social.daemonUrl,
          // ACCESS grant, not a LOAD slot — the worker reaches the catalog registry via the accessor.
          catalogUrl: catalogHandle.url,
        },
        daemonAuth,
      });
      held.stood.push({ what: "daemon worker", down: () => daemon.dispose() });

      // ── THE PERSONAGROUP IDENTITY-SLOT RING (docs/pono/identity-slot-policy, arm B) ─────────────────
      // The ONE assembly the node vessel composes (`assemblePersonaGroupRing`), over the face this boot
      // wears, its pinned root and the KEL chain the Binding Gate just walked. Only the PROOF SOURCE differs:
      // a leaf dials out, so the key it reads for a peer is the key that peer PROVED to this leaf — the gate
      // key that signed this leaf's verdict on the relay socket — never a key the wire named. It widens the
      // cross-operator gate by the face's own planes and nothing else; with no cross-operator gate armed the
      // relay is the operator's own node and every doc already syncs, so there is nothing to widen.
      //
      // The SAME ring decides for this face's SIBLINGS by its own path (`composeSiblings`), reading the device
      // key each one proved over the sibling session: the face's own planes and the public boards, never the
      // @daemon, never another face's planes.
      const ringRelay = relayAdapter;
      const ringRoot = daemonAuth.deviceEdge?.personaRootDid;
      if (ringRoot && daemonAuth.personaKel) {
        const ring = await assemblePersonaGroupRing({
          catalog: makeCatalogAccessor(repo, catalogHandle.url),
          personaGroupId: daemonAuth.personaGroupId,
          personaRootDid: ringRoot,
          personaKel: daemonAuth.personaKel,
          provenKeyOf: (peerId) => ringRelay?.provenKeyOf(peerId) ?? null,
          siblingKeyOf: (peerId) => siblings?.provenKeyOf(peerId) ?? null,
          // THE DYAD'S SHADOW at the face-grant seat and the sibling lane (kapae#/reach): a device the fleet root
          // set aside holds no seat here. Until this leaf's first read of the fleet board lands, every key reads aside.
          deviceAside: (vesselKey) => !fleetShadows || fleetShadows.readings.get(deviceEdgeId(fleetShadows.root, vesselKey))?.stands === true,
        });
        if (fedGate && ringRelay) fedGate = ring.compose(fedGate);
        // THE FLEET'S EDGE BOARD rides the sibling lane beside the public boards, so the root's raise reaches every
        // device; this leaf read it before its island booted (above) and re-reads it whenever it changes.
        const fleetBoardUrl = fleetEdgeBoardDocUrl(ringRoot);
        siblingGate = ring.composeSiblings(new DeterministicFederationGate(nexusPubkey, [fleetBoardUrl]));
      }

      // ── THE SIBLING CHANNEL (leaf kind 3, docs/pono/identity-slot-policy#/the-leaf-taxonomy) ────────
      // The ONE composition the node vessel calls (`standSiblingChannel`). This face's siblings — devices
      // its own PersonaGroup delegated — prove their edges to each other through every pinned herm against the
      // KEL chain the Binding Gate just walked, under the PersonaGroup secret the root sealed to this device at
      // enrolment and the lease epoch this vessel holds, and sync over the session that proof binds. Each herm
      // carries sealed frames and reads none; every pinned herm carries the KEL drops this leaf pulls before it
      // joins. Herms the channel cannot stand over refuse the channel alone, never the vessel. The seed stays in
      // these closures.
      const siblingEdge = daemonAuth.deviceEdge;
      if (siblingHerms && siblingHerms.length > 0 && siblingEdge && siblingGate) {
        const group = daemonAuth.personaGroupId;
        const sealText = tiddlerText(bootDaemonDoc?.tiddlers?.[groupSecretSealTitle(group)]);
        let sealRaw: unknown = null;
        try { sealRaw = sealText ? JSON.parse(sealText) : null; } catch { sealRaw = null; }
        const seal = await verifyGroupSecretSeal(sealRaw);
        if (!seal) {
          console.warn("[sibling] this face holds no PersonaGroup secret sealed to this device — its enrolment delivered none, so no sibling channel stands.");
        } else {
          const leasePrefix = leaseEpochPrefix(group);
          const leaseSlots = Object.entries(bootDaemonDoc?.tiddlers ?? {})
            .filter(([title]) => title.startsWith(leasePrefix)).map(([, rec]) => tiddlerText(rec));
          siblings = await standSiblingChannel({
            repo, herms: siblingHerms, nexusPubkey, personaKelPrefix,
            deviceKey: wornAtom.key, sign: wornAtom.sign,
            enrolment: { edge: siblingEdge, seal }, open: wornAtom.opener,
            expectedEpoch: effectiveLeaseEpoch(leaseSlots),
            onRefusal: (r) => console.warn(`[sibling] ${siblingRefusalLine(r)}`),
          });
        }
      }
      return { workerEa: daemon.workerEa, mountMainVerbs: daemon.mountMainVerbs, resolveBinding: daemon };
    },

    wireVerbs: (registry, _assembly) => {
      seedVesselDefaults(registry);
      // Thin main verb plane (node parity). Every catalog/recipe/residency-mutating
      // daemon verb lives in the worker now (wireWorkerVerbs) — access≠load, write-then-sync.
      // Main keeps only sync-wiki (commands the pool's active wiki) + residency stats (a read).
      registry.register("sync-wiki", async (args, ctx) => {
        await wikiActivation.ensureActive(slotActiveWikiId);   // reference wakes a cold grain (home wiki: no-op)
        return vmManager.placeWikiVerb(slotActiveWikiId, {
          verb: "sync-wiki", args: args as Record<string, unknown>, requestedBy: ctx.invocation.requestedBy,
        });
      });
      registry.register("residency", makeResidencyStatsReactor({ residency }));

      // ── The wiki-SWITCHER surface (the FACE over the activation cap) ────────────
      // The LIVE swap (distinct from boot-time `open-wiki`): ACTIVATE the grain
      // (resolveWikiSpec wakes ANY registered wiki cold, single-flight) THEN flip the
      // singleton #projection gate to it — the summon, mount-then-flip. Persist the
      // choice fire-and-forget to the boot pointer (read only at next cold boot).
      registry.register("wiki-switch", async (args) => {
        // slug rides as a structured `slug` arg — from the CLI / MCP, OR from a DOM
        // verse-event whose `arg-slug` field the reaction-router lifted into the args
        // payload (#48 unified the DOM path onto the CLI's structured-args contract).
        const slug = String(args["slug"] ?? "");
        if (!slug) throw new Error("wiki-switch: `slug` required");
        const active = await wikiActivation.ensureActive(slug);
        if (active) {
          activeSurfaceId = slug;   // flip the projection gate to the now-live wiki
          void daemon.placeVerb({ verb: "open-wiki", args: { slug }, requestedBy: "wiki-switch" });
          pushSwitcherState();      // reflect the new surface into the daemon widget
        }
        return { verb: "wiki-switch", slug, active, held: [...wikiActivation.held()] };
      });
      // wiki-hold / wiki-release — the ROTATABLE active-wiki pin (budget-enforced by the
      // cap: the daemon bag always + pinBudget rotatable; browser grant = one). The switcher's pin.
      registry.register("wiki-hold", async (args) => {
        const slug = String(args["slug"] ?? "");
        if (!slug) throw new Error("wiki-hold: `slug` required");
        const held = await wikiActivation.hold(slug);
        pushSwitcherState();
        return { verb: "wiki-hold", slug, held, holds: [...wikiActivation.held()], budget: wikiActivation.grant.pinBudget };
      });
      registry.register("wiki-release", async (args) => {
        const slug = String(args["slug"] ?? "");
        if (!slug) throw new Error("wiki-release: `slug` required");
        wikiActivation.release(slug);
        pushSwitcherState();
        return { verb: "wiki-release", slug, holds: [...wikiActivation.held()] };
      });
      // wiki-active — the live switcher state: which wikis run now + which are held +
      // which surface holds the projection. The daemon widget's state-tiddler reads this.
      registry.register("wiki-active", async () => {
        const active = vmManager.inspect().filter((s) => s.temperature === "wela").map((s) => s.wikiId);
        return {
          verb: "wiki-active", active, held: [...wikiActivation.held()], activeSurface: activeSurfaceId,
          activationCap: wikiActivation.grant.activationCap, pinBudget: wikiActivation.grant.pinBudget,
        };
      });

      // ── The PERSONA surface (the multitude-of-one door) ─────────────────────────
      // The isomorphic mirror of the wiki-switcher: main holds the IDB persona vault, so
      // these verbs DRIVE it (list / mint / wear) and reflect the fresh state into the
      // daemon persona surface via pushPersonaState. A projected click routes here exactly
      // as wiki-switch does (worker delegates the unknown verb to the main registry).

      // persona-refresh — repaint the surface from the live vault (idempotent read + push).
      registry.register("persona-refresh", async () => {
        void pushPersonaState();
        const roster = await listBrowserPersonaRoots(idbName);
        const active = await loadBrowserActivePersona(idbName);
        return { verb: "persona-refresh", roster, ...(active !== undefined ? { active } : {}) };
      });

      // persona-mint — mint a new persona-root at the NEXT index and set its DEFAULT private
      // pet-name (PRIVATE-all — the label never PUBLICLY federates; only a publicly announced Handle
      // binds a persona to a glamour, and that stays a SEPARATE explicit act, never auto-fired here).
      // The mint names the face for the human, who renames it through the pet-name store's own private
      // bag: a label typed into a projected field would travel a render surface with no way to tell a fleet
      // peer from a stranger, and the label is PRIVATE. Next index = max(held) + 1, or 0 when the
      // vessel holds no root (a joinee founding its first face).
      registry.register("persona-mint", async () => {
        // A FACE SECRET MINTS ONLY OVER A SLOT: the person binds a passphrase or paper slot first, in this tab.
        if (!opts.askCustody) throw new Error("persona-mint: this page offers no custody door, so no slot can bind before the root mints");
        const custody = await standBrowserCustody({ idbName, ask: opts.askCustody, secretMintDue: true });
        if (custody.reading !== "bound" && custody.reading !== "opens" && custody.reading !== "held") {
          return { verb: "persona-mint", refused: custody.reading };
        }
        const roster = await listBrowserPersonaRoots(idbName);
        const nextIndex = roster.length ? Math.max(...roster) + 1 : 0;
        const root = await generateOrLoadBrowserPersonaRoot(idbName, nextIndex);
        const petnames = await makeBrowserPersonaPetnameStore(idbName);
        await renameOwnPersona(petnames, nextIndex, `persona-h${nextIndex}`);
        void pushPersonaState();
        return { verb: "persona-mint", index: nextIndex, created: root.created };
      });

      // custody-clear — THE CLEAR-PASSWORD ACT (`tm-clear-password`): return this browser's custody rows to the clear.
      // The route comes from the page's custody door, never from the verb's arguments. The first pass answers `asks`
      // with the question; the wiki's confirm road parks it and re-dispatches with `confirmed: "yes"`, and only that
      // literal answer opens the confirm door (`browser-custody.ts`).
      registry.register("custody-clear", async (args) => {
        const answer = await clearCustodyVerb({ idbName, confirmed: args["confirmed"], clears: args["clears"], ...(opts.askCustody ? { askCustody: opts.askCustody } : {}) });
        if (answer.reading === "cleared") void pushPersonaState();
        return { verb: "custody-clear", ...answer };
      });

      // persona-wear — don the face at `index` (reboot-to-switch, one-face-to-mesh). FAIL CLOSED
      // on custody: wearBrowserPersona REFUSES when this vessel holds no root at that index (the
      // custody-by-type wall — sign only as a persona whose sovereign secret this vessel carries).
      // Wearing moves only the selector pointer; the worker BINDS the worn persona at boot
      // (`readWornPersonaMount` reads the selector and re-pins the mount), so the switch lands on the
      // next reboot —
      // rebootRequired names that for the web shell (the reboot itself is the caller's act).
      registry.register("persona-wear", async (args) => {
        const index = Number(args["index"]);
        if (!Number.isSafeInteger(index) || index < 0) throw new Error("persona-wear: valid `index` required");
        await wearBrowserPersona(idbName, index);   // custody-gated — throws when no root held
        void pushPersonaState();
        return { verb: "persona-wear", index, rebootRequired: true };
      });

      // ── The FACE surface (the public "here I am" door) ──────────────────────────
      // The browser twins of the node `handle` adapters (publish · burn · attest), surfaced as DELIBERATE
      // holder acts — a face NEVER federates as a boot side-effect; only an explicit invocation here posts a
      // glamour. Each resolves the per-Nexus WHO board off the crossroads address the who-plane already reads,
      // seats the persona index (the arg, else the worn persona, else the founding index), and calls the
      // shared act. WITHHELD boots hold no public board, so a face verb fails closed with an honest reason.
      const resolveFaceIndex = async (args: Record<string, unknown>): Promise<number> => {
        if (args["persona"] !== undefined) return Number(args["persona"]);
        return (await loadBrowserActivePersona(idbName)) ?? FOUNDING_PERSONA_INDEX;
      };
      const resolveWhoBoard = async (verb: string): Promise<DocHandle<LarDoc>> => {
        if (!relayGated || !relayAdapter?.session) {
          throw new Error(`[face-${verb}] this vessel holds no public WHO board — it has not crossed to a hearth, so it has no board to name a face on.`);
        }
        return materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads");
      };
      // The daemon doc the publish core reads for the owner prefix — the persona-KEL prefix IS the only field
      // it consults, and `social` carries it authoritatively; a faceless boot has none, so publish fails closed.
      const ownerDaemonDoc = (): LarDoc => {
        const d: LarDoc = { tiddlers: {} } as LarDoc;
        if (social.personaKelPrefix) {
          d.tiddlers[PERSONA_KEL_PREFIX_TIDDLER] = storedRecord({
            tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: social.personaKelPrefix, kind: "persona-kel-prefix" },
          });
        }
        return d;
      };

      // face-publish — announce a persona-anchored glamour onto the WHO board (fail-closed on absent prefix,
      // in the shared core). Returns the announced card for the UI to reflect.
      registry.register("face-publish", async (args) => {
        const glamour = String(args["glamour"] ?? "").trim();
        if (!glamour) throw new Error("face-publish: a `glamour` (display name) is required");
        const handleIndex = await resolveFaceIndex(args);
        const board = await resolveWhoBoard("publish");
        const card = await publishHandleBrowser({ daemonDoc: ownerDaemonDoc(), board, handleIndex, glamour, idbName });
        return { verb: "face-publish", nym: card.nym, glamour: card.glamour, actCid: card.actCid, parents: card.parents };
      });

      // face-burn — bury the name. SELF-burn by default (the seated handle key); `from-persona` buries it from
      // ABOVE (the owning persona's head op-key), resolving the owner head off the per-Nexus persona-KEL board.
      registry.register("face-burn", async (args) => {
        const handleIndex = await resolveFaceIndex(args);
        const board = await resolveWhoBoard("burn");
        const fromPersona = args["from-persona"] === true || args["from-persona"] === "true";
        const burnOpts: Parameters<typeof burnFaceBrowser>[0] = { board, handleIndex, idbName };
        if (fromPersona) {
          burnOpts.fromPersona = true;
          burnOpts.daemonDoc   = ownerDaemonDoc();
          burnOpts.kelBoard    = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(nexusPubkey), "board:persona-kel");
        }
        const card = await burnFaceBrowser(burnOpts);
        return { verb: "face-burn", nym: card.nym, actCid: card.actCid, parents: card.parents, burned: true, hand: fromPersona ? "owner" : "self" };
      });

      // face-attest — sign a claim under the face's head, carried ON the card, verified reader-locally. Not a
      // chain event; writes nothing to the board.
      registry.register("face-attest", async (args) => {
        // THE STRUCTURED EDGE, at the browser door: a named surface + the foreign subject it names. The verb
        // reaches the adapter family through the SAME mapping the CLI uses (`handleClaimFrom`), so a new
        // adapter opens on both doors at once and neither door learns a new argument.
        const claim = handleClaimFrom(
          String(args["surface"] ?? ""), String(args["subject"] ?? ""),
          args["return-locator"] === undefined ? undefined : String(args["return-locator"]),
        );
        if (!claim) throw new Error(`[face-attest] no adapter answers that claim — name a surface (${HANDLE_CLAIM_SURFACES.join(" · ")}) and its subject.`);
        const handleIndex = await resolveFaceIndex(args);
        const board = await resolveWhoBoard("attest");
        const statement = await attestFaceBrowser({ board, handleIndex, claim, idbName });
        return { verb: "face-attest", prefix: statement.prefix, headEventCid: statement.headEventCid, claim: statement.claim, sig: statement.sig };
      });

      // ── The FOLLOW surface (the IoC social-graph door) ──────────────────────────
      // The follow-graph's SOURCE OF TRUTH rides the sovereign circles doc, held in the daemon WORKER: the
      // FOLLOW-GRAPH verbs (circle-add / circle-remove / circle-list) live there (registered by the shared
      // operator-daemon-behavior), reaching the circles doc by access and writing-then-syncing. The circles doc is PRIVATE +
      // fleet-synced same-operator (a follow shows on ALL the operator's own devices) and NEVER federates. A
      // projected unfollow click carries the row's nym + circle straight to the WORKER `circle-remove` verb
      // (verse-event → placeVerb → the worker dispatcher, which shadows any main reactor); it self-renders the
      // surface from the circles doc. FOLLOWING a NEW nym needs a nym + a self-certifying card (recognition, fail-
      // closed) — the `lares circle` CLI / the exported composeFollow, never a projected text field.

      // circle-refresh — repaint the follow surface FROM the circles doc (the worker `circle-list` reads + renders it).
      registry.register("circle-refresh", async (args) => {
        const circleId = String(args["circle"] ?? CIRCLE_PANEL_DEFAULT) || CIRCLE_PANEL_DEFAULT;
        pushCircleState(circleId);
        return { verb: "circle-refresh", circle: circleId, federated: false };
      });

      // wiki-sense (the supervision reads) — the daemon's supervision READ-verbs over the islands this vessel's pool
      // actually holds. The shores ARE the supervision grant: designation resolves through the pool
      // alone (confused-deputy ward — a name outside the pool fails loud at both ends), and the
      // proof-hold writes into the daemon's OWN daemon layer (local, self-sovereign). The daemon
      // worker reaches these verbs over its existing delegate loop.
      wikiSense = createWikiSenseSupervisor(
        {
          supervises: (island) => vmManager.has(island),
          sendSignal: (island, msg) => vmManager.placeSensoriumSignal(island, msg),
        },
        { proofStore: daemon.composite, proofBag: DAEMON_BAG_ID },
      );
      registerWikiSenseVerbs(registry, wikiSense);
    },

    afterDaemon: (_a, assembly) => {
      void residency.pin(BAG_IDS.catalog,    "boot:catalog");
      void residency.pin(BAG_IDS.oracle,   "boot:lararium-island");
      if (assembly.laresHandle) void residency.pin(BAG_IDS.lares, "boot:lares-corpus");
      // A face's planes pin under the face's own names — the vessel pins what it actually mounted.
      const pinFace = social.personaBagId ? personaSiblingBagIds(social.personaBagId) : null;
      if (pinFace) {
        void residency.pin(pinFace.identities, "boot:identities");
        void residency.pin(pinFace.circles,    "boot:circles");
        void residency.pin(pinFace.sessions,   "boot:sessions");
      }
      void residency.pin(DAEMON_BAG_ID,       "boot:daemon");
      // Durable pin replay — BEFORE the sweeper starts, so a replayed pin never races the first
      // idle-cool tick. Recovers whatever an operator pin persisted under the daemon doc across a
      // restart (residency-tiers.mem#/pin-flag; see writePinTiddler/replayPinsFromDaemonDoc).
      void replayPinsFromDaemonDoc(daemon.daemonHandle, residency);
      residency.startSweeper();
      assembly.composite.attachResidency(residency);
      // NB: no inbound WS gate — a browser cannot listen on a socket (substrate floor).
    },

    makePool: (_a, assembly) => {
      // R4 — TWO WIKIS IN ONE VESSEL: each mount resolves its OWN recipe's plugin-offerings
      // through the selector + OPFS CAS (`resolveBrowserIslandPluginCids`), never one vessel-wide
      // floor. The Crossroads board materializes once (lazily,
      // shared with the daemon VM's own resolution above) and is read fresh per mount.
      vmManager = new BrowserVesselIslandPool({
        mainRepo: repo,
        resolvePluginCids: async (recipe) => {
          crossroadsOfferingsHandle ??= await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads");
          return resolveBrowserIslandPluginCids({
            islandBlobs: assembly.islandHandle.doc()?.blobs,
            recipe,
            lookup: browserOfferingLookup(crossroadsOfferingsHandle.doc()),
          });
        },
        onWorkerEvent: (_id, msg) => {
          // The camera's traffic reaches here the way an `event` does. A frame paints ONLY from the ACTIVE surface:
          // the gate keys on the transport id (never a payload claim), so a summon that flips activeSurfaceId
          // auto-supersedes the previous surface's frames with no explicit teardown (the wlroots seat / tmux
          // active-pane rhyme: one sink, N emitters, one gate). An answer passes ungated: the page drops one whose
          // surface or epoch it no longer shows. A host-door ask waits on the root-services slice.
          if (msg.type === "lar:frame") {
            if (_id === activeSurfaceId) onFrame?.({ ...msg, surface: _id });
            return;
          }
          if (msg.type === "lar:control-result") { onControlResult?.(_id, msg); return; }
          if (msg.type !== "event") return;
          // Coherence-nalu frame → the DOM coherence indicator. `obstructing` rode the wire as JSON
          // (the event payload admits only scalars); parse it back for the sink.
          if (msg.listenable === COHERENCE_FRAME) {
            let obstructing: string[] = [];
            try { obstructing = JSON.parse(String(msg.payload["obstructing"] ?? "[]")) as string[]; }
            catch { obstructing = []; }
            onCoherence?.({
              status:      String(msg.payload["status"] ?? "indeterminate") as CoherenceStatus,
              radius:      Number(msg.payload["radius"] ?? 0),
              glues:       Boolean(msg.payload["glues"]),
              vacuous:     Boolean(msg.payload["vacuous"]),
              obstructing,
              lociTotal:   Number(msg.payload["lociTotal"] ?? obstructing.length),
              label:       String(msg.payload["label"] ?? ""),
              rev:         Number(msg.payload["rev"] ?? 0),
            });
            return;
          }
          // Sensorium-nalu frame → the wiki-sense supervisor's return leg. The FRAME's island id
          // (the pool's wikiId, not any payload claim) pins the answer to the ask's designation.
          if (msg.listenable === SENSORIUM_FRAME) {
            wikiSense.acceptFrame(_id, msg.payload);
            return;
          }
          const verb    = typeof msg.payload["verb"]    === "string" ? msg.payload["verb"]    : undefined;
          const fromUri = typeof msg.payload["fromUri"] === "string" ? msg.payload["fromUri"] : undefined;
          if (!verb) return;
          daemon.placeVerb({
            verb, args: verbArgsFromPayload(msg.payload),   // structured args off the `verb-args` JSON (#48)
            requestedBy: typeof msg.payload["requestedBy"] === "string" ? msg.payload["requestedBy"] : msg.listenable,
            listenable: msg.listenable, ...(fromUri ? { fromUri } : {}),
          });
        },
        ...(workerScriptUrl ? { workerScriptUrl } : {}),
      });
      // Wire the pool through the SHARED residency factory: resolveWikiSpec (the UNKNOWN-grain
      // branch of the true multi-wiki swap) + the activation-on-reference cap (browser's minimal
      // grant) + the sovereign-worker residency binding (daemon evict routes THROUGH the ONE
      // collector) + wiki-alert delivery (the resolver-as-activator single-flight orchestration;
      // browser's hook WARNS + drops best-effort — no durable mailbox). The pool keys a slot by
      // its BARE SLUG (`slotActiveWikiId = sel.slug`), and the shared wiring keys the alert on
      // that same bare slug — never `${hostId}:${wikiSlug}`, which would fork the keyspace and
      // lose every alert. Browser resolves within its minimal grant exactly like node.
      wikiActivation = residencyWiring.wireToPool({
        daemon,
        pool:          vmManager,
        coreHash:      assembly.coreHash,
        islandUrl:     assembly.islandHandle.url,
        catalogHandle: assembly.catalogHandle,
      });
      // The daemon inherits the render cap (dormant-mounted at boot). Forward its frames into the SAME
      // #projection sink the pool wikis use — gated on the active-surface pointer, so a summoned daemon paints
      // and otherwise its frames drop. One sink, the daemon a peer surface among the wikis (KA·BA braid).
      daemon.onFrame((raw) => {
        if (activeSurfaceId !== DAEMON_SURFACE_ID) return;
        const frame = readLarFrame(raw);
        if (frame) onFrame?.({ ...frame, surface: DAEMON_SURFACE_ID });
      });
      daemon.onControlResult((raw) => {
        const result = readLarControlResult(raw);
        if (result) onControlResult?.(DAEMON_SURFACE_ID, result);
      });
      // The daemon's OWN verb OUT-path (a projected switcher click → wiki-switch /
      // add-bag / remove-bag): re-enter the dispatcher via placeVerb so the verb runs on
      // the main registry. LOOP-SAFE as of #48: the reaction-router fires a verb
      // verse-event ONLY on a tiddler carrying the `lares-dispatch` marker, which the verb
      // machinery's own invocation/outcome writes never set — so re-forwarding cannot loop.
      // Summon args ride the structured `verb-args` payload, not the URI (bearing-only).
      const DAEMON_SURFACE_VERBS_LIVE = true;   // #48 loop-safe dispatch — live
      if (DAEMON_SURFACE_VERBS_LIVE) {
        daemon.onVerbEvent((e) => {
          void daemon.placeVerb({
            verb: e.verb, args: e.args, requestedBy: "daemon-surface",
            ...(e.fromUri ? { fromUri: e.fromUri } : {}),
            ...(e.listenable ? { listenable: e.listenable } : {}),
          });
        });
      }
      return vmManager;
    },

    afterLive: ({ wikiHandle }) => {
      // Presence — ephemeral, does not travel via CRDT. The PLACE announces itself, never a face:
      // being-as-place costs nothing civic, so a vessel key is the right thing to be seen by here.
      // Carried in the canonical DID form (`0x` + verifying key) so the field holds what it names.
      wikiHandle.broadcast({ did: `0x${vesselVerifyingKey}` });
      // Boot DEMOTED to a pin (browser gradient): the daemon surface stays always-live
      // on its own; the home wiki registers in the ONE collector as a PINNED `wiki` grain
      // (the single rotatable pin this constrained vessel grants besides the daemon bag).
      // mountPrimaryWiki already mounted + spec-retained it → onHydrate no-ops.
      if (slotActiveWikiId) void residency.pin(slotActiveWikiId, "boot:home-wiki", "wiki");
    },
  }, [...meshExtraCaps, ...whoExtraCaps]);

  const returnLeg = makeSurfaceReturnLeg({
    daemonSurfaceId: DAEMON_SURFACE_ID,
    daemon: () => daemon,
    pool:   () => vmManager,
  });

  // The connection snapshot carries the actual mounted document alongside the crossing verdict, so a
  // served page can report which node wiki it rendered instead of treating a live socket as mount proof.
  connectionState.setWikiDocUrl(result.wikiHandle.url);

  return {
    identity: vesselIdentity,
    pool: result.pool,
    repo,
    store: result.assembly.composite,
    daemon,
    activeWikiId:     slotActiveWikiId,
    activeWikiSource: "boot-arg",
    wikiDocUrl:       result.wikiHandle.url,
    catalogHandleUrl: catalogHandle.url,
    daemonDocUrl:     social.daemonUrl,
    hearthDaemonUrl:  social.hearthDaemonUrl ?? null,
    oracleDocUrl:     result.assembly.islandHandle.url,
    larariumDocUrl:   result.assembly.larariumHandle?.url ?? null,
    phase:            "live",
    crossed: () => relayAdapter?.session != null,
    connectionState,
    siblingChannel: () => siblings?.status() ?? null,
    handOutInvite: () => walked !== null ? popInvite(walkStore, walked.gatePubKey, relayUrl) : Promise.resolve(null),
    // Shut by name (`walker-route-shut`): no walk is presented at the sealed gate, so nothing is carried or fetched.
    carryAtHearth: () => Promise.resolve(null),
    fetchFromHearth: () => Promise.resolve(null),
    // The oracle CONVERTS: the reader dials the peer's FLOOR gate under the pin this vessel holds for it, and reads
    // the pointer and the snapshot as sealed messages. `gatePubKey` is the publisher's key, never the gate's. A joined
    // face presents as itself; a device with no face joined presents FACELESS, under a place key minted for that one
    // read (`facelessFloorPresentation`), which a Nexus answering strangers serves and any other meets with silence.
    readOracle: async <T>(baseUrl: string, gatePubKey: string): Promise<OraclePullResult<T>> => {
      const presentation = facePresentation ?? await facelessFloorPresentation();
      // The Nexus OF THE HEARTH READ: the relay's own where `baseUrl` is the relay's hearth, and none elsewhere. A device
      // at the floor knows its hearth's Nexus by the floor card the URL carried.
      const nexus = oracleNexusFor(baseUrl, { relayUrl, nexus: sovereignNexus ?? carriedCard?.pin.nexus ?? null });
      if (nexus === null || !relayUrl) return { ok: false, reason: "no Nexus is known for this hearth: the URL carries no floor card, and no face joined here names one (nexus-absent)" };
      // The pair index files the hearth under its relay's name, so the read asks under that same name.
      const read = await pullAndVerifyOracle<T>(baseUrl, {
        pins: gatePins, hearth: hearthNameOf(relayUrl), nexus, presentation, audience: DAEMON_BAG_ID,
        deadlines: dialDeadlines(), verifyingKey: gatePubKey,
      });
      if (!read.ok && facePresentation === null && /said nothing/.test(read.reason ?? "")) {
        return { ...read, reason: "silence at the floor: this hearth's Nexus answers no stranger, or the hearth stands out of reach. A face joined to this device reads what the floor holds for it" };
      }
      return read;
    },
    // The return leg routes each event to the surface that painted its target; the active pointer plays no
    // part, so a switch between the person's act and its arrival never moves the event to another island.
    sendControlEvent: returnLeg.sendControlEvent,
    resend: (surface: string) => returnLeg.resend(surface),
    // The uniform pin-selector: flip the live gate synchronously (mount-then-flip — daemon + the pinned wiki
    // are already mounted), then persist the choice fire-and-forget to bags/daemon/active-wiki (read only at next
    // cold boot). No reboot — an active-surface change is a projection-gate flip, not a manifest rebuild.
    setActiveSurface: (surfaceId: string) => {
      const moved = surfaceId !== activeSurfaceId;
      activeSurfaceId = surfaceId;
      // Its frames dropped at the gate until now: ask it to paint whole under a fresh epoch.
      if (moved) returnLeg.resend(surfaceId);
      void daemon.placeVerb({
        verb: "open-wiki",
        args: { slug: surfaceId },
        requestedBy: "summon",
      });
      // Summoning the daemon: seed its switcher list + persona multitude with the live state so
      // the projected widgets paint a current view the moment the daemon becomes the surface.
      if (surfaceId === DAEMON_SURFACE_ID) { pushSwitcherState(); void pushPersonaState(); void pushCircleState(); }
    },
  };
}

/**
 * The browser's share verdict on both hooks — one decision, announce and access alike.
 *
 * `fedGateOf` reads the federation gate AT EACH DECISION. The Repo takes this config before the spore
 * crossing arms the gate, so a gate passed by value holds the pre-crossing `null` for the vessel's life —
 * and a null gate reads a cross-operator relay as the operator's own node (full device sync).
 *
 * The gate it reads is the whole verdict: the PersonaGroup ring composes onto that gate, never beside it.
 * A SIBLING — a peer the sibling channel proved — never reads as a house member: `siblings` hands it to the
 * sibling gate, the ring's sibling path, and nothing else reaches it.
 */
export function browserShareConfig(relayPeers: ReadonlySet<string>, fedGateOf: () => FederationGate | null, siblings?: SiblingShare | null) {
  // `siblings.aside` carries the dyad's shadow: mesh's one law reads it ahead of the sibling gate.
  return shareConfigOf((peerId, documentId) => federationShareDecision(relayPeers, fedGateOf(), peerId, documentId, siblings ?? null));
}
