/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/md-file-router
type: application/javascript
module-type: startup
\*/
/**
 * md-file-router — sniff .md files at import time and route carriers to
 * text/x-memetic-wikitext; all others fall through to text/x-markdown.
 *
 * A carrier .md file has the SOH DOCTYPE sigil on its first line:
 *   <<~ ... &#x0011; ... >>   (namespace-phase SOH)
 *   <<~ ... &#x0001; ... >>   (bare SOH, legacy)
 *
 * TW5's registerFileType last-write-wins. This startup module runs after
 * core boot and re-registers .md → text/x-md-auto. The paired
 * tiddlerdeserializer for text/x-md-auto peeks at the first line and
 * delegates to the appropriate deserializer.
 *
 * Drag-and-drop, the import dialog, and the filesystem adaptor all route
 * through $tw.config.fileExtensionInfo — one registration covers all three.
 */

const SNIFF_TYPE    = "text/x-md-auto";
const MEMETIC_TYPE  = "text/x-memetic-wikitext";
const MARKDOWN_TYPE = "text/x-markdown";

// SOH carrier sentinel on line 1 — matches &#x0001; or &#x0011; variant.
const DOCTYPE_RE = /^<<~[^>]*&#x(?:0001|0011);/;

interface TwUtils {
  registerFileType(type: string, encoding: string, extensions: string[], options?: Record<string, unknown>): void;
}

interface TwDeserializers {
  [type: string]: (text: string, fields?: Record<string, unknown>) => Array<Record<string, unknown>>;
}

interface TwGlobal {
  utils:        TwUtils;
  Wiki?:        { tiddlerDeserializerModules?: TwDeserializers };
  modules?: {
    types?: {
      tiddlerdeserializer?: Record<string, { exports?: TwDeserializers }>;
    };
  };
}

// ---------------------------------------------------------------------------
// startup export
// ---------------------------------------------------------------------------

export const name      = "lararium-md-file-router";
export const platforms = ["browser", "node"];
export const after     = ["startup"];
export const synchronous = true;

export function startup(): void {
  const tw = (globalThis as { $tw?: TwGlobal }).$tw;
  if (!tw?.utils?.registerFileType) return;
  tw.utils.registerFileType(SNIFF_TYPE, "utf8", [".md", ".markdown"]);
}

// ---------------------------------------------------------------------------
// tiddlerdeserializer export — peek first line, delegate
// ---------------------------------------------------------------------------

function resolveDeserializer(tw: TwGlobal, type: string) {
  // TW5 collects tiddlerdeserializer modules into $tw.modules.types.
  const mods = tw.modules?.types?.["tiddlerdeserializer"] ?? {};
  for (const [, mod] of Object.entries(mods)) {
    const fn = mod.exports?.[type];
    if (typeof fn === "function") return fn;
  }
  return null;
}

function mdAutoDeserializer(
  text:    string,
  fields?: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const tw = (globalThis as { $tw?: TwGlobal }).$tw;

  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);
  const targetType = DOCTYPE_RE.test(firstLine) ? MEMETIC_TYPE : MARKDOWN_TYPE;

  if (tw) {
    const fn = resolveDeserializer(tw, targetType);
    if (fn) return fn(text, fields);
  }

  // Fallback: return a single tiddler with the raw text typed appropriately.
  return [{ ...fields, type: targetType, text }];
}

export { mdAutoDeserializer as "text/x-md-auto" };
