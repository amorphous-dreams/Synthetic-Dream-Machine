/**
 * sovereign-kernel — the platform-blind OTP gen_island lifecycle.
 *
 * ONE kernel both vessels run. Node and browser do NOT each implement a
 * lifecycle; they each COMPOSE this one flow with a small host shore. The shore
 * is what *remains* after subtracting the identical skeleton from the two prior
 * mirror files (sovereign-island-model.ts ⇆ browser-sovereign-island-model.ts):
 * a data descriptor of four capability-pieces, not an OO platform interface.
 *
 *   generic lifecycle: boot → Repo → CompositeStore → IslandAdaptor → ea → demote
 *   caller-supplied IslandBehavior: onEa / onSignal / onHooAnu
 *
 * ## Recipe law — one model across all wikis
 *
 *   Manifest carries `recipe: WikiRecipe + grants: IslandGrants`. Structural
 *   slots arrive as typed grants; bag document pointers resolve through the
 *   vessel catalog, while the oracle supplies the read-only seed floor.
 *   `buildIslandRecipe()` lays the stack:
 *
 *     temp        (MemoryTiddlerStore, volatile)
 *     draft       (CRDT, high-churn drafts)
 *     @<wikiSlug>  (CRDT, operator's edits)
 *     libraryBags[]  (CRDT, optional content libraries resolved from the catalog registry)
 *     oracle       (read-only floor snapshots over the live oracle seed)
 *
 *   Write routing happens via the in-wiki cascade
 *   (`lar:///ha.ka.ba/lararium/config/bag-paths`), not by behavior config.
 *
 * ## The host shore (composition, not adaptation)
 *
 *   IslandHostShore carries the platform divergence as DATA + resolver fns:
 *     - post     : transport out (node parentPort.postMessage / browser self.postMessage)
 *     - listen   : transport in  (node parentPort.on / browser self.addEventListener)
 *     - storage  : Repo storage adapter for this manifest (nodefs / IndexedDB / memory)
 *     - ready?   : optional IoC handshake (browser posts mkReady; node omits)
 *
 *   Same isomorphic flow; different pieces resolved. role ≠ platform.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/sovereign-kernel
 */

import { wearOf } from "@lararium/mesh";
import {
  CompositeStore,
  ENGINE_CORE_ID,
  ORACLE_BAG,
  wikiBagUri,
  wikiSlotUri,
  expandRecipe,
  recipeLayerIndex,
  mkBreath,
  mkFault,
  isVesselToIslandMsg,
  mkTeardownAck,
  TEARDOWN_FAULT,
  makeIslandRepo,
  replicaHeads,
  sha256HexBytesSync,
  GENESIS_FLOOR_TIDDLER,
  plainRecordOrNull,
  resolveFloor,
  floorRecordsInOrder,
  floorCanonReader,
  islandSecretHome,
  type KahuaStageFace,
  type Repo,
  type DocHandle,
  type AutomergeUrl,
  type StorageAdapterInterface,
  type LarDoc,
  type IslandMsg_Manifest,
  type IslandToVesselMsg,
  type SlotUri,
  type LarTiddlerRecord, ownEntry, CONTROL_HOME_ID, controlStoreOf, floorAnswerStore, mkDaemonFloorAnswer, ControlHomeUnavailable,
  AutomergeDocStore, slotLayerFlags } from "@lararium/mesh";
import { IslandKernel } from "./island-kernel.js";
import { waitForSlotDocument } from "./slot-wait.js";
import { storeLiveness, type StoreLiveness } from "./store-liveness.js";
import { buildIslandRecipe, seedDrained } from "./island-recipe.js";
import { openIslandStory } from "./island-story.js";
import { casBlobPreloads, modulePinsOf } from "./module-pins.js";
import { makeCatalogAccessor, libraryDocUrl } from "./catalog-accessor.js";
import { librarySlotUrl, liveKahuaFace } from "./kahua-layer.js";
import { installLazyResolver } from "./lazy-resolver.js";
import { bridgeWikiToAdaptor } from "./outbound-bridge.js";
import { makeViewChannel, type ViewChannel } from "./view-channel.js";
import { makeReceiptCapability, type ReceiptCapability } from "./receipt.js";
import type { IslandContext, IslandBehavior } from "./island-context.js";
import { PLANE_LABELS } from "@lararium/mesh/plane-labels";

/** Detach a failed writable shore before its scheduler task settles. */
/**
 * An island's teardown ALWAYS ANSWERS: `teardown:ack` once it came down, or a `fault` named `teardown-fault: …` when a
 * step threw. The vessel's teardown wait ends on that answer, never on a clock.
 */
export async function answerTeardown(run: () => Promise<void>, post: (msg: IslandToVesselMsg) => void, wikiUri: () => string): Promise<void> {
  try { await run(); }
  catch (err) {
    post(mkFault(wikiUri(), `${TEARDOWN_FAULT} the island could not tear down: ${err instanceof Error ? err.message : String(err)}`));
    return;
  }
  post(mkTeardownAck());
}

export async function guardWritableStand<T>(run: () => Promise<T>, detach: () => Promise<void>): Promise<T> {
  try { return await run(); }
  catch (error) {
    try { await detach(); } catch (cleanupError) { console.warn("[writable] detach failed:", cleanupError); }
    throw error;
  }
}

export async function detachFaultedWritable(adaptor: import("./island-adaptor.js").IslandAdaptor | null, unsub: (() => void) | null): Promise<void> {
  adaptor?.dropResidency();
  unsub?.();
  await adaptor?.stop();
}

// ── The host shore — platform divergence as composition ──────────────────────

