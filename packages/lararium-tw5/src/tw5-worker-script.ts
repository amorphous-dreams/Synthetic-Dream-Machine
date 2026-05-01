/**
 * tw5-worker-script — TW5 RecipeVm running inside a Worker context.
 *
 * Executed inside a Node Worker Thread or browser Web Worker.
 * Receives WorkerRequest messages from TW5WorkerProxy, runs TW5 operations,
 * and posts WorkerResponse messages back.
 *
 * Isomorphic: detects Node (parentPort) vs browser (self) at runtime.
 * Same protocol on both sides — the VmPool factory chooses the Worker type.
 *
 * Message protocol:
 *   Request  { id?, type, ...payload }
 *   Response { id,  ok: true,  result? }  |  { id, ok: false, error: string }
 *
 *   Fire-and-forget types (setTiddler, removeTiddler, dispose) carry no id
 *   and expect no response.
 */

import { LarariumTW5 } from "./lararium-tw5.js";
import { exportCarrierText } from "./carrier-write.js";
import type { SerializedRecord } from "./recipe-vm.js";

let vm: LarariumTW5 | null = null;

// ---------------------------------------------------------------------------
// Message handler — all Worker operations run here
// ---------------------------------------------------------------------------

async function handle(msg: Record<string, unknown>): Promise<void> {
  const id   = msg["id"] as string | undefined;
  const type = msg["type"] as string;

  try {
    let result: unknown = undefined;

    switch (type) {
      case "boot":
        vm = new LarariumTW5();
        await vm.boot();
        break;

      case "loadRecords": {
        const records = msg["records"] as SerializedRecord[];
        vm!.bulkSetTiddlers(
          records.map((r) => ({
            title: r.title,
            ...r.fields,
            ...(r.text !== undefined ? { text: r.text } : {}),
          })),
        );
        break;
      }

      case "setTiddler":
        vm!.setTiddler(msg["fields"] as Record<string, string | string[]>);
        return; // fire and forget

      case "removeTiddler":
        vm!.removeTiddler(msg["title"] as string);
        return; // fire and forget

      case "filterTiddlers":
        result = vm!.filterTiddlers(msg["expr"] as string);
        break;

      case "renderCarrier":
        try { result = exportCarrierText(vm!, msg["uri"] as string); }
        catch  { result = null; }
        break;

      case "dispose":
        vm?.dispose();
        vm = null;
        return; // fire and forget
    }

    if (id) _post({ id, ok: true, result });
  } catch (e) {
    if (id) _post({ id, ok: false, error: String(e) });
  }
}

// ---------------------------------------------------------------------------
// Isomorphic port — Node Worker Thread vs Web Worker
// ---------------------------------------------------------------------------

let _post: (msg: object) => void = () => {};

if (
  typeof process !== "undefined" &&
  typeof process.versions?.node === "string"
) {
  // Node Worker Thread
  const { parentPort } = await import("node:worker_threads");
  _post = (msg) => parentPort!.postMessage(msg);
  parentPort!.on("message", (msg: Record<string, unknown>) => void handle(msg));
} else {
  // Web Worker
  _post = (msg) => (globalThis as unknown as Worker).postMessage(msg);
  (globalThis as unknown as Worker).onmessage = (e: MessageEvent) =>
    void handle(e.data as Record<string, unknown>);
}
