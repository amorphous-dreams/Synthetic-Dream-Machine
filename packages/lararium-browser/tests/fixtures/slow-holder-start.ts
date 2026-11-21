/** The shape of `startHolder`: a module whose evaluation waits, then opens the buffer. */
import type { makeConnectBuffer } from "../../src/connect-buffer.js";
await new Promise((resolve) => setTimeout(resolve, 1500));   // the slow island module this fixture models
export function startHolder(buffer: ReturnType<typeof makeConnectBuffer<MessagePort>>): void {
  buffer.open((port) => port.postMessage({ type: "ready" }));
}
