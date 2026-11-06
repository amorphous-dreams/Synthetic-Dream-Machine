import { runBrowserSovereignWorker, type BrowserIslandScope } from "./browser-sovereign-island-model.js";
import { islandSessionDoor, makeOperatorDaemonBehavior } from "@lararium/keyhive/operator-daemon-behavior";
import { mountProjection } from "@lararium/tw5";
import { HULLS_TS_ONLY, freshBasePort, islandLiveDocDoor } from "@lararium/mesh";
import { edgeLedgerDocUrl, materializeSharedLarDoc } from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { shoreStorage } from "@lararium/mesh";
import { idbSealedStoreShore, sealedStoreDbName } from "./browser-sealed-store.js";

// The daemon INHERITS the wiki render cap (hasProjection). Mount its projection DORMANT at island-boot —
// exactly as a pool wiki mounts its camera — so summoning the daemon is a pure active-surface gate flip,
// never a worker re-manifest (the HA·BA braid: mount-then-flip, fully live, uniform across surfaces). The
// frames ride onFrame to the boot; the boot's active-surface gate decides whether they paint #projection.
/** How long the island waits on its vessel's answer to one session ask; silence reads as a refusal by name. */
const SESSION_ASK_PATIENCE_MS = 60_000;

export function startIsland(scope?: BrowserIslandScope): void {
// THE SESSION SIGN DOOR: this island holds no session key. It names the invocation a session placed, and the vessel
// worker answers through its capability record's `sessionSign`, which the lift seats on unlock and the lock takes back
// (`browser-island-caps.ts`). A vessel at its floor answers `signer-unavailable`, and every mint here refuses by it.
const port = scope
  ? { post: (msg: unknown) => scope.post(msg as never), listen: (cb: (msg: unknown) => void) => scope.listen(cb) }
  : { post: (msg: unknown) => self.postMessage(msg), listen: (cb: (msg: unknown) => void) => self.addEventListener("message", (e: MessageEvent) => cb(e.data)) };
const sessionsOnVessel = islandSessionDoor(port, { patienceMs: SESSION_ASK_PATIENCE_MS, idPrefix: `session-sign-${crypto.randomUUID()}` });
// THE FRESH BASE (sealed-store#/owed, T6): a from-now admission cuts its fresh base off the bag's live document, which
// this island asks of the vessel worker across the document store's door, as the node's island does.
const docStorePort = { post: port.post, listen: (cb: (msg: unknown) => void) => { port.listen(cb); return () => {}; } };
const liveOnVessel = islandLiveDocDoor(docStorePort, { patienceMs: SESSION_ASK_PATIENCE_MS, idPrefix: `docstore-live-${crypto.randomUUID()}` });
runBrowserSovereignWorker((manifest) => {
  // Same-origin writes are accepted within one custody context: api/pono/session-contract.mem #/the-trust-line.
  const key = manifest.daemonAuth?.atom?.key;
  const ledgerRepo = key ? new Repo({ storage: shoreStorage(new IndexedDBStorageAdapter(`lares:island-edge-ledger:${key}`)) }) : null;
  const dyadLedger = key && ledgerRepo ? materializeSharedLarDoc(ledgerRepo, edgeLedgerDocUrl(key), "ledger:edge") : undefined;
  return makeOperatorDaemonBehavior(manifest, {
    // The island reads its signed fleet board through its own Repo; an absent edge reads clear until the signed frontier stands.
    readDyadFromBoard: true,
    ...(dyadLedger ? { dyadLedger } : {}),
    ...(ledgerRepo ? { restDyadLedger: () => ledgerRepo.flush() } : {}),
    // THE SEALED STORE'S REST (sealed-store#/the-store): the content-key holder stands beside this island's Keyhive
    // identities, over IndexedDB shelves of its own, and its roll takes this island's seat rolls.
    ...(key ? { sealedStore: idbSealedStoreShore(sealedStoreDbName(key)) } : {}),
    sessionProof: sessionsOnVessel,
    // THE DOCUMENT STORE'S DOOR (sealed-store#/owed): the vessel worker's Repo seals each save through the holder here,
    // under the ask its book holds for the session that booked the change, and opens each value it hydrates.
    docStoreDoor: docStorePort,
    freshBase: freshBasePort(liveOnVessel),
    // ONE SEED SITE: `makeDaemonBehavior` runs the cap-gated `seedDaemonProtocol` in onEa, so the daemon
    // protocol seed (Ui+Persona+Circle+Flow) stands identically on either boot. This ts-only browser vessel
    // passes HULLS_TS_ONLY → it seeds crystal alone, and its onBoot carries the projection mount.
    onBoot: (ctx) => mountProjection(ctx),
    runnableHulls: HULLS_TS_ONLY,
  });
}, scope);
}
