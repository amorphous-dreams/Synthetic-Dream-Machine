/*\
title: lar:///ha.ka.ba/@lararium/tw5/filters/bag-path
type: application/javascript
module-type: filteroperator
\*/
import type { TW5FilterOperator, TW5FilterSource } from "../types/tiddlywiki.js";

const PREFIX = "lar:///ha.ka.ba/";
const LARES_SCOPE = "@lares/";
const ENGINE_SCOPE = "@lararium/";

function splitHash(value: string): [string, string | null] {
  const index = value.indexOf("#");
  return index >= 0 ? [value.slice(0, index), value.slice(index + 1)] : [value, null];
}

function stripMd(value: string): string {
  return value.endsWith(".md") ? value.slice(0, -3) : value;
}

function withFrag(base: string, frag: string | null): string {
  return frag ? `${base}/${frag}.md` : `${base}.md`;
}

function laresRelPath(uri: string): string | null {
  if (!uri.startsWith(PREFIX)) return null;
  let rest = uri.slice(PREFIX.length);
  if (rest.startsWith(ENGINE_SCOPE)) return null;
  if (rest.startsWith(LARES_SCOPE)) {
    rest = rest.slice(LARES_SCOPE.length);
  } else if (rest.startsWith("@")) {
    return null;
  }

  const [pathPart, frag] = splitHash(rest);
  const base = stripMd(pathPart ?? "");
  if (!base) return null;
  return withFrag(base, frag);
}

function wikiShadowRelPath(uri: string): string | null {
  if (!uri.startsWith(PREFIX)) return null;
  let rest = uri.slice(PREFIX.length);
  let dirPrefix: string;

  if (rest.startsWith(LARES_SCOPE)) {
    rest = rest.slice(LARES_SCOPE.length);
    dirPrefix = "lares/";
  } else if (rest.startsWith(ENGINE_SCOPE)) {
    rest = rest.slice(ENGINE_SCOPE.length);
    dirPrefix = "lararium/";
  } else if (rest.startsWith("@")) {
    return null;
  } else {
    dirPrefix = "lares/";
  }

  const [pathPart, frag] = splitHash(rest);
  const base = stripMd(pathPart ?? "");
  if (!base) return null;
  return frag ? `${dirPrefix}${base}/${frag}.md` : `${dirPrefix}${base}.md`;
}

function engineRelPath(uri: string): string | null {
  const scope = PREFIX + ENGINE_SCOPE;
  if (!uri.startsWith(scope)) return null;
  const tail = uri.slice(scope.length);
  if (!tail) return null;

  const [pathPart, frag] = splitHash(tail);
  const base = stripMd(pathPart ?? "");
  if (!base) return null;
  return withFrag(base, frag);
}

export function bagPath(source: TW5FilterSource, operator: TW5FilterOperator): string[] {
  const strategy = (operator.operand ?? "lares").trim();
  const results: string[] = [];

  source(function (_tiddler, title: string) {
    let relPath: string | null = null;
    if (strategy === "lares") relPath = laresRelPath(title);
    else if (strategy === "wiki-shadow") relPath = wikiShadowRelPath(title);
    else if (strategy === "engine") relPath = engineRelPath(title);
    if (relPath) results.push(relPath);
  });

  return results;
}