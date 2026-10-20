export type { CorpusSource } from "./node-host.js";
export { REPO_ROOT, bagsRoot } from "./node-host.js";
export {
  createLanAnnouncement, encodePtrQuestion, encodeLanResponse, decodeLanPacket,
  createLanAnnouncer, createLanListener, candidatePin, dgramLanSocket,
} from "./lan-discovery.js";
export type { LanAnnouncement, LanCandidate, LanSocket, LanDatagramSocket, LanPacket, LanRecord } from "./lan-discovery.js";
export {
  larHome, larDataDir, larIdentityDir, larProjectionDir, larSealHome, larBootstrapPath,
  larHarvestDir, larHarvestStageDir, larStructurePalaceDir, larFormPalaceDir,
  larMempalaceDir, larContentDir, scratchSensoriumDir, scratchSensoriumInstanceDir,
  // XDG base homes + the memory sensorium dir + config path (the consolidated layout).
  laresDataHome, larariumDataHome, larStateHome, larCacheHome, larConfigHome, larRuntimeHome,
  assertOneSegment,
  memorySensoriumDir, memorySensoriumLenses, sensoriumLenses, sensoriumNames, sensoriumDir,
  // The `mesh` sensorium dir + its WHO/AUTHORITY/FLOW child dirs (the consolidated federation tree).
  meshSensoriumDir, meshWhoDir, meshAuthorityDir, meshFlowDir,
} from "./vessel-paths.js";
export { atomicWriteFileSync } from "./fs-atomic.js";
export { fileJournal } from "./vessel-journal-file.js";

// The Erisian date: `ddate(1)` where it stands (it carries holydays, exclamations, X-Day and the whole
// %{…%} shape), the computed calendar where it does not — and the STAMP always computed, because ddate's
// own output shape varies by invocation and a key-derivation cannot ride a moving string.
export { readDdate, ddateAvailable, discordianReading } from "./discordian-reader.js";
export type { DiscordianReading, DiscordianSource } from "./discordian-reader.js";

// A bag's OWN declaration on disk (what it carries · who may read it · where it belongs), the operator's
// REPO REGISTRY (ids, never paths), and the MOVE that relocates bytes and re-anchors the declaration together.
export {
  repoRegistryPath, readRepoRegistry, registerRepo, unregisterRepo,
  bagHomeRoots, metaTableFromBody, readBagManifest, writeBagManifest, surveyBags, moveBagHome,
} from "./bag-declare.js";
export type { BagSighting, BagMoveOutcome } from "./bag-declare.js";

// The ACQUIRED tier — bodies a human did not author, sited readable + verifiable in the SHRINE
// (`<lararium>/library`), a house no wipe names, so a shelf may grow without a repository growing with it.
export {
  larLibraryHome, libraryCollectionDir, resolveLibraryRef, acquireIntoLibrary,
  readLibraryMeta, listCollections, listCollection, verifyCollection, writeLibraryIndex,
} from "./library-store.js";
export type { AcquireOutcome, AcquireOptions, LibraryVerdict } from "./library-store.js";

// The per-daemon resource-override reader + the composable daemon resource caps (`~/.lares/config.json`
// sites bags/genesis/cas away from the repo-relative default; genesis artifacts stay checked-in by default).
export {
  loadLaresConfig, laresConfigPath, daemonCorpusRoot, daemonGenesisDir, daemonBagsDir, daemonCasDir,
  runtimeCasOverride, originDeclaration,
} from "./lares-config.js";
export type { LaresConfig, LaresResourceRoots, LaresVesselState, LaresOriginConfig } from "./lares-config.js";

// The SHEAF-TRUE sensorium primitive — a dir that `#has` fiber-caps (content/structure/form) with
// bands + coupling as base-caps living IN the manifest. The filetree IS the composition.
export {
  SENSORIUM_SCHEMA, SENSORIUM_MANIFEST, manifestPath, capDecl, resolveCapDir, capDir, planeVariance, sensoriumContract,
  SHEAF_PLANES, COSHEAF_PLANES,
  buildSensoriumManifest, readManifest, writeManifest,
} from "./sensorium.js";
export type {
  CapDecl, SensoriumChild, SensoriumCoupling, SensoriumBands, SensoriumManifest, SensoriumOrder, BuildSensoriumOptions,
  Variance,
} from "./sensorium.js";

// The DURABLE sensorium lifecycle CAPS — roster/inspect/reconcile/build/promote/retire/un-retire/purge,
// run direct over the manifest declaration (the mesh reducer + manifest-file I/O; no store holder). The
// gated store-swap + daemon-loop cadence + hardening signal ride here too, feature-gated OFF (stable ground).
export {
  rosterSensoria, inspectSensorium, reconcileSensorium, reconcileAllSensoria, runReconcileCadence,
  buildEphemeralSensorium, promoteSensorium, retireSensorium, unRetireSensorium, purgeSensorium,
  readSensoriumAliases, resolveSensoriumTarget, DEFAULT_HARDENING_HALFLIFE,
} from "./sensorium-lifecycle-verbs.js";
export type {
  LifecycleRow, ReconcileResult, BuildResult, PromoteResult, RetireResult, UnRetireResult, PurgeResult,
} from "./sensorium-lifecycle-verbs.js";

