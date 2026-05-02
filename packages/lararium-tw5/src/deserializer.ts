/**
 * deserializer — TW5 causal-island boundary module for text/x-memetic-wikitext.
 *
 * Heleuma ba: this TS source compiles to an IIFE plugin tiddler at
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
import { parseMemeText } from "@lararium/core/meme-ast";
import type { MemeAstNode, AhuNode } from "@lararium/core/meme-ast";
import { parseTaploFields } from "./toml-ast.js";

export type TiddlerFields = Record<string, string | string[]>;

// ---------------------------------------------------------------------------
// Control slots — ahu slots that carry structural metadata, not child tiddlers.
// ---------------------------------------------------------------------------

const CONTROL_SLOTS = new Set([
  "#iam", "#exit", "#stream-open", "#stream-close", "#stream-exit",
  "#body-open", "#body-close", "#meme-body-open", "#meme-body-close",
]);

// ---------------------------------------------------------------------------
// memeticWikitextDeserializer — the TW5 module export
//
// TW5 registers tiddlerdeserializer modules keyed by content-type.
// The compiled IIFE exports: exports["text/x-memetic-wikitext"] = this function.
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
  for (const ev of closes) {
    const uri      = ev.uri || baseUri;
    const tiddlers = splitMemeToTiddlers(uri, ev.fullText, asStringFields(fields));
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
  const { nodes } = parseMemeText(uri, text);
  const warnings: string[]      = [];
  const children: TiddlerFields[] = [];

  // Walk top-level AhuNodes to extract child tiddlers
  for (const node of nodes) {
    if (node.kind !== "Ahu" || !node.slot || CONTROL_SLOTS.has(node.slot)) continue;
    const ahuNode = node as AhuNode;
    const childTitle = uri + ahuNode.slot;
    const bodyText   = rawBodyText(text, ahuNode);
    const childFields = extractAhuFields(bodyText, warnings, `${uri}${ahuNode.slot}`);
    children.push({ ...childFields, title: childTitle, text: bodyText });
  }

  // Parent fields: root TOML iam prelude
  const rootToml   = extractRootToml(text);
  const rootFields = rootToml ? fieldifyToml(rootToml, warnings, uri) : {};

  // Parent text: replace ahu definition blocks with kahea references
  const parentText = transformParentText(text);

  const parent: TiddlerFields = {
    ...baseFields,
    ...rootFields,
    title: uri,
    type:  "text/x-memetic-wikitext",
    text:  parentText,
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
// rawBodyText — extract the raw source text of an AhuNode's body span.
// ---------------------------------------------------------------------------

function rawBodyText(fullText: string, node: AhuNode): string {
  if (!node.body.length) return "";
  const first = node.body[0]!;
  const last  = node.body[node.body.length - 1]!;
  // pos/raw.length gives us the end of the last node
  return fullText.slice(first.pos, last.pos + last.raw.length);
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
// transformParentText — replace ahu definition blocks with kahea references.
// <<~ ahu #slot >>body<<~/ahu >>  →  <<~ kahea ahu #slot >>
// ---------------------------------------------------------------------------

function transformParentText(text: string): string {
  return text.replace(
    /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>[\s\S]*?<<~\/ahu\s*>>/g,
    (_, slot: string) => `<<~ kahea ahu ${slot} >>`,
  );
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
