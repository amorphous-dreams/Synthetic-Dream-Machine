/**
 * operator-daemon-behavior — the keyhive-wired daemon island behavior, shared.
 *
 * The node and browser daemon entry points were byte-identical except for which
 * platform run-function they called. The keyhive wiring — boot keyhive in-worker
 * from `manifest.daemonAuth`, then supply makeDaemonBehavior's three callbacks
 * (verifierFactory, verifyPeer, resolveBinding) — lives here ONCE. Each entry
 * now only picks its platform kernel and passes this factory.
 *
 * Home: keyhive (it owns the keyhive wiring) composes tw5's keyhive-free
 * makeDaemonBehavior. tw5 stays keyhive-free; keyhive → tw5 is acyclic.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/operator-daemon-behavior
 */

import {
  makeDaemonBehavior, makeWhereReactor, makeResolveReactor, makeListWikisReactor,
  makePinReactor, makeUnpinReactor, makeRegisterColdReactor, registerActionReactors, makeTw5Deserializer,
  makeWikiPinReactor, makeWikiUnpinReactor,
  makeCatalogAccessor, findOrThrow,
  makeInitWikiReactor, makeOpenWikiReactor, makeDraftReactor, makePruneStaleReactor,
  makeMemePutReactor, makeMemeGetReactor, makeMemeListReactor, makeMemeDeleteReactor, makeMemeProjectReactor, memeVerbOptions, VERB_SURFACE,
  makeWardAlertReactor, fileWardRefusal,
  makeAddBagReactor, makeRemoveBagReactor, makeCompactBagReactor, makeRotateRecipeReactor,
  makeSwitcherStateReactor,
  makePersonaStateReactor,
  makeCircleStateReactor,
  makeCircleReactors,
  makeCabalRealmReactors,
} from "@lararium/tw5";
import { ACTION_VERBS, DOCUMENT_HANG_BOUND_MS, VerbRefusal, DAEMON_BAG_ID, AutomergeDocStore, personaBagIdFor, personaSiblingBagIds, didFromVerifyingKey, computeRecipeFingerprint, wikiBagUri, wikiSlotUri, mutableLarRecord, type ChangeOrigin } from "@lararium/mesh";
import type { IslandBehavior, IslandContext, DaemonBehaviorOptions, VerbReactor } from "@lararium/tw5";
import type { IslandMsg_Manifest, AuthProofWire, DeviceDelegationTiddler } from "@lararium/mesh";

/** Vessel-injected daemon shore the platform entry supplies (node folds the telemetry capture SINK here; a
 *  browser/node entry folds the projection `onBoot` mount so the daemon inherits the wiki render cap).
 *  Forwarded straight to makeDaemonBehavior — the daemon always carries the caps; this makes them live.
 *  Absent → the cap stays inert (sink not wired / no projection mount).
 *
 *  `persistArchive` — the Boundary-1 inversion: keyhive stays fs-blind, so NODE injects the writer that
 *  lands `keyhive.exportArchive()` bytes in the sovereign identity home. Consumed HERE (never forwarded to
 *  makeDaemonBehavior). Absent (a browser vessel with no fs) → the archive floor simply never persists. */
type DaemonExtra = Pick<DaemonBehaviorOptions, "makeCaptureEngine" | "captureTickMs" | "onBoot" | "runnableHulls"> & {
  persistArchive?: (bytes: Uint8Array) => void | Promise<void>;
  /** The veil identity's archive persistence — the same inversion, its own file. Absent → the veil's
   *  prekeys regenerate per boot, and material keyed to an earlier card stops opening. */
  persistVeilArchive?: (bytes: Uint8Array) => void | Promise<void>;
  /** `vault` — the SAME Boundary-1 inversion for the at-rest seal LIFECYCLE (#60): keyhive stays
   *  fs-blind, so NODE injects the handler that seals/rotates/exports the identity-home carriers and
   *  updates the worker's own in-memory seal policy (no un-rotate). Registered as the `vault-*` worker
   *  verbs below. Absent (a browser vessel with no fs) → the vault verbs simply never register. The
   *  passphrase rides the verb args over the owner-only 0600 UDS — the same trust boundary as a CLI arg. */
  vault?: (verb: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** `restDocuments` — the rest door. This island's Repo may keep no store for a slot document it mints; the
   *  host injects the ask that resolves once the vessel's own store holds the named documents durably. Present →
   *  every slot mint waits on it before its binding lands. Absent → the island's own Repo flush stands alone. */
  restDocuments?: (documentIds: readonly string[]) => Promise<void>;
  /** `bagTier` — the SAME inversion for the crossing gate's tier reader: keyhive stays fs-blind, so
   *  NODE injects the reader over its hearth bag manifests. Threaded into the ACTION verb handlers,
   *  where `crossingDirection` prices a transfer by direction. Absent (a browser vessel, tests) →
   *  the gate fail-closes every bag to VEIL and prices every transfer lateral, as before. */
  bagTier?: (bagUrl: string) => import("@lararium/mesh").CapTier | null;
  /** `dyadReading` — the SAME inversion for the dyad's shadow (kapae#/reach): the vessel folds its fleet's edge
   *  board, and this island asks it what one device's edge reads before it binds or seats that device. The
   *  reader answers `aside` until its first fold lands. Absent → the Binding Gate refuses a persona-bound boot
   *  and the join gate refuses a summons, each by name (`requireDyadReader`): a gate that could ask nobody
   *  binds and seats nobody. A faceless island asks nothing and stands without one. */
  dyadReading?: DyadReader;
  /** `sealedStore` — the SAME inversion for the sealed store (lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store):
   *  keyhive stays fs-blind, so the shore injects the rest for lockboxes, records and index rows, the sealed
   *  values' own rest, and the cleartext-local tier a staged body reads from and an opened one lands in. Present →
   *  the content-key holder stands beside this island's Keyhive identities and its roll subscribes to this
   *  island's seat rolls. Absent → no holder stands, and the `sealed-*` verbs refuse by name. */
  sealedStore?: SealedStoreShore;
  /** `sessionProof` — the signer of the session whose act asks, and this vessel's own reading of who may write a
   *  bag (the face proof's chain check). Absent → no session open stands composed: every mint refuses
   *  `signer-unavailable`, and the holder counts no record. No vessel key and no daemon key signs in its place. */
  sessionProof?: SessionProof;
  /** `countedRaises` — the raises the vessel's own ledger counts on one fleet's board, asked of the vessel's own
   *  fold. Absent → a raise counts where this island's own count answered it (each roll its seat took, each
   *  kept roll handed back under the vessel's receipt). */
  countedRaises?: (fleetRootDid: string) => ReadonlySet<string> | Promise<ReadonlySet<string>>;
};

/** What a shore injects so the content-key holder can stand in the daemon island. */
export interface SealedStoreShore {
  /** Durable rest for lockboxes, signed records and index rows. It holds no secret. */
  readonly rest:   SealedStoreRest;
  /** The sealed values' own rest: bytes by address (the `cad/` tier). */
  readonly values: ContentKeyHolderPorts["values"];
  /** The cleartext-local tier: a staged body by its plaintext address, and the landing of a body this vessel
   *  opened. It answers the plaintext's own address. */
  readonly staged: { read(cid: string): Uint8Array | null | Promise<Uint8Array | null>; write(plaintext: Uint8Array): string | Promise<string> };
  /** Durable rest for the Keyhive chunks each identity tracks per bag: ciphertext under opaque shelf names. */
  readonly chunks?: ProviderChunkRest;
}

/** No holder stands in this island: the shore injected no sealed store, or no Keyhive stands yet. */
export class SealedStoreUnavailable extends Error {
  override readonly name = "SealedStoreUnavailable";
  constructor(verb: string) {
    super(`[daemon] ${verb}: no content-key holder stands in this island — the shore injected no sealed store, or this vessel rests at the floor; unlock it with \`lares vault unlock\` (nothing sealed, nothing opened).`);
  }
}

/** The island's ask for one device's standing in one fleet, answered by the vessel's own fold of that fleet's board. */
export type DyadReader = (fleetRootDid: string, deviceVerifyingKey: string) => import("@lararium/mesh").EdgeStanding | Promise<import("@lararium/mesh").EdgeStanding>;

/**
 * The dyad's reader a gate asks through, or a refusal by name. A gate that binds or seats a device reads that
 * device's standing first; with no reader composed it cannot read one, and it never reads the absence as `clear`.
 */
export function requireDyadReader(reader: DyadReader | undefined, gate: "the Binding Gate" | "the join gate" | "the content-key seat"): DyadReader {
  if (!reader) {
    throw new Error(
      `[daemon] DyadReaderAbsent: ${gate} reads a device's standing off the vessel's own fold of its fleet board, and this island ` +
      "holds no door to ask through — it binds and seats nobody.",
    );
  }
  return reader;
}
import { verifyAuthProof, verifyEdgeAgainstPersonaKel } from "@lararium/mesh";
import { bootDaemonKeyhive } from "./boot-daemon-keyhive.js";
import { persistArchiveFloor } from "./archive-floor-write.js";
import { hexToBytes as meshHexToBytes } from "@lararium/mesh";
import { DaemonEventStore, absorbCapEvents } from "./daemon-event-store.js";
import { readLeaseFrontier, daemonLayerOf, type LeaseFrontier } from "./lease-frontier.js";
import { makeSlotDocResolver, type SlotDocResolver } from "./slot-doc-resolver.js";
import { runFaceJoin, type FaceJoinSummons } from "./face-join.js";
import { answerFleetSeatDuties, type FleetSeatFacts } from "./fleet-seat-duties.js";
import { announceSeatRoll } from "./seat-duty-executor.js";
import { faceGrantTitle, faceGrantRecordCid, FACE_GRANT_PREFIX, signFaceGrantRecord, verifyFaceGrantRecord, type FaceGrantRecord } from "./face-grant-record.js";
import { base64ToBytes, bytesToBase64 } from "./bytes-base64.js";
import { ed25519SignerFromSeed, memoryAskRefusal, mintMemoryKeypair, openMemorySecret, seatDutiesAskRefusal, hex as memoryHex, type LarTiddlerRecord, type MemoryAct, type MemoryKeypair } from "@lararium/mesh";
import { KeyhiveProvider } from "./keyhive-provider.js";
import type { ProviderChunkRest } from "./capability-provider.js";
import { seatContentKeys, type ContentKeySeat, type SessionProof } from "./content-key-seat.js";
import { SealedStore, readKeyParcel, readCarriedRecord, encodeKeyParcel, readKeyVersionId, utf8Bytes, type ContentKeyHolderPorts, type KeyParcel, type SealedRecord, type SealedStoreRest } from "@lararium/mesh";
import { unboundMints, restingMinter } from "./resolve-binding.js";

/** A daemon boot cannot stand without the daemon wiki's working layer. */
export class WorkingLayerAttachRefusal extends Error {
  constructor(slot: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`[daemon] WorkingLayerAttachRefusal: working layer "${slot}" could not attach (${detail}); start the vessel again from a fresh store (delete its store directory by hand), which re-seeds every document from the bags.`);
    this.name = "WorkingLayerAttachRefusal";
  }
}

