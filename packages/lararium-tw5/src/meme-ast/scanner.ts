/**
 * meme-ast/scanner.ts — regex scan patterns + collectEvents().
 *
 * Local-first, isomorphic: no fs/path/DOM imports.
 * Runs in Node, Deno, browser, and TW5-era JS environments.
 *
 * A SigilScan is one regex pass over the source text. collectEvents() runs all
 * scans, deduplicates by position, and returns a position-sorted ParseEvent[].
 * The caller (builder.ts) feeds these into the push/pop scope stack.
 *
 * Heleuma ka: sync-heleuma tracks this file.
 * Bundle entry: packages/lararium-tw5/src/meme-ast-entry.ts
 */

import type { GrammarRules, SigilRule } from "./types.js";
import { fencedSpans, maskedExecAll } from "./fence-mask.js";
import { GENERATED_SIGILS } from "./grammar-table.generated.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SigilScan {
  sigilName:     string;
  canonicalName?: string;   // alias erasure: event emits this name instead
  regex:         RegExp;
  eventType:     "open" | "close" | "leaf" | "pragma";
  generic?:      boolean;   // catch-all: emit the MATCHED word as sigilName, graded `missing` (partial rung)
}

export interface ParseEvent {
  pos:       number;
  end:       number;
  raw:       string;
  sigilName: string;        // canonical (alias already erased), or the matched word for a generic event
  eventType: "open" | "close" | "leaf" | "pragma";
  groups:    (string | undefined)[];
  generic?:  boolean;       // matched by the generic catch-all → builder grades it `missing` (partial rung)
}

