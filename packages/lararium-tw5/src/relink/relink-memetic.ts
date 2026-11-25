/*\
title: lar:///ha.ka.ba/lararium/tw5/relink/relink-memetic
type: application/javascript
module-type: relinktext
\*/
/**
 * relink-memetic — the house's carrier type under Relink's own handler API. Relink dispatches a record's text by its type
 * (`relinktext` modules), and a `text/memetic-wikitext+tiddlywiki` body met no handler, so a rename left every reference in a
 * meme slot stale. This module hands the carrier type Relink's own wikitext handler: the black ink relinks like any wikitext,
 * and the red ink meets `relink/relink-sigil` inside the same walk.
 *
 * ── THE MEMETIC PARSER'S RULE SET ────────────────────────────────────────────────────────────────────
 * The memetic parser drops the rules `lar:///ha.ka.ba/config/memetic-rules-except` names. The walk honours that list through
 * the wikitext's own `\rules except …` pragma, carried one line ahead of the text and cut from the answer, so it walks exactly
 * the rules a render of the carrier reads.
 *
 * ── INERT WITHOUT RELINK ─────────────────────────────────────────────────────────────────────────────
 * Only Relink reads the `relinktext` module type, and this module reaches Relink's wikitext handler only once Relink's utilities
 * stand among the engine's modules; absent, report finds nothing and relink changes nothing.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/heleuma/relink
 */
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { denyListPrefix } from "../relink-sigil-core.js";

const RELINK_UTILS = "$:/plugins/flibbles/relink/js/utils.js";
const RULES_CONFIG_TIDDLER = "lar:///ha.ka.ba/config/memetic-rules-except";

interface Entry { output?: string; impossible?: boolean }
interface WikitextHandler {
  report(text: string, callback: (title: string, blurb: string) => void, options: unknown): void;
  relink(text: string, fromTitle: string, toTitle: string, options: unknown): Entry | undefined;
}
interface RelinkOptions { wiki?: { getTiddlerText?(title: string, fallback?: string): string | undefined } }

declare const $tw: { modules?: { titles?: Record<string, unknown> } } | undefined;
declare const require: (id: string) => { getType(name: string): WikitextHandler | undefined };

/** Relink's own wikitext handler, or null where Relink stands absent. */
function wikitext(): WikitextHandler | null {
  if (typeof $tw === "undefined" || !$tw?.modules?.titles?.[RELINK_UTILS]) return null;
  return require(RELINK_UTILS).getType("wikitext") ?? null;
}

function prefixOf(options: RelinkOptions): string {
  return denyListPrefix(options?.wiki?.getTiddlerText?.(RULES_CONFIG_TIDDLER, "") ?? "");
}

export const type = CARRIER_TYPE;

export function report(text: string, callback: (title: string, blurb: string) => void, options: RelinkOptions): void {
  wikitext()?.report(prefixOf(options) + text, callback, options);
}

export function relink(text: string, fromTitle: string, toTitle: string, options: RelinkOptions): Entry | undefined {
  const handler = wikitext();
  if (!handler) return undefined;
  const prefix = prefixOf(options);
  const entry = handler.relink(prefix + text, fromTitle, toTitle, options);
  if (!entry || entry.output === undefined || prefix === "") return entry;
  // The pragma line rides ahead of the walk and never takes an edit; an answer that moved it reads as no answer at all.
  return entry.output.startsWith(prefix) ? { ...entry, output: entry.output.slice(prefix.length) } : { impossible: true };
}
