/**
 * ward-worker — THE PER-ACT WORKER ONE BROWSER WARD ACT RUNS IN (seat-harness#/the-ward).
 *
 * The page spawns one for one act, hands it a MessagePort, posts the act's request (the keystore tree and the root's sealed row as
 * raw bytes, the typed passphrase, the bytes to sign), reads one answer and terminates it. The tree key and the seed live only in
 * this worker's memory for the act, and the answer carries the root's public key and the signature alone (`ward-core`).
 *
 * Residual, named: the page passes the typed passphrase over the MessagePort, so a script running in the page when the person
 * types it reads it. The ward never holds a key on the page; it cannot keep a page script from reading what the page's own
 * dialog collects.
 */
import { runWardAct, type WardActRequest } from "./ward-core.js";

const scope = globalThis as unknown as { onmessage: ((e: MessageEvent) => void) | null; close(): void };
scope.onmessage = (e: MessageEvent) => {
  const port = e.ports[0];
  if (!port) return;
  port.onmessage = async (m: MessageEvent) => {
    const answer = await runWardAct(m.data as WardActRequest);
    port.postMessage(answer);
    port.close();
    scope.close();
  };
};
