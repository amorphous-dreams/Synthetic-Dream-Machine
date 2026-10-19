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

import {
  CompositeStore,
  ENGINE_CORE_ID,
  ORACLE_BAG,
  wikiBagUri,
  wikiSlotUri,
  expandRecipe,
  mkBreath,
  mkFault,
  isVesselToIslandMsg,
  mkTeardownAck,
  makeIslandRepo,
  replicaHeads,
  sha256HexBytesSync,
  GENESIS_FLOOR_TIDDLER,
  plainRecordOrNull,
  resolveFloor,
  type Repo,
  type DocHandle,
  type AutomergeUrl,
  type StorageAdapterInterface,
  type LarDoc,
  type IslandMsg_Manifest,
  type IslandToVesselMsg,
  type SlotUri,
  type LarTiddlerRecord,
} from "@lararium/mesh";
import { IslandKernel } from "./island-kernel.js";
import { waitForSlotDocument } from "./slot-wait.js";
import { buildIslandRecipe, seedDrained } from "./island-recipe.js";
import { preloadsFromCasBlob } from "./cas-preloads.js";
import { makeCatalogAccessor } from "./catalog-accessor.js";
import { installLazyResolver } from "./lazy-resolver.js";
import { bridgeWikiToAdaptor } from "./outbound-bridge.js";
import { makeViewChannel, type ViewChannel } from "./view-channel.js";
import type { IslandContext, IslandBehavior } from "./island-context.js";

// ── The host shore — platform divergence as composition ──────────────────────

export interface IslandHostShore {
  /** Transport out: post a message to the vessel. */
  post(msg: IslandToVesselMsg): void;
  /** Transport in: register the inbound message listener. */
  listen(onMessage: (raw: unknown) => void): void;
  /** Build the Repo storage adapter for this manifest (undefined = in-memory). */
  storage(msg: IslandMsg_Manifest): StorageAdapterInterface | undefined;
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
  opts?: { breathEveryMs?: number },
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
  let _composite: CompositeStore | null = null;
  let _ctx:       IslandContext | null  = null;
  let _lazyUnsub: (() => void) | null   = null;
  let _bridgeUnsub: (() => void) | null = null;   // the outbound bridge (Road B) — one listener, cancelled at teardown
  let _adaptor: import("./island-adaptor.js").IslandAdaptor | null = null;
  let _activeWikiUri                    = "";
  // A session island's two asked gates (catalog names, content addresses) ride this channel; null outside a session.
  let _view: ViewChannel | null         = null;

  // Live CRDT patches flow through AutomergeDocStore.handle.on("change") →
  // MemeProvider → IslandAdaptor → the shore queue. The packed engine is a synchronous applier;
  // the shore owns quota, host-task pacing, and the seed checkpoint.

  // ── Message dispatch ──────────────────────────────────────────────────────