// The LI (sheaf) CONSISTENCY-RADIUS — the Robinson li-disagreement signal over content/structure/form
// (0 ⟺ they glue; positive ⟺ a localizable obstruction), PAIRED with the KI (cosheaf) co-consistency —
// the PUSHFORWARD mirror over bands/coupling (0 ⟺ the flows co-extend; positive ⟺ a localizable
// co-obstruction), the sheaf/cosheaf dual pair.
// The consistency-radius organ (H⁰ li/ki dual), the cohomological gate (H¹ fusion), and the EFE organ
// live PLATFORM-BLIND in `@lararium/mesh` (one hull, every tier — node, tw5,
// browser — reaches the same organs; py mirrors them by contract). Import them from `@lararium/mesh`.

// The memetic-wikitext SENSORIUM — the concrete neither-top, co-located-peers instance: the reader
// (island-scan → standoff strata + skeletal tier + typed association graph, TWO axes span×channel), the
// fractal FFZ-aligned coupler (stratum red↔black ≅ corpus formal↔informal through the mesh keel's
// windowed-coupling runtime + linearity screen), and the `#has {formal, informal}` compose (coupling.
// children, neither top). LI (理 pattern) ⊥ KI (氣 flow).
export {
  bandForSpanLength, SPAN_BAND_MAX, sourceCidOf, sigilHead, stratify,
  SIGIL_INJECTION, sigilInjectionQuery,
  PULSE_GRAIN, coupleAligned, stratumTicks, readKiStratum, ffzAlignTicks, readKiCorpus,
  readLi, readKi, defaultSensoriumBands, buildMemeticWikitextSensorium, buildPeerSensorium,
  stratificationRestrictions,
} from "./memetic-wikitext-sensorium.js";
export type {
  ChannelTag, MuOp, Span, Stratum, SkeletalAnchor, AssociationEdge, SpreadDirection, Stratification,
  SigilInjection, ComposeMemeticWikitextOptions,
  AlignedTick, CoupleAlignedOptions, AlignedCouplingRead, FfzCell,
} from "./memetic-wikitext-sensorium.js";

// The shared palace-organ registry — setup (`lares sense setup`) + teardown read the SAME list. SOVEREIGN
// ONLY; the guest `~/.mempalace` rides its own lane (`guestMempalaceOrgan` / `initGuestMempalace`),
// reached from `lares mempalace …`, never from the boot — the vessel must not write its comparator.
export {
  palaceOrgans, setupPalaceOrgans, organHealthy,
  guestMempalaceOrgan, initGuestMempalace,
  materializeMemorySensorium, materializeMeshSensorium, materializeMemeticWikitextSensorium,
} from "./palace-organs.js";
export type { PalaceOrgan, PalaceSetupStep } from "./palace-organs.js";

// The memetic-wikitext sensorium dir + its formal/informal peer dirs (the co-located-peers tree).
export {
  memeticWikitextSensoriumDir, memeticWikitextFormalDir, memeticWikitextInformalDir, resolveMempalaceExe,
} from "./vessel-paths.js";

// The COUPLING READER — makes `coupling.children` load-bearing: resolves the child edges → each child's
// section over a shared stalk → the H¹-GATED fusion (fuse or hold-open, never a silent average).
export {
  readCoupling, readMemeticWikitextCoupling, defaultChildRestriction, SALIENCES_SIDECAR,
} from "./sensorium-coupling.js";
export type {
  ChildRestriction, CouplingChildRead, CouplingRead, ReadCouplingOptions,
} from "./sensorium-coupling.js";

// The li-radius (H⁰ gluing) READER — the sheaf twin: glue a sensorium's OWN sheaf planes over a shared
// cid stalk through the Robinson radius AND the H¹ gate. Cover-agnostic (the boundary, not the codomain):
// the default single-stream cover reads as a nested-cover PLUMBING witness, a live-boundary reader certifies.
export { readCohere, readCohereAcrossContexts, coveragePlaneReader } from "./sensorium-cohere.js";
export type { PlaneReader, CohereRead, ReadCohereOptions, CohereContext } from "./sensorium-cohere.js";

// The JING read — the li∘ki SQUARE over a child-hosting sensorium's cover (the mesh's who/authority/flow
// lobes): EXTEND the lobes to a reconciled self (ki `fuse`), RESTRICT it back (li), read the round-trip.
// Coheres ⟺ the node's grain and flow round-trip to the identity — the joint the two legs cannot see alone.
export { readJing } from "./sensorium-square.js";
export type { JingRead, LobeRoundTrip, ReadJingOptions } from "./sensorium-square.js";

// The auto-extraction PROJECTOR — read a poured target's child streams into a ChildSignalMV[] signal-matrix
// (the couple_r/mismatch/flow shape), the time-series twin of the salience sidecar. Feature-gated: the
// STRUCTURE uses a `signal.json` sidecar the re-pour lands per child; absent
// ⇒ the honest empty matrix, and the surface names the calibration data-wait.
export { extractSignalFromTarget, defaultChildSignalReader, CHILD_SIGNAL_SIDECAR } from "./sensorium-signal.js";
export type { ChildSignalReader, SignalExtraction, ExtractSignalOptions } from "./sensorium-signal.js";

