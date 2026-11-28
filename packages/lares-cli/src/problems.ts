/**
 * problems — one line per diagnostic, in the shape an editor's problem matcher reads.
 *
 *   path:line:col: severity: code: message
 *
 * `lares meme check format=problems` speaks this shape so a refusal reaches VS Code's Problems panel
 * through a `tasks.json` problem matcher, with no extension in the loop. The line and column count from
 * 1 against the file's own text as it sits on disk (never the normalized text), the column in UTF-16 code
 * units, the unit VS Code's matcher reads. A diagnostic the reader cannot place reports `path:1:1`.
 *
 * SEVERITY FOLLOWS THE GATE. A finding that makes the read-alone seat exit 1 reads `error`; an advisory
 * reading the gate passes (a flag, an unbound head, bare data) reads `warning`; a grammar preference,
 * never a fault, reads `info`.
 *
 * THE FRAME FAULTS CARRY NO OFFSET, so this reader places each by the mark it names: the span reader's
 * own marks (`frameMarks`, `readFrame`), the root meta fence, a duplicated key's second line. A fault
 * whose kind names no single mark (a torn spelling) reports `path:1:1` rather than guess.
 *
 * PYRE LEDGER: KEEP — the problems shape the house's matcher canon reads.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/problems
 */
import {
  fencedSpans, frameMarks, maskedExecAll, readFrame, rootMetaFence, META_OPEN_RE, type FrameFault,
} from "@lararium/memetic-frame";
import { metaKeyRedefinitions } from "@lararium/tw5/root-meta";

export type ProblemSeverity = "error" | "warning" | "info";

/**
 * The matcher's regexp, the one the canon's `tasks.json` sample carries (lar:///ha.ka.ba/lares/cli/problems).
 * The path reads lazily, so a drive letter's colon stays inside it.
 */
export const PROBLEM_LINE_SOURCE = String.raw`^(.+?):(\d+):(\d+): (error|warning|info): ([^:\s]+): (.*)$`;

/** A source offset read as a 1-based line and column against `text`; `null` reads `1:1`. */
export function positionOf(text: string, offset: number | null): { line: number; col: number } {
  if (offset === null || offset < 0) return { line: 1, col: 1 };
  const at = Math.min(offset, text.length);
  let line = 1;
  let start = 0;
  for (let i = text.indexOf("\n"); i !== -1 && i < at; i = text.indexOf("\n", i + 1)) {
    line++;
    start = i + 1;
  }
  return { line, col: at - start + 1 };
}

/** One problems line. The message folds onto a single line, since a matcher reads one line per problem. */
export function problemLine(
  file: string, text: string, offset: number | null, severity: ProblemSeverity, code: string, message: string,
): string {
  const { line, col } = positionOf(text, offset);
  return `${file}:${line}:${col}: ${severity}: ${code}: ${message.replace(/\s*\r?\n\s*/g, " ")}`;
}

/** Where a frame fault stands in `text`, by the mark its kind names; `null` where no one mark answers. */
export function frameFaultOffset(text: string, fault: FrameFault): number | null {
  const spans = fencedSpans(text);
  const marks = frameMarks(text, spans);
  const frame = readFrame(text, spans);
  switch (fault.kind) {
    case "no-etx":          return frame.stx?.index ?? null;
    case "second-stx":      return marks.stx[1]?.index ?? null;
    case "second-soh":      return marks.soh[1]?.index ?? null;
    case "second-etx":      return marks.etx[1]?.index ?? null;
    case "etx-before-stx":  return marks.etx[0]?.index ?? null;
    case "eot-out-of-order": return marks.eot[0]?.index ?? null;
    case "retired-trailer": return frame.etx?.end ?? null;
    case "head-meta-split": return rootMetaFence(text, spans)?.openStart ?? null;
    case "meta-before-stx": {
      const stx = frame.stx?.index ?? text.length;
      return maskedExecAll(text, new RegExp(META_OPEN_RE.source, "g"), spans, true).find((m) => m.index < stx)?.index ?? null;
    }
    default:                return null;
  }
}

/** The block check's own run inside the ETX mark: where a stale seal stands. */
export function bccOffset(text: string): number | null {
  const etx = readFrame(text).etx;
  if (!etx) return null;
  const at = text.indexOf("bcc=", etx.index);
  return at !== -1 && at < etx.end ? at : etx.index;
}

/** The first byte past EOT that is not whitespace: where foreign content begins. */
export function postEotOffset(text: string): number | null {
  const eot = readFrame(text).eot;
  if (!eot) return null;
  const rest = text.slice(eot.end);
  const lead = rest.length - rest.trimStart().length;
  return eot.end + lead;
}

/** The head mark: where an unbound head stands. */
export function headOffset(text: string): number | null {
  return frameMarks(text).soh[0]?.index ?? null;
}

/** Each duplicated meta key's redefining line, in the order `metaKeyRedefinitions` names them. */
export function duplicateKeyOffsets(text: string): number[] {
  return metaKeyRedefinitions(text).map((r) => {
    let at = r.bodyStart;
    for (let n = 1; n < r.line; n++) {
      const nl = text.indexOf("\n", at);
      if (nl === -1) return r.bodyStart;
      at = nl + 1;
    }
    return at;
  });
}
