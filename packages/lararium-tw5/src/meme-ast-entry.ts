/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/meme-ast
type: application/javascript
module-type: library
\*/
/**
 * meme-ast-entry.ts — CJS entry point for the meme-ast TW5 library module.
 *
 * Compiled by vite.plugin.config.ts → packages/lararium-tw5/tiddlers/src/meme-ast.js
 * as a native TW5 CJS tiddler with a comment-block header.
 *
 * module-type: library — accessible via require("lar:///ha.ka.ba/@lararium/tw5/modules/meme-ast")
 * inside the TW5 VM. The deserializer and other TW5 modules use parseMemeText() from here.
 */

export {
  parseMemeText,
  parseMemeNodes,
  parseMemeEdges,
  collectEvents,
  buildMemeAst,
  edgesFromMemeAst,
  BOOTSTRAP_SCANS,
} from "./meme-ast/index.js";

export type {
  MemeAstNode,
  MemeNode,
  PranalaEdge,
  ParseMemeResult,
} from "./meme-ast/index.js";
