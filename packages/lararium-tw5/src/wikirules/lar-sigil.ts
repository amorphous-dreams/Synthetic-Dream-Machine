/*\
title: lar:///ha.ka.ba/lararium/tw5/wikirules/lar-sigil
type: application/javascript
module-type: wikirule
\*/
/**
 * lar-sigil — unified TW5 wikirule (block + inline) for all `<<~ …>>` sigil
 * forms. Block forms (container ahu, container pranala, generic-with-closer)
 * are claimed at block parse phase. Leaf inline forms (aka, kahea, loulou,
 * pranala-inline, ahu/kau invocation) are claimed at inline phase.
 *
 * Dispatch model:
 *   All compound + simple sigils → ~ dispatcher (name=SIGIL, p1=ARGS)
 *   pranala block/inline         → ~pranala directly (keyword args: from/to/slot/…)
 *   generic block-with-closer    → text literal pass-through
 *
 * Child-slot detection (ahu, kau, future) uses grammarChildSlotNames() —
 * no sigil names hardcoded here beyond what the grammar registry supplies.
 */

import { getGrammar } from "../grammar-cache.js";
import { positionalsOf, readSigilAttrs } from "../sigil-attrs.js";
import { grammarHeadsOf } from "../grammar-heads.js";
import type { SigilAttr } from "../sigil-attrs.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { severityOfRung } from "../meme-ast/diagnostics.js";
import type { RecoveryRung } from "../meme-ast/diagnostics.js";
import {
  ParseTreeNode,
  ParseTreeAttribute,
  WikiParser,
  RuleInstance,
  matchCompoundSigilAt,
  indexOfSigilOpen,
  grammarChildSlotNames,
  matchPranalaOpenAt,
  findCloseEnd,
  findGenericOpenAt,
  buildClosers,
  grammarInlineSigils,
  attrToTree,
} from "./lar-sigil-shared.js";

export const name  = "lar-sigil";
export const types = { block: true, inline: true };

export function init(this: RuleInstance, parser: WikiParser): void {
  this.parser = parser;
}

// TW5's evalGlobal injects `$tw` as a direct parameter into module code; in the Node VM sandbox
// globalThis is the empty context, so the injected variable is the only reachable spelling.
declare const $tw: {
  utils?: { parseMacroInvocationAsTransclusion?: (source: string, pos: number) => ParseTreeNode | null };
} | undefined;

/**
 * One sigil parameter as the parse tree carries it.
 *
 * ── ALL FIVE VALUE KINDS ARRIVE AS THEMSELVES ───────────────────────────────────────────────────
 * A `macro` value — `name=<<something>>` — needs a PARSE, not a copy. Handing over its source text
 * cost more than the flattening it looked like: measured against the vendored core,
 * `<<nprobe alpha=<<greeting>> >>` renders `N=Aloha`, while the sigil form rendered
 * `A=&lt;&lt;greeting` and spilled the leftover `>>` into the page.
 *
 * The node comes from core's OWN `parseMacroInvocationAsTransclusion`, so the shape stays the
 * parser's to define and cannot drift from what every other call site receives. Where that reader is
 * out of reach — a parse driven outside the VM — or where it declines the text, the value falls back
 * to its string, because a parse must not break badly (#/graceful-parsing).
 */
function attrNodeOf(a: SigilAttr): ParseTreeAttribute {
  switch (a.kind) {
    case "indirect":    return { type: "indirect",    textReference: a.value.replace(/^\{\{|\}\}$/g, "") };
    case "filtered":    return { type: "filtered",    filter: a.value.replace(/^\{\{\{|\}\}\}$/g, "") };
    case "substituted": return { type: "substituted", rawValue: a.value.replace(/^`|`$/g, "") };
    case "macro": {
      const parse = typeof $tw !== "undefined" ? $tw?.utils?.parseMacroInvocationAsTransclusion : undefined;
      const node  = parse ? parse(a.value, 0) : null;
      return node ? { type: "macro", value: node } : { type: "string", value: a.value };
    }
    default:            return { type: "string",      value: a.value };
  }
}

