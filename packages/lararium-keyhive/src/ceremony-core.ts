/**
 * ceremony-core — isomorphic DreamNet founding and vessel-admission ceremonies.
 *
 * This module contains zero vessel-specific code. It runs identically in:
 *   - Node vessel (lararium-node wraps it with NodeFS + disk keypair)
 *   - Browser vessel (lararium-browser wraps it with IndexedDB + WebCrypto keypair)
 *   - Mobile vessel (any future vessel with its own storage adapter)
 *
 * The four vessel-specific shores the caller provides:
 *   repo         — Automerge Repo backed by any StorageAdapter
 *   vesselSeed — the PLACE's own 32-byte Ed25519 seed, from any secure store
 *   (founding ceremony also needs verifyingKey + displayName for identity tiddler)
 *
 * The result types carry all minted data; the caller decides where to persist
 * the bootstrap artifact (disk, IndexedDB, stdout, etc.).
 *
 * Identity lattice produced by runFoundingCeremony:
 *   Vessel Individual (from seed)
 *     └─▶ PersonaGroup, a Keyhive GROUP (the Binding Gate proves the vessel at boot; a seat's revocation rolls
 *         the key of every bag the group reaches)
 *              └─▶ MeshCabal sentinel Document (Gate C: cabal membership, owed at canon access, never at boot)
 *
 * At t=0, founding operator's PersonaGroup is the only MeshCabal member.
 * the carriage contract adds co-operators. The MeshCabal grows; this path never re-runs.
 *
 * The TRUE NAME MODEL the ceremony enacts — two DISTINCT keys, one signed edge:
 *   · `vesselSeed` carries the PLACE's own key — minted per-install,
 *     never copied to another vessel. It mints the Vessel Individual and inits Keyhive.
 *   · `binding` carries the PERSONA ROOT's authority — the HUMAN's side. A SELF-STOOD binding holds
 *     that root's seed, which ONLY signs and never inits Keyhive; a CONTRACTED binding holds no seed
 *     at all, carrying instead an edge some other operator already signed.
 *   · `buildDeviceDelegation` binds them without merging them: the persona root signs
 *     "Operator O delegates to Device D AT PLACE P", where `hearthTrueName` names P — the
 *     hearth's True Name. Peers pin the root and verify that edge offline. In the same act the root
 *     seals its PersonaGroup secret to D's key (`persona-group-secret`), the secret D's sibling
 *     proofs run on.
 * `runDeviceAdmitEdge` carries the same shape outward: the founder's root signs a joinee's
 * OWN vessel key into the PersonaGroup, so no seed ever crosses the wire. A single key
 * copied across vessels would present one collector to every verifier and link every self —
 * the split is what the veil rests on. See lar:///ha.ka.ba/lares/docs/federation.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/ceremony-core
 */

import type { Repo } from "@lararium/mesh";
import {
  IDENTITIES_NAMESPACE, DAEMON_BAG_ID,
  MESH_CABAL_SENTINEL_URI,
  PERSONA_GROUP_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  HEARTH_DAEMON_URL_TIDDLER,
  SIGNER_DID_TIDDLER, HEARTH_TRUE_NAME_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER,
  CAP_EVENT_TAG,
  seedIdentitiesDoc, seedCirclesDoc, seedSessionsDoc, seedDaemonDoc, seedPersonaDoc,
  personaScopedBagIds,
  buildDeviceDelegation, countersignDeviceDelegation, verifyDeviceDelegation, type DeviceDelegationTiddler, type DeviceDelegationRootHalf,
  personaKelBoardDocUrl, writePersonaKelEvent, materializeSharedLarDoc, fleetEdgeBoardDocUrl, writeEdgeFrontier, writeFrontierSnapshot, frontierSnapshotCid, verifyingKeyFromDid, type EdgeFrontier,
  type PersonaKelEvent,
  dyadId, signDyadBindingWithSeed, writeDyad,
  mintFaceAtomSeed, faceAtomKeyFromSeed, FACE_CHECKPOINT_INFO,
  DYAD_ID_DOMAIN, type DyadRecord, type DyadRef,
  deriveSelfRecoveryKey, provisionThresholdRecoveryAtFounding, guardianRecoveryRegistrationCard,
  enrolDevice, sealGroupSecret, groupSecretSealTitle, type GroupSecretSeal,
  type LarTiddlerStore, writePersonaAct,
  signFoundingLog, faceRootCommitment, edgeBodyDigest, landFleetGenesis, makeHandLineage,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, type LarDoc,
} from "@lararium/mesh";

import { bytesToBase64, base64ToBytes } from "./bytes-base64.js";
import { buildCeremonyTiddlers, webDigest, hex as hexEncode, plainEntries, storedRecord, tiddlerText, type StoredTiddlers } from "@lararium/mesh";
import { KeyhiveProvider } from "./keyhive-provider.js";
import { InMemoryEventStore } from "./event-store.js";
import { capEventTitle, absorbCapEvents } from "./daemon-event-store.js";
import type { DeviceAdmitPayload } from "./index.js";
import { readFaceOperation, writeFaceOperation } from "./face-operation-record.js";

async function checkpointKey(seed: Uint8Array, domain: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", Uint8Array.from(seed), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(domain) },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function sealCheckpoint(value: unknown, seed: Uint8Array, domain: string = FACE_CHECKPOINT_INFO): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(domain) }, await checkpointKey(seed, domain), plaintext));
  return JSON.stringify({ nonce: bytesToBase64(nonce), data: bytesToBase64(data) });
}

export async function openCheckpoint<T>(text: string, seed: Uint8Array, domain: string = FACE_CHECKPOINT_INFO): Promise<T> {
  try {
    const sealed = JSON.parse(text) as { nonce: string; data: string };
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(base64ToBytes(sealed.nonce)), additionalData: new TextEncoder().encode(domain) }, await checkpointKey(seed, domain), Uint8Array.from(base64ToBytes(sealed.data)));
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch { throw new Error("[ceremony] checkpoint does not open for this atom"); }
}

async function checkpointId(seed: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", Uint8Array.from(seed), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0),
    info: new TextEncoder().encode(`${FACE_CHECKPOINT_INFO}:title`),
  }, material, 256);
  return hexEncode(new Uint8Array(bits));
}

// ---------------------------------------------------------------------------
// Founding ceremony
// ---------------------------------------------------------------------------

/**
 * How a founding binds its device to its hearth — the two modes, made explicit rather than inferred.
 *
 * SELF-STOOD carries a seed that SIGNS: the vessel builds its own device-delegation and seats a fresh
 * persona-KEL inception. It never inits Keyhive with that seed (the per-vessel key stays the Individual).
 *
 * CONTRACTED carries no seed at all. A trusted operator, already contracted with the kahu, signed the edge
 * on THEIR vessel; this one carries the edge, the pinned identifier prefix, and the operator's KEL chain.
 * The chain rides ALONG because the Binding Gate walks it from the LOCAL replica — a vessel that founded
 * without it would boot fail-closed with no head to reach, waiting on a federation it cannot yet perform.
 * Carried, never fetched: a crossroads that holds no human key also holds no way to go ask for one.
 */
export type FoundingBinding =
  | {
      readonly mode:       "self-stood";
      /** The 32-byte seed that SIGNS the edge — a persona root, or the vessel's own for an anon. */
      readonly signerSeed: Uint8Array;
    }
  | {
      readonly mode:             "contracted";
      /** The edge the contracting operator signed elsewhere — this vessel holds it, never the seed behind it. */
      readonly edge:             DeviceDelegationRootHalf;
      /** The identifier PREFIX the Binding Gate pins — the contracting operator's, not this vessel's. */
      readonly personaKelPrefix: string;
      /** That operator's KEL, carried so the first boot walks prefix→head off its own replica. */
      readonly personaKelChain:  readonly PersonaKelEvent[];
      /** The PersonaGroup secret the contracting root sealed to THIS device beside the edge, in the same act. */
      readonly groupSecretSeal:  GroupSecretSeal;
    };

export interface FoundingCeremonyInput {
  repo:                Repo;
  /** The PER-VESSEL device signing seed — inits Keyhive (this vessel IS the Individual). */
  vesselSeed:        Uint8Array;
  /** Hex-encoded verifying key of the place. */
  vesselVerifyingKey: string;
  /** Display name for the device identity tiddler. */
  vesselDisplayName:  string;
  /** HOW this founding binds its device — the two modes `vessel-standing` names. REQUIRED: every
   *  founding binds, and the mode says whether this vessel signs its own binding or carries one. */
  binding: FoundingBinding;
  /** The hearth true-name (engine content-CID) this vessel binds TO — the place in (vessel × hearthTrueName).
   *  REQUIRED: a founding with no place to bind to is no founding. */
  hearthTrueName:      string;
  /** The Nexus pubkey (this node's own gate key) the per-Nexus persona-KEL board derives from. The founding
   *  seats the KEL INCEPTION onto that board so the very first boot walks the identifier→head mapping locally.
   *  REQUIRED: a founding that seats no inception leaves the Binding Gate with no head to walk (it fails closed). */
  nexusPubkey:         string;
  /** The face atom's seed; a fresh founding mints one when absent. */
  atomSeed?:           Uint8Array;
}

