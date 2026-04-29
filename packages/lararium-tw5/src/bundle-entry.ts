/**
 * bundle-entry.ts — IIFE entry point for TW5 module meme.
 *
 * Exposes MemeticParser and createLarariumWidgets on the global
 * `window.__lararium_tw5_modules` object so the kernel injection gate
 * (_bootModules) can reach them without ES module imports.
 */

export { MemeticParser } from "./memetic-parser.js";
export { createLarariumWidgets } from "./tw5-widgets.js";
