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
  makeWardAlertReactor,
  makeAddBagReactor, makeRemoveBagReactor, makeCompactBagReactor, makeRotateRecipeReactor,
  makeSwitcherStateReactor,
  makePersonaStateReactor,
  makeCircleStateReactor,
  makeCircleReactors,
  makePersonaSelvesReactors,
  makeCabalRealmReactors,
} from "@lararium/tw5";
import { DAEMON_BAG_ID, AutomergeDocStore, personaBagIdFor, personaSiblingBagIds, leaseEpochPrefix, effectiveLeaseEpoch, didFromVerifyingKey, computeRecipeFingerprint, wikiBagUri, wikiSlotUri, mutableLarRecord, type ChangeOrigin } from "@lararium/mesh";
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
  /** `bagTier` — the SAME inversion for the crossing gate's tier reader: keyhive stays fs-blind, so
   *  NODE injects the reader over its hearth bag manifests. Threaded into the ACTION verb handlers,
   *  where `crossingDirection` prices a transfer by direction. Absent (a browser vessel, tests) →
   *  the gate fail-closes every bag to VEIL and prices every transfer lateral, as before. */
  bagTier?: (bagUrl: string) => import("@lararium/mesh").CapTier | null;
};
import { verifyAuthProof, verifyEdgeAgainstPersonaKel, classifyCrossOperatorAdmission } from "@lararium/mesh";
import { bootDaemonKeyhive } from "./boot-daemon-keyhive.js";
import { deriveDyadVeil, hexToBytes as meshHexToBytes } from "@lararium/mesh";
import { DaemonEventStore } from "./daemon-event-store.js";
import { makeSlotDocResolver, type SlotDocResolver } from "./slot-doc-resolver.js";
import { runFaceJoin, type FaceJoinSummons } from "./face-join.js";
import { faceGrantTitle, FACE_GRANT_PREFIX, signFaceGrantRecord, verifyFaceGrantRecord, type FaceGrantRecord } from "./face-grant-record.js";
import { base64ToBytes } from "./bytes-base64.js";
import { ed25519SignerFromSeed, type LarTiddlerRecord } from "@lararium/mesh";
import { KeyhiveProvider } from "./keyhive-provider.js";

/**
 * Build the operator's daemon-island behavior from a manifest. With no auth
 * material, falls back to the verifier-less behavior (delegated-verb path only);
 * daemon manifests always carry daemonAuth, so that path guards tests.
 */
