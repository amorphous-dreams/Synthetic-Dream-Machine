/**
 * mcp-aho-child — the child `lares mcp aho` spawns when its line names none: the house's own surface, resolved at each spawn.
 *
 * A harness config records the bare verb (`resolveLaresMcp`), so the aho finds what stands beneath it here: the main clone this
 * CLI runs from, and the surface that clone's house answers through (`resolveLaresSurface`: the image's seat through the
 * compose file where the container house stands, else the clone's seat on the venv). A compose file that moves, an
 * interpreter that changes or a house that changes form reaches the next spawn with no config rewritten.
 *
 * This module loads the resolver's own imports, so the aho loads it only when its line names no child.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLaresSurface } from "./mcp-resolve.js";
import { mainCloneOf } from "./reality-tunnel/catalog.js";

/** The checkout this CLI runs from: `packages/lares-cli/dist/src` sits four levels beneath it. */
const CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** The surface's argv and the env it adds, or null while none resolves. */
export function resolveAhoChild(): { argv: string[]; env: Record<string, string> } | null {
  const surface = resolveLaresSurface(mainCloneOf(CHECKOUT));
  return surface === null ? null : { argv: [surface.command, ...surface.args], env: surface.env };
}
