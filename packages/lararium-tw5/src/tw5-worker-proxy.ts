/**
 * TW5WorkerProxy — RecipeVm backed by a Worker Thread (Node) or Web Worker (browser).
 *
 * Spawns a tw5-worker-script instance and forwards RecipeVm calls as structured-clone
 * messages. Request/response pairs are matched by a monotonic id.
 *
 * Fire-and-forget ops (setTiddler, removeTiddler, dispose) post without waiting.
 * All other ops return Promises resolved by the response listener.
 *
 * Usage (Node):
 *   const proxy = new TW5WorkerProxy(new URL("./tw5-worker-script.js", import.meta.url));
 *   await proxy.boot();
 *   await proxy.loadRecords(records);
 *   // VM is live — same interface as DirectRecipeVm from this point on.
 *
 * Usage (browser, Vite):
 *   const proxy = new TW5WorkerProxy(new URL("./tw5-worker-script.ts?worker", import.meta.url));
 *
 * The VmPool factory is the only place that constructs a TW5WorkerProxy —
 * all server-api call sites are backend-agnostic.
 */

import type { RecipeVm, SerializedRecord } from "./recipe-vm.js";

// ---------------------------------------------------------------------------
// Isomorphic worker constructor — Node Worker Thread or browser Web Worker
// ---------------------------------------------------------------------------

type AnyWorker = {
  postMessage(data: unknown): void;
  on?(event: string, handler: (data: unknown) => void): void;
  addEventListener?(type: string, handler: (e: MessageEvent) => void): void;
  terminate(): void | Promise<void>;
};

function spawnWorker(scriptUrl: URL): AnyWorker {
  if (
    typeof process !== "undefined" &&
    typeof process.versions?.node === "string"
  ) {
    // Node Worker Thread — dynamic import so browser bundles never see it
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Worker } = require("node:worker_threads") as typeof import("node:worker_threads");
    return new Worker(scriptUrl) as unknown as AnyWorker;
  }
  // Web Worker (browser)
  return new Worker(scriptUrl, { type: "module" }) as unknown as AnyWorker;
}

// ---------------------------------------------------------------------------
// TW5WorkerProxy
// ---------------------------------------------------------------------------

export class TW5WorkerProxy implements RecipeVm {
  private readonly _worker: AnyWorker;
  private readonly _pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private _seq = 0;

  constructor(scriptUrl: URL) {
    this._worker = spawnWorker(scriptUrl);

    const onMessage = (msg: unknown) => {
      const { id, ok, result, error } = msg as {
        id: string; ok: boolean; result?: unknown; error?: string;
      };
      const pending = this._pending.get(id);
      if (!pending) return;
      this._pending.delete(id);
      if (ok) pending.resolve(result);
      else pending.reject(new Error(error ?? "Worker error"));
    };

    if (this._worker.on) {
      // Node Worker Thread
      this._worker.on("message", onMessage);
    } else if (this._worker.addEventListener) {
      // Web Worker
      this._worker.addEventListener("message", (e: MessageEvent) => onMessage(e.data));
    }
  }

  private request<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    const id = String(this._seq++);
    return new Promise<T>((resolve, reject) => {
      this._pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this._worker.postMessage({ id, type, ...payload });
    });
  }

  private send(type: string, payload: Record<string, unknown> = {}): void {
    this._worker.postMessage({ type, ...payload });
  }

  // -------------------------------------------------------------------------
  // RecipeVm implementation
  // -------------------------------------------------------------------------

  /** Boot the TW5 engine inside the Worker. Must be called before all else. */
  boot(): Promise<void> {
    return this.request("boot");
  }

  async loadRecords(records: SerializedRecord[]): Promise<void> {
    await this.request("loadRecords", { records });
  }

  setTiddler(fields: Record<string, string | string[]>): void {
    this.send("setTiddler", { fields });
  }

  removeTiddler(title: string): void {
    this.send("removeTiddler", { title });
  }

  filterTiddlers(expr: string): Promise<string[]> {
    return this.request("filterTiddlers", { expr });
  }

  renderCarrier(uri: string): Promise<string | null> {
    return this.request("renderCarrier", { uri });
  }

  dispose(): void {
    this.send("dispose");
    // Reject all pending requests — the Worker is going away.
    for (const { reject } of this._pending.values()) {
      reject(new Error("TW5WorkerProxy disposed"));
    }
    this._pending.clear();
    void this._worker.terminate();
  }
}
