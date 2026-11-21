/**
 * kahua-shadow-title — where a shadow stamp sits in the temp plane. A leaf with no imports, so the
 * `kahua-shadow` filter operator packs into the plugin without the mesh barrel's WASM.
 */

/** The temp-plane prefix of a shadow stamp; the stamp for a title sits at `<prefix><title>`. */
export const KAHUA_SHADOW_PREFIX = "$:/temp/lares/kahua-shadow/";

/** The title of the stamp that marks `title` as shadowing a kahua record. */
export function kahuaShadowTitle(title: string): string {
  return `${KAHUA_SHADOW_PREFIX}${title}`;
}
