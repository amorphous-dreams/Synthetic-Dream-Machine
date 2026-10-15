/**
 * meta-fence — the ONE opener every reader of a `toml meta` block reads.
 *
 * ── WHY ONE ─────────────────────────────────────────────────────────────────────────────────────
 * A meta opener has four independent surfaces: the separator between `toml` and `meta`, trailing
 * whitespace, line anchoring, and the fence close. Every reader reaches this one recognition rule,
 * so a carrier with admitted whitespace keeps one reading across deserialization and shape checks.
 *
 * ── RECOGNITION IS PERMISSIVE · CANON IS STRICT · DEVIATION IS LOUD ─────────────────────────────
 * A reader ADMITS `[ \t]+` between `toml` and `meta` and `[ \t]*` after it. Strictness here would be
 * the worse fault: a carrier spelled with two spaces would fall out of `carrierFiles` and go
 * invisible to every corpus gate. A loud fault beats a hidden file.
 *
 * The CANON is exactly one space and nothing trailing. `readCarrierShape` faults a deviation so
 * `meme-normalize` has a repair it can name and the gradient has a fact it can report.
 *
 * NEVER `\s`. An opener does not cross a newline: `\s+` before the label makes ```toml\nmeta a
 * match, and `\s*` after it swallows the blank line beneath the opener into the opener itself,
 * shifting every body offset taken from the match.
 *
 * ── WHAT THIS MODULE DOES NOT OWN ───────────────────────────────────────────────────────────────
 * THE CLOSE. `carrier-shape` wants a body string and stops at `\n```; the deserializer wants a span
 * with `start`/`end` offsets and admits ```\n?. Those differ by PURPOSE, not by accident, and
 * byte-exact round-trip rests on the deserializer's. Each caller composes its own close onto the
 * opener source below.
 *
 * THE MASK POLICY. Whether a match riding a span's opening character counts is `allowSpanStart`, a
 * per-call parameter of `maskedExec` — a declaration opens a fence of its own, so its opener sits
 * exactly at a span start, while a ````-quoted example sits in a span's INTERIOR and stays refused.
 * That is a parameter, never a second regex.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

/** The canonical opener line: one space, nothing trailing. What every emitter writes. */
export const META_OPEN_CANON = "```toml meta";

/**
 * The opener a reader ADMITS.
 *
 * Exported WITHOUT `/g`. `maskedExec` clones the pattern and adds the flag itself, and a shared
 * module-level global regex carries `lastIndex` between callers — a stateful bug that reads as an
 * intermittent parse failure. A caller that genuinely needs a global builds one from `.source`.
 */
export const META_OPEN_RE = /```toml[ \t]+meta[ \t]*\n/;

/** The same opener as a WHOLE LINE, for scanners that walk a text line at a time. */
export const META_OPEN_LINE_RE = /^```toml[ \t]+meta[ \t]*$/;

/**
 * An UNLABELLED ```toml fence. Operator CONTENT — teaching matter, config examples — and never slot
 * identity. Swallowing one into fields mutated content on round-trip, so only a labelled fence names
 * a slot and this pattern exists to be refused by default.
 */
export const PLAIN_OPEN_RE = /```toml[ \t]*\n/;

/** Whether an opener line stands in canon. False for an admitted-but-deviant spelling. */
export function isCanonicalMetaOpen(line: string): boolean {
  return line === META_OPEN_CANON;
}
