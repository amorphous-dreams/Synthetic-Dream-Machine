/**
 * TiddlyWiki Filter Notation — guest grammar for Lararium carrier queries.
 *
 * Syntax subset (TW5-compatible):
 *
 *   filter := step+
 *   step   := '[' operator ']'
 *            | '[' operator '[' operand ']' ']'
 *   operator := 'all' | 'tag' | 'implements' | 'depth' | 'rating' | 'sort'
 *              | 'limit' | 'entry' | 'uri' | 'not' | 'field:' fieldname
 *
 * Example expressions (TW5-style):
 *
 *   [all[memes]]                     → all closure entries
 *   [all[memes]tag[lar:///pono/meme]]→ filter by implements URI
 *   [all[memes]sort[depth]limit[10]] → first 10 by depth
 *   [entry[]]                        → just the boot entry point (AGENTS)
 *   [all[memes]rating[data]]         → memes with kind === "data"
 *   [all[memes]depth[0]]             → only depth-0 memes
 *   [all[memes]uri[LARES]]           → memes whose URI contains "LARES"
 *
 * The guest grammar intentionally covers Lararium's needs without importing
 * TiddlyWiki's runtime. The operator set grows as UI needs grow.
 */

import { type ClosureEntry } from "./compiler.js";

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

export type FilterOperator =
  | { op: "all"; operand: string }
  | { op: "tag"; operand: string }
  | { op: "implements"; operand: string }
  | { op: "depth"; operand: number }
  | { op: "rating"; operand: string }
  | { op: "sort"; operand: "depth" | "uri" | "name" | "rating" }
  | { op: "limit"; operand: number }
  | { op: "entry" }
  | { op: "uri"; operand: string }
  | { op: "not"; inner: FilterExpression };

export type FilterExpression = FilterOperator[];

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a TW-style filter expression string into a FilterExpression.
 *
 * Grammar (TW run model):
 *   filter  := run+
 *   run     := '[' step+ ']'
 *   step    := opname | opname '[' operand ']'
 *   opname  := /[a-zA-Z_:][a-zA-Z0-9_:-]+/
 *
 * A "run" wraps one or more steps. Multiple runs are flattened into the
 * same FilterExpression (they execute in sequence on the same working set).
 *
 * Examples:
 *   "[all[memes]sort[depth]limit[3]]"   → 3 steps in one run
 *   "[all[memes]] [sort[depth]]"         → same (two runs, flattened)
 *   "[entry[]]"                          → entry step
 *   "[all[memes]tag[lar:///pono/meme]]"  → all then tag-filter
 */
export function parseFilter(expr: string): FilterExpression {
  const steps: FilterOperator[] = [];
  let i = 0;
  const src = expr.trim();

  while (i < src.length) {
    // skip whitespace between runs
    while (i < src.length && /\s/.test(src[i]!)) i++;
    if (i >= src.length) break;

    if (src[i] !== "[") throw new SyntaxError(`filter: expected '[' at position ${i}, got '${src[i]}'`);
    i++; // consume run-open '['

    // Parse steps until the run-closing ']'
    while (i < src.length && src[i] !== "]") {
      // skip whitespace within run
      while (i < src.length && /\s/.test(src[i]!)) i++;
      if (src[i] === "]") break;

      // read opname
      let opName = "";
      while (i < src.length && src[i] !== "[" && src[i] !== "]" && !/\s/.test(src[i]!)) {
        opName += src[i++];
      }
      opName = opName.trim();
      if (!opName) throw new SyntaxError(`filter: empty operator name at position ${i}`);

      // optional inner [operand]
      let operand: string | null = null;
      if (i < src.length && src[i] === "[") {
        i++; // consume inner '['
        let arg = "";
        while (i < src.length && src[i] !== "]") arg += src[i++];
        if (src[i] !== "]") throw new SyntaxError(`filter: unclosed inner '[' for operator '${opName}'`);
        i++; // consume inner ']'
        operand = arg;
      }

      steps.push(buildStep(opName, operand));
    }

    if (src[i] !== "]") throw new SyntaxError(`filter: unclosed run '[' (missing closing ']')`);
    i++; // consume run-close ']'
  }

  return steps;
}

function buildStep(opName: string, operand: string | null): FilterOperator {
  switch (opName) {
    case "all":
      return { op: "all", operand: operand ?? "memes" };
    case "tag":
    case "implements":
      if (!operand) throw new SyntaxError(`filter: [${opName}] requires an operand`);
      return { op: "implements", operand };
    case "depth":
      if (operand === null) throw new SyntaxError("filter: [depth] requires a number operand");
      return { op: "depth", operand: parseInt(operand, 10) };
    case "rating":
      if (!operand) throw new SyntaxError("filter: [rating] requires an operand");
      return { op: "rating", operand };
    case "sort":
      if (!operand) throw new SyntaxError("filter: [sort] requires a field name");
      if (!["depth", "uri", "name", "rating"].includes(operand))
        throw new SyntaxError(`filter: [sort[${operand}]] — unknown sort field`);
      return { op: "sort", operand: operand as "depth" | "uri" | "name" | "rating" };
    case "limit":
      if (operand === null) throw new SyntaxError("filter: [limit] requires a number operand");
      return { op: "limit", operand: parseInt(operand, 10) };
    case "entry":
      return { op: "entry" };
    case "uri":
      if (!operand) throw new SyntaxError("filter: [uri] requires an operand");
      return { op: "uri", operand };
    default:
      throw new SyntaxError(`filter: unknown operator '${opName}'`);
  }
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * Apply a parsed FilterExpression to an array of ClosureEntry objects.
 * Returns a new array (original is not mutated).
 *
 * Steps execute left-to-right; each step filters or transforms the working set.
 * `all[memes]` seeds the working set from the provided entries array.
 * Without an `all[]` step, the working set starts empty.
 */
export function applyFilter(
  allEntries: readonly ClosureEntry[],
  expr: FilterExpression,
): ClosureEntry[] {
  let result: ClosureEntry[] = [];

  for (const step of expr) {
    switch (step.op) {
      case "all":
        result = [...allEntries];
        break;
      case "implements":
        result = result.filter((e) => e.implements.some((u) => u.includes(step.operand)));
        break;
      case "depth":
        result = result.filter((e) => e.depth === step.operand);
        break;
      case "rating":
        result = result.filter((e) => e.kind === step.operand || e.kind.includes(step.operand));
        break;
      case "sort":
        result = [...result].sort((a, b) => {
          if (step.operand === "depth") return a.depth - b.depth;
          if (step.operand === "uri")   return a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0;
          if (step.operand === "rating") return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
          return a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0; // "name" fallback
        });
        break;
      case "limit":
        result = result.slice(0, step.operand);
        break;
      case "entry":
        result = allEntries.filter((e) => e.depth === 0);
        break;
      case "uri":
        result = result.filter((e) => e.uri.includes(step.operand));
        break;
      case "not":
        // not[] excludes entries that match the inner expression
        {
          const excluded = new Set(applyFilter(allEntries, step.inner).map((e) => e.uri));
          result = result.filter((e) => !excluded.has(e.uri));
        }
        break;
    }
  }

  return result;
}

/**
 * Convenience: parse and apply in one call.
 */
export function filterEntries(
  allEntries: readonly ClosureEntry[],
  expr: string,
): ClosureEntry[] {
  return applyFilter(allEntries, parseFilter(expr));
}