export interface FoundingCeremonyResult {
  /** Automerge URL strings — vessel-agnostic, serializable into the bootstrap artifact. */
  identitiesUrl:         string;
  circlesUrl:            string;
  sessionsUrl:           string;
  daemonUrl:              string;
  /** The mounted PersonaGroup plane's doc URL — founded alongside the daemon bag. */
  personaUrl:             string;
  /** That plane's BAG ID, derived from the PersonaGroup's own id. One name, everywhere it is reached. */
  personaBagId:           string;
  personaGroupId:   string;
  meshCabalDocIdHex:     string;
  /** The operator's self-certifying ContactCard JSON, minted once during the
   *  ceremony. The caller caches it for the light leaf-identity path (OP-AP5). */
  contactCardJson:       string;
  /** The PINNED signer DID ("0x"+hex) — provenance (the founding op-key = the KEL inception op-key). The
   *  Binding Gate pins `personaKelPrefix` instead and walks the KEL to the current head (no raw-pin hybrid). */
  signerDid:       string;
  /** The persona-KEL identifier PREFIX (AID) the Binding Gate PINS — stable across every op-key rotation.
   *  Its inception seats the founding op-key; a later Reading-B rotation advances the head beneath it. */
  personaKelPrefix:      string;
  /** The root-signed and atom-countersigned face delegation. */
  founderEdge:           DeviceDelegationTiddler;
  /** The atom seed handed to the shore for custody. */
  atomSeed:              Uint8Array;
  /** The vessel's own keyhive Archive as the place founding left it. RAW SECRET material; the shore keeps it. */
  archive:               Uint8Array;
  /** The creator-veil's keyhive Archive (see `FaceFoundingResult.veilArchive`). */
  veilArchive:           Uint8Array;
}

// ── THE TWO HALVES OF A FOUNDING ───────────────────────────────────────────────────────────────
// A founding stands TWO things, and canon keeps them apart: a PLACE (a somewhere — addressable,
// carriable, vouchable) and a FACE (a someone — a persona root, its key-event-log, the edge binding
// a device to it). `identity-classes#herm-establishment` rules the separation outright: the Herm
// "boots permissionlessly on its own key… it asks no blessing to exist", and "NO civic identity mints
// into the Herm" — only the wax-sealed contract edges.
//
// So the place founds ALONE and the face lands on top of it, by a later operator act. Fusing them made
// every vessel mint a human's root before it could carry a single byte, which is the one thing a
// crossroads exists not to do.
//
// WHERE THE CABAL SITS, AND WHY NOT THE PLACE: a MeshCabal holds MEMBERS, and its members read as
// PersonaGroups — faces. `IdentityAnchors` already files it that way, keyed by handle-index beside the
// persona ids, and the boot path calls cabal membership AFFILIATION rather than identity (a PersonaGroup
// belongs to many cabals or none). So a cabal seeded on a place identifier would hold a membership
// structure with nothing that can be a member.
//
// A faceless place carries by CONTRACT instead — the wax-sealed carriage edge canon gives the Herm:
// "No civic identity mints into the Herm — only the wax-sealed contract/edges." Carry ⊥ read holds
// without a cabal, because the edge carries the authority a seat would have.
//
// Canon: lar:///ha.ka.ba/lares/api/pono/waking-floor · lar:///ha.ka.ba/lararium/mesh/identity-classes

/** What a place-founding needs: a key, a name, and the hearth it stands at. No persona anywhere. */
export interface PlaceFoundingInput {
  repo:               Repo;
  /** The PER-VESSEL device signing seed — inits Keyhive (this vessel IS the Individual). */
  vesselSeed:         Uint8Array;
  /** The hearth true-name (engine content-CID) this place stands at. */
  hearthTrueName:     string;
  /** The vessel's own keyhive Archive when one already rests on this shore (a place founded again over a kept
   *  identity). Present, the vessel individual RESTORES from it, so the archive this founding hands back still
   *  carries every prekey secret and all the state the kept one held. Absent: a first founding. */
  archiveBytes?:      Uint8Array;
}

export interface PlaceFoundingResult {
  /** The sovereign daemon island — the immune core, standing before any face. */
  daemonUrl:            string;
  /** That island's live handle. `seedDaemonDoc` CREATES, so a face-founding must be handed this one
   *  rather than seeding again — a second call would stand a second daemon doc and orphan the first. */
  daemonHandle:         ReturnType<typeof seedDaemonDoc>;
  /** This vessel's own Keyhive agent — the Place DID's identifier. */
  vesselIdentifierHex:  string;
  /** The self-certifying ContactCard the light leaf-identity path re-presents (OP-AP5). */
  contactCardJson:      string;
  /** The vessel's own keyhive Archive as this founding left it: the prekey secrets behind the card above and the
   *  key agreement state of what it created. RAW SECRET material; the shore seals it at rest, and every later act
   *  that re-stands this individual restores from it. */
  archive:              Uint8Array;
}

/**
 * Found the PLACE — the daemon bag, the vessel's own Keyhive individual, and the hearth it stands at.
 *
 * Everything here stands on the vessel's own key and asks nobody. A vessel founded to this point
 * carries, serves the public shelf, and holds every sovereign act closed: the waking floor, reached
 * by founding rather than by falling.
 */
export async function foundThePlace(input: PlaceFoundingInput): Promise<PlaceFoundingResult> {
  const { repo, vesselSeed, hearthTrueName } = input;

  const daemonHandle = seedDaemonDoc(repo);

  const keyhive = new KeyhiveProvider();
  const store   = new InMemoryEventStore();
  await keyhive.init({ seed: vesselSeed, eventStore: store, ...(input.archiveBytes ? { archiveBytes: input.archiveBytes } : {}) });

  const vesselIdentifierHex = await keyhive.vesselIdentifierHex();

  await flushCapEvents(store, daemonHandle);

  daemonHandle.change((doc) => {
    doc.tiddlers[HEARTH_TRUE_NAME_TIDDLER] = storedRecord({
      tiddler: { title: HEARTH_TRUE_NAME_TIDDLER, text: hearthTrueName, kind: "hearth-true-name" },
      meta: { authority: "lares-init" },
    });
  });

  const contactCardJson = new TextDecoder().decode(await keyhive.contactCard());
  // THE ARCHIVE LEAVES BEFORE THE PROVIDER DOES. The card above names prekeys whose secrets live in this provider
  // alone; disposed with no archive taken, the vessel's next stand mints other prekeys under the same card's name.
  const archive = await keyhive.exportArchive();
  await keyhive.dispose();

  return {
    daemonUrl: daemonHandle.url as string,
    daemonHandle,
    vesselIdentifierHex,
    contactCardJson,
    archive,
  };
}

/**
 * The vessel's own self-certifying Keyhive ContactCard, minted from THE VESSEL'S OWN SEED and nothing else: the place card.
 * `foundThePlace` mints it at a place founding; a joinee node, which founds no place, mints it here so it never reaches a
 * place-arm presentation cardless. The archive leaves with the card (it holds the prekey secrets the card names).
 */
export async function mintPlaceCard(input: { readonly vesselSeed: Uint8Array; readonly archiveBytes?: Uint8Array }): Promise<{ readonly contactCardJson: string; readonly archive: Uint8Array; readonly vesselIdentifierHex: string }> {
  const keyhive = new KeyhiveProvider();
  await keyhive.init({ seed: input.vesselSeed, eventStore: new InMemoryEventStore(), ...(input.archiveBytes ? { archiveBytes: input.archiveBytes } : {}) });
  try {
    return {
      vesselIdentifierHex: await keyhive.vesselIdentifierHex(),
      contactCardJson: new TextDecoder().decode(await keyhive.contactCard()),
      archive: await keyhive.exportArchive(),
    };
  } finally { await keyhive.dispose(); }
}

/** Does this card name the individual whose verifying key is `vesselKeyHex`? Read through a throwaway provider, never trusted from the JSON. */
export async function placeCardIsOf(contactCardJson: string, vesselKeyHex: string): Promise<boolean> {
  const reader = new KeyhiveProvider();
  await reader.init({ seed: new Uint8Array(32).fill(1), eventStore: new InMemoryEventStore() });
  try {
    const { id } = await reader.receiveContactCard(new TextEncoder().encode(contactCardJson));
    return String(id).toLowerCase().replace(/^0x/, "").endsWith(vesselKeyHex.toLowerCase().replace(/^0x/, ""));
  } catch { return false; }
  finally { await reader.dispose(); }
}

/**
 * The cabal sentinel's seed for a face founded at one hearth: the sentinel URI under the hearth's Nexus AID, so two
 * hearths' cabals seed apart. A face founded at no hearth (a hearth-agnostic leaf) seeds from the bare URI.
 */
