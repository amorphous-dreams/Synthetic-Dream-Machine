/**
 * meta-fence — the ONE opener every reader of a `toml meta` block reads.
 *
 * ── WHY ONE ─────────────────────────────────────────────────────────────────────────────────────
 * The opener was spelled seven ways across the tree and the spellings differed on four axes: the
 * separator between `toml` and `meta`, what may trail the label, whether the line is anchored, and
 * how the fence closes. Five readers demanded exactly one space; the deserializer admitted one or
 * more spaces or tabs. A carrier written with two spaces therefore DESERIALIZED WITH ITS FIELDS and
 * read `meta:false` to the shape reader — `shelf` where a head stood, `unframed` where none did. One
 * file, two identities, and the gradient that exists to surface such a split produced it instead.
 *
 * ── RECOGNITION IS PERMISSIVE · CANON IS STRICT · DEVIATION IS LOUD ─────────────────────────────
 * A reader ADMITS `[ \t]+` between `toml` and `meta` and `[ \t]*` after it. Strictness here would be
 * the worse fault: a carrier spelled with two spaces would fall out of `carrierFiles` and go
 * invisible to every corpus gate at once, which is exactly how seventeen carriers once sat outside
 * all of them. A loud fault beats a hidden file.
 *
 * The CANON is exactly one space and nothing trailing — how every emitter writes it and how 733 of
 * 733 openers in the corpus stand. `readCarrierShape` faults a deviation so `meme-normalize` has
 * something to repair and the gradient has something to report.
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
