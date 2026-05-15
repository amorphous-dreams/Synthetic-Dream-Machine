/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/grammar-cache
type: application/javascript
module-type: startup
\*/
/**
 * grammar-cache — TW5 startup module: grammar loader + wiki-change invalidation.
 *
 * Grammar source (inverted control):
 *   Primary — all tiddlers tagged `lar:///ha.ka.ba/tags/SharktoothSigil`.
 *             Each tiddler contributes one SigilRule via its `lar-*` fields.
 *             Adding a new sigil = tagging a tiddler. No code change required.
 *   Fallback — `GRAMMAR_MEME_URI` TOML monolith, read via `grammarRulesFromText`.
 *             Covers sigils not yet migrated to SharktoothSigil tiddlers and ALL
 *             FamilyRule entries (families not yet tiddlerized).
 *             Tiddler sigils take precedence by name over TOML sigils.
 *
 * Exported:
 *   name, platforms, after, startup  — TW5 startup lifecycle
 *   GRAMMAR_TAG                       — SharktoothSigil tag URI
 *   getGrammar()                      — lazy GrammarRules loader
 *   resetGrammar()                    — explicit cache invalidation (tests / emergency)
 */

import { grammarRulesFromText, GRAMMAR_MEME_URI } from "@lararium/core";
import type { GrammarRules, SigilRule } from "@lararium/core";

/** Canonical tag URI for SharktoothSigil tiddlers. Each tagged tiddler = one sigil entry. */
export const GRAMMAR_TAG = "lar:///ha.ka.ba/tags/SharktoothSigil";

// ---------------------------------------------------------------------------
// TW5 startup lifecycle
// ---------------------------------------------------------------------------

export const name      = "lararium-grammar-cache";
export const platforms = ["browser"];
export const after     = ["startup"];

type TwFields = Record<string, unknown>;
type TwTiddler = { fields: TwFields };
type TwWiki = {
  getTiddler(t: string): TwTiddler | undefined;
  getTiddlerText(t: string): string | undefined;
  filterTiddlers(filter: string): string[];
  addEventListener(ev: "change", fn: (changes: Record<string, unknown>) => void): void;
};

function getWiki(): TwWiki | undefined {
  return (globalThis as { $tw?: { wiki?: TwWiki } }).$tw?.wiki;
}

export function startup(): void {
  const wiki = getWiki();
  if (!wiki) return;
  wiki.addEventListener("change", (changes) => {
    for (const title of Object.keys(changes)) {
      if (title === GRAMMAR_MEME_URI) { _cache = undefined; return; }
      const tags = wiki.getTiddler(title)?.fields?.["tags"];
      const tagList = Array.isArray(tags) ? tags
        : typeof tags === "string" ? tags.split(" ") : [];
      if (tagList.includes(GRAMMAR_TAG)) { _cache = undefined; return; }
    }
  });
}

// ---------------------------------------------------------------------------
// Grammar cache
// ---------------------------------------------------------------------------

let _cache: { loaded: true; rules: GrammarRules | null } | undefined = undefined;

export function getGrammar(): GrammarRules | null {
  if (_cache) return _cache.rules;
  let rules: GrammarRules | null = null;
  try {
    const wiki = getWiki();
    if (wiki) rules = buildGrammarFromWiki(wiki);
  } catch { /* grammar unavailable — BOOTSTRAP_SCANS remain active */ }
  _cache = { loaded: true, rules };
  return rules;
}

export function resetGrammar(): void { _cache = undefined; }

// ---------------------------------------------------------------------------
// Grammar assembly
// ---------------------------------------------------------------------------

function str(v: unknown): string { return typeof v === "string" ? v : ""; }

/**
 * Derive sigil name from tiddler fields or title.
 * `lar-name` field takes precedence; otherwise strips the "sigil-" prefix
 * from the last path segment of the title (e.g. "…/sigil-ahu" → "ahu").
 */
function nameFromTitle(title: string, fields: TwFields): string {
  if (fields["lar-name"]) return str(fields["lar-name"]);
  const last = title.split("/").pop() ?? title;
  return last.startsWith("sigil-") ? last.slice(6) : last;
}

/** Build SigilRule from a SharktoothSigil tiddler's fields. */
function sigilFromFields(title: string, fields: TwFields): SigilRule | null {
  const kind = str(fields["lar-kind"]) as SigilRule["kind"];
  if (!kind) return null;
  const rule: SigilRule = { name: nameFromTitle(title, fields), kind };
  if (fields["lar-pattern"])         rule.pattern        = str(fields["lar-pattern"]);
  if (fields["lar-open-pattern"])    rule.openPattern    = str(fields["lar-open-pattern"]);
  if (fields["lar-close-pattern"])   rule.closePattern   = str(fields["lar-close-pattern"]);
  if (fields["lar-inline-pattern"])  rule.inlinePattern  = str(fields["lar-inline-pattern"]);
  if (fields["lar-block-pattern"])   rule.blockPattern   = str(fields["lar-block-pattern"]);
  if (fields["lar-alias-for"])       rule.aliasFor       = str(fields["lar-alias-for"]);
  if (fields["lar-default-family"])  rule.defaultFamily  = str(fields["lar-default-family"]);
  const layer = str(fields["lar-layer"]);
  if (layer === "compile" || layer === "render" || layer === "both") rule.layer = layer;
  return rule;
}

/**
 * Assemble GrammarRules from:
 *   1. All `[tag[lar:///ha.ka.ba/tags/SharktoothSigil]]` tiddlers (primary sigil source)
 *   2. GRAMMAR_MEME_URI TOML monolith (fallback sigils + all families)
 *
 * Tiddler sigils take precedence over TOML sigils by name. As sigils migrate
 * to SharktoothSigil tiddlers, their TOML `[[sigils]]` blocks become dead code
 * and can be removed. When all sigils migrate, the TOML shrinks to families only.
 */
function buildGrammarFromWiki(wiki: TwWiki): GrammarRules | null {
  // Primary: SharktoothSigil-tagged tiddlers
  const titles = wiki.filterTiddlers(`[tag[${GRAMMAR_TAG}]]`);
  const tiddlerSigils: SigilRule[] = [];
  for (const title of titles) {
    const fields = wiki.getTiddler(title)?.fields ?? {};
    const rule = sigilFromFields(title, fields);
    if (rule) tiddlerSigils.push(rule);
  }
  const tiddlerNames = new Set(tiddlerSigils.map((s) => s.name));

  // Fallback: TOML monolith (families always; sigils for unmigrated entries)
  const monoText  = wiki.getTiddlerText(GRAMMAR_MEME_URI) ?? "";
  const monoRules = monoText ? grammarRulesFromText(GRAMMAR_MEME_URI, monoText) : null;
  const monoSigils = (monoRules?.sigils ?? []).filter((s) => !tiddlerNames.has(s.name));

  const sigils   = [...tiddlerSigils, ...monoSigils];
  const families = monoRules?.families ?? [];

  if (sigils.length === 0 && families.length === 0) return null;
  return { sigils, families };
}