  host.listen((raw: unknown) => {
    if (!isVesselToIslandMsg(raw)) return;
    if (_view?.settleAnswer(raw)) return;

    if (raw.type === "manifest") {
      void _handleManifest(raw as IslandMsg_Manifest);
      return;
    }

    if (raw.type === "teardown" || raw.type === "hooanu") {
      void _handleTeardown();
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
    const breathTimer = setInterval(() => breathe(), breathEveryMs);
    // Any throw during init (incl. a behavior.onEa gate failure, e.g.
    // bootDaemonKeyhive Gate A/B/C) posts fault so the vessel times out cleanly
    // instead of hanging without an ea.
    try {
      await _doManifest(msg, tick);
    } catch (err) {
      _post(mkFault(msg.wikiUri, `manifest handler threw: ${String(err)}`));
    } finally {
      clearInterval(breathTimer);
    }
  }

  // ── Slot resolution — silence-measured wait, fault loudly, never hang ──────
  //
  // Partition-as-normal-state: a doc that has not yet arrived over syncPort
  // gets a bounded wait; a doc that never arrives produces a LOUD fault the
  // vessel can read, never a mute hang the vessel must guess at by timeout.
  //
  // Silence is MEASURED on the syncPort (monotonic, suspend-blind), never
  // inferred from a fixed wall deadline: during a fresh-corpus boot both the
  // vessel main thread and this island wedge for whole seconds in synchronous
  // automerge/keyhive work, so a bare 8s `Promise.race` faulted a LIVE sync
  // whose response sat queued behind the wedge (personal never
  // "arrived" while its doc sat on disk the whole time).
  // The vessel-host ea-wait carries the same law; this is its island-side twin:
  //   - the budget clocks port-silence, re-armed by ANY inbound sync traffic
  //     (a busy peer mid-corpus-sync reads live, not absent);
  //   - a verdict defers one turn so queued port messages land first;
  //   - a hard cap keeps the loud-fault law when traffic flows forever without
  //     the doc (the vessel's mount stall budget backstops far above it).
  const SLOT_SILENCE_TIMEOUT_MS = 8_000;
  const SLOT_READY_HARD_CAP_MS  = 60_000;
  const SLOT_POLL_MS            = 250;
  const mono = (): number => performance.now();
  const defer = (): Promise<void> =>
    new Promise((res) => (typeof setImmediate === "function" ? setImmediate(res) : setTimeout(res, 0)));
  let _lastSyncHeardAt = mono();
  const _markSyncHeard = (): void => { _lastSyncHeardAt = mono(); };

  async function _resolveSlot(
    repo: Repo,
    docUrl: string,
    slot: string,
    wikiUri: string,
  ): Promise<DocHandle<LarDoc> | null> {
    // The wait's law lives in `slot-wait`: a rejection counts as a verdict only when a peer stood connected to
    // give it. This island's one peer is the vessel's main thread, and a Repo with no peer connected settles a
    // find "unavailable" at once, so an ask that lands while the main thread stalls (a key derivation at an
    // unlock, a corpus load) gets asked again inside the same silence and hard-cap budgets.
    const out = await waitForSlotDocument<DocHandle<LarDoc>>({
      find:      () => repo.find<LarDoc>(docUrl as AutomergeUrl),
      peerCount: () => repo.peers.length,
      // The library words an unavailable document so (`DocumentQuery`); the node package pins the wording
      // (`repo-without-a-peer-rejects.test.ts`), and any other rejection ends the wait at once as a refused ask.
      absence:   (rejection) => rejection instanceof Error && /is unavailable/.test(rejection.message),
      now:       mono,
      lastHeard: () => _lastSyncHeardAt,
      sleep:     (ms) => new Promise((res) => setTimeout(res, ms)),
      defer,
      budgets:   { silenceMs: SLOT_SILENCE_TIMEOUT_MS, hardCapMs: SLOT_READY_HARD_CAP_MS, pollMs: SLOT_POLL_MS },
    });
    if (out.outcome === "ready") return out.handle;
    if (out.outcome === "never-arrived") {
      _post(mkFault(wikiUri,
        `slot ${slot} unavailable — doc ${docUrl} never arrived over syncPort ` +
        `(${out.silentMs}ms port-silence, ${out.elapsedMs}ms elapsed; ` +
        `silence budget ${SLOT_SILENCE_TIMEOUT_MS}ms, hard cap ${SLOT_READY_HARD_CAP_MS}ms)`));
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
    // A SESSION ISLAND (`msg.view`) holds an EPHEMERAL replica on every platform: no storage adapter stands
    // behind its Repo whatever the host would offer, and its Repo announces the one peer ID its scoped view
    // admits. The vessel's owner alone persists.
    _view = msg.view ? makeViewChannel(_post) : null;
    const storageAdapter = msg.view ? undefined : host.storage(msg);
    _repo = makeIslandRepo({
      ...(storageAdapter ? { storage: storageAdapter } : {}),
      syncPort: msg.syncPort,
      ...(msg.view ? { peerId: msg.view.peerId } : {}),
      ...(msg.ownedDocument ? { denyDocument: msg.ownedDocument.documentUrl } : {}),
    });
    // A SESSION ISLAND HOLDS NO CONTENT STORE: every content read asks its view, and the vessel's owner answers
    // with the bytes or a refusal. The host's own resolver never gets asked. Each caller below re-checks the
    // bytes against the address, as it does for bytes from any store.
    const view = _view;
    const resolveByCid: IslandHostShore["resolveByCid"] = view ? (cid) => view.content(cid) : host.resolveByCid;
    if (msg.ownedDocument) {
      const ownedManifest = msg.ownedDocument.storage
        ? { ...msg, storage: msg.ownedDocument.storage, syncPort: msg.ownedDocument.syncPort }
        : { ...msg, syncPort: msg.ownedDocument.syncPort };
      const ownedStorage = host.storage(ownedManifest);
      _ownedRepo = makeIslandRepo({
        ...(ownedStorage ? { storage: ownedStorage } : {}),
        syncPort: msg.ownedDocument.syncPort,
        documentScope: msg.ownedDocument.documentUrl,
      });
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
    const catalog    = catalogUrl ? makeCatalogAccessor(_repo, catalogUrl) : null;

    // The catalog names each vessel's document pointers; the oracle supplies seed rows.
    // Structural instance slots arrive as typed grants.
    const slug = msg.recipe.wikiSlug;
    const slotUrl = async (slot: SlotUri): Promise<string | null> => {
      if (resolved) return slot === ORACLE_BAG ? msg.grants.islandUrl : resolved[slot] ?? null;
      if (slot === wikiSlotUri(slug, "draft"))    return msg.grants.draftUrl    ?? null;
      if (slot === wikiSlotUri(slug, "working"))  return msg.grants.workingUrl  ?? null;
      if (slot === wikiSlotUri(slug, "personal")) return msg.grants.personalUrl ?? null;
      if (slot === wikiBagUri(slug))              return msg.ownedDocument?.documentUrl ?? msg.grants.wikiUrl ?? null;
      if (slot === ORACLE_BAG)                 return msg.grants.islandUrl;
      return catalog ? await catalog.urlOf(slot) : null;
    };

    const slots = expandRecipe(msg.recipe);
    const ready: Array<{ slot: SlotUri; handle: DocHandle<LarDoc> }> = [];

    for (const slot of slots) {
      if (slot === wikiSlotUri(slug, "temp")) continue;
      if (slot === ORACLE_BAG) { ready.push({ slot, handle: laraiumHandle }); continue; }
      const docUrl = await slotUrl(slot);
      if (!docUrl) continue;   // ungranted/unregistered slot — in-memory or absent
      const handle = await _resolveSlot(
        slot === wikiBagUri(slug) && _ownedRepo ? _ownedRepo : _repo,
        docUrl, slot, msg.wikiUri,
      );
      if (!handle) return;     // fault already posted
      _handles.set(slot, handle);
      ready.push({ slot, handle });
      tick();                  // one slot resolved — real progress evidence
    }

    // ── Resolve the TW5 engine + plugin tiddlers ──────────────────────────────
    // The CID plane: the kernel, plugin blobs, and every large blob ride the local CAS,
    // pulled by CID (host.resolveByCid) — immutable bytes fetched by content-address +
    // verified by rehash, off the sync port. The CRDT plane carries no bytes. A missing
    // resolver, a missing coreHash, or a CAS miss faults the boot.
    // The booted engine version rides the SAME genesis blob entry the post-boot
    // engine-watch later compares against (blobs[ENGINE_CORE_ID].version on the
    // oracle doc). Sourcing it here — not a hardcoded "" — arms the anti-rollback
    // check: a later genesis pointing at a LOWER version reads as BACKWARD instead
    // of being silently presented as an upgrade (an empty booted-version made every
    // incoming version sort as newer).
    const coreVersion = String(laraiumHandle.doc()?.blobs?.[ENGINE_CORE_ID]?.version ?? "");
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
        preloads = preloadsFromCasBlob(bytes);
      } catch (err) {
        _post(mkFault(msg.wikiUri, `island cannot read plugin tiddler ${cid.slice(0, 12)}… as JSON: ${err instanceof Error ? err.message : String(err)}`));
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

    tick("tw5-boot");
    try {
      await handler.bootTw5(msg.wikiUri, coreBytes, pluginTiddlers);
    } catch (err) {
      const stack = err instanceof Error ? (err.stack ?? String(err)) : String(err);
      _post(mkFault(msg.wikiUri, `bootTw5 threw: ${stack}`));
      return;
    }

    const tw5 = handler.tw5()!;
    const floorCidField = plainRecordOrNull(laraiumHandle.doc()?.tiddlers?.[GENESIS_FLOOR_TIDDLER])?.tiddler.cid;
    let floorRows: readonly Readonly<Record<string, LarTiddlerRecord>>[] = [];
    if (typeof floorCidField === "string" && floorCidField.length > 0) {
      const floor = await resolveFloor(floorCidField, resolveByCid);
      if ("refusal" in floor) {
        _post(mkFault(msg.wikiUri, `@oracle floor mount refused (${floor.refusal}): ${floor.reason}`));
        return;
      }
      floorRows = [floor.lares, floor.lararium];
    } else {
      console.info("[floor] the genesis seed names no floor; @oracle reads the seed rows alone");
    }
    // One recipe model — buildIslandRecipe walks expandRecipe(msg.recipe),
    // wires temp + every resolved CRDT slot, registers the adaptor, and ARMS
    // the seed replay on the shore's quota-bounded host-task queue.
    tick("recipe");
    const { adaptor } = buildIslandRecipe({
      tw5,
      composite: _composite,
      recipe: msg.recipe,
      ready,
      floorRows,
    });
    _adaptor = adaptor;
    // The bridge compares wiki notifications with the landed ledger and sends hands through the gate.
    _bridgeUnsub = bridgeWikiToAdaptor(tw5, adaptor);
    // Await the shore's seed checkpoint before arming behavior: onEa observes a fully resident seed,
    // landed by the shore's queue in host-task slices.
    await seedDrained(tw5);

    // Isomorphic base: the catalog registry's grant rides into ctx (access entry, NOT a
    // load slot — the catalog registry is absent from expandRecipe). Worker behaviors build
    // a CatalogAccessor over it to reach any registered bag; recipe-watch keeps
    // reconciling the SAME path boot just walked.
    // The CID plane the kernel already pulls engine/plugin bytes from, lifted to
    // behaviors: a residency handler resolves a carrier body a verb rode by reference.
    _ctx = { wikiUri: msg.wikiUri, composite: _composite, tw5, handles: _handles, post: _post, repo: _repo!, catalogUrl, oracleUrl: msg.grants.islandUrl, engine, recipe: msg.recipe, resolveByCid, ...(resolved ? { resolvedMount: true } : {}), ...(view ? { viewCatalog: (name: string) => view.catalog(name) } : {}) };
    // Read-side skinny-handle rehydration: answer TW5's own `lazyLoad` event (fired when
    // `getTiddlerText` meets a bodyless `_is_skinny` tiddler) by pulling the body from the corpus
    // CAS through the SAME resolveByCid shore the kernel already rides for engine/plugin blobs. The
    // splice runs through the guarded nalu rail, so a rehydrated body never echoes back to the CRDT
    // (content-resolution.mem #tw5-shore). The boot above already refused an island with no CAS resolver.
    _lazyUnsub = installLazyResolver(tw5, resolveByCid);
    tick("behavior");
    await behavior.onEa(_ctx);

    handler.sendEa(msg.wikiUri);
  }

  // ── Teardown / Demote (OTP terminate) ──────────────────────────────────────

  async function _handleTeardown(): Promise<void> {
    // A hand whose `change` dispatch still sits queued in the wiki reaches the shore before the bridge
    // unhooks, so `stop()` flushes it as a marked title.
    if (_adaptor) await _adaptor.awaitWikiDispatch();
    _bridgeUnsub?.();
    _bridgeUnsub = null;
    if (_adaptor) await _adaptor.stop();
    _adaptor = null;
    _lazyUnsub?.();
    _lazyUnsub = null;
    if (_ctx && behavior) await behavior.onHooAnu(_ctx);
    handler.teardown();

    // DURABLE FLUSH before ack — persist this island's in-flight Automerge docs
    // (e.g. working) to its own storage so a graceful shutdown NEVER desyncs an
    // actively-written doc. Automerge-repo persists on a debounced timer; a bare
    // worker.terminate() (or SIGKILL) before that timer fires loses the write — the
    // "working never arrived over syncPort" gap. flush() resolves once the bytes
    // are durable. We await it BEFORE posting teardown:ack, so the vessel's
    // disposeAll() handshake only completes after every island's write is on disk
    // (flush-then-force; the vessel's force-timer is the only escape if THIS jams).
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
    _handles.clear();
    _composite = null;
    _ctx       = null;
    // EACH REPO SHUTS DOWN BEFORE THE ACK. A shutdown closes the storage adapter, so a sync arrival after the
    // flush starts no save the vessel's terminate could cut: a later save reads as late and lands no byte.
    try { await _ownedRepo?.shutdown(); } catch { /* teardown remains best-effort after flush */ }
    try { await _repo?.shutdown(); } catch { /* teardown remains best-effort after flush */ }
    _repo      = null;
    _ownedRepo = null;

    host.post(mkTeardownAck());
  }
}
