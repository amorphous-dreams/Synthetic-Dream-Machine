/**
 * diagnostics — the meme-ast recovery record, read onto the core TW5 parse-diagnostics contract.
 *
 * The driver already recovers span-keyed and out-of-band (`ParseFailure`). Core TiddlyWiki now
 * closes over the same shape for any grammar: `{from, to, severity, source, code, message}` with
 * severity drawn from `error | warning | info | hint`, read by `[parse-diagnostics[]]` through the
 * parse cache. Mapping one onto the other lets the wiki, the filter, the render plane and the
 * ingest gate read a single channel rather than three private ones.
 *
 * Pure and isomorphic: no `$tw`, so the gate imports it without dragging the VM in.
 */

import type { ParseFailure } from "./types.js";
import { CARRIER_TYPE as MEMETIC_TYPE } from "@lararium/mesh/carrier-type";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface MemeDiagnostic {
  readonly from:     number;
  readonly to:       number;
  readonly severity: DiagnosticSeverity;
  readonly source:   string;
  readonly code:     string;
  readonly message:  string;
}

export const MEMETIC_SOURCE = MEMETIC_TYPE;

/** Worst severity first, so a grade moves only when the worst class of fault moves. */
const SEVERITY_RANK: Readonly<Record<DiagnosticSeverity, number>> = {
  error:   1,
  warning: 2,
  info:    3,
  hint:    4,
};

/**
 * The ladder, stated once.
 *
 * `error` names the one fault that costs the operator their bytes: a carrier that stops
 * round-tripping no longer says what their hands left, so the shore refuses it rather than
 * ingesting a lossy render. Every recovery sits below that line, because a recovery keeps the
 * text: the driver stands an unplaceable construct back up verbatim in an Error node, and grades
 * how far it fell. `warning` marks a construct the grammar could not place; `info` marks one it
 * repaired at lower standing. Refusing a recovery would drop the bytes to protect the grammar,
 * which inverts what the shore exists to do.
 */
export function severityOf(failure: ParseFailure): DiagnosticSeverity {
  return severityOfRung(failure.recoveredAs);
}

/**
 * A recovery rung. The driver reports `missing`, `water` and `repaired`; the render plane reports
 * `partial` (a word it knows, in a shape it does not). All four keep the text, so all four grade
 * below `error`, on this ladder rather than on a second one beside it.
 */
export type RecoveryRung = ParseFailure["recoveredAs"] | "partial";

/**
 * THE GRACEFUL FLOOR UNDER THE BLOCK LAW. A sigil is a block only when its `>>` ends the line (TW5's
 * own `macrocallblock` split); a line opening on a sigil with text behind it reads as a paragraph
 * holding the sigil inline. Nothing is lost, so the rung is `repaired`, and the code names the act so a
 * wiki lists its exposure with a filter. It grades `warning`, above the `info` a repair usually earns,
 * because the author's block sigil stopped being one.
 */
export const SIGIL_TRAILING_TEXT_CODE = "sigil-trailing-text";

export function severityOfRung(rung: RecoveryRung): DiagnosticSeverity {
  switch (rung) {
    case "missing":  return "warning";
    case "water":    return "warning";
    case "partial":  return "info";
    case "repaired": return "info";
    default:         return "warning";
  }
}

/** The shore's fault: the carrier stopped round-tripping, so ingesting it would lose the bytes. */
export const SHORE_FAULT_CODE = "shore-round-trip";

export function shoreDiagnostic(message: string, sourceLength: number): MemeDiagnostic {
  return {
    from:     0,
    to:       sourceLength,
    severity: "error",
    source:   MEMETIC_SOURCE,
    code:     SHORE_FAULT_CODE,
    message,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

export function failuresToDiagnostics(
  failures: readonly ParseFailure[],
  sourceLength: number,
  source: string = MEMETIC_SOURCE,
): MemeDiagnostic[] {
  return failures.map((failure) => {
    const from = clamp(failure.pos, 0, sourceLength);
    const to   = clamp(failure.pos + failure.raw.length, from, sourceLength);
    if (failure.reason === SIGIL_TRAILING_TEXT_CODE) {
      return {
        from,
        to,
        severity: "warning" as const,
        source,
        code:     SIGIL_TRAILING_TEXT_CODE,
        message:  `Text follows the ${failure.sigilName ?? "sigil"} sigil's >> on its line, so the line reads as a paragraph with the sigil inline; a block sigil ends its line`,
      };
    }
    return {
      from,
      to,
      severity: severityOf(failure),
      source,
      code:     failure.reason,
      message:  failure.sigilName
        ? `The ${failure.sigilName} sigil recovered as ${failure.recoveredAs}: ${failure.reason}`
        : `The parser recovered this span as ${failure.recoveredAs}: ${failure.reason}`,
    };
  });
}

/** The carrier's grade: the worst severity it carries, or `clean` when it carries none. */
export function gradeOf(diagnostics: readonly MemeDiagnostic[]): DiagnosticSeverity | "clean" {
  let worst: DiagnosticSeverity | "clean" = "clean";
  for (const diagnostic of diagnostics) {
    if (worst === "clean" || SEVERITY_RANK[diagnostic.severity] < SEVERITY_RANK[worst]) {
      worst = diagnostic.severity;
    }
  }
  return worst;
}
