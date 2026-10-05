/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/deserializer
type: application/javascript
module-type: tiddlerdeserializer
\*/
/**
 * deserializer — TW5 causal-island boundary module for text/memetic-wikitext+tiddlywiki.
 *
 * Heleuma ba: this TS source compiles to an CJS plugin tiddler at
 * lar:///ha.ka.ba/lararium/tw5/modules/deserializer
 * (module-type: tiddlerdeserializer, key: text/memetic-wikitext+tiddlywiki).
 *
 * Parsing MUST happen inside the TW5 VM on live clients (FFZ invariant).
 * This file is the causal-island boundary: text/memetic-wikitext+tiddlywiki enters,
 * TiddlerFields[] (parent + ahu-slot children) leave.
 * Non-TW5 adaptation stops at this shore; decomposition law begins here.
 *
 * Isomorphic: no TW5 dep.
 *
 * Incoming (disk → wiki):
 *   memeticWikitextDeserializer — TW5 tiddlerdeserializer contract.
 *   Multi-meme: MemeStreamParser batches carrier-close events.
 *   Parent text model: ahu definition blocks → kahea references (children authoritative).
 *
 * Outgoing (wiki → disk):
 *   expandMemeRefs — published on the face as `$tw.lares.meme.recompose` by the
 *   meme-face startup module (island law: if it CAN happen in the TW5 Wiki VM
 *   causal island, it MUST happen there). Inverts the incoming transform: reads
 *   child bodies, reconstructs the whole definition-form carrier.
 */

import { MemeStreamParser } from "./meme-stream.js";
import {
  carrierHeadLinePattern,
  fencedSpans,
  inMask,
  maskedExec,
  maskedExecAll,
  META_OPEN_RE,
  PLAIN_OPEN_RE,
  frameAlt,
  frameHex,
  readFrame,
  frameCarrier,
  type FrameRead,
} from "@lararium/memetic-frame";
import { renderMetaTomlLine } from "./meme-normalize.js";
import { lendHostGlobals } from "./host-globals-lend.js";
import type { MemeStreamEvent } from "./meme-stream.js";
import {
  findTopLevelAhuBlocks,
  KAHEA_REF_RE,
} from "./meme-ast/ahu-scan.js";

// ── THE CODE SETS COME FROM THE DECLARATION; THE HEAD SCANS STAY THIS READER'S OWN (marks.ts) ───────
// The STX/ETX/EOT division is the one span reader's (`readFrame`). What stays here reads the HEAD: the
// SOH PREFIX stops at `&` so a namespace written as entities is never read AS the code. Only the entity
// alternation travels between them.
/** `<<^` then anything but an entity, then a SOH code — the prefix that stops at `&`. */
export const SOH_PREFIX_RE = new RegExp(`<<\\^[^&\\n]*${frameAlt("SOH")}`);
/** The SOH variant a head names through its `code=` binding, captured. */
const SOH_CODE_PARAM_RE = new RegExp(`^<<\\^[^>\\n]*?\\bcode=\\s*"&#x(${frameHex("SOH")});"`);
import { parseTaploFields } from "./toml-ast.js";
import { CARRIER_TYPE, CARRIER_TYPES, isCarrierType } from "@lararium/mesh/carrier-type";
import { HANDLE_ONLY_FIELDS } from "@lararium/mesh/content-handle";

import { getGrammar, resetGrammar } from "./grammar-cache.js";
export type { GrammarRules } from "./meme-ast/types.js";
export { getGrammar, resetGrammar };

export interface TiddlerFields {
  title?: string;
  text?: string;
  tags?: string | string[];
  type?: string;
  created?: string;
  modified?: string;
  creator?: string;
  modifier?: string;
  revision?: string;
  list?: string | string[];
  [field: string]: string | string[] | undefined;
}

// ---------------------------------------------------------------------------
// memeticWikitextDeserializer — the TW5 module export
//
// TW5 registers tiddlerdeserializer modules keyed by content-type.
// The compiled CJS exports: exports["<type>"] = this function, once per spelling. TW5 keys deserializer
// modules by type string, so a carrier stored under the unsuffixed name needs its own export or the
// file reads as plain text and yields no records at all.
// ---------------------------------------------------------------------------

