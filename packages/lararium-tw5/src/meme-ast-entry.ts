/**
 * meme-ast-entry.ts — IIFE entry point for the memetic-wikitext-ast TW5 bundle.
 *
 * Compiled by vite.tiddlers.config.ts → dist-widgets/meme-ast.iife.js
 * Spliced into memes/modules/meme-ast-tw5.md between STX/ETX markers.
 *
 * Exposes the full meme-ast API on the global __lar_meme_ast object so that
 * the deserializer and any TW5 module can call parseMemeText() without
 * importing ES modules.
 *
 * Self-registration: if $tw is already present (IIFE loaded by TW5 boot),
 * registers the deserializer on $tw.lararium immediately.
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
