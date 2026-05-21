/**
 * tiddler-text — read the `text` field from any LarTiddlerRecord-shaped object.
 *
 * Oracle tiddlers carry their payload in `tiddler.text`. This helper
 * centralises that read so call sites stay one token instead of an inline
 * typeof guard.
 *
 * Meme: lar:///ha.ka.ba/@lararium/mesh/v0.1/tiddler-text
 */

export function tiddlerText(record: { tiddler: { text?: unknown } } | null | undefined): string | null {
  const t = record?.tiddler.text;
  return typeof t === "string" ? t : null;
}
