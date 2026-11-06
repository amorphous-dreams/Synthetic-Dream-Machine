/**
 * ward.worker — THE PER-ACT WORKER ONE BROWSER WARD ACT RUNS IN (seat-harness#/the-ward).
 *
 * The vessel spawns one for one act, hands it a MessagePort, posts the act's request (the keystore tree and the root's sealed row as
 * raw bytes, the typed passphrase, the bytes to sign), reads one answer and terminates it. The tree key and the seed live only in
 * this worker's memory for the act, and the answer carries the root's public key and the signature alone (`ward-core`).
 *
 * The vessel worker spawns it: the passphrase reaches that worker from the unlock ceremony's clean document, never from the
 * surface page (browser-vessel-lift#/the-ceremony).
 */
import type { WardActRequest } from "./ward-core.js";

const scope = globalThis as unknown as { addEventListener(type: "message", listener: (e: MessageEvent) => void): void; close(): void };
// The listener stands before anything loads: this entry imports nothing at evaluation, since a bundled import graph that
// awaits at its top level lets the port's message arrive before a listener stands, and that message is lost. The pure core
// loads on the act's own request.
scope.addEventListener("message", (e: MessageEvent) => {
  const port = e.ports[0];
  if (!port) return;
  port.onmessage = async (m: MessageEvent) => {
    const { runWardAct } = await import("./ward-core.js");
    const answer = await runWardAct(m.data as WardActRequest);
    port.postMessage(answer);
    port.close();
    scope.close();
  };
});