export function operatorDaemonOptions(manifest: IslandMsg_Manifest, extra: DaemonExtra = {}): DaemonBehaviorOptions {
  // persistArchive + vault ride node-only; keep them OUT of the makeDaemonBehavior spread (not DaemonBehaviorOptions).
  const { persistArchive, persistVeilArchive, vault, bagTier, ...daemonExtra } = extra;
  const daemonAuth = manifest.daemonAuth;
  if (!daemonAuth) return { ...daemonExtra };

  let kh: KeyhiveProvider | null = null;
  // The VEIL identity — the group's creator, re-derived from (vessel seed × persisted tag). Stands
  // beside the vessel identity at boot; sentinel ops (the face-join seat) run through it, while bag
  // delegation and transport stay the vessel's. Absent tag → a pre-veil-born doc; joins refuse there.
  let veilKh: KeyhiveProvider | null = null;
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
      if (typeof rec?.sig !== "string" || judgedGrants.has(rec.sig)) continue;
      judgedGrants.add(rec.sig);
      const verdict = await verifyFaceGrantRecord(rec, {
        personaRootDid: ownEdge.personaRootDid, selfVerifyingKey: self, groupDocIdHex: group, now: Date.now(),
        ...(daemonAuth.personaKel ? { personaKel: daemonAuth.personaKel } : {}),   // the edge verifies under the KEL HEAD, never a frozen root
      });
      if (!verdict.ok) {
        console.log(`[daemon] face-join grant record REFUSED (${title.slice(-16)}): ${verdict.reason} — no binding moves`);
        continue;
      }
      // THE KIT'S OWN ACT: ingest the cap events (live) and persist them (boot re-hydrates the seat).
      const events = rec.capEvents.map(base64ToBytes);
      const eventStore = new DaemonEventStore({ daemon: ctx.composite });
      for (const bytes of events) {
        try { await eventStore.put({ bytes, variant: "cap-membership", hash: "" }); } catch { /* a persisted duplicate reads fine */ }
      }
      try { await kh.ingestPeerEvents(events); } catch (err) { console.log(`[daemon] face-join grant: vessel ingest faulted: ${(err as Error)?.message ?? err}`); }
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
      repo: ctx.repo, daemonStore: ctx.composite, keyhive: kh,
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

  // THE DAEMON WIKI HOLDS A WORKING LAYER ABOVE ITS OWN BAG (operator ruling: "working layers for
  // all wikis"). The vessel builds the daemon's grants before the VM hosting this resolver exists, so
  // the layer arrives by a LATE ATTACH: the working doc resolves through the same resolver under the
  // same binding law as every wiki's, splices above the daemon bag as the default writable, and the
  // cascade's `current-wiki-bag` re-seeds to it — a `lar:` save and the `meme put` anchor land there
  // from then on. The daemon bag beneath keeps the control plane (verbs, outcomes, bindings).
  const attachDaemonWorking = async (ctx: IslandContext): Promise<void> => {
    const slug = ctx.recipe.wikiSlug;
    const working = wikiSlotUri(slug, "working");
    if (ctx.composite.hasBag(working)) return;
    const daemonUrl = ctx.handles.get(wikiBagUri(slug))?.url;
    if (!daemonUrl) return;
    const recipeTrace = { wikiDocId: daemonUrl, libraryBagDocIds: [] as readonly string[] };
    const fingerprint = await computeRecipeFingerprint(recipeTrace);
    const { workingUrl } = await slotDocsOf(ctx).bindings(fingerprint, recipeTrace, slug);
    const handle = await findOrThrow(ctx.repo, workingUrl, `${working} (the daemon's working layer)`);
    const store = new AutomergeDocStore(handle, working);
    const at = ctx.composite.layerIndexOf(wikiBagUri(slug)) + 1;
    ctx.composite.addLayer({ bagId: working, store, writable: true, defaultWritable: true }, at);
    ctx.handles.set(working, handle);
    store.emitInitialReplay();
    store.markSyncComplete();
    // The cap gate keys on the slot's lar: URI — register it the way the vessel registers every wiki
    // bag it grants, delegated to the face where one is seated.
    await kh!.registerBag(working);
    if (daemonAuth.personaGroupAgentIdHex && veilKh && await (veilKh ?? kh!).knowsAgent(daemonAuth.personaGroupAgentIdHex)) {
      await delegateToFaceViaVeil(working, "admin");
    }
    const temp = wikiSlotUri(slug, "temp");
    if (ctx.composite.hasWritableBag(temp)) {
      const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "daemon-working-attach" };
      await ctx.composite.put(mutableLarRecord("lar:///ha.ka.ba/lararium/config/current-wiki-bag", { text: working }, "daemon-working-attach"), origin, { bag: temp });
    }
    console.log(`[daemon] working layer attached: ${working}`);
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
        const sysPlane = makeCatalogAccessor(ctx.repo, ctx.oracleUrl);
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
        const circleReactors = makeCircleReactors({ resolveStore: resolveCirclesStore, tw5: ctx.tw5 });

        // A FACELESS FLOOR NAMES THE LIFT — the one refusal every face-scoped verb hands back.
        //
        // The floor is a state a vessel LIFTS out of, so a refusal there carries the act that lifts it
        // (the law `holdings-witness` keeps for its own corrections: a refusal says what would change the
        // answer). The closure reaches for no face, so standing it costs the boot nothing.
        const lightAFace = (verb: string): VerbReactor => async () => {
          throw new Error(
            `[daemon] ${verb}: this vessel stands at the WAKING FLOOR and holds no face — ` +
            "light one with `lares persona new 0 --name '<label>'`, then stand the vessel again.",
          );
        };

        // The OWN-PERSONA name verbs over the sovereign persona doc — the human's labels for their OWN faces
        // (the private pet-name + the declared Handle), riding the same PRIVATE tier one plane over: the
        // self-slot FLEET-syncs the persona plane same-operator so a rename lands on ALL the operator's own devices,
        // and the DeterministicFederationGate never volunteers it to a cross-operator. The `seat` claim does
        // NOT ride — a Kahu chair names a seat on a PARTICULAR node, so each node keeps its own. No board
        // shore is reachable here: only a publicly announced Handle binds a persona to a public glamour.
        // The plane is reached by the name its own PersonaGroup derives — the same string the registry
        // entry, the composite layer and the capability ring use. `daemonAuth` already carries the group's
        // doc id, so the resolution happens here rather than travelling as a second parameter.
        // A FACELESS PLACE OFFERS NO PERSONA VERBS.
        //
        // A founding stands a PLACE first — carrying, serving the public shelf — and lights a FACE after. In
        // that window `faceGroup()` names nothing, and reaching for it HERE would throw during the wiring pass
        // itself, taking the whole boot with it. So these register only where they can act, the gate the vault
        // verbs already keep: absent the thing they need, they never register at all. A caller then meets an
        // unknown verb rather than a verb that throws, which is the honest answer to "this place holds no face".
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

          // A PERSONA PLANE IS A USER BAG, SO IT RESOLVES FROM THE CATALOG REGISTRY.
          //
          // Three registries stand and each answers its own question. the oracle plane names the SYSTEM bags — the
          // universal floor every vessel carries. the catalog registry names the operator's own bags under their OCAP
          // grants. the crossroads plane names what a stranger may mount. A PersonaGroup's plane belongs to a person,
          // so it lives in the middle one; reaching for it on the system floor asks the wrong plane a
          // question it was never given to answer, and the refusal reads as a missing document.
          const personaBagId = personaBagIdFor(faceGroup());
          const resolvePersonaStore = async () => {
            if (!facePlane) throw new Error("persona-selves-verb: this island carries no catalog plane — a user bag has no registry to resolve from");
            const store = await facePlane.storeOf(personaBagId);
            if (!store) throw new Error(`persona-selves-verb: the PersonaGroup plane is unresolved — the catalog registry names no ${personaBagId}`);
            return store;
          };
          const selvesReactors = makePersonaSelvesReactors({ resolveStore: resolvePersonaStore });
          registry.register("persona-label",  selvesReactors.label);
          registry.register("persona-handle", selvesReactors.handle);
          registry.register("persona-selves", selvesReactors.selves);
        } else {
          // Leaving these unregistered answers a caller "no handler registered for persona-selves" — true,
          // and it hands a human nothing to act on. Every verb that needs a face answers with the lift.
          registry.register("persona-label",  lightAFace("persona-label"));
          registry.register("persona-handle", lightAFace("persona-handle"));
          registry.register("persona-selves", lightAFace("persona-selves"));
          registry.register("circle-add",     lightAFace("circle-add"));
          registry.register("circle-remove",  lightAFace("circle-remove"));
          registry.register("circle-list",    lightAFace("circle-list"));
        }

        // The CABAL-REALM verbs over the daemon bag, where the per-writer lease slots live. `realm-feed` rolls THIS
        // writer's own slot — the offering a realm lives by; `realm-clock` reads every slot back and reports
        // who feeds and how deep, VERDICT-FREE (what spread counts as capture stays the operator's
        // calibration, and mechanizing it here would recreate the root a realm exists without).
        const resolveDaemonStore = async () => {
          const store = await sysPlane.storeOf(DAEMON_BAG_ID);
          if (!store) throw new Error("cabal-realm-verb: daemon bag unresolved — the oracle registry names no DAEMON_BAG_ID");
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
            // The lease read, off the live daemon replica: every slot under this group's prefix, folded by max.
            const store = await resolveDaemonStore();
            const prefix = leaseEpochPrefix(faceGroup());
            const slots: string[] = [];
            for (const title of await store.listVisible()) {
              if (!title.startsWith(prefix)) continue;
              const record = await store.get(title);
              const text = (record as { tiddler?: { text?: unknown } } | undefined)?.tiddler?.text;
              if (typeof text === "string") slots.push(text);
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
            const outcome = await runFaceJoin(joinProvider, summons, {
              personaRootDid:         ownEdge.personaRootDid,
              hearthTrueName:         ownEdge.hearthTrueName,
              personaGroupDocIdHex:   faceGroup(),
              personaGroupAgentIdHex: faceAgent(),
              leaseEpoch:             effectiveLeaseEpoch(slots),
              now:                    Date.now(),
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
            let recordTitle: string | null = null;
            if (outcome.ok && facePlane) {
              try {
                const store = await facePlane.storeOf(personaBagIdFor(faceGroup()));
                if (!store) throw new Error("the PersonaGroup plane is unresolved");
                const { kind: _grantKind, ...grantBody } = outcome.grant;
                void _grantKind;
                const rec = await signFaceGrantRecord({
                  kind: "face-join-grant/v1", groupDocIdHex: faceGroup(), ...grantBody,
                  founderEdge: ownEdge, issuedAt: new Date().toISOString(),
                }, ed25519SignerFromSeed(daemonAuth.seed));
                recordTitle = faceGrantTitle(faceGroup(), outcome.grant.joineeAgentIdHex);
                await store.put(
                  { tiddler: { title: recordTitle, text: JSON.stringify(rec), kind: "face-join-grant" } as LarTiddlerRecord["tiddler"], meta: { authority: "lares-verb" } },
                  { kind: "lares-verb", requestId: `face-grant-${rec.sig.slice(0, 12)}` },
                );
                console.log(`[daemon] face-join: grant record written to the PersonaGroup plane (${recordTitle.slice(-16)}) — the joinee's kit takes the seat on its next present`);
              } catch (err) {
                console.log(`[daemon] face-join: grant record NOT written (${(err as Error)?.message ?? err}) — the grant returns to the caller alone`);
                recordTitle = null;
              }
            }
            return outcome.ok
              ? { verb: "face-join", admitted: true,  ...outcome.grant, ...(recordTitle ? { recordTitle } : {}) }
              : { verb: "face-join", admitted: false, reason: outcome.reason };
          });
        }
      }

      // Disk-ward refusals (wiki-island projector → worker.event bridge) — audit
      // in the daemon bag + $:/tags/Alert into the operator's pinned VM.
      registry.register("ward-alert", makeWardAlertReactor(ctx.composite, ctx.post));

      // The at-rest seal LIFECYCLE (#60) — DAEMON-FIRST: seal/rotate/export/repair/status route THROUGH
      // this worker (which owns the M3 archive re-seal), so the daemon updates its OWN in-memory seal
      // policy in the same act it re-persists the carriers — no un-rotate. The node-injected `vault`
      // handler does the fs + policy work (keyhive stays fs-blind). The passphrase rides the args over
      // the owner-only 0600 UDS. Absent injection (no fs) → the verbs never register.
      if (vault) {
        for (const v of ["vault-status", "vault-seal", "vault-rotate", "vault-export", "vault-repair"] as const) {
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
          rootDir:     "",
          vesselDid: async () => didFromVerifyingKey(daemonAuth.vesselVerifyingKey),
          registerBag: registerBagCap,
          resolveDraftDoc: (slug: string) => slotDocsOf(ctx).draft(slug),
        };
        registry.register("init-wiki",   makeInitWikiReactor(wikiMintOpts));
        registry.register("open-wiki",   makeOpenWikiReactor({ composite: ctx.composite, catalog, post: ctx.post }));
        registry.register("prune-stale", makePruneStaleReactor(wikiMintOpts));
        registry.register("list-wikis",  makeListWikisReactor(catalog, sysPlane));
        // Whole-wiki residency policy — read the catalog recipe, command main's manager
        // per bag via daemon:residency-op. Pure policy, no live-layer mechanism.
        registry.register("pin-wiki",      makeWikiPinReactor(catalog, ctx.post));
        registry.register("unpin-wiki",    makeWikiUnpinReactor(catalog, ctx.post));
        // Recipe composition — write the catalog recipe, command residency via op. NO
        // live-layer mount/unmount: the recipe syncs, islands reconcile their own stacks.
        registry.register("add-bag",       makeAddBagReactor({ catalog, post: ctx.post }));
        registry.register("remove-bag",    makeRemoveBagReactor({ catalog, post: ctx.post }));
        // Catalog-writing residency verbs — mint/oracle via accessor + repo, command
        // residency via post. No live-layer swap (oracle/recipe sync; islands reconcile).
        registry.register("bag-compact", makeCompactBagReactor({ repo: ctx.repo, catalog, post: ctx.post }));
        registry.register("rotate-recipe", makeRotateRecipeReactor({ repo: ctx.repo, catalog, post: ctx.post }));
      }
    },
    verifierFactory: async (ctx: IslandContext) => {
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
        ...(daemonAuth.archiveBytes ? { archiveBytes: daemonAuth.archiveBytes } : {}),
      });
      kh = keyhive;
      mintedByHex = did;
      if (daemonAuth.dyadVeilTag) {
        const veilKeys = await deriveDyadVeil(daemonAuth.seed, daemonAuth.dyadVeilTag);
        const v = new KeyhiveProvider();
        await v.init({
          seed: meshHexToBytes(veilKeys.signingKey),
          eventStore: new DaemonEventStore({ daemon: ctx.composite }),
          ...(daemonAuth.veilArchiveBytes ? { archiveBytes: daemonAuth.veilArchiveBytes } : {}),
        });
        await v.hydrateFromEventStore();
        veilKh = v;
        if (persistVeilArchive) {
          try { await persistVeilArchive(await v.exportArchive()); }
          catch (err) { console.warn(`[daemon] veil archive export skipped: ${(err as Error)?.message ?? err}`); }
        }
      }
      // M3 — seed the on-disk archive FLOOR every boot: exportArchive() captures the founding +
      // hydrated membership/capability DAG (+ prekey secrets) so a later torn daemon doc restores from
      // here instead of orphaning the veiled Handle. Best-effort — a failed export never blocks boot.
      if (persistArchive) {
        try { await persistArchive(await keyhive.exportArchive()); }
        catch (err) { console.warn(`[daemon] keyhive archive export skipped: ${(err as Error)?.message ?? err}`); }
      }
      // The daemon's own working layer — after the keyhive and the veil stand, inside the fail-closed
      // boot window (never earlier). A failed attach leaves the write layer on the daemon bag, the
      // floor; it never takes the boot down.
      try { await attachDaemonWorking(ctx); }
      catch (err) { console.warn(`[daemon] working layer attach skipped — saves land in the daemon bag: ${(err as Error)?.message ?? err}`); }
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
          ts:         proof.ts,
          sig:        proof.sig,
          now:        Date.now(),
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
        const delegation    = await verifyEdgeAgainstPersonaKel(edge, kel.chain, { now: Date.now() });
        const deviceMatches = edge.deviceDid === id;
        if (delegation.ok && deviceMatches && proofVerified) {
          // Admitted at the operator's-own-device tier — equivalent flow to admin (it IS the
          // operator's delegated device). `reason` carries the provenance (survives the worker→host
          // boundary; the gate ignores it on an ok verdict but it aids audit).
          //
          // SELF-SLOT CLASS: the edge chains to the persona-KEL head op-key — THIS hearth's pinned
          // identifier's current authority — and binds to the exact identity that proved key-possession. A
          // cross-operator cannot forge an edge chaining to a KEL it never heads, so a verified head-chained
          // edge PROVES same-operator (the operator's own device fleet, a distinct device key under one identity).
          return { ok: true, identifier: id, proofVerified, reason: "admitted via operator device-delegation", peerClass: "same-operator" as const };
        }
        return {
          ok: false, identifier: id, proofVerified,
          reason: !delegation.ok  ? `device-delegation rejected: ${delegation.reason ?? "(no reason)"}`
                : !deviceMatches  ? "device-delegation edge not bound to the presented identity"
                :                   "device-delegation requires a verified proof-of-possession",
        };
      }

      // GATE-WIDENING — CROSS-OPERATOR bounded carriage (carry-contract MANDATORY tier). The peer holds
      // NEITHER cap=admin@daemon NOR a valid pinned-root device-edge, yet it proved a valid self-certifying
      // identity (receiveContactCard) and, under enforcement, key-possession (proofVerified — the early
      // return above already guaranteed it). A DIFFERENT operator identity (a cabal-mate / another kahu)
      // earns the BOUNDED "cross-operator" class: the node sharePolicy grants it ONLY the deterministically-
      // federatable public/infra planes (crossroads/WHO/kapae-antigen), NEVER a private-own plane, NEVER
      // admin. FAIL-CLOSED on the widened surface — a foreign identity that cannot prove possession draws a
      // DENY (the classifier gates on proofVerified; the LAR_V3_ALLOW_UNPROVEN escape hatch relaxes the
      // operator's OWN device fleet above, never a foreign presenter). The #59 antigen draws Mu on a Kapae'd
      // cross-operator AHEAD, at the sharePolicy.
      const cross = classifyCrossOperatorAdmission(proofVerified);
      if (cross.ok) {
        return { ok: true, identifier: id, proofVerified, reason: cross.reason, peerClass: cross.peerClass };
      }
      // No proven possession → the existing capability denial stands (fail-closed).
      return { ...verdict, identifier: id, proofVerified, reason: verdict.reason ?? cross.reason };
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
