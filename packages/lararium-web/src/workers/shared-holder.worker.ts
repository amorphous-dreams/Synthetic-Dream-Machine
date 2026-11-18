// Production SharedWorker entry: capture connections synchronously while the holder starts its island.
import { makeConnectBuffer } from "@lararium/browser/connect-buffer";
import { registerWorkerErrorRelay } from "./worker-boot.js";

registerWorkerErrorRelay("shared-holder");

const buffer = makeConnectBuffer<MessagePort>();
(self as unknown as SharedWorkerGlobalScope).addEventListener("connect", (event: MessageEvent) => {
  const port = event.ports[0];
  if (port) buffer.accept(port);
});
void import("@lararium/browser/shared-holder-start").then((m) => m.startHolder(buffer)).catch((e) =>
  console.error("[shared-holder] run-threw", e instanceof Error ? e.stack : String(e)));
