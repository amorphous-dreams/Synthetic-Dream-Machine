/**
 * deserializer — TW5 causal-island boundary module for text/x-memetic-wikitext.
 *
 * Heleuma ba: this TS source compiles to an CJS plugin tiddler at
 * lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/deserializer
 * (module-type: tiddlerdeserializer, key: text/x-memetic-wikitext).
 *
 * Parsing MUST happen inside the TW5 VM on live clients (FFZ invariant).
 * This file is the causal-island boundary: text/x-memetic-wikitext enters,
 * TiddlerFields[] (parent + ahu-slot children) leave.
 *
 * Uses parseMemeText() from @lararium/core/meme-ast — isomorphic, no TW5 dep.
 * Does NOT depend on carrier-split.ts (deprecated web2-era code).
 *
 * Incoming (disk → wiki):
 *   memeticWikitextDeserializer — TW5 tiddlerdeserializer contract.
 *   Multi-meme: MemeStreamParser batches carrier-close events.
 *   Parent text model: ahu definition blocks → kahea references (children authoritative).
 *
 * Outgoing (wiki → disk):
 *   expandMemeRefs — registered on $tw.lararium; called by sync-adaptor.
 *   Inverts the incoming transform: reads child bodies, reconstructs definition form.
 */

import { MemeStreamParser } from "@lararium/core";
import type { MemeStreamEvent } from "@lararium/core";
import {
  CONTROL_SLOTS,
  findTopLevelAhuBlocks,
  composeSlotPath,
} from "@lararium/core/meme-ast";
import { parseTaploFields } from "./toml-ast.js";

export type TiddlerFields = Record<string, string | string[]>;

// ---------------------------------------------------------------------------
// memeticWikitextDeserializer — the TW5 module export
//
// TW5 registers tiddlerdeserializer modules keyed by content-type.
// The compiled CJS exports: exports["text/x-memetic-wikitext"] = this function.
// ---------------------------------------------------------------------------