export function memeticWikitextDeserializer(
  text:   string,
  fields: Record<string, unknown>,
): TiddlerFields[] {
  // A plain server's sandbox lends no TextEncoder; the hashing below needs one whichever path reached
  // here, startup module or not.
  lendHostGlobals(globalThis, typeof process === "undefined" ? undefined : process);
  // Carrier-bytes law (memetic-wikitext-framing #carrier-bytes): carriers rest as UTF-8, LF, no BOM.
  // A TOLERANT READ, documented: a platform wrote a BOM or CRLF, not an author, so the boundary folds
  // them once, here, and every stratum downstream sees one byte law. The gradient names them and
  // `lares meme normalize` writes the canonical bytes back — the tolerance is never the rest state.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\r")) text = text.replace(/\r\n?/g, "\n");
  const baseUri = String(fields?.["title"] ?? "");
  const result: TiddlerFields[] = [];
  // The file-level carriage — the prologue above the head and the bytes past the frame — hangs on the
  // FIRST and LAST carrier respectively, so it is gathered here and joined once every close is read.
  const carriage: TiddlerFields[] = [];

  const { closes, prologue, postamble, slotText } = readStream(text);
  for (const ev of closes) {
    const uri      = ev.uri || baseUri;
    // MemeStreamParser's fullText extends past the ETX in single-meme
    // files; trim that trailing content so the parent meme's text field
    // doesn't duplicate the postamble already captured separately.
    const tiddlers = safeSplitMeme(uri, ownText(ev, closes, postamble), asStringFields(fields));
    if (prologue.length > 0 && tiddlers.length > 0 && ev === closes[0]) {
      // ONE RECORD, NOT A COPY PER TIDDLER. The prologue belongs to the carrier, and stamping it on
      // every record of that carrier put 4,015 copies of one string in the corpus.
      carriage.push(...carriageRecord(String(tiddlers[0]!["title"]), "prologue", prologue));
    }
    // The head names its namespace and its code by NAMED params, the one spelling a head is read in;
    // a head in a retired spelling (glyphs before the code) is the frame verdict's tear, never read
    // here. The Kapu SOH variant (&#x0011; DC1) carries its own semantics — the code survives on the
    // parent as `$carrier-soh`, never normalized away.
    const namespace = (/^<<\^[^>\n]*?\bnamespace="([^"]*)"/.exec(ev.fullText)?.[1] ?? "").trim();
    const sohCode = SOH_CODE_PARAM_RE.exec(ev.fullText)?.[1];
    if (namespace.length > 0 && tiddlers.length > 0) {
      for (const t of tiddlers) t["namespace"] = namespace;
    }
    if (sohCode === "0011" && tiddlers.length > 0) {
      tiddlers[0]!["$carrier-soh"] = "0011";
    }
    // `ahu` and `fragment` lower through one intent path. Each child record carries its authored
    // worksite spelling, and recomposition returns that surface.
    // WHAT MAY STAND BETWEEN ETX AND EOT — the BCC, and nothing else.
    //
    // ETX ends the text; the slot after it carries the block check, never payload (@lararium/memetic-frame check.ts
    // holds the why). A carrier that wrote prose there lost it: the render never reproduced it, and
    // nothing said so. Two `#edges` blocks vanished that way before anyone diffed a round-trip.
    //
    // Foreign content in that slot is the carrier check's to refuse (`carrier-check.ts`); this reader
    // stamps no reading onto a record. A block check needs no record either: the emitter mints one over
    // every framed body, so an arriving check is a fact already true of the bytes.
    if ((postamble.trim().length > 0 || slotText.trim().length > 0)
        && tiddlers.length > 0 && ev === closes[closes.length - 1]) {
      carriage.push(...carriageRecord(String(tiddlers[0]!["title"]), "postamble", postamble));
    }
    result.push(...tiddlers);
  }

  // ⤴ Fallback — no SOH framing: treat entire text as bare meme body.
  if (result.length === 0 && text.trim()) {
    result.push(...safeSplitMeme(baseUri, text, asStringFields(fields)));
  }

  result.push(...carriage);
  return result;
}

type CarrierClose = Extract<MemeStreamEvent, { kind: "carrier-close" }>;

/** A stream of carriers, read once: each close, and the file-level carriage around them. */
interface StreamReading {
  readonly closes: readonly CarrierClose[];
  readonly prologue: string;
  readonly postamble: string;
  /** What the last carrier wrote between end-of-text and end-of-transmission. */
  readonly slotText: string;
}

function readStream(text: string): StreamReading {
  // ✶ Scan — stream parse: handles single-meme, multi-meme, and partials.
  const parser = new MemeStreamParser();
  const events: MemeStreamEvent[] = [...parser.push(text), ...parser.flush()];

  // ⏿ Hold — only carrier-close events produce tiddlers.
  const closes = events.filter((e): e is CarrierClose =>
    e.kind === "carrier-close"
  );

  // ◇ Route — each carrier-close → split ahu slots → batch.
  // Pre-SOH content (the declaration + leading prose) sits OUTSIDE
  // ev.fullText because MemeStreamParser frames on SOH/ETX. Capture
  // everything before the first SOH as `prologue` on the first carrier's
  // parent and everything after the last ETX/EOT as `postamble` on the
  // last carrier's parent. The recompose inverse (`expandMemeRefs` /
  // `exportMemeText`) re-emits both verbatim. Round-trip law: anything in
  // the operator's source survives.
  // (Multi-meme prologue/postamble distribution between intermediate
  // carriers lands when MemeStreamParser surfaces positional metadata on
  // carrier events.)
  // SOH carrier sentinels begin with `<<^` then optional namespace glyphs
  // (⊙, ॐ ँ, …) then the SOH control-char reference directly — the same
  // shape the namespace extractor below reads. Anchoring on the SOH/SOH2
  // codes avoids matching the declaration, a speaking-head sigil,
  // or later STX/ETX sentinels — an
  // any-control-char form swallows the whole header into `prologue` whenever
  // the SOH carries a namespace it cannot see.
  const sohM = maskedExec(text, SOH_PREFIX_RE);
  const sohIdx = sohM ? sohM.index : -1;
  // THE FRAME OWNS THE DECLARATION; `prologue` carries bytes beyond it. This keeps the declaration in
  // one frame position instead of copying it onto every record of a carrier.
  const prologueRaw = (closes.length > 0 && sohIdx > 0) ? text.slice(0, sohIdx) : "";
  const prologue = prologueRaw.replace(/^<<!DOCTYPE[^>\n]*>>\n?\n?/m, "");
  // THE CLOSE IS THE ONE SPAN READER'S (`readFrame`), the same reader the block check and the gradient
  // divide by. The LAST carrier owns the file's tail, so the reader runs over that carrier's own region:
  // the ETX that closes its text, then the first release past it.
  //
  // ETX AND EOT ARE DIFFERENT GLYPHS AND STAY APART. The slot between them carries the block check and
  // nothing else; content stranded there stays legible to the classifier below instead of vanishing in
  // the render — which is how two `#edges` blocks were once lost. A second live ETX inside the frame
  // lands in that slot too: the text closed at the first, so what follows is not body, and it NAKs.
  const lastSoh = maskedExecAll(text, new RegExp(SOH_PREFIX_RE.source, "g")).at(-1);
  const tailFrom = lastSoh ? lastSoh.index : 0;
  const tail = readFrame(text.slice(tailFrom));
  const closeEnd = tail.etx ? tailFrom + tail.etx.end : -1;
  const release = tail.etx && tail.eot ? tail.eot : null;
  // THE SLOT: what the carrier wrote between end-of-text and end-of-transmission.
  const slotText = closeEnd >= 0 && release ? text.slice(closeEnd, tailFrom + release.index) : "";
  // Past EOT there stands only the frame's own trailing newline; that tail reads to end of text.
  const frameEnd = release ? tailFrom + release.end : closeEnd;
  const postamble = (closes.length > 0 && frameEnd >= 0 && frameEnd < text.length)
    ? text.slice(frameEnd)
    : "";
  return { closes, prologue, postamble, slotText };
}

