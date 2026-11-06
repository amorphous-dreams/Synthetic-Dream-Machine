// The vessel worker's entry (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift): the browser vessel runs here, on this worker's own thread, and the
// page talks to it over this worker's port alone. Keyhive's WASM instantiates first (worker-boot.ts), then the vessel chain
// evaluates; the page's messages that arrive meanwhile wait in order. Wrapped in run().catch (never a top-level await) so a
// rejection surfaces as a logged error and an `ended` message instead of a silent module-eval failure.
import { registerWorkerErrorRelay, initKeyhiveWasm } from "./worker-boot.js";
import type { PageToVessel, VesselToPage } from "../vessel-protocol.js";

registerWorkerErrorRelay("vessel-worker");

const scope = self as unknown as { postMessage(msg: VesselToPage, transfer: Transferable[]): void; addEventListener(type: "message", l: (e: MessageEvent) => void): void };
const waiting: PageToVessel[] = [];
let receive: ((msg: PageToVessel) => void) | null = null;
scope.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as PageToVessel;
  if (receive) receive(msg); else waiting.push(msg);
});

const run = async (): Promise<void> => {
  await initKeyhiveWasm();
  const { serveVessel } = await import("./vessel-host.js");
  const served = serveVessel({ postMessage: (msg, transfer = []) => scope.postMessage(msg, transfer) });
  receive = served.receive;
  for (const msg of waiting.splice(0)) served.receive(msg);
};
void run().catch((e: unknown) => {
  const detail = e instanceof Error ? e.stack ?? e.message : String(e);
  console.error("[vessel-worker] run-threw", detail);
  scope.postMessage({ t: "ended", why: `the vessel worker did not stand: ${e instanceof Error ? e.message : String(e)}`, stage: "open" }, []);
});
