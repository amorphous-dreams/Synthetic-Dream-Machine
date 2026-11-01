/**
 * @lararium/mesh — the platform-blind floor every other package composes on.
 *
 * WHAT STANDS HERE AFTER THE MESH-SCOPE CUT, AND WHY. The cut moved each module with exactly one
 * reader to that reader's own package (keyhive, node, tw5, lares-cli). What remains is kept here on
 * one of these grounds, each verified against the tree rather than assumed:
 *
 *   · SHARED BY TWO OR MORE PACKAGES — a module more than one package's `src/` imports has no single
 *     reader to move to; it stays the floor they compose on.
 *   · TRANSPORT LAW — `mu-void` states the deny-void law the transport itself must hold, true for
 *     every platform that speaks it, never one reader's concern.
 *   · MEME-NAMED — a canon meme already names the module as its own mesh source-file: `offering-antigen`,
 *     `quorum-entry`, `kumu-device`, `bag-copy-plan`, `signer-class`, `cert-expiry-gauge`,
 *     `crossroads-cry`, `holdings-witness`, `projection-registry`, `parallel-ingest`.
 *   · SENSORIUM-DEFERRED — `bures-metric`, `rank-te`, `windowed-coupling`, `partition-monitor`,
 *     `self-coupling`, `synthetic-drift`, `linearity-gate`, `independence-reading` carry an instrument
 *     the Sensorium wiring has not reached yet; no package reads them as a sole consumer today.
 *   · RULING-GATED — `recipe`, `readiness`, `reaction-graph` and `floor-manifest` hold their mesh
 *     source-file seats under the recipe and floor rulings; `pronaos` and `offering-inspection` carry
 *     their own mesh-namespace memes. Each other move waits on its
 *     own ruling, not this cut.
 *   · PERSONA-SELVES NAMING — `PERSONA_SELVES_PREFIX`, `personaSelfTiddlerUri` and
 *     `handleIndexFromSelfTiddlerUri` (in `lar-uris.ts`) carry the self-tiddler naming scheme tw5's
 *     `persona-selves`/`persona-selves-plane` build on directly, and keyhive's ceremony core reads
 *     the same `lar-uris` namespace constants alongside it.
 */