/**
 * One carrier's own text. MemeStreamParser's fullText extends past the ETX in single-meme files; trim
 * that trailing content so the parent meme's text field doesn't duplicate the postamble captured
 * separately.
 */
function ownText(ev: CarrierClose, closes: readonly CarrierClose[], postamble: string): string {
  if (postamble.length > 0 && ev === closes[closes.length - 1] && ev.fullText.endsWith(postamble)) {
    return ev.fullText.slice(0, ev.fullText.length - postamble.length);
  }
  return ev.fullText;
}

/** One carrier of a text: the address it names and the bytes the records are split from. */
export interface CarrierText {
  readonly uri:  string;
  readonly text: string;
}

/**
 * Every carrier a text carries, as the deserializer divides it — or the whole text under `baseUri`
 * where no carrier closes. The carrier check reads the same division the records were split from.
 */
export function carrierTexts(text: string, baseUri: string): CarrierText[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\r")) text = text.replace(/\r\n?/g, "\n");
  const { closes, postamble } = readStream(text);
  const out = closes.map((ev) => ({ uri: ev.uri || baseUri, text: ownText(ev, closes, postamble) }));
  return out.length === 0 && text.trim() ? [{ uri: baseUri, text }] : out;
}

// ---------------------------------------------------------------------------
// safeSplitMeme — LOSS-LESS split (Goal B).
//
// A split failure NEVER truncates — it falls back to the verbatim whole, flagged (drop-honesty): one
// un-split tiddler holding every byte beats a silent truncation. AI-session turns arrive bare (no
// carrier sigils) and ride this via the no-SOH fallback — they split clean (no ahu → verbatim parent)
// or, if malformed, degrade legibly.
// ---------------------------------------------------------------------------

function safeSplitMeme(uri: string, text: string, fields: TiddlerFields): TiddlerFields[] {
  try {
    return splitMemeToTiddlers(uri, text, fields);
  } catch (err) {
    console.warn(`[memetic-deserializer] split failed for ${uri} — verbatim fallback (drop-honesty): ${err instanceof Error ? err.message : String(err)}`);
    return [{ ...fields, title: uri, text } as TiddlerFields];
  }
}

// ---------------------------------------------------------------------------
// splitMemeToTiddlers — parse one meme (SOH→ETX span) into parent + children.
//
// `text` = ev.fullText from MemeStreamParser = SOH line → ETX inclusive.
// On exit: parent.text = body proper only (SOH/meta/STX/ETX stripped).
// Child tiddlers: one per non-control ahu slot; text = slot body proper.
// ---------------------------------------------------------------------------

// The head line, stripped at ingest. Control sigils live on ONE line by law — the shore's line pattern
// never crosses one (a greedy multi-line match once swallowed from a quoted `<<~` mention down to the
// real closer; found on loci.md).
const SOH_LINE_RE = carrierHeadLinePattern();

function stripLeadingNewlines(text: string): string {
  return text.replace(/^\n+/, "");
}

function stripEdgeNewlines(text: string): string {
  return text.replace(/^\n+|\n+$/g, "");
}

/** A meta fence as the reader found it: its TOML and where the fence stands. */
export interface MetaFence {
  readonly content: string;
  readonly start:   number;
  readonly end:     number;
}

/**
 * One carrier's text, divided — the frame, the bytes between the head and STX, the root meta, the
 * body. The records split from this division, and the carrier check reads the same one, so a check
 * never judges bytes the records were not built from.
 */
export interface CarrierDivision {
  /** The carrier text with its head line stripped. */
  readonly noSoh: string;
  /** The one span reader's division of `noSoh`. */
  readonly frame: FrameRead;
  /** The bytes between the head and STX, verbatim — carried, never read for fields. */
  readonly headerText: string;
  /** The root meta fence: the first construct of the body. */
  readonly bodyMeta: MetaFence | null;
  /** The authored body after its root meta, edge-trimmed — what the records split from. */
  readonly body: string;
}

export function divideCarrier(text: string): CarrierDivision {
  // Fence-mask law: a QUOTED control sigil (in a code fence or inline code) never frames the carrier —
  // before the mask, a fenced ETX mention truncated everything after it (real corpus loss).
  const noSoh = text.replace(SOH_LINE_RE, "");   // anchored at 0 — never fenced
  // THE ONE SPAN READER DIVIDES THE CARRIER (`readFrame`): the first live STX opens the text, the first
  // live ETX after it closes it, and a quoted mark — a teaching example in a fence — frames nothing.
  // The same rule the block check verifies by, so the body this split reads is the body the check
  // covers, byte for byte.
  //
  // A carrier that frames no body still closes its transmission, so where no ETX stands the body ends
  // at the release — otherwise the author's own close rides inside the body and the projection mints
  // a second one below it. The newline ahead of a closing mark is the frame's padding, never body.
  const frame = readFrame(noSoh);
  const closeMark = frame.etx ?? frame.eot;
  const closeAt = closeMark ? closeMark.index - (noSoh[closeMark.index - 1] === "\n" ? 1 : 0) : -1;
  const stripped = closeMark ? noSoh.slice(0, closeAt) : noSoh;
  // The STX the reader found, with the newline the frame pads it with — or none, where the text has no
  // bound (or the only STX stands past the close, which bounds nothing).
  const stx = frame.stx && frame.stx.index < stripped.length ? frame.stx : null;
  // ONE MODEL FOR EVERY CARRIER: routing outside, authored document inside. The bytes between the head
  // and STX ride VERBATIM as carriage, and no field is read from them — root metadata opens the BODY,
  // and a meta fence standing above STX is the frame verdict's fault (`meta-before-stx`), never a block
  // this reader recovers. NO STX MEANS ALL BODY: a carrier that supplies identity without framing has
  // left its document boundary short, rather than declared a second document kind.
  const headerText = stx ? stripped.slice(0, stx.index) : "";
  const bodyRegion = stripLeadingNewlines(stx
    ? stripped.slice(stx.end + (noSoh[stx.end] === "\n" ? 1 : 0))
    : stripped);
  // THE FENCE MUST OPEN THE BODY TO COUNT, because every OTHER meta block belongs to the ahu tiddler it
  // sits in. A slot’s fence carries its local metadata and `extractSlotStructure` projects it onto the
  // child record. One positional law holds: the opening root fence names the carrier, each later local
  // fence names its slot, and neither reaches into the other. Whitespace is spacing, never content.
  const candidate = findMetaFence(bodyRegion, false);
  const bodyMeta = candidate && bodyRegion.slice(0, candidate.start).trim() === "" ? candidate : null;
  const body = stripEdgeNewlines(bodyMeta ? stripLeadingNewlines(bodyRegion.slice(bodyMeta.end)) : bodyRegion);
  return { noSoh, frame, headerText, bodyMeta, body };
}

