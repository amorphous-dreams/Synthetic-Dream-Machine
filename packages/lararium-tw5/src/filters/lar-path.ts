/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/lar-path
type: application/javascript
module-type: filteroperator
\*/
/**
 * lar-path — the path each input title resolves to, read the way a reader resolves a URL: the scheme lower-cased, each
 * percent escape decoded, the `.` and `..` segments folded (`@lararium/mesh` `resolvedTitlePath`).
 *
 * The projection filters (`$:/config/lares/ProjectionFilter` and its class filters) read a family by its resolved path,
 * `[lar-path[]prefix[lar:///ha.ka.ba/bags/daemon/]]`, so no spelling of a title slips past the prefix it resolves to. The
 * same text runs here in TiddlyWiki's own filter engine and in the house's subset evaluator (`filterSelects`).
 */
import { resolvedTitlePath } from "@lararium/mesh/projection-filter";
import type { TW5FilterOperator, TW5FilterSource } from "../types/tiddlywiki.js";

export function larPath(source: TW5FilterSource, _operator: TW5FilterOperator): string[] {
  const results: string[] = [];
  source(function (_tiddler, title: string) { results.push(resolvedTitlePath(title)); });
  return results;
}

// The operator's name is its EXPORTED name; a hyphen needs the string form.
export { larPath as "lar-path" };
