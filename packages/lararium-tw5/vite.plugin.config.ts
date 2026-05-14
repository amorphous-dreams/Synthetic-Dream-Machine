/**
 * vite.plugin.config.ts — stable CLI/export surface for TW5 plugin module builds.
 *
 * The sub-Vite build machinery lives in plugin-build/ so each phase carries a
 * small web3/local-first claim: discover source modules, parse TW5 headers,
 * compile CJS tiddler bodies, and emit a content-addressed module manifest.
 */

import { pathToFileURL } from "url";
import { buildPluginCjsTiddlers } from "./plugin-build/vite-plugin-build.js";
export { buildPluginCjsTiddlers };
export { MODULE_MANIFEST, TIDDLERS_DIR, TIDDLER_SRC_DIR } from "./plugin-build/paths.js";

/** Kept for build-plugin-tiddler.ts compatibility; anchor patching now driven by bags/ scan. */
export const PLUGIN_ENTRIES: Array<{ name: string; anchor?: string }> = [];

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildPluginCjsTiddlers().catch((err) => { console.error(err); process.exit(1); });
}
