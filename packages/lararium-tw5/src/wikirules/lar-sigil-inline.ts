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

import {
  ParseTreeNode,
  WikiParser,
  RuleInstance,
  BLOCK_CLOSERS,
  matchAhuOpenAt,
  findCloseEnd,
  findGenericOpenAt,
  attrsForAhu,
  attrToTree,
} from "./lar-sigil-shared.js";

export const name  = "lar-sigil-inline";
export const types = { inline: true };

export function init(this: RuleInstance, parser: WikiParser): void {
  this.parser = parser;
}

export function findNextMatch(this: RuleInstance, startPos: number): number | undefined {
  const source = this.parser!.source;
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
    const generic = findGenericOpenAt(source, pos);
    if (generic) {
      if (generic.sigil && BLOCK_CLOSERS[generic.sigil]) {
        const blockClose = findCloseEnd(source, generic.sigil, generic.end);
        if (blockClose !== null) {
          pos = source.indexOf("<<~", pos + 3);
          continue;
        }
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

  return [{
    type:       "ahu",
    attributes: attrToTree(attrs),
    children:   [],
  }];
}
