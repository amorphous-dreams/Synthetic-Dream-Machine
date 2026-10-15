/*\
title: lar:///ha.ka.ba/lararium/tw5/lib/memetic-frame
type: application/javascript
module-type: library
\*/
/**
 * lib-memetic-frame — `@lararium/memetic-frame` as ONE TW5 library tiddler.
 *
 * The carrier frame (marks, fence mask, meta opener, head reader, the one span reader, the block
 * check, the frame writer) packs into the plugin exactly once, here. Every other module tiddler
 * requires it by URI:
 *
 *   const { verifyBcc } = require("lar:///ha.ka.ba/lararium/tw5/lib/memetic-frame");
 *
 * The plugin build externalizes the package in every other bundle and rewrites the import to that
 * require, so a stock TiddlyWiki holding nothing but the standalone plugin divides and verifies a
 * carrier with the same bytes of law every vessel runs.
 */
export * from "@lararium/memetic-frame";
