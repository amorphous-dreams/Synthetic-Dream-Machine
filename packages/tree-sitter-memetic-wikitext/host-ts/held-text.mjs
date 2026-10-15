/**
 * held-text — the text a carrier HOLDS whole, given back byte for byte (the TS twin of
 * `host-py/held_text.py`; the parity gate proves the two hosts read one shape).
 *
 * The holding shape: one ahu whose meta block declares the held text's media type, its body the text
 * fenced by a backtick run longer than any the text carries. The fence is the only escape, and this
 * reader undoes it. A text holding no such ahu reads as itself.
 */

const AHU_OPEN = /^<<~ ahu #\/[\w/-]+>>$/;
const META_OPEN = "```toml meta";
const TYPE_KEY = /^type\s*=\s*"([^"]+)"\s*$/;
const FENCE = /^(`{3,})[ \t]*$/;
const AHU_CLOSE = "<<~/ahu>>";

/** { type, start, end } of the held text in `text` (UTF-16 offsets), or null when nothing is held. */
function find(text) {
  const lines = text.split("\n");
  const offsets = [];
  let o = 0;
  for (const ln of lines) { offsets.push(o); o += ln.length + 1; }
  for (let i = 0; i < lines.length; i++) {
    if (!AHU_OPEN.test(lines[i]) || lines[i + 1] !== META_OPEN) continue;
    let j = i + 2, type = null;
    while (j < lines.length && lines[j] !== "```") {
      const m = TYPE_KEY.exec(lines[j]);
      if (m) type = m[1];
      j++;
    }
    if (type === null || j >= lines.length) continue;
    j++;
    while (j < lines.length && lines[j].trim() === "") j++;
    const opener = j < lines.length ? FENCE.exec(lines[j]) : null;
    if (!opener) continue;
    const run = opener[1].length;
    let k = j + 1;
    while (k < lines.length) {
      const closer = FENCE.exec(lines[k]);
      if (closer && closer[1].length >= run) break;
      k++;
    }
    if (k >= lines.length) continue;
    let after = k + 1;
    while (after < lines.length && lines[after].trim() === "") after++;
    if (after >= lines.length || lines[after] !== AHU_CLOSE) continue;
    return { type, start: offsets[j + 1], end: offsets[k] };
  }
  return null;
}

/** The text a carrier holds, byte for byte; a text holding nothing reads as itself. */
export function held(text) {
  const f = find(text);
  return f === null ? text : text.slice(f.start, f.end);
}

/** The media type the holding ahu declares, or null when the text holds nothing. */
export function heldType(text) {
  const f = find(text);
  return f === null ? null : f.type;
}

/** The bytes a reader folds: the text held in `data`, or `data` itself. */
export function heldBytes(data) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  const inner = held(text);
  return inner === text ? data : new TextEncoder().encode(inner);
}
