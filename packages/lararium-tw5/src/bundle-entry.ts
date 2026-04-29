/**
 * bundle-entry.ts — IIFE entry point for TW5 module meme.
 *
 * Exposes MemeticParser, createLarariumWidgets, and registerImplementorsOperator
 * on the global `window.__lararium_tw5_modules` object so the kernel injection
 * gate (_bootModules) can reach them without ES module imports.
 *
 * Also self-registers the implementors filter operator immediately on load,
 * using the $tw global that TW5 sets before running IIFE bundles.
 */

export { MemeticParser } from "./memetic-parser.js";
export { createLarariumWidgets, registerImplementorsOperator } from "./tw5-widgets.js";

// Self-register the implementors operator when the IIFE executes in TW5 context.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tw = (globalThis as any).$tw;
if (tw) {
  import("./tw5-widgets.js").then(({ registerImplementorsOperator }) => {
    registerImplementorsOperator(tw);
  });
}
