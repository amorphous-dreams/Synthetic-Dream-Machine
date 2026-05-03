/**
 * tw5-worker-entry — Vite named bundle entry → tw5-worker.js (no hash).
 *
 * This script runs inside a Web Worker (browser) or Worker Thread (Node).
 * All TW5Engine lifecycle + meme message dispatch lives in meme-worker-script.
 * The fixed output name is required: TW5WorkerProxy constructs the URL as
 * new URL("/tw5-worker.js", location.origin) with no content-hash suffix.
 */
export * from "@lararium/tw5/meme-worker-script.js";