export interface IslandHostShore {
  /** Transport out: post a message to the vessel. */
  post(msg: IslandToVesselMsg): void;
  /** Transport in: register the inbound message listener. */
  listen(onMessage: (raw: unknown) => void): void;
  /** Build the Repo storage adapter for a manifest that names a store (the daemon island's); undefined = in-memory. */
  storage(msg: IslandMsg_Manifest): StorageAdapterInterface | undefined;
  /** Ask the vessel's rest whether it holds a document sealed (`vesselRestAsker`); the daemon's secret home asks it before
   *  each secret act. Absent: the island reaches no secret home. */
  restsAtVessel?: (documentId: string) => Promise<boolean>;
  /** Optional IoC handshake fired after the listener registers (browser mkReady). */
  ready?(): void;
  /**
   * Resolve content-addressed bytes by CID (sha256 hex) from the platform's LOCAL CAS
   * (browser OPFS · node FS). The breath path: the worker PULLS its TW5 engine + plugin
   * tiddlers by CID, never CRDT-syncing a 2.3 MB blob doc over the port. Returns null
   * when the CID is absent. Omitted → the kernel falls back to reading oracle-doc blobs.
   */
  resolveByCid?(cid: string): Promise<Uint8Array | null>;
}

// ── runSovereignKernel — the OTP gen_island kernel ──────────────────────────

// The mount-breath interval. While a manifest mounts, the island emits a
// breath this often (plus a stage mark before each long stretch) so the
// vessel's watchdog re-arms on breath and silence alone reads dead.
const BREATH_INTERVAL_MS = 1_000;

