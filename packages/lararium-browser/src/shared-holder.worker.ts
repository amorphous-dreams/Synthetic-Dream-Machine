/** Direct SharedWorker entry: buffer connections while the holder starts. */
import { makeConnectBuffer } from "./connect-buffer.js";
import { startHolder } from "./shared-holder-start.js";

const sw = globalThis as unknown as {
  addEventListener(type: "connect", cb: (event: MessageEvent) => void): void;
};
const buffer = makeConnectBuffer<MessagePort>();
sw.addEventListener("connect", (event) => {
  const port = event.ports[0];
  if (port) buffer.accept(port);
});
void startHolder(buffer).catch((e) =>
  console.error("[shared-holder] run-threw", e instanceof Error ? e.stack : String(e)));