export function meshCabalSentinelUriFor(hearthAid: string): string {
  const aid = hearthAid.trim();
  return aid.length > 0 ? `${MESH_CABAL_SENTINEL_URI}/${aid}` : MESH_CABAL_SENTINEL_URI;
}

/** What a face-founding lands ON: a place that already stands, named by its own daemon bag. */
export interface FaceFoundingInput {
  repo:               Repo;
  /** The daemon handle the place-founding stood. The face writes its pins into the SAME island. */
  daemonHandle:       ReturnType<typeof seedDaemonDoc>;
  vesselVerifyingKey: string;
  vesselDisplayName:  string;
  /** The random atom seed held for this PersonaGroup. */
  atomSeed?:          Uint8Array;
  /** Bind a shore's full founding ask to its recoverable checkpoint. */
  askDigest?:         string;
  binding:            FoundingBinding;
  hearthTrueName:     string;
  nexusPubkey:        string;
  /** The atom's Keyhive archive as it rests on this shore. */
  veilArchiveBytes?:  Uint8Array;
  /** Whether this face MOUNTS — writes the SINGULAR daemon-doc pins (PersonaGroup / MeshCabal /
   *  signer / persona-KEL prefix / device-edge / dyad) the boot reads to run the ONE mounted
   *  face's Binding Gate. DEFAULT true — the founding face (h0) mounts, exactly as before. A per-persona
   *  founding of an ADDITIONAL compartment passes false: it MINTS its own individual (group, cabal, four
   *  planes, persona-KEL inception on the shared board, veil, edge) and returns it, but writes none of the
   *  singular pins — those keys are one-per-daemon-doc, so a second face writing them would unseat the first
   *  (its continuity anchor forks). The node adapter records the un-mounted face as a register-many plane
   *  entry the boot's `readPersonaPlanes` consumes; mounting it is a later act (the wear-reboot re-pin). */
  mount?:             boolean;
}

export interface FaceFoundingResult {
  /** The atom seed handed to the shore for custody. */
  atomSeed:               Uint8Array;
  /** The atom's self-certifying contact card. */
  contactCardJson:        string;
  /** The MeshCabal this face founds — a membership structure whose members read as PersonaGroups. */
  meshCabalDocIdHex:      string;
  identitiesUrl:          string;
  circlesUrl:             string;
  sessionsUrl:            string;
  personaUrl:             string;
  personaBagId:           string;
  personaGroupId:   string;
  signerDid:              string;
  personaKelPrefix:       string;
  founderEdge:            DeviceDelegationTiddler;
  /** The PersonaGroup secret sealed to this device beside `founderEdge`. */
  groupSecretSeal:        GroupSecretSeal;
  /** The atom's Keyhive archive; the shore seals it at rest. */
  veilArchive:            Uint8Array;
}

const FACE_FOUNDING_CHECKPOINT_PREFIX = "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/";
type FaceCheckpoint = {
  /** What the founding was asked: a checkpoint answers only that same ask. */
  scope: string;
  result: Omit<FaceFoundingResult, "atomSeed" | "veilArchive"> & { veilArchive: string };
  dyad: DyadRecord;
  mount: boolean;
  events: readonly { hash: string; variant: string; bytes: string; island?: string }[];
};

async function readFaceCheckpoint(handle: ReturnType<typeof seedDaemonDoc>, atomSeed: Uint8Array, scope: string): Promise<FaceCheckpoint | null> {
  const record = handle.doc()?.tiddlers[`${FACE_FOUNDING_CHECKPOINT_PREFIX}${await checkpointId(atomSeed)}`];
  const body = record ? tiddlerText(record) : null;
  if (!body) return null;
  const checkpoint = await openCheckpoint<FaceCheckpoint>(body, atomSeed);
  return checkpoint.scope === scope ? checkpoint : null;
}

/** Retire the founding write-ahead record after the node commits this face's local carriers. */
export async function retireFaceCheckpoint(handle: ReturnType<typeof seedDaemonDoc>, atomSeed: Uint8Array): Promise<void> {
  const title = `${FACE_FOUNDING_CHECKPOINT_PREFIX}${await checkpointId(atomSeed)}`;
  if (handle.doc()?.tiddlers[title]) handle.change((doc) => { delete doc.tiddlers[title]; });
}

async function landFaceCheckpoint(handle: ReturnType<typeof seedDaemonDoc>, checkpoint: FaceCheckpoint): Promise<void> {
  const result = checkpoint.result;
  const events = new InMemoryEventStore();
  for (const e of checkpoint.events) await events.put({ hash: e.hash, variant: e.variant, bytes: base64ToBytes(e.bytes), ...(e.island ? { island: e.island } : {}) });
  await flushCapEvents(events, handle);
  handle.change((doc) => {
    writeGroupSecretSeal(doc, result.personaGroupId, result.groupSecretSeal);
  });
  if (!checkpoint.mount) return;
  handle.change((doc) => {
    doc.tiddlers[MESH_CABAL_DOC_ID_TIDDLER] = storedRecord({
      tiddler: { title: MESH_CABAL_DOC_ID_TIDDLER, text: result.meshCabalDocIdHex, kind: "sentinel-id" }, meta: { authority: "lares-init" },
    });
    doc.tiddlers[PERSONA_GROUP_ID_TIDDLER] = storedRecord({
      tiddler: { title: PERSONA_GROUP_ID_TIDDLER, text: result.personaGroupId, kind: "persona-group-id" }, meta: { authority: "lares-init" },
    });
  });
  handle.change((doc) => {
    writeDyad(doc, checkpoint.dyad);
    doc.tiddlers[SIGNER_DID_TIDDLER] = storedRecord({
      tiddler: { title: SIGNER_DID_TIDDLER, text: result.signerDid, kind: "operator-root-did" }, meta: { authority: "lares-init" },
    });
    // The PINNED identifier — the pin's root of trust (the operator's own sovereign daemon home). The boot
    // path reads THIS prefix, threads it beside the local KEL chain, and the worker asserts chain[0].prefix === it.
    doc.tiddlers[PERSONA_KEL_PREFIX_TIDDLER] = storedRecord({
      tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: result.personaKelPrefix, kind: "persona-kel-prefix" }, meta: { authority: "lares-init" },
    });
    doc.tiddlers[DEVICE_DELEGATION_SELF_TIDDLER] = storedRecord({
      tiddler: { title: DEVICE_DELEGATION_SELF_TIDDLER, ...result.founderEdge }, meta: { authority: "lares-init" },
    });
    // The hearth the mounted face binds: its edge's true name, which a place founding wrote before any hearth stood.
    doc.tiddlers[HEARTH_TRUE_NAME_TIDDLER] = storedRecord({
      tiddler: { title: HEARTH_TRUE_NAME_TIDDLER, text: result.founderEdge.hearthTrueName, kind: "hearth-true-name" }, meta: { authority: "lares-init" },
    });
  });
}

/** Rest a device's PersonaGroup secret seal on its daemon doc, keyed by the group. Call inside `change()`. */
function writeGroupSecretSeal(
  doc: { tiddlers: StoredTiddlers }, personaGroupId: string, seal: GroupSecretSeal, authority = "lares-init",
): void {
  const title = groupSecretSealTitle(personaGroupId);
  doc.tiddlers[title] = storedRecord({
    tiddler: { title, text: JSON.stringify(seal), kind: "group-secret-seal" },
    meta: { authority },
  });
}

/**
 * The founding's SIGNED RECORDS, landed by the one path both shores take: the persona root signs the face's genesis log
 * onto its `@persona` plane (the founding, one `plane` act per plane, the founder device's admission and its edge) and the
 * fleet's empty genesis frontier onto its fleet board. Signatures are deterministic, so a founding that re-enters from its
 * checkpoint lands the same bytes and nothing doubles. A contracted founding holds no root seed and signs none: the
 * contracting operator's records arrive with its edge.
 */
async function landFaceGenesis(input: { repo: Repo; binding: FoundingBinding; atomSeed: Uint8Array; face: Pick<FaceFoundingResult, "personaGroupId" | "personaKelPrefix" | "personaUrl" | "identitiesUrl" | "circlesUrl" | "sessionsUrl" | "founderEdge" | "signerDid"> }): Promise<void> {
  if (input.binding.mode !== "self-stood") return;
  const { face } = input;
  const seed = input.binding.signerSeed;
  const rootKey = await ed25519VerifyingKeyFromSeed(seed);
  if (rootKey !== verifyingKeyFromDid(face.signerDid as never)) throw new Error("[founding] the root that signs the face's records differs from the founder's DID");
  const signer = { key: rootKey, sign: ed25519SignerFromSeed(seed) };
  const acts = await signFoundingLog({
    group: face.personaGroupId, personaKelPrefix: face.personaKelPrefix,
    rootCommitment: faceRootCommitment(face.founderEdge.personaRootDid), epoch: 0,
    planes: { persona: face.personaUrl, identities: face.identitiesUrl, circles: face.circlesUrl, sessions: face.sessionsUrl },
    deviceKey: faceAtomKeyFromSeed(input.atomSeed, face.personaGroupId).key,
    edgeDigest: edgeBodyDigest(face.founderEdge),
  }, signer);
  const plane = await input.repo.find<LarDoc>(face.personaUrl as never);
  plane.change((draft) => { for (const act of acts) writePersonaAct(draft, act); });
  const lineage = makeHandLineage([{ epoch: 0, signers: [rootKey], threshold: 1 }])!;
  const board = await materializeSharedLarDoc(input.repo, fleetEdgeBoardDocUrl(rootKey), "board:edge-kapae");
  const draft = { tiddlers: {} } as unknown as LarDoc;
  await landFleetGenesis(draft, rootKey, lineage, signer);
  board.change((d) => { Object.assign(d.tiddlers, draft.tiddlers); });
}

