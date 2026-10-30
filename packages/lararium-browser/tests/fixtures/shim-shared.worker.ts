/** Mirrors the production holder shim: the connect listener stands in the synchronous top level; the runtime arrives by a slow dynamic import. */
import { makeConnectBuffer } from "../../src/connect-buffer.js";

const sw = globalThis as unknown as { addEventListener(type: "connect", cb: (e: MessageEvent) => void): void };
const buffer = makeConnectBuffer<MessagePort>();
sw.addEventListener("connect", (event) => { const port = event.ports[0]; if (port) buffer.accept(port); });
void import("./slow-holder-start.js").then((module) => module.startHolder(buffer));
