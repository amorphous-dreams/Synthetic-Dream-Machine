// Local SharedWorker shim — runs @lararium/browser's shared-holder body: one daemon island per origin, a port per
// tab. The holder spawns the daemon island (a nested dedicated worker) from the `?island=` URL its own URL carries.
import { registerWorkerErrorRelay } from "./worker-boot.js";

registerWorkerErrorRelay("shared-holder");

void import("@lararium/browser/shared-holder-worker").catch((e) =>
  console.error("[shared-holder] run-threw", e instanceof Error ? e.stack : String(e)));