/**
 * Found the FACE — the persona group, its private plane, the social planes, the binding edge and the
 * persona-KEL inception — onto a place that already stands.
 *
 * It re-opens Keyhive over the cap events the place persisted rather than carrying a live provider in,
 * so ONE path serves both the composed founding and a later operator act. A face landing months after
 * its place runs exactly the code the founding ran.
 */
export async function foundTheFace(input: FaceFoundingInput): Promise<FaceFoundingResult> {
  const { repo, daemonHandle, vesselDisplayName, vesselVerifyingKey } = input;
  const atomSeed = input.atomSeed ?? mintFaceAtomSeed();
  const atom = faceAtomKeyFromSeed(atomSeed, "founding");
  if (atom.key === vesselVerifyingKey.toLowerCase()) throw new Error("[founding] the place key cannot stand as a face atom");
  const foundingScope = JSON.stringify([input.hearthTrueName, input.binding.mode, input.binding.mode === "contracted" ? input.binding.personaKelPrefix : null, input.mount !== false, ...(input.askDigest === undefined ? [] : [input.askDigest])]);
  const prior = await readFaceCheckpoint(daemonHandle, atomSeed, foundingScope);
  if (prior) {
    await landFaceCheckpoint(daemonHandle, prior);
    const resumed = { ...prior.result, atomSeed, veilArchive: base64ToBytes(prior.result.veilArchive) };
    await landFaceGenesis({ repo, binding: input.binding, atomSeed, face: resumed });
    return resumed;
  }
  // WHETHER THIS FACE MOUNTS. The founding face (h0) writes the singular daemon-doc pins below; an
  // additional compartment mints its own individual, is returned, and writes none of them (a register-many
  // plane entry carries it instead). Absent → true, so h0's path is unchanged.
  const mount = input.mount !== false;

  // The atom's Keyhive replays the face's cap events from the daemon document.
  const store   = await replayCapEvents(daemonHandle);
  const standing = new Set((await store.list()).map((e) => e.hash));

  // ── THE GROUP IS BORN UNDER THE ATOM ──────────────────────────────────────────────────────────
  // The creator's identifier rides every carried event in CLEARTEXT (the host-surface probe), a
  // creator can never leave its roster, and any access grade IS roster membership — so the place's own
  // identity must never create or hold the WHO-plane sentinels. The atom creates and holds the
  // PersonaGroup's Keyhive membership because the place must never stand in its roster. The place keeps
  // custody and transport; the atom keeps the group.
  const veilKeyhive  = new KeyhiveProvider();
  await veilKeyhive.init({
    seed: atomSeed, eventStore: store,
    ...(input.veilArchiveBytes ? { archiveBytes: input.veilArchiveBytes } : {}),
  });
  await veilKeyhive.hydrateFromEventStore();

  // THE PERSONAGROUP FOUNDS AS A KEYHIVE GROUP (kapae#/keys). A revocation travels down to the documents a group
  // reaches and rolls their key; a sentinel document's rolls none (`tests/seat-roll-substrate.probe.test.ts`).
  const personaGroup = await veilKeyhive.createGroup();

  // THE FACE'S FOUR PLANES, SEEDED ONLY NOW — every one of them names the group's own tag, so the group
  // must exist before any of them can stand under its true name. The capability layer keys a document by
  // hashing its bag URL (`changeIdForBag`), so a plane seeded under one name and renamed later leaves
  // behind a document nothing can ever reach again.
  //
  // A face's relations travel with the FACE. The circles plane holds who this persona follows, blocks and mutes;
  // @identities holds how it recognises others; @sessions holds the sessions it wears. One vessel-global
  // set would put one persona's blocked list in the same document as another's follows, and anything
  // reading it correlates the faces a multitude exists to hold apart.
  const planes        = personaScopedBagIds(personaGroup.groupId);
  const personaBagId  = planes.persona;
  const personaHandle = seedPersonaDoc(repo, personaBagId);
  const identitiesHandle = seedIdentitiesDoc(repo, planes.identities);
  const circlesHandle    = seedCirclesDoc(repo, planes.circles);
  const sessionsHandle   = seedSessionsDoc(repo, planes.sessions);

  // The operator's own identity + circle tiddlers land on the planes that now carry this face's tag.
  const ceremonyTiddlers = buildCeremonyTiddlers(atom.key, vesselDisplayName);
  for (const t of ceremonyTiddlers) {
    const handle = t.bag === IDENTITIES_NAMESPACE ? identitiesHandle : circlesHandle;
    handle.change((doc) => {
      if (!doc.tiddlers[t.title]) {
        doc.tiddlers[t.title] = storedRecord({ tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } });
      }
    });
  }

  // The cabal stands WITH the face, seated on the PersonaGroup that can actually hold a seat in it.
  // THE SENTINEL SEEDS FROM THE HEARTH. A constant seed named one cabal on every vessel; the hearth's AID names
  // this hearth's alone.
  const meshCabal = await veilKeyhive.createSentinelDoc(meshCabalSentinelUriFor(input.hearthTrueName));
  await veilKeyhive.addSentinelMember(personaGroup.groupId, meshCabal.docIdHex);

  // The veil-keyhive membership events are ADDITIVE (content-addressed) — every face's group needs them
  // persisted to be usable, mounted or not, so this flush always runs.

  // THE SINGULAR MOUNT PINS — one key each per daemon doc, read at boot for the ONE mounted face. Only the
  // mounting face writes them; an additional compartment leaves the mounted face's pins standing.

  // ── The binding edge: (vessel × hearthTrueName), SIGNED here or CARRIED in ──
  // A held seed only ever SIGNS — it never inits Keyhive (the per-vessel key stays the Individual).
  // Self-signed when that seed IS the vessel's own (an anon: signerDid == deviceDid); root-signed when
  // a granting root delegates (known-user / operator); and CARRIED when the vessel holds no root to
  // sign with at all. The cap-TIER stays a DERIVED read over the edge's lease-freshness — the
  // boundEpoch below is the decay hook — never a stamped field, whichever way the edge arrived.
  const founderEdge = input.binding.mode === "self-stood"
    ? await buildDeviceDelegation({
        personaRootSeed:    input.binding.signerSeed,  // the root SIGNS
        atomSeed,
        hearthTrueName:     input.hearthTrueName,      // the place this binds TO
        // GENESIS, NOT A PLACEHOLDER: at self-stood founding the daemon bag carries no lease-epoch slots yet
        // for this PersonaGroup (they cannot — the group is born in this same act), so `effectiveLeaseEpoch`
        // over an empty slot set IS 0 (epoch-lease.ts) — this 0 already equals the live read, not a stand-in
        // for one. Nothing to thread here; see the DEVICE-ADMIT mint below for the site that DOES need a live read.
        boundEpoch:         0,

      })
    // CONTRACTED — the edge arrived signed. This vessel binds under a root it does not hold, so it
    // verifies what it carries rather than trusting the hand that carried it: the edge MUST name THIS
    // device, and MUST bind the hearth this founding stands at. A bundle for another vessel or another
    // hearth REFUSES here, where a founding can still be abandoned cleanly.
    : await (async (e: DeviceDelegationRootHalf) => {
        if (e.deviceVerifyingKey.toLowerCase() !== atom.key) {
          throw new Error(
            "[founding] contracted edge names a different device — it delegates to " +
            `${e.deviceVerifyingKey.slice(0, 16)}…, this atom holds ${atom.key.slice(0, 16)}….`,
          );
        }
        if (e.hearthTrueName !== input.hearthTrueName) {
          throw new Error("[founding] contracted edge binds a different hearth true-name — refusing to found under it.");
        }
        return countersignDeviceDelegation(e, atom.sign);
      })(input.binding.edge);
  const signerDid = founderEdge.personaRootDid;
  const edgeVerdict = await verifyDeviceDelegation(founderEdge, signerDid);
  if (!edgeVerdict.ok) throw new Error(`[founding] face delegation refused (${edgeVerdict.reason})`);

  // ── The persona-KEL INCEPTION — the continuity anchor (identity-classes#the-continuity-anchor) ──
  // Seat seq-0 over the founding op-key (== signerDid, the edge's personaRootDid). The identifier PREFIX derives
  // from (founding op-key + the recovery-set pre-commit); it stays FIXED across every future Reading-B rotation,
  // so the Binding Gate pins the PREFIX and the op-key rotates beneath it. Recovery arms UNARMED here (empty
  // pre-commit): the live founding gathers no guardians, so no rotation can attest yet — arming rides the
  // separate recovery-keel wiring (provisionThresholdRecoveryAtFounding). The pin-move stands regardless: an
  // unarmed inception still walks to a head, and at inception the head IS signerDid (zero behavior change today).
  // SELF-STOOD mints its own inception. CONTRACTED mints NONE — the contracting operator's identifier
  // already stands, and minting a second one here would fork the very continuity the pin exists to hold.
  // NO PREFIX INCEPTS UNARMED. Self-stood, the inception pre-commits the
  // founder's OWN 1-of-1 self-recovery digest — a key derived off the persona seed at its own
  // domain-separated leaf. The multitude-of-one, NAMED: whoever holds the seed holds recovery,
  // which an empty commit already meant in practice while forbidding the rotation that acts on it.
  // `mintPersonaRotation` therefore works from day one (lose the device, hold the seed, rotate);
  // a real guardian set arrives by the face's typed first enrolment, which its own current key signs
  // (`mintGuardianEnrolment`), and every later change takes the guardians' rotation.
  const seatedEvents: readonly PersonaKelEvent[] = input.binding.mode === "self-stood"
    ? [provisionThresholdRecoveryAtFounding({
        foundingOpKeyDid:  signerDid,
        guardians:         [guardianRecoveryRegistrationCard("mine", (await deriveSelfRecoveryKey(input.binding.signerSeed)).verifyingKey, null)],
        recoveryThreshold: 1,
      }).inception]
    : input.binding.personaKelChain;
  const personaKelPrefix = input.binding.mode === "self-stood"
    ? seatedEvents[0]!.prefix
    : input.binding.personaKelPrefix;
  if (seatedEvents.length === 0 || seatedEvents.some((e) => e.prefix !== personaKelPrefix)) {
    throw new Error("[founding] the carried KEL is empty or names a prefix other than the pinned one — refusing to found on a chain the Binding Gate could not walk.");
  }
  // Seat the inception onto the per-Nexus KEL board (deterministic id) so the very first boot walks the
  // identifier→head mapping from its OWN local replica — no advertisement, no mint-race (materialize converges
  // on byte-identical blank bytes). The board federates once (DeterministicFederationGate).
  const kelBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(input.nexusPubkey), "board:persona-kel");
  kelBoard.change((draft) => { for (const e of seatedEvents) writePersonaKelEvent(draft, e); });

  // ── THE PERSONAGROUP SECRET, sealed beside the edge (persona-group-secret) ──
  // Self-stood, the root in these hands seals its secret to this device in the act that signed the edge; contracted,
  // the seal arrived with the edge from the root that signed both. It rests on the daemon doc keyed by the group —
  // sovereign, never crossing — so a compartment that does not mount keeps its own beside the mounted face's.
  const groupSecretSeal: GroupSecretSeal = input.binding.mode === "self-stood"
    ? await sealGroupSecret({ opSeed: input.binding.signerSeed, prefix: personaKelPrefix, deviceVerifyingKey: atom.key })
    : input.binding.groupSecretSeal;
  if (!groupSecretSeal || groupSecretSeal.deviceKey !== atom.key || groupSecretSeal.prefix !== personaKelPrefix) {
    throw new Error("[founding] the enrolment carries no PersonaGroup secret sealed to this device under the pinned prefix — refusing to found under it.");
  }

  // ── The DYAD, minted where the face meets the device ──
  // The veil derives off THIS vessel's own veil root, scoped by the PersonaGroup — never the persona root,
  // which spans devices and names no veil. Self-stood, the group root stands in these same hands,
  // so the binding SIGNS at the genesis epoch; contracted, no root is present and the absence
  // travels as binding:null rather than hiding behind a label.
  const dyadRef: DyadRef = { deviceDid: atom.did };
  // THE DYAD'S SCOPE IS THE HEARTH: the binding roots on the hearth's Nexus AID, so a fleet relation minted at one
  // hearth reads bound at that hearth alone. A face founded at no hearth (a hearth-agnostic leaf) binds no dyad.
  const dyadBinding = input.binding.mode === "self-stood" && input.hearthTrueName.trim().length > 0
    ? await signDyadBindingWithSeed(dyadRef, signerDid, input.hearthTrueName.trim(), input.binding.signerSeed)
    : null;
  const dyadRecord: DyadRecord = { kind: DYAD_ID_DOMAIN, dyadId: dyadId(dyadRef), ref: dyadRef, edge: founderEdge, binding: dyadBinding };

  // THE MOUNTED FACE'S BINDING PINS — the dyad, the signer, the persona-KEL prefix and the device-edge the
  // boot's Binding Gate walks. Singular per daemon doc, so only the mounting face writes them; the KEL
  // INCEPTION above already landed on the shared board (keyed by prefix), so an un-mounted compartment's
  // continuity is walkable the day it comes to be worn — without unseating the face standing now.

  // THE VEIL'S ARCHIVE LEAVES BEFORE ITS PROVIDER DOES. The veil created the group and the cabal in this act; the
  // key agreement state that lets it seat a member or seal a chunk lives in its provider alone. The vessel's own
  // provider created nothing here, so its archive stays the one its place founding handed out.
  const contactCardJson = new TextDecoder().decode(await veilKeyhive.contactCard());
  const veilArchive = await veilKeyhive.exportArchive();
  await veilKeyhive.dispose();

  const result: FaceFoundingResult = {
    veilArchive,
    meshCabalDocIdHex: meshCabal.docIdHex,
    identitiesUrl: identitiesHandle.url as string,
    circlesUrl:    circlesHandle.url    as string,
    sessionsUrl:   sessionsHandle.url   as string,
    personaUrl:    personaHandle.url    as string,
    personaBagId,
    personaGroupId:   personaGroup.groupId,
    signerDid,
    personaKelPrefix,
    founderEdge,
    groupSecretSeal,
    atomSeed,
    contactCardJson,
  };
  const events = (await store.list()).filter((e) => !standing.has(e.hash)).map((e) => ({ hash: e.hash, variant: e.variant, bytes: bytesToBase64(e.bytes), ...(e.island ? { island: e.island } : {}) }));
  const { atomSeed: _heldSeed, ...publicResult } = result;
  await landFaceGenesis({ repo, binding: input.binding, atomSeed, face: result });
  const checkpoint: FaceCheckpoint = { scope: foundingScope, result: { ...publicResult, veilArchive: bytesToBase64(veilArchive) }, dyad: dyadRecord, mount, events };
  const checkpointText = await sealCheckpoint(checkpoint, atomSeed);
  const foundingCheckpointTitle = `${FACE_FOUNDING_CHECKPOINT_PREFIX}${await checkpointId(atomSeed)}`;
  daemonHandle.change((doc) => {
    const title = foundingCheckpointTitle;
    doc.tiddlers[title] = storedRecord({ tiddler: { title, text: checkpointText, kind: "face-founding-checkpoint" }, meta: { authority: "lares-init" } });
  });
  await landFaceCheckpoint(daemonHandle, checkpoint);
  return result;
}

