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
  const rootToml   = extractRootToml(text);
  const rootFields = rootToml ? fieldifyToml(rootToml, warnings, uri) : {};
  // Top-level slots elide against the meme-root's iam.
  const sourceFile = typeof baseFields["source-file"] === "string" ? baseFields["source-file"] : "";
  const { children, rewrittenText } = splitRecursive(uri, "", text, warnings, rootFields, sourceFile);
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
  parentIam:       Readonly<TiddlerFields> = {}, // ancestor iam for default-elision
  parentSourceFile: string = "",                  // source-file of the carrier; drives child file-path
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
    // Peek at child's iam (without recursion) so we can pass the effective
    // (inherited + own) iam to grandchildren for their default-elision.
    const childPeek = extractSlotStructure(bodyText, warnings, childUri);
    const effectiveIam: TiddlerFields = { ...parentIam, ...childPeek.fields };
    const inner = splitRecursive(rootUri, childSlotPath, bodyText, warnings, effectiveIam, parentSourceFile);
    // Extract iam toml + flanking preamble/postamble from the rewritten body.
    // preamble = text before iam toml (operator prose at slot head, separate
    // from the field bag);
    // postamble = text after the last inner kahea ref (trailing prose at
    // slot tail);
    // text = the body proper, between iam-toml end and last-kahea-ref end
    // (inclusive of inline kahea refs for sub-slot reconstruction).
    const childStructure = extractSlotStructure(inner.rewrittenText, warnings, childUri);

    // J.2b — full effective iam for disk projection (no elision against parent).
    // Slot children project as standalone "full published meme MD files"; the
    // iam block must be self-contained so the file round-trips correctly even
    // when read in isolation. Override uri-path with the child's own URI path;
    // derive file-path from the carrier's source-file + slot path so the child
    // file is self-describing (wikis/scratch/.../parent/slot.md).
    const childUriPath  = childUri.startsWith("lar:///") ? childUri.slice(7) : childUri;
    const childFilePath = parentSourceFile
      ? parentSourceFile.replace(/\.md$/, "") + "/" + block.slot.replace(/^#/, "") + ".md"
      : undefined;
    const fullChildIam = regenerateIamToml(
      {
        ...effectiveIam,
        "uri-path": childUriPath,
        ...(childFilePath ? { "file-path": childFilePath } : {}),
      },
      {}, // no parent defaults to elide — emit all fields
    );
    // elidedIam kept for preamble-rendered substitution (operator-authored
    // slot bodies that carry an explicit <<~ iam >> sentinel get the delta).
    const elidedIam = regenerateIamToml(childStructure.fields, parentIam);
    const effectiveIamSource = elidedIam || childStructure.iamSource;

    // preamble-rendered substitutes the `<<~ iam >>` sentinel inside
    // preamble with the regenerated iam toml block. Pre-computed here at
    // deserialize so the meme-template can emit it directly without
    // needing macro/transclude expansion (the curated rule set in
    // text/x-memetic-wikitext excludes macrocall).
    const preambleRendered = childStructure.preamble && effectiveIamSource
      ? childStructure.preamble.replace(
          IAM_MARKER,
          `\`\`\`toml iam\n${effectiveIamSource}\`\`\``,
        )
      : childStructure.preamble;
    allChildren.push({
      ...childStructure.fields,
      title:             childUri,
      text:              childStructure.text,
      ...(childStructure.preamble  ? { preamble:    childStructure.preamble  } : {}),
      ...(preambleRendered && preambleRendered !== childStructure.preamble
        ? { "preamble-rendered": preambleRendered }
        : {}),
      // Full effective iam stored on all children for standalone readability.
      // Operator-authored iam-source (from explicit toml block in slot body)
      // overrides the generated one when present.
      ...(childStructure.iamSource
        ? { "iam-source": childStructure.iamSource }
        : fullChildIam ? { "iam-source": fullChildIam } : {}),
      ...(childStructure.postamble ? { postamble:   childStructure.postamble } : {}),
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

/**
 * Sentinel marker placed inside `preamble` to record the iam toml's
 * original position. Sigil-grammar-shaped (`<<~ ... >>`) so it survives
 * literal-survival in the wikirule, and so it reads as part of the
 * memetic-wikitext family rather than as a TW5 macro call.
 */
export const IAM_MARKER = "<<~ iam >>";

/**
 * Fields excluded from iam-class — TW5 system fields, Lar control fields,
 * and the round-trip helper fields. Everything else on a tiddler is
 * operator-authored content that belongs in the iam toml block.
 */
const IAM_DENYLIST: ReadonlySet<string> = new Set([
  // TW5 system
  "title", "text", "type", "tags", "created", "modified", "revision", "bag",
  // Lar control / slot-structure
  "slot", "fragment-parent", "preamble", "preamble-rendered",
  "postamble", "prologue", "iam-source",
  "lar-generated", "disk-projection",
  "ahu-parent", "ahu-slot", "realm-origin",
]);

/**
 * Format a TOML value for emission. Strings get JSON-style double quotes
 * with backslash escapes; numbers stay numeric; arrays emit as TOML arrays.
 * Bare booleans (`true`/`false` strings) emit unquoted to round-trip cleanly.
 */
function formatTomlValue(v: string | string[]): string {
  if (Array.isArray(v)) {
    return "[" + v.map((s) => formatTomlValue(s)).join(", ") + "]";
  }
  if (v === "true" || v === "false") return v;
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  return JSON.stringify(v);
}

/**
 * Regenerate the iam toml block content (between fences) from a tiddler's
 * iam-class fields, default-eliding values that match the parent's iam.
 * Returns the multi-line toml body — caller wraps with the fence pair.
 *
 * Default-elision: a child key is omitted from emission when its value
 * exactly matches the parent's value for the same key. Operators who
 * want a child to retain the parent's default explicitly can author it
 * (round-trips because it differs from "missing" semantics — but in
 * practice differs from the parent only when the child changes intent).
 *
 * Key order: stable insertion order from the input record. Operators
 * who care about ordering author toml directly via `iam-source` until
 * a key-ordering convention lands.
 */
export function regenerateIamToml(
  fields:       Readonly<Record<string, string | string[] | undefined>>,
  parentFields: Readonly<Record<string, string | string[] | undefined>>,
): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (IAM_DENYLIST.has(k)) continue;
    const parentVal = parentFields[k];
    if (parentVal !== undefined) {
      const a = Array.isArray(v) ? v.join("") : v;
      const b = Array.isArray(parentVal) ? parentVal.join("") : parentVal;
      if (a === b) continue; // elide — value matches parent default
    }
    lines.push(`${k} = ${formatTomlValue(v)}`);
  }
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

interface SlotStructure {
  readonly preamble:  string;
  readonly fields:    TiddlerFields;
  readonly iamSource: string;   // raw toml block bytes (between fences); empty when no iam
  readonly text:      string;
  readonly postamble: string;
}

function extractSlotStructure(
  bodyText: string,
  warnings: string[],
  context:  string,
): SlotStructure {
  // Find FIRST inner kahea ref — splits the body into preamble-region (with
  // iam) and content (text + postamble). When absent, the whole body is
  // preamble-region.
  const refRe       = /<<~\s*kahea\s+ahu\s+#[\w-]+\s*>>/g;
  const firstRefM   = refRe.exec(bodyText);
  const firstRefIdx = firstRefM?.index ?? bodyText.length;
  const preambleRegion = bodyText.slice(0, firstRefIdx);
  const contentRegion  = bodyText.slice(firstRefIdx);

  // Extract iam toml from preamble region. Replace it in-place with the
  // sentinel marker so position survives — operator may have written
  // prose on either side, or both, or neither.
  // Don't consume a trailing newline after the closing fence — let it
  // remain part of post-iam preamble prose so emission re-emits the
  // line-break that the operator authored between the iam block and
  // following text.
  const iamRe   = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```/;
  const plainRe = /```toml[ \t]*\n([\s\S]*?)```/;
  const iamM    = iamRe.exec(preambleRegion) ?? plainRe.exec(preambleRegion);
  let preamble  = preambleRegion;
  let fields:   TiddlerFields = {};
  let iamSource = "";
  if (iamM) {
    const beforeIam = preambleRegion.slice(0, iamM.index);
    const afterIam  = preambleRegion.slice(iamM.index + iamM[0].length);
    iamSource = iamM[1] ?? "";
    fields    = fieldifyToml(iamSource, warnings, context);
    preamble  = beforeIam + IAM_MARKER + afterIam;
  }

  // Find LAST inner kahea ref — trailing prose after it becomes postamble.
  refRe.lastIndex = 0;
  let lastEndAbsolute = -1;
  while (refRe.exec(contentRegion) !== null) {
    lastEndAbsolute = refRe.lastIndex;
  }
  let text      = contentRegion;
  let postamble = "";
  if (lastEndAbsolute >= 0 && lastEndAbsolute < contentRegion.length) {
    text      = contentRegion.slice(0, lastEndAbsolute);
    postamble = contentRegion.slice(lastEndAbsolute);
  }

  // No inner refs: body is pure preamble (with optional iam marker
  // embedded). text + postamble both empty.
  if (firstRefIdx === bodyText.length) {
    if (!iamM) {
      // Pure body, no iam, no inner sigils — everything goes to text.
      text     = bodyText;
      preamble = "";
    } else {
      text = "";
    }
  }

  return { preamble, fields, iamSource, text, postamble };
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
