/**
 * boot-daemon-keyhive — the isomorphic keyhive boot+gate sequence for the daemon
 * island. ONE function, called identically on every platform's daemon worker.
 *
 * Stage 1 of the isomorphic-vessel epic moves authn/z off the host and into the
 * daemon island. This function is the heart of that move, extracted PURE (no
 * worker, no platform API) so it unit-tests in-process. The daemon island's
 * `onEa` calls it with the selected face atom (delivered via the manifest) and the daemon
 * CompositeStore (the cap-event EventStore backing); the host never boots
 * keyhive at all (keyhive cannot double-boot — `generateDocument` mints a fresh
 * CSPRNG doc-id each call, so two instances diverge).
 *
 * Founding never happens here: a new operator's first boot founds on the host
 * (`runFoundingCeremony` via the platform `loadBootstrap`) BEFORE the daemon
 * worker spawns. This function always receives an already-founded operator and
 * GATES — identical whether the operator is new (just founded this boot) or
 * returning.
 *
 */

import { KeyhiveProvider } from "./keyhive-provider.js";
import { registerBagsDurably, type BagDocLedger } from "./bag-doc-ledger.js";
import type { CapabilityProviderInitOpts, ProviderChunkRest } from "./capability-provider.js";
import { checkFacePins, leaseEpochUnderAnchor, verifyEdgeAgainstPersonaKel, verifyEd25519, deviceAtomProofBytes, type FaceAnchor, type DeviceDelegationTiddler, type EdgeStanding, type PersonaKelEvent } from "@lararium/mesh";

export interface BootDaemonKeyhiveInput {
  /** The selected face's 32-byte atom seed. */
  readonly atomSeed?: Uint8Array;
  /** Cap-event store — DaemonEventStore over the daemon CompositeStore in-island. */
  readonly eventStore: CapabilityProviderInitOpts["eventStore"];
  /** The mounted face atom that Gate A and the device edge must name. */
  readonly faceVerifyingKey?: string;
  /** Public place key, used only to reject an old place-signed face edge. */
  readonly placeVerifyingKey?: string;
  /** The face's PersonaGroup id (a Keyhive group's), the affiliation layer's membership subject. ABSENT names a
   *  vessel at the WAKING FLOOR — see `face` below. */
  readonly personaGroupId?: string;
  readonly faceAnchor?: FaceAnchor | null;
  /** MeshCabal sentinel Document id hex — the affiliation layer's membership target, face-side. */
  readonly meshCabalDocIdHex?: string;
  /** Writable bag URIs to register so `verify`/`delegate` resolve (lar: URIs). */
  readonly registerBags: readonly string[];
  readonly ledger?: BagDocLedger;
  /** The PINNED signer DID — provenance ONLY (the founding op-key = the KEL inception op-key). The Binding
   *  Gate does NOT pin this; it pins `personaKel.prefix` and walks the KEL to the current head (no hybrid —
   *  accepting both a raw op-key pin AND the prefix would open a downgrade). */
  readonly signerDid?: string;
  /** The persona-KEL PIN + the LOCAL-replica chain the gate walks (identity-classes#the-continuity-anchor).
   *  `prefix` is the stable identifier (AID) read from the daemon bag (the pin's root of trust); `chain` is the
   *  seq-sorted key-event-log the caller read from its per-Nexus KEL board replica "as of last sync". The gate
   *  asserts `chain[0].prefix === prefix`, walks to the current authoritative head op-key (structural + every
   *  rotation quorum verified), and verifies the edge against THAT head — a rotated key still binds a fresh
   *  edge; a superseded key rejects. FAIL-CLOSED: an absent / broken / unreachable-head chain HALTS the boot
   *  (never a global lookup — a not-yet-synced replica simply denies). */
  readonly personaKel?: { readonly prefix: string; readonly chain: readonly PersonaKelEvent[] };
  /** This vessel's signed device-delegation edge (root→vessel) — the public, Beelay-free binding. */
  readonly deviceEdge?: DeviceDelegationTiddler;
  /** The PersonaGroup's CURRENT lease epoch, read by the caller off the live daemon replica
   *  (`leaseEpochPrefix`/`signedLeaseEpoch` — the same fold `gateFaceJoin` runs). The Binding Gate
   *  enforces the lease: `deviceEdge.boundEpoch` below this epoch HALTS the boot (the device's own edge has
   *  rolled stale — re-admit via a fresh face-join). A persona-bound boot without this frontier refuses; it
   *  cannot substitute a wall-clock window for causal authority. */
  readonly expectedEpoch?: number;
  /**
   * THE DYAD'S READING for THIS vessel's own device edge, off the fleet's edge board as the vessel itself folds
   * it (kapae#/reach). `aside` HALTS a persona-bound boot: the fleet root set this device aside, so its
   * delegation binds nothing, whatever the edge proves. `returned` and `clear` bind. The daemon behavior asks its
   * vessel for this reading before every persona-bound boot and refuses the boot when it holds no door to ask
   * through (`requireDyadReader`); a composed reader answers `aside` until its first fold lands. Absent here
   * means a caller of this function alone handed none.
   */
  readonly dyad?: EdgeStanding;
  /** OPTIONAL prior-identity Archive (a previous `exportArchive()`), persisted encrypted-at-rest. A joinee
   *  admitted into a PersonaGroup restores from it so its prekeys match the card the founder minted-to —
   *  without it, a fresh boot regenerates prekeys and the shared content reads "Key not found". */
  readonly veilArchiveBytes?: Uint8Array;
  /** Durable rest for the Keyhive chunks this identity tracks per bag (`KeyhiveProvider` `chunkRest`). Absent:
   *  they rest in memory alone, and a restart finds none. */
  readonly chunkRest?: ProviderChunkRest;
}