/** Write an event store's cap events into the daemon doc in DaemonEventStore-compatible form. Idempotent. */
async function flushCapEvents(
  store: InMemoryEventStore,
  daemonHandle: ReturnType<typeof seedDaemonDoc>,
  authority = "lares-init",
): Promise<void> {
  for (const evt of await store.list()) {
    const hash    = hexEncode(await webDigest("SHA-256", evt.bytes));
    const title   = capEventTitle(hash);
    daemonHandle.change((doc) => {
      if (!doc.tiddlers[title]) {
        doc.tiddlers[title] = storedRecord({
          tiddler: {
            title,
            text:        bytesToBase64(evt.bytes),
            tags:        CAP_EVENT_TAG,
            variant:     evt.variant,
            hash,
            // CIV-3 — the causal island travels WITH the record. `inSelfSlice` reads an absent island as
            // cross-cutting, so a record that loses it here co-loads with EVERY slice forever after: the
            // flatness cut degrades to "load everything" for exactly the events a ceremony wrote. The
            // provider stamps it at mint (DELEGATED/REVOKED off their own bytes, CGKA off the active
            // doc-op) and this round-trip was throwing it away with the value in hand.
            ...(evt.island !== undefined ? { island: evt.island } : {}),
            "bytes-len": String(evt.bytes.length),
          },
          meta: { authority },
        });
      }
    });
  }
}

