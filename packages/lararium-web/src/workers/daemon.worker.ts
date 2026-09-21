// Local worker shim — runs @lararium/browser's daemon-island body. keyhive WASM instantiates first
// (worker-boot.ts), then the island chain; wrapped in run().catch (NOT top-level await) so a
// rejection surfaces as a logged error instead of a silent module-eval failure.
import { registerWorkerErrorRelay, initKeyhiveWasm } from "./worker-boot.js";

registerWorkerErrorRelay("daemon-worker");
const trace = (phase: string, detail?: string): void => {
  if (new URL(self.location.href).searchParams.get("c4trace") !== "1") return;
  self.postMessage({ __laresC4BootTrace: phase, ...(detail ? { detail } : {}) });
};

const run = async (): Promise<void> => {
  trace("worker:entry");
  trace("worker:wasm-start");
  await initKeyhiveWasm();
  trace("worker:wasm-ready");
  trace("worker:kernel-import-start");
  await import("@lararium/browser/browser-daemon-island");
  trace("worker:kernel-imported");
};
void run().catch((e) => {
  const detail = e instanceof Error ? e.stack ?? e.message : String(e);
  trace("worker:startup-error", detail);
  console.error("[daemon-worker] run-threw", detail);
});
