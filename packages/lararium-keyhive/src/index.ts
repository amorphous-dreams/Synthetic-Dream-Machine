// @lararium/keyhive — capability layer wrapping @keyhive/keyhive (Ink & Switch concap, pre-alpha).

import type { DeviceDelegationRootHalf, PersonaKelEvent, GroupSecretSeal, GateBundlePin } from "@lararium/mesh";

export type {
  CapabilityProvider, CapabilityProviderInitOpts,
  DelegateArgs, DelegateResult, VerifyArgs, VerifyResult,
  PeerDID, KeyhiveAccess, EventStoreRef,
} from "./capability-provider.js";

export { KeyhiveProvider, ArchiveIdentityMismatch, ensureKeyhiveWasm, setKeyhiveWasmBytes, KEYHIVE_TRACE_ENV, keyhiveTraceAsked } from "./keyhive-provider.js";
export { makeFaceBagDoor, faceOwnerVerifier } from "./face-bag-door.js";
export type { FaceBagDoor } from "./face-bag-door.js";
export { registerBagsDurably, daemonBagDocLedger, planeBagDocLedger } from "./bag-doc-ledger.js";
export type { BagDocLedger } from "./bag-doc-ledger.js";
export { keyhiveLockboxShore, encodeLockboxBox, readLockboxBox } from "./keyhive-lockbox.js";
export type { LockboxProvider } from "./keyhive-lockbox.js";
export { seatContentKeys } from "./content-key-seat.js";
export type { ContentKeySeat, ContentKeySeatInput, ContentKeyProvider, SessionProof } from "./content-key-seat.js";
export type { ProviderChunkRest } from "./capability-provider.js";
export { memoryProviderChunkRest } from "./capability-provider.js";
// `KeyhiveIdentitySlot` stays out of this barrel: it stands specified in code, and no production path constructs it
// (its header names the caller it waits on).
export { packPersonaCrossing, applyPersonaCrossing } from "./persona-crossing.js";
export type { PersonaCrossingBundle, CrossingContent, CrossingPlaintext } from "./persona-crossing.js";
export { runFaceJoin, gateFaceJoin } from "./face-join.js";
export { faceGrantTitle, signFaceGrantRecord, verifyFaceGrantRecord, FACE_GRANT_PREFIX } from "./face-grant-record.js";
export type { FaceGrantRecord, UnsignedFaceGrantRecord, FaceGrantVerifyContext, FaceGrantVerdict } from "./face-grant-record.js";
// THE ONE assembly of the PersonaGroup identity-slot ring — node and browser both call it; only the proof source differs.
export { assemblePersonaGroupRing } from "./persona-group-ring-assembly.js";
export type { PersonaGroupRingInput } from "./persona-group-ring-assembly.js";
export type {
  FaceJoinSummons, FaceJoinGrant, FaceJoinOutcome, FaceJoinRefusal, FaceJoinProvider, FaceJoinContext,
} from "./face-join.js";
// THE KEY SIDE OF A REMOVAL (kapae#/keys): the executor that answers a plan, the fleet's own answer, and the
// seat-roll subscription a bag's content-key roll rides.
export { runSeatDuties, keyhiveSeatShore, subscribeSeatRolls, announceSeatRoll } from "./seat-duty-executor.js";
export type { SeatKeyShore, SeatShoreProvider, SeatDutyOutcome, SeatDutyDid } from "./seat-duty-executor.js";
export { answerFleetSeatDuties } from "./fleet-seat-duties.js";
export type { FleetSeatFacts, FleetSeatProvider, FleetSeatAnswer } from "./fleet-seat-duties.js";

export { InMemoryEventStore, inIslandSlice, inSelfSlice } from "./event-store.js";
export type { EventStore, EventRecord } from "./event-store.js";

export { DaemonEventStore, capEventTitle } from "./daemon-event-store.js";
export type { DaemonEventStoreOptions } from "./daemon-event-store.js";

