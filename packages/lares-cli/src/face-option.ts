/**
 * face-option — the face a command acts as, as the person names it: `--face N`, a whole persona index from 0.
 *
 * A vessel wears no face between commands. A command that acts as one face names it here; naming none, the vessel resolves the
 * one face standing open, and several faces standing with none named refuse by name (`face-selector`). A malformed `--face`
 * refuses here, before any door opens.
 */
import type { ParsedArgs } from "./parse-args.js";
import { sealedAct } from "./sealed-act-door.js";

export class FaceOptionMalformed extends Error {
  override readonly name = "FaceOptionMalformed";
}

/** `--face N` as a row argument: `{ face: N }`, or nothing where the command named none. */
export function faceOption(args: ParsedArgs): { face?: number } {
  const raw = args.options["face"];
  if (args.flags["face"] !== undefined) throw new FaceOptionMalformed("face-malformed: --face names a persona index: give it one, as `--face 1`");
  if (raw === undefined) return {};
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new FaceOptionMalformed(`face-malformed: --face names a persona index, a whole number from 0, never ${JSON.stringify(raw)}`);
  }
  return { face: Number(raw) };
}

/** The face this command acts as: the one `--face` names, else the one the vessel resolves (the one face standing open). */
export async function actingFace(args: ParsedArgs): Promise<number> {
  return (await sealedAct<{ face: number }>("face.resolve", faceOption(args))).face;
}
