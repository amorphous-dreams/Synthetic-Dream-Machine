/**
 * deserializer — TW5 tiddlerdeserializer for text/x-memetic-wikitext.
 *
 * Heleuma ba: this TS source compiles to an IIFE plugin tiddler at
 * lar:///ha.ka.ba/api/v0.1/lararium/modules/deserializer
 * (module-type: tiddlerdeserializer, key: text/x-memetic-wikitext).
 *
 * TW5 deserializer contract:
 *   deserializer(text: string, fields: Record<string, unknown>) → TiddlerFields[]
 *
 * Stream model:
 *   Multi-carrier: MemeStreamParser emits one carrier-close per meme; each becomes
 *     a batch of [parent, ...children] tiddlers.
 *   Partial carrier (no ETX): flush() emits a best-effort carrier-close; no crash.
 *   Bare body (no SOH framing): treated as a single carrier with baseUri from fields.title.
 *
 * OODA-HA:
 *   ✶ scan: MemeStreamParser.push(text) + flush() → events
 *   ⏿ hold: filter to carrier-close events only
 *   ◇ route: carrier-close → splitCarrierToTiddlers → [parent, ...children]
 *   ▶ yield: TiddlerFields[] result (all carriers, all children)
 *   ⤴ fallback: no events → bare body path
 *   ↺ release: no state; every call is a fresh parse
 */

import { MemeStreamParser } from "@lararium/core";
import type { MemeStreamEvent } from "@lararium/core";
import { splitCarrierToTiddlers } from "./carrier-split.js";

export type TiddlerFields = Record<string, string | string[]>;

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
  const result:  TiddlerFields[] = [];

  // ✶ Scan — stream parse: handles single-carrier, multi-carrier, and partials.
  const parser = new MemeStreamParser();
  const events: MemeStreamEvent[] = [...parser.push(text), ...parser.flush()];

  // ⏿ Hold — only carrier-close events produce tiddlers.
  const closes = events.filter((e): e is Extract<MemeStreamEvent, { kind: "carrier-close" }> =>
    e.kind === "carrier-close"
  );

  // ◇ Route — each carrier-close → splitCarrierToTiddlers → batch.
  for (const ev of closes) {
    const uri   = ev.uri || baseUri;
    const split = splitCarrierToTiddlers(uri, ev.fullText);

    const parent: TiddlerFields = {
      ...asStringFields(fields),
      ...split.parent.fields,
      title: uri,
      text:  ev.fullText,   // original carrier text — MemeticParser renders it
    };
    result.push(parent);

    for (const child of split.children) {
      result.push({ ...child.fields, title: child.title, text: child.text });
    }

    if (split.warnings.length > 0) {
      const safeSlug = uri.replace(/[^a-zA-Z0-9._-]/g, "_");
      result.push({
        title:          `$:/lararium/parse-warning/${safeSlug}`,
        tags:           "$:/lararium/parse-warnings",
        "carrier-uri":  uri,
        "warning-count": String(split.warnings.length),
        text:           split.warnings.join("\n"),
      });
    }
  }

  // ⤴ Fallback — no SOH framing detected: treat entire text as bare carrier body.
  if (result.length === 0 && text.trim()) {
    const split = splitCarrierToTiddlers(baseUri, text);
    const parent: TiddlerFields = {
      ...asStringFields(fields),
      ...split.parent.fields,
      title: baseUri,
      text,
    };
    result.push(parent);
    for (const child of split.children) {
      result.push({ ...child.fields, title: child.title, text: child.text });
    }
    if (split.warnings.length > 0) {
      const safeSlug = baseUri.replace(/[^a-zA-Z0-9._-]/g, "_");
      result.push({
        title:           `$:/lararium/parse-warning/${safeSlug}`,
        tags:            "$:/lararium/parse-warnings",
        "carrier-uri":   baseUri,
        "warning-count": String(split.warnings.length),
        text:            split.warnings.join("\n"),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// asStringFields — project unknown-typed baseFields to string values only
// ---------------------------------------------------------------------------

function asStringFields(fields: Record<string, unknown>): TiddlerFields {
  const out: TiddlerFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = (v as unknown[]).map(String);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}