export {
  load as automergeLoad,
  save as automergeSave,
  init as automergeInit,
  change as automergeChange,
  getHeads,
} from "@automerge/automerge";
export type { Heads, Doc as AutomergeDoc } from "@automerge/automerge";
export * from "./base-doc.js";
export * from "./stored-value.js";
export * from "./stored-record.js";
export * from "./catalog-row.js";
export * from "./floor-manifest.js";
export * from "./cas.js";
export * from "./lar-camera.js";
export * from "./record-port.js";
export * from "./port-lease.js";
export * from "./resolver.js";
export * from "./bag-residency.js";
// WHERE a bag's bytes rest — repository | hearth | ley — the third self-describing axis beside the cap-tier
// (who may read) and the residency temperature (whether it stands loaded). Fail-closed to hearth.
export * from "./bag-home.js";
// A bag's OWN `meta` declaration — what it carries, who may read it, where it belongs. The manifest that makes
// the three self-describing axes actually SPOKEN rather than merely defined.
export * from "./bag-manifest.js";
// The ACQUIRED tier — bodies a human did not author, kept readable + verifiable OUTSIDE every tracked tree.
// Distinct from the runtime CAS: derived blobs rebuild, acquired ones do not.
export * from "./library-tier.js";
// The Erisian reckoning, computed rather than shelled out for — ddate(1) ships with many machines and no
// machine reliably, and the whole calendar fits in one function.
export * from "./vessel-identity-core.js";
export * from "./anchor-store.js";
export * from "./persona-vault.js";
export * from "./vessel-standing.js";
export * from "./raise-challenge.js";
export * from "./persona-petname.js";
export * from "./persona-declare.js";
export * from "./persona-glamour.js";
export * from "./recovery-keel-core.js";
export * from "./custodian-card.js";
export * from "./recovery-registration.js";
export * from "./capability.js";
export * from "./domains.js";
export * from "./face-atom.js";
export * from "./face-leaf-bond.js";
export * from "./face-anchor.js";
export * from "./face-anchor-custody.js";
export * from "./signed-act.js";
export * from "./hand-lineage.js";
export * from "./persona-act.js";
export * from "./persona-act-board.js";
export * from "./intent-entry.js";
export * from "./intent-verbs.js";
export * from "./intent-read.js";
export * from "./intent-view.js";
export * from "./intent-issue.js";
export * from "./intent-relay-door.js";
export * from "./intent-delegation.js";
export * from "./intent-rubric.js";
export * from "./lease-advance.js";
export * from "./charter-hand-lineage.js";
export * from "./quorum-lease.js";
export * from "./face-boot-proof.js";
export * from "./face-reading.js";
export * from "./join-face-documents.js";
export * from "./edge-frontier-board.js";
export * from "./fleet-frontier.js";
export * from "./realm-frontier.js";
export * from "./frontier-carry.js";
export * from "./realm-admit-bundle.js";
export * from "./edge-frontier.js";
export * from "./face-atom-custody.js";
export * from "./place-signer.js";
export * from "./custody-carrier-context.js";
export * from "./crypto.js";
export * from "./agile-digest.js";
export * from "./projection-registry.js";
export * from "./readiness.js";
export * from "./lar-uris.js";
export * from "./boot-resolver.js";
export * from "./capture/build-patch.js";
export * from "./capture/branch-frontier.js";
export * from "./capture/gone-turns.js";
export * from "./stream-adapter.js";
export * from "./text-stream-adapter.js";
export * from "./sensorium-pc.js";
export * from "./aperture-selector.js";
export * from "./epoch-lease.js";
export * from "./lar-did.js";
export * from "./device-delegation.js";
export { holderSessionProofBytes, signHolderSessionProof, verifyHolderSessionProof } from "./holder-session-proof.js";
export type { HolderSessionProofFields, HolderSessionProofReading } from "./holder-session-proof.js";
export * from "./authority-verdict.js";
export * from "./flow-substrate.js";
export * from "./flow-read-client.js";
export * from "./plugin-offering.js";
export * from "./plugin-offering-selector.js";
export * from "./offering-announce.js";
export * from "./offering-antigen.js";
export * from "./offering-inspection.js";
export * from "./mesh-palace.js";
export * from "./pronaos.js";
export * from "./capture/bearing-harvest.js";
export * from "./capture/turn-harvest.js";
export * from "./capture/stamp-filter.js";
export * from "./mirror-paths.js";
export * from "./tiddler-store.js";
export * from "./recipe.js";
export * from "./flow.js";
export { bagStackFromRec } from "./bag-stack-from-rec.js";
export * from "./composite-store.js";
export * from "./find-or-throw.js";
export * from "./sensorium-consistency.js";
export * from "./sensorium-contract.js";
export * from "./sensorium-fusion.js";
export * from "./sensorium-efe.js";
export * from "./itc.js";
export * from "./ffz-clock.js";
export * from "./ffz-project.js";
export * from "./worldline-clock.js";
export * from "./worldline-edge.js";
export * from "./worldline-trajectory.js";
export * from "./worldline-inject-detect.js";
export * from "./capture-nalu.js";
export * from "./capture/capture-engine.js";
export * from "./projection-nalu.js";
export * from "./host-task.js";
export * from "./gate-tuning.js";
export * from "./lar-event-bus.js";
export * from "./social-tiddlers.js";
export * from "./automerge-doc-store.js";
export * from "./parallel-drafts.js";
export * from "./lar-vessel.js";
export * from "./lararium-vessel.js";
export type { IdentitySlot, CapabilityToken, ActorId } from "./identity-slot.js";
export {
  makePersonaGroupIdentityRing, governedPlaneDocIds, provenVesselKeyOf,
  type PersonaGroupIdentityRing, type PersonaGroupGrantReading, type PlaneCatalog,
} from "./persona-group-ring.js";
export * from "./leaf-peer-proof.js";
export * from "./sibling-channel.js";
export * from "./persona-group-secret.js";
export * from "./persona-kel-drop.js";
export type { FederationGate, SiblingShare, ShadowConsult } from "./federation-gate.js";
export { presenterStandsAside } from "./federation-gate.js";
export { gateSweep } from "./gate-sweep.js";
export type { GateSweepSeat, GateSweep, GateSweepPorts } from "./gate-sweep.js";
export { DeterministicFederationGate, federationShareDecision, identityShareDecision, siblingShareDecision, shareConfigOf } from "./federation-gate.js";
export type { SharePolicyFn, ShareConfigOf, ShareVerdictRecord, ShareVerdictSink } from "./federation-gate.js";
export type { IdentityRing } from "./federation-gate.js";
export type { AntigenRing } from "./federation-gate.js";
export { presenterIsKapaed, carryContractShareDecision, classifySocket, answersStrangers } from "./federation-gate.js";
export { carrierShareDecision, capTierShareDecision } from "./federation-gate.js";
export type { NexusMembership, PlaneSeal } from "./federation-gate.js";
// THE SCOPED VIEW: a session reads its face's documents through it (the node's D3 share verdict over a same-operator session).
export { SessionDocumentView, SessionViewError } from "./session-document-view.js";
export type { SessionDocumentFacets, DocumentFacet, FacetLayer } from "./session-document-view.js";
// The household's own certificate witness — nothing outside this stack warns before a cert expires.
export type { CertExpiryBand, CertLifetime, CertExpiryReading } from "./cert-expiry-gauge.js";
export {
  readCertExpiry, wantsAttention, renewalCadenceDays, graceWindowDays,
  RENEW_ELAPSED, WARN_ELAPSED, URGENT_ELAPSED,
} from "./cert-expiry-gauge.js";
// The bag's sharing-posture as SELF-DESCRIBING DATA — the 4-tier total order + the tighten-only keystone.
export type { CapTier, TierFloorSource, DeclaredTierSource, CapTierRing } from "./cap-tier.js";
export {
  CAP_TIER_ORDER, DEFAULT_CAP_TIER, capTierRank, parseCapTier, meetCapTier, resolveTier,
  refineBagTierWithTiddlers, mayDeclareTier, mayDeclassify, structuralFloorFor, resolveTierForDoc,
  tierPermitsRelayPeer, makeTierFloorSource,
} from "./cap-tier.js";
// The cad ENCRYPT-ON-CAS primitive — cid = BLAKE3(ciphertext), verify-cap ⊥ read-cap.
export {
  ciphertextCid, verifyCiphertextCid, sealPrivateBody, openPrivateBody,
  CIPHERTEXT_CID_ALGO, OPEN_PRIVATE_BODY_REFUSALS,
} from "./ciphertext-cas.js";
export type {
  PrivateBodyKey, SealedPrivateBody, SealPrivateBodyResult, OpenPrivateBodyResult, OpenPrivateBodyRefusalName,
} from "./ciphertext-cas.js";
// The sealed value: the one private-byte format (`lar:///ha.ka.ba/lararium/mesh/sealed-store`).
export {
  sealChunk, openChunk, authorizeAddress, sealedAddressOf, keyVersionIdOf, contextDigest, mintContentKey,
  readContentKey, readKeyVersionId, readSealedAddress, isChunkRole, sealedImage, readSealedImage, isWellFormedText,
  CHUNK_ROLES, ADDRESS_SOURCES, SEAL_REFUSALS, OPEN_REFUSALS, CONTENT_KEY_LEN, SEALED_HEADER_LEN, SEALED_SEGMENT_LEN, SEALED_TAG_LEN, SEALED_CHUNK_MARK, SEALED_MARK_LEN,
} from "./sealed-chunk.js";
export type {
  ContentKey, KeyVersionId, SealedAddress, ChunkRole, SealContext, AuthorizedAddress, AddressSource,
  SealedChunk, SealResult, OpenResult, SealRefusalName, OpenRefusalName,
} from "./sealed-chunk.js";
// The cad REMOTE TRANSIT leg — DHT-free discovery + secret-free BLAKE3(bytes)==cid verify (verify-cap ⊥ read-cap).
export {
  have, block,
  fetchCidOverTransit, makeCidResolver, cidDigestClass, verifyCidBytes,
} from "./cas-transit.js";
export type {
  CidDigestClass, CasHolder, CasTransitMessage, CasTransitTransport, LocalCasRead, LocalCasCache,
} from "./cas-transit.js";
// The open-beta federation POSTURE — the outer gate over cross-operator admission (private/open, default private).
export type { FederationPosture } from "./federation-gate.js";
export { DEFAULT_FEDERATION_POSTURE } from "./federation-gate.js";
export * from "./quorum-entry.js";
export * from "./sealed-box.js";
export * from "./ed25519-door.js";
export * from "./kapae-antigen.js";
export { antigenEntriesFromBoard, writeAntigenEntry, antigenEntryKey, ANTIGEN_ENTRY_PREFIX } from "./antigen-board.js";
// The operator MEMBERS-registry — the Kapae-antigen's ALLOW-twin (members{} ⊥ blocked{}); contracts, never identities.
export * from "./carriage-registry.js";
// The root of one Nexus as a vessel holds it, and the one door a presented admit reads through: the socket
// seat, the raise and the admit bundle hand the verifier a held root, never a roster of their own making.
export {
  heldNexusRoot, heldRootFor, heldRootRevision, readAdmitAtHeldRoot, NO_HELD_ROOT,
  verifySignedAdmitBundle, SIGNED_ADMIT_BUNDLE_REFUSALS,
  type HeldNexusRoot, type HeldRootAbsence, type HeldAdmitReading, type SignedAdmitBundleRefusal,
} from "./held-nexus-root.js";
export {
  carriageEntriesFromBoard, writeCarriageEntry, carriageEntryKey, CARRIAGE_ENTRY_PREFIX, coerceCarriageEntry,
  rollAnchorsFromBoard, carriageAncestryFromBoard, writeRollAnchor, rollAnchorKey, presentationFromBoardDoc,
} from "./carriage-board.js";
export {
  personaKelEventsFromBoard, personaKelChainsFromBoard, personaKelChainForPrefix,
  personaKelFoldsFromBoard, personaKelFoldForPrefix,
  writePersonaKelEvent, personaKelEntryKey, PERSONA_KEL_ENTRY_PREFIX, coercePersonaKelEvent,
} from "./persona-kel-board.js";
export * from "./mu-void.js";
export * from "./nexus-seal-seed.js";
export * from "./meme-provider.js";
export * from "./reaction-graph.js";
export * from "./wiki-recipe.js";
export * from "./verb-tiddler.js";
export * from "./face-scoped-id.js";
export * from "./durability-receipt.js";
export * from "./session-receipt.js";
export * from "./residency-actions.js";
export * from "./verb-refusal.js";
export * from "./content-handle.js";
export * from "./effect-record.js";
export * from "./kumu-device.js";
export * from "./genesis-doc.js";
export * from "./genesis-intake.js";
export * from "./island-protocol.js";
export * from "./conformance-verb-breathing.js";
export * from "./social-seed.js";
export { didKeyFromVerifyingKey, buildCeremonyTiddlers } from "./cold-boot-ceremony.js";
export type { CeremonyTiddler } from "./cold-boot-ceremony.js";
export type { Repo, DocHandle, AutomergeUrl, StorageAdapterInterface } from "@automerge/automerge-repo";
export { RECIPE_PLANES, effectiveRecipe, recipeRecordStands } from "./recipe-planes.js";
export type { EffectiveRecipe, RecipePlane } from "./recipe-planes.js";
export { resolveRecipePluginCids, deriveWikiRecipe, wikiSlugOfBag } from "./surface-recipe.js";
export type { WikiRecipeDerivation } from "./surface-recipe.js";
export { makeIslandRepo, attachMessageChannelSync, replicaHeads, islandPeersOf, markIslandArrival } from "./island-repo.js";
export { peerArrivals, type PeerArrival, type PeerArrivals } from "./peer-arrivals.js";
export { answerRestWithHeads, REST_STALL_ROUNDS } from "./rest-with-heads.js";
export { GatedSyncLeg, oneWayDocumentsGate } from "./gated-sync-leg.js";
export type { SyncLegGate, LegRefusal } from "./gated-sync-leg.js";
export type { IslandRepoConfig } from "./island-repo.js";
export { assembleVessel, mountWikiSlot } from "./open-vessel-core.js";
export type { VesselKeel, VesselBootstrap, VesselCoreAssembly, MountManifest, MountEntry } from "./open-vessel-core.js";
export { awaitIslandMsg } from "./vessel-host.js";
export type { AwaitIslandMsgOpts, VesselWorkerHandle, VesselIslandHost } from "./vessel-host.js";
export { VesselIslandPoolCore } from "./vessel-island-pool-core.js";
export { makeWikiActivationCap } from "./wiki-activation.js";
export type { WikiActivationCap, WikiActivationGrant, ActivationResidency, ActivationPool, ResolveWikiSpec, WikiActivationResult, WikiSpecResolution } from "./wiki-activation.js";
export type { VesselIslandPoolCoreOptions, VesselRestState, DiskMirrorGrant } from "./vessel-island-pool-core.js";
export { isPresentedAdmit, isPresented, mkLarSessionMsg, isLarSessionMsg } from "./leaf-presentation.js";
export type { LarSessionMsg, LeafIdentity, PresentedAdmit, PresentedAdmitArm, PresentedGrantArm, PresentedTokenArm, Presented, UnsignedPresented } from "./leaf-presentation.js";
export {
  hostingActBytes, hostingActCid, isHostingAct, verifyHostingAct, hostingKeyPair, hostingEpochOf, mintHostingAct,
  hostingActKey, writeHostingAct, hostingActsFromBoard, hostingForks,
  isInviteToken, tokenInfo, evaluateToken, mintHostToken, tokenVerifiesAt,
  isHostingGrant, grantInfo, issueGrant, grantVerifiesAt, renewGrant,
  redeemClaim, claimDigest, lineageOf, encodeInvite, decodeInvite, INVITE_SCHEME,
  allowance, mintMarker, batchDigest, evaluateWalkerBatch, blindWalkerBatch, finalizeWalkerBatch,
  carryRecordKey, walkCarrySecret, lapseRatio, foldRhythm, RECLAIM_RATIO,
} from "./hosting.js";
export type {
  HostingAct, HostingEpoch, HostingFork, InvitePurpose, InviteToken, HostingGrant, HostingInvite, PendingMint, PendingMintItem,
} from "./hosting.js";
export {
  takeInvite, walkArm, walkIdentity, walkOver, popInvite, hostingActOn, tellWalkFault, isWalkRecord,
  HOSTING_GRANT_SESSION_KIND, HOSTING_MINT_SESSION_KIND, HOSTING_MINTED_SESSION_KIND,
} from "./walk-client.js";
export type { WalkRecord, WalkStore, WalkLeaf, WalkTransport, WalkFault, CarryReceipt, HostingDocHandle } from "./walk-client.js";
export {
  carryDocument, fetchDocument, openCarried, watchCarryNotice, walkCarriageBagId, walkCarryDocumentKey,
  HOSTING_CARRY_SESSION_KIND, HOSTING_CARRIED_SESSION_KIND, HOSTING_FETCH_SESSION_KIND, HOSTING_FETCHED_SESSION_KIND, HOSTING_NOTICE_SESSION_KIND,
} from "./walk-carry.js";
export type { CarryOutcome } from "./walk-carry.js";
export { LEAF_RETRY_CAP_MS, LEAF_SILENCE_LOG_EVERY, LarWSClientAdapter } from "./lar-ws-client-adapter.js";
export type { LarWSClientOptions, LarLeafSession, FacePresentation } from "./lar-ws-client-adapter.js";
export * from "./cap-compose.js";
export * from "./carriage-caps.js";
export * from "./persona-hd.js";
export * from "./persona-identity.js";
export * from "./cabal-realm.js";
export * from "./cabal-invite.js";
export * from "./vouch-board.js";
export * from "./independence-reading.js";
export * from "./delegation-edge.js";
export * from "./dyad.js";
export * from "./edge-kapae.js";
export * from "./edge-ledger.js";
export * from "./realm-edges.js";
export * from "./seat-duties.js";
export * from "./edge-fork.js";
export * from "./edge-partial.js";
// A Nexus quorum act that crosses between vaults before its threshold meets (kapae#/edge-hands); the two-vault contract door calls it.
export * from "./nexus-partial.js";
export * from "./roll-circle.js";
// PRIVATE AUTHORITY FOR THE FACE PROOF, named here by its first caller: the device removal door, which signs a
// certificate withdrawal beside each dyad raise (`device-removal`).
export { withdrawKey, foldWithdrawals, heldWithdrawals, learnWithdrawals, isWithdrawalMemory, FACE_PROOF_CUSTODY_ROWS } from "./face-authority.js";
export {
  NEXUS_KEY_HAND_OVER_DOMAIN, NEXUS_KEY_HAND_OVER_PREFIX, NEXUS_KEY_LINE_BOUND,
  nexusKeyHandOverBytes, nexusKeyHandOverId, nexusKeyHandOverKey, signNexusKeyHandOver, readNexusKeyHandOver,
  writeNexusKeyHandOver, nexusKeyHandOversFromBoard, followNexusKeyLine, admittedKeyOf,
  type NexusKeyHandOver, type NexusKeyLine, type NexusKeyLineRefusal,
} from "./nexus-key-line.js";
export type { FaceKeyCustody, WithdrawalMemory, FaceAuthorityRefusal } from "./face-authority.js";
export type { FaceScope, FaceWithdrawal } from "./face-proof-subjects.js";
// THE SCOPE READER, named here by its first caller: the node's dial (`dial-presentation`), which reads a joined face's
// scope off the certificate its join record keeps, never by a cast.
export { readFaceScope } from "./face-proof-subjects.js";
// THE PRESENTER'S DIGEST, named here by its first caller: the node's D4 device book (`face-device-book`), which resolves
// a seated session's `vesselFaceDigest` to the device edge its face-scoped key was certified to.
export { withdrawnKeyDigest, type Digest } from "./face-proof-subjects.js";
// THE FLEET-JOIN DOOR, named here by its first caller: the node's `fleet join` (`commands/fleet-join`). A joining
// vessel mints and requests its own face-scoped keys, and the root holder certifies them in its answer.
export { requestCertificate, issueCertificate, mintVesselFaceKey, checkVesselChain } from "./face-authority.js";
export type { VesselFaceKeyCustody, MintedKey, VesselChainVerdict } from "./face-authority.js";
export type { VesselFaceCertificate, VesselFaceCertificateRequest, VesselFaceKey, FaceKey } from "./face-proof-subjects.js";
export * from "./fleet-join.js";
// THE JOINED VESSEL'S SESSION, named here by its first caller: the node's joined-face proof (`joined-face-proof`)
// hands it the vessel's own certificate, grant, key and custody door. The session table stays private to the mesh.
export { openJoinedFaceSession, prepareJoinedFace, type JoinedFaceTarget } from "./session-face.js";
export { preparePlaceFace, supplyPlaceFace, type PlaceFaceTarget, type PlaceReading } from "./session-face.js";
export { placeProofSubjectRef, readPlaceSessionCertificate, readPlaceSessionSignature, type PlaceScope, type PlaceSessionCertificate } from "./face-proof-subjects.js";
export { PlaceSessionSigner, type PlaceAnchorWatch } from "./session-signer.js";
export type { JoinedFaceSessionRefusal, FaceGrantReading } from "./session-face.js";
// THE GATE'S TWO ROOT DOORS, named here by the seats that mint them: the vessel identity mints the floor key's
// door and the custody seat the custody root's. The bundle itself joins the barrel below, with the gate.
export { floorKeyDoor, custodyRootDoor } from "./gate-bundle.js";
export type { FloorKeyDoor, CustodyRootDoor, GateRootDoor } from "./gate-bundle.js";
// THE GATE'S THREE FROZEN SEAMS AND THE FLOOR'S ANNOUNCEMENT, named here for their callers: the sealed carriage frames
// every message after a verdict (the session channel); the session channel holds the attach → verdict → open interval
// shut on both halves (the client adapter and the oracle read client dial it); the admit's gate pin and its pair index
// (the carriage registry and the hearth dial pin); the floor's signed announcement, read only against a pin its reader
// already holds (no caller yet; it stands for the floor's announce route).
export {
  SEALED_FRAME_VERSION, SEALED_KINDS, SEALED_HEADER_BYTES, SEALED_SEAL_OVERHEAD, SEALED_PART_BODY_MAX, SEALED_MESSAGE_MAX_BYTES,
  SEALED_CONCURRENT_MAX, SEALED_BUFFER_MAX_BYTES, SEALED_REFUSALS, SealedIdsSpent, sealedParts, sealedWriter, sealedReader,
} from "./sealed-carriage.js";
export type { SealedKind, SealedMessage, SealedRefusal, SealedReader } from "./sealed-carriage.js";
export { CHANNEL_CLOSE_REASONS, GateChannelClosed, seatedChannel, dialedChannel, channelSessionTable } from "./gate-session-channel.js";
export type { ChannelSocket, ChannelCloseReason, GateChannelBounds, GateSessionChannel, SeatedChannel } from "./gate-session-channel.js";
// THE FLOOR PIN SET, named here by its callers: the node's sync gate server sends it on a verified sovereign session, the
// client adapter files it, and the fleet-join answer carries it signed (house ruling "The admit's gate pin").
export {
  HEARTH_FLOOR_PINS_SESSION_KIND, HEARTH_FLOOR_PIN_BOUND, FLOOR_CARD_KEL_BOUND, readHearthFloorPins, hearthFloorPinsBody, readHearthFloorPinsBody,
  readHearthFloorProofBody, fileSessionClaims, HEARTH_FLOOR_CARD_ROUTE, hearthFloorCardText, readHearthFloorCard, verifyHearthFloorCard,
  fileHearthFloorCard, lastSyncNote,
} from "./hearth-floor-pins.js";
export type { ClaimDoor, HearthFloorCard, HearthFloorProof, FloorAnchor, VerifiedFloorCard, FloorCardFiling } from "./hearth-floor-pins.js";
export {
  PLACE_FLOOR_PIN_KIND, PLACE_FLOOR_PIN_PREFIX, PLACE_FLOOR_PIN_REFUSALS, placeFloorPinImage, signPlaceFloorPin, readPlaceFloorPin,
  placeFloorPinKey, writePlaceFloorPin, placeFloorPinsFromBoard, filePlaceFloorPins, placeArmFor, foldClaimHead,
  type PlaceFloorPinStatement, type PlaceFloorPinRefusal, type PlaceFloorPinReading, type ClaimReadAt, type ClaimStanding,
  type ClaimHeadReading, type ClaimFilingReport, type ClaimIndex,
} from "./place-floor-pin.js";
export { gateNativeCarriagePull, CARRIAGE_PIN_ABSENT, type GateNativeCarriagePullDeps } from "./carriage-pull.js";
export { SOVEREIGN_SYNC_ROUTE, ADMIT_GATE_PIN_REFUSALS, readAdmitGatePin, readAdmitGatePinAt, admitGatePinDigest, dialPinKeyOf, hearthPinIndex } from "./admit-gate-pin.js";
// The session table a dialer keeps for the sessions it opened (`dialSessions`), and the binding each rides.
export { SessionTable, sessionBinding } from "./session-contract.js";
// The five-step fence that switches one session's face in place (the node's session socket, the browser holder).
export { switchSession, SwitchActsSetAsideFull, SESSION_SWITCH_REFUSALS, type SessionSwitchPorts, type SessionSwitchResult, type SessionSwitchTarget, type SwitchIntent, type SwitchOutcome } from "./session-switch.js";
export type { SessionBinding } from "./session-contract.js";
export type {
  AdmitGatePinRefusal, DialPinKey, HearthPinIndex, PlaceClaimStand, PlaceClaimFiling, PlaceClaimFork, PlaceKelForkNote,
} from "./admit-gate-pin.js";
export {
  FLOOR_ANNOUNCEMENT_VERSION, FLOOR_ANNOUNCE_ROUTE, FLOOR_STANDINGS, FLOOR_ANNOUNCEMENT_REFUSALS, FloorAnnouncementRefused,
  gateAnnouncementImage, signFloorAnnouncement, readFloorAnnouncement,
} from "./floor-announcement.js";
export type { FloorStanding, FloorAnnouncementBody, FloorAnnouncement, FloorAnnouncementRefusal } from "./floor-announcement.js";
// THE GATE AND ITS DIAL, named here by their callers: the node's gate server stands `makeFaceGate` per (Nexus, route)
// behind the upgrade's knock and its first flight, the composer derives each bundle, and the dialers speak
// `dialFaceGate` over their own sockets.
export {
  deriveGateBundle, floorGateRoot, sovereignGateRoot, floorRoute, sovereignRoute, gateBundleDigest, gateKnock, knockSegment, readGateBundlePin,
  readGateSignature, nexusAidOfPin, GateBundleRefused, GATE_BUNDLE_REFUSALS, GATE_TIERS,
} from "./gate-bundle.js";
export type { GateBundle, GateBundlePin, GateBundleRoot, GateRoute, GateTier, GateBundleRefusalName } from "./gate-bundle.js";
export { makeFaceGate, presentedAdmitReader, memoryBackedWithdrawals, GATE_SILENCE_REASONS } from "./face-gate.js";
export type {
  FaceGate, FaceGateDeps, GateSocket, GateDeadlines, GateAdmitReader, PlaceContractReading, GateShadowReading, GateShadowRing,
  GateFaceGrantRing, GateSortInput, GateSortVerdict, GateSorter, GateWithdrawalMemory, GateSession, GateSeat, GateSessionTable,
  GateSilenceReason, GateSilenceDetail, GateOutcome,
} from "./face-gate.js";
export {
  GATE_PROTOCOL, GATE_FLIGHT_BYTES, GATE_FLIGHT_REFUSALS, gateFlightProtocols, readGateFlightHeader, gateProtocolSelected,
  GATE_FRAME, GATE_FRAME_DIRECTION, GATE_FINISH_BYTES, GATE_VERDICT_BYTES, GATE_FRAME_BODY_MAX, GATE_SUBJECT_MAX_BYTES,
  gateFrameTagReserved, gateFrameTableRefusal,
} from "./gate-exchange.js";
export type { GateFlightRefusal, PresentationArm, PlaceArm } from "./gate-exchange.js";
export { dialFaceGate, dialPlaceGate, FACE_DIAL_REFUSALS } from "./face-dial.js";
export type { DialSocket, FaceDialArgs, FaceDialOutcome, FaceDialRefusal, PlaceDialArgs, PlaceDialOutcome } from "./face-dial.js";
// The dial's WebSocket door, named here so a vessel hands it a client that holds the payload cap itself (`nodeDialSocket`).
export { wsDialSocket } from "./ws-dial-socket.js";
export type { WsFactory, WsFactoryOptions, WsLike } from "./ws-dial-socket.js";
// The one Noise bound the node's gate server caps a frame at (`face-gate-server`); the handshake doors stay out.
export { NOISE_MAX_MESSAGE_BYTES, MIN_MESSAGE1_BYTES, MIN_MESSAGE2_BYTES } from "./noise-ik.js";
// THE GATE'S MEMORY DOOR, named here by the vessel that answers it over its custody seat (`gate-memory-rows`).
export { GATE_MEMORY_ROW_MAX_BYTES, storedWithdrawals, GateMemoryRowTorn } from "./gate-withdrawal-store.js";
export type { GateMemoryRows } from "./gate-withdrawal-store.js";
export * from "./device-removal.js";
export * from "./re-anchoring.js";
export * from "./realm-steward-map.js";
export * from "./chartered-classes.js";
export * from "./promotion-approval.js";
export * from "./kahu-cabal-admission.js";
export * from "./kahu-canon-reach.js";
export * from "./floor-release.js";
export * from "./floor-answer.js";
export * from "./lineage-rank.js";
export * from "./admission-price.js";
export * from "./vouch-dag.js";
export * from "./handle-card.js";
export * from "./handle-publish.js";
export * from "./handle-orchestration.js";
export * from "./ahi-ka.js";
export * from "./cas-caps.js";
export * from "./handle-book.js";
// The card-arrival front door — decode a carried (paste / QR / URL-fragment) HandleCard so a follow can admit
// an unmet nym WITHOUT the CLI's `--card <file>` (the card arrives as data, carried as an invite is).
// The type-blind PERSONA-ADMISSION ceremony (airgapped device-to-device persona handoff) — the 3-hop ECDH-sealed
// choreography + its carried QR envelopes. A photographed tabletop stays inert; the join writes per-vessel only.
// The IoC follow — composeFollow braids the three LOCAL stores (handle-book · petname · circle) into one
// gesture; the CircleStore shore stays local-only, so a follow leaves NO central trace (membership-doctrine).
export * from "./compose-follow.js";
export * from "./handle-announce.js";
export * from "./who-face.js";
export * from "./who-face-cap.js";
export * from "./deterministic-doc.js";
export * from "./face-working-address.js";
export { pinnedDoc, PINNED_ACTOR } from "./pinned-doc.js";
export * from "./cabal-realm-clock.js";
export * from "./realm-bag.js";
export * from "./protected-doc-guard.js";
export * from "./realm-index.js";
export * from "./me-circle.js";
export * from "./veil-crossing.js";
export * from "./veil-vouch.js";
export * from "./veil-ladder.js";
export * from "./immune-read.js";
export * from "./shamir-gf256.js";
export * from "./recovery-share.js";
export * from "./holder-continuity.js";
export * from "./anergy-ledger.js";
export * from "./recovery-seat.js";
export * from "./wax-stamp.js";
// The two-founder act and the engine cadence it seats (kahu#/seed-and-nexus, kahu#/contract); the cofound ceremony calls them.
export * from "./cadence-lineage.js";
export * from "./cofound.js";
export * from "./cold-key-card.js";
export * from "./persona-kel.js";
// The Handle's SIBLING chain — burn · rotate · attest under an owner-bound prefix (identity-classes#the-handle-chain).
export * from "./handle-kel.js";
export * from "./conviction-dial.js";
export * from "./capture-reading.js";
export * from "./transfer-entropy.js";
export * from "./edge-kind.js";
export * from "./nucleation-gate.js";
export * from "./temporal-rigidity.js";
export * from "./clock-recovery.js";
export * from "./sink.js";
export * from "./sink-class.js";
export * from "./crystallization.js";
export * from "./commit-dial.js";
export * from "./purple-minter.js";
export * from "./spectral-keel.js";
export * from "./spectral-keel-cap.js";
export * from "./null-harness.js";
export * from "./numerics.js";
export * from "./arl-dial.js";
export * from "./subspace-track.js";
export * from "./synthetic-drift.js";
export * from "./sink-flow.js";
export * from "./partition-monitor.js";
export * from "./self-coupling.js";
export * from "./mesh-coupling.js";
export * from "./te-hodge.js";
export * from "./who-sensory-shore.js";
export * from "./sensory-shore.js";
export * from "./gaussian-cmi.js";
export * from "./bures-metric.js";
export * from "./fisher-rao.js";
export * from "./mesh-coupling-mv.js";
export * from "./cmi-significance.js";
export * from "./signed-innovation.js";
export * from "./mesh-couple.js";
export * from "./change-point.js";
export * from "./windowed-coupling.js";
export * from "./linearity-gate.js";
export * from "./rank-te.js";
export * from "./rank-consensus.js";
export * from "./membership-channel.js";


