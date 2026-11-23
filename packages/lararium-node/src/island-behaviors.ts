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

import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join as joinPath, resolve as resolvePath, sep } from "node:path";
import { mkWikiVerbResult, wikiSlotUri } from "@lararium/mesh";
import type { IslandMsg_Manifest, WikiMsg_PlaceVerb } from "@lararium/mesh";
import type { VesselJournal } from "@lararium/mesh";
import { exportCarrierFile, exportRecordCarrierFile, makeWikiBehavior, hasWikiSensorium, makeTw5Deserializer, canonicalizeNativeCarrierText, wikiLandedCovers, bindRecoveryAtRest } from "@lararium/tw5";
import type { CarrierFile } from "@lararium/tw5";
import type { IslandBehavior, IslandContext } from "@lararium/tw5";
// PURE subpath (no Automerge/wasm) — the same law `ingest-gate` reads `@lararium/mesh/agile-digest` under.
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { LarDiskProjector } from "./disk-projector.js";
import { namedBagMirror, FACES_PROJECTION_DIR } from "./bag-paths.js";
import { SyncedTree, syncedTreeDir, syncedTreeKey } from "./synced-tree.js";
import { larProjectionCheckpointDir, larProjectionsHome } from "./vessel-paths.js";
import { facePoolHeads } from "./pool-head.js";
import { checkoutTracking } from "./checkout-carriers.js";
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
 * `<projections>/faces/<pet name>/wikis/daemon/` much as a wiki's working layer projects to `<projections>/realms/<realm pet name>/wikis/<slug>/`.
 */
export function mountDiskProjection(
  manifest: Pick<IslandMsg_Manifest, "diskMirrors"> & Partial<Pick<IslandMsg_Manifest, "recipe">>,
  ctx: IslandContext,
  opts: { readonly journal?: VesselJournal; readonly projected?: (projector: LarDiskProjector) => void } = {},
): (() => Promise<void>) | undefined {
  const allDefs = manifest.diskMirrors;
  if (!allDefs?.length) return undefined;
  // THE USER TEMP LAYER stands only for this island's own wiki and only under `<root>/projections`: any other temp grant
  // drops here, before the projector learns of it.
  const tempSlug = manifest.recipe?.wikiSlug ?? "";
  const tempDefs = allDefs.filter((def) => def.tempLayer);
  const projectionsRoot = tempDefs.length === 0 ? null : (() => { try { return resolvePath(larProjectionsHome()); } catch { return null; } })();
  const tempMirrors = tempDefs.filter((def) =>
    tempSlug !== "" && def.bagId === wikiSlotUri(tempSlug, "temp") && projectionsRoot !== null && resolvePath(def.mirrorRoot).startsWith(projectionsRoot + sep)
    && ctx.composite.storeForBag(def.bagId) !== null);
  const mirrors = allDefs.filter((def) => !def.tempLayer || tempMirrors.includes(def)).map(({ bagId, mirrorRoot, scope, titlePaths, mirrorClass, tempLayer }) =>
    namedBagMirror(bagId, scope, mirrorRoot, titlePaths, mirrorClass, tempLayer),
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
      mirrorRoot: def.mirrorRoot, holds,
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
  // THE DOCUMENT EACH MIRRORED BAG RESTS IN: every base names it, so a file another face's workbench document mirrored
  // under the same bag id answers to that document alone.
  documentOf: (bagId) => (ctx.composite.storeForBag(bagId) as { readonly documentId?: unknown } | null)?.documentId as string | undefined ?? null,
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
  // The composition's top record, a tombstone included: a deliberate deletion above a mirrored bag stays a deletion.
  topRecordFn: (uri) => ctx.composite.get(uri),
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
  // same ward-alert verb the disk ward rides — the rail `fileWardRefusal` generalizes
  // (the archive-floor write files here too) — and `wardKind` names the
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
  // HEAD'S WORDS WHERE NO BASE STANDS (face-pools A5): a re-found clears the tree, and a face pool's last sitting names the
  // agreement in its stead. A file outside every face pool, or a pool with no `.git`, reads none and spawns no git.
  baseFromGit: facePoolHeads(() => { try { return larProjectionsHome(); } catch { return null; } }),
  // THE OWED COMMITS: a file a mirror root inside a checkout holds and git never tracked holds the only copy, so the records
  // dropping its carrier never unlinks it, and the census names it by path. The house's own face pools stand apart.
  untrackedAt: checkoutTracking(() => { try { return larProjectionsHome(); } catch { return null; } }),
  ...(opts.journal ? { journal: opts.journal } : {}),
  ...(!opts.journal ? {
    onBagProjected: (info: { bagId: string; path: string }) => ctx.post(bagProjectedEvent(ctx.wikiUri, info)),
  } : {}),
  });
  const stop = projector.start(ctx.tw5);
  // The island's own projector takes the shore's seat; a lit face's projector (`mountLitFaceProjection`) names its own.
  if (opts.projected) opts.projected(projector); else mountedProjector = projector;
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
    bindRecoveryAtRest(ctx.tw5, null);
    if (mountedProjector === projector) mountedProjector = null;
    await stop();
  };
}

/**
 * A root as the disk resolves it: the nearest folder that stands, through its links, joined with the rest of the path. A hand-made
 * link (`faces/h-alias -> faces/h-zero`) reads as the root it reaches, so it never passes for a root of its own.
 */