// The ephemeral astral multipalace lifecycle (the `sensorium` noun-verb tree).
export {
  newSensoriumId, listSensoria, openSensorium, querySensorium, keepSensorium,
  dissolveSensorium, dissolveAllSensoria, listOrphans, reapOrphans, runSensorium,
  sensoriumTeardownDirs, defaultSensoriumIngest, defaultSensoriumSearch,
} from "./sense-sensorium.js";
export { PETNAMES_FILE, listPetNames, attachPetName, proposePetName, acceptPetName } from "./sensorium-petnames.js";
export type { PetName, OperatorNaming, ProjectionNaming } from "./sensorium-petnames.js";
export type {
  SensoriumLifecycle, SensoriumIngest, SensoriumSearch, OpenSensoriumOptions, OpenSensoriumResult,
  QuerySensoriumResult, KeepResult, DissolveResult, RunSensoriumOptions, RunSensoriumResult,
} from "./sense-sensorium.js";

// The stream compose_palace shore — generalize the sensorium lifecycle to ANY StreamAdapter's frames.
export { composeStreamSensorium, defaultStreamPlaneSink } from "./sense-stream.js";
export type { ComposeStreamOptions } from "./sense-stream.js";

export { LarDiskProjector } from "./disk-projector.js";
export { makeGateSorter, socketsNoLongerHeld, ownPlacePosture, SHUT_ARMS } from "./socket-sorter.js";
export type { GateSorterDeps, ShutArm, PlaceClass } from "./socket-sorter.js";
export { gateShadowRing, faceDevicesUnbound } from "./gate-shadow-ring.js";
export { faceDeviceBook, faceDeviceBindings, type FaceDeviceBook, type FaceDeviceSources } from "./face-device-book.js";
export { faceFleetFacets, faceFleetViews, viewFederationGate, type FaceFleetViews } from "./face-fleet-view.js";
export { heldRootHoldings, standingFaceScopes } from "./face-root-holdings.js";
export type { FaceDeviceReading, GateShadowRingDeps } from "./gate-shadow-ring.js";
export { vesselGate } from "./vessel-gates.js";
export type { VesselGateDeps } from "./vessel-gates.js";
export { faceGateServer, gateSessionRegistry, gatePath, wsGateSocket, timerGateDeadlines, GATE_SOCKET_QUEUE_BOUND } from "./face-gate-server.js";
export type { FaceGateServer, GateSessionRegistry, SeatedGateSession, StoodGate, GateWire } from "./face-gate-server.js";
export { openNodeVessel, openNodeHerm, standNodeFloor, seatedSovereignReaders } from "./open-node-vessel.js";
export { openDaemonVm } from "./open-daemon-vm.js";
export { runDoctor, formatDoctorReport, enumerateStoreDocs } from "./doctor.js";
export { probeDocLoad, makeChildProcessDocLoadProbe, quarantineDoc } from "./doc-load-probe.js";
export { precheckDocStore, docStorePath } from "./store-integrity.js";
export { persistIdentityAnchors, loadIdentityAnchors, listAnchoredPersonas, persistIdentityArchive, loadIdentityArchive, persistVeilArchive, loadVeilArchive, archivePath, veilArchivePath, veilArchiveFile, type IdentityAnchors } from "./identity-anchors.js";

export type { DaemonVmOptions } from "./open-daemon-vm.js";
export type { NodeVesselOptions, NodeVesselResult, NodeHermResult, NodeFloor, SovereignReaders, NodeOpenPhase } from "./open-node-vessel.js";
export { createReadinessState, mountReadinessFace, markReadyOnceStanding } from "./readiness-face.js";
export type { NodeReadiness, ReadinessState, ReadinessFace } from "./readiness-face.js";

export { SOCIAL_BOOTSTRAP_PLUGIN_TITLE } from "./open-node-vessel.js";
export { SyncedTree, contentHash, syncedTreeKey, syncedTreeDir, type SyncedBase } from "./synced-tree.js";
export { bagsFileToUri, wikisFileToUri, mirrorDirFileToUri } from "./bag-paths.js";

export { runInit, runFoundTheFace, faceStands, armRecoveryAtFounding } from "./commands/init.js";
export { guardianOffer } from "./guardian-enrolment.js";
// THE STABLE FOUNDING ACT: place, persona zero, the one-seat seed charter and the face that binds its AID — see `found-hearth`.
export { runFoundHearth, foundSeedCharter, HearthFoundingRefused } from "./commands/found-hearth.js";
export type { FoundHearthOptions, FoundHearthResult, HearthCard } from "./commands/found-hearth.js";
// THE ROOT-CARD READER: the split-root cards build a face's body in the person's own process — see `face-card-restore`.
export { buildCardBody, CardRestoreRefused, CARD_REFUSALS } from "./face-card-restore.js";
export type { CardRefusal, FaceNamed, PresentedCard } from "./face-card-restore.js";
// The live read path onto `mesh/dyad` — a vessel enumerates the relationships it already holds.
export { makeBagTierReader, bagNameFromBagUrl } from "./vessel-bag-tier.js";
export type { InitOptions, InitResult, FoundFaceOptions, FoundFaceResult } from "./commands/init.js";

