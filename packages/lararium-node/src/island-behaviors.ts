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

import type { IslandMsg_Manifest } from "@lararium/mesh";
import { exportCarrierFile, makeWikiBehavior, hasWikiSensorium, makeTw5Deserializer, canonicalizeNativeCarrierText } from "@lararium/tw5";
import type { IslandBehavior, IslandContext } from "@lararium/tw5";
// PURE subpath (no Automerge/wasm) — the same law `ingest-gate` reads `@lararium/mesh/agile-digest` under.
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { LarDiskProjector } from "./disk-projector.js";
import { namedBagMirror } from "./bag-paths.js";
import { SyncedTree } from "./synced-tree.js";
import { larProjectionDir } from "./vessel-paths.js";
import { join } from "path";

/**
 * Primary wiki island behavior for the node vessel: the shared wiki behavior
 * plus disk write-back as the node-held onBoot capability.
 */
/**
 * Mount the disk projection an island's manifest grants: one `LarDiskProjector` over
 * `manifest.diskMirrors`, the ONE render shore, the shadow-aware unlink gate and the disk-ward.
 * A wiki island and the daemon island call the same function — the daemon wiki projects to
 * `<root>/wikis/daemon/` exactly as a wiki's working layer projects to `<root>/wikis/<slug>/`.
 */
export function mountDiskProjection(manifest: IslandMsg_Manifest, ctx: IslandContext): (() => void) | undefined {
  const mirrorDefs = manifest.diskMirrors;
  if (!mirrorDefs?.length) return undefined;
  const mirrors = mirrorDefs.map(({ bagId, mirrorRoot, scope, guardNexusHandles }) =>
    namedBagMirror(bagId, scope, mirrorRoot, guardNexusHandles),
  );
  // The Synced tree (Confluence merge base) sits at the INSTANCE ROOT (the dir
  // holding bags/) under .lararium-projection/ — observation state,
  // never a meme surface, never inside bags/; the ingest gate reads the
  // same file. mirrorRoot shape under the full-path-inside-bag ruling:
  // <root>/bags/<scope> → up two.
  const syncedTree = new SyncedTree(join(larProjectionDir(), "synced-tree.json"));   // runtime → ~/.lares
  const projector = new LarDiskProjector({
  mirrors,
  // The ONE render shore: a carrier projects back to ITS OWN filetype
  // (memetic → `.mem`; `.tid`/`.json`/`.md`/content-type → its native file
  // + a `.meta` sidecar). The VM registry decides type + bytes; the
  // projector only sites them.
  carrierFileFn: (uri) => { try { return Promise.resolve(exportCarrierFile(ctx.tw5, uri)); } catch { return Promise.resolve(null); } },
  // A POINTER projects as the whole file beside its `.meta`: the bytes come from the same
  // cid/ tier the lazy resolver reads (THE BLOB LAW, content-handle.ts).
  ...(ctx.resolveByCid ? { resolveByCid: ctx.resolveByCid } : {}),
  // Every bag holding a carrier — the shadow-aware stale-unlink gate. A
  // working edit shadowing its canon copy keeps BOTH files; the canon mirror
  // (bags/slug) never loses its file just because the carrier surfaced in a
  // working layer above it (the boot-seed-deletion cure).
  bagsHolding: (uri) => ctx.composite.listBagsHolding(uri),
  // Disk-ward refusal → the daemon VM (the generic worker.event → placeVerb
  // bridge routes any event whose payload carries `verb`). The daemon audits
  // it durably and injects a $:/tags/Alert into the operator's pinned VM.
  onRefusal: (info) => ctx.post({
    schema_version: 1,
    type: "event",
    wikiUri: ctx.wikiUri,
    listenable: "disk-ward:refused",
    payload: { verb: "ward-alert", requestedBy: "disk-ward", bagId: info.bagId, uri: info.uri, reason: info.reason },
  }),
  // The Confluence's projecting leg read a STANDOFF — disk and records both moved past the
  // merge base, so the projector stood down and the divergence must reach the operator
  // (the ruling: conflict-surfacing in BOTH legs). ONE RAIL, NOT A SECOND: it rides the
  // same ward-alert verb the disk ward rides — the rail `fileWardRefusal` was already
  // generalized for (the M3 archive-floor write files here too) — and `wardKind` names the
  // mechanism that actually stood down, so an operator is never sent to the disk ward for
  // a conflict. The wire `kind`/`cause` stay Rail A's transport names, per that ruling.
  onConflict: (info) => ctx.post({
    schema_version: 1,
    type: "event",
    wikiUri: ctx.wikiUri,
    listenable: "confluence:conflict",
    payload: { verb: "ward-alert", requestedBy: "projection-confluence", wardKind: "projection-conflict", bagId: info.bagId, uri: info.uri, reason: info.reason },
  }),
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
  });
  return projector.start(ctx.tw5);
}

export function makeWikiPrimaryBehavior(manifest: IslandMsg_Manifest): IslandBehavior {
  return makeWikiBehavior({
    onBoot: (ctx: IslandContext) => mountDiskProjection(manifest, ctx),
    // caps = the wiki-sensorium perceiver cap — the wiki island answers the daemon's supervision reads
    // (sensorium:cohere/recall in, SENSORIUM_FRAME back). Platform-blind hull; same cap as browser.
    caps: [hasWikiSensorium()],
  });
}