function splitMemeToTiddlers(
  uri:        string,
  text:       string,
  baseFields: TiddlerFields,
): TiddlerFields[] {
  const { headerText, bodyMeta, body } = divideCarrier(text);
  const rootFields = bodyMeta ? fieldifyToml(bodyMeta.content) : {};
  // A CARRIER IS A ROOT: every door refuses a fragment-carrying address before a split runs, so the
  // carrier's own URI is the root its slots compose under.
  const { children, rewrittenText } = splitRecursive(uri, "", body);

  const parent: TiddlerFields = {
    ...baseFields,
    ...rootFields,
    title: uri,
    type:  rootFields.type ?? CARRIER_TYPE,
    text:  stripEdgeNewlines(rewrittenText),
  };
  // Spacing between the head and STX is the frame's padding; anything more rides as carriage.
  return [parent, ...children, ...carriageRecord(uri, "header-text", headerText.trim() === "" ? "" : headerText)];
}

// ---------------------------------------------------------------------------
// splitRecursive — full-depth ahu walk producing a flat tiddler set.
//
// Each ahu sigil at every depth becomes its own tiddler. The bag stays flat;
// the URI fragment-path (`#/parent/child/grandchild`) carries the hierarchy.
// The parent of each tiddler — `fragment-parent` field — points ONE LEVEL up
// (immediate enclosing ahu, not the meme-root), so disk-projector and
// templates can climb to the nearest tagged ancestor in a single hop chain.
// The text returned for each tiddler has its own ahu blocks rewritten to
// `<<~ kahea ahu #slot>>` references; child tiddlers hold the body bytes
// authoritatively.
// ---------------------------------------------------------------------------

function splitRecursive(
  rootUri:          string,
  fragmentPrefix:   string,  // "" at meme root; "#/a" → "#/a/b" → "#/a/b/c"
  text:             string,
): { children: TiddlerFields[]; rewrittenText: string } {
  const allChildren: TiddlerFields[] = [];
  const enclosingUri = rootUri + fragmentPrefix;
  const blocks = findTopLevelAhuBlocks(text);
  let cursor = 0;
  let rewritten = "";
  for (const block of blocks) {
    rewritten += text.slice(cursor, block.openStart);
    // READ relation (never MINT): an authored nested open already carries its WHOLE path from the
    // carrier root by canon — `block.slot` is taken verbatim, never composed against `fragmentPrefix`.
    // A relative or parent-colliding open is the CHECK layer's fault to name
    // (`nested-slot-outside-parent`), not this reader's to tolerate or repair.
    const childSlotPath = block.slot;
    const childUri      = rootUri + block.slot;
    // ONE SLOT, ONE ADDRESS. The scanner admits the rooted spelling only; the record, parent ref, and
    // `$slot` carry that same spelling, so a reader needs no compatibility normalization.
    const slot          = block.slot;
    const bodyText      = text.slice(block.bodyStart, block.bodyEnd);
    const inner         = splitRecursive(rootUri, childSlotPath, bodyText);
    const childStructure = extractSlotStructure(inner.rewrittenText);

    const childUriPath  = childUri.startsWith("lar:///") ? childUri.slice(7) : childUri;
    // Record hygiene (carrier-whole at rest): children carry NO `file-path` —
    // a fragment record never owns a disk file; its carrier root does.

    allChildren.push({
      // Default carrier type; a child slot's OWN declared meta `type` (e.g. text/markdown) rides in
      // childStructure.fields and OVERRIDES this default via the spread — a typed child keeps its
      // type instead of losing it to the memetic-wikitext hardcode. (The parent carrier stays
      // memetic by construction — this deserializer runs because the carrier IS memetic.)
      type:              CARRIER_TYPE,
      ...childStructure.fields,
      title:             childUri,
      text:              childStructure.text,
      "uri-path":        childUriPath,
      "$fragment-parent": enclosingUri,
      "$slot":            slot,
    });
    // MINT ON DIFFERENCE, NEVER ON DEFAULT. The render (expandRefs below) already falls back to the
    // canonical spelling — `<<~ ahu ${slot}>>` / `<<~/ahu>>` — whenever no worksite carriage record
    // exists for a slot. So the split side must NOT mint one when the authored bytes already ARE that
    // canonical spelling: a record there would be a derived value stored, re-deriving the same bytes
    // the render would have emitted for free. Only authored bytes that DIFFER from the canonical
    // default (alternate spacing, the `fragment`/`/fragment` spelling, …) carry content worth a record.
    const openBytes  = text.slice(block.openStart, block.bodyStart);
    const closeBytes = text.slice(block.bodyEnd, block.closeEnd);
    allChildren.push(
      ...(openBytes  === `<<~ ahu ${slot}>>` ? [] : carriageRecord(childUri, "worksite-open",  openBytes)),
      ...(closeBytes === `<<~/ahu>>`         ? [] : carriageRecord(childUri, "worksite-close", closeBytes)),
      ...carriageRecord(childUri, "preamble",  childStructure.preamble  ?? ""),
      ...carriageRecord(childUri, "postamble", childStructure.postamble ?? ""),
    );
    allChildren.push(...inner.children);
    rewritten += `<<~ kahea ahu ${slot}>>`;
    cursor = block.closeEnd;
  }
  rewritten += text.slice(cursor);
  return { children: allChildren, rewrittenText: rewritten };
}