export { runDeviceAdmit } from "./commands/device-admit.js";
export type { DeviceAdmitOptions, DeviceAdmitPayload, DeviceAdmitResult } from "./commands/device-admit.js";
// THE FLEET-JOIN DOOR: the root holder's offer and answer ride the store door; the joining vessel requests, lands
// and abandons in its own process, with no vessel standing.
export { runFleetJoinOffer, runFleetJoinAnswer, runFleetJoinRequest, runFleetJoinLand, runFleetJoinAbandon, FleetJoinRefused } from "./commands/fleet-join.js";
export type { FleetJoinAnswerOptions } from "./commands/fleet-join.js";
export { readJoinedFaceProof } from "./joined-face-proof.js";
export type { JoinedFaceProof, JoinedFaceAbsence } from "./joined-face-proof.js";
export { runHandlePublish, runHandleBurn, runHandleRotate, runHandleAttest, resolveOwnerBurnHand } from "./commands/handle.js";
export type { HandlePublishOptions, HandleBurnOptions, HandleRotateOptions, HandleAttestOptions, OwnerAuthHand } from "./commands/handle.js";

// The Kapae antigen RAISE side (#65) — the founding kahu writes a quorum-signed ban/lift onto the board.
export { runNexusKapae, runNexusKapaeList, runNexusKapaeOpen, runNexusKapaePartial, NexusKapaeError, type NexusKapaePartialResult } from "./commands/nexus-kapae.js";
export { runHostState, runHostRoll, runHostInvite, HostRefusal } from "./commands/host.js";
export type { HostedNexusReading, HostRollResult } from "./commands/host.js";
export { runWalkState, runWalkTake, runWalkInvite, WalkRefusal } from "./commands/walk.js";
export type { WalkReading } from "./commands/walk.js";
// ONE STORE, ONE HOLDER — the door table every store command routes through, and the one direct opener.
export { storeDoorReactors, storeDoorDirect, STORE_DOOR_VERBS, type StoreDoorVerb, type StoreDoorDeps } from "./store-door-verbs.js";
export { ownedStore, claimStore, StoreHeld, StoreHeldElsewhere, type StoreClaim, readBootEpoch, bootEpochPath } from "./owned-store.js";
export { claimName, anchoredName, NameTooLong, NameHeld, NameReaping, type ClaimedName, type ClaimNameOptions } from "./socket-claim.js";
export { readHearthDialPin } from "./hearth-dial-pin.js";
export {
  readHostingState, rollHosting, liveEpochs, spendToken, spendMintMarker, redeemedCount, mintedCount, hostingDir, hostingRowDir, HostingStateMoved,
  DEFAULT_HOSTING_CAP,
} from "./hosting-store.js";
export type { HostingState, SpendOutcome } from "./hosting-store.js";
export type { NexusKapaeOptions, NexusKapaeResult, NexusKapaeListResult } from "./commands/nexus-kapae.js";
export { runNexusPublishPlugins, NexusPublishError } from "./commands/nexus-publish.js";
export type { NexusPublishPluginsOptions, NexusPublishPluginsResult } from "./commands/nexus-publish.js";
export { runNexusInspectOffering, NexusOfferingInspectError } from "./commands/nexus-offering-inspect.js";
export type { NexusOfferingInspectOptions, NexusOfferingInspectResult } from "./commands/nexus-offering-inspect.js";

// The operator MEMBERS-registry RAISE side (Build-2) — the founding kahu writes a quorum-signed + contract-in
// admit/revoke onto the members board (the antigen's ALLOW-twin); `accept-carriage` mints the operator contract-in.
export { runCabalVouch, CabalVouchError } from "./commands/cabal-vouch.js";
export { runCabalJoin, CabalJoinError } from "./commands/cabal-join.js";
export { runCabalFace, CabalFaceError, type CabalFaceResult } from "./commands/cabal-face.js";
export { runEdgeKapae, EdgeKapaeError } from "./commands/edge-kapae-cmd.js";
export type { EdgeKapaeOptions, EdgeKapaeResult } from "./commands/edge-kapae-cmd.js";
export { runEdgeRollAnchors, EdgeRollAnchorError, type EdgeRollAnchorLanded } from "./commands/edge-roll-anchor.js";
export { readVesselEdgeBoard, vesselEdgeCharter, type VesselEdgeBoardRead } from "./edge-board.js";
export { runEdgeSeatFacts, runEdgeSeatMarks, EdgeSeatError, type EdgeSeatFacts } from "./commands/edge-seats.js";
export { runEdgePartial, runEdgeCosign, EdgeCosignError, type EdgePartialResult, type EdgeCosignResult } from "./commands/edge-cosign.js";
export { runPromoteOpen, runPromoteSign, runPromoteCheck, runPromoteCheckBytes, promotionStatementDigest, PromoteError, type PromoteOpenResult, type PromoteSignResult } from "./commands/nexus-promote.js";
export { runCabalAct, runCabalCosign, runCabalStanding, NexusCabalError, type NexusCabalActResult } from "./commands/nexus-cabal.js";
export type { CabalVouchOptions, CabalVouchResult } from "./commands/cabal-vouch.js";
export type { CabalJoinOptions, CabalJoinResult } from "./commands/cabal-join.js";
export { runRaiseSign, readRaiseChallenge, RaiseSignError } from "./commands/raise-sign.js";
export type { RaiseSignResult } from "./commands/raise-sign.js";
export { runNexusContract, runNexusAcceptCarriage, runNexusCarryFor, runNexusMembersList, NexusContractError,
  runNexusContractOpen, runNexusContractPartial, type NexusContractPartialResult,
  runNexusRollAnchor, runNexusRollAnchorOpen, runNexusRollAnchorPartial, runNexusRollPriorAnchorCheck, runEdgeRollAnchorOpen, runEdgeRollAnchorPartial, runEdgeRollAnchorStanding, type NexusRollPriorAnchor, type NexusEdgeRollAnchorPartialResult, type NexusEdgeRollAnchorStanding, type NexusRollAnchorPartialResult, hasContractedInto, type CarriageConsent, type NexusRollAnchorResult } from "./commands/nexus-contract.js";
