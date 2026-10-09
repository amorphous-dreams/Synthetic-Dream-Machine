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
 *   · TEST-PINNED DOMAIN SEPARATION — `keyring-envelope` carries a signing-domain split a weld test
 *     pins directly; moving it would require moving the pin with it.
 *   · MEME-NAMED — a canon meme already names the module as its own mesh source-file: `offering-antigen`,
 *     `quorum-entry`, `kumu-device`, `bag-copy-plan`, `signer-class`, `cert-expiry-gauge`,
 *     `crossroads-cry`, `holdings-witness`, `projection-registry`, `parallel-ingest`.
 *   · SENSORIUM-DEFERRED — `bures-metric`, `rank-te`, `windowed-coupling`, `partition-monitor`,
 *     `self-coupling`, `synthetic-drift`, `linearity-gate`, `independence-reading` carry an instrument
 *     the Sensorium wiring has not reached yet; no package reads them as a sole consumer today.
 *   · RULING-GATED — `recipe`, `readiness`, `reaction-graph` are pinned as the mesh source-file by their own canon memes;
 *     `pronaos` and `offering-inspection` carry their own mesh-namespace memes. Each move waits on its
 *     own ruling, not this cut.
 *   · PERSONA-SELVES NAMING — `PERSONA_SELVES_PREFIX`, `personaSelfTiddlerUri` and
 *     `handleIndexFromSelfTiddlerUri` (in `lar-uris.ts`) carry the self-tiddler naming scheme tw5's
 *     `persona-selves`/`persona-selves-verbs` build on directly, and keyhive's ceremony core reads
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
export * from "./cas.js";
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
export * from "./guardian-card.js";
export * from "./recovery-registration.js";
export * from "./capability.js";
export * from "./domains.js";
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
export * from "./authority-verdict.js";
export * from "./oracle-substrate.js";
export * from "./oracle-read-client.js";
export * from "./plugin-offering.js";
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
export type { FederationGate, SiblingShare } from "./federation-gate.js";
export { DeterministicFederationGate, federationShareDecision, identityShareDecision, siblingShareDecision, shareConfigOf } from "./federation-gate.js";
export type { SharePolicyFn, ShareConfigOf, ShareVerdictRecord, ShareVerdictSink } from "./federation-gate.js";
export type { IdentityRing } from "./federation-gate.js";
export type { AntigenRing } from "./federation-gate.js";
export { presenterIsKapaed, carryContractShareDecision, classifySocket, answersStrangers } from "./federation-gate.js";
export { carrierShareDecision, capTierShareDecision } from "./federation-gate.js";
export type { NexusMembership, PlaneSeal } from "./federation-gate.js";
// The household's own certificate witness — nothing outside this stack warns before a cert expires.
export type { CertExpiryBand, CertLifetime, CertExpiryReading } from "./cert-expiry-gauge.js";
export {
  readCertExpiry, wantsAttention, renewalCadenceDays, graceWindowDays,
  RENEW_ELAPSED, WARN_ELAPSED, URGENT_ELAPSED,
} from "./cert-expiry-gauge.js";
// The bag's sharing-posture as SELF-DESCRIBING DATA — the 4-tier total order + the tighten-only keystone.
export type { CapTier, TierFloorOracle, DeclaredTierSource, CapTierRing } from "./cap-tier.js";
export {
  CAP_TIER_ORDER, DEFAULT_CAP_TIER, capTierRank, parseCapTier, meetCapTier, resolveTier,
  refineBagTierWithTiddlers, mayDeclareTier, mayDeclassify, structuralFloorFor, resolveTierForDoc,
  tierPermitsRelayPeer, makeTierFloorOracle,
} from "./cap-tier.js";
// The cad ENCRYPT-ON-CAS primitive — cid = BLAKE3(ciphertext), verify-cap ⊥ read-cap, per-Nexus message-lock.
export {
  ciphertextCid, verifyCiphertextCid, deriveMessageKey, sealBodyOnCas, openBodyOnCas,
  CIPHERTEXT_CID_ALGO, CONVERGENCE_SECRET_LEN, require32,
} from "./ciphertext-cas.js";
export type { SealedBody } from "./ciphertext-cas.js";
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
export * from "./kapae-antigen.js";
export { antigenEntriesFromBoard, writeAntigenEntry, antigenEntryKey, ANTIGEN_ENTRY_PREFIX } from "./antigen-board.js";
// The operator MEMBERS-registry — the Kapae-antigen's ALLOW-twin (members{} ⊥ blocked{}); contracts, never identities.
export * from "./carriage-registry.js";
export {
  carriageEntriesFromBoard, writeCarriageEntry, carriageEntryKey, CARRIAGE_ENTRY_PREFIX,
  rollAnchorsFromBoard, writeRollAnchor, rollAnchorKey, presentationFromBoardDoc,
} from "./carriage-board.js";
export {
  personaKelEventsFromBoard, personaKelChainsFromBoard, personaKelChainForPrefix,
  writePersonaKelEvent, personaKelEntryKey, PERSONA_KEL_ENTRY_PREFIX,
} from "./persona-kel-board.js";
export * from "./mu-void.js";
export * from "./nexus-seal-seed.js";
export * from "./meme-provider.js";
export * from "./reaction-graph.js";
export * from "./wiki-recipe.js";
export * from "./verb-tiddler.js";
export * from "./residency-actions.js";
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
export { makeIslandRepo, attachMessageChannelSync } from "./island-repo.js";
export type { IslandRepoConfig } from "./island-repo.js";
export { assembleVessel, mountWikiSlot } from "./open-vessel-core.js";
export type { VesselKeel, VesselBootstrap, VesselCoreAssembly } from "./open-vessel-core.js";
export { awaitIslandMsg } from "./vessel-host.js";
export type { AwaitIslandMsgOpts, VesselWorkerHandle, VesselIslandHost } from "./vessel-host.js";
export { VesselIslandPoolCore } from "./vessel-island-pool-core.js";
export { makeWikiActivationCap } from "./wiki-activation.js";
export type { WikiActivationCap, WikiActivationGrant, ActivationResidency, ActivationPool, ResolveWikiSpec } from "./wiki-activation.js";
export type { VesselIslandPoolCoreOptions, DiskMirrorGrant } from "./vessel-island-pool-core.js";
export {
  mkLarChallenge, mkLarAuth, mkLarAuthOk,
  isLarChallengeMsg, isLarAuthMsg, isLarAuthOkMsg, isPresentedAdmit, isPresented,
  authProofBytes, buildAuthResponse, verifyAuthProof, evaluateAuthProof, runPeerHandshake,
  authOkBytes, verifyAuthOk, mintLeafNonce, mkLarSessionMsg, isLarSessionMsg,
  leafProofBytes, signLeafProof, signPresented, verifyLeafProof, presentedCid, presentedSigner,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, ed25519VerifyHex,
} from "./auth-wire.js";
export type {
  LarChallengeMsg, LarAuthMsg, LarAuthOkMsg, LarSessionMsg, LarAuthWireMsg,
  AuthProofWire, PeerHandshake, LeafIdentity, DaemonProofEvidence, PresentedAdmit, PresentedAdmitArm,
  PresentedGrantArm, PresentedTokenArm, Presented, UnsignedPresented,
} from "./auth-wire.js";
export { knockSegment, knockPath, knockedUrl, pinnedRelayAddress } from "./gate-knock.js";
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
  takeInvite, walkArm, walkIdentity, walkOver, popInvite, hostingActOn,
  HOSTING_GRANT_SESSION_KIND, HOSTING_MINT_SESSION_KIND, HOSTING_MINTED_SESSION_KIND,
} from "./walk-client.js";
export type { WalkRecord, WalkStore, WalkLeaf, WalkTransport, CarryReceipt, HostingDocHandle } from "./walk-client.js";
export {
  carryDocument, fetchDocument, openCarried, watchCarryNotice,
  HOSTING_CARRY_SESSION_KIND, HOSTING_CARRIED_SESSION_KIND, HOSTING_FETCH_SESSION_KIND, HOSTING_FETCHED_SESSION_KIND, HOSTING_NOTICE_SESSION_KIND,
} from "./walk-carry.js";
export type { CarryOutcome } from "./walk-carry.js";
export { LarWSClientAdapter } from "./lar-ws-client-adapter.js";
export type { LarWSClientOptions, LarLeafSession } from "./lar-ws-client-adapter.js";
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
export * from "./re-anchoring.js";
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
export * from "./persona-admit.js";
// STAGE 2 (A1-①): the per-Nexus convergence keyring delivered to a joinee at admission via a sealed envelope
// (the persona-admit sealed-box shape). An admitted device opens it + reads sealed bodies; a carry-only peer cannot.
export * from "./keyring-envelope.js";
// The IoC follow — composeFollow braids the three LOCAL stores (handle-book · petname · circle) into one
// gesture; the CircleStore shore stays local-only, so a follow leaves NO central trace (membership-doctrine).
export * from "./compose-follow.js";
export * from "./handle-announce.js";
export * from "./who-face.js";
export * from "./who-face-cap.js";
export * from "./deterministic-doc.js";
export { pinnedDoc, PINNED_ACTOR } from "./pinned-doc.js";
export * from "./cabal-realm-clock.js";
export * from "./realm-bag.js";
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
export * from "./archive-envelope.js";