export function memeticWikitextDeserializer(
  text:   string,
  fields: Record<string, unknown>,
): TiddlerFields[] {
  const baseUri = String(fields?.["title"] ?? "");
  const result: TiddlerFields[] = [];

  // ✶ Scan — stream parse: handles single-meme, multi-meme, and partials.
  const parser = new MemeStreamParser();
  const events: MemeStreamEvent[] = [...parser.push(text), ...parser.flush()];

  // ⏿ Hold — only carrier-close events produce tiddlers.
  const closes = events.filter((e): e is Extract<MemeStreamEvent, { kind: "carrier-close" }> =>
    e.kind === "carrier-close"
  );

  // ◇ Route — each carrier-close → parseMemeText → split ahu slots → batch.
  // Pre-SOH content (DOCTYPE comment + leading prose) sits OUTSIDE
  // ev.fullText because MemeStreamParser frames on SOH/ETX. Capture
  // everything before the first SOH as `prologue` on the first carrier's
  // parent and everything after the last ETX/EOT as `postamble` on the
  // last carrier's parent. The markdown-meme template re-emits both
  // verbatim. Round-trip law: anything in the operator's source survives.
  // (Multi-meme prologue/postamble distribution between intermediate
  // carriers lands when MemeStreamParser surfaces positional metadata on
  // carrier events.)
  const sohIdx = text.search(/<<~[^>]*&#x000[1-9a-fA-F]+;[^>]*>>/);
  const prologue = (closes.length > 0 && sohIdx > 0)
    ? text.slice(0, sohIdx)
    : "";
  const lastEtxRe = /<<~[^>]*&#x000[34];[^>]*>>/g;
  let lastEtxEnd = -1;
  let etxMatch: RegExpExecArray | null;
  while ((etxMatch = lastEtxRe.exec(text)) !== null) {
    lastEtxEnd = etxMatch.index + etxMatch[0].length;
  }
  const postamble = (closes.length > 0 && lastEtxEnd >= 0 && lastEtxEnd < text.length)
    ? text.slice(lastEtxEnd)
    : "";
  for (const ev of closes) {
    const uri      = ev.uri || baseUri;
    const tiddlers = splitMemeToTiddlers(uri, ev.fullText, asStringFields(fields));
    if (prologue.length > 0 && tiddlers.length > 0 && ev === closes[0]) {
      tiddlers[0]!["prologue"] = prologue;
    }
    if (postamble.length > 0 && tiddlers.length > 0 && ev === closes[closes.length - 1]) {
      tiddlers[0]!["postamble"] = postamble;
    }
    result.push(...tiddlers);
  }

  // ⤴ Fallback — no SOH framing: treat entire text as bare meme body.
  if (result.length === 0 && text.trim()) {
    result.push(...splitMemeToTiddlers(baseUri, text, asStringFields(fields)));
  }

  return result;
}

// ---------------------------------------------------------------------------
// splitMemeToTiddlers — parse one meme text into parent + ahu-slot children.
//
// Parent text = transformation of input where ahu definition blocks are
//   replaced with <<~ kahea ahu #slot >> references. Children authoritative.
// Child tiddlers = one per non-control ahu slot, text = slot body text.
// ---------------------------------------------------------------------------

function splitMemeToTiddlers(
  uri:        string,
  text:       string,
  baseFields: TiddlerFields,
): TiddlerFields[] {
  const warnings: string[] = [];

  // Recursive split — every ahu sigil at every depth becomes its own tiddler.
  // The bag stays flat: addressing lives entirely in the URI fragment-path
  // (`#parent/child/grandchild`); the fragment-parent field points one level
  // up so disk-projector / templates can climb to the nearest tagged ancestor.
  // The parent's text is rewritten to `<<~ kahea ahu #slot >>` references
  // (live-ref form per memetic-wikitext spec §5.3); slot children hold their
  // body bytes authoritatively.
  const { children, rewrittenText } = splitRecursive(uri, "", text, warnings);

  const rootToml   = extractRootToml(text);
  const rootFields = rootToml ? fieldifyToml(rootToml, warnings, uri) : {};
  const parent: TiddlerFields = {
    ...baseFields,
    ...rootFields,
    title: uri,
    type:  "text/x-memetic-wikitext",
    text:  rewrittenText,
  };

  const result: TiddlerFields[] = [parent, ...children];

  if (warnings.length > 0) {
    const safeSlug = uri.replace(/[^a-zA-Z0-9._-]/g, "_");
    result.push({
      title:         `$:/lararium/parse-warning/${safeSlug}`,
      tags:          "$:/lararium/parse-warnings",
      "meme-uri":    uri,
      "warning-count": String(warnings.length),
      text:          warnings.join("\n"),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// splitRecursive — full-depth ahu walk producing a flat tiddler set.
//
// Each ahu sigil at every depth becomes its own tiddler. The bag stays flat;
// the URI fragment-path (`#parent/child/grandchild`) carries the hierarchy.
// The parent of each tiddler — `fragment-parent` field — points ONE LEVEL up
// (immediate enclosing ahu, not the meme-root), so disk-projector and
// templates can climb to the nearest tagged ancestor in a single hop chain.
// The text returned for each tiddler has its own ahu blocks rewritten to
// `<<~ kahea ahu #slot >>` references; child tiddlers hold the body bytes
// authoritatively.
// ---------------------------------------------------------------------------

function splitRecursive(
  rootUri:         string,
  fragmentPrefix:  string,   // "" at meme root; "#a" → "#a/b" → "#a/b/c"
  text:            string,
  warnings:        string[],
): { children: TiddlerFields[]; rewrittenText: string } {
  const allChildren: TiddlerFields[] = [];
  const enclosingUri = rootUri + fragmentPrefix;

  // Match top-level ahu blocks via balanced-aware iteration. Regex with
  // `[\s\S]*?` non-greedy handles single-level pairing; for nested blocks,
  // we walk by tracking depth via successive open/close-tag positions.
  // Cheaper than a full re-parse and adequate for the recursion-depth limit
  // TW5 enforces in widget rendering.
  const blocks = findTopLevelAhuBlocks(text);
  let cursor = 0;
  let rewritten = "";
  for (const block of blocks) {
    rewritten += text.slice(cursor, block.openStart);
    if (CONTROL_SLOTS.has(block.slot)) {
      // Control slots dissolve in the parent (iam, exit, stream-*, body-*).
      // Keep them inline in parent text — they're not addressable children.
      rewritten += text.slice(block.openStart, block.closeEnd);
      cursor = block.closeEnd;
      continue;
    }
    const childSlotPath = composeSlotPath(fragmentPrefix, block.slot);
    const childUri      = rootUri + childSlotPath;
    const bodyText      = text.slice(block.bodyStart, block.bodyEnd);
    const inner         = splitRecursive(rootUri, childSlotPath, bodyText, warnings);
    const childIam      = extractAhuFields(bodyText, warnings, childUri);
    allChildren.push({
      ...childIam,
      title:             childUri,
      text:              inner.rewrittenText,
      slot:              block.slot,
      "fragment-parent": enclosingUri,
    });
    allChildren.push(...inner.children);
    rewritten += `<<~ kahea ahu ${block.slot} >>`;
    cursor = block.closeEnd;
  }
  rewritten += text.slice(cursor);
  return { children: allChildren, rewrittenText: rewritten };
}

// ---------------------------------------------------------------------------
// extractRootToml — find the ```toml iam``` block before first ahu/STX
// ---------------------------------------------------------------------------

function extractRootToml(text: string): string | null {
  const firstAhu = text.search(/<<~[^>]*\bahu\s+#[\w-]+\s*>>/);
  const firstStx = text.search(/<<~[^>]*&#x0002;/);
  let limit       = text.length;
  if (firstAhu >= 0) limit = Math.min(limit, firstAhu);
  if (firstStx >= 0) limit = Math.min(limit, firstStx);

  const m = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```/.exec(text.slice(0, limit));
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// extractAhuFields — extract TOML fields from the start of an ahu body
// ---------------------------------------------------------------------------

function extractAhuFields(
  bodyText: string,
  warnings: string[],
  context:  string,
): TiddlerFields {
  const iamM   = /^[ \t\n]*```toml[ \t]+iam[ \t]*\n([\s\S]*?)```/.exec(bodyText);
  const plainM = /^[ \t\n]*```toml[ \t]*\n([\s\S]*?)```/.exec(bodyText);
  const toml   = iamM?.[1] ?? plainM?.[1] ?? null;
  if (!toml) return {};
  return fieldifyToml(toml, warnings, context);
}

// ---------------------------------------------------------------------------
// fieldifyToml — convert raw TOML key=value text into TiddlerFields
// ---------------------------------------------------------------------------

function fieldifyToml(
  toml:     string,
  warnings: string[],
  context:  string,
): TiddlerFields {
  const parsed = parseTaploFields(toml);
  const out: TiddlerFields = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k === "title") { warnings.push(`${context}: "title" in TOML ignored (derived from URI)`); continue; }
    if (k === "text")  { warnings.push(`${context}: "text" in TOML ignored (derived from body)`); continue; }
    if (Array.isArray(v)) { out[k] = (v as unknown[]).map(String); }
    else                  { out[k] = String(v); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// asStringFields — project unknown-typed baseFields to string values only
// ---------------------------------------------------------------------------

function asStringFields(fields: Record<string, unknown>): TiddlerFields {
  const out: TiddlerFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) out[k] = (v as unknown[]).map(String);
    else                  out[k] = String(v);
  }
  return out;
}

export { memeticWikitextDeserializer as "text/x-memetic-wikitext" };
