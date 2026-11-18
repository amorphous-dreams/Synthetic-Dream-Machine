import { expect, test } from "vitest";
import { readyWorker } from "./fixtures/ready-worker.js";

test("RED: a ready handshake delivers an immediate ask to a late listener; CONTROL: early listener opens and a load fault rejects", async () => {
  await expect(readyWorker(new URL("./fixtures/faulting-tab.worker.ts", import.meta.url))).rejects.toThrow();
  const early = await readyWorker(new URL("./fixtures/early-listener-tab.worker.ts", import.meta.url));
  early.terminate();
  const worker = await readyWorker(new URL("./fixtures/late-listener-tab.worker.ts", import.meta.url));
  try {
    const reply = new Promise((resolve, reject) => {
      worker.addEventListener("message", (event) => resolve(event.data), { once: true });
      worker.addEventListener("error", reject, { once: true });
    });
    worker.postMessage({ op: "status" });
    expect(await reply).toEqual({ op: "status", ok: true });
  } finally { worker.terminate(); }
}, 10_000);
