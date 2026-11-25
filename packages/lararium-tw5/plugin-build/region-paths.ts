/**
 * region-paths.ts — BUILD LOCATION NEVER MOVES BYTES.
 *
 * The bundler writes one `//#region <path>` comment per inlined module, relative to this package. A module from the pnpm store
 * reads `../../node_modules/…` from a bench that holds its own store, and `../../../../node_modules/…` from a nested worktree
 * that borrows the main checkout's (the store's realpath sits two levels further out), so one source packed two byte streams
 * (Seed-Prober, 2026-11-25). Every store region folds to the package's own spelling before the bundle lands, so the pack, its
 * manifest digest and the genesis that carries it read alike wherever the build ran. Sources (`src/…`, `../lararium-mesh/…`)
 * resolve through the package's own aliases and never move; only a region comment changes, never code.
 */

/** The store as this package spells it: the repository root's node_modules, two levels up. */
export const STORE_REGION = "../../node_modules/";

/** Fold every region comment that reaches the store through any depth of `../` to the package's own spelling. */
export function normalizeRegionPaths(text: string): string {
  return text.replace(/(\/\/#region )(?:\.\.\/)+node_modules\//g, (_m, head: string) => `${head}${STORE_REGION}`);
}
