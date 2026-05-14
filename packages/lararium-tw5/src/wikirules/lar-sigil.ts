/*\
title: lar:///ha.ka.ba/@lararium/tw5/wikirules/lar-sigil
type: application/javascript
module-type: wikirule
\*/
/**
 * lar-sigil — unified TW5 wikirule (block + inline) for all `<<~ … >>` sigil
 * forms. Block forms (container ahu, container pranala, generic-with-closer)
 * are claimed at block parse phase. Leaf inline forms (aka, kahea, loulou,
 * pranala-header, pranala-inline, ahu invocation) are claimed at inline phase.
 *
 * Replaces lar-sigil-block.ts + lar-sigil-inline.ts.
 */

import { getGrammar } from "../grammar-cache.js";
import {
  ParseTreeNode,
  WikiParser,
  RuleInstance,
  AHU_CLOSE_TAG,
  matchAhuOpenAt,
  matchUriFormSigilAt,
  matchPranalaHeaderAt,
  matchPranalaOpenAt,
  findCloseEnd,
  findGenericOpenAt,
  buildClosers,
  grammarInlineSigils,
  attrsForAhu,
  attrToTree,
} from "./lar-sigil-shared.js";

export const name  = "lar-sigil";
export const types = { block: true, inline: true };

export function init(this: RuleInstance, parser: WikiParser): void {
  this.parser = parser;
}

export function findNextMatch(this: RuleInstance, startPos: number): number | undefined {
  const source      = this.parser!.source;
  const grammar     = getGrammar();
  const closers     = buildClosers(grammar);
  const inlineSigils = grammarInlineSigils(grammar);
  let pos = source.indexOf("<<~", startPos);
  while (pos >= 0) {
    // ahu: block form if closer follows; invocation form (inline) otherwise.
    const ahu = matchAhuOpenAt(source, pos);
    if (ahu) {
      const closeEnd = findCloseEnd(source, "ahu", ahu.end);
      if (closeEnd !== null) {
        // Block: container ahu with body.
        const closeTagStart = source.lastIndexOf(AHU_CLOSE_TAG, closeEnd);
        const body = source.slice(ahu.end, closeTagStart);
        this.matchPos = pos;
        this.matchEnd = closeEnd;
        this.attrs    = { ...attrsForAhu(ahu), __body__: body };
        return pos;
      }
      // Inline: invocation (no closer) — emit ahu widget node.
      this.matchPos = pos;
      this.matchEnd = ahu.end;
      this.attrs    = { ...attrsForAhu(ahu), invocation: "true" };
      return pos;
    }

    // URI-form sigils: aka, kahea, loulou — emit macrocall via ~ dispatcher.
    const uriForm = matchUriFormSigilAt(source, pos);
    if (uriForm) {
      this.matchPos = pos;
      this.matchEnd = uriForm.end;
      this.attrs    = { __sigil__: uriForm.sigil, uri: uriForm.uri };
      return pos;
    }

    // pranala-header: <<~ ? -> uri >>
    const pranalaHeader = matchPranalaHeaderAt(source, pos);
    if (pranalaHeader) {
      this.matchPos = pos;
      this.matchEnd = pranalaHeader.end;
      this.attrs    = { __sigil__: "pranala-header", uri: pranalaHeader.uri };
      return pos;
    }

    // pranala: block if closer follows; inline edge otherwise.
    const pranala = matchPranalaOpenAt(source, pos);
    if (pranala) {
      const closeEnd = findCloseEnd(source, "pranala", pranala.end);
      if (closeEnd !== null) {
        // Block: container pranala with body.
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
      // Inline edge (no closer).
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

    // Generic: block if a registered closer follows; inline-sigil or literal otherwise.
    const generic = findGenericOpenAt(source, pos);
    if (generic) {
      if (generic.sigil && closers[generic.sigil] && generic.sigil !== "ahu" && generic.sigil !== "pranala") {
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
      this.matchPos = pos;
      this.matchEnd = generic.end;
      this.attrs    = { __literal__: source.slice(pos, generic.end) };
      return pos;
    }
    pos = source.indexOf("<<~", pos + 3);
  }
  return undefined;
}

export function parse(this: RuleInstance): ParseTreeNode[] {
  const parser = this.parser!;
  parser.pos = this.matchEnd!;
  const attrs = { ...(this.attrs ?? {}) };

  if ("__literal__" in attrs) {
    return [{ type: "text", text: attrs["__literal__"]! }];
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
    if (attrs["slot"])   macroAttrs["slot"]   = { type: "string", value: attrs["slot"] };
    if (attrs["family"]) macroAttrs["family"] = { type: "string", value: attrs["family"] };
    if (attrs["role"])   macroAttrs["role"]   = { type: "string", value: attrs["role"] };
    return [{ type: "macrocall", attributes: macroAttrs, children: [] }];
  }

  if ("__sigil__" in attrs) {
    const sigilType = attrs["__sigil__"]!;
    delete attrs["__sigil__"];

    if (sigilType === "aka" || sigilType === "kahea" || sigilType === "loulou") {
      return [{ type: "macrocall", attributes: {
        "$variable": { type: "string" as const, value: "~" },
        "name":      { type: "string" as const, value: sigilType },
        "p1":        { type: "string" as const, value: attrs["uri"] ?? "" },
      }, children: [] }];
    }
    if (sigilType === "pranala-header") {
      return [{ type: "macrocall", attributes: {
        "$variable": { type: "string" as const, value: "~" },
        "name":      { type: "string" as const, value: "pranala-header" },
        "p1":        { type: "string" as const, value: attrs["uri"] ?? "" },
      }, children: [] }];
    }
    if (sigilType === "pranala") {
      const macroAttrs: Record<string, { type: "string"; value: string }> = {
        "$variable": { type: "string", value: "~pranala" },
        "from":      { type: "string", value: attrs["from"] ?? "" },
        "to":        { type: "string", value: attrs["to"]   ?? "" },
      };
      if (attrs["slot"])   macroAttrs["slot"]   = { type: "string", value: attrs["slot"] };
      if (attrs["family"]) macroAttrs["family"] = { type: "string", value: attrs["family"] };
      if (attrs["role"])   macroAttrs["role"]   = { type: "string", value: attrs["role"] };
      return [{ type: "macrocall", attributes: macroAttrs, children: [] }];
    }
    return [{
      type:       sigilType,
      attributes: attrToTree(attrs),
      children:   [],
    }];
  }

  // ahu — block or invocation form.
  const body = attrs["__body__"] ?? "";
  delete attrs["__body__"];
  return [{
    type:       "ahu",
    attributes: attrToTree(attrs),
    children:   body ? [{ type: "text", text: body }] : [],
  }];
}