export * from "./persistence-keel.js";

export * from "./capture-drain.js";

export * from "./concurrency-dial.js";

export * from "./parallel-ingest.js";

export * from "./credit-gate.js";

export * from "./merge-gate.js";

export * from "./sensorium-lifecycle.js";

export * from "./store-integrity.js";

export * from "./doc-load-probe-contract.js";

export * from "./doctor-sweep.js";
export * from "./pack-provenance.js";

// One boot-time doc resolver for both vessels — races local readiness, then MERGES a late remote
// into the fallback rather than dropping it.
export { waitHandle, LOCAL_READY_MS } from "./wait-handle.js";

// The registered bag set, derived from the persona BINDING — founded stays private, admitted carries the fleet's.
export type { FleetMembership, RegisterBagsInput } from "./register-bags.js";
export { deriveRegisterBags, catalogNamedBags, isVesselGround } from "./register-bags.js";
export * from "./persona-scope.js";
export * from "./persona-planes.js";
export * from "./holdings-witness.js";
export * from "./crossroads-cry.js";

export { nexusIdentity, nexusScopeOrThrow, nexusScopeMoved, nexusIslandsBelow, admittedJoineeIsland,
         type NexusIdentity, type NexusIdentityAt } from "./nexus-identity.js";
// The boards a CLIMB moves. WHO and carriage stay deliberately absent from this surface, and
// `nexus-board-climb`'s header carries the reason for each refusal.
export { climbNexusBoards, carryAntigenUpTheGradient,
         reAnnounceRealmBooksAtIsland,
         type NexusBoardClimb, type BoardClimbResult } from "./nexus-board-climb.js";
