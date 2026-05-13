/**
 * lar-sigil-inline — TW5 wikirule (inline-mode) for inline `<<~ ... >>`
 * sigil shapes: ahu invocation form, kahea/aka/loulou/pranala/carrier
 * sentinels/pragmas. Block-form sigils with a recognized closer are
 * deferred to lar-sigil-block.
 *
 * Inline ahu (no closing tag) parses to `{ type: "ahu", invocation: true }`
 * widget node. Everything else parses to `{ type: "text" }` carrying the
 * raw source slice — literal-survival keeps disk round-trip working.
 *
 * Module-type: wikirule. Classified by `types: { inline: true }`.
 */

import { getGrammar } from "../grammar-cache.js";
import {
  ParseTreeNode,
  WikiParser,
  RuleInstance,
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

export const name  = "lar-sigil-inline";
export const types = { inline: true };

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
    const ahu = matchAhuOpenAt(source, pos);
    if (ahu) {
      const closeEnd = findCloseEnd(source, "ahu", ahu.end);
      if (closeEnd === null) {
        this.matchPos = pos;
        this.matchEnd = ahu.end;
        this.attrs    = attrsForAhu(ahu);
        this.attrs["invocation"] = "true";
        return pos;
      }
      pos = source.indexOf("<<~", pos + 3);
      continue;
    }
    // URI-form sigil: <<~ aka|kahea|loulou <uri> >> — emit a sigil-typed
    // widget node so the cascade can route to a render template. Matches
    // BEFORE the generic-literal fallback so the wikirule produces real
    // widget nodes for this family (instead of literal-survival text).
    const uriForm = matchUriFormSigilAt(source, pos);
    if (uriForm) {
      this.matchPos = pos;
      this.matchEnd = uriForm.end;
      this.attrs    = { __sigil__: uriForm.sigil, uri: uriForm.uri };
      return pos;
    }
    // Pranala-header: <<~ ? -> <uri> >> — this carrier's canonical edge.
    // Emits a `pranala-header` widget node; the widget's html template
    // renders a small breadcrumb anchor.
    const pranalaHeader = matchPranalaHeaderAt(source, pos);
    if (pranalaHeader) {
      this.matchPos = pos;
      this.matchEnd = pranalaHeader.end;
      this.attrs    = { __sigil__: "pranala-header", uri: pranalaHeader.uri };
      return pos;
    }
    // Pranala inline form: <<~ pranala #name? <from> -> <to> family:f? role:r? >>
    // No closing tag — pure inline edge declaration. Block form (with body)
    // is claimed by lar-sigil-block; here we match only when no closer follows.
    const pranala = matchPranalaOpenAt(source, pos);
    if (pranala) {
      const closeEnd = findCloseEnd(source, "pranala", pranala.end);
      if (closeEnd === null) {
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
      // Block form follows — leave to block rule.
      pos = source.indexOf("<<~", pos + 3);
      continue;
    }
    const generic = findGenericOpenAt(source, pos);
    if (generic) {
      if (generic.sigil && closers[generic.sigil]) {
        const blockClose = findCloseEnd(source, generic.sigil, generic.end, closers);
        if (blockClose !== null) {
          pos = source.indexOf("<<~", pos + 3);
          continue;
        }
      }
      // Grammar-registered inline edge sigil — emit a widget node instead of literal.
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

  if ("__sigil__" in attrs) {
    const sigilType = attrs["__sigil__"]!;
    delete attrs["__sigil__"];
    return [{
      type:       sigilType,
      attributes: attrToTree(attrs),
      children:   [],
    }];
  }

  return [{
    type:       "ahu",
    attributes: attrToTree(attrs),
    children:   [],
  }];
}
