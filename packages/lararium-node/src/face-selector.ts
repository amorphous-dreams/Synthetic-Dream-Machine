/**
 * face-selector — which face a command acts as. Never a silent `h0`, and never a face the vessel "wears" between commands.
 *
 * A command that signs or reads as one face resolves it in this order: the face the caller NAMED (`--face N`); else the ONE face
 * standing open on this vessel's custody. With several faces open and none named it refuses by name and lists them, whichever
 * of them holds its anchors, so an act never lands on whichever face stands first or rests most complete. The face the composition mounts
 * (the unlock's choice) is the composition's own state, and no command reads it here.
 */
import { unlockedFaceOrdinals } from "./custody-seat.js";

export class FaceNotNamed extends Error {}

export async function resolveFace(named?: number): Promise<number> {
  if (named !== undefined) return named;
  const open = await unlockedFaceOrdinals();   // a locked custody refuses here, by its own name
  if (open.length === 1) return open[0]!;
  if (open.length === 0) throw new FaceNotNamed("this vessel holds no face: found one with `lares persona new`");
  throw new FaceNotNamed(`this vessel stands faces ${open.map((i) => `h${i}`).join(", ")} open: name the face the command acts as (--face N)`);
}
