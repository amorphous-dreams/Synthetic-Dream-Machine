/**
 * The boot-fault attestation — what a node writes when its boot throws, and how a supervisor reads it back.
 *
 * A supervisor (`lares vessel stand`, `lares herm`) watches the node's boot log for one marker: a line carrying
 * `fatal:` attests a fault, and `vessel-ready` attests a live stand. A fault that writes no `fatal:` line reads
 * to the operator as a STALL, and whatever cure the node wrote never reaches them. So every boot fault leads
 * with exactly one `[lararium] fatal: …` line that names what failed (and its cure, when one exists); detail
 * and the stack follow on lines below it. The writer and the reader live here together so they cannot drift.
 */

/** EX_TEMPFAIL — a serde-skew boot is recoverable, distinct from a generic fatal (1). */
export const SERDE_SKEW_EXIT = 75;

/** The identity-safe cure for stored bytes a dependency bump can no longer deserialize. */
export const SERDE_SKEW_CURE = "lares vessel rite rebuild";

/**
 * Serde-skew detector. A dependency bump (keyhive / automerge / beelay / TW5) can leave the stored genesis
 * engine serialized in a format the new deserializer cannot read; the vessel-host then faults with a Rust
 * deserializer error.
 *
 * Matches the SYMPTOM (the deserializer's error text), never the wrapper: matching any `[vessel-host] fault`
 * or `manifest handler threw` paints every island fault (a slot-sync timeout, say) with the rebuild cure,
 * a wrong cure that costs real diagnosis time.
 */
export function isSerdeSkewFault(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /tag for enum is not valid|failed to deserialize|invalid type:|serde/i.test(msg);
}

function firstLine(text: string): string {
  return (text.split("\n").find((l) => l.trim() !== "") ?? text).trim();
}

/**
 * The lines a node writes to stderr for a boot fault, and the exit code it leaves with.
 * The FIRST line always carries the `fatal:` marker and names the fault in one line.
 */
export function bootFaultReport(err: unknown): { lines: string[]; code: number } {
  const message = err instanceof Error ? err.message : String(err);
  if (isSerdeSkewFault(err)) {
    return {
      code: SERDE_SKEW_EXIT,
      lines: [
        `[lararium] fatal: stored-bytes serde skew — the stored genesis engine no longer deserializes; cure: run \`${SERDE_SKEW_CURE}\` (identity-safe, no data loss)`,
        "[lararium]   Cause: stored bytes predate a dependency bump (keyhive / automerge / beelay / TW5).",
        "[lararium]   The rebuild re-derives the genesis engine under current deps; the operator key and card stay untouched.",
        `[lararium]   underlying: ${message}`,
      ],
    };
  }
  const stack = err instanceof Error && err.stack ? err.stack : null;
  return {
    code: 1,
    lines: [
      `[lararium] fatal: ${firstLine(message) || "boot failed with an empty error"}`,
      ...(stack ? [stack] : []),
    ],
  };
}

/**
 * The FATAL line a booting node attested, trimmed for a one-line report, or null when none stands.
 *
 * A boot fault writes its own diagnosis, and several of them name the exact cure (a sealed archive wanting its
 * passphrase, a serde skew wanting a rebuild). Reporting the log's PATH instead of its verdict discards the one
 * sentence written to be read.
 */
export function fatalLine(attestation: string): string | null {
  const line = attestation.split("\n").reverse().find((l) => /fatal:/.test(l));
  if (!line) return null;
  return line.replace(/^.*?fatal:\s*/, "").replace(/^Error:\s*/, "").split("\n")[0]!.trim().slice(0, 300);
}
