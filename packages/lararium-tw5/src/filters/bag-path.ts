/**
 * lar-bag-path — TW5 filter operator: URI → mirror-relative file path.
 *
 * Wiki-first: path computation rules live here in the VM, not in TypeScript
 * node-layer strategy functions.  Pure string arithmetic — no filesystem
 * imports, no I/O.  Runs identically in the browser bundle and in Node.
 *
 * Operator syntax:
 *
 *   [lar-bag-path[strategy]]
 *
 * The source is a set of `lar:` URIs; the operand selects a strategy.
 * Each URI that can be mapped to a file path emits that path; URIs that are
 * virtual (doc-identity, @-scoped that don't match the strategy, etc.) are
 * silently dropped.
 *
 * Supported strategies:
 *
 *   lares        — `lar:///ha.ka.ba/{rest}` or `lar:///ha.ka.ba/@lares/{rest}`
 *                  →  `{rest}.md` (fragments → `{rest}/{frag}.md`)
 *                  mirrorRoot = bags/@lares
 *
 *   wiki-shadow  — bare URIs → `lares/{rest}.md`;
 *                  @lares/* → `lares/{rest}.md`;
 *                  @lararium/* → `lararium/{rest}.md`
 *                  mirrorRoot = wikis/@{slug}
 *
 *   engine       — `lar:///ha.ka.ba/@lararium/{tail}`
 *                  → `{tail}.md`  (direct bijection)
 *                  mirrorRoot = bags/@lararium
 *
 * Design contract: `file-path = mirrorRoot + "/" + relPath` (pure string concat,
 * no path.join, no path.relative).
 */

import type { TW5Instance, TW5FilterSource, TW5FilterOperator, TW5Wiki } from "../types/tiddlywiki.js";

const PREFIX = "lar:///ha.ka.ba/";
const LARES_SCOPE  = "@lares/";
const ENGINE_SCOPE = "@lararium/";

/** Split a lar: URI at the first `#`, returning base and optional fragment. */
function splitHash(s: string): [string, string | null] {
  const i = s.indexOf("#");
  return i >= 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, null];
}

function stripMd(p: string): string {
  return p.endsWith(".md") ? p.slice(0, -3) : p;
}

/** Append fragment as sub-directory when present. */
function withFrag(base: string, frag: string | null): string {
  return frag ? `${base}/${frag}.md` : `${base}.md`;
}

/**
 * lares strategy:
 *   lar:///ha.ka.ba/{rest}        → {rest}.md
 *   lar:///ha.ka.ba/@lares/{rest} → {rest}.md
 *   fragment → {rest}/{frag}.md
 *   @-prefixed (non-lares) → null (virtual)
 */
function laresRelPath(uri: string): string | null {
  if (!uri.startsWith(PREFIX)) return null;
  let rest = uri.slice(PREFIX.length);

  if (rest.startsWith(ENGINE_SCOPE)) return null;  // @lararium/ = engine, not lares
  if (rest.startsWith(LARES_SCOPE)) {
    rest = rest.slice(LARES_SCOPE.length);
  } else if (rest.startsWith("@")) {
    return null;  // other @-scoped doc identities = virtual
  }
  const [pathPart, frag] = splitHash(rest);
  const base = stripMd(pathPart ?? "");
  if (!base) return null;
  return withFrag(base, frag);
}

/**
 * wiki-shadow strategy:
 *   lar:///ha.ka.ba/@lares/{rest}     → lares/{rest}.md
 *   lar:///ha.ka.ba/@lararium/{rest}  → lararium/{rest}.md
 *   lar:///ha.ka.ba/{bare-rest}       → lares/{rest}.md  (bare = lares territory)
 *   other @-scoped → null (virtual)
 */
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
    return null;  // other doc-identity scopes = virtual
  } else {
    dirPrefix = "lares/";  // bare = lares territory
  }

  const [pathPart, frag] = splitHash(rest);
  const base = stripMd(pathPart ?? "");
  if (!base) return null;
  return frag ? `${dirPrefix}${base}/${frag}.md` : `${dirPrefix}${base}.md`;
}

/**
 * engine strategy:
 *   lar:///ha.ka.ba/@lararium/{tail} → {tail}.md  (direct bijection)
 */
function engineRelPath(uri: string): string | null {
  const SCOPE = PREFIX + ENGINE_SCOPE;
  if (!uri.startsWith(SCOPE)) return null;
  const tail = uri.slice(SCOPE.length);
  if (!tail) return null;
  const [pathPart, frag] = splitHash(tail);
  const base = stripMd(pathPart ?? "");
  if (!base) return null;
  return withFrag(base, frag);
}

export function registerBagPath(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;

  tw.filterOperators["lar-bag-path"] = function (
    source:   TW5FilterSource,
    operator: TW5FilterOperator,
    _options: { wiki: TW5Wiki },
  ): string[] {
    const strategy = (operator.operand ?? "lares").trim();
    const results: string[] = [];

    source(function (_tiddler: unknown, title: string) {
      let relPath: string | null = null;
      if (strategy === "lares")        relPath = laresRelPath(title);
      else if (strategy === "wiki-shadow") relPath = wikiShadowRelPath(title);
      else if (strategy === "engine")      relPath = engineRelPath(title);
      if (relPath) results.push(relPath);
    });

    return results;
  };
}
