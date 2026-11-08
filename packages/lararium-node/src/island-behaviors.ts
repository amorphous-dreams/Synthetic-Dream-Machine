/**
 * island-behaviors — node-specific island behavior wiring.
 *
 * The primary-wiki behavior is isomorphic and lives in @lararium/tw5
 * `makeWikiBehavior` (ACTION verb registry + wiki:place-verb dispatch). This
 * file supplies only the node-held capability that composes IN on boot: disk
 * projection (LarDiskProjector, fs). Browser supplies no onBoot — same behavior,
 * the disk capability simply absent.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/island-behaviors
 */

import { resolve as resolvePath, sep } from "node:path";
import { mkWikiVerbResult, wikiSlotUri } from "@lararium/mesh";
import type { IslandMsg_Manifest, WikiMsg_PlaceVerb } from "@lararium/mesh";
import type { VesselJournal } from "@lararium/mesh";
import { exportCarrierFile, exportRecordCarrierFile, makeWikiBehavior, hasWikiSensorium, makeTw5Deserializer, canonicalizeNativeCarrierText, wikiLandedCovers, bindRecoveryAtRest } from "@lararium/tw5";
import type { CarrierFile } from "@lararium/tw5";
import type { IslandBehavior, IslandContext } from "@lararium/tw5";
// PURE subpath (no Automerge/wasm) — the same law `ingest-gate` reads `@lararium/mesh/agile-digest` under.
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { LarDiskProjector } from "./disk-projector.js";
import { namedBagMirror } from "./bag-paths.js";
import { mountDaemonObserve } from "./daemon-observe.js";
import { SyncedTree, syncedTreeDir, syncedTreeKey } from "./synced-tree.js";
import { larProjectionCheckpointDir, larProjectionsHome } from "./vessel-paths.js";
import { readBackTempCarriers, TempLayerHousekeeper } from "./temp-layer.js";
import { loadLaresConfig, tempExpiryDays, tempProjectionConsented } from "./lares-config.js";
import { SHORE_VERB, answerShore } from "./shore-verb.js";
import { bagProjectedEvent } from "./journal-append-gate.js";

export function hostEvent(wikiUri: string, listenable: string, payload: Record<string, string | number | boolean>) {
  return { type: "event" as const, wikiUri, listenable, payload: { ...payload, origin: "channel" as const } };
}

/** The projector this island mounted, while it stands. One island runs per worker, so one seat suffices. */
let mountedProjector: LarDiskProjector | null = null;

/** The disk projector this island mounts right now, or null. */
export function mountedDiskProjector(): LarDiskProjector | null {
  return mountedProjector;
}

/**
 * A PERSON'S ANSWER AT THE DISK SHORE. `lares shore` sends every act down two lines (`shore-core.ts`): `wiki-act`
 * carries the shore verb into the active wiki's island, and the `shore` verb itself reaches the daemon island. Here
 * it arrives as an ordinary `wiki:place-verb`; this door claims it ahead of the island's verb table and
 * answers from the projector the island mounts. An island that mounts no projector refuses by name.
 * Returns true where it claimed the message.
 */