export function runSovereignKernel(
  host: IslandHostShore,
  behaviorOrFactory: IslandBehavior | ((manifest: IslandMsg_Manifest) => IslandBehavior),
  opts?: { breathEveryMs?: number; caps?: { receipt?: true } },
): void {
  const breathEveryMs = opts?.breathEveryMs ?? BREATH_INTERVAL_MS;
  const _post = (msg: IslandToVesselMsg) => host.post(msg);
  const handler = new IslandKernel(_post);

  // Factory form: when a manifest-keyed factory is passed, the behavior resolves
  // lazily on first manifest — so the daemon entry can read manifest.daemonAuth
  // (the operator seed) at construction time.
  let behavior: IslandBehavior | null = typeof behaviorOrFactory === "function" ? null : behaviorOrFactory;
  const _resolveBehavior = (msg: IslandMsg_Manifest): IslandBehavior => {
    if (behavior === null) behavior = (behaviorOrFactory as (m: IslandMsg_Manifest) => IslandBehavior)(msg);
    return behavior;
  };

  let _repo:      Repo | null                    = null;
  let _ownedRepo: Repo | null                   = null;
  let _handles:   Map<string, DocHandle<LarDoc>> = new Map();
  let _receipt:   ReceiptCapability | null = null;
  let _receiptDoorClosed = false;
  /** This island has said `receipt:asks-done`: only then may the vessel's `receipt:close` end its receipts. */
  let _asksDonePosted = false;
  let _composite: CompositeStore | null = null;
  /** The daemon island's control store (`grants.controlUrl`); null on every wiki island. */
  let _control: CompositeStore | null = null;
  let _ctx:       IslandContext | null  = null;
  let _lazyUnsub: (() => void) | null   = null;
  let _bridgeUnsub: (() => void) | null = null;   // the outbound bridge (Road B) — one listener, cancelled at teardown
  let _adaptor: import("./island-adaptor.js").IslandAdaptor | null = null;
  let _activeWikiUri                    = "";
  // A session island's two asked gates (catalog names, content addresses) ride this channel; null outside a session.
  let _view: ViewChannel | null         = null;
  /** Whether this island is the daemon island, the one with a store of its own (its Repo's, or its owned document's);
   *  every wiki island relays through the vessel's Repo and settles its last heads at teardown. */
  let _keepsStore = false;
  // THE SECRET HOME rides the daemon manifest alone (`daemonAuth.secretUrl`), and only where the host can ask the vessel's
  // rest; a wiki island's manifest carries no daemonAuth and reaches none.
  const secretHomeOf = (msg: IslandMsg_Manifest): Pick<IslandContext, "secretStore" | "secretRest"> => {
    const url = msg.daemonAuth?.secretUrl;
    if (!url || !host.restsAtVessel || !_repo) return {};
    const home = islandSecretHome(_repo, url, host.restsAtVessel);
    return { secretStore: home.store, secretRest: home.rest };
  };

  // Live CRDT patches flow through AutomergeDocStore.handle.on("change") →
  // MemeProvider → IslandAdaptor → the shore queue. The packed engine is a synchronous applier;
  // the shore owns quota, host-task pacing, and the seed checkpoint.

  // ── Message dispatch ──────────────────────────────────────────────────────

  host.listen((raw: unknown) => {
    if (!isVesselToIslandMsg(raw)) return;
    // The vessel's close answers THIS island's asks-done, and nothing else: a bare close mid-life (a forwarded tab's, a replay)
    // ends no receipt. The sync port closing stays the local event that ends them at any time.
    if (raw.type === "receipt:close") { if (_asksDonePosted) { _receiptDoorClosed = true; _receipt?.close(); } return; }
    if (_view?.settleAnswer(raw)) return;
    if (_receipt?.answer(raw)) return;

    if (raw.type === "manifest") {
      void _handleManifest(raw as IslandMsg_Manifest);
      return;
    }

    if (raw.type === "teardown" || raw.type === "hooanu") {
      void answerTeardown(_handleTeardown, _post, () => _activeWikiUri);
      return;
    }

    // Delegate to behavior — daemon handles daemon:place-verb, daemon:verb-result, etc.
    if (_ctx && behavior && behavior.onSignal(raw.type, raw, _ctx)) return;
  });

  // Inversion of control: signal the vessel that this worker's message handler
  // is registered (browser also waits on WASM top-level await). The vessel MUST
  // NOT send a manifest until it receives this "ready" signal. Node omits it.
  host.ready?.();

  // ── Manifest (OTP init) ───────────────────────────────────────────────────

  async function _handleManifest(msg: IslandMsg_Manifest): Promise<void> {
    _activeWikiUri = msg.wikiUri;
    void _activeWikiUri;
    // The ea-breath law: the island breathes while it mounts — one breath at
    // receipt, a stage mark before each long stretch, and a steady interval
    // between awaits. Settle (ea or fault) ends the breathing. The interval
    // breath repeats the LAST evidence (alive); only tick() advances the
    // progress counter (advancing) — the vessel's stall budget judges the gap
    // (progress-kick over timer-kick).
    let _phase    = "manifest";
    let _progress = 0;
    const breathe = (): void => {
      _post(mkBreath(msg.wikiUri, _phase, _progress));
    };
    const tick = (next?: string): void => {
      if (next) _phase = next;
      _progress++;
      breathe();
    };
    breathe();
    // PACING: this emits breaths; the vessel judges their progress and silence.
    const breathTimer = setInterval(() => breathe(), breathEveryMs);
    _mountBreath = { slot: (slot) => tick(`slot ${slot}`), advance: () => { _progress++; } };
    // Any throw during init (incl. a behavior.onEa gate failure, e.g.
    // bootDaemonKeyhive Gate A/B/C) posts fault so the vessel times out cleanly
    // instead of hanging without an ea.
    try {
      await _doManifest(msg, tick);
    } catch (err) {
      _post(mkFault(msg.wikiUri, `manifest handler threw: ${String(err)}`));
    } finally {
      clearInterval(breathTimer);
      _mountBreath = null;
    }
  }

  // ── Slot resolution — the wait ends on events, faults loudly, never hangs ──
  //
  // NO CLOCK DECIDES AN ARRIVAL (road C16). A wiki island keeps no store, so every slot document arrives from the
  // vessel's Repo over the sync port, and the wait ends on an event (`slot-wait`): the document arriving, the Repo's
  // refusal, or the vessel's verdict that it holds no such document, which stands a grace window with nothing moving on
  // the port before it ends the wait. A silent port while an ask stands says only that the vessel still works: a corpus
  // load, a key derivation, a big store read. The hard cap stays as the one last-resort bound, and its fault names
  // itself and the phase the wait stood in. Each slot names itself on the island's breath while it waits, and inbound
  // sync advances the breath's progress, so the vessel's own stall budget reads a moving wait as moving and a still one
  // by the slot it waits on.
  const SLOT_VERDICT_GRACE_MS = 8_000;
  // The cap sits above any pull a live mount makes of its documents (a wiki island holds no local copy, so it pulls each
  // slot whole) and below the node pool's own mount stall budget, so the island names the slot before the vessel kills it.
  const SLOT_READY_HARD_CAP_MS = 300_000;
  const SLOT_POLL_MS           = 250;
  // The most documents one receipt ask names (`receipt-with-heads` answers a longer ask malformed).
  const SETTLE_BATCH = 64;
  const mono = (): number => performance.now();
  const defer = (): Promise<void> =>
    // PACING: defer yields to the host task queue without deciding readiness.
    new Promise((res) => (typeof setImmediate === "function" ? setImmediate(res) : setTimeout(res, 0)));
  let _lastSyncHeardAt = mono();
  const _syncWakes = new Set<() => void>();
  // The mount's breath, while a manifest mounts: a slot names its wait, and inbound sync advances the progress.
  let _mountBreath: { slot(slot: string): void; advance(): void } | null = null;
  const _markSyncHeard = (): void => { _lastSyncHeardAt = mono(); _mountBreath?.advance(); for (const wake of _syncWakes) wake(); };
  // THE DAEMON ISLAND'S OWN STORE, read for each of its Repos (`store-liveness`), the one island store that stands: a read
  // there may wait on the vessel's rest answer, so a slot wait that ends at the hard cap names a read still in flight.
  const _storeOf = new WeakMap<object, StoreLiveness>();
  const _counted = <S extends object>(repoStorage: S | undefined): { storage: S | undefined; liveness: StoreLiveness | null } => {
    if (!repoStorage) return { storage: undefined, liveness: null };
    const { storage, liveness } = storeLiveness(repoStorage, mono);
    return { storage, liveness };
  };

  async function _resolveSlot(
    repo: Repo,
    docUrl: string,
    slot: string,
    wikiUri: string,
  ): Promise<DocHandle<LarDoc> | null> {
    // The wait's law lives in `slot-wait`: a rejection counts as a verdict only when a peer stood connected to
    // give it. This island's one peer is the vessel's main thread, and a Repo with no peer connected settles a
    // find "unavailable" at once, so an ask that lands while the main thread stalls (a key derivation at an
    // unlock, a corpus load) gets asked again when the peer stands.
    _mountBreath?.slot(slot);
    const out = await waitForSlotDocument<DocHandle<LarDoc>>({
      find:      () => repo.find<LarDoc>(docUrl as AutomergeUrl),
      peerCount: () => repo.peers.length,
      // The library words an unavailable document so (`DocumentQuery`); the node package pins the wording
      // (`repo-without-a-peer-rejects.test.ts`), and any other rejection ends the wait at once as a refused ask.
      absence:   (rejection) => rejection instanceof Error && /is unavailable/.test(rejection.message),
      now:       mono,
      lastHeard: () => _lastSyncHeardAt,
      ...(_storeOf.has(repo) ? { store: () => _storeOf.get(repo)!.reading() } : {}),
      // LIVENESS: slot waits use this for the verdict's grace and the last-resort hard cap alone.
      sleep:     (ms) => new Promise((res) => setTimeout(res, ms)),
      defer,
      onWake: (wake) => {
        _syncWakes.add(wake);
        repo.networkSubsystem.on("peer", wake);
        return () => { _syncWakes.delete(wake); repo.networkSubsystem.off("peer", wake); };
      },
      budgets:   { verdictGraceMs: SLOT_VERDICT_GRACE_MS, hardCapMs: SLOT_READY_HARD_CAP_MS, pollMs: SLOT_POLL_MS },
    });
    if (out.outcome === "ready") return out.handle;
    if (out.outcome === "hard-cap") {
      const stood = out.phase === "store" ? `the island's own store still held ${out.storeReads} read(s) in flight, each waiting on that store or on the vessel's rest answer for its document`
        : out.phase === "asked" ? "the vessel stood connected and never answered the ask"
        : out.phase === "no-peer" ? "no vessel stood connected to ask"
        : "the vessel answered unavailable while traffic kept flowing";
      _post(mkFault(wikiUri,
        `slot ${slot} unavailable — LAST-RESORT HARD CAP: no event ended the wait for doc ${docUrl} in ${out.elapsedMs}ms ` +
        `(${stood}; hard cap ${SLOT_READY_HARD_CAP_MS}ms)`));
      return null;
    }
    if (out.outcome === "refused") {
      _post(mkFault(wikiUri, `slot ${slot} unavailable — the Repo refused the ask for ${docUrl}: ${out.why}`));
      return null;
    }
    _post(mkFault(wikiUri, `slot ${slot} unavailable — the peer answered WITHOUT doc ${docUrl} (unavailable verdict, not a timeout)`));
    return null;
  }

  async function _doManifest(
    msg: IslandMsg_Manifest,
    tick: (next?: string) => void = () => {},
  ): Promise<void> {
    const behavior = _resolveBehavior(msg);

    // Repo construction + network wiring is a CRDT concern owned by mesh; the
    // kernel composes it through the facade and stays @automerge-free.
    //
    // The silence clock taps the syncPort FIRST (same tick — no message can slip
    // between listeners): every inbound sync message marks the peer live, so the
    // slot wait measures true port-silence, never a wall deadline over a busy peer.
    _lastSyncHeardAt = mono();
    const tapPort = msg.syncPort as unknown as {
      addEventListener?: (t: string, h: () => void) => void;
      on?: (t: string, h: () => void) => void;
    };
    // Node worker_threads ports speak EventEmitter, browser ports EventTarget;
    // tap whichever face the platform holds (both coexist with the adapter's own).
    if (typeof tapPort.addEventListener === "function") tapPort.addEventListener("message", _markSyncHeard);
    else tapPort.on?.("message", _markSyncHeard);
    _receiptDoorClosed = false;
    _asksDonePosted = false;
    const closeReceipts = (): void => { _receiptDoorClosed = true; _receipt?.close(); };
    if (typeof tapPort.addEventListener === "function") tapPort.addEventListener("close", closeReceipts);
    else tapPort.on?.("close", closeReceipts);
    // AN ISLAND WHOSE MANIFEST NAMES NO STORE holds an EPHEMERAL replica on every platform: no storage adapter stands
    // behind its Repo whatever the host would offer, and the vessel's Repo, its one peer, rests what it holds. Every
    // wiki island stands so; the daemon island alone names a store. A SESSION ISLAND (`msg.view`) never takes one,
    // and its Repo announces the one peer ID its scoped view admits.
    _view = msg.view ? makeViewChannel(_post) : null;
    const own = _counted(msg.view || !msg.storage ? undefined : host.storage(msg));
    const storageAdapter = own.storage;
    _keepsStore = storageAdapter !== undefined || msg.ownedDocument !== undefined;
    _repo = makeIslandRepo({
      ...(storageAdapter ? { storage: storageAdapter } : {}),
      syncPort: msg.syncPort,
      ...(msg.view ? { peerId: msg.view.peerId } : {}),
      ...(msg.ownedDocument ? { denyDocument: msg.ownedDocument.documentUrl } : {}),
    });
    if (own.liveness) _storeOf.set(_repo, own.liveness);
    // A SESSION ISLAND HOLDS NO CONTENT STORE: every content read asks its view, and the vessel's owner answers
    // with the bytes or a refusal. The host's own resolver never gets asked. Each caller below re-checks the
    // bytes against the address, as it does for bytes from any store.
    const view = _view;
    const resolveByCid: IslandHostShore["resolveByCid"] = view ? (cid) => view.content(cid) : host.resolveByCid;
    if (msg.ownedDocument) {
      const ownedManifest = msg.ownedDocument.storage
        ? { ...msg, storage: msg.ownedDocument.storage, syncPort: msg.ownedDocument.syncPort }
        : { ...msg, syncPort: msg.ownedDocument.syncPort };
      const owned = _counted(host.storage(ownedManifest));
      const ownedStorage = owned.storage;
      _ownedRepo = makeIslandRepo({
        ...(ownedStorage ? { storage: ownedStorage } : {}),
        syncPort: msg.ownedDocument.syncPort,
        documentScope: msg.ownedDocument.documentUrl,
      });
      if (owned.liveness) _storeOf.set(_ownedRepo, owned.liveness);
    }

    _composite = new CompositeStore();

    // §6 — bytes travel via the lararium CRDT; manifest carries only integrity gate.
    // The engine grant resolves FIRST (engine bytes precede TW5 boot).
    tick("slots");
    const laraiumHandle = await _resolveSlot(_repo, msg.grants.islandUrl, ORACLE_BAG, msg.wikiUri);
    if (!laraiumHandle) return;
    _handles.set(ORACLE_BAG, laraiumHandle);

    // catalog registry ACCESS (never layered) — the island resolves library bags from
    // the user registry ITSELF: boot runs the same resolution path recipe-watch
    // runs live (boot = first reconcile).
    // A RESOLVED mount carries every slot's absolute id and reaches no catalog at all: the one mesh resolver
    // answered at surface mount, and this island lays what it names.
    const resolved   = msg.resolved ?? null;
    const catalogUrl = resolved ? null : msg.grants.catalogUrl ?? null;
    const faceCatalogUrl = resolved ? null : msg.grants.faceCatalogUrl ?? null;
    const catalog    = catalogUrl ? makeCatalogAccessor(_repo, catalogUrl, faceCatalogUrl) : null;

    // The catalog names each vessel's document pointers; the oracle supplies seed rows.
    // Structural instance slots arrive as typed grants.
    const slug = msg.recipe.wikiSlug;
    const slotUrl = async (slot: SlotUri): Promise<string | null> => {
      if (resolved) return slot === ORACLE_BAG ? msg.grants.islandUrl : resolved[slot] ?? null;
      if (slot === wikiSlotUri(slug, "draft"))    return msg.grants.draftUrl    ?? null;
      if (slot === wikiSlotUri(slug, "working"))  return msg.grants.workingUrl  ?? null;
      if (slot === wikiSlotUri(slug, "personal")) return msg.grants.personalUrl ?? null;
      // A canon that follows the face (`canonBag`) mounts from its own grant; the wiki's own bag then rides as vessel state.
      if (msg.recipe.canonBag !== undefined && slot === msg.recipe.canonBag) return msg.grants.canonUrl ?? null;
      if (slot === wikiBagUri(slug))              return msg.ownedDocument?.documentUrl ?? msg.grants.wikiUrl ?? null;
      if (slot === ORACLE_BAG)                 return msg.grants.islandUrl;
      // `bags/kahua` answers from the grant the face proof filled, never from a catalog row (`kahua-layer`).
      return librarySlotUrl(slot, msg.grants, catalog ? (s) => libraryDocUrl(catalog, s) : null);
    };

    // THE CONTROL DOCUMENT, an access grant the daemon island alone carries: resolved here and held as its own store, never
    // laid into the recipe's composite, so no control record reaches the engine's wiki or a mirrored layer.
    _control = null;
    if (msg.grants.controlRefusal) {
      // A LOCKED (or faceless) VESSEL FAILS CLOSED: the island resolves no control document and every control act refuses by name.
      // The floor still answers the acts that write no control fact: each answer crosses to the vessel's own floor store, the
      // memory the verb door waits on, and rests nowhere.
      _control = floorAnswerStore(new ControlHomeUnavailable("the vessel cannot read its control document now", msg.grants.controlRefusal),
        (record) => _post(mkDaemonFloorAnswer({ tiddler: { ...record.tiddler }, ...(record.meta ? { meta: { ...record.meta } } : {}) })));
    } else if (msg.grants.controlUrl) {
      const controlHandle = await _resolveSlot(_repo, msg.grants.controlUrl, CONTROL_HOME_ID, msg.wikiUri);
      if (!controlHandle) return;
      _handles.set(CONTROL_HOME_ID, controlHandle);
      _control = controlStoreOf(controlHandle);
    }

    const slots = expandRecipe(msg.recipe);
    const ready: Array<{ slot: SlotUri; handle: DocHandle<LarDoc> }> = [];
    // THE FACE'S CANON MOUNTS AFTER EA. It rests sealed under the face, and its values open only through this island's own
    // document-store door, which stands with the island's holder at `onEa`: a restart that waited on it here, before ea,
    // would wait on itself (the vessel's load refuses `holder-locked` until the door answers). So it mounts once ea lands,
    // the way the daemon's working slot lifts onto the face's document after the seat stands.
    let deferredCanon: { readonly slot: SlotUri; readonly url: string } | null = null;

    for (const slot of slots) {
      if (slot === wikiSlotUri(slug, "temp")) continue;
      if (slot === ORACLE_BAG) { ready.push({ slot, handle: laraiumHandle }); continue; }
      const docUrl = await slotUrl(slot);
      if (!docUrl) continue;   // ungranted/unregistered slot — in-memory or absent
      if (msg.recipe.canonBag !== undefined && slot === msg.recipe.canonBag) { deferredCanon = { slot, url: docUrl }; continue; }
      const handle = await _resolveSlot(
        slot === wikiBagUri(slug) && _ownedRepo ? _ownedRepo : _repo,
        docUrl, slot, msg.wikiUri,
      );
      if (!handle) return;     // fault already posted
      _handles.set(slot, handle);
      ready.push({ slot, handle });
      tick();                  // one slot resolved — real progress evidence
    }
    tick("slot-ready");

    // ── Resolve the TW5 engine + plugin tiddlers ──────────────────────────────
    // The CID plane: the kernel, plugin blobs, and every large blob ride the local CAS,
    // pulled by CID (host.resolveByCid) — immutable bytes fetched by content-address +
    // verified by rehash, off the sync port. The CRDT plane carries no bytes. A missing
    // resolver, a missing coreHash, or a CAS miss faults the boot.
    // The booted engine's display label: the version string on the genesis blob entry
    // (blobs[ENGINE_CORE_ID].version on the oracle doc). The engine's identity is the
    // sha256 of the bytes this kernel eval's; the label rides the engine-watch alert text
    // and nothing compares it.
    const coreVersion = String(ownEntry(laraiumHandle.doc()?.blobs, ENGINE_CORE_ID)?.version ?? "");
    const pluginTiddlers: Record<string, unknown>[] = [];

    if (!resolveByCid || !msg.coreHash) {
      _post(mkFault(msg.wikiUri, `island cannot resolve the TW5 core — the CID plane needs a local CAS resolver and a coreHash`));
      return;
    }
    const coreBytes = await resolveByCid(msg.coreHash);
    if (!coreBytes) {
      _post(mkFault(msg.wikiUri, `island cannot resolve TW5 core by CID ${msg.coreHash.slice(0, 12)}… from the local CAS`));
      return;
    }
    for (const cid of msg.pluginCids ?? []) {
      const bytes = await resolveByCid(cid);
      if (!bytes) {
        _post(mkFault(msg.wikiUri, `island cannot resolve plugin tiddler by CID ${cid.slice(0, 12)}… from the local CAS`));
        return;
      }
      let preloads: Record<string, unknown>[];
      try {
        // The blob's own CID pins its bytes: a blob that hashes elsewhere refuses by name before a record of it reads.
        preloads = casBlobPreloads(bytes, cid);
      } catch (err) {
        _post(mkFault(msg.wikiUri, `island cannot read plugin tiddler ${cid.slice(0, 12)}…: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }
      for (const t of preloads) pluginTiddlers.push(t);
    }

    // §6 integrity gate, enforced: the manifest's coreHash names the engine the vessel
    // intends; the kernel hashes the bytes it actually eval's. A mismatch faults before
    // boot — the island never runs an engine it cannot witness. (Free on the CAS path:
    // the CID IS the hash.)
    const engineSha = sha256HexBytesSync(coreBytes);
    if (msg.coreHash && msg.coreHash !== engineSha) {
      _post(mkFault(msg.wikiUri, `TW5 core integrity gate failed — manifest coreHash=${msg.coreHash.slice(0, 12)}… vs eval'd bytes sha256=${engineSha.slice(0, 12)}…`));
      return;
    }
    const engine = { sha256: engineSha, version: coreVersion };

    if (!pluginTiddlers.length) {
      _post(mkFault(msg.wikiUri, "island cannot load plugin tiddlers — none resolved (CAS by CID, or lararium-doc blobs)"));
      return;
    }

    // THE FLOOR THE VESSEL ACCEPTED (`floor-pin`): the manifest names it where the vessel's pin moved past genesis; absent,
    // the genesis seed's own floor witness.
    const floorCidField = msg.floorCid ?? plainRecordOrNull(ownEntry(laraiumHandle.doc()?.tiddlers, GENESIS_FLOOR_TIDDLER))?.tiddler.cid;
    let floorRecords: readonly Readonly<Record<string, LarTiddlerRecord>>[] = [];
    // One house canon bag's own snapshot off that floor (`IslandContext.floorCanon`): a read door's floor answer.
    let floorCanon: ((bag: string) => Readonly<Record<string, LarTiddlerRecord>> | null) | undefined;
    if (typeof floorCidField === "string" && floorCidField.length > 0) {
      const floor = await resolveFloor(floorCidField, resolveByCid);
      if ("refusal" in floor) {
        _post(mkFault(msg.wikiUri, `${PLANE_LABELS.oracle} mount refused (${floor.refusal}): ${floor.reason}`));
        return;
      }
      floorRecords = floorRecordsInOrder(floor);
      floorCanon = floorCanonReader(floor);
    } else {
      console.info(`[floor] the genesis seed names no floor; the ${PLANE_LABELS.oracle} reads the seed rows alone`);
    }
    tick("tw5-boot");
    let bootInstance: Record<string, unknown> | undefined;
    let used = false;
    try {
      // Every blob carries its pin into the engine: the core its manifest coreHash, each plugin module the CID its blob just
      // verified against, so the engine evaluates exactly the code the manifest named.
      await handler.bootTw5(msg.wikiUri, { bytes: coreBytes, sha256: msg.coreHash }, pluginTiddlers, {
        grantedDigests: new Set(msg.pluginCids ?? []),
        modulePins: modulePinsOf(pluginTiddlers),
        onInstance(instance) {
          bootInstance = instance as unknown as Record<string, unknown>;
          Object.defineProperty(instance, "larariumWritableStand", {
            configurable: true, enumerable: false,
            value: async () => {
              // Only the marker's take (delete before call) opens this door.
              if (used || Object.hasOwn(bootInstance!, "larariumWritableStand")) return;
              used = true;
              return guardWritableStand(async () => {
              const tw5 = handler.tw5()!;
              // One recipe model — buildIslandRecipe walks expandRecipe(msg.recipe),
              // wires temp + every resolved CRDT slot, registers the adaptor, and ARMS
              // the seed replay on the shore's quota-bounded host-task queue.
              tick("recipe");
              // THE KAHUA LAYER READS UNDER THE FACE THIS MANIFEST WEARS: its group names the stage, its verified KEL roster the grant
              // every lift's signer must hold. A manifest wearing no face reads an empty stage. The lineage reads LIVE off the
              // island's replica of the KEL board the manifest names, so a rotation merged after boot re-folds the layer.
              const auth = msg.daemonAuth;
              const kel = auth?.personaKel;
              const liveFace = auth?.personaGroupId && kel ? liveKahuaFace({
                group: auth.personaGroupId, prefix: kel.prefix, bootChain: kel.chain, anchor: auth.faceAnchor ?? null,
                board: kel.board ? _repo!.find<LarDoc>(kel.board as never) : null,
              }) : null;
              const kahuaFace = (): KahuaStageFace | null => liveFace?.read() ?? null;
              const kahuaFaceWatch = (fn: () => void): (() => void) => liveFace?.watch(fn) ?? (() => {});
              const { adaptor } = buildIslandRecipe({
                tw5,
                composite: _composite!,
                recipe: msg.recipe,
                ready,
                floorRecords,
                ...(msg.grants.writeSlot ? { writeSlot: msg.grants.writeSlot } : {}),
                kahuaFace,
                kahuaFaceWatch,
                // Each slot's store writes a worn face's change through the island Repo's seated actor door.
                ...(wearOf(_repo).wear ? { wear: wearOf(_repo).wear! } : {}),
              });
              _adaptor = adaptor;
              // THE RECEIPT CAPABILITY, for a host whose vessel declares it. A save act's result waits for the vessel to hold and flush
              // what the act wrote; a session island keeps no store and settles through its view at teardown instead.
              _receipt = view || opts?.caps?.receipt !== true ? null : makeReceiptCapability({
                post: _post,
                handles: () => _handles,
                flushOwn: async () => { await Promise.all([_ownedRepo?.flush(), _repo?.flush()]); },
              });
              if (_receiptDoorClosed) _receipt?.close();
              adaptor.caps = { receipt: _receipt };
              adaptor.receiptRequired = opts?.caps?.receipt === true && view === null;
              // The bridge compares wiki notifications with the landed ledger and sends hands through the gate.
              _bridgeUnsub = bridgeWikiToAdaptor(tw5, adaptor);
              // Await the shore's seed checkpoint before arming behavior: onEa observes a fully resident seed,
              // landed by the shore's queue in host-task slices. Each landed slice ticks the breath's progress, so the
              // vessel's stall watchdog reads a long seed as moving; a drain that lands no slice ticks nothing.
              tick("seed-drain");
              await seedDrained(tw5, () => tick());
              // THE STORY OPENS AT THE ISLAND'S FIRST WHOLE SNAPSHOT, never inside engine boot: the wiki's own landing has landed
              // by now, and a personal `$:/StoryList` the seed carried stays (`default-story.ts`). A composition with no layer for the
              // story keeps it in the engine alone, so the island owes no save it cannot make (`island-story.ts`).
              openIslandStory(tw5, adaptor);

              // Isomorphic base: the catalog registry's grant rides into ctx (access entry, NOT a
              // load slot — the catalog registry is absent from expandRecipe). Worker behaviors build
              // a CatalogAccessor over it to reach any registered bag; recipe-watch keeps
              // reconciling the SAME path boot just walked.
              // The CID plane the kernel already pulls engine/plugin bytes from, lifted to
              // behaviors: a residency handler resolves a carrier body a verb rode by reference.
              _ctx = { wikiUri: msg.wikiUri, composite: _composite!, ...(_control ? { control: _control } : {}), ...(msg.grants.floorKey ? { floorKey: msg.grants.floorKey } : {}), ...(floorCanon ? { floorCanon } : {}), tw5, handles: _handles, post: _post, requestDrain: () => _adaptor?.requestDrain(), repo: _repo!, kahuaUrl: msg.grants.kahuaUrl ?? null, hearthWorkingUrl: msg.grants.hearthWorkingUrl ?? null, kahuaFace, kahuaFaceWatch, ...(_receipt ? { receipt: _receipt } : {}), catalogUrl, faceCatalogUrl, oracleUrl: msg.grants.islandUrl, engine, recipe: msg.recipe, resolveByCid, ...(msg.coreHash ? { bootSet: { engineCid: msg.coreHash, pluginCids: [...(msg.pluginCids ?? [])] } } : {}), diskMirrors: msg.diskMirrors ?? [], ...(resolved ? { resolvedMount: true } : {}), ...(view ? { viewCatalog: (name: string) => view.catalog(name) } : {}), ...secretHomeOf(msg) };
              // Read-side skinny-handle rehydration: answer TW5's own `lazyLoad` event (fired when
              // `getTiddlerText` meets a bodyless `_is_skinny` tiddler) by pulling the body from the corpus
              // CAS through the SAME resolveByCid shore the kernel already rides for engine/plugin blobs. The
              // splice runs through the guarded nalu rail, so a rehydrated body never echoes back to the CRDT
              // (content-resolution.mem #tw5-shore). The boot above already refused an island with no CAS resolver.
              _lazyUnsub = installLazyResolver(tw5, resolveByCid);
              return await behavior.onWritable?.(_ctx!) ?? { state: "standing" };
              }, async () => {
                const unsub = _bridgeUnsub;
                _bridgeUnsub = null;
                _lazyUnsub?.();
                _lazyUnsub = null;
                await detachFaultedWritable(_adaptor, unsub);
                _adaptor = null;
                _ctx = null;
                _receipt = null;
              });
            },
          });
        },
      });
    } catch (err) {
      const stack = err instanceof Error ? (err.stack ?? String(err)) : String(err);
      _post(mkFault(msg.wikiUri, `bootTw5 threw: ${stack}`));
      return;
    }
    if (bootInstance?.larariumWritableFault) {
      const error = bootInstance.larariumWritableFault;
      _post(mkFault(msg.wikiUri, `lararium-writable failed: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    if (!used || !_ctx) {
      _post(mkFault(msg.wikiUri, "lararium-writable startup marker did not stand the backing"));
      return;
    }
    tick("behavior");
    await behavior.onEa(_ctx);

    tick("ea");
    handler.sendEa(msg.wikiUri);
    if (deferredCanon) void _mountDeferredCanon(msg, deferredCanon.slot, deferredCanon.url);
  }

  /**
   * Mount the face's canon once ea stands (see `deferredCanon`): resolve its document, then splice its layer in just above the
   * nearest layer the recipe lays beneath it. A canon that never arrives, or an island torn down meanwhile, mounts nothing and
   * says so; the daemon wiki stands on its other layers.
   */
  async function _mountDeferredCanon(msg: IslandMsg_Manifest, slot: SlotUri, docUrl: string): Promise<void> {
    const composite = _composite;
    const repo = _repo;
    if (!composite || !repo) return;
    const out = await waitForSlotDocument<DocHandle<LarDoc>>({
      find:      () => repo.find<LarDoc>(docUrl as AutomergeUrl),
      peerCount: () => repo.peers.length,
      absence:   (rejection) => rejection instanceof Error && /is unavailable/.test(rejection.message),
      now:       mono,
      lastHeard: () => _lastSyncHeardAt,
      ...(_storeOf.has(repo) ? { store: () => _storeOf.get(repo)!.reading() } : {}),
      sleep:     (ms) => new Promise((res) => setTimeout(res, ms)),
      defer,
      onWake: (wake) => {
        _syncWakes.add(wake);
        repo.networkSubsystem.on("peer", wake);
        return () => { _syncWakes.delete(wake); repo.networkSubsystem.off("peer", wake); };
      },
      budgets:   { verdictGraceMs: SLOT_VERDICT_GRACE_MS, hardCapMs: SLOT_READY_HARD_CAP_MS, pollMs: SLOT_POLL_MS },
    }).catch((error: unknown) => ({ outcome: "refused" as const, why: error instanceof Error ? error.message : String(error) }));
    if (_composite !== composite) return;
    if (out.outcome !== "ready") {
      console.warn(`[island] the face's canon ${slot} did not mount after ea (${out.outcome}${"why" in out ? `: ${String(out.why)}` : ""}${"phase" in out ? `, ${out.phase}` : ""}): the daemon wiki stands on its other layers`);
      return;
    }
    if (composite.hasBag(slot)) return;
    const store = new AutomergeDocStore(out.handle, slot, wearOf(repo));
    composite.addLayer({ bagId: slot, store, ...slotLayerFlags(slot, msg.recipe.wikiSlug) }, recipeLayerIndex(composite, msg.recipe, slot));
    _handles.set(slot, out.handle);
    store.emitInitialReplay();
    store.markSyncComplete();
  }

  // ── Teardown / Demote (OTP terminate) ──────────────────────────────────────

  async function _handleTeardown(): Promise<void> {
    // A hand whose `change` dispatch still sits queued in the wiki reaches the shore before the bridge
    // unhooks, so `stop()` flushes it as a marked title.
    if (_adaptor) await _adaptor.awaitWikiDispatch();
    _bridgeUnsub?.();
    _bridgeUnsub = null;
    // THE SETTLEMENT ROUND (L29, no island clock). The receipt door stays open while stop submits every owed write; the vessel
    // answers each ask as it comes. Once every ask has left (owed writes, removals behind their targets, acts), the island says
    // `receipt:asks-done`; the vessel answers what remains and sends `receipt:close`. That close, the sync port closing, or the worker
    // leaving ends every wait still out: a refused wait leaves its title owed and named unsaved. A worker wedged alive meets the
    // vessel's own force-kill, the one liveness.
    const receipt = _receipt;
    let unsaved: readonly string[] = [];
    let asksDone = false;
    // AN ISLAND WITH NO STORE OF ITS OWN SETTLES ITS LAST HEADS. What it wrote rests only once the vessel's Repo holds it, and a
    // change that rode no owed write (a verb's direct edit) reaches the vessel by sync alone. So once its owed asks have left, the
    // island asks one more receipt over every document it laid, naming the heads it holds; the vessel answers once its own copy
    // holds them and has flushed. The ask leaves before `receipt:asks-done`, so the round's close answers it. It rides in asks of
    // at most SETTLE_BATCH documents, the most one receipt names. A settle the vessel refuses names its documents' slots among the
    // unsaved, so the teardown faults by name rather than acking over a change no store holds.
    let settling: Promise<void> | null = null;
    const unsettled: string[] = [];
    const settleLastHeads = (): void => {
      if (settling || !receipt || _keepsStore || _handles.size === 0) return;
      const slots = [..._handles.keys()];
      const asks: Promise<void>[] = [];
      for (let at = 0; at < slots.length; at += SETTLE_BATCH) {
        const batch = slots.slice(at, at + SETTLE_BATCH);
        asks.push(receipt.ack(batch).catch((err: unknown) => {
          console.warn(`[sovereign-kernel] teardown settle: the vessel holds no receipt for this island's last heads (${String(err)})`);
          unsettled.push(...batch.map((slot) => `the last heads of ${slot}`));
        }));
      }
      settling = Promise.all(asks).then(() => undefined);
    };
    const announce = async (): Promise<void> => {
      if (!receipt) return;
      await receipt.asked();
      if (asksDone || _receiptDoorClosed) return;
      asksDone = true;
      _asksDonePosted = true;
      try { host.post({ type: "receipt:asks-done" }); } catch { /* the vessel went away: its close ends the waits */ }
    };
    try {
      if (_adaptor) unsaved = (await _adaptor.stop(() => { settleLastHeads(); void announce(); })) ?? [];
      settleLastHeads();
      await announce();
      await settling;
      await receipt?.idle();
      // A port write or act whose receipt refused or closed never reached durable storage either: it joins the drain's titles by name.
      if (receipt) unsaved = [...new Set([...unsaved, ...receipt.unrested(), ...unsettled])];
    } finally {
      receipt?.close();
    }
    _adaptor = null;
    _lazyUnsub?.();
    _lazyUnsub = null;
    if (_ctx && behavior) await behavior.onHooAnu(_ctx);
    handler.teardown();

    // DURABLE FLUSH before ack, for an island that keeps a store of its own (the daemon island): automerge-repo persists
    // on a debounced timer, and a bare terminate before it fires loses the write. flush() resolves once the bytes are
    // durable, so the vessel's disposeAll() handshake completes only after the write rests (flush-then-ack;
    // answerTeardown acks once this body returns, or names a fault when a step throws). An island with no store rests
    // nothing here: its writes reach rest through the vessel's receipts above.
    if (_repo) {
      try { await _repo.flush(); }
      catch (err) { console.warn(`[sovereign-kernel] teardown flush failed: ${String(err)}`); }
    }
    // A SESSION ISLAND KEEPS NO STORE, so the flush above rests nothing. What it wrote lives on only once the
    // vessel's owner holds it: the island names the heads of every document it laid and waits for the owner's
    // word before it acks. A view that closed first answers at once, and the vessel's own handshake budget
    // bounds the wait.
    if (_view) {
      const heads: Record<string, string[]> = {};
      for (const handle of _handles.values()) heads[handle.url] = replicaHeads(handle);
      try { await _view.settle(heads); }
      catch (err) { console.warn(`[sovereign-kernel] teardown settle failed: ${String(err)}`); }
    }
    if (_ownedRepo) {
      try { await _ownedRepo.flush(); }
      catch (err) { console.warn(`[sovereign-kernel] owned-document flush failed: ${String(err)}`); }
    }

    _view?.close();
    _view = null;
    _receipt = null;
    _handles.clear();
    _composite = null;
    _ctx       = null;
    // EACH REPO SHUTS DOWN BEFORE THE ACK. A shutdown closes the storage adapter, so a sync arrival after the
    // flush starts no save the vessel's terminate could cut: a later save reads as late and lands no byte.
    try { await _ownedRepo?.shutdown(); } catch { /* teardown remains best-effort after flush */ }
    try { await _repo?.shutdown(); } catch { /* teardown remains best-effort after flush */ }
    _repo      = null;
    _ownedRepo = null;

    // Every durable step above ran. A title that never reached durable storage reaches the vessel BY NAME, never a silent ack:
    // the throw becomes answerTeardown's named `teardown-fault`, which ends the vessel's teardown wait unacked.
    if (unsaved.length > 0) throw new Error(`unsaved at teardown: ${unsaved.map((title) => JSON.stringify(title)).join(", ")}`);
  }
}
