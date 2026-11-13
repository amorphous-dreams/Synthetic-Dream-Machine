/**
 * ward-ask-words — the words and kinds of one ward ask, clear of every module that holds a key, so the page's main thread may load
 * them (`@lararium/browser/page`) while the vessel worker's ward door re-exports the same pair.
 */

/**
 * THE KIND OF ONE WARD ASK: `open` reads a ward that stands, `bind` binds a fresh ward over the route typed for it, and `retype`
 * asks that route once more, so a bind lands only over a route typed twice alike (a ward bound over a typo opens for nobody).
 */
export type WardAskKind = "open" | "bind" | "retype";

/** The words a ward dialog shows for one ask: a bind names a bind, an open names an open. */
export function wardAskWords(act: string, kind: WardAskKind): string {
  if (kind === "bind") return `This act will bind a passphrase for this face's ward: ${act}. Type the passphrase every later act of this face asks for.`;
  if (kind === "retype") return `Type the same passphrase again, so the ward binds only over the one you meant: ${act}.`;
  return `Type this face's passphrase to open its ward for one act: ${act}. It opens for this act alone.`;
}
