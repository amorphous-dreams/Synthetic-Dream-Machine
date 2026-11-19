/**
 * shim-locate — where the checkout's container shim rests, and the exit a missing shim answers. Kept apart from the host
 * bridge so a host verb that only needs the shim's path (lares surface) reaches no option reads of other doors.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The exit a forward answers when no shim rests above the CLI. */
export const SHIM_ABSENT_EXIT = 69;

/** The checkout's shim, found by walking up from this module (a symlinked bin resolves to its real path). */
export function locateShim(from: string = fileURLToPath(import.meta.url)): string | null {
  let dir = dirname(from);
  for (;;) {
    const candidate = join(dir, "tools", "lares-container.sh");
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