// ---------------------------------------------------------------------------
// findMetaFence — locate a ```toml meta``` (or plain ```toml```) fence block.
// Used by both header-region and slot-body TOML extraction.
// ---------------------------------------------------------------------------

// THE OPENER IS SHARED, THE CLOSE IS THIS READER'S OWN. `findMetaFence` hands back `start`/`end` and
// the render rests on those offsets, so the ```\n? close stays exactly as it stands — a close fused
// with carrier-shape's `\n``` would move `content` and `end` and byte-exact round-trip with it.
const META_FENCE_RE  = new RegExp(META_OPEN_RE.source  + "([\\s\\S]*?)```\\n?");
const PLAIN_FENCE_RE = new RegExp(PLAIN_OPEN_RE.source + "([\\s\\S]*?)```\\n?");

export function findMetaFence(text: string, allowPlain = false): MetaFence | null {
  // The meta fence IS a fence — accept a match starting AT a span opener,
  // reject one buried inside another span (a ````-quoted teaching example).
  const m = maskedExec(text, META_FENCE_RE, undefined, true)
    ?? (allowPlain ? maskedExec(text, PLAIN_FENCE_RE, undefined, true) : null);
  if (!m) return null;
  return { content: m[1] ?? "", start: m.index, end: m.index + m[0].length };
}

// ---------------------------------------------------------------------------
// extractSlotStructure — split a slot body into preamble + meta fields + text
// + postamble. Same shape as the disk-version full-meme split, applied to
// every ahu slot so each slot is itself a valid "full published meme MD
// file" projection.
//
// Convention:
//   - THE FENCE MUST OPEN ITS HEAD. A labelled meta fence heads the slot it opens; content standing
//     BEFORE it means the fence heads nothing — it is body, the way a teaching example is. The parent
//     law (memetic-wikitext-framing #authoring: the fence that OPENS a carrier heads it) reaches every slot the same way.
//
//     Post-meta content in the head STANDS — that is the bindings zone, authored, and it re-emits
//     between the meta and the body. Pre-meta content does not, and `preamble` retires with it: a zone
//     that names a shape the grammar forbids holds bytes nothing should have written.
//   - fields    = parsed from the meta toml block (operator-authored keys).
//   - text      = body proper — from the first inner kahea ref to the last
//     inner kahea ref end (inclusive of refs for sub-slot reconstruction).
//   - postamble = text AFTER the last inner kahea ref (trailing prose).
//
// When no inner sigils exist:
//   - meta present: preamble holds pre-meta prose + meta marker + post-meta
//     prose; text = "".
//   - no meta:      text = whole body, preamble = "".
// ---------------------------------------------------------------------------

interface SlotStructure {
  readonly preamble:  string;
  readonly fields:    TiddlerFields;
  readonly text:      string;
  readonly postamble: string;
}

function extractSlotStructure(bodyText: string): SlotStructure {
  // Only a LABELED ```toml meta fence carries slot identity. A plain ```toml
  // fence is operator CONTENT (teaching matter, config examples) — swallowing
  // it into fields mutated content on round-trip (key reorder, re-alignment,
  // the fence relabeled `toml meta`). Carrier-whole law: content bytes survive
  // whole.
  // A fence preceded by content heads nothing. Whitespace does not count as content — a blank line
  // between the ahu sigil and the fence is spacing, not prose.
  const metaCandidate = findMetaFence(bodyText, false);
  const metaM = metaCandidate && bodyText.slice(0, metaCandidate.start).trim() === ""
    ? metaCandidate
    : null;

  let preamble = "";
  let fields: TiddlerFields = {};
  let remainder = bodyText;

  if (metaM) {
    // A fence that OPENS its head has only spacing above it, and spacing is not content — capturing it
    // gave `preamble` a whitespace value that re-emitted as an meta key and shrank on the next read.
    preamble  = "";
    fields    = fieldifyToml(metaM.content);
    remainder = bodyText.slice(metaM.end);
  }

  // Find LAST kahea ref — trailing prose becomes postamble. Quoted refs
  // (fenced/inline-code) stay content, never structure (fence-mask law). The slot path is the
  // scanner's own (`KAHEA_REF_RE`): a rooted path (`#/a/b/c`) addresses a nested fragment and MUST
  // round-trip whole.
  let lastEnd = -1;
  for (const m of maskedExecAll(remainder, KAHEA_REF_RE)) {
    lastEnd = m.index + m[0].length;
  }

  let text      = remainder;
  let postamble = "";
  if (lastEnd >= 0 && lastEnd < remainder.length) {
    text      = remainder.slice(0, lastEnd);
    postamble = remainder.slice(lastEnd);
  }

  // No meta, no refs: the whole body is text.
  if (!metaM && lastEnd < 0) {
    text     = bodyText;
    preamble = "";
  }

  return {
    preamble,
    fields,
    text: stripEdgeNewlines(text),
    postamble,
  };
}

// ---------------------------------------------------------------------------
// fieldifyToml — convert raw TOML key=value text into TiddlerFields
// ---------------------------------------------------------------------------