export { bootDaemonKeyhive, FacelessKeyhiveRefused } from "./boot-daemon-keyhive.js";
export type { BootDaemonKeyhiveInput, BootDaemonKeyhiveResult } from "./boot-daemon-keyhive.js";
// THE ONE ROAD a daemon island reads its lease frontier by — its own daemon layer, two verdicts never merged.
export { readLeaseFrontier, daemonLayerOf } from "./lease-frontier.js";
export type { LeaseFrontier, DaemonLayerHolder } from "./lease-frontier.js";
// THE ONE DOOR that lands the sovereign identity archive — and the standing gate standing on it.
export { persistArchiveFloor } from "./archive-floor-write.js";
export type {
  ArchiveFloorCarrier, ArchiveFloorWriters, ArchiveFloorRefusal, ArchiveFloorOutcome, ArchiveFloorInput,
} from "./archive-floor-write.js";

export { resolveOrMintBinding, unboundMints, restingMinter } from "./resolve-binding.js";
export type {
  ResolveBindingArgs, ResolveBindingResult, BindingKind, DocMinter,
} from "./resolve-binding.js";
export { makeSlotDocResolver, WorkingSlotRefusal } from "./slot-doc-resolver.js";
export type { SlotDocResolver, SlotDocResolverArgs, SlotDoc, SlotDocRepo } from "./slot-doc-resolver.js";

// makeOperatorDaemonBehavior is NOT re-exported here — it couples to @lararium/tw5
// (makeDaemonBehavior), and dragging tw5's index through the keyhive core index
// would pull tw5's browser-surface into keyhive consumers. It lives on its own
// subpath ("@lararium/keyhive/operator-daemon-behavior") so the keyhive core
// index stays tw5-free; only the daemon worker entries (which need tw5 anyway)
// import it.

export {
  foundThePlace, foundTheFace, runFoundingCeremony, runDeviceAdmitEdge, runApplyAdmitPayload,
  replayCapEvents, retireFaceCheckpoint, retireApplyCheckpoint, sealCheckpoint, openCheckpoint,
} from "./ceremony-core.js";
export type {
  PlaceFoundingInput, PlaceFoundingResult, FaceFoundingInput, FaceFoundingResult,
} from "./ceremony-core.js";
export { runReadmitEdge, type ReadmitEdgeInput } from "./recovery-core.js";
export { faceOperationTitle, readFaceOperation, writeFaceOperation } from "./face-operation-record.js";
export { runFaceJoinOperation } from "./face-join-operation.js";
export { makeFaceIntentDoor, requestFaceJoin, makeFaceIntentReader, admitAgentEntry } from "./face-intent-door.js";
export { makeSeatSummons, foundingHearthOf, standingOfReading, standingOwnSummons } from "./face-seat-summons.js";
export type { SeatSummonsPorts, SeatSummonsAnswer } from "./face-seat-summons.js";
export type { FaceIntentDoorPorts, FaceIntentAdmissionPorts } from "./face-intent-door.js";
export { archiveIsOf } from "./archive-is-of.js";
export type { GrantPlane, FaceJoinOperationInput } from "./face-join-operation.js";
export type {
  FoundingCeremonyInput, FoundingCeremonyResult,
  DeviceAdmitEdgeInput,
  ApplyAdmitInput, ApplyAdmitResult,
} from "./ceremony-core.js";

export {
  foundCabalRealm, foundCabalRealmWithGlamour,
  openDwelling, dwellersHolding, cabalRealmLiveness,
} from "./cabal-realm-ceremony.js";
export type { FoundCabalRealmOpts, FoundedCabalRealm } from "./cabal-realm-ceremony.js";
export { forkCabalRealm } from "./fork-realm-ceremony.js";
// THE FLEET-JOIN ANSWER'S ADMIT: the one shape the node's `runInit` and the browser's admit boot found a face by.
export { carriedAdmitOfFleetJoin, FLEET_JOIN_ADMIT_REFUSALS, type FleetJoinAdmitRefusalName } from "./fleet-join-admit.js";
export type { ForkCabalRealmOpts } from "./fork-realm-ceremony.js";