export * from "./doc-load-probe-contract.js";

export * from "./doctor-sweep.js";
export * from "./pack-provenance.js";

// One boot-time doc resolver for both vessels — races local readiness, then MERGES a late remote
// into the fallback rather than dropping it.
export { waitHandle, LOCAL_READY_MS } from "./wait-handle.js";

// The registered bag set, derived from the persona BINDING — founded stays private, admitted carries the fleet's.
export type { FleetMembership, RegisterBagsInput } from "./register-bags.js";
export { deriveRegisterBags, catalogNamedBags } from "./register-bags.js";
export * from "./persona-scope.js";
export * from "./persona-planes.js";
export * from "./holdings-witness.js";
export * from "./crossroads-cry.js";

export { nexusIdentity, nexusScopeOrThrow, nexusScopeMoved, nexusIslandsBelow, admittedJoineeIsland,
         type NexusIdentity, type NexusIdentityAt } from "./nexus-identity.js";
// The boards a CLIMB moves. THREE of the seven are deliberately absent from this surface — WHO, carriage
// and vouch — and `nexus-board-climb`'s header carries the reason for each refusal.
export { climbNexusBoards, carryAntigenUpTheGradient, carryEdgeShadowsUpTheGradient,
         reAnnounceRealmBooksAtIsland,
         type NexusBoardClimb, type BoardClimbResult } from "./nexus-board-climb.js";
// The FOURTH board the climb moves, held in its own module because it REFUSES rather than degrades — and
// housed HERE rather than on a shore, so the platform-blindness vow every shore composes it.
export { carryPersonaKelUpTheGradient, type PersonaKelCarry } from "./persona-kel-climb.js";
export { signerClass, type SignerClass, type SignerReading, type HeldKeys } from "./signer-class.js";
export { nexusScopeIndex, deriveNexusScopedKey } from "./persona-identity.js";
export { bagCopyPlan, type BagCopyPlan, type TitleAtRest } from "./bag-copy-plan.js";
export { crossingDirection, type CrossingDirection, type CrossingCost } from "./crossing-direction.js";
export { realmStanding, type RealmStanding, type RealmStandingName, type RealmFeedSlot } from "./realm-standing.js";
export { KEY_CLASSES, isKeyClass } from "./key-class.js";
export type { KeyClass } from "./key-class.js";
