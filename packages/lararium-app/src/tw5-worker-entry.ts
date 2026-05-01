/**
 * tw5-worker-entry — browser Web Worker entry point for the TW5 recipe VM.
 *
 * Loaded by TW5WorkerProxy via:
 *   new TW5WorkerProxy(new URL("/tw5-worker.js", window.location.href))
 *
 * Vite bundles this as dist/tw5-worker.js (fixed name, no hash — stable URL).
 * The worker body is the isomorphic tw5-worker-script from @lararium/tw5.
 */

export * from "@lararium/tw5/tw5-worker-script";
