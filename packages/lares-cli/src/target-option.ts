/**
 * target-option — the lit face a read VISITS, as the person names it: `--target <h1 | 1 | pet name>`.
 *
 * A LIT FACE RECEIVES VISITS (operator ruling 2026-11-20, state/decisions "the cross-face reach"): a read (`tiddler get`,
 * `wiki filter | render | status`, `meme get | list`) names another lit face it READS while the command keeps the face it
 * wears; the vessel's door resolves a pet name to its handle index. A shut face refuses `face-not-open`, a write naming another
 * face refuses `cross-face-write-refused`, and a face's personal layer never answers a visit (`cross-face-private`). `--face N`
 * stays the face a command ACTS AS; `--target` never wears a face.
 */
import type { ParsedArgs } from "./parse-args.js";
import { DoorUsage } from "./commands/door-call.js";

/** A `--target` that names no face: a bare flag, or an empty word. */
export class TargetOptionMalformed extends Error {
  override readonly name = "TargetOptionMalformed";
}

/** `--target <h1 | 1 | pet name>` as the verb's `target` argument: `{ target }`, or nothing where the command named none. */
export function targetOption(args: ParsedArgs): { target?: string } {
  if (args.flags["target"] !== undefined) throw new TargetOptionMalformed("target-malformed: --target names the lit face a read visits: give it one, as `--target h1` or `--target <pet name>`");
  const raw = args.options["target"];
  if (raw === undefined) return {};
  const word = raw.trim();
  if (word === "") throw new TargetOptionMalformed("target-malformed: --target names the lit face a read visits, by handle index (`h1`) or pet name");
  return { target: word };
}

/** The tiddler door's `--target` as the verb's `target` arg, or nothing; a malformed one refuses as the door's usage. Only the
 *  doors that read a target import this module, so no other command's accepts row answers for the flag. */
export function targetOf(args: ParsedArgs): { target?: string } {
  try { return targetOption(args); }
  catch (error) { if (error instanceof TargetOptionMalformed) throw new DoorUsage(error.message); throw error; }
}

/** The refusal a write naming `--target` answers before any door opens: a visit reads, and a write to another face waits on
 *  the rusuban rite (its own lane, its own lei). */
export function targetOnWriteRefusal(door: string): string {
  return `cross-face-write-refused: \`lares ${door}\` writes the face you wear, and --target names a face to READ; a write to another face waits on the rusuban rite, so nothing moved`;
}
