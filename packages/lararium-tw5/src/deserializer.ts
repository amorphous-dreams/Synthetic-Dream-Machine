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
  // SOH carrier sentinels begin with `<<~` then an optional phase glyph
  // (⊙) then `&#x000<digit>;` directly. Anchoring on the control-char
  // reference avoids matching unrelated `<<~ !DOCTYPE … >>` comments or
  // `<<~ ? -> uri >>` pranala-headers (whose `->` arrow contains a `>`).
  const sohIdx = text.search(/<<~(?:\s*⊙)?\s*&#x000[1-9a-fA-F]+;/);
  const prologue = (closes.length > 0 && sohIdx > 0)
    ? text.slice(0, sohIdx)
    : "";
  // ETX/EOT closer end: walk to find the last close-sentinel and use the
  // position right after its `>>`. Rather than craft a finicky regex for
  // the closing `>>` (which needs to skip past the embedded `;` and any
  // whitespace), search for the SOH-shape match position then walk
  // forward to the next `>>`.
  const etxOpenRe = /<<~(?:\s*⊙)?\s*&#x000[34];/g;
  let lastEtxEnd = -1;
  let etxMatch: RegExpExecArray | null;
  while ((etxMatch = etxOpenRe.exec(text)) !== null) {
    const closeIdx = text.indexOf(">>", etxMatch.index + etxMatch[0].length);
    if (closeIdx >= 0) lastEtxEnd = closeIdx + 2;
  }
  const postamble = (closes.length > 0 && lastEtxEnd >= 0 && lastEtxEnd < text.length)
    ? text.slice(lastEtxEnd)
    : "";
  for (const ev of closes) {
    const uri      = ev.uri || baseUri;
    // MemeStreamParser's fullText extends past the ETX in single-meme
    // files; trim that trailing content so the parent meme's text field
    // doesn't duplicate the postamble already captured separately.
    let memeText = ev.fullText;
    if (postamble.length > 0 && ev === closes[closes.length - 1] && memeText.endsWith(postamble)) {
      memeText = memeText.slice(0, memeText.length - postamble.length);
    }
    const tiddlers = splitMemeToTiddlers(uri, memeText, asStringFields(fields));
    if (prologue.length > 0 && tiddlers.length > 0 && ev === closes[0]) {
      // Copy prologue to ALL tiddlers so the template needs only `has[prologue]`.
      for (const t of tiddlers) t["prologue"] = prologue;
    }
    // Extract namespace prefix glyph(s) from SOH line (e.g. "ॐ ँ", "⊙").
    // Stored only when non-empty; template emits it before the control char.
    const nsM = /^<<~([^&\n]*)&#x(?:0001|0011)/.exec(ev.fullText);
    const namespace = nsM?.[1]?.trim() ?? "";
    if (namespace.length > 0 && tiddlers.length > 0) {
      for (const t of tiddlers) t["namespace"] = namespace;
    }
    // Only store postamble when it has real content (not just trailing whitespace).
    // A whitespace-only postamble (e.g. a single trailing \n after EOT) would be
    // rendered before the ETX marker by the template, producing an extra blank line.
    if (postamble.trim().length > 0 && tiddlers.length > 0 && ev === closes[closes.length - 1]) {
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
// splitMemeToTiddlers — parse one meme (SOH→ETX span) into parent + children.
//
// `text` = ev.fullText from MemeStreamParser = SOH line → ETX inclusive.
// On exit: parent.text = body proper only (SOH/iam/STX/ETX stripped).
// Child tiddlers: one per non-control ahu slot; text = slot body proper.
// ---------------------------------------------------------------------------

// Structural marker patterns — strip these from parent text at ingest.
const SOH_LINE_RE = /^<<~(?:[^>]|->)*&#x(?:0001|0011);(?:[^>]|->)*>>\n?/;
const STX_LINE_RE = /<<~(?:[^>]|->)*&#x0002;(?:[^>]|->)*>>\n?/;
const ETX_TAIL_RE = /\n?<<~(?:[^>]|->)*&#x0003;(?:[^>]|->)*>>[\s\S]*$/;

function splitMemeToTiddlers(
  uri:        string,
  text:       string,
  baseFields: TiddlerFields,
): TiddlerFields[] {
  const warnings: string[] = [];
  const sourceFile = typeof baseFields["source-file"] === "string" ? baseFields["source-file"] : "";

  // Strip structural markers to isolate header (SOH→STX) and body (STX→ETX).
  const stripped = text
    .replace(SOH_LINE_RE, "")   // remove SOH line
    .replace(ETX_TAIL_RE, "");  // remove ETX and everything after

  const stxM = STX_LINE_RE.exec(stripped);
  const headerRegion = stxM ? stripped.slice(0, stxM.index) : stripped;
  // Strip one leading \n from body: STX_LINE_RE consumes the \n after STX but the
  // source's blank line between STX and first content is stored in bodyRegion.
  // The template (meme-markdown-meme) explicitly emits \n\n after STX, so letting
  // the stored field also start with \n produces a double blank line.
  const bodyRegion   = (stxM ? stripped.slice(stxM.index + stxM[0].length) : "").replace(/^\n/, "");

  // Parse iam fields from header region (before STX).
  const iamPos     = extractRootTomlWithPos(headerRegion);
  const rootToml   = iamPos?.content ?? null;
  const rootFieldsRaw = rootToml ? fieldifyToml(rootToml, warnings, uri) : {};
  const { __arrayKeys: _, ...rootFields } = rootFieldsRaw as TiddlerFields & { __arrayKeys?: string[] };

  // Split header into pre-iam prose and post-iam-pre-STX content.
  // pre-iam: operator prose between SOH and the iam block (e.g. a framing note).
  // post-iam: aka refs, header ahu slots — structure that belongs before STX on disk.
  const preIamContent  = iamPos ? headerRegion.slice(0, iamPos.start) : headerRegion;
  // Strip one leading \n from post-iam content: extractRootTomlWithPos's regex
  // consumes the closing ``` and its \n, but the source's blank line between the
  // iam fence and the next header content (aka/ahu refs) lives here. The template
  // emits \n\n after the closing ```, so the stored field must not also start with \n.
  const postIamContent = iamPos ? headerRegion.slice(iamPos.end).replace(/^\n/, "") : "";

  // Recurse separately so the STX boundary is preserved in the parent's fields:
  //   header-text = post-iam pre-STX content (with ahu blocks → kahea refs)
  //   text        = post-STX body
  const { children: headerChildren, rewrittenText: headerRewritten } =
    splitRecursive(uri, "", postIamContent, warnings, sourceFile);
  const { children: bodyChildren, rewrittenText: bodyRewritten } =
    splitRecursive(uri, "", bodyRegion, warnings, sourceFile);

  const allChildren = [...headerChildren, ...bodyChildren];

  const parent: TiddlerFields = {
    ...baseFields,
    ...rootFields,
    title: uri,
    type:  "text/x-memetic-wikitext",
    text:  bodyRewritten,
    ...(preIamContent.trim()   ? { preamble:     preIamContent }   : {}),
    ...(headerRewritten.trim() ? { "header-text": headerRewritten } : {}),
  };

  const result: TiddlerFields[] = [parent, ...allChildren];

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
  rootUri:          string,
  fragmentPrefix:   string,  // "" at meme root; "#a" → "#a/b" → "#a/b/c"
  text:             string,
  warnings:         string[],
  parentSourceFile: string = "",
): { children: TiddlerFields[]; rewrittenText: string } {
  const allChildren: TiddlerFields[] = [];
  const enclosingUri = rootUri + fragmentPrefix;
  const blocks = findTopLevelAhuBlocks(text);
  let cursor = 0;
  let rewritten = "";
  for (const block of blocks) {
    rewritten += text.slice(cursor, block.openStart);
    if (CONTROL_SLOTS.has(block.slot)) {
      rewritten += text.slice(block.openStart, block.closeEnd);
      cursor = block.closeEnd;
      continue;
    }
    const childSlotPath = composeSlotPath(fragmentPrefix, block.slot);
    const childUri      = rootUri + childSlotPath;
    const bodyText      = text.slice(block.bodyStart, block.bodyEnd);
    const inner         = splitRecursive(rootUri, childSlotPath, bodyText, warnings, parentSourceFile);
    const childStructure = extractSlotStructure(inner.rewrittenText, warnings, childUri);

    const childUriPath  = childUri.startsWith("lar:///") ? childUri.slice(7) : childUri;
    const childFilePath = parentSourceFile
      ? parentSourceFile.replace(/\.md$/, "") + "/" + block.slot.replace(/^#/, "") + ".md"
      : undefined;

    allChildren.push({
      ...childStructure.fields,
      title:             childUri,
      type:              "text/x-memetic-wikitext",
      text:              childStructure.text,
      "uri-path":        childUriPath,
      "fragment-parent": enclosingUri,
      slot:              block.slot,
      ...(childFilePath                ? { "file-path": childFilePath }         : {}),
      ...(childStructure.preamble      ? { preamble:    childStructure.preamble }  : {}),
      ...(childStructure.postamble     ? { postamble:   childStructure.postamble } : {}),
    });
    allChildren.push(...inner.children);
    rewritten += `<<~ kahea ahu ${block.slot} >>`;
    cursor = block.closeEnd;
  }
  rewritten += text.slice(cursor);
  return { children: allChildren, rewrittenText: rewritten };
}

// ---------------------------------------------------------------------------
// extractRootToml — find the ```toml iam``` block in the header region.
// ---------------------------------------------------------------------------

function extractRootTomlWithPos(text: string): { content: string; start: number; end: number } | null {
  const m = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```\n?/.exec(text);
  if (!m) return null;
  return { content: m[1] ?? "", start: m.index, end: m.index + m[0].length };
}

// ---------------------------------------------------------------------------
// extractSlotStructure — split a slot body into preamble + iam fields + text
// + postamble. Same shape as the disk-version full-meme split, applied to
// every ahu slot so each slot is itself a valid "full published meme MD
// file" projection (operator clarification 2026-05-09).
//
// Convention (operator-confirmed):
//   - preamble = operator prose flanking the iam toml, before the first
//     inner sigil. The iam toml's original position within the preamble
//     is preserved as a `<<~ iam >>` sentinel marker — operators may
//     write prose BEFORE iam, AFTER iam, or BOTH; the marker keeps the
//     bytes recoverable. On emission, the slot template substitutes the
//     marker with the regenerated iam toml block.
//   - fields    = parsed from the iam toml block (operator-authored keys).
//   - text      = body proper — from the first inner kahea ref to the last
//     inner kahea ref end (inclusive of refs for sub-slot reconstruction).
//   - postamble = text AFTER the last inner kahea ref (trailing prose).
//
// When no inner sigils exist:
//   - iam present: preamble holds pre-iam prose + iam marker + post-iam
//     prose; text = "".
//   - no iam:      text = whole body, preamble = "".
// ---------------------------------------------------------------------------

// IAM_MARKER kept for reference only — no longer used in active code.
// @web2-era sentinel; preamble no longer carries an iam position marker.
export const IAM_MARKER = "<<~ iam >>";

// @web2-era — regenerateIamToml / formatTomlValue: replaced by lar-iam-block macro.
// Kept as reference for Path H (save-side auto-split). Not used in emit path.

interface SlotStructure {
  readonly preamble:  string;
  readonly fields:    TiddlerFields;
  readonly text:      string;
  readonly postamble: string;
}

function extractSlotStructure(
  bodyText: string,
  warnings: string[],
  context:  string,
): SlotStructure {
  // Find iam toml block — preamble is prose before it, text starts after.
  const iamRe   = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```\n?/;
  const plainRe = /```toml[ \t]*\n([\s\S]*?)```\n?/;
  const iamM    = iamRe.exec(bodyText) ?? plainRe.exec(bodyText);

  let preamble = "";
  let fields: TiddlerFields = {};
  let remainder = bodyText;

  if (iamM) {
    preamble  = bodyText.slice(0, iamM.index);
    const raw = fieldifyToml(iamM[1] ?? "", warnings, context);
    const { __arrayKeys: _, ...parsed } = raw as TiddlerFields & { __arrayKeys?: string[] };
    fields    = parsed;
    remainder = bodyText.slice(iamM.index + iamM[0].length);
  }

  // Find LAST kahea ref — trailing prose becomes postamble.
  const refRe = /<<~\s*kahea\s+ahu\s+#[\w-]+\s*>>/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = refRe.exec(remainder)) !== null) {
    lastEnd = m.index + m[0].length;
  }

  let text      = remainder;
  let postamble = "";
  if (lastEnd >= 0 && lastEnd < remainder.length) {
    text      = remainder.slice(0, lastEnd);
    postamble = remainder.slice(lastEnd);
  }

  // No iam, no refs: the whole body is text.
  if (!iamM && lastEnd < 0) {
    text     = bodyText;
    preamble = "";
  }

  return { preamble, fields, text, postamble };
}

// ---------------------------------------------------------------------------
// fieldifyToml — convert raw TOML key=value text into TiddlerFields
// ---------------------------------------------------------------------------

function fieldifyToml(
  toml:     string,
  warnings: string[],
  context:  string,
): TiddlerFields & { __arrayKeys?: string[] } {
  const parsed = parseTaploFields(toml);
  const out: TiddlerFields & { __arrayKeys?: string[] } = {};
  const arrayKeys: string[] = [];
  for (const [k, v] of Object.entries(parsed)) {
    if (k === "title") { warnings.push(`${context}: "title" in TOML ignored (derived from URI)`); continue; }
    if (k === "text")  { warnings.push(`${context}: "text" in TOML ignored (derived from body)`); continue; }
    if (Array.isArray(v)) { out[k] = (v as unknown[]).map(String); arrayKeys.push(k); }
    else                  { out[k] = String(v); }
  }
  if (arrayKeys.length > 0) out.__arrayKeys = arrayKeys;
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