/** Read the daemon doc's cap events back into a fresh store, so a later ceremony resumes the same lattice. */
export async function replayCapEvents(
  daemonHandle: ReturnType<typeof seedDaemonDoc>,
): Promise<InMemoryEventStore> {
  const store = new InMemoryEventStore();
  const doc   = daemonHandle.doc();
  for (const [title, rec] of plainEntries(doc?.tiddlers)) {
    if (!title.startsWith(`${DAEMON_BAG_ID}/cap/`)) continue;
    if (rec?.meta?.deleted) continue;
    const fields = rec?.tiddler as Record<string, string> | undefined;
    if (!fields?.["text"] || !fields["variant"] || !fields["hash"]) continue;
    await store.put({
      bytes:   base64ToBytes(fields["text"]),
      variant: fields["variant"] as never,
      hash:    fields["hash"],
      // Absent stays ABSENT — a fabricated island would put a record in a slice it does not belong to,
      // which is worse than the eager co-load an honest absence costs.
      ...(fields["island"] ? { island: fields["island"] } : {}),
    });
  }
  return store;
}

/**
 * The whole founding, both halves in one act — what a self-stood hearth or a browser vessel runs.
 *
 * A vessel that holds its own person founds place and face together; nothing is gained by making its
 * operator type two commands. `lares vessel found` runs the FIRST half alone, and `lares persona new 0`
 * lands the second whenever its operator arrives.
 */
export async function runFoundingCeremony(
  input: FoundingCeremonyInput,
): Promise<FoundingCeremonyResult> {
  const place = await foundThePlace({
    repo:           input.repo,
    vesselSeed:     input.vesselSeed,
    hearthTrueName: input.hearthTrueName,
  });
  const face = await foundTheFace({
    repo:               input.repo,
    daemonHandle:       place.daemonHandle,
    vesselVerifyingKey: input.vesselVerifyingKey,
    vesselDisplayName:  input.vesselDisplayName,
    binding:            input.binding,
    hearthTrueName:     input.hearthTrueName,
    nexusPubkey:        input.nexusPubkey,
    ...(input.atomSeed ? { atomSeed: input.atomSeed } : {}),
  });
  return {
    daemonUrl:       place.daemonUrl,
    archive:         place.archive,
    ...face,
  };
}

// ---------------------------------------------------------------------------
// Device-admit payload production
// ---------------------------------------------------------------------------

export interface DeviceAdmitEdgeInput {
  /** The acting atom's face-plane replay shore, keyed by the signed join request. */
  operation?: { readonly store: LarTiddlerStore; readonly atomSeed: Uint8Array; readonly signedInput: Uint8Array };
  /** The founder's PersonaGroup ROOT 32-byte seed — SIGNS the joinee's edge (never inits Keyhive). */
  signerSeed:             Uint8Array;
  /** The joinee atom's raw Ed25519 verifying key (64 lowercase hex). */
  joineeVerifyingKey:     string;
  /** The founder's persona-KEL identifier PREFIX (AID) the joinee PINS — REQUIRED (the joinee's Binding Gate
   *  walks the KEL to the head; a founding always seats an inception, so a prefix always stands). */
  personaKelPrefix:       string;
  /** The founder's persona-KEL chain snapshot, which seeds the joinee's local board. */
  personaKelChain:       readonly PersonaKelEvent[];
  /** Signed persona records to carry to the joinee's daemon doc. */
  personaActs:           readonly unknown[];
  edgeFrontier: { readonly records: readonly unknown[]; readonly snapshots: readonly (readonly [string, readonly string[]])[] };
  /** The hearth true-name (engine CID) the joinee binds TO. */
  hearthTrueName:         string;
  /** The face's PersonaGroup (a Keyhive group's id) and the MeshCabal sentinel the founding seated it in. */
  personaGroupId:   string;
  meshCabalDocIdHex:      string;
  syncUrl:                string | null;
  /** The PersonaGroup's CURRENT lease epoch (`effectiveLeaseEpoch` over `leaseEpochPrefix(personaGroupId)`
   *  slots, read by the caller off the live daemon replica — the SAME read `gateFaceJoin` folds by max) at
   *  mint time. The minted edge's `boundEpoch` binds to THIS value, so a device admitted before a later roll
   *  reads stale at the admission door and is denied until it re-presents via face-join regrant. OPTIONAL —
   *  a caller with no reachable lease read (e.g. a bare unit fixture) omits it and the edge mints `boundEpoch:
   *  0`, the pre-epoch-wiring floor (never a forged non-zero value from an unreachable source). */
  boundEpoch?:            number;
  /** Automerge URL of the issuing vessel's genesis island — for peer-sync delivery. */
  islandDocUrl?:          string | null;
  /** The HEARTH's own daemon doc — the door the joinee knocks on to ask for its seat (the daemon plane never
   *  crosses, so a joinee's own plane reaches nobody). REQUIRED (nullable): a founder with no door names
   *  that explicitly (`null`) rather than the caller omitting the field. */
  hearthDaemonUrl:       string | null;
  /** The shared PersonaGroup document URL the joinee joins. */
  personaUrl:            string;
}

/**
 * Produce a device-admit/v1 payload for the UPGRADE event: the founder's PersonaGroup root SIGNS
 * a root→joinee delegation root half for the joinee's atom key. The joinee countersigns it before storage.
 */
export async function runDeviceAdmitEdge(
  input: DeviceAdmitEdgeInput,
): Promise<DeviceAdmitPayload> {
  if (input.operation) {
    const prior = await readFaceOperation<DeviceAdmitPayload>(input.operation.store, input.operation.atomSeed, input.operation.signedInput);
    if (prior) return prior;
  }
  if (!/^[0-9a-f]{64}$/.test(input.joineeVerifyingKey)) {
    throw new Error("[ceremony] runDeviceAdmitEdge: joineeVerifyingKey must be 64-char lowercase hex");
  }
  // Fail-closed: the joinee's Binding Gate PINS this prefix — a payload with no pin would admit a vessel that
  // then boots with nothing to walk. A founding always seats an inception, so a prefix is always available.
  if (typeof input.personaKelPrefix !== "string" || input.personaKelPrefix.length === 0) {
    throw new Error("[ceremony] runDeviceAdmitEdge: personaKelPrefix required — the joinee pins the founder's persona-KEL identifier");
  }
  // A joinee needs the founder's KEL chain, shared persona document, and hearth door to join.
  if (!input.personaKelChain || input.personaKelChain.length === 0) {
    throw new Error("[ceremony] runDeviceAdmitEdge: personaKelChain required — the joinee seeds its local KEL board from it");
  }
  if (!input.edgeFrontier || !Array.isArray(input.edgeFrontier.records) || !Array.isArray(input.edgeFrontier.snapshots)) {
    throw new Error("[ceremony] runDeviceAdmitEdge: edgeFrontier required");
  }
  if (typeof input.personaUrl !== "string" || input.personaUrl.length === 0) {
    throw new Error("[ceremony] runDeviceAdmitEdge: personaUrl required — the joinee syncs the founder's shared persona doc from it");
  }
  if (input.hearthDaemonUrl === undefined) {
    throw new Error("[ceremony] runDeviceAdmitEdge: hearthDaemonUrl required (may be null) — state the hearth's door explicitly or name null, never omit it");
  }
  // ONE ENROLMENT: the founder's PersonaGroup root signs the joinee's edge and seals the PersonaGroup secret to the
  // same device key, in one act (persona-group-secret).
  const { edge: deviceEdge, seal: groupSecretSeal } = await enrolDevice({
    opSeed:             input.signerSeed,          // the founder's PersonaGroup root SIGNS and SEALS
    prefix:             input.personaKelPrefix,
    deviceVerifyingKey: input.joineeVerifyingKey,
    hearthTrueName:     input.hearthTrueName,
    // THE DEVICE-ADMIT PATH MUST CARRY A REAL EPOCH — this edge licenses a NEW device, so it binds to the
    // lease epoch the caller read live (`input.boundEpoch`), never a frozen genesis value. Absent a live
    // read, 0 is the honest floor (a doc predating the epoch wiring reads every device as maximally stale —
    // safe direction — never the reverse).
    boundEpoch:         input.boundEpoch ?? 0,
  });
  const issued: DeviceAdmitPayload = {
    kind:                   "device-admit/v1",
    signerDid:              deviceEdge.personaRootDid,
    personaKelPrefix:       input.personaKelPrefix,
    personaKelChain:        input.personaKelChain,
    personaActs:            input.personaActs,
    edgeFrontier:           input.edgeFrontier,
    deviceEdge,
    groupSecretSeal,
    hearthTrueName:         input.hearthTrueName,
    personaGroupId:   input.personaGroupId,
    meshCabalDocIdHex:      input.meshCabalDocIdHex,
    syncUrl:                input.syncUrl,
    ...(input.islandDocUrl != null ? { islandDocUrl: input.islandDocUrl } : {}),
    hearthDaemonUrl:        input.hearthDaemonUrl,
    personaUrl:             input.personaUrl,
  };
  if (input.operation) await writeFaceOperation(input.operation.store, input.operation.atomSeed, input.operation.signedInput, issued);
  return issued;
}

// ---------------------------------------------------------------------------
// Apply admit payload (vessel-admission path)
// ---------------------------------------------------------------------------