export interface BootDaemonKeyhiveResult {
  /** The booted provider — serves as the island VerbDispatcher verifier and the
   *  answerer for host→island verify-proxy queries. */
  readonly keyhive: KeyhiveProvider;
  /** The operator DID (keyhive whoami) this boot resolved to. */
  readonly did: string;
  /** What the Binding Gate's fold set aside — persona-KEL events that do not verify and so move nothing — or null
   *  when every event it met verified. The boot also says it on the log. */
  readonly unreadable: string | null;
}

export class FacelessKeyhiveRefused extends Error {
  constructor() {
    super("[daemon-keyhive] waking-floor: lightAFace before asking for a Keyhive identity");
    this.name = "FacelessKeyhiveRefused";
  }
}

export class LegacyFaceSignatureRefused extends Error {
  constructor() {
    super("[daemon-keyhive] face relation carries a retired place-key signature; re-found this vessel from a fresh store");
    this.name = "LegacyFaceSignatureRefused";
  }
}

/**
 * Boot keyhive from the selected face atom, re-hydrate cap state from the daemon doc,
 * clear the three sovereignty gates, and register the operator's writable bags.
 *
 * Throws (HALT) on any gate failure — the daemon island must post `fault` so the
 * vessel never declares itself live with a diverged or unauthorized identity.
 */
