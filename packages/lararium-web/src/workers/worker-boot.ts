// Shared worker-boot parts for the island worker shims (daemon · wiki). Both register the same
// self-error relay and instantiate the keyhive WASM the same way before their island chain
// evaluates; only the island body import differs (kept a static literal in each entry so Vite
// statically resolves the worker bundle — vitejs/vite#10837).

/** Register the worker's error + unhandledrejection relay (the worker console doesn't bubble). */
export function registerWorkerErrorRelay(label: string): void {
  const report = (kind: string, detail: unknown): void => {
    try { console.error(`[${label}]`, kind, String(detail).slice(0, 600)); } catch { /* never throw from the relay */ }
  };
  self.addEventListener("error", (e) =>
    report("error", (e as ErrorEvent).message || (e as ErrorEvent).error?.stack || e));
  self.addEventListener("unhandledrejection", (e) =>
    report("reject", (e as PromiseRejectionEvent).reason?.stack || (e as PromiseRejectionEvent).reason?.message || (e as PromiseRejectionEvent).reason));
}

/**
 * Instantiate the keyhive WASM BEFORE the island chain evaluates. The slim build does NOT
 * auto-init (its `new URL(_bg.wasm, import.meta.url)` would mis-resolve in a worker bundle), so the
 * wasm rides as CONTENT, off the module graph: the package's base64 export, decoded here and handed
 * to `initSync`. The provider's own feed later finds this instance live and agrees with it.
 */
export async function initKeyhiveWasm(): Promise<void> {
  const KH = await import("@keyhive/keyhive/slim");
  const { wasmBase64 } = await import("@keyhive/keyhive/wasm-base64");
  const bytes = Uint8Array.from(atob(wasmBase64), (character) => character.charCodeAt(0));
  (KH as unknown as { initSync: (input: { module: Uint8Array }) => unknown }).initSync({ module: bytes });
}