export interface ApplyAdmitInput {
  repo:                 Repo;
  daemonHandle:         ReturnType<typeof seedDaemonDoc>;
  /** The joinee's atom seed, which signs its edge and contact card. */
  atomSeed:           Uint8Array;
  vesselDisplayName:  string;
  payload:              DeviceAdmitPayload;
  /** The joinee's own Nexus pubkey (its gate key) — the per-Nexus KEL board the joinee seeds the founder's
   *  inception snapshot onto, so its LOCAL boot walks to a head with no sync wait (no-global-now). */
  nexusPubkey:          string;
  /** The atom's Keyhive archive at rest on this shore. */
  archiveBytes?:        Uint8Array;
  /** Leave the daemon's singular mount pins with its worn face. */
  mount?:               boolean;
}

export interface ApplyAdmitResult {
  /** The joinee's own self-certifying ContactCard JSON — the leaf identity it presents at a peer's gate. */
  contactCardJson: string;
  /** The joinee's own keyhive Archive: the prekey secrets behind that card and the membership it absorbed. RAW
   *  SECRET material; the shore seals it at rest. */
  archive:         Uint8Array;
  identitiesUrl: string;
  circlesUrl:    string;
  sessionsUrl:   string;
  daemonUrl:      string;
  /** The PersonaGroup plane's doc URL the joinee resolves — the founder's shared doc
   *  (membership-sync) when the payload carries it, else a fresh local seed. */
  personaUrl:     string;
  /** That plane's bag id, derived from the SAME group doc id the founder used. Both devices name one
   *  plane identically or they sync nothing — the derivation is what makes that hold without a roster. */
  personaBagId:   string;
  /** The HEARTH's daemon url — where this vessel asks for its seat. Null when the payload named no door;
   *  the vessel then holds standing and can ask for nothing until an operator carries a route to it. */
  hearthDaemonUrl: string | null;
  /** The complete edge: the root's half beside the atom's countersignature. */
  deviceEdge:      DeviceDelegationTiddler;
}

const APPLY_ADMIT_CHECKPOINT_PREFIX = "lar:///ha.ka.ba/dreamnet/apply-admit-checkpoint/";
type ApplyCheckpoint = {
  /** What the admit was asked: a checkpoint answers only that same payload. */
  scope: string;
  result: Omit<ApplyAdmitResult, "archive"> & { archive: string };
  events: readonly { hash: string; variant: string; bytes: string; island?: string }[];
};

async function readApplyCheckpoint(handle: ReturnType<typeof seedDaemonDoc>, atomSeed: Uint8Array, scope: string): Promise<ApplyCheckpoint | null> {
  const record = handle.doc()?.tiddlers[`${APPLY_ADMIT_CHECKPOINT_PREFIX}${await checkpointId(atomSeed)}`];
  const body = record ? tiddlerText(record) : null;
  if (!body) return null;
  const checkpoint = await openCheckpoint<ApplyCheckpoint>(body, atomSeed);
  return checkpoint.scope === scope ? checkpoint : null;
}

/** Retire the admission write-ahead record after the node commits this face's local carriers. */
export async function retireApplyCheckpoint(handle: ReturnType<typeof seedDaemonDoc>, atomSeed: Uint8Array): Promise<void> {
  const title = `${APPLY_ADMIT_CHECKPOINT_PREFIX}${await checkpointId(atomSeed)}`;
  if (handle.doc()?.tiddlers[title]) handle.change((doc) => { delete doc.tiddlers[title]; });
}

/**
 * Apply a device-admit/v1 payload to bootstrap a second vessel.
 * Seeds social docs identically to the founding path, then writes oracle
 * tiddlers and cap events from the payload so boot Gates B and C pass.
 */
