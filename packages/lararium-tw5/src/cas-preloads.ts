/**
 * cas-preloads — the tiddlers a CAS blob lends the engine at boot.
 *
 * The kernel pulls each plugin blob by CID and hands the engine what the bytes carry. This one
 * function shapes those bytes into preload entries, so the kernel and the genesis boot harness read
 * a blob the same way.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/cas-preloads
 */

/**
 * The preload entries one CAS blob carries: a plugin blob holds one tiddler (the plugin, with its own
 * tiddlers packed in its text), and a shadow-seed blob holds an array of tiddlers. TW5's `preloadTiddlers`
 * takes one field map per entry, so the array's members each stand as an entry of their own.
 */
export function preloadsFromCasBlob(bytes: Uint8Array): Record<string, unknown>[] {
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown> | Record<string, unknown>[];
  return Array.isArray(parsed) ? parsed : [parsed];
}