/**
 * DeviceAdmitPayload — isomorphic wire type for the same-operator vessel
 * admission ceremony. Produced by a Node vessel's `runDeviceAdmit`; consumed
 * by any vessel's init path (Node, browser, mobile) via `runInitFromAdmitPayload`.
 *
 * Exported here rather than from @lararium/node so browser and mobile vessels
 * can import this type without taking a Node dependency.
 */
export interface DeviceAdmitPayload {
  readonly kind:                   "device-admit/v1";
  /** The PINNED signer DID — PROVENANCE only (the founder's persona-KEL inception op-key). The pin is
   *  `personaKelPrefix`: the Binding Gate walks that identifier's KEL to its current head and verifies
   *  against THAT, so a rotated key still binds and a superseded one rejects. */
  readonly signerDid:              string;
  /** The founder's persona-KEL identifier PREFIX (AID) the joinee PINS — the joinee's own device edge chains
   *  to whatever op-key currently heads this identifier (the founder's persona-root, until a Reading-B rotation). */
  readonly personaKelPrefix:       string;
  /** The founder's persona-KEL chain SNAPSHOT (as of admit) — the joinee seeds its LOCAL KEL board from it so
   *  its very first boot walks to a head WITHOUT waiting on a federated sync (no-global-now: local seed, never
   *  a global lookup). REQUIRED — early alpha, no back-compat: a payload minted without it names a vessel that
   *  would RE-FOUND rather than join, so `runApplyAdmitPayload` refuses it by a named error instead of silently
   *  falling back to a federated-board wait. */
  readonly personaKelChain:       readonly PersonaKelEvent[];
  /** Signed persona log records, including the joinee's admission. */
  readonly personaActs:           readonly unknown[];
  readonly edgeFrontier: { readonly records: readonly unknown[]; readonly snapshots: readonly (readonly [string, readonly string[]])[] };
  /** The root-signed delegation half addressed to the joinee's atom; the joinee countersigns it. */
  readonly deviceEdge:             DeviceDelegationRootHalf;
  /** The PersonaGroup secret the same root sealed to the joinee's device key, beside the edge — the secret its
   *  sibling proofs and channel tags run on. REQUIRED: an enrolment that delivers no secret leaves the joinee
   *  unable to meet a single sibling, so `runApplyAdmitPayload` refuses a payload without one. */
  readonly groupSecretSeal:        GroupSecretSeal;
  /** The hearth true-name (engine CID) the joinee binds TO. */
  readonly hearthTrueName:         string;
  /** Founder sentinel oracle IDs — for the founding sentinel dance + the future affiliation layer. */
  readonly personaGroupId:    string;
  readonly meshCabalDocIdHex:      string;
  readonly syncUrl:                string | null;
  /**
   * The founder's persona doc URL — the joinee resolves/syncs it to receive the
   * shared veiled identity (PersonaGroup), the membership-sync foundation. The daemon bag
   * stays sovereign-per-vessel (the joinee seeds its own); the persona plane crosses by membership.
   * REQUIRED — early alpha, no back-compat: a payload minted without it would have the joinee seed a
   * FRESH local persona doc (a silent RE-FOUND, never a join); `runApplyAdmitPayload` refuses such a
   * payload by a named error instead.
   */
  readonly personaUrl:            string;
  /**
   * OPTIONAL keyhive membership cap-events (base64 StaticEvent bytes) — the founder's PersonaGroup ops that
   * admit this vessel into the KEYHIVE group so it can DECRYPT content shared through the catalog registry (packPersonaCrossing).
   * runApplyAdmitPayload writes them to the daemon doc; boot's hydrateFromEventStore ingests them into the vessel's
   * live keyhive. Absent → the vessel joins by the Ed25519 edge alone (plaintext-sync membership, no E2E).
   */
  readonly capEvents?:             readonly string[];
  /**
   * Automerge URL of the genesis island doc on the issuing vessel's Repo.
   * Browser vessels call repo.find(islandDocUrl) over the WebSocket to sync
   * the genesis island (TW5 core blob + sigil tiddlers) without a separate
   * binary delivery. Absent on payloads from older vessels; treated as null.
   */
  readonly islandDocUrl?:          string | null;
  /**
   * The HEARTH's own daemon doc — the door a joinee knocks on.
   *
   * The daemon bag stays sovereign-per-vessel: this joinee seeds its OWN at admission, so a verb summons written to
   * its own plane reaches nobody. Asking the hearth to seat it — the keyhive half of the join — means writing
   * onto the HEARTH's daemon doc, and this names it. The joinee resolves it the way it resolves `islandDocUrl`
   * and `personaUrl`: over the crossing its device edge already opened.
   *
   * The route runs both ways already: `browser-crossing` proves a leaf resolving a HEARTH-owned doc by url
   * and writing to it, with the hearth observing the change over the same crossed socket. Naming the door is
   * what was missing, never the opening of it.
   *
   * REQUIRED — early alpha, no back-compat: a payload minted without it would leave the joinee holding
   * standing with no route to ask for anything; `runApplyAdmitPayload` refuses such a payload by a named
   * error instead of silently seating it door-less. Still nullable: a founder with no door to name says
   * so explicitly (`hearthDaemonUrl: null`), which is a stated absence, never a missing field.
   */
  readonly hearthDaemonUrl:       string | null;
}