export async function bootDaemonKeyhive(input: BootDaemonKeyhiveInput): Promise<BootDaemonKeyhiveResult> {
  const facePins = [input.personaGroupId, input.signerDid, input.personaKel, input.deviceEdge];
  const facesHeld = facePins.filter((p) => p !== undefined).length;
  if (facesHeld === 0 && !input.atomSeed && !input.faceVerifyingKey) throw new FacelessKeyhiveRefused();
  if (facesHeld > 0 && !input.faceAnchor) {
    throw new Error("[daemon-keyhive] Face anchor: anchor-missing; re-found the face");
  }
  if (facesHeld !== facePins.length || !input.atomSeed || !input.faceVerifyingKey) {
    throw new Error("[daemon-keyhive] the face this vessel pins reads TORN — re-found the face");
  }
  const keyhive = new KeyhiveProvider();
  await keyhive.init({
    seed: input.atomSeed, eventStore: input.eventStore,
    ...(input.veilArchiveBytes ? { archiveBytes: input.veilArchiveBytes } : {}),
    ...(input.chunkRest ? { chunkRest: input.chunkRest } : {}),
  });

  try {
  // Re-ingest cap events the founding ceremony (or a prior boot) persisted to
  // the daemon doc — reconstructs the PersonaGroup / MeshCabal sentinels + edges.
  await keyhive.hydrateFromEventStore();

  const did = await keyhive.whoami();

  // ── DOES A FACE STAND HERE? ────────────────────────────────────────────────────────────────
  // A place founded without a face carries no Keyhive Individual. This direct boot call refuses by name;
  // the daemon behavior supplies a floor verifier for public reads without calling this function.
  //
  // THE GATE NEVER SOFTENS. It runs in FULL or the vessel carries no persona caps — absence of a face is
  // not a weaker check, it is FEWER CAPS. That is what keeps the confused-deputy / PCD cure intact: you
  // cannot skip the Binding Gate by deleting the edge, because deleting the edge deletes the authority
  // the gate would have granted. A HALF face refuses outright — a vessel holding some pins and not others
  // has a torn founding, and guessing which half to trust is exactly the deputy confusion.
  // Gate A binds the provider to the selected atom, never the public place key.
  if (!did.toLowerCase().endsWith(input.faceVerifyingKey.toLowerCase())) {
    throw new Error(
      `[daemon-keyhive] Gate A: identity drift — whoami=${did.slice(0, 18)}… ` +
      `does not match atom=${input.faceVerifyingKey.slice(0, 16)}…`,
    );
  }
  if (input.placeVerifyingKey && input.deviceEdge &&
      verifyEd25519(input.deviceEdge.atomSignature, deviceAtomProofBytes(input.deviceEdge), input.placeVerifyingKey)) {
    throw new LegacyFaceSignatureRefused();
  }

  // THE BINDING GATE — the canon identity path, now on the PERSONA-KEL PIN (the continuity anchor). The
  // vessel's signed device-delegation edge verifies against the CURRENT head op-key the pinned identifier
  // (`personaKel.prefix`) resolves to on the local KEL replica — the op-key rotates BENEATH a fixed prefix
  // (Reading-B recovery), so continuity rides the log, never a frozen key. The edge IS the binding: a
  // self-contained signed (vessel × hearthTrueName) proof over public CRDT state — no Beelay, no
  // encrypted-graph walk. FAIL-CLOSED and HALT on: a chain whose genesis prefix mismatches the pin (a
  // mis-threaded log), an unreachable / broken / below-quorum head, or an edge that does not chain to the head.
  let unreadable: string | null = null;
  {
  const { prefix, chain } = input.personaKel!;
  if (chain.length === 0 || chain[0]!.prefix !== prefix) {
    throw new Error(`[daemon-keyhive] Binding Gate: persona-KEL pin/chain mismatch — the local chain does not head the pinned identifier ${prefix.slice(0, 20)}…`);
  }
  if (input.expectedEpoch === undefined) {
    throw new Error("[daemon-keyhive] Binding Gate: current lease frontier unavailable — refusing persona-bound boot");
  }
  const anchorEpoch = leaseEpochUnderAnchor(input.faceAnchor!, input.expectedEpoch);
  const binding = await verifyEdgeAgainstPersonaKel(input.deviceEdge!, chain, { expectedEpoch: anchorEpoch.epoch });
  // Events that do not verify move nothing at the gate; the boot says so rather than set them aside in silence.
  if (binding.unreadable) {
    unreadable = binding.unreadable;
    console.warn(`[daemon-keyhive] Binding Gate: ${binding.unreadable}`);
  }
  if (!binding.ok) {
    throw new Error(`[daemon-keyhive] Binding Gate: device-delegation edge failed verification against the persona-KEL head op-key. ${binding.reason ?? ""}`);
  }
  // THE DYAD'S SHADOW (kapae#/reach): no seat, no bind. The operator's own door names the reading.
  if (input.dyad === "unknown") throw new Error("[daemon-keyhive] Binding Gate: no qualifying signed edge frontier — refusing persona-bound boot");
  if (input.dyad === "aside") {
    throw new Error(
      "[daemon-keyhive] Binding Gate: this device stands SET ASIDE from its fleet — a shadow stands over its own device edge, " +
      "so its delegation binds nothing. The fleet root lifts it (`lares edge un-kapae --device <key>`), and the device then takes a fresh seat.",
    );
  }
  // Bind-check: the edge MUST delegate to THIS vessel's key (designation carries authority —
  // a valid edge for a DIFFERENT vessel is not authority for this one).
  if (input.deviceEdge!.deviceVerifyingKey !== input.faceVerifyingKey) {
    throw new Error(
      `[daemon-keyhive] Binding Gate: edge delegates to ${input.deviceEdge!.deviceVerifyingKey.slice(0, 16)}…, ` +
      `not this face ${(input.faceVerifyingKey ?? "absent").slice(0, 16)}…`,
    );
  }
  // THE SEALED ANCHOR decides which face this is. The gate above proved the pins cohere; the anchor, written only by
  // founding, admission and recovery, proves they are THIS device's face. A coherent bundle of another face's pins
  // passes the chain's own checks and stops here, by name.
  const pins = checkFacePins(input.faceAnchor!, {
    personaGroup: input.personaGroupId,
    personaKelPrefix: input.personaKel?.prefix,
    personaRootDid: input.deviceEdge?.personaRootDid,
    edge: input.deviceEdge,
  });
  if (!pins.ok) throw new Error(`[daemon-keyhive] Face anchor: ${pins.refusal}; re-found the face`);
  }

  // Cabal/Nexus membership (the former "Gate C") has LEFT the boot path — it is AFFILIATION,
  // not identity (see api/pono/identity-vs-affiliation). A PersonaGroup
  // belongs to MANY cabals/nexuses or none (M:N), so membership is a HELD CAPABILITY checked at
  // ACCESS to a cabal's shared canon, local-first — never a single boot gate (a boot gate
  // conflated ID-with-authz, assumed single-membership, and read a global "now"). Boot proves
  // IDENTITY ONLY: Gate A (key self-consistency) + the Binding Gate (the signed delegation edge).
  // `personaGroupId` / `meshCabalDocIdHex` stay on the input for the founding sentinel
  // dance + the affiliation layer; boot itself proves identity only and does not read them.

  // Register the operator's writable bags so cap checks resolve against lar: URIs.
  if (input.ledger) await registerBagsDurably({ provider: keyhive, bags: input.registerBags, ledger: input.ledger });
  else for (const bagUrl of input.registerBags) await keyhive.registerBag(bagUrl);

  return { keyhive, did, unreadable };
  } catch (error) {
    try { await keyhive.dispose(); } catch (disposeError) { console.warn(`[daemon-keyhive] disposal failed: ${String(disposeError)}`); }
    throw error;
  }
}
