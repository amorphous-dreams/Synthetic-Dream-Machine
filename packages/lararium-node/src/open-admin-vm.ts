/**
 * openAdminVm — boot the operator's admin TW5 engine.
 *
 * The admin VM coordinates operator infrastructure for one Lararium node:
 * device delegations (cap=infrastructure), bag-mirror configs tagged
 * $:/tags/LarariumBagMirror, projection configs tagged $:/tags/LarariumProjection,
 * sessions (operator → agent), and ceremony state.
 *
 * Federation: scoped to the operator's own devices via cap=infrastructure
 * delegations, gated at the ingress trust check (S7.4). Never reaches room
 * peers — the admin doc has its own AutomergeUrl and its own sync boundary.
 *
 * Architecture: the admin VM has its own TW5Engine, its own CompositeStore,
 * and its own MemeSyncAdaptor. Sharing the room VM's composite would risk
 * leaking operator-private content (delegation proofs, session secrets) to
 * room peer connections.
 *
 * Standalone module — openNodeLarPeer wires this in (S5.6 A.4); for now
 * the function exists as a callable unit for tests and future integration.
 */

import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import type { MemeStoreDoc } from "@lararium/core";
import { ADMIN_BAG_ID, CompositeStore, AutomergeDocStore, emptyMemeStoreDoc } from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor } from "@lararium/tw5";
import type { TW5CoreBootBlob } from "@lararium/tw5";
import { waitHandleLocal } from "./repo-helpers.js";

export interface AdminVmOptions {
  /** Shared Automerge repo — same one the room VM uses. */
  repo: Repo;
  /** Admin doc AutomergeUrl from the social-bootstrap bundle (lararium:init). */
  adminUrl: string;
  /** Tiddlers to preload into the admin VM at boot — e.g. the lararium-lares
   *  corpus blob so bag-mirror config tiddlers can reference lar: URIs. */
  preloadedTiddlers?: Array<Record<string, unknown>>;
  /** TW5 core bytes from the content-addressed LarariumDoc blob. */
  coreBlob: TW5CoreBootBlob;
}

export interface AdminVmResult {
  /** Booted TW5 engine for the admin room. */
  tw5: TW5Engine;
  /** Composite store with the admin doc as the writable layer. */
  composite: CompositeStore;
  /** Live admin doc handle. */
  adminHandle: DocHandle<MemeStoreDoc>;
  /** Sync adaptor wired between TW5 and the composite, targeting admin bag. */
  adaptor: MemeSyncAdaptor;
  /** Tear down the engine. */
  dispose: () => void;
}

export async function openAdminVm(opts: AdminVmOptions): Promise<AdminVmResult> {
  const { repo, adminUrl } = opts;

  const adminHandle = await waitHandleLocal<MemeStoreDoc>(
    repo, adminUrl as AutomergeUrl,
    () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc()),
  );

  const composite = new CompositeStore();
  composite.addLayer({
    bagId:    ADMIN_BAG_ID,
    store:    new AutomergeDocStore(adminHandle, ADMIN_BAG_ID),
    writable: true,
  });

  const tw5 = new TW5Engine();
  const { preloadedTiddlers } = opts;
  await tw5.boot(opts.coreBlob, preloadedTiddlers && preloadedTiddlers.length > 0 ? preloadedTiddlers : undefined);

  const adaptor = new MemeSyncAdaptor(tw5, composite, ADMIN_BAG_ID);

  // Subscribe the adaptor to composite changes so admin tiddlers stream into
  // the wiki. The adaptor's onUriChanged handles the inbound direction;
  // saveTiddler handles outbound.
  composite.addProjection(adaptor);

  return {
    tw5,
    composite,
    adminHandle,
    adaptor,
    dispose: () => { tw5.dispose(); },
  };
}