export async function runApplyAdmitPayload(
  input: ApplyAdmitInput,
): Promise<ApplyAdmitResult> {
  const { repo, vesselDisplayName, payload, atomSeed, daemonHandle } = input;
  const atom = faceAtomKeyFromSeed(atomSeed, payload.personaGroupId);
  const mount = input.mount !== false;
  const applyScope = JSON.stringify([payload.deviceEdge, payload.personaKelPrefix, payload.hearthTrueName, payload.personaGroupId, mount]);
  const checkpoint = await readApplyCheckpoint(daemonHandle, atomSeed, applyScope);

  // Fail-closed: the binding is the joinee's whole authority — a missing field MUST halt,
  // never write a half-bound daemon doc (the confused-deputy / mycelium-PCD hole). The persona-KEL PREFIX
  // is part of that authority now: the joinee's Binding Gate pins it, so a payload with no pin would admit a
  // vessel that boots with nothing to walk (a fail-closed halt) — refuse it here, precisely, instead.
  if (!payload.signerDid || !payload.deviceEdge || !payload.hearthTrueName || !payload.personaKelPrefix) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload lacks signerDid/deviceEdge/hearthTrueName/personaKelPrefix — refusing to admit.");
  }
  // The KEL chain and shared document are required for a joined face.
  if (!payload.personaKelChain || payload.personaKelChain.length === 0) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload lacks personaKelChain — refusing to admit (pre-field payload would re-found, never join).");
  }
  if (typeof payload.personaUrl !== "string" || payload.personaUrl.length === 0) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload lacks personaUrl — refusing to admit (pre-field payload would seed a fresh, unsynced persona doc).");
  }
  if (!payload.edgeFrontier || !Array.isArray(payload.edgeFrontier.records) || !Array.isArray(payload.edgeFrontier.snapshots)) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload lacks edgeFrontier; re-admit the face.");
  }
  if (!Array.isArray(payload.personaActs)) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload lacks personaActs; re-admit the face.");
  }
  if (payload.hearthDaemonUrl === undefined) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload lacks hearthDaemonUrl — refusing to admit (pre-field payload would seat door-less with no stated absence).");
  }
  const seal = payload.groupSecretSeal;
  if (!seal || seal.deviceKey !== atom.key || seal.prefix !== payload.personaKelPrefix) {
    throw new Error("[ceremony] runApplyAdmitPayload: payload carries no PersonaGroup secret sealed to this device under the pinned prefix — refusing to admit (an enrolment without its secret meets no sibling).");
  }

  // THE FOUR PLANES OF THE FACE THIS VESSEL JOINS — all named off the SAME group doc id the founder used,
  // so the two devices name one set identically or they sync nothing. the daemon bag stays sovereign-per-vessel
  // and is seeded fresh above; the face's planes are shared ground reached by one derivation.
  const planes = personaScopedBagIds(payload.personaGroupId);
  // A FACE'S CIRCLES AND IDENTITIES ARE THE FACE'S, NOT THE DEVICE'S: the founder minted them once and a signed `plane` act in
  // the bundle names each, so this device adopts those documents by url and syncs them; a bundle that names none seeds
  // this device's own (a bare probe). The boot proves the urls it mounts against the verified acts, so an act this apply
  // reads unverified moves nothing there. SESSIONS stay per vessel: a session is motion (which device wears the face now),
  // and decisions cross devices, never motion.
  const planeUrlOf = (name: string): string | undefined => {
    for (const a of payload.personaActs) {
      const b = (a as { body?: { act?: unknown; plane?: unknown; url?: unknown } } | null)?.body;
      if (b?.act === "plane" && b.plane === name && typeof b.url === "string") return b.url;
    }
    return undefined;
  };
  const sharedIdentitiesUrl = planeUrlOf("identities"), sharedCirclesUrl = planeUrlOf("circles");
  const identitiesHandle: ReturnType<typeof seedIdentitiesDoc> | null = sharedIdentitiesUrl ? null
    : checkpoint ? await repo.find(checkpoint.result.identitiesUrl as never) : seedIdentitiesDoc(repo, planes.identities);
  const circlesHandle: ReturnType<typeof seedCirclesDoc> | null = sharedCirclesUrl ? null
    : checkpoint ? await repo.find(checkpoint.result.circlesUrl as never) : seedCirclesDoc(repo, planes.circles);
  const sessionsHandle: ReturnType<typeof seedSessionsDoc> = checkpoint ? await repo.find(checkpoint.result.sessionsUrl as never) : seedSessionsDoc(repo, planes.sessions);
  // The persona doc: the joinee RECEIVES the founder's shared veiled-identity doc to SYNC it
  // (the membership-sync foundation) — REQUIRED now (guarded above), never a fresh local seed.
  const personaBagId = planes.persona;
  const personaUrl = payload.personaUrl;

  const ceremonyTiddlers = buildCeremonyTiddlers(atom.key, vesselDisplayName);
  for (const t of ceremonyTiddlers) {
    // A shared document is not held yet on a fresh device; the founder seeded it, and this device's own entry joins it on a boot that holds it.
    if (t.bag === IDENTITIES_NAMESPACE) {
      identitiesHandle?.change((doc) => {
        if (!doc.tiddlers[t.title]) {
          doc.tiddlers[t.title] = storedRecord({ tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } });
        }
      });
    } else {
      circlesHandle?.change((doc) => {
        if (!doc.tiddlers[t.title]) {
          doc.tiddlers[t.title] = storedRecord({ tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } });
        }
      });
    }
  }

  // The joinee's DYAD: its veil derives off its OWN veil root, scoped by the group it joins. No group
  // root stands on this vessel, so the slot lands binding:null — presented, not yet gathered — and
  // `fleetOfGroup` will not count it until a root signs the binding (the absence travels).
  const fullEdge = await countersignDeviceDelegation(payload.deviceEdge, atom.sign);
  const edgeVerdict = await verifyDeviceDelegation(fullEdge, payload.signerDid);
  if (!edgeVerdict.ok || fullEdge.hearthTrueName !== payload.hearthTrueName) {
    throw new Error(`[ceremony] runApplyAdmitPayload: device edge refused (${edgeVerdict.reason ?? "hearth mismatch"})`);
  }
  const joineeRef: DyadRef = { deviceDid: atom.did };
  const joineeDyad: DyadRecord = { kind: DYAD_ID_DOMAIN, dyadId: dyadId(joineeRef), ref: joineeRef, edge: fullEdge, binding: null };

  let result: ApplyAdmitResult;
  const capStore = new InMemoryEventStore();
  if (checkpoint) {
    for (const e of checkpoint.events) await capStore.put({ hash: e.hash, variant: e.variant, bytes: base64ToBytes(e.bytes), ...(e.island ? { island: e.island } : {}) });
    result = { ...checkpoint.result, archive: base64ToBytes(checkpoint.result.archive) };
  } else {
    const keyhive = new KeyhiveProvider();
    await keyhive.init({ seed: atomSeed, eventStore: capStore, ...(input.archiveBytes ? { archiveBytes: input.archiveBytes } : {}) });
    const contactCardJson = new TextDecoder().decode(await keyhive.contactCard());
    if (payload.capEvents?.length) await absorbCapEvents(keyhive, capStore, payload.capEvents.map(base64ToBytes));
    const archive = await keyhive.exportArchive();
    await keyhive.dispose();
    result = {
      contactCardJson, archive,
      identitiesUrl: sharedIdentitiesUrl ?? identitiesHandle!.url as string,
      circlesUrl: sharedCirclesUrl ?? circlesHandle!.url as string,
      sessionsUrl: sessionsHandle.url as string,
      daemonUrl: daemonHandle.url as string,
      personaUrl, personaBagId,
      hearthDaemonUrl: payload.hearthDaemonUrl,
      deviceEdge: fullEdge,
    };
    const events = (await capStore.list()).map((e) => ({ hash: e.hash, variant: e.variant, bytes: bytesToBase64(e.bytes), ...(e.island ? { island: e.island } : {}) }));
    const stored: ApplyCheckpoint = { scope: applyScope, result: { ...result, archive: bytesToBase64(archive) }, events };
    const checkpointText = await sealCheckpoint(stored, atomSeed);
    const applyCheckpointTitle = `${APPLY_ADMIT_CHECKPOINT_PREFIX}${await checkpointId(atomSeed)}`;
    daemonHandle.change((doc) => {
      const title = applyCheckpointTitle;
      doc.tiddlers[title] = storedRecord({
        tiddler: { title, text: checkpointText, kind: "apply-admit-checkpoint" },
        meta: { authority: "lares-init-admit" },
      });
    });
  }

  // Write the joinee's BINDING into its own daemon doc — the pinned signer, the hearth true-name,
  // and the root→joinee edge (mirrors the founding write). The joinee boots through its Binding
  // Gate on these alone: verifyDeviceDelegation(edge, signerDid) — no cap events, no Beelay.
  daemonHandle.change((doc) => {
    for (const act of payload.personaActs) writePersonaAct(doc, act as Parameters<typeof writePersonaAct>[1]);
    writeDyad(doc, joineeDyad);
    if (!mount) {
      writeGroupSecretSeal(doc, payload.personaGroupId, seal, "lares-init-admit");
      return;
    }
    doc.tiddlers[SIGNER_DID_TIDDLER] = storedRecord({
      tiddler: { title: SIGNER_DID_TIDDLER, text: payload.signerDid, kind: "operator-root-did" },
      meta: { authority: "lares-init-admit" },
    });
    doc.tiddlers[HEARTH_TRUE_NAME_TIDDLER] = storedRecord({
      tiddler: { title: HEARTH_TRUE_NAME_TIDDLER, text: payload.hearthTrueName, kind: "hearth-true-name" },
      meta: { authority: "lares-init-admit" },
    });
    doc.tiddlers[DEVICE_DELEGATION_SELF_TIDDLER] = storedRecord({
      tiddler: { title: DEVICE_DELEGATION_SELF_TIDDLER, ...fullEdge },
      meta: { authority: "lares-init-admit" },
    });
    writeGroupSecretSeal(doc, payload.personaGroupId, seal, "lares-init-admit");
    // The joinee's veil tag IS the carried group doc id (the split's second moment) — persisted under
    // the same tiddler the founder's minted tag rides, so ONE boot rule stands either veil.
    // The PINNED identifier — the joinee's Binding Gate walks THIS to the current head op-key (the founder's
    // persona-root, until a Reading-B rotation). The raw signer-DID above stays for provenance only.
    doc.tiddlers[PERSONA_KEL_PREFIX_TIDDLER] = storedRecord({
      tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: payload.personaKelPrefix, kind: "persona-kel-prefix" },
      meta: { authority: "lares-init-admit" },
    });
  });

  // Seed the joinee's LOCAL KEL board from the founder's chain snapshot (REQUIRED, guarded above), so the
  // joinee's very first boot walks the identifier→head mapping from its OWN replica — no wait on a federated
  // sync of the founder's board (no-global-now: a local seed, never a global lookup).
  {
    const kelBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(input.nexusPubkey), "board:persona-kel");
    kelBoard.change((draft) => {
      for (const event of payload.personaKelChain) writePersonaKelEvent(draft, event);
    });
  }

  // Carry the founder's signed fleet frontier into the joinee's local replica for offline reads.
  {
    const root = verifyingKeyFromDid(payload.signerDid as never);
    const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
    board.change((draft) => {
      for (const [cid, raises] of payload.edgeFrontier.snapshots) {
        if (frontierSnapshotCid(raises) === cid) writeFrontierSnapshot(draft, raises);
      }
      for (const raw of payload.edgeFrontier.records) {
        const record = raw as EdgeFrontier;
        if (record?.body && Array.isArray(record.signatures)) writeEdgeFrontier(draft, record);
      }
    });
  }

  // Write the face's group pin and the cabal's sentinel pin.
  if (mount) daemonHandle.change((doc) => {
    doc.tiddlers[PERSONA_GROUP_ID_TIDDLER] = storedRecord({
      tiddler: { title: PERSONA_GROUP_ID_TIDDLER, text: payload.personaGroupId, kind: "persona-group-id" },
      meta: { authority: "lares-init-admit" },
    });
    doc.tiddlers[MESH_CABAL_DOC_ID_TIDDLER] = storedRecord({
      tiddler: { title: MESH_CABAL_DOC_ID_TIDDLER, text: payload.meshCabalDocIdHex, kind: "sentinel-id" },
      meta: { authority: "lares-init-admit" },
    });
    // THE DOOR, KEPT. The payload names the hearth's own daemon doc once; a joinee spends its payload and boots
    // for years after, so the url lands on the plane the joinee always reads. Every other url here rides the
    // RESULT into one bootstrap; this one is also the only address a joinee cannot re-derive from anything it
    // holds, so it earns a tiddler beside the sentinel ids.
    if (payload.hearthDaemonUrl) {
      doc.tiddlers[HEARTH_DAEMON_URL_TIDDLER] = storedRecord({
        tiddler: { title: HEARTH_DAEMON_URL_TIDDLER, text: payload.hearthDaemonUrl, kind: "hearth-door" },
        meta: { authority: "lares-init-admit" },
      });
    }
  });

  // THE VESSEL'S OWN CARD. The admit supplies the BINDING (whose group this vessel joins); the vessel
  // supplies the SELF (who it is). A self-certifying ContactCard is the latter, and it is minted from the
  // vessel's OWN seed — never the founder's, who is not present and whose seed never crossed.
  //
  // Without it, an admitted vessel comes up bound and MUTE: its leaf identity (`leaf-identity`) presents this
  // card at a peer's gate, so a cardless vessel cannot speak at a gate at all. The founding path and this
  // path both mint one.

  // Keyhive membership cap-events (packPersonaCrossing), when the founder packed them: take them into this
  // vessel's own keyhive and write them to its daemon doc, so boot's hydrateFromEventStore replays the same
  // lattice — admitting this vessel into the PersonaGroup so it can decrypt content shared through the
  // catalog registry. Absent → the vessel joins by the Ed25519 edge alone.
  //
  // THE INGEST IS THE READING. The wire hands bare bytes, but this keyhive parses them back into events and
  // fires the handler above, which stamps the true variant and self-attributes the island — the record is
  // typed because the vessel took the events, never because the founder labelled them.
  if (payload.capEvents?.length) {
    await flushCapEvents(capStore, daemonHandle, "lares-init-admit");
  }
  return result;
}
