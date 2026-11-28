/**
 * THE PROJECTOR'S WIRING: `start` subscribes to the wiki's change events, opens the reconcile queue, hears each mirrored
 * bag's own store, and marks every root a mount scan finds (each mirror's own records, kāpae tombstones,
 * orphan flags and folders); `stop` ends the settle waits and drains the queue.
 * Heleuma ha: see lararium/mesh/disk-projector-start.
 */

import { isEffectRecordUri } from "@lararium/mesh/effect-record";
import { familyRootOf } from "@lararium/mesh/family";
import { KeyedReconcileGate } from "@lararium/mesh/projection-nalu";
import type { LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { tendOrphanAlerts, wikiFamilyView } from "@lararium/tw5";
import type { TW5Engine } from "@lararium/tw5";
import type { ProjectorCore } from "./core.js";
import { rootOf } from "./entries.js";
import type { OrphanWiki } from "./entries.js";
import { orphanFolderRoots } from "./orphans.js";
import { ownRecordMirrors } from "./reconcile.js";
import { wakeWaiters, reconcileWatched } from "./watches.js";

/**
 * Subscribe to TW5 wiki change events and begin projecting.
 *
 * Architecture law (TW5 VM Primacy): only the IslandAdaptor subscribes
 * to Automerge stores. The disk projector subscribes to TW5 wiki change
 * events — the same surface that drives in-browser render. Bag provenance
 * reaches TW5 as the `$origin-bag` the nalu engine stamps from each change's
 * envelope; the projector reads it from the TW5 tiddler directly. `bag` is the
 * author's field and names nothing here.
 *
 * Returns an async unsubscribe that completes the running reconcile.
 */
export function start(core: ProjectorCore, tw5: TW5Engine): () => Promise<void> {
  core._tw5 = tw5;
  const wiki = tw5.$tw.wiki;
  // Group routing: a fragment record's change belongs to its carrier root.
  // Climb `$fragment-parent` one hop at a time (the field points one level
  // up); for a deleted record the chain is gone, so fall back to the URI
  // fragment-path law (`root#a/b` → `root`).
  // The one family law reads the chain (`familyRootOf`): the root a title's parent edges name.
  const familyView = wikiFamilyView(wiki as never);
  const routeToRoot = (title: string): string => familyRootOf(familyView, title).root;

  // LEVEL-TRIGGERED (K8s reconciliation prior-art): every change is a NUDGE to
  // reconcile this carrier root against the CURRENT settled VM state — never an edge that
  // licenses a destructive action off a transient view. A MOVE's source-tombstone and
  // destination-add mark one root. Reconcile reads settled VM state, so the last owner is visible;
  // a mark during that read sets dirty and causes one more read when it completes.
  const gate = new KeyedReconcileGate<string>({
    reconcile: (rootUri) => reconcileWatched(core, rootUri),
  });
  core.gate = gate;
  // NO FORM CUT. Every changed title reaches the gate — a `lar:` URI, `My Notes`, `$:/config/Foo`
  // alike. A `!title.startsWith("lar:")` filter here withheld a tiddler by the SHAPE OF ITS NAME,
  // which is the move canon already refused for hostful URIs, and it stood against the sync law:
  // what is allowed to sync by NOT sitting in a volatile layer shall sync, and what syncs into a
  // MIRRORED bag shall land on disk. THE RESIDENCY BAR IS THE ONLY BAR, and it lives one step
  // down in `reconcile`: a title whose `$origin-bag` names no mirror drops there. That covers the
  // volatile plane (never persisted, so never stamped), `$:/state/`, `$:/temp/`, `$:/boot/` and
  // drafts (the in-wiki cascade routes them to unmirrored bags), and `$:/core` (named withholding).
  // Each title change is one queue mark and a `getTiddler` + one field read — the reconcile is
  // level-triggered and idempotent, so a nudge that resolves to no mirror costs exactly that.
  const handler = (changes: Record<string, unknown>) => {
    core.measure.changeEvents++;
    core.measure.lastChangeAt = performance.now();
    core.measure.holdsSinceChange = 0;
    core.measure.wroteSinceChange = false;
    const roots = new Set<string>();
    for (const title of Object.keys(changes)) {
      const up = familyRootOf(familyView, title);
      roots.add(up.root);
      // A slot record that left, or one whose chain reaches no standing record, may leave orphans: its
      // root's next reconcile reads them (`reconcileOrphans`).
      if (title.includes("#") && !up.reaches) core.orphanSuspects.add(up.root);
    }
    for (const rootUri of roots) gate.mark(rootUri);
    wakeWaiters(core, roots);
  };
  wiki.addEventListener?.("change", handler);
  const ownUnsubs: Array<() => void> = [];
  const scans: Promise<void>[] = [];
  // EACH ORDINARY MIRROR READS ITS OWN BAG TOO. The resolved view hides a record a higher layer shadows, and a record
  // whose change notice never reached the view (a crash between its sealed write and the notification) stands in the
  // bag alone; enumerating the bag's own titles, and hearing its own changes, marks every such carrier root.
  for (const mirror of ownRecordMirrors(core)) {
    const store = core.bagStore!(mirror.bagId)!;
    ownUnsubs.push(store.subscribe((change) => gate.mark(rootOf(change.title))));
    scans.push(store.listVisible().then((titles) => {
      for (const title of titles) gate.mark(rootOf(title));
    }));
  }
  // A KĀPAE STANDING IN A MIRROR'S BAG WRITES ITS SHADOW AT START. `listVisible` hides a tombstone, and a mirror root that
  // stood up after the kāpae rose (a face's planes moving to `faces/<pet name>/`, a re-pour into a fresh root) never heard
  // the change that wrote the shadow, so the bag's own tombstones mark their roots: each settles its shadow where it sites.
  for (const mirror of core.mirrors) {
    const store = core.bagStore?.(mirror.bagId) as (LarTiddlerStore & { listTombstoned?: () => string[] }) | null | undefined;
    if (typeof store?.listTombstoned !== "function") continue;
    for (const title of store.listTombstoned()) if (!isEffectRecordUri(title)) gate.mark(rootOf(title));
  }
  // EVERY AGREEMENT A MIRROR'S BASE NAMES MARKS ITS ROOT AT START. `listVisible` hides a record tombstoned while the
  // projector rested, and the view may answer that title from a bag no mirror holds, so no other scan reaches it: the
  // persisted bases name the files such a record left, and their roots settle where they stand.
  core.syncedTree.reread();
  for (const { bagId, uri } of core.syncedTree.rows()) if (core.mirrors.some((m) => m.bagId === bagId)) gate.mark(rootOf(uri));
  core.ownScan = Promise.all(scans).then(() => {});
  // The scan follows subscription in this synchronous turn. The gate starts in a microtask and
  // yields between roots, so a mounted seed receives a complete, paced projection pass.
  // Every title, system titles included: the residency bar below is the only bar (`getTiddlers`
  // answers non-system titles alone).
  const titles = (wiki as unknown as { allTitles?: () => string[] }).allTitles?.() ?? [];
  const roots = new Set<string>();
  for (const title of titles) roots.add(routeToRoot(title));
  for (const rootUri of roots) {
    const fields = wiki.getTiddler?.(rootUri)?.fields as Record<string, unknown> | undefined;
    const bagId = fields?.["$origin-bag"];
    if (typeof bagId === "string" && core.mirrors.some((mirror) => mirror.bagId === bagId)) gate.mark(rootUri);
  }
  // THE ORPHAN FLAGS RE-DERIVE AT BOOT. The flag lives in `$:/temp` and survives nothing, so each start reads
  // the view afresh: every root that holds orphans raises its flag and reconciles, and every orphan folder
  // a mirror still holds marks its root, so a family that re-rooted while nothing watched gives its folder back.
  const orphanWiki = wiki as unknown as OrphanWiki;
  if (typeof orphanWiki.allTitles === "function" && typeof orphanWiki.addTiddler === "function") {
    for (const rootUri of tendOrphanAlerts(orphanWiki as never).keys()) { core.orphanSuspects.add(rootUri); gate.mark(rootUri); }
  }
  for (const rootUri of orphanFolderRoots(core)) { core.orphanSuspects.add(rootUri); gate.mark(rootUri); }
  return async () => { wiki.removeEventListener?.("change", handler); for (const unsub of ownUnsubs) unsub(); await core.ownScan; await core.stop(); };
}

export async function stop(core: ProjectorCore): Promise<void> {
  core.stopping = true;
  wakeWaiters(core);
  await core.gate?.settle();
  core.writing.clear();
}