export function findNextMatch(this: RuleInstance, startPos: number): number | undefined {
  const source         = this.parser!.source;
  const grammar        = getGrammar();
  const closers        = buildClosers(grammar);
  const inlineSigils   = grammarInlineSigils(grammar);
  const childSlotNames = grammarChildSlotNames(grammar);
  // THE ONE DOOR — which heads the shelf registers, off the grammar the cache already holds.
  const registeredHeads = grammarHeadsOf(grammar);
  let pos = indexOfSigilOpen(source, startPos);
  while (pos >= 0) {
    // pranala: permanent JS exception — <<~ pranala FROM -> TO>> arrow syntax with
    // keyword attrs (from/to/slot/family/role/body) is structurally distinct from
    // <<~ WORD ARGS>>. The ~ dispatcher's p1–p5 positional interface cannot carry
    // named keyword pairs without losing the readable HUD form.
    const pranala = matchPranalaOpenAt(source, pos);
    if (pranala) {
      const closeEnd = findCloseEnd(source, "pranala", pranala.end);
      if (closeEnd !== null) {
        const closeTagStart = source.lastIndexOf("<<~/pranala", closeEnd);
        const body = source.slice(pranala.end, closeTagStart);
        this.matchPos = pos;
        this.matchEnd = closeEnd;
        this.attrs    = {
          __pranala_block__: "true",
          ...(pranala.slot ? { slot: pranala.slot } : {}),
          from: pranala.from,
          to:   pranala.to,
          body,
          ...pranala.attrs,
        };
        return pos;
      }
      this.matchPos = pos;
      this.matchEnd = pranala.end;
      this.attrs    = {
        __sigil__: "pranala",
        ...(pranala.slot ? { slot: pranala.slot } : {}),
        from: pranala.from,
        to:   pranala.to,
        ...pranala.attrs,
      };
      return pos;
    }

    // Compound sigil: <<~ WORD1 [child-slot WORD2] ARGS>>
    // Handles: <<~ kahea ahu #slot>>, <<~ ahu #slot>>…<<~/ahu>>,
    //          <<~ kahea lar:///uri>>, <<~ loulou lar:///uri>>, <<~ kau …>>
    const compound = matchCompoundSigilAt(source, pos, childSlotNames);
    if (compound) {
      // ── A DECLARED CLOSER CLOSES ────────────────────────────────────────────────────────────────
      // The matcher reports the STRUCTURAL close key — a child slot or a compound head — because
      // those it can read off the call's own shape. Every OTHER block sigil declares its closer on
      // the shelf, and `buildClosers` has already merged all of them into the map one line above.
      // Reading `closeKey` alone attempted a body capture on three sigils out of thirty-one; the
      // registry answers for the rest, and the matcher keeps its own narrow contract.
      const closeKey = compound.closeKey ?? (closers[compound.name] ? compound.name : null);
      if (closeKey) {
        const closeEnd = findCloseEnd(source, closeKey, compound.end, closers);
        if (closeEnd !== null) {
          const closeTagStart = source.lastIndexOf(`<<~/${closeKey}`, closeEnd);
          const body = source.slice(compound.end, closeTagStart);
          this.matchPos = pos;
          this.matchEnd = closeEnd;
          this.attrs    = { __compound__: compound.name, __body__: body, p1: compound.p1,
                            __verbatim__: source.slice(pos, compound.end) };
          return pos;
        }
      }
      this.matchPos = pos;
      this.matchEnd = compound.end;
      this.attrs    = { __compound__: compound.name, p1: compound.p1,
                        __verbatim__: source.slice(pos, compound.end) };
      return pos;
    }

    // Generic fallback: covers <<~WORD>> (no-space), control chars (<<^ code="&#x0001;">>),
    // and any form compound did not claim. Well-formed HUD sigils never reach here.
    // pranala guard: matchPranalaOpenAt already claimed pranala forms above; guard
    // prevents a bare <<~ pranala>> (no arrow) from silently becoming a literal block.
    const generic = findGenericOpenAt(source, pos);
    if (generic) {
      // ── THE TIGHT FORM BELONGS TO TIDDLYWIKI ────────────────────────────────────────────────────
      // `<<~name …>>` IS a macrocall to a macro named `~name`, and the host parses it natively. This
      // rule exists for the SPACED form, which the host cannot read at all. Measured in a bare wiki
      // with no plugin: tight-and-defined renders its definition, spaced-and-defined renders nothing.
      //
      // The fallback below still claims a tight call, and rightly — measured in the same bare wiki, a
      // tight call to an UNDEFINED macro VANISHES, text and all, and this house never drops a
      // reader's source. So the two cases part on one fact the grammar now carries: where the shelf
      // REGISTERS the head, the host runs it; where it does not, the floor catches what the host
      // would swallow.
      if (!generic.spaced && generic.sigil && registeredHeads.has(generic.sigil)) return undefined;
      if (generic.sigil && closers[generic.sigil] && generic.sigil !== "pranala") {
        const closeEnd = findCloseEnd(source, generic.sigil, generic.end, closers);
        if (closeEnd !== null) {
          this.matchPos = pos;
          this.matchEnd = closeEnd;
          this.attrs    = { __literal__: source.slice(pos, closeEnd) };
          return pos;
        }
      }
      if (generic.sigil && inlineSigils.has(generic.sigil)) {
        this.matchPos = pos;
        this.matchEnd = generic.end;
        this.attrs    = { __sigil__: generic.sigil };
        return pos;
      }
      // GRADIENT (graceful-parsing): a sharktooth form no specific rule rendered. A sigil REGISTERED in
      // the grammar but not render-matched — the metadata/HUD-frame sigils (lares/confidence/hud/ward/
      // oracle/syad) — renders as PLAIN literal text ("just as it appears" in chat). Only a TRULY unknown
      // form degrades to a graded marker (partial = recognized word/novel shape · water = no word).
      this.matchPos = pos;
      this.matchEnd = generic.end;
      const known = !!generic.sigil && !!grammar?.sigils.some((s) => s.name === generic.sigil);
      this.attrs = known
        ? { __literal__: source.slice(pos, generic.end) }
        : { __literal__: source.slice(pos, generic.end), __degraded__: generic.sigil ? "partial" : "water" };
      return pos;
    }
    pos = indexOfSigilOpen(source, pos + 3);
  }
  return undefined;
}