function realRoot(path: string): string {
  let head = resolvePath(path);
  const rest: string[] = [];
  while (!existsSync(head)) {
    const up = dirname(head);
    if (up === head) return resolvePath(path);
    rest.unshift(basename(head));
    head = up;
  }
  try { return joinPath(realpathSync(head), ...rest); } catch { return resolvePath(path); }
}

/** The face root (`…/faces/<segment>`) a resolved root rests under, or null where it rests under none. */
function faceRootUnder(resolved: string, facesRoot: string | null): string | null {
  if (facesRoot === null || !resolved.startsWith(facesRoot + sep)) return null;
  const segment = resolved.slice(facesRoot.length + 1).split(sep)[0];
  return segment ? joinPath(facesRoot, segment) : null;
}

/**
 * Whether two roots would share files, as the disk resolves both: one stands at or under the other, or both rest under one face
 * root (`faces/<segment>`), since a face's folder belongs to that face whole, whichever of its planes a list happens to name.
 */
function rootsMeet(a: string, b: string, facesRoot: string | null): boolean {
  const x = realRoot(a), y = realRoot(b);
  if (x === y || x.startsWith(y + sep) || y.startsWith(x + sep)) return true;
  const fx = faceRootUnder(x, facesRoot);
  return fx !== null && fx === faceRootUnder(y, facesRoot);
}

/** THE ROOTS EACH LIT FACE'S PROJECTION HOLDS NOW, by handle index: one island runs per worker, so one table serves it. */
const litFaceRoots = new Map<number, readonly string[]>();

/**
 * EVERY LIT FACE PROJECTS ITS OWN WRITES. A face that stands lit beside the worn one composes its own engine over its own daemon
 * documents (`face-engine`), and its writes land there; this mounts one projector over THAT engine, through the same mount the
 * island's own projection takes (`mountDiskProjection`), under the mirror grants the vessel named for that face alone
 * (`JoinedFaceAuth.diskMirrors`, each under the face's own root). The face boundary holds twice: a grant that is a temp layer,
 * or whose root meets any root the island's own composition projects into (the worn face's, the crossroads), drops before the
 * projector learns of it, so a face's records never reach another face's root; and the projector reads the face's own engine,
 * never the worn composition. The island's shore keeps its own projector. Returns the stop, or undefined where no grant stands.
 */
export function mountLitFaceProjection(
  manifest: Pick<IslandMsg_Manifest, "diskMirrors">,
  face: { readonly handleIndex: number; readonly diskMirrors?: IslandMsg_Manifest["diskMirrors"] },
  engine: Pick<IslandContext, "tw5" | "composite">,
  ctx: IslandContext,
  opts: { readonly journal?: VesselJournal; readonly log?: (line: string) => void; readonly projected?: (projector: LarDiskProjector) => void; readonly projectionsRoot?: string } = {},
): (() => Promise<void>) | undefined {
  const facesRoot = (() => { try { return realRoot(joinPath(opts.projectionsRoot ?? larProjectionsHome(), FACES_PROJECTION_DIR)); } catch { return null; } })();
  const island = manifest.diskMirrors ?? [];
  const granted = (face.diskMirrors ?? []).filter((def) => {
    if (def.tempLayer) { opts.log?.(`face h${face.handleIndex}: the temp grant ${def.bagId} drops; a lit face projects no temp layer`); return false; }
    const meets = island.find((own) => rootsMeet(own.mirrorRoot, def.mirrorRoot, facesRoot));
    if (meets) { opts.log?.(`face h${face.handleIndex}: the grant ${def.bagId} at ${def.mirrorRoot} meets ${meets.mirrorRoot}, another projector's root; it drops`); return false; }
    return true;
  });
  if (granted.length === 0) return undefined;
  // SIBLING AGAINST SIBLING: a root another lit face's projection holds now refuses this face's whole mount, never a share. Two
  // faces may wear one pet name, and so one folder; the face that mounted first keeps it, and this one stands unprojected under
  // a named alert until the clash clears.
  for (const def of granted) {
    for (const [other, roots] of litFaceRoots) {
      if (other === face.handleIndex) continue;
      const held = roots.find((root) => rootsMeet(root, def.mirrorRoot, facesRoot));
      if (held === undefined) continue;
      const reason = `face h${face.handleIndex}'s grant ${def.bagId} at ${def.mirrorRoot} meets ${held}, which face h${other}'s projection holds; h${face.handleIndex} projects nothing until one face names another folder`;
      opts.log?.(reason);
      ctx.post(hostEvent(ctx.wikiUri, "lit-face:root-shared", { verb: "ward-alert", requestedBy: "lit-face-projection", wardKind: "lit-face-root-shared", bagId: def.bagId, uri: def.mirrorRoot, reason }));
      return undefined;
    }
  }
  const stop = mountDiskProjection({ diskMirrors: granted }, { ...ctx, tw5: engine.tw5, composite: engine.composite },
    { ...(opts.journal ? { journal: opts.journal } : {}), projected: opts.projected ?? (() => {}) });
  if (stop === undefined) return undefined;
  const roots = granted.map((def) => def.mirrorRoot);
  litFaceRoots.set(face.handleIndex, roots);
  return async () => {
    if (litFaceRoots.get(face.handleIndex) === roots) litFaceRoots.delete(face.handleIndex);
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