// The FOURTH board the climb moves, held in its own module because it REFUSES rather than degrades — and
// housed HERE rather than on a shore, so the platform-blindness vow every shore composes it.
export { carryPersonaKelUpTheGradient, type PersonaKelCarry } from "./persona-kel-climb.js";
export { signerClass, type SignerClass, type SignerReading, type HeldKeys } from "./signer-class.js";
export { bagCopyPlan, type BagCopyPlan, type TitleAtRest } from "./bag-copy-plan.js";
export { crossingDirection, type CrossingDirection, type CrossingCost } from "./crossing-direction.js";
export { realmStanding, type RealmStanding, type RealmStandingName, type RealmFeedSlot } from "./realm-standing.js";
export { KEY_CLASSES, isKeyClass, isRelationClass } from "./key-class.js";
export type { KeyClass } from "./key-class.js";
export { FCK_SEAL_MAGIC, FCK_SEAL_NONCE_LENGTH, FCK_SEAL_TAG_LENGTH, FCK_SEAL_MIN_LENGTH, readFckCarrier, splitFckFrame, joinFckFrame } from "./fck-envelope.js";
export type { FckCarrierReading } from "./fck-envelope.js";
export { mintFck, faceCarrierContext, sealUnderFck, openUnderFck } from "./fck.js";
export type { FaceCustodyKey, FaceCarrier, FckOpening } from "./fck.js";
// The tree key custody spine: the keyslot tree that commits to its tree key, and the ONE writer of tree-key-sealed carriers, which
// proves every tree key in hand against the standing tree under one custody holder — see `sealed-writer`.
export {
  writeSealedCarrier, updateSealedCarrier, removeSealedCarrier, openSealedCarrier, commitSlotTree, rotateTreeKey, settleRotation, assertStoreUnoccupied,
  CustodyRefusal, TreeKeyRefusal, CensusRefusal, OccupiedStoreRefusal, SEALING_SUFFIX, ROTATING_SUFFIX,
  writeFaceCarrier, updateFaceCarrier, removeFaceCarrier, openFaceCarrier, rotateFck, settleFaceRotation, assertFaceStoreUnoccupied, commitFaceTree,
} from "./sealed-writer.js";
export type {
  CustodyIo, SealedCarrier, SealedCarrierUpdate, StandingCarrier, TreeKeyReading, WriteSealedCarrierArgs, CommitSlotTreeArgs, RotateTreeKeyArgs, SettleRotationArgs,
  WriteFaceCarrierArgs, RotateFckArgs, CommitFaceTreeArgs,
} from "./sealed-writer.js";
export { bindSlot, unbindSlot, openTreeKey, nobleKdf, encodeSlotTree, decodeSlotTree, draftPaperPin, confirmPaperPin, confirmHeldPaper, mintPasskeySalt, openPasskeyPin, PIN_KINDS } from "./keyslot.js";
export type { KdfPort, ScryptCost, PaperDraft, ConfirmedPaperPin, SlotTree, SlotSpec, PinSpec, PinKind, PinRecord, PasskeyPinRecord, Credential, TreeKeyUnlock, SlotTreeReading } from "./keyslot.js";
export { mintTreeKey, treeKeyEquals } from "./tree-key.js";
// The serving key and the serving tree that wraps it under the tree key's entry — see `serving-key`.
export { mintServingKey, SK_LENGTH } from "./serving-key.js";
export type { ServingKey } from "./serving-key.js";
export type { TreeKey, TreeKeyOpening } from "./tree-key.js";
// The tree key's sealed-carrier frame: the magic that names the scheme, with no version byte — see `s-envelope`.
export { S_SEAL_MAGIC, S_SEAL_NONCE_LENGTH, S_SEAL_TAG_LENGTH, S_SEAL_MIN_LENGTH, readSCarrier, splitSFrame, joinSFrame } from "./s-envelope.js";
export type { SCarrierReading } from "./s-envelope.js";
// SLIP-39: the paper pin's encoder, over the house's own GF(256) field ops — see `slip39`.
export { Slip39Error, decodeShare, encodeShare, generateMnemonics, combineMnemonics, readBackMismatch } from "./slip39.js";
export type { Slip39Share, ReadBackMismatch } from "./slip39.js";
// The place KEL commits cold successors while online signers carry floor duties.
export * from "./vessel-kel.js";
export * from "./place-kel-board.js";
export * from "./place-founding-card.js";
export * from "./vessel-journal.js";
// ── The sealed store's records, lineage, lockboxes, rest and content-key holder ────────────────────────
// Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store. The key shore (`@lararium/keyhive`) and the node's
// seal producer consume them.
export * from "./sealed-records.js";
export * from "./content-key-lineage.js";
export * from "./sealed-store-rest.js";
export * from "./lockbox-wrap.js";
export * from "./content-key-holder.js";
export * from "./memory-section.js";
export * from "./face-bundle.js";
export * from "./face-log-view.js";
// The one parser of a Nexus seal file's text, platform-blind: the node's disk adapter and a browser leaf's landed
// fleet-join answer read a charter through it — see `nexus-doc-text`.
export { parseNexusDoc, readNexusDocFence, nexusDocFenceRe, NEXUS_DOC_FENCES } from "./nexus-doc-text.js";

export * from "./intent-admission.js";
export { censusOutcomeLinkage, type OutcomeLinkage } from "./outcome-census.js";