export function parse(this: RuleInstance): ParseTreeNode[] {
  const parser = this.parser!;
  parser.pos = this.matchEnd!;
  const attrs = { ...(this.attrs ?? {}) };

  if ("__degraded__" in attrs) {
    // The gradient made VISIBLE in the live wiki: a degraded sigil renders as a marked span (partial /
    // water) carrying its verbatim text — never silently dropped, never a crash. Styled via
    // $:/tags/Stylesheet so a pasted-and-saved turn shows its parse grade instead of a silent literal.
    const grade   = attrs["__degraded__"]!;
    const literal = attrs["__literal__"] ?? "";
    const from    = this.matchPos ?? 0;
    const to      = this.matchEnd ?? from + literal.length;
    // The render plane showed the damage while the filter and the gate stayed blind to it, so the rule
    // leaves the same receipt every other recovery leaves: a span nobody has to look at the DOM to find.
    parser.addDiagnostic?.({
      from,
      to,
      severity: severityOfRung(grade as RecoveryRung),
      source:   CARRIER_TYPE,
      code:     `unrecognized-sigil-${grade}`,
      message:  `The sigil form recovered as ${grade}, and its text stands verbatim`,
    });
    return [{
      type: "element",
      tag: "span",
      isRecovered: true,
      attributes: {
        class: { type: "string", value: `lar-sigil-degraded lar-sigil-${grade}` },
        title: { type: "string", value: `memetic-wikitext: ${grade} parse — unrecognized sigil form (verbatim preserved)` },
      },
      children: [{ type: "text", text: literal }],
    } as unknown as ParseTreeNode];
  }
  if ("__literal__" in attrs) {
    return [{ type: "text", text: attrs["__literal__"]! }];
  }

  // Compound sigil: <<~ WORD1 [child-slot WORD2] ARGS>>
  // Live wiki parent tiddlers hold <<~ kahea ahu #slot>> (space form, HUD-readable).
  // Deserializer splits block bodies into child tiddlers before TW5 parses carrier
  // text — block body drops here without data loss.
  if ("__compound__" in attrs) {
    const dispatchName = attrs["__compound__"]!;
    const verbatim     = attrs["__verbatim__"] ?? "";
    delete attrs["__compound__"];
    delete attrs["__body__"];
    delete attrs["__verbatim__"];
    // ── THE NODE THE PARSER ITSELF EMITS ──────────────────────────────────────────────────────────
    // TiddlyWiki parses `<<name …>>` to a TRANSCLUDE carrying `$variable`
    // (`parseMacroInvocationAsTransclusion`). The legacy `macrocall` widget survives, but it reads its
    // name from `parseTreeNode.name` — a node FIELD — or a `$name` attribute:
    //
    //     this.macroName = this.parseTreeNode.name || this.getAttribute("$name")
    //
    // A node carrying `$variable` and a plain `name` ATTRIBUTE satisfies neither, so the widget
    // resolved no macro and rendered NOTHING. Every spaced sigil in this corpus went to the page as
    // the empty string, silently, and no vector asked.
    // ── THE GRADIENT'S FLOOR RIDES AS THE TRANSCLUDE'S OWN FALLBACK ───────────────────────────────
    // TiddlyWiki renders a transclude's CHILDREN where the target resolves to nothing. So a sigil
    // whose procedure this wiki has never seen puts its own text on the page instead of vanishing —
    // the mechanism is the parser's, not a second one bolted beside it.
    // ── AND THE SLOTS ARE FILLED, NOT PROMISED ────────────────────────────────────────────────────
    // The dispatcher declares `p1 … p5` and twenty-nine definitions write against them. Handing the
    // whole argument run to `p1` alone leaves `p2 … p5` empty on every call, so a definition composing
    // two slots renders one raw string and a gap — and reads correct, because the raw string still
    // CONTAINS every word the call was written with. `positionalsOf` splits under TiddlyWiki's own
    // rules: four delimiters stripped, `name=value` pairs stepped over, an unquoted scheme left to the
    // name it binds.
    // ── THE RULE NAMES ITS TARGET ─────────────────────────────────────────────────────────────────
    // TiddlyWiki hands a procedure only the parameters it DECLARES, so a generic forwarder cannot
    // pass `hud=` to a callee whose signature it has never seen — and every named parameter a sigil
    // carried reached nothing. The rule already knows the target at parse time, so it names the
    // target and hands over everything the call carried.
    //
    // The gradient is untouched: a transclude renders its CHILDREN where the target resolves to
    // nothing, which is the very floor the dispatcher stood on. The dispatcher itself stays — it
    // answers INDIRECT dispatch, where a definition hands down a name it was given.
    const run   = attrs["p1"] ?? "";
    const slots = positionalsOf(run);
    const macroAttrs: Record<string, ParseTreeAttribute> = {
      "$variable": { type: "string", value: `~${dispatchName}` },
      "args":      { type: "string", value: run },
      "src":       { type: "string", value: verbatim },
    };
    for (let i = 0; i < 5; i++) macroAttrs[`p${i + 1}`] = { type: "string", value: slots[i] ?? "" };
    // A NAME WINS ITS OWN SLOT. Written last, so a call carrying `args=` or `src=` reaches the
    // definition's own parameter rather than the rule's bookkeeping.
    for (const a of readSigilAttrs(run)) macroAttrs[a.name] = attrNodeOf(a);
    return [{ type: "transclude", attributes: macroAttrs,
      children: [{ type: "text", text: verbatim }] }];
  }

  if ("__pranala_block__" in attrs) {
    delete attrs["__pranala_block__"];
    const body = attrs["body"] ?? "";
    const macroAttrs: Record<string, { type: "string"; value: string }> = {
      "$variable": { type: "string", value: "~pranala" },
      "from":      { type: "string", value: attrs["from"] ?? "" },
      "to":        { type: "string", value: attrs["to"]   ?? "" },
      "body":      { type: "string", value: body },
    };
    if (attrs["slot"])   macroAttrs["slot"]   = { type: "string", value: attrs["slot"]! };
    if (attrs["family"]) macroAttrs["family"] = { type: "string", value: attrs["family"]! };
    if (attrs["role"])   macroAttrs["role"]   = { type: "string", value: attrs["role"]! };
    return [{ type: "transclude", attributes: macroAttrs, children: [] }];
  }

  if ("__sigil__" in attrs) {
    const sigilType = attrs["__sigil__"]!;
    delete attrs["__sigil__"];

    if (sigilType === "pranala") {
      const macroAttrs: Record<string, { type: "string"; value: string }> = {
        "$variable": { type: "string", value: "~pranala" },
        "from":      { type: "string", value: attrs["from"] ?? "" },
        "to":        { type: "string", value: attrs["to"]   ?? "" },
      };
      if (attrs["slot"])   macroAttrs["slot"]   = { type: "string", value: attrs["slot"]! };
      if (attrs["family"]) macroAttrs["family"] = { type: "string", value: attrs["family"]! };
      if (attrs["role"])   macroAttrs["role"]   = { type: "string", value: attrs["role"]! };
      return [{ type: "transclude", attributes: macroAttrs, children: [] }];
    }
    // Grammar-registered inline sigil (edge/edge-sugar from operator tiddlers).
    return [{
      type:       sigilType,
      attributes: attrToTree(attrs),
      children:   [],
    }];
  }

  return [{ type: "text", text: "" }];
}
