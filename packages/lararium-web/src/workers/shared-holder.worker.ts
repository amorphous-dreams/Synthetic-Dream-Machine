// Local SharedWorker shim — runs @lararium/browser's shared-holder body: one daemon island per house, a port per
// tab. The holder starts the daemon island in this realm over a local MessageChannel.
import { registerWorkerErrorRelay } from "./worker-boot.js";

registerWorkerErrorRelay("shared-holder");

void import("@lararium/browser/shared-holder-worker").catch((e) =>
  console.error("[shared-holder] run-threw", e instanceof Error ? e.stack : String(e)));
