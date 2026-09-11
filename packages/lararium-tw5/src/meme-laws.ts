/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/meme-laws
type: application/javascript
module-type: library
\*/
/**
 * meme-laws — every pure law over meme TEXT, packed ONCE as one library tiddler.
 *
 * A capability of memetic-wikitext is a law over bytes: normalize a carrier's framing, compute and
 * verify its block check, read its shape down the ingest gradient, read every address it points at,
 * read what its head names. None of these touches a disk, a socket, or a store, so each one reaches
 * every context the plugin reaches — a stock TiddlyWiki, a lararium island, a worker, a browser —
 * the moment it rides the plugin.
 *
 * ONE COPY. The deserializer, the placement, the markdown projection and the in-VM face all need
 * these laws; the plugin build (`plugin-build/vite-plugin-build.ts`) rewrites every relative import
 * of a law module to `require("lar:///ha.ka.ba/lararium/tw5/modules/meme-laws")`, so the body below
 * is the only place the functions exist inside the packed plugin. A consumer outside the plugin
 * (the CLI, the sensorium) keeps importing the source modules by name through `@lararium/tw5`.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

export * from "./meme-normalize.js";
export * from "./block-check.js";
export * from "./carrier-check.js";
export * from "./carrier-shape.js";
export * from "./carrier-edges.js";
export * from "./carrier-head.js";
export * from "./frame-marks.js";