/**
 * Build the operator's daemon-island behavior from a manifest. Peer V3 admits
 * verify against persisted cap-events, and daemon boot requires Keyhive material
 * for its working-layer binding. Product manifests carry daemonAuth.
 */
/**
 * The note a live admission verdict carries when the persona-KEL walk set events aside or met a fork: events that
 * do not verify move nothing, and the verdict's provenance says so rather than drop them in silence. Empty when the
 * walk read every event it met.
 */
export function kelWalkNote(walk: { readonly unreadable?: string; readonly fork?: string }): string {
  return walk.unreadable ? ` — the persona-KEL walk set aside: ${walk.unreadable}` : "";
}

// A FACELESS FLOOR NAMES THE LIFT — the one refusal every face-scoped verb hands back.
//
// The floor is a state a vessel LIFTS out of, so a refusal there carries the act that lifts it
// (the law `holdings-witness` keeps for its own corrections: a refusal says what would change the
// answer). The closure reaches for no face, so standing it costs the boot nothing.
// The refusal is the house's named `VerbRefusal` (reason `waking-floor`), so a caller routes on the
// reason and never on the prose.
const lightAFace = (verb: string): VerbReactor => async () => {
  throw new VerbRefusal("waking-floor",
    `[daemon] ${verb}: this vessel stands at the WAKING FLOOR and holds no face — ` +
    "light one with `lares persona new 0 --name '<label>'`, then stand the vessel again.",
  );
};

