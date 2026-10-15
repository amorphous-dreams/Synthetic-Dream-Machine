/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/meme-laws
type: application/javascript
module-type: library
\*/
/**
 * meme-laws — every pure law over meme TEXT, packed ONCE as one library tiddler.
 *
 * A capability of memetic-wikitext is a law over bytes: normalize a carrier, read its shape down the
 * ingest gradient, read every address it points at, read the stage it stands in. None of these touches
 * a disk, a socket, or a store, so each one reaches
 * every context the plugin reaches — a stock TiddlyWiki, a lararium island, a worker, a browser —
 * the moment it rides the plugin.
 *
 * ONE COPY. The deserializer, the placement, the markdown projection and the in-VM face all need
 * these laws; the plugin build (`plugin-build/vite-plugin-build.ts`) rewrites every relative import
 * of a law module to `require("lar:///ha.ka.ba/lararium/tw5/modules/meme-laws")`, so the body below
 * is the only place the functions exist inside the packed plugin. A consumer outside the plugin
 * (the CLI, the sensorium) keeps importing the source modules by name through `@lararium/tw5`.
 *
 * THE FRAME IS NOT HERE. The marks, the span reader, the block check and the frame writer are
 * `@lararium/memetic-frame`, which the plugin packs as ITS OWN library tiddler
 * (`lar:///ha.ka.ba/lararium/tw5/lib/memetic-frame`) — once, required by URI from every module here.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

export * from "./meme-normalize.js";
export * from "./carrier-shape.js";
export * from "./carrier-edges.js";
export * from "./carrier-lifecycle.js";