function fieldifyToml(toml: string): TiddlerFields {
  const out: TiddlerFields = {};
  for (const [k, v] of Object.entries(parseTaploFields(toml))) {
    // `title` is carried in the root authorial block so identity can be checked against SOH. The
    // record title remains the canonical SOH-derived key; a mismatch is the carrier check's to name.
    if (k === "title") { out[k] = String(v); continue; }
    // `text` derives from the body; an authored `text` key is ignored here and named by the carrier check.
    if (k === "text")  continue;
    out[k] = Array.isArray(v) ? (v as unknown[]).map(String) : String(v);
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

export { memeticWikitextDeserializer as "text/memetic-wikitext+tiddlywiki" };

// ---------------------------------------------------------------------------
// splitBodyTiddler — Path H save-side auto-split
//
// Splits a tiddler's body text at ahu block boundaries without the full
// SOH/STX/ETX envelope processing (which is for disk ingest only).
//
// Used by IslandAdaptor.saveTiddler's "direct" handler when a user saves
// a tiddler whose body contains `<<~ ahu` blocks — symmetric with the disk
// sync path (ONE parser, FOUR call sites law).
//
// Returns:
//   parent   — same tiddler with `text` rewritten (ahu blocks → kahea refs)
//   children — one TiddlerFields per ahu slot, deep-recursed
//
// If no ahu blocks exist in bodyText the function returns { parent: fields,
// children: [] } with no allocation — callers can skip the tombstone scan.
// ---------------------------------------------------------------------------

export function splitBodyTiddler(
  rootUri:        string,
  fragmentPrefix: string,  // "" for a root; "#/a" for a slot child saved at its own address
  bodyText:       string,
  baseFields:     TiddlerFields,
): { parent: TiddlerFields; children: TiddlerFields[] } {
  const uri = rootUri + fragmentPrefix;
  if (!bodyText.includes("<<~ ahu")) {
    return { parent: { ...baseFields, title: uri, text: bodyText }, children: [] };
  }
  const { children, rewrittenText } = splitRecursive(rootUri, fragmentPrefix, bodyText);
  const parent: TiddlerFields = { ...baseFields, title: uri, text: rewrittenText };
  return { parent, children };
}

// ---------------------------------------------------------------------------
// expandMemeRefs — the recompose inverse (wiki → disk)
//
// Doctrine (disk-projection#granularity): every path back to disk MUST route
// through the recompose inverse (`expandMemeRefs` / `exportMemeText`). This
// function inverts the incoming shore transform above: it reads the
// parent's normalized records, splices each `<<~ kahea ahu #slot>>` marker
// back into its child's full definition form (recursively), and reassembles
// the carrier envelope (prologue · SOH · preamble · meta · header · STX ·
// body · ETX · EOT · postamble).
//
// Canonical-form law (handoff #pattern-integrities §2) binds the output:
//   1. idempotent render — canonical input round-trips byte-identical
//      (sigil spacing `<<^ code="&#x0002;">>`, one-blank-line block margins);
//   2. framing normalizes once — the meta block re-emits sorted + aligned
//      from fields (authored key order and padding do not survive the
//      record stratum);
//   3. parse∘render ≡ records — proven by the round-trip harness, never
//      by assertion.
//
// Pure function over a fields reader: no I/O, no TW5 dependency — the same
// shore module owns both directions, so the harness proves the pair.
// ---------------------------------------------------------------------------

export type FieldsReader = (title: string) => TiddlerFields | undefined;

// The single deny-set: STRUCTURAL / ENVELOPE fields never re-emit into the meta
// fence — they rebuild from the envelope + record stratum on recompose, so
// emitting them into the TOML DOUBLES the body (title/text) or the framing.
//
// The telemetry fence (operator ruling 2026-07-20): sensorium/worldline telemetry
// routes through Py on capture, and a sensorium→wiki pull MUST carry ALL its
// metadata. So `lar_*` sensorium fields (`lar_agent_handle`, `lar_ffz`,
// `lar_root_handle`, …) round-trip WHOLE — no prefix carries a blanket denial.
//
// NO OPERATOR NAME SITS HERE. TiddlyWiki restricts no field name and MultiWikiServer restricts two,
// so this set holds those two and their record-stratum siblings and nothing else. The grammar's OWN
// carriage — the prologue, the preamble, the header text, the slot a fragment fills, the parent it
// hangs from, the bytes trailing the frame — rides the `$…` namespace TW5 keeps for a host, which
  // `emitMetaToml` drops wholesale. An author writing `postamble` or `slot` receives an ordinary
// custom field that round-trips like any other, because the grammar stopped standing on those words.
//
// That move also closed a hole the name-list could not: `preamble` and `carrier-sila` were read as
// carriage and denied nowhere, so they emitted into the meta AND rebuilt as structure — an operator's
// value came back undefined and the projection stopped settling. A namespace covers what a list
// forgets.
const META_DENY: ReadonlySet<string> = new Set([
  // The host's two, and the record stratum they arrive with. TiddlyWiki restricts no field name;
  // MultiWikiServer overwrites `title` and `revision` on every read.
  "text", "modified", "revision",
  // The skinny handle's pointer internals (content-handle): a recomposed carrier carries its body
  // inline, so a `_canonical_uri` or `_integrity` re-emitted here would lie about the bytes beneath it.
  ...HANDLE_ONLY_FIELDS,
]);
// Authored identity re-emits: the deny-set
// holds MACHINE stamps only. `type` re-emits verbatim — the carrier
// self-describes its content type at rest (TW5's content-type field shares the
// name exactly; round trip = identity). `namespace` re-emits as explicit
// Unicode escapes — glyphs render on the SOH line, the TOML lists their
// codepoints. `created` re-emits because 11 corpus carriers author it as a
// human date and the LOAD→project path stamps it nowhere (a future
// wiki-edit stamping created would surface in the projection diff — the
// operator's signature surface — not silently). `source-file` re-emits
// for the same reason: 71 doc memes author it to name the TS source they
// document; the shore path stamps it nowhere.

// Children additionally drop ingest-stamped coordinates: `uri-path` is
// derived from the title, and `file-path` on a child is the burned
// fragment-file leak (carrier-whole at rest — a fragment never owns a file).
// Everything ELSE the author wrote re-emits verbatim (deny holds MACHINE
// stamps only): `type` self-describes the child's content family, `namespace`,
// `created`, `source-file`, `tags` all round-trip = identity, exactly as on
// the parent — a child that authored them keeps them.
const CHILD_META_DENY: ReadonlySet<string> = new Set([
  ...META_DENY, "title", "uri-path", "file-path",
]);

function fmtTomlValue(v: string | string[]): string {
  if (Array.isArray(v)) {
    return "[" + v.map((s) =>
      '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"'
    ).join(", ") + "]";
  }
  const s = String(v);
  if (/^-?\d+$/.test(s) || s === "true" || s === "false") return s;
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
}

/**
 * The namespace's canonical meta form: every non-ASCII codepoint as an
 * HTML-entity hexcode — the same idiom the carrier's control sigils speak
 * (`&#x0950;` beside `&#x0004;`). The glyphs render on the SOH line; the
 * TOML lists their codes. The SOH extraction holds field authority at
 * parse (glyphs), so the entity string re-derives stably each render.
 */
function fmtNamespaceEntities(v: string): string {
  let out = '"';
  for (const ch of String(v)) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (cp >= 0x20 && cp < 0x7f) out += ch;
    else out += "&#x" + cp.toString(16).toUpperCase().padStart(4, "0") + ";";
  }
  return out + '"';
}

/** Canonical meta TOML: sorted keys, equals-signs aligned to the longest key.
 *  `lar_*` sensorium/worldline metadata re-emits WHOLE (the telemetry fence —
 *  see META_DENY); the deny-set names the only
 *  denials by exact key (structural/envelope + the two parse-grade markers).
 *  TW5-internal `$…` fields stay off the operator's TOML. */
/** Field-value equality across the string | string[] carrier shapes (undefined never matches). */
function sameFieldValue(a: TiddlerFields[string] | undefined, b: TiddlerFields[string] | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [a];
    const bb = Array.isArray(b) ? b : [b];
    return aa.length === bb.length && aa.every((x, i) => x === bb[i]);
  }
  return a === b;
}

