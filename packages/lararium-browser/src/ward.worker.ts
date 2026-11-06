/**
 * ward.worker — THE PER-ACT WORKER ONE BROWSER WARD ACT RUNS IN (seat-harness#/the-ward).
 *
 * The page spawns one for one act, hands it a MessagePort, posts the act's request (the face's ward tree and its warded root row as
 * raw bytes, the typed route, the bytes to sign), reads one answer and terminates it. The ward key and the seed live only in
 * this worker's memory for the act, and the answer carries the public key and the signature alone (`ward-core`); a face's ward key
 * MINTS here too, its answer adding the two sealed rows the page lands and cannot open.
 *
 * Residual, named: the page passes the typed passphrase over the MessagePort, so a script running in the page when the person
 * types it reads it. The ward never holds a key on the page; it cannot keep a page script from reading what the page's own
 * dialog collects.
 */
import type { WardActRequest, WardKeyActRequest, WardKeyMintRequest } from "./ward-core.js";

const scope = globalThis as unknown as { addEventListener(type: "message", listener: (e: MessageEvent) => void): void; close(): void };
// The listener stands before anything loads: the entry imports no module at evaluation, so the page's port never arrives to an
// entry that is not listening yet. A bundle evaluates static imports first, and the mesh's wasm init awaits at top level there;
// a message posted meanwhile reached no listener and dropped, so the act never answered. The ward core loads inside the act.
scope.addEventListener("message", (e: MessageEvent) => {
  const port = e.ports[0];
  if (!port) return;
  port.onmessage = async (m: MessageEvent) => {
    // A core that fails to load answers by name: the act refuses, it never waits.
    const answer = await import("./ward-core.js").then(
      ({ runWardAct }) => runWardAct(m.data as WardActRequest | WardKeyActRequest | WardKeyMintRequest),
      () => ({ refused: "ward-worker-failed" }),
    );
    port.postMessage(answer);
    port.close();
    scope.close();
  };
});
