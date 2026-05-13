/**
 * meme-ast-entry.ts — CJS entry point for the meme-ast TW5 library module.
 *
 * Compiled by vite.tiddlers.config.ts → bags/@lararium/tw5/modules/meme-ast-tw5.js
 * as a native TW5 CJS tiddler with a comment-block header.
 *
 * module-type: library — accessible via require("lar:///ha.ka.ba/@lararium/tw5/modules/meme-ast-tw5")
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
} from "@lararium/core/meme-ast";

export type {
  MemeAstNode,
  MemeNode,
  PranalaEdge,
  ParseMemeResult,
} from "@lararium/core/meme-ast";