// The carried set — the Nexuses this vessel carries for, one contract-in each; partner charters land beside the primary.
export { importCarriedCharter, readCarriedCharters, writeConsent, readConsent, carriedSet, carriedReadings,
  carriedCharterHome, carriageConsentPathFor, charterHomeFor, primaryNexusAid, CarriedCharterError,
  type CarriedImportResult, type CarriedReading } from "./carried-set.js";
export type { NexusContractOptions, NexusContractResult, NexusMembersListResult } from "./commands/nexus-contract.js";
// The CARRIED admit — a joinee takes the bundle `nexus contract` emits, keeps it per Nexus, and presents it at the
// hearth that wrote it (the dial ties a gate key to a Nexus through it).
export {
  takeAdmitBundle, readKeptAdmitBundle, readKeptAdmitBundles, admitBundlePathFor, admitBundleHolds, dialedNexusAid,
  isAdmitBundle, AdmitBundleError, type AdmitBundle, type AdmitTakeResult,
} from "./admit-bundle.js";
export { takeCarryBundle, carryBundleFrom, CarryBundleError, CARRY_BUNDLE_KIND, type CarryBundle, type CarryTakeResult } from "./carry-bundle.js";

// The MEMBERSHIP consult holder — the carry-split's member gate: the LEAF MAP, filled from presented admits only.
export {
  makeNexusMembership, readCarriedNexuses, leafStandingFor, liveBoardOpener,
} from "./nexus-carriage.js";
export type {
  NexusMembershipHolder, SocketBinding, CarriedNexusReading, CarriedVia, LeafStanding, BoardOpener,
} from "./nexus-carriage.js";
// The cad seal's first live producer (seal a staged carrier body into the ciphertext federation plane, additive to the cleartext wake).
export { cadSealDir, sealCarrierForFederation, ContentKeyUnavailable } from "./seal-carrier-federation.js";
// The cad WIRE CONSUMER — a member carries a sealed body peer-to-peer over the request-response hop, gated by the
// member blind-transit lane; a stranger / Kapae'd presenter draws Mu (byte-identical to caught-up satiety).
export {
  serveCasWire, decideAndServeWantBlock, fetchSealedCidOverWire, muWireBytes,
  CAS_WANT_BLOCK, CAS_BLOCK, CAS_MU,
} from "./cas-wire.js";
export type { CasWireServerDeps, CasWireFetch } from "./cas-wire.js";