export function operatorDaemonOptions(manifest: IslandMsg_Manifest, extra: DaemonExtra = {}): DaemonBehaviorOptions {
  // persistArchive + vault ride node-only; keep them OUT of the makeDaemonBehavior spread (not DaemonBehaviorOptions).
  const { persistArchive, persistVeilArchive, vault, bagTier, restDocuments, dyadReading, sealedStore, sessionProof, countedRaises, ...daemonExtra } = extra;
  const daemonAuth = manifest.daemonAuth;
  if (!daemonAuth) {
    return {
      ...daemonExtra,
      verifierFactory: async () => {
        throw new WorkingLayerAttachRefusal(wikiSlotUri("daemon", "working"), new Error("daemon auth and Keyhive are unavailable"));
      },
    };
  }

  let kh: KeyhiveProvider | null = null;
  // The VEIL identity — the group's creator, re-derived from (vessel seed × persisted tag). Stands
  // beside the vessel identity at boot; sentinel ops (the face-join seat) run through it, while bag
  // delegation and transport stay the vessel's. Absent tag → a pre-veil-born doc; joins refuse there.
  let veilKh: KeyhiveProvider | null = null;
  // THE CONTENT-KEY HOLDER, seated beside the two identities once both stand (sealed-store#/the-store). Bare
  // content keys live in it, in this island's memory alone: no verb answers one, and none crosses the port.
  let contentKeys: ContentKeySeat | null = null;
  // ONE ROAD for every vessel-bag→face delegation: the vessel delegates the bag to the VEIL (one
  // per-group edge, non-correlating), the veil ingests the chain, adopts the mapping, and seats the
  // bag under the face — the vessel never learns the group agent (the byte-law).
  const delegateToFaceViaVeil = async (bagUrl: string, access: "read" | "admin"): Promise<void> => {
    if (!kh) throw new Error("delegate: keyhive unbooted");
    if (!veilKh) throw new Error("delegate: no veil identity stands — this doc predates the veil-born founding; re-found the face.");
    try { await veilKh.receiveContactCard(await kh.contactCard()); } catch { /* known */ }
    try { await kh.receiveContactCard(await veilKh.contactCard()); } catch { /* known */ }
    const veilId = await veilKh.vesselIdentifierHex();
    await kh.delegate({ bagUrl, audience: veilId, access: "admin" });
    await veilKh.ingestPeerEvents(await kh.eventsForPeer(veilId));
    const { docId } = await kh.registerBag(bagUrl);   // idempotent — the cached mapping
    veilKh.adoptBag(bagUrl, docId);
    await veilKh.delegate({ bagUrl, audience: faceAgent(), access });
  };
  let mintedByHex = daemonAuth.vesselVerifyingKey;
  // Captured at `verifierFactory` boot time (the only site this behavior sees an `IslandContext`) so the
  // lease read below stays reachable from doors that boot supplies no ctx to (`verifyPeer`). Only the island's
  // COMPOSITE is cached — never a snapshot of the epoch itself — so every read below is FRESH as of the moment
  // it runs, never a stale boot-time number (a roll after boot must still bite immediately).
  let epochCtx: { composite: IslandContext["composite"] } | null = null;

  // THE ONE SLOT-DOC RESOLVER — every site that names a wiki's draft/working/personal doc reads
  // through it (the island's slot grants, the host mount by proxy, wiki init, prune-stale,
  // `meme put --recipe`, the daemon's own working layer). Built once the keyhive stands, over the
  // live context; the face-seat read rides the veil's own registry (a pin is standing, a seat is
  // capability), so a binding never delegates to an agent the veil cannot name.
  // The grant records this vessel already judged, by signature — a refused record is judged ONCE per boot
  // (the refusal logs once), a taken one never re-ingests.
  const judgedGrants = new Set<string>();
  /**
   * The joinee's half of THE LATER GRANT. Reads the PersonaGroup plane (the doc both vessels sync by membership)
   * for a `face-join-grant/v1` record naming THIS vessel; verifies it against the persona root pinned at admit
   * and the founder's edge under that root; on a verdict, ingests the cap events into BOTH identities and
   * persists them as cap-event records so the next boot re-hydrates the seat. Returns whether the face now
   * reads seated. Any failure → false, a logged refusal, and NO binding moved.
   */
  const takeFaceGrantIfPublished = async (ctx: IslandContext): Promise<boolean> => {
    const agent = daemonAuth.personaGroupAgentIdHex;
    const group = daemonAuth.personaGroupDocIdHex;
    const ownEdge = daemonAuth.deviceEdge;
    if (!agent || !group || !ownEdge || !kh || !ctx.catalogUrl) return false;
    // NO CLOCK. Absent a founder persona-KEL chain to walk, ABSTAIN rather than fall back to a
    // pinned-root-only verify gated on a wall clock — fail-closed, event order or nothing (no global now).
    if (!daemonAuth.personaKel) return false;
    let store: Awaited<ReturnType<ReturnType<typeof makeCatalogAccessor>["storeOf"]>>;
    try { store = await makeCatalogAccessor(ctx.repo, ctx.catalogUrl).storeOf(personaBagIdFor(group)); } catch { return false; }
    if (!store) return false;
    const prefix = `${FACE_GRANT_PREFIX}${group}/`;
    const self = daemonAuth.vesselVerifyingKey.toLowerCase();
    let titles: string[];
    try { titles = (await store.listVisible()).filter((t) => t.startsWith(prefix) && t.toLowerCase().endsWith(self)); } catch { return false; }
    for (const title of titles) {
      const record = await store.get(title);
      const text = (record as { tiddler?: { text?: unknown } } | null)?.tiddler?.text;
      if (typeof text !== "string") continue;
      let rec: FaceGrantRecord;
      try { rec = JSON.parse(text) as FaceGrantRecord; } catch { continue; }
      // The founder's own edge leases too — read the SAME epoch the founder's door checks it against
      // (readLeaseEpoch, shared). An unavailable frontier is a pending mutation, never a reason to
      // let the signature and soft wall-clock window license the ingest. Keep the record unjudged so
      // a later live attempt can retry after the causal shore returns.
      const lease = await readLeaseEpoch(ctx.composite);
      if (typeof rec?.sig !== "string" || judgedGrants.has(rec.sig)) continue;
      if (lease.kind === "unavailable") {
        console.log(`[daemon] face-join grant pending (${title.slice(-16)}): current lease frontier unavailable (${lease.why}) — no binding moves`);
        continue;
      }
      const expectedEpoch = lease.n;
      judgedGrants.add(rec.sig);
      const verdict = await verifyFaceGrantRecord(rec, {
        personaRootDid: ownEdge.personaRootDid, selfVerifyingKey: self, groupDocIdHex: group,
        personaKel: daemonAuth.personaKel,   // the edge verifies under the KEL HEAD, never a frozen root — no clock
        expectedEpoch,
      });
      if (!verdict.ok) {
        console.log(`[daemon] face-join grant record REFUSED (${title.slice(-16)}): ${verdict.reason} — no binding moves`);
        continue;
      }
      // THE KIT'S OWN ACT: take the cap events (live) and persist them (boot re-hydrates the seat).
      // Ingest is also the READING — the vessel's own handler stamps the true variant and island on the
      // events keyhive accepts, so it must reach the store before any backstop row masks them.
      const events = rec.capEvents.map(base64ToBytes);
      const eventStore = new DaemonEventStore({ daemon: ctx.composite });
      try { await absorbCapEvents(kh, eventStore, events); } catch (err) { console.log(`[daemon] face-join grant: vessel ingest faulted: ${(err as Error)?.message ?? err}`); }
      try { await veilKh?.ingestPeerEvents(events); } catch (err) { console.log(`[daemon] face-join grant: veil ingest faulted: ${(err as Error)?.message ?? err}`); }
      const seated = await (veilKh ?? kh).knowsAgent(agent);
      console.log(`[daemon] face-join grant record taken from the PersonaGroup plane (${events.length} cap events, regranted ${rec.regranted}) — face ${seated ? "SEATED" : "still unseated after ingest"}`);
      if (seated) return true;
    }
    return false;
  };

  let slotDocs: SlotDocResolver | null = null;
  const slotDocsOf = (ctx: IslandContext): SlotDocResolver => {
    if (slotDocs) return slotDocs;
    if (!kh) throw new Error("keyhive not booted");
    slotDocs = makeSlotDocResolver({
      repo: restDocuments ? restingMinter(ctx.repo, restDocuments) : ctx.repo, daemonStore: ctx.composite, keyhive: kh,
      catalog: ctx.catalogUrl ? makeCatalogAccessor(ctx.repo, ctx.catalogUrl) : null,
      oracle:  ctx.oracleUrl  ? makeCatalogAccessor(ctx.repo, ctx.oracleUrl)  : null,
      vesselDid: () => didFromVerifyingKey(daemonAuth.vesselVerifyingKey),
      mintedByHex: () => mintedByHex,
      ...(daemonAuth.personaGroupAgentIdHex ? { personaGroupAgentIdHex: daemonAuth.personaGroupAgentIdHex } : {}),
      ...(veilKh ? { delegateToFace: (bagUrl: string, access: "read" | "admin") => delegateToFaceViaVeil(bagUrl, access) } : {}),
      faceSeated: async () => {
        const agent = daemonAuth.personaGroupAgentIdHex;
        if (!agent) return false;
        let seated = await (veilKh ?? kh!).knowsAgent(agent);
        // THE LATER GRANT (basket-one #/the-later-grant): not seated → read the PersonaGroup plane for a grant
        // record naming this vessel, verify it OFFLINE against the published seal, and take the seat by this
        // kit's own act. Reading alone re-cuts nothing — a record that fails stays a record.
        if (!seated) seated = await takeFaceGrantIfPublished(ctx);
        if (!seated) console.log(`[daemon] face ${agent.slice(0, 16)}… pinned, not yet seated — bindings mint vessel-only until a face-join lands`);
        return seated;
      },
    });
    return slotDocs;
  };

  // Every write made by the daemon wiki, including its receipts and audit records, lands in its working
  // layer. The daemon bag beneath holds only records the daemon wiki names explicitly.
  const attachDaemonWorking = async (ctx: IslandContext): Promise<void> => {
    const slug = ctx.recipe.wikiSlug;
    const working = wikiSlotUri(slug, "working");
    try {
      if (ctx.composite.hasBag(working)) {
        if (ctx.composite.defaultWritableBagId() !== working) throw new Error("the working layer is not the default writable");
        return;
      }
      const daemonUrl = ctx.handles.get(wikiBagUri(slug))?.url;
      if (!daemonUrl) throw new Error(`daemon bag ${wikiBagUri(slug)} is unavailable`);
      if (!kh) throw new Error("Keyhive is unavailable in the daemon boot");
      const recipeTrace = { wikiDocId: daemonUrl, libraryBagDocIds: [] as readonly string[] };
      const fingerprint = await computeRecipeFingerprint(recipeTrace);
      const { workingUrl } = await slotDocsOf(ctx).bindings(fingerprint, recipeTrace, slug);
      const handle = await findOrThrow(ctx.repo, workingUrl, `${working} (the daemon's working layer)`, { timeoutMs: DOCUMENT_HANG_BOUND_MS });
      const store = new AutomergeDocStore(handle, working);
      const at = ctx.composite.layerIndexOf(wikiBagUri(slug)) + 1;
      ctx.composite.addLayer({ bagId: working, store, writable: true, defaultWritable: true }, at);
      ctx.handles.set(working, handle);
      store.emitInitialReplay();
      store.markSyncComplete();
      // Keyhive gates this slot by its lar: URI; register the working doc and grant the seated face its reach.
      await kh.registerBag(working);
      if (daemonAuth.personaGroupAgentIdHex && veilKh && await veilKh.knowsAgent(daemonAuth.personaGroupAgentIdHex)) {
        await delegateToFaceViaVeil(working, "admin");
      }
      const temp = wikiSlotUri(slug, "temp");
      if (ctx.composite.hasWritableBag(temp)) {
        const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "daemon-working-attach" };
        await ctx.composite.put(mutableLarRecord("lar:///ha.ka.ba/lararium/config/current-wiki-bag", { text: working }, "daemon-working-attach"), origin, { bag: temp });
      }
      console.log(`[daemon] working layer attached: ${working}`);
    } catch (cause) {
      if (cause instanceof WorkingLayerAttachRefusal) throw cause;
      throw new WorkingLayerAttachRefusal(working, cause);
    }
  };

  // ── PERSONA-SCOPED ACTS NEED A FACE, AND SAY SO ────────────────────────────────────────────────
  // A vessel at the WAKING FLOOR carries and serves; it holds no persona plane, no bindings, nobody to
  // delegate a bag TO. Reaching for the face here refuses LOUDLY rather than resolving `undefined` into
  // a cap check — an audience that reads undefined would delegate to nobody and look like it worked.
  const faceAgent = (): string => {
    const id = daemonAuth.personaGroupAgentIdHex;
    if (!id) throw new Error("[daemon] this vessel stands at the waking floor and holds no face — light one with `lares persona new 0 --name '<label>'` before any persona-scoped act.");
    return id;
  };
  const faceGroup = (): string => {
    const id = daemonAuth.personaGroupDocIdHex;
    if (!id) throw new Error("[daemon] this vessel stands at the waking floor and holds no PersonaGroup plane — light a face with `lares persona new 0 --name '<label>'`.");
    return id;
  };

  // THE LEASE READ every device-delegation admission door shares — off the island's OWN daemon layer (its
  // composite holds the daemon doc on every platform; under an owned document the main repo DENIES it, so no
  // registry walk over `ctx.repo` reaches it), the SAME per-writer slots `gateFaceJoin` folds by max. A device
  // edge's `boundEpoch` checks against the epoch a FRESH join would license against — read fresh on every call,
  // never cached, so a roll after boot bites at the very next admission attempt, not just the next reboot.
  // TWO VERDICTS (`lease-frontier.ts`): an empty, readable slot set reads 0, the founding epoch; no group pinned,
  // no daemon layer, or a read fault reads UNAVAILABLE — and a mutation gate names that frontier rather than
  // silently licensing from the signature and wall-clock window alone.
  const readLeaseEpoch = (composite: IslandContext["composite"] | null | undefined): Promise<LeaseFrontier> =>
    readLeaseFrontier(composite, daemonAuth.personaGroupDocIdHex);

  return {
    ...daemonExtra, // the vessel-injected telemetry capture SINK flows through (idempotent cap → live)
    // Sovereign-worker data-plane: register the read-only reactors in-worker over the
    // IslandContext composite (verify-then-delegate gate inherited); the residency
    // ACTION reactors register alongside them below.
    wireWorkerVerbs: (registry, ctx: IslandContext) => {
      // `where` reaches every registered bag across both oracle planes by ACCESS
      // (access≠load) — the daemon queries all bags, mounts none. resolve stays
      // cascade-scoped.
      registry.register("where",      makeWhereReactor(ctx.composite, {
        repo: ctx.repo, catalogUrl: ctx.catalogUrl, oracleUrl: ctx.oracleUrl,
        slotDocUrl: async (slug, kind, opts) => (await slotDocsOf(ctx).slotDoc(slug, kind, opts))?.url ?? null,
      }));
      registry.register("resolve",    makeResolveReactor(ctx.composite));
      registry.register("unbound-docs", async () => ({ verb: "unbound-docs", unbound: await unboundMints(ctx.composite) }));
      // Residency ACTION verbs (ADD/COPY/MOVE/CLEAR/DROP/LOAD) — verify-then-delegate
      // gated, the `lares act` front door. The daemon reaches a deep target bag by
      // ACCESS (ephemeral mount, released after — no standing system-bag mount; the
      // edit/action split, wiki-layer-ontology#write-law).
      // A new bag is born WITH its cap: register its Keyhive Document + hand the
      // operator's PersonaGroup the reach below, in the same act as the mint (the
      // resolveOrMintBinding sequence). Shared by CREATE and wiki init — a mint
      // that only writes a catalog entry leaves the bag cap-denied until restart.
      // `kh` binds late — booted before dispatch.
      // THE REACH this vessel hands its OWN face over every bag it mints.
      //
      // The string stays keyhive's, because the wire speaks keyhive's vocabulary; the NAME says what the grant
      // does here. Keyhive's `admin` names one precise power — "the ability to revoke any members of a group,
      // not just those that they have causal seniority over" — never the web2 administrator its spelling
      // suggests, and never a tier of person. A face that mints a bag may seat and unseat within it; that is
      // the whole of what crosses.
      //
      // The mint and the join's re-grant read this ONE name, so a re-grant can never hand the group more than
      // the mint did — the two cannot drift into a silent promotion, because nothing stands for them to drift
      // apart FROM.
      const FACE_SEATS_AND_UNSEATS = "admin" as const;
      const registerBagCap = async (bagUrl: string): Promise<void> => {
        if (!kh) throw new Error("mint: keyhive unbooted — cannot register the new bag's cap");
        // bagUrl = the lar: bag URL — the key registerBag/delegate/verify all share,
        // the same string boot-registration registers (never the automerge doc url).
        await kh.registerBag(bagUrl);
        await delegateToFaceViaVeil(bagUrl, FACE_SEATS_AND_UNSEATS);
      };
      // THE CONTENT VERBS NEED A FACE. Every ACTION verb mints or writes under the face's reach, and REPACK
      // registers beside them; a floor holds no face and no bag it minted, so each refuses by naming the lift
      // BEFORE the cap check, the mint or any registry write. The set derives from the mesh table, never a list.
      if (daemonAuth.personaGroupAgentIdHex) {
        registerActionReactors(registry, {
          composite: ctx.composite,
          reach: {
            repo: ctx.repo, catalogUrl: ctx.catalogUrl, oracleUrl: ctx.oracleUrl,
            slotDocUrl: async (slug, kind, opts) => (await slotDocsOf(ctx).slotDoc(slug, kind, opts))?.url ?? null,
          },
          registerBag: registerBagCap,
          // LOAD lands every legal TW5 filetype via TW5's own deserializer registry,
          // resolved lazily through the daemon island's live $tw at action time.
          tw5: makeTw5Deserializer(ctx.tw5),
          // Resolve a carrier body a LOAD/INGEST verb rode BY REFERENCE (never inline) —
          // the fs-less worker pulls it from the corpus CAS by content-address.
          ...(ctx.resolveByCid ? { resolveByCid: ctx.resolveByCid } : {}),
          // The crossing gate's tier reader — node's disk, injected here so the gate can price direction.
          ...(bagTier ? { bagTier } : {}),
        });
      } else {
        for (const v of [...ACTION_VERBS, "REPACK"]) registry.register(v, lightAFace(v));
      }
      // Residency mutators (pin/unpin/register-cold) — gated in-worker; they command the
      // main-resident BagStowage via daemon:residency-op (ctx.post). `residency`
      // stats (a read) stays main pending the askMain research.
      registry.register("pin",           makePinReactor(ctx.post));
      registry.register("unpin",         makeUnpinReactor(ctx.post));
      registry.register("register-cold", makeRegisterColdReactor(ctx.post));

      // draft needs no catalog — register it regardless of slot.
      registry.register("draft", makeDraftReactor({ composite: ctx.composite }));

      // meme-put / meme-get — the daemon skins of the one placement function (`placeMeme`): the anchor
      // rides the daemon's own $tw.wiki; a named recipe or bag reaches its store by access (access≠load).
      const memeOpts = memeVerbOptions(ctx, async (slug, kind, opts) => (await slotDocsOf(ctx).slotDoc(slug, kind, opts))?.url ?? null);
      registry.register("meme-put", makeMemePutReactor(memeOpts), { summary: "Place a meme (framed text) through the Confluence gate into the anchor wiki, a named recipe's designated bag, or a named bag; `base` = the canonical hash last read.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("meme-get", makeMemeGetReactor(memeOpts), { summary: "Read a meme back as text + the canonical hash a writer hands back as its base.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("meme-list", makeMemeListReactor(memeOpts), { summary: "List every meme root a seat holds with its canonical hash; `tree` nests the slot tree.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("meme-delete", makeMemeDeleteReactor(memeOpts), { summary: "Remove a meme's whole group; `base` = the canonical hash last read, stale → conflict.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("meme-project", makeMemeProjectReactor(memeOpts), { summary: "Project a meme root to a target — mem · md · html · tid · json — as { uri, to, text, contentType, meta? }; the anchor renders every target in-VM, a recipe or bag target projects mem · md.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });

      // switcher-state — the daemon UX widget's IN path: main pushes the live
      // activation state and this writes the LOCAL, volatile $:/temp/lares/switcher
      // tiddler so the projected switcher re-renders (reactive, never a poll).
      registry.register("switcher-state", makeSwitcherStateReactor(ctx.tw5));

      // persona-state — the daemon persona surface's IN path: main (which holds the IDB
      // persona vault) pushes the live multitude-view and this writes the LOCAL, volatile
      // $:/temp/lares/personas tiddler so the projected surface re-renders. The tiddler
      // carries the PRIVATE pet-names — it stays in the temp slot, syncing to no bag. A
      // headless node daemon registers this verb but never receives a push (browser-only).
      registry.register("persona-state", makePersonaStateReactor(ctx.tw5));

      // circle-state — the daemon follow surface's IN path: main (which holds the IDB
      // follow-graph) pushes the live follow-view for a circle and this writes the LOCAL,
      // volatile $:/temp/lares/circles tiddler so the projected surface re-renders. The
      // tiddler carries the PRIVATE follow-graph + petnames — it stays in the temp slot,
      // syncing to no bag (the never-federates wall). A headless node daemon registers this
      // verb but never receives a push (browser-only).
      registry.register("circle-state", makeCircleStateReactor(ctx.tw5));

      // The FOLLOW-GRAPH verbs — the SOURCE OF TRUTH over the sovereign circles doc. "Adding to a circle IS
      // the follow"; circle-add/circle-remove write circles.memberDids, circle-list reads it back. The daemon
      // reaches this face's `circles-<tag>` by ACCESS off the catalog registry — access≠load, write-
      // then-sync. The circles doc rides the PRIVATE tier: the self-slot FLEET-syncs it same-operator (so a follow
      // lands on ALL the operator's own devices) and the DeterministicFederationGate NEVER volunteers it to a
      // cross-operator (the circles doc sits outside its federatable set). A follow writes ONLY the circles doc — no board shore
      // is reachable here, the never-federates wall made structural. `ctx.tw5` lets a mutation/list re-render
      // the daemon follow surface (a browser paints it; a headless node daemon rests the temp tiddler).
      if (ctx.oracleUrl) {
        // The registry a FACE's planes answer to — the persona, circles, identities and sessions planes all share one
        // tag and one home. Built once so the two verb families below cannot drift onto different planes.
        const facePlane = ctx.catalogUrl ? makeCatalogAccessor(ctx.repo, ctx.catalogUrl) : null;
        // THE FOLLOW GRAPH BELONGS TO THE FACE THAT IS WORN, AND A FACE'S PLANES ARE USER BAGS.
        //
        // `circles-<tag>` names this PersonaGroup's own circles, derived off the same tag as its persona
        // plane, so a vessel holding a multitude reads the circles of the face it stands in and never
        // another's. The tag comes from the plane id itself — the name is the index — so nothing here holds
        // a second copy to drift from.
        //
        // It resolves from the catalog registry, beside the persona plane it shares a tag with: the oracle plane names the SYSTEM
        // bags, the universal floor every vessel carries, and a person's relations are not universal. Which
        // registry a face's planes answer to reads as an OWNERSHIP question rather than a measured one — the
        // pair matches wherever both halves are written, so evidence alone never settled it (canon:
        // wiki-layer-ontology, ruled by the operator).
        const resolveCirclesStore = async () => {
          const face = personaSiblingBagIds(personaBagIdFor(faceGroup()));
          if (!face) throw new Error("circle-verb: this vessel's PersonaGroup plane names no face");
          if (!facePlane) throw new Error("circle-verb: this island carries no catalog plane — a user bag has no registry to resolve from");
          const store = await facePlane.storeOf(face.circles);
          if (!store) throw new Error(`circle-verb: ${face.circles} unresolved — the catalog registry names no such plane for the face this vessel wears`);
          return store;
        };
        // THIS device's own did (M5′): `cold-boot-ceremony` mints a fresh genesis follow's dot as
        // `<did>.0` off this SAME `vesselVerifyingKey` — injecting it here as the replica id keeps every
        // circle-verb dot this device mints disjoint from every OTHER device of the same operator by
        // construction, matching the dot a device's own genesis follow already carries.
        const circleReactors = makeCircleReactors({
          resolveStore: resolveCirclesStore,
          tw5: ctx.tw5,
          replica: didFromVerifyingKey(daemonAuth.vesselVerifyingKey),
        });

        // A FACE'S OWN NAMES ANSWER NO VERB. The private pet-name and the declared Handle ride the persona plane, and
        // the vessel's main thread writes them there from its custody door (the node package's `sealed-acts`, rows
        // `selves.read` and `selves.carry`). A verb's outcome rests in the daemon's document in the clear and the
        // digest of its arguments rests in a receipt, so this island registers no verb that takes or answers a
        // pet-name or a declared Handle.
        // A FACELESS PLACE OFFERS NO FACE VERBS.
        //
        // A founding stands a PLACE first — carrying, serving the public shelf — and lights a FACE after. In
        // that window `faceGroup()` names nothing, so the follow verbs register only where they can act; absent
        // a face each answers with the act that lights one.
        if (daemonAuth.personaGroupDocIdHex) {
          // THE FOLLOW-GRAPH RIDES THE FACE, so it registers on the same fact the persona verbs do.
          // Founding writes the circles doc in the same breath as the PersonaGroup plane and its sentinel — a
          // PLACE bootstrap carries the daemon bag alone — and the boot refuses a partial set outright, so the
          // two stand or fall together. Registering the follow verbs on a faceless floor would answer a
          // human "circles-<tag> unresolved: the oracle registry names no such plane" — a true sentence
          // that reads as a broken registry, when the honest answer is that no face has been lit yet.
          registry.register("circle-add",    circleReactors.add);
          registry.register("circle-remove", circleReactors.remove);
          registry.register("circle-list",   circleReactors.list);
        } else {
          // Leaving these unregistered answers a caller "no handler registered for circle-list" — true,
          // and it hands a human nothing to act on. Every verb that needs a face answers with the lift.
          registry.register("circle-add",     lightAFace("circle-add"));
          registry.register("circle-remove",  lightAFace("circle-remove"));
          registry.register("circle-list",    lightAFace("circle-list"));
        }

        // The CABAL-REALM verbs over the daemon bag, where the per-writer lease slots live. `realm-feed` rolls THIS
        // writer's own slot — the offering a realm lives by; `realm-clock` reads every slot back and reports
        // who feeds and how deep, VERDICT-FREE (what spread counts as capture stays the operator's
        // calibration, and mechanizing it here would recreate the root a realm exists without).
        // The slots live in the island's OWN daemon layer — the composite holds it on every platform, and under
        // an owned document the main repo denies the daemon doc, so no registry walk over `ctx.repo` reaches it.
        const resolveDaemonStore = async () => {
          const store = daemonLayerOf(ctx.composite);
          if (!store) throw new Error("cabal-realm-verb: daemon bag unresolved — the daemon layer is absent from this island's composite");
          return store;
        };
        const realmReactors = makeCabalRealmReactors({ resolveStore: resolveDaemonStore });
        registry.register("realm-feed",  realmReactors.feed);
        registry.register("realm-clock", realmReactors.clock);

        // `face-join` — the CAPABILITY half of joining this operator's own face, run where the booted
        // provider already lives. A device-admit confers STANDING (a signed edge the joinee pins); keyhive
        // still knows no such member, so the joinee reaches the plaintext planes and decrypts nothing sealed.
        // A joinee summons here with its ContactCard + the edge that licenses it, and leaves holding the
        // group key. The human confers standing once, by hand; the machine completes the capability.
        //
        // The gate reads THIS vessel's own edge for its two anchors: the root that signed us is the only root
        // whose edges seat anyone here, and the hearth we bind to is the hearth a joinee must bind to.
        //
        // FRESHNESS TAKES THE LEASE, NEVER THE CLOCK ALONE. The PersonaGroup's per-writer slots fold by
        // max-register — monotone, read locally, no shared now — and a grant bound below that reads stale.
        // Rolling those slots re-admits the WHOLE fleet (the epoch leases, it never revokes one device;
        // a single device leaves by `revokeSentinelMember`).
        // The capability half of a join is persona-scoped too — a hearth with no face seats nobody.
        if (daemonAuth.personaGroupDocIdHex) {
          // `seat-duties` — THE KEY SIDE OF A REMOVAL, for the face this island wears (kapae#/keys). The vessel
          // folds its fleet's edge board and hands in the acts it counted; this island, where the group's keys
          // live, counts them again under the root its own edge pins, reads each seat, plans what the counted
          // raises owe, and answers through the VEIL (the identity that holds the group). It returns what it did
          // and the rolls the vessel keeps in its own ledger.
          // WHO MAY ASK. The verb recounts signed acts and mints key epochs, so it answers its own vessel's main
          // thread alone: the ask carries the vessel key's signature over this request id and these facts. A
          // wiki island's surface, a session island and a peer's summons hold no such key, whatever requester
          // they name. The check runs before any read of the facts.
          registry.register("seat-duties", async (args, context) => {
            const unlicensed = seatDutiesAskRefusal({
              requestId: context.invocation.requestId, facts: args["facts"], ask: args["ask"], vesselVerifyingKey: daemonAuth.vesselVerifyingKey,
            });
            if (unlicensed) throw new Error(`[daemon] seat-duties: ${unlicensed}`);
            if (!veilKh) return { verb: "seat-duties", ran: false, reason: "no veil identity stands — this doc predates the veil-born founding; re-found the face." };
            const ownEdge = daemonAuth.deviceEdge;
            if (!ownEdge) throw new Error("[daemon] seat-duties: this vessel carries no device edge of its own, so it names no fleet.");
            const facts = args["facts"] as FleetSeatFacts | undefined;
            if (!facts || typeof facts !== "object" || typeof facts.fleetRoot !== "string" || !Array.isArray(facts.acts) || !Array.isArray(facts.rolled)) {
              throw new Error("[daemon] seat-duties: no facts in args — carry {fleetRoot, acts, rolled}.");
            }
            const answered = await answerFleetSeatDuties({
              provider: veilKh, facts,
              wornFleetRoot: ownEdge.personaRootDid,
              groupDocIdHex: faceGroup(),
              ownIdentifiers: [await veilKh.vesselIdentifierHex(), ...(kh ? [await kh.vesselIdentifierHex()] : []), daemonAuth.vesselVerifyingKey],
              sink: announceSeatRoll,
              signReceipt: ed25519SignerFromSeed(daemonAuth.seed),
            });
            return { verb: "seat-duties", ran: true, ...answered };
          });
          registry.register("face-join", async (args) => {
            if (!kh) throw new Error("[daemon] face-join: keyhive unbooted");
            const ownEdge = daemonAuth.deviceEdge;
            if (!ownEdge) {
              throw new Error(
                "[daemon] face-join: this vessel carries no device edge of its own, so it can name no root to " +
                "verify a joinee against — light a face with `lares persona new 0 --name '<label>'`.",
              );
            }
            const summons = args["summons"] as FaceJoinSummons | undefined;
            if (!summons || typeof summons !== "object") {
              throw new Error("[daemon] face-join: no summons in args — carry {contactCard, deviceEdge}.");
            }
            // A HEARTH NEVER SEATS ITSELF.
            //
            // A summons rides the daemon doc, and the daemon doc fleet-syncs across the operator's own devices — so every
            // seated vessel sees it, and every one of them runs this verb over the SAME PersonaGroup under the
            // SAME root. The joinee's own island would pass its own gate (the edge it presents was signed by the
            // root its boot pins) and seat itself, while the hearth seats it too: two writers, one group, one
            // seat, racing to re-key. The joinee is exactly the vessel that must not answer, and it knows itself
            // by the key it just presented.
            if (summons.deviceEdge?.deviceVerifyingKey?.toLowerCase() === daemonAuth.vesselVerifyingKey.toLowerCase()) {
              return {
                verb: "face-join", admitted: false, self: true,
                reason: "this vessel IS the joinee — a summons is answered by the hearth that holds the face, never by the device asking to join it.",
              };
            }
            // The lease read, off the island's own daemon layer: every slot under this group's prefix, folded
            // by max — the SAME read every admission door shares. An unavailable frontier seats nobody.
            const lease = await readLeaseEpoch(ctx.composite);
            if (lease.kind === "unavailable") {
              throw new Error(`[daemon] face-join: current lease frontier unavailable (${lease.why}) — no seat moves`);
            }

            // THE TWO-HANDED JOIN: the VEIL seats (it holds the group), the VESSEL re-grants its own
            // bags, and the joinee ingests BOTH slices. The contact card lands in both registries so
            // each identity can address the joinee.
            if (!veilKh) return { verb: "face-join", admitted: false, reason: "no veil identity stands — this doc predates the veil-born founding; re-found the face." };
            const veil = veilKh;
            const vessel = kh;
            const joinProvider = {
              receiveContactCard: async (bytes: Uint8Array) => {
                const got = await veil.receiveContactCard(bytes);
                try { await vessel.receiveContactCard(bytes); } catch { /* already known reads fine */ }
                return got;
              },
              verifySentinelMembership: (a: string, d: string) => veil.verifySentinelMembership(a, d),
              addSentinelMember:        (a: string, d: string) => veil.addSentinelMember(a, d),
              revokeSentinelSeat:       (a: string, d: string) => veil.revokeSentinelSeat(a, d),
              delegate:                 async (args: { bagUrl: string; audience: string; access: "read" | "admin" }) =>
                delegateToFaceViaVeil(args.bagUrl, args.access),
              // The re-delegate re-keys the bag FORWARD only; the vessel holds the standing chunks it sealed and
              // re-seals them at the re-keyed epoch, so a fresh seat reaches what the group held before it. The
              // vessel is the holder because the vessel sealed the content — the same key that delegated the bag.
              reSealBag:                (bagUrl: string) => vessel.reSealBag(bagUrl),
              eventsForPeer:            async (peer: string) => [
                ...(await veil.eventsForPeer(peer)),
                ...(await vessel.eventsForPeer(peer)),
              ],
              contactCard:              () => vessel.contactCard(),
            };
            // THE DYAD'S READING, asked of the vessel once for the device this summons names: the gate reads it
            // twice (before and after the card binds) and must read one answer.
            const joineeKey = typeof summons.deviceEdge?.deviceVerifyingKey === "string" ? summons.deviceEdge.deviceVerifyingKey : "";
            const joineeDyad = await requireDyadReader(dyadReading, "the join gate")(ownEdge.personaRootDid, joineeKey);
            const outcome = await runFaceJoin(joinProvider, summons, {
              personaRootDid:         ownEdge.personaRootDid,
              hearthTrueName:         ownEdge.hearthTrueName,
              personaGroupDocIdHex:   faceGroup(),
              personaGroupAgentIdHex: faceAgent(),
              leaseEpoch:             lease.n,
              dyad:                   () => joineeDyad,
              // The bags this vessel ALREADY delegated to its own face, re-granted so a fresh seat reaches them.
              // Naming only what we granted, at the access we granted, widens nobody's reach — it refreshes the
              // epoch on grants that already stand. `registerBags` IS that set, and `FACE_SEATS_AND_UNSEATS` IS the
              // access every one of them carries, because the mint above reads the same name.
              regrant: daemonAuth.registerBags.map((bagUrl) => ({ bagUrl, access: FACE_SEATS_AND_UNSEATS })),
            });
            // A refusal RETURNS — an unlicensed summons names an absent contract, never an attack, and the
            // reason rides the outcome so the joinee's panel can paint why rather than showing a silence.
            // THE LATER GRANT LANDS AS A RECORD on the PersonaGroup plane — the doc the joinee already syncs by
            // membership — signed under this vessel's device key and carrying this vessel's root-signed edge, so
            // the joinee's own kit verifies it offline against the root it pinned and takes the seat by its own
            // act. The grant still returns to the caller; a plane that cannot be written is said, never fatal.
            //
            // THE OUTCOME NAMES THE RECORD, IT NEVER CARRIES IT. The outcome is a bounded view; the record is the act.
            // So the outcome names where the record stands (`recordTitle`), what it is (`recordCid`, its tagged
            // sha256 content address) and the plane's heads just after the write (`recordHeads`). A caller that
            // must know what the join granted reads the record off the PersonaGroup plane once that plane's
            // history holds those heads — a causal wait — and recomputes the CID.
            let recordTitle: string | null = null;
            let recordCid: string | null = null;
            let recordHeads: readonly string[] | null = null;
            if (outcome.ok && facePlane) {
              try {
                const planeHandle = await facePlane.find(personaBagIdFor(faceGroup()));
                if (!planeHandle) throw new Error("the PersonaGroup plane is unresolved");
                const store = new AutomergeDocStore(planeHandle, personaBagIdFor(faceGroup()));
                const { kind: _grantKind, ...grantBody } = outcome.grant;
                void _grantKind;
                const rec = await signFaceGrantRecord({
                  kind: "face-join-grant/v1", groupDocIdHex: faceGroup(), ...grantBody,
                  founderEdge: ownEdge,
                }, ed25519SignerFromSeed(daemonAuth.seed));
                recordTitle = faceGrantTitle(faceGroup(), outcome.grant.joineeAgentIdHex);
                await store.put(
                  { tiddler: { title: recordTitle, text: JSON.stringify(rec), kind: "face-join-grant" } as LarTiddlerRecord["tiddler"], meta: { authority: "lares-verb" } },
                  { kind: "lares-verb", requestId: `face-grant-${rec.sig.slice(0, 12)}` },
                );
                recordCid = faceGrantRecordCid(rec);
                recordHeads = [...planeHandle.heads()];
                console.log(`[daemon] face-join: grant record written to the PersonaGroup plane (${recordTitle.slice(-16)}) — the joinee's kit takes the seat on its next present`);
              } catch (err) {
                console.log(`[daemon] face-join: grant record NOT written (${(err as Error)?.message ?? err}) — the grant returns to the caller alone`);
                recordTitle = null; recordCid = null; recordHeads = null;
              }
            }
            return outcome.ok
              ? { verb: "face-join", admitted: true,  ...outcome.grant, ...(recordTitle ? { recordTitle, recordCid, recordHeads } : {}) }
              : { verb: "face-join", admitted: false, reason: outcome.reason };
          });
        }
      }

      // Disk-ward refusals (wiki-island projector → worker.event bridge) — audit
      // in the daemon bag + $:/tags/Alert into the operator's pinned VM.
      registry.register("ward-alert", makeWardAlertReactor(ctx.composite, ctx.post));

      // ── THE SEALED STORE'S VERBS (sealed-store#/the-store) ───────────────────────────────────────────────
      // The content-key holder lives in this island, so every act that needs a content key runs here. No verb
      // answers a key, a plaintext or a parcel: an outcome rests in the daemon wiki, so each answers addresses,
      // opaque ids and counts alone. A body arrives as a staged address (or inline text) and an opened body
      // lands in the cleartext-local tier, the same tier the wake reads. A parcel carries the key shore's
      // public operations, which name readers: it rests in this vessel's own outbox for the member lane.
      const holderFor = (verb: string): ContentKeySeat => {
        if (!contentKeys) throw new SealedStoreUnavailable(verb);
        return contentKeys;
      };
      const signerNow = () => sessionProof?.signer() ?? null;
      const refusedBy = (verb: string, r: { readonly refusal: string; readonly cause?: string }): never => {
        throw new VerbRefusal(r.refusal, `[daemon] ${verb}: ${r.refusal}${r.cause ? ` (${r.cause})` : ""} — nothing sealed, nothing opened.`);
      };
      const bagOf = (verb: string, args: Record<string, unknown>): string => {
        const bag = args["bag"];
        if (typeof bag !== "string" || bag.length === 0) throw new Error(`[daemon] ${verb}: \`bag\` required — a private body seals under its own bag's content key.`);
        return bag;
      };
      registry.register("sealed-seal", async (args) => {
        const seat = holderFor("sealed-seal");
        const bag = bagOf("sealed-seal", args);
        const cid = typeof args["cid"] === "string" ? args["cid"] : "";
        const text = typeof args["text"] === "string" ? args["text"] : "";
        const plaintext = cid ? await sealedStore!.staged.read(cid) : text ? utf8Bytes(text) : null;
        if (plaintext === null) throw new Error(cid ? `[daemon] sealed-seal: no staged body at ${cid} in the cleartext-local tier.` : "[daemon] sealed-seal: `cid` (a staged body) or `text` (an inline body) required.");
        const history = args["history"] === "shareable" || args["history"] === "closed" ? args["history"] : undefined;
        const sealed = await seat.holder.sealBlob({ bagId: bag, plaintext, signer: signerNow(), ...(history ? { founding: { history } } : {}) });
        if ("refusal" in sealed) return refusedBy("sealed-seal", sealed);
        return {
          verb: "sealed-seal", cid: sealed.body.cid, keyVersion: sealed.body.keyVersion, ref: sealed.body.ref, founding: sealed.founding, manifest: sealed.manifest,
          ...(sealed.founded ? { founded: true, unserved: sealed.founded.unserved.length } : {}), ...(sealed.joined ? { joined: sealed.joined.keyVersion } : {}),
        };
      }, { summary: "Seal one private body under its bag's content key; answers the sealed address, the key version and the body's digest.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("sealed-open", async (args) => {
        const seat = holderFor("sealed-open");
        const opened = await seat.holder.openBlob({ bagId: bagOf("sealed-open", args), ref: typeof args["ref"] === "string" ? args["ref"] : "" });
        if ("refusal" in opened) return refusedBy("sealed-open", opened);
        // The body lands in the cleartext-local tier; the outcome names its address and its length alone.
        return { verb: "sealed-open", cid: await sealedStore!.staged.write(opened.plaintext), bytes: opened.plaintext.length, keyVersion: opened.keyVersion };
      }, { summary: "Open one private body by the digest its pointer names, into the cleartext-local tier.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("sealed-reading", async (args) => {
        const reading = await holderFor("sealed-reading").holder.reading(bagOf("sealed-reading", args));
        if ("refusal" in reading) return refusedBy("sealed-reading", reading);
        return { verb: "sealed-reading", ...reading };
      }, { summary: "Read one bag's key lineage: each founding, its heads, forks, rival foundings and unserved readers.", surfaces: [VERB_SURFACE.cli, VERB_SURFACE.agent] });
      registry.register("sealed-choose-head", async (args) => {
        const head = readKeyVersionId(args["head"]);
        if (head === null) throw new Error("[daemon] sealed-choose-head: `head` (a key version id) required.");
        const chose = await holderFor("sealed-choose-head").holder.chooseHead({ bagId: bagOf("sealed-choose-head", args), head });
        if ("refusal" in chose) return refusedBy("sealed-choose-head", chose);
        return { verb: "sealed-choose-head", ...chose };
      });
      /** Rest each parcel in the outbox under its reader's digest; answer the opaque names alone. */
      const parcelsOut = async (reader: string | null, parcels: readonly KeyParcel[]): Promise<string[]> => {
        const outbox = new SealedStore(sealedStore!.rest);
        const names: string[] = [];
        for (const parcel of parcels) names.push(await outbox.putOutbox(reader ?? "every-reader", encodeKeyParcel(parcel)));
        return names;
      };
      registry.register("sealed-hand-over", async (args) => {
        const reader = typeof args["reader"] === "string" ? args["reader"] : "";
        if (!reader) throw new Error("[daemon] sealed-hand-over: `reader` (a seat's identifier on the key shore) required.");
        const from = args["from"] === undefined ? undefined : readKeyVersionId(args["from"]);
        if (from === null) throw new Error("[daemon] sealed-hand-over: `from` reads as no key version id.");
        const handed = await holderFor("sealed-hand-over").holder.handOver({ bagId: bagOf("sealed-hand-over", args), reader, signer: signerNow(), ...(from ? { from } : {}) });
        if ("refusal" in handed) return refusedBy("sealed-hand-over", handed);
        // The hand-over record rests with the other records; the parcels rest in the outbox for the member lane.
        return { verb: "sealed-hand-over", outbox: await parcelsOut(reader, handed.parcels), versions: handed.record.body.versions, missing: handed.missing };
      });
      registry.register("sealed-admit", async (args) => {
        const act = typeof args["act"] === "string" ? args["act"] : "";
        const history = args["history"] === "shareable" ? "shareable" as const : "closed" as const;
        const admitted = await holderFor("sealed-admit").holder.admitFromNow({ bagId: bagOf("sealed-admit", args), act, history, signer: signerNow() });
        if ("refusal" in admitted) return refusedBy("sealed-admit", admitted);
        return { verb: "sealed-admit", minted: admitted.map((one) => ({ keyVersion: one.keyVersion, founding: one.founding, unserved: one.unserved.length })) };
      });
      registry.register("sealed-parcels", async (args) => {
        const reader = typeof args["reader"] === "string" ? args["reader"] : "";
        const parcels = await holderFor("sealed-parcels").holder.parcelsFor({ bagId: bagOf("sealed-parcels", args), reader });
        if ("refusal" in parcels) return refusedBy("sealed-parcels", parcels as { refusal: string });
        return { verb: "sealed-parcels", outbox: await parcelsOut(reader, parcels as readonly KeyParcel[]) };
      });
      registry.register("sealed-receive", async (args) => {
        const read = <T>(list: unknown, one: (bytes: Uint8Array) => T | null): T[] =>
          (Array.isArray(list) ? list : []).map((entry) => (typeof entry === "string" ? one(base64ToBytes(entry)) : null)).filter((x): x is T => x !== null);
        const parcels = read(args["parcels"], readKeyParcel);
        const records = read<SealedRecord>(args["records"], readCarriedRecord);
        const took = await holderFor("sealed-receive").holder.receive({ parcels, records });
        if ("refusal" in took) return refusedBy("sealed-receive", took);
        return { verb: "sealed-receive", parcels: parcels.length, records: records.length, bags: took.bags.length };
      });
      registry.register("sealed-serve", async () => {
        const served = await holderFor("sealed-serve").holder.serveUnserved();
        if ("refusal" in served) return refusedBy("sealed-serve", served);
        return { verb: "sealed-serve", outbox: await parcelsOut(null, served.parcels), owed: served.owed };
      });
      // ── A BACKUP BUNDLE'S MEMORY SECTION (sealed-store#/the-store; custody#/the-bundle) ────────────────────
      // The section leaves and enters the holder SEALED: a cut takes a public key and answers ciphertext, and an
      // import takes the section and its pair's secret half sealed to a key this island named for that one import.
      // No bare content key crosses the port, and no outcome names one. Each verb answers its own vessel's main
      // thread alone: the ask carries the vessel key's signature over this request and what it hands in.
      // ONE SIGNED ASK RUNS ONCE. This island keeps each request it answered for its own life, so the same signed
      // invocation placed again refuses. A replay after a restart gains nothing either way: a cut seals to the
      // key its own ask named, a door stands for an import its replayer cannot seal to, and an import meets no door.
      const memoryAsked = new Set<string>();
      const memoryAsk = (verb: string, act: MemoryAct, facts: unknown, args: Record<string, unknown>, requestId: unknown): void => {
        const unlicensed = memoryAskRefusal({ requestId, act, facts, ask: args["ask"], vesselVerifyingKey: daemonAuth.vesselVerifyingKey });
        if (unlicensed) throw new VerbRefusal("memory-ask-unlicensed", `[daemon] ${verb}: ${unlicensed}`);
        if (memoryAsked.has(requestId as string)) throw new VerbRefusal("memory-ask-spent", `[daemon] ${verb}: this island already answered that request; a fresh ask carries a fresh request id.`);
        memoryAsked.add(requestId as string);
      };
      /** The pair this island named for ONE import. The next `sealed-memory-door` replaces it; an import spends it. */
      let memoryDoor: MemoryKeypair | null = null;
      registry.register("sealed-memory-cut", async (args, context) => {
        const to = typeof args["to"] === "string" && /^[0-9a-f]{64}$/.test(args["to"]) ? args["to"] : null;
        memoryAsk("sealed-memory-cut", "cut", { to }, args, context.invocation.requestId);
        if (to === null) throw new Error("[daemon] sealed-memory-cut: `to` (the section pair's public half, 64 lower hex) required.");
        const cut = await holderFor("sealed-memory-cut").holder.cutMemory({ bags: daemonAuth.registerBags, to: meshHexToBytes(to) });
        if ("refusal" in cut) return refusedBy("sealed-memory-cut", cut);
        return { verb: "sealed-memory-cut", section: bytesToBase64(cut.section), holds: cut.holds.map((one) => ({ ...one })) };
      });
      registry.register("sealed-memory-door", async (args, context) => {
        memoryAsk("sealed-memory-door", "door", {}, args, context.invocation.requestId);
        holderFor("sealed-memory-door");
        memoryDoor?.secret.fill(0);
        memoryDoor = mintMemoryKeypair();
        return { verb: "sealed-memory-door", door: memoryHex(memoryDoor.public) };
      });
      registry.register("sealed-memory-import", async (args, context) => {
        const section = typeof args["section"] === "string" ? args["section"] : null;
        const sealedSecret = typeof args["secret"] === "string" ? args["secret"] : null;
        memoryAsk("sealed-memory-import", "import", { section, secret: sealedSecret }, args, context.invocation.requestId);
        const seat = holderFor("sealed-memory-import");
        if (section === null || sealedSecret === null) throw new Error("[daemon] sealed-memory-import: `section` and `secret` (each base64) required.");
        const door = memoryDoor;
        memoryDoor = null;   // one door, one import
        if (door === null) throw new VerbRefusal("memory-door-unnamed", "[daemon] sealed-memory-import: this island named no door for this import — ask `sealed-memory-door` first; nothing imported.");
        let secret: Uint8Array | null = null;
        try {
          secret = openMemorySecret(base64ToBytes(sealedSecret), door.secret);
          if (secret === null) throw new VerbRefusal("memory-malformed", "[daemon] sealed-memory-import: the section's key did not open under this import's door — nothing imported.");
          const imported = await seat.holder.importMemory({ section: base64ToBytes(section), secret, signer: signerNow() });
          if ("refusal" in imported) return refusedBy("sealed-memory-import", imported);
          return { verb: "sealed-memory-import", results: imported.results.map((one) => ({ ...one })) };
        } finally { secret?.fill(0); door.secret.fill(0); }
      });
      // The vessel hands back the rolls it kept (`keptSeatRolls`), each under its own receipt: a founding or a
      // head that arrived after a raise settled still takes its roll, and a forged roll moves nothing.
      registry.register("sealed-rolls", async (args) => {
        const rolls = Array.isArray(args["rolls"]) ? args["rolls"] : [];
        return { verb: "sealed-rolls", ...(await holderFor("sealed-rolls").catchUp(rolls, daemonAuth.vesselVerifyingKey)) };
      });

      // The share carriers' passphrase LIFECYCLE (#60) — DAEMON-FIRST: seal/rotate/repair/status route THROUGH
      // this worker, so the daemon updates its OWN in-memory seal
      // policy in the same act it re-persists the carriers — no un-rotate. The node-injected `vault`
      // handler does the fs + policy work (keyhive stays fs-blind). The passphrase rides the args over
      // the owner-only 0600 UDS. Absent injection (no fs) → the verbs never register.
      if (vault) {
        for (const v of ["vault-status", "vault-seal", "vault-rotate", "vault-repair"] as const) {
          registry.register(v, async (args) => vault(v, args));
        }
      }

      // Every other daemon verb reaches USER registry data in the catalog plane (wiki oracles,
      // recipes) via the accessor over ctx.repo/ctx.catalogUrl — access≠load. The daemon
      // recipe NEVER loads the catalog registry as tiddlers. All ride the verify-then-delegate gate.
      // vesselDid mints through `didFromVerifyingKey` wherever a draft key derives, so those keys never drift —
      // the PLACE is what asks, never the persona root.
      if (ctx.catalogUrl) {
        const catalog = makeCatalogAccessor(ctx.repo, ctx.catalogUrl);
        // System plane (oracle) accessor — list-wikis reads system wiki-recipes
        // (the lares and lararium bags) from here, user recipes from the catalog registry (two-plane).
        const sysPlane = ctx.oracleUrl ? makeCatalogAccessor(ctx.repo, ctx.oracleUrl) : undefined;
        const wikiMintOpts = {
          composite:   ctx.composite,
          repo:        ctx.repo,
          catalog,
          ...(sysPlane ? { oracle: sysPlane } : {}),
          rootDir:     "",
          vesselDid: async () => didFromVerifyingKey(daemonAuth.vesselVerifyingKey),
          registerBag: registerBagCap,
          resolveDraftDoc: (slug: string) => slotDocsOf(ctx).draft(slug),
        };
        // The wiki-minting and composing verbs write under the face's reach, so a floor refuses them by
        // naming the lift, as it does the ACTION verbs.
        const faceStands = !!daemonAuth.personaGroupAgentIdHex;
        const underFace = (verb: string, reactor: VerbReactor): VerbReactor => faceStands ? reactor : lightAFace(verb);
        registry.register("init-wiki",   underFace("init-wiki", makeInitWikiReactor(wikiMintOpts)));
        registry.register("open-wiki",   makeOpenWikiReactor({ composite: ctx.composite, catalog, post: ctx.post }));
        registry.register("prune-stale", underFace("prune-stale", makePruneStaleReactor(wikiMintOpts)));
        registry.register("list-wikis",  makeListWikisReactor(catalog, sysPlane));
        // Whole-wiki residency policy — read the catalog recipe, command main's manager
        // per bag via daemon:residency-op. Pure policy, no live-layer mechanism.
        registry.register("pin-wiki",      makeWikiPinReactor(catalog, ctx.post, sysPlane));
        registry.register("unpin-wiki",    makeWikiUnpinReactor(catalog, ctx.post, sysPlane));
        // Recipe composition — write the catalog recipe, command residency via op. NO
        // live-layer mount/unmount: the recipe syncs, islands reconcile their own stacks.
        registry.register("add-bag",       underFace("add-bag", makeAddBagReactor({ catalog, ...(sysPlane ? { oracle: sysPlane } : {}), post: ctx.post })));
        registry.register("remove-bag",    underFace("remove-bag", makeRemoveBagReactor({ catalog, ...(sysPlane ? { oracle: sysPlane } : {}), post: ctx.post })));
        // Catalog-writing residency verbs — mint/oracle via accessor + repo, command
        // residency via post. No live-layer swap (oracle/recipe sync; islands reconcile).
        registry.register("bag-compact", makeCompactBagReactor({ repo: ctx.repo, catalog, post: ctx.post }));
        registry.register("rotate-recipe", makeRotateRecipeReactor({ repo: ctx.repo, catalog, post: ctx.post }));
      }
    },
    verifierFactory: async (ctx: IslandContext) => {
      // Cache the composite for the FRESH per-call lease reads below (verifyPeer, the joinee grant-take) —
      // never the epoch itself, which must be read live at each door.
      epochCtx = { composite: ctx.composite };
      // THE BINDING GATE'S OWN LEASE READ — the same fold, done once here (boot only re-runs the gate at
      // boot, so a single read at this moment is exactly as fresh as the gate itself). An UNAVAILABLE frontier
      // threads no epoch, and the gate refuses a persona-bound boot on it.
      const bindingGateLease = await readLeaseEpoch(ctx.composite);
      if (bindingGateLease.kind === "unavailable" && daemonAuth.personaGroupDocIdHex) {
        console.log(`[daemon] Binding Gate lease read: current lease frontier unavailable (${bindingGateLease.why})`);
      }
      const { keyhive, did } = await bootDaemonKeyhive({
        seed:                  daemonAuth.seed,
        eventStore:            new DaemonEventStore({ daemon: ctx.composite }),
        vesselVerifyingKey:  daemonAuth.vesselVerifyingKey,
        // The face pins ride CONDITIONALLY — the gate runs in full or grants no persona caps at all.
        ...(daemonAuth.personaGroupDocIdHex   ? { personaGroupDocIdHex:   daemonAuth.personaGroupDocIdHex }   : {}),
        ...(daemonAuth.personaGroupAgentIdHex ? { personaGroupAgentIdHex: daemonAuth.personaGroupAgentIdHex } : {}),
        ...(daemonAuth.meshCabalDocIdHex      ? { meshCabalDocIdHex:      daemonAuth.meshCabalDocIdHex }      : {}),
        registerBags:          daemonAuth.registerBags,
        ...(daemonAuth.signerDid  ? { signerDid:  daemonAuth.signerDid }  : {}),
        ...(daemonAuth.personaKel ? { personaKel: daemonAuth.personaKel } : {}),
        ...(daemonAuth.deviceEdge ? { deviceEdge: daemonAuth.deviceEdge } : {}),
        ...(bindingGateLease.kind === "epoch" ? { expectedEpoch: bindingGateLease.n } : {}),
        // THE DYAD'S SHADOW over this vessel's own device edge, asked of the vessel's own fold of its fleet board.
        ...(daemonAuth.deviceEdge
          ? { dyad: await requireDyadReader(dyadReading, "the Binding Gate")(daemonAuth.deviceEdge.personaRootDid, daemonAuth.vesselVerifyingKey) } : {}),
        ...(daemonAuth.archiveBytes ? { archiveBytes: daemonAuth.archiveBytes } : {}),
        ...(sealedStore?.chunks ? { chunkRest: sealedStore.chunks } : {}),
      });
      kh = keyhive;
      mintedByHex = did;
      if (daemonAuth.dyadVeil) {
        // THE SHORE DERIVES THE VEIL, never this island: the veil's root rests where the shore keeps it (a sealed
        // custody root the island never holds), so the mounted face's veil key arrives already derived.
        const v = new KeyhiveProvider();
        await v.init({
          seed: meshHexToBytes(daemonAuth.dyadVeil.signingKey),
          eventStore: new DaemonEventStore({ daemon: ctx.composite }),
          ...(daemonAuth.veilArchiveBytes ? { archiveBytes: daemonAuth.veilArchiveBytes } : {}),
          ...(sealedStore?.chunks ? { chunkRest: sealedStore.chunks } : {}),
        });
        await v.hydrateFromEventStore();
        veilKh = v;
      }
      // ── M3 — THE ARCHIVE FLOOR, THROUGH THE ONE DOOR ──────────────────────────────────────────
      // `exportArchive()` captures the founding + hydrated membership/capability DAG (+ prekey
      // secrets) so a later torn daemon doc restores from here instead of orphaning the veiled
      // Handle. Best-effort — a failed export never blocks boot.
      //
      // "EVERY BOOT" WAS THE SEAM. This ran unconditionally, written when only one boot shape
      // existed; a vessel whose archive holds SHUT boots too now, and canon rules that a locked
      // vessel signs nothing (waking-floor #/the-shape). `persistArchiveFloor` reads the standing
      // ITSELF and bars both writers — the gate stands at the DOOR that performs the write, never
      // at the injection site, because "a model that fences at the grant and not at the door has
      // moved the check somewhere nobody performs it" (waking-floor #/the-breaks ①). keyhive stays
      // fs-blind: the door reads a boolean fact and declines to CALL the writer, learning no path.
      //
      // THE RESTORE PREMISE IS PARTLY SUPERSEDED, so the loss is smaller than it reads.
      // `KeyhiveProvider.init` now self-heals an ORPHANED veil by comparing the restored archive's
      // `whoami` against the seed-derived identity and standing fresh from the seed on a mismatch
      // (founding-runbook §the-seed-decides-the-identity). A barred boot loses its restore FLOOR
      // and replays cap-events alone — a vessel that has lost its CAPS and kept its FLOOR.
      //
      // RAIL B: the door DECIDES the refusals; this frame SURFACES them (below).
      const floor = await persistArchiveFloor({
        archiveOpens: daemonAuth.archiveOpens,
        writers: {
          ...(persistArchive     ? { persistArchive }     : {}),
          ...(persistVeilArchive ? { persistVeilArchive } : {}),
        },
        // EACH STAND'S CARD MINTS BEFORE ITS ARCHIVE LEAVES. Every later ask in this boot (a binding's
        // two-handed delegation, a face-join, a crossing) presents that same card, so the Archive that
        // lands here holds the secret behind every prekey this boot presents.
        exportArchive: () => keyhive.exportArchiveAfterTheCard(),
        ...(veilKh ? { exportVeilArchive: () => veilKh!.exportArchiveAfterTheCard() } : {}),
      });
      // ── THE CONTENT-KEY HOLDER STANDS HERE, beside the identities that wrap and open its lockboxes ──────────
      // One subscription: its roll takes this island's seat rolls (kapae#/keys). A wrap rests the wrapping
      // identity's Archive through the SAME door as the floor above, and only where the archive opens: a locked
      // vessel rests nothing, so it wraps nothing.
      if (sealedStore) {
        const fleetRoot = daemonAuth.deviceEdge?.personaRootDid;
        const bareId = (id: string): string => id.trim().toLowerCase().replace(/^0x/, "");
        contentKeys = seatContentKeys({
          providers: [...(veilKh ? [veilKh] : []), keyhive],
          rest: sealedStore.rest,
          values: sealedStore.values,
          restArchive: async (provider) => {
            if (daemonAuth.archiveOpens !== true) throw new Error("the archive holds shut: a locked vessel rests no Archive, so no lockbox wraps");
            const write = provider === veilKh ? persistVeilArchive : persistArchive;
            if (!write) throw new Error("no Archive writer stands on this shore, so a wrap could not open again");
            await write(await (provider as KeyhiveProvider).exportArchiveAfterTheCard());
          },
          group: daemonAuth.personaGroupDocIdHex && fleetRoot ? { docIdHex: daemonAuth.personaGroupDocIdHex, scope: fleetRoot } : null,
          bags: () => daemonAuth.registerBags,
          // A face's seat reads every standing through the dyad's guard: with no reader composed each ask
          // throws by name, so the seat wraps for nobody and performs no key act. It never reads the absence
          // as `clear`.
          ...(fleetRoot ? {
            standingOf: async (member: string) => requireDyadReader(dyadReading, "the content-key seat")(fleetRoot, bareId(member)),
            ownEdgeShadowed: async () => (await requireDyadReader(dyadReading, "the content-key seat")(fleetRoot, daemonAuth.vesselVerifyingKey)) === "aside",
          } : {}),
          ...(countedRaises && fleetRoot ? { countedRaises: () => countedRaises(fleetRoot) } : {}),
          ...(sessionProof ? { session: sessionProof } : {}),
          // A report names a result, a founding's opaque locator and a key version: no key, and no bag's name.
          report: (o) => console.log(`[daemon] content-key roll: ${o.result}${o.founding ? ` founding ${o.founding.slice(0, 12)}…` : ""}${o.keyVersion ? ` → version ${o.keyVersion.slice(0, 12)}…` : ""} (${o.raises.length} raise(s))`),
        });
        // THE HOLDER LEAVES WITH ITS IDENTITY: a disposed provider opens no lockbox, so the seat unsubscribes
        // and overwrites every key in the same breath.
        const seat = contentKeys;
        keyhive.whenDisposed(() => { seat.lock(); if (contentKeys === seat) contentKeys = null; });
      }
      // Archive refusal records use the daemon wiki's default writable layer, so attachment precedes them.
      await attachDaemonWorking(ctx);
      console.log(`[daemon] unbound documents: ${(await unboundMints(ctx.composite)).length} (list them with \`lares vessel unbound\`; nothing removes one)`);
      if (floor.barred) {
        console.log("[daemon] the archive holds shut — the identity archive was NOT re-sealed; every sovereign act waits.");
      }
      // Archive refusal records and operator alerts use the attached daemon working layer. `wardKind`
      // identifies the refusing ward; keyhive stays fs-blind and the record names a `lar:` URI.
      if (floor.refusals.length) {
        for (const r of floor.refusals) {
          console.warn(`[daemon] ${r.carrier} archive export REFUSED: ${r.message}`);
          try {
            await fileWardRefusal(ctx.composite, ctx.post, {
              bagId:    DAEMON_BAG_ID,
              uri:      `lar:///ha.ka.ba/identity/${r.carrier}-archive`,
              reason:   r.message,
              wardKind: "archive-seal",
            });
          } catch (err) {
            // The surfacing itself must never take the boot down — the refusal is already on stdout.
            console.warn(`[daemon] archive-seal refusal could not be filed durably: ${(err as Error)?.message ?? err}`);
          }
        }
      }
      return keyhive;
    },

    verifyPeer: async (cardBytes: Uint8Array, bagUrl: string, access: "read" | "admin", proof?: AuthProofWire, edge?: DeviceDelegationTiddler) => {
      if (!kh) return { ok: false, reason: "keyhive not booted" };
      const { id } = await kh.receiveContactCard(cardBytes);
      const verdict = await kh.verify({ presenter: id, bagUrl, access });

      // V3 proof-of-possession (project_verification_placement): the keyholder
      // worker — the only place that holds BOTH the gate's own key and the peer's
      // real key — checks the relayed signature. Conservative-caller law: derive
      // both pubkeys from TRUSTED sources, never the wire.
      //   gatePubKey = this gate's OWN verifying key (vesselVerifyingKey) — so a
      //     proof signed for a different gate fails here (anti-relay).
      //   peerPubKey = the raw ed25519 key, the suffix of the card-derived
      //     Identifier hex (the same relationship bootDaemonKeyhive Gate A relies on:
      //     did.endsWith(verifyingKey)).
      let proofVerified = false;
      let proofReason: string | undefined;   // the SPECIFIC cause — never swallowed into a generic verdict
      if (proof) {
        const peerPubKey = id.slice(-64); // raw 32-byte ed25519 verifying key (hex)
        const r = await verifyAuthProof({
          nonce:      proof.nonce,
          gatePubKey: mintedByHex.slice(-64),
          peerPubKey,
          aud:        bagUrl,
          sig:        proof.sig,
        });
        proofVerified = r.ok;
        proofReason   = r.reason;
      }

      // ENFORCEMENT FLIP (V3 step D): admission requires BOTH a satisfied
      // capability (`verdict.ok`) AND a verified proof-of-possession. Every live
      // peer transport now sources a real proof (the CLI via LarWSClientAdapter;
      // the browser stays passive). ESCAPE HATCH: a node operator MAY set
      // LAR_V3_ALLOW_UNPROVEN=1 to fall back to capability-only admission (the
      // prior advisory posture) if a live handshake regression surfaces — guarded
      // for browser-safety (no `process` there; the browser holds no inbound peer).
      const enforce = !(typeof process !== "undefined" && process.env?.["LAR_V3_ALLOW_UNPROVEN"] === "1");
      if (enforce && !proofVerified) {
        // Carry the SPECIFIC cause. "V3 proof verification failed" alone cannot tell a bad signature from a
        // stale timestamp from a malformed field, and a gate that hides which one refused makes every
        // handshake regression a guess. The narrow reason (bad-sig · expired · not-32-byte-hex) rides out.
        const why = proof ? `V3 proof rejected: ${proofReason ?? "unverified"}` : "V3 proof required";
        return { ok: false, identifier: id, proofVerified, reason: why };
      }

      // ADMIN-CAP PATH (unchanged): a satisfied capability admits directly. Under `enforce`
      // the early return above already guaranteed proofVerified, so this admits on cap + a
      // verified proof-of-possession exactly as before.
      //
      // SELF-SLOT CLASS: cap=admin on the daemon bag is held ONLY by this operator's own PersonaGroup (the
      // founding delegates admin to personaGroupAgentIdHex; no foreign operator ever earns it). So an
      // admin admit PROVES same-operator — the peer keeps full device sync. This is an UNFORGEABLE
      // signal: a cross-operator cannot manufacture an admin@daemon grant it was never delegated.
      if (verdict.ok) {
        return { ...verdict, identifier: id, proofVerified, peerClass: "same-operator" as const };
      }

      // OPERATOR DEVICE-DELEGATION PATH (additive). The peer holds NO cap=admin, but a
      // device the operator admitted carries the signed root→device edge. Admit it at the
      // operator's-own-device tier IFF the edge verifies AND binds to THIS proven identity.
      //
      // MANDATORY PIN (confused-deputy cure), now on the PERSONA-KEL: the operator's own device edge MUST
      // chain to the CURRENT head op-key the hearth's pinned identifier (`daemonAuth.personaKel.prefix`)
      // resolves to — the same continuity anchor the Binding Gate walks in bootDaemonKeyhive. Walking the
      // KEL (not a frozen op-key) means a device re-issued under a rotated head still admits, and a device
      // edge signed by a SUPERSEDED op-key rejects. An absent / mis-pinned KEL is a HARD ERROR, not a skip.
      // The presenter binding (`edge.deviceDid === id`) ties the operator's grant to the exact identity that
      // just proved possession of its key (proofVerified, above) — a device-admitted peer STILL proves it
      // holds its key; the edge only adds the operator's delegation, it never weakens the V3 proof.
      if (edge) {
        const kel = daemonAuth.personaKel;
        if (!kel || kel.chain.length === 0 || kel.chain[0]!.prefix !== kel.prefix) {
          return { ok: false, identifier: id, proofVerified, reason: "device-delegation: no pinned persona-KEL in scope — refusing to admit on an unpinned edge" };
        }
        // FRESHNESS TAKES THE LEASE, NEVER THE CLOCK ALONE (same law as gateFaceJoin, :502-509). Read the
        // CURRENT PersonaGroup lease epoch fresh at this admission attempt — a device whose boundEpoch has
        // rolled past denies HERE, and re-presents via the existing face-join regrant flow (:467-470).
        // An absent/unavailable frontier is an explicit refusal: this is a mutation gate, so a valid signature
        // plus a soft wall-clock window cannot silently stand in for the current authority relation.
        if (!epochCtx) {
          return { ok: false, identifier: id, proofVerified, reason: "device-delegation pending: current lease frontier unavailable" };
        }
        const lease = await readLeaseEpoch(epochCtx.composite);
        if (lease.kind === "unavailable") {
          return { ok: false, identifier: id, proofVerified, reason: `device-delegation pending: current lease frontier unavailable (${lease.why})` };
        }
        const expectedEpoch = lease.n;
        const delegation    = await verifyEdgeAgainstPersonaKel(edge, kel.chain, { expectedEpoch });
        const deviceMatches = edge.deviceDid === id;
        const unreadNote    = kelWalkNote(delegation);
        if (delegation.ok && deviceMatches && proofVerified) {
          // Admitted at the operator's-own-device tier — equivalent flow to admin (it IS the
          // operator's delegated device). `reason` carries the provenance (survives the worker→host
          // boundary; the gate ignores it on an ok verdict but it aids audit).
          //
          // SELF-SLOT CLASS: the edge chains to the persona-KEL head op-key — THIS hearth's pinned
          // identifier's current authority — and binds to the exact identity that proved key-possession. A
          // cross-operator cannot forge an edge chaining to a KEL it never heads, so a verified head-chained
          // edge PROVES same-operator (the operator's own device fleet, a distinct device key under one identity).
          // Events the walk set aside move nothing; the provenance says so rather than drop them in silence.
          return { ok: true, identifier: id, proofVerified, reason: `admitted via operator device-delegation${unreadNote}`, peerClass: "same-operator" as const };
        }
        return {
          ok: false, identifier: id, proofVerified,
          reason: (!delegation.ok  ? `device-delegation rejected: ${delegation.reason ?? "(no reason)"}`
                : !deviceMatches  ? "device-delegation edge not bound to the presented identity"
                :                   "device-delegation requires a verified proof-of-possession") + unreadNote,
        };
      }

      // A PROVEN KEY, AND NOTHING MORE. The peer holds neither cap=admin@daemon nor a valid KEL-pinned device
      // edge, yet it proved a self-certifying identity and — the foreign surface never relaxes — possession of
      // its key. The worker vouches exactly that: `ok` with the proven identifier and NO class. The gate's sorter
      // then classes the socket (contracted · walker · stranger) or answers it silence; the worker never
      // decides what a foreign key reaches. A foreign key that cannot prove possession is refused here, whatever
      // `LAR_V3_ALLOW_UNPROVEN` says (that hatch relaxes the operator's OWN device fleet above, never a foreign
      // presenter).
      if (proofVerified) return { ok: true, identifier: id, proofVerified, reason: "proven key — the gate's sorter classes it" };
      return { ...verdict, identifier: id, proofVerified, reason: verdict.reason ?? "a foreign key must prove possession" };
    },

    // A VESSEL BINDS ON ITS OWN KEY, AND A FACE COMPOSES ONTO THAT.
    //
    // These name a wiki's personal/draft/working layers, through THE ONE slot-doc resolver. The MINT
    // is what confers authority (`registerBag` generates the document; its generator is admin by
    // construction), so a faceless vessel's binding is a doc the VESSEL holds — the posture its
    // daemon bag has always stood in. Where a face is SEATED the same doc delegates to the
    // PersonaGroup on top, so operator and vessel compose over every critical doc; the draft slot
    // of an unseated vessel falls to the device floor and says so (`resolveSlotDoc`). The callback
    // reads `daemonAuth.personaGroupAgentIdHex` directly rather than through `faceAgent()`, so a
    // floor offering it cannot throw during boot and take its own standing with it.
    resolveBinding: async (ctx: IslandContext, fingerprint: string, recipeTrace: { wikiDocId: string; libraryBagDocIds: readonly string[] }, wikiSlug: string) =>
      slotDocsOf(ctx).bindings(fingerprint, recipeTrace, wikiSlug),

  };
}

/**
 * The operator's daemon-island behavior — `operatorDaemonOptions` stood up.
 *
 * The options ride their own door because the wiring pass they carry decides WHICH VERBS A VESSEL OFFERS,
 * and that decision had no witness: `wireWorkerVerbs` is called deep inside `makeDaemonBehavior`'s onEa over
 * a live VerbTable, so nothing could read it without standing a whole daemon. A pass that shapes a vessel's
 * surface deserves to be readable on its own.
 */
export function makeOperatorDaemonBehavior(manifest: IslandMsg_Manifest, extra: DaemonExtra = {}): IslandBehavior {
  return makeDaemonBehavior(operatorDaemonOptions(manifest, extra));
}
