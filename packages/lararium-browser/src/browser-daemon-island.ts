/**
 * browser-daemon-island — browser Web Worker entry point for the daemon island.
 *
 * Sovereign daemon island AND the operator's authn/z home (isomorphic-vessel
 * Stage 1). Composition only: the browser sovereign kernel + the shared
 * keyhive-wired daemon behavior (makeOperatorDaemonBehavior, @lararium/keyhive) —
 * byte-identical wiring to the node daemon entry, which is why it lives once in
 * keyhive. This file picks only the platform kernel.
 *
 * Island Sovereignty Law §9: TW5 boots here, inside a sovereign Worker.
 * DOM types do not appear in this file (BA-1). `self` is the sole platform surface.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-daemon-island
 */

import { runBrowserSovereignWorker } from "./browser-sovereign-island-model.js";
import { makeOperatorDaemonBehavior } from "@lararium/keyhive/operator-daemon-behavior";
import { mountProjection } from "@lararium/tw5";
import { HULLS_TS_ONLY } from "@lararium/mesh";
import { edgeLedgerDocUrl, materializeSharedLarDoc } from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

// The daemon INHERITS the wiki render cap (hasProjection). Mount its projection DORMANT at island-boot —
// exactly as a pool wiki mounts its camera — so summoning the daemon is a pure active-surface gate flip,
// never a worker re-manifest (the HA·BA braid: mount-then-flip, fully live, uniform across surfaces). The
// frames ride onFrame to the boot; the boot's active-surface gate decides whether they paint #projection.
runBrowserSovereignWorker((manifest) => {
  // Same-origin writes are accepted within one custody context: api/pono/session-contract.mem #/the-trust-line.
  const key = manifest.daemonAuth?.atom?.key ?? manifest.daemonAuth?.vesselVerifyingKey;
  const ledgerRepo = key ? new Repo({ storage: new IndexedDBStorageAdapter(`lares:island-edge-ledger:${key}`) }) : null;
  const dyadLedger = key && ledgerRepo ? materializeSharedLarDoc(ledgerRepo, edgeLedgerDocUrl(key), "ledger:edge") : undefined;
  return makeOperatorDaemonBehavior(manifest, {
    // The island reads its signed fleet board through its own Repo.
    readDyadFromBoard: true,
    ...(dyadLedger ? { dyadLedger } : {}),
    ...(ledgerRepo ? { restDyadLedger: () => ledgerRepo.flush() } : {}),
    // ONE SEED SITE: `makeDaemonBehavior` runs the cap-gated `seedDaemonProtocol` in onEa, so the daemon
    // protocol seed (Ui+Persona+Circle+Flow) stands identically on either boot. This ts-only browser vessel
    // passes HULLS_TS_ONLY → it seeds crystal alone, and its onBoot carries the projection mount.
    onBoot: (ctx) => mountProjection(ctx),
    runnableHulls: HULLS_TS_ONLY,
  });
});