/**
 * The payload as CARRIED: `DeviceAdmitPayload` plus the hearth's gate key (the dial's binding), the canon
 * documents that hearth names to the joinee, and the founder's RESOLVED island at mint time — a SNAPSHOT, kind + scope, so a climbed founder's joinee seats
 * where the founder actually stood rather than where its raw vessel key falls.
 *
 * KEPT DISTINCT from `DeviceAdmitPayload` on purpose, not merged into it: these fields sit outside the device
 * edge's own signed image (`delegationProofBytes`, device-delegation.ts) and ride instead inside the root-signed
 * fleet-join answer, as its carriage and reach. `carriedAdmitOfFleetJoin` builds this shape from an answer that
 * already read under the face's root key, and from nothing else. Widening the base interface would blur which
 * signature covers which field: the edge's covers `DeviceAdmitPayload`, the answer's covers the rest.
 *
 * Exported here (not `@lararium/node`) for the same reason `DeviceAdmitPayload` is — so browser and
 * mobile vessels can read a payload carrying these fields without taking a Node dependency. The node land
 * (`commands/fleet-join.ts`) and the browser land (`browser-fleet-join.ts`) build it from a verified answer; the
 * browser's `#admit=` stash carries it across the page's own reload alone.
 */
export type CarriedAdmitPayload = DeviceAdmitPayload & {
  /** The key that signs the hearth gate's verdict: the carried pin's `signingKey`, kept as the one key the anchor and the hosting address read. */
  readonly hearthGatePubKey?: string;
  /** The hearth's FULL sovereign sync pin the root-signed answer carried (tier, Nexus, route, transport and signing keys): what a dial files and knocks with. */
  readonly hearthGatePin?: GateBundlePin;
  /** The hearth's FLOOR pins at that Nexus, which the root-signed answer carried (house ruling "The admit's gate pin", carrier (b)):
   *  what the oracle read files under the same hearth, before any crossing. */
  readonly hearthFloorPins?: readonly GateBundlePin[];
  /** The hearth's base-canon documents the joinee mounts, keyed by canon bag URI (`bags/lares`,
   *  `bags/lararium`) and valued by document url. The joinee's gate widens by exactly these documents when it
   *  dials this hearth; the hearth's oracle plane never crosses to it. */
  readonly hearthCanonDocs?: Readonly<Record<string, string>>;
  /** How the founder's island resolved at admit time — never `torn` (a torn founder refuses before
   *  minting: `admitBoardIsland`/`nodeNexusStanding` throws). Absent on an older payload; a reader
   *  without it falls back to the pre-existing anchor-by-gate-key behavior, unchanged for `own`/`anchor`
   *  founders. */
  readonly hearthIslandKind?:  "own" | "anchor" | "charter" | "explicit";
  /** The scope that kind names — the genesis epoch string for `charter`, else the founder's own key. */
  readonly hearthIslandScope?: string;
};
export { boardDyadReader } from "./board-dyad-reader.js";
export { kahuReachSourceOf } from "./kahu-reach-source.js";
