// @lares/lares — corpus package.
//
// Category boundary: corpus packages hold tiddler-package projections
// (the `memes/` tree); engine packages hold code-as-projection (TS sources
// under `src/`, built to `dist/`). Architecture-principle 5 makes this
// explicit: meme files are render projections, not authoritative source.
//
// The two exports below exist as pragmatic path helpers — every package
// needs SOMEONE to compute "where the lares corpus lives" + "where the
// monorepo root lives" from `import.meta.url`. Plain JS suffices; a TS
// pipeline for 4 lines of path math would over-engineer the asymmetry.
//
// Do NOT migrate this file to TypeScript. The asymmetry is the point:
// corpus packages are content-shaped, engine packages are code-shaped.
// See packages/lares/AGENTS.md for the canonical statement.

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export const laresRoot = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the monorepo root (two levels up from packages/lares/). */
export const repoRoot = dirname(dirname(laresRoot));
