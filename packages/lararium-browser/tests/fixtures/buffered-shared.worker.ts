/** A SharedWorker whose runtime opens late (a slow island module): the connect listener stands first, so no port is lost. */
import { makeConnectBuffer } from "../../src/connect-buffer.js";

const sw = globalThis as unknown as { addEventListener(type: "connect", cb: (e: MessageEvent) => void): void };
const buffer = makeConnectBuffer<MessagePort>();
sw.addEventListener("connect", (event) => { const port = event.ports[0]; if (port) buffer.accept(port); });
await new Promise((resolve) => setTimeout(resolve, 1500));   // the slow module graph this fixture models
buffer.open((port) => port.postMessage({ type: "ready" }));