export { loadVesselVerifyingKey, loadVesselSigningSeed, loadVesselCard, persistVesselCard, vesselFloorKeyDoor, FloorKeyDoorRefused } from "./node-vessel-identity.js";
// The reach-face helpers — every http origin a vessel answers on + the ws:// dial each yields. Re-used by the
// `lares herm` stand-up verb to print the carriage crossroads' dial URLs (host from the face, the relay's own port).
export {
  deriveReachFaces, wsUrlForOrigin, originCompositionForFace, webOriginForFace, oracleOriginForFace,
  assertWaystoneCustody, crossingBannerLines, OriginCustodyRefusal,
  type ReachFace, type InterfaceTable, type ExplicitOriginComposition, type FaceOriginComposition,
  type WaystoneOriginComposition, type StandingOriginComposition, type OriginStanding,
} from "./lan-address.js";
export { isSerdeSkewFault, bootFaultReport, fatalLine, SERDE_SKEW_EXIT, SERDE_SKEW_CURE } from "./boot-fault.js";
// The active-persona selector — "put on a mask" at the identity layer (Plurality Pono). The persona-root
// SET mints/loads the operator-root the `lares persona` door drives (founder-side custody).
export { loadActivePersonaIndex, wearPersona, personaRootExists, listPersonaRoots, listPersonaRosterLines, orphanPersonaRoots, VesselKeyMintRefused, VesselInceptionRefused } from "./node-vessel-identity.js";
export { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";
export type { PersonaGroupRoot, PersonaRosterLine } from "./node-vessel-identity.js";
// The two-layer pet-names (#64 stage 4): the PRIVATE own-persona label map (fleet-only; never PUBLICLY
// federates) + the PUBLIC own-published-face record (persona → crossroads-plane glamour, the one act that binds a
// persona to a public name). Distinct stores, distinct from the handle-book.
export { makeNodePersonaPetnameStore, makeNodePublicHandleStore } from "./node-vessel-identity.js";
// The DECLARATION store — the Handle a persona answers to + whether it stands for a Kahu seat. Sits between
// the private label and the published record so a private compartment name never becomes a public commitment.
export { makeNodePersonaDeclarationStore } from "./node-vessel-identity.js";

// The IoC follow — the node-fs LOCAL adapters for the private circle-graph + the recogniser's handle-book.
// Both under the identity home, sealed under the vessel key, never federated (the `lares circle` door drives them via composeFollow).
export { loadNodeHandleBook, saveNodeHandleBook, HANDLE_BOOK_FILE } from "./node-circle-store.js";
// QR transport — GENERATE a scannable carriage QR (terminal / PNG / SVG / matrix, ECC H) + DECODE a still PNG
// through an injected decoder shore (the headless node scanner + the browser camera both plug in behind it).
export {
  qrCarriageToPngBuffer, qrCarriageMatrix,
  pngToImageData, decodeQrPng, HANDSHAKE_QR_ECC,
} from "./qr-transport.js";
export type { QrImageDecoder } from "./qr-transport.js";
// THIS vessel's local persona-KEL board, read: a KEL's head and its sequence off one board read.
export { makeLocalPersonaKelHeadAndSeqResolver } from "./local-persona-kel.js";
// The `bags/nexus` charter DOC adapter — the antigen roster's authority home read/written on disk (#66).
export {
  readNexusDoc, parseNexusDoc, writeNexusDoc, renderNexusDoc, writeNexusSeal, writeNexusKahu, writeNexusPractice,
  nexusCharterDocPath, nexusCharterDocRelPath, nexusCharterStands, nexusCharterShape,
} from "./nexus-doc.js";
export type { NexusCharterShape } from "./nexus-doc.js";
export { loadLeafIdentity } from "./leaf-identity.js";
export type { LeafIdentity } from "./leaf-identity.js";
// A seat's own key: one cold sealed row per key, minted at random, apart from every persona root and every leaf.
// The seal rite arms its heads from these rows and the quorum doors sign with them.
export {
  SEAT_KEY_FILE, heldSeatKey, listSeatKeys, mintSeatKey, retireSeatKey, seatKeyFile, seatKeyName, seatKeysOfFace, signAsSeat, storeSeatKey,
} from "./seat-key-store.js";
export type { HeldSeatKey } from "./seat-key-store.js";
export { heldSeatSigners, selectHeldQuorumSigners } from "./held-quorum.js";
export type { HeldQuorumSigner } from "./held-quorum.js";
export type { ArmedGenesis, ArmedRoll, SeatKept } from "./seal-ceremony.js";
// The crossing record's own library (its bytes, its cid, its mint and its verdict): a pure module the seal
// ceremony's rows call, and the one a reader of a carried record verifies it with.
export {
  reserveTransitionBytes, witnessSignBytes, reserveTransitionCidOf, mintReserveTransition, transitionSignerFromSeed, verifyReserveTransition,
} from "./reserve-transition.js";
export type { ReserveTransition, ReserveTransitionCore, TransitionWitness, TransitionSigner, TransitionVerdict } from "./reserve-transition.js";
export { VerbDispatcher, VerbTable } from "@lararium/tw5";
export type { VerbReactor, VerbContext, VerbDispatcherOptions } from "@lararium/tw5";
export { heedSummons } from "@lararium/tw5";
export type { SummonsRelayOptions, SummonsRequest } from "@lararium/tw5";
export { runLocalVerb, makeCapVerify } from "@lararium/tw5";

// The where + resolve reactors live in @lararium/tw5 (worker-data-verbs) and run in the daemon worker
// (sovereign-worker, verify-then-delegate); a node caller reads them through this barrel.
export { makeWhereReactor, makeResolveReactor } from "@lararium/tw5";

// The verb-plane reactors live at their pono home @lararium/tw5 (composite/repo-only, not
// node-specific; both vessels hold them); a node caller reads them through this barrel.
export {
  makeListWikisReactor, makeInitWikiReactor, makeOpenWikiReactor,
  makeWikiPinReactor, makeWikiUnpinReactor,
  makeAddBagReactor, makeRemoveBagReactor,
  makePruneStaleReactor, makeDraftReactor,
  makeCompactBagReactor, makeRotateRecipeReactor,
  makeResidencyStatsReactor,
  makePinReactor, makeUnpinReactor, makeRegisterColdReactor,
} from "@lararium/tw5";
export type {
  WikiHandlerOptions, WikiMintHandlerOptions,
  WikiComposeOptions, DraftHandlerOptions,
  EpochHandlerOptions, RotateRecipeOptions, ResidencyHandlerOptions,
} from "@lararium/tw5";

export { VesselIslandPool } from "./vessel-island-pool.js";
export type { VesselIslandPoolOptions } from "./vessel-island-pool.js";
// The consolidated sensorium file — the manifest primitive + the shared palace transport +
// the palace CLIENTS (content/form/persistence) + the unified cap-stack. The palace transport
// cap (the #has-stack foundation both local stores compose) lives here.
export { PalaceHolder, PalaceHolderRegistry, canonicalDirOf } from "./sensorium.js";
export type { PalaceHolderProc, PalaceHolderSpawn, PalaceFeedCap } from "./sensorium.js";
export { makePersistencePalace } from "./sensorium.js";
export type { PersistencePalace, RecordProvenance, PersistencePalaceOptions } from "./sensorium.js";
export { makeContentPalace } from "./sensorium.js";
export type { ContentPalace, ContentEntry, ContentMatch, ScannedRecord, ScanPage, Taxonomy, ContentPalaceOptions } from "./sensorium.js";
export { importGuestPalace } from "./guest-import.js";
export type { GuestImportResult } from "./guest-import.js";
export { makeSearchCap } from "./search-cap.js";
export type { SearchCap, SearchHit, SearchResult, SearchCapOptions } from "./search-cap.js";
export { makeKgCap } from "./kg-cap.js";
export type { KgCap, TripleOpts, KgCapOptions } from "./kg-cap.js";
export { makeGraphCap } from "./graph-cap.js";
export type { GraphCap, GraphCapOptions } from "./graph-cap.js";
export { composePalaceCaps } from "./sensorium.js";
export type { PalaceCaps, PalaceCapsOptions } from "./sensorium.js";
export { makeLaresQuery, openMemorySensorium } from "./lares-query.js";
export { runTrialServing, trialContentDir, verifyTrialModel } from "./sensorium-trial-serving.js";
export type { LaresQuery, Lens } from "./lares-query.js";
export { makeEmbedCap } from "./embed-cap.js";
export type { EmbedCap, EmbedResult, EmbedCapOptions } from "./embed-cap.js";
export { makeSourceCapture } from "./capture/capture-source.js";
export type { SourceCapture, SourceCaptureRequest, SourceCaptureResult, SourceCaptureSpawn } from "./capture/capture-source.js";
// The herm's relay port: the persona-KEL drops over plain HTTP; every upgrade meets silence.
export { startHermRelayPort } from "./herm-relay-port.js";
export type { HermRelayPort } from "./herm-relay-port.js";
// The CARRIAGE relay capability: the herm's relay port and the DHT-free bag-tracker, one service.
export { startCarriageRelay } from "./carriage-relay.js";
export type { CarriageRelay } from "./carriage-relay.js";
// The immune keel's RE-KEY (roll a lease epoch, per-writer-slot max-register) + RE-SHARE (list held sealed bodies
// to re-announce) teeth at the Herm's own tier — the `nexus-rekey` / `nexus-reshare` daemon verbs' cores.
export { rollLeaseEpochOnBoard } from "./lease-rekey.js";
export type { LeaseRekeyResult } from "./lease-rekey.js";
export { listSealedCids } from "./cas-reshare.js";
// The BULB cap — the genesis seed + the CAS it names, named by the seed's CID and served by cid over the public
// floor; and the two library doors (`pullBulb` by a bulb CID, `pullArrival` off a lararium's own Pronaos) that pull
// it + kindle a NEW SOVEREIGN hearth (the device mints its OWN key — serve fire, never key). All-public OPEN path
// (bulb ⊥ stolon).
export { buildBulb, assembleBulb, readBulbArtifact, bulbSeed } from "./bulb.js";
export type { BulbArtifact, BulbBlob } from "./bulb.js";
export { mountBulbReadFace, mountHermWaymark, hermWaymarkBytes, WAYMARK_FORMAT } from "./bulb-read-face.js";
export type { HermWaymark } from "./bulb-read-face.js";
export {
  mountPronaosReadFace, mountPronaosPublicArtifact, pronaosRequestHandler,
  pronaosPublicArtifactRequestHandler, pronaosRouteInventoryForProjection,
} from "./pronaos-adapter.js";
export type {
  PronaosFile, PronaosProjection, PronaosPreparedProjection, PronaosMount,
} from "./pronaos-adapter.js";
export { buildPronaosProjection } from "./pronaos-projection.js";
export type { PronaosProjectionInputs } from "./pronaos-projection.js";
export { composePronaosFromEnv, parsePronaosCompositionConfig } from "./pronaos-composition.js";
export type { PronaosComposition, PronaosCompositionConfig } from "./pronaos-composition.js";
export { bulbCap } from "./node-caps.js";
export { pullBulb, pullArrival, kindleFromBulb, httpBulbTransport } from "./kindle.js";
export type { BulbPullTransport, KindleResult } from "./kindle.js";
export { startNexusClientDial, maybeStartNexusClientDial } from "./nexus-client-dial.js";
export type { NexusClientDial, NexusClientDialConfig, NexusClientDialInput } from "./nexus-client-dial.js";
export { FileMembershipChannel } from "./file-membership-channel.js";
export { makeFormPalace } from "./sensorium.js";
export type {
  FormPalace, FormPalaceOptions, FormHolderSpawn, FormMetadata, FormStoreResult,
  FormMatch, FormEntry, SerializedBasis,
} from "./sensorium.js";
// P4 — the RRF multi-graph query: fuse the CONTENT (verbatim mempalace), FORM (.formpalace), and
// later graphs on verbatim_sha by N-ary reciprocal rank fusion (living-grammar-palace#dual-graph).
export {
  fuseMultiGraph, multiGraphRecall, buildFormWhere, combineWhere, makeFormSearch, DEFAULT_RRF_K,
  resolveApertureGrain, apertureWeight, weightByAperture, PARAGRAPH_APERTURE,
  contentKeyOf, contentLeg, formLeg, verbatimShaOf,
} from "./sensorium-recall.js";
export type {
  MultiGraphHit, MultiGraphOptions, MultiGraphRecallDeps, MultiGraphRecallArgs, MultiGraphRecallResult,
  GraphLeg, GraphItem, ExtraGraph, ApertureWeightOptions, ShaOrGap,
  FormSearchPalace, FormSearchConfig,
} from "./sensorium-recall.js";
// The telemetry capture cap is FOLDED into the daemon bag (idempotent: every daemon carries it).
// node-daemon-island wires the capture SINK live (from the
// daemon spawn's optional workerData.telemetry) or leaves the cap inert. The capture core stays
// composable + isomorphic: @lararium/mesh capture-engine + the tw5 `hasCapture` cap; node shores via
// makeNodeCaptureEngine.

// ── The cleartext `cid/` CAS tier — read · list · sweep (tiddler-carriage #/pin-and-release) ──
export { KEY_CLASSES, isKeyClass, isRelationClass } from "@lararium/mesh";
export { FsCustodyIo, vesselCustodyIo, CustodyLockRefused, CUSTODY_CLAIM_NAME, type FsCustodyIoOptions } from "./custody-io.js";
export type { KeyClass } from "@lararium/mesh";
// The ONE carrier table: every carrier at rest by home, custody class and writer. The custody status, the VK
// rotation, the bundle's cut and the custody shape reader all derive from it — see `vault-carriers`.
export {
  CUSTODY_CLASSES, CUSTODY_PARTS, carrierTable, carrierCensus, outsideTheTable, vesselCustodyHomes,
  vkSlotsPath, skSlotsPath, vkSealedCarriers, rotateVesselVk,
} from "./vault-carriers.js";
export type {
  CustodyClass, CustodyPart, CustodyTarget, CustodyHome, CustodyHomes, CarrierRow, CarrierEntry, OutsideFile, OutsideWhy,
} from "./vault-carriers.js";
// The old-shape reader: the shape every vessel home stands in, read before any write — see `custody-shape`.
export { readCustodyShape, oldShapeRefusal, FRESH_START_RUNBOOK } from "./custody-shape.js";
export type { CustodyShape, CustodyShapeReading, OldShapeOffender, OldShapeReason } from "./custody-shape.js";
// The custody root: the hot carrier every sovereign derivation stands on, apart from the floor key — see `custody-root`.
export {
  CUSTODY_ROOT_BYTES, CustodyRootRefused, mintCustodyRoot, custodyRootFromBytes, isCustodyRoot, custodyRootPath,
  custodyDerive, custodyVeil, openCustodyRootCarrier, sealCustodyRoot,
} from "./custody-root.js";
export type { CustodyRoot, OpenedCustodyRoot } from "./custody-root.js";
// The custody session: found, unlock, bind, unbind, rotate and read the vessel's key custody — see `custody-session`.
export {
  foundCustody, unlockCustody, bindCustodySlot, unbindCustodySlot, rotateCustody, custodyStatus,
  custodyTreeStands, assertFoundingRoute, CustodyFoundingRefused, RotationSlotsRefused,
} from "./custody-session.js";
export type { CustodyUnlock, CustodyStatus, CustodyStatusRow } from "./custody-session.js";
export { casDirForStorage, readCasBlobFromFs, readVerifiedCasBlobFromFs, listCasBlobs, casSweep, readCasPins, writeCasPins, pinCas, releaseCas } from "./node-cas.js";
export type { CasSweepOptions, CasSweepResult } from "./node-cas.js";
export { readGenesisCasManifest, genesisProtectSet, genesisCasDir, genesisSeedCid, genesisSeedFileBytes,
  readGenesisEngineCid, readGenesisGrammarCid, readGenesisPluginsCid,
  GENESIS_ENGINE_CID } from "./genesis-artifact.js";
export { makeCustodyHolder, CustodyLocked, CustodyRowUnknown, CustodyRowUnavailable, CustodyAdoptRefused, UNLOCK_ATTEMPTS_PER_BOOT } from "./custody-holder.js";
export { runSealedAct, isSealedActName, SealedActRefused, SEALED_ACTS, SEALED_ACT_NAMES, SIGN_IMAGE_LIMIT, TEXT_ARG_LIMIT, LABEL_ARG_LIMIT, SNAPSHOT_ARG_LIMIT, type SealedActName, type SealedActContext, type SealedActRefusalReason, type PersonaSelvesPlane, type PersonaSelfLine, type PersonaSelfNameKind } from "./sealed-acts.js";
export { gateMemoryRows, gateMemoryRowFile, GateMemoryRowRefused, GATE_MEMORY_DIR } from "./gate-memory-rows.js";
export { gateGrantFor, gateGrantRing } from "./gate-rings.js";
export type { GateGrantRing, GateGrantRingReaders, GateRootHolding } from "./gate-rings.js";
export { custodyGateDoor, seatCustody, unseatCustody, seatCustodyWhenNeeded, seatedCustody, custodyHeld, openedCustody, readCustodyRow, writeCustodyRow, updateCustodyRow, openColdCustodyRow, updateColdCustodyRow, custodyVeilKeys } from "./custody-seat.js";
export type { RowUpdate } from "./custody-holder.js";
export type { CustodyOpener } from "./custody-seat.js";
export type { CustodyHolder, HolderUnlock, RowReading } from "./custody-holder.js";
export { custodyFrameHandler, isCustodyFrame } from "./custody-frames.js";
// The verb socket's front, named here for a suite that stands a custody door as the vessel's main thread does.
export { serveUdsFront, type UdsFront } from "./uds-channel.js";
export type { CustodyFrame, CustodyAnswer, CustodyFrameDeps } from "./custody-frames.js";