export function claimShoreVerb(
  type: string, raw: unknown, post: IslandContext["post"], projector: () => LarDiskProjector | null = mountedDiskProjector,
): boolean {
  if (type !== "wiki:place-verb") return false;
  const msg = raw as WikiMsg_PlaceVerb;
  if (msg.verb !== SHORE_VERB) return false;
  const requestId = msg.requestId;
  const mounted = projector();
  const answer = mounted === null
    ? Promise.resolve<Record<string, unknown>>({ ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" })
    : answerShore(mounted, msg.args ?? {});
  void answer.then(
    (result) => { if (requestId) post(mkWikiVerbResult({ requestId, result })); },
    (err: unknown) => { if (requestId) post(mkWikiVerbResult({ requestId, error: err instanceof Error ? err.message : String(err) })); },
  );
  return true;
}

/**
 * The projector's carrier door over the VM's export. An export that throws answers no file and says so by
 * uri, since nothing retries it; an export that answers `null` (the honest "this uri has no file") stays quiet.
 */
export function carrierFileOf(exportFn: (uri: string) => CarrierFile | null): (uri: string) => Promise<CarrierFile | null> {
  return (uri) => {
    try { return Promise.resolve(exportFn(uri)); }
    catch (err) {
      console.warn(`[disk-projector] carrier for ${uri} not exported: ${err instanceof Error ? err.message : String(err)}`);
      return Promise.resolve(null);
    }
  };
}

/**
 * THE FAR SIDE CLOSES: a watch that resolves once the island's Repo holds no sync peer, at once where it holds
 * none now, else when its last peer disconnects. The event is the link's own; no clock decides.
 */
export function farSideClosedOf(repo: Pick<IslandContext["repo"], "peers" | "networkSubsystem">): { readonly promise: Promise<void>; readonly cancel: () => void } {
  const net = repo.networkSubsystem;
  let cancel = (): void => {};
  const promise = new Promise<void>((resolve) => {
    if (repo.peers.length === 0) { resolve(); return; }
    const onGone = (): void => { if (repo.peers.length === 0) { cancel(); resolve(); } };
    cancel = () => { net.off("peer-disconnected", onGone); };
    net.on("peer-disconnected", onGone);
  });
  return { promise, cancel: () => cancel() };
}

/** The carrier door a projector mounts over an island's own VM. */
export function vmCarrierFile(tw5: Parameters<typeof exportCarrierFile>[0]): (uri: string) => Promise<CarrierFile | null> {
  return carrierFileOf((uri) => exportCarrierFile(tw5, uri));
}

/**
 * Primary wiki island behavior for the node vessel: the shared wiki behavior
 * plus disk write-back as the node-held onBoot capability.
 */
/**
 * Mount the disk projection an island's manifest grants: one `LarDiskProjector` over
 * `manifest.diskMirrors`, the ONE render shore, the shadow-aware unlink gate and the disk-ward.
 * A wiki island and the daemon island call the same function — the daemon wiki projects to
 * `<projections>/wikis/daemon-<F>/` much as a wiki's working layer projects to `<projections>/wikis/<slug>/`.
 */
export function mountDiskProjection(
  manifest: IslandMsg_Manifest,
  ctx: IslandContext,
  opts: { readonly journal?: VesselJournal } = {},
): (() => Promise<void>) | undefined {
  const allDefs = manifest.diskMirrors;
  if (!allDefs?.length) return undefined;
  // THE OBSERVE RENDERS stand apart from the projector: a one-way writer over the bag's own store, no agreement, no
  // ingest (`daemon-observe.ts`).
  const observes = allDefs.filter((def) => def.mirrorClass === "observe").flatMap(({ bagId, mirrorRoot }) => {
    const store = ctx.composite.storeForBag(bagId);
    return store ? [mountDaemonObserve(store, mirrorRoot)] : [];
  });
  const mirrorDefs = allDefs.filter((def) => def.mirrorClass !== "observe");
  if (!mirrorDefs.length) return async () => { for (const o of observes) o.stop(); };
  // THE USER TEMP LAYER stands only for this island's own wiki and only under `<root>/projections`: any other temp grant
  // drops here, before the projector learns of it.
  const tempSlug = manifest.recipe?.wikiSlug ?? "";
  const tempDefs = mirrorDefs.filter((def) => def.tempLayer);
  const projectionsRoot = tempDefs.length === 0 ? null : (() => { try { return resolvePath(larProjectionsHome()); } catch { return null; } })();
  const tempMirrors = tempDefs.filter((def) =>
    tempSlug !== "" && def.bagId === wikiSlotUri(tempSlug, "temp") && projectionsRoot !== null && resolvePath(def.mirrorRoot).startsWith(projectionsRoot + sep)
    && ctx.composite.storeForBag(def.bagId) !== null);
  const mirrors = mirrorDefs.filter((def) => !def.tempLayer || tempMirrors.includes(def)).map(({ bagId, mirrorRoot, scope, guardNexusHandles, titlePaths, mirrorClass, tempLayer }) =>
    namedBagMirror(bagId, scope, mirrorRoot, guardNexusHandles, titlePaths, mirrorClass, tempLayer),
  );
  // READ-BACK AHEAD OF THE FIRST PASS: the temp layer comes up empty at every restart, so each carrier its mirror holds
  // re-enters the layer's store before the projector starts; the start scan then finds every record standing, and no
  // carrier reads as dropped (`temp-layer.ts`).
  for (const def of tempMirrors) {
    const store = ctx.composite.storeForBag(def.bagId)!;
    const holds = (title: string): boolean => {
      const record = (store as { readNow?: (t: string) => { record: { meta?: { deleted?: boolean } } | null } }).readNow?.(title)?.record;
      return record !== null && record !== undefined && record.meta?.deleted !== true;
    };
    const read = readBackTempCarriers({
      mirrorRoot: def.mirrorRoot, projectionsRoot: projectionsRoot!, holds,
      put: (fields) => { void store.put({ tiddler: fields }, { kind: "operator-import", sessionId: "temp-read-back" }); },
    });
    if (read.read > 0 || read.refused > 0) console.log(`[temp-layer] ${tempSlug}: ${read.read} carrier(s) read back, ${read.refused} refused`);
  }
  // The Synced tree (Confluence merge base) sits at the INSTANCE ROOT (the dir
  // holding bags/) under .lararium-projection/ — observation state,
  // never a meme surface, never inside bags/; the ingest gate reads the
  // same file. mirrorRoot shape under the full-path-inside-bag ruling:
  // <root>/bags/<scope> → up two.
  const syncedTree = new SyncedTree(syncedTreeDir(larProjectionCheckpointDir()));   // runtime → <root>/hearth/checkpoints
  const projector = new LarDiskProjector({
  mirrors,
  // The ONE render shore: a carrier projects back to ITS OWN filetype
  // (memetic → `.mem`; `.tid`/`.json`/`.md`/content-type → its native file
  // + a `.meta` sidecar). The VM registry decides type + bytes; the
  // projector only sites them.
  carrierFileFn: vmCarrierFile(ctx.tw5),
  recoveryStore: (bagId) => ctx.composite.storeForBag(bagId),
  recoveryFileFn: async (fields) => {
    const title = fields["title"];
    if (typeof title !== "string") return null;
    const tiddler = new ctx.tw5.$tw.Tiddler(fields);
    return {
      ext: ".tid",
      body: `${tiddler.getFieldStringBlock({ exclude: ["text", "bag", "$origin-bag"] })}\n\n${typeof fields["text"] === "string" ? fields["text"] : ""}`,
      defaultRelPath: `${encodeURIComponent(title)}.tid`,
    };
  },
  // A SHADOWED OWN RECORD renders off its bag's own records: the root and its own fragment records, read from that bag
  // alone, through the same shore the resolved view renders through (`exportRecordCarrierFile`).
  recordFileFn: async (bagId, uri) => {
    const store = ctx.composite.storeForBag(bagId);
    if (!store) return null;
    const records = new Map<string, Record<string, unknown>>();
    const root = await store.get(uri);
    if (!root || root.meta?.deleted) return null;
    records.set(uri, root.tiddler);
    for (const title of await store.listVisible()) {
      if (!title.startsWith(`${uri}#`)) continue;
      const record = await store.get(title);
      if (record && !record.meta?.deleted) records.set(title, record.tiddler);
    }
    return carrierFileOf((u) => exportRecordCarrierFile(ctx.tw5, u, records))(uri);
  },
  // A POINTER projects as the whole file beside its `.meta`: the bytes come from the same
  // cid/ tier the lazy resolver reads (THE BLOB LAW, content-handle.ts).
  ...(ctx.resolveByCid ? { resolveByCid: ctx.resolveByCid } : {}),
  // Every bag holding a carrier — the shadow-aware stale-unlink gate. A
  // working edit shadowing its canon copy keeps BOTH files; the canon mirror
  // (bags/slug) never loses its file just because the carrier surfaced in a
  // working layer above it (the boot-seed-deletion cure).
  bagsHolding: (uri) => ctx.composite.listBagsHolding(uri),
  // Where a bag stands in this island's composition: the settle word tells a carrier a higher bag shadows from one
  // whose records have not reached the view yet.
  layerIndexOf: (bagId) => ctx.composite.layerIndexOf(bagId),
  // THE SETTLE WORD FOLLOWS HEADS: the wiki has landed a bag's document up to the heads a gesture named
  // (`wikiLandedCovers`), and the far side has closed when the island's Repo holds no sync peer: no record
  // comes through a link that closed (`farSideClosedOf`), unless the island's own replica holds the heads (`docHolds`).
  viewHolds: (bagId, _uri, heads) => wikiLandedCovers(ctx.tw5, bagId, heads),
  farSideClosed: () => farSideClosedOf(ctx.repo),
  docHolds: (bagId, heads) => ctx.composite.storeForBag(bagId)?.holdsHeads?.(heads) === true,
  // Disk-ward refusal → the daemon VM (the generic worker.event → placeVerb
  // bridge routes any event whose payload carries `verb`). The daemon audits
  // it durably and injects a $:/tags/Alert into the operator's pinned VM.
  onRefusal: (info) => ctx.post(hostEvent(ctx.wikiUri, "disk-ward:refused", { verb: "ward-alert", requestedBy: "disk-ward", bagId: info.bagId, uri: info.uri, reason: info.reason })),
  // The Confluence's projecting leg read a STANDOFF — disk and records both moved past the
  // merge base, so the projector stood down and the divergence must reach the operator
  // (the ruling: conflict-surfacing in BOTH legs). ONE RAIL, NOT A SECOND: it rides the
  // same ward-alert verb the disk ward rides — the rail `fileWardRefusal` was already
  // generalized for (the M3 archive-floor write files here too) — and `wardKind` names the
  // mechanism that actually stood down, so an operator is never sent to the disk ward for
  // a conflict. The wire `kind`/`cause` stay Rail A's transport names, per that ruling.
  onConflict: (info) => ctx.post(hostEvent(ctx.wikiUri, "confluence:conflict", { verb: "ward-alert", requestedBy: "projection-confluence", wardKind: "projection-conflict", bagId: info.bagId, uri: info.uri, reason: info.reason, standoff: info.standoff })),
  // The standoff the projector surfaced stands resolved: the same rail carries its key with `resolved`,
  // and the alert that key raised clears. No audit row rides a resolution.
  onConflictResolved: (info) => ctx.post(hostEvent(ctx.wikiUri, "confluence:resolved", { verb: "ward-alert", requestedBy: "projection-confluence", wardKind: "projection-conflict", bagId: info.bagId, uri: info.uri, reason: "resolved", standoff: info.standoff, resolved: true })),
  // A file vanished from the path its base names: the projector wrote nothing back and tombstoned nothing.
  // ONE ALERT PER BAG names the count and rides the same rail under its own ward kind; the set's key names
  // the audit row and the live alert, and the set's end clears it.
  onPendingRemoval: (info) => ctx.post(hostEvent(ctx.wikiUri, "confluence:pending-removal", { verb: "ward-alert", requestedBy: "projection-confluence", wardKind: "pending-removal", bagId: info.bagId, uri: info.uris[0] ?? "(none)", reason: info.reason, standoff: info.key })),
  onPendingRemovalResolved: (info) => ctx.post(hostEvent(ctx.wikiUri, "confluence:pending-removal-resolved", { verb: "ward-alert", requestedBy: "projection-confluence", wardKind: "pending-removal", bagId: info.bagId, uri: "(none)", reason: "resolved", standoff: info.key, resolved: true })),
  // THE `remove` ANSWER'S DELETE DOOR: a hand's delete of the carrier root in this island's wiki. The wiki
  // shore carries it like any hand delete: its adaptor routes the tombstone (the working layer, shadowing
  // canon) and removes the slot children.
  removeCarrier: (uri) => { ctx.tw5.$tw.wiki.deleteTiddler(uri); },
  // WHAT THE DISK BYTES SAY — `render(parse(disk))`, the `≈` seat the projecting leg of
  // the Confluence has no parse of its own to compute. ONE door, the pure subpath (the
  // barrel drags wasm the plugin build cannot bundle, and this is the same congruence the
  // ingest leg reads), so exactly one implementation of `≈` stands in the tree.
  canonicalizeFn: canonicalizeCarrierText,
  // THE NATIVE CONGRUENCE, MIRRORED FROM THE INGEST LEG: `action-handler.ts`'s LOAD
  // path already runs a native carrier through the SAME `decideIngest` triangle via its
  // `nativeRender` closure (deserialize disk bytes + merge `.meta` + render back through
  // `renderCarrier`) — a wiring gap over proven code, not a fresh design. `makeTw5Deserializer`
  // closes over this island's own booted `$tw`, so the projecting leg reads native carrier
  // text through the exact same TW5 registry the ingest leg does.
  canonicalizeNativeFn: (uri, ext, diskBody, diskMeta) =>
    canonicalizeNativeCarrierText(makeTw5Deserializer(ctx.tw5), uri, ext, diskBody, diskMeta),
  syncedTree,
  ...(opts.journal ? { journal: opts.journal } : {}),
  ...(!opts.journal ? {
    onBagProjected: (info: { bagId: string; path: string }) => ctx.post(bagProjectedEvent(ctx.wikiUri, info)),
  } : {}),
  });
  const stop = projector.start(ctx.tw5);
  mountedProjector = projector;
  bindRecoveryAtRest(ctx.tw5, (bag, title, fields) => projector.recoveryAtRest(bag, title, fields));
  // HOUSEKEEPING per temp mirror: once the first pass settles, then once a day; each run reads the consent row and the
  // expiry window afresh from `<root>/config/config.json`.
  const housekeepers = tempMirrors.map((def) => {
    const store = ctx.composite.storeForBag(def.bagId)!;
    return new TempLayerHousekeeper({
      bagId: def.bagId, slug: tempSlug, mirrorRoot: def.mirrorRoot, projectionsRoot: projectionsRoot!,
      policy: () => { const cfg = loadLaresConfig(); return { consent: tempProjectionConsented(cfg, tempSlug), expiryDays: tempExpiryDays(cfg, tempSlug) }; },
      record: async (title) => {
        const record = await store.get(title);
        return record === null ? "absent" : record.meta?.deleted ? "gone" : "live";
      },
      lastWritten: (title, path) => { syncedTree.reread(syncedTreeKey(def.bagId, title)); return syncedTree.baseAt(syncedTreeKey(def.bagId, title), path)?.disk ?? null; },
      forget: (title, path) => syncedTree.deleteAt(syncedTreeKey(def.bagId, title), path),
      holdsOpen: (title) => projector.writing.has(title)
        || projector.pendingRemovals().some((p) => p.bagId === def.bagId && p.uri === title)
        || projector.standing().some((st) => st.bagId === def.bagId && st.uri === title),
      onError: (err) => console.error(`[temp-layer] ${tempSlug}: housekeeping skipped: ${(err as Error).message}`),
    });
  });
  if (housekeepers.length > 0) void projector.idle().then(() => { for (const h of housekeepers) h.start(); });
  return async () => {
    for (const h of housekeepers) await h.stop();
    for (const o of observes) o.stop();
    bindRecoveryAtRest(ctx.tw5, null);
    if (mountedProjector === projector) mountedProjector = null;
    await stop();
  };
}

export function makeWikiPrimaryBehavior(manifest: IslandMsg_Manifest, journal?: VesselJournal): IslandBehavior {
  const base = makeWikiBehavior({
    onBoot: (ctx: IslandContext) => mountDiskProjection(manifest, ctx, journal ? { journal } : {}),
    // caps = the wiki-sensorium perceiver cap — the wiki island answers the daemon's supervision reads
    // (sensorium:cohere/recall in, SENSORIUM_FRAME back). Platform-blind hull; same cap as browser.
    caps: [hasWikiSensorium()],
  });
  return {
    onEa:     (ctx) => base.onEa(ctx),
    // The shore verb belongs to the node-held disk capability, so its door stands here, ahead of the
    // isomorphic verb table.
    onSignal: (type, raw, ctx) => claimShoreVerb(type, raw, ctx.post) || base.onSignal(type, raw, ctx),
    onHooAnu: (ctx) => base.onHooAnu(ctx),
  };
}
