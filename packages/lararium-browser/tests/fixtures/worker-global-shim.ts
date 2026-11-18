/**
 * worker-global-shim — the first import of a worker fixture. A dedicated worker's thread already offers no `window`, `document`,
 * `localStorage` or `sessionStorage`; this shim strips the worker's own `location` down to the one `href` the dev server's module
 * transform resolves `new URL(…, import.meta.url)` against, so no `origin`, `search`, `hash`, `reload` or `assign` stands for a
 * module to reach. ES modules evaluate in import order, so this runs before every module the fixture imports after it.
 */
const href = String(globalThis.location);
Object.defineProperty(globalThis, "location", {
  value: Object.freeze({ href, toString: () => href }),
  configurable: true,
});
export const PAGE_GLOBALS = ["window", "document", "localStorage", "sessionStorage", "alert", "confirm", "prompt"] as const;
export const LOCATION_KEYS = (): string[] => Object.keys(globalThis.location as object);
