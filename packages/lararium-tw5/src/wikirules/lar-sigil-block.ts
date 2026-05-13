/**
 * lar-sigil-block — TW5 wikirule (block-mode) for `<<~ ahu ... >>` blocks
 * and any other `<<~ sigil ... >>...<<~/sigil >>` block-form sigil.
 *
 * Slot-bearing ahu blocks parse to `{ type: "ahu" }` widget nodes (cascade
 * picks the render template). All other recognized block sigils parse to
 * `{ type: "text" }` carrying the raw source slice — literal-survival keeps
 * disk round-trip working until each sigil ports to its own template.
 *
 * Module-type: wikirule. TW5's standard plugin loader registers this via
 * `WikiParser.createClassesFromModules`, classifying by `types: { block: true }`.
 */

import { getGrammar } from "../grammar-cache.js";
import {
  ParseTreeNode,
  WikiParser,
  RuleInstance,
  AHU_CLOSE_TAG,
  matchAhuOpenAt,
  matchPranalaOpenAt,
  findCloseEnd,
  findGenericOpenAt,
  buildClosers,
  attrsForAhu,
  attrToTree,
} from "./lar-sigil-shared.js";

export const name  = "lar-sigil-block";
export const types = { block: true };

export function init(this: RuleInstance, parser: WikiParser): void {
  this.parser = parser;
}

export function findNextMatch(this: RuleInstance, startPos: number): number | undefined {
  const source  = this.parser!.source;
  const closers = buildClosers(getGrammar());
  let pos = source.indexOf("<<~", startPos);
  while (pos >= 0) {
    const ahu = matchAhuOpenAt(source, pos);
    if (ahu) {
      const closeEnd = findCloseEnd(source, "ahu", ahu.end);
      if (closeEnd !== null) {
        this.matchPos = pos;
        this.matchEnd = closeEnd;
        this.attrs    = attrsForAhu(ahu);
        const closeTagStart = source.lastIndexOf(AHU_CLOSE_TAG, closeEnd);
        this.attrs["__body__"] = source.slice(ahu.end, closeTagStart);
        return pos;
      }
    }
    // Pranala block form: `<<~ pranala #name? <from> -> <to> >>body<<~/pranala >>`
    // Emit a `pranala` widget node with attributes + body as a text-node child.
    // Templates reconstruct the canonical disk form from attributes + body.
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
    }
    const generic = findGenericOpenAt(source, pos);
    if (generic?.sigil && closers[generic.sigil] && generic.sigil !== "ahu" && generic.sigil !== "pranala") {
      const closeEnd = findCloseEnd(source, generic.sigil, generic.end, closers);
      if (closeEnd !== null) {
        this.matchPos = pos;
        this.matchEnd = closeEnd;
        this.attrs    = { __literal__: source.slice(pos, closeEnd) };
        return pos;
      }
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
    return [{
      type:       "pranala",
      attributes: attrToTree(attrs),
      children:   body ? [{ type: "text", text: body }] : [],
    }];
  }

  const body = attrs["__body__"] ?? "";
  delete attrs["__body__"];
  return [{
    type:       "ahu",
    attributes: attrToTree(attrs),
    children:   body ? [{ type: "text", text: body }] : [],
  }];
}