// ---------------------------------------------------------------------------
// BOOTSTRAP_SCANS — the reasoned HAND-WRITTEN residue: ASCII control-character
// framing alone (SOH/STX/ETX/EOT/ETB + their kapu-extended DC1/DC4 variants).
//
// G2-G4 cutover (lar:///sigil.grammar.lane loop 2): every OTHER bootstrap scan this file used to
// hand-carry (ahu, scale, aka, kahea, pono, lele, hui/holo/puka, papalohe, toml, waiho, kau,
// heihei/kahawai/mukuwai, huli, wehe, meme, every English alias, kumu/widget, hana/task, kukali) now
// derives from GENERATED_SIGILS (grammar-table.generated.ts, itself derived from the tiddlers) —
// `collectEvents` falls to it when no live GrammarRules is loaded, in place of a second hand-kept list
// that could silently drift from the tiddlers. See collectEvents below. `pranala` alone stays a SECOND
// reasoned hand-kept exception (below, beside control-*) — see its own comment.
//
// ⚠ THESE control-* PATTERNS STAY HAND-WRITTEN, and that is the point. `frame-parity` reads the
// control codes out of THIS FILE as the independent second recogniser — comparing the spec against
// tiddlers alone reads tautological while one hand writes both. Sourcing them from the shared shore
// would delete the very seam that witness exists to measure. The bearing READ collapsed
// (carrier-head.ts); the bootstrap SCAN did not, by the same ruling that keeps every frame scan local
// (frame-marks.ts). (`sigil-frame-soh.tid` etc. DO carry a `lar-pattern` — a deliberately narrower
// spec-side anchor frame-parity's OWN witness reads; it is not this file's independent recognizer.)
export const BOOTSTRAP_SCANS: SigilScan[] = [
  { sigilName: "control-soh", regex: /<<\^(?:[^>]|>(?!>))*&#x0001;(?:[^>]|>(?!>))*"?\?"?\s*->\s*(?:to=)?"?([^"\s>]+)"?\s*>>/g, eventType: "pragma" },
  { sigilName: "control-stx", regex: /<<\^(?:[^>]|>(?!>))*&#x0002;(?:[^>]|>(?!>))*>>/g,                        eventType: "pragma" },
  { sigilName: "control-etx", regex: /<<\^(?:[^>]|>(?!>))*&#x0003;(?:[^>]|>(?!>))*>>/g,                        eventType: "pragma" },
  { sigilName: "control-eot", regex: /<<\^(?:[^>]|>(?!>))*&#x0004;(?:[^>]|>(?!>))*>>/g,                        eventType: "pragma" },
  // ETB (&#x0017;) — the attestation block's terminator, between ETX and EOT. A cold parse must find
  // it or a carrier that gained a seal loses it on the first write-back, silently, because nothing
  // on the read path ever saw what went missing.
  { sigilName: "control-etb", regex: /<<\^(?:[^>]|>(?!>))*&#x0017;(?:[^>]|>(?!>))*>>/g,                        eventType: "pragma" },
  // Kapu extended range — DC1 (&#x0011;) SOH variant, DC4 (&#x0014;) EOT variant
  { sigilName: "control-soh", regex: /<<\^(?:[^>]|>(?!>))*&#x0011;(?:[^>]|>(?!>))*"?\?"?\s*->\s*(?:to=)?"?([^"\s>]+)"?\s*>>/g, eventType: "pragma" },
  { sigilName: "control-eot", regex: /<<\^(?:[^>]|>(?!>))*&#x0014;(?:[^>]|>(?!>))*>>/g,                        eventType: "pragma" },
  // pranala stays a reasoned SECOND hand-kept exception, discovered while wiring this cutover
  // (RED: pranala-attribute-spellings.test.ts). `sigil-pranala.tid`'s own `lar-inline-pattern` /
  // `lar-block-pattern` carry a DIFFERENT capture shape than builder.ts's makeLeaf "pranala" case
  // expects (family/role pre-split into their own groups, vs. one raw tail-attrs string `attrOf`
  // reads) — and the tiddler's own comment says why: "Parsed directly in lar-sigil.ts
  // findNextMatch before compound dispatch fires" — pranala's LIVE-WIKI rendering already bypasses
  // the generic tiddler-pattern dispatch, so the tiddler's pattern fields describe the sigil for
  // reference/generation, not the shape a scanner-and-builder contract can cut over to blind. Kept
  // verbatim from the pre-cutover bootstrap (block before inline — block wins at same position).
  { sigilName: "pranala", regex: /<<~\s*pranala\s+(#[\w-]+\s+)?"?((?:[^"\s>]|>(?!>))+)"?\s*->\s*"?((?:[^"\s>]|>(?!>))+)"?((?:\s+[\w-]+\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))*)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs, eventType: "leaf" },
  { sigilName: "pranala", regex: /<<~\s*pranala\s+(#[\w-]+\s+)?"?((?:[^"\s>]|>(?!>))+)"?\s*->\s*"?((?:[^"\s>]|>(?!>))+)"?((?:\s+[\w-]+\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))*)\s*>>/g, eventType: "leaf" },
];

// ---------------------------------------------------------------------------
// buildScansFromGrammar — hydrate grammar-meme sigil rules into SigilScan[]
// ---------------------------------------------------------------------------

function safeRegex(src: string, flags: string): RegExp | null {
  try { return new RegExp(src, flags); } catch { return null; }
}

export function buildScansFromGrammar(sigils: SigilRule[]): SigilScan[] {
  const scans: SigilScan[] = [];
  for (const s of sigils) {
    const extra = s.aliasFor ? { canonicalName: s.aliasFor } : {};
    if (s.openPattern)   { const rx = safeRegex(s.openPattern,   "g");  if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "open"   }); }
    if (s.closePattern)  { const rx = safeRegex(s.closePattern,  "g");  if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "close"  }); }
    if (s.pragmaPattern) { const rx = safeRegex(s.pragmaPattern, "g");  if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "pragma" }); }
    if (s.blockPattern)  { const rx = safeRegex(s.blockPattern,  "gs"); if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "leaf"   }); }
    if (s.inlinePattern) { const rx = safeRegex(s.inlinePattern, "g");  if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "leaf"   }); }
    if (s.pattern && !s.openPattern && !s.blockPattern && !s.inlinePattern) {
      const flags = s.name === "pranala" ? "gs" : "g";
      const rx = safeRegex(s.pattern, flags);
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "leaf" });
    }
  }
  // GENERIC catch-all — appended LAST so every specific grammar scan claims its position first (the same
  // partial-rung the bootstrap carries, now in grammar-mode too: an unmatched sharktooth grades `missing`
  // in the FULL-grammar in-VM parse, not only bootstrap).
  scans.push({ sigilName: "(generic)", generic: true, regex: /<<~\s*(\\?[A-Za-z][\w-]*)((?:[^>]|>(?!>))*?)\s*>>/g, eventType: "leaf" });
  // Control scans must win at identical positions even in grammar-hydrated mode
  return scans.sort((a, b) => (a.sigilName.startsWith("control-") ? 0 : 1) - (b.sigilName.startsWith("control-") ? 0 : 1));
}

// ---------------------------------------------------------------------------
// collectEvents — scan text + inline alias erasure in one pass
// ---------------------------------------------------------------------------