// `parentFields`, when present, drives child INHERITANCE: a child writes a field ONLY when it
// DIFFERS from the parent's (or the parent lacks it). A field that matches the parent floats down
// silently — the author sees it once, at the level that set it, never re-stamped on every fragment.
function emitMetaToml(fields: TiddlerFields, deny: ReadonlySet<string>, parentFields?: TiddlerFields): string {
  const keys = Object.keys(fields).sort().filter((k) => {
    if (deny.has(k) || k.charAt(0) === "$") return false;
    const v = fields[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return false;
    // Inherited-and-matching → skip (write only what the child changes from its parent).
    if (parentFields && sameFieldValue(v, parentFields[k])) return false;
    return true;
  });
  if (keys.length === 0) return "";
  // The column law lives in meme-normalize, so the projector's render and `meme normalize` agree.
  const pad = Math.max(...keys.map((k) => k.length));
  return keys.map((k) => {
    const v = fields[k] as string | string[];
    const rendered = k === "namespace" && typeof v === "string"
      ? fmtNamespaceEntities(v)
      : fmtTomlValue(v);
    return renderMetaTomlLine(k, rendered, pad);
  }).join("\n") + "\n";
}

// The captured slot mirrors AHU_OPEN_RE's grammar, slash-path included — a
// `#/a/b` slot addresses a nested fragment; a `#[\w-]+`-only capture stopped at
// the first `/`, so the ref never matched its child and the whole slot body
// dropped from the render (the ahu-drop). The path re-composes verbatim below.
/**
 * CARRIAGE RIDES ITS OWN RECORD, at an address derived from the carrier's.
 *
 * Four parts of a carrier hold CONTENT rather than a value: the prologue above the declaration, the
 * preamble beneath the head, the header text before STX, the bytes trailing the frame. A tiddler field
 * cannot hold any of them across a `.tid` projection — TW5 parses a field header line by line, so only
 * `text` may carry a newline (boot.js, `application/x-tiddler`). A field that can only survive inside
 * one file format is a field that cannot travel.
 *
 * So each becomes a record with a `text`, on the rails that already carry ahu fragments: a deterministic
 * address under the carrier's own, `$fragment-parent` set so the projector climbs to the root and never
 * writes it as its own file, and no kahea marker anywhere — the frame splices these by POSITION, which
 * is the only signal the bytes ever carried.
 *
 * The `$` marks the host's slot and keeps the address whole; a `$:/`-prefixed system title would break
 * the carriage away from the thing it belongs to.
 *
 * Scalars stay fields. `$slot`, `$fragment-parent`, `$carrier-soh` hold single
 * values that never carry a newline, and a record for each would cost the native filter surface and buy
 * nothing. The split runs scalar-or-multiline, never reserved-or-free.
 */
export const CARRIAGE_PARTS = ["prologue", "preamble", "header-text", "postamble", "worksite-open", "worksite-close"] as const;
export type CarriagePart = (typeof CARRIAGE_PARTS)[number];

/**
 * A carriage record's address.
 *
 * A carriage rides a path like everything else the house addresses — `#/$postamble` at a carrier
 * root, `#/observe/$postamble` under a section. The bare space holds no house address at all
 * (composeChildPath); it belongs to the page anchors a live wiki renders.
 */
export function carriageUri(carrierUri: string, part: CarriagePart): string {
  const cut = carrierUri.indexOf("#");
  if (cut < 0) return `${carrierUri}#/$${part}`;
  const base = carrierUri.slice(0, cut);
  const frag = carrierUri.slice(cut + 1);
  return `${base}#/${frag.replace(/^\//, "")}/$${part}`;
}

/** One carriage record, or nothing where the part holds no content. */
function carriageRecord(carrierUri: string, part: CarriagePart, text: string): TiddlerFields[] {
  if (text === "") return [];
  return [{
    title:              carriageUri(carrierUri, part),
    type:               CARRIER_TYPE,
    text,
    "$fragment-parent": carrierUri,
    "$slot":            `$${part}`,
  }];
}

/** What a carriage part holds for a carrier, read through the same reader the frame reads records by. */
function carriageText(reader: FieldsReader, carrierUri: string, part: CarriagePart): string {
  const r = reader(carriageUri(carrierUri, part));
  return r && typeof r["text"] === "string" ? (r["text"] as string) : "";
}

/**
 * Splice child definition blocks back over their kahea markers, full depth.
 * Quoted markers (fenced/inline-code) stay verbatim — the operator SHOWS
 * the grammar there, the recompose never expands inside the mask.
 */
function expandRefs(reader: FieldsReader, rootUri: string, text: string, parentFields: TiddlerFields): string {
  const mask = fencedSpans(text);
  return text.replace(KAHEA_REF_RE, (marker, slot: string, offset: number) => {
    if (inMask(mask, offset)) return marker;
    // READ relation: the kahea marker already carries the slot's full rooted address (split emits it
    // verbatim), so the child's path is the marker's slot, never recomposed against `fragmentPrefix`.
    const slotPath = slot;
    const child = reader(rootUri + slotPath);
    if (!child) return marker;   // missing child: keep the marker — honest residue, never invented bytes
    // Diff the child against ITS parent; recurse with the child as the next level's parent.
    const meta   = emitMetaToml(child, CHILD_META_DENY, parentFields);
    const inner = expandRefs(reader, rootUri, String(child["text"] ?? ""), child);
    const pre   = carriageText(reader, rootUri + slotPath, "preamble");
    const post  = carriageText(reader, rootUri + slotPath, "postamble");
    // The meta block sits FLUSH against the ahu sigil line (mirroring the parent carrier's SOH+meta) —
    // a single newline, no blank between. A blank line then separates any content below. A preamble
    // (rare) keeps the older sigil-then-blank spacing since content precedes the meta there.
    const metaBlock = meta ? "```toml meta\n" + meta + "```" : "";
    const rest     = stripEdgeNewlines(inner + post);
    // A whitespace-only preamble (`"\n\n"`) carries no content — treat it as none so the meta
    // still hugs the sigil line. Only REAL preamble content routes to the sigil-then-blank form.
    const hasPre   = pre.trim() !== "";
    let opened: string;
    if (hasPre) {
      opened = `\n\n${stripEdgeNewlines(pre + (metaBlock ? "\n\n" + metaBlock : "") + (rest ? "\n\n" + rest : ""))}`;
    } else if (metaBlock) {
      opened = `\n${metaBlock}${rest ? "\n\n" + rest : ""}`;
    } else {
      // An empty child carries no body — leave `opened` bare so the fixed closer supplies
      // the single blank line; a filled one opens on the sigil-then-blank spacing.
      opened = rest ? `\n\n${rest}` : "";
    }
    // Both spellings reach one worksite record shape. Worksite carriage bytes hold authored delimiters;
    // an absent carriage uses the shared ahu opener and closer.
    const spelt = slot;
    const open = carriageText(reader, rootUri + slotPath, "worksite-open");
    const close = carriageText(reader, rootUri + slotPath, "worksite-close");
    return `${open || `<<~ ahu ${spelt}>>`}${opened}\n\n${close || "<<~/ahu>>"}`;
  });
}

/**
 * Recompose one whole carrier from its record group.
 *
 * Returns null when the parent record is absent or not memetic-wikitext —
 * the caller falls back to its own law (exportMemeText returns raw text).
 */
export function expandMemeRefs(reader: FieldsReader, memeUri: string): string | null {
  const f = reader(memeUri);
  if (!f) return null;
  // A RECORD THAT IS NOT A CARRIER PROJECTS TO NOTHING, and until it said so this was the quietest
  // failure in the tree: a type the reader does not admit returns null, the projection writes no file,
  // and nothing anywhere reports which record went missing or why.
  if (!isCarrierType(f.type)) {
    if (typeof f["type"] === "string" && (f["type"] as string).includes("memetic-wikitext")) {
      console.warn(`[memetic-deserializer] ${memeUri} declares type "${f["type"] as string}" — not a spelling this reader admits (${CARRIER_TYPES.join(" · ")}); it will not project`);
    }
    return null;
  }

  const str = (k: string): string => (typeof f[k] === "string" ? (f[k] as string) : "");
  const meta = emitMetaToml(f, META_DENY);

  // THE BODY IS THIS READER'S; THE FRAME IS THE FRAME WRITER'S. Root metadata, carried root content
  // and the root text travel inside STX..ETX — the root follows the same metadata/body pattern as an
  // ahu/fragment worksite, so the check seals parent fields along with the prose.
  const carriedRootContent = [
    carriageText(reader, memeUri, "preamble"),
    expandRefs(reader, memeUri, carriageText(reader, memeUri, "header-text"), f),
  ].filter((s) => s.trim() !== "").join("\n\n");
  const body =
    (meta ? "```toml meta\n" + meta + "```\n\n" : "")
    + (carriedRootContent ? carriedRootContent + "\n\n" : "")
    + expandRefs(reader, memeUri, String(f.text ?? ""), f);

  // Everything the frame carries is MINTED, never read back from a field: the declaration (a carrier
  // that never carried one gains it on its first projection), the head (both bearing ends quoted, so
  // TiddlyWiki's own parser types it), and the check (computed over the span just framed — a stored
  // check goes stale the moment the bytes move). What the author wrote above the declaration and past
  // the release rides its own carriage record and lands in its position.
  return frameCarrier({
    head: { uri: memeUri, namespace: str("namespace"), kapu: f["$carrier-soh"] === "0011" },
    body,
    prologue: carriageText(reader, memeUri, "prologue"),
    attestation: str("$carrier-sila"),
    postamble: carriageText(reader, memeUri, "postamble"),
  });
}
