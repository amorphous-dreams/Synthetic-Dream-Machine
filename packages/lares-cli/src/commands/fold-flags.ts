/**
 * A FOLD READS ONLY ITS OWN FLAGS. The door's `accepts` row checks the whole door, so a path folded beneath a wide
 * parent (`sense analyze --lens <x>`, `sense pour --bulk`, `sense roster`) would take a flag it never reads and say
 * nothing. Each fold names what it reads; any other flag on the line refuses by name. The door-wide flags (`--json`,
 * `--help`, …) and the threaded `sensorium-root` ride every path. Kept local and small until the door table carries
 * sub-verb accepts of its own, where these lists move.
 */
import type { ParsedArgs } from "../parse-args.js";

const DOOR_WIDE: ReadonlySet<string> = new Set(["json", "help", "meme", "yes", "skip-build", "keyhive-trace", "sensorium-root"]);

/** The first flag on the line this path does not read, spelled as typed (`--signal`), or undefined. */
export function unreadFlag(args: ParsedArgs, reads: readonly string[]): string | undefined {
  const read = new Set(reads);
  const name = [...Object.keys(args.options), ...Object.keys(args.flags)].find((n) => !DOOR_WIDE.has(n) && !read.has(n));
  return name === undefined ? undefined : `--${name}`;
}
