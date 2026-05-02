/**
 * @deprecated web2-era — re-exports tw5-worker-script (carrier-era VM worker).
 * Do NOT add new exports here.
 *
 * Principles worth keeping:
 *   - Re-export-as-Vite-bundle-entry pattern is correct. Vite builds this as
 *     dist/tw5-worker.js (fixed name, no hash — stable URL). Pattern survives.
 *   - Worker body is isomorphic between Node Worker Thread and Web Worker.
 *     The TW5WorkerProxy caller needs no change — only the export swaps.
 *
 * Rebuild target: swap re-export to @lararium/tw5/meme-worker-script once
 *   meme-worker-script.ts exists.
 *
 * tw5-worker-entry — browser Web Worker entry point for the TW5 recipe VM.
 *
 * Loaded by TW5WorkerProxy via:
 *   new TW5WorkerProxy(new URL("/tw5-worker.js", window.location.href))
 *
 * Vite bundles this as dist/tw5-worker.js (fixed name, no hash — stable URL).
 * The worker body is the isomorphic tw5-worker-script from @lararium/tw5.
 */

export * from "@lararium/tw5/tw5-worker-script";