export function collectEvents(text: string, grammar?: GrammarRules): ParseEvent[] {
  // The control-* frame scans (BOOTSTRAP_SCANS) ride ahead unconditionally — hand-written, never
  // tiddler-derived (see the comment above BOOTSTRAP_SCANS). Every other sigil comes from the live
  // GrammarRules when one loaded, else from GENERATED_SIGILS — the tiddler-derived table — rather
  // than a second hand-kept list that could drift from the tiddlers unnoticed.
  const scans = [...BOOTSTRAP_SCANS, ...buildScansFromGrammar(grammar ? grammar.sigils : GENERATED_SIGILS)];

  // ── A FENCED SIGIL TEACHES; IT DECLARES AND FIRES NOTHING ──────────────────────────────────────
  // Every scan below reads through the quoted-code mask, computed ONCE for the carrier. A grammar
  // spec shows the sigils it names, and an unmasked scan compiles the lesson: measured over the 718
  // declared carriers, 739 of 15,666 events stood inside a quoted span across 122 carriers — 34
  // `ahu` openers and 23 closers among them, opening scopes no author wrote, plus 19 SOH / 11 ETX
  // control pragmas the framing never meant. The render side already rules that a fenced sigil calls
  // nothing; the compile side gives the same answer, from the same module, so the two cannot drift.
  //
  // `allowSpanStart` — a scan whose TARGET is a fence. The meta block spells itself ```toml, so a
  // mask that refused every span erased 840 of the corpus's 852 meta reads. A match landing exactly
  // on a span's opening character stands; one in the interior — a ````-quoted ```toml example — does
  // not. No `<<~` form can begin at a span opener, so the admission reaches the fence scans alone.
  const mask = fencedSpans(text);

  // Pranala block spans: inline events inside a pranala block body are excluded
  const blockSpans: [number, number][] = [];
  for (const m of maskedExecAll(text, /<<~\s*pranala\s+(#[\w-]+\s+)?"?((?:[^"\s>]|>(?!>))+)"?\s*->\s*"?((?:[^"\s>]|>(?!>))+)"?((?:\s+[\w-]+\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))*)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs, mask, true)) {
    blockSpans.push([m.index!, m.index! + m[0].length]);
  }
  const inBlock = (pos: number): boolean => blockSpans.some(([s, e]) => pos >= s && pos < e);

  // Hana body spans: a hana body carries a FOREIGN grammar (guest-grammar.mem #/hana-worksite), not
  // TW5 wikitext, parsed by a registered guest interpreter — so a `<<~ …>>` an author writes INSIDE
  // that body must stay opaque to the scanner, the same worksite exclusion pranala's block body gets
  // just above. `\task` is hana's English alias and shares the same worksite shape.
  //
  // Unlike pranala's whole-match blockSpans (leaf/pragma only, below), this excludes EVERY event
  // type INCLUDING open/close — a guest payload can carry `<<~ ahu #/x>>`-shaped text, and an ahu
  // open/close pair must not fire as a real child inside a foreign grammar. The span covers the
  // BODY ONLY (between the opener's `>>` and the closer's `<<~/`), never the block's own opener or
  // closer positions, so the hana/task sigil's own open and close events still scan normally.
  const hanaBodySpans: [number, number][] = [];
  const HANA_OPEN_RE  = /^<<~\s*(?:hana|task)\s+[^\n>]+?\s*>>/;
  const HANA_CLOSE_RE = /<<~\/(?:hana|task)\s*>>$/;
  for (const m of maskedExecAll(text, /<<~\s*(?:hana|task)\s+[^\n>]+?\s*>>[\s\S]*?<<~\/(?:hana|task)\s*>>/g, mask, true)) {
    const openMatch  = HANA_OPEN_RE.exec(m[0]);
    const closeMatch = HANA_CLOSE_RE.exec(m[0]);
    if (!openMatch || !closeMatch) continue;
    const bodyStart = m.index! + openMatch[0].length;
    const bodyEnd   = m.index! + m[0].length - closeMatch[0].length;
    if (bodyStart < bodyEnd) hanaBodySpans.push([bodyStart, bodyEnd]);
  }
  const inHanaBody = (pos: number): boolean => hanaBodySpans.some(([s, e]) => pos >= s && pos < e);

  const seen   = new Set<number>();
  const events: ParseEvent[] = [];

  for (const scan of scans) {
    const rx       = new RegExp(scan.regex.source, scan.regex.flags.includes("s") ? "gs" : "g");
    const emitName = scan.canonicalName ?? scan.sigilName;
    for (const m of maskedExecAll(text, rx, mask, true)) {
      const pos = m.index!;
      if (seen.has(pos)) continue;
      if (inHanaBody(pos)) continue;
      if (scan.eventType !== "open" && scan.eventType !== "close" && inBlock(pos)) continue;
      seen.add(pos);
      // The generic catch-all emits the MATCHED sigil-name (group 1), flagged so the builder grades it
      // `missing` (the partial rung); specific scans emit their fixed (alias-erased) name.
      const name = scan.generic ? (m[1] ?? emitName) : emitName;
      const evt: ParseEvent = { pos, end: pos + m[0].length, raw: m[0], sigilName: name, eventType: scan.eventType, groups: [...m] };
      if (scan.generic) evt.generic = true;
      events.push(evt);
    }
  }

  return events.sort((a, b) => a.pos - b.pos || a.end - b.end);
}
